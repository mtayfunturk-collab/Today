/**
 * Today AI Engine — Explainable Daily Support Analyzer
 * NUT-017.3
 *
 * Saf ve deterministik bir analiz fonksiyonudur. DOM, Today App depolaması,
 * ağ, model sağlayıcısı, Connect veya sistem saatine erişmez.
 */

export const ENGINE_VERSION = "0.3.0-analysis";
export const ANALYSIS_REQUEST_SCHEMA_VERSION = 1;
export const ANALYSIS_OUTPUT_SCHEMA_VERSION = 1;
export const CAPABILITY = "daily-support-suggestion";
export const RULESET_ID = "today:daily-support:nut-017.3";

const IDENTIFIER_PATTERN =
  /^[a-z0-9](?:[a-z0-9._:-]{0,158}[a-z0-9])?$/;
const SHORT_SLEEP_MINUTES = 360;

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function isContextItem(value, source) {
  return isPlainObject(value) &&
    value.source === source &&
    typeof value.eventId === "string" &&
    value.eventId.length > 0 &&
    typeof value.eventType === "string" &&
    value.eventType.length > 0 &&
    isDateKey(value.localDate) &&
    isDateTime(value.createdAt) &&
    isPlainObject(value.facts);
}

function symbolicBoundaryIsValid(item) {
  if (item.eventType !== "core-sky-symbolic-snapshot") return true;
  return item.facts.metadata?.interpretation === "none" &&
    item.facts.metadata?.causalityClaim === false &&
    item.facts.metadata?.aiProcessed === false;
}

function validateContext(context, requestedAt) {
  if (
    !isPlainObject(context) ||
    context.schemaVersion !== 1 ||
    typeof context.contextId !== "string" ||
    !context.contextId ||
    typeof context.requestId !== "string" ||
    !context.requestId ||
    typeof context.purpose !== "string" ||
    !context.purpose.trim() ||
    !isDateTime(context.builtAt) ||
    Date.parse(context.builtAt) > Date.parse(requestedAt) ||
    context.processing?.mode !== "device-only" ||
    context.processing?.externalRecipient !== null ||
    context.processing?.retention !== "request-scoped" ||
    typeof context.consentReceipt?.consentId !== "string" ||
    !context.consentReceipt.consentId ||
    context.consentReceipt?.granted !== true ||
    context.consentReceipt?.purpose !== context.purpose ||
    !isDateTime(context.consentReceipt?.grantedAt) ||
    Date.parse(context.consentReceipt.grantedAt) > Date.parse(context.builtAt) ||
    context.boundaries?.skyRole !== "symbolic-context-only" ||
    context.boundaries?.skyCausalityAllowed !== false ||
    context.boundaries?.skyScientificEvidence !== false ||
    context.boundaries?.rawBirthDataIncluded !== false ||
    context.boundaries?.domAccessed !== false ||
    context.boundaries?.storageAccessed !== false ||
    context.boundaries?.externalTransfer !== false ||
    typeof context.boundaries?.freeTextIncluded !== "boolean" ||
    !Array.isArray(context.sections?.core) ||
    !Array.isArray(context.sections?.health) ||
    !Array.isArray(context.sections?.symbolicContext?.items) ||
    context.sections.symbolicContext.role !== "symbolic-context-only" ||
    context.sections.symbolicContext.causalityClaim !== false ||
    context.sections.symbolicContext.scientificEvidence !== false ||
    !Array.isArray(context.provenance)
  ) {
    return false;
  }

  if (!context.sections.core.every(item => isContextItem(item, "today-core"))) {
    return false;
  }
  if (!context.sections.health.every(item => isContextItem(item, "today-health"))) {
    return false;
  }
  if (!context.sections.symbolicContext.items.every(
    item => isContextItem(item, "today-sky") && symbolicBoundaryIsValid(item)
  )) {
    return false;
  }

  const provenance = new Set(context.provenance.map(entry =>
    `${entry?.source || ""}:${entry?.eventId || ""}`
  ));
  return [...context.sections.core, ...context.sections.health]
    .every(item => provenance.has(`${item.source}:${item.eventId}`));
}

function validateRequest(request) {
  return isPlainObject(request) &&
    request.schemaVersion === ANALYSIS_REQUEST_SCHEMA_VERSION &&
    typeof request.analysisId === "string" &&
    IDENTIFIER_PATTERN.test(request.analysisId) &&
    request.capability === CAPABILITY &&
    isDateTime(request.requestedAt) &&
    validateContext(request.context, request.requestedAt);
}

function compareLatest(left, right) {
  for (const key of ["localDate", "createdAt", "eventId"]) {
    const compared = String(right[key]).localeCompare(String(left[key]), "en");
    if (compared !== 0) return compared;
  }
  return 0;
}

function latest(items, predicate) {
  return items.filter(predicate).sort(compareLatest)[0] || null;
}

function durationReference(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0
    ? `Uyku kaydı: ${hours} saat`
    : `Uyku kaydı: ${hours} saat ${remainder} dakika`;
}

function matchingEvidence(context) {
  const core = latest(
    context.sections.core,
    item => item.eventType === "daily-checkin"
  );
  const sleep = latest(
    context.sections.health,
    item => item.eventType === "sleep-record"
  );

  return core &&
    core.facts.choice === "C" &&
    sleep &&
    sleep.localDate === core.localDate &&
    Number.isFinite(sleep.facts.durationMinutes) &&
    sleep.facts.durationMinutes > 0 &&
    sleep.facts.durationMinutes < SHORT_SLEEP_MINUTES
      ? { core, sleep }
      : null;
}

/**
 * analysis-request v1 nesnesinden analysis-output v1 üretir.
 * Çıktı yalnız ilk, dar kuralla eşleşirse oluşur: Core C + 6 saatin altı uyku.
 */
export function analyzeTodayContext(request) {
  if (!validateRequest(request)) {
    return failure("invalid-analysis-request");
  }

  const matched = matchingEvidence(request.context);
  if (!matched) {
    return failure("no-matching-rule");
  }

  const analysis = {
    schemaVersion: ANALYSIS_OUTPUT_SCHEMA_VERSION,
    analysisId: request.analysisId,
    type: CAPABILITY,
    summary: "Seçtiğin kayıtlara göre bugün toparlanma ihtiyacın artmış olabilir.",
    suggestion: "Akşam planını daha hafif tutmayı ve uyku hazırlığını biraz öne almayı değerlendirebilirsin.",
    evidence: [
      {
        source: "today-core",
        eventId: matched.core.eventId,
        reference: "Core günlük seçimi: Zordu bugün"
      },
      {
        source: "today-health",
        eventId: matched.sleep.eventId,
        reference: durationReference(matched.sleep.facts.durationMinutes)
      }
    ],
    confidence: 0.72,
    uncertainty: [
      "Bugünkü iş yükün ve zorunlu planların bilinmiyor.",
      "Bu çıktı iki kayda ve sabit bir kurala dayanır; teşhis veya kesinlik değildir."
    ],
    alternatives: [
      "Öneriyi kullanmadan devam et",
      "Akşam planını kendine göre hafiflet",
      "Veri kapsamını değiştirip yeniden değerlendir"
    ],
    requiresUserApproval: true,
    proposedActions: [
      {
        actionId: `action:${request.analysisId}:sleep-preparation`,
        type: "create-reminder",
        label: "Uyku hazırlığını hatırla",
        status: "pending-user-approval"
      }
    ]
  };

  return deepFreeze({ ok: true, analysis });
}

export default Object.freeze({
  ENGINE_VERSION,
  ANALYSIS_REQUEST_SCHEMA_VERSION,
  ANALYSIS_OUTPUT_SCHEMA_VERSION,
  CAPABILITY,
  RULESET_ID,
  analyzeTodayContext
});
