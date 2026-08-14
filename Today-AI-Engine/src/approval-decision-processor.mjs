/**
 * Today AI Engine — Request-scoped Approval Decision Processor
 * NUT-017.4
 *
 * Saf ve deterministik bir karar fonksiyonudur. DOM, Today App depolaması,
 * ağ, Connect, audit writer veya sistem saatine erişmez.
 */

export const ENGINE_VERSION = "0.4.0-approval";
export const APPROVAL_DECISION_SCHEMA_VERSION = 1;
export const RULESET_ID = "today:approval-decision:nut-017.4";

const IDENTIFIER_PATTERN =
  /^[a-z0-9](?:[a-z0-9._:-]{0,158}[a-z0-9])?$/;
const REMINDER_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
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
  return deepFreeze({
    ok: false,
    error: { code }
  });
}

function isDateTime(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function isIdentifier(value) {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

function isPendingAction(action) {
  return isPlainObject(action) &&
    hasOnlyKeys(action, new Set(["actionId", "type", "label", "status"])) &&
    isIdentifier(action.actionId) &&
    ACTION_TYPES.has(action.type) &&
    typeof action.label === "string" &&
    action.label.trim().length > 0 &&
    action.label.length <= 160 &&
    action.status === "pending-user-approval";
}

function isEditedPayload(value) {
  return isPlainObject(value) &&
    hasOnlyKeys(value, new Set(["reminderTime"])) &&
    typeof value.reminderTime === "string" &&
    REMINDER_TIME_PATTERN.test(value.reminderTime);
}

function validateRequest(request) {
  if (
    !isPlainObject(request) ||
    !hasOnlyKeys(request, new Set([
      "schemaVersion",
      "decisionId",
      "analysisId",
      "action",
      "decision",
      "decidedAt",
      "editedPayload"
    ])) ||
    request.schemaVersion !== APPROVAL_DECISION_SCHEMA_VERSION ||
    !isIdentifier(request.decisionId) ||
    !isIdentifier(request.analysisId) ||
    !isPendingAction(request.action) ||
    !DECISIONS.has(request.decision) ||
    !isDateTime(request.decidedAt)
  ) {
    return false;
  }

  if (request.decision === "edited") {
    return request.action.type === "create-reminder" &&
      isEditedPayload(request.editedPayload);
  }

  return request.editedPayload === undefined;
}

function shortHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function decisionRecord(request) {
  return {
    schemaVersion: APPROVAL_DECISION_SCHEMA_VERSION,
    decisionId: request.decisionId,
    analysisId: request.analysisId,
    actionId: request.action.actionId,
    decision: request.decision,
    decidedAt: request.decidedAt,
    ...(request.decision === "edited"
      ? { editedPayload: { reminderTime: request.editedPayload.reminderTime } }
      : {})
  };
}

function replacementAction(request) {
  if (request.decision !== "edited") return null;
  const reminderTime = request.editedPayload.reminderTime;
  const revisionToken = shortHash([
    request.analysisId,
    request.action.actionId,
    request.decisionId,
    reminderTime
  ].join("|"));

  return {
    actionId: `action:revision:${revisionToken}`,
    type: "create-reminder",
    label: `Uyku hazırlığını ${reminderTime} için hatırla`,
    status: "pending-user-approval"
  };
}

/**
 * approval-decision v1 kaydı ve geçici eylem durumunu üretir.
 * Düzenleme onay sayılmaz; yeni bir taslak oluşturur ve yeniden onay ister.
 */
export function processApprovalDecision(request) {
  if (!validateRequest(request)) {
    return failure("invalid-approval-decision");
  }

  const status = request.decision === "approved"
    ? "approved"
    : request.decision === "rejected"
      ? "rejected"
      : "edited";

  return deepFreeze({
    ok: true,
    decision: decisionRecord(request),
    actionState: {
      ...request.action,
      status
    },
    replacementAction: replacementAction(request),
    processing: {
      mode: "device-only",
      retention: "request-scoped",
      externalRecipient: null
    },
    executionRequested: false,
    auditPersisted: false,
    externalTransfer: false
  });
}

export default Object.freeze({
  ENGINE_VERSION,
  APPROVAL_DECISION_SCHEMA_VERSION,
  RULESET_ID,
  processApprovalDecision
});
