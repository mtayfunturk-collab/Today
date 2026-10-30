import assert from "node:assert/strict";
import { createNativeWearableReader } from "../modules/wearable-native-provider.mjs";

const originalTZ = process.env.TZ;
process.env.TZ = "Europe/Istanbul";
const fixedNow = () => new Date("2026-10-30T12:00:00+03:00");
const options = { userConfirmed: true, purpose: "Seçtiğim saat özetlerini inceleme", types: ["steps"], startDate: "2026-10-29", endDate: "2026-10-29" };
const iso = (key, time) => new Date(`${key}T${time}:00+03:00`).toISOString();
const sleepSample = (start, end, extras = {}) => ({ dataType: "sleep", unit: "minute", value: (Date.parse(end) - Date.parse(start)) / 60000, startDate: start, endDate: end, ...extras });
const stepBucket = (query, value = 1234) => ({ startDate: query.startDate, endDate: query.endDate, unit: "count", value, values: { sum: value } });
function harness(platform = "android", overrides = {}) {
  const calls = [];
  const methods = {
    isAvailable: async () => ({ available: true }),
    requestAuthorization: async value => ({ readAuthorized: value.read, readDenied: [] }),
    checkAuthorization: async value => ({ readAuthorized: value.read, readDenied: [] }),
    queryAggregated: async value => ({ samples: [stepBucket(value)] }),
    readSamples: async () => ({ samples: [] }),
    queryWorkouts: async () => ({ workouts: [] }),
    ...overrides
  };
  const health = Object.fromEntries(Object.entries(methods).map(([name, fn]) => [name, async value => {
    calls.push({ name, options: value });
    return fn(value);
  }]));
  const bridge = { isNative: true, platform, pluginAvailable: true, health };
  return { calls, bridge, reader: () => createNativeWearableReader(bridge, { now: fixedNow }) };
}
let count = 0;
async function check(name, callback) {
  await callback();
  count += 1;
  console.log(`PASS ${name}`);
}

try {
  await check("PWA and incomplete/non-native bridges do not request or read", async () => {
    const unavailablePlugin = harness();
    unavailablePlugin.bridge.pluginAvailable = false;
    for (const bridge of [undefined, {}, { isNative: false, platform: "ios" }, { isNative: true, platform: "web", health: {} }, { isNative: true, platform: "android", health: {} }]) {
      const reader = await createNativeWearableReader(bridge);
      assert.deepEqual(reader.getAvailability(), { supported: false, provider: null, connected: false });
      assert.equal((await reader.read(options)).error.code, "native-provider-unavailable");
    }
    assert.equal((await createNativeWearableReader(unavailablePlugin.bridge)).getAvailability().supported, false);
    assert.equal(unavailablePlugin.calls.length, 0);
  });

  await check("Native detection asks availability only, with no permission prompt", async () => {
    const h = harness(); const reader = await h.reader();
    assert.deepEqual(h.calls.map(call => call.name), ["isAvailable"]);
    assert.deepEqual(reader.getAvailability(), { supported: true, provider: "health-connect", connected: false });
  });

  await check("Unavailable or throwing SDK detection remains safely unsupported", async () => {
    for (const isAvailable of [async () => ({ available: false, reason: "private details" }), async () => { throw Error("private details"); }]) {
      const h = harness("android", { isAvailable }); const reader = await h.reader();
      assert.equal(reader.getAvailability().supported, false);
      assert.equal(JSON.stringify(reader.getAvailability()).includes("private"), false);
      assert.equal(h.calls.length, 1);
    }
  });

  await check("No user confirmation means no OS authorization or sample calls", async () => {
    const h = harness(); const reader = await h.reader();
    assert.equal((await reader.read({ ...options, userConfirmed: false })).ok, false);
    assert.deepEqual(h.calls.map(call => call.name), ["isAvailable"]);
  });

  await check("Authorization maps only selected sleep/steps/workouts and no write/history scope", async () => {
    const h = harness(); const reader = await h.reader();
    assert.equal((await reader.read({ ...options, types: ["sleep", "activity"] })).ok, true);
    const auth = h.calls.find(call => call.name === "requestAuthorization").options;
    assert.deepEqual(auth, { read: ["sleep", "workouts"], write: [] });
    assert.equal(h.calls.some(call => call.name === "queryAggregated"), false);
    assert.deepEqual(h.calls.filter(call => call.name === "checkAuthorization").map(call => call.options), [
      { read: ["sleep"], write: [] }, { read: ["workouts"], write: [] }
    ]);
  });

  await check("HealthKit empty reads never infer denial or trust readAuthorized", async () => {
    const h = harness("ios", {
      requestAuthorization: async () => ({ readAuthorized: [], readDenied: ["steps"] }),
      queryAggregated: async () => ({ samples: [] })
    });
    const result = await (await h.reader()).read(options);
    assert.equal(result.ok, true); assert.equal(result.status, "no-readable-data");
    assert.equal(result.permissionState, "not-inferred"); assert.deepEqual(result.samples, []);
    assert.equal(h.calls.some(call => call.name === "checkAuthorization"), false);
  });

  await check("Android denied selected type prevents all sample queries", async () => {
    const h = harness("android", { requestAuthorization: async () => ({ readAuthorized: [], readDenied: ["steps"] }) });
    const result = await (await h.reader()).read(options);
    assert.equal(result.error.code, "permission-request-incomplete");
    assert.deepEqual(h.calls.map(call => call.name), ["isAvailable", "requestAuthorization"]);
  });

  await check("Android permission is checked again before read and revocation fails safely", async () => {
    const h = harness("android", { checkAuthorization: async () => ({ readAuthorized: [], readDenied: ["steps"] }) });
    const result = await (await h.reader()).read(options);
    assert.equal(result.error.code, "provider-read-failed");
    assert.equal(h.calls.some(call => call.name === "queryAggregated"), false);
  });

  await check("Step reading uses native aggregation and returns a coarse private summary", async () => {
    const h = harness("ios", { queryAggregated: async query => ({ samples: [{ ...stepBucket(query, 4321), sourceId: "private-device", metadata: { note: "private-note" } }] }) });
    const result = await (await h.reader()).read(options);
    assert.equal(result.ok, true); assert.equal(result.samples[0].value, 4321);
    assert.equal(result.samples[0].sourceId, "apple-health:native-daily-summary");
    assert.equal(result.samples[0].aggregation, "daily-deduplicated");
    assert.equal(result.persistent, false); assert.equal(result.externalTransfer, false);
    assert.equal(Object.isFrozen(result.samples[0]), true);
    assert.equal(JSON.stringify(result).includes("private"), false);
    assert.equal(h.calls.some(call => call.name === "readSamples"), false);
    assert.deepEqual(h.calls.find(call => call.name === "queryAggregated").options, {
      startDate: iso("2026-10-29", "00:00"), endDate: iso("2026-10-30", "00:00"), dataType: "steps", bucket: "day", aggregation: "sum"
    });
  });

  await check("No aggregate bucket is missing data; an explicit zero remains zero", async () => {
    const missing = harness("ios", { queryAggregated: async () => ({ samples: [] }) });
    assert.equal((await (await missing.reader()).read(options)).status, "no-readable-data");
    const zero = harness("ios", { queryAggregated: async query => ({ samples: [stepBucket(query, 0)] }) });
    const result = await (await zero.reader()).read(options);
    assert.equal(result.samples.length, 1); assert.equal(result.samples[0].value, 0);
  });

  await check("Invalid, overlapping, wrongly scoped or noninteger step buckets fail the whole read", async () => {
    const patches = [
      bucket => [{ ...bucket, unit: "minute" }],
      bucket => [{ ...bucket, value: 3.5, values: { sum: 3.5 } }],
      bucket => [{ ...bucket, value: 1, values: {} }],
      bucket => [{ ...bucket, values: { sum: -1 } }],
      bucket => [{ ...bucket, startDate: "invalid" }],
      bucket => [{ ...bucket, startDate: "2026-02-30T00:00:00Z" }],
      bucket => [{ ...bucket, endDate: iso("2026-10-31", "00:00") }],
      bucket => [bucket, bucket],
      bucket => [bucket, bucket, bucket]
    ];
    for (const patch of patches) {
      const h = harness("ios", { queryAggregated: async query => ({ samples: patch(stepBucket(query)) }) });
      const result = await (await h.reader()).read(options);
      assert.equal(result.error.code, "provider-read-failed");
      assert.equal(result.samples, undefined);
    }
  });

  await check("Sleep unions duplicate/asleep stages, excludes awake/inBed and strips raw metadata", async () => {
    const start = iso("2026-10-29", "01:00"); const middle = iso("2026-10-29", "03:00"); const end = iso("2026-10-29", "05:00");
    const sample = sleepSample(start, end, { hasStageData: true, sourceId: "private-watch", stages: [
      { startDate: start, endDate: middle, stage: "deep", durationMinutes: 120 },
      { startDate: middle, endDate: end, stage: "awake", durationMinutes: 120 }
    ] });
    const h = harness("android", { readSamples: async () => ({ samples: [sample, sample, sleepSample(start, end, { sleepState: "inBed" })] }) });
    const result = await (await h.reader()).read({ ...options, types: ["sleep"] });
    assert.equal(result.samples[0].value, 120);
    assert.equal(JSON.stringify(result).includes("private-watch"), false);
  });

  await check("Overnight sleep clips to the selected calendar day without duplication", async () => {
    const h = harness("ios", { readSamples: async () => ({ samples: [sleepSample(iso("2026-10-28", "23:00"), iso("2026-10-29", "07:00"), { sleepState: "asleep" })] }) });
    const result = await (await h.reader()).read({ ...options, types: ["sleep"] });
    assert.equal(result.samples[0].value, 420); assert.equal(result.samples[0].localDate, "2026-10-29");
  });

  await check("An un-staged sleep session or awake-only sample does not invent asleep minutes", async () => {
    const sample = sleepSample(iso("2026-10-29", "01:00"), iso("2026-10-29", "07:00"));
    const h = harness("android", { readSamples: async () => ({ samples: [sample, { ...sample, sleepState: "awake" }] }) });
    const result = await (await h.reader()).read({ ...options, types: ["sleep"] });
    assert.equal(result.status, "no-readable-data"); assert.deepEqual(result.samples, []);
  });

  await check("Invalid sleep stages, future intervals and a full sample page never produce partial success", async () => {
    const sample = sleepSample(iso("2026-10-29", "01:00"), iso("2026-10-29", "07:00"), { sleepState: "asleep" });
    const batches = [
      [sample, { ...sample, sleepState: "unknown-stage" }],
      [{ ...sample, hasStageData: true }],
      [{ ...sample, stages: [{ stage: "deep", startDate: iso("2026-10-28", "00:00"), endDate: sample.endDate }] }],
      [{ ...sample, endDate: iso("2026-10-31", "07:00") }],
      Array(1000).fill(sample)
    ];
    for (const samples of batches) {
      const h = harness("ios", { readSamples: async () => ({ samples }) });
      assert.equal((await (await h.reader()).read({ ...options, types: ["sleep"] })).error.code, "provider-read-failed");
    }
  });

  await check("Workout summaries union elapsed session spans across sources and preserve pause distinction", async () => {
    const workout = (start, end, duration) => ({ startDate: iso("2026-10-29", start), endDate: iso("2026-10-29", end), duration, metadata: { privateNote: "hidden" } });
    const h = harness("ios", { queryWorkouts: async () => ({ workouts: [workout("10:00", "11:00", 1800), workout("10:00", "11:00", 1800), workout("10:30", "11:30", 3600)] }) });
    const result = await (await h.reader()).read({ ...options, types: ["activity"] });
    assert.equal(result.samples[0].value, 90); assert.equal(result.samples[0].unit, "min");
    assert.equal(JSON.stringify(result).includes("privateNote"), false);
  });

  await check("Workout page anchors, page caps and invalid durations fail closed", async () => {
    const workout = { startDate: iso("2026-10-29", "10:00"), endDate: iso("2026-10-29", "11:00"), duration: 3600 };
    for (const response of [{ workouts: [workout], anchor: "next-private-page" }, { workouts: Array(200).fill(workout) }, { workouts: [{ ...workout, duration: 9000 }] }]) {
      const h = harness("ios", { queryWorkouts: async () => response });
      assert.equal((await (await h.reader()).read({ ...options, types: ["activity"] })).error.code, "provider-read-failed");
    }
  });

  await check("Native historical/future scope is rejected before requesting expanded OS access", async () => {
    for (const range of [
      { startDate: "2026-09-30", endDate: "2026-10-30" },
      { startDate: "2026-09-01", endDate: "2026-09-01" },
      { startDate: "2026-10-31", endDate: "2026-10-31" }
    ]) {
      const h = harness(); const reader = await h.reader();
      assert.equal((await reader.read({ ...options, ...range })).ok, false);
      assert.deepEqual(h.calls.map(call => call.name), ["isAvailable"]);
    }
  });

  await check("A multi-day scope queries each date separately, not a multiplied 24-hour range", async () => {
    const h = harness("ios");
    const result = await (await h.reader()).read({ ...options, startDate: "2026-10-27" });
    assert.deepEqual(result.samples.map(sample => sample.localDate), ["2026-10-27", "2026-10-28", "2026-10-29"]);
    assert.equal(h.calls.filter(call => call.name === "queryAggregated").length, 3);
  });

  await check("DST fall/spring calendar boundaries and two native fall-day buckets are handled", async () => {
    process.env.TZ = "Europe/Berlin";
    try {
      for (const [key, next, hours] of [["2026-10-25", "2026-10-26", 25], ["2026-03-29", "2026-03-30", 23]]) {
        const h = harness("android", { queryAggregated: async query => {
          const start = Date.parse(query.startDate); const end = Date.parse(query.endDate);
          assert.equal((end - start) / 3600000, hours);
          if (hours === 25) {
            const split = new Date(start + 86400000).toISOString();
            return { samples: [stepBucket({ startDate: query.startDate, endDate: split }, 100), stepBucket({ startDate: split, endDate: query.endDate }, 50)] };
          }
          return { samples: [stepBucket(query, 150)] };
        } });
        const reader = await createNativeWearableReader(h.bridge, { now: () => new Date(`${next}T12:00:00`) });
        const result = await reader.read({ ...options, startDate: key, endDate: key });
        assert.equal(result.ok, true); assert.equal(result.samples[0].value, 150);
      }
    } finally { process.env.TZ = "Europe/Istanbul"; }
  });

  await check("Today's query ends at now while native calendar-bucket metadata may end at midnight", async () => {
    const h = harness("ios", { queryAggregated: async query => {
      assert.equal(query.endDate, fixedNow().toISOString());
      return { samples: [{ ...stepBucket(query, 22), endDate: iso("2026-10-31", "00:00") }] };
    } });
    const result = await (await h.reader()).read({ ...options, startDate: "2026-10-30", endDate: "2026-10-30" });
    assert.equal(result.samples[0].value, 22);
  });

  await check("Native error messages cannot leak into the read result", async () => {
    const h = harness("android", { queryAggregated: async () => { throw Error("private health error source id"); } });
    const result = await (await h.reader()).read(options);
    assert.deepEqual(result, { ok: false, error: { code: "provider-read-failed" } });
    assert.equal(JSON.stringify(result).includes("private"), false);
  });

  await check("Cancelling while the OS authorization sheet is pending prevents every data query", async () => {
    const controller = new AbortController();
    const h = harness("ios", { requestAuthorization: async value => {
      controller.abort();
      return { readAuthorized: value.read, readDenied: [] };
    } });
    const result = await (await h.reader()).read({ ...options, signal: controller.signal });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "read-cancelled");
    assert.deepEqual(h.calls.map(call => call.name), ["isAvailable", "requestAuthorization"]);
    assert.equal(result.samples, undefined);
  });

  await check("Cancelling after the first calendar query discards it and stops subsequent dates", async () => {
    const controller = new AbortController();
    const h = harness("android", { queryAggregated: async query => {
      controller.abort();
      return { samples: [stepBucket(query)] };
    } });
    const result = await (await h.reader()).read({ ...options, startDate: "2026-10-27", signal: controller.signal });
    assert.equal(result.ok, false); assert.equal(result.samples, undefined);
    assert.equal(result.error.code, "read-cancelled");
    assert.equal(h.calls.filter(call => call.name === "queryAggregated").length, 1);
    assert.equal(h.calls.filter(call => call.name === "checkAuthorization").length, 1);
  });

  await check("Cancelling during Android's permission recheck stops the following health query", async () => {
    const controller = new AbortController();
    const h = harness("android", { checkAuthorization: async value => {
      controller.abort();
      return { readAuthorized: value.read, readDenied: [] };
    } });
    const result = await (await h.reader()).read({ ...options, signal: controller.signal });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "read-cancelled");
    assert.equal(h.calls.some(call => call.name === "queryAggregated"), false);
  });

  await check("Cancelling a sleep/workout await stops all later selected types", async () => {
    for (const [type, method, response] of [["sleep", "readSamples", { samples: [] }], ["activity", "queryWorkouts", { workouts: [] }]]) {
      const controller = new AbortController();
      const h = harness("ios", { [method]: async () => { controller.abort(); return response; } });
      const result = await (await h.reader()).read({ ...options, types: [type, "steps"], signal: controller.signal });
      assert.equal(result.ok, false); assert.equal(result.samples, undefined);
      assert.equal(result.error.code, "read-cancelled");
      assert.equal(h.calls.some(call => call.name === "queryAggregated"), false);
    }
  });

  console.log(`NUT-019.2 Native Wearable Provider: ${count}/${count} başarılı`);
} finally {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
}
