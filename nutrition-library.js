/**
 * Today App — Nutrition Library
 * NUT-005 — Versioned food, recipe and meal-template library
 *
 * This module is local-first and UI/network agnostic. It coordinates NUT-001
 * contracts, NUT-002 atomic storage, NUT-003 deterministic calculations and
 * NUT-004 profile warnings without mutating any of those layers.
 */

(function () {
  "use strict";

  const LIBRARY_API_VERSION = 2;
  const LIBRARY_RULESET_ID =
    "today:nutrition:library:v2";
  const LIBRARY_EXTENSION_KEY =
    "today.nutrition.library";
  const SNAPSHOT_EXTENSION_KEY =
    "today.nutrition.library-snapshot";
  const APPROVAL_EXTENSION_KEY =
    "today.nutrition.library-approval";
  const AI_REQUEST_EXTENSION_KEY =
    "today.nutrition.library-ai-request";

  const LIBRARY_RECORD_TYPES = deepFreeze([
    "food_version",
    "recipe_version",
    "meal_template"
  ]);
  const SOURCE_CLASSES = deepFreeze([
    "user_custom",
    "verified_data_package",
    "ai_draft"
  ]);
  const MEAL_TYPES = deepFreeze([
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "other"
  ]);
  const DEFAULT_UNKNOWN_NUTRIENTS = deepFreeze({
    energy: {
      status: "unknown",
      value: null,
      unit: "kcal",
      basis: null
    },
    protein: {
      status: "unknown",
      value: null,
      unit: "g",
      basis: null
    },
    carbohydrate: {
      status: "unknown",
      value: null,
      unit: "g",
      basis: null
    },
    fat: {
      status: "unknown",
      value: null,
      unit: "g",
      basis: null
    }
  });

  const IDENTIFIER_PATTERN =
    /^[a-z0-9](?:[a-z0-9._:-]{0,78}[a-z0-9])?$/;
  const VERSION_PATTERN =
    /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/i;
  const SEMVER_PATTERN =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  const MAX_TEXT_LENGTH = 500;
  const MAX_LIST_LENGTH = 500;

  let idCounter = 0;
  let writeTail = Promise.resolve();

  function createError(code, message, detail = null, cause = null) {
    const error = new Error(message);
    error.name = "TodayNutritionLibraryError";
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

    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }

    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
  }

  function freezeClone(value) {
    return deepFreeze(clone(value));
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return (
      prototype === Object.prototype ||
      prototype === null ||
      (
        Object.prototype.toString.call(value) === "[object Object]" &&
        prototype &&
        prototype.constructor &&
        prototype.constructor.name === "Object"
      )
    );
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function serializeWrite(operation) {
    const run = writeTail.then(operation, operation);

    writeTail = run.catch(() => undefined);
    return run;
  }

  function getDependencies() {
    const contracts = window.TodayNutritionContracts;
    const storage = window.TodayNutritionStorage;
    const calculations = window.TodayNutritionCalculations;
    const missing = [];

    [
      "validateMeasurement",
      "validateRecord",
      "createRecord"
    ].forEach(methodName => {
      if (!contracts || typeof contracts[methodName] !== "function") {
        missing.push(`TodayNutritionContracts.${methodName}`);
      }
    });

    [
      "getRecord",
      "queryRecords",
      "saveRecord",
      "saveRecords"
    ].forEach(methodName => {
      if (!storage || typeof storage[methodName] !== "function") {
        missing.push(`TodayNutritionStorage.${methodName}`);
      }
    });

    [
      "canConvert",
      "calculateFoodNutrients",
      "calculateRecipeNutrients",
      "buildCalculatedSnapshot"
    ].forEach(methodName => {
      if (!calculations || typeof calculations[methodName] !== "function") {
        missing.push(`TodayNutritionCalculations.${methodName}`);
      }
    });

    if (missing.length > 0) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-001",
        "Beslenme kütüphanesi bağımlılıkları hazır değil.",
        { missing }
      );
    }

    return { contracts, storage, calculations };
  }

  function assertUserConfirmation(options) {
    if (
      options?.userInitiated !== true ||
      options?.userConfirmed !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-003",
        "Bu beslenme kütüphanesi değişikliği açık kullanıcı onayı gerektirir."
      );
    }
  }

  function assertAiRequest(options) {
    if (
      options?.userRequested !== true ||
      options?.userDataUseApproved !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-007",
        "AI kütüphane taslağı açık kullanıcı isteği ve veri kullanım onayı gerektirir."
      );
    }
  }

  function resolveTimestamp(options = {}, minimum = null) {
    const candidate = options.at || new Date().toISOString();
    const parsed = Date.parse(candidate);

    if (Number.isNaN(parsed)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "İşlem zamanı geçerli bir tarih-saat olmalıdır."
      );
    }

    const normalized = new Date(parsed).toISOString();

    if (minimum && Date.parse(normalized) < Date.parse(minimum)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "İşlem zamanı mevcut kütüphane kaydından önce olamaz.",
        { minimum, received: normalized }
      );
    }

    return normalized;
  }

  function createIdentifier(prefix) {
    idCounter += 1;
    let suffix;

    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      suffix = window.crypto.randomUUID();
    } else {
      suffix = [
        Date.now().toString(36),
        idCounter.toString(36),
        Math.random().toString(36).slice(2, 10)
      ].join("-");
    }

    return `${prefix}:${suffix}`;
  }

  function normalizeText(value, fieldName, options = {}) {
    if (typeof value !== "string") {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} metin olmalıdır.`
      );
    }

    const normalized = value.trim();
    const allowEmpty = options.allowEmpty === true;

    if (
      (!allowEmpty && !normalized) ||
      normalized.length > (options.maxLength || MAX_TEXT_LENGTH)
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} geçersiz.`
      );
    }

    return normalized;
  }

  function normalizeIdentifier(value, fieldName, fallbackPrefix = null) {
    const candidate =
      value === undefined && fallbackPrefix
        ? createIdentifier(fallbackPrefix)
        : value;

    if (typeof candidate !== "string" || !IDENTIFIER_PATTERN.test(candidate)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} geçerli bir kimlik olmalıdır.`
      );
    }

    return candidate;
  }

  function normalizeVersion(value, fieldName, fallback = null) {
    const candidate = value === undefined ? fallback : value;

    if (typeof candidate !== "string" || !VERSION_PATTERN.test(candidate)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} geçerli bir sürüm olmalıdır.`
      );
    }

    return candidate;
  }

  function normalizeLogicalVersion(value, fallback = "1.0.0") {
    const version = normalizeVersion(value, "Kütüphane sürümü", fallback);

    if (!SEMVER_PATTERN.test(version)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "Kütüphane sürümü major.minor.patch biçiminde olmalıdır.",
        { version }
      );
    }

    return version;
  }

  function nextVersion(version) {
    const normalized = normalizeLogicalVersion(version);
    const match = normalized.match(SEMVER_PATTERN);
    const patch = Number(match[3]);

    if (!Number.isSafeInteger(patch + 1)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "Kütüphane sürümü güvenli biçimde artırılamıyor."
      );
    }

    return `${match[1]}.${match[2]}.${patch + 1}`;
  }

  function compareVersions(left, right) {
    const leftParts = normalizeLogicalVersion(left).split(".").map(Number);
    const rightParts = normalizeLogicalVersion(right).split(".").map(Number);

    for (let index = 0; index < 3; index += 1) {
      if (leftParts[index] !== rightParts[index]) {
        return leftParts[index] - rightParts[index];
      }
    }

    return 0;
  }

  function normalizeStringList(value, fieldName, options = {}) {
    const candidate = value === undefined ? [] : value;

    if (!Array.isArray(candidate) || candidate.length > MAX_LIST_LENGTH) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} liste olmalıdır.`
      );
    }

    const result = [];
    const seen = new Set();

    candidate.forEach(item => {
      const text = normalizeText(item, fieldName);
      const key = normalizedLabel(text);

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      result.push(text);
    });

    if (options.requireOne === true && result.length === 0) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} boş olamaz.`
      );
    }

    return result;
  }

  function normalizeIdList(value, fieldName, fallback = []) {
    const candidate = value === undefined ? fallback : value;

    if (!Array.isArray(candidate) || candidate.length > MAX_LIST_LENGTH) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} kimlik listesi olmalıdır.`
      );
    }

    const result = [];
    const seen = new Set();

    candidate.forEach(item => {
      const id = normalizeIdentifier(item, fieldName);

      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    });

    if (result.length === 0) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} boş olamaz.`
      );
    }

    return result;
  }

  function normalizedLabel(value) {
    return String(value)
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ");
  }

  function stableValue(value) {
    if (Array.isArray(value)) {
      return value.map(stableValue);
    }

    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(key => [key, stableValue(value[key])])
      );
    }

    return value;
  }

  function sameValue(left, right) {
    return JSON.stringify(stableValue(left)) ===
      JSON.stringify(stableValue(right));
  }

  function normalizePreparation(value) {
    const candidate = value === undefined
      ? { method: "unspecified", details: null }
      : (
          typeof value === "string"
            ? { method: value, details: null }
            : value
        );

    if (!isPlainObject(candidate)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "Hazırlama biçimi geçersiz."
      );
    }

    const method = normalizeText(candidate.method, "Hazırlama biçimi");
    const details =
      candidate.details === undefined || candidate.details === null
        ? null
        : normalizeText(candidate.details, "Hazırlama ayrıntısı");

    return { method, details };
  }

  function normalizeMeasurement(value, fieldName) {
    const { contracts } = getDependencies();
    const result = contracts.validateMeasurement(value, {
      path: `$.${fieldName}`
    });

    if (!result.valid) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} sözleşmeye uygun değil.`,
        { validationErrors: clone(result.errors) }
      );
    }

    return clone(value);
  }

  function normalizeNutrients(value, options = {}) {
    const candidate = value === undefined && options.aiDraft === true
      ? clone(DEFAULT_UNKNOWN_NUTRIENTS)
      : value;

    if (!isPlainObject(candidate) || Object.keys(candidate).length === 0) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "Besin değerleri boş olmayan bir ölçüm haritası olmalıdır."
      );
    }

    const normalized = {};

    Object.keys(candidate).sort().forEach(key => {
      if (!IDENTIFIER_PATTERN.test(key)) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-002",
          "Besin değeri anahtarı geçersiz.",
          { nutrientKey: key }
        );
      }

      const measurement = normalizeMeasurement(
        candidate[key],
        `nutrients.${key}`
      );

      if (options.aiDraft === true && measurement.status !== "unknown") {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-007",
          "AI besin değeri uyduramaz; taslakta doğrulanmamış değer unknown kalmalıdır.",
          { nutrientKey: key }
        );
      }

      normalized[key] = measurement;
    });

    return normalized;
  }

  function deriveKnowledgeStatus(measurements) {
    const statuses = measurements.map(item => item.status);

    if (statuses.includes("unknown")) {
      return "unknown";
    }

    if (statuses.includes("estimated")) {
      return "estimated";
    }

    return "known";
  }

  function sourceSpec(kind, source = {}) {
    if (kind === "manual") {
      return {
        source: {
          kind: "manual",
          referenceId: null,
          version: null
        },
        sourceClass: "user_custom",
        verificationStatus: "user_confirmed"
      };
    }

    if (kind === "data_package" || kind === "ai_draft") {
      if (!isPlainObject(source)) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-006",
          "Kütüphane kaynak bilgisi geçersiz."
        );
      }

      const referenceId = normalizeIdentifier(
        source.referenceId,
        "Kaynak kimliği"
      );
      const version = normalizeVersion(
        source.version,
        "Kaynak sürümü"
      );

      return {
        source: { kind, referenceId, version },
        sourceClass:
          kind === "data_package"
            ? "verified_data_package"
            : "ai_draft",
        verificationStatus:
          kind === "data_package"
            ? "source_verified"
            : "unverified"
      };
    }

    throw createError(
      "TODAY-NUTRITION-LIBRARY-006",
      "Kütüphane kaynak türü desteklenmiyor.",
      { kind }
    );
  }

  function buildRecord(candidate) {
    const { contracts } = getDependencies();

    try {
      return clone(contracts.createRecord(candidate));
    } catch (error) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "Kütüphane kaydı beslenme sözleşmesine uygun değil.",
        {
          type: candidate?.type || null,
          validationErrors: clone(error?.validationErrors || [])
        },
        error
      );
    }
  }

  function libraryExtensions(meta, extra = {}) {
    return {
      [LIBRARY_EXTENSION_KEY]: clone(meta),
      ...clone(extra)
    };
  }

  function recordBase(options) {
    const draft = options.sourceSpec.source.kind === "ai_draft";

    return {
      id: options.id,
      type: options.type,
      schemaVersion: getDependencies().contracts.CONTRACT_VERSION,
      createdAt: options.timestamp,
      updatedAt: options.timestamp,
      eventAt: null,
      source: clone(options.sourceSpec.source),
      knowledgeStatus: draft ? "estimated" : options.knowledgeStatus,
      recordStatus: draft ? "draft" : "active",
      verificationStatus: options.sourceSpec.verificationStatus,
      calculationVersion: null,
      userEdited: options.userEdited === true,
      payload: clone(options.payload),
      extensions: libraryExtensions(options.meta, options.extraExtensions)
    };
  }

  function normalizeFoodInput(input, options = {}) {
    if (!isPlainObject(input)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "Besin bilgisi düz bir nesne olmalıdır."
      );
    }

    const nutrients = normalizeNutrients(input.nutrients, {
      aiDraft: options.aiDraft === true
    });
    const servingBasis = normalizeMeasurement(
      input.servingBasis,
      "servingBasis"
    );

    return {
      name: normalizeText(input.name, "Besin adı"),
      servingBasis,
      nutrients,
      preparation: normalizePreparation(input.preparation),
      tags: normalizeStringList(input.tags, "Besin etiketi"),
      constraintTags: normalizeStringList(
        input.constraintTags,
        "Kısıt etiketi"
      ),
      referenceSourceIds: normalizeIdList(
        input.referenceSourceIds,
        "Besin kaynak referansı",
        options.defaultReferenceSourceIds || ["source:user-entry"]
      ),
      nutritionVersion: normalizeVersion(
        input.nutritionVersion,
        "Besin değeri sürümü",
        options.defaultNutritionVersion || options.version || "1.0.0"
      )
    };
  }

  function buildFoodRecord(options) {
    const measurements = [
      options.normalized.servingBasis,
      ...Object.values(options.normalized.nutrients)
    ];
    const meta = {
      entityKind: "food",
      logicalId: options.logicalId,
      version: options.version,
      supersedesId: options.supersedesId || null,
      baseRecordId: options.baseRecordId || null,
      sourceClass: options.sourceSpec.sourceClass,
      preparation: clone(options.normalized.preparation),
      nutritionVersion: options.normalized.nutritionVersion,
      tags: clone(options.normalized.tags),
      constraintTags: clone(options.normalized.constraintTags),
      derivedFromId: options.derivedFromId || null
    };
    const extra = clone(options.extraExtensions || {});

    if (options.aiRequest) {
      extra[AI_REQUEST_EXTENSION_KEY] = clone(options.aiRequest);
    }

    return buildRecord(recordBase({
      id: options.recordId,
      type: "food_version",
      timestamp: options.timestamp,
      sourceSpec: options.sourceSpec,
      knowledgeStatus: deriveKnowledgeStatus(measurements),
      userEdited: options.userEdited,
      payload: {
        foodId: options.logicalId,
        version: options.version,
        name: options.normalized.name,
        servingBasis: options.normalized.servingBasis,
        nutrients: options.normalized.nutrients,
        referenceSourceIds: options.normalized.referenceSourceIds
      },
      meta,
      extraExtensions: extra
    }));
  }

  function libraryMeta(record) {
    return record?.extensions?.[LIBRARY_EXTENSION_KEY] || null;
  }

  function snapshotMeta(record) {
    return record?.extensions?.[SNAPSHOT_EXTENSION_KEY] || null;
  }

  function expectedVersions(records) {
    return Object.fromEntries(
      records.filter(Boolean).map(record => [record.id, record.updatedAt])
    );
  }

  function statusCopy(record, status, timestamp) {
    return buildRecord({
      ...clone(record),
      updatedAt: timestamp,
      recordStatus: status,
      userEdited: true
    });
  }

  function validateLibraryRecord(record) {
    const meta = libraryMeta(record);

    if (!meta || !isPlainObject(meta)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Kütüphane kaydının sürüm izi eksik.",
        { recordId: record.id }
      );
    }

    if (
      !["food", "recipe", "meal_template"].includes(meta.entityKind) ||
      !IDENTIFIER_PATTERN.test(meta.logicalId || "") ||
      !SEMVER_PATTERN.test(meta.version || "") ||
      !SOURCE_CLASSES.includes(meta.sourceClass)
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Kütüphane kaydının sürüm metadatası geçersiz.",
        { recordId: record.id }
      );
    }

    const expectedEntity = {
      food_version: "food",
      recipe_version: "recipe",
      meal_template: "meal_template"
    }[record.type];

    if (expectedEntity !== meta.entityKind) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Kütüphane kayıt türü ile sürüm izi uyuşmuyor.",
        { recordId: record.id }
      );
    }

    if (
      record.type === "food_version" &&
      (
        record.payload.foodId !== meta.logicalId ||
        record.payload.version !== meta.version
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Besin kimliği veya sürümü üst metadatayla uyuşmuyor.",
        { recordId: record.id }
      );
    }

    if (
      record.type === "recipe_version" &&
      (
        record.payload.recipeId !== meta.logicalId ||
        record.payload.version !== meta.version
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Tarif kimliği veya sürümü üst metadatayla uyuşmuyor.",
        { recordId: record.id }
      );
    }

    const sourceClassByKind = {
      manual: "user_custom",
      data_package: "verified_data_package",
      ai_draft: "ai_draft"
    };

    if (sourceClassByKind[record.source.kind] !== meta.sourceClass) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Kütüphane kaynağı olduğundan farklı gösterilemez.",
        { recordId: record.id }
      );
    }

    if (
      record.source.kind === "ai_draft" &&
      (
        record.recordStatus !== "draft" ||
        record.verificationStatus !== "unverified"
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "AI kütüphane kaydı yalnız doğrulanmamış taslak olabilir.",
        { recordId: record.id }
      );
    }

    if (
      record.source.kind === "data_package" &&
      record.verificationStatus !== "source_verified"
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Veri paketi kaydı kaynak doğrulaması taşımalıdır.",
        { recordId: record.id }
      );
    }

    if (
      record.source.kind === "manual" &&
      record.verificationStatus !== "user_confirmed"
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Kullanıcı besini kullanıcı doğrulaması taşımalıdır.",
        { recordId: record.id }
      );
    }

    return meta;
  }

  function validateDomain(records) {
    const libraryRecords = records.filter(record =>
      LIBRARY_RECORD_TYPES.includes(record.type)
    );
    const byId = new Map(records.map(record => [record.id, record]));
    const activeByLogical = new Map();
    const successorCounts = new Map();

    libraryRecords.forEach(record => {
      const meta = validateLibraryRecord(record);

      if (record.recordStatus === "active") {
        const key = `${record.type}:${meta.logicalId}`;

        if (activeByLogical.has(key)) {
          throw createError(
            "TODAY-NUTRITION-LIBRARY-004",
            "Aynı kütüphane öğesinin birden fazla etkin sürümü olamaz.",
            { logicalId: meta.logicalId }
          );
        }

        activeByLogical.set(key, record);
      }

      if (meta.supersedesId) {
        const previous = byId.get(meta.supersedesId);

        if (!previous || previous.type !== record.type) {
          throw createError(
            "TODAY-NUTRITION-LIBRARY-004",
            "Kütüphane sürüm zincirinin önceki kaydı bulunamıyor.",
            { recordId: record.id, supersedesId: meta.supersedesId }
          );
        }

        const previousMeta = libraryMeta(previous);

        if (
          !previousMeta ||
          previousMeta.logicalId !== meta.logicalId ||
          previous.recordStatus !== "superseded" ||
          compareVersions(meta.version, previousMeta.version) <= 0
        ) {
          throw createError(
            "TODAY-NUTRITION-LIBRARY-004",
            "Kütüphane sürüm zinciri tutarsız.",
            { recordId: record.id, supersedesId: meta.supersedesId }
          );
        }

        successorCounts.set(
          meta.supersedesId,
          (successorCounts.get(meta.supersedesId) || 0) + 1
        );
      }
    });

    successorCounts.forEach((count, recordId) => {
      if (count > 1) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "Kütüphane sürüm geçmişi dallanamaz.",
          { recordId }
        );
      }
    });

    libraryRecords.forEach(record => {
      const visited = new Set();
      let cursor = record;

      while (cursor) {
        if (visited.has(cursor.id)) {
          throw createError(
            "TODAY-NUTRITION-LIBRARY-004",
            "Kütüphane sürüm geçmişinde döngü olamaz.",
            { recordId: record.id }
          );
        }

        visited.add(cursor.id);
        const previousId = libraryMeta(cursor)?.supersedesId;
        cursor = previousId ? byId.get(previousId) : null;
      }
    });

    return {
      records,
      libraryRecords,
      byId,
      activeByLogical
    };
  }

  async function readDomainState() {
    const { storage } = getDependencies();
    const records = await storage.queryRecords({
      types: [...LIBRARY_RECORD_TYPES, "meal_item_snapshot"],
      includeAiDrafts: true,
      limit: 5000,
      sortDirection: "asc"
    });

    return validateDomain(records);
  }

  function findLibraryRecord(state, recordId, expectedType = null) {
    const id = normalizeIdentifier(recordId, "Kütüphane kayıt kimliği");
    const record = state.byId.get(id);

    if (
      !record ||
      !LIBRARY_RECORD_TYPES.includes(record.type) ||
      (expectedType && record.type !== expectedType)
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Kütüphane kaydı bulunamadı.",
        { recordId: id, expectedType }
      );
    }

    return record;
  }

  function activeForLogical(state, type, logicalId) {
    return state.activeByLogical.get(`${type}:${logicalId}`) || null;
  }

  function assertNewLogicalId(state, type, logicalId) {
    const conflict = state.libraryRecords.find(record => {
      const meta = libraryMeta(record);
      return (
        record.type === type &&
        record.source.kind !== "ai_draft" &&
        meta?.logicalId === logicalId
      );
    });

    if (conflict) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Bu kütüphane kimliği daha önce kullanılmış.",
        { logicalId, recordId: conflict.id }
      );
    }
  }

  function assertCalculationSource(record) {
    const { calculations } = getDependencies();

    if (
      !record ||
      !["food_version", "recipe_version"].includes(record.type) ||
      record.recordStatus !== "active" ||
      record.source.kind === "ai_draft" ||
      !["user_confirmed", "source_verified"].includes(
        record.verificationStatus
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-005",
        "Hesaplamaya yalnız etkin ve doğrulanmış besin veya tarif sürümü girebilir.",
        { recordId: record?.id || null }
      );
    }

    validateLibraryRecord(record);

    if (!calculations.CALCULATION_VERSION) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-001",
        "Hesaplama sürümü hazır değil."
      );
    }

    return record;
  }

  function recipeSnapshots(record, state) {
    return record.payload.ingredientSnapshotIds.map(snapshotId => {
      const snapshot = state.byId.get(snapshotId);

      if (
        !snapshot ||
        snapshot.type !== "meal_item_snapshot" ||
        snapshot.source.kind !== "system_calculation" ||
        snapshot.recordStatus !== "active" ||
        snapshot.calculationVersion !==
          getDependencies().calculations.CALCULATION_VERSION ||
        !snapshotMeta(snapshot) ||
        snapshotMeta(snapshot).sourceClass === "ai_draft"
      ) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-005",
          "Tarif bileşen anlık görüntüsü güncel ve doğrulanabilir değil.",
          { recipeRecordId: record.id, snapshotId }
        );
      }

      return snapshot;
    });
  }

  function calculateRecord(record, amount, state) {
    const { calculations } = getDependencies();
    assertCalculationSource(record);
    const normalizedAmount = normalizeMeasurement(amount, "amount");

    try {
      if (record.type === "food_version") {
        return calculations.calculateFoodNutrients(record, normalizedAmount);
      }

      return calculations.calculateRecipeNutrients(
        record,
        recipeSnapshots(record, state),
        normalizedAmount
      );
    } catch (error) {
      if (error?.todayCode?.startsWith("TODAY-NUTRITION-LIBRARY-")) {
        throw error;
      }

      throw createError(
        "TODAY-NUTRITION-LIBRARY-005",
        "Kütüphane miktarı kaynak porsiyonuyla uyumlu değil.",
        { recordId: record.id, calculationError: error?.todayCode || null },
        error
      );
    }
  }

  function normalizeItemInputs(value, fieldName) {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_LIST_LENGTH) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        `${fieldName} boş olmayan bir liste olmalıdır.`
      );
    }

    return value.map((item, index) => {
      if (!isPlainObject(item)) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-002",
          `${fieldName}[${index}] geçersiz.`
        );
      }

      return {
        recordId: normalizeIdentifier(
          item.recordId,
          `${fieldName}[${index}].recordId`
        ),
        amount: normalizeMeasurement(
          item.amount,
          `${fieldName}[${index}].amount`
        ),
        name:
          item.name === undefined
            ? null
            : normalizeText(item.name, `${fieldName}[${index}].name`)
      };
    });
  }

  function buildItemSnapshots(items, timestamp, state, options = {}) {
    const { contracts, calculations } = getDependencies();

    return items.map(item => {
      const sourceRecord = state.byId.get(item.recordId);
      const calculation = calculateRecord(sourceRecord, item.amount, state);
      const raw = calculations.buildCalculatedSnapshot({
        id: createIdentifier("library-snapshot"),
        createdAt: timestamp,
        calculation,
        name: item.name || sourceRecord.payload.name
      });
      const sourceMeta = libraryMeta(sourceRecord);
      const candidate = clone(raw);

      candidate.recordStatus = options.draft === true ? "draft" : "active";
      candidate.extensions[SNAPSHOT_EXTENSION_KEY] = {
        sourceRecordId: sourceRecord.id,
        sourceLogicalId: sourceMeta.logicalId,
        sourceVersion: sourceMeta.version,
        sourceClass: sourceMeta.sourceClass,
        preparation: clone(sourceMeta.preparation),
        nutritionVersion: sourceMeta.nutritionVersion,
        constraintTags: clone(sourceMeta.constraintTags || []),
        draftOwnerId: options.draftOwnerId || null
      };

      try {
        return clone(contracts.createRecord(candidate));
      } catch (error) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-005",
          "Kütüphane öğesi anlık görüntüye alınamadı.",
          { validationErrors: clone(error?.validationErrors || []) },
          error
        );
      }
    });
  }

  function unionConstraintTags(explicitTags, snapshots) {
    const tags = [...explicitTags];

    snapshots.forEach(snapshot => {
      (snapshotMeta(snapshot)?.constraintTags || []).forEach(tag => {
        if (!tags.some(existing => normalizedLabel(existing) === normalizedLabel(tag))) {
          tags.push(tag);
        }
      });
    });

    return tags;
  }

  function normalizeRecipeInput(input) {
    if (!isPlainObject(input)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "Tarif bilgisi düz bir nesne olmalıdır."
      );
    }

    return {
      name: normalizeText(input.name, "Tarif adı"),
      yield: normalizeMeasurement(input.yield, "yield"),
      ingredients: normalizeItemInputs(input.ingredients, "ingredients"),
      preparation: normalizePreparation(input.preparation),
      tags: normalizeStringList(input.tags, "Tarif etiketi"),
      constraintTags: normalizeStringList(input.constraintTags, "Kısıt etiketi")
    };
  }

  function buildRecipeRecord(options) {
    const statuses = options.snapshots.map(snapshot => ({
      status: snapshot.knowledgeStatus
    }));
    const constraintTags = unionConstraintTags(
      options.normalized.constraintTags,
      options.snapshots
    );
    const meta = {
      entityKind: "recipe",
      logicalId: options.logicalId,
      version: options.version,
      supersedesId: options.supersedesId || null,
      baseRecordId: options.baseRecordId || null,
      sourceClass: options.sourceSpec.sourceClass,
      preparation: clone(options.normalized.preparation),
      nutritionVersion: getDependencies().calculations.CALCULATION_VERSION,
      tags: clone(options.normalized.tags),
      constraintTags,
      derivedFromId: options.derivedFromId || null
    };
    const extra = clone(options.extraExtensions || {});

    if (options.aiRequest) {
      extra[AI_REQUEST_EXTENSION_KEY] = clone(options.aiRequest);
    }

    return buildRecord(recordBase({
      id: options.recordId,
      type: "recipe_version",
      timestamp: options.timestamp,
      sourceSpec: options.sourceSpec,
      knowledgeStatus: deriveKnowledgeStatus([
        options.normalized.yield,
        ...statuses
      ]),
      userEdited: options.userEdited,
      payload: {
        recipeId: options.logicalId,
        version: options.version,
        name: options.normalized.name,
        yield: options.normalized.yield,
        ingredientSnapshotIds: options.snapshots.map(snapshot => snapshot.id)
      },
      meta,
      extraExtensions: extra
    }));
  }

  function normalizeTemplateInput(input) {
    if (!isPlainObject(input)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "Öğün şablonu bilgisi düz bir nesne olmalıdır."
      );
    }

    if (!MEAL_TYPES.includes(input.mealType)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "Öğün şablonu türü geçersiz."
      );
    }

    return {
      name: normalizeText(input.name, "Öğün şablonu adı"),
      mealType: input.mealType,
      items: normalizeItemInputs(input.items, "items"),
      tags: normalizeStringList(input.tags, "Öğün etiketi"),
      constraintTags: normalizeStringList(input.constraintTags, "Kısıt etiketi")
    };
  }

  function buildTemplateRecord(options) {
    const meta = {
      entityKind: "meal_template",
      logicalId: options.logicalId,
      version: options.version,
      supersedesId: options.supersedesId || null,
      baseRecordId: options.baseRecordId || null,
      sourceClass: options.sourceSpec.sourceClass,
      preparation: null,
      nutritionVersion: getDependencies().calculations.CALCULATION_VERSION,
      tags: clone(options.normalized.tags),
      constraintTags: unionConstraintTags(
        options.normalized.constraintTags,
        options.snapshots
      ),
      derivedFromId: options.derivedFromId || null
    };
    const extra = clone(options.extraExtensions || {});

    if (options.aiRequest) {
      extra[AI_REQUEST_EXTENSION_KEY] = clone(options.aiRequest);
    }

    return buildRecord(recordBase({
      id: options.recordId,
      type: "meal_template",
      timestamp: options.timestamp,
      sourceSpec: options.sourceSpec,
      knowledgeStatus: deriveKnowledgeStatus(
        options.snapshots.map(snapshot => ({
          status: snapshot.knowledgeStatus
        }))
      ),
      userEdited: options.userEdited,
      payload: {
        name: options.normalized.name,
        mealType: options.normalized.mealType,
        itemSnapshotIds: options.snapshots.map(snapshot => snapshot.id)
      },
      meta,
      extraExtensions: extra
    }));
  }

  function publicSnapshot(state) {
    const active = state.libraryRecords.filter(record => record.recordStatus === "active");
    const drafts = state.libraryRecords.filter(record => record.source.kind === "ai_draft");
    const history = state.libraryRecords.filter(record =>
      ["superseded", "archived"].includes(record.recordStatus)
    );

    function byType(type) {
      return active
        .filter(record => record.type === type)
        .sort(compareLibraryRecords);
    }

    return freezeClone({
      foods: byType("food_version"),
      recipes: byType("recipe_version"),
      mealTemplates: byType("meal_template"),
      drafts: drafts.sort(compareLibraryRecords),
      history: history.sort(compareLibraryRecords),
      counts: {
        activeFoods: byType("food_version").length,
        activeRecipes: byType("recipe_version").length,
        activeMealTemplates: byType("meal_template").length,
        drafts: drafts.length,
        historicalVersions: history.length
      }
    });
  }

  function compareLibraryRecords(left, right) {
    const leftName = left.payload.name || "";
    const rightName = right.payload.name || "";
    const nameCompare = leftName.localeCompare(rightName, "tr-TR");

    return nameCompare || left.id.localeCompare(right.id);
  }

  async function getSnapshot() {
    return publicSnapshot(await readDomainState());
  }

  async function getItem(recordId, options = {}) {
    const state = await readDomainState();
    const record = findLibraryRecord(state, recordId);

    if (record.source.kind === "ai_draft" && options.includeDraft !== true) {
      return null;
    }

    return freezeClone(record);
  }

  async function getVersionHistory(recordId) {
    const state = await readDomainState();
    const start = findLibraryRecord(state, recordId);
    const meta = libraryMeta(start);
    const records = state.libraryRecords
      .filter(record =>
        record.type === start.type &&
        record.source.kind !== "ai_draft" &&
        libraryMeta(record)?.logicalId === meta.logicalId
      )
      .sort((left, right) =>
        compareVersions(
          libraryMeta(right).version,
          libraryMeta(left).version
        )
      );

    return freezeClone(records);
  }

  async function calculateItem(recordId, amount) {
    const state = await readDomainState();
    const record = findLibraryRecord(state, recordId);
    const calculation = calculateRecord(record, amount, state);

    return freezeClone(calculation);
  }

  async function createFood(input, confirmation) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const timestamp = resolveTimestamp(confirmation);
      const logicalId = normalizeIdentifier(input?.foodId, "Besin kimliği", "food");
      const version = normalizeLogicalVersion(input?.version, "1.0.0");
      const spec = sourceSpec("manual");
      const normalized = normalizeFoodInput(input, {
        version,
        defaultReferenceSourceIds: ["source:user-entry"]
      });
      const record = buildFoodRecord({
        recordId: createIdentifier("food-version"),
        logicalId,
        version,
        timestamp,
        normalized,
        sourceSpec: spec,
        userEdited: false
      });

      assertNewLogicalId(state, "food_version", logicalId);
      await getDependencies().storage.saveRecord(record, { mode: "add" });
      return freezeClone(record);
    });
  }

  async function importVerifiedFood(input, packageSource, confirmation) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const timestamp = resolveTimestamp(confirmation);
      const logicalId = normalizeIdentifier(input?.foodId, "Besin kimliği", "food");
      const version = normalizeLogicalVersion(input?.version, "1.0.0");
      const spec = sourceSpec("data_package", packageSource);
      const normalized = normalizeFoodInput(input, {
        version,
        defaultReferenceSourceIds: [spec.source.referenceId],
        defaultNutritionVersion: spec.source.version
      });
      const record = buildFoodRecord({
        recordId: createIdentifier("food-version"),
        logicalId,
        version,
        timestamp,
        normalized,
        sourceSpec: spec,
        userEdited: false
      });

      assertNewLogicalId(state, "food_version", logicalId);
      await getDependencies().storage.saveRecord(record, { mode: "add" });
      return freezeClone(record);
    });
  }

  function foodInputFromRecord(record, changes = {}) {
    const meta = libraryMeta(record);
    const merged = {
      name: record.payload.name,
      servingBasis: clone(record.payload.servingBasis),
      nutrients: clone(record.payload.nutrients),
      referenceSourceIds: clone(record.payload.referenceSourceIds),
      preparation: clone(meta.preparation),
      tags: clone(meta.tags || []),
      constraintTags: clone(meta.constraintTags || []),
      nutritionVersion: meta.nutritionVersion
    };

    Object.keys(changes || {}).forEach(key => {
      if (hasOwn(merged, key)) {
        merged[key] = clone(changes[key]);
      }
    });

    return merged;
  }

  async function updateFood(recordId, changes, confirmation) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const current = findLibraryRecord(state, recordId, "food_version");

      if (current.recordStatus !== "active") {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "Yalnız etkin besin sürümü güncellenebilir.",
          { recordId: current.id }
        );
      }

      const timestamp = resolveTimestamp(confirmation, current.updatedAt);
      const currentMeta = libraryMeta(current);
      const version = nextVersion(currentMeta.version);
      const normalized = normalizeFoodInput(
        foodInputFromRecord(current, changes),
        { version }
      );

      if (
        sameValue(
          normalized,
          normalizeFoodInput(
            foodInputFromRecord(current),
            { version: currentMeta.version }
          )
        )
      ) {
        return freezeClone(current);
      }

      const previous = statusCopy(current, "superseded", timestamp);
      const record = buildFoodRecord({
        recordId: createIdentifier("food-version"),
        logicalId: currentMeta.logicalId,
        version,
        timestamp,
        normalized,
        sourceSpec: sourceSpec("manual"),
        supersedesId: current.id,
        derivedFromId: current.id,
        userEdited: true
      });

      await getDependencies().storage.saveRecords(
        [previous, record],
        {
          mode: "upsert",
          expectedUpdatedAtById: expectedVersions([current])
        }
      );
      return freezeClone(record);
    });
  }

  async function importVerifiedFoodVersion(
    recordId,
    input,
    packageSource,
    confirmation
  ) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const current = findLibraryRecord(state, recordId, "food_version");

      if (current.recordStatus !== "active") {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "Yalnız etkin besin sürümü kaynak paketiyle güncellenebilir."
        );
      }

      const timestamp = resolveTimestamp(confirmation, current.updatedAt);
      const currentMeta = libraryMeta(current);
      const version = nextVersion(currentMeta.version);
      const spec = sourceSpec("data_package", packageSource);
      const normalized = normalizeFoodInput(input, {
        version,
        defaultReferenceSourceIds: [spec.source.referenceId],
        defaultNutritionVersion: spec.source.version
      });
      const previous = statusCopy(current, "superseded", timestamp);
      const record = buildFoodRecord({
        recordId: createIdentifier("food-version"),
        logicalId: currentMeta.logicalId,
        version,
        timestamp,
        normalized,
        sourceSpec: spec,
        supersedesId: current.id,
        userEdited: false
      });

      await getDependencies().storage.saveRecords(
        [previous, record],
        {
          mode: "upsert",
          expectedUpdatedAtById: expectedVersions([current])
        }
      );
      return freezeClone(record);
    });
  }

  async function createComposite(
    kind,
    input,
    confirmation,
    options = {}
  ) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const timestamp = resolveTimestamp(confirmation);
      const sourceKind = options.packageSource ? "data_package" : "manual";
      const spec = sourceSpec(sourceKind, options.packageSource);
      const isRecipe = kind === "recipe";
      const type = isRecipe ? "recipe_version" : "meal_template";
      const logicalField = isRecipe ? "recipeId" : "templateId";
      const logicalPrefix = isRecipe ? "recipe" : "meal-template";
      const logicalId = normalizeIdentifier(
        input?.[logicalField],
        isRecipe ? "Tarif kimliği" : "Öğün şablonu kimliği",
        logicalPrefix
      );
      const version = normalizeLogicalVersion(input?.version, "1.0.0");
      const normalized = isRecipe
        ? normalizeRecipeInput(input)
        : normalizeTemplateInput(input);
      const items = isRecipe ? normalized.ingredients : normalized.items;
      const recordId = createIdentifier(
        isRecipe ? "recipe-version" : "meal-template-version"
      );
      const snapshots = buildItemSnapshots(items, timestamp, state);
      const record = isRecipe
        ? buildRecipeRecord({
            recordId,
            logicalId,
            version,
            timestamp,
            normalized,
            snapshots,
            sourceSpec: spec,
            userEdited: false
          })
        : buildTemplateRecord({
            recordId,
            logicalId,
            version,
            timestamp,
            normalized,
            snapshots,
            sourceSpec: spec,
            userEdited: false
          });

      assertNewLogicalId(state, type, logicalId);
      await getDependencies().storage.saveRecords(
        [...snapshots, record],
        { mode: "add" }
      );
      return freezeClone(record);
    });
  }

  function createRecipe(input, confirmation) {
    return createComposite("recipe", input, confirmation);
  }

  function importVerifiedRecipe(input, packageSource, confirmation) {
    return createComposite("recipe", input, confirmation, { packageSource });
  }

  function createMealTemplate(input, confirmation) {
    return createComposite("meal_template", input, confirmation);
  }

  function itemsFromRecord(record, state) {
    const ids = record.type === "recipe_version"
      ? record.payload.ingredientSnapshotIds
      : record.payload.itemSnapshotIds;

    return ids.map(id => {
      const snapshot = state.byId.get(id);

      if (!snapshot || snapshot.type !== "meal_item_snapshot") {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "Kütüphane anlık görüntüsü bulunamadı.",
          { snapshotId: id }
        );
      }

      return {
        recordId: snapshot.payload.referenceId,
        amount: clone(snapshot.payload.amount),
        name: snapshot.payload.name
      };
    });
  }

  function compositeInputFromRecord(record, state, changes = {}) {
    const meta = libraryMeta(record);
    const recipe = record.type === "recipe_version";
    const merged = recipe
      ? {
          name: record.payload.name,
          yield: clone(record.payload.yield),
          ingredients: itemsFromRecord(record, state),
          preparation: clone(meta.preparation),
          tags: clone(meta.tags || []),
          constraintTags: clone(meta.constraintTags || [])
        }
      : {
          name: record.payload.name,
          mealType: record.payload.mealType,
          items: itemsFromRecord(record, state),
          tags: clone(meta.tags || []),
          constraintTags: clone(meta.constraintTags || [])
        };

    Object.keys(changes || {}).forEach(key => {
      if (hasOwn(merged, key)) {
        merged[key] = clone(changes[key]);
      }
    });

    return merged;
  }

  async function updateComposite(kind, recordId, changes, confirmation) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const isRecipe = kind === "recipe";
      const type = isRecipe ? "recipe_version" : "meal_template";
      const current = findLibraryRecord(state, recordId, type);

      if (current.recordStatus !== "active") {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "Yalnız etkin kütüphane sürümü güncellenebilir."
        );
      }

      const timestamp = resolveTimestamp(confirmation, current.updatedAt);
      const meta = libraryMeta(current);
      const version = nextVersion(meta.version);
      const normalized = isRecipe
        ? normalizeRecipeInput(compositeInputFromRecord(current, state, changes))
        : normalizeTemplateInput(compositeInputFromRecord(current, state, changes));

      const currentNormalized = isRecipe
        ? normalizeRecipeInput(compositeInputFromRecord(current, state))
        : normalizeTemplateInput(compositeInputFromRecord(current, state));

      if (sameValue(normalized, currentNormalized)) {
        return freezeClone(current);
      }

      const items = isRecipe ? normalized.ingredients : normalized.items;
      const snapshots = buildItemSnapshots(items, timestamp, state);
      const previous = statusCopy(current, "superseded", timestamp);
      const spec = sourceSpec("manual");
      const record = isRecipe
        ? buildRecipeRecord({
            recordId: createIdentifier("recipe-version"),
            logicalId: meta.logicalId,
            version,
            timestamp,
            normalized,
            snapshots,
            sourceSpec: spec,
            supersedesId: current.id,
            derivedFromId: current.id,
            userEdited: true
          })
        : buildTemplateRecord({
            recordId: createIdentifier("meal-template-version"),
            logicalId: meta.logicalId,
            version,
            timestamp,
            normalized,
            snapshots,
            sourceSpec: spec,
            supersedesId: current.id,
            derivedFromId: current.id,
            userEdited: true
          });

      await getDependencies().storage.saveRecords(
        [previous, ...snapshots, record],
        {
          mode: "upsert",
          expectedUpdatedAtById: expectedVersions([current])
        }
      );
      return freezeClone(record);
    });
  }

  function updateRecipe(recordId, changes, confirmation) {
    return updateComposite("recipe", recordId, changes, confirmation);
  }

  function updateMealTemplate(recordId, changes, confirmation) {
    return updateComposite("meal_template", recordId, changes, confirmation);
  }

  async function archiveItem(recordId, confirmation) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const current = findLibraryRecord(state, recordId);

      if (current.recordStatus !== "active") {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "Yalnız etkin kütüphane kaydı arşivlenebilir."
        );
      }

      const timestamp = resolveTimestamp(confirmation, current.updatedAt);
      const archived = statusCopy(current, "archived", timestamp);

      await getDependencies().storage.saveRecord(archived, {
        mode: "upsert",
        expectedUpdatedAtById: expectedVersions([current])
      });
      return freezeClone(archived);
    });
  }

  async function restoreItem(recordId, confirmation) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const current = findLibraryRecord(state, recordId);

      if (current.recordStatus !== "archived") {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "Yalnız arşivlenmiş kütüphane kaydı geri alınabilir."
        );
      }

      const meta = libraryMeta(current);
      const conflict = activeForLogical(
        state,
        current.type,
        meta.logicalId
      );

      if (conflict) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "Aynı kütüphane öğesinin etkin bir sürümü varken arşiv geri alınamaz.",
          {
            recordId: current.id,
            conflictId: conflict.id
          }
        );
      }

      const timestamp = resolveTimestamp(
        confirmation,
        current.updatedAt
      );
      const restored = statusCopy(
        current,
        "active",
        timestamp
      );

      await getDependencies().storage.saveRecord(
        restored,
        {
          mode: "upsert",
          expectedUpdatedAtById:
            expectedVersions([current])
        }
      );
      return freezeClone(restored);
    });
  }

  function aiRequestMetadata(consent) {
    return {
      requestedAt: resolveTimestamp(consent),
      userRequested: true,
      userDataUseApproved: true
    };
  }

  function draftBase(state, type, input) {
    const baseRecordId = input?.baseRecordId || null;

    if (!baseRecordId) {
      return { baseRecord: null, logicalId: null, version: "1.0.0" };
    }

    const baseRecord = findLibraryRecord(state, baseRecordId, type);

    if (baseRecord.recordStatus !== "active") {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "AI taslağı yalnız güncel etkin sürüme dayanabilir."
      );
    }

    const meta = libraryMeta(baseRecord);

    return {
      baseRecord,
      logicalId: meta.logicalId,
      version: nextVersion(meta.version)
    };
  }

  async function saveFoodDraft(input, consent) {
    assertAiRequest(consent);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const base = draftBase(state, "food_version", input);
      const timestamp = resolveTimestamp(consent);
      const spec = sourceSpec("ai_draft", input?.aiSource);
      const logicalId = base.logicalId || normalizeIdentifier(
        input?.foodId,
        "Besin kimliği",
        "food"
      );
      const version = base.version;
      const normalized = normalizeFoodInput(input, {
        aiDraft: true,
        version,
        defaultReferenceSourceIds: [spec.source.referenceId],
        defaultNutritionVersion: spec.source.version
      });
      const record = buildFoodRecord({
        recordId: createIdentifier("food-draft"),
        logicalId,
        version,
        timestamp,
        normalized,
        sourceSpec: spec,
        baseRecordId: base.baseRecord?.id || null,
        userEdited: false,
        aiRequest: aiRequestMetadata(consent)
      });

      if (!base.baseRecord) {
        assertNewLogicalId(state, "food_version", logicalId);
      }

      await getDependencies().storage.saveRecord(record, { mode: "add" });
      return freezeClone(record);
    });
  }

  async function saveCompositeDraft(kind, input, consent) {
    assertAiRequest(consent);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const isRecipe = kind === "recipe";
      const type = isRecipe ? "recipe_version" : "meal_template";
      const base = draftBase(state, type, input);
      const timestamp = resolveTimestamp(consent);
      const spec = sourceSpec("ai_draft", input?.aiSource);
      const logicalId = base.logicalId || normalizeIdentifier(
        isRecipe ? input?.recipeId : input?.templateId,
        isRecipe ? "Tarif kimliği" : "Öğün şablonu kimliği",
        isRecipe ? "recipe" : "meal-template"
      );
      const normalized = isRecipe
        ? normalizeRecipeInput(input)
        : normalizeTemplateInput(input);
      const recordId = createIdentifier(
        isRecipe ? "recipe-draft" : "meal-template-draft"
      );
      const snapshots = buildItemSnapshots(
        isRecipe ? normalized.ingredients : normalized.items,
        timestamp,
        state,
        { draft: true, draftOwnerId: recordId }
      );
      const shared = {
        recordId,
        logicalId,
        version: base.version,
        timestamp,
        normalized,
        snapshots,
        sourceSpec: spec,
        baseRecordId: base.baseRecord?.id || null,
        userEdited: false,
        aiRequest: aiRequestMetadata(consent)
      };
      const record = isRecipe
        ? buildRecipeRecord(shared)
        : buildTemplateRecord(shared);

      if (!base.baseRecord) {
        assertNewLogicalId(state, type, logicalId);
      }

      await getDependencies().storage.saveRecords(
        [...snapshots, record],
        { mode: "add" }
      );
      return freezeClone(record);
    });
  }

  function saveRecipeDraft(input, consent) {
    return saveCompositeDraft("recipe", input, consent);
  }

  function saveMealTemplateDraft(input, consent) {
    return saveCompositeDraft("meal_template", input, consent);
  }

  async function listDrafts(options = {}) {
    const state = await readDomainState();
    const type = options.type || null;

    if (type && !LIBRARY_RECORD_TYPES.includes(type)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-002",
        "AI taslak türü geçersiz."
      );
    }

    return freezeClone(
      state.libraryRecords
        .filter(record =>
          record.source.kind === "ai_draft" &&
          (!type || record.type === type)
        )
        .sort(compareLibraryRecords)
    );
  }

  function acceptedDraftRecord(state, draftId) {
    return state.libraryRecords.find(record =>
      record.extensions?.[APPROVAL_EXTENSION_KEY]?.draftId === draftId
    ) || null;
  }

  function assertDraftBaseCurrent(state, draft) {
    const meta = libraryMeta(draft);
    const baseRecordId = meta.baseRecordId;
    const current = activeForLogical(state, draft.type, meta.logicalId);

    if (baseRecordId) {
      if (!current || current.id !== baseRecordId) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "AI taslağının dayandığı kütüphane sürümü artık güncel değil.",
          { draftId: draft.id, baseRecordId }
        );
      }

      return current;
    }

    if (current) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-004",
        "Yeni öğe AI taslağının kimliği bu sırada kullanılmış.",
        { draftId: draft.id, currentRecordId: current.id }
      );
    }

    return null;
  }

  function draftInput(draft, state, overrides = {}) {
    const meta = libraryMeta(draft);

    if (draft.type === "food_version") {
      return foodInputFromRecord(draft, overrides);
    }

    return compositeInputFromRecord(draft, state, overrides);
  }

  async function acceptDraft(draftId, overrides, confirmation) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const state = await readDomainState();
      const draft = findLibraryRecord(state, draftId);

      if (
        draft.source.kind !== "ai_draft" ||
        draft.recordStatus !== "draft"
      ) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "Kayıt kabul edilebilir bir AI taslağı değil."
        );
      }

      if (acceptedDraftRecord(state, draft.id)) {
        throw createError(
          "TODAY-NUTRITION-LIBRARY-004",
          "AI kütüphane taslağı daha önce kabul edilmiş."
        );
      }

      const current = assertDraftBaseCurrent(state, draft);
      const timestamp = resolveTimestamp(
        confirmation,
        current?.updatedAt || draft.updatedAt
      );
      const meta = libraryMeta(draft);
      const normalizedInput = draftInput(draft, state, overrides || {});
      const spec = sourceSpec("manual");
      const approval = {
        [APPROVAL_EXTENSION_KEY]: {
          draftId: draft.id,
          approvedAt: timestamp,
          userInitiated: true,
          userConfirmed: true
        }
      };
      const version = current
        ? nextVersion(libraryMeta(current).version)
        : meta.version;
      const previous = current
        ? statusCopy(current, "superseded", timestamp)
        : null;
      let record;
      let snapshots = [];

      if (draft.type === "food_version") {
        const normalized = normalizeFoodInput(normalizedInput, { version });
        record = buildFoodRecord({
          recordId: createIdentifier("food-version"),
          logicalId: meta.logicalId,
          version,
          timestamp,
          normalized,
          sourceSpec: spec,
          supersedesId: current?.id || null,
          derivedFromId: draft.id,
          userEdited: true,
          extraExtensions: approval
        });
      } else {
        const recipe = draft.type === "recipe_version";
        const normalized = recipe
          ? normalizeRecipeInput(normalizedInput)
          : normalizeTemplateInput(normalizedInput);
        snapshots = buildItemSnapshots(
          recipe ? normalized.ingredients : normalized.items,
          timestamp,
          state
        );
        const shared = {
          recordId: createIdentifier(
            recipe ? "recipe-version" : "meal-template-version"
          ),
          logicalId: meta.logicalId,
          version,
          timestamp,
          normalized,
          snapshots,
          sourceSpec: spec,
          supersedesId: current?.id || null,
          derivedFromId: draft.id,
          userEdited: true,
          extraExtensions: approval
        };
        record = recipe
          ? buildRecipeRecord(shared)
          : buildTemplateRecord(shared);
      }

      await getDependencies().storage.saveRecords(
        [previous, ...snapshots, record].filter(Boolean),
        {
          mode: "upsert",
          expectedUpdatedAtById: expectedVersions([current].filter(Boolean))
        }
      );
      return freezeClone(record);
    });
  }

  async function getConstraintWarnings(recordId, profileSnapshot = null) {
    const state = await readDomainState();
    const record = findLibraryRecord(state, recordId);
    const tags = libraryMeta(record).constraintTags || [];
    let profile = profileSnapshot;

    if (profile === null) {
      const profileApi = window.TodayNutritionProfile;

      if (!profileApi || typeof profileApi.getSnapshot !== "function") {
        return freezeClone([]);
      }

      profile = await profileApi.getSnapshot();
    }

    if (!isPlainObject(profile) || !Array.isArray(profile.activeConstraints)) {
      throw createError(
        "TODAY-NUTRITION-LIBRARY-008",
        "Profil kısıt bağlamı geçersiz."
      );
    }

    const normalizedTags = new Map(
      tags.map(tag => [normalizedLabel(tag), tag])
    );
    const warnings = profile.activeConstraints
      .filter(constraint => {
        const label = constraint?.label || constraint?.payload?.label;
        return label && normalizedTags.has(normalizedLabel(label));
      })
      .map(constraint => {
        const label = constraint.label || constraint.payload.label;
        const category = constraint.category || constraint.payload.kind;

        return {
          constraintId: constraint.id,
          category,
          label,
          matchedTag: normalizedTags.get(normalizedLabel(label)),
          blocking: false,
          message: `${label} profil kısıtıyla eşleşen açıklanabilir bir etiket bulundu.`
        };
      });

    return freezeClone(warnings);
  }

  window.TodayNutritionLibrary = Object.freeze({
    LIBRARY_API_VERSION,
    LIBRARY_RULESET_ID,
    LIBRARY_EXTENSION_KEY,
    SNAPSHOT_EXTENSION_KEY,
    APPROVAL_EXTENSION_KEY,
    LIBRARY_RECORD_TYPES,
    SOURCE_CLASSES,
    MEAL_TYPES,
    getSnapshot,
    getItem,
    getVersionHistory,
    calculateItem,
    createFood,
    importVerifiedFood,
    updateFood,
    importVerifiedFoodVersion,
    createRecipe,
    importVerifiedRecipe,
    updateRecipe,
    createMealTemplate,
    updateMealTemplate,
    archiveItem,
    restoreItem,
    saveFoodDraft,
    saveRecipeDraft,
    saveMealTemplateDraft,
    listDrafts,
    acceptDraft,
    getConstraintWarnings
  });
})();
