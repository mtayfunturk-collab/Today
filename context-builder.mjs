import {
  canIncludeFreeText,
  evaluateDataUsageConsent,
  isDataClassAllowed
} from "./data-usage-consent.mjs";

export const CONTEXT_PACKAGE_SCHEMA_VERSION = 1;

export const SUPPORTED_EVENT_TYPES = Object.freeze({
  "today-core": Object.freeze([
    "daily-checkin"
  ]),
  "today-health": Object.freeze([
    "sleep-record",
    "energy-record",
    "symptom-record",
    "workout-record",
    "nutrition-record"
  ]),
  "today-sky": Object.freeze([
    "sky-moment",
    "sky-periods",
    "core-sky-symbolic-snapshot"
  ])
});

const RAW_SKY_EVENT_TYPES = new Set([
  "birth-profile",
  "sky-birth-profile",
  "observation-context",
  "sky-observation-context"
]);

const NUTRITION_CLASS_BY_TYPE = Object.freeze({
  hydration_entry: "hydration",
  meal_entry: "nutrition",
  nutrition_summary: "nutrition",
  weight_reference: "weight",
  activity_reference: "activity"
});

const INACTIVE_HEALTH_STATUSES = new Set([
  "archived",
  "deleted",
  "superseded"
]);

const IDENTIFIER_PATTERN =
  /^[a-z0-9](?:[a-z0-9._:-]{0,158}[a-z0-9])?$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return value;
  }

  seen.add(value);
  Object.values(value).forEach(entry => deepFreeze(entry, seen));
  return Object.freeze(value);
}

function failure(code, details = {}) {
  return deepFreeze({
    ok: false,
    error: { code, ...details }
  });
}

function isDateTime(value) {
  return (
    typeof value === "string" &&
    value.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isDateKey(value) {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function safeString(value, maxLength = 120) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized && normalized.length <= maxLength
    ? normalized
    : null;
}

function safeNumber(value, minimum = -Infinity, maximum = Infinity) {
  const numeric = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum
    ? numeric
    : null;
}

function safeScalar(value, maxStringLength = 80) {
  if (typeof value === "boolean") {
    return value;
  }

  const numeric = safeNumber(value);
  if (numeric !== null) {
    return numeric;
  }

  return safeString(value, maxStringLength);
}

function stableSerialize(value, seen = new Set()) {
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (seen.has(value)) {
    return '"[circular]"';
  }

  seen.add(value);
  const serialized = Array.isArray(value)
    ? `[${value.map(entry => stableSerialize(entry, seen)).join(",")}]`
    : `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${stableSerialize(value[key], seen)}`
    ).join(",")}}`;
  seen.delete(value);
  return serialized;
}

function compareEvents(left, right) {
  const keys = ["localDate", "createdAt", "eventId", "source", "eventType"];

  for (const key of keys) {
    const compared = String(left?.[key] ?? "")
      .localeCompare(String(right?.[key] ?? ""), "en");
    if (compared !== 0) {
      return compared;
    }
  }

  return stableSerialize(left?.payload)
    .localeCompare(stableSerialize(right?.payload), "en");
}

function normalizeEvent(value) {
  if (
    !isPlainObject(value) ||
    value.schemaVersion !== 1 ||
    typeof value.eventId !== "string" ||
    !value.eventId.trim() ||
    value.eventId.length > 256 ||
    !Object.hasOwn(SUPPORTED_EVENT_TYPES, value.source) ||
    typeof value.eventType !== "string" ||
    !value.eventType.trim() ||
    value.eventType.length > 120 ||
    !isDateTime(value.createdAt) ||
    !isDateKey(value.localDate) ||
    !isPlainObject(value.payload)
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    eventId: value.eventId,
    source: value.source,
    eventType: value.eventType,
    createdAt: new Date(value.createdAt).toISOString(),
    localDate: value.localDate,
    payload: value.payload
  };
}

function omissionFor(value, reason, index = 0) {
  const source = Object.hasOwn(SUPPORTED_EVENT_TYPES, value?.source)
    ? value.source
    : "unknown";

  return {
    eventId: safeString(value?.eventId, 256) || `invalid-event-${index + 1}`,
    source,
    eventType: safeString(value?.eventType, 120) || "unknown",
    reason
  };
}

function redact(event, field, reason = "not-needed-for-purpose") {
  return {
    eventId: event.eventId,
    source: event.source,
    field,
    reason
  };
}

function copyFreeText(event, consent, payload, facts, redactions, fields) {
  let included = false;

  for (const field of fields) {
    if (!Object.hasOwn(payload, field)) {
      continue;
    }

    const value = safeString(payload[field], 1000);
    if (canIncludeFreeText(consent, "health") && value) {
      facts[field] = value;
      included = true;
    } else {
      redactions.push(redact(
        event,
        `payload.${field}`,
        "free-text-not-consented"
      ));
    }
  }

  return included;
}

function mapCore(event, consent) {
  const { payload } = event;
  const facts = {};
  const dataClasses = [];
  const redactions = [];
  let freeTextIncluded = false;

  const choice = safeScalar(payload.choice);
  if (choice !== null && isDataClassAllowed(consent, "core", "daily-choice")) {
    facts.choice = choice;
    dataClasses.push("daily-choice");
  } else if (Object.hasOwn(payload, "choice")) {
    redactions.push(redact(event, "payload.choice", "data-class-not-consented"));
  }

  const color = safeString(payload.color, 80);
  if (color && isDataClassAllowed(consent, "core", "color")) {
    facts.color = color;
    dataClasses.push("color");
  } else if (Object.hasOwn(payload, "color")) {
    redactions.push(redact(event, "payload.color", "data-class-not-consented"));
  }

  if (Object.hasOwn(payload, "note")) {
    const note = safeString(payload.note, 1000);
    if (
      note &&
      isDataClassAllowed(consent, "core", "note") &&
      canIncludeFreeText(consent, "core")
    ) {
      facts.note = note;
      dataClasses.push("note");
      freeTextIncluded = true;
    } else {
      redactions.push(redact(event, "payload.note", "free-text-not-consented"));
    }
  }

  for (const field of ["changeLog", "coreSkyLink"]) {
    if (Object.hasOwn(payload, field)) {
      redactions.push(redact(event, `payload.${field}`));
    }
  }

  return dataClasses.length > 0
    ? { facts, dataClasses, redactions, freeTextIncluded }
    : { omissionReason: "no-eligible-fields", redactions };
}

function mapSleep(event, consent) {
  if (!isDataClassAllowed(consent, "health", "sleep")) {
    return { omissionReason: "data-class-not-consented", redactions: [] };
  }

  const { payload } = event;
  const facts = {};
  const redactions = [];
  const durationMinutes = safeNumber(payload.durationMinutes, 0, 1440);
  if (durationMinutes !== null) facts.durationMinutes = durationMinutes;

  for (const field of ["quality", "recovery"]) {
    const value = safeScalar(payload[field]);
    if (value !== null) facts[field] = value;
  }

  const freeTextIncluded = copyFreeText(
    event,
    consent,
    payload,
    facts,
    redactions,
    ["note"]
  );

  for (const field of ["bedtime", "wakeTime", "date", "dayKey"]) {
    if (Object.hasOwn(payload, field)) {
      redactions.push(redact(event, `payload.${field}`));
    }
  }

  return Object.keys(facts).length > 0
    ? { facts, dataClasses: ["sleep"], redactions, freeTextIncluded }
    : { omissionReason: "no-eligible-fields", redactions };
}

function mapEnergy(event, consent) {
  if (!isDataClassAllowed(consent, "health", "energy")) {
    return { omissionReason: "data-class-not-consented", redactions: [] };
  }

  const { payload } = event;
  const facts = {};
  const redactions = [];
  for (const field of ["energy", "fatigue", "body"]) {
    const value = safeScalar(payload[field]);
    if (value !== null) facts[field] = value;
  }

  const freeTextIncluded = copyFreeText(
    event,
    consent,
    payload,
    facts,
    redactions,
    ["note"]
  );

  return Object.keys(facts).length > 0
    ? { facts, dataClasses: ["energy"], redactions, freeTextIncluded }
    : { omissionReason: "no-eligible-fields", redactions };
}

function safeStringArray(value, maxItems = 20) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, maxItems)
    .map(entry => safeString(entry, 80))
    .filter(Boolean);
}

function mapSymptoms(event, consent) {
  if (!isDataClassAllowed(consent, "health", "symptoms")) {
    return { omissionReason: "data-class-not-consented", redactions: [] };
  }

  const { payload } = event;
  const facts = {};
  const redactions = [];
  const symptoms = safeStringArray(payload.symptoms);
  const bodyArea = safeStringArray(payload.bodyArea);
  const severity = safeScalar(payload.severity);
  if (symptoms.length) facts.symptoms = symptoms;
  if (bodyArea.length) facts.bodyArea = bodyArea;
  if (severity !== null) facts.severity = severity;

  const freeTextIncluded = copyFreeText(
    event,
    consent,
    payload,
    facts,
    redactions,
    ["customSymptom", "note"]
  );

  return Object.keys(facts).length > 0
    ? { facts, dataClasses: ["symptoms"], redactions, freeTextIncluded }
    : { omissionReason: "no-eligible-fields", redactions };
}

function mapWorkout(event, consent) {
  if (!isDataClassAllowed(consent, "health", "activity")) {
    return { omissionReason: "data-class-not-consented", redactions: [] };
  }

  const { payload } = event;
  const facts = {};
  const redactions = [];
  const durationMinutes = safeNumber(payload.durationMinutes, 0, 1440);
  if (durationMinutes !== null) facts.durationMinutes = durationMinutes;

  if (Array.isArray(payload.exercises)) {
    const exercises = payload.exercises.filter(isPlainObject);
    facts.exerciseCount = exercises.length;
    facts.completedExerciseCount = exercises.filter(
      exercise => exercise.completed === true
    ).length;

    for (const field of ["exerciseId", "name", "muscle", "image", "sets", "reps", "kg"]) {
      if (exercises.some(exercise => Object.hasOwn(exercise, field))) {
        redactions.push(redact(event, `payload.exercises[*].${field}`));
      }
    }
  }

  for (const field of ["date", "dayIndex", "dayTitle"]) {
    if (Object.hasOwn(payload, field)) {
      redactions.push(redact(event, `payload.${field}`));
    }
  }

  return Object.keys(facts).length > 0
    ? { facts, dataClasses: ["activity"], redactions, freeTextIncluded: false }
    : { omissionReason: "no-eligible-fields", redactions };
}

function firstFinite(object, keys, minimum = 0, maximum = Infinity) {
  for (const key of keys) {
    const value = safeNumber(object?.[key], minimum, maximum);
    if (value !== null) {
      return { key, value };
    }
  }
  return null;
}

function mapNutrition(event, consent) {
  const record = isPlainObject(event.payload.record)
    ? event.payload.record
    : event.payload;
  const recordType = safeString(record.type, 80);

  if (
    record.schemaVersion !== 1 ||
    !safeString(record.id, 256) ||
    !recordType ||
    !isPlainObject(record.payload)
  ) {
    return { omissionReason: "invalid-nutrition-record", redactions: [] };
  }

  const sourceKind = typeof record.source === "string"
    ? record.source
    : record.source?.kind;
  if (sourceKind === "ai_draft") {
    return { omissionReason: "ai-draft-not-accepted", redactions: [] };
  }

  if (INACTIVE_HEALTH_STATUSES.has(record.recordStatus)) {
    return { omissionReason: "inactive-health-record", redactions: [] };
  }

  const dataClass = NUTRITION_CLASS_BY_TYPE[recordType];
  if (!dataClass) {
    return { omissionReason: "unsupported-nutrition-record-type", redactions: [] };
  }

  if (!isDataClassAllowed(consent, "health", dataClass)) {
    return { omissionReason: "data-class-not-consented", redactions: [] };
  }

  const payload = record.payload;
  const facts = { recordType };
  const redactions = [];

  if (recordType === "hydration_entry") {
    const amount = firstFinite(
      payload,
      ["amountMl", "volumeMl", "waterMl", "quantityMl"],
      0,
      20000
    );
    if (amount) facts[amount.key] = amount.value;
  } else if (recordType === "meal_entry") {
    const mealType = safeString(payload.mealType, 80);
    if (mealType) facts.mealType = mealType;
    const items = Array.isArray(payload.items) ? payload.items : [];
    facts.itemCount = items.length;
    if (items.length) redactions.push(redact(event, "payload.payload.items"));
  } else if (recordType === "nutrition_summary") {
    const totals = isPlainObject(payload.totals) ? payload.totals : payload;
    for (const field of [
      "energyKcal",
      "proteinGrams",
      "carbohydrateGrams",
      "fatGrams",
      "fiberGrams",
      "waterMl"
    ]) {
      const value = safeNumber(totals[field], 0, 100000);
      if (value !== null) facts[field] = value;
    }
  } else if (recordType === "weight_reference") {
    const weightKg = safeNumber(payload.weightKg, 1, 1000);
    if (weightKg !== null) facts.weightKg = weightKg;
  } else if (recordType === "activity_reference") {
    const durationMinutes = safeNumber(payload.durationMinutes, 0, 1440);
    const steps = safeNumber(payload.steps, 0, 1000000);
    if (durationMinutes !== null) facts.durationMinutes = durationMinutes;
    if (steps !== null) facts.steps = steps;
  }

  for (const field of ["note", "description", "rawText"]) {
    if (Object.hasOwn(payload, field)) {
      redactions.push(redact(event, `payload.payload.${field}`, "free-text-not-consented"));
    }
  }

  return Object.keys(facts).length > 1
    ? { facts, dataClasses: [dataClass], redactions, freeTextIncluded: false }
    : { omissionReason: "no-eligible-fields", redactions };
}

function skyBoundaryIsValid(payload, eventType) {
  if (!isPlainObject(payload)) {
    return false;
  }

  const seen = new Set();
  const stack = [payload];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (key === "interpretation" && value !== "none") return false;
      if (key === "causalityClaim" && value !== false) return false;
      if (key === "aiProcessed" && value !== false) return false;
      if (value && typeof value === "object") stack.push(value);
    }
  }

  if (eventType === "core-sky-symbolic-snapshot") {
    const planetIds = Array.isArray(payload.sky?.planets)
      ? payload.sky.planets.map(planet => planet?.id)
      : [];
    return payload.contractVersion === 1 &&
      isDateKey(payload.dateKey) &&
      isDateTime(payload.linkedAt) &&
      payload.linkMode === "user_initiated_snapshot" &&
      typeof payload.place?.label === "string" &&
      typeof payload.place?.timezoneId === "string" &&
      isDateTime(payload.sky?.instant) &&
      planetIds.length === 10 &&
      ["sun", "moon", "mercury", "venus", "mars"]
        .every(id => planetIds.includes(id)) &&
      payload.metadata?.interpretation === "none" &&
      payload.metadata?.causalityClaim === false &&
      payload.metadata?.aiProcessed === false;
  }

  if (eventType === "sky-periods") {
    return payload.metadata?.symbolicOnly === true;
  }

  return true;
}

function sanitizePlacement(value) {
  if (!isPlainObject(value)) return null;
  const id = safeString(value.id, 80);
  if (!id) return null;

  const result = { id };
  const signId = safeString(value.signId, 80);
  const longitude = safeNumber(value.longitude, 0, 360);
  const degreeInSign = safeNumber(value.degreeInSign, 0, 30);
  const house = safeNumber(value.house, 1, 12);
  if (signId) result.signId = signId;
  if (longitude !== null) result.longitude = longitude;
  if (degreeInSign !== null) result.degreeInSign = degreeInSign;
  if (house !== null) result.house = house;
  return result;
}

function sanitizeAngle(value) {
  if (!isPlainObject(value)) return null;
  const result = {};
  const longitude = safeNumber(value.longitude, 0, 360);
  const signId = safeString(value.signId, 80);
  const degreeInSign = safeNumber(value.degreeInSign, 0, 30);
  if (longitude !== null) result.longitude = longitude;
  if (signId) result.signId = signId;
  if (degreeInSign !== null) result.degreeInSign = degreeInSign;
  return Object.keys(result).length ? result : null;
}

function sanitizeAspect(value) {
  if (!isPlainObject(value)) return null;
  const type = safeString(value.type, 80);
  if (!type) return null;
  const result = { type };
  const orb = safeNumber(value.orb, 0, 30);
  const leftId = safeString(value.left?.id, 80);
  const rightId = safeString(value.right?.id, 80);
  if (orb !== null) result.orb = orb;
  if (leftId) result.leftId = leftId;
  if (rightId) result.rightId = rightId;
  return result;
}

function sanitizeSkyCalculation(value) {
  if (!isPlainObject(value)) return null;
  const result = {};
  if (isDateTime(value.instant)) {
    result.instant = new Date(value.instant).toISOString();
  }

  if (Array.isArray(value.planets)) {
    const planets = value.planets.slice(0, 20).map(sanitizePlacement).filter(Boolean);
    if (planets.length) result.planets = planets;
  }

  if (isPlainObject(value.angles)) {
    const angles = {};
    for (const key of ["ascendant", "midheaven"]) {
      const angle = sanitizeAngle(value.angles[key]);
      if (angle) angles[key] = angle;
    }
    if (Object.keys(angles).length) result.angles = angles;
  }

  if (Array.isArray(value.aspects)) {
    const aspects = value.aspects.slice(0, 100).map(sanitizeAspect).filter(Boolean);
    if (aspects.length) result.aspects = aspects;
  }

  return Object.keys(result).length ? result : null;
}

function sanitizePeriods(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map(period => {
    if (!isPlainObject(period)) return null;
    const result = {};
    for (const field of ["id", "type", "bodyId", "signId", "phase"]) {
      const entry = safeString(period[field], 100);
      if (entry) result[field] = entry;
    }
    for (const field of ["start", "end"]) {
      if (isDateTime(period[field])) {
        result[field] = new Date(period[field]).toISOString();
      }
    }
    const house = safeNumber(period.house, 1, 12);
    if (house !== null) result.house = house;
    return Object.keys(result).length ? result : null;
  }).filter(Boolean);
}

function mapSky(event, consent) {
  const dataClass = {
    "sky-moment": "moment",
    "sky-periods": "periods",
    "core-sky-symbolic-snapshot": "core-sky-snapshot"
  }[event.eventType];

  if (!isDataClassAllowed(consent, "sky", dataClass)) {
    return { omissionReason: "data-class-not-consented", redactions: [] };
  }

  if (!skyBoundaryIsValid(event.payload, event.eventType)) {
    return { omissionReason: "invalid-symbolic-boundary", redactions: [] };
  }

  const { payload } = event;
  const facts = {};
  const redactions = [];

  if (Object.hasOwn(payload, "place")) {
    redactions.push(redact(event, "payload.place", "precise-location-not-needed"));
  }
  if (Object.hasOwn(payload, "birthProfile")) {
    redactions.push(redact(event, "payload.birthProfile", "raw-birth-data-excluded"));
  }

  if (event.eventType === "core-sky-symbolic-snapshot") {
    if (payload.dateKey !== event.localDate) {
      return { omissionReason: "invalid-symbolic-boundary", redactions: [] };
    }
    const dateKey = isDateKey(payload.dateKey) ? payload.dateKey : null;
    const linkMode = safeString(payload.linkMode, 80);
    const sky = sanitizeSkyCalculation(payload.sky);
    if (dateKey) facts.dateKey = dateKey;
    if (linkMode) facts.linkMode = linkMode;
    if (sky) facts.sky = sky;
    facts.metadata = {
      interpretation: "none",
      causalityClaim: false,
      aiProcessed: false
    };
    if (payload.sky?.clock) {
      redactions.push(redact(event, "payload.sky.clock", "precise-timezone-not-needed"));
    }
  } else if (event.eventType === "sky-moment") {
    const calculation = sanitizeSkyCalculation(payload);
    if (calculation) facts.calculation = calculation;
  } else {
    const periods = sanitizePeriods(payload.periods);
    if (periods.length) facts.periods = periods;
    facts.metadata = { symbolicOnly: true };
  }

  return Object.keys(facts).length > 0
    ? { facts, dataClasses: [dataClass], redactions, freeTextIncluded: false }
    : { omissionReason: "no-eligible-fields", redactions };
}

function mapEvent(event, consent) {
  if (event.source === "today-core") return mapCore(event, consent);
  if (event.source === "today-sky") return mapSky(event, consent);

  switch (event.eventType) {
    case "sleep-record": return mapSleep(event, consent);
    case "energy-record": return mapEnergy(event, consent);
    case "symptom-record": return mapSymptoms(event, consent);
    case "workout-record": return mapWorkout(event, consent);
    case "nutrition-record": return mapNutrition(event, consent);
    default: return { omissionReason: "unsupported-event-type", redactions: [] };
  }
}

function normalizeRequest(request) {
  if (!isPlainObject(request) || request.schemaVersion !== 1) {
    return failure("invalid-context-request");
  }

  if (
    typeof request.requestId !== "string" ||
    !IDENTIFIER_PATTERN.test(request.requestId)
  ) {
    return failure("invalid-request-id");
  }

  const purpose = safeString(request.purpose, 160);
  if (!purpose) return failure("invalid-request-purpose");
  if (!isDateTime(request.requestedAt)) return failure("invalid-request-time");

  const window = request.window;
  if (
    !isPlainObject(window) ||
    !isDateKey(window.startDate) ||
    !isDateKey(window.endDate) ||
    window.startDate > window.endDate ||
    !Number.isInteger(window.maxEventsPerSource) ||
    window.maxEventsPerSource < 1 ||
    window.maxEventsPerSource > 366
  ) {
    return failure("invalid-context-window");
  }

  if (!Array.isArray(request.events) || request.events.length > 1098) {
    return failure("invalid-event-collection");
  }

  return {
    ok: true,
    request: {
      requestId: request.requestId,
      purpose,
      requestedAt: new Date(request.requestedAt).toISOString(),
      window: {
        startDate: window.startDate,
        endDate: window.endDate,
        maxEventsPerSource: window.maxEventsPerSource
      },
      consent: request.consent,
      events: request.events
    }
  };
}

/**
 * Onaylı Today olay zarflarından, depolama ve DOM erişimi olmadan,
 * deterministik ve veri-minimum bir NUT-017.1 bağlam paketi üretir.
 */
export function buildTodayContext(value) {
  const normalized = normalizeRequest(value);
  if (!normalized.ok) return normalized;

  const request = normalized.request;
  const consentResult = evaluateDataUsageConsent(request.consent, {
    purpose: request.purpose,
    at: request.requestedAt
  });
  if (!consentResult.ok) {
    return failure("consent-check-failed", {
      consentError: consentResult.error.code
    });
  }

  const consent = consentResult.consent;
  const sections = {
    core: [],
    health: [],
    symbolicContext: {
      role: "symbolic-context-only",
      causalityClaim: false,
      scientificEvidence: false,
      items: []
    }
  };
  const provenance = [];
  const omissions = [];
  const redactions = [];
  const seenIds = new Set();
  const sourceCounts = {
    "today-core": 0,
    "today-health": 0,
    "today-sky": 0
  };
  let freeTextIncluded = false;

  const candidates = request.events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => compareEvents(left.event, right.event));

  for (const candidate of candidates) {
    const event = normalizeEvent(candidate.event);
    if (!event) {
      omissions.push(omissionFor(candidate.event, "invalid-event", candidate.index));
      continue;
    }

    if (seenIds.has(event.eventId)) {
      omissions.push(omissionFor(event, "duplicate-event-id", candidate.index));
      continue;
    }
    seenIds.add(event.eventId);

    if (
      event.localDate < request.window.startDate ||
      event.localDate > request.window.endDate
    ) {
      omissions.push(omissionFor(event, "outside-request-window", candidate.index));
      continue;
    }

    if (Date.parse(event.createdAt) > Date.parse(request.requestedAt)) {
      omissions.push(omissionFor(event, "event-created-after-request", candidate.index));
      continue;
    }

    if (RAW_SKY_EVENT_TYPES.has(event.eventType)) {
      omissions.push(omissionFor(event, "raw-sky-input-excluded", candidate.index));
      continue;
    }

    const sourceKey = {
      "today-core": "core",
      "today-health": "health",
      "today-sky": "sky"
    }[event.source];
    if (!consent.permissions[sourceKey].allowed) {
      omissions.push(omissionFor(event, "source-not-consented", candidate.index));
      continue;
    }

    if (!SUPPORTED_EVENT_TYPES[event.source].includes(event.eventType)) {
      omissions.push(omissionFor(event, "unsupported-event-type", candidate.index));
      continue;
    }

    sourceCounts[event.source] += 1;
    if (sourceCounts[event.source] > request.window.maxEventsPerSource) {
      omissions.push(omissionFor(event, "source-event-limit", candidate.index));
      continue;
    }

    const mapped = mapEvent(event, consent);
    redactions.push(...mapped.redactions);
    if (mapped.omissionReason) {
      omissions.push(omissionFor(event, mapped.omissionReason, candidate.index));
      continue;
    }

    const contextItemId = `context-item:${event.eventId}`;
    const item = {
      contextItemId,
      eventId: event.eventId,
      source: event.source,
      eventType: event.eventType,
      localDate: event.localDate,
      createdAt: event.createdAt,
      dataClasses: [...new Set(mapped.dataClasses)],
      facts: mapped.facts
    };

    if (event.source === "today-core") sections.core.push(item);
    else if (event.source === "today-health") sections.health.push(item);
    else sections.symbolicContext.items.push(item);

    provenance.push({
      contextItemId,
      eventId: event.eventId,
      source: event.source,
      eventType: event.eventType
    });
    freeTextIncluded ||= mapped.freeTextIncluded === true;
  }

  const context = {
    schemaVersion: CONTEXT_PACKAGE_SCHEMA_VERSION,
    contextId: `context:${request.requestId}`,
    requestId: request.requestId,
    purpose: request.purpose,
    builtAt: request.requestedAt,
    processing: {
      mode: "device-only",
      externalRecipient: null,
      retention: "request-scoped"
    },
    consentReceipt: {
      consentId: consent.consentId,
      granted: true,
      grantedAt: consent.grantedAt,
      purpose: consent.purpose
    },
    window: { ...request.window },
    sections,
    provenance,
    omissions,
    redactions,
    boundaries: {
      skyRole: "symbolic-context-only",
      skyCausalityAllowed: false,
      skyScientificEvidence: false,
      rawBirthDataIncluded: false,
      domAccessed: false,
      storageAccessed: false,
      externalTransfer: false,
      freeTextIncluded
    },
    counts: {
      core: sections.core.length,
      health: sections.health.length,
      symbolicSky: sections.symbolicContext.items.length,
      omitted: omissions.length,
      redacted: redactions.length
    }
  };

  return deepFreeze({ ok: true, context });
}
