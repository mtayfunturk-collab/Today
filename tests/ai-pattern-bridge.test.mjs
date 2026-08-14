import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTodayContext } from "../Today-AI-Engine/src/context-builder.mjs";
import {
  buildPatternPreview,
  getStatus
} from "../modules/ai-pattern-bridge.mjs";

const bridgeSource = await readFile(
  new URL("../modules/ai-pattern-bridge.mjs", import.meta.url),
  "utf8"
);
const clone = value => JSON.parse(JSON.stringify(value));

function contextWithDays(days) {
  const purpose = "Son 7 gündeki tekrarları cihazda gözlemleme";
  const built = buildTodayContext({
    schemaVersion: 1,
    requestId: "pattern-bridge-context",
    purpose,
    requestedAt: "2040-01-16T12:00:00.000Z",
    window: {
      startDate: "2040-01-09",
      endDate: "2040-01-15",
      maxEventsPerSource: 20
    },
    consent: {
      schemaVersion: 1,
      consentId: "pattern-bridge-consent",
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
    events: days.flatMap(([localDate, choice, durationMinutes]) => [
      {
        schemaVersion: 1,
        eventId: `core-bridge-${localDate}`,
        source: "today-core",
        eventType: "daily-checkin",
        createdAt: `${localDate}T18:00:00.000Z`,
        localDate,
        payload: { choice }
      },
      {
        schemaVersion: 1,
        eventId: `sleep-bridge-${localDate}`,
        source: "today-health",
        eventType: "sleep-record",
        createdAt: `${localDate}T07:00:00.000Z`,
        localDate,
        payload: { durationMinutes }
      }
    ])
  });
  assert.equal(built.ok, true);
  return built.context;
}

const matchingContext = contextWithDays([
  ["2040-01-09", "C", 330],
  ["2040-01-10", "B", 420],
  ["2040-01-11", "C", 340],
  ["2040-01-12", "A", 390]
]);

function options(context = matchingContext) {
  return {
    observationId: "pattern:nut-017.6:bridge-001",
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

await test("Köprü cihaz-içi, eylemsiz ve nedenselliksiz durum bildirir", () => {
  const status = getStatus();
  assert.equal(status.ready, true);
  assert.equal(status.engineVersion, "0.6.0-pattern");
  assert.equal(status.rulesetId, "today:ai-pattern-bridge:nut-017.6");
  assert.equal(status.processingMode, "device-only");
  assert.equal(status.retention, "request-scoped");
  assert.equal(status.externalRecipient, null);
  assert.equal(status.providerRegistered, false);
  assert.equal(status.skyUsed, false);
  assert.equal(status.causalityClaim, false);
  assert.equal(status.approvalRequired, false);
  assert.equal(status.actionProposed, false);
  assert.equal(status.connectEnabled, false);
  assert.equal(status.auditPersistenceEnabled, false);
  assert.equal(Object.isFrozen(status), true);
});

await test("Geçerli çok günlük bağlam sade gözlem üretir", () => {
  const result = buildPatternPreview(options());
  assert.equal(result.success, true);
  assert.equal(result.observation.type, "core-sleep-recurrence");
  assert.equal(result.observation.window.eligibleDays, 4);
  assert.equal(result.observation.window.matchingDays, 2);
  assert.equal(result.observation.evidence.length, 2);
  assert.equal(result.observation.boundaries.causalityClaim, false);
  assert.equal(Object.isFrozen(result.observation), true);
});

await test("Yetersiz karşılaştırılabilir gün kontrollü sonuç döndürür", () => {
  const context = contextWithDays([
    ["2040-01-09", "C", 330],
    ["2040-01-10", "B", 420]
  ]);
  const result = buildPatternPreview(options(context));
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "TODAY-AI-PATTERN-INSUFFICIENT-DATA");
  assert.equal(result.patternEvaluation.counts.eligibleDays, 2);
});

await test("Tekrar yoksa gözlem uydurulmaz", () => {
  const context = contextWithDays([
    ["2040-01-09", "C", 330],
    ["2040-01-10", "B", 420],
    ["2040-01-11", "A", 390]
  ]);
  const result = buildPatternPreview(options(context));
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "TODAY-AI-PATTERN-NO-RECURRENCE");
  assert.equal(result.patternEvaluation.counts.matchingDays, 1);
});

await test("Geçersiz bağlam fail-closed reddedilir", () => {
  const context = clone(matchingContext);
  context.boundaries.externalTransfer = true;
  const result = buildPatternPreview(options(context));
  assert.deepEqual({ ...result }, {
    success: false,
    errorCode: "TODAY-AI-PATTERN-REQUEST",
    patternError: "invalid-pattern-observation-request"
  });
});

await test("Gözlem işlem, onay, dış aktarım veya audit başlatmaz", () => {
  const result = buildPatternPreview(options());
  assert.equal(result.externalTransfer, false);
  assert.equal(result.actionStarted, false);
  assert.equal(result.approvalRequired, false);
  assert.equal(result.auditPersisted, false);
  assert.equal(result.observation.approval.status, "not-required");
  assert.equal(result.observation.boundaries.actionProposed, false);
});

await test("Köprü aynı bağlamda deterministik sonuç verir", () => {
  assert.deepEqual(buildPatternPreview(options()), buildPatternPreview(options()));
});

await test("Örüntü köprüsü DOM, storage, ağ, TodayAI veya Connect çağırmaz", () => {
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
console.log(`NUT-017.6 Pattern Bridge: ${passed}/${results.length} başarılı`);
