import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateSyntheticBenchmark } from
  "../Today-AI-Engine/src/synthetic-benchmark-evaluator.mjs";

const loadText = relativePath => readFile(
  new URL(relativePath, import.meta.url),
  "utf8"
);
const loadJson = async relativePath => JSON.parse(await loadText(relativePath));

const [suite, extensionSuite, suiteSchema, reportSchema, evaluatorSource, indexSource,
  uiSource, serviceWorkerSource, versionSource] = await Promise.all([
  loadJson("../Today-AI-Engine/fixtures/synthetic/nut-017.8-benchmark-suite.json"),
  loadJson("../Today-AI-Engine/fixtures/synthetic/nut-017.9-benchmark-suite.json"),
  loadJson("../Today-AI-Engine/contracts/benchmark-suite.schema.json"),
  loadJson("../Today-AI-Engine/contracts/benchmark-report.schema.json"),
  loadText("../Today-AI-Engine/src/synthetic-benchmark-evaluator.mjs"),
  loadText("../index.html"),
  loadText("../modules/ai-context-ui.mjs"),
  loadText("../sw.js"),
  loadText("../modules/version.js")
]);

const results = [];
async function test(name, callback) {
  try {
    await callback();
    results.push({ name, success: true });
  } catch (error) {
    results.push({ name, success: false, error });
  }
}

const evaluated = evaluateSyntheticBenchmark(suite);
const extensionEvaluated = evaluateSyntheticBenchmark(extensionSuite);

await test("Sentetik kalite kapısı bütün kontrollü vakaları geçirir", () => {
  assert.equal(evaluated.ok, true);
  assert.equal(extensionEvaluated.ok, true);
  assert.equal(evaluated.report.summary.evaluationStatus, "passed");
  assert.equal(extensionEvaluated.report.summary.evaluationStatus, "passed");
  assert.equal(
    evaluated.report.summary.totalCases +
      extensionEvaluated.report.summary.totalCases,
    16
  );
  assert.equal(
    evaluated.report.summary.passedCases +
      extensionEvaluated.report.summary.passedCases,
    16
  );
  assert.equal(
    evaluated.report.summary.safetyViolations +
      extensionEvaluated.report.summary.safetyViolations,
    0
  );
});

await test("Değerlendirme yalnız sentetik ve geçici kapsamda kalır", () => {
  assert.deepEqual({ ...evaluated.report.scope }, {
    data: "synthetic-only",
    processingMode: "device-only",
    retention: "run-scoped",
    persistent: false,
    externalRecipient: null
  });
  assert.equal(suite.policy.realUserDataAllowed, false);
  assert.equal(suite.policy.modelProvider, null);
  assert.deepEqual(extensionEvaluated.report.scope, evaluated.report.scope);
});

await test("Değerlendirme dış etki ve sağlık iddiası üretmez", () => {
  assert.equal(
    Object.values(evaluated.report.boundaries).every(value => value === false),
    true
  );
  assert.equal(evaluated.report.boundaries.actionExecuted, false);
  assert.equal(evaluated.report.boundaries.connectCalled, false);
  assert.equal(evaluated.report.boundaries.auditPersisted, false);
});

await test("Benchmark girdileri dar ve sentetik olaylardan oluşur", () => {
  const events = [suite, extensionSuite].flatMap(entry =>
    entry.datasets.flatMap(dataset => dataset.events)
  );
  assert.equal(events.length > 0, true);
  assert.equal(events.every(event => event.eventId.startsWith("synthetic-")), true);
  assert.equal(events.some(event =>
    ["note", "name", "email", "birthProfile", "place"].some(field =>
      Object.hasOwn(event.payload, field)
    )
  ), false);
});

await test("Sembolik Sky Core–uyku sonucunu değiştirmez", () => {
  const skyCase = evaluated.report.cases.find(testCase =>
    testCase.caseId === "pattern-with-sky"
  );
  assert.equal(skyCase.passed, true);
  assert.equal(skyCase.checks.some(check =>
    check.checkId === "equivalent-output-with-symbolic-sky" && check.passed
  ), true);
});

await test("Yeni enerji kuralı güvenli ve mevcut kısa uyku önceliği sabittir", () => {
  const energyCase = extensionEvaluated.report.cases.find(testCase =>
    testCase.caseId === "analysis-energy-match"
  );
  const partialCase = extensionEvaluated.report.cases.find(testCase =>
    testCase.caseId === "analysis-energy-partial"
  );
  const precedenceCase = extensionEvaluated.report.cases.find(testCase =>
    testCase.caseId === "analysis-precedence-with-energy"
  );
  assert.equal(energyCase.actualOutcome, "success");
  assert.equal(partialCase.actualOutcome, "no-result");
  assert.equal(precedenceCase.checks.some(check =>
    check.checkId === "equivalent-output-with-rule-priority" && check.passed
  ), true);
});

await test("Benchmark ve rapor sözleşmeleri sürümlüdür", () => {
  assert.deepEqual(suiteSchema.properties.suiteId.enum, [
    suite.suiteId,
    extensionSuite.suiteId
  ]);
  assert.equal(reportSchema.properties.engineVersion.const, "0.9.0-evaluation");
  assert.equal(reportSchema.properties.boundaries.properties.accuracyClaim.const, false);
});

await test("Değerlendirici uygulama yüzeyi ve depolamadan bağımsızdır", () => {
  assert.doesNotMatch(
    evaluatorSource,
    /(?:document\s*\.|globalThis\.window|localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket\s*\()/
  );
  assert.doesNotMatch(evaluatorSource, /Date\.now\s*\(|new\s+Date\s*\(\s*\)/);
});

await test("Benchmark geliştirme kapısıdır ve kullanıcı ekranına taşınmaz", () => {
  assert.doesNotMatch(indexSource, /synthetic-benchmark-evaluator|run-benchmark/i);
  assert.doesNotMatch(uiSource, /synthetic-benchmark-evaluator|run-benchmark/i);
  assert.doesNotMatch(serviceWorkerSource, /synthetic-benchmark-evaluator|run-benchmark/i);
});

await test("Today runtime yeni günlük kural kataloğu sürümünü taşır", () => {
  assert.match(versionSource, /const APP_VERSION = "2\.16\.0"/);
  assert.match(versionSource, /const SCHEMA_VERSION = 2/);
  assert.match(serviceWorkerSource, /const VERSION = "today-v2-foundation-067"/);
});

await test("Rapor ham olay veya yanıltıcı doğruluk yüzdesi taşımaz", () => {
  const serialized = JSON.stringify([
    evaluated.report,
    extensionEvaluated.report
  ]);
  assert.doesNotMatch(serialized, /synthetic-(?:core|sleep|sky|energy)-/);
  assert.equal(evaluated.report.boundaries.accuracyClaim, false);
  assert.doesNotMatch(serialized, /accuracyPercentage|probabilityScore/);
});

const failures = results.filter(result => !result.success);
failures.forEach(result => {
  console.error(`FAIL — ${result.name}`);
  console.error(result.error?.stack || result.error);
});
if (failures.length) process.exitCode = 1;
const passed = results.length - failures.length;
console.log(`NUT-017.9 Evaluation Gate: ${passed}/${results.length} başarılı`);
