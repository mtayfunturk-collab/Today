// Read-only observations of an already consented Context Package v1.
// No storage, provider, notification, diagnosis or action execution.
export const WINDOW_DAYS = Object.freeze([1, 7, 30, 90]);

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const dateKey = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const time = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value));
const number = (value, max) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
const error = code => freeze({ ok: false, error: { code } });
const evidence = item => ({ source: item.source, eventId: item.eventId, localDate: item.localDate });
const kinds = {
  "daily-checkin": ["today-core", null],
  "sleep-record": ["today-health", "sleep"],
  "energy-record": ["today-health", "energy"],
  "workout-record": ["today-health", "activity"],
  "nutrition-record": ["today-health", null],
  "symptom-record": ["today-health", "symptoms"]
};

function validate(context, requestedAt) {
  if (!time(requestedAt) || context?.schemaVersion !== 1 || !time(context.builtAt) ||
      Date.parse(context.builtAt) > Date.parse(requestedAt) ||
      !dateKey(context.window?.startDate) || !dateKey(context.window?.endDate) ||
      !Number.isInteger(context.window.maxEventsPerSource) || context.window.maxEventsPerSource < 1 ||
      context.window.maxEventsPerSource > 366 ||
      context.processing?.mode !== "device-only" || context.processing?.externalRecipient !== null ||
      context.processing?.retention !== "request-scoped" ||
      context.consentReceipt?.granted !== true || !context.consentReceipt.consentId ||
      !context.purpose || context.consentReceipt.purpose !== context.purpose ||
      !time(context.consentReceipt.grantedAt) || Date.parse(context.consentReceipt.grantedAt) > Date.parse(context.builtAt) ||
      context.boundaries?.skyRole !== "symbolic-context-only" ||
      ["skyCausalityAllowed", "skyScientificEvidence", "rawBirthDataIncluded", "domAccessed", "storageAccessed", "externalTransfer"]
        .some(key => context.boundaries?.[key] !== false) ||
      !Array.isArray(context.sections?.core) || !Array.isArray(context.sections?.health) ||
      !Array.isArray(context.sections?.symbolicContext?.items) ||
      context.sections.symbolicContext.role !== "symbolic-context-only" ||
      context.sections.symbolicContext.causalityClaim !== false ||
      context.sections.symbolicContext.scientificEvidence !== false ||
      !Array.isArray(context.provenance) || !Array.isArray(context.omissions)) return null;
  const days = 1 + Math.round((Date.parse(context.window.endDate) - Date.parse(context.window.startDate)) / 86400000);
  if (!WINDOW_DAYS.includes(days)) return null;
  const provenance = new Set(context.provenance.map(item => `${item.source}:${item.eventId}`));
  const seen = new Set();
  const rows = [...context.sections.core, ...context.sections.health];
  if (context.sections.core.length > context.window.maxEventsPerSource ||
      context.sections.health.length > context.window.maxEventsPerSource) return null;
  for (const item of rows) {
    const key = `${item?.source}:${item?.eventId}`;
    const kind = kinds[item?.eventType];
    if (!kind || kind[0] !== item.source || typeof item.eventId !== "string" || !item.eventId ||
        !dateKey(item.localDate) || item.localDate < context.window.startDate || item.localDate > context.window.endDate ||
        !time(item.createdAt) || Date.parse(item.createdAt) > Date.parse(context.builtAt) ||
        !item.facts || typeof item.facts !== "object" || Array.isArray(item.facts) || !Array.isArray(item.dataClasses) ||
        (kind[1] && !item.dataClasses.includes(kind[1])) ||
        !provenance.has(key) || seen.has(key)) return null;
    seen.add(key);
  }
  if (context.sections.core.some(item => item.source !== "today-core") ||
      context.sections.health.some(item => item.source !== "today-health")) return null;
  return { days, rows };
}

function latest(rows, type, predicate) {
  const byDay = new Map();
  for (const item of rows.filter(row => row.eventType === type && predicate(row))) {
    const current = byDay.get(item.localDate);
    if (!current || Date.parse(item.createdAt) > Date.parse(current.createdAt) ||
        (Date.parse(item.createdAt) === Date.parse(current.createdAt) && item.eventId > current.eventId)) {
      byDay.set(item.localDate, item);
    }
  }
  return [...byDay.values()].sort((a, b) => a.localDate.localeCompare(b.localDate));
}

export function observeMultiWindow(request = {}) {
  let context, requestedAt;
  let validated;
  try { ({ context, requestedAt } = request); validated = validate(context, requestedAt); }
  catch { return error("invalid-multi-window-context"); }
  if (!validated) return error("invalid-multi-window-context");
  const { days, rows } = validated;
  const observations = [];
  const specs = [
    ["core", "daily-checkin", "choice", "daily-choice", value => ["A", "B", "C"].includes(value)],
    ["sleep", "sleep-record", "durationMinutes", "sleep", value => number(value, 1440)],
    ["energy", "energy-record", "energy", "energy", value => ["low", "balanced", "high"].includes(value)],
    ["fatigue", "energy-record", "fatigue", "energy", value => ["none", "some", "high"].includes(value)],
    ["activity", "workout-record", "durationMinutes", "activity", value => number(value, 1440)]
  ];
  const selected = {};
  for (const [metric, type, field, dataClass, valid] of specs) {
    const items = latest(rows, type, item => item.dataClasses.includes(dataClass) && valid(item.facts[field]));
    selected[metric] = items;
    if (!items.length) continue;
    const frequencies = new Map();
    items.forEach(item => {
      const value = item.facts[field];
      if (typeof value === "string") frequencies.set(value, (frequencies.get(value) || 0) + 1);
    });
    observations.push({
      metric, kind: days === 1 ? "daily-observation" : "record-summary",
      recordedDays: items.length, calendarDays: days,
      // Each value is the latest eligible record of that type on its date.
      values: items.map(item => ({ localDate: item.localDate, value: item.facts[field] })),
      repeatedValues: [...frequencies].filter(([, count]) => count >= 2)
        .map(([value, recordedDays]) => ({ value, recordedDays })),
      evidence: items.map(evidence)
    });
  }
  const paired = selected.core.map(core => ({ core, sleep: selected.sleep.find(item => item.localDate === core.localDate) }))
    .filter(pair => pair.sleep);
  const matches = paired.filter(pair => pair.core.facts.choice === "C" && pair.sleep.facts.durationMinutes < 360);
  if (days > 1 && matches.length >= 2) observations.push({
    metric: "core-short-sleep", kind: "preliminary-recurrence",
    recordedDays: paired.length, matchingDays: matches.length, calendarDays: days,
    evidence: matches.flatMap(pair => [evidence(pair.core), evidence(pair.sleep)])
  });
  const observedDays = new Set(observations.flatMap(item => item.evidence.map(row => row.localDate))).size;
  return freeze({ ok: true, report: {
    schemaVersion: 1, window: { ...context.window, days }, observedDays,
    omittedEvents: context.omissions.length, observations,
    status: observations.length ? "observed" : "insufficient-data",
    uncertainty: [
      "Sonuç yalnız kaydedilmiş günleri betimler; eksik günler sıfır sayılmaz.",
      "Tek günlük kayıt tekrar örüntüsü değildir; az verideki tekrar yalnız ön gözlemdir.",
      "Birlikte görülme neden-sonuç veya tıbbi sonuç göstermez."
    ],
    boundaries: { deviceOnly: true, persistent: false, skyUsed: false, causalityClaim: false,
      diagnosis: false, actionExecuted: false, notificationSent: false, externalTransfer: false }
  }});
}
