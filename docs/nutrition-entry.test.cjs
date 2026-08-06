const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {
  IDBFactory
} = require("fake-indexeddb");

const CONTRACT_PATH =
  "modules/nutrition-contracts.js";
const CALCULATION_PATH =
  "modules/nutrition-calculations.js";
const STORAGE_PATH =
  "modules/nutrition-storage.js";
const LIBRARY_PATH =
  "modules/nutrition-library.js";
const ENTRY_PATH =
  "modules/nutrition-entry.js";

const sources = Object.fromEntries(
  [
    CONTRACT_PATH,
    CALCULATION_PATH,
    STORAGE_PATH,
    LIBRARY_PATH,
    ENTRY_PATH
  ].map(path => [
    path,
    fs.readFileSync(path, "utf8")
  ])
);

const T1 = "2026-08-06T08:00:00.000Z";
const T2 = "2026-08-06T09:00:00.000Z";
const T3 = "2026-08-06T10:00:00.000Z";
const T4 = "2026-08-06T11:00:00.000Z";
const T5 = "2026-08-06T12:00:00.000Z";
const T6 = "2026-08-06T13:00:00.000Z";
const PAST = "2026-08-05T20:30:00.000Z";
const FUTURE = "2026-08-07T12:00:00.000Z";

function createRuntime(options = {}) {
  let uuidCounter = 0;
  const window = {
    indexedDB: new IDBFactory(),
    structuredClone:
      globalThis.structuredClone,
    crypto: {
      randomUUID() {
        uuidCounter += 1;
        return [
          "00000000",
          "0000",
          "4000",
          "8000",
          String(uuidCounter)
            .padStart(12, "0")
        ].join("-");
      }
    }
  };
  const context = {
    window,
    console,
    structuredClone:
      globalThis.structuredClone
  };

  if (options.loadContracts !== false) {
    vm.runInNewContext(
      sources[CONTRACT_PATH],
      context,
      { filename: CONTRACT_PATH }
    );
  }

  if (options.loadCalculations !== false) {
    vm.runInNewContext(
      sources[CALCULATION_PATH],
      context,
      { filename: CALCULATION_PATH }
    );
  }

  if (options.loadStorage !== false) {
    vm.runInNewContext(
      sources[STORAGE_PATH],
      context,
      { filename: STORAGE_PATH }
    );
  }

  if (options.loadLibrary !== false) {
    vm.runInNewContext(
      sources[LIBRARY_PATH],
      context,
      { filename: LIBRARY_PATH }
    );
  }

  vm.runInNewContext(
    sources[ENTRY_PATH],
    context,
    { filename: ENTRY_PATH }
  );

  return {
    window,
    contracts:
      window.TodayNutritionContracts,
    calculations:
      window.TodayNutritionCalculations,
    storage:
      window.TodayNutritionStorage,
    library:
      window.TodayNutritionLibrary,
    api:
      window.TodayNutritionEntry
  };
}

function clone(value) {
  return value === undefined
    ? undefined
    : JSON.parse(JSON.stringify(value));
}

function known(value, unit) {
  return {
    status: "known",
    value,
    unit,
    basis: null
  };
}

function estimated(
  value,
  unit,
  basis = "Kullanıcı tahmini"
) {
  return {
    status: "estimated",
    value,
    unit,
    basis
  };
}

function unknown(unit = null) {
  return {
    status: "unknown",
    value: null,
    unit,
    basis: null
  };
}

function confirmed(at = T4, extras = {}) {
  return {
    userInitiated: true,
    userConfirmed: true,
    at,
    ...extras
  };
}

function aiConsent(at = T4, extras = {}) {
  return {
    userRequested: true,
    userDataUseApproved: true,
    at,
    aiSource: {
      referenceId: "today-ai-request-1",
      version: "today-ai-v1"
    },
    ...extras
  };
}

function foodInput(overrides = {}) {
  return {
    foodId: "food:yogurt",
    name: "Yoğurt",
    servingBasis: known(100, "g"),
    nutrients: {
      energy: known(60, "kcal"),
      protein: known(4, "g"),
      carbohydrate: known(5, "g"),
      fat: known(3, "g")
    },
    preparation: {
      method: "plain",
      details: "Sade"
    },
    tags: ["süt ürünü"],
    constraintTags: ["Laktoz"],
    referenceSourceIds: [
      "source:user-entry"
    ],
    nutritionVersion: "user-v1",
    ...overrides
  };
}

function recipeInput(foodId, overrides = {}) {
  return {
    recipeId: "recipe:yogurt-bowl",
    name: "Yoğurt Kasesi",
    yield: known(1, "portion"),
    ingredients: [
      {
        recordId: foodId,
        amount: known(200, "g")
      }
    ],
    preparation: "mixed",
    tags: ["kahvaltı"],
    constraintTags: [],
    ...overrides
  };
}

function templateInput(recordId, overrides = {}) {
  return {
    templateId: "meal-template:morning",
    name: "Sabah Şablonu",
    mealType: "breakfast",
    items: [
      {
        recordId,
        amount: known(1, "portion")
      }
    ],
    tags: ["sabah"],
    constraintTags: [],
    ...overrides
  };
}

async function createFood(
  runtime,
  overrides = {},
  at = T1
) {
  return runtime.library.createFood(
    foodInput(overrides),
    confirmed(at)
  );
}

async function createRecipe(
  runtime,
  food,
  overrides = {},
  at = T2
) {
  return runtime.library.createRecipe(
    recipeInput(food.id, overrides),
    confirmed(at)
  );
}

async function createTemplate(
  runtime,
  recipe,
  overrides = {},
  at = T3
) {
  return runtime.library.createMealTemplate(
    templateInput(recipe.id, overrides),
    confirmed(at)
  );
}

function baseRecord(
  runtime,
  id,
  type,
  payload,
  overrides = {}
) {
  return runtime.contracts.createRecord({
    id,
    type,
    schemaVersion: 1,
    createdAt: T3,
    updatedAt: T3,
    eventAt: null,
    source: {
      kind: "manual",
      referenceId: null,
      version: null
    },
    knowledgeStatus: "known",
    recordStatus: "active",
    verificationStatus:
      "user_confirmed",
    calculationVersion: null,
    userEdited: false,
    payload,
    extensions: {},
    ...overrides
  });
}

async function createPlan(
  runtime,
  snapshotIds,
  overrides = {}
) {
  const plan = baseRecord(
    runtime,
    overrides.id || "planned-meal:1",
    "planned_meal",
    {
      plannedFor:
        overrides.plannedFor || FUTURE,
      mealType:
        overrides.mealType || "breakfast",
      itemSnapshotIds: snapshotIds,
      status:
        overrides.status || "planned",
      mealEntryId:
        overrides.mealEntryId || null
    },
    {
      eventAt:
        overrides.plannedFor || FUTURE,
      source:
        overrides.source || {
          kind: "manual",
          referenceId: null,
          version: null
        },
      knowledgeStatus:
        overrides.knowledgeStatus || "known",
      recordStatus:
        overrides.recordStatus || "active",
      verificationStatus:
        overrides.verificationStatus ||
        "user_confirmed"
    }
  );

  await runtime.storage.saveRecord(plan);
  return plan;
}

async function createLibrarySet(runtime) {
  const food = await createFood(runtime);
  const recipe = await createRecipe(
    runtime,
    food
  );
  const template = await createTemplate(
    runtime,
    recipe
  );

  return { food, recipe, template };
}

async function close(runtime) {
  runtime.storage?.close();
}

async function expectCode(promise, code) {
  await assert.rejects(
    promise,
    error => {
      assert.equal(error.todayCode, code);
      return true;
    }
  );
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test(
  "Kayıt API'si v1 kimliğiyle değişmez yayımlanıyor",
  async () => {
    const runtime = createRuntime();
    assert.equal(runtime.api.ENTRY_API_VERSION, 1);
    assert.equal(Object.isFrozen(runtime.api), true);
    await close(runtime);
  }
);

test(
  "Kayıt kural seti ve dört uzantı kimliği sürümlü",
  async () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.ENTRY_RULESET_ID,
      "today:nutrition:entry:v1"
    );
    assert.equal(
      runtime.api.ENTRY_EXTENSION_KEY,
      "today.nutrition.entry"
    );
    assert.equal(
      runtime.api.SNAPSHOT_EXTENSION_KEY,
      "today.nutrition.entry-snapshot"
    );
    assert.equal(
      runtime.api.APPROVAL_EXTENSION_KEY,
      "today.nutrition.entry-approval"
    );
    await close(runtime);
  }
);

test(
  "Öğün ve sıvı gerçek tüketim türleri ayrı tutuluyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.ENTRY_TYPES],
      ["meal_entry", "hydration_entry"]
    );
    assert.equal(
      Object.isFrozen(runtime.api.ENTRY_TYPES),
      true
    );
    await close(runtime);
  }
);

test(
  "Beş öğün türü ve kapsam kodları değişmez yayımlanıyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.MEAL_TYPES],
      [
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "other"
      ]
    );
    assert.deepEqual(
      [...runtime.api.COVERAGE_CODES],
      [
        "complete",
        "partial",
        "single_event",
        "unspecified"
      ]
    );
    await close(runtime);
  }
);

test(
  "Yaygın içecek türleri suyu içeriyor ama sözleşme genişletilebilir kalıyor",
  async () => {
    const runtime = createRuntime();
    assert.ok(
      runtime.api.COMMON_BEVERAGE_TYPES
        .includes("water")
    );
    assert.equal(
      Object.isFrozen(
        runtime.api.COMMON_BEVERAGE_TYPES
      ),
      true
    );
    await close(runtime);
  }
);

test(
  "Kayıt modülü UI, ağ, Core deposu veya silme API'si kullanmıyor",
  async () => {
    [
      "document.",
      "fetch(",
      "XMLHttpRequest",
      ".localStorage",
      "today_store_v2",
      ".deleteRecord(",
      "TodayAI",
      "TodayConnect"
    ].forEach(forbidden => {
      assert.equal(
        sources[ENTRY_PATH].includes(forbidden),
        false,
        forbidden
      );
    });
  }
);

test(
  "Modül yüklenirken IndexedDB veya tüketim kaydı oluşturmuyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      await runtime.window.indexedDB.databases(),
      []
    );
    await close(runtime);
  }
);

[
  ["sözleşme", { loadContracts: false }],
  ["hesaplama", { loadCalculations: false }],
  ["depolama", { loadStorage: false }],
  ["kütüphane", { loadLibrary: false }]
].forEach(([label, options]) => {
  test(
    `Eksik ${label} bağımlılığı açık hata koduyla duruyor`,
    async () => {
      const runtime = createRuntime(options);
      await expectCode(
        runtime.api.getSnapshot(),
        "TODAY-NUTRITION-ENTRY-001"
      );
      await close(runtime);
    }
  );
});

test(
  "Boş tüketim özeti açık sıfır kapsamı döndürüyor",
  async () => {
    const runtime = createRuntime();
    const snapshot = await runtime.api.getSnapshot();
    assert.deepEqual(clone(snapshot), {
      counts: {
        meals: 0,
        hydration: 0,
        drafts: 0
      },
      lastEntry: null
    });
    await close(runtime);
  }
);

test(
  "Boş tüketim listesi veri uydurmadan boş dönüyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      clone(await runtime.api.listEntries()),
      []
    );
    await close(runtime);
  }
);

[
  { userConfirmed: true, at: T4 },
  { userInitiated: true, at: T4 }
].forEach((confirmation, index) => {
  test(
    `Öğün kaydı eksik kullanıcı onayı biçimi ${index + 1} ile reddediliyor`,
    async () => {
      const runtime = createRuntime();
      await expectCode(
        runtime.api.logMeal(
          {
            mealType: "breakfast",
            coverage: "unspecified"
          },
          confirmation
        ),
        "TODAY-NUTRITION-ENTRY-003"
      );
      await close(runtime);
    }
  );
});

[
  { userConfirmed: true, at: T4 },
  { userInitiated: true, at: T4 }
].forEach((confirmation, index) => {
  test(
    `Sıvı kaydı eksik kullanıcı onayı biçimi ${index + 1} ile reddediliyor`,
    async () => {
      const runtime = createRuntime();
      await expectCode(
        runtime.api.logHydration(
          {
            beverageType: "water",
            amount: known(350, "ml")
          },
          confirmation
        ),
        "TODAY-NUTRITION-ENTRY-003"
      );
      await close(runtime);
    }
  );
});

test(
  "Sade mod ayrıntısız öğünü unspecified ve unknown olarak kaydediyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logMeal(
      {
        mealType: "breakfast"
      },
      confirmed(T4)
    );
    assert.equal(entry.type, "meal_entry");
    assert.equal(entry.payload.coverage, "unspecified");
    assert.equal(entry.knowledgeStatus, "unknown");
    assert.deepEqual(
      clone(entry.payload.itemSnapshotIds),
      []
    );
    await close(runtime);
  }
);

test(
  "Gerçek öğünde eventAt ile consumedAt birebir eşleşiyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logMeal(
      {
        mealType: "lunch",
        consumedAt: PAST
      },
      confirmed(T4)
    );
    assert.equal(entry.eventAt, PAST);
    assert.equal(entry.payload.consumedAt, PAST);
    await close(runtime);
  }
);

test(
  "Tüketim zamanı verilmezse açık işlem zamanı kullanılıyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logMeal(
      { mealType: "snack" },
      confirmed(T4)
    );
    assert.equal(entry.eventAt, T4);
    await close(runtime);
  }
);

test(
  "Gelecekteki plan zamanı gerçek öğün zamanı olarak kullanılamıyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.logMeal(
        {
          mealType: "dinner",
          consumedAt: FUTURE
        },
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-002"
    );
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      0
    );
    await close(runtime);
  }
);

test(
  "Öğesiz kayıt complete kapsamıyla gerçekmiş gibi gösterilemiyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.logMeal(
        {
          mealType: "breakfast",
          coverage: "complete"
        },
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-002"
    );
    await close(runtime);
  }
);

test(
  "Geçersiz öğün türü hiçbir tüketim kaydı bırakmıyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.logMeal(
        {
          mealType: "brunch"
        },
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-002"
    );
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      0
    );
    await close(runtime);
  }
);

test(
  "Özel hızlı öğe kalori veya makro istemeden anlık görüntü oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logMeal(
      {
        mealType: "lunch",
        customItems: [
          { name: "Ev yemeği" }
        ]
      },
      confirmed(T4)
    );
    const item = await runtime.storage.getRecord(
      entry.payload.itemSnapshotIds[0]
    );
    assert.equal(item.payload.itemKind, "custom");
    assert.deepEqual(clone(item.payload.nutrients), {});
    assert.deepEqual(
      clone(item.payload.amount),
      known(1, "portion")
    );
    assert.equal(item.knowledgeStatus, "unknown");
    await close(runtime);
  }
);

test(
  "Özel öğedeki bilinmeyen besin değeri sıfıra çevrilmiyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logMeal(
      {
        mealType: "dinner",
        customItems: [
          {
            name: "Çorba",
            amount: known(1, "portion"),
            nutrients: {
              energy: unknown("kcal")
            }
          }
        ]
      },
      confirmed(T4)
    );
    const item = await runtime.storage.getRecord(
      entry.payload.itemSnapshotIds[0]
    );
    assert.equal(
      item.payload.nutrients.energy.value,
      null
    );
    assert.equal(
      item.payload.nutrients.energy.status,
      "unknown"
    );
    await close(runtime);
  }
);

test(
  "Gerçek sıfır besin değeri bilinmeyenden ayrı korunuyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logMeal(
      {
        mealType: "snack",
        customItems: [
          {
            name: "Şekersiz içecek",
            nutrients: {
              carbohydrate: known(0, "g")
            }
          }
        ]
      },
      confirmed(T4)
    );
    const item = await runtime.storage.getRecord(
      entry.payload.itemSnapshotIds[0]
    );
    assert.equal(
      item.payload.nutrients.carbohydrate.value,
      0
    );
    assert.equal(
      item.payload.nutrients.carbohydrate.status,
      "known"
    );
    await close(runtime);
  }
);

test(
  "Özel öğe tahmini değerin dayanağını koruyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logMeal(
      {
        mealType: "snack",
        customItems: [
          {
            name: "Yaklaşık porsiyon",
            nutrients: {
              energy: estimated(
                180,
                "kcal",
                "Etiket tahmini"
              )
            }
          }
        ]
      },
      confirmed(T4)
    );
    const item = await runtime.storage.getRecord(
      entry.payload.itemSnapshotIds[0]
    );
    assert.equal(
      item.payload.nutrients.energy.basis,
      "Etiket tahmini"
    );
    assert.equal(entry.knowledgeStatus, "estimated");
    await close(runtime);
  }
);

test(
  "Özel öğe anlık görüntüsü tüketim kaydından ayrı nesne kalıyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logMeal(
      {
        mealType: "lunch",
        customItems: [
          { name: "Sandviç" }
        ]
      },
      confirmed(T4)
    );
    const records = await runtime.storage.queryRecords({
      limit: 10
    });
    assert.equal(records.length, 2);
    assert.deepEqual(
      records.map(record => record.type).sort(),
      ["meal_entry", "meal_item_snapshot"]
    );
    await close(runtime);
  }
);

test(
  "Kütüphane besini seçilen miktarla yeni hesaplanmış anlık görüntüye dönüşüyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const entry = await runtime.api.logMeal(
      {
        mealType: "breakfast",
        items: [
          {
            recordId: food.id,
            amount: known(200, "g")
          }
        ]
      },
      confirmed(T4)
    );
    const item = await runtime.storage.getRecord(
      entry.payload.itemSnapshotIds[0]
    );
    assert.notEqual(item.id, food.id);
    assert.equal(item.payload.referenceId, food.id);
    assert.equal(item.payload.nutrients.energy.value, 120);
    assert.equal(
      item.calculationVersion,
      "nutrition-calc-v1"
    );
    await close(runtime);
  }
);

test(
  "Kütüphane tarifinin kaynak sürümü tüketim anlık görüntüsünde korunuyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const entry = await runtime.api.logMeal(
      {
        mealType: "breakfast",
        items: [
          {
            recordId: recipe.id,
            amount: known(1, "portion")
          }
        ]
      },
      confirmed(T4)
    );
    const item = await runtime.storage.getRecord(
      entry.payload.itemSnapshotIds[0]
    );
    assert.equal(item.payload.referenceId, recipe.id);
    assert.equal(item.payload.sourceVersion, "1.0.0");
    assert.equal(
      item.extensions[
        runtime.api.SNAPSHOT_EXTENSION_KEY
      ].sourceLogicalId,
      "recipe:yogurt-bowl"
    );
    await close(runtime);
  }
);

test(
  "Sonraki kütüphane sürümü geçmiş tüketim anlık görüntüsünü değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const entry = await runtime.api.logMeal(
      {
        mealType: "breakfast",
        items: [
          {
            recordId: food.id,
            amount: known(100, "g")
          }
        ]
      },
      confirmed(T4)
    );
    const snapshotId =
      entry.payload.itemSnapshotIds[0];
    const before = clone(
      await runtime.storage.getRecord(snapshotId)
    );
    await runtime.library.updateFood(
      food.id,
      {
        nutrients: {
          energy: known(100, "kcal")
        }
      },
      confirmed(T5)
    );
    const after = clone(
      await runtime.storage.getRecord(snapshotId)
    );
    assert.deepEqual(after, before);
    await close(runtime);
  }
);

test(
  "Arşivlenmiş kütüphane kaynağı gerçek tüketim için kullanılamıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await runtime.library.archiveItem(
      food.id,
      confirmed(T2)
    );
    const before =
      (await runtime.storage.getStatus()).recordCount;
    await expectCode(
      runtime.api.logMeal(
        {
          mealType: "breakfast",
          items: [
            {
              recordId: food.id,
              amount: known(100, "g")
            }
          ]
        },
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-004"
    );
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      before
    );
    await close(runtime);
  }
);

test(
  "AI kütüphane taslağı doğrudan gerçek tüketim kaynağı olamıyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.library.saveFoodDraft(
      foodInput({
        foodId: "food:ai",
        nutrients: {
          energy: unknown("kcal")
        },
        aiSource: {
          referenceId: "proposal-food",
          version: "today-ai-v1"
        }
      }),
      aiConsent(T2)
    );
    await expectCode(
      runtime.api.logMeal(
        {
          mealType: "snack",
          items: [
            {
              recordId: draft.id,
              amount: known(100, "g")
            }
          ]
        },
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-004"
    );
    await close(runtime);
  }
);

test(
  "Uyumsuz kütüphane miktarı atomik olarak reddediliyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const before =
      (await runtime.storage.getStatus()).recordCount;
    await expectCode(
      runtime.api.logMeal(
        {
          mealType: "breakfast",
          items: [
            {
              recordId: food.id,
              amount: known(200, "ml")
            }
          ]
        },
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-005"
    );
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      before
    );
    await close(runtime);
  }
);

test(
  "Öğün şablonu türü belirtilmeden hızlı öğün oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    const entry = await runtime.api.logMeal(
      { templateId: template.id },
      confirmed(T4)
    );
    assert.equal(entry.payload.mealType, "breakfast");
    assert.equal(
      entry.extensions[
        runtime.api.ENTRY_EXTENSION_KEY
      ].captureMode,
      "template"
    );
    await close(runtime);
  }
);

test(
  "Şablondan tüketim canlı snapshot kimliğini yeniden kullanmıyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    const sourceSnapshotId =
      template.payload.itemSnapshotIds[0];
    const entry = await runtime.api.logMeal(
      { templateId: template.id },
      confirmed(T4)
    );
    assert.notEqual(
      entry.payload.itemSnapshotIds[0],
      sourceSnapshotId
    );
    const item = await runtime.storage.getRecord(
      entry.payload.itemSnapshotIds[0]
    );
    assert.equal(
      item.extensions[
        runtime.api.SNAPSHOT_EXTENSION_KEY
      ].sourceSnapshotId,
      sourceSnapshotId
    );
    await close(runtime);
  }
);

test(
  "Şablon çarpanı miktar ve besin değerini deterministik ölçekliyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    const entry = await runtime.api.logMeal(
      {
        templateId: template.id,
        templateMultiplier: 2
      },
      confirmed(T4)
    );
    const item = await runtime.storage.getRecord(
      entry.payload.itemSnapshotIds[0]
    );
    assert.equal(item.payload.amount.value, 2);
    assert.equal(item.payload.nutrients.energy.value, 240);
    await close(runtime);
  }
);

test(
  "Şablon tüketimi kaynak şablon ve snapshot içeriğini değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    const sourceSnapshotId =
      template.payload.itemSnapshotIds[0];
    const before = clone(
      await runtime.storage.getRecord(sourceSnapshotId)
    );
    await runtime.api.logMeal(
      {
        templateId: template.id,
        templateMultiplier: 3
      },
      confirmed(T4)
    );
    assert.deepEqual(
      clone(await runtime.storage.getRecord(sourceSnapshotId)),
      before
    );
    assert.deepEqual(
      clone(await runtime.library.getItem(template.id)),
      clone(template)
    );
    await close(runtime);
  }
);

[
  0,
  -1,
  Number.NaN
].forEach((multiplier, index) => {
  test(
    `Geçersiz şablon çarpanı ${index + 1} hiçbir tüketim kaydı bırakmıyor`,
    async () => {
      const runtime = createRuntime();
      const { template } =
        await createLibrarySet(runtime);
      const before =
        (await runtime.storage.getStatus()).recordCount;
      await expectCode(
        runtime.api.logMeal(
          {
            templateId: template.id,
            templateMultiplier: multiplier
          },
          confirmed(T4)
        ),
        "TODAY-NUTRITION-ENTRY-002"
      );
      assert.equal(
        (await runtime.storage.getStatus()).recordCount,
        before
      );
      await close(runtime);
    }
  );
});

test(
  "Şablon kimliği olmadan şablon çarpanı kullanılamıyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.logMeal(
        {
          mealType: "breakfast",
          templateMultiplier: 2
        },
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-002"
    );
    await close(runtime);
  }
);

test(
  "Karma hızlı öğün şablon, kütüphane ve özel öğeyi ayrı snapshotlarla koruyor",
  async () => {
    const runtime = createRuntime();
    const { food, template } =
      await createLibrarySet(runtime);
    const entry = await runtime.api.logMeal(
      {
        templateId: template.id,
        items: [
          {
            recordId: food.id,
            amount: known(50, "g")
          }
        ],
        customItems: [
          { name: "Ek notlu yiyecek" }
        ]
      },
      confirmed(T4)
    );
    assert.equal(entry.payload.itemSnapshotIds.length, 3);
    assert.equal(
      entry.extensions[
        runtime.api.ENTRY_EXTENSION_KEY
      ].captureMode,
      "mixed"
    );
    await close(runtime);
  }
);

test(
  "Sıvı kaydı öğünden ayrı hydration_entry nesnesi oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logHydration(
      {
        beverageType: "water",
        amount: known(350, "ml")
      },
      confirmed(T4)
    );
    assert.equal(entry.type, "hydration_entry");
    assert.equal(entry.payload.beverageType, "water");
    assert.deepEqual(
      clone(entry.payload.amount),
      known(350, "ml")
    );
    await close(runtime);
  }
);

test(
  "Sıvı eventAt ve consumedAt alanları birebir eşleşiyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logHydration(
      {
        beverageType: "tea",
        amount: known(200, "ml"),
        consumedAt: PAST
      },
      confirmed(T4)
    );
    assert.equal(entry.eventAt, PAST);
    assert.equal(entry.payload.consumedAt, PAST);
    await close(runtime);
  }
);

test(
  "Litre hacim birimi varsayımsız biçimde korunuyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logHydration(
      {
        beverageType: "water",
        amount: known(1, "l")
      },
      confirmed(T4)
    );
    assert.equal(entry.payload.amount.value, 1);
    assert.equal(entry.payload.amount.unit, "l");
    await close(runtime);
  }
);

test(
  "Özel geçerli içecek kimliği yaygın listeyle sınırlanmıyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logHydration(
      {
        beverageType: "herbal-tea",
        amount: known(250, "ml")
      },
      confirmed(T4)
    );
    assert.equal(
      entry.payload.beverageType,
      "herbal-tea"
    );
    await close(runtime);
  }
);

[
  [known(0, "ml"), "sıfır"],
  [unknown("ml"), "bilinmeyen"],
  [known(350, "g"), "kütle"],
  [known(-10, "ml"), "negatif"]
].forEach(([amount, label]) => {
  test(
    `${label} sıvı miktarı gerçek tüketim olarak kaydedilemiyor`,
    async () => {
      const runtime = createRuntime();
      await expectCode(
        runtime.api.logHydration(
          {
            beverageType: "water",
            amount
          },
          confirmed(T4)
        ),
        "TODAY-NUTRITION-ENTRY-002"
      );
      assert.equal(
        (await runtime.storage.getStatus()).recordCount,
        0
      );
      await close(runtime);
    }
  );
});

test(
  "Gelecekteki sıvı olayı plan yerine tüketim sayılamıyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.logHydration(
        {
          beverageType: "water",
          amount: known(350, "ml"),
          consumedAt: FUTURE
        },
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-002"
    );
    await close(runtime);
  }
);

test(
  "logWater su türünü tek alanla güvenli biçimde tamamlıyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logWater(
      known(350, "ml"),
      confirmed(T4)
    );
    assert.equal(entry.payload.beverageType, "water");
    assert.equal(entry.payload.amount.value, 350);
    await close(runtime);
  }
);

test(
  "Aynı istemci işlem kimliği çift öğün dokunuşunu tek kayda indiriyor",
  async () => {
    const runtime = createRuntime();
    const action = confirmed(T4, {
      clientOperationId: "quick-meal-op-1"
    });
    const first = await runtime.api.logMeal(
      { mealType: "snack" },
      action
    );
    const second = await runtime.api.logMeal(
      { mealType: "snack" },
      action
    );
    assert.equal(second.id, first.id);
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      1
    );
    await close(runtime);
  }
);

test(
  "Aynı istemci işlem kimliği çift sıvı dokunuşunu tek kayda indiriyor",
  async () => {
    const runtime = createRuntime();
    const action = confirmed(T4, {
      clientOperationId: "quick-water-op-1"
    });
    const first = await runtime.api.logWater(
      known(350, "ml"),
      action
    );
    const second = await runtime.api.logWater(
      known(350, "ml"),
      action
    );
    assert.equal(second.id, first.id);
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      1
    );
    await close(runtime);
  }
);

test(
  "Aynı işlem kimliği öğün ile sıvı arasında yeniden kullanılamıyor",
  async () => {
    const runtime = createRuntime();
    const action = confirmed(T4, {
      clientOperationId: "quick-op-shared"
    });
    await runtime.api.logMeal(
      { mealType: "snack" },
      action
    );
    await expectCode(
      runtime.api.logWater(
        known(350, "ml"),
        action
      ),
      "TODAY-NUTRITION-ENTRY-008"
    );
    await close(runtime);
  }
);

test(
  "Öğün tekrarı yeni olay ve yeni snapshot kimlikleri oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const first = await runtime.api.logMeal(
      {
        mealType: "lunch",
        customItems: [
          { name: "Sandviç" }
        ]
      },
      confirmed(T4)
    );
    const repeated = await runtime.api.repeatEntry(
      first.id,
      {},
      confirmed(T5)
    );
    assert.notEqual(repeated.id, first.id);
    assert.notEqual(
      repeated.payload.itemSnapshotIds[0],
      first.payload.itemSnapshotIds[0]
    );
    assert.equal(repeated.eventAt, T5);
    await close(runtime);
  }
);

test(
  "Öğün tekrarı geçmiş snapshot içeriğini değiştirmeden kopyalıyor",
  async () => {
    const runtime = createRuntime();
    const first = await runtime.api.logMeal(
      {
        mealType: "lunch",
        customItems: [
          {
            name: "Sandviç",
            nutrients: {
              energy: unknown("kcal")
            }
          }
        ]
      },
      confirmed(T4)
    );
    const sourceId =
      first.payload.itemSnapshotIds[0];
    const sourceBefore = clone(
      await runtime.storage.getRecord(sourceId)
    );
    const repeated = await runtime.api.repeatEntry(
      first.id,
      {},
      confirmed(T5)
    );
    const copied = await runtime.storage.getRecord(
      repeated.payload.itemSnapshotIds[0]
    );
    assert.deepEqual(
      clone(copied.payload),
      clone(sourceBefore.payload)
    );
    assert.deepEqual(
      clone(await runtime.storage.getRecord(sourceId)),
      sourceBefore
    );
    await close(runtime);
  }
);

test(
  "Tekrarlanan öğün eski plan bağlantısını taşımıyor",
  async () => {
    const runtime = createRuntime();
    const first = await runtime.api.logMeal(
      { mealType: "lunch" },
      confirmed(T4)
    );
    const repeated = await runtime.api.repeatEntry(
      first.id,
      {},
      confirmed(T5)
    );
    assert.equal(repeated.payload.plannedMealId, null);
    assert.equal(
      repeated.extensions[
        runtime.api.ENTRY_EXTENSION_KEY
      ].sourceEntryId,
      first.id
    );
    await close(runtime);
  }
);

test(
  "Sıvı tekrarı yeni olay oluşturup miktar değişikliğini açıkça alıyor",
  async () => {
    const runtime = createRuntime();
    const first = await runtime.api.logWater(
      known(350, "ml"),
      confirmed(T4)
    );
    const repeated = await runtime.api.repeatEntry(
      first.id,
      {
        amount: known(500, "ml")
      },
      confirmed(T5)
    );
    assert.notEqual(repeated.id, first.id);
    assert.equal(repeated.payload.amount.value, 500);
    assert.equal(
      repeated.extensions[
        runtime.api.ENTRY_EXTENSION_KEY
      ].sourceEntryId,
      first.id
    );
    await close(runtime);
  }
);

test(
  "AI taslağı gerçek tüketim gibi repeatEntry ile çoğaltılamıyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveHydrationDraft(
      {
        beverageType: "water",
        amount: unknown("ml")
      },
      aiConsent(T4)
    );
    await expectCode(
      runtime.api.repeatEntry(
        draft.id,
        {},
        confirmed(T5)
      ),
      "TODAY-NUTRITION-ENTRY-004"
    );
    await close(runtime);
  }
);

test(
  "Planlanan öğün genel logMeal çağrısıyla otomatik tüketilemiyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.logMeal(
        {
          mealType: "breakfast",
          plannedMealId: "planned-meal:1"
        },
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-006"
    );
    await close(runtime);
  }
);

test(
  "Plan tüketimi ayrı açık onay bayrağı olmadan çalışmıyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    await createPlan(
      runtime,
      template.payload.itemSnapshotIds
    );
    await expectCode(
      runtime.api.logPlannedMeal(
        "planned-meal:1",
        {},
        confirmed(T4)
      ),
      "TODAY-NUTRITION-ENTRY-006"
    );
    await close(runtime);
  }
);

test(
  "Açık plan tüketimi entry ve linked planı aynı atomik işlemde oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    const plan = await createPlan(
      runtime,
      template.payload.itemSnapshotIds
    );
    const entry = await runtime.api.logPlannedMeal(
      plan.id,
      {},
      confirmed(T4, {
        confirmPlanConsumption: true
      })
    );
    const linked = await runtime.storage.getRecord(
      plan.id
    );
    assert.equal(entry.payload.plannedMealId, plan.id);
    assert.equal(linked.payload.status, "linked");
    assert.equal(linked.payload.mealEntryId, entry.id);
    await close(runtime);
  }
);

test(
  "Plan tüketimi plannedFor yerine gerçek işlem zamanını kullanıyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    const plan = await createPlan(
      runtime,
      template.payload.itemSnapshotIds,
      { plannedFor: FUTURE }
    );
    const entry = await runtime.api.logPlannedMeal(
      plan.id,
      {},
      confirmed(T4, {
        confirmPlanConsumption: true
      })
    );
    assert.equal(entry.eventAt, T4);
    assert.notEqual(entry.eventAt, FUTURE);
    const linked = await runtime.storage.getRecord(plan.id);
    assert.equal(linked.eventAt, FUTURE);
    await close(runtime);
  }
);

test(
  "Plan tüketimi kaynak plan snapshot kimliklerini yeniden kullanmıyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    const plan = await createPlan(
      runtime,
      template.payload.itemSnapshotIds
    );
    const entry = await runtime.api.logPlannedMeal(
      plan.id,
      {},
      confirmed(T4, {
        confirmPlanConsumption: true
      })
    );
    assert.notEqual(
      entry.payload.itemSnapshotIds[0],
      plan.payload.itemSnapshotIds[0]
    );
    await close(runtime);
  }
);

test(
  "Bağlanmış plan ikinci kez tüketilemiyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    const plan = await createPlan(
      runtime,
      template.payload.itemSnapshotIds
    );
    await runtime.api.logPlannedMeal(
      plan.id,
      {},
      confirmed(T4, {
        confirmPlanConsumption: true
      })
    );
    await expectCode(
      runtime.api.logPlannedMeal(
        plan.id,
        {},
        confirmed(T5, {
          confirmPlanConsumption: true
        })
      ),
      "TODAY-NUTRITION-ENTRY-006"
    );
    await close(runtime);
  }
);

test(
  "Geçmiş zamanlı plan tüketimi planı değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(runtime);
    const plan = await createPlan(
      runtime,
      template.payload.itemSnapshotIds
    );
    const before = clone(
      await runtime.storage.getRecord(plan.id)
    );
    await expectCode(
      runtime.api.logPlannedMeal(
        plan.id,
        {},
        confirmed(T2, {
          confirmPlanConsumption: true
        })
      ),
      "TODAY-NUTRITION-ENTRY-002"
    );
    assert.deepEqual(
      clone(await runtime.storage.getRecord(plan.id)),
      before
    );
    await close(runtime);
  }
);

[
  { userDataUseApproved: true, at: T4 },
  { userRequested: true, at: T4 }
].forEach((consent, index) => {
  test(
    `AI öğün taslağı eksik izin biçimi ${index + 1} ile oluşturulamıyor`,
    async () => {
      const runtime = createRuntime();
      await expectCode(
        runtime.api.saveMealDraft(
          { mealType: "snack" },
          consent
        ),
        "TODAY-NUTRITION-ENTRY-007"
      );
      await close(runtime);
    }
  );
});

test(
  "AI kaynak izi olmadan tüketim taslağı oluşturulamıyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.saveMealDraft(
        { mealType: "snack" },
        {
          userRequested: true,
          userDataUseApproved: true,
          at: T4
        }
      ),
      "TODAY-NUTRITION-ENTRY-007"
    );
    await close(runtime);
  }
);

test(
  "AI öğün önerisi yalnız doğrulanmamış draft kaydı oluyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveMealDraft(
      {
        mealType: "snack",
        customItems: [
          { name: "Önerilen ara öğün" }
        ]
      },
      aiConsent(T4)
    );
    assert.equal(draft.source.kind, "ai_draft");
    assert.equal(draft.recordStatus, "draft");
    assert.equal(draft.verificationStatus, "unverified");
    assert.equal(draft.knowledgeStatus, "estimated");
    await close(runtime);
  }
);

test(
  "AI sıvı taslağı bilinmeyen miktarı sıfırlaştırmadan saklıyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveHydrationDraft(
      {
        beverageType: "water",
        amount: unknown("ml")
      },
      aiConsent(T4)
    );
    assert.equal(draft.payload.amount.status, "unknown");
    assert.equal(draft.payload.amount.value, null);
    assert.equal(draft.recordStatus, "draft");
    await close(runtime);
  }
);

test(
  "AI taslakları varsayılan gerçek tüketim listesinden dışlanıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.saveMealDraft(
      { mealType: "snack" },
      aiConsent(T4)
    );
    assert.deepEqual(
      clone(await runtime.api.listEntries()),
      []
    );
    assert.equal(
      (await runtime.api.getSnapshot()).counts.drafts,
      1
    );
    await close(runtime);
  }
);

test(
  "listDrafts yalnız AI tüketim taslaklarını döndürüyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.logWater(
      known(350, "ml"),
      confirmed(T4)
    );
    const draft = await runtime.api.saveMealDraft(
      { mealType: "snack" },
      aiConsent(T5)
    );
    const drafts = await runtime.api.listDrafts();
    assert.deepEqual(
      drafts.map(record => record.id),
      [draft.id]
    );
    await close(runtime);
  }
);

test(
  "AI taslağı genel userConfirmed ile ayrıca kabul edilmeden etkinleşmiyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveMealDraft(
      { mealType: "snack" },
      aiConsent(T4)
    );
    await expectCode(
      runtime.api.acceptDraft(
        draft.id,
        {},
        confirmed(T5)
      ),
      "TODAY-NUTRITION-ENTRY-007"
    );
    assert.equal(
      (await runtime.api.getSnapshot()).counts.meals,
      0
    );
    await close(runtime);
  }
);

test(
  "AI öğün taslağı kabul edilince ayrı manuel kayıt ve yeni snapshot oluşuyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveMealDraft(
      {
        mealType: "snack",
        customItems: [
          { name: "Meyve" }
        ]
      },
      aiConsent(T4)
    );
    const accepted = await runtime.api.acceptDraft(
      draft.id,
      {},
      confirmed(T5, {
        acceptDraft: true
      })
    );
    assert.notEqual(accepted.id, draft.id);
    assert.equal(accepted.source.kind, "manual");
    assert.equal(accepted.recordStatus, "active");
    assert.notEqual(
      accepted.payload.itemSnapshotIds[0],
      draft.payload.itemSnapshotIds[0]
    );
    await close(runtime);
  }
);

test(
  "Kabul edilen AI öğünü özgün taslak ve taslak snapshotını değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveMealDraft(
      {
        mealType: "snack",
        customItems: [
          { name: "Meyve" }
        ]
      },
      aiConsent(T4)
    );
    const draftBefore = clone(draft);
    const snapshotBefore = clone(
      await runtime.storage.getRecord(
        draft.payload.itemSnapshotIds[0],
        { includeAiDraft: true }
      )
    );
    await runtime.api.acceptDraft(
      draft.id,
      {},
      confirmed(T5, {
        acceptDraft: true
      })
    );
    assert.deepEqual(
      clone(await runtime.api.getEntry(
        draft.id,
        { includeDraft: true }
      )),
      draftBefore
    );
    assert.deepEqual(
      clone(await runtime.storage.getRecord(
        draft.payload.itemSnapshotIds[0],
        { includeAiDraft: true }
      )),
      snapshotBefore
    );
    await close(runtime);
  }
);

test(
  "AI taslak zamanı varsayılan olarak gerçek tüketim zamanına taşınmıyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveMealDraft(
      {
        mealType: "snack",
        consumedAt: PAST
      },
      aiConsent(T4)
    );
    const accepted = await runtime.api.acceptDraft(
      draft.id,
      {},
      confirmed(T5, {
        acceptDraft: true
      })
    );
    assert.equal(accepted.eventAt, T5);
    assert.notEqual(accepted.eventAt, PAST);
    await close(runtime);
  }
);

test(
  "Taslak tüketim zamanı yalnız açık useDraftConsumedAt seçimiyle kullanılıyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveMealDraft(
      {
        mealType: "snack",
        consumedAt: PAST
      },
      aiConsent(T4)
    );
    const accepted = await runtime.api.acceptDraft(
      draft.id,
      { useDraftConsumedAt: true },
      confirmed(T5, {
        acceptDraft: true
      })
    );
    assert.equal(accepted.eventAt, PAST);
    await close(runtime);
  }
);

test(
  "Bilinmeyen AI sıvı miktarı açık kullanıcı miktarı olmadan kabul edilemiyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveHydrationDraft(
      {
        beverageType: "water",
        amount: unknown("ml")
      },
      aiConsent(T4)
    );
    await expectCode(
      runtime.api.acceptDraft(
        draft.id,
        {},
        confirmed(T5, {
          acceptDraft: true
        })
      ),
      "TODAY-NUTRITION-ENTRY-002"
    );
    assert.equal(
      (await runtime.api.getSnapshot()).counts.hydration,
      0
    );
    await close(runtime);
  }
);

test(
  "AI sıvı taslağı açık kullanıcı miktarıyla ayrı gerçek kayda dönüşüyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveHydrationDraft(
      {
        beverageType: "water",
        amount: unknown("ml")
      },
      aiConsent(T4)
    );
    const accepted = await runtime.api.acceptDraft(
      draft.id,
      { amount: known(350, "ml") },
      confirmed(T5, {
        acceptDraft: true
      })
    );
    assert.equal(accepted.type, "hydration_entry");
    assert.equal(accepted.payload.amount.value, 350);
    assert.equal(accepted.source.kind, "manual");
    assert.equal(
      accepted.extensions[
        runtime.api.APPROVAL_EXTENSION_KEY
      ].draftId,
      draft.id
    );
    await close(runtime);
  }
);

test(
  "Aynı AI taslağı ikinci kez kabul edilemiyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveHydrationDraft(
      {
        beverageType: "water",
        amount: known(350, "ml")
      },
      aiConsent(T4)
    );
    await runtime.api.acceptDraft(
      draft.id,
      {},
      confirmed(T5, {
        acceptDraft: true
      })
    );
    await expectCode(
      runtime.api.acceptDraft(
        draft.id,
        {},
        confirmed(T6, {
          acceptDraft: true
        })
      ),
      "TODAY-NUTRITION-ENTRY-008"
    );
    await close(runtime);
  }
);

test(
  "Gerçek kayıt getEntry ile, taslak ise yalnız açık includeDraft ile okunuyor",
  async () => {
    const runtime = createRuntime();
    const real = await runtime.api.logWater(
      known(350, "ml"),
      confirmed(T4)
    );
    const draft = await runtime.api.saveMealDraft(
      { mealType: "snack" },
      aiConsent(T5)
    );
    assert.equal(
      (await runtime.api.getEntry(real.id)).id,
      real.id
    );
    assert.equal(
      await runtime.api.getEntry(draft.id),
      null
    );
    assert.equal(
      (await runtime.api.getEntry(
        draft.id,
        { includeDraft: true }
      )).id,
      draft.id
    );
    await close(runtime);
  }
);

test(
  "Tüketim listesi tür ve olay aralığına göre ayrıştırılıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.logMeal(
      {
        mealType: "breakfast",
        consumedAt: PAST
      },
      confirmed(T4)
    );
    const water = await runtime.api.logWater(
      known(350, "ml"),
      confirmed(T5)
    );
    const records = await runtime.api.listEntries({
      types: "hydration_entry",
      eventFrom: T4,
      eventTo: T6
    });
    assert.deepEqual(
      records.map(record => record.id),
      [water.id]
    );
    await close(runtime);
  }
);

test(
  "Geçersiz tüketim türü filtresi depoya gönderilmeden reddediliyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.listEntries({
        types: "planned_meal"
      }),
      "TODAY-NUTRITION-ENTRY-002"
    );
    await close(runtime);
  }
);

test(
  "Tüketim özeti gerçek öğün, sıvı ve taslakları karıştırmıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.logMeal(
      { mealType: "snack" },
      confirmed(T4)
    );
    const water = await runtime.api.logWater(
      known(350, "ml"),
      confirmed(T5)
    );
    await runtime.api.saveMealDraft(
      { mealType: "dinner" },
      aiConsent(T6)
    );
    const snapshot = await runtime.api.getSnapshot();
    assert.deepEqual(clone(snapshot.counts), {
      meals: 1,
      hydration: 1,
      drafts: 1
    });
    assert.equal(snapshot.lastEntry.id, water.id);
    await close(runtime);
  }
);

test(
  "Kayıt API sonuçları ve iç alanları dışarıdan değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    const entry = await runtime.api.logWater(
      known(350, "ml"),
      confirmed(T4)
    );
    const snapshot = await runtime.api.getSnapshot();
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(entry.payload), true);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.counts), true);
    await close(runtime);
  }
);

test(
  "Kayıt akışı yalnız today_nutrition deposunu kullanıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.logWater(
      known(350, "ml"),
      confirmed(T4)
    );
    const databases =
      await runtime.window.indexedDB.databases();
    assert.deepEqual(
      databases.map(item => item.name),
      ["today_nutrition"]
    );
    assert.equal(
      sources[ENTRY_PATH].includes("today_app_v10"),
      false
    );
    await close(runtime);
  }
);

test(
  "Tüm gerçek ve taslak kayıtlar NUT-001 sözleşmesinden geçiyor",
  async () => {
    const runtime = createRuntime();
    const meal = await runtime.api.logMeal(
      {
        mealType: "lunch",
        customItems: [
          { name: "Ev yemeği" }
        ]
      },
      confirmed(T4)
    );
    const water = await runtime.api.logWater(
      known(350, "ml"),
      confirmed(T5)
    );
    const draft = await runtime.api.saveMealDraft(
      { mealType: "snack" },
      aiConsent(T6)
    );
    [meal, water, draft].forEach(record => {
      assert.equal(
        runtime.contracts.validateRecord(record).valid,
        true
      );
    });
    await close(runtime);
  }
);

async function run() {
  const results = [];

  for (const entry of tests) {
    try {
      await entry.callback();
      results.push({
        name: entry.name,
        success: true
      });
    } catch (error) {
      results.push({
        name: entry.name,
        success: false,
        error:
          `${error?.stack || error?.message || error}${
            error?.todayCode
              ? ` [${error.todayCode}]`
              : ""
          }`
      });
    }
  }

  results.forEach(result => {
    const prefix = result.success
      ? "PASS"
      : "FAIL";
    const suffix = result.error
      ? ` — ${result.error}`
      : "";

    console.log(
      `${prefix}: ${result.name}${suffix}`
    );
  });

  const failed = results.filter(
    result => !result.success
  );

  console.log(
    `Nutrition Entry Tests: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run();
