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
const PROFILE_PATH =
  "modules/nutrition-profile.js";
const LIBRARY_PATH =
  "modules/nutrition-library.js";

const sources = Object.fromEntries(
  [
    CONTRACT_PATH,
    CALCULATION_PATH,
    STORAGE_PATH,
    PROFILE_PATH,
    LIBRARY_PATH
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

  if (options.loadProfile === true) {
    vm.runInNewContext(
      sources[PROFILE_PATH],
      context,
      { filename: PROFILE_PATH }
    );
  }

  vm.runInNewContext(
    sources[LIBRARY_PATH],
    context,
    { filename: LIBRARY_PATH }
  );

  return {
    window,
    contracts:
      window.TodayNutritionContracts,
    calculations:
      window.TodayNutritionCalculations,
    storage:
      window.TodayNutritionStorage,
    profile:
      window.TodayNutritionProfile,
    api:
      window.TodayNutritionLibrary
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function confirmed(at = T1) {
  return {
    userInitiated: true,
    userConfirmed: true,
    at
  };
}

function aiApproved(at = T2) {
  return {
    userRequested: true,
    userDataUseApproved: true,
    at
  };
}

function packageSource(
  referenceId = "turkomp-package",
  version = "2026.08"
) {
  return { referenceId, version };
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

function secondFoodInput(overrides = {}) {
  return foodInput({
    foodId: "food:oats",
    name: "Yulaf",
    servingBasis: known(100, "g"),
    nutrients: {
      energy: known(370, "kcal"),
      protein: known(13, "g"),
      carbohydrate: known(60, "g"),
      fat: known(7, "g")
    },
    preparation: "raw",
    tags: ["tahıl"],
    constraintTags: ["Gluten"],
    ...overrides
  });
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
    preparation: {
      method: "mixed",
      details: "Karıştır"
    },
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

async function createFood(runtime, overrides = {}, at = T1) {
  return runtime.api.createFood(
    foodInput(overrides),
    confirmed(at)
  );
}

async function createRecipe(runtime, food, overrides = {}, at = T2) {
  return runtime.api.createRecipe(
    recipeInput(food.id, overrides),
    confirmed(at)
  );
}

async function createTemplate(runtime, recipe, overrides = {}, at = T3) {
  return runtime.api.createMealTemplate(
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
    createdAt: T1,
    updatedAt: T1,
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

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test(
  "Kütüphane API'si v2 kimliğiyle değişmez yayımlanıyor",
  async () => {
    const runtime = createRuntime();
    assert.equal(runtime.api.LIBRARY_API_VERSION, 2);
    assert.equal(Object.isFrozen(runtime.api), true);
    await close(runtime);
  }
);

test(
  "Kütüphane kural seti ve uzantı kimlikleri sürümlü",
  async () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.LIBRARY_RULESET_ID,
      "today:nutrition:library:v2"
    );
    assert.equal(
      runtime.api.LIBRARY_EXTENSION_KEY,
      "today.nutrition.library"
    );
    assert.equal(
      runtime.api.SNAPSHOT_EXTENSION_KEY,
      "today.nutrition.library-snapshot"
    );
    await close(runtime);
  }
);

test(
  "Besin, tarif ve öğün şablonu kütüphane türleri ayrı tutuluyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.LIBRARY_RECORD_TYPES],
      [
        "food_version",
        "recipe_version",
        "meal_template"
      ]
    );
    assert.equal(
      Object.isFrozen(
        runtime.api.LIBRARY_RECORD_TYPES
      ),
      true
    );
    await close(runtime);
  }
);

test(
  "Kullanıcı, doğrulanmış veri paketi ve AI taslağı kaynakları karışmıyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.SOURCE_CLASSES],
      [
        "user_custom",
        "verified_data_package",
        "ai_draft"
      ]
    );
    await close(runtime);
  }
);

test(
  "Beş öğün türü değişmez yayımlanıyor",
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
    await close(runtime);
  }
);

test(
  "Kütüphane modülü UI, ağ, Core deposu veya silme API'si kullanmıyor",
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
        sources[LIBRARY_PATH].includes(forbidden),
        false,
        forbidden
      );
    });
  }
);

test(
  "Modül yüklenirken IndexedDB veya kütüphane kaydı oluşturmuyor",
  async () => {
    const runtime = createRuntime();
    const databases =
      await runtime.window.indexedDB.databases();
    assert.deepEqual(databases, []);
    await close(runtime);
  }
);

[
  ["sözleşme", { loadContracts: false }, "TODAY-NUTRITION-LIBRARY-001"],
  ["depolama", { loadStorage: false }, "TODAY-NUTRITION-LIBRARY-001"],
  ["hesaplama", { loadCalculations: false }, "TODAY-NUTRITION-LIBRARY-001"]
].forEach(([label, options, code]) => {
  test(
    `Eksik ${label} bağımlılığı açık hata koduyla duruyor`,
    async () => {
      const runtime = createRuntime(options);
      await expectCode(runtime.api.getSnapshot(), code);
      await close(runtime);
    }
  );
});

test(
  "Boş kütüphane açık sıfır kapsamı döndürüyor",
  async () => {
    const runtime = createRuntime();
    const snapshot = await runtime.api.getSnapshot();
    assert.deepEqual(clone(snapshot.counts), {
      activeFoods: 0,
      activeRecipes: 0,
      activeMealTemplates: 0,
      drafts: 0,
      historicalVersions: 0
    });
    await close(runtime);
  }
);

[
  [{ userConfirmed: true, at: T1 }],
  [{ userInitiated: true, at: T1 }]
].forEach(([confirmation], index) => {
  test(
    `Besin oluşturma eksik kullanıcı onayı biçimi ${index + 1} ile reddediliyor`,
    async () => {
      const runtime = createRuntime();
      await expectCode(
        runtime.api.createFood(
          foodInput(),
          confirmation
        ),
        "TODAY-NUTRITION-LIBRARY-003"
      );
      const snapshot = await runtime.api.getSnapshot();
      assert.equal(snapshot.counts.activeFoods, 0);
      await close(runtime);
    }
  );
});

test(
  "Kullanıcı besini sözleşmeye uygun etkin sürüm olarak oluşuyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    assert.equal(food.type, "food_version");
    assert.equal(food.recordStatus, "active");
    assert.equal(food.payload.version, "1.0.0");
    assert.equal(
      runtime.contracts.validateRecord(food).valid,
      true
    );
    await close(runtime);
  }
);

test(
  "Kullanıcı besini manuel ve kullanıcı doğrulanmış kaynağı koruyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const meta = food.extensions[
      runtime.api.LIBRARY_EXTENSION_KEY
    ];
    assert.equal(food.source.kind, "manual");
    assert.equal(
      food.verificationStatus,
      "user_confirmed"
    );
    assert.equal(meta.sourceClass, "user_custom");
    await close(runtime);
  }
);

test(
  "Besin adı yalnız kenar boşlukları temizlenerek saklanıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime, {
      name: "  Ev Yoğurdu  "
    });
    assert.equal(food.payload.name, "Ev Yoğurdu");
    await close(runtime);
  }
);

test(
  "Hazırlama biçimi ve ayrıntısı sürüm izinde korunuyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const meta = food.extensions[
      runtime.api.LIBRARY_EXTENSION_KEY
    ];
    assert.deepEqual(clone(meta.preparation), {
      method: "plain",
      details: "Sade"
    });
    await close(runtime);
  }
);

test(
  "Porsiyon temeli ve besin değeri sürümü birlikte korunuyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const meta = food.extensions[
      runtime.api.LIBRARY_EXTENSION_KEY
    ];
    assert.deepEqual(
      clone(food.payload.servingBasis),
      known(100, "g")
    );
    assert.equal(meta.nutritionVersion, "user-v1");
    await close(runtime);
  }
);

test(
  "Gerçek sıfır besin değeri sıfır olarak korunuyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime, {
      nutrients: {
        energy: known(0, "kcal")
      }
    });
    assert.equal(food.payload.nutrients.energy.value, 0);
    assert.equal(food.payload.nutrients.energy.status, "known");
    await close(runtime);
  }
);

test(
  "Bilinmeyen besin değeri sıfıra çevrilmeden saklanıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime, {
      nutrients: {
        energy: unknown("kcal")
      }
    });
    assert.equal(food.knowledgeStatus, "unknown");
    assert.equal(food.payload.nutrients.energy.value, null);
    await close(runtime);
  }
);

test(
  "Tahmini besin değeri dayanağıyla birlikte tahmini kalıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime, {
      nutrients: {
        energy: estimated(80, "kcal", "Etiket okunaksız")
      }
    });
    assert.equal(food.knowledgeStatus, "estimated");
    assert.equal(
      food.payload.nutrients.energy.basis,
      "Etiket okunaksız"
    );
    await close(runtime);
  }
);

test(
  "Boş besin değeri haritası atomik yazmayı durduruyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      createFood(runtime, { nutrients: {} }),
      "TODAY-NUTRITION-LIBRARY-002"
    );
    assert.equal(
      (await runtime.api.getSnapshot()).counts.activeFoods,
      0
    );
    await close(runtime);
  }
);

test(
  "Geçersiz porsiyon ölçümü besin kaydı bırakmıyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      createFood(runtime, {
        servingBasis: {
          status: "unknown",
          value: 0,
          unit: "g",
          basis: null
        }
      }),
      "TODAY-NUTRITION-LIBRARY-002"
    );
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      0
    );
    await close(runtime);
  }
);

test(
  "Aynı mantıksal besin kimliği ikinci kez oluşturulamıyor",
  async () => {
    const runtime = createRuntime();
    await createFood(runtime);
    await expectCode(
      createFood(runtime, {}, T2),
      "TODAY-NUTRITION-LIBRARY-004"
    );
    assert.equal(
      (await runtime.api.getSnapshot()).counts.activeFoods,
      1
    );
    await close(runtime);
  }
);

test(
  "Doğrulanmış veri paketi besini kaynağını ve paket sürümünü taşıyor",
  async () => {
    const runtime = createRuntime();
    const input = foodInput({
      foodId: "food:package-yogurt",
      referenceSourceIds: undefined,
      nutritionVersion: undefined
    });
    const food = await runtime.api.importVerifiedFood(
      input,
      packageSource(),
      confirmed()
    );
    const meta = food.extensions[
      runtime.api.LIBRARY_EXTENSION_KEY
    ];
    assert.equal(food.source.kind, "data_package");
    assert.equal(
      food.verificationStatus,
      "source_verified"
    );
    assert.equal(
      meta.sourceClass,
      "verified_data_package"
    );
    assert.equal(meta.nutritionVersion, "2026.08");
    await close(runtime);
  }
);

[
  [{ version: "1.0.0" }],
  [{ referenceId: "package-only" }]
].forEach(([source], index) => {
  test(
    `Veri paketi kaynağı eksik alan biçimi ${index + 1} ile doğrulanmış gösterilemiyor`,
    async () => {
      const runtime = createRuntime();
      await expectCode(
        runtime.api.importVerifiedFood(
          foodInput({ foodId: "food:package" }),
          source,
          confirmed()
        ),
        "TODAY-NUTRITION-LIBRARY-002"
      );
      await close(runtime);
    }
  );
});

test(
  "Besin güncellemesi yeni sürüm üretip eski sürümü superseded yapıyor",
  async () => {
    const runtime = createRuntime();
    const first = await createFood(runtime);
    const second = await runtime.api.updateFood(
      first.id,
      { name: "Yeni Yoğurt" },
      confirmed(T2)
    );
    const old = await runtime.storage.getRecord(first.id);
    assert.equal(second.payload.version, "1.0.1");
    assert.equal(old.recordStatus, "superseded");
    assert.equal(
      second.extensions[
        runtime.api.LIBRARY_EXTENSION_KEY
      ].supersedesId,
      first.id
    );
    const repeated = await runtime.api.updateFood(
      second.id,
      { name: "Yeni Yoğurt" },
      confirmed(T3)
    );
    assert.equal(repeated.id, second.id);
    assert.equal(
      (await runtime.api.getVersionHistory(second.id)).length,
      2
    );
    await close(runtime);
  }
);

test(
  "Veri paketi üzerinde kullanıcı düzenlemesi yeni manuel türev sürüm oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const first = await runtime.api.importVerifiedFood(
      foodInput({ foodId: "food:package" }),
      packageSource(),
      confirmed()
    );
    const second = await runtime.api.updateFood(
      first.id,
      { name: "Kişisel Paket Besini" },
      confirmed(T2)
    );
    const meta = second.extensions[
      runtime.api.LIBRARY_EXTENSION_KEY
    ];
    assert.equal(second.source.kind, "manual");
    assert.equal(meta.derivedFromId, first.id);
    assert.equal(meta.sourceClass, "user_custom");
    await close(runtime);
  }
);

test(
  "Yeni doğrulanmış paket sürümü doğrulanmış kaynak durumunu koruyor",
  async () => {
    const runtime = createRuntime();
    const first = await runtime.api.importVerifiedFood(
      foodInput({ foodId: "food:package" }),
      packageSource(),
      confirmed()
    );
    const second = await runtime.api.importVerifiedFoodVersion(
      first.id,
      foodInput({
        foodId: undefined,
        name: "Paket Besini 2",
        nutritionVersion: undefined,
        referenceSourceIds: undefined
      }),
      packageSource("turkomp-package", "2026.09"),
      confirmed(T2)
    );
    assert.equal(second.source.kind, "data_package");
    assert.equal(
      second.verificationStatus,
      "source_verified"
    );
    assert.equal(
      second.extensions[
        runtime.api.LIBRARY_EXTENSION_KEY
      ].nutritionVersion,
      "2026.09"
    );
    await close(runtime);
  }
);

test(
  "Besin sürüm geçmişi güncelden eskiye doğru sıralanıyor",
  async () => {
    const runtime = createRuntime();
    const first = await createFood(runtime);
    const second = await runtime.api.updateFood(
      first.id,
      { name: "v2" },
      confirmed(T2)
    );
    const third = await runtime.api.updateFood(
      second.id,
      { name: "v3" },
      confirmed(T3)
    );
    const history = await runtime.api.getVersionHistory(third.id);
    assert.deepEqual(
      history.map(record => record.payload.version),
      ["1.0.2", "1.0.1", "1.0.0"]
    );
    await close(runtime);
  }
);

test(
  "Geçmiş besin sürümü güncel sürüm değişince içerik olarak değişmiyor",
  async () => {
    const runtime = createRuntime();
    const first = await createFood(runtime);
    const before = clone(first.payload);
    await runtime.api.updateFood(
      first.id,
      {
        nutrients: {
          energy: known(100, "kcal")
        }
      },
      confirmed(T2)
    );
    const old = await runtime.storage.getRecord(first.id);
    assert.deepEqual(clone(old.payload), before);
    await close(runtime);
  }
);

test(
  "Geçmiş zamanlı besin güncellemesi etkin sürümü değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const first = await createFood(runtime, {}, T2);
    await expectCode(
      runtime.api.updateFood(
        first.id,
        { name: "Geçmiş" },
        confirmed(T1)
      ),
      "TODAY-NUTRITION-LIBRARY-002"
    );
    assert.equal(
      (await runtime.api.getItem(first.id)).recordStatus,
      "active"
    );
    await close(runtime);
  }
);

test(
  "Besin hesabı yalnız doğrulanmış sürümden deterministik sonuç üretiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const calculation = await runtime.api.calculateItem(
      food.id,
      known(200, "g")
    );
    assert.equal(calculation.kind, "food");
    assert.equal(
      calculation.calculationVersion,
      "nutrition-calc-v1"
    );
    assert.equal(calculation.nutrients.energy.value, 120);
    await close(runtime);
  }
);

test(
  "Besin hesabında bilinmeyen değer sıfır katkıya dönüşmüyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime, {
      nutrients: {
        energy: unknown("kcal")
      }
    });
    const calculation = await runtime.api.calculateItem(
      food.id,
      known(200, "g")
    );
    assert.equal(calculation.nutrients.energy.status, "unknown");
    assert.equal(calculation.nutrients.energy.value, null);
    await close(runtime);
  }
);

test(
  "Uyumsuz hacim miktarı kütle porsiyonuna varsayımla çevrilmiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await expectCode(
      runtime.api.calculateItem(
        food.id,
        known(200, "ml")
      ),
      "TODAY-NUTRITION-LIBRARY-005"
    );
    await close(runtime);
  }
);

test(
  "Arşivlenen besin silinmeden etkin kütüphaneden ayrılıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const archived = await runtime.api.archiveItem(
      food.id,
      confirmed(T2)
    );
    const snapshot = await runtime.api.getSnapshot();
    assert.equal(archived.recordStatus, "archived");
    assert.equal(snapshot.counts.activeFoods, 0);
    assert.equal(snapshot.counts.historicalVersions, 1);
    assert.ok(await runtime.storage.getRecord(food.id));
    await close(runtime);
  }
);

test(
  "Arşivlenen sürüm ikinci kez arşivlenemiyor veya hesaplanamıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await runtime.api.archiveItem(food.id, confirmed(T2));
    await expectCode(
      runtime.api.archiveItem(food.id, confirmed(T3)),
      "TODAY-NUTRITION-LIBRARY-004"
    );
    await expectCode(
      runtime.api.calculateItem(food.id, known(100, "g")),
      "TODAY-NUTRITION-LIBRARY-005"
    );
    await close(runtime);
  }
);

test(
  "Arşiv geri alma açık kullanıcı onayı olmadan çalışmıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await runtime.api.archiveItem(
      food.id,
      confirmed(T2)
    );
    await expectCode(
      runtime.api.restoreItem(
        food.id,
        {
          userInitiated: true,
          at: T3
        }
      ),
      "TODAY-NUTRITION-LIBRARY-003"
    );
    await close(runtime);
  }
);

test(
  "Arşivlenen besin aynı kimlikle yeniden etkinleştiriliyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await runtime.api.archiveItem(
      food.id,
      confirmed(T2)
    );
    const restored =
      await runtime.api.restoreItem(
        food.id,
        confirmed(T3)
      );
    const snapshot =
      await runtime.api.getSnapshot();

    assert.equal(restored.id, food.id);
    assert.equal(
      restored.recordStatus,
      "active"
    );
    assert.equal(
      snapshot.counts.activeFoods,
      1
    );
    assert.equal(
      snapshot.counts.historicalVersions,
      0
    );
    await close(runtime);
  }
);

test(
  "Etkin kütüphane kaydı geri alma işlemine giremiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await expectCode(
      runtime.api.restoreItem(
        food.id,
        confirmed(T2)
      ),
      "TODAY-NUTRITION-LIBRARY-004"
    );
    await close(runtime);
  }
);

test(
  "Geri alınan besin yeniden deterministik hesaplamaya girebiliyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await runtime.api.archiveItem(
      food.id,
      confirmed(T2)
    );
    await runtime.api.restoreItem(
      food.id,
      confirmed(T3)
    );
    const calculation =
      await runtime.api.calculateItem(
        food.id,
        known(200, "g")
      );

    assert.equal(
      calculation.nutrients.energy.value,
      120
    );
    await close(runtime);
  }
);

test(
  "Tarif arşivden dönerken bileşen anlık görüntüsü değişmiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe =
      await createRecipe(runtime, food);
    const snapshotId =
      recipe.payload.ingredientSnapshotIds[0];
    const before = clone(
      await runtime.storage.getRecord(
        snapshotId
      )
    );

    await runtime.api.archiveItem(
      recipe.id,
      confirmed(T3)
    );
    await runtime.api.restoreItem(
      recipe.id,
      confirmed(T4)
    );
    const after = clone(
      await runtime.storage.getRecord(
        snapshotId
      )
    );

    assert.deepEqual(after, before);
    await close(runtime);
  }
);

test(
  "Tarif doğrulanmış besinden atomik bileşen anlık görüntüsü oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const snapshotId = recipe.payload.ingredientSnapshotIds[0];
    const item = await runtime.storage.getRecord(snapshotId);
    assert.equal(item.type, "meal_item_snapshot");
    assert.equal(item.payload.referenceId, food.id);
    assert.equal(item.payload.sourceVersion, "1.0.0");
    assert.equal(item.calculationVersion, "nutrition-calc-v1");
    await close(runtime);
  }
);

test(
  "Tarif bileşeni miktarı ve hesaplanmış besin değerini anlık görüntüde koruyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const item = await runtime.storage.getRecord(
      recipe.payload.ingredientSnapshotIds[0]
    );
    assert.deepEqual(clone(item.payload.amount), known(200, "g"));
    assert.equal(item.payload.nutrients.energy.value, 120);
    await close(runtime);
  }
);

test(
  "Tarif sürümü hazırlama biçimi ve hesaplama sürümünü koruyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const meta = recipe.extensions[
      runtime.api.LIBRARY_EXTENSION_KEY
    ];
    assert.equal(meta.preparation.method, "mixed");
    assert.equal(meta.nutritionVersion, "nutrition-calc-v1");
    await close(runtime);
  }
);

test(
  "Tarif kısıt etiketlerini bileşenlerden açıklanabilir biçimde devralıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const tags = recipe.extensions[
      runtime.api.LIBRARY_EXTENSION_KEY
    ].constraintTags;
    assert.deepEqual(clone(tags), ["Laktoz"]);
    await close(runtime);
  }
);

test(
  "Tarif hesabı bileşen anlık görüntüsünden deterministik sonuç üretiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const calculation = await runtime.api.calculateItem(
      recipe.id,
      known(2, "portion")
    );
    assert.equal(calculation.kind, "recipe");
    assert.equal(calculation.nutrients.energy.value, 240);
    assert.equal(calculation.usedRecordIds[0], recipe.id);
    await close(runtime);
  }
);

test(
  "Tarif oluşturma kullanıcı onayı olmadan hiçbir anlık görüntü bırakmıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await expectCode(
      runtime.api.createRecipe(
        recipeInput(food.id),
        { userInitiated: true, at: T2 }
      ),
      "TODAY-NUTRITION-LIBRARY-003"
    );
    const status = await runtime.storage.getStatus();
    assert.equal(status.recordCount, 1);
    await close(runtime);
  }
);

test(
  "Eksik besin referansı tarif ve kısmi anlık görüntü bırakmıyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.createRecipe(
        recipeInput("food-version:missing"),
        confirmed(T2)
      ),
      "TODAY-NUTRITION-LIBRARY-005"
    );
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      0
    );
    await close(runtime);
  }
);

test(
  "Uyumsuz tarif bileşeni miktarı atomik olarak reddediliyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await expectCode(
      runtime.api.createRecipe(
        recipeInput(food.id, {
          ingredients: [
            {
              recordId: food.id,
              amount: known(1, "liter")
            }
          ]
        }),
        confirmed(T2)
      ),
      "TODAY-NUTRITION-LIBRARY-005"
    );
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      1
    );
    await close(runtime);
  }
);

test(
  "Birden fazla tarif bileşeni kaynak sırasını aynen koruyor",
  async () => {
    const runtime = createRuntime();
    const yogurt = await createFood(runtime);
    const oats = await runtime.api.createFood(
      secondFoodInput(),
      confirmed(T2)
    );
    const recipe = await runtime.api.createRecipe(
      recipeInput(yogurt.id, {
        ingredients: [
          { recordId: oats.id, amount: known(50, "g") },
          { recordId: yogurt.id, amount: known(200, "g") }
        ]
      }),
      confirmed(T3)
    );
    const snapshots = await Promise.all(
      recipe.payload.ingredientSnapshotIds.map(id =>
        runtime.storage.getRecord(id)
      )
    );
    assert.deepEqual(
      snapshots.map(item => item.payload.referenceId),
      [oats.id, yogurt.id]
    );
    await close(runtime);
  }
);

test(
  "Tarif güncellemesi yeni tarif ve yeni bileşen anlık görüntüsü üretir",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const first = await createRecipe(runtime, food);
    const second = await runtime.api.updateRecipe(
      first.id,
      { name: "Güncel Kase" },
      confirmed(T3)
    );
    const old = await runtime.storage.getRecord(first.id);
    assert.equal(second.payload.version, "1.0.1");
    assert.equal(old.recordStatus, "superseded");
    assert.notEqual(
      second.payload.ingredientSnapshotIds[0],
      first.payload.ingredientSnapshotIds[0]
    );
    const repeated = await runtime.api.updateRecipe(
      second.id,
      { name: "Güncel Kase" },
      confirmed(T4)
    );
    assert.equal(repeated.id, second.id);
    assert.equal(
      (await runtime.api.getVersionHistory(second.id)).length,
      2
    );
    await close(runtime);
  }
);

test(
  "Besin güncellense bile geçmiş tarif anlık görüntüsü değişmiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const snapshotId = recipe.payload.ingredientSnapshotIds[0];
    const before = await runtime.storage.getRecord(snapshotId);
    await runtime.api.updateFood(
      food.id,
      {
        nutrients: {
          energy: known(999, "kcal")
        }
      },
      confirmed(T3)
    );
    const after = await runtime.storage.getRecord(snapshotId);
    assert.deepEqual(clone(after), clone(before));
    await close(runtime);
  }
);

test(
  "Tarif güncellense bile eski tarif bileşen anlık görüntüleri silinmiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const first = await createRecipe(runtime, food);
    const snapshotId = first.payload.ingredientSnapshotIds[0];
    await runtime.api.updateRecipe(
      first.id,
      { name: "Yeni Tarif" },
      confirmed(T3)
    );
    assert.ok(await runtime.storage.getRecord(snapshotId));
    await close(runtime);
  }
);

test(
  "Doğrulanmış paket tarifi kaynak sınıfını kullanıcı tarifi gibi göstermiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await runtime.api.importVerifiedRecipe(
      recipeInput(food.id, {
        recipeId: "recipe:package"
      }),
      packageSource("recipe-pack", "3.2.0"),
      confirmed(T2)
    );
    assert.equal(recipe.source.kind, "data_package");
    assert.equal(
      recipe.extensions[
        runtime.api.LIBRARY_EXTENSION_KEY
      ].sourceClass,
      "verified_data_package"
    );
    await close(runtime);
  }
);

test(
  "Doğrulanmış tarif başka tarifte sürümlü bileşen olabilir",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const baseRecipe = await createRecipe(runtime, food);
    const nested = await runtime.api.createRecipe(
      {
        recipeId: "recipe:nested",
        name: "İkili Kase",
        yield: known(1, "portion"),
        ingredients: [
          {
            recordId: baseRecipe.id,
            amount: known(1, "portion")
          }
        ],
        preparation: "assembled"
      },
      confirmed(T3)
    );
    const result = await runtime.api.calculateItem(
      nested.id,
      known(1, "portion")
    );
    assert.equal(result.nutrients.energy.value, 120);
    await close(runtime);
  }
);

test(
  "Öğün şablonu tarif sürümünü yeni anlık görüntüyle sabitliyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const template = await createTemplate(runtime, recipe);
    const item = await runtime.storage.getRecord(
      template.payload.itemSnapshotIds[0]
    );
    assert.equal(template.type, "meal_template");
    assert.equal(item.payload.itemKind, "recipe_version");
    assert.equal(item.payload.referenceId, recipe.id);
    await close(runtime);
  }
);

test(
  "Öğün şablonu yemek türünü ve kaynak kısıt etiketini koruyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const template = await createTemplate(runtime, recipe);
    const meta = template.extensions[
      runtime.api.LIBRARY_EXTENSION_KEY
    ];
    assert.equal(template.payload.mealType, "breakfast");
    assert.deepEqual(clone(meta.constraintTags), ["Laktoz"]);
    await close(runtime);
  }
);

test(
  "Geçersiz öğün türü şablon veya anlık görüntü bırakmıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const before = (await runtime.storage.getStatus()).recordCount;
    await expectCode(
      runtime.api.createMealTemplate(
        templateInput(recipe.id, {
          mealType: "brunch"
        }),
        confirmed(T3)
      ),
      "TODAY-NUTRITION-LIBRARY-002"
    );
    assert.equal(
      (await runtime.storage.getStatus()).recordCount,
      before
    );
    await close(runtime);
  }
);

test(
  "Şablon oluşturma açık kullanıcı onayı olmadan çalışmıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    await expectCode(
      runtime.api.createMealTemplate(
        templateInput(recipe.id),
        { userConfirmed: true, at: T3 }
      ),
      "TODAY-NUTRITION-LIBRARY-003"
    );
    await close(runtime);
  }
);

test(
  "Öğün şablonu güncellemesi eski şablonu silmeden sürümler",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const first = await createTemplate(runtime, recipe);
    const second = await runtime.api.updateMealTemplate(
      first.id,
      { mealType: "snack", name: "Ara Öğün" },
      confirmed(T4)
    );
    assert.equal(second.payload.mealType, "snack");
    assert.equal(
      (await runtime.storage.getRecord(first.id)).recordStatus,
      "superseded"
    );
    assert.equal(
      (await runtime.api.getVersionHistory(second.id)).length,
      2
    );
    await close(runtime);
  }
);

test(
  "Şablon güncellemesi eski şablon anlık görüntüsünü değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const first = await createTemplate(runtime, recipe);
    const snapshotId = first.payload.itemSnapshotIds[0];
    const before = await runtime.storage.getRecord(snapshotId);
    await runtime.api.updateMealTemplate(
      first.id,
      { name: "Yeni Şablon" },
      confirmed(T4)
    );
    const after = await runtime.storage.getRecord(snapshotId);
    assert.deepEqual(clone(after), clone(before));
    await close(runtime);
  }
);

test(
  "Kütüphane özeti etkin öğeleri türlerine göre ayırıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    await createTemplate(runtime, recipe);
    const snapshot = await runtime.api.getSnapshot();
    assert.deepEqual(clone(snapshot.counts), {
      activeFoods: 1,
      activeRecipes: 1,
      activeMealTemplates: 1,
      drafts: 0,
      historicalVersions: 0
    });
    await close(runtime);
  }
);

test(
  "Kütüphane özeti ve iç kayıtları dışarıdan değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    await createFood(runtime);
    const snapshot = await runtime.api.getSnapshot();
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.foods), true);
    assert.equal(Object.isFrozen(snapshot.foods[0]), true);
    await close(runtime);
  }
);

test(
  "Önceden alınan kütüphane özeti sonraki yazımdan etkilenmiyor",
  async () => {
    const runtime = createRuntime();
    const before = await runtime.api.getSnapshot();
    await createFood(runtime);
    assert.equal(before.counts.activeFoods, 0);
    await close(runtime);
  }
);

[
  [{ userDataUseApproved: true, at: T2 }],
  [{ userRequested: true, at: T2 }]
].forEach(([consent], index) => {
  test(
    `AI besin taslağı eksik izin biçimi ${index + 1} ile kaydedilmiyor`,
    async () => {
      const runtime = createRuntime();
      await expectCode(
        runtime.api.saveFoodDraft(
          {
            ...foodInput({ foodId: "food:ai" }),
            nutrients: undefined,
            aiSource: {
              referenceId: "today-ai-engine",
              version: "1.0.0"
            }
          },
          consent
        ),
        "TODAY-NUTRITION-LIBRARY-007"
      );
      await close(runtime);
    }
  );
});

test(
  "AI besin taslağı eksik değerleri unknown olarak saklıyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveFoodDraft(
      {
        ...foodInput({ foodId: "food:ai" }),
        nutrients: undefined,
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved()
    );
    assert.equal(draft.source.kind, "ai_draft");
    assert.equal(draft.recordStatus, "draft");
    assert.equal(draft.knowledgeStatus, "estimated");
    Object.values(draft.payload.nutrients).forEach(value => {
      assert.equal(value.status, "unknown");
      assert.equal(value.value, null);
    });
    await close(runtime);
  }
);

test(
  "AI bilinen besin değeri uydurarak taslak kaydedemiyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.saveFoodDraft(
        {
          ...foodInput({ foodId: "food:ai" }),
          nutrients: {
            energy: known(100, "kcal")
          },
          aiSource: {
            referenceId: "today-ai-engine",
            version: "1.0.0"
          }
        },
        aiApproved()
      ),
      "TODAY-NUTRITION-LIBRARY-007"
    );
    await close(runtime);
  }
);

test(
  "AI taslağı varsayılan etkin kütüphane listesine karışmıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.saveFoodDraft(
      {
        ...foodInput({ foodId: "food:ai" }),
        nutrients: undefined,
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved()
    );
    const snapshot = await runtime.api.getSnapshot();
    assert.equal(snapshot.foods.length, 0);
    assert.equal(snapshot.drafts.length, 1);
    assert.equal(snapshot.counts.drafts, 1);
    await close(runtime);
  }
);

test(
  "Tekil kütüphane okuması AI taslağını varsayılan olarak gizliyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveFoodDraft(
      {
        ...foodInput({ foodId: "food:ai" }),
        nutrients: undefined,
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved()
    );
    assert.equal(await runtime.api.getItem(draft.id), null);
    assert.equal(
      (await runtime.api.getItem(draft.id, {
        includeDraft: true
      })).id,
      draft.id
    );
    await close(runtime);
  }
);

test(
  "AI taslağı deterministik hesaplamaya doğrulanmış kaynak gibi giremiyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveFoodDraft(
      {
        ...foodInput({ foodId: "food:ai" }),
        nutrients: undefined,
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved()
    );
    await expectCode(
      runtime.api.calculateItem(draft.id, known(100, "g")),
      "TODAY-NUTRITION-LIBRARY-005"
    );
    await close(runtime);
  }
);

test(
  "AI taslağı açık kullanıcı onayı olmadan kabul edilmiyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveFoodDraft(
      {
        ...foodInput({ foodId: "food:ai" }),
        nutrients: undefined,
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved()
    );
    await expectCode(
      runtime.api.acceptDraft(
        draft.id,
        {},
        { userInitiated: true, at: T3 }
      ),
      "TODAY-NUTRITION-LIBRARY-003"
    );
    await close(runtime);
  }
);

test(
  "Kabul edilen AI besin taslağı yeni manuel kullanıcı kaydı oluyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveFoodDraft(
      {
        ...foodInput({ foodId: "food:ai" }),
        nutrients: undefined,
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved()
    );
    const accepted = await runtime.api.acceptDraft(
      draft.id,
      {
        nutrients: {
          energy: known(75, "kcal")
        }
      },
      confirmed(T3)
    );
    assert.equal(accepted.source.kind, "manual");
    assert.equal(accepted.recordStatus, "active");
    assert.equal(
      accepted.payload.nutrients.energy.value,
      75
    );
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
  "Kabul edilen AI taslağı özgün taslak kaydını değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveFoodDraft(
      {
        ...foodInput({ foodId: "food:ai" }),
        nutrients: undefined,
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved()
    );
    const before = clone(draft);
    await runtime.api.acceptDraft(
      draft.id,
      {},
      confirmed(T3)
    );
    const after = await runtime.storage.getRecord(
      draft.id,
      { includeAiDraft: true }
    );
    assert.deepEqual(clone(after), before);
    await close(runtime);
  }
);

test(
  "Aynı AI taslağı ikinci kez etkin kütüphane kaydı yapılamıyor",
  async () => {
    const runtime = createRuntime();
    const draft = await runtime.api.saveFoodDraft(
      {
        ...foodInput({ foodId: "food:ai" }),
        nutrients: undefined,
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved()
    );
    await runtime.api.acceptDraft(
      draft.id,
      {},
      confirmed(T3)
    );
    await expectCode(
      runtime.api.acceptDraft(
        draft.id,
        {},
        confirmed(T4)
      ),
      "TODAY-NUTRITION-LIBRARY-004"
    );
    await close(runtime);
  }
);

test(
  "AI tarif taslağı yalnız doğrulanmış yerel bileşenlerden değer üretir",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const draft = await runtime.api.saveRecipeDraft(
      {
        ...recipeInput(food.id, {
          recipeId: "recipe:ai"
        }),
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved(T2)
    );
    const item = await runtime.storage.getRecord(
      draft.payload.ingredientSnapshotIds[0]
    );
    assert.equal(draft.recordStatus, "draft");
    assert.equal(item.recordStatus, "draft");
    assert.equal(item.payload.nutrients.energy.value, 120);
    await close(runtime);
  }
);

test(
  "AI tarif taslağı kabul edildiğinde yeni anlık görüntüler oluşturuluyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const draft = await runtime.api.saveRecipeDraft(
      {
        ...recipeInput(food.id, {
          recipeId: "recipe:ai"
        }),
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved(T2)
    );
    const accepted = await runtime.api.acceptDraft(
      draft.id,
      {},
      confirmed(T3)
    );
    assert.notDeepEqual(
      accepted.payload.ingredientSnapshotIds,
      draft.payload.ingredientSnapshotIds
    );
    assert.equal(accepted.source.kind, "manual");
    await close(runtime);
  }
);

test(
  "AI öğün şablonu taslağı kabul edilmeden etkin şablona karışmıyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const draft = await runtime.api.saveMealTemplateDraft(
      {
        ...templateInput(recipe.id, {
          templateId: "meal-template:ai"
        }),
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved(T3)
    );
    const snapshot = await runtime.api.getSnapshot();
    assert.equal(snapshot.mealTemplates.length, 0);
    assert.equal(draft.recordStatus, "draft");
    await close(runtime);
  }
);

test(
  "AI öğün şablonu taslağı açık onayla ayrı manuel şablona dönüşüyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const draft = await runtime.api.saveMealTemplateDraft(
      {
        ...templateInput(recipe.id, {
          templateId: "meal-template:ai"
        }),
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved(T3)
    );
    const accepted = await runtime.api.acceptDraft(
      draft.id,
      { name: "Onaylı Sabah" },
      confirmed(T4)
    );
    assert.equal(accepted.payload.name, "Onaylı Sabah");
    assert.equal(accepted.source.kind, "manual");
    assert.equal(
      (await runtime.api.getSnapshot()).mealTemplates.length,
      1
    );
    await close(runtime);
  }
);

test(
  "AI güncelleme taslağı dayandığı sürümü izlenebilir biçimde koruyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const draft = await runtime.api.saveFoodDraft(
      {
        ...foodInput({
          baseRecordId: food.id,
          foodId: undefined,
          nutrients: undefined,
          name: "AI Önerisi"
        }),
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved(T2)
    );
    const meta = draft.extensions[
      runtime.api.LIBRARY_EXTENSION_KEY
    ];
    assert.equal(meta.baseRecordId, food.id);
    assert.equal(meta.version, "1.0.1");
    await close(runtime);
  }
);

test(
  "Güncel sürüm değiştiyse eski AI güncelleme taslağı sessizce kabul edilmiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const draft = await runtime.api.saveFoodDraft(
      {
        ...foodInput({
          baseRecordId: food.id,
          foodId: undefined,
          nutrients: undefined
        }),
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved(T2)
    );
    await runtime.api.updateFood(
      food.id,
      { name: "Kullanıcı Güncelledi" },
      confirmed(T3)
    );
    await expectCode(
      runtime.api.acceptDraft(
        draft.id,
        {},
        confirmed(T4)
      ),
      "TODAY-NUTRITION-LIBRARY-004"
    );
    await close(runtime);
  }
);

test(
  "AI taslak listesi kayıt türüne göre filtreleniyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await runtime.api.saveFoodDraft(
      {
        ...foodInput({ foodId: "food:ai", nutrients: undefined }),
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved(T2)
    );
    await runtime.api.saveRecipeDraft(
      {
        ...recipeInput(food.id, { recipeId: "recipe:ai" }),
        aiSource: {
          referenceId: "today-ai-engine",
          version: "1.0.0"
        }
      },
      aiApproved(T3)
    );
    const foods = await runtime.api.listDrafts({
      type: "food_version"
    });
    const recipes = await runtime.api.listDrafts({
      type: "recipe_version"
    });
    assert.equal(foods.length, 1);
    assert.equal(recipes.length, 1);
    await close(runtime);
  }
);

test(
  "Profil kısıtı kütüphane kaydını engellemeden açıklanabilir uyarı üretir",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const warnings = await runtime.api.getConstraintWarnings(
      food.id,
      {
        activeConstraints: [
          {
            id: "constraint:lactose",
            category: "intolerance",
            label: "Laktoz"
          }
        ]
      }
    );
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].blocking, false);
    assert.equal(warnings[0].matchedTag, "Laktoz");
    assert.equal(
      (await runtime.api.getItem(food.id)).recordStatus,
      "active"
    );
    await close(runtime);
  }
);

test(
  "Profil etiketi Türkçe büyük-küçük harf farkından etkilenmeden eşleşiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime, {
      constraintTags: ["İNEK SÜTÜ"]
    });
    const warnings = await runtime.api.getConstraintWarnings(
      food.id,
      {
        activeConstraints: [
          {
            id: "constraint:milk",
            category: "allergy",
            label: "inek sütü"
          }
        ]
      }
    );
    assert.equal(warnings.length, 1);
    await close(runtime);
  }
);

test(
  "Eşleşmeyen profil kısıtı yanlış uyarı üretmiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const warnings = await runtime.api.getConstraintWarnings(
      food.id,
      {
        activeConstraints: [
          {
            id: "constraint:peanut",
            category: "allergy",
            label: "Yer fıstığı"
          }
        ]
      }
    );
    assert.deepEqual(clone(warnings), []);
    await close(runtime);
  }
);

test(
  "Profil API'si yoksa kısıt kontrolü güvenli boş liste döndürüyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const warnings = await runtime.api.getConstraintWarnings(food.id);
    assert.deepEqual(clone(warnings), []);
    await close(runtime);
  }
);

test(
  "Gerçek NUT-004 profili kütüphane uyarı bağlamında kimliğiyle kullanılıyor",
  async () => {
    const runtime = createRuntime({ loadProfile: true });
    await runtime.profile.createProfile(
      {
        constraints: [
          {
            category: "intolerance",
            label: "Laktoz"
          }
        ]
      },
      confirmed(T1)
    );
    const food = await createFood(runtime, {}, T2);
    const warnings = await runtime.api.getConstraintWarnings(food.id);
    assert.equal(warnings.length, 1);
    assert.match(
      warnings[0].constraintId,
      /^dietary-constraint:/
    );
    await close(runtime);
  }
);

test(
  "Geçersiz profil bağlamı kütüphane kaydını değiştirmeden reddediliyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    await expectCode(
      runtime.api.getConstraintWarnings(
        food.id,
        { constraints: [] }
      ),
      "TODAY-NUTRITION-LIBRARY-008"
    );
    assert.equal(
      (await runtime.api.getItem(food.id)).recordStatus,
      "active"
    );
    await close(runtime);
  }
);

test(
  "Eşzamanlı iki farklı kullanıcı besini seri yazılıp ikisi de korunuyor",
  async () => {
    const runtime = createRuntime();
    const [first, second] = await Promise.all([
      runtime.api.createFood(
        foodInput(),
        confirmed(T1)
      ),
      runtime.api.createFood(
        secondFoodInput(),
        confirmed(T1)
      )
    ]);
    assert.notEqual(first.id, second.id);
    assert.equal(
      (await runtime.api.getSnapshot()).foods.length,
      2
    );
    await close(runtime);
  }
);

test(
  "Başarısız kütüphane komutu sonraki geçerli komutu zehirlemiyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      createFood(runtime, { nutrients: {} }),
      "TODAY-NUTRITION-LIBRARY-002"
    );
    const food = await createFood(runtime, {}, T2);
    assert.equal(food.recordStatus, "active");
    await close(runtime);
  }
);

test(
  "Bozuk kaynak sınıfı yüksek seviye kütüphane kapısında yakalanıyor",
  async () => {
    const runtime = createRuntime();
    const record = baseRecord(
      runtime,
      "food-version:corrupt",
      "food_version",
      {
        foodId: "food:corrupt",
        version: "1.0.0",
        name: "Bozuk",
        servingBasis: known(100, "g"),
        nutrients: { energy: known(10, "kcal") },
        referenceSourceIds: ["source:user-entry"]
      },
      {
        extensions: {
          "today.nutrition.library": {
            entityKind: "food",
            logicalId: "food:corrupt",
            version: "1.0.0",
            supersedesId: null,
            baseRecordId: null,
            sourceClass: "verified_data_package",
            preparation: {
              method: "raw",
              details: null
            },
            nutritionVersion: "1.0.0",
            tags: [],
            constraintTags: [],
            derivedFromId: null
          }
        }
      }
    );
    await runtime.storage.saveRecord(record);
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-LIBRARY-004"
    );
    await close(runtime);
  }
);

test(
  "Birden fazla etkin aynı mantıksal sürüm yüksek seviye kapıda reddediliyor",
  async () => {
    const runtime = createRuntime();
    const first = await createFood(runtime);
    const duplicate = clone(first);
    duplicate.id = "food-version:duplicate";
    duplicate.createdAt = T2;
    duplicate.updatedAt = T2;
    await runtime.storage.saveRecord(duplicate);
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-LIBRARY-004"
    );
    await close(runtime);
  }
);

test(
  "Kütüphane sürüm zinciri geri veya eşit sürüme ilerleyemiyor",
  async () => {
    const runtime = createRuntime();
    const first = await createFood(runtime);
    const previous = clone(first);
    previous.recordStatus = "superseded";
    previous.updatedAt = T2;
    const invalid = clone(first);
    invalid.id = "food-version:invalid-next";
    invalid.createdAt = T2;
    invalid.updatedAt = T2;
    invalid.extensions["today.nutrition.library"].supersedesId = first.id;
    await runtime.storage.saveRecords([previous, invalid]);
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-LIBRARY-004"
    );
    await close(runtime);
  }
);

test(
  "Kütüphane yalnız today_nutrition deposunu kullanıp Core localStorage alanına dokunmuyor",
  async () => {
    const runtime = createRuntime();
    await createFood(runtime);
    const databases = await runtime.window.indexedDB.databases();
    assert.deepEqual(
      databases.map(item => item.name),
      ["today_nutrition"]
    );
    assert.equal(
      sources[LIBRARY_PATH].includes("today_app_v10"),
      false
    );
    await close(runtime);
  }
);

test(
  "Arşivleme geçmiş tarif veya şablon anlık görüntülerini otomatik silmiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    const recipe = await createRecipe(runtime, food);
    const template = await createTemplate(runtime, recipe);
    const recipeSnapshot = recipe.payload.ingredientSnapshotIds[0];
    const templateSnapshot = template.payload.itemSnapshotIds[0];
    await runtime.api.archiveItem(template.id, confirmed(T4));
    assert.ok(await runtime.storage.getRecord(recipeSnapshot));
    assert.ok(await runtime.storage.getRecord(templateSnapshot));
    await close(runtime);
  }
);

test(
  "Kütüphane API sonuçlarının iç içe alanları dışarıdan değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    const food = await createFood(runtime);
    assert.equal(Object.isFrozen(food), true);
    assert.equal(Object.isFrozen(food.payload), true);
    assert.equal(Object.isFrozen(food.payload.nutrients), true);
    assert.equal(
      Object.isFrozen(
        food.extensions[
          runtime.api.LIBRARY_EXTENSION_KEY
        ]
      ),
      true
    );
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
          `${error.message}${
            error.todayCode
              ? ` [${error.todayCode}]`
              : ""
          }`
      });
    }
  }

  const failed = results.filter(result => !result.success);

  results.forEach(result => {
    const prefix = result.success ? "PASS" : "FAIL";
    const suffix = result.error ? ` — ${result.error}` : "";
    console.log(`${prefix}: ${result.name}${suffix}`);
  });

  console.log(
    `Nutrition Library: ${results.length - failed.length}/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
