import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTodayContext } from "../Today-AI-Engine/src/context-builder.mjs";
import { buildPatternPreview } from "../modules/ai-pattern-bridge.mjs";
import {
  getStatus,
  recordPatternFeedback
} from "../modules/ai-pattern-feedback-bridge.mjs";

const bridgeSource = await readFile(
  new URL("../modules/ai-pattern-feedback-bridge.mjs", import.meta.url),
  "utf8"
);
const clone = value => JSON.parse(JSON.stringify(value));

function observation() {
  const purpose = "Son 7 gündeki tekrarları cihazda gözlemleme";
  const context = buildTodayContext({
    schemaVersion: 1,
    requestId: "feedback-bridge-context",
    purpose,
    requestedAt: "2040-01-16T12:00:00.000Z",
    window: {
      startDate: "2040-01-09",
      endDate: "2040-01-15",
      maxEventsPerSource: 20
    },
    consent: {
      schemaVersion: 1,
      consentId: "feedback-bridge-consent",
      purpose,
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
    events: [
      ["2040-01-09", "C", 330],
      ["2040-01-10", "B", 420],
      ["2040-01-11", "C", 340]
    ].flatMap(([localDate, choice, durationMinutes]) => [
      {
        schemaVersion: 1,
        eventId: `core-feedback-bridge-${localDate}`,
        source: "today-core",
        eventType: "daily-checkin",
        createdAt: `${localDate}T18:00:00.000Z`,
        localDate,
        payload: { choice }
      },
      {
        schemaVersion: 1,
        eventId: `sleep-feedback-bridge-${localDate}`,
        source: "today-health",
        eventType: "sleep-record",
        createdAt: `${localDate}T07:00:00.000Z`,
        localDate,
        payload: { durationMinutes }
      }
    ])
  });
  assert.equal(context.ok, true);
  const pattern = buildPatternPreview({
    observationId: "pattern:nut-017.7:feedback-bridge-observation",
    requestedAt: "2040-01-16T12:01:00.000Z",
    context: context.context
  });
  assert.equal(pattern.success, true);
  return pattern.observation;
}

function options(response = "resonates") {
  return {
    feedbackId: `feedback:nut-017.7:bridge-${response}`,
    observation: observation(),
    response,
    respondedAt: "2040-01-16T12:02:00.000Z"
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

await test("Köprü cihaz-içi ve istek-süreli durum bildirir", () => {
  const status = getStatus();
  assert.equal(status.ready, true);
  assert.equal(status.engineVersion, "0.7.0-feedback");
  assert.equal(status.rulesetId, "today:ai-pattern-feedback-bridge:nut-017.7");
  assert.equal(status.processingMode, "device-only");
  assert.equal(status.retention, "request-scoped");
  assert.equal(status.persistent, false);
  assert.equal(status.externalRecipient, null);
  assert.equal(status.feedbackReceiptEnabled, true);
  assert.equal(status.observationMutationEnabled, false);
  assert.equal(status.modelLearningEnabled, false);
  assert.equal(status.memoryEnabled, false);
  assert.equal(status.connectEnabled, false);
  assert.equal(status.executionEnabled, false);
  assert.equal(status.auditPersistenceEnabled, false);
  assert.equal(Object.isFrozen(status), true);
});

await test("Geçerli kullanıcı yanıtı gözleme bağlı makbuz üretir", () => {
  const request = options();
  const result = recordPatternFeedback(request);
  assert.equal(result.success, true);
  assert.equal(result.receipt.observationId, request.observation.observationId);
  assert.equal(result.receipt.response, "resonates");
  assert.equal(result.receipt.actor, "user");
  assert.equal(Object.isFrozen(result.receipt.effects), true);
});

await test("Üç sade geri bildirim seçeneği de kabul edilir", () => {
  for (const response of ["resonates", "does-not-resonate", "unsure"]) {
    const result = recordPatternFeedback(options(response));
    assert.equal(result.success, true);
    assert.equal(result.receipt.response, response);
  }
});

await test("Bilinmeyen geri bildirim fail-closed reddedilir", () => {
  const result = recordPatternFeedback(options("kararsızım"));
  assert.deepEqual({ ...result }, {
    success: false,
    errorCode: "TODAY-AI-PATTERN-FEEDBACK",
    feedbackError: "invalid-pattern-feedback"
  });
});

await test("Sınırı değiştirilmiş gözlem geri bildirime dayanak olamaz", () => {
  const request = options();
  request.observation = clone(request.observation);
  request.observation.boundaries.causalityClaim = true;
  const result = recordPatternFeedback(request);
  assert.equal(result.success, false);
  assert.equal(result.feedbackError, "invalid-pattern-feedback");
});

await test("Geri bildirim gözlem, model, hafıza veya işlem değiştirmez", () => {
  const result = recordPatternFeedback(options("does-not-resonate"));
  assert.equal(result.observationChanged, false);
  assert.equal(result.modelUpdated, false);
  assert.equal(result.memoryWritten, false);
  assert.equal(result.actionStarted, false);
  assert.equal(result.connectCalled, false);
  assert.equal(result.auditPersisted, false);
  assert.equal(result.externalTransfer, false);
  assert.deepEqual({ ...result.receipt.boundaries }, {
    causalityClaim: false,
    diagnosis: false,
    skyUsed: false
  });
});

await test("Köprü aynı girdide deterministik sonuç verir", () => {
  const request = options("unsure");
  assert.deepEqual(
    recordPatternFeedback(request),
    recordPatternFeedback(request)
  );
});

await test("Geri bildirim köprüsü DOM, storage, ağ veya Connect çağırmaz", () => {
  assert.doesNotMatch(
    bridgeSource,
    /(?:localStorage|sessionStorage|indexedDB|document\s*\.|querySelector\s*\(|getElementById\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayAI\s*\.|TodayConnect\s*\.)/
  );
});

const failures = results.filter(result => !result.success);
failures.forEach(result => {
  console.error(`FAIL — ${result.name}`);
  console.error(result.error?.stack || result.error);
});
if (failures.length) process.exitCode = 1;
const passed = results.length - failures.length;
console.log(`NUT-017.7 Pattern Feedback Bridge: ${passed}/${results.length} başarılı`);
