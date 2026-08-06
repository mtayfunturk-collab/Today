/**
 * Today App — Deterministic Nutrition Calculations
 * NUT-003 — Unit conversion, recipe scaling and nutrient calculation engine
 *
 * This module is UI-, storage-, network- and AI-agnostic. It never persists a
 * result by itself. Every record candidate is validated through NUT-001 before
 * NUT-002 can accept it.
 */

(function () {
  "use strict";

  const CALCULATION_API_VERSION = 1;
  const CALCULATION_VERSION =
    "nutrition-calc-v1";
  const UNIT_RULESET_ID =
    "today:nutrition:units:v1";
  const UNIT_RULESET_VERSION = 1;
  const PRECISION_DIGITS = 12;

  const IDENTIFIER_PATTERN =
    /^[a-z0-9](?:[a-z0-9._:-]{0,78}[a-z0-9])?$/;

  const UNIT_RULES = deepFreeze({
    mass: {
      baseUnit: "g",
      units: {
        mcg: {
          numerator: 1,
          denominator: 1000000
        },
        mg: {
          numerator: 1,
          denominator: 1000
        },
        g: {
          numerator: 1,
          denominator: 1
        },
        kg: {
          numerator: 1000,
          denominator: 1
        }
      }
    },
    volume: {
      baseUnit: "ml",
      units: {
        ml: {
          numerator: 1,
          denominator: 1
        },
        cl: {
          numerator: 10,
          denominator: 1
        },
        dl: {
          numerator: 100,
          denominator: 1
        },
        l: {
          numerator: 1000,
          denominator: 1
        }
      }
    },
    energy: {
      baseUnit: "kj",
      units: {
        kj: {
          numerator: 1,
          denominator: 1
        },
        kcal: {
          numerator: 4184,
          denominator: 1000
        }
      }
    }
  });

  const CONTEXTUAL_UNITS = Object.freeze([
    "count",
    "piece",
    "portion",
    "serving",
    "slice"
  ]);

  const UNIT_LOOKUP = createUnitLookup();

  function createError(
    code,
    message,
    details = null
  ) {
    const error = new Error(message);
    error.name =
      "TodayNutritionCalculationError";
    error.todayCode = code;
    error.details = details;
    return error;
  }

  function isPlainObject(value) {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return false;
    }

    const prototype =
      Object.getPrototypeOf(value);

    return (
      prototype === Object.prototype ||
      prototype === null ||
      (
        Object.prototype.toString.call(value) ===
          "[object Object]" &&
        prototype &&
        prototype.constructor &&
        prototype.constructor.name === "Object"
      )
    );
  }

  function hasOwn(value, key) {
    return Boolean(
      value &&
      Object.prototype.hasOwnProperty.call(
        value,
        key
      )
    );
  }

  function clone(value) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== "object"
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(clone);
    }

    const result = {};

    Object.keys(value).forEach(key => {
      result[key] = clone(value[key]);
    });

    return result;
  }

  function deepFreeze(value) {
    if (
      value === null ||
      typeof value !== "object" ||
      Object.isFrozen(value)
    ) {
      return value;
    }

    Object.keys(value).forEach(key => {
      deepFreeze(value[key]);
    });

    return Object.freeze(value);
  }

  function freezeClone(value) {
    return deepFreeze(clone(value));
  }

  function createUnitLookup() {
    const lookup = new Map();

    Object.entries(UNIT_RULES).forEach(
      ([dimension, definition]) => {
        Object.entries(
          definition.units
        ).forEach(([unit, factor]) => {
          lookup.set(unit, {
            unit,
            dimension,
            baseUnit:
              definition.baseUnit,
            contextual: false,
            numerator:
              factor.numerator,
            denominator:
              factor.denominator
          });
        });
      }
    );

    CONTEXTUAL_UNITS.forEach(unit => {
      lookup.set(unit, {
        unit,
        dimension: `contextual:${unit}`,
        baseUnit: unit,
        contextual: true,
        numerator: 1,
        denominator: 1
      });
    });

    return lookup;
  }

  function getContracts() {
    const contracts =
      window.TodayNutritionContracts;

    const missing = [
      "validateMeasurement",
      "validateRecord",
      "createRecord"
    ].filter(
      methodName =>
        !contracts ||
        typeof contracts[methodName] !==
          "function"
    );

    if (
      missing.length > 0 ||
      !Number.isInteger(
        contracts?.CONTRACT_VERSION
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-001",
        "Beslenme veri sözleşmesi hazır değil.",
        { missing }
      );
    }

    return contracts;
  }

  function roundNumber(value) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value)
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-006",
        "Hesaplama sonlu bir sayı üretmedi."
      );
    }

    const rounded = Number(
      value.toFixed(PRECISION_DIGITS)
    );

    if (!Number.isFinite(rounded)) {
      throw createError(
        "TODAY-NUTRITION-CALC-006",
        "Hesaplama güvenli sayı sınırını aştı."
      );
    }

    return Object.is(rounded, -0)
      ? 0
      : rounded;
  }

  function assertScalar(value, path) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-005",
        "Dönüştürülecek değer sonlu ve negatif olmayan bir sayı olmalıdır.",
        { path }
      );
    }
  }

  function getUnitInfo(unit) {
    return UNIT_LOOKUP.get(unit) || null;
  }

  function inspectUnit(unit) {
    const info = getUnitInfo(unit);
    return info
      ? freezeClone(info)
      : null;
  }

  function listUnits() {
    return Object.freeze(
      [...UNIT_LOOKUP.keys()]
        .sort()
    );
  }

  function canConvert(fromUnit, toUnit) {
    const from = getUnitInfo(fromUnit);
    const to = getUnitInfo(toUnit);

    return Boolean(
      from &&
      to &&
      from.dimension === to.dimension &&
      (
        !from.contextual ||
        from.unit === to.unit
      )
    );
  }

  function assertConvertible(
    fromUnit,
    toUnit,
    path = "$"
  ) {
    const from = getUnitInfo(fromUnit);
    const to = getUnitInfo(toUnit);

    if (!from || !to) {
      throw createError(
        "TODAY-NUTRITION-CALC-003",
        "Birim bu kural setinde tanımlı değil.",
        {
          path,
          fromUnit,
          toUnit
        }
      );
    }

    if (!canConvert(fromUnit, toUnit)) {
      throw createError(
        "TODAY-NUTRITION-CALC-004",
        "Birimler güvenli biçimde birbirine dönüştürülemez.",
        {
          path,
          fromUnit,
          toUnit
        }
      );
    }

    return { from, to };
  }

  function convertValue(
    value,
    fromUnit,
    toUnit
  ) {
    assertScalar(value, "$.value");
    const { from, to } =
      assertConvertible(
        fromUnit,
        toUnit
      );

    const baseValue =
      value *
      from.numerator /
      from.denominator;
    const converted =
      baseValue *
      to.denominator /
      to.numerator;

    return roundNumber(converted);
  }

  function assertMeasurement(
    measurement,
    path = "$"
  ) {
    const contracts = getContracts();
    const validation =
      contracts.validateMeasurement(
        measurement,
        { path }
      );

    if (!validation.valid) {
      throw createError(
        "TODAY-NUTRITION-CALC-002",
        "Ölçüm beslenme sözleşmesini karşılamıyor.",
        {
          path,
          validationErrors:
            validation.errors
        }
      );
    }

    return measurement;
  }

  function convertMeasurement(
    measurement,
    targetUnit
  ) {
    assertMeasurement(measurement);

    if (measurement.unit === null) {
      throw createError(
        "TODAY-NUTRITION-CALC-003",
        "Kaynak birimi bilinmeyen ölçüm dönüştürülemez.",
        { targetUnit }
      );
    }

    assertConvertible(
      measurement.unit,
      targetUnit
    );

    if (measurement.status === "unknown") {
      return freezeClone({
        status: "unknown",
        value: null,
        unit: targetUnit,
        basis: null
      });
    }

    return freezeClone({
      status: measurement.status,
      value: convertValue(
        measurement.value,
        measurement.unit,
        targetUnit
      ),
      unit: targetUnit,
      basis: measurement.basis
    });
  }

  function mergeBasis(
    values,
    fallback
  ) {
    const unique = [];

    values.forEach(value => {
      if (
        typeof value === "string" &&
        value.trim() &&
        !unique.includes(value.trim())
      ) {
        unique.push(value.trim());
      }
    });

    if (unique.length === 0) {
      unique.push(fallback);
    }

    const joined = unique.join(" | ");
    return joined.length <= 4000
      ? joined
      : joined.slice(0, 4000);
  }

  function normalizeFactor(factor) {
    if (typeof factor === "number") {
      assertScalar(factor, "$.factor");
      return {
        status: "known",
        value: factor,
        basis: null
      };
    }

    if (!isPlainObject(factor)) {
      throw createError(
        "TODAY-NUTRITION-CALC-005",
        "Ölçek katsayısı geçersiz."
      );
    }

    if (
      ![
        "known",
        "estimated",
        "unknown"
      ].includes(factor.status)
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-005",
        "Ölçek katsayısı bilgi durumu geçersiz."
      );
    }

    if (factor.status === "unknown") {
      if (factor.value !== null) {
        throw createError(
          "TODAY-NUTRITION-CALC-005",
          "Bilinmeyen ölçek katsayısı null olmalıdır."
        );
      }

      return {
        status: "unknown",
        value: null,
        basis: null
      };
    }

    assertScalar(factor.value, "$.factor.value");

    if (
      factor.status === "estimated" &&
      (
        typeof factor.basis !== "string" ||
        !factor.basis.trim()
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-005",
        "Tahmini ölçek katsayısında dayanak zorunludur."
      );
    }

    return {
      status: factor.status,
      value: factor.value,
      basis:
        factor.status === "estimated"
          ? factor.basis
          : null
    };
  }

  function calculateScaleFactor(
    sourceMeasurement,
    targetMeasurement
  ) {
    assertMeasurement(
      sourceMeasurement,
      "$.sourceMeasurement"
    );
    assertMeasurement(
      targetMeasurement,
      "$.targetMeasurement"
    );

    if (
      sourceMeasurement.unit === null ||
      targetMeasurement.unit === null
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-003",
        "Ölçekleme için kaynak ve hedef birimleri bilinmelidir."
      );
    }

    assertConvertible(
      targetMeasurement.unit,
      sourceMeasurement.unit
    );

    if (
      sourceMeasurement.status !==
        "unknown" &&
      sourceMeasurement.value === 0
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-007",
        "Sıfır kaynak miktarı üzerinden ölçek hesaplanamaz."
      );
    }

    if (
      sourceMeasurement.status ===
        "unknown" ||
      targetMeasurement.status ===
        "unknown"
    ) {
      return freezeClone({
        status: "unknown",
        value: null,
        basis: null,
        sourceUnit:
          sourceMeasurement.unit,
        targetUnit:
          targetMeasurement.unit
      });
    }

    const convertedTarget =
      convertMeasurement(
        targetMeasurement,
        sourceMeasurement.unit
      );
    const status =
      sourceMeasurement.status ===
        "estimated" ||
      targetMeasurement.status ===
        "estimated"
        ? "estimated"
        : "known";

    return freezeClone({
      status,
      value: roundNumber(
        convertedTarget.value /
        sourceMeasurement.value
      ),
      basis:
        status === "estimated"
          ? mergeBasis(
              [
                sourceMeasurement.basis,
                targetMeasurement.basis
              ],
              "Tahmini girdi içeren deterministik ölçekleme."
            )
          : null,
      sourceUnit:
        sourceMeasurement.unit,
      targetUnit:
        targetMeasurement.unit
    });
  }

  function scaleMeasurement(
    measurement,
    factor
  ) {
    assertMeasurement(measurement);
    const normalizedFactor =
      normalizeFactor(factor);

    if (
      measurement.status === "unknown" ||
      normalizedFactor.status ===
        "unknown"
    ) {
      return freezeClone({
        status: "unknown",
        value: null,
        unit: measurement.unit,
        basis: null
      });
    }

    const status =
      measurement.status === "estimated" ||
      normalizedFactor.status ===
        "estimated"
        ? "estimated"
        : "known";

    return freezeClone({
      status,
      value: roundNumber(
        measurement.value *
        normalizedFactor.value
      ),
      unit: measurement.unit,
      basis:
        status === "estimated"
          ? mergeBasis(
              [
                measurement.basis,
                normalizedFactor.basis
              ],
              "Tahmini girdi içeren deterministik hesaplama."
            )
          : null
    });
  }

  function validateNutrientMap(
    nutrientMap,
    path
  ) {
    if (!isPlainObject(nutrientMap)) {
      throw createError(
        "TODAY-NUTRITION-CALC-009",
        "Besin değerleri düz bir nesne olmalıdır.",
        { path }
      );
    }

    Object.keys(nutrientMap).forEach(key => {
      if (!IDENTIFIER_PATTERN.test(key)) {
        throw createError(
          "TODAY-NUTRITION-CALC-009",
          "Besin değeri anahtarı geçersiz.",
          { path: `${path}.${key}` }
        );
      }

      assertMeasurement(
        nutrientMap[key],
        `${path}.${key}`
      );
    });

    return nutrientMap;
  }

  function scaleNutrientMap(
    nutrientMap,
    factor
  ) {
    validateNutrientMap(
      nutrientMap,
      "$.nutrients"
    );
    const result = {};

    Object.keys(nutrientMap)
      .sort()
      .forEach(key => {
        result[key] = scaleMeasurement(
          nutrientMap[key],
          factor
        );
      });

    return freezeClone(result);
  }

  function coverageFor(nutrients) {
    const keys = Object.keys(nutrients);
    const counts = {
      known: 0,
      estimated: 0,
      unknown: 0
    };

    keys.forEach(key => {
      counts[nutrients[key].status] += 1;
    });

    const calculable =
      counts.known + counts.estimated;
    let status = "unspecified";

    if (keys.length > 0) {
      if (counts.unknown === 0) {
        status = "complete";
      } else if (calculable > 0) {
        status = "partial";
      }
    }

    return freezeClone({
      status,
      nutrientCount: keys.length,
      calculableNutrientCount:
        calculable,
      knownNutrientCount: counts.known,
      estimatedNutrientCount:
        counts.estimated,
      unknownNutrientCount:
        counts.unknown
    });
  }

  function assertRecord(record, type) {
    const contracts = getContracts();
    const validation =
      contracts.validateRecord(record);

    if (
      !validation.valid ||
      record?.type !== type
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-008",
        "Hesaplama kaynağı beklenen beslenme kaydı değil.",
        {
          expectedType: type,
          actualType: record?.type || null,
          validationErrors:
            validation.errors
        }
      );
    }

    return record;
  }

  function calculateFoodNutrients(
    foodRecord,
    requestedAmount
  ) {
    assertRecord(foodRecord, "food_version");
    assertMeasurement(
      requestedAmount,
      "$.requestedAmount"
    );

    const scaleFactor =
      calculateScaleFactor(
        foodRecord.payload.servingBasis,
        requestedAmount
      );
    const nutrients = scaleNutrientMap(
      foodRecord.payload.nutrients,
      scaleFactor
    );

    return freezeClone({
      kind: "food",
      calculationVersion:
        CALCULATION_VERSION,
      unitRuleSetId: UNIT_RULESET_ID,
      unitRuleSetVersion:
        UNIT_RULESET_VERSION,
      source: {
        recordId: foodRecord.id,
        logicalId:
          foodRecord.payload.foodId,
        version:
          foodRecord.payload.version,
        name: foodRecord.payload.name
      },
      sourceServingBasis:
        foodRecord.payload.servingBasis,
      requestedAmount,
      scaleFactor,
      nutrients,
      coverage: coverageFor(nutrients),
      usedRecordIds: [foodRecord.id]
    });
  }

  function normalizeAggregationEntries(entries) {
    if (
      !Array.isArray(entries) ||
      entries.length === 0
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-009",
        "Toplanacak en az bir besin değeri kaynağı olmalıdır."
      );
    }

    const seen = new Set();

    return entries.map((entry, index) => {
      if (
        !isPlainObject(entry) ||
        !IDENTIFIER_PATTERN.test(
          entry.id
        )
      ) {
        throw createError(
          "TODAY-NUTRITION-CALC-009",
          "Besin değeri kaynak kimliği geçersiz.",
          { index }
        );
      }

      if (seen.has(entry.id)) {
        throw createError(
          "TODAY-NUTRITION-CALC-009",
          "Besin değeri kaynak kimliği yinelenemez.",
          { recordId: entry.id }
        );
      }

      seen.add(entry.id);
      validateNutrientMap(
        entry.nutrients,
        `$[${index}].nutrients`
      );

      return {
        id: entry.id,
        nutrients: entry.nutrients
      };
    });
  }

  function chooseTargetUnit(
    nutrientKey,
    entries,
    targetUnits
  ) {
    if (
      isPlainObject(targetUnits) &&
      hasOwn(targetUnits, nutrientKey)
    ) {
      const target = targetUnits[nutrientKey];

      if (!getUnitInfo(target)) {
        throw createError(
          "TODAY-NUTRITION-CALC-003",
          "Hedef besin birimi tanımlı değil.",
          { nutrientKey, targetUnit: target }
        );
      }

      return target;
    }

    for (const entry of entries) {
      const unit =
        entry.nutrients[nutrientKey]
          ?.unit;

      if (unit !== null && unit !== undefined) {
        return unit;
      }
    }

    return null;
  }

  function aggregateNutrients(
    entries,
    options = {}
  ) {
    const normalized =
      normalizeAggregationEntries(entries);
    const nutrientKeys = [
      ...new Set(
        normalized.flatMap(entry =>
          Object.keys(entry.nutrients)
        )
      )
    ].sort();
    const nutrients = {};
    const details = {};

    nutrientKeys.forEach(nutrientKey => {
      const targetUnit = chooseTargetUnit(
        nutrientKey,
        normalized,
        options.targetUnits
      );
      const missingRecordIds = [];
      const unknownRecordIds = [];
      const calculable = [];

      normalized.forEach(entry => {
        const measurement =
          entry.nutrients[nutrientKey];

        if (!measurement) {
          missingRecordIds.push(entry.id);
          return;
        }

        if (measurement.unit !== null) {
          if (targetUnit === null) {
            throw createError(
              "TODAY-NUTRITION-CALC-010",
              "Besin toplamı için ortak birim belirlenemedi.",
              { nutrientKey }
            );
          }

          assertConvertible(
            measurement.unit,
            targetUnit,
            `$.nutrients.${nutrientKey}`
          );
        }

        if (measurement.status === "unknown") {
          unknownRecordIds.push(entry.id);
          return;
        }

        calculable.push({
          id: entry.id,
          measurement:
            convertMeasurement(
              measurement,
              targetUnit
            )
        });
      });

      let partialSubtotal;

      if (calculable.length === 0) {
        partialSubtotal = {
          status: "unknown",
          value: null,
          unit: targetUnit,
          basis: null
        };
      } else {
        const estimated =
          calculable.filter(
            item =>
              item.measurement.status ===
                "estimated"
          );
        const status =
          estimated.length > 0
            ? "estimated"
            : "known";
        let total = 0;

        calculable.forEach(item => {
          total = roundNumber(
            total +
            item.measurement.value
          );
        });

        partialSubtotal = {
          status,
          value: total,
          unit: targetUnit,
          basis:
            status === "estimated"
              ? mergeBasis(
                  estimated.map(
                    item =>
                      item.measurement.basis
                  ),
                  "Tahmini girdi içeren deterministik toplam."
                )
              : null
        };
      }

      const complete =
        missingRecordIds.length === 0 &&
        unknownRecordIds.length === 0;

      nutrients[nutrientKey] = complete
        ? partialSubtotal
        : {
            status: "unknown",
            value: null,
            unit: targetUnit,
            basis: null
          };
      details[nutrientKey] = {
        contributorCount:
          normalized.length,
        calculableContributorCount:
          calculable.length,
        missingRecordIds,
        unknownRecordIds,
        complete,
        partialSubtotal
      };
    });

    return freezeClone({
      calculationVersion:
        CALCULATION_VERSION,
      unitRuleSetId: UNIT_RULESET_ID,
      unitRuleSetVersion:
        UNIT_RULESET_VERSION,
      nutrients,
      coverage: coverageFor(nutrients),
      details
    });
  }

  function resolveRecipeIngredients(
    recipeRecord,
    ingredientRecords
  ) {
    if (!Array.isArray(ingredientRecords)) {
      throw createError(
        "TODAY-NUTRITION-CALC-011",
        "Tarif bileşen kayıtları liste olmalıdır."
      );
    }

    const byId = new Map();

    ingredientRecords.forEach(record => {
      assertRecord(
        record,
        "meal_item_snapshot"
      );

      if (byId.has(record.id)) {
        throw createError(
          "TODAY-NUTRITION-CALC-011",
          "Tarif bileşen kimliği yinelenemez.",
          { recordId: record.id }
        );
      }

      byId.set(record.id, record);
    });

    const expectedIds =
      recipeRecord.payload
        .ingredientSnapshotIds;

    if (
      byId.size !== expectedIds.length ||
      expectedIds.some(id => !byId.has(id))
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-011",
        "Tarif sürümü ile bileşen kayıtları birebir eşleşmiyor.",
        {
          expectedIds: clone(expectedIds),
          receivedIds: [
            ...byId.keys()
          ]
        }
      );
    }

    return expectedIds.map(id => byId.get(id));
  }

  function scaleRecipe(
    recipeRecord,
    ingredientRecords,
    targetYield
  ) {
    assertRecord(
      recipeRecord,
      "recipe_version"
    );
    assertMeasurement(
      targetYield,
      "$.targetYield"
    );
    const orderedIngredients =
      resolveRecipeIngredients(
        recipeRecord,
        ingredientRecords
      );
    const scaleFactor =
      calculateScaleFactor(
        recipeRecord.payload.yield,
        targetYield
      );
    const scaledIngredients =
      orderedIngredients.map(record => {
        const nutrients =
          scaleNutrientMap(
            record.payload.nutrients,
            scaleFactor
          );

        return {
          sourceSnapshotId: record.id,
          itemKind:
            record.payload.itemKind,
          referenceId:
            record.payload.referenceId,
          sourceVersion:
            record.payload.sourceVersion,
          name: record.payload.name,
          originalAmount:
            record.payload.amount,
          scaledAmount:
            scaleMeasurement(
              record.payload.amount,
              scaleFactor
            ),
          nutrients,
          coverage:
            coverageFor(nutrients)
        };
      });

    return freezeClone({
      kind: "recipe_scale",
      calculationVersion:
        CALCULATION_VERSION,
      unitRuleSetId: UNIT_RULESET_ID,
      unitRuleSetVersion:
        UNIT_RULESET_VERSION,
      source: {
        recordId: recipeRecord.id,
        logicalId:
          recipeRecord.payload.recipeId,
        version:
          recipeRecord.payload.version,
        name: recipeRecord.payload.name
      },
      sourceYield:
        recipeRecord.payload.yield,
      targetYield,
      scaleFactor,
      scaledIngredients,
      usedRecordIds: [
        recipeRecord.id,
        ...orderedIngredients.map(
          record => record.id
        )
      ]
    });
  }

  function calculateRecipeNutrients(
    recipeRecord,
    ingredientRecords,
    targetYield,
    options = {}
  ) {
    const scaled = scaleRecipe(
      recipeRecord,
      ingredientRecords,
      targetYield
    );
    const aggregate =
      aggregateNutrients(
        scaled.scaledIngredients.map(
          ingredient => ({
            id:
              ingredient.sourceSnapshotId,
            nutrients:
              ingredient.nutrients
          })
        ),
        options
      );

    return freezeClone({
      kind: "recipe",
      calculationVersion:
        CALCULATION_VERSION,
      unitRuleSetId: UNIT_RULESET_ID,
      unitRuleSetVersion:
        UNIT_RULESET_VERSION,
      source: scaled.source,
      sourceYield: scaled.sourceYield,
      targetYield: scaled.targetYield,
      scaleFactor: scaled.scaleFactor,
      scaledIngredients:
        scaled.scaledIngredients,
      nutrients: aggregate.nutrients,
      coverage: aggregate.coverage,
      nutrientDetails:
        aggregate.details,
      usedRecordIds:
        scaled.usedRecordIds
    });
  }

  function calculateMealNutrients(
    itemRecords,
    options = {}
  ) {
    if (
      !Array.isArray(itemRecords) ||
      itemRecords.length === 0
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-012",
        "Öğün hesabı için en az bir öğe kaydı gerekir."
      );
    }

    const ids = new Set();
    const entries = itemRecords.map(record => {
      assertRecord(
        record,
        "meal_item_snapshot"
      );

      if (ids.has(record.id)) {
        throw createError(
          "TODAY-NUTRITION-CALC-012",
          "Öğün hesabında yinelenen kayıt kullanılamaz.",
          { recordId: record.id }
        );
      }

      ids.add(record.id);
      return {
        id: record.id,
        nutrients:
          record.payload.nutrients
      };
    });
    const aggregate =
      aggregateNutrients(entries, options);

    return freezeClone({
      kind: "meal",
      calculationVersion:
        CALCULATION_VERSION,
      unitRuleSetId: UNIT_RULESET_ID,
      unitRuleSetVersion:
        UNIT_RULESET_VERSION,
      nutrients: aggregate.nutrients,
      coverage: aggregate.coverage,
      nutrientDetails:
        aggregate.details,
      usedRecordIds: [...ids]
    });
  }

  function deriveKnowledgeStatus(
    amount,
    nutrients
  ) {
    const statuses = [
      amount.status,
      ...Object.values(nutrients).map(
        measurement =>
          measurement.status
      )
    ];

    if (statuses.includes("unknown")) {
      return "unknown";
    }

    if (statuses.includes("estimated")) {
      return "estimated";
    }

    return "known";
  }

  function assertCalculationResult(
    calculation
  ) {
    if (
      !isPlainObject(calculation) ||
      !["food", "recipe"].includes(
        calculation.kind
      ) ||
      calculation.calculationVersion !==
        CALCULATION_VERSION ||
      calculation.unitRuleSetId !==
        UNIT_RULESET_ID ||
      calculation.unitRuleSetVersion !==
        UNIT_RULESET_VERSION ||
      !isPlainObject(calculation.source)
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-013",
        "Hesaplama sonucu bu motor sürümüne ait değil."
      );
    }

    const amount =
      calculation.kind === "food"
        ? calculation.requestedAmount
        : calculation.targetYield;

    assertMeasurement(amount, "$.amount");
    validateNutrientMap(
      calculation.nutrients,
      "$.nutrients"
    );

    if (
      !IDENTIFIER_PATTERN.test(
        calculation.source.recordId
      ) ||
      typeof calculation.source.version !==
        "string" ||
      !calculation.source.version ||
      typeof calculation.source.name !==
        "string" ||
      !calculation.source.name.trim()
    ) {
      throw createError(
        "TODAY-NUTRITION-CALC-013",
        "Hesaplama kaynak izi eksik."
      );
    }

    return { amount };
  }

  function buildCalculatedSnapshot(
    options
  ) {
    if (!isPlainObject(options)) {
      throw createError(
        "TODAY-NUTRITION-CALC-014",
        "Hesaplanmış kayıt seçenekleri geçersiz."
      );
    }

    const calculation =
      options.calculation;
    const { amount } =
      assertCalculationResult(calculation);
    const itemKind =
      calculation.kind === "food"
        ? "food_version"
        : "recipe_version";
    const record = {
      id: options.id,
      type: "meal_item_snapshot",
      schemaVersion:
        getContracts().CONTRACT_VERSION,
      createdAt: options.createdAt,
      updatedAt:
        options.updatedAt ||
        options.createdAt,
      eventAt: null,
      source: {
        kind: "system_calculation",
        referenceId:
          calculation.source.recordId,
        version:
          calculation.source.version
      },
      knowledgeStatus:
        deriveKnowledgeStatus(
          amount,
          calculation.nutrients
        ),
      recordStatus: "active",
      verificationStatus: "unverified",
      calculationVersion:
        CALCULATION_VERSION,
      userEdited: false,
      payload: {
        itemKind,
        referenceId:
          calculation.source.recordId,
        name:
          options.name ||
          calculation.source.name,
        amount,
        nutrients:
          calculation.nutrients,
        sourceVersion:
          calculation.source.version
      },
      extensions: {
        "today.nutrition.calculation": {
          unitRuleSetId:
            UNIT_RULESET_ID,
          unitRuleSetVersion:
            UNIT_RULESET_VERSION,
          usedRecordIds:
            calculation.usedRecordIds,
          coverage:
            calculation.coverage
        }
      }
    };

    try {
      return getContracts()
        .createRecord(record);
    } catch (error) {
      throw createError(
        "TODAY-NUTRITION-CALC-014",
        "Hesaplanmış öğün öğesi kaydı doğrulanamadı.",
        {
          validationErrors:
            error.validationErrors || null
        }
      );
    }
  }

  window.TodayNutritionCalculations =
    Object.freeze({
      CALCULATION_API_VERSION,
      CALCULATION_VERSION,
      UNIT_RULESET_ID,
      UNIT_RULESET_VERSION,
      PRECISION_DIGITS,
      UNIT_RULES,
      CONTEXTUAL_UNITS,
      listUnits,
      inspectUnit,
      canConvert,
      convertValue,
      convertMeasurement,
      calculateScaleFactor,
      scaleMeasurement,
      scaleNutrientMap,
      aggregateNutrients,
      calculateFoodNutrients,
      scaleRecipe,
      calculateRecipeNutrients,
      calculateMealNutrients,
      buildCalculatedSnapshot
    });
})();
