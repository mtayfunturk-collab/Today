const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE_PATH =
  "modules/nutrition-contracts.js";
const source = fs.readFileSync(
  SOURCE_PATH,
  "utf8"
);
const SCHEMA_PATH =
  "contracts/nutrition/v1/nutrition-record.schema.json";
const portableSchema = JSON.parse(
  fs.readFileSync(
    SCHEMA_PATH,
    "utf8"
  )
);

function createRuntime() {
  const window = {};

  vm.runInNewContext(
    source,
    {
      window,
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      Set,
      Map,
      Error
    },
    {
      filename: SOURCE_PATH
    }
  );

  return window.TodayNutritionContracts;
}

const api = createRuntime();
const NOW =
  "2026-08-05T12:00:00.000Z";
const LATER =
  "2026-08-05T12:05:00.000Z";
const EVENT =
  "2026-08-05T09:00:00.000Z";

function known(value, unit) {
  return {
    status: "known",
    value,
    unit,
    basis: null
  };
}

function estimated(value, unit) {
  return {
    status: "estimated",
    value,
    unit,
    basis:
      "Kullanıcının seçtiği yaklaşık porsiyon"
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

function coverage(
  status = "complete"
) {
  return {
    status,
    comparableRecordCount: 1,
    totalRecordCount: 1,
    missingRecordCount: 0,
    userDeclared: true
  };
}

function baseRecord(
  type,
  payload,
  overrides = {}
) {
  return {
    id: `${type}-1`,
    type,
    schemaVersion: 1,
    createdAt: NOW,
    updatedAt: LATER,
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
  };
}

function calculatedRecord(
  type,
  payload,
  overrides = {}
) {
  return baseRecord(
    type,
    payload,
    {
      source: {
        kind: "system_calculation",
        referenceId:
          "today-nutrition-engine",
        version: "1.0.0"
      },
      verificationStatus:
        "source_verified",
      calculationVersion:
        "nutrition-calc-1",
      ...overrides
    }
  );
}

function fixtures() {
  return {
    nutrition_profile: baseRecord(
      "nutrition_profile",
      {
        trackingMode: "simple",
        dietaryConstraintIds: [],
        primaryGoalVersionId: null
      }
    ),

    dietary_constraint: baseRecord(
      "dietary_constraint",
      {
        kind: "preference",
        label: "Kırmızı eti sınırlamak",
        active: true
      }
    ),

    nutrition_goal_version: baseRecord(
      "nutrition_goal_version",
      {
        goalKind: "awareness",
        effectiveFrom: "2026-08-05",
        supersedesId: null,
        targets: {}
      }
    ),

    food_version: baseRecord(
      "food_version",
      {
        foodId: "food-yogurt",
        version: "1.0.0",
        name: "Yoğurt",
        servingBasis: known(100, "g"),
        nutrients: {
          energy_kcal: known(61, "kcal"),
          protein_g: known(3.5, "g")
        },
        referenceSourceIds: [
          "source-turkomp"
        ]
      }
    ),

    recipe_version: baseRecord(
      "recipe_version",
      {
        recipeId: "recipe-bowl",
        version: "1.0.0",
        name: "Yoğurt kasesi",
        yield: known(1, "portion"),
        ingredientSnapshotIds: [
          "meal-item-snapshot-1"
        ]
      }
    ),

    meal_template: baseRecord(
      "meal_template",
      {
        name: "Olağan kahvaltım",
        mealType: "breakfast",
        itemSnapshotIds: [
          "meal-item-snapshot-1"
        ]
      }
    ),

    meal_entry: baseRecord(
      "meal_entry",
      {
        consumedAt: EVENT,
        mealType: "breakfast",
        itemSnapshotIds: [
          "meal-item-snapshot-1"
        ],
        coverage: "complete",
        plannedMealId: null
      },
      {
        eventAt: EVENT
      }
    ),

    meal_item_snapshot: baseRecord(
      "meal_item_snapshot",
      {
        itemKind: "custom",
        referenceId: null,
        name: "Ev yapımı sandviç",
        amount: estimated(1, "portion"),
        nutrients: {
          energy_kcal: unknown("kcal")
        },
        sourceVersion: null
      }
    ),

    hydration_entry: baseRecord(
      "hydration_entry",
      {
        consumedAt: EVENT,
        beverageType: "water",
        amount: known(350, "ml")
      },
      {
        eventAt: EVENT
      }
    ),

    meal_plan: baseRecord(
      "meal_plan",
      {
        startDate: "2026-08-05",
        endDate: "2026-08-11",
        status: "active",
        plannedMealIds: [
          "planned-meal-1"
        ]
      }
    ),

    planned_meal: baseRecord(
      "planned_meal",
      {
        plannedFor: EVENT,
        mealType: "breakfast",
        itemSnapshotIds: [
          "meal-item-snapshot-1"
        ],
        status: "planned",
        mealEntryId: null
      },
      {
        eventAt: EVENT
      }
    ),

    batch_preparation: baseRecord(
      "batch_preparation",
      {
        preparedAt: EVENT,
        recipeVersionId:
          "recipe-version-1",
        producedPortions:
          known(4, "portion"),
        leftoverPortionIds: []
      },
      {
        eventAt: EVENT
      }
    ),

    leftover_portion: baseRecord(
      "leftover_portion",
      {
        batchPreparationId:
          "batch-preparation-1",
        amount: known(1, "portion"),
        status: "available",
        mealEntryId: null
      }
    ),

    shopping_list: baseRecord(
      "shopping_list",
      {
        name: "Haftalık liste",
        status: "active",
        itemIds: []
      }
    ),

    shopping_list_item: baseRecord(
      "shopping_list_item",
      {
        name: "Yoğurt",
        amount: known(1, "kg"),
        status: "needed",
        plannedMealIds: []
      }
    ),

    home_availability: baseRecord(
      "home_availability",
      {
        checkedAt: EVENT,
        itemKind: "custom",
        referenceId: null,
        amount: estimated(2, "portion")
      },
      {
        eventAt: EVENT
      }
    ),

    activity_reference: baseRecord(
      "activity_reference",
      {
        healthRecordId:
          "health-activity-1",
        relation: "activity",
        occurredAt: EVENT
      },
      {
        eventAt: EVENT
      }
    ),

    recovery_check: baseRecord(
      "recovery_check",
      {
        healthRecordId:
          "health-recovery-1",
        relation: "recovery",
        occurredAt: EVENT
      },
      {
        eventAt: EVENT
      }
    ),

    weight_reference: baseRecord(
      "weight_reference",
      {
        healthRecordId:
          "health-weight-1",
        relation: "weight",
        occurredAt: EVENT
      },
      {
        eventAt: EVENT
      }
    ),

    nutrition_summary: calculatedRecord(
      "nutrition_summary",
      {
        period: {
          startDate: "2026-08-01",
          endDate: "2026-08-05"
        },
        usedRecordIds: [
          "meal-entry-1"
        ],
        coverage: coverage("partial"),
        metrics: {
          recorded_energy_kcal:
            estimated(1800, "kcal")
        }
      }
    ),

    insight_snapshot: calculatedRecord(
      "insight_snapshot",
      {
        period: {
          startDate: "2026-07-15",
          endDate: "2026-08-05"
        },
        usedRecordIds: [
          "meal-entry-1",
          "meal-entry-2",
          "meal-entry-3",
          "meal-entry-4"
        ],
        observation:
          "Kayıtlı kahvaltıların çoğunda protein kaynağı bulunuyor.",
        basis: [
          "Kaydı yeterli dört gün"
        ],
        relationshipType:
          "descriptive",
        uncertainty:
          "Kısmi kaydedilen günler gerçek tüketimin tamamını göstermeyebilir.",
        aiNarrationVersion:
          "today-ai-narration-1"
      }
    ),

    report_snapshot: calculatedRecord(
      "report_snapshot",
      {
        period: {
          startDate: "2026-08-01",
          endDate: "2026-08-05"
        },
        includedRecordIds: [
          "meal-entry-1"
        ],
        coverage: coverage("partial"),
        goalVersionId: null,
        referenceSourceIds: [],
        includedSections: [
          "meal_pattern"
        ],
        hiddenFields: [
          "weight_history"
        ],
        generatedAt: EVENT,
        aiNarrationVersion: null,
        sharing: {
          status: "not_shared",
          consent: null,
          method: null
        }
      },
      {
        eventAt: EVENT
      }
    ),

    nutrition_reminder: baseRecord(
      "nutrition_reminder",
      {
        reminderKind: "reflection",
        enabled: true,
        userInitiated: true,
        schedule: {
          kind: "local_time",
          localTime: "20:00",
          timezone: "Europe/Istanbul",
          daysOfWeek: [
            1, 2, 3, 4, 5, 6, 7
          ]
        },
        messageStyle: "gentle"
      }
    )
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasCode(result, code) {
  return result.errors.some(
    error => error.code === code
  );
}

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({
      name,
      success: true
    });
  } catch (error) {
    results.push({
      name,
      success: false,
      error: error.message
    });
  }
}

test(
  "Sözleşme API'si v1 kimliğiyle değişmez olarak dışa açılıyor",
  () => {
    assert.equal(api.CONTRACT_VERSION, 1);
    assert.equal(
      api.SCHEMA_ID,
      "today:nutrition:record:v1"
    );
    assert.equal(Object.isFrozen(api), true);
  }
);

test(
  "Durum kodları bilgi, kaynak, kayıt, doğrulama, kapsam, ilişki ve paylaşımı ayırıyor",
  () => {
    assert.deepEqual(
      [...api.STATUS_CODES.knowledge],
      [
        "known",
        "estimated",
        "unknown"
      ]
    );
    assert.ok(
      api.STATUS_CODES.source.includes(
        "ai_draft"
      )
    );
    assert.ok(
      api.STATUS_CODES.relationship.includes(
        "association"
      )
    );
  }
);

test(
  "Kapanış mimarisindeki 23 veri nesnesinin tamamı kayıtlı",
  () => {
    assert.equal(api.RECORD_TYPES.length, 23);
    assert.deepEqual(
      [...api.RECORD_TYPES],
      Object.keys(fixtures())
    );
  }
);

test(
  "Sözleşme tanımları dışarıdan değiştirilemiyor",
  () => {
    const contract =
      api.getContract("meal_entry");
    assert.equal(Object.isFrozen(contract), true);
    assert.equal(
      Object.isFrozen(
        contract.requiredPayload
      ),
      true
    );
    assert.equal(
      api.getContract("not-known"),
      null
    );
    const listed = api.listContracts();
    assert.equal(listed.length, 23);
    assert.equal(
      listed[0].type,
      "nutrition_profile"
    );
    assert.equal(
      Object.isFrozen(listed[0]),
      true
    );
  }
);

test(
  "Taşınabilir JSON Schema çalışma zamanı sözleşmesiyle aynı kimliği taşıyor",
  () => {
    assert.equal(
      portableSchema.$id,
      api.SCHEMA_ID
    );
    assert.equal(
      portableSchema.properties
        .schemaVersion.const,
      api.CONTRACT_VERSION
    );
  }
);

test(
  "JSON Schema ile çalışma zamanı aynı 23 kayıt türünü tanıyor",
  () => {
    assert.deepEqual(
      portableSchema.properties.type.enum,
      [...api.RECORD_TYPES]
    );
  }
);

test(
  "JSON Schema ortak izlenebilirlik alanlarını zorunlu tutuyor",
  () => {
    [
      "id",
      "type",
      "schemaVersion",
      "createdAt",
      "updatedAt",
      "eventAt",
      "source",
      "knowledgeStatus",
      "recordStatus",
      "verificationStatus",
      "calculationVersion",
      "userEdited",
      "payload"
    ].forEach(field => {
      assert.ok(
        portableSchema.required.includes(field),
        field
      );
    });
  }
);

test(
  "Yirmi üç örnek kaydın her biri kendi tür sözleşmesini karşılıyor",
  () => {
    Object.entries(fixtures())
      .forEach(([type, record]) => {
        const result =
          api.validateRecord(record);
        assert.equal(
          result.valid,
          true,
          `${type}: ${JSON.stringify(
            result.errors
          )}`
        );
      });
  }
);

test(
  "Bilinmeyen ölçüm null değerle geçerli",
  () => {
    assert.equal(
      api.validateMeasurement(
        unknown("kcal")
      ).valid,
      true
    );
  }
);

test(
  "Bilinen gerçek sıfır değeri korunuyor",
  () => {
    assert.equal(
      api.validateMeasurement(
        known(0, "ml")
      ).valid,
      true
    );
  }
);

test(
  "Bilinmeyen değer sıfırla temsil edilemiyor",
  () => {
    const result =
      api.validateMeasurement({
        ...unknown("kcal"),
        value: 0
      });
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-MEASURE-004"),
      true
    );
  }
);

test(
  "Bilinen ölçüm null değer taşıyamıyor",
  () => {
    const result =
      api.validateMeasurement({
        status: "known",
        value: null,
        unit: "g",
        basis: null
      });
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-MEASURE-005"),
      true
    );
  }
);

test(
  "Tahmini ölçüm açıklanabilir dayanak olmadan kabul edilmiyor",
  () => {
    const result =
      api.validateMeasurement({
        status: "estimated",
        value: 1,
        unit: "portion",
        basis: null
      });
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-MEASURE-010"),
      true
    );
  }
);

test(
  "Varsayılan ölçüm sözleşmesi negatif miktarı reddediyor",
  () => {
    const result =
      api.validateMeasurement(
        known(-1, "g")
      );
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-MEASURE-006"),
      true
    );
  }
);

test(
  "Ölçüm kurucuları değişmez known, estimated ve unknown nesneleri üretiyor",
  () => {
    const values = [
      api.createKnownMeasurement(2, "l"),
      api.createEstimatedMeasurement(
        2,
        "portion",
        "Görsel porsiyon seçimi"
      ),
      api.createUnknownMeasurement("kcal")
    ];
    values.forEach(value => {
      assert.equal(Object.isFrozen(value), true);
    });
  }
);

test(
  "Desteklenmeyen beslenme şema sürümü reddediliyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.schemaVersion = 2;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-COMMON-005"),
      true
    );
  }
);

test(
  "Bilinmeyen kayıt türü reddediliyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.type = "nutrition_score";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-COMMON-004"),
      true
    );
  }
);

test(
  "Tanımsız üst seviye alan extensions dışına eklenemiyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.secretScore = 99;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-COMMON-002"),
      true
    );
  }
);

test(
  "Ad alanlı genişletme alanı kabul ediliyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.extensions = {
      "today.research": {
        cohort: "local-test"
      }
    };
    assert.equal(
      api.validateRecord(record).valid,
      true
    );
  }
);

test(
  "Ad alanı olmayan genişletme anahtarı reddediliyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.extensions = {
      research: true
    };
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-COMMON-017"),
      true
    );
  }
);

test(
  "Güncellenme zamanı oluşturulma zamanından önce olamıyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.updatedAt =
      "2026-08-05T11:00:00.000Z";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-COMMON-008"),
      true
    );
  }
);

test(
  "Olay kaydı üst seviye ve yük zamanı uyuşmadığında reddediliyor",
  () => {
    const record =
      fixtures().meal_entry;
    record.eventAt =
      "2026-08-05T10:00:00.000Z";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-EVENT-003"),
      true
    );
  }
);

test(
  "AI önerisi yalnız tahmini ve doğrulanmamış taslak olarak geçerli",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.source = {
      kind: "ai_draft",
      referenceId: "proposal-1",
      version: "today-ai-1"
    };
    record.knowledgeStatus = "estimated";
    record.recordStatus = "draft";
    record.verificationStatus =
      "unverified";
    record.userEdited = false;
    assert.equal(
      api.validateRecord(record).valid,
      true
    );
  }
);

test(
  "AI taslağı etkin kayıt yapılamıyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.source.kind = "ai_draft";
    record.knowledgeStatus = "estimated";
    record.verificationStatus =
      "unverified";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-001"),
      true
    );
  }
);

test(
  "AI taslağı doğrulanmış işaretlenemiyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.source.kind = "ai_draft";
    record.knowledgeStatus = "estimated";
    record.recordStatus = "draft";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-002"),
      true
    );
  }
);

test(
  "AI taslağı bilinen veri olarak sunulamıyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.source.kind = "ai_draft";
    record.recordStatus = "draft";
    record.verificationStatus =
      "unverified";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-003"),
      true
    );
  }
);

test(
  "Manuel kayıt dış kaynak doğrulaması taşıyamıyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.verificationStatus =
      "source_verified";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-005"),
      true
    );
  }
);

test(
  "Sistem hesabı hesaplama sürümü olmadan saklanamıyor",
  () => {
    const record =
      fixtures().nutrition_summary;
    record.calculationVersion = null;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-006"),
      true
    );
  }
);

test(
  "Planlanan öğün tüketim zamanı taşıyamıyor",
  () => {
    const record =
      fixtures().planned_meal;
    record.payload.consumedAt = EVENT;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-007"),
      true
    );
  }
);

test(
  "Gerçek öğün plan tarihi alanıyla plan nesnesine dönüştürülemiyor",
  () => {
    const record = fixtures().meal_entry;
    record.payload.plannedFor = EVENT;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-007"),
      true
    );
  }
);

test(
  "Bağlanmış plan ayrı gerçek öğün kimliği gerektiriyor",
  () => {
    const record = fixtures().planned_meal;
    record.payload.status = "linked";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(
        result,
        "NUT-PLANNED-MEAL-003"
      ),
      true
    );
  }
);

test(
  "Planlanmış fakat bağlanmamış öğün gerçek tüketim kimliği taşıyamıyor",
  () => {
    const record = fixtures().planned_meal;
    record.payload.mealEntryId =
      "meal-entry-1";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(
        result,
        "NUT-PLANNED-MEAL-004"
      ),
      true
    );
  }
);

test(
  "Aktivite referansı Health verisini kopyalayamıyor",
  () => {
    const record =
      fixtures().activity_reference;
    record.payload.calories = 400;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-007"),
      true
    );
  }
);

test(
  "Toparlanma referansı uyku ve HRV verisini kopyalayamıyor",
  () => {
    const record =
      fixtures().recovery_check;
    record.payload.hrv = 54;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-007"),
      true
    );
  }
);

test(
  "Kilo referansı ölçümü yeniden saklayamıyor",
  () => {
    const record =
      fixtures().weight_reference;
    record.payload.weight = 84;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-007"),
      true
    );
  }
);

test(
  "İçgörü nedensellik ilişkisi iddia edemiyor",
  () => {
    const record =
      fixtures().insight_snapshot;
    record.payload.relationshipType =
      "causal";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-008"),
      true
    );
  }
);

test(
  "İçgörü belirsizlik açıklaması olmadan üretilemiyor",
  () => {
    const record =
      fixtures().insight_snapshot;
    record.payload.uncertainty = "";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INSIGHT-002"),
      true
    );
  }
);

test(
  "Paylaşılmış rapor açık kullanıcı onayı olmadan geçmiyor",
  () => {
    const record =
      fixtures().report_snapshot;
    record.payload.sharing = {
      status: "shared",
      consent: null,
      method: "device_share"
    };
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-009"),
      true
    );
  }
);

test(
  "Açık onaylı cihaz paylaşımı rapor sözleşmesini karşılıyor",
  () => {
    const record =
      fixtures().report_snapshot;
    record.payload.sharing = {
      status: "shared",
      consent: {
        granted: true,
        purpose:
          "Kullanıcının seçtiği uzmanla raporu paylaşmak",
        grantedAt: LATER
      },
      method: "device_share"
    };
    assert.equal(
      api.validateRecord(record).valid,
      true
    );
  }
);

test(
  "Paylaşılmamış rapor artık paylaşım onayı taşıyamıyor",
  () => {
    const record =
      fixtures().report_snapshot;
    record.payload.sharing.consent = {
      granted: true,
      purpose: "Eski onay",
      grantedAt: LATER
    };
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-SHARING-003"),
      true
    );
  }
);

test(
  "Hatırlatıcı kullanıcı açmadan etkinleşemiyor",
  () => {
    const record =
      fixtures().nutrition_reminder;
    record.payload.userInitiated = false;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-INVARIANT-011"),
      true
    );
  }
);

test(
  "Hatırlatıcı yerel saat biçimini doğruluyor",
  () => {
    const record =
      fixtures().nutrition_reminder;
    record.payload.schedule.localTime =
      "25:90";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-REMINDER-006"),
      true
    );
  }
);

test(
  "Kayıt kümesinde yinelenen kimlik reddediliyor",
  () => {
    const first =
      fixtures().nutrition_profile;
    const second =
      fixtures().dietary_constraint;
    second.id = first.id;
    const result =
      api.validateRecordSet([
        first,
        second
      ]);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-SET-002"),
      true
    );
  }
);

test(
  "Kayıt kümesinde birden fazla etkin ana hedef reddediliyor",
  () => {
    const first =
      fixtures().nutrition_goal_version;
    const second = clone(first);
    second.id =
      "nutrition-goal-version-2";
    const result =
      api.validateRecordSet([
        first,
        second
      ]);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-SET-003"),
      true
    );
  }
);

test(
  "Kısmi dışa aktarmada eksik referans hata yerine görünür uyarı oluyor",
  () => {
    const result =
      api.validateRecordSet([
        fixtures().meal_entry
      ]);
    assert.equal(result.valid, true);
    assert.ok(result.warnings.length > 0);
    assert.equal(
      result.warnings[0].code,
      "NUT-SET-W001"
    );
  }
);

test(
  "Tam depo doğrulamasında eksik referans hata oluyor",
  () => {
    const result =
      api.validateRecordSet(
        [fixtures().meal_entry],
        {
          requireReferences: true
        }
      );
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-SET-004"),
      true
    );
  }
);

test(
  "Referans kimliği yanlış kayıt türüne bağlanamıyor",
  () => {
    const meal = fixtures().meal_entry;
    const wrong =
      fixtures().dietary_constraint;
    wrong.id = "meal-item-snapshot-1";
    const result =
      api.validateRecordSet([
        meal,
        wrong
      ]);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-SET-005"),
      true
    );
  }
);

test(
  "Plan ile gerçek tüketim ayrı kayıtlar olarak karşılıklı bağlanabiliyor",
  () => {
    const item =
      fixtures().meal_item_snapshot;
    const plan = fixtures().planned_meal;
    const meal = fixtures().meal_entry;

    item.id = "meal-item-snapshot-1";
    plan.id = "planned-meal-1";
    plan.payload.status = "linked";
    plan.payload.mealEntryId =
      "meal-entry-1";
    meal.id = "meal-entry-1";
    meal.payload.plannedMealId =
      "planned-meal-1";

    const result =
      api.validateRecordSet(
        [item, plan, meal],
        {
          requireReferences: true
        }
      );
    assert.equal(
      result.valid,
      true,
      JSON.stringify(result.errors)
    );
  }
);

test(
  "Geçerli kayıt oluşturucu bağımsız ve derin dondurulmuş nesne döndürüyor",
  () => {
    const candidate =
      fixtures().nutrition_profile;
    const created =
      api.createRecord(candidate);
    candidate.payload.trackingMode =
      "detailed";
    assert.equal(
      created.payload.trackingMode,
      "simple"
    );
    assert.equal(Object.isFrozen(created), true);
    assert.equal(
      Object.isFrozen(created.payload),
      true
    );
  }
);

test(
  "Geçersiz kayıt oluşturma ayrıntılı sözleşme hatası fırlatıyor",
  () => {
    const candidate =
      fixtures().nutrition_profile;
    candidate.schemaVersion = 99;

    assert.throws(
      () => api.createRecord(candidate),
      error =>
        error.code ===
          "NUT-CONTRACT-INVALID" &&
        Array.isArray(
          error.validationErrors
        )
    );
  }
);

test(
  "Döngüsel kayıt güvenli biçimde reddediliyor",
  () => {
    const candidate =
      fixtures().nutrition_profile;
    candidate.payload.self =
      candidate.payload;
    const result =
      api.validateRecord(candidate);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-SAFE-005"),
      true
    );
  }
);

test(
  "Sonlu olmayan sayısal değer JSON sözleşmesine giremiyor",
  () => {
    const candidate =
      fixtures().nutrition_profile;
    candidate.extensions = {
      "today.test": Infinity
    };
    const result =
      api.validateRecord(candidate);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-SAFE-003"),
      true
    );
  }
);

test(
  "Nesne derinliği güvenlik sınırını aşamıyor",
  () => {
    const candidate =
      fixtures().nutrition_profile;
    let cursor = {};
    candidate.extensions = {
      "today.deep": cursor
    };

    for (let index = 0; index < 12; index += 1) {
      cursor.next = {};
      cursor = cursor.next;
    }

    const result =
      api.validateRecord(candidate);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-SAFE-002"),
      true
    );
  }
);

test(
  "Hesaplanamayan besin değeri sıfıra dönüştürülmeden öğün anlık görüntüsünde korunuyor",
  () => {
    const record =
      fixtures().meal_item_snapshot;
    const result = api.validateRecord(record);
    assert.equal(result.valid, true);
    assert.equal(
      record.payload.nutrients
        .energy_kcal.status,
      "unknown"
    );
    assert.equal(
      record.payload.nutrients
        .energy_kcal.value,
      null
    );
  }
);

test(
  "Kütüphane öğesi kaynak sürümü olmadan anlık görüntüye alınamıyor",
  () => {
    const record =
      fixtures().meal_item_snapshot;
    record.payload.itemKind =
      "food_version";
    record.payload.referenceId =
      "food-version-1";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-SNAPSHOT-006"),
      true
    );
  }
);

test(
  "Kayıt kapsamı karşılaştırılabilir sayının toplamı aşmasını reddediyor",
  () => {
    const record =
      fixtures().nutrition_summary;
    record.payload.coverage
      .comparableRecordCount = 2;
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-COVERAGE-005"),
      true
    );
  }
);

test(
  "Rapor dönemi ters tarih aralığı taşıyamıyor",
  () => {
    const record =
      fixtures().report_snapshot;
    record.payload.period = {
      startDate: "2026-08-05",
      endDate: "2026-08-01"
    };
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-PERIOD-004"),
      true
    );
  }
);

test(
  "Health bağlantı nesnesi yalnız doğru ilişki türüne bağlanıyor",
  () => {
    const record =
      fixtures().activity_reference;
    record.payload.relation = "weight";
    const result = api.validateRecord(record);
    assert.equal(result.valid, false);
    assert.equal(
      hasCode(result, "NUT-HEALTH-REF-002"),
      true
    );
  }
);

test(
  "Sözleşme modülü UI, kalıcı depolama veya ağ API'si kullanmıyor",
  () => {
    [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "querySelector",
      "getElementById",
      "createElement",
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "navigator."
    ].forEach(text => {
      assert.equal(
        source.includes(text),
        false,
        text
      );
    });
  }
);

test(
  "Doğrulama sonucu ve hata listeleri değişmez dönüyor",
  () => {
    const record =
      fixtures().nutrition_profile;
    record.schemaVersion = 0;
    const result = api.validateRecord(record);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(
      Object.isFrozen(result.errors),
      true
    );
    assert.equal(
      Object.isFrozen(result.errors[0]),
      true
    );
  }
);

const failed = results.filter(
  result => !result.success
);

results.forEach(result => {
  const prefix =
    result.success
      ? "PASS"
      : "FAIL";
  const suffix =
    result.error
      ? ` — ${result.error}`
      : "";

  console.log(
    `${prefix}: ${result.name}${suffix}`
  );
});

console.log(
  `Nutrition Data Contracts: ${
    results.length - failed.length
  }/${results.length} başarılı`
);

if (failed.length > 0) {
  process.exitCode = 1;
}
