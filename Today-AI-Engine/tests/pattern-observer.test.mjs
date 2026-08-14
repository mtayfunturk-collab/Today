import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTodayContext } from "../src/context-builder.mjs";
import {
  CAPABILITY,
  ENGINE_VERSION,
  PATTERN_OUTPUT_SCHEMA_VERSION,
  PATTERN_REQUEST_SCHEMA_VERSION,
  RULESET_ID,
  observeTodayPattern
} from "../src/pattern-observer.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const loadJson = async relativePath => JSON.parse(
  await readFile(new URL(relativePath, import.meta.url), "utf8")
);

const DAYS = Object.freeze([
  ["2040-01-09", "C", 330],
  ["2040-01-10", "B", 420],
  ["2040-01-11", "C", 350],
  ["2040-01-12", "A", 390],
  ["2040-01-13", "C", 300],
  ["2040-01-14", "B", 360],
  ["2040-01-15", "C", 420]
]);

function contextRequest(days = DAYS) {
  const events = days.flatMap(([localDate, choice, durationMinutes]) => [
    {
      schemaVersion: 1,
      eventId: `core-${localDate}`,
      source: "today-core",
      eventType: "daily-checkin",
      createdAt: `${localDate}T18:00:00.000Z`,
      localDate,
      payload: { choice, color: "mavi" }
    },
    {
      schemaVersion: 1,
      eventId: `sleep-${localDate}`,
      source: "today-health",
      eventType: "sleep-record",
      createdAt: `${localDate}T07:00:00.000Z`,
      localDate,
      payload: { durationMinutes }
    }
  ]);

  return {
    schemaVersion: 1,
    requestId: "pattern-context-20400115",
    purpose: "Son 7 gündeki tekrarları cihazda gözlemleme",
    requestedAt: "2040-01-16T12:00:00.000Z",
    window: {
      startDate: "2040-01-09",
      endDate: "2040-01-15",
      maxEventsPerSource: 20
    },
    consent: {
      schemaVersion: 1,
      consentId: "pattern-consent-20400115",
      purpose: "Son 7 gündeki tekrarları cihazda gözlemleme",
      granted: true,
      grantedAt: "2040-01-09T06:00:00.000Z",
      revokedAt: null,
      processing: {
        mode: "device-only",
        externalRecipient: null,
        retention: "request-scoped"
      },
      permissions: {
        core: {
          allowed: true,
          dataClasses: ["daily-choice"],
          includeFreeText: false
        },
        health: {
          allowed: true,
          dataClasses: ["sleep"],
          includeFreeText: false
        },
        sky: {
          allowed: false,
          dataClasses: [],
          includeFreeText: false,
          role: "symbolic-context-only"
        }
      }
    },
    events
  };
}

function observationRequest(source = contextRequest()) {
  const built = buildTodayContext(source);
  assert.equal(built.ok, true);
  return {
    schemaVersion: 1,
    observationId: "pattern:nut-017.6:synthetic-001",
    capability: CAPABILITY,
    requestedAt: "2040-01-16T12:01:00.000Z",
    context: built.context
  };
}

export async function runPatternObserverTests() {
  const requestSchema = await loadJson(
    "../contracts/pattern-observation-request.schema.json"
  );
  const outputSchema = await loadJson(
    "../contracts/pattern-observation-output.schema.json"
  );
  const source = await readFile(
    new URL("../src/pattern-observer.mjs", import.meta.url),
    "utf8"
  );
  const request = observationRequest();
  let checks = 0;

  const check = (condition, message) => {
    assert.ok(condition, message);
    checks += 1;
  };
  const equal = (actual, expected, message) => {
    assert.equal(actual, expected, message);
    checks += 1;
  };
  const deepEqual = (actual, expected, message) => {
    assert.deepEqual(actual, expected, message);
    checks += 1;
  };

  equal(ENGINE_VERSION, "0.6.0-pattern", "Örüntü motoru sürümü doğru olmalı");
  equal(RULESET_ID, "today:pattern-observer:nut-017.6", "Kural kimliği sabit olmalı");
  equal(PATTERN_REQUEST_SCHEMA_VERSION, 1, "İstek sözleşmesi v1 olmalı");
  equal(PATTERN_OUTPUT_SCHEMA_VERSION, 1, "Çıktı sözleşmesi v1 olmalı");
  equal(
    requestSchema.properties.capability.const,
    CAPABILITY,
    "İstek yalnız dar Core–uyku capability'sini kabul etmeli"
  );

  const first = observeTodayPattern(request);
  equal(first.ok, true, "Tekrarlanan Core–uyku birlikteliği gözlenmeli");
  check(
    outputSchema.required.every(field =>
      Object.hasOwn(first.observation, field)
    ),
    "Çıktı dayanak, güven, belirsizlik, seçenek ve onay alanlarını taşımalı"
  );
  equal(first.observation.schemaVersion, 1, "Çıktı schemaVersion 1 olmalı");
  equal(first.observation.type, CAPABILITY, "Çıktı capability ile eşleşmeli");
  deepEqual(
    first.observation.window,
    {
      startDate: "2040-01-09",
      endDate: "2040-01-15",
      totalDays: 7,
      eligibleDays: 7,
      matchingDays: 3
    },
    "Yedi günlük karşılaştırılabilir ve eşleşen gün sayıları doğru olmalı"
  );
  deepEqual(
    first.observation.evidence.map(entry => entry.localDate),
    ["2040-01-09", "2040-01-11", "2040-01-13"],
    "Yalnız eşleşen yerel günler dayanak olmalı"
  );
  check(
    first.observation.evidence.every(entry =>
      request.context.provenance.some(provenance =>
        provenance.source === entry.core.source &&
        provenance.eventId === entry.core.eventId
      ) &&
      request.context.provenance.some(provenance =>
        provenance.source === entry.health.source &&
        provenance.eventId === entry.health.eventId
      )
    ),
    "Her Core ve Health dayanağı gerçek provenance kaydına bağlanmalı"
  );
  equal(first.observation.confidence.score, 0.66, "Güven hesabı sabit olmalı");
  equal(first.observation.confidence.level, "moderate", "Güven düzeyi doğru olmalı");
  equal(
    first.observation.confidence.probabilityClaim,
    false,
    "Güven doğruluk olasılığı sayılmamalı"
  );
  check(first.observation.uncertainty.length >= 2, "Belirsizlik görünür olmalı");
  check(first.observation.alternatives.length >= 3, "Kullanıcı seçenekleri bulunmalı");
  deepEqual(
    first.observation.approval,
    { required: false, status: "not-required" },
    "Eylemsiz gözlem onay gerektirmemeli"
  );
  deepEqual(
    first.observation.boundaries,
    {
      interpretation: "descriptive-observation",
      causalityClaim: false,
      diagnosis: false,
      skyUsed: false,
      processingMode: "device-only",
      retention: "request-scoped",
      externalRecipient: null,
      actionProposed: false
    },
    "Nedensellik, Sky ve işlem sınırları kapalı kalmalı"
  );
  check(
    Object.isFrozen(first) &&
      Object.isFrozen(first.observation) &&
      Object.isFrozen(first.observation.evidence[0].core),
    "Örüntü sonucu derin dondurulmalı"
  );
  deepEqual(
    observeTodayPattern(request),
    first,
    "Aynı istek deterministik olarak aynı sonucu üretmeli"
  );

  const reversed = clone(request);
  reversed.context.sections.core.reverse();
  reversed.context.sections.health.reverse();
  deepEqual(
    observeTodayPattern(reversed),
    first,
    "Bağlam sırası gözlemi değiştirmemeli"
  );

  const withSky = clone(request);
  const skyItem = {
    contextItemId: "context-item:sky-pattern-synthetic",
    eventId: "sky-pattern-synthetic",
    source: "today-sky",
    eventType: "sky-moment",
    localDate: "2040-01-15",
    createdAt: "2040-01-15T19:00:00.000Z",
    dataClasses: ["moment"],
    facts: { marker: "symbolic-only" }
  };
  withSky.context.sections.symbolicContext.items.push(skyItem);
  withSky.context.provenance.push({
    contextItemId: skyItem.contextItemId,
    eventId: skyItem.eventId,
    source: skyItem.source,
    eventType: skyItem.eventType
  });
  withSky.context.counts.symbolicSky = 1;
  deepEqual(
    observeTodayPattern(withSky),
    first,
    "Sembolik Sky içeriği gözlemi veya güveni değiştirmemeli"
  );

  const newerCoreSource = contextRequest();
  newerCoreSource.events.push({
    schemaVersion: 1,
    eventId: "core-2040-01-13-newer",
    source: "today-core",
    eventType: "daily-checkin",
    createdAt: "2040-01-13T20:00:00.000Z",
    localDate: "2040-01-13",
    payload: { choice: "B", color: "yesil" }
  });
  const newerCore = observeTodayPattern(observationRequest(newerCoreSource));
  equal(newerCore.ok, true, "Kalan iki eşleşme gözlem için yeterli olmalı");
  deepEqual(
    newerCore.observation.evidence.map(entry => entry.localDate),
    ["2040-01-09", "2040-01-11"],
    "Aynı günün daha yeni Core kaydı eski eşleşmeyi geçersiz kılmalı"
  );

  const insufficient = clone(request);
  insufficient.context.sections.health =
    insufficient.context.sections.health.slice(0, 2);
  const insufficientResult = observeTodayPattern(insufficient);
  equal(
    insufficientResult.error.code,
    "insufficient-paired-days",
    "Üçten az karşılaştırılabilir gün örüntü üretmemeli"
  );
  equal(
    insufficientResult.error.patternEvaluation.counts.eligibleDays,
    2,
    "Eksik veri tanısı yalnız gün sayısını göstermeli"
  );
  equal(
    insufficientResult.error.patternEvaluation.skyExcluded,
    true,
    "Eşleşmeme tanısı Sky'ı dışarıda tutmalı"
  );

  const noRecurrence = clone(request);
  noRecurrence.context.sections.core.forEach(item => {
    item.facts.choice = "B";
  });
  const noRecurrenceResult = observeTodayPattern(noRecurrence);
  equal(
    noRecurrenceResult.error.code,
    "recurrence-not-observed",
    "İki eşleşme yoksa tekrar uydurulmamalı"
  );
  deepEqual(
    noRecurrenceResult.error.patternEvaluation.reasons,
    ["recurrence-not-observed"],
    "Tekrar bulunmama nedeni kontrollü olmalı"
  );

  const threshold = clone(request);
  threshold.context.sections.health.forEach(item => {
    if (item.facts.durationMinutes < 360) item.facts.durationMinutes = 360;
  });
  equal(
    observeTodayPattern(threshold).error.code,
    "recurrence-not-observed",
    "Tam 6 saat kısa uyku sayılmamalı"
  );

  const unsafeBoundary = clone(request);
  unsafeBoundary.context.boundaries.externalTransfer = true;
  const unsafeResult = observeTodayPattern(unsafeBoundary);
  equal(
    unsafeResult.error.code,
    "invalid-pattern-observation-request",
    "Cihaz dışı bağlam fail-closed reddedilmeli"
  );
  equal(
    Object.hasOwn(unsafeResult.error, "patternEvaluation"),
    false,
    "Geçersiz istekte doğrulanmamış gözlem tanısı sızmamalı"
  );
  const causalSky = clone(request);
  causalSky.context.sections.symbolicContext.causalityClaim = true;
  equal(
    observeTodayPattern(causalSky).error.code,
    "invalid-pattern-observation-request",
    "Nedensellik iddialı sembolik sınır reddedilmeli"
  );
  const futureContext = clone(request);
  futureContext.context.builtAt = "2040-01-16T12:02:00.000Z";
  equal(
    observeTodayPattern(futureContext).error.code,
    "invalid-pattern-observation-request",
    "Gelecekte oluşturulmuş bağlam reddedilmeli"
  );
  const missingProvenance = clone(request);
  missingProvenance.context.provenance = [];
  equal(
    observeTodayPattern(missingProvenance).error.code,
    "invalid-pattern-observation-request",
    "Dayanak izi olmayan bağlam reddedilmeli"
  );
  const wrongWindow = clone(request);
  wrongWindow.context.window.startDate = "2040-01-10";
  equal(
    observeTodayPattern(wrongWindow).error.code,
    "invalid-pattern-observation-request",
    "NUT-017.6 yalnız belgelenmiş 7 günlük pencereyi kabul etmeli"
  );
  const extraField = clone(request);
  extraField.storageKey = "today_store_v2";
  equal(
    observeTodayPattern(extraField).error.code,
    "invalid-pattern-observation-request",
    "Bilinmeyen istek alanı reddedilmeli"
  );

  const serialized = JSON.stringify(first.observation).toLocaleLowerCase("tr");
  check(
    [
      "uykusuzluk zor güne neden oldu",
      "zor gün uykusuzluğa sebep oldu",
      "depresyondasın",
      "uyku bozukluğun var",
      "kesin olarak"
    ]
      .every(term => !serialized.includes(term)),
    "Nedensellik, teşhis ve kesinlik dili üretilmemeli"
  );
  check(
    !/(?:localStorage|sessionStorage|indexedDB|document\s*\.|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayConnect|Date\.now|new Date\s*\(\s*\))/.test(source),
    "Saf gözlemci DOM, depolama, ağ, Connect veya sistem saatini kullanmamalı"
  );

  return checks;
}
