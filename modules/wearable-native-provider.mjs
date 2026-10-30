import { createWearableReader } from "./wearable-read-adapter.mjs";

// Only the locally bundled native bootstrap supplies this bridge. A PWA has none.
const DATA_TYPES = Object.freeze({ sleep: "sleep", steps: "steps", activity: "workouts" });
const ASLEEP = new Set(["asleep", "rem", "deep", "light"]);
const SLEEP_STATES = new Set([...ASLEEP, "inBed", "awake"]);
const SAMPLE_LIMIT = 1000;
const WORKOUT_LIMIT = 200;
const MINUTE = 60_000;
const invalid = () => { throw new Error("invalid-native-health-response"); };
const ensureActive = scope => { if (scope.signal?.aborted === true) throw new Error("native-health-read-cancelled"); };

function localKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localMidnight(key) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (localKey(date) !== key) invalid();
  return date;
}

function scopeWindows(scope, now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) invalid();
  const today = localKey(now);
  const earliest = localMidnight(today);
  earliest.setDate(earliest.getDate() - 29);
  if (scope.startDate < localKey(earliest) || scope.endDate > today) invalid();
  const windows = [];
  // Advance calendar dates, never assume a local day always lasts 24 hours.
  for (let cursor = localMidnight(scope.startDate); localKey(cursor) <= scope.endDate;) {
    const start = new Date(cursor);
    cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    const end = new Date(Math.min(cursor.getTime(), now.getTime()));
    if (windows.length >= 30) invalid();
    windows.push({ localDate: localKey(start), start: start.getTime(), end: end.getTime(), calendarEnd: cursor.getTime() });
  }
  return windows;
}

function instant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) invalid();
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) invalid();
  const result = Date.parse(value);
  if (!Number.isFinite(result)) invalid();
  return result;
}

function interval(sample, window, now) {
  const start = instant(sample?.startDate);
  const end = instant(sample?.endDate);
  if (end <= start || end > now || start >= window.end || end <= window.start) invalid();
  return { start, end };
}

function unionMinutes(intervals, window) {
  const clipped = intervals.map(({ start, end }) => [Math.max(start, window.start), Math.min(end, window.end)])
    .filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!clipped.length) return null;
  let total = 0;
  let [start, end] = clipped[0];
  for (const [nextStart, nextEnd] of clipped.slice(1)) {
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else { total += end - start; start = nextStart; end = nextEnd; }
  }
  return (total + end - start) / MINUTE;
}

function normalizeSteps(result, window) {
  if (!Array.isArray(result?.samples) || result.samples.length > 2) invalid();
  if (!result.samples.length) return null;
  const buckets = result.samples.map(sample => {
    const start = instant(sample?.startDate);
    const end = instant(sample?.endDate);
    const value = sample?.values?.sum;
    if (sample?.unit !== "count" || !Number.isInteger(value) || value < 0 || value > 1_000_000 ||
        sample.value !== value || start < window.start || start >= window.end || end <= start || end > window.calendarEnd) invalid();
    return { start, end, value };
  }).sort((a, b) => a.start - b.start);
  if (buckets.some((sample, index) => index && sample.start < buckets[index - 1].end)) invalid();
  const value = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  if (value > 1_000_000) invalid();
  return value;
}

function normalizeSleep(result, window, now) {
  if (!Array.isArray(result?.samples) || result.samples.length >= SAMPLE_LIMIT) invalid();
  const intervals = [];
  let stagesCount = 0;
  for (const sample of result.samples) {
    const outer = interval(sample, window, now);
    if (sample.dataType !== "sleep" || sample.unit !== "minute" || !Number.isFinite(sample.value) || sample.value < 0) invalid();
    if (sample.stages != null && !Array.isArray(sample.stages)) invalid();
    if (sample.hasStageData === true && !sample.stages?.length) invalid();
    if (sample.stages?.length) {
      for (const stage of sample.stages) {
        if (++stagesCount > 10_000 || !SLEEP_STATES.has(stage?.stage)) invalid();
        const start = instant(stage.startDate);
        const end = instant(stage.endDate);
        if (start < outer.start || end > outer.end || end <= start) invalid();
        if (ASLEEP.has(stage.stage)) intervals.push({ start, end });
      }
    } else if (sample.sleepState != null) {
      if (!SLEEP_STATES.has(sample.sleepState)) invalid();
      if (ASLEEP.has(sample.sleepState)) intervals.push(outer);
    }
    // A session without an asleep state/stages is not evidence of time asleep.
  }
  return unionMinutes(intervals, window);
}

function normalizeWorkouts(result, window, now) {
  if (!Array.isArray(result?.workouts) || result.workouts.length >= WORKOUT_LIMIT || result.anchor) invalid();
  const intervals = result.workouts.map(workout => {
    const span = interval(workout, window, now);
    if (!Number.isFinite(workout.duration) || workout.duration < 0 || workout.duration > (span.end - span.start) / 1000 + 1) invalid();
    // Use the recorded session span; duration can exclude pauses and cannot be
    // safely distributed over calendar dates. This is not active exercise time.
    return span;
  });
  return unionMinutes(intervals, window);
}

export async function createNativeWearableReader(bridge = globalThis.TodayNativeHealth, { now = () => new Date() } = {}) {
  const health = bridge?.health;
  const platform = bridge?.platform;
  const native = bridge?.isNative === true && bridge.pluginAvailable === true && ["ios", "android"].includes(platform);
  const methods = ["isAvailable", "requestAuthorization", "checkAuthorization", "queryAggregated", "readSamples", "queryWorkouts"];
  if (!native || !methods.every(method => typeof health?.[method] === "function")) return createWearableReader();
  try {
    if ((await health.isAvailable())?.available !== true) return createWearableReader();
  } catch { return createWearableReader(); }

  const kind = platform === "ios" ? "apple-health" : "health-connect";
  const sourceId = `${kind}:native-daily-summary`;
  const authorization = scope => ({ read: scope.types.map(type => DATA_TYPES[type]), write: [] });
  const allowed = (result, read) => Array.isArray(result?.readAuthorized) && read.every(type => result.readAuthorized.includes(type)) &&
    (!Array.isArray(result?.readDenied) || !read.some(type => result.readDenied.includes(type)));

  const provider = Object.freeze({
    kind,
    async requestReadPermission(scope) {
      ensureActive(scope);
      scopeWindows(scope, now()); // Reject unsupported history/future dates before an OS prompt.
      const options = authorization(scope);
      const result = await health.requestAuthorization(options);
      ensureActive(scope);
      // HealthKit deliberately hides whether read permissions were denied.
      return platform === "ios" ? result != null : allowed(result, options.read);
    },
    async readDailySummaries(scope) {
      ensureActive(scope);
      const current = now();
      const windows = scopeWindows(scope, current);
      const normalized = [];
      for (const window of windows) {
        ensureActive(scope);
        if (window.end <= window.start) continue;
        const dates = { startDate: new Date(window.start).toISOString(), endDate: new Date(window.end).toISOString() };
        for (const type of scope.types) {
          ensureActive(scope);
          const dataType = DATA_TYPES[type];
          if (platform === "android") {
            const options = { read: [dataType], write: [] };
            const status = await health.checkAuthorization(options);
            ensureActive(scope);
            if (!allowed(status, options.read)) invalid();
          }
          ensureActive(scope);
          let value;
          if (type === "steps") {
            const result = await health.queryAggregated({ ...dates, dataType, bucket: "day", aggregation: "sum" });
            ensureActive(scope);
            value = normalizeSteps(result, window);
          } else if (type === "sleep") {
            const result = await health.readSamples({ ...dates, dataType, limit: SAMPLE_LIMIT, ascending: true });
            ensureActive(scope);
            value = normalizeSleep(result, window, current.getTime());
          } else {
            const result = await health.queryWorkouts({ ...dates, limit: WORKOUT_LIMIT, ascending: true });
            ensureActive(scope);
            value = normalizeWorkouts(result, window, current.getTime());
          }
          if (value != null) normalized.push({ type, localDate: window.localDate, value, unit: type === "steps" ? "count" : "min",
            sourceId, aggregation: "daily-deduplicated" });
        }
      }
      ensureActive(scope);
      return normalized;
    }
  });
  return createWearableReader(provider);
}
