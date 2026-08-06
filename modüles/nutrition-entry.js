/**
 * Today App — Nutrition Entry
 * NUT-006 — Quick meal and hydration recording flows
 *
 * This module is local-first and UI/network agnostic. It creates immutable
 * consumption events through NUT-001 contracts, NUT-002 atomic storage,
 * NUT-003 calculations and NUT-005 versioned library sources.
 */

(function () {
  "use strict";

  const ENTRY_API_VERSION = 1;
  const ENTRY_RULESET_ID =
    "today:nutrition:entry:v1";
  const ENTRY_EXTENSION_KEY =
    "today.nutrition.entry";
  const SNAPSHOT_EXTENSION_KEY =
    "today.nutrition.entry-snapshot";
  const AI_REQUEST_EXTENSION_KEY =
    "today.nutrition.entry-ai-request";
  const APPROVAL_EXTENSION_KEY =
    "today.nutrition.entry-approval";

  const ENTRY_TYPES = deepFreeze([
    "meal_entry",
    "hydration_entry"
  ]);
  const MEAL_TYPES = deepFreeze([
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "other"
  ]);
  const COVERAGE_CODES = deepFreeze([
    "complete",
    "partial",
    "single_event",
    "unspecified"
  ]);
  const COMMON_BEVERAGE_TYPES = deepFreeze([
    "water",
    "tea",
    "coffee",
    "milk",
    "ayran",
    "juice",
    "other"
  ]);

  const IDENTIFIER_PATTERN =
    /^[a-z0-9](?:[a-z0-9._:-]{0,78}[a-z0-9])?$/;
  const VERSION_PATTERN =
    /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/i;
  const MAX_TEXT_LENGTH = 500;
  const MAX_ITEM_COUNT = 500;

  let idCounter = 0;
  let writeTail = Promise.resolve();

  function createError(
    code,
    message,
    detail = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name = "TodayNutritionEntryError";
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

    const prototype = Object.getPrototypeOf(value);

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

  function serializeWrite(operation) {
    const run = writeTail.then(operation, operation);

    writeTail = run.catch(() => undefined);
    return run;
  }

  function getDependencies() {
    const contracts = window.TodayNutritionContracts;
    const calculations =
      window.TodayNutritionCalculations;
    const storage = window.TodayNutritionStorage;
    const library = window.TodayNutritionLibrary;
    const missing = [];

    [
      "validateMeasurement",
      "createRecord"
    ].forEach(methodName => {
      if (
        !contracts ||
        typeof contracts[methodName] !== "function"
      ) {
        missing.push(
          `TodayNutritionContracts.${methodName}`
        );
      }
    });

    [
      "buildCalculatedSnapshot",
      "scaleMeasurement",
      "scaleNutrientMap",
      "canConvert"
    ].forEach(methodName => {
      if (
        !calculations ||
        typeof calculations[methodName] !== "function"
      ) {
        missing.push(
          `TodayNutritionCalculations.${methodName}`
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
        typeof storage[methodName] !== "function"
      ) {
        missing.push(
          `TodayNutritionStorage.${methodName}`
        );
      }
    });

    [
      "getItem",
      "calculateItem"
    ].forEach(methodName => {
      if (
        !library ||
        typeof library[methodName] !== "function"
      ) {
        missing.push(
          `TodayNutritionLibrary.${methodName}`
        );
      }
    });

    if (missing.length > 0) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-001",
        "Beslenme kayıt akışı bağımlılıkları hazır değil.",
        { missing }
      );
    }

    return {
      contracts,
      calculations,
      storage,
      library
    };
  }

  function assertUserConfirmation(options) {
    if (
      options?.userInitiated !== true ||
      options?.userConfirmed !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-003",
        "Gerçek tüketim kaydı açık kullanıcı işlemi ve onayı gerektirir."
      );
    }
  }

  function assertAiRequest(options) {
    if (
      options?.userRequested !== true ||
      options?.userDataUseApproved !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-007",
        "AI tüketim taslağı açık kullanıcı isteği ve veri kullanım onayı gerektirir."
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

    if (!IDENTIFIER_PATTERN.test(normalized)) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        `${fieldName} geçersiz.`,
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

    return normalizeIdentifier(value, fieldName);
  }

  function normalizeVersion(
    value,
    fieldName
  ) {
    const normalized =
      typeof value === "string"
        ? value.trim()
        : "";

    if (!VERSION_PATTERN.test(normalized)) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        `${fieldName} geçersiz.`,
        { fieldName }
      );
    }

    return normalized;
  }

  function normalizeText(value, fieldName) {
    const normalized =
      typeof value === "string"
        ? value.trim()
        : "";

    if (
      !normalized ||
      normalized.length > MAX_TEXT_LENGTH
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        `${fieldName} geçersiz.`,
        { fieldName }
      );
    }

    return normalized;
  }

  function normalizeMealType(value) {
    if (!MEAL_TYPES.includes(value)) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Öğün türü geçersiz.",
        { mealType: value || null }
      );
    }

    return value;
  }

  function normalizeCoverage(
    value,
    itemCount
  ) {
    const normalized =
      value ||
      (itemCount === 0
        ? "unspecified"
        : "complete");

    if (!COVERAGE_CODES.includes(normalized)) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Öğün kapsamı geçersiz.",
        { coverage: normalized }
      );
    }

    if (
      itemCount === 0 &&
      normalized !== "unspecified"
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Öğesi bilinmeyen hızlı kayıt yalnız unspecified kapsamıyla saklanabilir."
      );
    }

    return normalized;
  }

  function resolveTimestamp(options = {}) {
    const candidate =
      options.at ||
      new Date().toISOString();
    const parsed = Date.parse(candidate);

    if (Number.isNaN(parsed)) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "İşlem zamanı geçerli bir tarih-saat olmalıdır."
      );
    }

    return new Date(parsed).toISOString();
  }

  function resolveConsumedAt(
    value,
    operationAt
  ) {
    const candidate = value || operationAt;
    const parsed = Date.parse(candidate);

    if (Number.isNaN(parsed)) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Tüketim zamanı geçerli bir tarih-saat olmalıdır."
      );
    }

    const normalized =
      new Date(parsed).toISOString();

    if (
      Date.parse(normalized) >
      Date.parse(operationAt)
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Gelecekteki plan zamanı gerçek tüketim zamanı olarak kaydedilemez."
      );
    }

    return normalized;
  }

  function normalizeMeasurement(
    value,
    fieldName,
    options = {}
  ) {
    const { contracts } = getDependencies();
    const candidate = clone(value);
    const result =
      contracts.validateMeasurement(
        candidate,
        { path: `$.${fieldName}` }
      );

    if (!result.valid) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        `${fieldName} geçerli bir ölçüm olmalıdır.`,
        {
          fieldName,
          validationErrors: clone(result.errors)
        }
      );
    }

    if (
      options.requireKnown === true &&
      (
        candidate.status !== "known" ||
        typeof candidate.value !== "number" ||
        candidate.value <= 0
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        `${fieldName} gerçek kayıtta sıfırdan büyük ve bilinen olmalıdır.`,
        { fieldName }
      );
    }

    return candidate;
  }

  function normalizeNutrients(
    value,
    fieldName = "nutrients"
  ) {
    if (value === undefined || value === null) {
      return {};
    }

    if (!isPlainObject(value)) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Besin değerleri düz bir nesne olmalıdır."
      );
    }

    const nutrients = {};

    Object.keys(value).sort().forEach(key => {
      normalizeIdentifier(key, `${fieldName} anahtarı`);
      nutrients[key] = normalizeMeasurement(
        value[key],
        `${fieldName}.${key}`
      );
    });

    return nutrients;
  }

  function assertHydrationAmount(
    amount,
    options = {}
  ) {
    const { calculations } = getDependencies();
    const normalized = normalizeMeasurement(
      amount,
      "amount",
      {
        requireKnown:
          options.allowUnknown !== true
      }
    );

    if (
      normalized.unit !== null &&
      !calculations.canConvert(
        normalized.unit,
        "ml"
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Sıvı miktarı hacim birimiyle kaydedilmelidir.",
        { unit: normalized.unit }
      );
    }

    if (
      options.allowUnknown !== true &&
      normalized.unit === null
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Gerçek sıvı kaydında hacim birimi zorunludur."
      );
    }

    return normalized;
  }

  function deriveKnowledgeStatus(
    snapshots
  ) {
    if (
      !Array.isArray(snapshots) ||
      snapshots.length === 0
    ) {
      return "unknown";
    }

    const statuses = snapshots.map(
      snapshot => snapshot.knowledgeStatus
    );

    if (statuses.includes("unknown")) {
      return "unknown";
    }

    if (statuses.includes("estimated")) {
      return "estimated";
    }

    return "known";
  }

  function createIdentifier(prefix) {
    idCounter += 1;
    const randomPart =
      typeof window.crypto?.randomUUID ===
        "function"
        ? window.crypto.randomUUID()
        : `${Date.now().toString(36)}-${idCounter.toString(36)}`;

    return `${prefix}:${randomPart}`
      .toLowerCase()
      .replace(/[^a-z0-9._:-]/g, "-")
      .slice(0, 80);
  }

  function buildRecord(candidate) {
    const { contracts } = getDependencies();

    try {
      return clone(
        contracts.createRecord(candidate)
      );
    } catch (error) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-005",
        "Beslenme tüketim kaydı veri sözleşmesine uygun değil.",
        {
          type: candidate?.type || null,
          validationErrors:
            clone(error?.validationErrors || [])
        },
        error
      );
    }
  }

  function normalizeOperationId(options) {
    return normalizeOptionalIdentifier(
      options?.clientOperationId,
      "İstemci işlem kimliği"
    );
  }

  function aiSource(input, options) {
    const candidate =
      input?.aiSource ||
      options?.aiSource;

    if (!isPlainObject(candidate)) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-007",
        "AI taslak kaynak izi zorunludur."
      );
    }

    return {
      kind: "ai_draft",
      referenceId: normalizeIdentifier(
        candidate.referenceId,
        "AI istek kimliği"
      ),
      version: normalizeVersion(
        candidate.version,
        "AI sürümü"
      )
    };
  }

  function entryExtension(options) {
    return {
      rulesetId: ENTRY_RULESET_ID,
      entryKind: options.entryKind,
      captureMode: options.captureMode,
      userAction:
        options.userAction === true,
      clientOperationId:
        options.clientOperationId || null,
      sourceEntryId:
        options.sourceEntryId || null,
      sourceTemplateId:
        options.sourceTemplateId || null,
      sourcePlannedMealId:
        options.sourcePlannedMealId || null,
      derivedFromDraftId:
        options.derivedFromDraftId || null,
      snapshotCount:
        options.snapshotCount || 0
    };
  }

  function buildMealEntry(options) {
    const draft =
      options.source.kind === "ai_draft";
    const extensions = {
      [ENTRY_EXTENSION_KEY]:
        entryExtension({
          entryKind: "meal",
          captureMode:
            options.captureMode,
          userAction: !draft,
          clientOperationId:
            options.clientOperationId,
          sourceEntryId:
            options.sourceEntryId,
          sourceTemplateId:
            options.sourceTemplateId,
          sourcePlannedMealId:
            options.plannedMealId,
          derivedFromDraftId:
            options.derivedFromDraftId,
          snapshotCount:
            options.snapshots.length
        })
    };

    if (options.aiRequest) {
      extensions[AI_REQUEST_EXTENSION_KEY] =
        clone(options.aiRequest);
    }

    if (options.approval) {
      extensions[APPROVAL_EXTENSION_KEY] =
        clone(options.approval);
    }

    return buildRecord({
      id: options.id,
      type: "meal_entry",
      schemaVersion:
        getDependencies().contracts.CONTRACT_VERSION,
      createdAt: options.timestamp,
      updatedAt: options.timestamp,
      eventAt: options.consumedAt,
      source: clone(options.source),
      knowledgeStatus: draft
        ? "estimated"
        : deriveKnowledgeStatus(
            options.snapshots
          ),
      recordStatus: draft
        ? "draft"
        : "active",
      verificationStatus: draft
        ? "unverified"
        : "user_confirmed",
      calculationVersion: null,
      userEdited: false,
      payload: {
        consumedAt:
          options.consumedAt,
        mealType: options.mealType,
        itemSnapshotIds:
          options.snapshots.map(
            snapshot => snapshot.id
          ),
        coverage: options.coverage,
        plannedMealId:
          options.plannedMealId || null
      },
      extensions
    });
  }

  function buildHydrationEntry(options) {
    const draft =
      options.source.kind === "ai_draft";
    const extensions = {
      [ENTRY_EXTENSION_KEY]:
        entryExtension({
          entryKind: "hydration",
          captureMode:
            options.captureMode,
          userAction: !draft,
          clientOperationId:
            options.clientOperationId,
          sourceEntryId:
            options.sourceEntryId,
          derivedFromDraftId:
            options.derivedFromDraftId,
          snapshotCount: 0
        })
    };

    if (options.aiRequest) {
      extensions[AI_REQUEST_EXTENSION_KEY] =
        clone(options.aiRequest);
    }

    if (options.approval) {
      extensions[APPROVAL_EXTENSION_KEY] =
        clone(options.approval);
    }

    return buildRecord({
      id: options.id,
      type: "hydration_entry",
      schemaVersion:
        getDependencies().contracts.CONTRACT_VERSION,
      createdAt: options.timestamp,
      updatedAt: options.timestamp,
      eventAt: options.consumedAt,
      source: clone(options.source),
      knowledgeStatus: draft
        ? "estimated"
        : "known",
      recordStatus: draft
        ? "draft"
        : "active",
      verificationStatus: draft
        ? "unverified"
        : "user_confirmed",
      calculationVersion: null,
      userEdited: false,
      payload: {
        consumedAt:
          options.consumedAt,
        beverageType:
          options.beverageType,
        amount: clone(options.amount)
      },
      extensions
    });
  }

  function normalizeItemList(
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
        "TODAY-NUTRITION-ENTRY-002",
        `${fieldName} geçerli bir liste olmalıdır.`
      );
    }

    return value;
  }

  function normalizeLibraryItems(value) {
    return normalizeItemList(
      value,
      "items"
    ).map((item, index) => {
      if (!isPlainObject(item)) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-002",
          `items[${index}] geçersiz.`
        );
      }

      return {
        recordId: normalizeIdentifier(
          item.recordId,
          `items[${index}].recordId`
        ),
        amount: normalizeMeasurement(
          item.amount,
          `items[${index}].amount`,
          { requireKnown: true }
        ),
        name:
          item.name === undefined
            ? null
            : normalizeText(
                item.name,
                `items[${index}].name`
              )
      };
    });
  }

  function normalizeCustomItems(
    value,
    options = {}
  ) {
    return normalizeItemList(
      value,
      "customItems"
    ).map((item, index) => {
      if (!isPlainObject(item)) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-002",
          `customItems[${index}] geçersiz.`
        );
      }

      const defaultAmount = {
        status: options.draft
          ? "unknown"
          : "known",
        value: options.draft
          ? null
          : 1,
        unit: "portion",
        basis: null
      };

      return {
        name: normalizeText(
          item.name,
          `customItems[${index}].name`
        ),
        amount: normalizeMeasurement(
          item.amount || defaultAmount,
          `customItems[${index}].amount`,
          {
            requireKnown:
              options.draft !== true
          }
        ),
        nutrients: normalizeNutrients(
          item.nutrients,
          `customItems[${index}].nutrients`
        )
      };
    });
  }

  function buildCustomSnapshot(
    item,
    options
  ) {
    const draft = options.draft === true;
    const nutrientStatuses =
      Object.values(item.nutrients).map(
        measurement => measurement.status
      );
    let knowledgeStatus = "known";

    if (
      Object.keys(item.nutrients).length === 0 ||
      nutrientStatuses.includes("unknown")
    ) {
      knowledgeStatus = "unknown";
    } else if (
      item.amount.status === "estimated" ||
      nutrientStatuses.includes("estimated")
    ) {
      knowledgeStatus = "estimated";
    }

    if (draft) {
      knowledgeStatus = "estimated";
    }

    return buildRecord({
      id: createIdentifier("entry-snapshot"),
      type: "meal_item_snapshot",
      schemaVersion:
        getDependencies().contracts.CONTRACT_VERSION,
      createdAt: options.timestamp,
      updatedAt: options.timestamp,
      eventAt: null,
      source: draft
        ? clone(options.aiSource)
        : {
            kind: "manual",
            referenceId: null,
            version: null
          },
      knowledgeStatus,
      recordStatus: draft
        ? "draft"
        : "active",
      verificationStatus: draft
        ? "unverified"
        : "user_confirmed",
      calculationVersion: null,
      userEdited: false,
      payload: {
        itemKind: "custom",
        referenceId: null,
        name: item.name,
        amount: clone(item.amount),
        nutrients: clone(item.nutrients),
        sourceVersion: null
      },
      extensions: {
        [SNAPSHOT_EXTENSION_KEY]: {
          rulesetId: ENTRY_RULESET_ID,
          captureMode: "custom",
          sourceSnapshotId: null,
          sourceEntryId: null,
          draftOwnerId:
            draft
              ? options.ownerId
              : null
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
    const sourceRecord =
      await library.getItem(item.recordId, {
        includeDraft: true
      });

    if (
      !sourceRecord ||
      ![
        "food_version",
        "recipe_version"
      ].includes(sourceRecord.type) ||
      sourceRecord.recordStatus !== "active" ||
      sourceRecord.source.kind === "ai_draft"
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-004",
        "Hızlı öğün yalnız etkin ve doğrulanmış besin veya tarif sürümünü kullanabilir.",
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
        "TODAY-NUTRITION-ENTRY-005",
        "Seçilen öğün miktarı deterministik olarak hesaplanamadı.",
        {
          recordId: item.recordId,
          calculationError:
            error?.todayCode || null
        },
        error
      );
    }

    const raw = clone(
      calculations.buildCalculatedSnapshot({
        id: createIdentifier("entry-snapshot"),
        createdAt: options.timestamp,
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

    raw.recordStatus = options.draft
      ? "draft"
      : "active";
    raw.extensions[
      SNAPSHOT_EXTENSION_KEY
    ] = {
      rulesetId: ENTRY_RULESET_ID,
      captureMode: "library",
      sourceSnapshotId: null,
      sourceEntryId: null,
      sourceLibraryRecordId:
        sourceRecord.id,
      sourceLogicalId:
        libraryMeta.logicalId || null,
      sourceVersion:
        libraryMeta.version ||
        sourceRecord.payload.version,
      sourceClass:
        libraryMeta.sourceClass || null,
      preparation:
        clone(libraryMeta.preparation || null),
      nutritionVersion:
        libraryMeta.nutritionVersion ||
        calculation.calculationVersion,
      constraintTags:
        clone(libraryMeta.constraintTags || []),
      draftOwnerId:
        options.draft
          ? options.ownerId
          : null
    };

    return buildRecord(raw);
  }

  function normalizeMultiplier(value) {
    const candidate =
      value === undefined || value === null
        ? 1
        : Number(value);

    if (
      !Number.isFinite(candidate) ||
      candidate <= 0
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Öğün şablonu çarpanı sıfırdan büyük olmalıdır."
      );
    }

    return candidate;
  }

  function assertSnapshotRecord(
    snapshot,
    options = {}
  ) {
    const { calculations } = getDependencies();

    if (
      !snapshot ||
      snapshot.type !== "meal_item_snapshot" ||
      (
        options.allowDraft !== true &&
        snapshot.recordStatus !== "active"
      ) ||
      (
        snapshot.source.kind === "ai_draft" &&
        options.allowDraft !== true
      ) ||
      (
        snapshot.source.kind === "system_calculation" &&
        snapshot.calculationVersion !==
          calculations.CALCULATION_VERSION
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-004",
        "Kaynak öğün anlık görüntüsü geçersiz veya doğrulanamaz.",
        { snapshotId: snapshot?.id || null }
      );
    }

    return snapshot;
  }

  function cloneSnapshot(
    sourceSnapshot,
    options
  ) {
    const source = assertSnapshotRecord(
      sourceSnapshot,
      {
        allowDraft:
          options.allowDraft === true
      }
    );
    const draft = options.draft === true;
    const candidate = clone(source);

    candidate.id =
      createIdentifier("entry-snapshot");
    candidate.createdAt = options.timestamp;
    candidate.updatedAt = options.timestamp;
    candidate.eventAt = null;
    candidate.recordStatus = draft
      ? "draft"
      : "active";
    candidate.userEdited = false;

    if (
      !draft &&
      candidate.source.kind === "ai_draft"
    ) {
      candidate.source = {
        kind: "manual",
        referenceId: null,
        version: null
      };
      candidate.verificationStatus =
        "user_confirmed";
      candidate.knowledgeStatus =
        candidate.payload.nutrients &&
        Object.keys(candidate.payload.nutrients).length > 0
          ? candidate.knowledgeStatus
          : "unknown";
    }

    candidate.extensions = {
      ...clone(candidate.extensions || {}),
      [SNAPSHOT_EXTENSION_KEY]: {
        rulesetId: ENTRY_RULESET_ID,
        captureMode:
          options.captureMode,
        sourceSnapshotId: source.id,
        sourceEntryId:
          options.sourceEntryId || null,
        draftOwnerId:
          draft
            ? options.ownerId
            : null
      }
    };

    return buildRecord(candidate);
  }

  function scaleTemplateSnapshot(
    sourceSnapshot,
    multiplier,
    options
  ) {
    const { calculations } = getDependencies();
    const source = assertSnapshotRecord(
      sourceSnapshot
    );
    const factor = {
      status: "known",
      value: multiplier,
      basis: null
    };
    const candidate = clone(source);

    candidate.id =
      createIdentifier("entry-snapshot");
    candidate.createdAt = options.timestamp;
    candidate.updatedAt = options.timestamp;
    candidate.eventAt = null;
    candidate.recordStatus = options.draft
      ? "draft"
      : "active";
    candidate.payload.amount = clone(
      calculations.scaleMeasurement(
        source.payload.amount,
        factor
      )
    );
    candidate.payload.nutrients = clone(
      calculations.scaleNutrientMap(
        source.payload.nutrients,
        factor
      )
    );
    candidate.extensions = {
      ...clone(candidate.extensions || {}),
      [SNAPSHOT_EXTENSION_KEY]: {
        rulesetId: ENTRY_RULESET_ID,
        captureMode: "template",
        sourceSnapshotId: source.id,
        sourceEntryId: null,
        sourceTemplateId:
          options.templateId,
        templateMultiplier: multiplier,
        draftOwnerId:
          options.draft
            ? options.ownerId
            : null
      }
    };

    return buildRecord(candidate);
  }

  async function readSnapshots(
    snapshotIds,
    options = {}
  ) {
    const { storage } = getDependencies();
    const records = [];

    for (const snapshotId of snapshotIds) {
      const snapshot = await storage.getRecord(
        snapshotId,
        { includeAiDraft: true }
      );

      if (!snapshot) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-004",
          "Kaynak öğün anlık görüntüsü bulunamadı.",
          { snapshotId }
        );
      }

      records.push(
        assertSnapshotRecord(snapshot, options)
      );
    }

    return records;
  }

  async function templateSnapshots(
    templateId,
    multiplier,
    options
  ) {
    const { library } = getDependencies();
    const template = await library.getItem(
      templateId,
      { includeDraft: true }
    );

    if (
      !template ||
      template.type !== "meal_template" ||
      template.recordStatus !== "active" ||
      template.source.kind === "ai_draft" ||
      ![
        "user_confirmed",
        "source_verified"
      ].includes(template.verificationStatus)
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-004",
        "Hızlı kayıt için etkin ve doğrulanmış öğün şablonu gerekir.",
        { templateId }
      );
    }

    const sourceSnapshots =
      await readSnapshots(
        template.payload.itemSnapshotIds
      );
    const snapshots = sourceSnapshots.map(
      snapshot => scaleTemplateSnapshot(
        snapshot,
        multiplier,
        {
          ...options,
          templateId: template.id
        }
      )
    );

    return { template, snapshots };
  }

  async function buildMealSnapshots(
    input,
    options
  ) {
    if (!isPlainObject(input)) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Öğün kaydı düz bir nesne olmalıdır."
      );
    }

    const libraryItems =
      normalizeLibraryItems(input.items);
    const customItems =
      normalizeCustomItems(
        input.customItems,
        { draft: options.draft }
      );
    const snapshots = [];
    let template = null;

    if (input.templateId !== undefined) {
      const result = await templateSnapshots(
        normalizeIdentifier(
          input.templateId,
          "Öğün şablonu kimliği"
        ),
        normalizeMultiplier(
          input.templateMultiplier
        ),
        options
      );

      template = result.template;
      snapshots.push(...result.snapshots);
    } else if (
      input.templateMultiplier !== undefined
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Şablon çarpanı yalnız şablon kimliğiyle kullanılabilir."
      );
    }

    for (const item of libraryItems) {
      snapshots.push(
        await buildLibrarySnapshot(
          item,
          options
        )
      );
    }

    customItems.forEach(item => {
      snapshots.push(
        buildCustomSnapshot(item, options)
      );
    });

    if (snapshots.length > MAX_ITEM_COUNT) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Tek öğün kaydı en fazla 500 anlık görüntü içerebilir."
      );
    }

    const mealType = normalizeMealType(
      input.mealType ||
      template?.payload?.mealType
    );
    const coverage = normalizeCoverage(
      input.coverage,
      snapshots.length
    );
    const captureModes = [];

    if (template) {
      captureModes.push("template");
    }
    if (libraryItems.length > 0) {
      captureModes.push("library");
    }
    if (customItems.length > 0) {
      captureModes.push("custom");
    }
    if (snapshots.length === 0) {
      captureModes.push("unspecified");
    }

    return {
      snapshots,
      mealType,
      coverage,
      templateId:
        template?.id || null,
      captureMode:
        captureModes.length === 1
          ? captureModes[0]
          : "mixed"
    };
  }

  async function findByOperationId(
    operationId
  ) {
    if (!operationId) {
      return null;
    }

    const { storage } = getDependencies();
    const records = await storage.queryRecords({
      types: ENTRY_TYPES,
      includeAiDrafts: true,
      limit: 5000,
      sortDirection: "asc"
    });

    return records.find(record =>
      record.extensions?.[
        ENTRY_EXTENSION_KEY
      ]?.clientOperationId === operationId
    ) || null;
  }

  async function idempotentResult(
    operationId,
    expectedType
  ) {
    const existing =
      await findByOperationId(operationId);

    if (!existing) {
      return null;
    }

    if (existing.type !== expectedType) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-008",
        "İstemci işlem kimliği farklı bir tüketim türü için daha önce kullanılmış.",
        {
          operationId,
          existingType: existing.type,
          expectedType
        }
      );
    }

    return freezeClone(existing);
  }

  function manualSource() {
    return {
      kind: "manual",
      referenceId: null,
      version: null
    };
  }

  async function logMeal(
    input,
    confirmation
  ) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const timestamp =
        resolveTimestamp(confirmation);
      const consumedAt = resolveConsumedAt(
        input?.consumedAt,
        timestamp
      );
      const operationId =
        normalizeOperationId(confirmation);
      const existing =
        await idempotentResult(
          operationId,
          "meal_entry"
        );

      if (existing) {
        return existing;
      }

      if (input?.plannedMealId) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-006",
          "Planlanan öğün yalnız açık plan tüketimi işlemiyle gerçek kayda bağlanabilir."
        );
      }

      const entryId =
        createIdentifier("meal-entry");
      const built =
        await buildMealSnapshots(
          input,
          {
            timestamp,
            draft: false,
            ownerId: entryId
          }
        );
      const entry = buildMealEntry({
        id: entryId,
        timestamp,
        consumedAt,
        source: manualSource(),
        snapshots: built.snapshots,
        mealType: built.mealType,
        coverage: built.coverage,
        plannedMealId: null,
        captureMode: built.captureMode,
        sourceTemplateId:
          built.templateId,
        clientOperationId: operationId
      });

      await getDependencies().storage.saveRecords(
        [...built.snapshots, entry],
        { mode: "add" }
      );

      return freezeClone(entry);
    });
  }

  async function logHydration(
    input,
    confirmation
  ) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      if (!isPlainObject(input)) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-002",
          "Sıvı kaydı düz bir nesne olmalıdır."
        );
      }

      const timestamp =
        resolveTimestamp(confirmation);
      const consumedAt = resolveConsumedAt(
        input.consumedAt,
        timestamp
      );
      const operationId =
        normalizeOperationId(confirmation);
      const existing =
        await idempotentResult(
          operationId,
          "hydration_entry"
        );

      if (existing) {
        return existing;
      }

      const entry = buildHydrationEntry({
        id: createIdentifier(
          "hydration-entry"
        ),
        timestamp,
        consumedAt,
        source: manualSource(),
        beverageType: normalizeIdentifier(
          input.beverageType,
          "İçecek türü"
        ),
        amount: assertHydrationAmount(
          input.amount
        ),
        captureMode: "quick",
        clientOperationId: operationId
      });

      await getDependencies().storage.saveRecords(
        [entry],
        { mode: "add" }
      );

      return freezeClone(entry);
    });
  }

  function logWater(
    amount,
    confirmation
  ) {
    return logHydration(
      {
        beverageType: "water",
        amount
      },
      confirmation
    );
  }

  async function getEntry(
    recordId,
    options = {}
  ) {
    const id = normalizeIdentifier(
      recordId,
      "Tüketim kayıt kimliği"
    );
    const record = await getDependencies()
      .storage.getRecord(id, {
        includeAiDraft:
          options.includeDraft === true
      });

    if (
      !record ||
      !ENTRY_TYPES.includes(record.type)
    ) {
      return null;
    }

    return freezeClone(record);
  }

  async function listEntries(
    options = {}
  ) {
    const candidateTypes =
      options.types === undefined
        ? ENTRY_TYPES
        : (
            Array.isArray(options.types)
              ? options.types
              : [options.types]
          );

    if (
      candidateTypes.some(
        type => !ENTRY_TYPES.includes(type)
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-002",
        "Tüketim kayıt türü filtresi geçersiz."
      );
    }

    const records = await getDependencies()
      .storage.queryRecords({
        types: candidateTypes,
        includeAiDrafts:
          options.includeDrafts === true,
        eventFrom:
          options.eventFrom || null,
        eventTo:
          options.eventTo || null,
        sortDirection:
          options.sortDirection || "desc",
        limit:
          options.limit === undefined
            ? 100
            : options.limit,
        offset:
          options.offset || 0
      });

    return freezeClone(records);
  }

  async function getSnapshot() {
    const records = await getDependencies()
      .storage.queryRecords({
        types: ENTRY_TYPES,
        includeAiDrafts: true,
        limit: 5000,
        sortDirection: "desc"
      });
    const active = records.filter(record =>
      record.recordStatus === "active" &&
      record.source.kind !== "ai_draft"
    );
    const drafts = records.filter(record =>
      record.recordStatus === "draft" &&
      record.source.kind === "ai_draft"
    );

    return freezeClone({
      counts: {
        meals: active.filter(
          record =>
            record.type === "meal_entry"
        ).length,
        hydration: active.filter(
          record =>
            record.type ===
              "hydration_entry"
        ).length,
        drafts: drafts.length
      },
      lastEntry:
        active[0] || null
    });
  }

  async function sourceEntry(recordId) {
    const record = await getDependencies()
      .storage.getRecord(
        normalizeIdentifier(
          recordId,
          "Kaynak tüketim kayıt kimliği"
        ),
        { includeAiDraft: true }
      );

    if (
      !record ||
      !ENTRY_TYPES.includes(record.type)
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-004",
        "Kaynak tüketim kaydı bulunamadı.",
        { recordId }
      );
    }

    return record;
  }

  async function repeatEntry(
    recordId,
    overrides = {},
    confirmation
  ) {
    assertUserConfirmation(confirmation);

    return serializeWrite(async () => {
      const source = await sourceEntry(recordId);

      if (
        source.source.kind === "ai_draft" ||
        source.recordStatus !== "active"
      ) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-004",
          "Yalnız etkin gerçek tüketim kaydı tekrarlanabilir."
        );
      }

      const timestamp =
        resolveTimestamp(confirmation);
      const consumedAt = resolveConsumedAt(
        overrides.consumedAt,
        timestamp
      );
      const operationId =
        normalizeOperationId(confirmation);
      const existing =
        await idempotentResult(
          operationId,
          source.type
        );

      if (existing) {
        return existing;
      }

      if (source.type === "hydration_entry") {
        const entry = buildHydrationEntry({
          id: createIdentifier(
            "hydration-entry"
          ),
          timestamp,
          consumedAt,
          source: manualSource(),
          beverageType: normalizeIdentifier(
            overrides.beverageType ||
              source.payload.beverageType,
            "İçecek türü"
          ),
          amount: assertHydrationAmount(
            overrides.amount ||
              source.payload.amount
          ),
          captureMode: "repeat",
          sourceEntryId: source.id,
          clientOperationId: operationId
        });

        await getDependencies().storage.saveRecords(
          [entry],
          { mode: "add" }
        );
        return freezeClone(entry);
      }

      const sourceSnapshots =
        await readSnapshots(
          source.payload.itemSnapshotIds
        );
      const entryId =
        createIdentifier("meal-entry");
      const snapshots = sourceSnapshots.map(
        snapshot => cloneSnapshot(
          snapshot,
          {
            timestamp,
            captureMode: "repeat",
            sourceEntryId: source.id,
            ownerId: entryId
          }
        )
      );
      const entry = buildMealEntry({
        id: entryId,
        timestamp,
        consumedAt,
        source: manualSource(),
        snapshots,
        mealType: normalizeMealType(
          overrides.mealType ||
            source.payload.mealType
        ),
        coverage: normalizeCoverage(
          overrides.coverage ||
            source.payload.coverage,
          snapshots.length
        ),
        plannedMealId: null,
        captureMode: "repeat",
        sourceEntryId: source.id,
        clientOperationId: operationId
      });

      await getDependencies().storage.saveRecords(
        [...snapshots, entry],
        { mode: "add" }
      );

      return freezeClone(entry);
    });
  }

  async function logPlannedMeal(
    plannedMealId,
    overrides = {},
    confirmation
  ) {
    assertUserConfirmation(confirmation);

    if (
      confirmation?.confirmPlanConsumption !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-006",
        "Planlanan öğünün gerçek tüketim olarak bağlanması ayrıca açıkça onaylanmalıdır."
      );
    }

    return serializeWrite(async () => {
      const { storage } = getDependencies();
      const planId = normalizeIdentifier(
        plannedMealId,
        "Planlanan öğün kimliği"
      );
      const plan = await storage.getRecord(
        planId,
        { includeAiDraft: true }
      );

      if (
        !plan ||
        plan.type !== "planned_meal" ||
        plan.recordStatus !== "active" ||
        plan.source.kind === "ai_draft" ||
        plan.payload.status !== "planned" ||
        plan.payload.mealEntryId !== null
      ) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-006",
          "Yalnız etkin ve henüz bağlanmamış planlanan öğün tüketilebilir.",
          { plannedMealId: planId }
        );
      }

      const timestamp =
        resolveTimestamp(confirmation);

      if (
        Date.parse(timestamp) <
        Date.parse(plan.updatedAt)
      ) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-002",
          "Plan tüketim işlemi planın son güncellemesinden önce olamaz."
        );
      }

      const consumedAt = resolveConsumedAt(
        overrides.consumedAt,
        timestamp
      );
      const operationId =
        normalizeOperationId(confirmation);
      const existing =
        await idempotentResult(
          operationId,
          "meal_entry"
        );

      if (existing) {
        return existing;
      }

      const sourceSnapshots =
        await readSnapshots(
          plan.payload.itemSnapshotIds
        );
      const entryId =
        createIdentifier("meal-entry");
      const snapshots = sourceSnapshots.map(
        snapshot => cloneSnapshot(
          snapshot,
          {
            timestamp,
            captureMode: "planned",
            sourceEntryId: null,
            ownerId: entryId
          }
        )
      );
      const entry = buildMealEntry({
        id: entryId,
        timestamp,
        consumedAt,
        source: manualSource(),
        snapshots,
        mealType: normalizeMealType(
          plan.payload.mealType
        ),
        coverage: normalizeCoverage(
          overrides.coverage,
          snapshots.length
        ),
        plannedMealId: plan.id,
        captureMode: "planned",
        clientOperationId: operationId
      });
      const linkedPlan = buildRecord({
        ...clone(plan),
        updatedAt: timestamp,
        userEdited: true,
        payload: {
          ...clone(plan.payload),
          status: "linked",
          mealEntryId: entry.id
        }
      });

      await storage.saveRecords(
        [
          ...snapshots,
          entry,
          linkedPlan
        ],
        {
          expectedUpdatedAtById: {
            [plan.id]: plan.updatedAt
          }
        }
      );

      return freezeClone(entry);
    });
  }

  function aiRequestMeta(
    source,
    timestamp
  ) {
    return {
      requestedAt: timestamp,
      referenceId: source.referenceId,
      version: source.version,
      userRequested: true,
      userDataUseApproved: true
    };
  }

  async function saveMealDraft(
    input,
    consent
  ) {
    assertAiRequest(consent);

    return serializeWrite(async () => {
      const timestamp =
        resolveTimestamp(consent);
      const consumedAt = resolveConsumedAt(
        input?.consumedAt,
        timestamp
      );
      const source = aiSource(input, consent);
      const operationId =
        normalizeOperationId(consent);
      const existing =
        await idempotentResult(
          operationId,
          "meal_entry"
        );

      if (existing) {
        return existing;
      }

      const entryId =
        createIdentifier("meal-draft");
      const built =
        await buildMealSnapshots(
          input,
          {
            timestamp,
            draft: true,
            ownerId: entryId,
            aiSource: source
          }
        );
      const entry = buildMealEntry({
        id: entryId,
        timestamp,
        consumedAt,
        source,
        snapshots: built.snapshots,
        mealType: built.mealType,
        coverage: built.coverage,
        plannedMealId: null,
        captureMode: "ai_draft",
        sourceTemplateId:
          built.templateId,
        clientOperationId: operationId,
        aiRequest:
          aiRequestMeta(source, timestamp)
      });

      await getDependencies().storage.saveRecords(
        [...built.snapshots, entry],
        { mode: "add" }
      );

      return freezeClone(entry);
    });
  }

  async function saveHydrationDraft(
    input,
    consent
  ) {
    assertAiRequest(consent);

    return serializeWrite(async () => {
      if (!isPlainObject(input)) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-002",
          "Sıvı taslağı düz bir nesne olmalıdır."
        );
      }

      const timestamp =
        resolveTimestamp(consent);
      const consumedAt = resolveConsumedAt(
        input.consumedAt,
        timestamp
      );
      const source = aiSource(input, consent);
      const operationId =
        normalizeOperationId(consent);
      const existing =
        await idempotentResult(
          operationId,
          "hydration_entry"
        );

      if (existing) {
        return existing;
      }

      const entry = buildHydrationEntry({
        id: createIdentifier(
          "hydration-draft"
        ),
        timestamp,
        consumedAt,
        source,
        beverageType: normalizeIdentifier(
          input.beverageType,
          "İçecek türü"
        ),
        amount: assertHydrationAmount(
          input.amount,
          { allowUnknown: true }
        ),
        captureMode: "ai_draft",
        clientOperationId: operationId,
        aiRequest:
          aiRequestMeta(source, timestamp)
      });

      await getDependencies().storage.saveRecords(
        [entry],
        { mode: "add" }
      );

      return freezeClone(entry);
    });
  }

  async function listDrafts(
    options = {}
  ) {
    const records = await listEntries({
      ...options,
      includeDrafts: true
    });

    return freezeClone(
      records.filter(record =>
        record.source.kind === "ai_draft" &&
        record.recordStatus === "draft"
      )
    );
  }

  async function acceptedDraftRecord(
    draftId
  ) {
    const records = await getDependencies()
      .storage.queryRecords({
        types: ENTRY_TYPES,
        includeAiDrafts: false,
        limit: 5000,
        sortDirection: "asc"
      });

    return records.find(record =>
      record.extensions?.[
        APPROVAL_EXTENSION_KEY
      ]?.draftId === draftId
    ) || null;
  }

  async function acceptDraft(
    draftId,
    overrides = {},
    confirmation
  ) {
    assertUserConfirmation(confirmation);

    if (confirmation?.acceptDraft !== true) {
      throw createError(
        "TODAY-NUTRITION-ENTRY-007",
        "AI tüketim taslağı ayrıca açıkça kabul edilmelidir."
      );
    }

    return serializeWrite(async () => {
      const draft = await sourceEntry(draftId);

      if (
        draft.source.kind !== "ai_draft" ||
        draft.recordStatus !== "draft" ||
        draft.verificationStatus !== "unverified"
      ) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-007",
          "Yalnız doğrulanmamış AI tüketim taslağı kabul edilebilir."
        );
      }

      const accepted =
        await acceptedDraftRecord(draft.id);

      if (accepted) {
        throw createError(
          "TODAY-NUTRITION-ENTRY-008",
          "Bu AI tüketim taslağı daha önce kabul edilmiş.",
          {
            draftId: draft.id,
            acceptedRecordId: accepted.id
          }
        );
      }

      const timestamp =
        resolveTimestamp(confirmation);
      const useDraftTime =
        overrides.useDraftConsumedAt === true;
      const consumedAt = resolveConsumedAt(
        overrides.consumedAt ||
          (useDraftTime
            ? draft.payload.consumedAt
            : null),
        timestamp
      );
      const operationId =
        normalizeOperationId(confirmation);
      const existing =
        await idempotentResult(
          operationId,
          draft.type
        );

      if (existing) {
        return existing;
      }

      const approval = {
        draftId: draft.id,
        acceptedAt: timestamp,
        userInitiated: true,
        userConfirmed: true
      };

      if (draft.type === "hydration_entry") {
        const entry = buildHydrationEntry({
          id: createIdentifier(
            "hydration-entry"
          ),
          timestamp,
          consumedAt,
          source: manualSource(),
          beverageType: normalizeIdentifier(
            overrides.beverageType ||
              draft.payload.beverageType,
            "İçecek türü"
          ),
          amount: assertHydrationAmount(
            overrides.amount ||
              draft.payload.amount
          ),
          captureMode:
            "draft_acceptance",
          derivedFromDraftId:
            draft.id,
          clientOperationId:
            operationId,
          approval
        });

        await getDependencies().storage.saveRecords(
          [entry],
          { mode: "add" }
        );
        return freezeClone(entry);
      }

      const draftSnapshots =
        await readSnapshots(
          draft.payload.itemSnapshotIds,
          { allowDraft: true }
        );
      const entryId =
        createIdentifier("meal-entry");
      const snapshots = draftSnapshots.map(
        snapshot => cloneSnapshot(
          snapshot,
          {
            timestamp,
            captureMode:
              "draft_acceptance",
            sourceEntryId: draft.id,
            allowDraft: true,
            ownerId: entryId
          }
        )
      );
      const entry = buildMealEntry({
        id: entryId,
        timestamp,
        consumedAt,
        source: manualSource(),
        snapshots,
        mealType: normalizeMealType(
          overrides.mealType ||
            draft.payload.mealType
        ),
        coverage: normalizeCoverage(
          overrides.coverage ||
            draft.payload.coverage,
          snapshots.length
        ),
        plannedMealId: null,
        captureMode: "draft_acceptance",
        derivedFromDraftId:
          draft.id,
        clientOperationId: operationId,
        approval
      });

      await getDependencies().storage.saveRecords(
        [...snapshots, entry],
        { mode: "add" }
      );

      return freezeClone(entry);
    });
  }

  window.TodayNutritionEntry =
    Object.freeze({
      ENTRY_API_VERSION,
      ENTRY_RULESET_ID,
      ENTRY_EXTENSION_KEY,
      SNAPSHOT_EXTENSION_KEY,
      AI_REQUEST_EXTENSION_KEY,
      APPROVAL_EXTENSION_KEY,
      ENTRY_TYPES,
      MEAL_TYPES,
      COVERAGE_CODES,
      COMMON_BEVERAGE_TYPES,
      getSnapshot,
      getEntry,
      listEntries,
      logMeal,
      logHydration,
      logWater,
      repeatEntry,
      logPlannedMeal,
      saveMealDraft,
      saveHydrationDraft,
      listDrafts,
      acceptDraft
    });
})();
