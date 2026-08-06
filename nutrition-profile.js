/**
 * Today App — Nutrition Profile Service
 * NUT-004 — Profile, dietary constraints and goal versioning
 *
 * The service is UI- and network-agnostic. It writes only NUT-001 profile,
 * constraint and goal records through the NUT-002 atomic storage boundary.
 */

(function () {
  "use strict";

  const PROFILE_API_VERSION = 1;
  const PROFILE_RULESET_ID =
    "today:nutrition:profile:v1";
  const PROFILE_RECORD_ID =
    "nutrition-profile:main";
  const DEFAULT_TRACKING_MODE = "simple";
  const CONSTRAINT_EXTENSION_KEY =
    "today.nutrition.constraint";
  const APPROVAL_EXTENSION_KEY =
    "today.nutrition.approval";
  const AI_REQUEST_EXTENSION_KEY =
    "today.nutrition.ai-request";

  const TRACKING_MODES = deepFreeze([
    "simple",
    "detailed",
    "professional"
  ]);

  const GOAL_KINDS = deepFreeze([
    "awareness",
    "maintenance",
    "weight_loss",
    "weight_gain",
    "muscle_gain",
    "performance",
    "professional_other"
  ]);

  const CATEGORY_DEFINITIONS = deepFreeze({
    allergy: {
      contractKind: "allergy"
    },
    intolerance: {
      contractKind: "intolerance"
    },
    ethical_preference: {
      contractKind: "preference"
    },
    personal_preference: {
      contractKind: "preference"
    },
    religious: {
      contractKind: "religious"
    },
    medical: {
      contractKind: "medical"
    },
    other: {
      contractKind: "other"
    }
  });

  const CONSTRAINT_CATEGORIES = deepFreeze(
    Object.keys(CATEGORY_DEFINITIONS)
  );

  let writeTail = Promise.resolve();
  let idCounter = 0;

  function createError(
    code,
    message,
    details = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name =
      "TodayNutritionProfileError";
    error.todayCode = code;
    error.details = details;

    if (cause) {
      error.cause = cause;
    }

    return error;
  }

  function clone(value) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== "object"
    ) {
      return value;
    }

    if (
      typeof window.structuredClone ===
      "function"
    ) {
      return window.structuredClone(value);
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

    Object.keys(value).forEach(key => {
      deepFreeze(value[key]);
    });

    return Object.freeze(value);
  }

  function freezeClone(value) {
    return deepFreeze(clone(value));
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

  function getDependencies() {
    const contracts =
      window.TodayNutritionContracts;
    const storage =
      window.TodayNutritionStorage;
    const missing = [];

    [
      "validateRecord",
      "createRecord"
    ].forEach(methodName => {
      if (
        !contracts ||
        typeof contracts[methodName] !==
          "function"
      ) {
        missing.push(
          `TodayNutritionContracts.${methodName}`
        );
      }
    });

    [
      "getRecord",
      "queryRecords",
      "saveRecord",
      "saveRecords"
    ].forEach(methodName => {
      if (
        !storage ||
        typeof storage[methodName] !==
          "function"
      ) {
        missing.push(
          `TodayNutritionStorage.${methodName}`
        );
      }
    });

    if (missing.length > 0) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-001",
        "Beslenme profili bağımlılıkları hazır değil.",
        { missing }
      );
    }

    return { contracts, storage };
  }

  function serializeWrite(operation) {
    const run = writeTail.then(
      operation,
      operation
    );

    writeTail = run.catch(() => undefined);
    return run;
  }

  function assertUserConfirmation(options) {
    if (
      options?.userInitiated !== true ||
      options?.userConfirmed !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-003",
        "Bu beslenme profili değişikliği açık kullanıcı onayı gerektirir."
      );
    }
  }

  function assertAiRequest(options) {
    if (
      options?.userRequested !== true ||
      options?.userDataUseApproved !== true
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-007",
        "AI hedef taslağı açık kullanıcı isteği ve veri kullanım onayı gerektirir."
      );
    }
  }

  function resolveTimestamp(
    options = {},
    minimum = null
  ) {
    const candidate =
      options.at ||
      new Date().toISOString();
    const parsed = Date.parse(candidate);

    if (Number.isNaN(parsed)) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-002",
        "İşlem zamanı geçerli bir tarih-saat olmalıdır."
      );
    }

    const normalized =
      new Date(parsed).toISOString();

    if (
      minimum &&
      Date.parse(normalized) <
        Date.parse(minimum)
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-002",
        "İşlem zamanı mevcut kaydın güncellenme zamanından önce olamaz.",
        {
          minimum,
          received: normalized
        }
      );
    }

    return normalized;
  }

  function createIdentifier(prefix) {
    idCounter += 1;

    let suffix;

    if (
      window.crypto &&
      typeof window.crypto.randomUUID ===
        "function"
    ) {
      suffix = window.crypto.randomUUID();
    } else {
      suffix = [
        Date.now().toString(36),
        idCounter.toString(36),
        Math.random()
          .toString(36)
          .slice(2, 10)
      ].join("-");
    }

    return `${prefix}:${suffix}`;
  }

  function manualSource() {
    return {
      kind: "manual",
      referenceId: null,
      version: null
    };
  }

  function buildRecord(
    type,
    id,
    payload,
    timestamp,
    overrides = {}
  ) {
    const { contracts } = getDependencies();
    const candidate = {
      id,
      type,
      schemaVersion:
        contracts.CONTRACT_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
      eventAt: null,
      source: manualSource(),
      knowledgeStatus: "known",
      recordStatus: "active",
      verificationStatus:
        "user_confirmed",
      calculationVersion: null,
      userEdited: false,
      payload: clone(payload),
      extensions: {},
      ...clone(overrides)
    };

    try {
      return clone(
        contracts.createRecord(candidate)
      );
    } catch (error) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-002",
        "Beslenme profili kaydı sözleşmeye uygun değil.",
        {
          type,
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

  function normalizeTrackingMode(mode) {
    if (!TRACKING_MODES.includes(mode)) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-002",
        "Beslenme kayıt modu geçersiz.",
        { mode }
      );
    }

    return mode;
  }

  function normalizeConstraintInput(input) {
    if (!isPlainObject(input)) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-002",
        "Beslenme kısıtı düz bir nesne olmalıdır."
      );
    }

    const category = input.category;
    const definition =
      CATEGORY_DEFINITIONS[category];

    if (!definition) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-008",
        "Beslenme kısıtı kategorisi geçersiz.",
        { category }
      );
    }

    if (
      typeof input.label !== "string" ||
      !input.label.trim()
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-002",
        "Beslenme kısıtı etiketi boş olamaz."
      );
    }

    return {
      category,
      contractKind:
        definition.contractKind,
      label: input.label.trim()
    };
  }

  function normalizeGoalInput(input) {
    if (!isPlainObject(input)) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-002",
        "Beslenme hedefi düz bir nesne olmalıdır."
      );
    }

    if (!GOAL_KINDS.includes(input.goalKind)) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-009",
        "Beslenme hedef türü geçersiz.",
        { goalKind: input.goalKind }
      );
    }

    if (
      typeof input.effectiveFrom !==
        "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        input.effectiveFrom
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-009",
        "Beslenme hedefi başlangıç tarihi geçersiz."
      );
    }

    const [year, month, day] =
      input.effectiveFrom
        .split("-")
        .map(Number);
    const effectiveDate = new Date(
      Date.UTC(year, month - 1, day)
    );

    if (
      effectiveDate.getUTCFullYear() !== year ||
      effectiveDate.getUTCMonth() !== month - 1 ||
      effectiveDate.getUTCDate() !== day
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-009",
        "Beslenme hedefi başlangıç tarihi geçersiz."
      );
    }

    if (!isPlainObject(input.targets)) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-009",
        "Beslenme hedef ölçümleri düz bir nesne olmalıdır."
      );
    }

    return {
      goalKind: input.goalKind,
      effectiveFrom:
        input.effectiveFrom,
      targets: clone(input.targets)
    };
  }

  function buildConstraintRecord(
    input,
    timestamp
  ) {
    const normalized =
      normalizeConstraintInput(input);

    return buildRecord(
      "dietary_constraint",
      createIdentifier(
        "dietary-constraint"
      ),
      {
        kind: normalized.contractKind,
        label: normalized.label,
        active: true
      },
      timestamp,
      {
        extensions: {
          [CONSTRAINT_EXTENSION_KEY]: {
            category:
              normalized.category
          }
        }
      }
    );
  }

  function buildGoalRecord(
    input,
    timestamp,
    supersedesId,
    overrides = {}
  ) {
    const normalized =
      normalizeGoalInput(input);

    return buildRecord(
      "nutrition_goal_version",
      createIdentifier("nutrition-goal"),
      {
        goalKind: normalized.goalKind,
        effectiveFrom:
          normalized.effectiveFrom,
        supersedesId,
        targets: normalized.targets
      },
      timestamp,
      overrides
    );
  }

  function getConstraintCategory(record) {
    const explicit =
      record.extensions?.[
        CONSTRAINT_EXTENSION_KEY
      ]?.category;

    if (explicit !== undefined) {
      const definition =
        CATEGORY_DEFINITIONS[explicit];

      if (
        !definition ||
        definition.contractKind !==
          record.payload.kind
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-005",
          "Beslenme kısıtı kategori bilgisi kayıt türüyle uyuşmuyor.",
          { recordId: record.id }
        );
      }

      return {
        category: explicit,
        needsClassification: false
      };
    }

    if (record.payload.kind === "preference") {
      return {
        category:
          "preference_unspecified",
        needsClassification: true
      };
    }

    const category =
      CONSTRAINT_CATEGORIES.find(
        candidate =>
          CATEGORY_DEFINITIONS[
            candidate
          ].contractKind ===
            record.payload.kind
      );

    if (!category) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-005",
        "Beslenme kısıtı türü sınıflandırılamadı.",
        { recordId: record.id }
      );
    }

    return {
      category,
      needsClassification: false
    };
  }

  function constraintView(record) {
    const classification =
      getConstraintCategory(record);

    return {
      id: record.id,
      category:
        classification.category,
      needsClassification:
        classification.needsClassification,
      label: record.payload.label,
      active:
        record.payload.active === true &&
        record.recordStatus === "active",
      record: clone(record)
    };
  }

  function normalizedLabel(label) {
    return label
      .trim()
      .toLocaleLowerCase("tr-TR");
  }

  function assertConstraintNotDuplicate(
    constraintViews,
    normalized,
    excludedId = null
  ) {
    const duplicate = constraintViews.find(
      view =>
        view.id !== excludedId &&
        view.category ===
          normalized.category &&
        normalizedLabel(view.label) ===
          normalizedLabel(
            normalized.label
          )
    );

    if (duplicate) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-004",
        "Aynı etkin beslenme kısıtı zaten kayıtlı.",
        {
          existingId: duplicate.id,
          category:
            normalized.category
        }
      );
    }
  }

  function compareRecords(a, b) {
    return (
      a.createdAt.localeCompare(
        b.createdAt
      ) ||
      a.id.localeCompare(b.id)
    );
  }

  async function readDomainState(
    options = {}
  ) {
    const { storage } = getDependencies();
    const records = await storage.queryRecords({
      types: [
        "nutrition_profile",
        "dietary_constraint",
        "nutrition_goal_version"
      ],
      includeAiDrafts: true,
      limit: 5000
    });
    const profiles = records.filter(
      record =>
        record.type ===
          "nutrition_profile"
    );
    const constraints = records.filter(
      record =>
        record.type ===
          "dietary_constraint"
    );
    const goals = records.filter(
      record =>
        record.type ===
          "nutrition_goal_version"
    );
    const activeProfiles = profiles.filter(
      record =>
        record.recordStatus === "active" &&
        record.source.kind !== "ai_draft"
    );

    if (activeProfiles.length > 1) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-005",
        "Birden fazla etkin beslenme profili bulundu."
      );
    }

    const profile =
      activeProfiles[0] || null;

    if (
      options.requireProfile === true &&
      !profile
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-006",
        "Etkin beslenme profili bulunamadı."
      );
    }

    if (!profile) {
      const unmanagedUserRecords = [
        ...profiles,
        ...constraints,
        ...goals
      ].filter(record =>
        record.source.kind !== "ai_draft"
      );

      if (unmanagedUserRecords.length > 0) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-005",
          "Etkin profil olmadan kullanıcıya ait beslenme profil kayıtları bulundu.",
          {
            recordIds:
              unmanagedUserRecords.map(
                record => record.id
              )
          }
        );
      }

      return {
        profile: null,
        profiles,
        constraints,
        goals,
        activeConstraints: [],
        constraintHistory:
          constraints
            .filter(record =>
              record.source.kind !==
                "ai_draft"
            )
            .sort(compareRecords),
        primaryGoal: null,
        goalHistory: []
      };
    }

    if (
      profile.verificationStatus !==
        "user_confirmed" ||
      profile.source.kind === "ai_draft"
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-005",
        "Etkin beslenme profili kullanıcı onaylı değil.",
        { recordId: profile.id }
      );
    }

    const nonAiConstraints =
      constraints.filter(record =>
        record.source.kind !== "ai_draft"
      );
    const activeConstraints =
      nonAiConstraints.filter(record =>
        record.recordStatus === "active" ||
        record.payload.active === true
      );

    activeConstraints.forEach(record => {
      if (
        record.recordStatus !== "active" ||
        record.payload.active !== true ||
        record.verificationStatus !==
          "user_confirmed"
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-005",
          "Etkin beslenme kısıtı durumu tutarsız.",
          { recordId: record.id }
        );
      }
    });

    const referencedConstraintIds =
      new Set(
        profile.payload
          .dietaryConstraintIds
      );
    const activeConstraintIds =
      new Set(
        activeConstraints.map(
          record => record.id
        )
      );

    if (
      referencedConstraintIds.size !==
        activeConstraintIds.size ||
      [...referencedConstraintIds].some(
        id => !activeConstraintIds.has(id)
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-005",
        "Profil ile etkin beslenme kısıtları aynı kümeyi göstermiyor."
      );
    }

    const nonAiGoals = goals.filter(
      record =>
        record.source.kind !== "ai_draft"
    );
    const activeGoals = nonAiGoals.filter(
      record =>
        record.recordStatus === "active"
    );

    if (activeGoals.length > 1) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-005",
        "Birden fazla etkin ana beslenme hedefi bulundu."
      );
    }

    const primaryGoalId =
      profile.payload
        .primaryGoalVersionId;
    const primaryGoal =
      primaryGoalId === null
        ? null
        : nonAiGoals.find(
            record =>
              record.id ===
                primaryGoalId
          ) || null;

    if (
      (
        primaryGoal === null &&
        activeGoals.length !== 0
      ) ||
      (
        primaryGoal !== null &&
        (
          activeGoals.length !== 1 ||
          activeGoals[0].id !==
            primaryGoal.id ||
          primaryGoal.recordStatus !==
            "active" ||
          primaryGoal.verificationStatus !==
            "user_confirmed"
        )
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-005",
        "Profil ana hedefi etkin hedef kaydıyla uyuşmuyor."
      );
    }

    const goalsById = new Map(
      nonAiGoals.map(record => [
        record.id,
        record
      ])
    );
    const goalHistory = [];
    const visited = new Set();
    let cursor = primaryGoal;

    while (cursor) {
      if (visited.has(cursor.id)) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-005",
          "Beslenme hedef geçmişinde döngü bulundu.",
          { recordId: cursor.id }
        );
      }

      visited.add(cursor.id);
      goalHistory.push(cursor);

      const previousId =
        cursor.payload.supersedesId;

      if (previousId === null) {
        break;
      }

      const previous =
        goalsById.get(previousId);

      if (!previous) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-005",
          "Beslenme hedef geçmişinin önceki sürümü bulunamadı.",
          { recordId: cursor.id }
        );
      }

      if (
        previous.recordStatus !==
          "superseded" ||
        cursor.payload.effectiveFrom <
          previous.payload.effectiveFrom
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-005",
          "Beslenme hedef geçmişi durum veya tarih bakımından tutarsız.",
          { recordId: previous.id }
        );
      }

      cursor = previous;
    }

    const unreachableHistory =
      nonAiGoals.filter(record =>
        [
          "active",
          "superseded"
        ].includes(record.recordStatus) &&
        !visited.has(record.id)
      );

    if (unreachableHistory.length > 0) {
      throw createError(
        "TODAY-NUTRITION-PROFILE-005",
        "Beslenme hedef geçmişinde ana zincire bağlı olmayan sürüm bulundu.",
        {
          recordIds:
            unreachableHistory.map(
              record => record.id
            )
        }
      );
    }

    return {
      profile,
      profiles,
      constraints,
      goals,
      activeConstraints:
        profile.payload
          .dietaryConstraintIds
          .map(id =>
            activeConstraints.find(
              record => record.id === id
            )
          ),
      constraintHistory:
        nonAiConstraints.sort(
          compareRecords
        ),
      primaryGoal,
      goalHistory
    };
  }

  function publicSnapshot(state) {
    return freezeClone({
      profile: state.profile,
      trackingMode:
        state.profile?.payload
          .trackingMode || null,
      activeConstraints:
        state.activeConstraints.map(
          constraintView
        ),
      constraintHistory:
        state.constraintHistory.map(
          constraintView
        ),
      primaryGoal: state.primaryGoal,
      goalHistory: state.goalHistory
    });
  }

  async function getSnapshot() {
    const state = await readDomainState();
    return publicSnapshot(state);
  }

  function expectedVersions(records) {
    const versions = {};

    records.forEach(record => {
      if (record) {
        versions[record.id] =
          record.updatedAt;
      }
    });

    return versions;
  }

  function updatedProfile(
    profile,
    payload,
    timestamp
  ) {
    return buildRecord(
      "nutrition_profile",
      profile.id,
      payload,
      profile.createdAt,
      {
        updatedAt: timestamp,
        source: manualSource(),
        userEdited: true,
        extensions:
          clone(profile.extensions || {})
      }
    );
  }

  function archivedConstraint(
    constraint,
    timestamp
  ) {
    return buildRecord(
      "dietary_constraint",
      constraint.id,
      {
        ...clone(constraint.payload),
        active: false
      },
      constraint.createdAt,
      {
        updatedAt: timestamp,
        source:
          clone(constraint.source),
        recordStatus: "archived",
        verificationStatus:
          constraint.verificationStatus,
        userEdited: true,
        extensions:
          clone(
            constraint.extensions || {}
          )
      }
    );
  }

  function supersededGoal(goal, timestamp) {
    return buildRecord(
      "nutrition_goal_version",
      goal.id,
      clone(goal.payload),
      goal.createdAt,
      {
        updatedAt: timestamp,
        source: clone(goal.source),
        recordStatus: "superseded",
        verificationStatus:
          goal.verificationStatus,
        userEdited: goal.userEdited,
        extensions:
          clone(goal.extensions || {})
      }
    );
  }

  function stableValue(value) {
    if (
      value === null ||
      typeof value !== "object"
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(stableValue);
    }

    const output = {};

    Object.keys(value)
      .sort()
      .forEach(key => {
        output[key] =
          stableValue(value[key]);
      });

    return output;
  }

  function goalMatches(goal, normalized) {
    return Boolean(
      goal &&
      goal.payload.goalKind ===
        normalized.goalKind &&
      goal.payload.effectiveFrom ===
        normalized.effectiveFrom &&
      JSON.stringify(
        stableValue(goal.payload.targets)
      ) ===
        JSON.stringify(
          stableValue(normalized.targets)
        )
    );
  }

  async function createProfile(
    input = {},
    options = {}
  ) {
    return serializeWrite(async () => {
      assertUserConfirmation(options);
      const { storage } = getDependencies();

      if (!isPlainObject(input)) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-002",
          "Beslenme profili girdisi düz bir nesne olmalıdır."
        );
      }

      const existing =
        await readDomainState();
      const existingUserProfiles =
        existing.profiles.filter(
          record =>
            record.source.kind !==
              "ai_draft"
        );

      if (
        existingUserProfiles.length > 0
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-004",
          "Beslenme profili zaten mevcut."
        );
      }

      const timestamp =
        resolveTimestamp(options);
      const trackingMode =
        normalizeTrackingMode(
          input.trackingMode ===
            undefined
            ? DEFAULT_TRACKING_MODE
            : input.trackingMode
        );
      const constraintInputs =
        input.constraints === undefined
          ? []
          : input.constraints;

      if (!Array.isArray(constraintInputs)) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-002",
          "İlk beslenme kısıtları bir liste olmalıdır."
        );
      }

      const normalizedConstraints =
        constraintInputs.map(
          normalizeConstraintInput
        );

      normalizedConstraints.forEach(
        (constraint, index) => {
          assertConstraintNotDuplicate(
            normalizedConstraints
              .slice(0, index)
              .map((entry, entryIndex) => ({
                id: String(entryIndex),
                category: entry.category,
                label: entry.label
              })),
            constraint
          );
        }
      );

      const constraints =
        constraintInputs.map(inputItem =>
          buildConstraintRecord(
            inputItem,
            timestamp
          )
        );
      const primaryGoal =
        input.primaryGoal === undefined ||
        input.primaryGoal === null
          ? null
          : buildGoalRecord(
              input.primaryGoal,
              timestamp,
              null
            );
      const profile = buildRecord(
        "nutrition_profile",
        PROFILE_RECORD_ID,
        {
          trackingMode,
          dietaryConstraintIds:
            constraints.map(
              record => record.id
            ),
          primaryGoalVersionId:
            primaryGoal?.id || null
        },
        timestamp
      );
      const records = [
        ...constraints,
        ...(primaryGoal
          ? [primaryGoal]
          : []),
        profile
      ];

      await storage.saveRecords(records, {
        mode: "add"
      });

      return publicSnapshot(
        await readDomainState({
          requireProfile: true
        })
      );
    });
  }

  async function setTrackingMode(
    mode,
    options = {}
  ) {
    return serializeWrite(async () => {
      assertUserConfirmation(options);
      const { storage } = getDependencies();
      const normalizedMode =
        normalizeTrackingMode(mode);
      const state = await readDomainState({
        requireProfile: true
      });

      if (
        state.profile.payload
          .trackingMode ===
        normalizedMode
      ) {
        return publicSnapshot(state);
      }

      const timestamp = resolveTimestamp(
        options,
        state.profile.updatedAt
      );
      const profile = updatedProfile(
        state.profile,
        {
          ...clone(state.profile.payload),
          trackingMode: normalizedMode
        },
        timestamp
      );

      await storage.saveRecord(profile, {
        expectedUpdatedAtById:
          expectedVersions([
            state.profile
          ])
      });

      return publicSnapshot(
        await readDomainState({
          requireProfile: true
        })
      );
    });
  }

  async function addConstraint(
    input,
    options = {}
  ) {
    return serializeWrite(async () => {
      assertUserConfirmation(options);
      const { storage } = getDependencies();
      const state = await readDomainState({
        requireProfile: true
      });
      const normalized =
        normalizeConstraintInput(input);
      const activeViews =
        state.activeConstraints.map(
          constraintView
        );

      assertConstraintNotDuplicate(
        activeViews,
        normalized
      );

      const timestamp = resolveTimestamp(
        options,
        state.profile.updatedAt
      );
      const constraint =
        buildConstraintRecord(
          normalized,
          timestamp
        );
      const profile = updatedProfile(
        state.profile,
        {
          ...clone(state.profile.payload),
          dietaryConstraintIds: [
            ...state.profile.payload
              .dietaryConstraintIds,
            constraint.id
          ]
        },
        timestamp
      );

      await storage.saveRecords(
        [constraint, profile],
        {
          mode: "upsert",
          expectedUpdatedAtById:
            expectedVersions([
              state.profile
            ])
        }
      );

      return publicSnapshot(
        await readDomainState({
          requireProfile: true
        })
      );
    });
  }

  async function replaceConstraint(
    constraintId,
    input,
    options = {}
  ) {
    return serializeWrite(async () => {
      assertUserConfirmation(options);
      const { storage } = getDependencies();
      const state = await readDomainState({
        requireProfile: true
      });
      const current =
        state.activeConstraints.find(
          record =>
            record.id === constraintId
        );

      if (!current) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-006",
          "Etkin beslenme kısıtı bulunamadı.",
          { constraintId }
        );
      }

      const normalized =
        normalizeConstraintInput(input);
      const activeViews =
        state.activeConstraints.map(
          constraintView
        );

      assertConstraintNotDuplicate(
        activeViews,
        normalized,
        current.id
      );

      const currentView =
        constraintView(current);

      if (
        currentView.category ===
          normalized.category &&
        currentView.label ===
          normalized.label
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-004",
          "Beslenme kısıtında sürümlenecek bir değişiklik yok."
        );
      }

      const timestamp = resolveTimestamp(
        options,
        [
          state.profile.updatedAt,
          current.updatedAt
        ].sort().at(-1)
      );
      const replacement =
        buildConstraintRecord(
          normalized,
          timestamp
        );
      const archived =
        archivedConstraint(
          current,
          timestamp
        );
      const profile = updatedProfile(
        state.profile,
        {
          ...clone(state.profile.payload),
          dietaryConstraintIds:
            state.profile.payload
              .dietaryConstraintIds
              .map(id =>
                id === current.id
                  ? replacement.id
                  : id
              )
        },
        timestamp
      );

      await storage.saveRecords(
        [archived, replacement, profile],
        {
          mode: "upsert",
          expectedUpdatedAtById:
            expectedVersions([
              state.profile,
              current
            ])
        }
      );

      return publicSnapshot(
        await readDomainState({
          requireProfile: true
        })
      );
    });
  }

  async function deactivateConstraint(
    constraintId,
    options = {}
  ) {
    return serializeWrite(async () => {
      assertUserConfirmation(options);
      const { storage } = getDependencies();
      const state = await readDomainState({
        requireProfile: true
      });
      const current =
        state.activeConstraints.find(
          record =>
            record.id === constraintId
        );

      if (!current) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-006",
          "Etkin beslenme kısıtı bulunamadı.",
          { constraintId }
        );
      }

      const timestamp = resolveTimestamp(
        options,
        [
          state.profile.updatedAt,
          current.updatedAt
        ].sort().at(-1)
      );
      const archived =
        archivedConstraint(
          current,
          timestamp
        );
      const profile = updatedProfile(
        state.profile,
        {
          ...clone(state.profile.payload),
          dietaryConstraintIds:
            state.profile.payload
              .dietaryConstraintIds
              .filter(id =>
                id !== current.id
              )
        },
        timestamp
      );

      await storage.saveRecords(
        [archived, profile],
        {
          mode: "upsert",
          expectedUpdatedAtById:
            expectedVersions([
              state.profile,
              current
            ])
        }
      );

      return publicSnapshot(
        await readDomainState({
          requireProfile: true
        })
      );
    });
  }

  async function createGoalVersion(
    input,
    options = {}
  ) {
    return serializeWrite(async () => {
      assertUserConfirmation(options);
      const { storage } = getDependencies();
      const normalized =
        normalizeGoalInput(input);
      const state = await readDomainState({
        requireProfile: true
      });

      if (
        state.primaryGoal &&
        normalized.effectiveFrom <
          state.primaryGoal.payload
            .effectiveFrom
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-009",
          "Yeni hedef sürümü mevcut hedefin başlangıcından önce olamaz."
        );
      }

      if (
        goalMatches(
          state.primaryGoal,
          normalized
        )
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-004",
          "Beslenme hedefinde sürümlenecek bir değişiklik yok."
        );
      }

      const minimum = [
        state.profile.updatedAt,
        state.primaryGoal?.updatedAt
      ]
        .filter(Boolean)
        .sort()
        .at(-1);
      const timestamp = resolveTimestamp(
        options,
        minimum
      );
      const goal = buildGoalRecord(
        normalized,
        timestamp,
        state.primaryGoal?.id || null
      );
      const previous = state.primaryGoal
        ? supersededGoal(
            state.primaryGoal,
            timestamp
          )
        : null;
      const profile = updatedProfile(
        state.profile,
        {
          ...clone(state.profile.payload),
          primaryGoalVersionId: goal.id
        },
        timestamp
      );
      const candidates = [
        ...(previous ? [previous] : []),
        goal,
        profile
      ];

      await storage.saveRecords(
        candidates,
        {
          mode: "upsert",
          expectedUpdatedAtById:
            expectedVersions([
              state.profile,
              state.primaryGoal
            ])
        }
      );

      return publicSnapshot(
        await readDomainState({
          requireProfile: true
        })
      );
    });
  }

  async function saveGoalDraft(
    input,
    options = {}
  ) {
    return serializeWrite(async () => {
      assertAiRequest(options);
      const { storage } = getDependencies();
      const state = await readDomainState({
        requireProfile: true
      });
      const normalized =
        normalizeGoalInput(input);
      const aiSource = input.aiSource;

      if (
        !isPlainObject(aiSource) ||
        typeof aiSource.referenceId !==
          "string" ||
        !aiSource.referenceId.trim() ||
        typeof aiSource.version !==
          "string" ||
        !aiSource.version.trim()
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-007",
          "AI hedef taslağı sürümlü kaynak kimliği taşımalıdır."
        );
      }

      if (
        state.primaryGoal &&
        normalized.effectiveFrom <
          state.primaryGoal.payload
            .effectiveFrom
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-009",
          "AI hedef taslağı mevcut hedefin başlangıcından önce olamaz."
        );
      }

      const timestamp =
        resolveTimestamp(
          options,
          [
            state.profile.updatedAt,
            state.primaryGoal?.updatedAt
          ]
            .filter(Boolean)
            .sort()
            .at(-1)
        );
      const draft = buildGoalRecord(
        normalized,
        timestamp,
        state.primaryGoal?.id || null,
        {
          source: {
            kind: "ai_draft",
            referenceId:
              aiSource.referenceId.trim(),
            version:
              aiSource.version.trim()
          },
          knowledgeStatus: "estimated",
          recordStatus: "draft",
          verificationStatus:
            "unverified",
          userEdited: false,
          extensions: {
            [AI_REQUEST_EXTENSION_KEY]: {
              userRequested: true,
              dataUseApproved: true,
              requestedAt: timestamp
            }
          }
        }
      );

      await storage.saveRecord(draft, {
        mode: "add"
      });

      return freezeClone(draft);
    });
  }

  function approvedGoalByDraftId(
    goals,
    draftId
  ) {
    return goals.find(record =>
      record.source.kind !== "ai_draft" &&
      record.extensions?.[
        APPROVAL_EXTENSION_KEY
      ]?.sourceDraftId === draftId
    ) || null;
  }

  async function listGoalDrafts(
    options = {}
  ) {
    const state = await readDomainState();
    const includeAccepted =
      options.includeAccepted === true;
    const drafts = state.goals
      .filter(record =>
        record.source.kind ===
          "ai_draft" &&
        record.recordStatus === "draft"
      )
      .sort(compareRecords)
      .map(record => {
        const acceptedGoal =
          approvedGoalByDraftId(
            state.goals,
            record.id
          );

        return {
          record,
          accepted:
            Boolean(acceptedGoal),
          acceptedGoalId:
            acceptedGoal?.id || null
        };
      })
      .filter(item =>
        includeAccepted ||
        !item.accepted
      );

    return freezeClone(drafts);
  }

  async function acceptGoalDraft(
    draftId,
    options = {}
  ) {
    return serializeWrite(async () => {
      assertUserConfirmation(options);
      const { storage } = getDependencies();
      const state = await readDomainState({
        requireProfile: true
      });
      const draft = await storage.getRecord(
        draftId,
        { includeAiDraft: true }
      );

      if (
        !draft ||
        draft.type !==
          "nutrition_goal_version" ||
        draft.source.kind !== "ai_draft" ||
        draft.recordStatus !== "draft" ||
        draft.verificationStatus !==
          "unverified"
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-006",
          "Onaylanabilir AI hedef taslağı bulunamadı.",
          { draftId }
        );
      }

      if (
        approvedGoalByDraftId(
          state.goals,
          draft.id
        )
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-004",
          "AI hedef taslağı daha önce kullanıcı kaydına dönüştürülmüş.",
          { draftId }
        );
      }

      const currentGoalId =
        state.primaryGoal?.id || null;

      if (
        draft.payload.supersedesId !==
          currentGoalId
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-010",
          "AI hedef taslağı güncel ana hedef sürümüne dayanmıyor.",
          {
            draftBase:
              draft.payload.supersedesId,
            currentGoalId
          }
        );
      }

      if (
        state.primaryGoal &&
        draft.payload.effectiveFrom <
          state.primaryGoal.payload
            .effectiveFrom
      ) {
        throw createError(
          "TODAY-NUTRITION-PROFILE-009",
          "AI hedef taslağının başlangıcı güncel hedeften önce olamaz."
        );
      }

      const minimum = [
        state.profile.updatedAt,
        state.primaryGoal?.updatedAt,
        draft.updatedAt
      ]
        .filter(Boolean)
        .sort()
        .at(-1);
      const timestamp = resolveTimestamp(
        options,
        minimum
      );
      const goal = buildGoalRecord(
        {
          goalKind:
            draft.payload.goalKind,
          effectiveFrom:
            draft.payload.effectiveFrom,
          targets:
            clone(draft.payload.targets)
        },
        timestamp,
        currentGoalId,
        {
          extensions: {
            [APPROVAL_EXTENSION_KEY]: {
              sourceDraftId: draft.id,
              confirmedAt: timestamp
            }
          }
        }
      );
      const previous = state.primaryGoal
        ? supersededGoal(
            state.primaryGoal,
            timestamp
          )
        : null;
      const profile = updatedProfile(
        state.profile,
        {
          ...clone(state.profile.payload),
          primaryGoalVersionId: goal.id
        },
        timestamp
      );

      await storage.saveRecords(
        [
          ...(previous ? [previous] : []),
          goal,
          profile,
          draft
        ],
        {
          mode: "upsert",
          expectedUpdatedAtById:
            expectedVersions([
              state.profile,
              state.primaryGoal,
              draft
            ])
        }
      );

      return publicSnapshot(
        await readDomainState({
          requireProfile: true
        })
      );
    });
  }

  window.TodayNutritionProfile =
    Object.freeze({
      PROFILE_API_VERSION,
      PROFILE_RULESET_ID,
      PROFILE_RECORD_ID,
      DEFAULT_TRACKING_MODE,
      TRACKING_MODES,
      CONSTRAINT_CATEGORIES,
      GOAL_KINDS,
      getSnapshot,
      createProfile,
      setTrackingMode,
      addConstraint,
      replaceConstraint,
      deactivateConstraint,
      createGoalVersion,
      saveGoalDraft,
      listGoalDrafts,
      acceptGoalDraft
    });
})();
