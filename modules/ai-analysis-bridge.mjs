/**
 * Today App ↔ Today AI Engine Explainable Analysis Bridge
 * NUT-017.3.1
 *
 * Request-scoped Context Package'i saf Engine analizine verir. DOM, App
 * depolaması, ağ, model sağlayıcısı, Connect veya kalıcı onay kullanmaz.
 */
import {
  ANALYSIS_REQUEST_SCHEMA_VERSION,
  CAPABILITY,
  ENGINE_VERSION,
  RULESET_ID as ENGINE_RULESET_ID,
  analyzeTodayContext
} from "../Today-AI-Engine/src/daily-support-analyzer.mjs";

export const API_VERSION = 1;
export const CONTRACT_VERSION = 1;
export const RULESET_ID = "today:ai-analysis-bridge:nut-017.3.1";

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach(entry => deepFreeze(entry, seen));
  return Object.freeze(value);
}

function failure(errorCode, details = {}) {
  return deepFreeze({
    success: false,
    errorCode,
    ...details
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
    connectEnabled: false,
    skyUsedAsEvidence: false
  });
}

export function buildAnalysisPreview(options = {}) {
  const result = analyzeTodayContext({
    schemaVersion: ANALYSIS_REQUEST_SCHEMA_VERSION,
    analysisId: options.analysisId,
    capability: CAPABILITY,
    requestedAt: options.requestedAt,
    context: options.context
  });

  if (!result.ok) {
    const errorCode = result.error.code === "no-matching-rule"
      ? "TODAY-AI-ANALYSIS-NO-MATCH"
      : "TODAY-AI-ANALYSIS-REQUEST";
    return failure(errorCode, {
      analysisError: result.error.code,
      ...(result.error.ruleEvaluation
        ? { ruleEvaluation: result.error.ruleEvaluation }
        : {})
    });
  }

  return deepFreeze({
    success: true,
    analysis: result.analysis,
    provider: null,
    externalTransfer: false,
    actionStarted: false
  });
}

const publicApi = Object.freeze({
  API_VERSION,
  CONTRACT_VERSION,
  RULESET_ID,
  ENGINE_VERSION,
  CAPABILITY,
  getStatus,
  buildAnalysisPreview
});

if (typeof window !== "undefined") {
  window.TodayAIAnalysisBridge = publicApi;
  if (
    typeof window.dispatchEvent === "function" &&
    typeof window.CustomEvent === "function"
  ) {
    window.dispatchEvent(new window.CustomEvent(
      "today:ai-analysis-bridge-ready",
      { detail: Object.freeze({ rulesetId: RULESET_ID }) }
    ));
  }
}

export default publicApi;
