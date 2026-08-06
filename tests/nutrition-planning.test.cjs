const assert =
  require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {
  IDBFactory
} = require("fake-indexeddb");

const PATHS = Object.freeze({
  contracts:
    "modules/nutrition-contracts.js",
  calculations:
    "modules/nutrition-calculations.js",
  storage:
    "modules/nutrition-storage.js",
  profile:
    "modules/nutrition-profile.js",
  library:
    "modules/nutrition-library.js",
  entry:
    "modules/nutrition-entry.js",
  planning:
    "modules/nutrition-planning.js"
});

const sources =
  Object.fromEntries(
    Object.entries(PATHS).map(
      ([key, path]) => [
        key,
        fs.readFileSync(
          path,
          "utf8"
        )
      ]
    )
  );

const T1 =
  "2026-08-06T08:00:00.000Z";
const T2 =
  "2026-08-06T09:00:00.000Z";
const T3 =
  "2026-08-06T10:00:00.000Z";
const T4 =
  "2026-08-06T11:00:00.000Z";
const T5 =
  "2026-08-06T12:00:00.000Z";
const T6 =
  "2026-08-06T13:00:00.000Z";
const T7 =
  "2026-08-06T14:00:00.000Z";
const P1 =
  "2026-08-07T07:00:00.000Z";
const P2 =
  "2026-08-07T12:00:00.000Z";
const P3 =
  "2026-08-08T16:00:00.000Z";
const OUTSIDE =
  "2026-08-10T08:00:00.000Z";
const PLAN_START = "2026-08-07";
const PLAN_END = "2026-08-09";

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

  [
    "contracts",
    "calculations",
    "storage",
    "profile",
    "library",
    "entry"
  ].forEach(key => {
    const optionName =
      "load" +
      key[0].toUpperCase() +
      key.slice(1);

    if (
      options[optionName] !== false
    ) {
      vm.runInNewContext(
        sources[key],
        context,
        { filename: PATHS[key] }
      );
    }
  });

  vm.runInNewContext(
    sources.planning,
    context,
    {
      filename: PATHS.planning
    }
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
    library:
      window.TodayNutritionLibrary,
    entry:
      window.TodayNutritionEntry,
    api:
      window.TodayNutritionPlanning
  };
}

function clone(value) {
  return value === undefined
    ? undefined
    : JSON.parse(
        JSON.stringify(value)
      );
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
  basis = "Açıklanmış tahmin"
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

function confirmed(
  at = T4,
  extras = {}
) {
  return {
    userInitiated: true,
    userConfirmed: true,
    at,
    ...extras
  };
}

function aiConsent(
  at = T4,
  extras = {}
) {
  return {
    userRequested: true,
    userDataUseApproved: true,
    at,
    aiSource: {
      referenceId:
        "today-ai-plan-request",
      version: "today-ai-v1"
    },
    ...extras
  };
}

function foodInput(overrides = {}) {
  return {
    foodId: "food:yogurt",
    name: "Yoğurt",
    servingBasis:
      known(100, "g"),
    nutrients: {
      energy:
        known(60, "kcal"),
      protein: known(4, "g"),
      carbohydrate:
        known(5, "g"),
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

function recipeInput(
  foodId,
  overrides = {}
) {
  return {
    recipeId:
      "recipe:yogurt-bowl",
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

function templateInput(
  recordId,
  overrides = {}
) {
  return {
    templateId:
      "meal-template:morning",
    name: "Sabah Şablonu",
    mealType: "breakfast",
    items: [
      {
        recordId,
        amount:
          known(1, "portion")
      }
    ],
    tags: ["sabah"],
    constraintTags: [],
    ...overrides
  };
}

async function createLibrarySet(
  runtime,
  options = {}
) {
  const food =
    await runtime.library.createFood(
      foodInput(
        options.food || {}
      ),
      confirmed(T1)
    );
  const recipe =
    await runtime.library.createRecipe(
      recipeInput(
        food.id,
        options.recipe || {}
      ),
      confirmed(T2)
    );
  const template =
    await runtime.library
      .createMealTemplate(
        templateInput(
          recipe.id,
          options.template || {}
        ),
        confirmed(T3)
      );

  return {
    food,
    recipe,
    template
  };
}

function customMeal(overrides = {}) {
  return {
    plannedFor: P1,
    mealType: "breakfast",
    customItems: [
      {
        name: "Serbest öğün"
      }
    ],
    ...overrides
  };
}

function planInput(overrides = {}) {
  return {
    startDate: PLAN_START,
    endDate: PLAN_END,
    title: "Haftalık Plan",
    timeZone:
      "Europe/Istanbul",
    meals: [customMeal()],
    ...overrides
  };
}

async function createPlan(
  runtime,
  input = planInput(),
  confirmation = confirmed(T4)
) {
  return runtime.api.createPlan(
    input,
    confirmation
  );
}

async function createLibraryPlan(
  runtime,
  options = {}
) {
  const library =
    await createLibrarySet(runtime);
  const graph =
    await createPlan(
      runtime,
      planInput({
        meals: [
          {
            plannedFor: P1,
            mealType:
              "breakfast",
            items: [
              {
                recordId:
                  library.food.id,
                amount:
                  known(150, "g")
              }
            ],
            ...(
              options.meal || {}
            )
          }
        ],
        ...(
          options.plan || {}
        )
      })
    );

  return {
    ...library,
    graph
  };
}

async function close(runtime) {
  runtime.storage?.close();
}

async function expectCode(
  promise,
  code
) {
  await assert.rejects(
    promise,
    error => {
      assert.equal(
        error.todayCode,
        code
      );
      return true;
    }
  );
}

async function allRecords(runtime) {
  return runtime.storage
    .queryRecords({
      includeAiDrafts: true,
      recordStatuses: [
        "active",
        "draft",
        "archived",
        "superseded"
      ],
      limit: 500
    });
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test(
  "Planlama API'si v1 ve değişmez yayımlanıyor",
  async () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api
        .PLANNING_API_VERSION,
      1
    );
    assert.equal(
      Object.isFrozen(runtime.api),
      true
    );
    await close(runtime);
  }
);

test(
  "Planlama kural seti ve uzantı adları sürümlü",
  async () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api
        .PLANNING_RULESET_ID,
      "today:nutrition:planning:v1"
    );
    assert.equal(
      runtime.api
        .PLAN_EXTENSION_KEY,
      "today.nutrition.planning"
    );
    assert.equal(
      runtime.api
        .SNAPSHOT_EXTENSION_KEY,
      "today.nutrition.planning-snapshot"
    );
    await close(runtime);
  }
);

test(
  "Plan ve planlanan öğün kayıt türleri ayrı",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.PLAN_RECORD_TYPES],
      [
        "meal_plan",
        "planned_meal"
      ]
    );
    assert.equal(
      Object.isFrozen(
        runtime.api
          .PLAN_RECORD_TYPES
      ),
      true
    );
    await close(runtime);
  }
);

test(
  "Plan ve öğün durum kümeleri sözleşmeyle eşleşiyor",
  async () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.PLAN_STATUSES],
      [
        "draft",
        "active",
        "completed",
        "archived"
      ]
    );
    assert.deepEqual(
      [
        ...runtime.api
          .PLANNED_MEAL_STATUSES
      ],
      [
        "planned",
        "linked",
        "skipped",
        "cancelled"
      ]
    );
    await close(runtime);
  }
);

test(
  "Varsayılan plan saat dilimi Europe Istanbul",
  async () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api
        .DEFAULT_TIME_ZONE,
      "Europe/Istanbul"
    );
    await close(runtime);
  }
);

test(
  "Modül yüklenirken IndexedDB açılmıyor",
  async () => {
    const runtime = createRuntime();
    const databases =
      await runtime.window
        .indexedDB
        .databases();
    assert.deepEqual(databases, []);
    await close(runtime);
  }
);

test(
  "Eksik sözleşme bağımlılığı çağrı anında güvenli hata veriyor",
  async () => {
    const runtime = createRuntime({
      loadContracts: false
    });
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PLANNING-001"
    );
  }
);

test(
  "Eksik profil bağımlılığı çağrı anında güvenli hata veriyor",
  async () => {
    const runtime = createRuntime({
      loadProfile: false
    });
    await expectCode(
      runtime.api.getSnapshot(),
      "TODAY-NUTRITION-PLANNING-001"
    );
    await close(runtime);
  }
);

test(
  "NUT-006 yüklenmeden de plan oluşturulabiliyor",
  async () => {
    const runtime = createRuntime({
      loadEntry: false
    });
    const graph =
      await createPlan(runtime);
    assert.equal(
      graph.plan.payload.status,
      "active"
    );
    await close(runtime);
  }
);

[
  {
    name:
      "Plan kullanıcı başlatması olmadan oluşturulmuyor",
    confirmation: {
      userConfirmed: true,
      at: T4
    },
    code:
      "TODAY-NUTRITION-PLANNING-003"
  },
  {
    name:
      "Plan kullanıcı onayı olmadan oluşturulmuyor",
    confirmation: {
      userInitiated: true,
      at: T4
    },
    code:
      "TODAY-NUTRITION-PLANNING-003"
  },
  {
    name:
      "Geçersiz işlem zamanı reddediliyor",
    confirmation:
      confirmed("not-a-date"),
    code:
      "TODAY-NUTRITION-PLANNING-002"
  },
  {
    name:
      "Geçersiz istemci işlem kimliği reddediliyor",
    confirmation:
      confirmed(T4, {
        clientOperationId: "?"
      }),
    code:
      "TODAY-NUTRITION-PLANNING-002"
  }
].forEach(item => {
  test(item.name, async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.createPlan(
        planInput(),
        item.confirmation
      ),
      item.code
    );
    await close(runtime);
  });
});

[
  {
    name:
      "Null plan girdisi reddediliyor",
    input: null
  },
  {
    name:
      "Plan başlangıcı eksikse reddediliyor",
    input:
      planInput({
        startDate: null
      })
  },
  {
    name:
      "Takvimde olmayan başlangıç tarihi reddediliyor",
    input:
      planInput({
        startDate:
          "2026-02-30"
      })
  },
  {
    name:
      "Plan bitiş biçimi geçersizse reddediliyor",
    input:
      planInput({
        endDate: "09.08.2026"
      })
  },
  {
    name:
      "Plan bitişi başlangıçtan önceyse reddediliyor",
    input:
      planInput({
        startDate:
          "2026-08-09",
        endDate:
          "2026-08-07"
      })
  },
  {
    name:
      "Geçersiz saat dilimi reddediliyor",
    input:
      planInput({
        timeZone:
          "Istanbul"
      })
  },
  {
    name:
      "Plan öğünleri liste değilse reddediliyor",
    input:
      planInput({
        meals: {}
      })
  },
  {
    name:
      "Planlanan öğün nesne değilse reddediliyor",
    input:
      planInput({
        meals: [null]
      })
  },
  {
    name:
      "Planlanan öğün zamanı geçersizse reddediliyor",
    input:
      planInput({
        meals: [
          customMeal({
            plannedFor:
              "tomorrow"
          })
        ]
      })
  },
  {
    name:
      "Planlanan öğün plan öncesindeyse reddediliyor",
    input:
      planInput({
        meals: [
          customMeal({
            plannedFor:
              "2026-08-06T07:00:00.000Z"
          })
        ]
      })
  },
  {
    name:
      "Planlanan öğün plan sonrasındaysa reddediliyor",
    input:
      planInput({
        meals: [
          customMeal({
            plannedFor:
              OUTSIDE
          })
        ]
      })
  },
  {
    name:
      "İçeriksiz planlanan öğün reddediliyor",
    input:
      planInput({
        meals: [
          {
            plannedFor: P1,
            mealType:
              "breakfast"
          }
        ]
      })
  },
  {
    name:
      "Geçersiz özel öğe adı reddediliyor",
    input:
      planInput({
        meals: [
          customMeal({
            customItems: [
              { name: "" }
            ]
          })
        ]
      })
  },
  {
    name:
      "Sıfır özel öğe miktarı reddediliyor",
    input:
      planInput({
        meals: [
          customMeal({
            customItems: [
              {
                name: "Öğün",
                amount:
                  known(
                    0,
                    "portion"
                  )
              }
            ]
          })
        ]
      })
  },
  {
    name:
      "Yinelenen istemci öğün kimliği reddediliyor",
    input:
      planInput({
        meals: [
          customMeal({
            clientMealId:
              "client-meal:1"
          }),
          customMeal({
            plannedFor: P2,
            mealType: "lunch",
            clientMealId:
              "client-meal:1"
          })
        ]
      })
  }
].forEach(item => {
  test(item.name, async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.createPlan(
        item.input,
        confirmed(T4)
      ),
      "TODAY-NUTRITION-PLANNING-002"
    );
    assert.equal(
      (await allRecords(runtime))
        .length,
      0
    );
    await close(runtime);
  });
});

[
  "invalid",
  "",
  null,
  "water",
  "brunch"
].forEach(value => {
  test(
    "Geçersiz öğün türü reddediliyor: " +
      String(value),
    async () => {
      const runtime =
        createRuntime();
      await expectCode(
        runtime.api.createPlan(
          planInput({
            meals: [
              customMeal({
                mealType: value
              })
            ]
          }),
          confirmed(T4)
        ),
        "TODAY-NUTRITION-PLANNING-002"
      );
      await close(runtime);
    }
  );
});

test(
  "Boş plan kullanıcı onayıyla etkin oluşabiliyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(
        runtime,
        planInput({ meals: [] })
      );
    assert.equal(
      graph.plan.type,
      "meal_plan"
    );
    assert.equal(
      graph.plan.payload.status,
      "active"
    );
    assert.deepEqual(
      graph.plan.payload
        .plannedMealIds,
      []
    );
    assert.equal(
      graph.summary.mealCount,
      0
    );
    await close(runtime);
  }
);

test(
  "Özel öğün planı plan öğün ve snapshot zincirini atomik oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const records =
      await allRecords(runtime);
    assert.equal(
      records.filter(
        record =>
          record.type ===
            "meal_plan"
      ).length,
      1
    );
    assert.equal(
      graph.plannedMeals.length,
      1
    );
    assert.equal(
      records.filter(
        record =>
          record.type ===
            "meal_item_snapshot"
      ).length,
      1
    );
    await close(runtime);
  }
);

test(
  "Plan zamanı yalnız plannedFor ve eventAt alanlarında tutuluyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const meal =
      graph.plannedMeals[0];
    assert.equal(
      meal.payload.plannedFor,
      P1
    );
    assert.equal(meal.eventAt, P1);
    assert.equal(
      Object.hasOwn(
        meal.payload,
        "consumedAt"
      ),
      false
    );
    assert.equal(
      graph.plan.eventAt,
      null
    );
    await close(runtime);
  }
);

test(
  "Plan kaydı snapshot kimliği taşımaz",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    assert.equal(
      Object.hasOwn(
        graph.plan.payload,
        "itemSnapshotIds"
      ),
      false
    );
    await close(runtime);
  }
);

test(
  "Plan snapshot sahipliği plan ve planlanan öğün kimliğiyle izleniyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const full =
      await runtime.api.getPlan(
        graph.plan.id,
        {
          includeSnapshots: true
        }
      );
    const meta =
      full.snapshots[0]
        .extensions[
          runtime.api
            .SNAPSHOT_EXTENSION_KEY
        ];
    assert.equal(
      meta.ownerPlanId,
      graph.plan.id
    );
    assert.equal(
      meta.ownerPlannedMealId,
      graph.plannedMeals[0].id
    );
    await close(runtime);
  }
);

test(
  "Besin değeri girilmeyen özel plan öğesi sıfıra çevrilmiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const full =
      await runtime.api.getPlan(
        graph.plan.id,
        {
          includeSnapshots: true
        }
      );
    const snapshot =
      full.snapshots[0];
    assert.deepEqual(
      snapshot.payload.nutrients,
      {}
    );
    assert.equal(
      snapshot.knowledgeStatus,
      "unknown"
    );
    await close(runtime);
  }
);

test(
  "Gerçek sıfır besin değeri bilinen ölçüm olarak korunuyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(
        runtime,
        planInput({
          meals: [
            customMeal({
              customItems: [
                {
                  name: "Şekersiz",
                  nutrients: {
                    carbohydrate:
                      known(0, "g")
                  }
                }
              ]
            })
          ]
        })
      );
    const full =
      await runtime.api.getPlan(
        graph.plan.id,
        {
          includeSnapshots: true
        }
      );
    assert.deepEqual(
      clone(
        full.snapshots[0]
          .payload
          .nutrients
          .carbohydrate
      ),
      known(0, "g")
    );
    await close(runtime);
  }
);

test(
  "Özel plan öğesinin düşük eforlu varsayılanı bir porsiyon",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const full =
      await runtime.api.getPlan(
        graph.plan.id,
        {
          includeSnapshots: true
        }
      );
    assert.deepEqual(
      clone(
        full.snapshots[0]
          .payload.amount
      ),
      known(1, "portion")
    );
    await close(runtime);
  }
);

test(
  "Birden çok planlanan öğün takvim zamanına göre dönüyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(
        runtime,
        planInput({
          meals: [
            customMeal({
              plannedFor: P3,
              mealType: "dinner"
            }),
            customMeal({
              plannedFor: P1
            }),
            customMeal({
              plannedFor: P2,
              mealType: "lunch"
            })
          ]
        })
      );
    assert.deepEqual(
      graph.plannedMeals.map(
        meal =>
          meal.payload.plannedFor
      ),
      [P1, P2, P3]
    );
    await close(runtime);
  }
);

test(
  "Kütüphane besini seçilen miktarla deterministik hesaplanıyor",
  async () => {
    const runtime = createRuntime();
    const { graph } =
      await createLibraryPlan(
        runtime
      );
    const full =
      await runtime.api.getPlan(
        graph.plan.id,
        {
          includeSnapshots: true
        }
      );
    assert.equal(
      full.snapshots[0]
        .payload
        .nutrients
        .energy
        .value,
      90
    );
    assert.equal(
      full.snapshots[0]
        .calculationVersion,
      "nutrition-calc-v1"
    );
    await close(runtime);
  }
);

test(
  "Kütüphane kaynak sürümü plan snapshotında izleniyor",
  async () => {
    const runtime = createRuntime();
    const { graph, food } =
      await createLibraryPlan(
        runtime
      );
    const full =
      await runtime.api.getPlan(
        graph.plan.id,
        {
          includeSnapshots: true
        }
      );
    const meta =
      full.snapshots[0]
        .extensions[
          runtime.api
            .SNAPSHOT_EXTENSION_KEY
        ];
    assert.equal(
      meta.sourceLibraryRecordId,
      food.id
    );
    assert.equal(
      meta.sourceVersion,
      "1.0.0"
    );
    await close(runtime);
  }
);

test(
  "Öğün şablonu plan için yeni snapshot kimlikleri oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(
        runtime
      );
    const graph =
      await createPlan(
        runtime,
        planInput({
          meals: [
            {
              plannedFor: P1,
              mealType:
                "breakfast",
              templateId:
                template.id
            }
          ]
        })
      );
    const full =
      await runtime.api.getPlan(
        graph.plan.id,
        {
          includeSnapshots: true
        }
      );
    assert.notEqual(
      full.snapshots[0].id,
      template.payload
        .itemSnapshotIds[0]
    );
    assert.equal(
      full.snapshots[0]
        .extensions[
          runtime.api
            .SNAPSHOT_EXTENSION_KEY
        ]
        .sourceTemplateId,
      template.id
    );
    await close(runtime);
  }
);

test(
  "Öğün şablonu çarpanı miktar ve besinleri birlikte ölçekliyor",
  async () => {
    const runtime = createRuntime();
    const { template } =
      await createLibrarySet(
        runtime
      );
    const graph =
      await createPlan(
        runtime,
        planInput({
          meals: [
            {
              plannedFor: P1,
              mealType:
                "breakfast",
              templateId:
                template.id,
              templateMultiplier: 2
            }
          ]
        })
      );
    const full =
      await runtime.api.getPlan(
        graph.plan.id,
        {
          includeSnapshots: true
        }
      );
    assert.equal(
      full.snapshots[0]
        .payload.amount.value,
      2
    );
    assert.equal(
      full.snapshots[0]
        .payload.nutrients
        .energy.value,
      240
    );
    await close(runtime);
  }
);

test(
  "Şablon kütüphane ve özel öğe birlikte mixed olarak izleniyor",
  async () => {
    const runtime = createRuntime();
    const {
      food,
      template
    } = await createLibrarySet(
      runtime
    );
    const graph =
      await createPlan(
        runtime,
        planInput({
          meals: [
            {
              plannedFor: P1,
              mealType:
                "breakfast",
              templateId:
                template.id,
              items: [
                {
                  recordId:
                    food.id,
                  amount:
                    known(50, "g")
                }
              ],
              customItems: [
                { name: "Notlu öğe" }
              ]
            }
          ]
        })
      );
    assert.equal(
      graph.plannedMeals[0]
        .extensions[
          runtime.api
            .PLAN_EXTENSION_KEY
        ]
        .captureMode,
      "mixed"
    );
    assert.equal(
      graph.plannedMeals[0]
        .payload
        .itemSnapshotIds.length,
      3
    );
    await close(runtime);
  }
);

test(
  "Bulunmayan kütüphane kaynağı atomik plan yazımını durduruyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.createPlan(
        planInput({
          meals: [
            {
              plannedFor: P1,
              mealType:
                "breakfast",
              items: [
                {
                  recordId:
                    "food:missing",
                  amount:
                    known(100, "g")
                }
              ]
            }
          ]
        }),
        confirmed(T4)
      ),
      "TODAY-NUTRITION-PLANNING-005"
    );
    assert.equal(
      (await allRecords(runtime))
        .length,
      0
    );
    await close(runtime);
  }
);

test(
  "Profil kısıtı planı engellemeden açıklanabilir uyarı üretiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.profile
      .createProfile(
        {
          constraints: [
            {
              category:
                "intolerance",
              label: "Laktoz"
            }
          ]
        },
        confirmed(T1)
      );
    const { graph } =
      await createLibraryPlan(
        runtime
      );
    const warning =
      graph.plannedMeals[0]
        .extensions[
          runtime.api
            .PLAN_EXTENSION_KEY
        ]
        .warnings[0];
    assert.equal(
      warning.label,
      "Laktoz"
    );
    assert.equal(
      warning.blocking,
      false
    );
    await close(runtime);
  }
);

test(
  "Aynı kısıt uyarısı plan özetinde yinelenmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.profile
      .createProfile(
        {
          constraints: [
            {
              category:
                "intolerance",
              label: "Laktoz"
            }
          ]
        },
        confirmed(T1)
      );
    const { food } =
      await createLibrarySet(
        runtime
      );
    const graph =
      await createPlan(
        runtime,
        planInput({
          meals: [
            {
              plannedFor: P1,
              mealType:
                "breakfast",
              items: [
                {
                  recordId:
                    food.id,
                  amount:
                    known(100, "g")
                },
                {
                  recordId:
                    food.id,
                  amount:
                    known(50, "g")
                }
              ]
            }
          ]
        })
      );
    assert.equal(
      graph.plan.extensions[
        runtime.api
          .PLAN_EXTENSION_KEY
      ].warnings.length,
      1
    );
    await close(runtime);
  }
);

test(
  "Dönen plan grafiği dışarıdan değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    assert.equal(
      Object.isFrozen(graph),
      true
    );
    assert.equal(
      Object.isFrozen(graph.plan),
      true
    );
    assert.equal(
      Object.isFrozen(
        graph.plannedMeals
      ),
      true
    );
    await close(runtime);
  }
);

test(
  "getPlan bilinmeyen plan için null dönüyor",
  async () => {
    const runtime = createRuntime();
    assert.equal(
      await runtime.api.getPlan(
        "meal-plan:missing"
      ),
      null
    );
    await close(runtime);
  }
);

test(
  "getPlan required seçeneğinde bilinmeyen planı hata sayıyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.getPlan(
        "meal-plan:missing",
        { required: true }
      ),
      "TODAY-NUTRITION-PLANNING-004"
    );
    await close(runtime);
  }
);

test(
  "Aktif plan listesi AI taslaklarını içermez",
  async () => {
    const runtime = createRuntime();
    await createPlan(runtime);
    const plans =
      await runtime.api.listPlans();
    assert.equal(plans.length, 1);
    assert.equal(
      plans[0].source.kind,
      "manual"
    );
    await close(runtime);
  }
);

test(
  "Takvim aralığı yalnız eşleşen planlanan öğünleri döndürüyor",
  async () => {
    const runtime = createRuntime();
    await createPlan(
      runtime,
      planInput({
        meals: [
          customMeal({
            plannedFor: P1
          }),
          customMeal({
            plannedFor: P3,
            mealType: "dinner"
          })
        ]
      })
    );
    const meals =
      await runtime.api
        .listPlannedMeals({
          from:
            "2026-08-07T00:00:00.000Z",
          to:
            "2026-08-07T23:59:59.999Z"
        });
    assert.equal(meals.length, 1);
    assert.equal(
      meals[0].payload.plannedFor,
      P1
    );
    await close(runtime);
  }
);

test(
  "Aynı istemci plan işlemi yinelendiğinde ikinci plan oluşturmuyor",
  async () => {
    const runtime = createRuntime();
    const first =
      await createPlan(
        runtime,
        planInput(),
        confirmed(T4, {
          clientOperationId:
            "plan-operation:1"
        })
      );
    const second =
      await createPlan(
        runtime,
        planInput(),
        confirmed(T5, {
          clientOperationId:
            "plan-operation:1"
        })
      );
    assert.equal(
      first.plan.id,
      second.plan.id
    );
    assert.equal(
      (await runtime.api
        .listPlans()).length,
      1
    );
    await close(runtime);
  }
);

test(
  "Plan öğünü eklemek yeni snapshot ve plan revizyonu oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const updated =
      await runtime.api
        .addPlannedMeal(
          graph.plan.id,
          customMeal({
            plannedFor: P2,
            mealType: "lunch"
          }),
          confirmed(T5)
        );
    assert.equal(
      updated.plannedMeals.length,
      2
    );
    assert.equal(
      updated.plan.extensions[
        runtime.api
          .PLAN_EXTENSION_KEY
      ].revision,
      2
    );
    await close(runtime);
  }
);

test(
  "Geçersiz ek öğün planı ve ilk öğünü değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const before =
      clone(
        await runtime.api.getPlan(
          graph.plan.id,
          {
            includeSnapshots: true
          }
        )
      );
    await expectCode(
      runtime.api.addPlannedMeal(
        graph.plan.id,
        customMeal({
          plannedFor: OUTSIDE
        }),
        confirmed(T5)
      ),
      "TODAY-NUTRITION-PLANNING-002"
    );
    assert.deepEqual(
      clone(
        await runtime.api.getPlan(
          graph.plan.id,
          {
            includeSnapshots: true
          }
        )
      ),
      before
    );
    await close(runtime);
  }
);

test(
  "Plan içinde istemci öğün kimliği yeniden kullanılamıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(
        runtime,
        planInput({
          meals: [
            customMeal({
              clientMealId:
                "client-meal:1"
            })
          ]
        })
      );
    await expectCode(
      runtime.api.addPlannedMeal(
        graph.plan.id,
        customMeal({
          plannedFor: P2,
          mealType: "lunch",
          clientMealId:
            "client-meal:1"
        }),
        confirmed(T5)
      ),
      "TODAY-NUTRITION-PLANNING-006"
    );
    await close(runtime);
  }
);

test(
  "Plan oluşturulmadan önceki zamanla öğün eklenemiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await expectCode(
      runtime.api.addPlannedMeal(
        graph.plan.id,
        customMeal({
          plannedFor: P2,
          mealType: "lunch"
        }),
        confirmed(T3)
      ),
      "TODAY-NUTRITION-PLANNING-002"
    );
    await close(runtime);
  }
);

test(
  "Plan penceresi başlık ve saat dilimiyle güncelleniyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const updated =
      await runtime.api
        .updatePlanWindow(
          graph.plan.id,
          {
            endDate:
              "2026-08-10",
            title: "Yeni Plan",
            timeZone: "UTC"
          },
          confirmed(T5)
        );
    assert.equal(
      updated.plan.payload.endDate,
      "2026-08-10"
    );
    assert.equal(
      updated.plan.extensions[
        runtime.api
          .PLAN_EXTENSION_KEY
      ].title,
      "Yeni Plan"
    );
    assert.equal(
      updated.plan.extensions[
        runtime.api
          .PLAN_EXTENSION_KEY
      ].timeZone,
      "UTC"
    );
    await close(runtime);
  }
);

test(
  "Plan penceresi mevcut öğünü dışarıda bırakacak biçimde daraltılamıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await expectCode(
      runtime.api.updatePlanWindow(
        graph.plan.id,
        {
          startDate:
            "2026-08-08"
        },
        confirmed(T5)
      ),
      "TODAY-NUTRITION-PLANNING-006"
    );
    await close(runtime);
  }
);

test(
  "Planlanan öğün yeniden zamanlanırken eventAt aynı anda güncelleniyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const meal =
      await runtime.api
        .reschedulePlannedMeal(
          graph.plannedMeals[0].id,
          P2,
          confirmed(T5)
        );
    assert.equal(
      meal.payload.plannedFor,
      P2
    );
    assert.equal(meal.eventAt, P2);
    assert.equal(
      meal.extensions[
        runtime.api
          .PLAN_EXTENSION_KEY
      ].scheduleHistory.length,
      1
    );
    await close(runtime);
  }
);

test(
  "Yeniden zamanlama snapshotları değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const beforeIds =
      graph.plannedMeals[0]
        .payload
        .itemSnapshotIds;
    const meal =
      await runtime.api
        .reschedulePlannedMeal(
          graph.plannedMeals[0].id,
          P2,
          confirmed(T5)
        );
    assert.deepEqual(
      [...meal.payload
        .itemSnapshotIds],
      [...beforeIds]
    );
    await close(runtime);
  }
);

test(
  "Plan aralığı dışına yeniden zamanlama reddediliyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await expectCode(
      runtime.api
        .reschedulePlannedMeal(
          graph.plannedMeals[0].id,
          OUTSIDE,
          confirmed(T5)
        ),
      "TODAY-NUTRITION-PLANNING-002"
    );
    await close(runtime);
  }
);

test(
  "Geçmiş işlem zamanı yeniden zamanlamayı değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await expectCode(
      runtime.api
        .reschedulePlannedMeal(
          graph.plannedMeals[0].id,
          P2,
          confirmed(T3)
        ),
      "TODAY-NUTRITION-PLANNING-002"
    );
    assert.equal(
      (
        await runtime.api
          .listPlannedMeals()
      )[0].payload.plannedFor,
      P1
    );
    await close(runtime);
  }
);

test(
  "İçerik verilmeden ikame eski snapshotı yeni kimlikle kopyalıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const result =
      await runtime.api
        .replacePlannedMeal(
          graph.plannedMeals[0].id,
          {
            plannedFor: P2,
            mealType: "lunch"
          },
          confirmed(T5)
        );
    assert.equal(
      result.replaced
        .payload.status,
      "cancelled"
    );
    assert.equal(
      result.replacement
        .payload.status,
      "planned"
    );
    assert.notEqual(
      result.replaced
        .payload
        .itemSnapshotIds[0],
      result.replacement
        .payload
        .itemSnapshotIds[0]
    );
    await close(runtime);
  }
);

test(
  "Yeni içerikli ikame deterministik yeni snapshot oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const { food } =
      await createLibrarySet(
        runtime
      );
    const graph =
      await createPlan(runtime);
    const result =
      await runtime.api
        .replacePlannedMeal(
          graph.plannedMeals[0].id,
          {
            items: [
              {
                recordId: food.id,
                amount:
                  known(50, "g")
              }
            ]
          },
          confirmed(T5)
        );
    const snapshot =
      await runtime.storage
        .getRecord(
          result.replacement
            .payload
            .itemSnapshotIds[0]
        );
    assert.equal(
      snapshot.payload
        .nutrients.energy.value,
      30
    );
    await close(runtime);
  }
);

test(
  "İkame zinciri eski öğünü silmeden iki kimliği planda tutuyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await runtime.api
      .replacePlannedMeal(
        graph.plannedMeals[0].id,
        {},
        confirmed(T5)
      );
    const updated =
      await runtime.api.getPlan(
        graph.plan.id
      );
    assert.equal(
      updated.plan.payload
        .plannedMealIds.length,
      2
    );
    assert.deepEqual(
      updated.plannedMeals.map(
        meal =>
          meal.payload.status
      ).sort(),
      [
        "cancelled",
        "planned"
      ]
    );
    await close(runtime);
  }
);

test(
  "Planlanan öğün açık işlemle skipped durumuna geçiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const skipped =
      await runtime.api
        .skipPlannedMeal(
          graph.plannedMeals[0].id,
          confirmed(T5)
        );
    assert.equal(
      skipped.payload.status,
      "skipped"
    );
    assert.equal(
      skipped.payload.mealEntryId,
      null
    );
    await close(runtime);
  }
);

test(
  "Planlanan öğün açık işlemle cancelled durumuna geçiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const cancelled =
      await runtime.api
        .cancelPlannedMeal(
          graph.plannedMeals[0].id,
          confirmed(T5)
        );
    assert.equal(
      cancelled.payload.status,
      "cancelled"
    );
    await close(runtime);
  }
);

test(
  "Atlanmış öğün ikinci kez değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await runtime.api
      .skipPlannedMeal(
        graph.plannedMeals[0].id,
        confirmed(T5)
      );
    await expectCode(
      runtime.api
        .cancelPlannedMeal(
          graph.plannedMeals[0].id,
          confirmed(T6)
        ),
      "TODAY-NUTRITION-PLANNING-006"
    );
    await close(runtime);
  }
);

test(
  "Bekleyen öğün varken plan tamamlanamıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await expectCode(
      runtime.api.completePlan(
        graph.plan.id,
        confirmed(T5)
      ),
      "TODAY-NUTRITION-PLANNING-006"
    );
    await close(runtime);
  }
);

test(
  "Boş plan tamamlanmış sayılamıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(
        runtime,
        planInput({ meals: [] })
      );
    await expectCode(
      runtime.api.completePlan(
        graph.plan.id,
        confirmed(T5)
      ),
      "TODAY-NUTRITION-PLANNING-006"
    );
    await close(runtime);
  }
);

test(
  "Bütün öğünler sonuçlandıktan sonra plan tamamlanıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await runtime.api
      .skipPlannedMeal(
        graph.plannedMeals[0].id,
        confirmed(T5)
      );
    const plan =
      await runtime.api.completePlan(
        graph.plan.id,
        confirmed(T6)
      );
    assert.equal(
      plan.payload.status,
      "completed"
    );
    await close(runtime);
  }
);

test(
  "Etkin plan doğrudan arşivlenemiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await expectCode(
      runtime.api.archivePlan(
        graph.plan.id,
        confirmed(T5)
      ),
      "TODAY-NUTRITION-PLANNING-006"
    );
    await close(runtime);
  }
);

test(
  "Tamamlanan plan recordStatus archived ile arşivleniyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await runtime.api
      .skipPlannedMeal(
        graph.plannedMeals[0].id,
        confirmed(T5)
      );
    await runtime.api.completePlan(
      graph.plan.id,
      confirmed(T6)
    );
    const archived =
      await runtime.api.archivePlan(
        graph.plan.id,
        confirmed(T7)
      );
    assert.equal(
      archived.payload.status,
      "archived"
    );
    assert.equal(
      archived.recordStatus,
      "archived"
    );
    assert.equal(
      (
        await runtime.api.listPlans()
      ).length,
      0
    );
    assert.equal(
      (
        await runtime.api.listPlans({
          includeArchived: true
        })
      ).length,
      1
    );
    await close(runtime);
  }
);

test(
  "Planlama API'si kalıcı kayıt silme işlevi yayımlamıyor",
  async () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.deletePlan,
      undefined
    );
    assert.equal(
      runtime.api.deletePlannedMeal,
      undefined
    );
    await close(runtime);
  }
);

[
  {
    name:
      "AI plan taslağı kullanıcı isteği olmadan oluşmuyor",
    consent: {
      userDataUseApproved: true,
      at: T4,
      aiSource: {
        referenceId: "ai:1",
        version: "v1"
      }
    }
  },
  {
    name:
      "AI plan taslağı veri kullanım onayı olmadan oluşmuyor",
    consent: {
      userRequested: true,
      at: T4,
      aiSource: {
        referenceId: "ai:1",
        version: "v1"
      }
    }
  }
].forEach(item => {
  test(item.name, async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.savePlanDraft(
        planInput(),
        item.consent
      ),
      "TODAY-NUTRITION-PLANNING-007"
    );
    await close(runtime);
  });
});

test(
  "AI plan taslağı sürümlü kaynak izi olmadan oluşmuyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.savePlanDraft(
        planInput(),
        {
          userRequested: true,
          userDataUseApproved: true,
          at: T4
        }
      ),
      "TODAY-NUTRITION-PLANNING-007"
    );
    await close(runtime);
  }
);

test(
  "AI plan taslağı bütün zincirde draft ve unverified kalıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    assert.equal(
      graph.plan.source.kind,
      "ai_draft"
    );
    assert.equal(
      graph.plan.recordStatus,
      "draft"
    );
    assert.equal(
      graph.plan
        .verificationStatus,
      "unverified"
    );
    assert.ok(
      graph.plannedMeals.every(
        meal =>
          meal.recordStatus ===
            "draft"
      )
    );
    assert.ok(
      graph.snapshots.every(
        snapshot =>
          snapshot.source.kind ===
            "ai_draft"
      )
    );
    await close(runtime);
  }
);

test(
  "AI plan taslağı varsayılan plan ve takvim sorgularından dışlanıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api
      .savePlanDraft(
        planInput(),
        aiConsent(T4)
      );
    assert.equal(
      (
        await runtime.api.listPlans()
      ).length,
      0
    );
    assert.equal(
      (
        await runtime.api
          .listPlannedMeals()
      ).length,
      0
    );
    assert.equal(
      (
        await runtime.api
          .listDrafts()
      ).length,
      1
    );
    await close(runtime);
  }
);

test(
  "AI özel öğe besin değeri uyduramaz ve kısmi taslak bırakmaz",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.savePlanDraft(
        planInput({
          meals: [
            customMeal({
              customItems: [
                {
                  name: "AI öğünü",
                  nutrients: {
                    energy:
                      estimated(
                        500,
                        "kcal",
                        "AI tahmini"
                      )
                  }
                }
              ]
            })
          ]
        }),
        aiConsent(T4)
      ),
      "TODAY-NUTRITION-PLANNING-007"
    );
    assert.equal(
      (await allRecords(runtime))
        .length,
      0
    );
    await close(runtime);
  }
);

test(
  "AI özel öğe bilinmeyen miktar ve boş besin değeriyle korunuyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    assert.deepEqual(
      clone(
        graph.snapshots[0]
          .payload.amount
      ),
      unknown("portion")
    );
    assert.deepEqual(
      graph.snapshots[0]
        .payload.nutrients,
      {}
    );
    await close(runtime);
  }
);

test(
  "AI kütüphane planı doğrulanmış kaynaktan deterministik hesaplanıyor",
  async () => {
    const runtime = createRuntime();
    const { food } =
      await createLibrarySet(
        runtime
      );
    const graph =
      await runtime.api
        .savePlanDraft(
          planInput({
            meals: [
              {
                plannedFor: P1,
                mealType:
                  "breakfast",
                items: [
                  {
                    recordId:
                      food.id,
                    amount:
                      known(100, "g")
                  }
                ]
              }
            ]
          }),
          aiConsent(T4)
        );
    assert.equal(
      graph.snapshots[0]
        .payload
        .nutrients.energy.value,
      60
    );
    assert.equal(
      graph.snapshots[0]
        .recordStatus,
      "draft"
    );
    await close(runtime);
  }
);

test(
  "AI plan taslağında profil uyarısı engelleyici değil",
  async () => {
    const runtime = createRuntime();
    await runtime.profile
      .createProfile(
        {
          constraints: [
            {
              category:
                "intolerance",
              label: "Laktoz"
            }
          ]
        },
        confirmed(T1)
      );
    const { food } =
      await createLibrarySet(
        runtime
      );
    const graph =
      await runtime.api
        .savePlanDraft(
          planInput({
            meals: [
              {
                plannedFor: P1,
                mealType:
                  "breakfast",
                items: [
                  {
                    recordId:
                      food.id,
                    amount:
                      known(100, "g")
                  }
                ]
              }
            ]
          }),
          aiConsent(T4)
        );
    assert.equal(
      graph.plan.extensions[
        runtime.api
          .PLAN_EXTENSION_KEY
      ].warnings[0].blocking,
      false
    );
    await close(runtime);
  }
);

test(
  "Aynı istemci kimlikli AI taslak isteği ikinci taslak oluşturmuyor",
  async () => {
    const runtime = createRuntime();
    const consent =
      aiConsent(T4, {
        clientOperationId:
          "ai-plan-operation:1"
      });
    const first =
      await runtime.api
        .savePlanDraft(
          planInput(),
          consent
        );
    const second =
      await runtime.api
        .savePlanDraft(
          planInput(),
          {
            ...consent,
            at: T5
          }
        );
    assert.equal(
      first.plan.id,
      second.plan.id
    );
    assert.equal(
      (
        await runtime.api.listDrafts()
      ).length,
      1
    );
    await close(runtime);
  }
);

test(
  "AI taslağı ek açık kabul olmadan etkinleşmiyor",
  async () => {
    const runtime = createRuntime();
    const draft =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    await expectCode(
      runtime.api.acceptPlanDraft(
        draft.plan.id,
        {},
        confirmed(T5)
      ),
      "TODAY-NUTRITION-PLANNING-008"
    );
    await close(runtime);
  }
);

test(
  "AI taslak kabulü özgün taslağı değiştirmeden yeni manuel plan oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const draft =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    const before =
      clone(draft);
    const accepted =
      await runtime.api
        .acceptPlanDraft(
          draft.plan.id,
          {},
          confirmed(T5, {
            acceptDraft: true
          })
        );
    assert.notEqual(
      accepted.plan.id,
      draft.plan.id
    );
    assert.equal(
      accepted.plan.source.kind,
      "manual"
    );
    assert.equal(
      accepted.plan.payload.status,
      "active"
    );
    assert.deepEqual(
      clone(
        await runtime.api.getPlan(
          draft.plan.id,
          {
            includeDraft: true,
            includeSnapshots: true
          }
        )
      ),
      before
    );
    await close(runtime);
  }
);

test(
  "Kabul edilen AI planında yeni öğün ve snapshot kimlikleri oluşuyor",
  async () => {
    const runtime = createRuntime();
    const draft =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    const accepted =
      await runtime.api
        .acceptPlanDraft(
          draft.plan.id,
          {},
          confirmed(T5, {
            acceptDraft: true
          })
        );
    assert.notEqual(
      accepted
        .plannedMeals[0].id,
      draft.plannedMeals[0].id
    );
    assert.notEqual(
      accepted.snapshots[0].id,
      draft.snapshots[0].id
    );
    assert.ok(
      accepted.snapshots.every(
        snapshot =>
          snapshot.source.kind !==
            "ai_draft"
      )
    );
    await close(runtime);
  }
);

test(
  "AI taslak kabulünde bilinmeyen özel değer sıfırlaşmıyor",
  async () => {
    const runtime = createRuntime();
    const draft =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    const accepted =
      await runtime.api
        .acceptPlanDraft(
          draft.plan.id,
          {},
          confirmed(T5, {
            acceptDraft: true
          })
        );
    assert.equal(
      accepted.snapshots[0]
        .payload.amount.status,
      "unknown"
    );
    assert.equal(
      accepted.snapshots[0]
        .payload.amount.value,
      null
    );
    await close(runtime);
  }
);

test(
  "AI taslak kabulünde öğün zamanı açık değişiklikle güncellenebiliyor",
  async () => {
    const runtime = createRuntime();
    const draft =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    const accepted =
      await runtime.api
        .acceptPlanDraft(
          draft.plan.id,
          {
            mealOverrides: [
              {
                draftPlannedMealId:
                  draft.plannedMeals[0].id,
                plannedFor: P2,
                mealType: "lunch"
              }
            ]
          },
          confirmed(T5, {
            acceptDraft: true
          })
        );
    assert.equal(
      accepted.plannedMeals[0]
        .payload.plannedFor,
      P2
    );
    assert.equal(
      accepted.plannedMeals[0]
        .payload.mealType,
      "lunch"
    );
    await close(runtime);
  }
);

test(
  "AI taslağı ikinci kez kabul edilemiyor",
  async () => {
    const runtime = createRuntime();
    const draft =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    await runtime.api
      .acceptPlanDraft(
        draft.plan.id,
        {},
        confirmed(T5, {
          acceptDraft: true
        })
      );
    await expectCode(
      runtime.api.acceptPlanDraft(
        draft.plan.id,
        {},
        confirmed(T6, {
          acceptDraft: true
        })
      ),
      "TODAY-NUTRITION-PLANNING-008"
    );
    await close(runtime);
  }
);

test(
  "AI taslağı taslak zamanından önce kabul edilemiyor",
  async () => {
    const runtime = createRuntime();
    const draft =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    await expectCode(
      runtime.api.acceptPlanDraft(
        draft.plan.id,
        {},
        confirmed(T3, {
          acceptDraft: true
        })
      ),
      "TODAY-NUTRITION-PLANNING-002"
    );
    await close(runtime);
  }
);

test(
  "AI taslağı etkin plan mutasyon API'leriyle değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    const draft =
      await runtime.api
        .savePlanDraft(
          planInput(),
          aiConsent(T4)
        );
    await expectCode(
      runtime.api.addPlannedMeal(
        draft.plan.id,
        customMeal({
          plannedFor: P2,
          mealType: "lunch"
        }),
        confirmed(T5)
      ),
      "TODAY-NUTRITION-PLANNING-004"
    );
    await close(runtime);
  }
);

test(
  "Plan tüketimi ayrıca açık onay olmadan NUT-006'ya devredilmiyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await expectCode(
      runtime.api
        .consumePlannedMeal(
          graph.plannedMeals[0].id,
          {},
          confirmed(T5)
        ),
      "TODAY-NUTRITION-PLANNING-010"
    );
    assert.equal(
      (
        await runtime.entry
          .listEntries()
      ).length,
      0
    );
    await close(runtime);
  }
);

test(
  "NUT-006 yoksa yalnız tüketim delegasyonu bağımlılık hatası veriyor",
  async () => {
    const runtime = createRuntime({
      loadEntry: false
    });
    const graph =
      await createPlan(runtime);
    await expectCode(
      runtime.api
        .consumePlannedMeal(
          graph.plannedMeals[0].id,
          {},
          confirmed(T5, {
            confirmPlanConsumption:
              true
          })
        ),
      "TODAY-NUTRITION-PLANNING-001"
    );
    await close(runtime);
  }
);

test(
  "Açık plan tüketimi NUT-006 ile gerçek meal_entry ve linked plan oluşturuyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const entry =
      await runtime.api
        .consumePlannedMeal(
          graph.plannedMeals[0].id,
          {
            consumedAt: T6
          },
          confirmed(T6, {
            confirmPlanConsumption:
              true
          })
        );
    const linked =
      await runtime.storage
        .getRecord(
          graph.plannedMeals[0].id
        );
    assert.equal(
      entry.type,
      "meal_entry"
    );
    assert.equal(
      entry.payload.plannedMealId,
      linked.id
    );
    assert.equal(
      linked.payload.status,
      "linked"
    );
    assert.equal(
      linked.payload.mealEntryId,
      entry.id
    );
    await close(runtime);
  }
);

test(
  "Gerçek tüketim plan zamanını consumedAt olarak kullanmıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const entry =
      await runtime.api
        .consumePlannedMeal(
          graph.plannedMeals[0].id,
          {},
          confirmed(T6, {
            confirmPlanConsumption:
              true
          })
        );
    assert.equal(
      entry.payload.consumedAt,
      T6
    );
    assert.notEqual(
      entry.payload.consumedAt,
      P1
    );
    await close(runtime);
  }
);

test(
  "Gerçek tüketim plan snapshot kimliğini yeniden kullanmıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    const entry =
      await runtime.api
        .consumePlannedMeal(
          graph.plannedMeals[0].id,
          {},
          confirmed(T6, {
            confirmPlanConsumption:
              true
          })
        );
    assert.notEqual(
      entry.payload
        .itemSnapshotIds[0],
      graph.plannedMeals[0]
        .payload
        .itemSnapshotIds[0]
    );
    await close(runtime);
  }
);

test(
  "Plan tüketimi ana planı kendiliğinden tamamlamıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await runtime.api
      .consumePlannedMeal(
        graph.plannedMeals[0].id,
        {},
        confirmed(T6, {
          confirmPlanConsumption:
            true
        })
      );
    const plan =
      await runtime.api.getPlan(
        graph.plan.id
      );
    assert.equal(
      plan.plan.payload.status,
      "active"
    );
    await close(runtime);
  }
);

test(
  "Bağlanmış öğün yeniden zamanlanamıyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await runtime.api
      .consumePlannedMeal(
        graph.plannedMeals[0].id,
        {},
        confirmed(T6, {
          confirmPlanConsumption:
            true
        })
      );
    await expectCode(
      runtime.api
        .reschedulePlannedMeal(
          graph.plannedMeals[0].id,
          P2,
          confirmed(T7)
        ),
      "TODAY-NUTRITION-PLANNING-006"
    );
    await close(runtime);
  }
);

test(
  "Bağlanmış tek öğün sonrası kullanıcı planı tamamlayabiliyor",
  async () => {
    const runtime = createRuntime();
    const graph =
      await createPlan(runtime);
    await runtime.api
      .consumePlannedMeal(
        graph.plannedMeals[0].id,
        {},
        confirmed(T6, {
          confirmPlanConsumption:
            true
        })
      );
    const completed =
      await runtime.api.completePlan(
        graph.plan.id,
        confirmed(T7)
      );
    assert.equal(
      completed.payload.status,
      "completed"
    );
    await close(runtime);
  }
);

test(
  "Plan snapshot özeti etkin plan taslak ve bekleyen öğünü ayırıyor",
  async () => {
    const runtime = createRuntime();
    await createPlan(runtime);
    await runtime.api
      .savePlanDraft(
        planInput({
          title: "AI Taslağı"
        }),
        aiConsent(T5)
      );
    const snapshot =
      await runtime.api
        .getSnapshot();
    assert.equal(
      snapshot.counts.plans,
      1
    );
    assert.equal(
      snapshot.counts.drafts,
      1
    );
    assert.equal(
      snapshot.counts
        .pendingMeals,
      1
    );
    await close(runtime);
  }
);

test(
  "Geçersiz plan durumu filtresi depoya gitmeden reddediliyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.listPlans({
        statuses:
          ["unknown"]
      }),
      "TODAY-NUTRITION-PLANNING-002"
    );
    await close(runtime);
  }
);

test(
  "Geçersiz planlanan öğün durumu filtresi reddediliyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api
        .listPlannedMeals({
          statuses:
            ["consumed"]
        }),
      "TODAY-NUTRITION-PLANNING-002"
    );
    await close(runtime);
  }
);

test(
  "Takvim bitişi başlangıçtan önce olamaz",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api
        .listPlannedMeals({
          from: P2,
          to: P1
        }),
      "TODAY-NUTRITION-PLANNING-002"
    );
    await close(runtime);
  }
);

test(
  "Geçersiz sıralama yönü plan listesinde reddediliyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api.listPlans({
        sortDirection: "sideways"
      }),
      "TODAY-NUTRITION-PLANNING-002"
    );
    await close(runtime);
  }
);

test(
  "Geçersiz sıralama yönü öğün listesinde reddediliyor",
  async () => {
    const runtime = createRuntime();
    await expectCode(
      runtime.api
        .listPlannedMeals({
          sortDirection: "sideways"
        }),
      "TODAY-NUTRITION-PLANNING-002"
    );
    await close(runtime);
  }
);

(async () => {
  const results = [];

  for (const current of tests) {
    try {
      await current.callback();
      results.push({
        name: current.name,
        success: true
      });
    } catch (error) {
      results.push({
        name: current.name,
        success: false,
        error:
          error?.stack ||
          error?.message ||
          String(error)
      });
    }
  }

  results.forEach(result => {
    const prefix =
      result.success
        ? "PASS"
        : "FAIL";
    const suffix =
      result.error
        ? " — " + result.error
        : "";

    console.log(
      prefix +
      ": " +
      result.name +
      suffix
    );
  });

  const failed =
    results.filter(
      result =>
        !result.success
    );

  console.log(
    "Nutrition Planning: " +
    (
      results.length -
      failed.length
    ) +
    "/" +
    results.length +
    " başarılı"
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
