/**
 * Today App — Nutrition Data Contracts
 * NUT-001 — Versioned contracts, status codes and validation rules
 *
 * This module is deliberately storage-, UI- and network-agnostic. It defines
 * the boundary that NUT-002 and later nutrition capabilities must consume.
 */

(function () {
  "use strict";

  const CONTRACT_VERSION = 1;
  const SCHEMA_ID =
    "today:nutrition:record:v1";

  const IDENTIFIER_PATTERN =
    /^[a-z0-9](?:[a-z0-9._:-]{0,78}[a-z0-9])?$/;
  const VERSION_PATTERN =
    /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/i;
  const DATE_PATTERN =
    /^\d{4}-\d{2}-\d{2}$/;
  const TIME_PATTERN =
    /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const EXTENSION_KEY_PATTERN =
    /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;

  const MAX_TEXT_LENGTH = 500;
  const MAX_LONG_TEXT_LENGTH = 4000;
  const MAX_LIST_LENGTH = 500;
  const MAX_OBJECT_DEPTH = 10;
  const MAX_OBJECT_NODES = 5000;

  const STATUS_CODES = deepFreeze({
    knowledge: [
      "known",
      "estimated",
      "unknown"
    ],
    source: [
      "manual",
      "device",
      "data_package",
      "ai_draft",
      "system_calculation"
    ],
    record: [
      "draft",
      "active",
      "archived",
      "superseded"
    ],
    verification: [
      "unverified",
      "user_confirmed",
      "source_verified"
    ],
    coverage: [
      "complete",
      "partial",
      "single_event",
      "unspecified"
    ],
    relationship: [
      "descriptive",
      "association"
    ],
    sharing: [
      "not_shared",
      "shared"
    ]
  });

  const CONTRACT_DEFINITIONS = deepFreeze({
    nutrition_profile: {
      objectName: "NutritionProfile",
      category: "profile",
      requiredPayload: [
        "trackingMode",
        "dietaryConstraintIds",
        "primaryGoalVersionId"
      ],
      eventPolicy: "optional"
    },
    dietary_constraint: {
      objectName: "DietaryConstraint",
      category: "profile",
      requiredPayload: [
        "kind",
        "label",
        "active"
      ],
      eventPolicy: "optional"
    },
    nutrition_goal_version: {
      objectName: "NutritionGoalVersion",
      category: "goal",
      requiredPayload: [
        "goalKind",
        "effectiveFrom",
        "supersedesId",
        "targets"
      ],
      eventPolicy: "optional"
    },
    food_version: {
      objectName: "FoodVersion",
      category: "library",
      requiredPayload: [
        "foodId",
        "version",
        "name",
        "servingBasis",
        "nutrients",
        "referenceSourceIds"
      ],
      eventPolicy: "optional"
    },
    recipe_version: {
      objectName: "RecipeVersion",
      category: "library",
      requiredPayload: [
        "recipeId",
        "version",
        "name",
        "yield",
        "ingredientSnapshotIds"
      ],
      eventPolicy: "optional"
    },
    meal_template: {
      objectName: "MealTemplate",
      category: "library",
      requiredPayload: [
        "name",
        "mealType",
        "itemSnapshotIds"
      ],
      eventPolicy: "optional"
    },
    meal_entry: {
      objectName: "MealEntry",
      category: "consumption",
      requiredPayload: [
        "consumedAt",
        "mealType",
        "itemSnapshotIds",
        "coverage",
        "plannedMealId"
      ],
      forbiddenPayload: [
        "plannedFor",
        "planStatus"
      ],
      eventField: "consumedAt",
      eventPolicy: "required_match"
    },
    meal_item_snapshot: {
      objectName: "MealItemSnapshot",
      category: "consumption",
      requiredPayload: [
        "itemKind",
        "referenceId",
        "name",
        "amount",
        "nutrients",
        "sourceVersion"
      ],
      eventPolicy: "optional"
    },
    hydration_entry: {
      objectName: "HydrationEntry",
      category: "consumption",
      requiredPayload: [
        "consumedAt",
        "beverageType",
        "amount"
      ],
      forbiddenPayload: [
        "plannedFor",
        "planStatus"
      ],
      eventField: "consumedAt",
      eventPolicy: "required_match"
    },
    meal_plan: {
      objectName: "MealPlan",
      category: "planning",
      requiredPayload: [
        "startDate",
        "endDate",
        "status",
        "plannedMealIds"
      ],
      forbiddenPayload: [
        "consumedAt",
        "itemSnapshotIds"
      ],
      eventPolicy: "optional"
    },
    planned_meal: {
      objectName: "PlannedMeal",
      category: "planning",
      requiredPayload: [
        "plannedFor",
        "mealType",
        "itemSnapshotIds",
        "status",
        "mealEntryId"
      ],
      forbiddenPayload: [
        "consumedAt",
        "coverage"
      ],
      eventField: "plannedFor",
      eventPolicy: "required_match"
    },
    batch_preparation: {
      objectName: "BatchPreparation",
      category: "planning",
      requiredPayload: [
        "preparedAt",
        "recipeVersionId",
        "producedPortions",
        "leftoverPortionIds"
      ],
      eventField: "preparedAt",
      eventPolicy: "required_match"
    },
    leftover_portion: {
      objectName: "LeftoverPortion",
      category: "planning",
      requiredPayload: [
        "batchPreparationId",
        "amount",
        "status",
        "mealEntryId"
      ],
      eventPolicy: "optional"
    },
    shopping_list: {
      objectName: "ShoppingList",
      category: "planning",
      requiredPayload: [
        "name",
        "status",
        "itemIds"
      ],
      eventPolicy: "optional"
    },
    shopping_list_item: {
      objectName: "ShoppingListItem",
      category: "planning",
      requiredPayload: [
        "name",
        "amount",
        "status",
        "plannedMealIds"
      ],
      eventPolicy: "optional"
    },
    home_availability: {
      objectName: "HomeAvailability",
      category: "planning",
      requiredPayload: [
        "checkedAt",
        "itemKind",
        "referenceId",
        "amount"
      ],
      eventField: "checkedAt",
      eventPolicy: "required_match"
    },
    activity_reference: {
      objectName: "ActivityReference",
      category: "health_reference",
      requiredPayload: [
        "healthRecordId",
        "relation",
        "occurredAt"
      ],
      forbiddenPayload: [
        "durationMinutes",
        "calories",
        "heartRate",
        "steps"
      ],
      eventField: "occurredAt",
      eventPolicy: "required_match"
    },
    recovery_check: {
      objectName: "RecoveryCheck",
      category: "health_reference",
      requiredPayload: [
        "healthRecordId",
        "relation",
        "occurredAt"
      ],
      forbiddenPayload: [
        "sleepHours",
        "heartRate",
        "hrv",
        "symptoms"
      ],
      eventField: "occurredAt",
      eventPolicy: "required_match"
    },
    weight_reference: {
      objectName: "WeightReference",
      category: "health_reference",
      requiredPayload: [
        "healthRecordId",
        "relation",
        "occurredAt"
      ],
      forbiddenPayload: [
        "weight",
        "unit",
        "bmi"
      ],
      eventField: "occurredAt",
      eventPolicy: "required_match"
    },
    nutrition_summary: {
      objectName: "NutritionSummary",
      category: "analysis",
      requiredPayload: [
        "period",
        "usedRecordIds",
        "coverage",
        "metrics"
      ],
      eventPolicy: "optional"
    },
    insight_snapshot: {
      objectName: "InsightSnapshot",
      category: "analysis",
      requiredPayload: [
        "period",
        "usedRecordIds",
        "observation",
        "basis",
        "relationshipType",
        "uncertainty",
        "aiNarrationVersion"
      ],
      eventPolicy: "optional"
    },
    report_snapshot: {
      objectName: "ReportSnapshot",
      category: "sharing",
      requiredPayload: [
        "period",
        "includedRecordIds",
        "coverage",
        "goalVersionId",
        "referenceSourceIds",
        "includedSections",
        "hiddenFields",
        "generatedAt",
        "aiNarrationVersion",
        "sharing"
      ],
      eventField: "generatedAt",
      eventPolicy: "required_match"
    },
    nutrition_reminder: {
      objectName: "NutritionReminder",
      category: "reminder",
      requiredPayload: [
        "reminderKind",
        "enabled",
        "userInitiated",
        "schedule",
        "messageStyle"
      ],
      eventPolicy: "optional"
    }
  });

  const RECORD_TYPES = Object.freeze(
    Object.keys(CONTRACT_DEFINITIONS)
  );

  const TOP_LEVEL_FIELDS = new Set([
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
    "payload",
    "extensions"
  ]);

  function deepFreeze(value, seen = new Set()) {
    if (
      value === null ||
      typeof value !== "object" ||
      seen.has(value)
    ) {
      return value;
    }

    seen.add(value);

    Object.keys(value).forEach(key => {
      deepFreeze(value[key], seen);
    });

    return Object.freeze(value);
  }

  function isPlainObject(value) {
    if (
      value === null ||
      typeof value !== "object"
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

  function isIdentifier(value) {
    return (
      typeof value === "string" &&
      IDENTIFIER_PATTERN.test(value)
    );
  }

  function isVersion(value) {
    return (
      typeof value === "string" &&
      VERSION_PATTERN.test(value)
    );
  }

  function isDateTime(value) {
    return (
      typeof value === "string" &&
      value.includes("T") &&
      !Number.isNaN(Date.parse(value))
    );
  }

  function isDate(value) {
    if (
      typeof value !== "string" ||
      !DATE_PATTERN.test(value)
    ) {
      return false;
    }

    const [year, month, day] =
      value.split("-").map(Number);
    const date =
      new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function isText(value, maximum = MAX_TEXT_LENGTH) {
    return (
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.length <= maximum
    );
  }

  function isNullableIdentifier(value) {
    return value === null || isIdentifier(value);
  }

  function addError(
    errors,
    code,
    path,
    message
  ) {
    errors.push({
      code,
      path,
      message
    });
  }

  function validateJsonSafety(value) {
    const errors = [];
    const ancestors = new Set();
    let nodeCount = 0;

    function visit(current, path, depth) {
      nodeCount += 1;

      if (nodeCount > MAX_OBJECT_NODES) {
        addError(
          errors,
          "NUT-SAFE-001",
          path,
          "Kayıt izin verilen düğüm sınırını aşıyor."
        );
        return;
      }

      if (depth > MAX_OBJECT_DEPTH) {
        addError(
          errors,
          "NUT-SAFE-002",
          path,
          "Kayıt izin verilen iç içe geçme sınırını aşıyor."
        );
        return;
      }

      if (
        current === null ||
        typeof current === "string" ||
        typeof current === "boolean"
      ) {
        return;
      }

      if (typeof current === "number") {
        if (!Number.isFinite(current)) {
          addError(
            errors,
            "NUT-SAFE-003",
            path,
            "Sayısal değer sonlu olmalıdır."
          );
        }
        return;
      }

      if (typeof current !== "object") {
        addError(
          errors,
          "NUT-SAFE-004",
          path,
          "Yalnız JSON ile taşınabilir değerler kullanılabilir."
        );
        return;
      }

      if (ancestors.has(current)) {
        addError(
          errors,
          "NUT-SAFE-005",
          path,
          "Döngüsel nesne kullanılamaz."
        );
        return;
      }

      if (
        !Array.isArray(current) &&
        !isPlainObject(current)
      ) {
        addError(
          errors,
          "NUT-SAFE-006",
          path,
          "Özel nesne örnekleri veri sözleşmesinde kullanılamaz."
        );
        return;
      }

      ancestors.add(current);

      if (Array.isArray(current)) {
        if (current.length > MAX_LIST_LENGTH) {
          addError(
            errors,
            "NUT-SAFE-007",
            path,
            "Liste izin verilen öğe sınırını aşıyor."
          );
        }

        current.forEach((entry, index) => {
          visit(
            entry,
            `${path}[${index}]`,
            depth + 1
          );
        });
      } else {
        Object.keys(current).forEach(key => {
          if (
            [
              "__proto__",
              "constructor",
              "prototype"
            ].includes(key)
          ) {
            addError(
              errors,
              "NUT-SAFE-008",
              `${path}.${key}`,
              "Güvenli olmayan nesne anahtarı kullanılamaz."
            );
            return;
          }

          visit(
            current[key],
            `${path}.${key}`,
            depth + 1
          );
        });
      }

      ancestors.delete(current);
    }

    visit(value, "$", 0);
    return errors;
  }

  function validateMeasurement(
    measurement,
    options = {}
  ) {
    const errors = [];
    const path = options.path || "$";

    if (!isPlainObject(measurement)) {
      addError(
        errors,
        "NUT-MEASURE-001",
        path,
        "Ölçüm düz bir nesne olmalıdır."
      );
      return resultFor(errors);
    }

    const allowedFields = new Set([
      "status",
      "value",
      "unit",
      "basis"
    ]);

    Object.keys(measurement).forEach(key => {
      if (!allowedFields.has(key)) {
        addError(
          errors,
          "NUT-MEASURE-002",
          `${path}.${key}`,
          "Ölçüm alanı sözleşmede tanımlı değil."
        );
      }
    });

    if (
      !STATUS_CODES.knowledge.includes(
        measurement.status
      )
    ) {
      addError(
        errors,
        "NUT-MEASURE-003",
        `${path}.status`,
        "Ölçüm bilgi durumu geçersiz."
      );
    }

    if (measurement.status === "unknown") {
      if (measurement.value !== null) {
        addError(
          errors,
          "NUT-MEASURE-004",
          `${path}.value`,
          "Bilinmeyen değer null olmalı; 0 bilinmeyen yerine kullanılamaz."
        );
      }
    } else if (
      measurement.status === "known" ||
      measurement.status === "estimated"
    ) {
      if (
        typeof measurement.value !== "number" ||
        !Number.isFinite(measurement.value)
      ) {
        addError(
          errors,
          "NUT-MEASURE-005",
          `${path}.value`,
          "Bilinen veya tahmini ölçüm sonlu bir sayı içermelidir."
        );
      } else if (
        options.allowNegative !== true &&
        measurement.value < 0
      ) {
        addError(
          errors,
          "NUT-MEASURE-006",
          `${path}.value`,
          "Bu ölçüm negatif olamaz."
        );
      }
    }

    if (
      measurement.unit !== null &&
      !isIdentifier(measurement.unit)
    ) {
      addError(
        errors,
        "NUT-MEASURE-007",
        `${path}.unit`,
        "Ölçüm birimi geçersiz."
      );
    }

    if (
      measurement.status !== "unknown" &&
      measurement.unit === null
    ) {
      addError(
        errors,
        "NUT-MEASURE-008",
        `${path}.unit`,
        "Bilinen veya tahmini ölçümde birim zorunludur."
      );
    }

    if (
      measurement.basis !== null &&
      !isText(
        measurement.basis,
        MAX_LONG_TEXT_LENGTH
      )
    ) {
      addError(
        errors,
        "NUT-MEASURE-009",
        `${path}.basis`,
        "Ölçüm dayanağı geçersiz."
      );
    }

    if (
      measurement.status === "estimated" &&
      !isText(
        measurement.basis,
        MAX_LONG_TEXT_LENGTH
      )
    ) {
      addError(
        errors,
        "NUT-MEASURE-010",
        `${path}.basis`,
        "Tahmini ölçümde açıklanabilir bir dayanak zorunludur."
      );
    }

    return resultFor(errors);
  }

  function validateSource(source, errors) {
    if (!isPlainObject(source)) {
      addError(
        errors,
        "NUT-SOURCE-001",
        "$.source",
        "Kaynak bilgisi düz bir nesne olmalıdır."
      );
      return;
    }

    const allowedFields = new Set([
      "kind",
      "referenceId",
      "version"
    ]);

    Object.keys(source).forEach(key => {
      if (!allowedFields.has(key)) {
        addError(
          errors,
          "NUT-SOURCE-002",
          `$.source.${key}`,
          "Kaynak alanı sözleşmede tanımlı değil."
        );
      }
    });

    if (
      !STATUS_CODES.source.includes(
        source.kind
      )
    ) {
      addError(
        errors,
        "NUT-SOURCE-003",
        "$.source.kind",
        "Kaynak türü geçersiz."
      );
    }

    if (!isNullableIdentifier(source.referenceId)) {
      addError(
        errors,
        "NUT-SOURCE-004",
        "$.source.referenceId",
        "Kaynak referansı null veya geçerli bir kimlik olmalıdır."
      );
    }

    if (
      source.version !== null &&
      !isVersion(source.version)
    ) {
      addError(
        errors,
        "NUT-SOURCE-005",
        "$.source.version",
        "Kaynak sürümü geçersiz."
      );
    }

    if (
      [
        "device",
        "data_package",
        "system_calculation"
      ].includes(source.kind) &&
      !isIdentifier(source.referenceId)
    ) {
      addError(
        errors,
        "NUT-SOURCE-006",
        "$.source.referenceId",
        "Bu kaynak türünde kaynak referansı zorunludur."
      );
    }
  }

  function validateIdArray(
    value,
    path,
    errors,
    options = {}
  ) {
    if (!Array.isArray(value)) {
      addError(
        errors,
        "NUT-FIELD-001",
        path,
        "Alan bir kimlik listesi olmalıdır."
      );
      return;
    }

    if (
      options.allowEmpty !== true &&
      value.length === 0
    ) {
      addError(
        errors,
        "NUT-FIELD-002",
        path,
        "Kimlik listesi boş olamaz."
      );
    }

    const seen = new Set();

    value.forEach((entry, index) => {
      if (!isIdentifier(entry)) {
        addError(
          errors,
          "NUT-FIELD-003",
          `${path}[${index}]`,
          "Liste öğesi geçerli bir kimlik olmalıdır."
        );
      } else if (seen.has(entry)) {
        addError(
          errors,
          "NUT-FIELD-004",
          `${path}[${index}]`,
          "Kimlik listesinde tekrar olamaz."
        );
      }

      seen.add(entry);
    });
  }

  function validateTextArray(
    value,
    path,
    errors,
    options = {}
  ) {
    if (!Array.isArray(value)) {
      addError(
        errors,
        "NUT-FIELD-005",
        path,
        "Alan bir metin listesi olmalıdır."
      );
      return;
    }

    if (
      options.allowEmpty !== true &&
      value.length === 0
    ) {
      addError(
        errors,
        "NUT-FIELD-006",
        path,
        "Metin listesi boş olamaz."
      );
    }

    const seen = new Set();

    value.forEach((entry, index) => {
      if (!isText(entry)) {
        addError(
          errors,
          "NUT-FIELD-007",
          `${path}[${index}]`,
          "Liste öğesi geçerli bir metin olmalıdır."
        );
      } else if (seen.has(entry)) {
        addError(
          errors,
          "NUT-FIELD-008",
          `${path}[${index}]`,
          "Metin listesinde tekrar olamaz."
        );
      }

      seen.add(entry);
    });
  }

  function validateMeasurementMap(
    value,
    path,
    errors,
    options = {}
  ) {
    if (!isPlainObject(value)) {
      addError(
        errors,
        "NUT-FIELD-009",
        path,
        "Ölçüm haritası düz bir nesne olmalıdır."
      );
      return;
    }

    const keys = Object.keys(value);

    if (
      options.allowEmpty !== true &&
      keys.length === 0
    ) {
      addError(
        errors,
        "NUT-FIELD-010",
        path,
        "Ölçüm haritası boş olamaz."
      );
    }

    keys.forEach(key => {
      if (!isIdentifier(key)) {
        addError(
          errors,
          "NUT-FIELD-011",
          `${path}.${key}`,
          "Ölçüm anahtarı geçersiz."
        );
        return;
      }

      const result =
        validateMeasurement(
          value[key],
          {
            path: `${path}.${key}`
          }
        );

      errors.push(...result.errors);
    });
  }

  function validateCoverage(
    value,
    path,
    errors
  ) {
    if (!isPlainObject(value)) {
      addError(
        errors,
        "NUT-COVERAGE-001",
        path,
        "Kayıt kapsamı düz bir nesne olmalıdır."
      );
      return;
    }

    if (
      !STATUS_CODES.coverage.includes(
        value.status
      )
    ) {
      addError(
        errors,
        "NUT-COVERAGE-002",
        `${path}.status`,
        "Kayıt kapsamı durumu geçersiz."
      );
    }

    [
      "comparableRecordCount",
      "totalRecordCount",
      "missingRecordCount"
    ].forEach(field => {
      if (
        !Number.isInteger(value[field]) ||
        value[field] < 0
      ) {
        addError(
          errors,
          "NUT-COVERAGE-003",
          `${path}.${field}`,
          "Kapsam sayacı negatif olmayan bir tam sayı olmalıdır."
        );
      }
    });

    if (typeof value.userDeclared !== "boolean") {
      addError(
        errors,
        "NUT-COVERAGE-004",
        `${path}.userDeclared`,
        "Kapsamın kullanıcı beyanı olup olmadığı belirtilmelidir."
      );
    }

    if (
      Number.isInteger(value.comparableRecordCount) &&
      Number.isInteger(value.totalRecordCount) &&
      value.comparableRecordCount >
        value.totalRecordCount
    ) {
      addError(
        errors,
        "NUT-COVERAGE-005",
        `${path}.comparableRecordCount`,
        "Karşılaştırılabilir kayıt sayısı toplamı aşamaz."
      );
    }

    if (
      Number.isInteger(value.missingRecordCount) &&
      Number.isInteger(value.totalRecordCount) &&
      value.missingRecordCount >
        value.totalRecordCount
    ) {
      addError(
        errors,
        "NUT-COVERAGE-006",
        `${path}.missingRecordCount`,
        "Eksik kayıt sayısı toplamı aşamaz."
      );
    }
  }

  function validatePeriod(value, path, errors) {
    if (!isPlainObject(value)) {
      addError(
        errors,
        "NUT-PERIOD-001",
        path,
        "Dönem düz bir nesne olmalıdır."
      );
      return;
    }

    if (!isDate(value.startDate)) {
      addError(
        errors,
        "NUT-PERIOD-002",
        `${path}.startDate`,
        "Dönem başlangıcı geçerli bir tarih olmalıdır."
      );
    }

    if (!isDate(value.endDate)) {
      addError(
        errors,
        "NUT-PERIOD-003",
        `${path}.endDate`,
        "Dönem bitişi geçerli bir tarih olmalıdır."
      );
    }

    if (
      isDate(value.startDate) &&
      isDate(value.endDate) &&
      value.startDate > value.endDate
    ) {
      addError(
        errors,
        "NUT-PERIOD-004",
        `${path}.endDate`,
        "Dönem bitişi başlangıçtan önce olamaz."
      );
    }
  }

  function validateCommon(record, errors) {
    if (!isPlainObject(record)) {
      addError(
        errors,
        "NUT-COMMON-001",
        "$",
        "Beslenme kaydı düz bir nesne olmalıdır."
      );
      return;
    }

    Object.keys(record).forEach(key => {
      if (!TOP_LEVEL_FIELDS.has(key)) {
        addError(
          errors,
          "NUT-COMMON-002",
          `$.${key}`,
          "Üst seviye alan sözleşmede tanımlı değil; genişletmeler extensions altında olmalıdır."
        );
      }
    });

    if (!isIdentifier(record.id)) {
      addError(
        errors,
        "NUT-COMMON-003",
        "$.id",
        "Kayıt kimliği geçersiz."
      );
    }

    if (!RECORD_TYPES.includes(record.type)) {
      addError(
        errors,
        "NUT-COMMON-004",
        "$.type",
        "Kayıt türü bu sözleşme sürümünde tanımlı değil."
      );
    }

    if (record.schemaVersion !== CONTRACT_VERSION) {
      addError(
        errors,
        "NUT-COMMON-005",
        "$.schemaVersion",
        "Beslenme kayıt şeması sürümü desteklenmiyor."
      );
    }

    if (!isDateTime(record.createdAt)) {
      addError(
        errors,
        "NUT-COMMON-006",
        "$.createdAt",
        "Oluşturulma zamanı geçerli bir tarih-saat olmalıdır."
      );
    }

    if (!isDateTime(record.updatedAt)) {
      addError(
        errors,
        "NUT-COMMON-007",
        "$.updatedAt",
        "Güncellenme zamanı geçerli bir tarih-saat olmalıdır."
      );
    }

    if (
      isDateTime(record.createdAt) &&
      isDateTime(record.updatedAt) &&
      Date.parse(record.updatedAt) <
        Date.parse(record.createdAt)
    ) {
      addError(
        errors,
        "NUT-COMMON-008",
        "$.updatedAt",
        "Güncellenme zamanı oluşturulma zamanından önce olamaz."
      );
    }

    if (
      record.eventAt !== null &&
      !isDateTime(record.eventAt)
    ) {
      addError(
        errors,
        "NUT-COMMON-009",
        "$.eventAt",
        "Olay zamanı null veya geçerli bir tarih-saat olmalıdır."
      );
    }

    validateSource(record.source, errors);

    if (
      !STATUS_CODES.knowledge.includes(
        record.knowledgeStatus
      )
    ) {
      addError(
        errors,
        "NUT-COMMON-010",
        "$.knowledgeStatus",
        "Kayıt bilgi durumu geçersiz."
      );
    }

    if (
      !STATUS_CODES.record.includes(
        record.recordStatus
      )
    ) {
      addError(
        errors,
        "NUT-COMMON-011",
        "$.recordStatus",
        "Kayıt yaşam döngüsü durumu geçersiz."
      );
    }

    if (
      !STATUS_CODES.verification.includes(
        record.verificationStatus
      )
    ) {
      addError(
        errors,
        "NUT-COMMON-012",
        "$.verificationStatus",
        "Doğrulama durumu geçersiz."
      );
    }

    if (
      record.calculationVersion !== null &&
      !isVersion(record.calculationVersion)
    ) {
      addError(
        errors,
        "NUT-COMMON-013",
        "$.calculationVersion",
        "Hesaplama sürümü geçersiz."
      );
    }

    if (typeof record.userEdited !== "boolean") {
      addError(
        errors,
        "NUT-COMMON-014",
        "$.userEdited",
        "Kullanıcı düzenleme durumu boolean olmalıdır."
      );
    }

    if (!isPlainObject(record.payload)) {
      addError(
        errors,
        "NUT-COMMON-015",
        "$.payload",
        "Kayıt yükü düz bir nesne olmalıdır."
      );
    }

    if (
      record.extensions !== undefined &&
      !isPlainObject(record.extensions)
    ) {
      addError(
        errors,
        "NUT-COMMON-016",
        "$.extensions",
        "Genişletmeler düz bir nesne olmalıdır."
      );
    } else if (isPlainObject(record.extensions)) {
      Object.keys(record.extensions).forEach(key => {
        if (!EXTENSION_KEY_PATTERN.test(key)) {
          addError(
            errors,
            "NUT-COMMON-017",
            `$.extensions.${key}`,
            "Genişletme anahtarı ad alanı içermelidir."
          );
        }
      });
    }

    if (
      isPlainObject(record.source) &&
      record.source.kind === "ai_draft"
    ) {
      if (record.recordStatus !== "draft") {
        addError(
          errors,
          "NUT-INVARIANT-001",
          "$.recordStatus",
          "AI taslağı etkin veya doğrulanmış kayıt olarak saklanamaz."
        );
      }

      if (
        record.verificationStatus !==
        "unverified"
      ) {
        addError(
          errors,
          "NUT-INVARIANT-002",
          "$.verificationStatus",
          "AI taslağı doğrulanmış olarak işaretlenemez."
        );
      }

      if (record.knowledgeStatus !== "estimated") {
        addError(
          errors,
          "NUT-INVARIANT-003",
          "$.knowledgeStatus",
          "AI taslağı yalnız tahmini bilgi durumu taşıyabilir."
        );
      }

      if (record.userEdited !== false) {
        addError(
          errors,
          "NUT-INVARIANT-004",
          "$.userEdited",
          "Düzenlenmiş AI önerisi yeni bir kullanıcı kaydı olarak oluşturulmalıdır."
        );
      }
    }

    if (
      isPlainObject(record.source) &&
      record.source.kind === "manual" &&
      record.verificationStatus ===
        "source_verified"
    ) {
      addError(
        errors,
        "NUT-INVARIANT-005",
        "$.verificationStatus",
        "Manuel kayıt dış kaynak doğrulaması taşıyamaz."
      );
    }

    if (
      isPlainObject(record.source) &&
      record.source.kind ===
        "system_calculation" &&
      record.calculationVersion === null
    ) {
      addError(
        errors,
        "NUT-INVARIANT-006",
        "$.calculationVersion",
        "Sistem hesabında hesaplama sürümü zorunludur."
      );
    }
  }

  function validateDefinitionRules(
    record,
    definition,
    errors
  ) {
    if (!isPlainObject(record.payload)) {
      return;
    }

    definition.requiredPayload.forEach(field => {
      if (!Object.prototype.hasOwnProperty.call(
        record.payload,
        field
      )) {
        addError(
          errors,
          "NUT-PAYLOAD-001",
          `$.payload.${field}`,
          "Zorunlu yük alanı eksik."
        );
      }
    });

    (definition.forbiddenPayload || [])
      .forEach(field => {
        if (Object.prototype.hasOwnProperty.call(
          record.payload,
          field
        )) {
          addError(
            errors,
            "NUT-INVARIANT-007",
            `$.payload.${field}`,
            "Planlanan ve gerçekleşen kayıt alanları birbirine karıştırılamaz."
          );
        }
      });

    if (
      definition.eventPolicy ===
        "required_match"
    ) {
      const payloadTime =
        record.payload[definition.eventField];

      if (!isDateTime(record.eventAt)) {
        addError(
          errors,
          "NUT-EVENT-001",
          "$.eventAt",
          "Bu kayıt türünde olay zamanı zorunludur."
        );
      }

      if (!isDateTime(payloadTime)) {
        addError(
          errors,
          "NUT-EVENT-002",
          `$.payload.${definition.eventField}`,
          "Yük içindeki olay zamanı geçersiz."
        );
      }

      if (
        isDateTime(record.eventAt) &&
        isDateTime(payloadTime) &&
        Date.parse(record.eventAt) !==
          Date.parse(payloadTime)
      ) {
        addError(
          errors,
          "NUT-EVENT-003",
          "$.eventAt",
          "Üst seviye olay zamanı yük içindeki zamanla eşleşmelidir."
        );
      }
    }
  }

  function validateProfile(payload, errors) {
    if (
      ![
        "simple",
        "detailed",
        "professional"
      ].includes(payload.trackingMode)
    ) {
      addError(
        errors,
        "NUT-PROFILE-001",
        "$.payload.trackingMode",
        "Beslenme kayıt modu geçersiz."
      );
    }

    validateIdArray(
      payload.dietaryConstraintIds,
      "$.payload.dietaryConstraintIds",
      errors,
      { allowEmpty: true }
    );

    if (!isNullableIdentifier(
      payload.primaryGoalVersionId
    )) {
      addError(
        errors,
        "NUT-PROFILE-002",
        "$.payload.primaryGoalVersionId",
        "Ana hedef sürümü referansı geçersiz."
      );
    }
  }

  function validateConstraint(payload, errors) {
    if (
      ![
        "allergy",
        "intolerance",
        "preference",
        "religious",
        "medical",
        "other"
      ].includes(payload.kind)
    ) {
      addError(
        errors,
        "NUT-CONSTRAINT-001",
        "$.payload.kind",
        "Beslenme kısıtı türü geçersiz."
      );
    }

    if (!isText(payload.label)) {
      addError(
        errors,
        "NUT-CONSTRAINT-002",
        "$.payload.label",
        "Kısıt etiketi geçersiz."
      );
    }

    if (typeof payload.active !== "boolean") {
      addError(
        errors,
        "NUT-CONSTRAINT-003",
        "$.payload.active",
        "Kısıt etkinlik durumu boolean olmalıdır."
      );
    }
  }

  function validateGoal(payload, errors) {
    if (
      ![
        "awareness",
        "maintenance",
        "weight_loss",
        "weight_gain",
        "muscle_gain",
        "performance",
        "professional_other"
      ].includes(payload.goalKind)
    ) {
      addError(
        errors,
        "NUT-GOAL-001",
        "$.payload.goalKind",
        "Beslenme hedef türü geçersiz."
      );
    }

    if (!isDate(payload.effectiveFrom)) {
      addError(
        errors,
        "NUT-GOAL-002",
        "$.payload.effectiveFrom",
        "Hedef başlangıcı geçerli bir tarih olmalıdır."
      );
    }

    if (!isNullableIdentifier(payload.supersedesId)) {
      addError(
        errors,
        "NUT-GOAL-003",
        "$.payload.supersedesId",
        "Önceki hedef sürümü referansı geçersiz."
      );
    }

    validateMeasurementMap(
      payload.targets,
      "$.payload.targets",
      errors,
      {
        allowEmpty:
          payload.goalKind === "awareness"
      }
    );
  }

  function validateFood(payload, errors) {
    if (!isIdentifier(payload.foodId)) {
      addError(
        errors,
        "NUT-FOOD-001",
        "$.payload.foodId",
        "Besin kimliği geçersiz."
      );
    }

    if (!isVersion(payload.version)) {
      addError(
        errors,
        "NUT-FOOD-002",
        "$.payload.version",
        "Besin sürümü geçersiz."
      );
    }

    if (!isText(payload.name)) {
      addError(
        errors,
        "NUT-FOOD-003",
        "$.payload.name",
        "Besin adı geçersiz."
      );
    }

    errors.push(
      ...validateMeasurement(
        payload.servingBasis,
        {
          path:
            "$.payload.servingBasis"
        }
      ).errors
    );

    validateMeasurementMap(
      payload.nutrients,
      "$.payload.nutrients",
      errors
    );

    validateIdArray(
      payload.referenceSourceIds,
      "$.payload.referenceSourceIds",
      errors
    );
  }

  function validateRecipe(payload, errors) {
    if (!isIdentifier(payload.recipeId)) {
      addError(
        errors,
        "NUT-RECIPE-001",
        "$.payload.recipeId",
        "Tarif kimliği geçersiz."
      );
    }

    if (!isVersion(payload.version)) {
      addError(
        errors,
        "NUT-RECIPE-002",
        "$.payload.version",
        "Tarif sürümü geçersiz."
      );
    }

    if (!isText(payload.name)) {
      addError(
        errors,
        "NUT-RECIPE-003",
        "$.payload.name",
        "Tarif adı geçersiz."
      );
    }

    errors.push(
      ...validateMeasurement(
        payload.yield,
        {
          path: "$.payload.yield"
        }
      ).errors
    );

    validateIdArray(
      payload.ingredientSnapshotIds,
      "$.payload.ingredientSnapshotIds",
      errors
    );
  }

  function validateMealTemplate(payload, errors) {
    if (!isText(payload.name)) {
      addError(
        errors,
        "NUT-TEMPLATE-001",
        "$.payload.name",
        "Öğün şablonu adı geçersiz."
      );
    }

    validateMealType(
      payload.mealType,
      "$.payload.mealType",
      errors
    );

    validateIdArray(
      payload.itemSnapshotIds,
      "$.payload.itemSnapshotIds",
      errors
    );
  }

  function validateMealType(value, path, errors) {
    if (
      ![
        "breakfast",
        "lunch",
        "dinner",
        "snack",
        "other"
      ].includes(value)
    ) {
      addError(
        errors,
        "NUT-MEAL-001",
        path,
        "Öğün türü geçersiz."
      );
    }
  }

  function validateMealEntry(payload, errors) {
    validateMealType(
      payload.mealType,
      "$.payload.mealType",
      errors
    );

    validateIdArray(
      payload.itemSnapshotIds,
      "$.payload.itemSnapshotIds",
      errors,
      {
        allowEmpty:
          payload.coverage === "unspecified"
      }
    );

    if (
      !STATUS_CODES.coverage.includes(
        payload.coverage
      )
    ) {
      addError(
        errors,
        "NUT-MEAL-002",
        "$.payload.coverage",
        "Öğün kayıt kapsamı geçersiz."
      );
    }

    if (!isNullableIdentifier(payload.plannedMealId)) {
      addError(
        errors,
        "NUT-MEAL-003",
        "$.payload.plannedMealId",
        "Planlanan öğün referansı geçersiz."
      );
    }
  }

  function validateMealItemSnapshot(payload, errors) {
    if (
      ![
        "food_version",
        "recipe_version",
        "custom"
      ].includes(payload.itemKind)
    ) {
      addError(
        errors,
        "NUT-SNAPSHOT-001",
        "$.payload.itemKind",
        "Öğün öğesi türü geçersiz."
      );
    }

    if (!isNullableIdentifier(payload.referenceId)) {
      addError(
        errors,
        "NUT-SNAPSHOT-002",
        "$.payload.referenceId",
        "Öğün öğesi referansı geçersiz."
      );
    }

    if (
      payload.itemKind !== "custom" &&
      !isIdentifier(payload.referenceId)
    ) {
      addError(
        errors,
        "NUT-SNAPSHOT-003",
        "$.payload.referenceId",
        "Kütüphane öğesinde sürümlü kaynak referansı zorunludur."
      );
    }

    if (!isText(payload.name)) {
      addError(
        errors,
        "NUT-SNAPSHOT-004",
        "$.payload.name",
        "Öğün öğesi adı geçersiz."
      );
    }

    errors.push(
      ...validateMeasurement(
        payload.amount,
        {
          path: "$.payload.amount"
        }
      ).errors
    );

    validateMeasurementMap(
      payload.nutrients,
      "$.payload.nutrients",
      errors,
      { allowEmpty: true }
    );

    if (
      payload.sourceVersion !== null &&
      !isVersion(payload.sourceVersion)
    ) {
      addError(
        errors,
        "NUT-SNAPSHOT-005",
        "$.payload.sourceVersion",
        "Öğün öğesi kaynak sürümü geçersiz."
      );
    }

    if (
      payload.itemKind !== "custom" &&
      !isVersion(payload.sourceVersion)
    ) {
      addError(
        errors,
        "NUT-SNAPSHOT-006",
        "$.payload.sourceVersion",
        "Kütüphane öğesinde kaynak sürümü zorunludur."
      );
    }
  }

  function validateHydration(payload, errors) {
    if (!isIdentifier(payload.beverageType)) {
      addError(
        errors,
        "NUT-HYDRATION-001",
        "$.payload.beverageType",
        "İçecek türü geçersiz."
      );
    }

    errors.push(
      ...validateMeasurement(
        payload.amount,
        {
          path: "$.payload.amount"
        }
      ).errors
    );
  }

  function validateMealPlan(payload, errors) {
    if (!isDate(payload.startDate)) {
      addError(
        errors,
        "NUT-PLAN-001",
        "$.payload.startDate",
        "Plan başlangıcı geçerli bir tarih olmalıdır."
      );
    }

    if (!isDate(payload.endDate)) {
      addError(
        errors,
        "NUT-PLAN-002",
        "$.payload.endDate",
        "Plan bitişi geçerli bir tarih olmalıdır."
      );
    }

    if (
      isDate(payload.startDate) &&
      isDate(payload.endDate) &&
      payload.startDate > payload.endDate
    ) {
      addError(
        errors,
        "NUT-PLAN-003",
        "$.payload.endDate",
        "Plan bitişi başlangıçtan önce olamaz."
      );
    }

    if (
      ![
        "draft",
        "active",
        "completed",
        "archived"
      ].includes(payload.status)
    ) {
      addError(
        errors,
        "NUT-PLAN-004",
        "$.payload.status",
        "Öğün planı durumu geçersiz."
      );
    }

    validateIdArray(
      payload.plannedMealIds,
      "$.payload.plannedMealIds",
      errors,
      { allowEmpty: true }
    );
  }

  function validatePlannedMeal(payload, errors) {
    validateMealType(
      payload.mealType,
      "$.payload.mealType",
      errors
    );

    validateIdArray(
      payload.itemSnapshotIds,
      "$.payload.itemSnapshotIds",
      errors
    );

    if (
      ![
        "planned",
        "linked",
        "skipped",
        "cancelled"
      ].includes(payload.status)
    ) {
      addError(
        errors,
        "NUT-PLANNED-MEAL-001",
        "$.payload.status",
        "Planlanan öğün durumu geçersiz."
      );
    }

    if (!isNullableIdentifier(payload.mealEntryId)) {
      addError(
        errors,
        "NUT-PLANNED-MEAL-002",
        "$.payload.mealEntryId",
        "Gerçek öğün referansı geçersiz."
      );
    }

    if (
      payload.status === "linked" &&
      !isIdentifier(payload.mealEntryId)
    ) {
      addError(
        errors,
        "NUT-PLANNED-MEAL-003",
        "$.payload.mealEntryId",
        "Bağlanmış plan için ayrı gerçek öğün referansı zorunludur."
      );
    }

    if (
      payload.status !== "linked" &&
      payload.mealEntryId !== null
    ) {
      addError(
        errors,
        "NUT-PLANNED-MEAL-004",
        "$.payload.mealEntryId",
        "Yalnız bağlanmış plan gerçek öğün referansı taşıyabilir."
      );
    }
  }

  function validateBatch(payload, errors) {
    if (!isIdentifier(payload.recipeVersionId)) {
      addError(
        errors,
        "NUT-BATCH-001",
        "$.payload.recipeVersionId",
        "Tarif sürümü referansı geçersiz."
      );
    }

    errors.push(
      ...validateMeasurement(
        payload.producedPortions,
        {
          path:
            "$.payload.producedPortions"
        }
      ).errors
    );

    validateIdArray(
      payload.leftoverPortionIds,
      "$.payload.leftoverPortionIds",
      errors,
      { allowEmpty: true }
    );
  }

  function validateLeftover(payload, errors) {
    if (!isIdentifier(payload.batchPreparationId)) {
      addError(
        errors,
        "NUT-LEFTOVER-001",
        "$.payload.batchPreparationId",
        "Toplu hazırlık referansı geçersiz."
      );
    }

    errors.push(
      ...validateMeasurement(
        payload.amount,
        {
          path: "$.payload.amount"
        }
      ).errors
    );

    if (
      ![
        "available",
        "reserved",
        "used",
        "discarded"
      ].includes(payload.status)
    ) {
      addError(
        errors,
        "NUT-LEFTOVER-002",
        "$.payload.status",
        "Kalan porsiyon durumu geçersiz."
      );
    }

    if (!isNullableIdentifier(payload.mealEntryId)) {
      addError(
        errors,
        "NUT-LEFTOVER-003",
        "$.payload.mealEntryId",
        "Gerçek öğün referansı geçersiz."
      );
    }

    if (
      payload.status === "used" &&
      !isIdentifier(payload.mealEntryId)
    ) {
      addError(
        errors,
        "NUT-LEFTOVER-004",
        "$.payload.mealEntryId",
        "Kullanılmış porsiyon ayrı gerçek öğün kaydına bağlanmalıdır."
      );
    }
  }

  function validateShoppingList(payload, errors) {
    if (!isText(payload.name)) {
      addError(
        errors,
        "NUT-SHOPPING-001",
        "$.payload.name",
        "Alışveriş listesi adı geçersiz."
      );
    }

    if (
      ![
        "active",
        "completed",
        "archived"
      ].includes(payload.status)
    ) {
      addError(
        errors,
        "NUT-SHOPPING-002",
        "$.payload.status",
        "Alışveriş listesi durumu geçersiz."
      );
    }

    validateIdArray(
      payload.itemIds,
      "$.payload.itemIds",
      errors,
      { allowEmpty: true }
    );
  }

  function validateShoppingItem(payload, errors) {
    if (!isText(payload.name)) {
      addError(
        errors,
        "NUT-SHOPPING-ITEM-001",
        "$.payload.name",
        "Alışveriş öğesi adı geçersiz."
      );
    }

    errors.push(
      ...validateMeasurement(
        payload.amount,
        {
          path: "$.payload.amount"
        }
      ).errors
    );

    if (
      ![
        "needed",
        "in_cart",
        "bought",
        "skipped"
      ].includes(payload.status)
    ) {
      addError(
        errors,
        "NUT-SHOPPING-ITEM-002",
        "$.payload.status",
        "Alışveriş öğesi durumu geçersiz."
      );
    }

    validateIdArray(
      payload.plannedMealIds,
      "$.payload.plannedMealIds",
      errors,
      { allowEmpty: true }
    );
  }

  function validateAvailability(payload, errors) {
    if (
      ![
        "food_version",
        "recipe_version",
        "custom"
      ].includes(payload.itemKind)
    ) {
      addError(
        errors,
        "NUT-AVAILABILITY-001",
        "$.payload.itemKind",
        "Evde bulunan öğe türü geçersiz."
      );
    }

    if (!isNullableIdentifier(payload.referenceId)) {
      addError(
        errors,
        "NUT-AVAILABILITY-002",
        "$.payload.referenceId",
        "Evde bulunan öğe referansı geçersiz."
      );
    }

    errors.push(
      ...validateMeasurement(
        payload.amount,
        {
          path: "$.payload.amount"
        }
      ).errors
    );
  }

  function validateHealthReference(
    payload,
    errors,
    expectedRelation
  ) {
    if (!isIdentifier(payload.healthRecordId)) {
      addError(
        errors,
        "NUT-HEALTH-REF-001",
        "$.payload.healthRecordId",
        "Health kayıt referansı geçersiz."
      );
    }

    if (payload.relation !== expectedRelation) {
      addError(
        errors,
        "NUT-HEALTH-REF-002",
        "$.payload.relation",
        "Health referans ilişki türü kayıt türüyle eşleşmiyor."
      );
    }
  }

  function validateSummary(payload, errors) {
    validatePeriod(
      payload.period,
      "$.payload.period",
      errors
    );
    validateIdArray(
      payload.usedRecordIds,
      "$.payload.usedRecordIds",
      errors
    );
    validateCoverage(
      payload.coverage,
      "$.payload.coverage",
      errors
    );
    validateMeasurementMap(
      payload.metrics,
      "$.payload.metrics",
      errors,
      { allowEmpty: true }
    );
  }

  function validateInsight(payload, errors) {
    validatePeriod(
      payload.period,
      "$.payload.period",
      errors
    );
    validateIdArray(
      payload.usedRecordIds,
      "$.payload.usedRecordIds",
      errors
    );

    if (!isText(
      payload.observation,
      MAX_LONG_TEXT_LENGTH
    )) {
      addError(
        errors,
        "NUT-INSIGHT-001",
        "$.payload.observation",
        "İçgörü gözlemi geçersiz."
      );
    }

    validateTextArray(
      payload.basis,
      "$.payload.basis",
      errors
    );

    if (
      !STATUS_CODES.relationship.includes(
        payload.relationshipType
      )
    ) {
      addError(
        errors,
        "NUT-INVARIANT-008",
        "$.payload.relationshipType",
        "İçgörü yalnız betimleyici veya ilişki düzeyinde olabilir; nedensellik iddiası kullanılamaz."
      );
    }

    if (!isText(
      payload.uncertainty,
      MAX_LONG_TEXT_LENGTH
    )) {
      addError(
        errors,
        "NUT-INSIGHT-002",
        "$.payload.uncertainty",
        "İçgörü belirsizliği açıkça belirtilmelidir."
      );
    }

    if (
      payload.aiNarrationVersion !== null &&
      !isVersion(payload.aiNarrationVersion)
    ) {
      addError(
        errors,
        "NUT-INSIGHT-003",
        "$.payload.aiNarrationVersion",
        "AI anlatım sürümü geçersiz."
      );
    }
  }

  function validateSharing(value, errors) {
    const path = "$.payload.sharing";

    if (!isPlainObject(value)) {
      addError(
        errors,
        "NUT-SHARING-001",
        path,
        "Paylaşım bilgisi düz bir nesne olmalıdır."
      );
      return;
    }

    if (!STATUS_CODES.sharing.includes(value.status)) {
      addError(
        errors,
        "NUT-SHARING-002",
        `${path}.status`,
        "Paylaşım durumu geçersiz."
      );
    }

    if (value.status === "not_shared") {
      if (value.consent !== null) {
        addError(
          errors,
          "NUT-SHARING-003",
          `${path}.consent`,
          "Paylaşılmamış rapor paylaşım onayı taşımaz."
        );
      }
      return;
    }

    if (!isPlainObject(value.consent)) {
      addError(
        errors,
        "NUT-INVARIANT-009",
        `${path}.consent`,
        "Paylaşılmış raporda ayrı ve açık kullanıcı onayı zorunludur."
      );
      return;
    }

    if (value.consent.granted !== true) {
      addError(
        errors,
        "NUT-INVARIANT-010",
        `${path}.consent.granted`,
        "Paylaşım onayı açıkça verilmiş olmalıdır."
      );
    }

    if (!isText(value.consent.purpose)) {
      addError(
        errors,
        "NUT-SHARING-004",
        `${path}.consent.purpose`,
        "Paylaşım amacı belirtilmelidir."
      );
    }

    if (!isDateTime(value.consent.grantedAt)) {
      addError(
        errors,
        "NUT-SHARING-005",
        `${path}.consent.grantedAt`,
        "Paylaşım onayı zamanı geçersiz."
      );
    }

    if (
      ![
        "device_save",
        "device_share"
      ].includes(value.method)
    ) {
      addError(
        errors,
        "NUT-SHARING-006",
        `${path}.method`,
        "İlk sürüm paylaşım yöntemi geçersiz."
      );
    }
  }

  function validateReport(payload, errors) {
    validatePeriod(
      payload.period,
      "$.payload.period",
      errors
    );
    validateIdArray(
      payload.includedRecordIds,
      "$.payload.includedRecordIds",
      errors
    );
    validateCoverage(
      payload.coverage,
      "$.payload.coverage",
      errors
    );

    if (!isNullableIdentifier(payload.goalVersionId)) {
      addError(
        errors,
        "NUT-REPORT-001",
        "$.payload.goalVersionId",
        "Rapor hedef sürümü referansı geçersiz."
      );
    }

    validateIdArray(
      payload.referenceSourceIds,
      "$.payload.referenceSourceIds",
      errors,
      { allowEmpty: true }
    );
    validateTextArray(
      payload.includedSections,
      "$.payload.includedSections",
      errors
    );
    validateTextArray(
      payload.hiddenFields,
      "$.payload.hiddenFields",
      errors,
      { allowEmpty: true }
    );

    if (
      payload.aiNarrationVersion !== null &&
      !isVersion(payload.aiNarrationVersion)
    ) {
      addError(
        errors,
        "NUT-REPORT-002",
        "$.payload.aiNarrationVersion",
        "Rapor AI anlatım sürümü geçersiz."
      );
    }

    validateSharing(payload.sharing, errors);
  }

  function validateReminder(payload, errors) {
    if (
      ![
        "meal_log",
        "hydration_log",
        "meal_plan",
        "reflection"
      ].includes(payload.reminderKind)
    ) {
      addError(
        errors,
        "NUT-REMINDER-001",
        "$.payload.reminderKind",
        "Beslenme hatırlatıcısı türü geçersiz."
      );
    }

    if (typeof payload.enabled !== "boolean") {
      addError(
        errors,
        "NUT-REMINDER-002",
        "$.payload.enabled",
        "Hatırlatıcı etkinlik durumu boolean olmalıdır."
      );
    }

    if (typeof payload.userInitiated !== "boolean") {
      addError(
        errors,
        "NUT-REMINDER-003",
        "$.payload.userInitiated",
        "Hatırlatıcının kullanıcı tarafından açıldığı belirtilmelidir."
      );
    }

    if (
      payload.enabled === true &&
      payload.userInitiated !== true
    ) {
      addError(
        errors,
        "NUT-INVARIANT-011",
        "$.payload.userInitiated",
        "Beslenme hatırlatıcısı kullanıcı açmadan etkinleşemez."
      );
    }

    if (!isPlainObject(payload.schedule)) {
      addError(
        errors,
        "NUT-REMINDER-004",
        "$.payload.schedule",
        "Hatırlatıcı programı düz bir nesne olmalıdır."
      );
    } else {
      if (
        payload.schedule.kind !==
        "local_time"
      ) {
        addError(
          errors,
          "NUT-REMINDER-005",
          "$.payload.schedule.kind",
          "İlk sürümde yalnız yerel saat programı desteklenir."
        );
      }

      if (!TIME_PATTERN.test(
        payload.schedule.localTime || ""
      )) {
        addError(
          errors,
          "NUT-REMINDER-006",
          "$.payload.schedule.localTime",
          "Yerel saat HH:MM biçiminde olmalıdır."
        );
      }

      if (!isText(payload.schedule.timezone)) {
        addError(
          errors,
          "NUT-REMINDER-007",
          "$.payload.schedule.timezone",
          "Hatırlatıcı zaman dilimi zorunludur."
        );
      }

      if (!Array.isArray(
        payload.schedule.daysOfWeek
      )) {
        addError(
          errors,
          "NUT-REMINDER-008",
          "$.payload.schedule.daysOfWeek",
          "Hafta günleri bir liste olmalıdır."
        );
      } else {
        const uniqueDays = new Set(
          payload.schedule.daysOfWeek
        );

        if (
          uniqueDays.size !==
          payload.schedule.daysOfWeek.length ||
          payload.schedule.daysOfWeek.some(
            day =>
              !Number.isInteger(day) ||
              day < 1 ||
              day > 7
          )
        ) {
          addError(
            errors,
            "NUT-REMINDER-009",
            "$.payload.schedule.daysOfWeek",
            "Hafta günleri tekrarsız 1–7 değerlerinden oluşmalıdır."
          );
        }
      }
    }

    if (
      ![
        "gentle",
        "neutral"
      ].includes(payload.messageStyle)
    ) {
      addError(
        errors,
        "NUT-REMINDER-010",
        "$.payload.messageStyle",
        "Hatırlatıcı dili geçersiz."
      );
    }
  }

  const TYPE_VALIDATORS = {
    nutrition_profile:
      validateProfile,
    dietary_constraint:
      validateConstraint,
    nutrition_goal_version:
      validateGoal,
    food_version:
      validateFood,
    recipe_version:
      validateRecipe,
    meal_template:
      validateMealTemplate,
    meal_entry:
      validateMealEntry,
    meal_item_snapshot:
      validateMealItemSnapshot,
    hydration_entry:
      validateHydration,
    meal_plan:
      validateMealPlan,
    planned_meal:
      validatePlannedMeal,
    batch_preparation:
      validateBatch,
    leftover_portion:
      validateLeftover,
    shopping_list:
      validateShoppingList,
    shopping_list_item:
      validateShoppingItem,
    home_availability:
      validateAvailability,
    activity_reference:
      (payload, errors) =>
        validateHealthReference(
          payload,
          errors,
          "activity"
        ),
    recovery_check:
      (payload, errors) =>
        validateHealthReference(
          payload,
          errors,
          "recovery"
        ),
    weight_reference:
      (payload, errors) =>
        validateHealthReference(
          payload,
          errors,
          "weight"
        ),
    nutrition_summary:
      validateSummary,
    insight_snapshot:
      validateInsight,
    report_snapshot:
      validateReport,
    nutrition_reminder:
      validateReminder
  };

  function resultFor(errors, warnings = []) {
    return deepFreeze({
      valid: errors.length === 0,
      contractVersion: CONTRACT_VERSION,
      schemaId: SCHEMA_ID,
      errors: errors.map(error => ({
        ...error
      })),
      warnings: warnings.map(warning => ({
        ...warning
      }))
    });
  }

  function validateRecord(record) {
    const errors =
      validateJsonSafety(record);

    validateCommon(record, errors);

    if (
      !isPlainObject(record) ||
      !RECORD_TYPES.includes(record.type) ||
      !isPlainObject(record.payload)
    ) {
      return resultFor(errors);
    }

    const definition =
      CONTRACT_DEFINITIONS[record.type];

    validateDefinitionRules(
      record,
      definition,
      errors
    );

    const validator =
      TYPE_VALIDATORS[record.type];

    validator(record.payload, errors);

    if (
      [
        "nutrition_summary",
        "insight_snapshot",
        "report_snapshot"
      ].includes(record.type) &&
      record.calculationVersion === null
    ) {
      addError(
        errors,
        "NUT-INVARIANT-012",
        "$.calculationVersion",
        "Özet, içgörü ve rapor kayıtlarında hesaplama sürümü zorunludur."
      );
    }

    return resultFor(errors);
  }

  function getReferenceRules(record) {
    const payload = record.payload;
    const rules = [];

    function add(id, expectedType, path) {
      if (isIdentifier(id)) {
        rules.push({
          id,
          expectedType,
          path
        });
      }
    }

    function addMany(ids, expectedType, path) {
      if (!Array.isArray(ids)) {
        return;
      }

      ids.forEach((id, index) => {
        add(
          id,
          expectedType,
          `${path}[${index}]`
        );
      });
    }

    switch (record.type) {
      case "nutrition_profile":
        addMany(
          payload.dietaryConstraintIds,
          "dietary_constraint",
          "$.payload.dietaryConstraintIds"
        );
        add(
          payload.primaryGoalVersionId,
          "nutrition_goal_version",
          "$.payload.primaryGoalVersionId"
        );
        break;
      case "nutrition_goal_version":
        add(
          payload.supersedesId,
          "nutrition_goal_version",
          "$.payload.supersedesId"
        );
        break;
      case "recipe_version":
        addMany(
          payload.ingredientSnapshotIds,
          "meal_item_snapshot",
          "$.payload.ingredientSnapshotIds"
        );
        break;
      case "meal_template":
      case "planned_meal":
      case "meal_entry":
        addMany(
          payload.itemSnapshotIds,
          "meal_item_snapshot",
          "$.payload.itemSnapshotIds"
        );
        if (record.type === "meal_entry") {
          add(
            payload.plannedMealId,
            "planned_meal",
            "$.payload.plannedMealId"
          );
        }
        if (record.type === "planned_meal") {
          add(
            payload.mealEntryId,
            "meal_entry",
            "$.payload.mealEntryId"
          );
        }
        break;
      case "meal_item_snapshot":
        if (payload.itemKind !== "custom") {
          add(
            payload.referenceId,
            payload.itemKind,
            "$.payload.referenceId"
          );
        }
        break;
      case "meal_plan":
        addMany(
          payload.plannedMealIds,
          "planned_meal",
          "$.payload.plannedMealIds"
        );
        break;
      case "batch_preparation":
        add(
          payload.recipeVersionId,
          "recipe_version",
          "$.payload.recipeVersionId"
        );
        addMany(
          payload.leftoverPortionIds,
          "leftover_portion",
          "$.payload.leftoverPortionIds"
        );
        break;
      case "leftover_portion":
        add(
          payload.batchPreparationId,
          "batch_preparation",
          "$.payload.batchPreparationId"
        );
        add(
          payload.mealEntryId,
          "meal_entry",
          "$.payload.mealEntryId"
        );
        break;
      case "shopping_list":
        addMany(
          payload.itemIds,
          "shopping_list_item",
          "$.payload.itemIds"
        );
        break;
      case "shopping_list_item":
        addMany(
          payload.plannedMealIds,
          "planned_meal",
          "$.payload.plannedMealIds"
        );
        break;
      default:
        break;
    }

    return rules;
  }

  function validateRecordSet(
    records,
    options = {}
  ) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(records)) {
      addError(
        errors,
        "NUT-SET-001",
        "$",
        "Kayıt kümesi bir liste olmalıdır."
      );
      return resultFor(errors, warnings);
    }

    const recordsById = new Map();

    records.forEach((record, index) => {
      const result = validateRecord(record);

      result.errors.forEach(error => {
        addError(
          errors,
          error.code,
          `$[${index}]${
            error.path === "$"
              ? ""
              : error.path.slice(1)
          }`,
          error.message
        );
      });

      if (isPlainObject(record) && isIdentifier(record.id)) {
        if (recordsById.has(record.id)) {
          addError(
            errors,
            "NUT-SET-002",
            `$[${index}].id`,
            "Kayıt kümesinde yinelenen kimlik olamaz."
          );
        } else {
          recordsById.set(record.id, record);
        }
      }
    });

    const activeGoals = records.filter(record =>
      isPlainObject(record) &&
      record.type ===
        "nutrition_goal_version" &&
      record.recordStatus === "active"
    );

    if (activeGoals.length > 1) {
      addError(
        errors,
        "NUT-SET-003",
        "$",
        "Aynı veri kümesinde birden fazla etkin ana beslenme hedefi olamaz."
      );
    }

    records.forEach((record, index) => {
      if (
        !isPlainObject(record) ||
        !isPlainObject(record.payload) ||
        !RECORD_TYPES.includes(record.type)
      ) {
        return;
      }

      getReferenceRules(record).forEach(rule => {
        const target = recordsById.get(rule.id);

        if (!target) {
          const targetList =
            options.requireReferences === true
              ? errors
              : warnings;

          targetList.push({
            code:
              options.requireReferences === true
                ? "NUT-SET-004"
                : "NUT-SET-W001",
            path:
              `$[${index}]${rule.path.slice(1)}`,
            message:
              "Başvurulan kayıt bu veri kümesinde bulunmuyor."
          });
          return;
        }

        if (target.type !== rule.expectedType) {
          addError(
            errors,
            "NUT-SET-005",
            `$[${index}]${rule.path.slice(1)}`,
            "Başvurulan kayıt beklenen türle eşleşmiyor."
          );
        }
      });
    });

    return resultFor(errors, warnings);
  }

  function cloneValue(value) {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(cloneValue);
    }

    const clone = Object.create(null);

    Object.keys(value).forEach(key => {
      clone[key] = cloneValue(value[key]);
    });

    return clone;
  }

  function createRecord(candidate) {
    const result = validateRecord(candidate);

    if (!result.valid) {
      const error = new Error(
        "Today Nutrition: Kayıt veri sözleşmesini karşılamıyor."
      );
      error.code = "NUT-CONTRACT-INVALID";
      error.validationErrors =
        result.errors;
      throw error;
    }

    return deepFreeze(cloneValue(candidate));
  }

  function createUnknownMeasurement(unit = null) {
    const candidate = {
      status: "unknown",
      value: null,
      unit,
      basis: null
    };
    const result =
      validateMeasurement(candidate);

    if (!result.valid) {
      throw new Error(
        "Today Nutrition: Bilinmeyen ölçüm birimi geçersiz."
      );
    }

    return deepFreeze(candidate);
  }

  function createKnownMeasurement(value, unit) {
    const candidate = {
      status: "known",
      value,
      unit,
      basis: null
    };
    const result =
      validateMeasurement(candidate);

    if (!result.valid) {
      throw new Error(
        "Today Nutrition: Bilinen ölçüm geçersiz."
      );
    }

    return deepFreeze(candidate);
  }

  function createEstimatedMeasurement(
    value,
    unit,
    basis
  ) {
    const candidate = {
      status: "estimated",
      value,
      unit,
      basis
    };
    const result =
      validateMeasurement(candidate);

    if (!result.valid) {
      throw new Error(
        "Today Nutrition: Tahmini ölçüm geçersiz."
      );
    }

    return deepFreeze(candidate);
  }

  function getContract(type) {
    return CONTRACT_DEFINITIONS[type] || null;
  }

  function listContracts() {
    return Object.freeze(
      RECORD_TYPES.map(type =>
        Object.freeze({
          type,
          ...CONTRACT_DEFINITIONS[type]
        })
      )
    );
  }

  window.TodayNutritionContracts =
    Object.freeze({
      CONTRACT_VERSION,
      SCHEMA_ID,
      RECORD_TYPES,
      STATUS_CODES,
      validateMeasurement,
      validateRecord,
      validateRecordSet,
      createRecord,
      createUnknownMeasurement,
      createKnownMeasurement,
      createEstimatedMeasurement,
      getContract,
      listContracts
    });
})();
