import { readFile } from "node:fs/promises";
import { evaluateSyntheticBenchmark } from
  "../src/synthetic-benchmark-evaluator.mjs";

const suite = JSON.parse(await readFile(
  new URL("../fixtures/synthetic/nut-017.8-benchmark-suite.json", import.meta.url),
  "utf8"
));
const result = evaluateSyntheticBenchmark(suite);

if (!result.ok) {
  console.error(`NUT-017.8 Sentetik Benchmark çalıştırılamadı: ${result.error.code}`);
  process.exitCode = 1;
} else {
  const { summary } = result.report;
  console.log(
    `NUT-017.8 Sentetik Benchmark: ${summary.passedCases}/${summary.totalCases} ` +
    `vaka başarılı; ${summary.safetyViolations} güvenlik ihlali.`
  );
  if (summary.evaluationStatus !== "passed") process.exitCode = 1;
}
