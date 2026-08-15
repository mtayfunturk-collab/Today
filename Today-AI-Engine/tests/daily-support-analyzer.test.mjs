import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTodayContext } from "../src/context-builder.mjs";
import {
  CAPABILITY,
  ENGINE_VERSION,
  RULE_IDS,
  RULESET_ID,
  analyzeTodayContext
} from "../src/daily-support-analyzer.mjs";

const loadJson = async relativePath => JSON.parse(
  await readFile(new URL(relativePath, import.meta.url), "utf8")
);
const clone = value => JSON.parse(JSON.stringify(value));

function matchingRequest(sourceRequest) {
  const contextRequest = clone(sourceRequest);
  contextRequest.events.find(
    event => event.eventId === "sleep-20400115"
  ).payload.durationMinutes = 330;
  const built = buildTodayContext(contextRequest);
  assert.equal(built.ok, true);
  return {
    schemaVersion: 1,
    analysisId: "analysis:nut-017.3:synthetic-001",
    capability: CAPABILITY,
    requestedAt: "2040-01-16T12:01:00.000Z",
    context: built.context
  };
}

function energyRequest(sourceRequest, overrides = {}) {
  const contextRequest = clone(sourceRequest);
  contextRequest.events.find(
    event => event.eventId === "sleep-20400115"
  ).payload.durationMinutes = overrides.sleepMinutes ?? 420;
  contextRequest.events
    .filter(event => event.eventType === "energy-record")
    .forEach(event => {
      event.payload.energy = overrides.energy ?? "low";
      event.payload.fatigue = overrides.fatigue ?? "high";
      event.payload.body = overrides.body ?? "tense";
    });
  const built = buildTodayContext(contextRequest);
  assert.equal(built.ok, true);
  return {
    schemaVersion: 1,
    analysisId: "analysis:nut-017.9:energy-synthetic-001",
    capability: CAPABILITY,
    requestedAt: "2040-01-16T12:01:00.000Z",
    context: built.context
  };
}

export async function runDailySupportAnalyzerTests() {
  const sourceRequest = await loadJson(
    "../fixtures/synthetic/nut-017.1-context-request.json"
  );
  const requestSchema = await loadJson(
    "../contracts/analysis-request.schema.json"
  );
  const outputSchema = await loadJson(
    "../contracts/analysis-output.schema.json"
  );
  const source = await readFile(
    new URL("../src/daily-support-analyzer.mjs", import.meta.url),
    "utf8"
  );
  const request = matchingRequest(sourceRequest);
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

  equal(ENGINE_VERSION, "0.9.0-rules", "Engine sürümü NUT-017.9 olmalı");
  equal(RULESET_ID, "today:daily-support:nut-017.9", "Katalog kimliği sabit olmalı");
  deepEqual(
    RULE_IDS,
    {
      shortSleep: "hard-day-short-sleep",
      lowEnergy: "hard-day-low-energy-high-fatigue"
    },
    "İki dar kuralın kimliği sürümlü olmalı"
  );
  check(
    requestSchema.required.includes("context") &&
      requestSchema.properties.capability.const === CAPABILITY,
    "Analiz isteği bağlamı ve dar capability'yi zorunlu tutmalı"
  );

  const first = analyzeTodayContext(request);
  check(first.ok, "Dar Core + Health kuralı eşleşmeli");
  check(
    Object.isFrozen(first) && Object.isFrozen(first.analysis.evidence),
    "Analiz sonucu derin dondurulmalı"
  );
  equal(first.analysis.schemaVersion, 1, "Çıktı schemaVersion 1 olmalı");
  equal(first.analysis.type, CAPABILITY, "Çıktı capability ile eşleşmeli");
  check(
    outputSchema.required.every(field => Object.hasOwn(first.analysis, field)),
    "Mevcut analysis-output zorunlu alanlarının tümü üretilmeli"
  );
  deepEqual(
    first.analysis.evidence.map(entry => entry.source),
    ["today-core", "today-health"],
    "Dayanaklar Core ve Health olarak ayrı kalmalı"
  );
  equal(
    first.analysis.evidence[0].reference,
    "Günlük seçim: Zordu bugün",
    "Kullanıcı dayanağı teknik Core ifadesi taşımamalı"
  );
  check(
    first.analysis.evidence.every(entry => request.context.provenance.some(
      provenance => provenance.eventId === entry.eventId &&
        provenance.source === entry.source
    )),
    "Her dayanak gerçek provenance kaydına bağlanmalı"
  );
  equal(
    first.analysis.evidence.some(entry => entry.source === "today-sky"),
    false,
    "Sky analiz dayanağı olamaz"
  );
  check(
    first.analysis.confidence >= 0 && first.analysis.confidence <= 1,
    "Güven sözleşme aralığında olmalı"
  );
  check(first.analysis.uncertainty.length >= 2, "Belirsizlikler görünür olmalı");
  check(first.analysis.alternatives.length >= 3, "Kullanıcı seçenekleri görünür olmalı");
  equal(first.analysis.requiresUserApproval, true, "İşlem onayı zorunlu olmalı");
  check(
    first.analysis.proposedActions.every(
      action => action.status === "pending-user-approval"
    ),
    "Bütün işlem taslakları onay beklemeli"
  );

  deepEqual(
    analyzeTodayContext(request),
    first,
    "Aynı istek deterministik olarak aynı çıktıyı üretmeli"
  );
  const reversed = clone(request);
  reversed.context.sections.core.reverse();
  reversed.context.sections.health.reverse();
  deepEqual(
    analyzeTodayContext(reversed),
    first,
    "Bağlam sırası sonucu değiştirmemeli"
  );

  const changedSky = clone(request);
  changedSky.context.sections.symbolicContext.items[0].facts.sky.planets.reverse();
  deepEqual(
    analyzeTodayContext(changedSky),
    first,
    "Sembolik Sky içeriği analizi veya güveni değiştirmemeli"
  );

  const sixHours = clone(request);
  sixHours.context.sections.health.find(
    item => item.eventType === "sleep-record"
  ).facts.durationMinutes = 360;
  const sixHoursResult = analyzeTodayContext(sixHours);
  equal(
    sixHoursResult.error.code,
    "no-matching-rule",
    "6 saat sınırında öneri uydurulmamalı"
  );
  equal(
    sixHoursResult.error.ruleEvaluation.evaluatedRuleCount,
    2,
    "Eşleşmeme tanısı iki dar kuralı değerlendirmeli"
  );
  equal(
    sixHoursResult.error.ruleEvaluation.selectedRuleId,
    null,
    "Eşleşme yoksa kural seçilmemeli"
  );
  const sixHoursSleepRule = sixHoursResult.error.ruleEvaluation.rules.find(
    rule => rule.ruleId === RULE_IDS.shortSleep
  );
  deepEqual(
    sixHoursSleepRule,
    {
      ruleId: RULE_IDS.shortSleep,
      matched: false,
      required: {
        coreChoice: "C",
        sleepDuration: { operator: "less-than", minutes: 360 },
        sameLocalDate: true
      },
      observed: {
        core: {
          eventId: "core-20400115",
          localDate: "2040-01-15",
          choice: "C"
        },
        sleep: {
          eventId: "sleep-20400115",
          localDate: "2040-01-15",
          durationMinutes: 360
        }
      },
      checks: {
        coreChoice: true,
        sleepDuration: false,
        sameLocalDate: true
      },
      reasons: ["sleep-duration-not-below-threshold"]
    },
    "Uyku kuralı tanısı yalnız değerlendirilen kayıtları ve sabit koşulları göstermeli"
  );
  check(
    Object.isFrozen(sixHoursResult.error.ruleEvaluation) &&
      Object.isFrozen(sixHoursResult.error.ruleEvaluation.rules) &&
      Object.isFrozen(sixHoursSleepRule.observed),
    "Kural tanısı derin dondurulmalı"
  );
  const noHardDay = clone(request);
  noHardDay.context.sections.core[0].facts.choice = "B";
  const noHardDayResult = analyzeTodayContext(noHardDay);
  equal(
    noHardDayResult.error.code,
    "no-matching-rule",
    "Core C olmadan ilk kural çalışmamalı"
  );
  check(
    noHardDayResult.error.ruleEvaluation.rules.every(rule =>
      rule.reasons.includes("core-choice-not-hard-day")
    ),
    "Core koşulunun eşleşmeme nedeni iki kuralda da açık olmalı"
  );
  const newerNeutralDay = clone(request);
  const newerCore = clone(newerNeutralDay.context.sections.core[0]);
  newerCore.eventId = "core-20400115-newer";
  newerCore.contextItemId = "context-item:core-20400115-newer";
  newerCore.createdAt = "2040-01-15T19:00:00.000Z";
  newerCore.facts.choice = "B";
  newerNeutralDay.context.sections.core.push(newerCore);
  newerNeutralDay.context.provenance.push({
    contextItemId: newerCore.contextItemId,
    eventId: newerCore.eventId,
    source: newerCore.source,
    eventType: newerCore.eventType
  });
  equal(
    analyzeTodayContext(newerNeutralDay).error.code,
    "no-matching-rule",
    "Daha eski Core C, daha güncel nötr seçimi geçersiz kılamamalı"
  );
  const differentDays = clone(request);
  differentDays.context.sections.health.find(
    item => item.eventType === "sleep-record"
  ).localDate = "2040-01-14";
  const differentDaysResult = analyzeTodayContext(differentDays);
  equal(
    differentDaysResult.error.code,
    "no-matching-rule",
    "Core ve uyku farklı yerel günlerdeyse günlük kural çalışmamalı"
  );
  check(
    differentDaysResult.error.ruleEvaluation.rules.find(
      rule => rule.ruleId === RULE_IDS.shortSleep
    ).reasons.includes("records-not-same-local-date"),
    "Farklı yerel tarih nedeni uyku kuralında açık olmalı"
  );

  const noSleep = clone(request);
  noSleep.context.sections.health = noSleep.context.sections.health.filter(
    item => item.eventType !== "sleep-record"
  );
  const noSleepResult = analyzeTodayContext(noSleep);
  check(
    noSleepResult.error.ruleEvaluation.rules.find(
      rule => rule.ruleId === RULE_IDS.shortSleep
    ).reasons.includes("sleep-record-missing"),
    "Uyku kaydı yokluğu açık olmalı"
  );

  const energyMatchRequest = energyRequest(sourceRequest);
  const energyMatch = analyzeTodayContext(energyMatchRequest);
  equal(
    energyMatch.ok,
    true,
    "Core C ile düşük enerji ve fazla yorgunluk aynı gün eşleşmeli"
  );
  deepEqual(
    energyMatch.analysis.evidence.map(entry => entry.eventId),
    ["core-20400115", "energy-20400115"],
    "İkinci kural yalnız Core ve enerji kaydına dayanmalı"
  );
  equal(
    energyMatch.analysis.evidence[1].reference,
    "Enerji ve beden kaydı: Düşük enerji · Fazla yorgunluk",
    "Enerji dayanağı sade kullanıcı diliyle sunulmalı"
  );
  equal(
    energyMatch.analysis.confidence,
    0.74,
    "İkinci kuralın kapsam güveni sabit ve olasılık dışı olmalı"
  );
  equal(
    energyMatch.analysis.proposedActions[0].label,
    "Kısa bir mola vermeyi hatırla",
    "İkinci kural yalnız onay bekleyen mola taslağı üretmeli"
  );
  check(
    energyMatch.analysis.evidence.every(entry =>
      energyMatchRequest.context.provenance.some(provenance =>
        provenance.source === entry.source &&
        provenance.eventId === entry.eventId
      )
    ),
    "İkinci kuralın bütün dayanakları provenance kaydına bağlanmalı"
  );

  const partialEnergy = analyzeTodayContext(energyRequest(sourceRequest, {
    energy: "balanced",
    fatigue: "high"
  }));
  equal(
    partialEnergy.error.code,
    "no-matching-rule",
    "Yalnız fazla yorgunluk varsa ikinci kural öneri uydurmamalı"
  );
  const partialEnergyRule = partialEnergy.error.ruleEvaluation.rules.find(
    rule => rule.ruleId === RULE_IDS.lowEnergy
  );
  deepEqual(
    partialEnergyRule.reasons,
    ["energy-level-not-low"],
    "İkinci kuralın eşleşmeme nedeni kontrollü olmalı"
  );

  const differentEnergyDay = clone(energyRequest(sourceRequest));
  differentEnergyDay.context.sections.health.find(
    item => item.eventType === "energy-record"
  ).localDate = "2040-01-14";
  const differentEnergyResult = analyzeTodayContext(differentEnergyDay);
  equal(
    differentEnergyResult.error.code,
    "no-matching-rule",
    "Core ve enerji farklı günlerdeyse ikinci kural çalışmamalı"
  );
  check(
    differentEnergyResult.error.ruleEvaluation.rules.find(
      rule => rule.ruleId === RULE_IDS.lowEnergy
    ).reasons.includes("records-not-same-local-date"),
    "Enerji kuralında farklı yerel tarih nedeni görünmeli"
  );

  const bothMatch = energyRequest(sourceRequest, { sleepMinutes: 330 });
  bothMatch.analysisId = request.analysisId;
  deepEqual(
    analyzeTodayContext(bothMatch),
    first,
    "İki kural birden eşleşirse mevcut kısa uyku önerisi öncelikli kalmalı"
  );

  const energySkyChanged = clone(energyMatchRequest);
  energySkyChanged.context.sections.symbolicContext.items[0]
    .facts.sky.planets.reverse();
  deepEqual(
    analyzeTodayContext(energySkyChanged),
    energyMatch,
    "Sembolik Sky ikinci kuralı veya güvenini değiştirmemeli"
  );

  const unsafeBoundary = clone(request);
  unsafeBoundary.context.boundaries.externalTransfer = true;
  const unsafeBoundaryResult = analyzeTodayContext(unsafeBoundary);
  equal(
    unsafeBoundaryResult.error.code,
    "invalid-analysis-request",
    "Cihaz dışı bağlam kapalı kalmalı"
  );
  equal(
    Object.hasOwn(unsafeBoundaryResult.error, "ruleEvaluation"),
    false,
    "Geçersiz analiz isteği doğrulanmamış bağlam tanısı sızdırmamalı"
  );
  const causalSky = clone(request);
  causalSky.context.sections.symbolicContext.causalityClaim = true;
  equal(
    analyzeTodayContext(causalSky).error.code,
    "invalid-analysis-request",
    "Nedensellik iddialı Sky sınırı reddedilmeli"
  );
  const tamperedSkyRecord = clone(request);
  tamperedSkyRecord.context.sections.symbolicContext.items[0]
    .facts.metadata.causalityClaim = true;
  equal(
    analyzeTodayContext(tamperedSkyRecord).error.code,
    "invalid-analysis-request",
    "Core–Sky kayıt metadatasındaki nedensellik iddiası reddedilmeli"
  );
  const futureContext = clone(request);
  futureContext.context.builtAt = "2040-01-16T12:02:00.000Z";
  equal(
    analyzeTodayContext(futureContext).error.code,
    "invalid-analysis-request",
    "Gelecekte oluşturulmuş bağlam reddedilmeli"
  );

  const extraRequestField = clone(request);
  extraRequestField.storageKey = "not-allowed";
  equal(
    analyzeTodayContext(extraRequestField).error.code,
    "invalid-analysis-request",
    "Sözleşme dışı istek alanı fail-closed reddedilmeli"
  );

  const serialized = JSON.stringify(first.analysis).toLocaleLowerCase("tr");
  check(
    ["depresyondasın", "teşhis koydum", "kesin olarak", "uyku bozukluğun var"]
      .every(term => !serialized.includes(term)),
    "Teşhis ve kesinlik dili üretilmemeli"
  );
  const serializedEnergy = JSON.stringify(energyMatch.analysis)
    .toLocaleLowerCase("tr");
  check(
    ["depresyondasın", "teşhis koydum", "kesin olarak", "neden oldu"]
      .every(term => !serializedEnergy.includes(term)),
    "Enerji önerisi teşhis, kesinlik veya nedensellik dili üretmemeli"
  );
  check(
    !/(?:localStorage|sessionStorage|indexedDB|document\s*\.|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayConnect|Date\.now|new Date\s*\(\s*\))/.test(source),
    "Saf analiz DOM, depolama, ağ, Connect veya sistem saati kullanmamalı"
  );

  return checks;
}
