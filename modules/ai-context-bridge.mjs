/**
 * Today App ↔ Today AI Engine Context Bridge
 * NUT-017.2
 *
 * App kaynak adaptörünün olaylarını NUT-017.1 Context Builder'a verir.
 * DOM, App depolaması, ağ, kalıcı onay veya AI önerisi üretmez.
 */
import {
  buildTodayContext
} from "../Today-AI-Engine/src/context-builder.mjs";
import {
  evaluateDataUsageConsent,
  toAppAdapterConsent
} from "../Today-AI-Engine/src/data-usage-consent.mjs";

export const API_VERSION = 1;
export const CONTRACT_VERSION = 1;
export const RULESET_ID =
  "today:ai-context-bridge:nut-017.2";
export const ENGINE_VERSION = "0.3.1-analysis";

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

function sourceApiFrom(dependencies) {
  return dependencies.sourceApi ||
    globalThis.TodayAIContextSources ||
    globalThis.window?.TodayAIContextSources ||
    null;
}

export function getStatus(dependencies = {}) {
  const sourceApi = sourceApiFrom(dependencies);
  return deepFreeze({
    apiVersion: API_VERSION,
    contractVersion: CONTRACT_VERSION,
    rulesetId: RULESET_ID,
    engineVersion: ENGINE_VERSION,
    ready: Boolean(sourceApi && typeof sourceApi.collectEvents === "function"),
    processingMode: "device-only",
    retention: "request-scoped",
    externalRecipient: null
  });
}

export async function buildContextPreview(options = {}, dependencies = {}) {
  const consentResult = evaluateDataUsageConsent(options.consent, {
    purpose: options.purpose,
    at: options.requestedAt
  });

  if (!consentResult.ok) {
    return failure("TODAY-AI-CONTEXT-CONSENT", {
      consentError: consentResult.error.code
    });
  }

  const sourceApi = sourceApiFrom(dependencies);
  if (!sourceApi || typeof sourceApi.collectEvents !== "function") {
    return failure("TODAY-AI-CONTEXT-SOURCES");
  }

  let collected;
  try {
    collected = await sourceApi.collectEvents({
      consent: consentResult.consent,
      window: options.window,
      requestedAt: options.requestedAt
    });
  } catch (error) {
    return failure("TODAY-AI-CONTEXT-COLLECT", {
      errorName: error?.name || "Error"
    });
  }

  if (!collected || !Array.isArray(collected.events)) {
    return failure("TODAY-AI-CONTEXT-EVENTS");
  }

  const built = buildTodayContext({
    schemaVersion: 1,
    requestId: options.requestId,
    purpose: options.purpose,
    requestedAt: options.requestedAt,
    window: options.window,
    consent: consentResult.consent,
    events: collected.events
  });

  if (!built.ok) {
    return failure("TODAY-AI-CONTEXT-BUILD", {
      builderError: built.error.code,
      consentError: built.error.consentError || null
    });
  }

  return deepFreeze({
    success: true,
    context: built.context,
    appConsent: toAppAdapterConsent(consentResult.consent, {
      purpose: options.purpose,
      at: options.requestedAt
    }),
    sourceEventCount: collected.events.length,
    sourceWarnings: Array.isArray(collected.warnings)
      ? collected.warnings
      : []
  });
}

const publicApi = Object.freeze({
  API_VERSION,
  CONTRACT_VERSION,
  RULESET_ID,
  ENGINE_VERSION,
  getStatus,
  buildContextPreview
});

if (typeof window !== "undefined") {
  window.TodayAIContextBridge = publicApi;
  if (
    typeof window.dispatchEvent === "function" &&
    typeof window.CustomEvent === "function"
  ) {
    window.dispatchEvent(new window.CustomEvent(
      "today:ai-context-bridge-ready",
      { detail: Object.freeze({ rulesetId: RULESET_ID }) }
    ));
  }
}

export default publicApi;
