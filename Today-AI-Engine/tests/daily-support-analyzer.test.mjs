import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTodayContext } from "../src/context-builder.mjs";
import {
  CAPABILITY,
  ENGINE_VERSION,
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

  equal(ENGINE_VERSION, "0.3.1-analysis", "Engine sürümü NUT-017.3.1 olmalı");
  equal(RULESET_ID, "today:daily-support:nut-017.3.1", "Kural kimliği sabit olmalı");
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
  deepEqual(
    sixHoursResult.error.ruleEvaluation,
    {
      rulesetId: RULESET_ID,
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
    "Eşleşmeme tanısı yalnız değerlendirilen kayıtları ve sabit koşulları göstermeli"
  );
  check(
    Object.isFrozen(sixHoursResult.error.ruleEvaluation) &&
      Object.isFrozen(sixHoursResult.error.ruleEvaluation.observed),
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
  deepEqual(
    noHardDayResult.error.ruleEvaluation.reasons,
    ["core-choice-not-hard-day"],
    "Core koşulunun eşleşmeme nedeni açık olmalı"
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
  deepEqual(
    differentDaysResult.error.ruleEvaluation.reasons,
    ["records-not-same-local-date"],
    "Farklı yerel tarih nedeni açık olmalı"
  );

  const noSleep = clone(request);
  noSleep.context.sections.health = noSleep.context.sections.health.filter(
    item => item.eventType !== "sleep-record"
  );
  const noSleepResult = analyzeTodayContext(noSleep);
  deepEqual(
    noSleepResult.error.ruleEvaluation.reasons,
    ["sleep-record-missing"],
    "Uyku kaydı yokluğu açık olmalı"
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

  const serialized = JSON.stringify(first.analysis).toLocaleLowerCase("tr");
  check(
    ["depresyondasın", "teşhis koydum", "kesin olarak", "uyku bozukluğun var"]
      .every(term => !serialized.includes(term)),
    "Teşhis ve kesinlik dili üretilmemeli"
  );
  check(
    !/(?:localStorage|sessionStorage|indexedDB|document\s*\.|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayConnect|Date\.now|new Date\s*\(\s*\))/.test(source),
    "Saf analiz DOM, depolama, ağ, Connect veya sistem saati kullanmamalı"
  );

  return checks;
}
