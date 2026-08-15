const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const GROUPS = Object.freeze([
  "tests/ai-context-source-adapters.test.cjs",
  "tests/ai-context-bridge.test.mjs",
  "tests/ai-analysis-bridge.test.mjs",
  "tests/ai-approval-bridge.test.mjs",
  "tests/ai-context-ui.test.mjs"
]);

let passed = 0;
let expected = 0;
const failures = [];

for (const file of GROUPS) {
  const result = spawnSync(process.execPath, [file], {
    cwd: ROOT,
    env: { ...process.env, TZ: "Europe/Istanbul" },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("");
  process.stdout.write(`\n=== ${file} ===\n${output}`);
  const summary = output.match(
    /NUT-017\.(?:2|3|4|5|6|7|8|9)(?:\.[12])? [^:]+: (\d+)\/(\d+) başarılı/
  );
  if (!summary || result.status !== 0 || summary[1] !== summary[2]) {
    failures.push({ file, status: result.status });
    continue;
  }
  passed += Number(summary[1]);
  expected += Number(summary[2]);
}

if (failures.length) {
  console.error("\nNUT-017.5 Gate başarısız:", failures);
  process.exitCode = 1;
} else {
  console.log(`\nNUT-017.5 Gate: ${passed}/${expected} başarılı`);
}
