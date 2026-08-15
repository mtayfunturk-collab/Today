import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BENCHMARK_REPORT_SCHEMA_VERSION,
  BENCHMARK_SUITE_SCHEMA_VERSION,
  ENGINE_VERSION,
  RULESET_ID,
  SUITE_ID,
  evaluateSyntheticBenchmark
} from "../src/synthetic-benchmark-evaluator.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const loadJson = async relativePath => JSON.parse(
  await readFile(new URL(relativePath, import.meta.url), "utf8")
);

export async function runSyntheticBenchmarkEvaluatorTests() {
  const suite = await loadJson(
    "../fixtures/synthetic/nut-017.8-benchmark-suite.json"
  );
  const suiteSchema = await loadJson(
    "../contracts/benchmark-suite.schema.json"
  );
  const reportSchema = await loadJson(
    "../contracts/benchmark-report.schema.json"
  );
  const source = await readFile(
    new URL("../src/synthetic-benchmark-evaluator.mjs", import.meta.url),
    "utf8"
  );
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
  const invalid = (mutate, message) => {
    const changed = clone(suite);
    mutate(changed);
    equal(
      evaluateSyntheticBenchmark(changed).error?.code,
      "invalid-benchmark-suite",
      message
    );
  };

  equal(ENGINE_VERSION, "0.8.0-evaluation", "Benchmark sürümü doğru olmalı");
  equal(RULESET_ID, "today:synthetic-safety-benchmark:nut-017.8", "Kural kimliği sabit olmalı");
  equal(SUITE_ID, "today:nut-017.8:synthetic-safety-v1", "Paket kimliği sabit olmalı");
  equal(BENCHMARK_SUITE_SCHEMA_VERSION, 1, "Benchmark paketi v1 olmalı");
  equal(BENCHMARK_REPORT_SCHEMA_VERSION, 1, "Benchmark raporu v1 olmalı");
  equal(suiteSchema.properties.suiteId.const, SUITE_ID, "Suite sözleşmesi kimliği sabitlemeli");
  equal(reportSchema.properties.engineVersion.const, ENGINE_VERSION, "Rapor sözleşmesi Engine sürümünü sabitlemeli");
  equal(suiteSchema.properties.policy.properties.syntheticOnly.const, true, "Sözleşme yalnız sentetik veriyi kabul etmeli");
  equal(reportSchema.properties.boundaries.properties.accuracyClaim.const, false, "Rapor doğruluk iddiasını kapatmalı");

  const first = evaluateSyntheticBenchmark(suite);
  equal(first.ok, true, "Geçerli sentetik paket değerlendirilmeli");
  equal(first.report.schemaVersion, 1, "Rapor schemaVersion 1 olmalı");
  equal(first.report.suiteId, SUITE_ID, "Rapor paket kimliğine bağlanmalı");
  equal(first.report.engineVersion, ENGINE_VERSION, "Rapor Engine sürümünü taşımalı");
  equal(first.report.summary.evaluationStatus, "passed", "Tüm vakalar geçtiğinde kapı açılmalı");
  equal(first.report.summary.totalCases, 12, "On iki sentetik vaka değerlendirilmeli");
  equal(first.report.summary.passedCases, 12, "On iki vaka geçmeli");
  equal(first.report.summary.failedCases, 0, "Başarısız vaka olmamalı");
  equal(first.report.summary.safetyViolations, 0, "Güvenlik ihlali olmamalı");
  deepEqual(
    first.report.summary.capabilities,
    ["daily-analysis", "pattern-feedback", "pattern-observation"],
    "Üç dar capability raporlanmalı"
  );
  deepEqual(
    first.report.components,
    {
      analysis: "0.3.1-analysis",
      pattern: "0.6.0-pattern",
      feedback: "0.7.0-feedback"
    },
    "Değerlendirilen bileşen sürümleri görünür olmalı"
  );
  deepEqual(
    first.report.scope,
    {
      data: "synthetic-only",
      processingMode: "device-only",
      retention: "run-scoped",
      persistent: false,
      externalRecipient: null
    },
    "Benchmark kapsamı cihaz-içi, sentetik ve geçici kalmalı"
  );
  check(
    Object.values(first.report.boundaries).every(value => value === false),
    "Bütün dış etki, teşhis, nedensellik ve doğruluk iddiası sınırları kapalı olmalı"
  );
  check(
    reportSchema.required.every(field => Object.hasOwn(first.report, field)),
    "Rapor sözleşmesinin zorunlu alanları üretilmeli"
  );
  check(
    first.report.cases.every(testCase =>
      reportSchema.properties.cases.items.required.every(field =>
        Object.hasOwn(testCase, field)
      )
    ),
    "Her vaka raporu zorunlu alanları taşımalı"
  );
  check(
    first.report.cases.every(testCase =>
      testCase.passed && testCase.checks.every(result => result.passed)
    ),
    "Her vaka içindeki beklenti, açıklama ve güvenlik kontrolleri geçmeli"
  );

  const outcomes = Object.fromEntries(first.report.cases.map(testCase => [
    testCase.caseId,
    testCase.actualOutcome
  ]));
  equal(outcomes["analysis-match"], "success", "Dar günlük analiz eşleşmeli");
  equal(outcomes["analysis-threshold"], "no-result", "Altı saat sınırı sonuç üretmemeli");
  equal(outcomes["analysis-other-core"], "no-result", "Diğer Core seçimi sonuç üretmemeli");
  equal(outcomes["analysis-unsafe-context"], "rejected", "Dış aktarım işaretli bağlam reddedilmeli");
  equal(outcomes["pattern-match"], "success", "Tekrarlanan örüntü gözlenmeli");
  equal(outcomes["pattern-insufficient"], "no-result", "Yetersiz eşleşmiş gün sonuç üretmemeli");
  equal(outcomes["pattern-no-recurrence"], "no-result", "Tekrar yoksa örüntü uydurulmamalı");
  equal(outcomes["pattern-with-sky"], "success", "Sembolik Sky eklenmesi değerlendirmeyi bozmamalı");
  equal(outcomes["feedback-resonates"], "success", "Uyuyor geri bildirimi doğrulanmalı");
  equal(outcomes["feedback-does-not-resonate"], "success", "Uymuyor geri bildirimi doğrulanmalı");
  equal(outcomes["feedback-unsure"], "success", "Emin değilim geri bildirimi doğrulanmalı");
  equal(outcomes["feedback-causal-tamper"], "rejected", "Nedensellik açılmış gözlem reddedilmeli");

  const skyCase = first.report.cases.find(testCase =>
    testCase.caseId === "pattern-with-sky"
  );
  check(
    skyCase.checks.some(result =>
      result.checkId === "equivalent-output-with-symbolic-sky" && result.passed
    ),
    "Sembolik Sky, Core–uyku örüntü sonucunu değiştirmemeli"
  );
  const serializedReport = JSON.stringify(first.report);
  check(
    !serializedReport.includes("synthetic-core-") &&
      !serializedReport.includes("synthetic-sleep-") &&
      !serializedReport.includes("synthetic-sky-"),
    "Rapor ham sentetik olayları veya dayanak kimliklerini taşımamalı"
  );
  equal(
    serializedReport.includes("accuracyPercentage"),
    false,
    "Vaka geçiş oranı AI doğruluk yüzdesi gibi sunulmamalı"
  );
  check(
    Object.isFrozen(first) &&
      Object.isFrozen(first.report) &&
      Object.isFrozen(first.report.cases[0].checks),
    "Benchmark sonucu derin dondurulmalı"
  );

  const shuffled = clone(suite);
  shuffled.datasets.reverse();
  shuffled.datasets.forEach(dataset => dataset.events.reverse());
  shuffled.cases.reverse();
  deepEqual(
    evaluateSyntheticBenchmark(shuffled),
    first,
    "Veri kümesi, olay ve vaka sırası sonucu değiştirmemeli"
  );

  const mismatchedExpectation = clone(suite);
  const matchCase = mismatchedExpectation.cases.find(testCase =>
    testCase.caseId === "analysis-match"
  );
  matchCase.expectedOutcome = "no-result";
  matchCase.expectedError = "no-matching-rule";
  const failed = evaluateSyntheticBenchmark(mismatchedExpectation);
  equal(failed.ok, true, "Geçerli fakat yanlış beklentili paket rapor üretmeli");
  equal(failed.report.summary.evaluationStatus, "failed", "Yanlış beklenti kalite kapısını kapatmalı");
  equal(failed.report.summary.failedCases, 1, "Yalnız bozulan beklenti başarısız olmalı");
  equal(failed.report.summary.safetyViolations, 0, "Beklenti hatası güvenlik ihlali sayılmamalı");

  invalid(value => { value.extra = true; }, "Bilinmeyen kök alan reddedilmeli");
  invalid(value => { value.policy.syntheticOnly = false; }, "Sentetik-only kapatılamamalı");
  invalid(value => { value.policy.realUserDataAllowed = true; }, "Gerçek kullanıcı verisine izin verilememeli");
  invalid(value => { value.policy.externalRecipient = "provider"; }, "Dış alıcı tanımlanamamalı");
  invalid(value => { value.policy.modelProvider = "provider"; }, "Model sağlayıcısı tanımlanamamalı");
  invalid(value => { value.window.startDate = "2040-01-08"; }, "Yedi günden uzun pencere reddedilmeli");
  invalid(value => { value.evaluatedAt = "2040-01-16T11:00:00.000Z"; }, "Bağlamdan önceki değerlendirme reddedilmeli");
  invalid(value => { value.contextBuiltAt = "2040-01-15T12:00:00.000Z"; }, "Pencere tamamlanmadan kurulan bağlam reddedilmeli");
  invalid(value => { value.datasets.push(clone(value.datasets[0])); }, "Tekrarlanan veri kümesi kimliği reddedilmeli");
  invalid(value => { value.cases.push(clone(value.cases[0])); }, "Tekrarlanan vaka kimliği reddedilmeli");
  invalid(value => { value.cases[0].datasetId = "missing-dataset"; }, "Olmayan veri kümesi reddedilmeli");
  invalid(value => {
    value.cases.find(testCase => testCase.caseId === "feedback-resonates")
      .sourceCaseId = "analysis-match";
  }, "Geri bildirim yalnız başarılı örüntü gözlemine bağlanmalı");
  invalid(value => {
    value.cases.find(testCase => testCase.caseId === "pattern-with-sky")
      .equivalentToCaseId = "analysis-match";
  }, "Eşdeğerlik farklı capability'ler arasında kurulamamalı");
  invalid(value => { value.datasets[0].events[0].eventId = "real-event"; }, "Sentetik öneki olmayan olay reddedilmeli");
  invalid(value => { value.datasets[0].events[0].payload.note = "metin"; }, "Serbest metin benchmark girdisine eklenememeli");
  invalid(value => { value.datasets[0].events[0].createdAt = "2041-01-01T00:00:00.000Z"; }, "Gelecekte oluşturulmuş olay reddedilmeli");
  invalid(value => { value.datasets[0].events.push(clone(value.datasets[0].events[0])); }, "Aynı veri kümesindeki yinelenen olay reddedilmeli");
  invalid(value => { value.cases[0].unknown = true; }, "Bilinmeyen vaka alanı reddedilmeli");

  check(
    !/\bdocument\.|globalThis\.window|localStorage|sessionStorage|\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(source),
    "Değerlendirici DOM, depolama veya ağ API'sine erişmemeli"
  );
  check(
    !/Date\.now\s*\(|new\s+Date\s*\(\s*\)/.test(source),
    "Değerlendirici sistem saatini okumamalı"
  );
  check(
    !/process\.env|node:fs|node:https|node:http/.test(source),
    "Değerlendirici ortam, dosya veya ağ bağımlılığı taşımamalı"
  );

  return checks;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const checks = await runSyntheticBenchmarkEvaluatorTests();
  console.log(`${checks}/${checks} NUT-017.8 sentetik benchmark kontrolü başarılı.`);
}
