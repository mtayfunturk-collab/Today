/**
 * Today App ↔ Today AI Engine Approval Decision Bridge
 * NUT-017.4
 *
 * Onay kararını saf Engine katmanına iletir. DOM, App depolaması, ağ,
 * Connect veya kalıcı audit yazımı kullanmaz.
 */
import {
  APPROVAL_DECISION_SCHEMA_VERSION,
  ENGINE_VERSION,
  RULESET_ID as ENGINE_RULESET_ID,
  processApprovalDecision
} from "../Today-AI-Engine/src/approval-decision-processor.mjs";

export const API_VERSION = 1;
export const CONTRACT_VERSION = 1;
export const RULESET_ID = "today:ai-approval-bridge:nut-017.4";

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach(entry => deepFreeze(entry, seen));
  return Object.freeze(value);
}

export function getStatus() {
  return deepFreeze({
    apiVersion: API_VERSION,
    contractVersion: CONTRACT_VERSION,
    rulesetId: RULESET_ID,
    engineRulesetId: ENGINE_RULESET_ID,
    engineVersion: ENGINE_VERSION,
    ready: true,
    processingMode: "device-only",
    retention: "request-scoped",
    externalRecipient: null,
    connectEnabled: false,
    executionEnabled: false,
    auditPersistenceEnabled: false
  });
}

export function recordApprovalDecision(options = {}) {
  const result = processApprovalDecision({
    schemaVersion: APPROVAL_DECISION_SCHEMA_VERSION,
    decisionId: options.decisionId,
    analysisId: options.analysisId,
    action: options.action,
    decision: options.decision,
    decidedAt: options.decidedAt,
    ...(options.editedPayload === undefined
      ? {}
      : { editedPayload: options.editedPayload })
  });

  if (!result.ok) {
    return deepFreeze({
      success: false,
      errorCode: "TODAY-AI-APPROVAL-DECISION",
      decisionError: result.error.code
    });
  }

  return deepFreeze({
    success: true,
    decision: result.decision,
    actionState: result.actionState,
    replacementAction: result.replacementAction,
    processing: result.processing,
    executionRequested: result.executionRequested,
    auditPersisted: result.auditPersisted,
    externalTransfer: result.externalTransfer
  });
}

const publicApi = Object.freeze({
  API_VERSION,
  CONTRACT_VERSION,
  RULESET_ID,
  ENGINE_VERSION,
  getStatus,
  recordApprovalDecision
});

if (typeof window !== "undefined") {
  window.TodayAIApprovalBridge = publicApi;
  if (
    typeof window.dispatchEvent === "function" &&
    typeof window.CustomEvent === "function"
  ) {
    window.dispatchEvent(new window.CustomEvent(
      "today:ai-approval-bridge-ready",
      { detail: Object.freeze({ rulesetId: RULESET_ID }) }
    ));
  }
}

export default publicApi;
