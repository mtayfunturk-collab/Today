import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTodayContext } from "../src/context-builder.mjs";
import {
  CAPABILITY,
  observeTodayPattern
} from "../src/pattern-observer.mjs";
import {
  ENGINE_VERSION,
  EVENT_TYPE,
  PATTERN_FEEDBACK_RECEIPT_SCHEMA_VERSION,
  PATTERN_FEEDBACK_SCHEMA_VERSION,
  RESPONSE_VALUES,
  RULESET_ID,
  processPatternFeedback
} from "../src/pattern-feedback-processor.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const loadJson = async relativePath => JSON.parse(
  await readFile(new URL(relativePath, import.meta.url), "utf8")
);

function validObservation() {
  const purpose = "Son 7 gündeki tekrarları cihazda gözlemleme";
  const events = [
    ["2040-01-09", "C", 330],
    ["2040-01-10", "B", 420],
    ["2040-01-11", "C", 340],
    ["2040-01-12", "A", 390]
  ].flatMap(([localDate, choice, durationMinutes]) => [
    {
      schemaVersion: 1,
      eventId: `core-feedback-${localDate}`,
      source: "today-core",
      eventType: "daily-checkin",
      createdAt: `${localDate}T18:00:00.000Z`,
      localDate,
      payload: { choice }
    },
    {
      schemaVersion: 1,
      eventId: `sleep-feedback-${localDate}`,
      source: "today-health",
      eventType: "sleep-record",
      createdAt: `${localDate}T07:00:00.000Z`,
      localDate,
      payload: { durationMinutes }
    }
  ]);
  const context = buildTodayContext({
    schemaVersion: 1,
    requestId: "pattern-feedback-context",
    purpose,
    requestedAt: "2040-01-16T12:00:00.000Z",
    window: {
      startDate: "2040-01-09",
      endDate: "2040-01-15",
      maxEventsPerSource: 20
    },
    consent: {
      schemaVersion: 1,
      consentId: "pattern-feedback-consent",
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
    events
  });
  assert.equal(context.ok, true);
  const observed = observeTodayPattern({
    schemaVersion: 1,
    observationId: "pattern:nut-017.7:feedback-observation",
    capability: CAPABILITY,
    requestedAt: "2040-01-16T12:01:00.000Z",
    context: context.context
  });
  assert.equal(observed.ok, true);
  return observed.observation;
}

function validRequest(response = "resonates") {
  return {
    schemaVersion: 1,
    feedbackId: `feedback:nut-017.7:${response}`,
    observation: clone(validObservation()),
    response,
    respondedAt: "2040-01-16T12:02:00.000Z"
  };
}

export async function runPatternFeedbackProcessorTests() {
  const requestSchema = await loadJson(
    "../contracts/pattern-feedback.schema.json"
  );
  const receiptSchema = await loadJson(
    "../contracts/pattern-feedback-receipt.schema.json"
  );
  const source = await readFile(
    new URL("../src/pattern-feedback-processor.mjs", import.meta.url),
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

  equal(ENGINE_VERSION, "0.7.0-feedback", "Geri bildirim sürümü doğru olmalı");
  equal(RULESET_ID, "today:pattern-feedback:nut-017.7", "Kural kimliği sabit olmalı");
  equal(PATTERN_FEEDBACK_SCHEMA_VERSION, 1, "Geri bildirim sözleşmesi v1 olmalı");
  equal(
    PATTERN_FEEDBACK_RECEIPT_SCHEMA_VERSION,
    1,
    "Makbuz sözleşmesi v1 olmalı"
  );
  equal(EVENT_TYPE, "pattern-feedback-recorded", "Olay türü sabit olmalı");
  deepEqual(
    [...RESPONSE_VALUES],
    ["resonates", "does-not-resonate", "unsure"],
    "Yalnız üç açık kullanıcı yanıtı kabul edilmeli"
  );
  equal(
    requestSchema.properties.observation.$ref,
    "pattern-observation-output.schema.json",
    "Geri bildirim geçerli gözlem sözleşmesine bağlanmalı"
  );

  const request = validRequest();
  const first = processPatternFeedback(request);
  equal(first.ok, true, "Geçerli geri bildirim kabul edilmeli");
  check(
    receiptSchema.required.every(field => Object.hasOwn(first.receipt, field)),
    "Makbuz tüm sürümlü alanları taşımalı"
  );
  equal(first.receipt.schemaVersion, 1, "Makbuz schemaVersion 1 olmalı");
  equal(first.receipt.eventType, EVENT_TYPE, "Makbuz olay türünü taşımalı");
  equal(first.receipt.feedbackId, request.feedbackId, "Geri bildirim izi korunmalı");
  equal(
    first.receipt.observationId,
    request.observation.observationId,
    "Geri bildirim gerçek gözleme bağlanmalı"
  );
  equal(first.receipt.response, "resonates", "Kullanıcı yanıtı korunmalı");
  equal(first.receipt.respondedAt, request.respondedAt, "Yanıt zamanı korunmalı");
  equal(first.receipt.actor, "user", "Yanıtın sahibi kullanıcı olmalı");
  deepEqual(
    first.receipt.scope,
    {
      processingMode: "device-only",
      retention: "request-scoped",
      persistent: false,
      externalRecipient: null
    },
    "Geri bildirim yalnız cihazda ve istek süresince tutulmalı"
  );
  deepEqual(
    first.receipt.effects,
    {
      observationChanged: false,
      confidenceChanged: false,
      modelUpdated: false,
      memoryWritten: false,
      actionExecuted: false,
      connectCalled: false,
      auditPersisted: false,
      externalTransfer: false
    },
    "Geri bildirim öğrenme, kalıcılık veya işlem başlatmamalı"
  );
  deepEqual(
    first.receipt.boundaries,
    { causalityClaim: false, diagnosis: false, skyUsed: false },
    "Nedensellik, teşhis ve Sky sınırı korunmalı"
  );
  check(
    Object.isFrozen(first) &&
      Object.isFrozen(first.receipt) &&
      Object.isFrozen(first.receipt.effects),
    "Sonuç derin dondurulmalı"
  );
  deepEqual(
    processPatternFeedback(request),
    first,
    "Aynı istek deterministik sonuç vermeli"
  );

  for (const response of RESPONSE_VALUES) {
    const result = processPatternFeedback(validRequest(response));
    equal(result.ok, true, `${response} yanıtı kabul edilmeli`);
    equal(result.receipt.response, response, `${response} değiştirilmemeli`);
  }

  const invalidCases = [
    ["unknown-response", value => { value.response = "maybe"; }],
    ["invalid-feedback-id", value => { value.feedbackId = "Geri Bildirim"; }],
    ["invalid-time", value => { value.respondedAt = "yarın"; }],
    ["unknown-request-field", value => { value.storageKey = "today_store_v2"; }],
    ["unknown-observation-field", value => { value.observation.provider = "x"; }],
    ["wrong-observation-type", value => { value.observation.type = "forecast"; }],
    ["causal-observation", value => { value.observation.boundaries.causalityClaim = true; }],
    ["diagnostic-observation", value => { value.observation.boundaries.diagnosis = true; }],
    ["sky-backed-observation", value => { value.observation.boundaries.skyUsed = true; }],
    ["action-observation", value => { value.observation.boundaries.actionProposed = true; }],
    ["external-observation", value => { value.observation.boundaries.externalRecipient = "vendor"; }],
    ["persistent-observation", value => { value.observation.boundaries.retention = "persistent"; }],
    ["approval-observation", value => { value.observation.approval.required = true; }],
    ["probability-claim", value => { value.observation.confidence.probabilityClaim = true; }],
    ["wrong-confidence-level", value => { value.observation.confidence.level = "strong"; }],
    ["wrong-evidence-source", value => { value.observation.evidence[0].core.source = "today-sky"; }],
    ["missing-evidence", value => { value.observation.evidence.pop(); }],
    ["duplicate-day", value => { value.observation.evidence[1].localDate = value.observation.evidence[0].localDate; }],
    ["wrong-window", value => { value.observation.window.startDate = "2040-01-10"; }]
  ];

  for (const [name, mutate] of invalidCases) {
    const invalid = validRequest();
    mutate(invalid);
    deepEqual(
      processPatternFeedback(invalid),
      { ok: false, error: { code: "invalid-pattern-feedback" } },
      `${name} fail-closed reddedilmeli`
    );
  }

  check(
    !/(?:localStorage|sessionStorage|indexedDB|document\s*\.|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|TodayConnect|Date\.now|new Date\s*\(\s*\))/.test(source),
    "Saf işlemci DOM, depolama, ağ, Connect veya sistem saatini kullanmamalı"
  );

  return checks;
}
