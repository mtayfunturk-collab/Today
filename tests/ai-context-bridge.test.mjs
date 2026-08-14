import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildContextPreview,
  getStatus
} from "../modules/ai-context-bridge.mjs";

const loadJson = async relativePath => JSON.parse(
  await readFile(new URL(relativePath, import.meta.url), "utf8")
);
const clone = value => JSON.parse(JSON.stringify(value));
const request = await loadJson(
  "../Today-AI-Engine/fixtures/synthetic/nut-017.1-context-request.json"
);
const bridgeSource = await readFile(
  new URL("../modules/ai-context-bridge.mjs", import.meta.url),
  "utf8"
);
const analysisSchema = await loadJson(
  "../Today-AI-Engine/contracts/analysis-output.schema.json"
);

function options(overrides = {}) {
  return {
    requestId: request.requestId,
    purpose: request.purpose,
    requestedAt: request.requestedAt,
    window: clone(request.window),
    consent: clone(request.consent),
    ...overrides
  };
}

function sourceApi(overrides = {}) {
  return {
    async collectEvents() {
      return {
        events: clone(request.events),
        warnings: [{ source: "sentetik", reason: "test-warning" }]
      };
    },
    ...overrides
  };
}

const results = [];
async function test(name, callback) {
  try {
    await callback();
    results.push({ name, success: true });
  } catch (error) {
    results.push({ name, success: false, error });
  }
}

await test("Köprü public durumu cihaz-içi ve sağlayıcısız sınırı açıklar", () => {
  const missing = getStatus({ sourceApi: null });
  assert.equal(missing.ready, false);
  const ready = getStatus({ sourceApi: sourceApi() });
  assert.deepEqual(clone({
    ready: ready.ready,
    processingMode: ready.processingMode,
    retention: ready.retention,
    externalRecipient: ready.externalRecipient
  }), {
    ready: true,
    processingMode: "device-only",
    retention: "request-scoped",
    externalRecipient: null
  });
  assert.equal(Object.isFrozen(ready), true);
});

await test("Geçerli onay App olaylarından NUT-017.1 bağlamı üretir", async () => {
  const result = await buildContextPreview(
    options(),
    { sourceApi: sourceApi() }
  );
  assert.equal(result.success, true);
  assert.equal(result.context.schemaVersion, 1);
  assert.equal(result.context.processing.mode, "device-only");
  assert.equal(result.context.boundaries.externalTransfer, false);
  assert.equal(result.sourceEventCount, request.events.length);
  assert.deepEqual(clone(result.sourceWarnings), [
    { source: "sentetik", reason: "test-warning" }
  ]);
});

await test("Dar App onay fişi amaç ve zamanla sınırlı kalır", async () => {
  const result = await buildContextPreview(
    options(),
    { sourceApi: sourceApi() }
  );
  assert.deepEqual(clone(result.appConsent), {
    granted: true,
    purpose: request.purpose,
    grantedAt: request.consent.grantedAt
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.context.sections.health), true);
});

await test("Sky yalnız sembolik bölümde ve nedensellik kapalı kalır", async () => {
  const result = await buildContextPreview(
    options(),
    { sourceApi: sourceApi() }
  );
  assert.equal(result.context.sections.symbolicContext.role, "symbolic-context-only");
  assert.equal(result.context.sections.symbolicContext.causalityClaim, false);
  assert.equal(result.context.boundaries.skyCausalityAllowed, false);
  assert.equal(
    result.context.sections.core.some(item => item.source === "today-sky"),
    false
  );
  assert.equal(
    result.context.sections.health.some(item => item.source === "today-sky"),
    false
  );
});

await test("Amaç uyuşmazlığında kaynaklara erişmeden onay reddedilir", async () => {
  let called = false;
  const result = await buildContextPreview(
    options({ purpose: "Başka amaç" }),
    { sourceApi: sourceApi({ collectEvents: async () => { called = true; } }) }
  );
  assert.deepEqual(clone(result), {
    success: false,
    errorCode: "TODAY-AI-CONTEXT-CONSENT",
    consentError: "consent-purpose-mismatch"
  });
  assert.equal(called, false);
});

await test("İptal ve cihaz-dışı onay politikaları kapalı kalır", async () => {
  const revoked = clone(request.consent);
  revoked.revokedAt = request.requestedAt;
  const revokedResult = await buildContextPreview(
    options({ consent: revoked }),
    { sourceApi: sourceApi() }
  );
  assert.equal(revokedResult.consentError, "consent-revoked");

  const cloud = clone(request.consent);
  cloud.processing = {
    mode: "cloud",
    externalRecipient: "sentetik",
    retention: "provider-policy"
  };
  const cloudResult = await buildContextPreview(
    options({ consent: cloud }),
    { sourceApi: sourceApi() }
  );
  assert.equal(cloudResult.consentError, "unsupported-processing-policy");
});

await test("Eksik veya bozuk kaynak API'sinde bağlam uydurulmaz", async () => {
  const missing = await buildContextPreview(options(), { sourceApi: null });
  assert.equal(missing.errorCode, "TODAY-AI-CONTEXT-SOURCES");
  const malformed = await buildContextPreview(
    options(),
    { sourceApi: sourceApi({ collectEvents: async () => ({ events: null }) }) }
  );
  assert.equal(malformed.errorCode, "TODAY-AI-CONTEXT-EVENTS");
});

await test("Kaynak hatası ayrıntılı kullanıcı verisi taşımadan kontrollü döner", async () => {
  const result = await buildContextPreview(
    options(),
    {
      sourceApi: sourceApi({
        collectEvents: async () => {
          throw new RangeError("SENTETIK_GIZLI_DEGER");
        }
      })
    }
  );
  assert.deepEqual(clone(result), {
    success: false,
    errorCode: "TODAY-AI-CONTEXT-COLLECT",
    errorName: "RangeError"
  });
  assert.equal(JSON.stringify(result).includes("SENTETIK_GIZLI_DEGER"), false);
});

await test("Geçersiz builder isteği açık hata koduyla sonuçlanır", async () => {
  const result = await buildContextPreview(
    options({ requestId: "GEÇERSİZ İSTEK" }),
    { sourceApi: sourceApi() }
  );
  assert.equal(result.errorCode, "TODAY-AI-CONTEXT-BUILD");
  assert.equal(result.builderError, "invalid-request-id");
});

await test("Köprü DOM, App depolaması, ağ veya AI sağlayıcısı çağırmaz", () => {
  assert.doesNotMatch(
    bridgeSource,
    /(?:localStorage|sessionStorage|indexedDB|document\s*\.|querySelector\s*\(|getElementById\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayAI\s*\.|requestProposal\s*\()/
  );
});

await test("Sonraki AI çıktısının açıklanabilirlik ve onay alanları zorunlu kalır", () => {
  const required = [
    "evidence",
    "confidence",
    "uncertainty",
    "alternatives",
    "requiresUserApproval",
    "proposedActions"
  ];
  assert.equal(required.every(field => analysisSchema.required.includes(field)), true);
  assert.equal(analysisSchema.properties.requiresUserApproval.const, true);
});

const failures = results.filter(result => !result.success);
failures.forEach(result => {
  console.error(`FAIL — ${result.name}`);
  console.error(result.error?.stack || result.error);
});
if (failures.length) process.exitCode = 1;
const passed = results.length - failures.length;
console.log(`NUT-017.2 Context Bridge: ${passed}/${results.length} başarılı`);
