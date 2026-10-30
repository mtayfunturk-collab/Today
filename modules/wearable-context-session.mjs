// The latest approved Health preview, kept only in this JavaScript session.
// Writing a preview never grants AI use; source adapters still require separate consent.
const TYPES = Object.freeze(["sleep", "steps", "activity"]);
const PROVIDERS = Object.freeze(["apple-health", "health-connect"]);
let revision = 0;
let preview = null;

function dateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function dateWindow(value, maxDays) {
  if (!dateKey(value?.startDate) || !dateKey(value?.endDate)) return null;
  const days = 1 + (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86400000;
  return days >= 1 && days <= maxDays
    ? Object.freeze({ startDate: value.startDate, endDate: value.endDate }) : null;
}

function timestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now();
}

function localKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}

function changed() {
  revision += 1;
  const target = globalThis.window || globalThis;
  if (typeof target.dispatchEvent === "function" && typeof target.CustomEvent === "function") {
    target.dispatchEvent(new target.CustomEvent("today:wearable-preview-changed", {
      detail: Object.freeze({ revision })
    }));
  }
}

export function clearWearablePreview() {
  preview = null;
  changed();
  return revision;
}

export function replaceWearablePreview(input = {}) {
  let normalized = null;
  try {
    const window = dateWindow(input.window, 30);
    if (!window || !timestamp(input.capturedAt) || window.endDate > localKey(new Date(input.capturedAt)) ||
        !Array.isArray(input.samples) || input.samples.length > 90) {
      throw new TypeError("invalid-wearable-preview");
    }
    const seen = new Set();
    const samples = input.samples.map(sample => {
      const unit = sample?.type === "steps" ? "count" : "min";
      const max = sample?.type === "steps" ? 1000000 : 1440;
      const key = `${sample?.type}:${sample?.localDate}`;
      if (!TYPES.includes(sample?.type) || !dateKey(sample.localDate) ||
          sample.localDate < window.startDate || sample.localDate > window.endDate ||
          !PROVIDERS.includes(sample.provider) || sample.unit !== unit ||
          sample.aggregation !== "daily-deduplicated" || typeof sample.value !== "number" ||
          !Number.isFinite(sample.value) || sample.value < 0 || sample.value > max ||
          (sample.type === "steps" && !Number.isInteger(sample.value)) || seen.has(key)) {
        throw new TypeError("invalid-wearable-preview");
      }
      seen.add(key);
      return Object.freeze({ type: sample.type, localDate: sample.localDate, value: sample.value,
        unit, provider: sample.provider, aggregation: "daily-deduplicated" });
    }).sort((a, b) => a.localDate.localeCompare(b.localDate) || a.type.localeCompare(b.type));
    if (samples.length) normalized = Object.freeze({ capturedAt: input.capturedAt,
      window, samples: Object.freeze(samples) });
  } catch {
    preview = null;
    changed();
    return Object.freeze({ ok: false, revision, error: "invalid-wearable-preview" });
  }
  preview = normalized;
  changed();
  return Object.freeze({ ok: true, revision });
}

function getSnapshot(options = {}) {
  const window = dateWindow(options, 90);
  if (!preview || !window || !Array.isArray(options.types) || !options.types.length ||
      options.types.some(type => !TYPES.includes(type)) || new Set(options.types).size !== options.types.length) return null;
  const samples = preview.samples.filter(sample => options.types.includes(sample.type) &&
    sample.localDate >= window.startDate && sample.localDate <= window.endDate);
  return samples.length ? Object.freeze({ revision, capturedAt: preview.capturedAt, window: preview.window,
    samples: Object.freeze(samples) }) : null;
}

export const wearableContextSession = Object.freeze({ getRevision: () => revision, getSnapshot });
globalThis.TodayWearableContextSession = wearableContextSession;
