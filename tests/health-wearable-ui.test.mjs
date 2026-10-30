import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { mountWearableUI, PURPOSE } from "../modules/health-wearable-ui.mjs";
import { wearableContextSession } from "../modules/wearable-context-session.mjs";

let checks = 0;
const days = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0")].join("-");
const sample = { type: "steps", localDate: days(new Date()), value: 1234, unit: "count", provider: "health-connect", aggregation: "daily-deduplicated" };
const success = { ok: true, samples: [sample] };
const pause = () => new Promise(resolve => setTimeout(resolve, 0));

async function check(name, callback) {
  await callback(); checks += 1;
  console.log(`PASS: ${name}`);
}

async function fixture({ supported = true, result = success, read, factory } = {}) {
  const dom = new JSDOM('<!doctype html><section id="wellnessPersonalDataPanel"></section>', {
    url: "https://example.test/Today/"
  });
  const calls = [];
  const reader = {
    getAvailability: () => ({ supported, provider: supported ? "apple-health" : null, connected: false }),
    async read(scope) { calls.push(scope); return read ? read(scope) : result; }
  };
  const api = await mountWearableUI({ root: dom.window.document, readerFactory: factory || (() => reader) });
  const $ = id => dom.window.document.getElementById(id);
  const change = node => node.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  const select = (type, value = true) => {
    const input = dom.window.document.querySelector(`[data-wearable-type="${type}"]`);
    input.checked = value; change(input);
  };
  const consent = () => { $("wearableReadConsent").checked = true; change($("wearableReadConsent")); };
  const period = value => { $("wearableReadDays").value = String(value); change($("wearableReadDays")); };
  return { dom, api, calls, $, change, select, consent, period, close: () => dom.window.close() };
}

await check("mount does not read or request permission; duplicate mount is idempotent", async () => {
  const f = await fixture();
  try {
    assert.deepEqual(f.calls, []);
    assert.equal(f.$("btnWearableRead").disabled, true);
    const api = await mountWearableUI({ root: f.dom.window.document, readerFactory: () => { throw Error("second factory"); } });
    assert.equal(api, f.api);
    assert.equal(f.dom.window.document.querySelectorAll("#wearableReadConsent").length, 1);
  } finally { f.close(); }
});

await check("missing native provider is shown honestly with no enabled read", async () => {
  const f = await fixture({ supported: false });
  try {
    f.select("steps"); f.consent(); f.$("btnWearableRead").click();
    assert.equal(f.api.getState().supported, false);
    assert.match(f.$("wearableAvailability").textContent, /Bu sürümde saat verisine erişim yok/);
    assert.deepEqual(f.calls, []);
    assert.doesNotMatch(f.$("wearableAvailability").textContent, /bağlı/);
  } finally { f.close(); }
});

await check("factory failure does not reveal native error details", async () => {
  const f = await fixture({ factory: async () => { throw new Error("private health token"); } });
  try {
    assert.equal(f.api.getState().supported, false);
    assert.doesNotMatch(f.dom.window.document.body.textContent, /private health token/);
    assert.equal(f.$("btnWearableRead").disabled, true);
  } finally { f.close(); }
});

await check("both selected types and fresh consent are required", async () => {
  const f = await fixture();
  try {
    f.consent(); assert.equal(f.$("btnWearableRead").disabled, true);
    f.select("steps"); assert.equal(f.$("wearableReadConsent").checked, false);
    f.$("btnWearableRead").click(); assert.equal(f.calls.length, 0);
    f.consent(); assert.equal(f.$("btnWearableRead").disabled, false);
  } finally { f.close(); }
});

await check("only chosen types and bounded local inclusive date windows reach the reader", async () => {
  const f = await fixture();
  try {
    f.select("sleep"); f.select("activity");
    for (const count of [1, 7, 30]) {
      f.period(count); f.consent(); f.$("btnWearableRead").click(); await pause();
      const scope = f.calls.at(-1);
      const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setDate(start.getDate() - (count - 1));
      assert.deepEqual(scope.types, ["sleep", "activity"]);
      assert.equal(scope.startDate, days(start)); assert.equal(scope.endDate, days(now));
      assert.equal(scope.userConfirmed, true); assert.equal(scope.purpose, PURPOSE);
      assert.equal(f.$("wearableReadConsent").checked, false);
    }
    assert.deepEqual([...f.$("wearableReadDays").options].map(option => option.value), ["1", "7", "30"]);
  } finally { f.close(); }
});

await check("successful daily summaries are rendered without automatic saving or AI transfer", async () => {
  const f = await fixture();
  try {
    f.dom.window.localStorage.setItem("existing-synthetic-data", "preserve");
    const before = JSON.stringify({ ...f.dom.window.localStorage });
    f.dom.window.indexedDB = { open() { throw Error("No database writes allowed"); } };
    f.dom.window.fetch = () => { throw Error("No outbound transfer allowed"); };
    f.select("steps"); f.consent(); f.$("btnWearableRead").click(); await pause();
    assert.match(f.$("wearableReadResults").textContent, /1234 adım/);
    assert.match(f.$("wearableReadResults").textContent, /kalıcı bağlantı veya kayıt oluşturulmadı/);
    assert.equal(f.api.getState().hasResult, true);
    assert.equal(JSON.stringify({ ...f.dom.window.localStorage }), before);
    assert.equal(f.$("wearableReadConsent").checked, false);
    assert.equal(f.$("btnWearableRead").disabled, true);
  } finally { f.close(); }
});

await check("empty HealthKit read is not presented as permission denial or zero sample", async () => {
  const f = await fixture({ result: { ok: true, samples: [], permissionState: "not-inferred" } });
  try {
    f.select("steps"); f.consent(); f.$("btnWearableRead").click(); await pause();
    assert.match(f.$("wearableReadStatus").textContent, /izni reddettiğin anlamına gelmeyebilir/);
    assert.equal(f.$("wearableReadResults").textContent, "");
    assert.equal(f.api.getState().hasResult, false);
  } finally { f.close(); }
});

await check("changing types or window clears results and requires new consent", async () => {
  const f = await fixture();
  try {
    f.select("steps"); f.consent(); f.$("btnWearableRead").click(); await pause();
    f.select("sleep");
    assert.equal(f.$("wearableReadResults").textContent, ""); assert.equal(f.$("wearableReadConsent").checked, false);
    f.consent(); f.$("btnWearableRead").click(); await pause(); f.period(30);
    assert.equal(f.$("wearableReadResults").textContent, ""); assert.equal(f.$("wearableReadConsent").checked, false);
  } finally { f.close(); }
});

await check("double clicks cannot start overlapping native reads", async () => {
  let release;
  const f = await fixture({ read: () => new Promise(resolve => { release = resolve; }) });
  try {
    f.select("steps"); f.consent(); f.$("btnWearableRead").click(); f.$("btnWearableRead").click();
    assert.equal(f.calls.length, 1); assert.equal(f.api.getState().busy, true);
    assert.equal(f.$("btnWearableRead").getAttribute("aria-busy"), "true");
    release(success); await pause(); assert.equal(f.api.getState().busy, false);
  } finally { f.close(); }
});

await check("changed scope discards late result and blocks overlap until pending read settles", async () => {
  let release;
  const f = await fixture({ read: () => new Promise(resolve => { release = resolve; }) });
  try {
    f.select("steps"); f.consent(); f.$("btnWearableRead").click();
    f.period(30); f.consent(); f.$("btnWearableRead").click();
    assert.equal(f.calls.length, 1); assert.equal(f.$("btnWearableRead").disabled, true);
    release(success); await pause();
    assert.equal(f.$("wearableReadResults").textContent, ""); assert.equal(f.api.getState().hasResult, false);
    assert.equal(f.api.getState().busy, false);
    assert.match(f.$("wearableReadStatus").textContent, /Dönem değişti/);
  } finally { f.close(); }
});

await check("clear removes preview and suppresses a late response", async () => {
  let release;
  const f = await fixture({ read: () => new Promise(resolve => { release = resolve; }) });
  try {
    f.select("steps"); f.consent(); f.$("btnWearableRead").click(); f.$("btnWearableClear").click();
    release(success); await pause();
    assert.equal(f.$("wearableReadResults").textContent, ""); assert.equal(f.$("wearableReadConsent").checked, false);
    assert.match(f.$("wearableReadStatus").textContent, /Önizleme temizlendi/);
  } finally { f.close(); }
});

await check("revoking consent clears preview and suppresses pending result", async () => {
  let release;
  const f = await fixture({ read: () => new Promise(resolve => { release = resolve; }) });
  try {
    f.select("steps"); f.consent(); f.$("btnWearableRead").click();
    f.$("wearableReadConsent").checked = false; f.change(f.$("wearableReadConsent"));
    release(success); await pause();
    assert.equal(f.$("wearableReadResults").textContent, ""); assert.equal(f.api.getState().hasResult, false);
  } finally { f.close(); }
});

await check("scope changes revoke pending read signals and each retry receives a fresh signal", async () => {
  const releases = [];
  const signals = [];
  let healthReads = 0;
  const f = await fixture({ read: scope => new Promise(resolve => {
    signals.push(scope.signal);
    releases.push(() => {
      if (!scope.signal.aborted) healthReads += 1;
      resolve(success);
    });
  }) });
  try {
    const invalidations = [
      () => f.period(30),
      () => f.select("sleep"),
      () => { f.$("wearableReadConsent").checked = false; f.change(f.$("wearableReadConsent")); },
      () => f.$("btnWearableClear").click()
    ];
    f.select("steps");
    for (const invalidate of invalidations) {
      f.consent(); f.$("btnWearableRead").click();
      const signal = signals.at(-1);
      assert.ok(signal instanceof f.dom.window.AbortSignal);
      assert.equal(signal.aborted, false);
      invalidate();
      assert.equal(signal.aborted, true);
      assert.equal(f.api.getState().busy, true, "OS prompt is still pending; cancellation must not claim it closed");
      const count = f.calls.length;
      f.consent(); f.$("btnWearableRead").click();
      assert.equal(f.calls.length, count, "An outstanding OS prompt must block overlapping requests");
      releases.at(-1)(); await pause();
      assert.equal(healthReads, 0);
      assert.equal(f.$("wearableReadResults").textContent, "");
      assert.equal(f.api.getState().busy, false);
    }
    f.consent(); f.$("btnWearableRead").click();
    assert.equal(signals.at(-1).aborted, false);
    assert.equal(new Set(signals).size, 5, "Aborted signals must never be reused for later consent");
    releases.at(-1)(); await pause();
    assert.equal(healthReads, 1);
    assert.match(f.$("wearableReadResults").textContent, /1234 adım/);
    assert.equal(signals.at(-1).aborted, false);
  } finally { f.close(); }
});

await check("provider errors are generic and do not leak rejected payloads", async () => {
  for (const patch of [
    { result: { ok: false, error: { code: "private health details" } } },
    { read: async () => { throw Error("private health details"); } }
  ]) {
    const f = await fixture(patch);
    try {
      f.select("steps"); f.consent(); f.$("btnWearableRead").click(); await pause();
      assert.match(f.$("wearableReadStatus").textContent, /Veriler okunamadı/);
      assert.doesNotMatch(f.dom.window.document.body.textContent, /private health details/);
      assert.equal(f.api.getState().busy, false); assert.equal(f.$("wearableReadConsent").checked, false);
    } finally { f.close(); }
  }
});

await check("invalid sample markup is rejected before it can enter preview or AI memory", async () => {
  const f = await fixture({ result: { ok: true, samples: [
    { type: "activity", localDate: '<img src=x onerror="alert(1)">', value: 0, unit: "min" }
  ] } });
  try {
    f.select("activity"); f.consent(); f.$("btnWearableRead").click(); await pause();
    assert.equal(f.$("wearableReadResults").textContent, '');
    assert.match(f.$("wearableReadStatus").textContent, /doğrulanamadı/);
    assert.equal(f.$("wearableReadResults").querySelector("img"), null);
  } finally { f.close(); }
});

await check("valid zero activity summary retains its separate unit and session meaning", async () => {
  const f = await fixture({ result: { ok: true, samples: [{ ...sample, type: 'activity', value: 0, unit: 'min' }] } });
  try {
    f.select('activity'); f.period(1); f.consent(); f.$('btnWearableRead').click(); await pause();
    assert.match(f.$('wearableReadResults').textContent, /Antrenman oturumu süresi: 0 dakika/);
    assert.match(f.dom.window.document.body.textContent, /molaları içerebilir/);
  } finally { f.close(); }
});

await check("missing mount point safely does nothing", async () => {
  const dom = new JSDOM("<!doctype html><p>No panel</p>");
  try {
    assert.equal(await mountWearableUI({ root: dom.window.document, readerFactory: () => { throw Error("must not call"); } }), null);
  } finally { dom.window.close(); }
});

await check("automatic lifecycle waits for successful startup before mounting", async () => {
  const dom = new JSDOM('<!doctype html><section id="wellnessPersonalDataPanel"></section>', {
    url: "https://example.test/Today/"
  });
  const prior = { window: globalThis.window, document: globalThis.document };
  let phase = "failed";
  dom.window.TodayStartup = { getStatus: () => ({ phase }) };
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  try {
    await import(`../modules/health-wearable-ui.mjs?lifecycle=${Date.now()}`);
    await pause();
    dom.window.dispatchEvent(new dom.window.Event("today:startup-ready"));
    assert.equal(dom.window.document.getElementById("wearableAvailability"), null);
    phase = "ready";
    dom.window.dispatchEvent(new dom.window.Event("today:startup-ready"));
    await pause();
    assert.ok(dom.window.document.getElementById("wearableAvailability"));
    assert.equal(dom.window.document.getElementById("btnWearableRead").disabled, true);
    assert.equal(dom.window.localStorage.length, 0);
  } finally {
    dom.window.close();
    if (prior.window === undefined) delete globalThis.window; else globalThis.window = prior.window;
    if (prior.document === undefined) delete globalThis.document; else globalThis.document = prior.document;
  }
});

await check("deferred interactive module retries after classic Health Hub creates its panel", async () => {
  const dom = new JSDOM("<!doctype html><main></main>", { url: "https://example.test/Today/" });
  const prior = { window: globalThis.window, document: globalThis.document };
  try {
    // Finish JSDOM's own loading first, then control the browser's deferred-module ordering.
    await pause();
    let readyState = "interactive";
    Object.defineProperty(dom.window.document, "readyState", { configurable: true, get: () => readyState });
    dom.window.TodayStartup = { getStatus: () => ({ phase: "ready" }) };
    dom.window.document.addEventListener("DOMContentLoaded", () => {
      const panel = dom.window.document.createElement("section");
      panel.id = "wellnessPersonalDataPanel";
      dom.window.document.querySelector("main").append(panel);
      readyState = "complete";
    }, { once: true });
    globalThis.window = dom.window; globalThis.document = dom.window.document;
    await import(`../modules/health-wearable-ui.mjs?deferred-lifecycle=${Date.now()}`);
    assert.equal(dom.window.document.getElementById("wearableAvailability"), null);
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
    await pause();
    assert.ok(dom.window.document.getElementById("wearableAvailability"));
    dom.window.dispatchEvent(new dom.window.Event("today:health-hub-ready"));
    await pause();
    assert.equal(dom.window.document.querySelectorAll("#wearableAvailability").length, 1);
  } finally {
    dom.window.close();
    if (prior.window === undefined) delete globalThis.window; else globalThis.window = prior.window;
    if (prior.document === undefined) delete globalThis.document; else globalThis.document = prior.document;
  }
});

await check("successful preview is available only in memory and clearing revokes AI source", async () => {
  const f = await fixture();
  try {
    f.select('steps'); f.period(1); f.consent(); f.$('btnWearableRead').click(); await pause();
    const scope = { startDate: sample.localDate, endDate: sample.localDate, types: ['steps'] };
    assert.equal(wearableContextSession.getSnapshot(scope).samples[0].value, 1234);
    f.$('btnWearableClear').click();
    assert.equal(wearableContextSession.getSnapshot(scope), null);
  } finally { f.close(); }
});
console.log(`NUT-019.2 Wearable UI: ${checks}/${checks} başarılı`);
