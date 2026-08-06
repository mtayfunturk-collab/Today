/**
 * Today App v2
 * Schema & Migration Orchestrator
 * TB-016 — Platform Architecture
 *
 * Amaç:
 * - Şema geçişlerini sıralı ve doğrulanabilir adımlarla yürütmek
 * - Eski Today kayıtlarını mevcut v2 verisini ezmeden içe aktarmak
 * - Her kalıcı değişiklikten önce tek güvenlik yedeği oluşturmak
 * - Başarısız geçişte ana veriyi yedekten geri almak
 * - Eski localStorage anahtarlarını hiçbir zaman silmemek
 */

(function () {
  "use strict";

  const ORCHESTRATOR_VERSION = 1;
  const DATE_KEY_PATTERN =
    /^\d{4}-\d{2}-\d{2}$/;

  const KNOWN_LEGACY_KEYS =
    Object.freeze([
      "today_app_v10",
      "today_data_v10",
      "today_data_v2",
      "today_data_v1",
      "today_data",
      "today_store",
      "today_store_v1",
      "todaySelections",
      "today_entries",
      "todayAppData",
      "today_app_data"
    ]);

  const SUPPORTED_THEMES =
    Object.freeze([
      "system",
      "light",
      "dark",
      "contrast"
    ]);

  let runPhase = "idle";
  let lastResult = null;

  function isObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
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

    if (
      typeof window.structuredClone ===
      "function"
    ) {
      return window.structuredClone(value);
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(value) {
    if (
      !value ||
      typeof value !== "string"
    ) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function isDateKey(value) {
    return (
      typeof value === "string" &&
      DATE_KEY_PATTERN.test(value)
    );
  }

  function isDateMap(value) {
    return (
      isObject(value) &&
      Object.keys(value).some(isDateKey)
    );
  }

  function hasOwn(value, key) {
    return (
      isObject(value) &&
      Object.prototype.hasOwnProperty.call(
        value,
        key
      )
    );
  }

  function dispatch(name, detail) {
    if (
      typeof window.dispatchEvent !==
        "function" ||
      typeof window.CustomEvent !==
        "function"
    ) {
      return;
    }

    window.dispatchEvent(
      new window.CustomEvent(name, {
        detail
      })
    );
  }

  function freezeResult(result) {
    return Object.freeze({
      ...result,
      appliedSteps: Object.freeze([
        ...(result.appliedSteps || [])
      ]),
      sourceKeys: Object.freeze([
        ...(result.sourceKeys || [])
      ])
    });
  }

  function normalizeChoice(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    const text = String(value).trim();

    if (
      ["A", "B", "C"].includes(text)
    ) {
      return text;
    }

    const normalized =
      text.toLocaleLowerCase("tr-TR");

    if (
      normalized.includes("adı yok") ||
      normalized.includes("bir şey oldu")
    ) {
      return "A";
    }

    if (
      normalized.includes("çok net") ||
      normalized === "net" ||
      normalized === "netti"
    ) {
      return "B";
    }

    if (
      normalized.includes("zordu") ||
      normalized.includes("zor")
    ) {
      return "C";
    }

    return "";
  }

  function normalizeColor(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    const text = String(value)
      .trim()
      .toLocaleLowerCase("tr-TR");

    const colors = {
      k: "deep",
      black: "deep",
      siyah: "deep",
      deep: "deep",
      derin: "deep",

      b: "blue",
      blue: "blue",
      mavi: "blue",

      r: "red",
      red: "red",
      kırmızı: "red",
      kirmizi: "red",

      g: "green",
      green: "green",
      yeşil: "green",
      yesil: "green",

      y: "yellow",
      yellow: "yellow",
      sarı: "yellow",
      sari: "yellow",

      navy: "navy",
      lacivert: "navy",

      orange: "orange",
      turuncu: "orange"
    };

    return colors[text] || "";
  }

  function normalizeTimestamp(
    value,
    fallback
  ) {
    if (!value) {
      return fallback;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? fallback
      : date.toISOString();
  }

  function normalizeChangeLog(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(entry => {
        if (!entry) {
          return null;
        }

        if (
          typeof entry === "string"
        ) {
          return {
            timestamp: nowIso(),
            type: "legacy",
            description: entry
          };
        }

        if (!isObject(entry)) {
          return null;
        }

        return {
          timestamp: normalizeTimestamp(
            entry.timestamp ||
              entry.time ||
              entry.t ||
              entry.createdAt,
            nowIso()
          ),
          type:
            entry.type ||
            entry.action ||
            entry.a ||
            entry.what ||
            "legacy",
          description:
            entry.description ||
            entry.message ||
            entry.what ||
            entry.a ||
            ""
        };
      })
      .filter(Boolean);
  }

  function normalizeDay(
    dateKey,
    legacyValue,
    legacyLog
  ) {
    const fallbackTimestamp =
      `${dateKey}T12:00:00.000Z`;

    if (
      typeof legacyValue === "string"
    ) {
      return {
        choice:
          normalizeChoice(legacyValue),
        color: "",
        note: "",
        createdAt: fallbackTimestamp,
        updatedAt: fallbackTimestamp,
        changeCount: 0,
        changeLog: []
      };
    }

    if (!isObject(legacyValue)) {
      return null;
    }

    const rawChoice =
      legacyValue.choice ??
      legacyValue.selection ??
      legacyValue.selected ??
      legacyValue.sel ??
      legacyValue.pick ??
      legacyValue.value ??
      "";

    const rawColor =
      legacyValue.color ??
      legacyValue.colour ??
      legacyValue.col ??
      legacyValue.colorCode ??
      "";

    const rawNote =
      legacyValue.note ??
      legacyValue.notes ??
      legacyValue.text ??
      legacyValue.comment ??
      "";

    const createdAt =
      normalizeTimestamp(
        legacyValue.createdAt ||
          legacyValue.created ||
          legacyValue.firstCreatedAt,
        fallbackTimestamp
      );

    const updatedAt =
      normalizeTimestamp(
        legacyValue.updatedAt ||
          legacyValue.updated ||
          legacyValue.lastUpdated ||
          legacyValue.timestamp,
        createdAt
      );

    const logSource =
      legacyValue.changeLog ||
      legacyValue.changes ||
      legacyValue.log ||
      legacyValue.history ||
      legacyLog?.changes ||
      [];

    const changeLog =
      normalizeChangeLog(logSource);

    const rawCount =
      legacyValue.changeCount ??
      legacyValue.edits ??
      legacyValue.editCount ??
      changeLog.length;

    const changeCount =
      Number.isFinite(Number(rawCount))
        ? Math.max(
            0,
            Number(rawCount),
            changeLog.length
          )
        : changeLog.length;

    return {
      choice:
        normalizeChoice(rawChoice),
      color:
        normalizeColor(rawColor),
      note:
        typeof rawNote === "string"
          ? rawNote
          : String(rawNote || ""),
      createdAt,
      updatedAt,
      changeCount,
      changeLog
    };
  }

  function extractLegacyPayload(value) {
    if (!value) {
      return null;
    }

    if (Array.isArray(value)) {
      const dayMap = {};

      value.forEach(entry => {
        if (!isObject(entry)) {
          return;
        }

        const dateKey =
          entry.date ||
          entry.dateKey ||
          entry.day ||
          entry.createdDate;

        if (isDateKey(dateKey)) {
          dayMap[dateKey] = entry;
        }
      });

      return Object.keys(dayMap).length
        ? {
            dayMap,
            logs: {},
            theme: null
          }
        : null;
    }

    if (!isObject(value)) {
      return null;
    }

    const candidates = [
      value.days,
      value.entries,
      value.selections,
      value
    ];

    const dayMap =
      candidates.find(isDateMap);

    if (!dayMap) {
      return null;
    }

    return {
      dayMap,
      logs:
        isObject(value.logs)
          ? value.logs
          : {},
      theme:
        SUPPORTED_THEMES.includes(
          value.theme
        )
          ? value.theme
          : null
    };
  }

  function readLegacySources() {
    const storage =
      window.localStorage;
    const protectedKeys = new Set([
      window.TodayStorage?.STORAGE_KEY,
      window.TodayStorage?.BACKUP_KEY
    ]);
    const sources = [];

    KNOWN_LEGACY_KEYS.forEach(key => {
      if (
        !key ||
        protectedKeys.has(key)
      ) {
        return;
      }

      const parsed = safeParse(
        storage.getItem(key)
      );
      const payload =
        extractLegacyPayload(parsed);

      if (!payload) {
        return;
      }

      sources.push({
        key,
        ...payload,
        dayCount:
          Object.keys(
            payload.dayMap
          ).filter(isDateKey).length
      });
    });

    return sources;
  }

  function inspectLegacySources() {
    return Object.freeze(
      readLegacySources().map(source =>
        Object.freeze({
          key: source.key,
          dayCount: source.dayCount,
          hasTheme:
            source.theme !== null
        })
      )
    );
  }

  function mergeLogs(
    migratedLog,
    currentLog
  ) {
    const combined = [
      ...(
        Array.isArray(migratedLog)
          ? migratedLog
          : []
      ),
      ...(
        Array.isArray(currentLog)
          ? currentLog
          : []
      )
    ];

    return combined
      .filter(
        (entry, index, array) => {
          const signature =
            JSON.stringify(entry);

          return (
            array.findIndex(
              candidate =>
                JSON.stringify(
                  candidate
                ) === signature
            ) === index
          );
        }
      )
      .sort((entryA, entryB) =>
        String(
          entryA?.timestamp || ""
        ).localeCompare(
          String(
            entryB?.timestamp || ""
          )
        )
      );
  }

  function mergeDayRecords(
    currentDay,
    migratedDay
  ) {
    if (!isObject(currentDay)) {
      return clone(migratedDay);
    }

    if (!isObject(migratedDay)) {
      return clone(currentDay);
    }

    const mergedLog = mergeLogs(
      migratedDay.changeLog,
      currentDay.changeLog
    );

    const pick = key =>
      hasOwn(currentDay, key)
        ? currentDay[key]
        : migratedDay[key];

    return {
      ...clone(migratedDay),
      ...clone(currentDay),
      choice: pick("choice") ?? "",
      color: pick("color") ?? "",
      note: pick("note") ?? "",
      createdAt:
        pick("createdAt") ||
        nowIso(),
      updatedAt:
        pick("updatedAt") ||
        nowIso(),
      changeCount: Math.max(
        Number(
          currentDay.changeCount || 0
        ),
        Number(
          migratedDay.changeCount || 0
        ),
        mergedLog.length
      ),
      changeLog: mergedLog
    };
  }

  function normalizeStoreShell(
    value,
    schemaVersion
  ) {
    const timestamp = nowIso();
    const store =
      isObject(value)
        ? clone(value)
        : {};

    return {
      ...store,
      schemaVersion,
      appVersion:
        typeof store.appVersion ===
        "string"
          ? store.appVersion
          : "0.0.0",
      createdAt:
        typeof store.createdAt ===
        "string"
          ? store.createdAt
          : timestamp,
      updatedAt:
        typeof store.updatedAt ===
        "string"
          ? store.updatedAt
          : timestamp,
      metadata:
        isObject(store.metadata)
          ? store.metadata
          : {},
      settings:
        isObject(store.settings)
          ? store.settings
          : {
              theme: "system"
            },
      days:
        isObject(store.days)
          ? store.days
          : {},
      usage:
        isObject(store.usage)
          ? store.usage
          : {},
      migration:
        isObject(store.migration)
          ? store.migration
          : {
              completed: false,
              sourceKeys: [],
              migratedAt: null
            }
    };
  }

  function migrateSchema0To1(value) {
    return normalizeStoreShell(
      value,
      1
    );
  }

  function migrateSchema1To2(value) {
    const store =
      normalizeStoreShell(
        value,
        2
      );
    const normalizedDays = {};

    Object.entries(
      store.days
    ).forEach(([dateKey, day]) => {
      if (
        !isDateKey(dateKey) ||
        !isObject(day)
      ) {
        normalizedDays[dateKey] =
          clone(day);
        return;
      }

      const normalized =
        normalizeDay(
          dateKey,
          day,
          null
        );

      normalizedDays[dateKey] = {
        ...clone(day),
        ...normalized
      };
    });

    store.days = normalizedDays;

    return store;
  }

  const SCHEMA_STEPS =
    Object.freeze([
      Object.freeze({
        id: "schema-0-to-1",
        from: 0,
        to: 1,
        apply: migrateSchema0To1
      }),
      Object.freeze({
        id: "schema-1-to-2",
        from: 1,
        to: 2,
        apply: migrateSchema1To2
      })
    ]);

  function getStepDefinitions() {
    return Object.freeze(
      SCHEMA_STEPS.map(step =>
        Object.freeze({
          id: step.id,
          from: step.from,
          to: step.to
        })
      )
    );
  }

  function validateDependencies() {
    const missingDependencies = [];
    const storage =
      window.TodayStorage;
    const version =
      window.TodayVersion;

    [
      "loadStore",
      "saveStore",
      "createBackup",
      "restoreBackup"
    ].forEach(method => {
      if (
        !storage ||
        typeof storage[method] !==
          "function"
      ) {
        missingDependencies.push(
          `TodayStorage.${method}`
        );
      }
    });

    [
      "inspectStore",
      "stampStore"
    ].forEach(method => {
      if (
        !version ||
        typeof version[method] !==
          "function"
      ) {
        missingDependencies.push(
          `TodayVersion.${method}`
        );
      }
    });

    const storageSchema =
      Number(storage?.SCHEMA_VERSION);
    const versionSchema =
      Number(version?.SCHEMA_VERSION);
    const storageAppVersion =
      storage?.APP_VERSION;
    const versionAppVersion =
      version?.APP_VERSION;
    const highestStep =
      SCHEMA_STEPS.at(-1)?.to;

    if (
      Number.isFinite(storageSchema) &&
      Number.isFinite(versionSchema) &&
      storageSchema !== versionSchema
    ) {
      missingDependencies.push(
        "schema-version-alignment"
      );
    }

    if (
      typeof storageAppVersion ===
        "string" &&
      typeof versionAppVersion ===
        "string" &&
      storageAppVersion !==
        versionAppVersion
    ) {
      missingDependencies.push(
        "app-version-alignment"
      );
    }

    if (
      Number.isFinite(versionSchema) &&
      highestStep !== versionSchema
    ) {
      missingDependencies.push(
        "migration-step-alignment"
      );
    }

    return Object.freeze({
      valid:
        missingDependencies.length === 0,
      missingDependencies:
        Object.freeze(
          missingDependencies
        ),
      storageSchemaVersion:
        Number.isFinite(storageSchema)
          ? storageSchema
          : null,
      targetSchemaVersion:
        Number.isFinite(versionSchema)
          ? versionSchema
          : null,
      appVersion:
        typeof versionAppVersion ===
        "string"
          ? versionAppVersion
          : null
    });
  }

  function buildPlan(store) {
    const dependencies =
      validateDependencies();

    if (!dependencies.valid) {
      return freezeResult({
        success: false,
        required: false,
        blocked: true,
        errorCode:
          "TODAY-MIGRATION-001",
        phase: "dependencies",
        currentSchemaVersion: null,
        targetSchemaVersion:
          dependencies.targetSchemaVersion
      });
    }

    const inspection =
      window.TodayVersion.inspectStore(
        store
      );

    if (!inspection.valid) {
      return freezeResult({
        success: false,
        required: false,
        blocked: true,
        errorCode:
          "TODAY-MIGRATION-002",
        phase: "inspection",
        currentSchemaVersion: null,
        targetSchemaVersion:
          dependencies.targetSchemaVersion
      });
    }

    const currentSchemaVersion =
      Number(
        inspection.currentSchemaVersion
      );
    const targetSchemaVersion =
      Number(
        inspection.targetSchemaVersion
      );

    if (
      !Number.isInteger(
        currentSchemaVersion
      ) ||
      currentSchemaVersion < 0
    ) {
      return freezeResult({
        success: false,
        required: false,
        blocked: true,
        errorCode:
          "TODAY-MIGRATION-002",
        phase: "inspection",
        currentSchemaVersion: null,
        targetSchemaVersion
      });
    }

    if (
      currentSchemaVersion >
      targetSchemaVersion
    ) {
      return freezeResult({
        success: false,
        required: false,
        blocked: true,
        errorCode:
          "TODAY-MIGRATION-003",
        phase: "future-schema",
        currentSchemaVersion,
        targetSchemaVersion
      });
    }

    const steps = [];
    let cursor =
      currentSchemaVersion;

    while (
      cursor <
      targetSchemaVersion
    ) {
      const step =
        SCHEMA_STEPS.find(
          candidate =>
            candidate.from === cursor
        );

      if (
        !step ||
        step.to <= cursor
      ) {
        return freezeResult({
          success: false,
          required: false,
          blocked: true,
          errorCode:
            "TODAY-MIGRATION-002",
          phase: "plan",
          currentSchemaVersion,
          targetSchemaVersion,
          appliedSteps:
            steps.map(item => item.id)
        });
      }

      steps.push(step);
      cursor = step.to;
    }

    const legacyImportRequired =
      store.migration?.completed !==
      true;

    return freezeResult({
      success: true,
      required:
        steps.length > 0 ||
        legacyImportRequired,
      blocked: false,
      errorCode: null,
      phase: "planned",
      currentSchemaVersion,
      targetSchemaVersion,
      legacyImportRequired,
      appliedSteps:
        steps.map(step => step.id)
    });
  }

  function inspect() {
    try {
      const store =
        window.TodayStorage?.loadStore?.();

      if (!store) {
        return buildPlan(null);
      }

      const plan = buildPlan(store);
      const legacySources =
        plan.success &&
        plan.legacyImportRequired
          ? inspectLegacySources()
          : [];

      return freezeResult({
        ...plan,
        sourceKeys:
          legacySources.map(
            source => source.key
          ),
        legacyDayCount:
          legacySources.reduce(
            (total, source) =>
              total +
              source.dayCount,
            0
          )
      });
    } catch (error) {
      return freezeResult({
        success: false,
        required: false,
        blocked: true,
        errorCode:
          "TODAY-MIGRATION-002",
        phase: "inspection",
        currentSchemaVersion: null,
        targetSchemaVersion:
          Number(
            window.TodayVersion
              ?.SCHEMA_VERSION
          ) || null
      });
    }
  }

  function applySchemaSteps(
    store,
    plan
  ) {
    let workingStore = clone(store);
    const appliedSteps = [];

    plan.appliedSteps.forEach(
      stepId => {
        const step =
          SCHEMA_STEPS.find(
            candidate =>
              candidate.id === stepId
          );

        if (!step) {
          const error =
            new Error(
              "Migration adımı bulunamadı."
            );
          error.todayCode =
            "TODAY-MIGRATION-002";
          throw error;
        }

        workingStore =
          step.apply(workingStore);

        if (
          Number(
            workingStore.schemaVersion
          ) !== step.to
        ) {
          const error =
            new Error(
              "Migration adımı hedef şemayı üretmedi."
            );
          error.todayCode =
            "TODAY-MIGRATION-005";
          throw error;
        }

        appliedSteps.push(step.id);
      }
    );

    return {
      store: workingStore,
      appliedSteps
    };
  }

  function importLegacyData(store) {
    const workingStore =
      normalizeStoreShell(
        store,
        Number(
          store.schemaVersion
        )
      );
    const sources =
      readLegacySources();
    const changedDates =
      new Set();
    let legacyTheme = null;

    sources.forEach(source => {
      if (
        !legacyTheme &&
        source.theme
      ) {
        legacyTheme =
          source.theme;
      }

      Object.entries(
        source.dayMap
      ).forEach(
        ([dateKey, legacyDay]) => {
          if (!isDateKey(dateKey)) {
            return;
          }

          const migratedDay =
            normalizeDay(
              dateKey,
              legacyDay,
              source.logs[dateKey]
            );

          if (!migratedDay) {
            return;
          }

          const currentDay =
            workingStore.days[
              dateKey
            ];
          const mergedDay =
            mergeDayRecords(
              currentDay,
              migratedDay
            );

          if (
            JSON.stringify(
              currentDay
            ) !==
            JSON.stringify(
              mergedDay
            )
          ) {
            changedDates.add(
              dateKey
            );
          }

          workingStore.days[
            dateKey
          ] = mergedDay;
        }
      );
    });

    if (
      legacyTheme &&
      (
        !SUPPORTED_THEMES.includes(
          workingStore.settings.theme
        ) ||
        (
          workingStore.settings
            .theme === "system" &&
          Object.keys(
            workingStore.days
          ).length ===
            changedDates.size
        )
      )
    ) {
      workingStore.settings.theme =
        legacyTheme;
    }

    return {
      store: workingStore,
      sourceKeys:
        sources.map(
          source => source.key
        ),
      migratedDayCount:
        changedDates.size
    };
  }

  function validateTargetStore(store) {
    const target =
      Number(
        window.TodayVersion
          ?.SCHEMA_VERSION
      );

    return Boolean(
      isObject(store) &&
      Number(store.schemaVersion) ===
        target &&
      isObject(store.days) &&
      isObject(store.settings) &&
      isObject(store.usage) &&
      isObject(store.migration) &&
      store.migration.completed ===
        true
    );
  }

  function createFailure(
    errorCode,
    phase,
    plan,
    options = {}
  ) {
    const result = freezeResult({
      success: false,
      migrated: false,
      skipped: false,
      blocked:
        options.blocked === true,
      rolledBack:
        options.rolledBack === true,
      errorCode,
      phase,
      currentSchemaVersion:
        plan?.currentSchemaVersion ??
        null,
      targetSchemaVersion:
        (
          plan?.targetSchemaVersion ??
          Number(
            window.TodayVersion
              ?.SCHEMA_VERSION
          )
        ) ||
        null,
      migratedDayCount: 0,
      appliedSteps:
        options.appliedSteps || [],
      sourceKeys:
        options.sourceKeys || []
    });

    lastResult = result;
    runPhase = "failed";

    dispatch(
      "today:migrationerror",
      {
        errorCode,
        phase,
        currentSchemaVersion:
          result.currentSchemaVersion,
        targetSchemaVersion:
          result.targetSchemaVersion,
        rolledBack:
          result.rolledBack
      }
    );

    return result;
  }

  function run() {
    if (runPhase === "running") {
      return createFailure(
        "TODAY-MIGRATION-006",
        "running",
        null,
        {
          blocked: true
        }
      );
    }

    runPhase = "running";

    let store;
    let plan;

    try {
      store =
        window.TodayStorage.loadStore();
      plan = buildPlan(store);
    } catch (error) {
      return createFailure(
        "TODAY-MIGRATION-002",
        "inspection",
        null,
        {
          blocked: true
        }
      );
    }

    if (!plan.success) {
      return createFailure(
        plan.errorCode,
        plan.phase,
        plan,
        {
          blocked: true
        }
      );
    }

    if (!plan.required) {
      const result = freezeResult({
        success: true,
        migrated: false,
        skipped: true,
        blocked: false,
        rolledBack: false,
        errorCode: null,
        phase: "ready",
        currentSchemaVersion:
          plan.currentSchemaVersion,
        targetSchemaVersion:
          plan.targetSchemaVersion,
        migratedDayCount: 0
      });

      lastResult = result;
      runPhase = "ready";

      dispatch(
        "today:migrationready",
        {
          migrated: false,
          skipped: true,
          schemaVersion:
            plan.targetSchemaVersion
        }
      );

      return result;
    }

    let backupCreated = false;
    let rolledBack = false;
    let appliedSteps = [];
    let sourceKeys = [];

    try {
      const schemaResult =
        applySchemaSteps(
          store,
          plan
        );
      let workingStore =
        schemaResult.store;

      appliedSteps =
        schemaResult.appliedSteps;

      let migratedDayCount = 0;

      sourceKeys =
        Array.isArray(
          workingStore.migration
            ?.sourceKeys
        )
          ? [
              ...workingStore
                .migration
                .sourceKeys
            ]
          : [];

      migratedDayCount =
        Number(
          workingStore.migration
            ?.migratedDayCount
        ) || 0;

      if (
        plan.legacyImportRequired
      ) {
        const legacyResult =
          importLegacyData(
            workingStore
          );

        workingStore =
          legacyResult.store;
        sourceKeys =
          legacyResult.sourceKeys;
        migratedDayCount =
          legacyResult
            .migratedDayCount;
      }

      const migrationTimestamp =
        nowIso();

      workingStore.migration = {
        ...(
          isObject(
            workingStore.migration
          )
            ? workingStore.migration
            : {}
        ),
        completed: true,
        orchestratorVersion:
          ORCHESTRATOR_VERSION,
        sourceKeys: [
          ...new Set(sourceKeys)
        ],
        migratedAt:
          migrationTimestamp,
        migratedDayCount,
        fromSchemaVersion:
          plan.currentSchemaVersion,
        toSchemaVersion:
          plan.targetSchemaVersion,
        appliedSteps: [
          ...appliedSteps
        ]
      };

      workingStore =
        window.TodayVersion.stampStore(
          workingStore
        );

      if (
        !validateTargetStore(
          workingStore
        )
      ) {
        const error =
          new Error(
            "Migration sonucu geçersiz."
          );
        error.todayCode =
          "TODAY-MIGRATION-005";
        throw error;
      }

      backupCreated =
        window.TodayStorage
          .createBackup();

      if (!backupCreated) {
        const error =
          new Error(
            "Migration yedeği oluşturulamadı."
          );
        error.todayCode =
          "TODAY-MIGRATION-004";
        throw error;
      }

      window.TodayStorage.saveStore(
        workingStore,
        {
          backup: false
        }
      );

      const persistedStore =
        window.TodayStorage.loadStore();

      if (
        !validateTargetStore(
          persistedStore
        )
      ) {
        const error =
          new Error(
            "Migration kaydı doğrulanamadı."
          );
        error.todayCode =
          "TODAY-MIGRATION-005";
        throw error;
      }

      const result = freezeResult({
        success: true,
        migrated: true,
        skipped: false,
        blocked: false,
        rolledBack: false,
        errorCode: null,
        phase: "ready",
        currentSchemaVersion:
          plan.currentSchemaVersion,
        targetSchemaVersion:
          plan.targetSchemaVersion,
        migratedDayCount,
        appliedSteps,
        sourceKeys: [
          ...new Set(sourceKeys)
        ]
      });

      lastResult = result;
      runPhase = "ready";

      dispatch(
        "today:migrationready",
        {
          migrated: true,
          skipped: false,
          schemaVersion:
            plan.targetSchemaVersion,
          migratedDayCount,
          appliedSteps: [
            ...appliedSteps
          ]
        }
      );

      return result;
    } catch (error) {
      if (backupCreated) {
        try {
          const restoreResult =
            window.TodayStorage
              .restoreBackup();

          rolledBack =
            restoreResult?.success ===
            true;
        } catch (restoreError) {
          rolledBack = false;
        }
      }

      return createFailure(
        error?.todayCode ||
          "TODAY-MIGRATION-005",
        "commit",
        plan,
        {
          rolledBack,
          appliedSteps,
          sourceKeys
        }
      );
    }
  }

  function getStatus() {
    return Object.freeze({
      orchestratorVersion:
        ORCHESTRATOR_VERSION,
      phase: runPhase,
      lastResult
    });
  }

  window.TodayMigration =
    Object.freeze({
      ORCHESTRATOR_VERSION,
      KNOWN_LEGACY_KEYS,
      getStepDefinitions,
      validateDependencies,
      inspectLegacySources,
      inspect,
      run,
      getStatus
    });

  console.info(
    "Today Schema & Migration Orchestrator hazır."
  );
})();
