const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const CONTRACT_PATH =
  "modules/nutrition-contracts.js";
const CALCULATION_PATH =
  "modules/nutrition-calculations.js";
const RULES_PATH =
  "contracts/nutrition/v1/nutrition-unit-rules.json";

const contractSource = fs.readFileSync(
  CONTRACT_PATH,
  "utf8"
);
const calculationSource = fs.readFileSync(
  CALCULATION_PATH,
  "utf8"
);
const portableRules = JSON.parse(
  fs.readFileSync(RULES_PATH, "utf8")
);

function createRuntime() {
  const window = {};
  const context = {
    window,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Date,
    Set,
    Map,
    Error,
    JSON,
    Math
  };

  vm.runInNewContext(
    contractSource,
    context,
    { filename: CONTRACT_PATH }
  );
  vm.runInNewContext(
    calculationSource,
    context,
    { filename: CALCULATION_PATH }
  );

  return window;
}

const window = createRuntime();
const api =
  window.TodayNutritionCalculations;
const contracts =
  window.TodayNutritionContracts;

const NOW =
  "2026-08-05T12:00:00.000Z";
const LATER =
  "2026-08-05T12:05:00.000Z";

function plain(value) {
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

function estimated(value, unit, basis = "Yaklaşık porsiyon") {
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

function baseRecord(
  id,
  type,
  payload,
  overrides = {}
) {
  return {
    id,
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

function foodRecord(overrides = {}) {
  const base = baseRecord(
    "food-version-1",
    "food_version",
    {
      foodId: "food-yogurt",
      version: "1.0.0",
      name: "Yoğurt",
      servingBasis: known(100, "g"),
      nutrients: {
        energy: known(100, "kcal"),
        protein: known(10, "g")
      },
      referenceSourceIds: [
        "source-one"
      ]
    }
  );

  return {
    ...base,
    ...overrides,
    payload: {
      ...base.payload,
      ...(overrides.payload || {})
    }
  };
}

function snapshotRecord(
  id,
  nutrients,
  overrides = {}
) {
  const base = baseRecord(
    id,
    "meal_item_snapshot",
    {
      itemKind: "food_version",
      referenceId:
        `${id}-food-source`,
      name: `Bileşen ${id}`,
      amount: known(100, "g"),
      nutrients,
      sourceVersion: "1.0.0"
    }
  );

  return {
    ...base,
    ...overrides,
    payload: {
      ...base.payload,
      ...(overrides.payload || {})
    }
  };
}

function recipeRecord(overrides = {}) {
  const base = baseRecord(
    "recipe-version-1",
    "recipe_version",
    {
      recipeId: "recipe-bowl",
      version: "2.1.0",
      name: "Kase",
      yield: known(2, "portion"),
      ingredientSnapshotIds: [
        "ingredient-a",
        "ingredient-b"
      ]
    }
  );

  return {
    ...base,
    ...overrides,
    payload: {
      ...base.payload,
      ...(overrides.payload || {})
    }
  };
}

function recipeIngredients() {
  return [
    snapshotRecord(
      "ingredient-a",
      {
        energy: known(100, "kcal"),
        protein: known(10, "g")
      }
    ),
    snapshotRecord(
      "ingredient-b",
      {
        energy: known(50, "kcal"),
        protein: known(5, "g")
      },
      {
        payload: {
          amount: known(50, "g"),
          sourceVersion: "3.0.0"
        }
      }
    )
  ];
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
      error:
        `${error.message}${
          error.todayCode
            ? ` [${error.todayCode}]`
            : ""
        }`
    });
  }
}

test(
  "Hesaplama API'si v1 ve değişmez olarak yayımlanıyor",
  () => {
    assert.equal(
      api.CALCULATION_API_VERSION,
      1
    );
    assert.equal(Object.isFrozen(api), true);
  }
);

test(
  "Hesaplama ve birim kural seti kimlikleri sürümlü",
  () => {
    assert.equal(
      api.CALCULATION_VERSION,
      "nutrition-calc-v1"
    );
    assert.equal(
      api.UNIT_RULESET_ID,
      "today:nutrition:units:v1"
    );
    assert.equal(api.UNIT_RULESET_VERSION, 1);
  }
);

test(
  "Taşınabilir birim dosyası çalışma zamanı kimlikleriyle eşleşiyor",
  () => {
    assert.equal(
      portableRules.ruleSetId,
      api.UNIT_RULESET_ID
    );
    assert.equal(
      portableRules.calculationVersion,
      api.CALCULATION_VERSION
    );
    assert.equal(
      portableRules.precisionDigits,
      api.PRECISION_DIGITS
    );
  }
);

test(
  "Taşınabilir boyut kuralları çalışma zamanı kurallarıyla aynı",
  () => {
    assert.deepEqual(
      plain(api.UNIT_RULES),
      portableRules.dimensions
    );
    assert.deepEqual(
      Array.from(api.CONTEXTUAL_UNITS),
      portableRules.contextualUnits
    );
  }
);

test(
  "Birim listesi sıralı ve değişmez dönüyor",
  () => {
    const units = api.listUnits();
    assert.deepEqual(
      Array.from(units),
      [...units].sort()
    );
    assert.equal(Object.isFrozen(units), true);
  }
);

test(
  "Çalışma zamanı birim kuralları derin dondurulmuş",
  () => {
    assert.equal(
      Object.isFrozen(api.UNIT_RULES),
      true
    );
    assert.equal(
      Object.isFrozen(
        api.UNIT_RULES.mass.units.g
      ),
      true
    );
  }
);

test(
  "Metrik kütle birimi boyut ve kesir izini gösteriyor",
  () => {
    assert.deepEqual(
      plain(api.inspectUnit("mg")),
      {
        unit: "mg",
        dimension: "mass",
        baseUnit: "g",
        contextual: false,
        numerator: 1,
        denominator: 1000
      }
    );
  }
);

test(
  "Bağlamsal porsiyon birimi yalnız kendi kimliğiyle tanımlı",
  () => {
    const unit = api.inspectUnit("portion");
    assert.equal(unit.contextual, true);
    assert.equal(
      unit.dimension,
      "contextual:portion"
    );
  }
);

test(
  "Bilinmeyen birim incelemesi null dönüyor",
  () => {
    assert.equal(
      api.inspectUnit("cup"),
      null
    );
  }
);

test(
  "Hesaplama motoru UI, depolama, ağ ve AI çağrısı kullanmıyor",
  () => {
    [
      /\blocalStorage\b/,
      /\bindexedDB\b/,
      /\bfetch\s*\(/,
      /\bdocument\./,
      /TodayAI/
    ].forEach(pattern => {
      assert.equal(
        pattern.test(calculationSource),
        false,
        String(pattern)
      );
    });
  }
);

[
  ["g", "kg", true, "Gram ve kilogram uyumlu"],
  ["mg", "mcg", true, "Miligram ve mikrogram uyumlu"],
  ["ml", "l", true, "Mililitre ve litre uyumlu"],
  ["kcal", "kj", true, "Kilokalori ve kilojul uyumlu"],
  ["portion", "portion", true, "Porsiyon kimliği kendi içinde uyumlu"],
  ["portion", "serving", false, "Porsiyon ve servis varsayımla eşitlenmiyor"],
  ["g", "ml", false, "Kütle ve hacim yoğunluk olmadan çevrilmiyor"],
  ["cup", "ml", false, "Tanımsız birim dönüştürülemiyor"]
].forEach(([from, to, expected, name]) => {
  test(name, () => {
    assert.equal(
      api.canConvert(from, to),
      expected
    );
  });
});

[
  [1, "kg", "g", 1000, "Kilogram grama doğru çevriliyor"],
  [1000, "g", "kg", 1, "Gram kilograma doğru çevriliyor"],
  [1000, "mg", "g", 1, "Miligram grama doğru çevriliyor"],
  [1, "g", "mg", 1000, "Gram miligrama doğru çevriliyor"],
  [1000, "mcg", "mg", 1, "Mikrogram miligrama doğru çevriliyor"],
  [1, "l", "ml", 1000, "Litre mililitreye doğru çevriliyor"],
  [2, "cl", "ml", 20, "Santilitre mililitreye doğru çevriliyor"],
  [5, "dl", "l", 0.5, "Desilitre litreye doğru çevriliyor"],
  [100, "kcal", "kj", 418.4, "Kilokalori kilojule doğru çevriliyor"],
  [418.4, "kj", "kcal", 100, "Kilojul kilokaloriye doğru çevriliyor"]
].forEach(([value, from, to, expected, name]) => {
  test(name, () => {
    assert.equal(
      api.convertValue(value, from, to),
      expected
    );
  });
});

test(
  "Gerçek sıfır birim dönüşümünde sıfır olarak korunuyor",
  () => {
    assert.equal(
      api.convertValue(0, "g", "kg"),
      0
    );
  }
);

test(
  "Dönüşüm sonucu on iki basamakta deterministik yuvarlanıyor",
  () => {
    assert.equal(
      api.convertValue(1, "mg", "kg"),
      0.000001
    );
  }
);

test(
  "Bilinen ölçüm birimi ve değeri birlikte çevriliyor",
  () => {
    assert.deepEqual(
      plain(
        api.convertMeasurement(
          known(2500, "mg"),
          "g"
        )
      ),
      known(2.5, "g")
    );
  }
);

test(
  "Tahmini ölçüm dönüşümünde bilgi durumu ve dayanak korunuyor",
  () => {
    const result = api.convertMeasurement(
      estimated(1.5, "l", "Bardak tahmini"),
      "ml"
    );
    assert.equal(result.status, "estimated");
    assert.equal(result.value, 1500);
    assert.equal(result.basis, "Bardak tahmini");
  }
);

test(
  "Bilinmeyen ölçüm dönüşümde sıfıra çevrilmiyor",
  () => {
    assert.deepEqual(
      plain(
        api.convertMeasurement(
          unknown("g"),
          "kg"
        )
      ),
      unknown("kg")
    );
  }
);

test(
  "Ölçüm dönüşümü kaynağı değiştirmiyor",
  () => {
    const source = known(1000, "mg");
    api.convertMeasurement(source, "g");
    assert.deepEqual(
      source,
      known(1000, "mg")
    );
  }
);

test(
  "Dönüştürülen ölçüm değişmez dönüyor",
  () => {
    const result = api.convertMeasurement(
      known(1, "kg"),
      "g"
    );
    assert.equal(Object.isFrozen(result), true);
  }
);

[
  [
    () => api.convertValue(NaN, "g", "kg"),
    "TODAY-NUTRITION-CALC-005",
    "Sonlu olmayan değer reddediliyor"
  ],
  [
    () => api.convertValue(-1, "g", "kg"),
    "TODAY-NUTRITION-CALC-005",
    "Negatif beslenme miktarı reddediliyor"
  ],
  [
    () => api.convertValue(1, "cup", "ml"),
    "TODAY-NUTRITION-CALC-003",
    "Tanımsız kaynak birimi açık hatayla reddediliyor"
  ],
  [
    () => api.convertValue(1, "ml", "cup"),
    "TODAY-NUTRITION-CALC-003",
    "Tanımsız hedef birimi açık hatayla reddediliyor"
  ],
  [
    () => api.convertValue(1, "g", "ml"),
    "TODAY-NUTRITION-CALC-004",
    "Uyumsuz boyutlar yoğunluk varsayılmadan reddediliyor"
  ],
  [
    () => api.convertMeasurement(unknown(), "g"),
    "TODAY-NUTRITION-CALC-003",
    "Kaynak birimi bilinmeyen ölçüm dönüştürülmüyor"
  ],
  [
    () => api.convertMeasurement(
      {
        status: "unknown",
        value: 0,
        unit: "g",
        basis: null
      },
      "kg"
    ),
    "TODAY-NUTRITION-CALC-002",
    "Sıfırla maskelenmiş bilinmeyen ölçüm reddediliyor"
  ]
].forEach(([callback, code, name]) => {
  test(name, () => {
    assert.throws(
      callback,
      error => error.todayCode === code
    );
  });
});

test(
  "Bilinen kaynak ve hedef deterministik ölçek katsayısı üretiyor",
  () => {
    const factor = api.calculateScaleFactor(
      known(100, "g"),
      known(250, "g")
    );
    assert.equal(factor.status, "known");
    assert.equal(factor.value, 2.5);
  }
);

test(
  "Hedef önce kaynak birimine çevrilerek oranlanıyor",
  () => {
    const factor = api.calculateScaleFactor(
      known(500, "g"),
      known(1, "kg")
    );
    assert.equal(factor.value, 2);
  }
);

test(
  "Tahmini girdi ölçek katsayısını tahmini ve açıklanabilir yapıyor",
  () => {
    const factor = api.calculateScaleFactor(
      known(1, "portion"),
      estimated(2, "portion")
    );
    assert.equal(factor.status, "estimated");
    assert.ok(factor.basis);
  }
);

test(
  "Bilinmeyen kaynak oranı sıfır yerine bilinmeyen kalıyor",
  () => {
    const factor = api.calculateScaleFactor(
      unknown("g"),
      known(100, "g")
    );
    assert.equal(factor.status, "unknown");
    assert.equal(factor.value, null);
  }
);

test(
  "Bilinmeyen hedef oranı sıfır yerine bilinmeyen kalıyor",
  () => {
    const factor = api.calculateScaleFactor(
      known(100, "g"),
      unknown("g")
    );
    assert.equal(factor.status, "unknown");
  }
);

test(
  "Sıfır kaynak miktarı bölme yapılmadan reddediliyor",
  () => {
    assert.throws(
      () => api.calculateScaleFactor(
        known(0, "g"),
        known(10, "g")
      ),
      error =>
        error.todayCode ===
        "TODAY-NUTRITION-CALC-007"
    );
  }
);

test(
  "Bilinen ölçüm bilinen katsayıyla doğru ölçekleniyor",
  () => {
    assert.equal(
      api.scaleMeasurement(
        known(12, "g"),
        2.5
      ).value,
      30
    );
  }
);

test(
  "Tahmini ölçüm ölçeklemede tahmini kalıyor",
  () => {
    const result = api.scaleMeasurement(
      estimated(10, "g"),
      2
    );
    assert.equal(result.status, "estimated");
    assert.ok(result.basis);
  }
);

test(
  "Tahmini katsayı bilinen ölçümün sonucunu tahmini yapıyor",
  () => {
    const result = api.scaleMeasurement(
      known(10, "g"),
      {
        status: "estimated",
        value: 1.5,
        basis: "Yaklaşık hedef"
      }
    );
    assert.equal(result.status, "estimated");
    assert.equal(result.value, 15);
  }
);

test(
  "Bilinmeyen ölçüm ölçeklemede sıfıra dönüşmüyor",
  () => {
    assert.deepEqual(
      plain(
        api.scaleMeasurement(
          unknown("g"),
          5
        )
      ),
      unknown("g")
    );
  }
);

test(
  "Bilinmeyen katsayı bilinen ölçümü kesin sonuç yapmıyor",
  () => {
    const result = api.scaleMeasurement(
      known(10, "g"),
      {
        status: "unknown",
        value: null,
        basis: null
      }
    );
    assert.equal(result.status, "unknown");
    assert.equal(result.value, null);
  }
);

test(
  "Tahmini katsayı dayanak olmadan kullanılamıyor",
  () => {
    assert.throws(
      () => api.scaleMeasurement(
        known(10, "g"),
        {
          status: "estimated",
          value: 2,
          basis: null
        }
      ),
      error =>
        error.todayCode ===
        "TODAY-NUTRITION-CALC-005"
    );
  }
);

test(
  "Besin haritası anahtar sırasından bağımsız sabit sırada ölçekleniyor",
  () => {
    const result = api.scaleNutrientMap(
      {
        protein: known(10, "g"),
        energy: known(100, "kcal")
      },
      2
    );
    assert.deepEqual(
      Object.keys(result),
      ["energy", "protein"]
    );
  }
);

test(
  "Besin haritası ölçeklemesi kaynak haritayı değiştirmiyor",
  () => {
    const source = {
      protein: known(10, "g")
    };
    api.scaleNutrientMap(source, 3);
    assert.equal(source.protein.value, 10);
  }
);

test(
  "Besin hesabı porsiyon oranını doğru kuruyor",
  () => {
    const result = api.calculateFoodNutrients(
      foodRecord(),
      known(250, "g")
    );
    assert.equal(result.scaleFactor.value, 2.5);
  }
);

test(
  "Besin hesabı enerji ve makroyu deterministik ölçekliyor",
  () => {
    const result = api.calculateFoodNutrients(
      foodRecord(),
      known(250, "g")
    );
    assert.equal(result.nutrients.energy.value, 250);
    assert.equal(result.nutrients.protein.value, 25);
  }
);

test(
  "Kaynak porsiyonla aynı miktar besin değerini değiştirmiyor",
  () => {
    const result = api.calculateFoodNutrients(
      foodRecord(),
      known(100, "g")
    );
    assert.equal(result.nutrients.energy.value, 100);
  }
);

test(
  "Tahmini istenen porsiyon hesaplanan değerleri tahmini yapıyor",
  () => {
    const result = api.calculateFoodNutrients(
      foodRecord(),
      estimated(150, "g")
    );
    assert.equal(
      result.nutrients.energy.status,
      "estimated"
    );
  }
);

test(
  "Kaynakta bilinmeyen besin değeri hesapta bilinmeyen kalıyor",
  () => {
    const result = api.calculateFoodNutrients(
      foodRecord({
        payload: {
          nutrients: {
            energy: known(100, "kcal"),
            protein: unknown("g")
          }
        }
      }),
      known(200, "g")
    );
    assert.equal(
      result.nutrients.protein.status,
      "unknown"
    );
  }
);

test(
  "Bilinmeyen istenen porsiyon bütün hesabı sıfır yerine bilinmeyen yapıyor",
  () => {
    const result = api.calculateFoodNutrients(
      foodRecord(),
      unknown("g")
    );
    assert.equal(
      result.nutrients.energy.value,
      null
    );
    assert.equal(
      result.nutrients.protein.value,
      null
    );
  }
);

test(
  "Besin hesabı kaynak kayıt, mantıksal kimlik ve sürüm izini koruyor",
  () => {
    const result = api.calculateFoodNutrients(
      foodRecord(),
      known(100, "g")
    );
    assert.deepEqual(
      plain(result.source),
      {
        recordId: "food-version-1",
        logicalId: "food-yogurt",
        version: "1.0.0",
        name: "Yoğurt"
      }
    );
  }
);

test(
  "Kısmen bilinmeyen besin hesabı kapsamı partial gösteriyor",
  () => {
    const result = api.calculateFoodNutrients(
      foodRecord({
        payload: {
          nutrients: {
            energy: known(100, "kcal"),
            protein: unknown("g")
          }
        }
      }),
      known(100, "g")
    );
    assert.equal(result.coverage.status, "partial");
    assert.equal(
      result.coverage.unknownNutrientCount,
      1
    );
  }
);

test(
  "Geçersiz besin kaydı hesaplamaya alınmıyor",
  () => {
    assert.throws(
      () => api.calculateFoodNutrients(
        foodRecord({ schemaVersion: 2 }),
        known(100, "g")
      ),
      error =>
        error.todayCode ===
        "TODAY-NUTRITION-CALC-008"
    );
  }
);

test(
  "Aynı birimde besin değerleri doğru toplanıyor",
  () => {
    const result = api.aggregateNutrients([
      {
        id: "a",
        nutrients: {
          energy: known(100, "kcal")
        }
      },
      {
        id: "b",
        nutrients: {
          energy: known(50, "kcal")
        }
      }
    ]);
    assert.equal(result.nutrients.energy.value, 150);
  }
);

test(
  "Uyumlu farklı enerji birimleri ortak birimde toplanıyor",
  () => {
    const result = api.aggregateNutrients([
      {
        id: "a",
        nutrients: {
          energy: known(100, "kcal")
        }
      },
      {
        id: "b",
        nutrients: {
          energy: known(418.4, "kj")
        }
      }
    ]);
    assert.equal(result.nutrients.energy.value, 200);
    assert.equal(result.nutrients.energy.unit, "kcal");
  }
);

test(
  "Açık hedef birimi toplama sonucunu değiştirebiliyor",
  () => {
    const result = api.aggregateNutrients(
      [
        {
          id: "a",
          nutrients: {
            energy: known(100, "kcal")
          }
        },
        {
          id: "b",
          nutrients: {
            energy: known(100, "kcal")
          }
        }
      ],
      {
        targetUnits: {
          energy: "kj"
        }
      }
    );
    assert.equal(result.nutrients.energy.value, 836.8);
    assert.equal(result.nutrients.energy.unit, "kj");
  }
);

test(
  "Tahmini katkı toplamın bilgi durumunu tahmini yapıyor",
  () => {
    const result = api.aggregateNutrients([
      {
        id: "a",
        nutrients: {
          protein: known(10, "g")
        }
      },
      {
        id: "b",
        nutrients: {
          protein: estimated(5, "g")
        }
      }
    ]);
    assert.equal(
      result.nutrients.protein.status,
      "estimated"
    );
    assert.ok(result.nutrients.protein.basis);
  }
);

test(
  "Bilinmeyen katkı nihai toplamda sıfır sayılmıyor",
  () => {
    const result = api.aggregateNutrients([
      {
        id: "a",
        nutrients: {
          protein: known(10, "g")
        }
      },
      {
        id: "b",
        nutrients: {
          protein: unknown("g")
        }
      }
    ]);
    assert.equal(
      result.nutrients.protein.status,
      "unknown"
    );
    assert.equal(result.nutrients.protein.value, null);
  }
);

test(
  "Eksik besin alanı sıfır katkı kabul edilmiyor",
  () => {
    const result = api.aggregateNutrients([
      {
        id: "a",
        nutrients: {
          energy: known(100, "kcal")
        }
      },
      {
        id: "b",
        nutrients: {
          protein: known(10, "g")
        }
      }
    ]);
    assert.equal(
      result.nutrients.energy.status,
      "unknown"
    );
    assert.equal(
      result.nutrients.protein.status,
      "unknown"
    );
  }
);

test(
  "Eksik katkıda bilinen ara toplam izlenebilir fakat nihai değer değildir",
  () => {
    const result = api.aggregateNutrients([
      {
        id: "a",
        nutrients: {
          energy: known(100, "kcal")
        }
      },
      {
        id: "b",
        nutrients: {}
      }
    ]);
    assert.equal(result.nutrients.energy.value, null);
    assert.equal(
      result.details.energy
        .partialSubtotal.value,
      100
    );
    assert.deepEqual(
      Array.from(
        result.details.energy
          .missingRecordIds
      ),
      ["b"]
    );
  }
);

test(
  "Uyumsuz besin birimleri toplama sırasında reddediliyor",
  () => {
    assert.throws(
      () => api.aggregateNutrients([
        {
          id: "a",
          nutrients: {
            nutrient: known(10, "g")
          }
        },
        {
          id: "b",
          nutrients: {
            nutrient: known(10, "ml")
          }
        }
      ]),
      error =>
        error.todayCode ===
        "TODAY-NUTRITION-CALC-004"
    );
  }
);

test(
  "Toplama ayrıntıları ve kapsam dışarıdan değiştirilemiyor",
  () => {
    const result = api.aggregateNutrients([
      {
        id: "a",
        nutrients: {
          energy: known(1, "kcal")
        }
      }
    ]);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(
      Object.isFrozen(result.details.energy),
      true
    );
  }
);

test(
  "Toplama sonucu besin anahtarlarını sabit sırada üretiyor",
  () => {
    const result = api.aggregateNutrients([
      {
        id: "a",
        nutrients: {
          protein: known(1, "g"),
          energy: known(1, "kcal")
        }
      }
    ]);
    assert.deepEqual(
      Object.keys(result.nutrients),
      ["energy", "protein"]
    );
  }
);

test(
  "Tarif hedef porsiyona göre bileşen miktarlarını ölçekliyor",
  () => {
    const result = api.scaleRecipe(
      recipeRecord(),
      recipeIngredients(),
      known(4, "portion")
    );
    assert.equal(result.scaleFactor.value, 2);
    assert.equal(
      result.scaledIngredients[0]
        .scaledAmount.value,
      200
    );
  }
);

test(
  "Tarif ölçekleme kaynak bileşen ve sürüm izini koruyor",
  () => {
    const result = api.scaleRecipe(
      recipeRecord(),
      recipeIngredients(),
      known(4, "portion")
    );
    assert.equal(
      result.scaledIngredients[1]
        .sourceSnapshotId,
      "ingredient-b"
    );
    assert.equal(
      result.scaledIngredients[1]
        .sourceVersion,
      "3.0.0"
    );
  }
);

test(
  "Tarif besin toplamı ölçeklenmiş bileşenlerden hesaplanıyor",
  () => {
    const result =
      api.calculateRecipeNutrients(
        recipeRecord(),
        recipeIngredients(),
        known(4, "portion")
      );
    assert.equal(result.nutrients.energy.value, 300);
    assert.equal(result.nutrients.protein.value, 30);
  }
);

test(
  "Tarif bileşenleri çağrı sırasına değil tarif sürümü sırasına bağlanıyor",
  () => {
    const ingredients = recipeIngredients();
    const result = api.scaleRecipe(
      recipeRecord(),
      [...ingredients].reverse(),
      known(2, "portion")
    );
    assert.deepEqual(
      Array.from(
        result.scaledIngredients.map(
          item => item.sourceSnapshotId
        )
      ),
      ["ingredient-a", "ingredient-b"]
    );
  }
);

test(
  "Eksik tarif bileşeni sessizce sıfır sayılmadan reddediliyor",
  () => {
    assert.throws(
      () => api.scaleRecipe(
        recipeRecord(),
        recipeIngredients().slice(0, 1),
        known(2, "portion")
      ),
      error =>
        error.todayCode ===
        "TODAY-NUTRITION-CALC-011"
    );
  }
);

test(
  "Tarif sürümünde olmayan fazla bileşen hesaba karıştırılmıyor",
  () => {
    assert.throws(
      () => api.scaleRecipe(
        recipeRecord(),
        [
          ...recipeIngredients(),
          snapshotRecord(
            "ingredient-c",
            {
              energy: known(10, "kcal")
            }
          )
        ],
        known(2, "portion")
      ),
      error =>
        error.todayCode ===
        "TODAY-NUTRITION-CALC-011"
    );
  }
);

test(
  "Öğün hesabı doğrulanmış anlık görüntüleri deterministik topluyor",
  () => {
    const result =
      api.calculateMealNutrients(
        recipeIngredients()
      );
    assert.equal(result.nutrients.energy.value, 150);
    assert.deepEqual(
      Array.from(result.usedRecordIds),
      ["ingredient-a", "ingredient-b"]
    );
  }
);

test(
  "Hesaplanmış anlık görüntü sözleşme ve calculationVersion taşıyor",
  () => {
    const calculation =
      api.calculateFoodNutrients(
        foodRecord(),
        known(150, "g")
      );
    const record =
      api.buildCalculatedSnapshot({
        id: "calculated-item-1",
        createdAt: NOW,
        updatedAt: LATER,
        calculation
      });
    const validation =
      contracts.validateRecord(record);

    assert.equal(validation.valid, true);
    assert.equal(
      record.source.kind,
      "system_calculation"
    );
    assert.equal(
      record.calculationVersion,
      api.CALCULATION_VERSION
    );
  }
);

test(
  "Bilinmeyen hesap kayıtlaşınca bilinmeyen kalıyor ve yabancı sürüm reddediliyor",
  () => {
    const calculation =
      api.calculateFoodNutrients(
        foodRecord(),
        unknown("g")
      );
    const record =
      api.buildCalculatedSnapshot({
        id: "calculated-item-unknown",
        createdAt: NOW,
        calculation
      });

    assert.equal(
      record.knowledgeStatus,
      "unknown"
    );
    assert.equal(
      record.payload.nutrients.energy.value,
      null
    );

    assert.throws(
      () => api.buildCalculatedSnapshot({
        id: "forged-item",
        createdAt: NOW,
        calculation: {
          ...plain(calculation),
          calculationVersion:
            "foreign-engine-v1"
        }
      }),
      error =>
        error.todayCode ===
        "TODAY-NUTRITION-CALC-013"
    );
  }
);

if (results.length !== 84) {
  throw new Error(
    `NUT-003 test matrisi 84 yerine ${results.length} test içeriyor.`
  );
}

const failed = results.filter(
  result => !result.success
);

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

console.log(
  `Nutrition Calculations: ${
    results.length - failed.length
  }/${results.length} başarılı`
);

if (failed.length > 0) {
  process.exitCode = 1;
}
