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
const approvalBridgeSource = await readFile(
  new URL("../modules/ai-approval-bridge.mjs", import.meta.url),
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
let observedSleepMinutes = 330;
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
          payload: Object.freeze({ durationMinutes: observedSleepMinutes })
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

const buildMatchingAnalysis = async () => {
  observedSleepMinutes = 330;
  document.querySelector("#aiConsentConfirm").checked = true;
  document.querySelector("#btnAiContextPreview").click();
  await settle();
  document.querySelector("#btnAiAnalysis").click();
  await settle();
};

await test("Ayarlar içinde erişilebilir AI bağlam yüzeyi bulunur", () => {
  const panel = document.querySelector("#aiContextPanel");
  assert.ok(panel);
  assert.equal(panel.getAttribute("aria-labelledby"), "aiContextTitle");
  assert.equal(document.querySelector("#aiContextStatus").getAttribute("role"), "status");
  assert.equal(document.querySelector("#aiConsentPurpose").textContent, ui.PURPOSE);
  assert.equal(ui.RULESET_ID, "today:ai-context-ui:nut-017.5");
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
  assert.match(document.querySelector("#aiContextStatus").textContent, /kullanımını onayla/);
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
  assert.match(counts, /Günlük kayıtlar: 1/);
  assert.match(counts, /Sağlık kayıtları: 1/);
  assert.match(counts, /Sky \(sembolik\): 0/);
});

await test("Önizleme sınırları sade kullanıcı diliyle görünür kılar", () => {
  const panelText = document.querySelector("#aiContextPanel").textContent;
  assert.match(panelText, /yalnız bu işlem için cihazında hazırlandı/);
  assert.match(panelText, /Sky yalnız sembolik kalır/);
  assert.match(panelText, /0 kapsam dışı kayıt/);
  assert.match(panelText, /Henüz öneri veya başka bir işlem oluşturulmadı/);
  assert.match(panelText, /cihazından çıkarılmadı/);
  assert.doesNotMatch(panelText, /no-eligible-fields|not-needed-for-purpose/);
});

await test("Kullanılan onay aynı kapsam için otomatik yeniden kullanılamaz", () => {
  assert.equal(document.querySelector("#aiConsentConfirm").checked, false);
  const status = ui.getStatus();
  assert.equal(status.hasRequestScopedContext, true);
  assert.equal(status.persistentConsent, false);
  assert.equal(status.aiProposalGenerated, false);
  assert.equal(status.actionStarted, false);
});

await test("Analiz bağlamdan ayrı ve açık kullanıcı komutu bekler", async () => {
  assert.equal(document.querySelector("#aiAnalysisRequest").hidden, false);
  assert.equal(document.querySelector("#aiAnalysisOutput").hidden, true);
  assert.equal(ui.getStatus().aiProposalGenerated, false);
  document.querySelector("#btnAiAnalysis").click();
  await settle();
  assert.equal(document.querySelector("#aiAnalysisOutput").hidden, false);
  assert.equal(ui.getStatus().aiProposalGenerated, true);
});

await test("Açıklanabilir çıktı dayanak, güven, belirsizlik ve seçenekleri gösterir", () => {
  const evidence = document.querySelector("#aiAnalysisEvidence").textContent;
  assert.match(evidence, /Core günlük seçimi: Zordu bugün/);
  assert.match(evidence, /Uyku kaydı: 5 saat 30 dakika/);
  assert.doesNotMatch(evidence, /Sky/);
  assert.doesNotMatch(evidence, /core:ui-synthetic|health:ui-synthetic/);
  assert.match(document.querySelector("#aiAnalysisConfidence").textContent, /Orta/);
  assert.doesNotMatch(document.querySelector("#aiAnalysisConfidence").textContent, /%72/);
  assert.ok(document.querySelector("#aiAnalysisUncertainty").childElementCount >= 2);
  assert.ok(document.querySelector("#aiAnalysisAlternatives").childElementCount >= 3);
});

await test("Taslak anlaşılır karar seçenekleriyle onay bekler", () => {
  const status = ui.getStatus();
  assert.equal(status.providerRegistered, false);
  assert.equal(status.actionStarted, false);
  assert.equal(status.approvalState, "pending-user-approval");
  assert.equal(status.hasPendingAction, true);
  assert.equal(status.receiptCount, 0);
  assert.equal(document.querySelector("#aiDecisionReceipt").hidden, true);
  assert.equal(document.querySelector("#aiDecisionControls").hidden, false);
  assert.match(document.querySelector("#aiAnalysisApproval").textContent, /kullanmak ister misin/);
  assert.match(document.querySelector("#aiAnalysisActionLabel").textContent, /Uyku hazırlığını hatırla/);
  assert.match(document.querySelector("#aiAnalysisSkyBoundary").textContent, /Sky bu öneride kullanılmadı/);
});

await test("Düzenle yeni saatli taslak hazırlar ve yeniden onay ister", async () => {
  document.querySelector("#btnAiEdit").click();
  assert.equal(document.querySelector("#aiEditPanel").hidden, false);
  document.querySelector("#aiReminderTime").value = "21:45";
  document.querySelector("#btnAiEditSave").click();
  await settle();

  assert.equal(document.querySelector("#aiEditPanel").hidden, true);
  assert.match(document.querySelector("#aiAnalysisActionLabel").textContent, /21:45/);
  assert.match(document.querySelector("#aiDecisionStatus").textContent, /Yeni taslak onayını bekliyor/);
  assert.equal(document.querySelector("#aiDecisionControls").hidden, false);
  assert.equal(ui.getStatus().approvalState, "pending-user-approval");
  assert.equal(ui.getStatus().actionStarted, false);
  assert.equal(ui.getStatus().auditPersisted, false);
  assert.equal(ui.getStatus().receiptCount, 1);
  assert.equal(ui.getStatus().latestReceiptOutcome, "edited");
});

await test("Onay kararı görünür olur fakat hatırlatıcı çalıştırılmaz", async () => {
  document.querySelector("#btnAiApprove").click();
  await settle();

  assert.equal(ui.getStatus().approvalState, "approved");
  assert.equal(ui.getStatus().hasPendingAction, false);
  assert.equal(ui.getStatus().actionStarted, false);
  assert.equal(document.querySelector("#aiDecisionControls").hidden, true);
  assert.match(document.querySelector("#aiAnalysisApproval").textContent, /onayladın/);
  assert.match(document.querySelector("#aiDecisionStatus").textContent, /hatırlatıcı oluşturulmadı/);
});

await test("Karar geçmişi düzenleme ve onayı sade makbuzlarla gösterir", () => {
  const panel = document.querySelector("#aiDecisionReceipt");
  const items = document.querySelector("#aiDecisionReceiptItems");
  assert.equal(panel.hidden, false);
  assert.equal(items.childElementCount, 2);
  assert.match(items.textContent, /Düzenlendi/);
  assert.match(items.textContent, /Yeni taslak yeniden onay bekliyor/);
  assert.match(items.textContent, /Onaylandı/);
  assert.match(items.textContent, /İşlem yapılmadı/);
  assert.doesNotMatch(items.textContent, /receipt:|decision:|action:|analysis:/);
  assert.equal(ui.getStatus().receiptCount, 2);
  assert.equal(ui.getStatus().latestReceiptOutcome, "approved");
  assert.equal(ui.getStatus().auditPersisted, false);
});

await test("Ret kararı hiçbir işlem başlatmadan öneriyi kapatır", async () => {
  await buildMatchingAnalysis();
  document.querySelector("#btnAiReject").click();
  await settle();

  assert.equal(ui.getStatus().approvalState, "rejected");
  assert.equal(ui.getStatus().hasPendingAction, false);
  assert.equal(ui.getStatus().actionStarted, false);
  assert.equal(document.querySelector("#aiDecisionControls").hidden, true);
  assert.match(document.querySelector("#aiAnalysisApproval").textContent, /kullanmamayı seçtin/);
  assert.match(document.querySelector("#aiDecisionStatus").textContent, /Hiçbir işlem yapılmadı/);
  assert.equal(document.querySelector("#aiDecisionReceiptItems").childElementCount, 1);
  assert.match(document.querySelector("#aiDecisionReceiptItems").textContent, /Reddedildi/);
  assert.equal(ui.getStatus().receiptCount, 1);
  assert.equal(ui.getStatus().latestReceiptOutcome, "rejected");
});

await test("Kullanıcı yüzeyi teknik kimlik ve sürüm kodu göstermez", () => {
  const visibleText = document.querySelector("#aiContextPanel").textContent;
  assert.doesNotMatch(visibleText, /core:ui-synthetic|health:ui-synthetic/);
  assert.doesNotMatch(visibleText, /NUT-017|schemaVersion|eventId|rulesetId/);
});

await test("Eşleşmeme tanısı değerlendirilen Core, uyku ve tarih koşullarını gösterir", async () => {
  observedSleepMinutes = 420;
  document.querySelector("#aiConsentConfirm").checked = true;
  document.querySelector("#btnAiContextPreview").click();
  await settle();
  document.querySelector("#btnAiAnalysis").click();
  await settle();

  const diagnostic = document.querySelector("#aiRuleEvaluation");
  assert.equal(diagnostic.hidden, false);
  assert.equal(document.querySelector("#aiAnalysisOutput").hidden, true);
  assert.match(diagnostic.textContent, /Günlük seçim: Zordu bugün/);
  assert.match(diagnostic.textContent, /Uyku: 7 saat/);
  assert.match(diagnostic.textContent, /Kayıtlar aynı güne ait/);
  assert.match(
    document.querySelector("#aiRuleEvaluationSummary").textContent,
    /6 saatin altında değil/
  );
  assert.match(document.querySelector("#aiContextStatus").textContent, /öneri oluşmadı/i);
  assert.doesNotMatch(document.querySelector("#aiContextStatus").textContent, /NUT-/);
  assert.equal(ui.getStatus().aiProposalGenerated, false);
  observedSleepMinutes = 330;
});

await test("Kapsam değişikliği bellekteki ve hazırlanmakta olan önizlemeyi düşürür", async () => {
  const sky = document.querySelector('[data-ai-context-source="sky"]');
  document.querySelector("#aiConsentConfirm").checked = true;
  sky.checked = true;
  sky.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(document.querySelector("#aiConsentConfirm").checked, false);
  assert.equal(document.querySelector("#aiContextPreview").hidden, true);
  assert.equal(document.querySelector("#aiAnalysisOutput").hidden, true);
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
  assert.equal(document.querySelector("#aiAnalysisOutput").hidden, true);
  assert.equal(document.querySelector("#aiAnalysisSummary").textContent, "");
  assert.equal(document.querySelector("#aiAnalysisEvidence").childElementCount, 0);
  assert.equal(document.querySelector("#aiDecisionReceiptItems").childElementCount, 0);
  assert.equal(document.querySelector("#aiDecisionReceipt").hidden, true);
  assert.equal(ui.getStatus().receiptCount, 0);
  assert.equal(document.querySelector("#aiConsentConfirm").checked, false);
});

await test("UI onayı veya seçilen bilgiler kalıcı depolamaya ya da ağa yazılmaz", () => {
  assert.equal(window.localStorage.length, 0);
  for (const source of [uiSource, approvalBridgeSource]) {
    assert.doesNotMatch(
      source,
      /(?:localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket\s*\()/
    );
  }
});

await test("Runtime dosyaları doğru sırayla yüklenir ve çevrimdışı kabuğa dahildir", async () => {
  const sourceIndex = indexSource.indexOf("ai-context-source-adapters.js");
  const uiIndex = indexSource.indexOf("ai-context-ui.mjs");
  const routerIndex = indexSource.indexOf("modules/router.js");
  assert.equal(sourceIndex > 0 && uiIndex > sourceIndex && routerIndex > uiIndex, true);
  for (const file of [
    "./modules/ai-context-source-adapters.js",
    "./modules/ai-context-bridge.mjs",
    "./modules/ai-analysis-bridge.mjs",
    "./modules/ai-approval-bridge.mjs",
    "./modules/ai-context-ui.mjs",
    "./Today-AI-Engine/src/context-builder.mjs",
    "./Today-AI-Engine/src/data-usage-consent.mjs",
    "./Today-AI-Engine/src/daily-support-analyzer.mjs",
    "./Today-AI-Engine/src/approval-decision-processor.mjs",
    "./Today-AI-Engine/src/decision-receipt-builder.mjs"
  ]) {
    assert.equal(swSource.includes(`"${file}"`), true, `${file} shell dışında`);
  }
  const shellBlock = swSource.match(
    /const APP_SHELL = \[([\s\S]*?)\n\];/
  )?.[1] || "";
  const shellFiles = [...shellBlock.matchAll(/"(\.\/[^"\n]*)"/g)]
    .map(match => match[1]);
  assert.equal(shellFiles.length, 109);
  assert.equal(new Set(shellFiles).size, shellFiles.length);
  await Promise.all(shellFiles.map(file =>
    access(new URL(`../${file.slice(2)}`, import.meta.url))
  ));
  assert.match(swSource, /today-v2-foundation-064/);
});

const failures = results.filter(result => !result.success);
failures.forEach(result => {
  console.error(`FAIL — ${result.name}`);
  console.error(result.error?.stack || result.error);
});
if (failures.length) process.exitCode = 1;
const passed = results.length - failures.length;
console.log(`NUT-017.5 Consent, Analysis, Decision & Receipt UI: ${passed}/${results.length} başarılı`);

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
