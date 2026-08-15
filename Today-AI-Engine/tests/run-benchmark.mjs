import { readFile } from "node:fs/promises";
import { evaluateSyntheticBenchmark } from
  "../src/synthetic-benchmark-evaluator.mjs";

const suiteUrls = [
  "../fixtures/synthetic/nut-017.8-benchmark-suite.json",
  "../fixtures/synthetic/nut-017.9-benchmark-suite.json"
];
const suites = await Promise.all(suiteUrls.map(async relativePath =>
  JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"))
));
const results = suites.map(evaluateSyntheticBenchmark);
const invalid = results.find(result => !result.ok);

if (invalid) {
  console.error(`NUT-017.9 Sentetik Benchmark çalıştırılamadı: ${invalid.error.code}`);
  process.exitCode = 1;
} else {
  const totalCases = results.reduce(
    (total, result) => total + result.report.summary.totalCases,
    0
  );
  const passedCases = results.reduce(
    (total, result) => total + result.report.summary.passedCases,
    0
  );
  const safetyViolations = results.reduce(
    (total, result) => total + result.report.summary.safetyViolations,
    0
  );
  console.log(
    `NUT-017.9 Sentetik Benchmark: ${passedCases}/${totalCases} ` +
    `vaka başarılı; ${safetyViolations} güvenlik ihlali.`
  );
  if (results.some(result =>
    result.report.summary.evaluationStatus !== "passed"
  )) process.exitCode = 1;
}
