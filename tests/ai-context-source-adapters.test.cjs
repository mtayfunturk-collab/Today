const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const SOURCE_PATH = path.join(
  __dirname,
  "..",
  "modules",
  "ai-context-source-adapters.js"
);
const HEALTH_SOURCE_PATH = path.join(
  __dirname,
  "..",
  "modules",
  "health-hub.js"
);
const source = fs.readFileSync(SOURCE_PATH, "utf8");
const healthSource = fs.readFileSync(HEALTH_SOURCE_PATH, "utf8");

const clone = value => JSON.parse(JSON.stringify(value));

function createConsent(overrides = {}) {
  const coreClasses = overrides.coreClasses || ["daily-choice", "color"];
  const healthClasses = overrides.healthClasses || [
    "sleep",
    "energy",
    "activity",
    "hydration"
  ];
  const skyClasses = overrides.skyClasses || [];

  return {
    schemaVersion: 1,
    consentId: "consent:nut-017.2:test",
    purpose: "Sentetik bağlam testi",
    granted: true,
    grantedAt: "2026-08-13T09:00:00.000Z",
    revokedAt: null,
    processing: {
      mode: "device-only",
      externalRecipient: null,
      retention: "request-scoped"
    },
    permissions: {
      core: {
        allowed: coreClasses.length > 0,
        dataClasses: coreClasses,
        includeFreeText: overrides.coreFreeText === true
      },
      health: {
        allowed: healthClasses.length > 0,
        dataClasses: healthClasses,
        includeFreeText: overrides.healthFreeText === true
      },
      sky: {
        allowed: skyClasses.length > 0,
        dataClasses: skyClasses,
        includeFreeText: false,
        role: "symbolic-context-only"
      }
    }
  };
}

function createRuntime() {
  const calls = {
    core: 0,
    health: [],
    nutrition: [],
    sky: []
  };
  const nutritionRecords = [
    {
      schemaVersion: 1,
      id: "hydration-1",
      type: "hydration_entry",
      recordStatus: "active",
      eventAt: "2026-08-12T10:00:00.000Z",
      payload: { amountMl: 350 }
    },
    {
      schemaVersion: 1,
      id: "activity-reference-1",
      type: "activity_reference",
      recordStatus: "active",
      eventAt: "2026-08-12T11:00:00.000Z",
      payload: { steps: 4200 }
    },
    {
      schemaVersion: 1,
      id: "meal-1",
      type: "meal_entry",
      recordStatus: "active",
      eventAt: "2026-08-12T12:00:00.000Z",
      payload: { mealType: "lunch", items: ["sentetik"] }
    },
    {
      schemaVersion: 1,
      id: "weight-1",
      type: "weight_reference",
      recordStatus: "active",
      eventAt: "2026-08-12T13:00:00.000Z",
      payload: { weightKg: 70 }
    }
  ];

  const context = {
    console: { info() {}, warn() {}, error() {} },
    Date,
    Object,
    Array,
    String,
    Number,
    Boolean,
    JSON,
    Set,
    TypeError,
    structuredClone,
    TodayStorage: {
      getAllDays() {
        calls.core += 1;
        return [
          {
            date: "2026-08-12",
            choice: "C",
            color: "red",
            note: "SENTETIK_CORE_NOTU",
            updatedAt: "2026-08-12T08:00:00.000Z"
          },
          {
            date: "2026-07-01",
            choice: "A",
            note: "PENCERE_DISI"
          }
        ];
      }
    },
    TodayHealthHub: {
      listContextRecords(options) {
        calls.health.push(clone(options));
        return {
          sleep: [{
            id: "sleep-1",
            dayKey: "2026-08-12",
            date: "2026-08-12T06:00:00.000Z",
            durationMinutes: 300,
            note: "SENTETIK_UYKU_NOTU"
          }],
          energy: [{
            id: "energy-1",
            dayKey: "2026-08-12",
            date: "2026-08-12T07:00:00.000Z",
            energy: 3,
            note: "SENTETIK_ENERJI_NOTU"
          }],
          symptoms: [{
            id: "symptom-1",
            dayKey: "2026-08-12",
            date: "2026-08-12T07:30:00.000Z",
            symptoms: ["headache"],
            customSymptom: "SENTETIK_BELIRTI_NOTU"
          }],
          workouts: [{
            id: "workout-1",
            dayKey: "2026-08-12",
            date: "2026-08-12T08:30:00.000Z",
            durationMinutes: 20,
            exercises: []
          }]
        };
      }
    },
    TodayNutritionStorage: {
      async queryRecords(options) {
        calls.nutrition.push(clone(options));
        return nutritionRecords
          .filter(record => options.types.includes(record.type))
          .map(clone);
      }
    },
    TodayCoreSkyLink: {
      listLinks(options) {
        calls.sky.push(clone(options));
        return [{
          dateKey: "2026-08-12",
          link: {
            contractVersion: 1,
            dateKey: "2026-08-12",
            linkedAt: "2026-08-12T08:45:00.000Z",
            linkMode: "user_initiated_snapshot",
            metadata: {
              interpretation: "none",
              causalityClaim: false,
              aiProcessed: false
            }
          }
        }];
      }
    }
  };

  vm.createContext(context);
  new vm.Script(source, { filename: SOURCE_PATH }).runInContext(context);
  return { context, calls };
}

const windowRequest = Object.freeze({
  startDate: "2026-08-07",
  endDate: "2026-08-13",
  maxEventsPerSource: 31
});
const requestedAt = "2026-08-13T09:00:00.000Z";
const results = [];

async function test(name, callback) {
  try {
    await callback();
    results.push({ name, success: true });
  } catch (error) {
    results.push({ name, success: false, error });
  }
}

(async () => {
  await test("Sürümlü ve değişmez public kaynak API'si yayımlanır", () => {
    const { context } = createRuntime();
    assert.equal(context.TodayAIContextSources.API_VERSION, 1);
    assert.equal(context.TodayAIContextSources.CONTRACT_VERSION, 1);
    assert.equal(
      context.TodayAIContextSources.RULESET_ID,
      "today:ai-context-source-adapters:nut-017.3.2"
    );
    assert.equal(Object.isFrozen(context.TodayAIContextSources), true);
    assert.equal(typeof context.TodayAIContextSources.collectEvents, "function");
  });

  await test("Adaptör DOM, doğrudan depolama ve ağ API'lerine bağlanmaz", () => {
    assert.doesNotMatch(
      source,
      /(?:localStorage|sessionStorage|indexedDB|document\s*\.|querySelector\s*\(|getElementById\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket\s*\()/
    );
  });

  await test("Varsayılan kapsam yalnız seçili Core ve Health olaylarını toplar", async () => {
    const { context } = createRuntime();
    const result = await context.TodayAIContextSources.collectEvents({
      consent: createConsent(),
      window: windowRequest,
      requestedAt
    });
    assert.deepEqual(clone(result.counts), {
      core: 1,
      health: 5,
      sky: 0,
      total: 6
    });
    assert.equal(result.events.some(event => event.eventType === "symptom-record"), false);
    assert.equal(result.events.some(event => event.payload.note), false);
    assert.equal(JSON.stringify(result).includes("PENCERE_DISI"), false);
  });

  await test("Nutrition sorgusu yalnız onaylı veri sınıflarının türlerini ister", async () => {
    const { context, calls } = createRuntime();
    await context.TodayAIContextSources.collectEvents({
      consent: createConsent(),
      window: windowRequest,
      requestedAt
    });
    assert.deepEqual(calls.nutrition[0].types, [
      "hydration_entry",
      "activity_reference"
    ]);
    assert.deepEqual(calls.nutrition[0].recordStatuses, ["active"]);
    assert.equal(calls.nutrition[0].includeAiDrafts, false);
  });

  await test("Serbest metin ancak veri sınıfı ve ayrı izin birlikte seçilince geçer", async () => {
    const { context } = createRuntime();
    const noText = await context.TodayAIContextSources.collectEvents({
      consent: createConsent({
        coreClasses: ["daily-choice", "note"],
        healthClasses: ["symptoms"]
      }),
      window: windowRequest,
      requestedAt
    });
    assert.equal(JSON.stringify(noText).includes("SENTETIK_CORE_NOTU"), false);
    assert.equal(JSON.stringify(noText).includes("SENTETIK_BELIRTI_NOTU"), false);

    const withText = await context.TodayAIContextSources.collectEvents({
      consent: createConsent({
        coreClasses: ["daily-choice", "note"],
        coreFreeText: true,
        healthClasses: ["symptoms"],
        healthFreeText: true
      }),
      window: windowRequest,
      requestedAt
    });
    assert.equal(JSON.stringify(withText).includes("SENTETIK_CORE_NOTU"), true);
    assert.equal(JSON.stringify(withText).includes("SENTETIK_BELIRTI_NOTU"), true);
  });

  await test("Sky varsayılan kapalıdır ve açıldığında yorumsuz metadata korunur", async () => {
    const { context, calls } = createRuntime();
    const off = await context.TodayAIContextSources.collectEvents({
      consent: createConsent(),
      window: windowRequest,
      requestedAt
    });
    assert.equal(off.counts.sky, 0);
    assert.equal(calls.sky.length, 0);

    const on = await context.TodayAIContextSources.collectEvents({
      consent: createConsent({ skyClasses: ["core-sky-snapshot"] }),
      window: windowRequest,
      requestedAt
    });
    const sky = on.events.find(event => event.source === "today-sky");
    assert.deepEqual(clone(sky.payload.metadata), {
      interpretation: "none",
      causalityClaim: false,
      aiProcessed: false
    });
  });

  await test("Olay sıralaması aynı girdide deterministiktir", async () => {
    const { context } = createRuntime();
    const options = {
      consent: createConsent({ skyClasses: ["core-sky-snapshot"] }),
      window: windowRequest,
      requestedAt
    };
    const first = await context.TodayAIContextSources.collectEvents(options);
    const second = await context.TodayAIContextSources.collectEvents(options);
    assert.deepEqual(clone(first), clone(second));
    const keys = clone(first.events).map(event =>
      `${event.localDate}|${event.createdAt}|${event.eventId}`
    );
    assert.deepEqual(keys, [...keys].sort());
  });

  await test("Kaynak başına olay üst sınırı Engine öncesinde uygulanır", async () => {
    const { context, calls } = createRuntime();
    const result = await context.TodayAIContextSources.collectEvents({
      consent: createConsent(),
      window: { ...windowRequest, maxEventsPerSource: 2 },
      requestedAt
    });
    assert.equal(result.counts.core <= 2, true);
    assert.equal(result.counts.health, 2);
    assert.equal(calls.health[0].limitPerType, 2);
    assert.equal(calls.nutrition[0].limit, 2);
  });

  await test("31 olaylık kaynak sınırı bugünkü uyku olayını korur", async () => {
    const { context } = createRuntime();
    const olderEnergy = Array.from({ length: 31 }, (_, index) => ({
      id: `energy-old-${String(index).padStart(2, "0")}`,
      dayKey: "2026-08-12",
      date: `2026-08-12T08:${String(index).padStart(2, "0")}:00.000Z`,
      energy: 2
    }));
    context.TodayHealthHub.listContextRecords = () => ({
      sleep: [{
        id: "sleep-today",
        dayKey: "2026-08-13",
        date: "2026-08-13T08:30:00.000Z",
        durationMinutes: 330,
        quality: "okay",
        recovery: "low"
      }],
      energy: olderEnergy,
      symptoms: [],
      workouts: []
    });

    const result = await context.TodayAIContextSources.collectEvents({
      consent: createConsent({
        coreClasses: [],
        healthClasses: ["sleep", "energy"]
      }),
      window: windowRequest,
      requestedAt
    });

    const eventIds = clone(result.events).map(event => event.eventId);
    assert.equal(result.counts.health, 31);
    assert.equal(eventIds.includes("health:sleep:sleep-today"), true);
    assert.equal(eventIds.includes("health:energy:energy-old-00"), false);
    assert.deepEqual(
      clone(result.events).map(event =>
        `${event.localDate}|${event.createdAt}|${event.eventId}`
      ),
      clone(result.events).map(event =>
        `${event.localDate}|${event.createdAt}|${event.eventId}`
      ).sort()
    );
  });

  await test("Eksik App kaynakları veri uydurmak yerine görünür uyarı üretir", async () => {
    const { context } = createRuntime();
    delete context.TodayHealthHub;
    delete context.TodayNutritionStorage;
    delete context.TodayCoreSkyLink;
    const result = await context.TodayAIContextSources.collectEvents({
      consent: createConsent({
        healthClasses: ["sleep", "hydration"],
        skyClasses: ["core-sky-snapshot"]
      }),
      window: windowRequest,
      requestedAt
    });
    assert.deepEqual(
      clone(result.warnings).map(entry => entry.reason),
      [
        "health-api-unavailable",
        "nutrition-api-unavailable",
        "source-api-unavailable"
      ]
    );
  });

  await test("İstek ve onay girdileri değiştirilmez; çıktı derin dondurulur", async () => {
    const { context } = createRuntime();
    const consent = createConsent();
    const before = JSON.stringify({ consent, windowRequest });
    const result = await context.TodayAIContextSources.collectEvents({
      consent,
      window: windowRequest,
      requestedAt
    });
    assert.equal(JSON.stringify({ consent, windowRequest }), before);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.events[0].payload), true);
  });

  await test("Health kayıt görünümü depolama anahtarlarını adaptöre sızdırmadan dışa açılır", () => {
    assert.match(healthSource, /function listContextRecords\(options = \{\}\)/);
    assert.match(healthSource, /listContextRecords,\s*\n\s*getState/);
    assert.match(healthSource, /return freezeContextCopy\(\{/);
    assert.doesNotMatch(source, /today\.health\.|WELLNESS_.*_KEY|SPORT_.*_KEY/);
  });

  await test("Gerçek Health public görünümü en yeni kayıtların değişmez kopyasını döndürür", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><div data-view='health'><div id='healthDashboard'></div></div></body></html>",
      { runScripts: "outside-only", url: "https://example.test/Today/" }
    );
    dom.window.scrollTo = () => {};
    dom.window.TodayNutritionUI = { open: async () => {} };
    dom.window.TodayNutritionLibraryUI = { open: async () => {} };
    new vm.Script(healthSource, { filename: HEALTH_SOURCE_PATH })
      .runInContext(dom.getInternalVMContext());

    dom.window.localStorage.setItem(
      "today.health.wellness.sleep.v1",
      JSON.stringify([
        {
          id: "sleep-2026-08-07",
          dayKey: "2026-08-07",
          date: "2026-08-07T08:00:00.000Z",
          durationMinutes: 420
        },
        {
          id: "sleep-2026-08-12",
          dayKey: "2026-08-12",
          date: "2026-08-12T08:00:00.000Z",
          durationMinutes: 390
        },
        {
          id: "sleep-2026-08-13",
          dayKey: "2026-08-13",
          date: "2026-08-13T08:00:00.000Z",
          durationMinutes: 330
        }
      ])
    );

    const before = dom.window.localStorage.length;
    const records = dom.window.TodayHealthHub.listContextRecords({
      startDate: "2026-08-07",
      endDate: "2026-08-13",
      limitPerType: 2
    });
    assert.equal(records.contractVersion, 1);
    assert.deepEqual(clone(records.window), {
      startDate: "2026-08-07",
      endDate: "2026-08-13",
      limitPerType: 2
    });
    assert.deepEqual(
      clone(records.sleep).map(record => record.dayKey),
      ["2026-08-12", "2026-08-13"]
    );
    assert.equal(Object.isFrozen(records), true);
    assert.equal(Object.isFrozen(records.sleep), true);
    assert.equal(dom.window.localStorage.length, before);
    dom.window.close();
  });

  const failures = results.filter(result => !result.success);
  failures.forEach(result => {
    console.error(`FAIL — ${result.name}`);
    console.error(result.error?.stack || result.error);
  });
  if (failures.length) process.exitCode = 1;
  const passed = results.length - failures.length;
  console.log(
    `NUT-017.3.2 Source Adapters: ${passed}/${results.length} başarılı`
  );
})();
