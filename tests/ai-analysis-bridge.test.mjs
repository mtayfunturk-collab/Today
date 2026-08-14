import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTodayContext } from "../Today-AI-Engine/src/context-builder.mjs";
import {
  buildAnalysisPreview,
  getStatus
} from "../modules/ai-analysis-bridge.mjs";

const loadJson = async relativePath => JSON.parse(
  await readFile(new URL(relativePath, import.meta.url), "utf8")
);
const clone = value => JSON.parse(JSON.stringify(value));
const sourceRequest = await loadJson(
  "../Today-AI-Engine/fixtures/synthetic/nut-017.1-context-request.json"
);
const bridgeSource = await readFile(
  new URL("../modules/ai-analysis-bridge.mjs", import.meta.url),
  "utf8"
);

function contextWith({ choice = "C", sleepMinutes = 330 } = {}) {
  const request = clone(sourceRequest);
  request.events.find(
    event => event.eventId === "core-20400115"
  ).payload.choice = choice;
  request.events.find(
    event => event.eventId === "sleep-20400115"
  ).payload.durationMinutes = sleepMinutes;
  return buildTodayContext(request).context;
}

function options(context = contextWith()) {
  return {
    analysisId: "analysis:nut-017.3.1:bridge-001",
    requestedAt: "2040-01-16T12:01:00.000Z",
    context
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

await test("Köprü cihaz-içi, sağlayıcısız ve Connect'siz durum bildirir", () => {
  const status = getStatus();
  assert.equal(status.ready, true);
  assert.equal(status.engineVersion, "0.3.1-analysis");
  assert.equal(status.rulesetId, "today:ai-analysis-bridge:nut-017.3.1");
  assert.equal(status.processingMode, "device-only");
  assert.equal(status.externalRecipient, null);
  assert.equal(status.providerRegistered, false);
  assert.equal(status.connectEnabled, false);
  assert.equal(status.skyUsedAsEvidence, false);
  assert.equal(Object.isFrozen(status), true);
});

await test("Geçerli request-scoped bağlam açıklanabilir çıktı üretir", () => {
  const result = buildAnalysisPreview(options());
  assert.equal(result.success, true);
  assert.equal(result.analysis.schemaVersion, 1);
  assert.equal(result.analysis.type, "daily-support-suggestion");
  assert.equal(result.provider, null);
  assert.equal(result.externalTransfer, false);
  assert.equal(result.actionStarted, false);
});

await test("Çıktı dayanak, güven, belirsizlik, seçenek ve onay taşır", () => {
  const { analysis } = buildAnalysisPreview(options());
  assert.equal(analysis.evidence.length, 2);
  assert.equal(analysis.confidence, 0.72);
  assert.ok(analysis.uncertainty.length > 0);
  assert.ok(analysis.alternatives.length > 0);
  assert.equal(analysis.requiresUserApproval, true);
  assert.ok(analysis.proposedActions.length > 0);
});

await test("Her dayanak Context provenance kaydına bağlanır", () => {
  const context = contextWith();
  const { analysis } = buildAnalysisPreview(options(context));
  assert.equal(analysis.evidence.every(evidence => context.provenance.some(
    provenance => provenance.eventId === evidence.eventId &&
      provenance.source === evidence.source
  )), true);
});

await test("Sky pakette bulunsa da dayanak veya güven girdisi olmaz", () => {
  const context = contextWith();
  assert.equal(context.counts.symbolicSky, 1);
  const first = buildAnalysisPreview(options(context));
  assert.equal(first.analysis.evidence.some(
    evidence => evidence.source === "today-sky"
  ), false);
  const changed = clone(context);
  changed.sections.symbolicContext.items[0].facts.sky.planets.reverse();
  assert.deepEqual(buildAnalysisPreview(options(changed)), first);
});

await test("Eşleşmeyen kayıt için çıktı uydurulmaz", () => {
  const result = buildAnalysisPreview(options(contextWith({ sleepMinutes: 420 })));
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "TODAY-AI-ANALYSIS-NO-MATCH");
  assert.equal(result.analysisError, "no-matching-rule");
  assert.equal(result.ruleEvaluation.observed.sleep.durationMinutes, 420);
  assert.equal(result.ruleEvaluation.checks.sleepDuration, false);
  assert.deepEqual(result.ruleEvaluation.reasons, [
    "sleep-duration-not-below-threshold"
  ]);
  assert.equal(Object.isFrozen(result.ruleEvaluation), true);
});

await test("Core C yoksa dar ilk kural çalışmaz", () => {
  const result = buildAnalysisPreview(options(contextWith({ choice: "B" })));
  assert.equal(result.errorCode, "TODAY-AI-ANALYSIS-NO-MATCH");
});

await test("Bozuk veya cihaz-dışı context fail-closed reddedilir", () => {
  const context = clone(contextWith());
  context.boundaries.externalTransfer = true;
  const result = buildAnalysisPreview(options(context));
  assert.deepEqual(clone(result), {
    success: false,
    errorCode: "TODAY-AI-ANALYSIS-REQUEST",
    analysisError: "invalid-analysis-request"
  });
  assert.equal(Object.hasOwn(result, "ruleEvaluation"), false);
});

await test("İşlem yalnız onay bekleyen taslak olarak kalır", () => {
  const result = buildAnalysisPreview(options());
  assert.equal(result.analysis.proposedActions.every(
    action => action.status === "pending-user-approval"
  ), true);
  assert.equal(result.actionStarted, false);
});

await test("Analiz köprüsü DOM, storage, ağ, TodayAI veya Connect çağırmaz", () => {
  assert.doesNotMatch(
    bridgeSource,
    /(?:localStorage|sessionStorage|indexedDB|document\s*\.|querySelector\s*\(|getElementById\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayAI\s*\.|requestProposal\s*\(|TodayConnect\s*\.)/
  );
});

const failures = results.filter(result => !result.success);
failures.forEach(result => {
  console.error(`FAIL — ${result.name}`);
  console.error(result.error?.stack || result.error);
});
if (failures.length) process.exitCode = 1;
const passed = results.length - failures.length;
console.log(`NUT-017.3.1 Analysis Bridge: ${passed}/${results.length} başarılı`);
