/**
 * Today AI Engine — Explainable Multi-day Pattern Observer
 * NUT-017.6
 *
 * Son 7 günlük sürümlü Context Package içinde Core ve uyku kayıtlarının
 * birlikte tekrarını betimler. Nedensellik, teşhis veya eylem üretmez.
 * DOM, Today App depolaması, ağ, model sağlayıcısı, Connect ve sistem saatine
 * erişmez.
 */

export const ENGINE_VERSION = "0.6.0-pattern";
export const PATTERN_REQUEST_SCHEMA_VERSION = 1;
export const PATTERN_OUTPUT_SCHEMA_VERSION = 1;
export const CAPABILITY = "core-sleep-recurrence";
export const RULESET_ID = "today:pattern-observer:nut-017.6";

const IDENTIFIER_PATTERN =
  /^[a-z0-9](?:[a-z0-9._:-]{0,158}[a-z0-9])?$/;
const SHORT_SLEEP_MINUTES = 360;
const OBSERVATION_WINDOW_DAYS = 7;
const MINIMUM_ELIGIBLE_DAYS = 3;
const MINIMUM_MATCHING_DAYS = 2;
const VALID_CORE_CHOICES = new Set(["A", "B", "C"]);

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

function failure(code, details = {}) {
  return deepFreeze({ ok: false, error: { code, ...details } });
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

function isContextItem(value, source, startDate, endDate) {
  return isPlainObject(value) &&
    value.source === source &&
    typeof value.eventId === "string" &&
    value.eventId.length > 0 &&
    typeof value.eventType === "string" &&
    value.eventType.length > 0 &&
    isDateKey(value.localDate) &&
    value.localDate >= startDate &&
    value.localDate <= endDate &&
    isDateTime(value.createdAt) &&
    Array.isArray(value.dataClasses) &&
    isPlainObject(value.facts);
}

function symbolicBoundaryIsValid(item) {
  if (item.eventType !== "core-sky-symbolic-snapshot") return true;
  return item.facts.metadata?.interpretation === "none" &&
    item.facts.metadata?.causalityClaim === false &&
    item.facts.metadata?.aiProcessed === false;
}

function validateContext(context, requestedAt) {
  const startDate = context?.window?.startDate;
  const endDate = context?.window?.endDate;
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
    !isPlainObject(context.window) ||
    inclusiveDays(startDate, endDate) !== OBSERVATION_WINDOW_DAYS ||
    !Number.isInteger(context.window.maxEventsPerSource) ||
    context.window.maxEventsPerSource < 1 ||
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

  if (!context.sections.core.every(
    item => isContextItem(item, "today-core", startDate, endDate)
  )) return false;
  if (!context.sections.health.every(
    item => isContextItem(item, "today-health", startDate, endDate)
  )) return false;
  if (!context.sections.symbolicContext.items.every(item =>
    isContextItem(item, "today-sky", startDate, endDate) &&
    symbolicBoundaryIsValid(item)
  )) return false;

  const provenance = new Set(context.provenance.map(entry =>
    `${entry?.source || ""}:${entry?.eventId || ""}`
  ));
  return [
    ...context.sections.core,
    ...context.sections.health,
    ...context.sections.symbolicContext.items
  ].every(item => provenance.has(`${item.source}:${item.eventId}`));
}

function validateRequest(request) {
  return isPlainObject(request) &&
    hasOnlyKeys(request, new Set([
      "schemaVersion",
      "observationId",
      "capability",
      "requestedAt",
      "context"
    ])) &&
    request.schemaVersion === PATTERN_REQUEST_SCHEMA_VERSION &&
    typeof request.observationId === "string" &&
    IDENTIFIER_PATTERN.test(request.observationId) &&
    request.capability === CAPABILITY &&
    isDateTime(request.requestedAt) &&
    validateContext(request.context, request.requestedAt);
}

function isNewer(candidate, current) {
  const createdAt = candidate.createdAt.localeCompare(current.createdAt, "en");
  if (createdAt !== 0) return createdAt > 0;
  return candidate.eventId.localeCompare(current.eventId, "en") > 0;
}

function latestByDate(items, eventType) {
  const selected = new Map();
  items.filter(item => item.eventType === eventType).forEach(item => {
    const current = selected.get(item.localDate);
    if (!current || isNewer(item, current)) {
      selected.set(item.localDate, item);
    }
  });
  return selected;
}

function evaluatePattern(context) {
  const coreByDate = latestByDate(context.sections.core, "daily-checkin");
  const sleepByDate = latestByDate(context.sections.health, "sleep-record");
  const dates = [...new Set([
    ...coreByDate.keys(),
    ...sleepByDate.keys()
  ])].sort((left, right) => left.localeCompare(right, "en"));

  const eligible = dates.map(localDate => ({
    localDate,
    core: coreByDate.get(localDate) || null,
    sleep: sleepByDate.get(localDate) || null
  })).filter(day =>
    day.core &&
    day.sleep &&
    VALID_CORE_CHOICES.has(day.core.facts.choice) &&
    Number.isFinite(day.sleep.facts.durationMinutes) &&
    day.sleep.facts.durationMinutes > 0 &&
    day.sleep.facts.durationMinutes <= 1440
  );

  const matching = eligible.filter(day =>
    day.core.facts.choice === "C" &&
    day.sleep.facts.durationMinutes < SHORT_SLEEP_MINUTES
  );
  const reasons = [];
  if (eligible.length < MINIMUM_ELIGIBLE_DAYS) {
    reasons.push("insufficient-paired-days");
  } else if (matching.length < MINIMUM_MATCHING_DAYS) {
    reasons.push("recurrence-not-observed");
  }

  return {
    eligible,
    matching,
    diagnostic: deepFreeze({
      rulesetId: RULESET_ID,
      observed: reasons.length === 0,
      window: {
        startDate: context.window.startDate,
        endDate: context.window.endDate,
        totalDays: OBSERVATION_WINDOW_DAYS
      },
      required: {
        minimumEligibleDays: MINIMUM_ELIGIBLE_DAYS,
        minimumMatchingDays: MINIMUM_MATCHING_DAYS,
        coreChoice: "C",
        sleepDuration: {
          operator: "less-than",
          minutes: SHORT_SLEEP_MINUTES
        },
        sameLocalDate: true
      },
      counts: {
        eligibleDays: eligible.length,
        matchingDays: matching.length
      },
      reasons,
      skyExcluded: true
    })
  };
}

function durationReference(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0
    ? `Uyku: ${hours} saat`
    : `Uyku: ${hours} saat ${remainder} dakika`;
}

function confidenceFor(eligibleDays, matchingDays) {
  const coverage = eligibleDays / OBSERVATION_WINDOW_DAYS;
  const recurrence = matchingDays / eligibleDays;
  const score = Math.min(
    0.85,
    Math.round(((coverage * 0.4) + (recurrence * 0.6)) * 100) / 100
  );
  return {
    score,
    level: score >= 0.75
      ? "strong"
      : score >= 0.6
        ? "moderate"
        : "limited",
    basis: "window-coverage-and-recurrence",
    probabilityClaim: false
  };
}

/**
 * Son 7 gündeki Core C + 6 saat altı uyku tekrarını yalnız betimler.
 */
export function observeTodayPattern(request) {
  if (!validateRequest(request)) {
    return failure("invalid-pattern-observation-request");
  }

  const evaluated = evaluatePattern(request.context);
  if (!evaluated.diagnostic.observed) {
    return failure(evaluated.diagnostic.reasons[0], {
      patternEvaluation: evaluated.diagnostic
    });
  }

  const eligibleDays = evaluated.eligible.length;
  const matchingDays = evaluated.matching.length;
  const observation = {
    schemaVersion: PATTERN_OUTPUT_SCHEMA_VERSION,
    observationId: request.observationId,
    type: CAPABILITY,
    summary: `Son 7 günde, karşılaştırılabilir ${eligibleDays} günün ` +
      `${matchingDays} gününde “Zordu bugün” seçimi ile 6 saatin ` +
      "altındaki uyku birlikte görüldü.",
    window: {
      startDate: request.context.window.startDate,
      endDate: request.context.window.endDate,
      totalDays: OBSERVATION_WINDOW_DAYS,
      eligibleDays,
      matchingDays
    },
    evidence: evaluated.matching.map(day => ({
      localDate: day.localDate,
      core: {
        source: "today-core",
        eventId: day.core.eventId,
        reference: "Günlük seçim: Zordu bugün"
      },
      health: {
        source: "today-health",
        eventId: day.sleep.eventId,
        reference: durationReference(day.sleep.facts.durationMinutes)
      }
    })),
    confidence: confidenceFor(eligibleDays, matchingDays),
    uncertainty: [
      "Bu iki kaydın birlikte görülmesi, birinin diğerine neden olduğunu göstermez.",
      "Yalnız seçtiğin bilgiler ve son 7 gün değerlendirildi.",
      "İş yükü, stres, hastalık ve diğer koşullar bilinmiyor."
    ],
    alternatives: [
      "Yalnızca fark et ve kayıt tutmaya devam et",
      "Uyku ve günlük kayıtlarını ayrı ayrı incele",
      "Bilgi kapsamını değiştirip yeniden değerlendir"
    ],
    approval: {
      required: false,
      status: "not-required"
    },
    boundaries: {
      interpretation: "descriptive-observation",
      causalityClaim: false,
      diagnosis: false,
      skyUsed: false,
      processingMode: "device-only",
      retention: "request-scoped",
      externalRecipient: null,
      actionProposed: false
    }
  };

  return deepFreeze({ ok: true, observation });
}

export default Object.freeze({
  ENGINE_VERSION,
  PATTERN_REQUEST_SCHEMA_VERSION,
  PATTERN_OUTPUT_SCHEMA_VERSION,
  CAPABILITY,
  RULESET_ID,
  observeTodayPattern
});
