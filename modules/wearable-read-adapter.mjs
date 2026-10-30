// Contract for a future native HealthKit/Health Connect provider.
// This module neither registers a provider nor requests access on import.
export const READ_TYPES = Object.freeze(["sleep", "steps", "activity"]);
// Content contract only: importing these templates never schedules or sends a notification.
export const NOTIFICATION_TEMPLATES = Object.freeze({
  appUpdate: Object.freeze({
    title: "Today Yenilik",
    body: "Today’in yeni sürümü hazır. Yenilikleri görmek için uygulamayı aç."
  }),
  aiObservation: Object.freeze({
    title: "Today",
    body: "Today, yeni bir gözlemin var. Uygulamayı açıp inceleyebilirsin."
  })
});
export const NOTIFICATION_PREVIEW = NOTIFICATION_TEMPLATES.aiObservation;

const dateKey = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const failure = code => Object.freeze({ ok: false, error: Object.freeze({ code }) });

export function createWearableReader(provider = null) {
  const supported = ["apple-health", "health-connect"].includes(provider?.kind) &&
    typeof provider.requestReadPermission === "function" && typeof provider.readDailySummaries === "function";
  return Object.freeze({
    getAvailability: () => Object.freeze({ supported, provider: supported ? provider.kind : null, connected: false }),
    async read(options = {}) {
      if (!supported) return failure("native-provider-unavailable");
      if (options?.signal?.aborted === true) return failure("read-cancelled");
      if (options?.userConfirmed !== true || typeof options.purpose !== "string" || !options.purpose.trim() ||
          !Array.isArray(options.types) || !options.types.length ||
          options.types.some(type => !READ_TYPES.includes(type)) || new Set(options.types).size !== options.types.length ||
          !dateKey(options.startDate) || !dateKey(options.endDate)) return failure("explicit-read-scope-required");
      const days = 1 + (Date.parse(options.endDate) - Date.parse(options.startDate)) / 86400000;
      if (days < 1 || days > 90) return failure("invalid-read-window");
      const scope = Object.freeze({ types: Object.freeze([...options.types]), startDate: options.startDate,
        endDate: options.endDate, purpose: options.purpose.trim(), readOnly: true,
        ...(options.signal ? { signal: options.signal } : {}) });
      try {
        // Completion is not proof that every HealthKit type was granted.
        if (await provider.requestReadPermission(scope) !== true) return failure("permission-request-incomplete");
        if (scope.signal?.aborted === true) return failure("read-cancelled");
        const samples = await provider.readDailySummaries(scope);
        if (scope.signal?.aborted === true) return failure("read-cancelled");
        if (!Array.isArray(samples) || samples.length > 270) return failure("invalid-provider-response");
        const daysSeen = new Set();
        const normalized = [];
        for (const sample of samples) {
          const key = `${sample?.type}:${sample?.localDate}`;
          const unit = sample?.type === "steps" ? "count" : "min";
          const max = sample?.type === "steps" ? 1000000 : 1440;
          if (!sample || !options.types.includes(sample.type) || !dateKey(sample.localDate) ||
              sample.localDate < options.startDate || sample.localDate > options.endDate ||
              sample.unit !== unit || typeof sample.value !== "number" || !Number.isFinite(sample.value) ||
              sample.value < 0 || sample.value > max || (sample.type === "steps" && !Number.isInteger(sample.value)) ||
              sample.aggregation !== "daily-deduplicated" || typeof sample.sourceId !== "string" ||
              !sample.sourceId.trim() || sample.sourceId.length > 160 || daysSeen.has(key)) return failure("invalid-daily-summary");
          daysSeen.add(key);
          normalized.push(Object.freeze({ type: sample.type, localDate: sample.localDate, value: sample.value,
            unit, sourceId: sample.sourceId, provider: provider.kind, aggregation: "daily-deduplicated" }));
        }
        return Object.freeze({ ok: true, status: normalized.length ? "read-completed" : "no-readable-data",
          permissionState: "not-inferred", samples: Object.freeze(normalized), persistent: false, externalTransfer: false });
      } catch { return failure(scope.signal?.aborted === true ? "read-cancelled" : "provider-read-failed"); }
    }
  });
}
