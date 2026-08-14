/**
 * Today AI Engine — Request-scoped Pattern Feedback Processor
 * NUT-017.7
 *
 * Kullanıcının açıklanabilir örüntü gözlemine verdiği geri bildirimi yalnız
 * mevcut istek için sürümlü bir makbuza dönüştürür. Gözlemi değiştirmez,
 * model öğrenmesi veya kalıcı hafıza başlatmaz. DOM, Today App depolaması,
 * ağ, Connect, audit writer ve sistem saatine erişmez.
 */

export const ENGINE_VERSION = "0.7.0-feedback";
export const PATTERN_FEEDBACK_SCHEMA_VERSION = 1;
export const PATTERN_FEEDBACK_RECEIPT_SCHEMA_VERSION = 1;
export const EVENT_TYPE = "pattern-feedback-recorded";
export const RULESET_ID = "today:pattern-feedback:nut-017.7";
export const RESPONSE_VALUES = Object.freeze([
  "resonates",
  "does-not-resonate",
  "unsure"
]);

const IDENTIFIER_PATTERN =
  /^[a-z0-9](?:[a-z0-9._:-]{0,158}[a-z0-9])?$/;
const RESPONSE_SET = new Set(RESPONSE_VALUES);
const CONFIDENCE_LEVELS = new Set(["limited", "moderate", "strong"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every(key => allowedKeys.has(key));
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach(entry => deepFreeze(entry, seen));
  return Object.freeze(value);
}

function failure(code) {
  return deepFreeze({ ok: false, error: { code } });
}

function isIdentifier(value) {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function isDateTime(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function inclusiveDays(startDate, endDate) {
  if (!isDateKey(startDate) || !isDateKey(endDate) || startDate > endDate) {
    return null;
  }
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

function isText(value, maxLength = 500) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength;
}

function isTextList(value, minimum) {
  return Array.isArray(value) &&
    value.length >= minimum &&
    value.length <= 12 &&
    value.every(entry => isText(entry));
}

function confidenceLevelFor(score) {
  if (score >= 0.75) return "strong";
  if (score >= 0.6) return "moderate";
  return "limited";
}

function isEvidenceReference(value, source) {
  return isPlainObject(value) &&
    hasOnlyKeys(value, new Set(["source", "eventId", "reference"])) &&
    value.source === source &&
    isIdentifier(value.eventId) &&
    isText(value.reference, 200);
}

function isEvidence(value, startDate, endDate) {
  return isPlainObject(value) &&
    hasOnlyKeys(value, new Set(["localDate", "core", "health"])) &&
    isDateKey(value.localDate) &&
    value.localDate >= startDate &&
    value.localDate <= endDate &&
    isEvidenceReference(value.core, "today-core") &&
    isEvidenceReference(value.health, "today-health");
}

function isObservation(value) {
  if (
    !isPlainObject(value) ||
    !hasOnlyKeys(value, new Set([
      "schemaVersion",
      "observationId",
      "type",
      "summary",
      "window",
      "evidence",
      "confidence",
      "uncertainty",
      "alternatives",
      "approval",
      "boundaries"
    ])) ||
    value.schemaVersion !== 1 ||
    !isIdentifier(value.observationId) ||
    value.type !== "core-sleep-recurrence" ||
    !isText(value.summary) ||
    !isPlainObject(value.window) ||
    !hasOnlyKeys(value.window, new Set([
      "startDate",
      "endDate",
      "totalDays",
      "eligibleDays",
      "matchingDays"
    ])) ||
    !isDateKey(value.window.startDate) ||
    !isDateKey(value.window.endDate) ||
    inclusiveDays(value.window.startDate, value.window.endDate) !== 7 ||
    value.window.totalDays !== 7 ||
    !Number.isInteger(value.window.eligibleDays) ||
    value.window.eligibleDays < 3 ||
    value.window.eligibleDays > 7 ||
    !Number.isInteger(value.window.matchingDays) ||
    value.window.matchingDays < 2 ||
    value.window.matchingDays > value.window.eligibleDays ||
    !Array.isArray(value.evidence) ||
    value.evidence.length !== value.window.matchingDays ||
    !value.evidence.every(entry => isEvidence(
      entry,
      value.window.startDate,
      value.window.endDate
    )) ||
    new Set(value.evidence.map(entry => entry.localDate)).size !==
      value.evidence.length ||
    !isPlainObject(value.confidence) ||
    !hasOnlyKeys(value.confidence, new Set([
      "score",
      "level",
      "basis",
      "probabilityClaim"
    ])) ||
    !Number.isFinite(value.confidence.score) ||
    value.confidence.score < 0 ||
    value.confidence.score > 0.85 ||
    !CONFIDENCE_LEVELS.has(value.confidence.level) ||
    value.confidence.level !== confidenceLevelFor(value.confidence.score) ||
    value.confidence.basis !== "window-coverage-and-recurrence" ||
    value.confidence.probabilityClaim !== false ||
    !isTextList(value.uncertainty, 2) ||
    !isTextList(value.alternatives, 3) ||
    !isPlainObject(value.approval) ||
    !hasOnlyKeys(value.approval, new Set(["required", "status"])) ||
    value.approval.required !== false ||
    value.approval.status !== "not-required" ||
    !isPlainObject(value.boundaries) ||
    !hasOnlyKeys(value.boundaries, new Set([
      "interpretation",
      "causalityClaim",
      "diagnosis",
      "skyUsed",
      "processingMode",
      "retention",
      "externalRecipient",
      "actionProposed"
    ])) ||
    value.boundaries.interpretation !== "descriptive-observation" ||
    value.boundaries.causalityClaim !== false ||
    value.boundaries.diagnosis !== false ||
    value.boundaries.skyUsed !== false ||
    value.boundaries.processingMode !== "device-only" ||
    value.boundaries.retention !== "request-scoped" ||
    value.boundaries.externalRecipient !== null ||
    value.boundaries.actionProposed !== false
  ) {
    return false;
  }

  return true;
}

function validateRequest(request) {
  return isPlainObject(request) &&
    hasOnlyKeys(request, new Set([
      "schemaVersion",
      "feedbackId",
      "observation",
      "response",
      "respondedAt"
    ])) &&
    request.schemaVersion === PATTERN_FEEDBACK_SCHEMA_VERSION &&
    isIdentifier(request.feedbackId) &&
    isObservation(request.observation) &&
    RESPONSE_SET.has(request.response) &&
    isDateTime(request.respondedAt);
}

function shortHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Geçerli kullanıcı geri bildirimini istek-süreli bir makbuza dönüştürür.
 */
export function processPatternFeedback(request) {
  if (!validateRequest(request)) {
    return failure("invalid-pattern-feedback");
  }

  const receipt = {
    schemaVersion: PATTERN_FEEDBACK_RECEIPT_SCHEMA_VERSION,
    receiptId: `pattern-feedback-receipt:${shortHash([
      request.feedbackId,
      request.observation.observationId,
      request.response,
      request.respondedAt
    ].join("|"))}`,
    eventType: EVENT_TYPE,
    feedbackId: request.feedbackId,
    observationId: request.observation.observationId,
    response: request.response,
    respondedAt: request.respondedAt,
    actor: "user",
    scope: {
      processingMode: "device-only",
      retention: "request-scoped",
      persistent: false,
      externalRecipient: null
    },
    effects: {
      observationChanged: false,
      confidenceChanged: false,
      modelUpdated: false,
      memoryWritten: false,
      actionExecuted: false,
      connectCalled: false,
      auditPersisted: false,
      externalTransfer: false
    },
    boundaries: {
      causalityClaim: false,
      diagnosis: false,
      skyUsed: false
    }
  };

  return deepFreeze({ ok: true, receipt });
}

export default Object.freeze({
  ENGINE_VERSION,
  PATTERN_FEEDBACK_SCHEMA_VERSION,
  PATTERN_FEEDBACK_RECEIPT_SCHEMA_VERSION,
  EVENT_TYPE,
  RULESET_ID,
  RESPONSE_VALUES,
  processPatternFeedback
});
