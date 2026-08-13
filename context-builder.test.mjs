import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateDataUsageConsent,
  toAppAdapterConsent
} from "../src/data-usage-consent.mjs";
import { buildTodayContext } from "../src/context-builder.mjs";

const loadJson = async relativePath => JSON.parse(
  await readFile(new URL(relativePath, import.meta.url), "utf8")
);

const clone = value => JSON.parse(JSON.stringify(value));

export async function runContextBuilderTests() {
  const request = await loadJson(
    "../fixtures/synthetic/nut-017.1-context-request.json"
  );
  const expected = await loadJson(
    "../fixtures/synthetic/nut-017.1-expected-policy.json"
  );
  const contextSchemas = await Promise.all([
    loadJson("../contracts/data-usage-consent.schema.json"),
    loadJson("../contracts/context-build-request.schema.json"),
    loadJson("../contracts/context-package.schema.json")
  ]);
  let checks = 0;

  const check = (condition, message) => {
    assert.ok(condition, message);
    checks += 1;
  };
  const equal = (actual, wanted, message) => {
    assert.equal(actual, wanted, message);
    checks += 1;
  };
  const deepEqual = (actual, wanted, message) => {
    assert.deepEqual(actual, wanted, message);
    checks += 1;
  };

  const consentResult = evaluateDataUsageConsent(request.consent, {
    purpose: request.purpose,
    at: request.requestedAt
  });
  check(consentResult.ok, "Geçerli, amaç-bağlı cihaz-içi onay kabul edilmeli");
  check(Object.isFrozen(consentResult.consent), "Normalize onay değiştirilemez olmalı");
  deepEqual(
    toAppAdapterConsent(request.consent, {
      purpose: request.purpose,
      at: request.requestedAt
    }),
    {
      granted: true,
      purpose: request.purpose,
      grantedAt: request.consent.grantedAt
    },
    "TB-018 TodayAI dar onay görünümü korunmalı"
  );

  equal(
    evaluateDataUsageConsent(request.consent, {
      purpose: "başka bir amaç",
      at: request.requestedAt
    }).error.code,
    "consent-purpose-mismatch",
    "Onay başka amaç için yeniden kullanılamamalı"
  );

  const revokedConsent = clone(request.consent);
  revokedConsent.revokedAt = "2040-01-15T00:00:00.000Z";
  equal(
    evaluateDataUsageConsent(revokedConsent, {
      purpose: request.purpose,
      at: request.requestedAt
    }).error.code,
    "consent-revoked",
    "İptal edilmiş onay kapalı kalmalı"
  );

  const cloudConsent = clone(request.consent);
  cloudConsent.processing = {
    mode: "cloud",
    externalRecipient: "synthetic-provider",
    retention: "provider-policy"
  };
  equal(
    evaluateDataUsageConsent(cloudConsent, {
      purpose: request.purpose,
      at: request.requestedAt
    }).error.code,
    "unsupported-processing-policy",
    "NUT-017.1 dış alıcı veya bulut işlemeyi reddetmeli"
  );

  const invalidSkyConsent = clone(request.consent);
  invalidSkyConsent.permissions.sky.role = "health-evidence";
  equal(
    evaluateDataUsageConsent(invalidSkyConsent, {
      purpose: request.purpose,
      at: request.requestedAt
    }).error.code,
    "invalid-sky-boundary",
    "Sky yalnız sembolik bağlam rolüyle onaylanabilmeli"
  );

  const futureConsent = clone(request.consent);
  futureConsent.grantedAt = "2040-01-17T00:00:00.000Z";
  equal(
    evaluateDataUsageConsent(futureConsent, {
      purpose: request.purpose,
      at: request.requestedAt
    }).error.code,
    "consent-granted-in-future",
    "Gelecekte verilmiş onay geçersiz olmalı"
  );

  const untouchedRequest = JSON.stringify(request);
  const built = buildTodayContext(request);
  check(built.ok, "Geçerli bağlam isteği işlenmeli");
  const { context } = built;
  equal(JSON.stringify(request), untouchedRequest, "Builder girdiyi değiştirmemeli");
  check(
    Object.isFrozen(context) && Object.isFrozen(context.sections.health),
    "Bağlam paketi derin dondurulmalı"
  );

  deepEqual(
    {
      core: context.counts.core,
      health: context.counts.health,
      symbolicSky: context.counts.symbolicSky
    },
    expected.includedCounts,
    "Yalnız beklenen veri-minimum kayıtlar dahil edilmeli"
  );
  deepEqual(
    context.boundaries,
    expected.requiredBoundaries,
    "Sistem, veri ve Sky sınırları çıktı paketinde görünür olmalı"
  );

  const serializedContext = JSON.stringify(context);
  check(
    expected.forbiddenContent.every(value => !serializedContext.includes(value)),
    "Not, ayrıntılı egzersiz, konum, zaman dilimi ve doğum bilgisi sızmamalı"
  );
  deepEqual(
    [...new Set(context.omissions.map(entry => entry.reason))].sort(),
    [...expected.omissionReasons].sort(),
    "Her dışlama belirlenmiş gerekçeyle görünür olmalı"
  );

  const includedItems = [
    ...context.sections.core,
    ...context.sections.health,
    ...context.sections.symbolicContext.items
  ];
  deepEqual(
    new Set(context.provenance.map(entry => entry.eventId)),
    new Set(includedItems.map(entry => entry.eventId)),
    "Her bağlam öğesi gerçek giriş olayına bağlanmalı"
  );
  check(
    context.redactions.some(entry =>
      entry.eventId === "core-20400115" && entry.field === "payload.note"
    ),
    "Core notu değer taşımadan redaksiyon kaydı üretmeli"
  );
  check(
    context.sections.core.every(item => item.source !== "today-sky") &&
      context.sections.health.every(item => item.source !== "today-sky") &&
      context.sections.symbolicContext.items.every(item => item.source === "today-sky"),
    "Sky, Core ve Health bölümlerinden ayrı tutulmalı"
  );

  const skyItem = context.sections.symbolicContext.items[0];
  deepEqual(
    skyItem.facts.metadata,
    {
      interpretation: "none",
      causalityClaim: false,
      aiProcessed: false
    },
    "Core–Sky güvenlik metadatası aynen korunmalı"
  );
  check(
    !Object.hasOwn(skyItem.facts, "place") &&
      !Object.hasOwn(skyItem.facts.sky, "clock"),
    "Kesin konum ve saat dilimi bağlam paketine alınmamalı"
  );

  const hydration = context.sections.health.find(
    item => item.eventId === "hydration-20400115"
  );
  deepEqual(
    hydration.facts,
    { recordType: "hydration_entry", amountMl: 350 },
    "Nutrition v1 hidrasyon kaydı minimum alanlara indirgenmeli"
  );
  const workout = context.sections.health.find(
    item => item.eventId === "workout-20400114"
  );
  deepEqual(
    workout.facts,
    { durationMinutes: 32, exerciseCount: 1, completedExerciseCount: 1 },
    "Antrenman ayrıntıları yerine amaç için yeterli toplamlar kullanılmalı"
  );

  const energy = context.sections.health.find(
    item => item.eventId === "energy-20400115"
  );
  equal(energy.facts.energy, 3, "Tekrarlı olaylarda deterministik ilk kayıt kullanılmalı");
  check(
    context.omissions.some(entry =>
      entry.eventId === "energy-20400115" && entry.reason === "duplicate-event-id"
    ),
    "Tekrarlı olay görünür gerekçeyle dışlanmalı"
  );
  check(
    context.omissions.some(entry => entry.reason === "raw-sky-input-excluded"),
    "Ham doğum/observation Sky girdisi hiçbir zaman dahil edilmemeli"
  );
  check(
    context.omissions.some(entry => entry.reason === "outside-request-window"),
    "İstenen tarih aralığı dışındaki olaylar dahil edilmemeli"
  );

  const reversed = clone(request);
  reversed.events.reverse();
  deepEqual(
    buildTodayContext(reversed).context,
    context,
    "Girdi sırası deterministik sonucu değiştirmemeli"
  );

  const wrongPurposeRequest = clone(request);
  wrongPurposeRequest.purpose = "uyuşmayan amaç";
  deepEqual(
    buildTodayContext(wrongPurposeRequest).error,
    {
      code: "consent-check-failed",
      consentError: "consent-purpose-mismatch"
    },
    "Builder amaç uyuşmazlığında bağlam üretmemeli"
  );
  const revokedRequest = clone(request);
  revokedRequest.consent.revokedAt = "2040-01-15T00:00:00.000Z";
  equal(
    buildTodayContext(revokedRequest).error.consentError,
    "consent-revoked",
    "Builder iptal edilmiş onayda bağlam üretmemeli"
  );
  const cloudRequest = clone(request);
  cloudRequest.consent = cloudConsent;
  equal(
    buildTodayContext(cloudRequest).error.consentError,
    "unsupported-processing-policy",
    "Builder harici alıcı talebinde bağlam üretmemeli"
  );

  const causalSkyRequest = clone(request);
  causalSkyRequest.events.find(
    event => event.eventId === "sky-link-20400115"
  ).payload.metadata.causalityClaim = true;
  const causalSkyContext = buildTodayContext(causalSkyRequest).context;
  equal(
    causalSkyContext.counts.symbolicSky,
    0,
    "Nedensellik iddialı Sky kaydı sembolik bölüme alınmamalı"
  );
  check(
    causalSkyContext.omissions.some(entry =>
      entry.eventId === "sky-link-20400115" &&
      entry.reason === "invalid-symbolic-boundary"
    ),
    "Bozuk Sky sınırı açık gerekçeyle dışlanmalı"
  );

  const aiDraftRequest = clone(request);
  aiDraftRequest.events.find(
    event => event.eventId === "hydration-20400115"
  ).payload.source.kind = "ai_draft";
  const aiDraftContext = buildTodayContext(aiDraftRequest).context;
  check(
    aiDraftContext.omissions.some(entry =>
      entry.eventId === "hydration-20400115" &&
      entry.reason === "ai-draft-not-accepted"
    ),
    "AI taslağı tekrar AI dayanağına çevrilmemeli"
  );

  const freeTextRequest = clone(request);
  freeTextRequest.consent.permissions.core.dataClasses.push("note");
  freeTextRequest.consent.permissions.core.includeFreeText = true;
  freeTextRequest.consent.permissions.health = {
    allowed: false,
    dataClasses: [],
    includeFreeText: false
  };
  freeTextRequest.consent.permissions.sky = {
    allowed: false,
    dataClasses: [],
    includeFreeText: false,
    role: "symbolic-context-only"
  };
  const freeTextContext = buildTodayContext(freeTextRequest).context;
  equal(
    freeTextContext.sections.core[0].facts.note,
    "SENTETIK_GIZLI_NOT_CONTEXTE_GIRMEMELI",
    "Serbest metin yalnız veri sınıfı ve ayrı bayrak birlikte onaylıysa eklenmeli"
  );
  equal(
    freeTextContext.boundaries.freeTextIncluded,
    true,
    "Serbest metin kullanımı paket sınırlarında görünür olmalı"
  );

  const limitedRequest = clone(request);
  limitedRequest.window.maxEventsPerSource = 1;
  const limitedContext = buildTodayContext(limitedRequest).context;
  check(
    limitedContext.omissions.some(entry => entry.reason === "source-event-limit"),
    "Kaynak başına olay üst sınırı uygulanmalı"
  );

  const futureEventRequest = clone(request);
  futureEventRequest.events.push({
    schemaVersion: 1,
    eventId: "future-event-synthetic",
    source: "today-core",
    eventType: "daily-checkin",
    createdAt: "2040-01-17T00:00:00.000Z",
    localDate: "2040-01-15",
    payload: { choice: "A" }
  });
  check(
    buildTodayContext(futureEventRequest).context.omissions.some(entry =>
      entry.eventId === "future-event-synthetic" &&
      entry.reason === "event-created-after-request"
    ),
    "İstek zamanından sonra oluşturulmuş olay kullanılmamalı"
  );

  const sources = await Promise.all([
    readFile(new URL("../src/context-builder.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/data-usage-consent.mjs", import.meta.url), "utf8")
  ]);
  const runtimeSource = sources.join("\n");
  check(
    !/(?:localStorage|sessionStorage|indexedDB|document\s*\.|querySelector\s*\(|getElementById\s*\()/.test(runtimeSource),
    "AI Engine DOM veya App depolama API'sine bağlanmamalı"
  );
  check(
    !/(?:fetch\s*\(|XMLHttpRequest|WebSocket\s*\()/.test(runtimeSource),
    "NUT-017.1 çalışma zamanı ağ aktarımı yapmamalı"
  );
  deepEqual(
    contextSchemas.map(schema => schema.properties.schemaVersion.const),
    [1, 1, 1],
    "Üç yeni sözleşme açık schemaVersion 1 taşımalı"
  );

  const analysisSchema = await loadJson("../contracts/analysis-output.schema.json");
  const requiredExplainability = [
    "evidence",
    "confidence",
    "uncertainty",
    "alternatives",
    "requiresUserApproval",
    "proposedActions"
  ];
  check(
    requiredExplainability.every(field => analysisSchema.required.includes(field)) &&
      analysisSchema.properties.requiresUserApproval.const === true,
    "Her AI çıktısında dayanak, güven, belirsizlik, seçenek ve onay durumu zorunlu kalmalı"
  );

  return checks;
}
