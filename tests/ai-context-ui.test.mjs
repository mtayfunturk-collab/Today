import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const indexSource = await readFile(
  new URL("../index.html", import.meta.url),
  "utf8"
);
const uiSource = await readFile(
  new URL("../modules/ai-context-ui.mjs", import.meta.url),
  "utf8"
);
const swSource = await readFile(
  new URL("../sw.js", import.meta.url),
  "utf8"
);

const dom = new JSDOM(indexSource, {
  url: "https://example.test/Today/",
  runScripts: "outside-only"
});
const { window } = dom;
const { document } = window;
const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  TodayAIContextSources: globalThis.TodayAIContextSources
};

globalThis.window = window;
globalThis.document = document;

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

const observed = [];
let holdNextRequest = false;
let releaseHeldRequest = null;
const today = localDateKey(new Date());
globalThis.TodayAIContextSources = Object.freeze({
  async collectEvents(options) {
    observed.push(options);
    if (holdNextRequest) {
      holdNextRequest = false;
      await new Promise(resolve => {
        releaseHeldRequest = resolve;
      });
    }
    return Object.freeze({
      events: Object.freeze([
        Object.freeze({
          schemaVersion: 1,
          eventId: "core:ui-synthetic",
          source: "today-core",
          eventType: "daily-checkin",
          createdAt: new Date(Date.now() - 60_000).toISOString(),
          localDate: today,
          payload: Object.freeze({ choice: "C", color: "blue" })
        }),
        Object.freeze({
          schemaVersion: 1,
          eventId: "health:ui-synthetic",
          source: "today-health",
          eventType: "sleep-record",
          createdAt: new Date(Date.now() - 120_000).toISOString(),
          localDate: today,
          payload: Object.freeze({ durationMinutes: 330 })
        })
      ]),
      warnings: Object.freeze([])
    });
  }
});

const ui = await import(
  `../modules/ai-context-ui.mjs?test=${Date.now()}`
);
ui.initAIContextUI(document);

const results = [];
async function test(name, callback) {
  try {
    await callback();
    results.push({ name, success: true });
  } catch (error) {
    results.push({ name, success: false, error });
  }
}

const settle = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
};

await test("Ayarlar içinde erişilebilir AI bağlam yüzeyi bulunur", () => {
  const panel = document.querySelector("#aiContextPanel");
  assert.ok(panel);
  assert.equal(panel.getAttribute("aria-labelledby"), "aiContextTitle");
  assert.equal(document.querySelector("#aiContextStatus").getAttribute("role"), "status");
  assert.equal(document.querySelector("#aiConsentPurpose").textContent, ui.PURPOSE);
});

await test("Varsayılan kapsam veri-minimum Core ve temel Health seçimidir", () => {
  assert.equal(
    document.querySelectorAll('[data-ai-context-source="core"]:checked').length,
    2
  );
  assert.equal(
    document.querySelectorAll('[data-ai-context-source="health"]:checked').length,
    4
  );
  assert.equal(
    document.querySelectorAll('[data-ai-context-source="sky"]:checked').length,
    0
  );
  assert.equal(document.querySelector('[data-ai-context-class="symptoms"]').checked, false);
  assert.equal(document.querySelector('[data-ai-context-class="note"]').checked, false);
});

await test("Sky varsayılan kapalı ve kullanıcıya sembolik sınırla açıklanır", () => {
  const text = document.querySelector("#aiContextPanel").textContent;
  assert.match(text, /Varsayılan olarak kapalıdır/);
  assert.match(text, /sağlık veya duygunun nedeni\s+sayılmaz/);
});

await test("Açık istek onayı olmadan kaynak veya Engine çağrılmaz", async () => {
  document.querySelector("#btnAiContextPreview").click();
  await settle();
  assert.equal(observed.length, 0);
  assert.match(document.querySelector("#aiContextStatus").textContent, /açıkça onaylayın/);
  assert.equal(document.querySelector("#aiContextPreview").hidden, true);
});

await test("Onay, cihaz-içi ve tek istekli politika ile kaynaklara iletilir", async () => {
  document.querySelector("#aiConsentConfirm").checked = true;
  document.querySelector("#btnAiContextPreview").click();
  await settle();
  assert.equal(observed.length, 1);
  const consent = observed[0].consent;
  assert.equal(consent.purpose, ui.PURPOSE);
  assert.deepEqual({ ...consent.processing }, {
    mode: "device-only",
    externalRecipient: null,
    retention: "request-scoped"
  });
  assert.equal(consent.permissions.sky.allowed, false);
  assert.equal(consent.permissions.sky.role, "symbolic-context-only");
});

await test("Başarılı istek Core, Health ve ayrı sembolik Sky sayılarını gösterir", () => {
  const preview = document.querySelector("#aiContextPreview");
  assert.equal(preview.hidden, false);
  const counts = document.querySelector("#aiContextCounts").textContent;
  assert.match(counts, /Core: 1/);
  assert.match(counts, /Health: 1/);
  assert.match(counts, /Sembolik Sky: 0/);
});

await test("Önizleme onay, sınır, dışlama ve aktarım durumunu görünür kılar", () => {
  const panelText = document.querySelector("#aiContextPanel").textContent;
  assert.match(panelText, /Onay: bu istek için verildi/);
  assert.match(panelText, /Sky: yalnız sembolik bağlam/);
  assert.match(panelText, /0 kayıt dışlandı/);
  assert.match(panelText, /AI önerisi üretilmedi/);
  assert.match(panelText, /cihaz dışına aktarım yapılmadı/);
});

await test("Kullanılan onay aynı kapsam için otomatik yeniden kullanılamaz", () => {
  assert.equal(document.querySelector("#aiConsentConfirm").checked, false);
  const status = ui.getStatus();
  assert.equal(status.hasRequestScopedContext, true);
  assert.equal(status.persistentConsent, false);
  assert.equal(status.aiProposalGenerated, false);
  assert.equal(status.actionStarted, false);
});

await test("Kapsam değişikliği bellekteki ve hazırlanmakta olan önizlemeyi düşürür", async () => {
  const sky = document.querySelector('[data-ai-context-source="sky"]');
  document.querySelector("#aiConsentConfirm").checked = true;
  sky.checked = true;
  sky.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(document.querySelector("#aiConsentConfirm").checked, false);
  assert.equal(document.querySelector("#aiContextPreview").hidden, true);
  assert.equal(ui.getStatus().hasRequestScopedContext, false);
  assert.match(document.querySelector("#aiContextStatus").textContent, /yeniden onay gerekir/);

  holdNextRequest = true;
  document.querySelector("#aiConsentConfirm").checked = true;
  document.querySelector("#btnAiContextPreview").click();
  await settle();
  const note = document.querySelector('[data-ai-context-class="note"]');
  note.checked = true;
  note.dispatchEvent(new window.Event("change", { bubbles: true }));
  releaseHeldRequest();
  await settle();
  assert.equal(ui.getStatus().hasRequestScopedContext, false);
  assert.equal(document.querySelector("#aiContextPreview").hidden, true);
});

await test("Temizle eylemi bağlamı, sayıları ve onay kutusunu temizler", async () => {
  document.querySelector('[data-ai-context-source="sky"]').checked = false;
  document.querySelector('[data-ai-context-class="note"]').checked = false;
  document.querySelector("#aiConsentConfirm").checked = true;
  document.querySelector("#btnAiContextPreview").click();
  await settle();
  assert.equal(ui.getStatus().hasRequestScopedContext, true);
  document.querySelector("#btnAiContextClear").click();
  assert.equal(ui.getStatus().hasRequestScopedContext, false);
  assert.equal(document.querySelector("#aiContextCounts").childElementCount, 0);
  assert.equal(document.querySelector("#aiContextPreview").hidden, true);
  assert.equal(document.querySelector("#aiConsentConfirm").checked, false);
});

await test("UI onayı veya bağlamı kalıcı depolamaya ya da ağa yazmaz", () => {
  assert.equal(window.localStorage.length, 0);
  assert.doesNotMatch(
    uiSource,
    /(?:localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket\s*\()/
  );
});

await test("Runtime dosyaları doğru sırayla yüklenir ve çevrimdışı kabuğa dahildir", async () => {
  const sourceIndex = indexSource.indexOf("ai-context-source-adapters.js");
  const uiIndex = indexSource.indexOf("ai-context-ui.mjs");
  const routerIndex = indexSource.indexOf("modules/router.js");
  assert.equal(sourceIndex > 0 && uiIndex > sourceIndex && routerIndex > uiIndex, true);
  for (const file of [
    "./modules/ai-context-source-adapters.js",
    "./modules/ai-context-bridge.mjs",
    "./modules/ai-context-ui.mjs",
    "./Today-AI-Engine/src/context-builder.mjs",
    "./Today-AI-Engine/src/data-usage-consent.mjs"
  ]) {
    assert.equal(swSource.includes(`"${file}"`), true, `${file} shell dışında`);
  }
  const shellBlock = swSource.match(
    /const APP_SHELL = \[([\s\S]*?)\n\];/
  )?.[1] || "";
  const shellFiles = [...shellBlock.matchAll(/"(\.\/[^"\n]*)"/g)]
    .map(match => match[1]);
  assert.equal(shellFiles.length, 104);
  assert.equal(new Set(shellFiles).size, shellFiles.length);
  await Promise.all(shellFiles.map(file =>
    access(new URL(`../${file.slice(2)}`, import.meta.url))
  ));
  assert.match(swSource, /today-v2-foundation-059/);
});

const failures = results.filter(result => !result.success);
failures.forEach(result => {
  console.error(`FAIL — ${result.name}`);
  console.error(result.error?.stack || result.error);
});
if (failures.length) process.exitCode = 1;
const passed = results.length - failures.length;
console.log(`NUT-017.2 Consent UI: ${passed}/${results.length} başarılı`);

if (originalGlobals.window === undefined) delete globalThis.window;
else globalThis.window = originalGlobals.window;
if (originalGlobals.document === undefined) delete globalThis.document;
else globalThis.document = originalGlobals.document;
if (originalGlobals.TodayAIContextSources === undefined) {
  delete globalThis.TodayAIContextSources;
} else {
  globalThis.TodayAIContextSources = originalGlobals.TodayAIContextSources;
}
dom.window.close();
