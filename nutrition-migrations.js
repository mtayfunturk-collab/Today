/**
 * Today App — Nutrition Migration Orchestrator
 * NUT-002 — Contract-version migration plan for the IndexedDB data layer
 */

(function () {
  "use strict";

  const MIGRATION_API_VERSION = 1;
  const MIGRATION_PLAN_VERSION = 1;

  let phase = "idle";
  let lastResult = null;
  let runPromise = null;

  function createError(
    code,
    message,
    cause = null
  ) {
    const error = new Error(message);
    error.name =
      "TodayNutritionMigrationError";
    error.todayCode = code;

    if (cause) {
      error.cause = cause;
    }

    return error;
  }

  function getDependencies() {
    const contracts =
      window.TodayNutritionContracts;
    const storage =
      window.TodayNutritionStorage;
    const missing = [];

    if (
      !contracts ||
      !Number.isInteger(
        contracts.CONTRACT_VERSION
      ) ||
      typeof contracts.validateRecord !==
        "function"
    ) {
      missing.push(
        "TodayNutritionContracts"
      );
    }

    if (
      !storage ||
      typeof storage.getStatus !==
        "function" ||
      typeof storage.applyMigrationPlan !==
        "function"
    ) {
      missing.push(
        "TodayNutritionStorage"
      );
    }

    if (missing.length > 0) {
      throw createError(
        "TODAY-NUTRITION-MIGRATION-001",
        `Beslenme migration bağımlılıkları eksik: ${
          missing.join(", ")
        }`
      );
    }

    return {
      contracts,
      storage
    };
  }

  function migrateRecordFrom0To1(record) {
    const { contracts } =
      getDependencies();

    /*
     * NUT-002 is the first release that can persist nutrition records. There is
     * no approved legacy nutrition payload to reinterpret. A record can pass
     * this recovery step only when it is already a valid v1 record and the
     * metadata marker alone was left behind.
     */
    const validation =
      contracts.validateRecord(record);

    if (
      !validation.valid ||
      record.schemaVersion !== 1
    ) {
      throw createError(
        "TODAY-NUTRITION-MIGRATION-003",
        "Onaylanmamış eski bir beslenme kaydı otomatik dönüştürülemez."
      );
    }

    return record;
  }

  const MIGRATION_STEPS = Object.freeze([
    Object.freeze({
      id: "nutrition-contract-0-to-1",
      fromVersion: 0,
      toVersion: 1,
      migrateRecord:
        migrateRecordFrom0To1
    })
  ]);

  function freezeResult(result) {
    return Object.freeze({
      ...result,
      appliedSteps: Object.freeze([
        ...(result.appliedSteps || [])
      ])
    });
  }

  async function inspect() {
    const { contracts, storage } =
      getDependencies();
    const status = await storage.getStatus();

    return Object.freeze({
      migrationApiVersion:
        MIGRATION_API_VERSION,
      migrationPlanVersion:
        MIGRATION_PLAN_VERSION,
      currentContractVersion:
        status.storedContractVersion,
      targetContractVersion:
        contracts.CONTRACT_VERSION,
      migrationRequired:
        status.storedContractVersion !==
        contracts.CONTRACT_VERSION,
      supported:
        status.storedContractVersion <=
        contracts.CONTRACT_VERSION,
      recordCount: status.recordCount,
      backupCount: status.backupCount,
      lastMigration: status.lastMigration
    });
  }

  async function executeRun() {
    const { contracts, storage } =
      getDependencies();

    phase = "inspecting";
    const before = await inspect();

    if (!before.supported) {
      throw createError(
        "TODAY-NUTRITION-MIGRATION-002",
        "Beslenme veri şeması bu uygulama sürümünden daha yeni."
      );
    }

    phase = "migrating";
    const storageResult =
      await storage.applyMigrationPlan({
        migrationId:
          `nutrition-plan-${
            MIGRATION_PLAN_VERSION
          }-${
            before.currentContractVersion
          }-to-${
            contracts.CONTRACT_VERSION
          }`,
        targetVersion:
          contracts.CONTRACT_VERSION,
        steps: MIGRATION_STEPS
      });

    phase = "ready";
    lastResult = freezeResult({
      success: true,
      migrated: storageResult.migrated,
      skipped: storageResult.skipped,
      fromVersion:
        storageResult.fromVersion,
      toVersion: storageResult.toVersion,
      appliedSteps:
        storageResult.appliedSteps,
      backupId:
        storageResult.backupId,
      recordCount:
        storageResult.recordCount,
      errorCode: null
    });

    return lastResult;
  }

  function run() {
    if (runPromise) {
      return runPromise;
    }

    runPromise = executeRun()
      .catch(error => {
        phase = "failed";
        lastResult = freezeResult({
          success: false,
          migrated: false,
          skipped: false,
          fromVersion: null,
          toVersion: null,
          appliedSteps: [],
          backupId: null,
          recordCount: null,
          errorCode:
            error?.todayCode ||
            "TODAY-NUTRITION-MIGRATION-004"
        });

        return lastResult;
      })
      .finally(() => {
        runPromise = null;
      });

    return runPromise;
  }

  function getStatus() {
    return Object.freeze({
      phase,
      running: Boolean(runPromise),
      lastResult
    });
  }

  window.TodayNutritionMigration =
    Object.freeze({
      MIGRATION_API_VERSION,
      MIGRATION_PLAN_VERSION,
      MIGRATION_STEPS,
      inspect,
      run,
      getStatus
    });
})();
