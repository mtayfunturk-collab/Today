/**
 * Today App ↔ Today AI Engine Pattern Feedback Bridge
 * NUT-017.7
 *
 * Kullanıcının örüntü geri bildirimini saf Engine işlemcisine iletir. DOM,
 * App depolaması, ağ, model sağlayıcısı, Connect veya kalıcı audit kullanmaz.
 */
import {
  ENGINE_VERSION,
  PATTERN_FEEDBACK_SCHEMA_VERSION,
  RULESET_ID as ENGINE_RULESET_ID,
  processPatternFeedback
} from "../Today-AI-Engine/src/pattern-feedback-processor.mjs";

export const API_VERSION = 1;
export const CONTRACT_VERSION = 1;
export const RULESET_ID = "today:ai-pattern-feedback-bridge:nut-017.7";

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
    persistent: false,
    externalRecipient: null,
    feedbackReceiptEnabled: true,
    observationMutationEnabled: false,
    modelLearningEnabled: false,
    memoryEnabled: false,
    connectEnabled: false,
    executionEnabled: false,
    auditPersistenceEnabled: false
  });
}

export function recordPatternFeedback(options = {}) {
  const result = processPatternFeedback({
    schemaVersion: PATTERN_FEEDBACK_SCHEMA_VERSION,
    feedbackId: options.feedbackId,
    observation: options.observation,
    response: options.response,
    respondedAt: options.respondedAt
  });

  if (!result.ok) {
    return deepFreeze({
      success: false,
      errorCode: "TODAY-AI-PATTERN-FEEDBACK",
      feedbackError: result.error.code
    });
  }

  return deepFreeze({
    success: true,
    receipt: result.receipt,
    observationChanged: false,
    modelUpdated: false,
    memoryWritten: false,
    actionStarted: false,
    connectCalled: false,
    auditPersisted: false,
    externalTransfer: false
  });
}

const publicApi = Object.freeze({
  API_VERSION,
  CONTRACT_VERSION,
  RULESET_ID,
  ENGINE_VERSION,
  getStatus,
  recordPatternFeedback
});

if (typeof window !== "undefined") {
  window.TodayAIPatternFeedbackBridge = publicApi;
  if (
    typeof window.dispatchEvent === "function" &&
    typeof window.CustomEvent === "function"
  ) {
    window.dispatchEvent(new window.CustomEvent(
      "today:ai-pattern-feedback-bridge-ready",
      { detail: Object.freeze({ rulesetId: RULESET_ID }) }
    ));
  }
}

export default publicApi;
