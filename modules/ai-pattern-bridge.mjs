/**
 * Today App ↔ Today AI Engine Pattern Observation Bridge
 * NUT-017.6
 *
 * Onaylı, istek-süreli Context Package'i saf örüntü gözlemcisine iletir.
 * DOM, App depolaması, ağ, model sağlayıcısı, Connect veya kalıcı audit
 * kullanmaz.
 */
import {
  CAPABILITY,
  ENGINE_VERSION,
  PATTERN_REQUEST_SCHEMA_VERSION,
  RULESET_ID as ENGINE_RULESET_ID,
  observeTodayPattern
} from "../Today-AI-Engine/src/pattern-observer.mjs";

export const API_VERSION = 1;
export const CONTRACT_VERSION = 1;
export const RULESET_ID = "today:ai-pattern-bridge:nut-017.6";

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach(entry => deepFreeze(entry, seen));
  return Object.freeze(value);
}

function failure(errorCode, result) {
  return deepFreeze({
    success: false,
    errorCode,
    patternError: result.error.code,
    ...(result.error.patternEvaluation
      ? { patternEvaluation: result.error.patternEvaluation }
      : {})
  });
}

export function getStatus() {
  return deepFreeze({
    apiVersion: API_VERSION,
    contractVersion: CONTRACT_VERSION,
    rulesetId: RULESET_ID,
    engineRulesetId: ENGINE_RULESET_ID,
    engineVersion: ENGINE_VERSION,
    capability: CAPABILITY,
    ready: true,
    processingMode: "device-only",
    retention: "request-scoped",
    externalRecipient: null,
    providerRegistered: false,
    skyUsed: false,
    causalityClaim: false,
    approvalRequired: false,
    actionProposed: false,
    connectEnabled: false,
    auditPersistenceEnabled: false
  });
}

export function buildPatternPreview(options = {}) {
  const result = observeTodayPattern({
    schemaVersion: PATTERN_REQUEST_SCHEMA_VERSION,
    observationId: options.observationId,
    capability: CAPABILITY,
    requestedAt: options.requestedAt,
    context: options.context
  });

  if (!result.ok) {
    const errorCode = result.error.code === "insufficient-paired-days"
      ? "TODAY-AI-PATTERN-INSUFFICIENT-DATA"
      : result.error.code === "recurrence-not-observed"
        ? "TODAY-AI-PATTERN-NO-RECURRENCE"
        : "TODAY-AI-PATTERN-REQUEST";
    return failure(errorCode, result);
  }

  return deepFreeze({
    success: true,
    observation: result.observation,
    provider: null,
    externalTransfer: false,
    actionStarted: false,
    approvalRequired: false,
    auditPersisted: false
  });
}

const publicApi = Object.freeze({
  API_VERSION,
  CONTRACT_VERSION,
  RULESET_ID,
  ENGINE_VERSION,
  CAPABILITY,
  getStatus,
  buildPatternPreview
});

if (typeof window !== "undefined") {
  window.TodayAIPatternBridge = publicApi;
  if (
    typeof window.dispatchEvent === "function" &&
    typeof window.CustomEvent === "function"
  ) {
    window.dispatchEvent(new window.CustomEvent(
      "today:ai-pattern-bridge-ready",
      { detail: Object.freeze({ rulesetId: RULESET_ID }) }
    ));
  }
}

export default publicApi;
