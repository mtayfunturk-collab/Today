/** Bounded, opt-in notification archive. No reads/writes occur on import. */
import { DATA_CLASSES } from "../Today-AI-Engine/src/data-usage-consent.mjs";

export const KEY = "today_ai_delivery_v1";
export const RETENTION_MS = 7 * 86400000;
const MAX_REPORT_BYTES = 16 * 1024;
const MAX_STATE_BYTES = 128 * 1024;
const CAVEATS = Object.freeze([
  "Sonuç yalnız kaydedilmiş günleri betimler; eksik günler sıfır sayılmaz.",
  "Tek günlük kayıt tekrar örüntüsü değildir; az verideki tekrar yalnız ön gözlemdir.",
  "Birlikte görülme neden-sonuç veya tıbbi sonuç göstermez."
]);
const METRICS = Object.freeze({
  core: ["A", "B", "C"], energy: ["low", "balanced", "high"], fatigue: ["none", "some", "high"],
  sleep: 1440, activity: 1440, "wearable-sleep-calendar-day": 1440,
  "wearable-steps": 1000000, "wearable-workout-span": 1440
});
const PROVIDERS = ["apple-health", "health-connect"];
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fail = code => { throw new TypeError(code); };
const bounded = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const integer = (value, min, max) => Number.isInteger(value) && bounded(value, min, max);
const bytes = value => new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)).length;
const clone = value => JSON.parse(JSON.stringify(value));
function frozen(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function keys(value, names) {
  if (!plain(value) || Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name))) fail("invalid-fields");
}
function time(value) {
  if (typeof value !== "string" || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail("invalid-time");
  day(value.slice(0, 10));
  return Date.parse(value);
}
function day(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) fail("invalid-date");
  return value;
}
function token(value, max = 100) {
  if (typeof value !== "string" || !new RegExp(`^[a-zA-Z0-9._:-]{1,${max}}$`).test(value)) fail("invalid-token");
  return value;
}
function insightId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(value)) fail("invalid-insight-id");
  return value;
}
function windowOf(value, strict = false) {
  if (strict) keys(value, ["startDate", "endDate", "days"]);
  if (!plain(value)) fail("invalid-window");
  const startDate = day(value.startDate), endDate = day(value.endDate);
  const days = 1 + (Date.parse(endDate) - Date.parse(startDate)) / 86400000;
  if (![1, 7, 30, 90].includes(days) || value.days !== days) fail("invalid-window");
  return { startDate, endDate, days };
}
function validValue(metric, value) {
  const spec = METRICS[metric];
  return Array.isArray(spec) ? spec.includes(value) : bounded(value, 0, spec) &&
    (metric !== "wearable-steps" || Number.isInteger(value));
}

function observationOf(input, window, strict) {
  if (!plain(input)) fail("invalid-observation");
  const recurrence = input.metric === "core-short-sleep";
  const wearable = typeof input.metric === "string" && input.metric.startsWith("wearable-");
  if (!recurrence && !Object.hasOwn(METRICS, input.metric)) fail("invalid-metric");
  const fields = recurrence ? ["metric", "kind", "recordedDays", "matchingDays", "calendarDays"] :
    ["metric", "kind", "recordedDays", "calendarDays", "values", "repeatedValues", ...(wearable ? ["unit", "providers"] : [])];
  if (strict) keys(input, fields);
  if (!integer(input.recordedDays, 1, window.days) || input.calendarDays !== window.days) fail("invalid-recorded-days");
  const result = { metric: input.metric, kind: input.kind, recordedDays: input.recordedDays, calendarDays: input.calendarDays };
  if (recurrence) {
    if (window.days === 1 || input.kind !== "preliminary-recurrence" || !integer(input.matchingDays, 2, input.recordedDays)) fail("invalid-recurrence");
    result.matchingDays = input.matchingDays;
    return result;
  }
  if (input.kind !== (window.days === 1 ? "daily-observation" : "record-summary") ||
      !Array.isArray(input.values) || input.values.length !== input.recordedDays || !Array.isArray(input.repeatedValues) || input.repeatedValues.length > 3) fail("invalid-observation");
  const seen = new Set();
  result.values = input.values.map(item => {
    if (!plain(item)) fail("invalid-observation-value");
    if (strict) keys(item, ["localDate", "value"]);
    const localDate = day(item.localDate);
    if (localDate < window.startDate || localDate > window.endDate || seen.has(localDate) || !validValue(input.metric, item.value)) fail("invalid-observation-value");
    seen.add(localDate); return { localDate, value: item.value };
  }).sort((a, b) => a.localDate.localeCompare(b.localDate));
  const repeated = new Set();
  result.repeatedValues = input.repeatedValues.map(item => {
    if (!plain(item)) fail("invalid-repeated-value");
    if (strict) keys(item, ["value", "recordedDays"]);
    if (typeof item.value !== "string" || !validValue(input.metric, item.value) || repeated.has(item.value) ||
        !integer(item.recordedDays, 2, input.recordedDays) || result.values.filter(row => row.value === item.value).length !== item.recordedDays) fail("invalid-repeated-value");
    repeated.add(item.value); return { value: item.value, recordedDays: item.recordedDays };
  });
  if (wearable) {
    const expectedUnit = input.metric === "wearable-steps" ? "count" : "min";
    if (input.unit !== expectedUnit || !Array.isArray(input.providers) || !input.providers.length || input.providers.length > 2 ||
        input.providers.some(value => !PROVIDERS.includes(value)) || new Set(input.providers).size !== input.providers.length) fail("invalid-native-metadata");
    result.unit = expectedUnit; result.providers = [...input.providers].sort();
  }
  return result;
}

function reportOf(value, strict = false) {
  if (!plain(value)) fail("invalid-report");
  if (strict) keys(value, ["schemaVersion", "window", "observedDays", "omittedEvents", "observations", "status", "uncertainty"]);
  const window = windowOf(value.window, strict);
  if (value.schemaVersion !== 1 || value.status !== "observed" || !integer(value.observedDays, 1, window.days) ||
      !integer(value.omittedEvents, 0, 1000000) || !Array.isArray(value.observations) || !value.observations.length || value.observations.length > 9) fail("invalid-report");
  const metrics = new Set();
  const observations = value.observations.map(item => {
    if (metrics.has(item?.metric)) fail("duplicate-metric");
    metrics.add(item?.metric); return observationOf(item, window, strict);
  });
  const knownDays = new Set(observations.flatMap(item => (item.values || []).map(row => row.localDate))).size;
  if (!knownDays || value.observedDays !== knownDays) fail("invalid-observed-days");
  if (strict && (!Array.isArray(value.uncertainty) || value.uncertainty.length !== CAVEATS.length || value.uncertainty.some((item, index) => item !== CAVEATS[index]))) fail("invalid-caveats");
  const result = { schemaVersion: 1, window, observedDays: value.observedDays, omittedEvents: value.omittedEvents,
    observations, status: "observed", uncertainty: [...CAVEATS] };
  if (bytes(result) > MAX_REPORT_BYTES) fail("report-size-limit");
  return result;
}

export function sanitizeObservation(report) {
  try { return frozen({ ok: true, report: reportOf(report) }); }
  catch { return frozen({ ok: false, error: "invalid-observation-report" }); }
}

export function defaultState() {
  return frozen({ schemaVersion: 1,
    preferences: { aiEnabled: false, updateEnabled: false, localTime: null, quietHours: null, timeZoneMode: "device-local" },
    dailyAnalysisConsent: { enabled: false, purpose: null, grantedAt: null, expiresAt: null, windowDays: null,
      scope: { core: [], health: [], sky: [] } },
    insights: [], dispatches: [], lastNotifiedUpdateVersion: null });
}
function clockTime(value) { return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }
function validateState(value, now) {
  keys(value, ["schemaVersion", "preferences", "dailyAnalysisConsent", "insights", "dispatches", "lastNotifiedUpdateVersion"]);
  if (value.schemaVersion !== 1) fail("unsupported-schema");
  const prefs = value.preferences;
  keys(prefs, ["aiEnabled", "updateEnabled", "localTime", "quietHours", "timeZoneMode"]);
  if (typeof prefs.aiEnabled !== "boolean" || typeof prefs.updateEnabled !== "boolean" || prefs.timeZoneMode !== "device-local" ||
      (prefs.localTime !== null && !clockTime(prefs.localTime)) || (prefs.aiEnabled && !clockTime(prefs.localTime))) fail("invalid-preferences");
  if (prefs.quietHours !== null) {
    keys(prefs.quietHours, ["start", "end"]);
    if (!clockTime(prefs.quietHours.start) || !clockTime(prefs.quietHours.end) || prefs.quietHours.start === prefs.quietHours.end) fail("invalid-quiet-hours");
  }
  const consent = value.dailyAnalysisConsent;
  keys(consent, ["enabled", "purpose", "grantedAt", "expiresAt", "windowDays", "scope"]);
  keys(consent.scope, ["core", "health", "sky"]);
  if (typeof consent.enabled !== "boolean") fail("invalid-consent");
  for (const source of ["core", "health", "sky"]) {
    const classes = consent.scope[source];
    if (!Array.isArray(classes) || new Set(classes).size !== classes.length || classes.some(item => !DATA_CLASSES[source].includes(item))) fail("invalid-consent-scope");
  }
  if (consent.enabled) {
    if (typeof consent.purpose !== "string" || !consent.purpose.trim() || consent.purpose.length > 160 ||
        time(consent.grantedAt) > now || time(consent.expiresAt) <= time(consent.grantedAt) ||
        ![1, 7, 30, 90].includes(consent.windowDays) || !Object.values(consent.scope).some(items => items.length)) fail("invalid-consent");
  } else if ([consent.purpose, consent.grantedAt, consent.expiresAt, consent.windowDays].some(item => item !== null) ||
      Object.values(consent.scope).some(items => items.length)) fail("inactive-consent-data");
  if (!Array.isArray(value.insights) || value.insights.length > 7 || !Array.isArray(value.dispatches) || value.dispatches.length > 14) fail("archive-count-limit");
  const insightIds = new Set();
  for (const insight of value.insights) {
    keys(insight, ["id", "createdAt", "expiresAt", "rulesetId", "window", "report"]);
    insightId(insight.id); token(insight.rulesetId, 160);
    const createdAt = time(insight.createdAt), expiresAt = time(insight.expiresAt);
    if (createdAt > now || expiresAt <= createdAt || expiresAt - createdAt > RETENTION_MS || insightIds.has(insight.id)) fail("invalid-insight");
    insightIds.add(insight.id);
    const window = windowOf(insight.window, true), report = reportOf(insight.report, true);
    if (JSON.stringify(window) !== JSON.stringify(report.window)) fail("insight-window-mismatch");
  }
  const dispatchIds = new Set();
  for (const item of value.dispatches) {
    keys(item, ["id", "kind", "insightId", "version", "localDate", "zone", "scheduledFor", "state"]);
    if (!integer(item.id, 1, 2147483647) || dispatchIds.has(item.id) || !["ai", "update"].includes(item.kind) ||
        !["reserved", "scheduled", "failed"].includes(item.state) || time(item.scheduledFor) > now + RETENTION_MS) fail("invalid-dispatch");
    dispatchIds.add(item.id); day(item.localDate);
    if (typeof item.zone !== "string" || item.zone.length > 100) fail("invalid-time-zone");
    try { new Intl.DateTimeFormat("en", { timeZone: item.zone }); } catch { fail("invalid-time-zone"); }
    if (item.kind === "ai") { insightId(item.insightId); if (item.version !== null) fail("invalid-dispatch"); }
    else { token(item.version); if (item.insightId !== null) fail("invalid-dispatch"); }
  }
  if (value.lastNotifiedUpdateVersion !== null) token(value.lastNotifiedUpdateVersion);
  if (bytes(value) > MAX_STATE_BYTES) fail("state-size-limit");
  return clone(value);
}

export function cleanState(value, at = new Date()) {
  try {
    const now = at instanceof Date ? at.getTime() : time(at);
    if (!Number.isFinite(now)) fail("invalid-clock");
    const original = validateState(value, now), state = clone(original);
    state.insights = state.insights.filter(item => time(item.expiresAt) > now);
    const insightIds = new Set(state.insights.map(item => item.id));
    const removed = state.dispatches.filter(item => time(item.scheduledFor) + RETENTION_MS <= now ||
      (item.kind === "ai" && !insightIds.has(item.insightId)));
    const expiredIds = removed.map(item => item.id);
    state.dispatches = state.dispatches.filter(item => !expiredIds.includes(item.id));
    if (state.dailyAnalysisConsent.enabled && time(state.dailyAnalysisConsent.expiresAt) <= now) state.dailyAnalysisConsent = clone(defaultState().dailyAnalysisConsent);
    return frozen({ ok: true, state, originalState: original, expiredIds, changed: JSON.stringify(original) !== JSON.stringify(state) });
  } catch { return frozen({ ok: false, error: "invalid-notification-state" }); }
}

export function createNotificationStore({ storage, now = () => new Date() } = {}) {
  const error = code => frozen({ ok: false, error: code });
  function read() {
    try {
      const raw = storage.getItem(KEY);
      if (raw === null) return frozen({ ok: true, state: defaultState(), originalState: defaultState(), expiredIds: [], changed: false, exists: false });
      if (typeof raw !== "string" || bytes(raw) > MAX_STATE_BYTES) return error("invalid-notification-state");
      const result = cleanState(JSON.parse(raw), now());
      return result.ok ? frozen({ ...result, exists: true }) : result;
    } catch { return error("notification-storage-unavailable"); }
  }
  function commit(value) {
    const existing = read();
    if (!existing.ok) return existing;
    try {
      const at = now();
      const instant = at instanceof Date ? at.getTime() : time(at);
      if (!Number.isFinite(instant)) fail("invalid-clock");
      const state = validateState(value, instant);
      const empty = !state.preferences.aiEnabled && !state.preferences.updateEnabled && !state.insights.length && !state.dispatches.length;
      if (empty) { if (existing.exists) storage.removeItem(KEY); }
      else storage.setItem(KEY, JSON.stringify(state));
      return frozen({ ok: true, state });
    } catch { return error("notification-state-write-failed"); }
  }
  function reset() {
    try { storage.removeItem(KEY); return frozen({ ok: true, state: defaultState() }); }
    catch { return error("notification-state-reset-failed"); }
  }
  return frozen({ read, commit, reset });
}
