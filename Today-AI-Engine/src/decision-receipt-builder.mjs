/**
 * Today AI Engine — Request-scoped Decision Receipt Builder
 * NUT-017.5
 *
 * Karar sonucundan sürümlü ve denetlenebilir bir olay üretir. Bu modül
 * foundation audit writer'ı yeniden kurmaz; olayı yazmaz veya saklamaz.
 * DOM, Today App depolaması, ağ, Connect ve sistem saatine erişmez.
 */

export const ENGINE_VERSION = "0.5.0-receipt";
export const DECISION_RECEIPT_SCHEMA_VERSION = 1;
export const EVENT_TYPE = "user-decision-recorded";
export const RULESET_ID = "today:decision-receipt:nut-017.5";

const IDENTIFIER_PATTERN =
  /^[a-z0-9](?:[a-z0-9._:-]{0,158}[a-z0-9])?$/;
const DECISIONS = new Set(["approved", "rejected", "edited"]);
const ACTION_TYPES = new Set([
  "create-reminder",
  "create-calendar-event",
  "create-task",
  "draft-email"
]);

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

function isDecision(value) {
  if (
    !isPlainObject(value) ||
    !hasOnlyKeys(value, new Set([
      "schemaVersion",
      "decisionId",
      "analysisId",
      "actionId",
      "decision",
      "decidedAt",
      "editedPayload"
    ])) ||
    value.schemaVersion !== 1 ||
    !isIdentifier(value.decisionId) ||
    !isIdentifier(value.analysisId) ||
    !isIdentifier(value.actionId) ||
    !DECISIONS.has(value.decision) ||
    !isDateTime(value.decidedAt)
  ) {
    return false;
  }

  if (value.decision === "edited") {
    return isPlainObject(value.editedPayload) &&
      hasOnlyKeys(value.editedPayload, new Set(["reminderTime"])) &&
      typeof value.editedPayload.reminderTime === "string" &&
      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
        value.editedPayload.reminderTime
      );
  }
  return value.editedPayload === undefined;
}

function isAction(value, allowedStatuses) {
  return isPlainObject(value) &&
    hasOnlyKeys(value, new Set(["actionId", "type", "label", "status"])) &&
    isIdentifier(value.actionId) &&
    ACTION_TYPES.has(value.type) &&
    typeof value.label === "string" &&
    value.label.trim().length > 0 &&
    value.label.length <= 160 &&
    allowedStatuses.has(value.status);
}

function validateRequest(request) {
  if (
    !isPlainObject(request) ||
    !hasOnlyKeys(request, new Set([
      "decision",
      "actionState",
      "replacementAction",
      "processing",
      "executionRequested",
      "auditPersisted",
      "externalTransfer"
    ])) ||
    !isDecision(request.decision) ||
    !isAction(request.actionState, DECISIONS) ||
    request.decision.actionId !== request.actionState.actionId ||
    request.decision.decision !== request.actionState.status ||
    request.processing?.mode !== "device-only" ||
    request.processing?.retention !== "request-scoped" ||
    request.processing?.externalRecipient !== null ||
    request.executionRequested !== false ||
    request.auditPersisted !== false ||
    request.externalTransfer !== false
  ) {
    return false;
  }

  if (request.decision.decision === "edited") {
    return isAction(
      request.replacementAction,
      new Set(["pending-user-approval"])
    ) && request.replacementAction.actionId !== request.actionState.actionId;
  }

  return request.replacementAction === null;
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
 * Geçerli karar sonucunu decision-receipt v1 olayına dönüştürür.
 */
export function buildDecisionReceipt(request) {
  if (!validateRequest(request)) {
    return failure("invalid-decision-receipt-request");
  }

  const edited = request.decision.decision === "edited";
  const receipt = {
    schemaVersion: DECISION_RECEIPT_SCHEMA_VERSION,
    receiptId: `receipt:${shortHash([
      request.decision.decisionId,
      request.decision.actionId
    ].join("|"))}`,
    eventType: EVENT_TYPE,
    decisionId: request.decision.decisionId,
    analysisId: request.decision.analysisId,
    actionId: request.decision.actionId,
    outcome: request.decision.decision,
    occurredAt: request.decision.decidedAt,
    actor: "user",
    actionStatus: request.actionState.status,
    ...(edited
      ? { replacementActionId: request.replacementAction.actionId }
      : {}),
    scope: {
      processingMode: "device-only",
      retention: "request-scoped",
      persistent: false,
      externalRecipient: null
    },
    effects: {
      actionExecuted: false,
      connectCalled: false,
      auditPersisted: false,
      externalTransfer: false,
      replacementRequiresApproval: edited
    }
  };

  return deepFreeze({ ok: true, receipt });
}

export default Object.freeze({
  ENGINE_VERSION,
  DECISION_RECEIPT_SCHEMA_VERSION,
  EVENT_TYPE,
  RULESET_ID,
  buildDecisionReceipt
});
