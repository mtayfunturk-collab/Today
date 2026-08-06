/**
 * Today App — Nutrition Planning
 * NUT-007 — Meal plans and planned-meal lifecycle
 *
 * This module is local-first and UI/network agnostic. It creates meal plans,
 * planned meals and immutable planning snapshots through the existing
 * nutrition contracts and atomic IndexedDB storage boundary.
 */

(function () {
  "use strict";

  const PLANNING_API_VERSION = 1;
  const PLANNING_RULESET_ID =
    "today:nutrition:planning:v1";
  const PLAN_EXTENSION_KEY =
    "today.nutrition.planning";
  const SNAPSHOT_EXTENSION_KEY =
    "today.nutrition.planning-snapshot";
  const AI_REQUEST_EXTENSION_KEY =
    "today.nutrition.planning-ai-request";
  const APPROVAL_EXTENSION_KEY =
    "today.nutrition.planning-approval";
  const DEFAULT_TIME_ZONE =
    "Europe/Istanbul";

  const PLAN_RECORD_TYPES = deepFreeze([
    "meal_plan",
    "planned_meal"
  ]);
  const PLAN_STATUSES = deepFreeze([
    "draft",
    "active",
    "completed",
    "archived"
  ]);
  const PLANNED_MEAL_STATUSES = deepFreeze([
    "planned",
    "linked",
    "skipped",
    "cancelled"
  ]);
  const MEAL_TYPES = deepFreeze([
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "other"
  ]);

  const IDENTIFIER_PATTERN =
    /^[a-z0-9](?:[a-z0-9._:-]{0,78}[a-z0-9])?$/;
  const VERSION_PATTERN =
    /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/i;
  const DATE_PATTERN =
    /^\d{4}-\d{2}-\d{2}$/;
  const TIME_ZONE_PATTERN =
    /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/;
  const MAX_TEXT_LENGTH = 500;
  const MAX_MEAL_COUNT = 100;
  const MAX_ITEM_COUNT = 100;
  const MAX_HISTORY_COUNT = 20;

  let idCounter = 0;
  let writeTail = Promise.resolve();

  function createError(
    code,
    message,
    detail = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name =
      "TodayNutritionPlanningError";
    error.todayCode = code;
    error.detail = detail;

    if (cause) {
      error.cause = cause;
    }

    return error;
  }

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }

    if (
      typeof structuredClone ===
      "function"
    ) {
      return structuredClone(value);
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function deepFreeze(value) {
    if (
      value === null ||
      typeof value !== "object" ||
      Object.isFrozen(value)
    ) {
      return value;
    }

    Object.keys(value).forEach(key =>
      deepFreeze(value[key])
    );

    return Object.freeze(value);
  }

  function freezeClone(value) {
    return deepFreeze(clone(value));
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
        prototype.constructor.name ===
          "Object"
      )
    );
  }

  function hasOwn(value, key) {
    return Object.prototype
      .hasOwnProperty
      .call(value, key);
  }

  function serializeWrite(operation) {
    const run = writeTail.then(
      operation,
      operation
    );

    writeTail =
      run.catch(() => undefined);

    return run;
  }

  function getDependencies() {
    const contracts =
      window.TodayNutritionContracts;
    const calculations =
      window.TodayNutritionCalculations;
    const storage =
      window.TodayNutritionStorage;
    const profile =
      window.TodayNutritionProfile;
    const library =
      window.TodayNutritionLibrary;
    const missing = [];

    [
      "validateMeasurement",
      "createRecord"
    ].forEach(methodName => {
      if (
        !contracts ||
        typeof contracts[methodName] !==
          "function"
      ) {
        missing.push(
          "TodayNutritionContracts." +
          methodName
        );
      }
    });

    [
      "buildCalculatedSnapshot",
      "scaleMeasurement",
      "scaleNutrientMap"
    ].forEach(methodName => {
      if (
        !calculations ||
        typeof calculations[methodName] !==
          "function"
      ) {
        missing.push(
          "TodayNutritionCalculations." +
          methodName
        );
      }
    });

    [
      "getRecord",
      "queryRecords",
      "saveRecords"
    ].forEach(methodName => {
      if (
        !storage ||
        typeof storage[methodName] !==
          "function"
      ) {
        missing.push(
          "TodayNutritionStorage." +
          methodName
        );
      }
    });

    [
      "getItem",
      "calculateItem",
      "getConstraintWarnings"
    ].forEach(methodName => {
      if (
        !library ||
        typeof library[methodName] !==
          "function"
      ) {
        missing.push(
          "TodayNutritionLibrary." +
          methodName
        );
      }
    });

    if (
      !profile ||
      typeof profile.getSnapshot !==
        "function"
    ) {
      missing.push(
        "TodayNutritionProfile.getSnapshot"
      );
    }

    if (missing.length > 0) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-001",
        "Beslenme planlama bağımlılıkları hazır değil.",
        { missing }
      );
    }

    return {
      contracts,
      calculations,
      storage,
      profile,
      library
    };
  }

  function assertUserConfirmation(options) {
    if (
      options?.userInitiated !== true ||
      options?.userConfirmed !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-003",
        "Öğün planı değişikliği açık kullanıcı işlemi ve onayı gerektirir."
      );
    }
  }

  function assertAiRequest(options) {
    if (
      options?.userRequested !== true ||
      options?.userDataUseApproved !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-007",
        "AI plan taslağı açık kullanıcı isteği ve veri kullanım onayı gerektirir."
      );
    }
  }

  function normalizeIdentifier(
    value,
    fieldName
  ) {
    const normalized =
      typeof value === "string"
        ? value.trim()
        : "";

    if (
      !IDENTIFIER_PATTERN.test(
        normalized
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " geçerli bir kimlik olmalıdır.",
        { fieldName }
      );
    }

    return normalized;
  }

  function normalizeOptionalIdentifier(
    value,
    fieldName
  ) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return null;
    }

    return normalizeIdentifier(
      value,
      fieldName
    );
  }

  function normalizeVersion(
    value,
    fieldName
  ) {
    const normalized =
      typeof value === "string"
        ? value.trim()
        : "";

    if (
      !VERSION_PATTERN.test(normalized)
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " geçerli bir sürüm olmalıdır.",
        { fieldName }
      );
    }

    return normalized;
  }

  function normalizeText(
    value,
    fieldName,
    options = {}
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      if (options.optional === true) {
        return null;
      }

      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName + " zorunludur."
      );
    }

    const normalized =
      typeof value === "string"
        ? value.trim()
        : "";

    if (
      (
        !normalized &&
        options.allowEmpty !== true
      ) ||
      normalized.length >
        (options.maxLength ||
          MAX_TEXT_LENGTH)
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName + " geçersiz."
      );
    }

    return normalized;
  }

  function normalizeDate(
    value,
    fieldName
  ) {
    const normalized =
      typeof value === "string"
        ? value.trim()
        : "";

    if (
      !DATE_PATTERN.test(normalized)
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " YYYY-MM-DD biçiminde olmalıdır."
      );
    }

    const date =
      new Date(normalized + "T00:00:00.000Z");

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !==
        normalized
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " geçerli bir tarih olmalıdır."
      );
    }

    return normalized;
  }

  function normalizeDateTime(
    value,
    fieldName
  ) {
    const parsed =
      typeof value === "string"
        ? Date.parse(value)
        : NaN;

    if (Number.isNaN(parsed)) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " geçerli bir tarih-saat olmalıdır."
      );
    }

    return new Date(parsed).toISOString();
  }

  function resolveTimestamp(
    options = {},
    minimum = null
  ) {
    const normalized =
      normalizeDateTime(
        options.at ||
          new Date().toISOString(),
        "İşlem zamanı"
      );

    if (
      minimum &&
      Date.parse(normalized) <
        Date.parse(minimum)
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "İşlem zamanı mevcut plan kaydından önce olamaz.",
        {
          minimum,
          received: normalized
        }
      );
    }

    return normalized;
  }

  function normalizeTimeZone(value) {
    const candidate =
      value === undefined ||
      value === null
        ? DEFAULT_TIME_ZONE
        : normalizeText(
            value,
            "Saat dilimi",
            { maxLength: 100 }
          );

    if (
      !TIME_ZONE_PATTERN.test(candidate)
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Saat dilimi geçersiz.",
        { timeZone: candidate }
      );
    }

    return candidate;
  }

  function normalizeMealType(value) {
    if (!MEAL_TYPES.includes(value)) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Öğün türü geçersiz.",
        { mealType: value || null }
      );
    }

    return value;
  }

  function normalizeMeasurement(
    value,
    fieldName,
    options = {}
  ) {
    const { contracts } =
      getDependencies();
    const result =
      contracts.validateMeasurement(
        value,
        { path: "$." + fieldName }
      );

    if (!result.valid) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " geçerli bir ölçüm olmalıdır.",
        {
          fieldName,
          validationErrors:
            clone(result.errors)
        }
      );
    }

    const measurement = clone(value);

    if (
      options.requireKnown === true &&
      measurement.status === "unknown"
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " bilinen veya açıklanmış tahmini bir değer taşımalıdır."
      );
    }

    if (
      measurement.status !== "unknown" &&
      options.allowZero !== true &&
      measurement.value <= 0
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " sıfırdan büyük olmalıdır."
      );
    }

    return measurement;
  }

  function normalizeNutrients(
    value,
    fieldName = "nutrients"
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      return {};
    }

    if (!isPlainObject(value)) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Besin değerleri düz bir nesne olmalıdır."
      );
    }

    const nutrients = {};

    Object.keys(value)
      .sort()
      .forEach(key => {
        normalizeIdentifier(
          key,
          fieldName + " anahtarı"
        );
        nutrients[key] =
          normalizeMeasurement(
            value[key],
            fieldName + "." + key,
            { allowZero: true }
          );
      });

    return nutrients;
  }

  function normalizeStringList(
    value,
    fieldName
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      return [];
    }

    if (
      !Array.isArray(value) ||
      value.length > MAX_ITEM_COUNT
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " geçerli bir liste olmalıdır."
      );
    }

    const result = [];
    const seen = new Set();

    value.forEach(item => {
      const normalized =
        normalizeText(
          item,
          fieldName
        );
      const key =
        normalized.toLocaleLowerCase(
          "tr-TR"
        );

      if (!seen.has(key)) {
        seen.add(key);
        result.push(normalized);
      }
    });

    return result;
  }

  function createIdentifier(prefix) {
    idCounter += 1;
    let suffix;

    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {
      suffix =
        window.crypto.randomUUID();
    } else {
      suffix = [
        Date.now().toString(36),
        idCounter.toString(36),
        Math.random()
          .toString(36)
          .slice(2, 10)
      ].join("-");
    }

    return (
      prefix +
      ":" +
      suffix
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9._:-]/g,
        "-"
      )
      .slice(0, 80);
  }

  function buildRecord(candidate) {
    const { contracts } =
      getDependencies();

    try {
      return clone(
        contracts.createRecord(candidate)
      );
    } catch (error) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-005",
        "Beslenme planlama kaydı veri sözleşmesine uygun değil.",
        {
          type:
            candidate?.type || null,
          validationErrors:
            clone(
              error?.validationErrors ||
              []
            )
        },
        error
      );
    }
  }

  function manualSource() {
    return {
      kind: "manual",
      referenceId: null,
      version: null
    };
  }

  function aiSource(input, options) {
    const candidate =
      input?.aiSource ||
      options?.aiSource;

    if (!isPlainObject(candidate)) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-007",
        "AI plan taslağı kaynak izi zorunludur."
      );
    }

    return {
      kind: "ai_draft",
      referenceId:
        normalizeIdentifier(
          candidate.referenceId,
          "AI istek kimliği"
        ),
      version:
        normalizeVersion(
          candidate.version,
          "AI sürümü"
        )
    };
  }

  function deriveKnowledgeStatus(
    snapshots,
    draft = false
  ) {
    if (draft) {
      return "estimated";
    }

    if (
      !Array.isArray(snapshots) ||
      snapshots.length === 0
    ) {
      return "unknown";
    }

    const statuses =
      snapshots.map(
        snapshot =>
          snapshot.knowledgeStatus
      );

    if (statuses.includes("unknown")) {
      return "unknown";
    }

    if (statuses.includes("estimated")) {
      return "estimated";
    }

    return "known";
  }

  function normalizeLibraryItems(value) {
    if (
      value === undefined ||
      value === null
    ) {
      return [];
    }

    if (
      !Array.isArray(value) ||
      value.length > MAX_ITEM_COUNT
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "items geçerli bir liste olmalıdır."
      );
    }

    return value.map((item, index) => {
      if (!isPlainObject(item)) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "items[" +
            index +
            "] geçersiz."
        );
      }

      return {
        recordId:
          normalizeIdentifier(
            item.recordId,
            "items[" +
              index +
              "].recordId"
          ),
        amount:
          normalizeMeasurement(
            item.amount,
            "items[" +
              index +
              "].amount",
            { requireKnown: true }
          ),
        name:
          item.name === undefined
            ? null
            : normalizeText(
                item.name,
                "items[" +
                  index +
                  "].name"
              )
      };
    });
  }

  function normalizeCustomItems(
    value,
    options = {}
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      return [];
    }

    if (
      !Array.isArray(value) ||
      value.length > MAX_ITEM_COUNT
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "customItems geçerli bir liste olmalıdır."
      );
    }

    return value.map((item, index) => {
      if (!isPlainObject(item)) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "customItems[" +
            index +
            "] geçersiz."
        );
      }

      if (
        options.draft === true &&
        item.nutrients &&
        Object.keys(
          item.nutrients
        ).length > 0
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-007",
          "AI plan taslağı özel öğe için besin değeri üretemez."
        );
      }

      const defaultAmount = {
        status:
          options.draft === true
            ? "unknown"
            : "known",
        value:
          options.draft === true
            ? null
            : 1,
        unit: "portion",
        basis: null
      };

      return {
        name:
          normalizeText(
            item.name,
            "customItems[" +
              index +
              "].name"
          ),
        amount:
          normalizeMeasurement(
            item.amount ||
              defaultAmount,
            "customItems[" +
              index +
              "].amount",
            {
              requireKnown:
                options.draft !== true
            }
          ),
        nutrients:
          options.draft === true
            ? {}
            : normalizeNutrients(
                item.nutrients,
                "customItems[" +
                  index +
                  "].nutrients"
              ),
        constraintTags:
          normalizeStringList(
            item.constraintTags,
            "customItems[" +
              index +
              "].constraintTags"
          )
      };
    });
  }

  function normalizeMultiplier(value) {
    const candidate =
      value === undefined ||
      value === null
        ? 1
        : Number(value);

    if (
      !Number.isFinite(candidate) ||
      candidate <= 0
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Öğün şablonu çarpanı sıfırdan büyük olmalıdır."
      );
    }

    return candidate;
  }

  function normalizeMealInput(
    input,
    options = {}
  ) {
    if (!isPlainObject(input)) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Planlanan öğün düz bir nesne olmalıdır."
      );
    }

    const items =
      normalizeLibraryItems(
        input.items
      );
    const customItems =
      normalizeCustomItems(
        input.customItems,
        options
      );
    const templateId =
      normalizeOptionalIdentifier(
        input.templateId,
        "Öğün şablonu kimliği"
      );

    if (
      !templateId &&
      items.length === 0 &&
      customItems.length === 0
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Planlanan öğün en az bir şablon, kütüphane öğesi veya özel öğe içermelidir."
      );
    }

    return {
      plannedFor:
        normalizeDateTime(
          input.plannedFor,
          "Planlanan öğün zamanı"
        ),
      mealType:
        normalizeMealType(
          input.mealType
        ),
      templateId,
      templateMultiplier:
        normalizeMultiplier(
          input.templateMultiplier
        ),
      items,
      customItems,
      note:
        input.note === undefined
          ? null
          : normalizeText(
              input.note,
              "Planlanan öğün notu",
              {
                optional: true,
                allowEmpty: true
              }
            ),
      clientMealId:
        normalizeOptionalIdentifier(
          input.clientMealId,
          "İstemci öğün kimliği"
        )
    };
  }

  function normalizePlanInput(
    input,
    options = {}
  ) {
    if (!isPlainObject(input)) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Öğün planı düz bir nesne olmalıdır."
      );
    }

    const startDate =
      normalizeDate(
        input.startDate,
        "Plan başlangıcı"
      );
    const endDate =
      normalizeDate(
        input.endDate,
        "Plan bitişi"
      );

    if (startDate > endDate) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Plan bitişi başlangıçtan önce olamaz."
      );
    }

    const meals =
      input.meals === undefined
        ? []
        : input.meals;

    if (
      !Array.isArray(meals) ||
      meals.length > MAX_MEAL_COUNT
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Plan öğünleri geçerli bir liste olmalıdır."
      );
    }

    const normalizedMeals =
      meals.map(meal =>
        normalizeMealInput(
          meal,
          options
        )
      );
    const clientIds =
      normalizedMeals
        .map(meal => meal.clientMealId)
        .filter(Boolean);

    if (
      new Set(clientIds).size !==
      clientIds.length
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Aynı plan içinde istemci öğün kimliği yinelenemez."
      );
    }

    normalizedMeals.forEach(meal => {
      const mealDate =
        meal.plannedFor.slice(0, 10);

      if (
        mealDate < startDate ||
        mealDate > endDate
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "Planlanan öğün plan tarih aralığının dışında olamaz.",
          {
            plannedFor:
              meal.plannedFor,
            startDate,
            endDate
          }
        );
      }
    });

    return {
      startDate,
      endDate,
      title:
        input.title === undefined
          ? null
          : normalizeText(
              input.title,
              "Plan adı",
              {
                optional: true,
                allowEmpty: true,
                maxLength: 120
              }
            ),
      timeZone:
        normalizeTimeZone(
          input.timeZone
        ),
      meals: normalizedMeals
    };
  }

  function planningMeta(record) {
    return record?.extensions?.[
      PLAN_EXTENSION_KEY
    ] || null;
  }

  function planningSnapshotMeta(record) {
    return record?.extensions?.[
      SNAPSHOT_EXTENSION_KEY
    ] || null;
  }

  function uniqueWarnings(warnings) {
    const seen = new Set();
    const result = [];

    warnings.forEach(warning => {
      const key = [
        warning.constraintId || "",
        warning.label || "",
        warning.matchedTag || "",
        warning.sourceRecordId || ""
      ].join("|");

      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          ...clone(warning),
          blocking: false
        });
      }
    });

    return result;
  }

  async function warningsForTags(
    tags,
    sourceRecordId = null
  ) {
    if (
      !Array.isArray(tags) ||
      tags.length === 0
    ) {
      return [];
    }

    const profile =
      await getDependencies()
        .profile
        .getSnapshot();

    if (
      !profile ||
      !Array.isArray(
        profile.activeConstraints
      )
    ) {
      return [];
    }

    const normalizedTags =
      new Map(
        tags.map(tag => [
          String(tag)
            .trim()
            .toLocaleLowerCase(
              "tr-TR"
            ),
          tag
        ])
      );

    return profile.activeConstraints
      .filter(constraint => {
        const label =
          constraint?.label ||
          constraint?.payload?.label;

        return (
          label &&
          normalizedTags.has(
            label
              .trim()
              .toLocaleLowerCase(
                "tr-TR"
              )
          )
        );
      })
      .map(constraint => {
        const label =
          constraint.label ||
          constraint.payload.label;

        return {
          constraintId:
            constraint.id,
          category:
            constraint.category ||
            constraint.payload.kind,
          label,
          matchedTag:
            normalizedTags.get(
              label
                .trim()
                .toLocaleLowerCase(
                  "tr-TR"
                )
            ),
          blocking: false,
          sourceRecordId,
          message:
            label +
            " profil kısıtıyla eşleşen açıklanabilir bir plan etiketi bulundu."
        };
      });
  }

  async function warningsForLibrary(
    recordId
  ) {
    const warnings =
      await getDependencies()
        .library
        .getConstraintWarnings(
          recordId
        );

    return warnings.map(warning => ({
      ...clone(warning),
      sourceRecordId: recordId,
      blocking: false
    }));
  }

  function buildCustomSnapshot(
    item,
    options
  ) {
    const draft =
      options.draft === true;
    const nutrientStatuses =
      Object.values(
        item.nutrients
      ).map(
        measurement =>
          measurement.status
      );
    let knowledgeStatus = "known";

    if (
      Object.keys(item.nutrients)
        .length === 0 ||
      nutrientStatuses.includes(
        "unknown"
      )
    ) {
      knowledgeStatus = "unknown";
    } else if (
      item.amount.status ===
        "estimated" ||
      nutrientStatuses.includes(
        "estimated"
      )
    ) {
      knowledgeStatus = "estimated";
    }

    const source = draft
      ? clone(options.source)
      : manualSource();

    return buildRecord({
      id:
        createIdentifier(
          "plan-snapshot"
        ),
      type: "meal_item_snapshot",
      schemaVersion:
        getDependencies()
          .contracts
          .CONTRACT_VERSION,
      createdAt: options.timestamp,
      updatedAt: options.timestamp,
      eventAt: null,
      source,
      knowledgeStatus:
        draft
          ? "estimated"
          : knowledgeStatus,
      recordStatus:
        draft
          ? "draft"
          : "active",
      verificationStatus:
        draft
          ? "unverified"
          : "user_confirmed",
      calculationVersion: null,
      userEdited: false,
      payload: {
        itemKind: "custom",
        referenceId: null,
        name: item.name,
        amount: clone(item.amount),
        nutrients:
          clone(item.nutrients),
        sourceVersion: null
      },
      extensions: {
        [SNAPSHOT_EXTENSION_KEY]: {
          rulesetId:
            PLANNING_RULESET_ID,
          ownerPlanId:
            options.planId,
          ownerPlannedMealId:
            options.plannedMealId,
          captureMode: "custom",
          sourceSnapshotId: null,
          sourceLibraryRecordId:
            null,
          sourceTemplateId: null,
          constraintTags:
            clone(
              item.constraintTags
            ),
          originSource:
            manualSource(),
          originVerificationStatus:
            "user_confirmed",
          originKnowledgeStatus:
            knowledgeStatus,
          derivedFromDraftSnapshotId:
            null
        }
      }
    });
  }

  async function buildLibrarySnapshot(
    item,
    options
  ) {
    const {
      calculations,
      library
    } = getDependencies();
    let sourceRecord;

    try {
      sourceRecord =
        await library.getItem(
          item.recordId,
          { includeDraft: true }
        );
    } catch (error) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-005",
        "Plan kütüphane kaynağı bulunamadı veya doğrulanamadı.",
        {
          recordId: item.recordId,
          libraryError:
            error?.todayCode || null
        },
        error
      );
    }

    if (
      !sourceRecord ||
      ![
        "food_version",
        "recipe_version"
      ].includes(sourceRecord.type) ||
      sourceRecord.recordStatus !==
        "active" ||
      sourceRecord.source.kind ===
        "ai_draft" ||
      ![
        "user_confirmed",
        "source_verified"
      ].includes(
        sourceRecord
          .verificationStatus
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-005",
        "Plan yalnız etkin ve doğrulanmış besin veya tarif sürümünü kullanabilir.",
        { recordId: item.recordId }
      );
    }

    let calculation;

    try {
      calculation =
        await library.calculateItem(
          sourceRecord.id,
          item.amount
        );
    } catch (error) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-005",
        "Plan öğesi deterministik olarak hesaplanamadı.",
        {
          recordId: item.recordId,
          calculationError:
            error?.todayCode || null
        },
        error
      );
    }

    const raw = clone(
      calculations
        .buildCalculatedSnapshot({
          id:
            createIdentifier(
              "plan-snapshot"
            ),
          createdAt:
            options.timestamp,
          calculation,
          name:
            item.name ||
            sourceRecord.payload.name
        })
    );
    const libraryMeta =
      sourceRecord.extensions?.[
        "today.nutrition.library"
      ] || {};
    const originSource =
      clone(raw.source);
    const originVerificationStatus =
      raw.verificationStatus;
    const originKnowledgeStatus =
      raw.knowledgeStatus;

    if (options.draft === true) {
      raw.source =
        clone(options.source);
      raw.recordStatus = "draft";
      raw.verificationStatus =
        "unverified";
      raw.knowledgeStatus =
        "estimated";
    }

    raw.extensions[
      SNAPSHOT_EXTENSION_KEY
    ] = {
      rulesetId:
        PLANNING_RULESET_ID,
      ownerPlanId:
        options.planId,
      ownerPlannedMealId:
        options.plannedMealId,
      captureMode: "library",
      sourceSnapshotId: null,
      sourceLibraryRecordId:
        sourceRecord.id,
      sourceLogicalId:
        libraryMeta.logicalId || null,
      sourceVersion:
        libraryMeta.version ||
        sourceRecord.payload.version,
      sourceClass:
        libraryMeta.sourceClass ||
        null,
      sourceTemplateId: null,
      preparation:
        clone(
          libraryMeta.preparation ||
          null
        ),
      nutritionVersion:
        libraryMeta.nutritionVersion ||
        calculation
          .calculationVersion,
      constraintTags:
        clone(
          libraryMeta.constraintTags ||
          []
        ),
      originSource,
      originVerificationStatus,
      originKnowledgeStatus,
      derivedFromDraftSnapshotId:
        null
    };

    return buildRecord(raw);
  }

  function assertSourceSnapshot(
    snapshot
  ) {
    const { calculations } =
      getDependencies();

    if (
      !snapshot ||
      snapshot.type !==
        "meal_item_snapshot" ||
      snapshot.recordStatus !==
        "active" ||
      snapshot.source.kind ===
        "ai_draft" ||
      (
        snapshot.source.kind ===
          "system_calculation" &&
        snapshot.calculationVersion !==
          calculations
            .CALCULATION_VERSION
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-005",
        "Öğün şablonu anlık görüntüsü geçersiz veya doğrulanamaz.",
        {
          snapshotId:
            snapshot?.id || null
        }
      );
    }

    return snapshot;
  }

  function cloneTemplateSnapshot(
    sourceSnapshot,
    multiplier,
    options
  ) {
    const { calculations } =
      getDependencies();
    const source =
      assertSourceSnapshot(
        sourceSnapshot
      );
    const factor = {
      status: "known",
      value: multiplier,
      basis: null
    };
    const candidate = clone(source);
    const originSource =
      clone(source.source);
    const originVerificationStatus =
      source.verificationStatus;
    const originKnowledgeStatus =
      source.knowledgeStatus;
    const sourceTags =
      source.extensions?.[
        "today.nutrition.library-snapshot"
      ]?.constraintTags ||
      source.extensions?.[
        SNAPSHOT_EXTENSION_KEY
      ]?.constraintTags ||
      [];

    candidate.id =
      createIdentifier(
        "plan-snapshot"
      );
    candidate.createdAt =
      options.timestamp;
    candidate.updatedAt =
      options.timestamp;
    candidate.eventAt = null;
    candidate.payload.amount =
      clone(
        calculations.scaleMeasurement(
          source.payload.amount,
          factor
        )
      );
    candidate.payload.nutrients =
      clone(
        calculations.scaleNutrientMap(
          source.payload.nutrients,
          factor
        )
      );
    candidate.userEdited = false;

    if (options.draft === true) {
      candidate.source =
        clone(options.source);
      candidate.recordStatus =
        "draft";
      candidate.verificationStatus =
        "unverified";
      candidate.knowledgeStatus =
        "estimated";
    } else {
      candidate.recordStatus =
        "active";
    }

    candidate.extensions = {
      ...clone(
        candidate.extensions || {}
      ),
      [SNAPSHOT_EXTENSION_KEY]: {
        rulesetId:
          PLANNING_RULESET_ID,
        ownerPlanId:
          options.planId,
        ownerPlannedMealId:
          options.plannedMealId,
        captureMode: "template",
        sourceSnapshotId:
          source.id,
        sourceLibraryRecordId:
          null,
        sourceTemplateId:
          options.templateId,
        templateMultiplier:
          multiplier,
        constraintTags:
          clone(sourceTags),
        originSource,
        originVerificationStatus,
        originKnowledgeStatus,
        derivedFromDraftSnapshotId:
          null
      }
    };

    return buildRecord(candidate);
  }

  async function templateSnapshots(
    templateId,
    multiplier,
    options
  ) {
    const {
      library,
      storage
    } = getDependencies();
    let template;

    try {
      template =
        await library.getItem(
          templateId,
          { includeDraft: true }
        );
    } catch (error) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-005",
        "Plan öğün şablonu bulunamadı veya doğrulanamadı.",
        {
          templateId,
          libraryError:
            error?.todayCode || null
        },
        error
      );
    }

    if (
      !template ||
      template.type !==
        "meal_template" ||
      template.recordStatus !==
        "active" ||
      template.source.kind ===
        "ai_draft" ||
      ![
        "user_confirmed",
        "source_verified"
      ].includes(
        template.verificationStatus
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-005",
        "Plan yalnız etkin ve doğrulanmış öğün şablonunu kullanabilir.",
        { templateId }
      );
    }

    const snapshots = [];

    for (
      const snapshotId of
      template.payload
        .itemSnapshotIds
    ) {
      const snapshot =
        await storage.getRecord(
          snapshotId,
          {
            includeAiDraft: true
          }
        );

      snapshots.push(
        cloneTemplateSnapshot(
          snapshot,
          multiplier,
          {
            ...options,
            templateId
          }
        )
      );
    }

    return snapshots;
  }

  async function buildMealContent(
    meal,
    options
  ) {
    const snapshots = [];
    const warnings = [];
    const modes = [];

    if (meal.templateId) {
      const templateItems =
        await templateSnapshots(
          meal.templateId,
          meal.templateMultiplier,
          options
        );

      snapshots.push(
        ...templateItems
      );
      warnings.push(
        ...await warningsForLibrary(
          meal.templateId
        )
      );
      modes.push("template");
    }

    for (const item of meal.items) {
      snapshots.push(
        await buildLibrarySnapshot(
          item,
          options
        )
      );
      warnings.push(
        ...await warningsForLibrary(
          item.recordId
        )
      );
      modes.push("library");
    }

    for (
      const item of
      meal.customItems
    ) {
      snapshots.push(
        buildCustomSnapshot(
          item,
          options
        )
      );
      warnings.push(
        ...await warningsForTags(
          item.constraintTags
        )
      );
      modes.push("custom");
    }

    if (
      snapshots.length === 0 ||
      snapshots.length >
        MAX_ITEM_COUNT
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Planlanan öğün geçerli sayıda öğe içermelidir."
      );
    }

    return {
      snapshots,
      warnings:
        uniqueWarnings(warnings),
      captureMode:
        new Set(modes).size === 1
          ? modes[0]
          : "mixed"
    };
  }

  function buildPlannedMeal(options) {
    const draft =
      options.draft === true;

    return buildRecord({
      id: options.id,
      type: "planned_meal",
      schemaVersion:
        getDependencies()
          .contracts
          .CONTRACT_VERSION,
      createdAt: options.timestamp,
      updatedAt: options.timestamp,
      eventAt:
        options.meal.plannedFor,
      source:
        clone(options.source),
      knowledgeStatus:
        deriveKnowledgeStatus(
          options.snapshots,
          draft
        ),
      recordStatus:
        draft
          ? "draft"
          : "active",
      verificationStatus:
        draft
          ? "unverified"
          : "user_confirmed",
      calculationVersion: null,
      userEdited:
        options.userEdited === true,
      payload: {
        plannedFor:
          options.meal.plannedFor,
        mealType:
          options.meal.mealType,
        itemSnapshotIds:
          options.snapshots.map(
            snapshot => snapshot.id
          ),
        status: "planned",
        mealEntryId: null
      },
      extensions: {
        [PLAN_EXTENSION_KEY]: {
          rulesetId:
            PLANNING_RULESET_ID,
          entityKind:
            "planned_meal",
          ownerPlanId:
            options.planId,
          captureMode:
            options.captureMode,
          clientMealId:
            options.meal.clientMealId,
          note:
            options.meal.note,
          warnings:
            clone(options.warnings),
          snapshotCount:
            options.snapshots.length,
          revision:
            options.revision || 1,
          replacesPlannedMealId:
            options.replacesPlannedMealId ||
            null,
          replacedByPlannedMealId:
            null,
          derivedFromDraftPlannedMealId:
            options
              .derivedFromDraftPlannedMealId ||
            null,
          scheduleHistory: []
        }
      }
    });
  }

  function buildPlanRecord(options) {
    const draft =
      options.draft === true;
    const extensions = {
      [PLAN_EXTENSION_KEY]: {
        rulesetId:
          PLANNING_RULESET_ID,
        entityKind: "meal_plan",
        title:
          options.normalized.title,
        timeZone:
          options.normalized.timeZone,
        userAction: !draft,
        clientOperationId:
          options.clientOperationId ||
          null,
        revision:
          options.revision || 1,
        warnings:
          clone(options.warnings),
        derivedFromDraftId:
          options.derivedFromDraftId ||
          null
      }
    };

    if (options.aiRequest) {
      extensions[
        AI_REQUEST_EXTENSION_KEY
      ] = clone(options.aiRequest);
    }

    if (options.approval) {
      extensions[
        APPROVAL_EXTENSION_KEY
      ] = clone(options.approval);
    }

    return buildRecord({
      id: options.id,
      type: "meal_plan",
      schemaVersion:
        getDependencies()
          .contracts
          .CONTRACT_VERSION,
      createdAt: options.timestamp,
      updatedAt: options.timestamp,
      eventAt: null,
      source:
        clone(options.source),
      knowledgeStatus:
        deriveKnowledgeStatus(
          options.snapshots,
          draft
        ),
      recordStatus:
        draft
          ? "draft"
          : (
              options.status ===
                "archived"
                ? "archived"
                : "active"
            ),
      verificationStatus:
        draft
          ? "unverified"
          : "user_confirmed",
      calculationVersion: null,
      userEdited:
        options.userEdited === true,
      payload: {
        startDate:
          options.normalized.startDate,
        endDate:
          options.normalized.endDate,
        status:
          options.status ||
          (draft
            ? "draft"
            : "active"),
        plannedMealIds:
          clone(
            options.plannedMealIds
          )
      },
      extensions
    });
  }

  async function buildPlanGraph(
    input,
    options
  ) {
    const normalized =
      normalizePlanInput(
        input,
        { draft: options.draft }
      );
    const planId =
      options.planId ||
      createIdentifier("meal-plan");
    const allSnapshots = [];
    const plannedMeals = [];
    const allWarnings = [];

    for (
      const meal of
      normalized.meals
    ) {
      const plannedMealId =
        createIdentifier(
          "planned-meal"
        );
      const content =
        await buildMealContent(
          meal,
          {
            timestamp:
              options.timestamp,
            planId,
            plannedMealId,
            draft:
              options.draft,
            source:
              options.source
          }
        );
      const plannedMeal =
        buildPlannedMeal({
          id: plannedMealId,
          planId,
          timestamp:
            options.timestamp,
          source: options.source,
          draft: options.draft,
          meal,
          snapshots:
            content.snapshots,
          warnings:
            content.warnings,
          captureMode:
            content.captureMode,
          revision: 1
        });

      allSnapshots.push(
        ...content.snapshots
      );
      plannedMeals.push(
        plannedMeal
      );
      allWarnings.push(
        ...content.warnings
      );
    }

    const plan =
      buildPlanRecord({
        id: planId,
        timestamp:
          options.timestamp,
        normalized,
        source: options.source,
        draft: options.draft,
        status:
          options.draft
            ? "draft"
            : "active",
        plannedMealIds:
          plannedMeals.map(
            meal => meal.id
          ),
        snapshots: allSnapshots,
        warnings:
          uniqueWarnings(
            allWarnings
          ),
        clientOperationId:
          options.clientOperationId,
        aiRequest:
          options.aiRequest
      });

    return {
      plan,
      plannedMeals,
      snapshots: allSnapshots
    };
  }

  function assertManagedPlan(
    plan,
    options = {}
  ) {
    const meta =
      planningMeta(plan);

    if (
      !plan ||
      plan.type !== "meal_plan" ||
      !meta ||
      meta.rulesetId !==
        PLANNING_RULESET_ID ||
      meta.entityKind !==
        "meal_plan"
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-004",
        "Öğün planı bulunamadı veya bu servis tarafından yönetilmiyor.",
        {
          planId:
            plan?.id || null
        }
      );
    }

    if (
      options.allowDraft !== true &&
      plan.source.kind ===
        "ai_draft"
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-004",
        "AI plan taslağı etkin plan gibi kullanılamaz.",
        { planId: plan.id }
      );
    }

    return plan;
  }

  function assertManualActivePlan(plan) {
    assertManagedPlan(plan);

    if (
      plan.source.kind !== "manual" ||
      plan.recordStatus !== "active" ||
      plan.payload.status !== "active"
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-006",
        "Yalnız etkin ve kullanıcı onaylı plan değiştirilebilir.",
        { planId: plan.id }
      );
    }

    return plan;
  }

  function assertOwnedMeal(
    meal,
    plan,
    options = {}
  ) {
    const meta =
      planningMeta(meal);

    if (
      !meal ||
      meal.type !==
        "planned_meal" ||
      !meta ||
      meta.rulesetId !==
        PLANNING_RULESET_ID ||
      meta.entityKind !==
        "planned_meal" ||
      meta.ownerPlanId !==
        plan.id ||
      !plan.payload
        .plannedMealIds
        .includes(meal.id)
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-009",
        "Planlanan öğün plan sahipliğiyle uyuşmuyor.",
        {
          mealId:
            meal?.id || null,
          planId: plan.id
        }
      );
    }

    if (
      options.allowDraft !== true &&
      meal.source.kind ===
        "ai_draft"
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-004",
        "AI planlanan öğün taslağı etkin öğün gibi kullanılamaz."
      );
    }

    return meal;
  }

  function assertEditableMeal(
    meal,
    plan
  ) {
    assertManualActivePlan(plan);
    assertOwnedMeal(meal, plan);

    if (
      meal.recordStatus !== "active" ||
      meal.source.kind !== "manual" ||
      meal.payload.status !==
        "planned" ||
      meal.payload.mealEntryId !==
        null
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-006",
        "Yalnız henüz tüketilmemiş etkin planlanan öğün değiştirilebilir.",
        {
          mealId: meal.id,
          status:
            meal.payload.status
        }
      );
    }

    return meal;
  }

  async function loadPlan(
    planId,
    options = {}
  ) {
    const { storage } =
      getDependencies();
    const normalizedId =
      normalizeIdentifier(
        planId,
        "Öğün planı kimliği"
      );
    const plan =
      await storage.getRecord(
        normalizedId,
        { includeAiDraft: true }
      );

    assertManagedPlan(
      plan,
      options
    );

    const plannedMeals = [];

    for (
      const mealId of
      plan.payload.plannedMealIds
    ) {
      const meal =
        await storage.getRecord(
          mealId,
          {
            includeAiDraft: true
          }
        );

      plannedMeals.push(
        assertOwnedMeal(
          meal,
          plan,
          options
        )
      );
    }

    return {
      plan,
      plannedMeals
    };
  }

  async function loadMeal(
    plannedMealId,
    options = {}
  ) {
    const { storage } =
      getDependencies();
    const mealId =
      normalizeIdentifier(
        plannedMealId,
        "Planlanan öğün kimliği"
      );
    const meal =
      await storage.getRecord(
        mealId,
        { includeAiDraft: true }
      );
    const ownerPlanId =
      planningMeta(meal)
        ?.ownerPlanId;

    if (!ownerPlanId) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-004",
        "Planlanan öğün bulunamadı veya bu servis tarafından yönetilmiyor.",
        { plannedMealId: mealId }
      );
    }

    const graph =
      await loadPlan(
        ownerPlanId,
        options
      );
    const owned =
      graph.plannedMeals.find(
        candidate =>
          candidate.id === mealId
      );

    if (!owned) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-009",
        "Planlanan öğün sahibi planda bulunamadı.",
        { plannedMealId: mealId }
      );
    }

    return {
      ...graph,
      meal: owned
    };
  }

  async function readSnapshotsForMeal(
    meal,
    options = {}
  ) {
    const { storage } =
      getDependencies();
    const snapshots = [];

    for (
      const snapshotId of
      meal.payload.itemSnapshotIds
    ) {
      const snapshot =
        await storage.getRecord(
          snapshotId,
          {
            includeAiDraft: true
          }
        );
      const meta =
        planningSnapshotMeta(
          snapshot
        );

      if (
        !snapshot ||
        snapshot.type !==
          "meal_item_snapshot" ||
        !meta ||
        meta.rulesetId !==
          PLANNING_RULESET_ID ||
        meta.ownerPlanId !==
          planningMeta(meal)
            .ownerPlanId ||
        meta.ownerPlannedMealId !==
          meal.id ||
        (
          options.allowDraft !== true &&
          snapshot.source.kind ===
            "ai_draft"
        )
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-009",
          "Planlanan öğün anlık görüntüsü sahiplik zinciriyle uyuşmuyor.",
          {
            mealId: meal.id,
            snapshotId
          }
        );
      }

      snapshots.push(snapshot);
    }

    return snapshots;
  }

  function planSummary(
    plan,
    plannedMeals
  ) {
    const statusCounts =
      Object.fromEntries(
        PLANNED_MEAL_STATUSES.map(
          status => [status, 0]
        )
      );

    plannedMeals.forEach(meal => {
      statusCounts[
        meal.payload.status
      ] += 1;
    });

    return {
      planId: plan.id,
      status:
        plan.payload.status,
      mealCount:
        plannedMeals.length,
      statusCounts,
      warningCount:
        planningMeta(plan)
          .warnings.length
    };
  }

  async function getPlan(
    planId,
    options = {}
  ) {
    let graph;

    try {
      graph =
        await loadPlan(
          planId,
          {
            allowDraft:
              options.includeDraft ===
                true
          }
        );
    } catch (error) {
      if (
        error.todayCode ===
          "TODAY-NUTRITION-PLANNING-004" &&
        options.required !== true
      ) {
        return null;
      }

      throw error;
    }

    const result = {
      plan: graph.plan,
      plannedMeals:
        graph.plannedMeals
          .slice()
          .sort(
            comparePlannedMeals
          ),
      summary:
        planSummary(
          graph.plan,
          graph.plannedMeals
        )
    };

    if (
      options.includeSnapshots === true
    ) {
      const snapshots = [];

      for (
        const meal of
        graph.plannedMeals
      ) {
        snapshots.push(
          ...await readSnapshotsForMeal(
            meal,
            {
              allowDraft:
                options.includeDraft ===
                  true
            }
          )
        );
      }

      result.snapshots = snapshots;
    }

    return freezeClone(result);
  }

  function comparePlans(left, right) {
    const dateCompare =
      left.payload.startDate
        .localeCompare(
          right.payload.startDate
        );

    return (
      dateCompare ||
      left.id.localeCompare(right.id)
    );
  }

  function comparePlannedMeals(
    left,
    right
  ) {
    const timeCompare =
      left.payload.plannedFor
        .localeCompare(
          right.payload.plannedFor
        );

    return (
      timeCompare ||
      left.id.localeCompare(right.id)
    );
  }

  function normalizeStatusFilter(
    value,
    allowed,
    fieldName
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      return null;
    }

    const values =
      Array.isArray(value)
        ? value
        : [value];

    if (
      values.length === 0 ||
      values.some(
        status =>
          !allowed.includes(status)
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        fieldName +
          " filtresi geçersiz."
      );
    }

    return new Set(values);
  }

  async function listPlans(
    options = {}
  ) {
    const statusFilter =
      normalizeStatusFilter(
        options.statuses,
        PLAN_STATUSES,
        "Plan durumu"
      );
    const records =
      await getDependencies()
        .storage
        .queryRecords({
          types: ["meal_plan"],
          includeAiDrafts:
            options.includeDraft ===
              true,
          recordStatuses:
            options.includeArchived ===
              true
              ? [
                  "active",
                  "archived",
                  "draft"
                ]
              : [
                  "active",
                  "draft"
                ],
          sortDirection: "asc"
        });
    let plans =
      records.filter(record => {
        const meta =
          planningMeta(record);

        return (
          meta &&
          meta.rulesetId ===
            PLANNING_RULESET_ID &&
          meta.entityKind ===
            "meal_plan" &&
          (
            options.includeDraft ===
              true ||
            record.source.kind !==
              "ai_draft"
          ) &&
          (
            !statusFilter ||
            statusFilter.has(
              record.payload.status
            )
          )
        );
      });

    plans.sort(comparePlans);

    if (
      options.sortDirection === "desc"
    ) {
      plans.reverse();
    } else if (
      options.sortDirection !==
        undefined &&
      options.sortDirection !== "asc"
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Plan sıralama yönü geçersiz."
      );
    }

    return freezeClone(plans);
  }

  async function listPlannedMeals(
    options = {}
  ) {
    const statusFilter =
      normalizeStatusFilter(
        options.statuses,
        PLANNED_MEAL_STATUSES,
        "Planlanan öğün durumu"
      );
    const planId =
      options.planId === undefined
        ? null
        : normalizeIdentifier(
            options.planId,
            "Öğün planı kimliği"
          );
    const eventFrom =
      options.from === undefined
        ? null
        : normalizeDateTime(
            options.from,
            "Takvim başlangıcı"
          );
    const eventTo =
      options.to === undefined
        ? null
        : normalizeDateTime(
            options.to,
            "Takvim bitişi"
          );

    if (
      eventFrom &&
      eventTo &&
      eventFrom > eventTo
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Takvim bitişi başlangıçtan önce olamaz."
      );
    }

    const records =
      await getDependencies()
        .storage
        .queryRecords({
          types:
            ["planned_meal"],
          includeAiDrafts:
            options.includeDraft ===
              true,
          eventFrom,
          eventTo,
          sortDirection: "asc"
        });
    let meals =
      records.filter(record => {
        const meta =
          planningMeta(record);

        return (
          meta &&
          meta.rulesetId ===
            PLANNING_RULESET_ID &&
          meta.entityKind ===
            "planned_meal" &&
          (
            !planId ||
            meta.ownerPlanId ===
              planId
          ) &&
          (
            options.includeDraft ===
              true ||
            record.source.kind !==
              "ai_draft"
          ) &&
          (
            !statusFilter ||
            statusFilter.has(
              record.payload.status
            )
          )
        );
      });

    meals.sort(comparePlannedMeals);

    if (
      options.sortDirection === "desc"
    ) {
      meals.reverse();
    } else if (
      options.sortDirection !==
        undefined &&
      options.sortDirection !== "asc"
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Öğün sıralama yönü geçersiz."
      );
    }

    return freezeClone(meals);
  }

  async function getSnapshot() {
    const plans =
      await listPlans({
        includeArchived: true
      });
    const plannedMeals =
      await listPlannedMeals();
    const drafts =
      await listPlans({
        includeDraft: true,
        statuses: ["draft"]
      });

    return freezeClone({
      plans,
      plannedMeals,
      drafts,
      counts: {
        plans: plans.length,
        plannedMeals:
          plannedMeals.length,
        drafts: drafts.length,
        pendingMeals:
          plannedMeals.filter(
            meal =>
              meal.payload.status ===
                "planned"
          ).length
      }
    });
  }

  async function findByOperationId(
    operationId
  ) {
    if (!operationId) {
      return null;
    }

    const records =
      await getDependencies()
        .storage
        .queryRecords({
          types: ["meal_plan"],
          includeAiDrafts: true,
          recordStatuses: [
            "active",
            "draft",
            "archived"
          ]
        });

    return (
      records.find(record =>
        planningMeta(record)
          ?.clientOperationId ===
            operationId
      ) ||
      null
    );
  }

  function normalizeOperationId(
    options
  ) {
    return normalizeOptionalIdentifier(
      options?.clientOperationId,
      "İstemci işlem kimliği"
    );
  }

  async function createPlan(
    input,
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    return serializeWrite(async () => {
      const operationId =
        normalizeOperationId(
          confirmation
        );
      const existing =
        await findByOperationId(
          operationId
        );

      if (existing) {
        if (
          existing.source.kind !==
            "manual"
        ) {
          throw createError(
            "TODAY-NUTRITION-PLANNING-006",
            "İstemci işlem kimliği farklı bir plan akışında kullanılmış.",
            {
              clientOperationId:
                operationId
            }
          );
        }

        return getPlan(existing.id);
      }

      const timestamp =
        resolveTimestamp(
          confirmation
        );
      const graph =
        await buildPlanGraph(
          input,
          {
            timestamp,
            source:
              manualSource(),
            draft: false,
            clientOperationId:
              operationId
          }
        );

      await getDependencies()
        .storage
        .saveRecords(
          [
            ...graph.snapshots,
            ...graph.plannedMeals,
            graph.plan
          ],
          { mode: "add" }
        );

      return getPlan(graph.plan.id);
    });
  }

  function updatedPlan(
    plan,
    timestamp,
    changes = {}
  ) {
    const meta =
      planningMeta(plan);
    const candidate = clone(plan);

    candidate.updatedAt =
      timestamp;
    candidate.userEdited = true;
    candidate.payload = {
      ...clone(plan.payload),
      ...clone(
        changes.payload || {}
      )
    };
    candidate.extensions = {
      ...clone(
        plan.extensions || {}
      ),
      [PLAN_EXTENSION_KEY]: {
        ...clone(meta),
        ...clone(
          changes.meta || {}
        ),
        revision:
          (meta.revision || 1) + 1
      }
    };

    if (
      changes.recordStatus
    ) {
      candidate.recordStatus =
        changes.recordStatus;
    }

    return buildRecord(candidate);
  }

  async function addPlannedMeal(
    planId,
    mealInput,
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    return serializeWrite(async () => {
      const graph =
        await loadPlan(planId);
      const plan =
        assertManualActivePlan(
          graph.plan
        );
      const timestamp =
        resolveTimestamp(
          confirmation,
          plan.updatedAt
        );
      const meal =
        normalizeMealInput(
          mealInput
        );
      const mealDate =
        meal.plannedFor.slice(0, 10);

      if (
        mealDate <
          plan.payload.startDate ||
        mealDate >
          plan.payload.endDate
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "Planlanan öğün plan tarih aralığının dışında olamaz."
        );
      }

      if (
        meal.clientMealId &&
        graph.plannedMeals.some(
          candidate =>
            planningMeta(candidate)
              .clientMealId ===
              meal.clientMealId
        )
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-006",
          "İstemci öğün kimliği bu planda daha önce kullanılmış."
        );
      }

      const plannedMealId =
        createIdentifier(
          "planned-meal"
        );
      const content =
        await buildMealContent(
          meal,
          {
            timestamp,
            planId: plan.id,
            plannedMealId,
            source:
              manualSource(),
            draft: false
          }
        );
      const plannedMeal =
        buildPlannedMeal({
          id: plannedMealId,
          planId: plan.id,
          timestamp,
          source:
            manualSource(),
          draft: false,
          meal,
          snapshots:
            content.snapshots,
          warnings:
            content.warnings,
          captureMode:
            content.captureMode,
          revision:
            planningMeta(plan)
              .revision + 1,
          userEdited: true
        });
      const warnings =
        uniqueWarnings([
          ...planningMeta(plan)
            .warnings,
          ...content.warnings
        ]);
      const nextPlan =
        updatedPlan(
          plan,
          timestamp,
          {
            payload: {
              plannedMealIds: [
                ...plan.payload
                  .plannedMealIds,
                plannedMeal.id
              ]
            },
            meta: { warnings }
          }
        );

      await getDependencies()
        .storage
        .saveRecords(
          [
            ...content.snapshots,
            plannedMeal,
            nextPlan
          ],
          {
            expectedUpdatedAtById: {
              [plan.id]:
                plan.updatedAt
            }
          }
        );

      return getPlan(plan.id);
    });
  }

  async function updatePlanWindow(
    planId,
    changes,
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    if (!isPlainObject(changes)) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Plan aralığı değişikliği düz bir nesne olmalıdır."
      );
    }

    return serializeWrite(async () => {
      const graph =
        await loadPlan(planId);
      const plan =
        assertManualActivePlan(
          graph.plan
        );
      const timestamp =
        resolveTimestamp(
          confirmation,
          plan.updatedAt
        );
      const startDate =
        changes.startDate ===
          undefined
          ? plan.payload.startDate
          : normalizeDate(
              changes.startDate,
              "Plan başlangıcı"
            );
      const endDate =
        changes.endDate ===
          undefined
          ? plan.payload.endDate
          : normalizeDate(
              changes.endDate,
              "Plan bitişi"
            );

      if (startDate > endDate) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "Plan bitişi başlangıçtan önce olamaz."
        );
      }

      const outside =
        graph.plannedMeals.find(
          meal => {
            const date =
              meal.payload
                .plannedFor
                .slice(0, 10);

            return (
              date < startDate ||
              date > endDate
            );
          }
        );

      if (outside) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-006",
          "Yeni plan aralığı mevcut planlanan öğünleri dışarıda bırakamaz.",
          { mealId: outside.id }
        );
      }

      const title =
        changes.title === undefined
          ? planningMeta(plan).title
          : normalizeText(
              changes.title,
              "Plan adı",
              {
                optional: true,
                allowEmpty: true,
                maxLength: 120
              }
            );
      const timeZone =
        changes.timeZone ===
          undefined
          ? planningMeta(plan)
              .timeZone
          : normalizeTimeZone(
              changes.timeZone
            );
      const nextPlan =
        updatedPlan(
          plan,
          timestamp,
          {
            payload: {
              startDate,
              endDate
            },
            meta: {
              title,
              timeZone
            }
          }
        );

      await getDependencies()
        .storage
        .saveRecords(
          [nextPlan],
          {
            expectedUpdatedAtById: {
              [plan.id]:
                plan.updatedAt
            }
          }
        );

      return getPlan(plan.id);
    });
  }

  function updatedMeal(
    meal,
    timestamp,
    changes = {}
  ) {
    const meta =
      planningMeta(meal);
    const candidate = clone(meal);

    candidate.updatedAt =
      timestamp;
    candidate.userEdited = true;
    candidate.payload = {
      ...clone(meal.payload),
      ...clone(
        changes.payload || {}
      )
    };
    candidate.eventAt =
      candidate.payload.plannedFor;
    candidate.extensions = {
      ...clone(
        meal.extensions || {}
      ),
      [PLAN_EXTENSION_KEY]: {
        ...clone(meta),
        ...clone(
          changes.meta || {}
        ),
        revision:
          (meta.revision || 1) + 1
      }
    };

    return buildRecord(candidate);
  }

  async function reschedulePlannedMeal(
    plannedMealId,
    plannedFor,
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    return serializeWrite(async () => {
      const graph =
        await loadMeal(
          plannedMealId
        );
      const plan =
        assertManualActivePlan(
          graph.plan
        );
      const meal =
        assertEditableMeal(
          graph.meal,
          plan
        );
      const timestamp =
        resolveTimestamp(
          confirmation,
          [
            plan.updatedAt,
            meal.updatedAt
          ].sort().at(-1)
        );
      const normalized =
        normalizeDateTime(
          plannedFor,
          "Yeni plan zamanı"
        );
      const date =
        normalized.slice(0, 10);

      if (
        date <
          plan.payload.startDate ||
        date >
          plan.payload.endDate
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "Yeni plan zamanı plan tarih aralığının dışında olamaz."
        );
      }

      const history = [
        ...(
          planningMeta(meal)
            .scheduleHistory ||
          []
        ),
        {
          from:
            meal.payload.plannedFor,
          to: normalized,
          changedAt: timestamp
        }
      ].slice(
        -MAX_HISTORY_COUNT
      );
      const nextMeal =
        updatedMeal(
          meal,
          timestamp,
          {
            payload: {
              plannedFor:
                normalized
            },
            meta: {
              scheduleHistory:
                history
            }
          }
        );
      const nextPlan =
        updatedPlan(
          plan,
          timestamp
        );

      await getDependencies()
        .storage
        .saveRecords(
          [
            nextMeal,
            nextPlan
          ],
          {
            expectedUpdatedAtById: {
              [meal.id]:
                meal.updatedAt,
              [plan.id]:
                plan.updatedAt
            }
          }
        );

      return freezeClone(nextMeal);
    });
  }

  function clonePlanningSnapshot(
    source,
    options
  ) {
    const meta =
      planningSnapshotMeta(
        source
      );

    if (
      !source ||
      source.type !==
        "meal_item_snapshot" ||
      !meta ||
      meta.rulesetId !==
        PLANNING_RULESET_ID
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-009",
        "Kopyalanacak plan anlık görüntüsü geçersiz."
      );
    }

    const candidate = clone(source);

    candidate.id =
      createIdentifier(
        "plan-snapshot"
      );
    candidate.createdAt =
      options.timestamp;
    candidate.updatedAt =
      options.timestamp;
    candidate.eventAt = null;
    candidate.userEdited = false;
    candidate.recordStatus =
      options.draft
        ? "draft"
        : "active";

    if (options.acceptDraft) {
      candidate.source =
        clone(
          meta.originSource ||
          manualSource()
        );
      candidate.verificationStatus =
        meta
          .originVerificationStatus ||
        "user_confirmed";
      candidate.knowledgeStatus =
        meta
          .originKnowledgeStatus ||
        (
          Object.keys(
            candidate.payload
              .nutrients || {}
          ).length > 0
            ? "known"
            : "unknown"
        );
    } else if (options.draft) {
      candidate.source =
        clone(options.source);
      candidate.verificationStatus =
        "unverified";
      candidate.knowledgeStatus =
        "estimated";
    }

    candidate.extensions = {
      ...clone(
        candidate.extensions || {}
      ),
      [SNAPSHOT_EXTENSION_KEY]: {
        ...clone(meta),
        ownerPlanId:
          options.planId,
        ownerPlannedMealId:
          options.plannedMealId,
        captureMode:
          options.captureMode ||
          "replacement_copy",
        sourceSnapshotId:
          source.id,
        derivedFromDraftSnapshotId:
          options.acceptDraft
            ? source.id
            : null
      }
    };

    return buildRecord(candidate);
  }

  async function replacePlannedMeal(
    plannedMealId,
    replacement,
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    if (!isPlainObject(replacement)) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "İkame öğün bilgisi düz bir nesne olmalıdır."
      );
    }

    return serializeWrite(async () => {
      const graph =
        await loadMeal(
          plannedMealId
        );
      const plan =
        assertManualActivePlan(
          graph.plan
        );
      const meal =
        assertEditableMeal(
          graph.meal,
          plan
        );
      const timestamp =
        resolveTimestamp(
          confirmation,
          [
            plan.updatedAt,
            meal.updatedAt
          ].sort().at(-1)
        );
      const hasNewContent =
        replacement.templateId !==
          undefined ||
        replacement.items !==
          undefined ||
        replacement.customItems !==
          undefined;
      const normalized =
        normalizeMealInput({
          plannedFor:
            replacement.plannedFor ||
            meal.payload.plannedFor,
          mealType:
            replacement.mealType ||
            meal.payload.mealType,
          note:
            replacement.note ===
              undefined
              ? planningMeta(meal)
                  .note
              : replacement.note,
          clientMealId:
            replacement.clientMealId,
          templateId:
            hasNewContent
              ? replacement.templateId
              : null,
          templateMultiplier:
            replacement
              .templateMultiplier,
          items:
            hasNewContent
              ? replacement.items
              : [],
          customItems:
            hasNewContent
              ? replacement.customItems
              : [
                  {
                    name:
                      "__copy_existing__"
                  }
                ]
        });
      const date =
        normalized
          .plannedFor
          .slice(0, 10);

      if (
        date <
          plan.payload.startDate ||
        date >
          plan.payload.endDate
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "İkame öğün zamanı plan tarih aralığının dışında olamaz."
        );
      }

      const newMealId =
        createIdentifier(
          "planned-meal"
        );
      let content;

      if (hasNewContent) {
        content =
          await buildMealContent(
            normalized,
            {
              timestamp,
              planId: plan.id,
              plannedMealId:
                newMealId,
              source:
                manualSource(),
              draft: false
            }
          );
      } else {
        const sourceSnapshots =
          await readSnapshotsForMeal(
            meal
          );
        const snapshots =
          sourceSnapshots.map(
            snapshot =>
              clonePlanningSnapshot(
                snapshot,
                {
                  timestamp,
                  planId:
                    plan.id,
                  plannedMealId:
                    newMealId,
                  draft: false,
                  captureMode:
                    "replacement_copy"
                }
              )
          );

        content = {
          snapshots,
          warnings:
            clone(
              planningMeta(meal)
                .warnings
            ),
          captureMode:
            "replacement_copy"
        };
      }

      const nextMeal =
        buildPlannedMeal({
          id: newMealId,
          planId: plan.id,
          timestamp,
          source:
            manualSource(),
          draft: false,
          meal: normalized,
          snapshots:
            content.snapshots,
          warnings:
            content.warnings,
          captureMode:
            content.captureMode,
          revision:
            planningMeta(plan)
              .revision + 1,
          replacesPlannedMealId:
            meal.id,
          userEdited: true
        });
      const replaced =
        updatedMeal(
          meal,
          timestamp,
          {
            payload: {
              status: "cancelled",
              mealEntryId: null
            },
            meta: {
              replacedByPlannedMealId:
                nextMeal.id
            }
          }
        );
      const nextPlan =
        updatedPlan(
          plan,
          timestamp,
          {
            payload: {
              plannedMealIds: [
                ...plan.payload
                  .plannedMealIds,
                nextMeal.id
              ]
            },
            meta: {
              warnings:
                uniqueWarnings([
                  ...planningMeta(plan)
                    .warnings,
                  ...content.warnings
                ])
            }
          }
        );

      await getDependencies()
        .storage
        .saveRecords(
          [
            ...content.snapshots,
            replaced,
            nextMeal,
            nextPlan
          ],
          {
            expectedUpdatedAtById: {
              [meal.id]:
                meal.updatedAt,
              [plan.id]:
                plan.updatedAt
            }
          }
        );

      return freezeClone({
        replaced,
        replacement: nextMeal
      });
    });
  }

  async function setMealDisposition(
    plannedMealId,
    status,
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    if (
      ![
        "skipped",
        "cancelled"
      ].includes(status)
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Planlanan öğün sonucu geçersiz."
      );
    }

    return serializeWrite(async () => {
      const graph =
        await loadMeal(
          plannedMealId
        );
      const plan =
        assertManualActivePlan(
          graph.plan
        );
      const meal =
        assertEditableMeal(
          graph.meal,
          plan
        );
      const timestamp =
        resolveTimestamp(
          confirmation,
          [
            plan.updatedAt,
            meal.updatedAt
          ].sort().at(-1)
        );
      const nextMeal =
        updatedMeal(
          meal,
          timestamp,
          {
            payload: {
              status,
              mealEntryId: null
            },
            meta: {
              dispositionAt:
                timestamp
            }
          }
        );
      const nextPlan =
        updatedPlan(
          plan,
          timestamp
        );

      await getDependencies()
        .storage
        .saveRecords(
          [
            nextMeal,
            nextPlan
          ],
          {
            expectedUpdatedAtById: {
              [meal.id]:
                meal.updatedAt,
              [plan.id]:
                plan.updatedAt
            }
          }
        );

      return freezeClone(nextMeal);
    });
  }

  function skipPlannedMeal(
    plannedMealId,
    confirmation
  ) {
    return setMealDisposition(
      plannedMealId,
      "skipped",
      confirmation
    );
  }

  function cancelPlannedMeal(
    plannedMealId,
    confirmation
  ) {
    return setMealDisposition(
      plannedMealId,
      "cancelled",
      confirmation
    );
  }

  async function completePlan(
    planId,
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    return serializeWrite(async () => {
      const graph =
        await loadPlan(planId);
      const plan =
        assertManualActivePlan(
          graph.plan
        );
      const pending =
        graph.plannedMeals.filter(
          meal =>
            meal.payload.status ===
              "planned"
        );

      if (
        graph.plannedMeals.length ===
          0 ||
        pending.length > 0
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-006",
          "Plan ancak bütün öğünler bağlandı, atlandı veya iptal edildiyse tamamlanabilir.",
          {
            pendingMealIds:
              pending.map(
                meal => meal.id
              )
          }
        );
      }

      const timestamp =
        resolveTimestamp(
          confirmation,
          plan.updatedAt
        );
      const nextPlan =
        updatedPlan(
          plan,
          timestamp,
          {
            payload: {
              status: "completed"
            },
            meta: {
              completedAt:
                timestamp
            }
          }
        );

      await getDependencies()
        .storage
        .saveRecords(
          [nextPlan],
          {
            expectedUpdatedAtById: {
              [plan.id]:
                plan.updatedAt
            }
          }
        );

      return freezeClone(nextPlan);
    });
  }

  async function archivePlan(
    planId,
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    return serializeWrite(async () => {
      const graph =
        await loadPlan(planId);
      const plan =
        assertManagedPlan(
          graph.plan
        );

      if (
        plan.source.kind !== "manual" ||
        plan.recordStatus !== "active" ||
        plan.payload.status !==
          "completed"
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-006",
          "Yalnız tamamlanmış kullanıcı planı arşivlenebilir.",
          { planId: plan.id }
        );
      }

      const timestamp =
        resolveTimestamp(
          confirmation,
          plan.updatedAt
        );
      const nextPlan =
        updatedPlan(
          plan,
          timestamp,
          {
            payload: {
              status: "archived"
            },
            meta: {
              archivedAt:
                timestamp
            },
            recordStatus:
              "archived"
          }
        );

      await getDependencies()
        .storage
        .saveRecords(
          [nextPlan],
          {
            expectedUpdatedAtById: {
              [plan.id]:
                plan.updatedAt
            }
          }
        );

      return freezeClone(nextPlan);
    });
  }

  function aiRequestMeta(
    source,
    timestamp
  ) {
    return {
      requestedAt: timestamp,
      referenceId:
        source.referenceId,
      version: source.version,
      userRequested: true,
      userDataUseApproved: true
    };
  }

  async function savePlanDraft(
    input,
    consent
  ) {
    assertAiRequest(consent);

    return serializeWrite(async () => {
      const operationId =
        normalizeOperationId(
          consent
        );
      const existing =
        await findByOperationId(
          operationId
        );

      if (existing) {
        if (
          existing.source.kind !==
            "ai_draft"
        ) {
          throw createError(
            "TODAY-NUTRITION-PLANNING-006",
            "İstemci işlem kimliği farklı bir plan akışında kullanılmış."
          );
        }

        return getPlan(
          existing.id,
          {
            includeDraft: true
          }
        );
      }

      const timestamp =
        resolveTimestamp(consent);
      const source =
        aiSource(input, consent);
      const graph =
        await buildPlanGraph(
          input,
          {
            timestamp,
            source,
            draft: true,
            clientOperationId:
              operationId,
            aiRequest:
              aiRequestMeta(
                source,
                timestamp
              )
          }
        );

      await getDependencies()
        .storage
        .saveRecords(
          [
            ...graph.snapshots,
            ...graph.plannedMeals,
            graph.plan
          ],
          { mode: "add" }
        );

      return getPlan(
        graph.plan.id,
        {
          includeDraft: true,
          includeSnapshots: true
        }
      );
    });
  }

  async function listDrafts() {
    return listPlans({
      includeDraft: true,
      statuses: ["draft"]
    });
  }

  async function acceptedPlanByDraftId(
    draftId
  ) {
    const plans =
      await getDependencies()
        .storage
        .queryRecords({
          types: ["meal_plan"],
          sourceKinds: ["manual"],
          includeAiDrafts: false,
          recordStatuses: [
            "active",
            "archived"
          ]
        });

    return (
      plans.find(plan =>
        planningMeta(plan)
          ?.derivedFromDraftId ===
            draftId
      ) ||
      null
    );
  }

  function normalizeMealOverrides(
    value,
    draftMeals
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      return new Map();
    }

    if (
      !Array.isArray(value) ||
      value.length >
        draftMeals.length
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Taslak öğün değişiklikleri geçerli bir liste olmalıdır."
      );
    }

    const draftIds =
      new Set(
        draftMeals.map(
          meal => meal.id
        )
      );
    const result = new Map();

    value.forEach((item, index) => {
      if (!isPlainObject(item)) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "mealOverrides[" +
            index +
            "] geçersiz."
        );
      }

      const draftPlannedMealId =
        normalizeIdentifier(
          item.draftPlannedMealId,
          "Taslak planlanan öğün kimliği"
        );

      if (
        !draftIds.has(
          draftPlannedMealId
        ) ||
        result.has(
          draftPlannedMealId
        )
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "Taslak öğün değişikliği bilinmeyen veya yinelenen kimlik içeriyor."
        );
      }

      result.set(
        draftPlannedMealId,
        {
          plannedFor:
            item.plannedFor ===
              undefined
              ? null
              : normalizeDateTime(
                  item.plannedFor,
                  "Kabul edilen plan zamanı"
                ),
          mealType:
            item.mealType ===
              undefined
              ? null
              : normalizeMealType(
                  item.mealType
                ),
          note:
            item.note === undefined
              ? undefined
              : normalizeText(
                  item.note,
                  "Kabul edilen öğün notu",
                  {
                    optional: true,
                    allowEmpty: true
                  }
                )
        }
      );
    });

    return result;
  }

  async function acceptPlanDraft(
    draftPlanId,
    overrides = {},
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    if (
      confirmation
        ?.acceptDraft !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-008",
        "AI plan taslağının etkin plana dönüşmesi ayrıca açıkça onaylanmalıdır."
      );
    }

    if (!isPlainObject(overrides)) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-002",
        "Taslak kabul değişiklikleri düz bir nesne olmalıdır."
      );
    }

    return serializeWrite(async () => {
      const graph =
        await loadPlan(
          draftPlanId,
          { allowDraft: true }
        );
      const draft =
        graph.plan;

      if (
        draft.source.kind !==
          "ai_draft" ||
        draft.recordStatus !==
          "draft" ||
        draft.payload.status !==
          "draft"
      ) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-008",
          "Yalnız doğrulanmamış AI plan taslağı kabul edilebilir."
        );
      }

      const existing =
        await acceptedPlanByDraftId(
          draft.id
        );

      if (existing) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-008",
          "AI plan taslağı daha önce kabul edilmiş.",
          {
            acceptedPlanId:
              existing.id
          }
        );
      }

      const timestamp =
        resolveTimestamp(
          confirmation,
          draft.updatedAt
        );
      const startDate =
        overrides.startDate ===
          undefined
          ? draft.payload.startDate
          : normalizeDate(
              overrides.startDate,
              "Plan başlangıcı"
            );
      const endDate =
        overrides.endDate ===
          undefined
          ? draft.payload.endDate
          : normalizeDate(
              overrides.endDate,
              "Plan bitişi"
            );

      if (startDate > endDate) {
        throw createError(
          "TODAY-NUTRITION-PLANNING-002",
          "Plan bitişi başlangıçtan önce olamaz."
        );
      }

      const title =
        overrides.title === undefined
          ? planningMeta(draft)
              .title
          : normalizeText(
              overrides.title,
              "Plan adı",
              {
                optional: true,
                allowEmpty: true,
                maxLength: 120
              }
            );
      const timeZone =
        overrides.timeZone ===
          undefined
          ? planningMeta(draft)
              .timeZone
          : normalizeTimeZone(
              overrides.timeZone
            );
      const mealOverrides =
        normalizeMealOverrides(
          overrides.mealOverrides,
          graph.plannedMeals
        );
      const planId =
        createIdentifier(
          "meal-plan"
        );
      const plannedMeals = [];
      const snapshots = [];
      const warnings = [];

      for (
        const draftMeal of
        graph.plannedMeals
      ) {
        if (
          draftMeal.source.kind !==
            "ai_draft" ||
          draftMeal.recordStatus !==
            "draft"
        ) {
          throw createError(
            "TODAY-NUTRITION-PLANNING-009",
            "AI taslak öğün zinciri geçersiz."
          );
        }

        const mealOverride =
          mealOverrides.get(
            draftMeal.id
          ) || {};
        const plannedFor =
          mealOverride.plannedFor ||
          draftMeal.payload
            .plannedFor;
        const date =
          plannedFor.slice(0, 10);

        if (
          date < startDate ||
          date > endDate
        ) {
          throw createError(
            "TODAY-NUTRITION-PLANNING-002",
            "Kabul edilen öğün plan tarih aralığının dışında olamaz."
          );
        }

        const newMealId =
          createIdentifier(
            "planned-meal"
          );
        const draftSnapshots =
          await readSnapshotsForMeal(
            draftMeal,
            { allowDraft: true }
          );
        const acceptedSnapshots =
          draftSnapshots.map(
            snapshot =>
              clonePlanningSnapshot(
                snapshot,
                {
                  timestamp,
                  planId,
                  plannedMealId:
                    newMealId,
                  draft: false,
                  acceptDraft: true,
                  captureMode:
                    "draft_acceptance"
                }
              )
          );
        const tags =
          acceptedSnapshots.flatMap(
            snapshot =>
              planningSnapshotMeta(
                snapshot
              )?.constraintTags ||
              []
          );
        const currentWarnings =
          await warningsForTags(tags);
        const meal = {
          plannedFor,
          mealType:
            mealOverride.mealType ||
            draftMeal.payload
              .mealType,
          note:
            mealOverride.note ===
              undefined
              ? planningMeta(
                  draftMeal
                ).note
              : mealOverride.note,
          clientMealId: null
        };
        const acceptedMeal =
          buildPlannedMeal({
            id: newMealId,
            planId,
            timestamp,
            source:
              manualSource(),
            draft: false,
            meal,
            snapshots:
              acceptedSnapshots,
            warnings:
              currentWarnings,
            captureMode:
              "draft_acceptance",
            revision: 1,
            derivedFromDraftPlannedMealId:
              draftMeal.id,
            userEdited: true
          });

        snapshots.push(
          ...acceptedSnapshots
        );
        plannedMeals.push(
          acceptedMeal
        );
        warnings.push(
          ...currentWarnings
        );
      }

      const approval = {
        approvedAt: timestamp,
        draftPlanId: draft.id,
        explicitApproval: true,
        userInitiated: true,
        userConfirmed: true
      };
      const normalized = {
        startDate,
        endDate,
        title,
        timeZone
      };
      const plan =
        buildPlanRecord({
          id: planId,
          timestamp,
          normalized,
          source:
            manualSource(),
          draft: false,
          status: "active",
          plannedMealIds:
            plannedMeals.map(
              meal => meal.id
            ),
          snapshots,
          warnings:
            uniqueWarnings(warnings),
          derivedFromDraftId:
            draft.id,
          approval,
          userEdited: true
        });

      await getDependencies()
        .storage
        .saveRecords(
          [
            ...snapshots,
            ...plannedMeals,
            plan
          ],
          { mode: "add" }
        );

      return getPlan(
        plan.id,
        {
          includeSnapshots: true
        }
      );
    });
  }

  async function consumePlannedMeal(
    plannedMealId,
    overrides,
    confirmation
  ) {
    assertUserConfirmation(
      confirmation
    );

    if (
      confirmation
        ?.confirmPlanConsumption !==
          true
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-010",
        "Planlanan öğünün gerçek tüketim olarak kaydı ayrıca açıkça onaylanmalıdır."
      );
    }

    const graph =
      await loadMeal(
        plannedMealId
      );

    assertManualActivePlan(
      graph.plan
    );
    assertEditableMeal(
      graph.meal,
      graph.plan
    );

    const entry =
      window.TodayNutritionEntry;

    if (
      !entry ||
      typeof entry.logPlannedMeal !==
        "function"
    ) {
      throw createError(
        "TODAY-NUTRITION-PLANNING-001",
        "NUT-006 gerçek tüketim kapısı hazır değil.",
        {
          missing:
            "TodayNutritionEntry.logPlannedMeal"
        }
      );
    }

    return entry.logPlannedMeal(
      graph.meal.id,
      overrides || {},
      confirmation
    );
  }

  window.TodayNutritionPlanning =
    Object.freeze({
      PLANNING_API_VERSION,
      PLANNING_RULESET_ID,
      PLAN_EXTENSION_KEY,
      SNAPSHOT_EXTENSION_KEY,
      AI_REQUEST_EXTENSION_KEY,
      APPROVAL_EXTENSION_KEY,
      DEFAULT_TIME_ZONE,
      PLAN_RECORD_TYPES,
      PLAN_STATUSES,
      PLANNED_MEAL_STATUSES,
      MEAL_TYPES,
      getSnapshot,
      getPlan,
      listPlans,
      listPlannedMeals,
      createPlan,
      addPlannedMeal,
      updatePlanWindow,
      reschedulePlannedMeal,
      replacePlannedMeal,
      skipPlannedMeal,
      cancelPlannedMeal,
      completePlan,
      archivePlan,
      savePlanDraft,
      listDrafts,
      acceptPlanDraft,
      consumePlannedMeal
    });
})();
