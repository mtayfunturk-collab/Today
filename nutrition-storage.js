/**
 * Today App — Nutrition Storage
 * NUT-002 — IndexedDB offline data layer and migration boundary
 *
 * This module owns nutrition persistence only. Existing Today Core data stays
 * in TodayStorage/localStorage until a separately approved migration exists.
 */

(function () {
  "use strict";

  const STORAGE_API_VERSION = 1;
  const DATABASE_NAME = "today_nutrition";
  const DATABASE_VERSION = 1;
  const DATA_SCHEMA_VERSION = 1;

  const STORE_NAMES = Object.freeze({
    records: "records",
    metadata: "metadata",
    backups: "migration_backups"
  });

  const INDEX_NAMES = Object.freeze({
    type: "by_type",
    recordStatus: "by_record_status",
    sourceKind: "by_source_kind",
    updatedAt: "by_updated_at",
    eventAt: "by_event_at",
    typeAndStatus: "by_type_and_status",
    typeAndEventAt: "by_type_and_event_at",
    schemaVersion: "by_schema_version",
    backupCreatedAt: "by_created_at",
    backupStatus: "by_status"
  });

  const DATABASE_STATE_KEY = "database_state";
  const SNAPSHOT_SCHEMA_ID =
    "today:nutrition:storage-snapshot:v1";
  const MAX_QUERY_LIMIT = 5000;

  const PLANNED_TYPES = Object.freeze([
    "meal_plan",
    "planned_meal"
  ]);

  const CONSUMED_TYPES = Object.freeze([
    "meal_entry",
    "hydration_entry"
  ]);

  let openPromise = null;
  let currentDatabase = null;
  let writeTail = Promise.resolve();

  function createError(
    code,
    message,
    details = null,
    cause = null
  ) {
    const error = new Error(message);
    error.name = "TodayNutritionStorageError";
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

  function nowIso() {
    return new Date().toISOString();
  }

  function hasOwn(value, key) {
    return Boolean(
      value &&
      typeof value === "object" &&
      Object.prototype.hasOwnProperty.call(
        value,
        key
      )
    );
  }

  function getContracts() {
    const contracts =
      window.TodayNutritionContracts;

    const missing = [
      "validateRecord",
      "validateRecordSet",
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
        "TODAY-NUTRITION-STORAGE-001",
        "Beslenme veri sözleşmesi hazır değil.",
        { missing }
      );
    }

    return contracts;
  }

  function getIndexedDb() {
    if (
      !window.indexedDB ||
      typeof window.indexedDB.open !==
        "function"
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-002",
        "Bu ortam IndexedDB depolamasını desteklemiyor."
      );
    }

    return window.indexedDB;
  }

  function requestAsPromise(
    request,
    errorCode =
      "TODAY-NUTRITION-STORAGE-008"
  ) {
    return new Promise(
      (resolve, reject) => {
        request.onsuccess = () =>
          resolve(request.result);
        request.onerror = () =>
          reject(
            createError(
              errorCode,
              "IndexedDB isteği tamamlanamadı.",
              null,
              request.error
            )
          );
      }
    );
  }

  function transactionAsPromise(transaction) {
    return new Promise(
      (resolve, reject) => {
        transaction.oncomplete = () =>
          resolve();
        transaction.onabort = () =>
          reject(
            createError(
              "TODAY-NUTRITION-STORAGE-008",
              "IndexedDB işlemi geri alındı.",
              null,
              transaction.error
            )
          );
        transaction.onerror = () => {
          // The abort event is the authoritative transaction failure signal.
        };
      }
    );
  }

  async function withTransaction(
    database,
    storeNames,
    mode,
    worker
  ) {
    const transaction =
      database.transaction(
        storeNames,
        mode
      );
    const completion =
      transactionAsPromise(transaction);

    try {
      const result =
        await worker(transaction);
      await completion;
      return result;
    } catch (error) {
      try {
        transaction.abort();
      } catch (abortError) {
        // A completed or already aborted transaction cannot be aborted again.
      }

      try {
        await completion;
      } catch (transactionError) {
        // Preserve the more specific application error when one exists.
      }

      if (error?.todayCode) {
        throw error;
      }

      throw createError(
        "TODAY-NUTRITION-STORAGE-008",
        "Beslenme verisi işlemi tamamlanamadı.",
        null,
        error
      );
    }
  }

  function serializeWrite(worker) {
    const task =
      writeTail.then(worker, worker);

    writeTail = task.catch(() => undefined);
    return task;
  }

  function ensureIndex(
    objectStore,
    name,
    keyPath,
    options = {}
  ) {
    if (!objectStore.indexNames.contains(name)) {
      objectStore.createIndex(
        name,
        keyPath,
        options
      );
    }
  }

  function createPhysicalSchema(
    database,
    transaction,
    oldVersion
  ) {
    let recordStore;

    if (
      !database.objectStoreNames.contains(
        STORE_NAMES.records
      )
    ) {
      recordStore =
        database.createObjectStore(
          STORE_NAMES.records,
          { keyPath: "id" }
        );
    } else {
      recordStore =
        transaction.objectStore(
          STORE_NAMES.records
        );
    }

    ensureIndex(
      recordStore,
      INDEX_NAMES.type,
      "type"
    );
    ensureIndex(
      recordStore,
      INDEX_NAMES.recordStatus,
      "recordStatus"
    );
    ensureIndex(
      recordStore,
      INDEX_NAMES.sourceKind,
      "source.kind"
    );
    ensureIndex(
      recordStore,
      INDEX_NAMES.updatedAt,
      "updatedAt"
    );
    ensureIndex(
      recordStore,
      INDEX_NAMES.eventAt,
      "eventAt"
    );
    ensureIndex(
      recordStore,
      INDEX_NAMES.typeAndStatus,
      ["type", "recordStatus"]
    );
    ensureIndex(
      recordStore,
      INDEX_NAMES.typeAndEventAt,
      ["type", "eventAt"]
    );
    ensureIndex(
      recordStore,
      INDEX_NAMES.schemaVersion,
      "schemaVersion"
    );

    let metadataStore;

    if (
      !database.objectStoreNames.contains(
        STORE_NAMES.metadata
      )
    ) {
      metadataStore =
        database.createObjectStore(
          STORE_NAMES.metadata,
          { keyPath: "key" }
        );
    } else {
      metadataStore =
        transaction.objectStore(
          STORE_NAMES.metadata
        );
    }

    let backupStore;

    if (
      !database.objectStoreNames.contains(
        STORE_NAMES.backups
      )
    ) {
      backupStore =
        database.createObjectStore(
          STORE_NAMES.backups,
          { keyPath: "id" }
        );
    } else {
      backupStore =
        transaction.objectStore(
          STORE_NAMES.backups
        );
    }

    ensureIndex(
      backupStore,
      INDEX_NAMES.backupCreatedAt,
      "createdAt"
    );
    ensureIndex(
      backupStore,
      INDEX_NAMES.backupStatus,
      "status"
    );

    if (oldVersion === 0) {
      const timestamp = nowIso();
      const contracts = getContracts();

      metadataStore.put({
        key: DATABASE_STATE_KEY,
        storageSchemaVersion:
          DATA_SCHEMA_VERSION,
        contractVersion:
          contracts.CONTRACT_VERSION,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastMigration: null
      });
    }
  }

  function openDatabase() {
    if (openPromise) {
      return openPromise;
    }

    getContracts();
    const indexedDb = getIndexedDb();

    openPromise = new Promise(
      (resolve, reject) => {
        const request = indexedDb.open(
          DATABASE_NAME,
          DATABASE_VERSION
        );
        let settled = false;

        request.onupgradeneeded = event => {
          try {
            createPhysicalSchema(
              request.result,
              request.transaction,
              event.oldVersion
            );
          } catch (error) {
            try {
              request.transaction.abort();
            } catch (abortError) {
              // The request error below reports the failed upgrade.
            }

            if (!settled) {
              settled = true;
              reject(
                error?.todayCode
                  ? error
                  : createError(
                      "TODAY-NUTRITION-STORAGE-004",
                      "Beslenme veritabanı şeması oluşturulamadı.",
                      null,
                      error
                    )
              );
            }
          }
        };

        request.onblocked = () => {
          if (settled) {
            return;
          }

          settled = true;
          reject(
            createError(
              "TODAY-NUTRITION-STORAGE-003",
              "Beslenme veritabanı güncellemesi başka bir sekme tarafından engellendi."
            )
          );
        };

        request.onerror = () => {
          if (settled) {
            return;
          }

          settled = true;
          reject(
            createError(
              "TODAY-NUTRITION-STORAGE-004",
              "Beslenme veritabanı açılamadı.",
              null,
              request.error
            )
          );
        };

        request.onsuccess = () => {
          const database = request.result;

          database.onversionchange = () => {
            database.close();

            if (currentDatabase === database) {
              currentDatabase = null;
              openPromise = null;
            }
          };

          if (settled) {
            database.close();
            return;
          }

          settled = true;
          currentDatabase = database;
          resolve(database);
        };
      }
    ).catch(error => {
      openPromise = null;
      throw error;
    });

    return openPromise;
  }

  async function readDatabaseState(database) {
    return withTransaction(
      database,
      [STORE_NAMES.metadata],
      "readonly",
      transaction =>
        requestAsPromise(
          transaction
            .objectStore(
              STORE_NAMES.metadata
            )
            .get(DATABASE_STATE_KEY)
        )
    );
  }

  function validateDatabaseState(state) {
    if (
      !state ||
      state.key !== DATABASE_STATE_KEY ||
      !Number.isInteger(
        state.storageSchemaVersion
      ) ||
      !Number.isInteger(
        state.contractVersion
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-009",
        "Beslenme veritabanı durum kaydı geçersiz."
      );
    }

    if (
      state.storageSchemaVersion !==
      DATA_SCHEMA_VERSION
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-009",
        "Beslenme depolama şeması bu sürümle uyumlu değil.",
        {
          stored:
            state.storageSchemaVersion,
          expected:
            DATA_SCHEMA_VERSION
        }
      );
    }

    const contracts = getContracts();

    if (
      state.contractVersion >
      contracts.CONTRACT_VERSION
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-012",
        "Beslenme verisi uygulamanın desteklediğinden daha yeni bir sözleşme kullanıyor.",
        {
          stored: state.contractVersion,
          supported:
            contracts.CONTRACT_VERSION
        }
      );
    }

    return state;
  }

  async function getOperationalContext(
    options = {}
  ) {
    const database = await openDatabase();
    const state = validateDatabaseState(
      await readDatabaseState(database)
    );
    const contracts = getContracts();

    if (
      options.allowMigrationPending !== true &&
      state.contractVersion !==
        contracts.CONTRACT_VERSION
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-011",
        "Beslenme veri şeması geçiş bekliyor.",
        {
          stored: state.contractVersion,
          target:
            contracts.CONTRACT_VERSION
        }
      );
    }

    return {
      database,
      state,
      contracts
    };
  }

  async function readAllRecords(database) {
    const records = await withTransaction(
      database,
      [STORE_NAMES.records],
      "readonly",
      transaction =>
        requestAsPromise(
          transaction
            .objectStore(
              STORE_NAMES.records
            )
            .getAll()
        )
    );

    return clone(records || []);
  }

  function assertRecord(record, contracts) {
    const validation =
      contracts.validateRecord(record);

    if (!validation.valid) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-005",
        "Beslenme kaydı sözleşmeye uygun değil.",
        {
          errors: clone(
            validation.errors || []
          )
        }
      );
    }

    try {
      return clone(
        contracts.createRecord(record)
      );
    } catch (error) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-005",
        "Beslenme kaydı oluşturulamadı.",
        null,
        error
      );
    }
  }

  function assertRecordSet(records, contracts) {
    if (!Array.isArray(records)) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-006",
        "Beslenme kayıt kümesi bir dizi olmalıdır."
      );
    }

    const normalized = records.map(
      record => assertRecord(
        record,
        contracts
      )
    );
    const validation =
      contracts.validateRecordSet(
        normalized,
        { requireReferences: true }
      );

    if (!validation.valid) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-006",
        "Beslenme kayıt kümesinin referans bütünlüğü geçersiz.",
        {
          errors: clone(
            validation.errors || []
          ),
          warnings: clone(
            validation.warnings || []
          )
        }
      );
    }

    return normalized;
  }

  function mergeRecordSet(
    currentRecords,
    candidateRecords
  ) {
    const recordsById = new Map(
      currentRecords.map(record => [
        record.id,
        clone(record)
      ])
    );

    candidateRecords.forEach(record => {
      recordsById.set(
        record.id,
        clone(record)
      );
    });

    return [
      ...recordsById.values()
    ];
  }

  async function initialize() {
    const context = await getOperationalContext({
      allowMigrationPending: true
    });
    const recordCount =
      await countStore(
        context.database,
        STORE_NAMES.records
      );

    return Object.freeze({
      success: true,
      databaseName: DATABASE_NAME,
      databaseVersion:
        context.database.version,
      storageSchemaVersion:
        context.state.storageSchemaVersion,
      storedContractVersion:
        context.state.contractVersion,
      targetContractVersion:
        context.contracts.CONTRACT_VERSION,
      migrationRequired:
        context.state.contractVersion !==
        context.contracts.CONTRACT_VERSION,
      recordCount
    });
  }

  async function countStore(
    database,
    storeName
  ) {
    return withTransaction(
      database,
      [storeName],
      "readonly",
      transaction =>
        requestAsPromise(
          transaction
            .objectStore(storeName)
            .count()
        )
    );
  }

  async function getStatus() {
    const context = await getOperationalContext({
      allowMigrationPending: true
    });
    const [recordCount, backupCount] =
      await Promise.all([
        countStore(
          context.database,
          STORE_NAMES.records
        ),
        countStore(
          context.database,
          STORE_NAMES.backups
        )
      ]);

    return Object.freeze({
      storageApiVersion:
        STORAGE_API_VERSION,
      databaseName: DATABASE_NAME,
      databaseVersion:
        context.database.version,
      storageSchemaVersion:
        context.state.storageSchemaVersion,
      storedContractVersion:
        context.state.contractVersion,
      targetContractVersion:
        context.contracts.CONTRACT_VERSION,
      migrationRequired:
        context.state.contractVersion !==
        context.contracts.CONTRACT_VERSION,
      recordCount,
      backupCount,
      lastMigration: clone(
        context.state.lastMigration
      )
    });
  }

  async function getRecord(
    recordId,
    options = {}
  ) {
    if (
      typeof recordId !== "string" ||
      !recordId.trim()
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-005",
        "Beslenme kayıt kimliği geçersiz."
      );
    }

    const { database } =
      await getOperationalContext();
    const record = await withTransaction(
      database,
      [STORE_NAMES.records],
      "readonly",
      transaction =>
        requestAsPromise(
          transaction
            .objectStore(
              STORE_NAMES.records
            )
            .get(recordId)
        )
    );

    if (!record) {
      return null;
    }

    if (
      record.source?.kind ===
        "ai_draft" &&
      options.includeAiDraft !== true
    ) {
      return null;
    }

    return clone(record);
  }

  function normalizeFilterList(
    value,
    fieldName
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      return null;
    }

    const values = Array.isArray(value)
      ? value
      : [value];

    if (
      values.some(
        item =>
          typeof item !== "string" ||
          !item.trim()
      )
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-005",
        `${fieldName} filtresi geçersiz.`
      );
    }

    return new Set(
      values.map(item => item.trim())
    );
  }

  function normalizeQueryOptions(options) {
    const candidate =
      options &&
      typeof options === "object"
        ? options
        : {};
    const limit =
      candidate.limit === undefined
        ? MAX_QUERY_LIMIT
        : Number(candidate.limit);
    const offset =
      candidate.offset === undefined
        ? 0
        : Number(candidate.offset);

    if (
      !Number.isInteger(limit) ||
      limit < 0 ||
      limit > MAX_QUERY_LIMIT ||
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-005",
        "Beslenme sorgusu limit veya offset değeri geçersiz."
      );
    }

    const sortDirection =
      candidate.sortDirection || "asc";

    if (
      sortDirection !== "asc" &&
      sortDirection !== "desc"
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-005",
        "Beslenme sorgusu sıralama yönü geçersiz."
      );
    }

    return {
      types: normalizeFilterList(
        candidate.types,
        "types"
      ),
      recordStatuses: normalizeFilterList(
        candidate.recordStatuses,
        "recordStatuses"
      ),
      sourceKinds: normalizeFilterList(
        candidate.sourceKinds,
        "sourceKinds"
      ),
      includeAiDrafts:
        candidate.includeAiDrafts === true,
      eventFrom:
        candidate.eventFrom || null,
      eventTo:
        candidate.eventTo || null,
      sortDirection,
      limit,
      offset
    };
  }

  function compareRecords(a, b) {
    const aTime =
      a.eventAt || a.updatedAt || "";
    const bTime =
      b.eventAt || b.updatedAt || "";
    const timeComparison =
      aTime.localeCompare(bTime);

    return timeComparison ||
      a.id.localeCompare(b.id);
  }

  async function queryRecords(options = {}) {
    const normalized =
      normalizeQueryOptions(options);
    const { database } =
      await getOperationalContext();
    const records =
      await readAllRecords(database);

    let filtered = records.filter(record => {
      if (
        !normalized.includeAiDrafts &&
        record.source?.kind ===
          "ai_draft"
      ) {
        return false;
      }

      if (
        normalized.types &&
        !normalized.types.has(record.type)
      ) {
        return false;
      }

      if (
        normalized.recordStatuses &&
        !normalized.recordStatuses.has(
          record.recordStatus
        )
      ) {
        return false;
      }

      if (
        normalized.sourceKinds &&
        !normalized.sourceKinds.has(
          record.source?.kind
        )
      ) {
        return false;
      }

      if (
        normalized.eventFrom &&
        (
          !record.eventAt ||
          record.eventAt <
            normalized.eventFrom
        )
      ) {
        return false;
      }

      if (
        normalized.eventTo &&
        (
          !record.eventAt ||
          record.eventAt >
            normalized.eventTo
        )
      ) {
        return false;
      }

      return true;
    });

    filtered.sort(compareRecords);

    if (normalized.sortDirection === "desc") {
      filtered.reverse();
    }

    filtered = filtered.slice(
      normalized.offset,
      normalized.offset +
        normalized.limit
    );

    return clone(filtered);
  }

  function getPlannedRecords(options = {}) {
    return queryRecords({
      ...options,
      types: PLANNED_TYPES,
      includeAiDrafts: false
    });
  }

  function getConsumedRecords(options = {}) {
    return queryRecords({
      ...options,
      types: CONSUMED_TYPES,
      includeAiDrafts: false
    });
  }

  function getAiDrafts(options = {}) {
    return queryRecords({
      ...options,
      sourceKinds: ["ai_draft"],
      includeAiDrafts: true
    });
  }

  async function saveRecords(
    records,
    options = {}
  ) {
    return serializeWrite(async () => {
      const context =
        await getOperationalContext();
      const candidates =
        Array.isArray(records)
          ? records
          : [];

      if (candidates.length === 0) {
        throw createError(
          "TODAY-NUTRITION-STORAGE-006",
          "Kaydedilecek beslenme kaydı bulunamadı."
        );
      }

      const normalizedCandidates =
        candidates.map(record =>
          assertRecord(
            record,
            context.contracts
          )
        );
      const candidateIds = new Set();

      normalizedCandidates.forEach(record => {
        if (candidateIds.has(record.id)) {
          throw createError(
            "TODAY-NUTRITION-STORAGE-006",
            "Aynı işlemde yinelenen beslenme kayıt kimliği kullanılamaz.",
            { recordId: record.id }
          );
        }

        candidateIds.add(record.id);
      });

      const currentRecords =
        await readAllRecords(
          context.database
        );
      const currentById = new Map(
        currentRecords.map(record => [
          record.id,
          record
        ])
      );
      const mode = options.mode || "upsert";

      if (
        mode !== "upsert" &&
        mode !== "add"
      ) {
        throw createError(
          "TODAY-NUTRITION-STORAGE-005",
          "Beslenme kayıt modu geçersiz."
        );
      }

      if (mode === "add") {
        const conflict =
          normalizedCandidates.find(
            record =>
              currentById.has(record.id)
          );

        if (conflict) {
          throw createError(
            "TODAY-NUTRITION-STORAGE-007",
            "Beslenme kaydı zaten mevcut.",
            { recordId: conflict.id }
          );
        }
      }

      const expectedUpdatedAtById =
        options.expectedUpdatedAtById;

      if (
        expectedUpdatedAtById &&
        typeof expectedUpdatedAtById ===
          "object"
      ) {
        normalizedCandidates.forEach(record => {
          if (
            !hasOwn(
              expectedUpdatedAtById,
              record.id
            )
          ) {
            return;
          }

          const current =
            currentById.get(record.id);
          const expected =
            expectedUpdatedAtById[
              record.id
            ];

          if (
            !current ||
            current.updatedAt !== expected
          ) {
            throw createError(
              "TODAY-NUTRITION-STORAGE-007",
              "Beslenme kaydı başka bir işlem tarafından değiştirilmiş.",
              { recordId: record.id }
            );
          }
        });
      }

      assertRecordSet(
        mergeRecordSet(
          currentRecords,
          normalizedCandidates
        ),
        context.contracts
      );

      await withTransaction(
        context.database,
        [STORE_NAMES.records],
        "readwrite",
        async transaction => {
          const store =
            transaction.objectStore(
              STORE_NAMES.records
            );

          for (
            const record of
            normalizedCandidates
          ) {
            await requestAsPromise(
              mode === "add"
                ? store.add(clone(record))
                : store.put(clone(record))
            );
          }
        }
      );

      return clone(normalizedCandidates);
    });
  }

  async function saveRecord(
    record,
    options = {}
  ) {
    const records = await saveRecords(
      [record],
      options
    );

    return records[0];
  }

  async function deleteRecord(recordId) {
    return serializeWrite(async () => {
      const context =
        await getOperationalContext();
      const currentRecords =
        await readAllRecords(
          context.database
        );
      const exists = currentRecords.some(
        record => record.id === recordId
      );

      if (!exists) {
        return false;
      }

      const remaining =
        currentRecords.filter(
          record =>
            record.id !== recordId
        );

      assertRecordSet(
        remaining,
        context.contracts
      );

      await withTransaction(
        context.database,
        [STORE_NAMES.records],
        "readwrite",
        transaction =>
          requestAsPromise(
            transaction
              .objectStore(
                STORE_NAMES.records
              )
              .delete(recordId)
          )
      );

      return true;
    });
  }

  function createBackupId() {
    const timestamp = nowIso()
      .replace(/[^0-9]/g, "")
      .slice(0, 17);
    const randomPart =
      typeof window.crypto?.randomUUID ===
        "function"
        ? window.crypto
            .randomUUID()
            .replace(/-/g, "")
            .slice(0, 12)
        : Math.random()
            .toString(36)
            .slice(2, 14);

    return `nutrition-backup-${timestamp}-${randomPart}`;
  }

  function buildBackup(
    records,
    state,
    reason,
    status = "available"
  ) {
    const createdAt = nowIso();

    return {
      id: createBackupId(),
      snapshotSchemaId:
        SNAPSHOT_SCHEMA_ID,
      createdAt,
      reason:
        typeof reason === "string" &&
        reason.trim()
          ? reason.trim().slice(0, 160)
          : "manual",
      status,
      storageSchemaVersion:
        state.storageSchemaVersion,
      contractVersion:
        state.contractVersion,
      recordCount: records.length,
      records: clone(records)
    };
  }

  async function createBackup(
    reason = "manual"
  ) {
    return serializeWrite(async () => {
      const context =
        await getOperationalContext({
          allowMigrationPending: true
        });
      const records =
        await readAllRecords(
          context.database
        );
      const backup = buildBackup(
        records,
        context.state,
        reason
      );

      await withTransaction(
        context.database,
        [STORE_NAMES.backups],
        "readwrite",
        transaction =>
          requestAsPromise(
            transaction
              .objectStore(
                STORE_NAMES.backups
              )
              .add(clone(backup))
          )
      );

      return clone(backup);
    });
  }

  async function listBackups() {
    const { database } =
      await getOperationalContext({
        allowMigrationPending: true
      });
    const backups = await withTransaction(
      database,
      [STORE_NAMES.backups],
      "readonly",
      transaction =>
        requestAsPromise(
          transaction
            .objectStore(
              STORE_NAMES.backups
            )
            .getAll()
        )
    );

    return (backups || [])
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(
            a.createdAt
          )
      )
      .map(backup => ({
        id: backup.id,
        createdAt: backup.createdAt,
        reason: backup.reason,
        status: backup.status,
        storageSchemaVersion:
          backup.storageSchemaVersion,
        contractVersion:
          backup.contractVersion,
        recordCount: backup.recordCount
      }));
  }

  async function getBackup(
    database,
    backupId
  ) {
    const backup = await withTransaction(
      database,
      [STORE_NAMES.backups],
      "readonly",
      transaction =>
        requestAsPromise(
          transaction
            .objectStore(
              STORE_NAMES.backups
            )
            .get(backupId)
        )
    );

    if (!backup) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-010",
        "Beslenme veri yedeği bulunamadı.",
        { backupId }
      );
    }

    return clone(backup);
  }

  async function replaceAllRecords(
    records,
    options = {}
  ) {
    return serializeWrite(async () => {
      const context =
        await getOperationalContext();
      const normalized = assertRecordSet(
        records,
        context.contracts
      );
      const currentRecords =
        await readAllRecords(
          context.database
        );
      const backup =
        options.createBackup === false
          ? null
          : buildBackup(
              currentRecords,
              context.state,
              options.reason ||
                "replace_all"
            );
      const updatedState = {
        ...clone(context.state),
        updatedAt: nowIso()
      };

      await withTransaction(
        context.database,
        [
          STORE_NAMES.records,
          STORE_NAMES.backups,
          STORE_NAMES.metadata
        ],
        "readwrite",
        async transaction => {
          const recordStore =
            transaction.objectStore(
              STORE_NAMES.records
            );

          if (backup) {
            await requestAsPromise(
              transaction
                .objectStore(
                  STORE_NAMES.backups
                )
                .add(clone(backup))
            );
          }

          await requestAsPromise(
            recordStore.clear()
          );

          for (const record of normalized) {
            await requestAsPromise(
              recordStore.add(
                clone(record)
              )
            );
          }

          await requestAsPromise(
            transaction
              .objectStore(
                STORE_NAMES.metadata
              )
              .put(updatedState)
          );
        }
      );

      return Object.freeze({
        success: true,
        recordCount: normalized.length,
        backupId: backup?.id || null
      });
    });
  }

  async function restoreBackup(backupId) {
    const context =
      await getOperationalContext();
    const backup = await getBackup(
      context.database,
      backupId
    );

    if (
      backup.contractVersion !==
      context.contracts.CONTRACT_VERSION
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-010",
        "Yedek farklı bir beslenme sözleşmesi sürümü kullanıyor.",
        {
          stored:
            backup.contractVersion,
          expected:
            context.contracts.CONTRACT_VERSION
        }
      );
    }

    const result = await replaceAllRecords(
      backup.records,
      {
        createBackup: true,
        reason:
          `before_restore:${backupId}`
      }
    );

    return Object.freeze({
      ...result,
      restoredBackupId: backupId
    });
  }

  async function exportSnapshot() {
    const context =
      await getOperationalContext();
    const records =
      await readAllRecords(
        context.database
      );

    return clone({
      snapshotSchemaId:
        SNAPSHOT_SCHEMA_ID,
      createdAt: nowIso(),
      databaseName: DATABASE_NAME,
      databaseVersion:
        context.database.version,
      storageSchemaVersion:
        context.state.storageSchemaVersion,
      contractVersion:
        context.state.contractVersion,
      recordCount: records.length,
      records
    });
  }

  function validateSnapshot(snapshot) {
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      snapshot.snapshotSchemaId !==
        SNAPSHOT_SCHEMA_ID ||
      snapshot.storageSchemaVersion !==
        DATA_SCHEMA_VERSION ||
      !Number.isInteger(
        snapshot.contractVersion
      ) ||
      !Array.isArray(snapshot.records) ||
      snapshot.recordCount !==
        snapshot.records.length
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-009",
        "Beslenme veri anlık görüntüsü geçersiz."
      );
    }

    return snapshot;
  }

  async function importSnapshot(
    snapshot,
    options = {}
  ) {
    const candidate = validateSnapshot(
      clone(snapshot)
    );
    const contracts = getContracts();

    if (
      candidate.contractVersion !==
      contracts.CONTRACT_VERSION
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-012",
        "Beslenme veri anlık görüntüsü desteklenmeyen sözleşme sürümü kullanıyor.",
        {
          stored:
            candidate.contractVersion,
          supported:
            contracts.CONTRACT_VERSION
        }
      );
    }

    return replaceAllRecords(
      candidate.records,
      {
        createBackup:
          options.createBackup !== false,
        reason:
          options.reason ||
          "snapshot_import"
      }
    );
  }

  function validateMigrationPlan(
    currentVersion,
    targetVersion,
    steps
  ) {
    if (
      !Number.isInteger(targetVersion) ||
      targetVersion < currentVersion ||
      !Array.isArray(steps)
    ) {
      throw createError(
        "TODAY-NUTRITION-STORAGE-011",
        "Beslenme migration planı geçersiz."
      );
    }

    const required = [];
    let cursor = currentVersion;

    while (cursor < targetVersion) {
      const step = steps.find(
        candidate =>
          candidate &&
          candidate.fromVersion === cursor
      );

      if (
        !step ||
        step.toVersion !== cursor + 1 ||
        typeof step.migrateRecord !==
          "function" ||
        typeof step.id !== "string" ||
        !step.id.trim()
      ) {
        throw createError(
          "TODAY-NUTRITION-STORAGE-011",
          "Beslenme migration adımları kesintisiz değil.",
          { missingFromVersion: cursor }
        );
      }

      required.push(step);
      cursor = step.toVersion;
    }

    return required;
  }

  async function updateBackupStatus(
    database,
    backup,
    status
  ) {
    const updated = {
      ...clone(backup),
      status,
      updatedAt: nowIso()
    };

    await withTransaction(
      database,
      [STORE_NAMES.backups],
      "readwrite",
      transaction =>
        requestAsPromise(
          transaction
            .objectStore(
              STORE_NAMES.backups
            )
            .put(updated)
        )
    );

    return updated;
  }

  async function applyMigrationPlan(options) {
    return serializeWrite(async () => {
      const context =
        await getOperationalContext({
          allowMigrationPending: true
        });
      const targetVersion =
        options?.targetVersion;

      if (
        targetVersion !==
        context.contracts.CONTRACT_VERSION
      ) {
        throw createError(
          "TODAY-NUTRITION-STORAGE-012",
          "Migration hedefi etkin beslenme sözleşmesiyle eşleşmiyor.",
          {
            targetVersion,
            supported:
              context.contracts.CONTRACT_VERSION
          }
        );
      }

      if (
        context.state.contractVersion ===
        targetVersion
      ) {
        return Object.freeze({
          success: true,
          migrated: false,
          skipped: true,
          fromVersion:
            context.state.contractVersion,
          toVersion: targetVersion,
          appliedSteps: Object.freeze([]),
          backupId: null,
          recordCount:
            await countStore(
              context.database,
              STORE_NAMES.records
            )
        });
      }

      const requiredSteps =
        validateMigrationPlan(
          context.state.contractVersion,
          targetVersion,
          options?.steps
        );
      const originalRecords =
        await readAllRecords(
          context.database
        );
      let workingRecords =
        clone(originalRecords);
      const migrationId =
        typeof options?.migrationId ===
          "string" &&
        options.migrationId.trim()
          ? options.migrationId.trim()
          : `contract-${
              context.state.contractVersion
            }-to-${targetVersion}`;
      let backup = buildBackup(
        originalRecords,
        context.state,
        `migration:${migrationId}`,
        "prepared"
      );

      await withTransaction(
        context.database,
        [STORE_NAMES.backups],
        "readwrite",
        transaction =>
          requestAsPromise(
            transaction
              .objectStore(
                STORE_NAMES.backups
              )
              .add(clone(backup))
          )
      );

      try {
        for (const step of requiredSteps) {
          workingRecords =
            workingRecords.map(
              (record, index) => {
                const migrated =
                  step.migrateRecord(
                    clone(record),
                    Object.freeze({
                      index,
                      fromVersion:
                        step.fromVersion,
                      toVersion:
                        step.toVersion,
                      migrationId
                    })
                  );

                if (
                  migrated &&
                  typeof migrated.then ===
                    "function"
                ) {
                  throw createError(
                    "TODAY-NUTRITION-STORAGE-011",
                    "Migration kayıt dönüştürücüsü eşzamanlı olmalıdır.",
                    { stepId: step.id }
                  );
                }

                return clone(migrated);
              }
            );
        }

        workingRecords = assertRecordSet(
          workingRecords,
          context.contracts
        );
      } catch (error) {
        try {
          backup = await updateBackupStatus(
            context.database,
            backup,
            "failed"
          );
        } catch (backupError) {
          // Original records are still untouched even if status marking fails.
        }

        if (error?.todayCode) {
          throw error;
        }

        throw createError(
          "TODAY-NUTRITION-STORAGE-011",
          "Beslenme kayıtları yeni şemaya dönüştürülemedi.",
          {
            migrationId,
            backupId: backup.id
          },
          error
        );
      }

      const migratedAt = nowIso();
      const appliedSteps =
        requiredSteps.map(step => step.id);
      const updatedState = {
        ...clone(context.state),
        contractVersion: targetVersion,
        updatedAt: migratedAt,
        lastMigration: {
          id: migrationId,
          fromVersion:
            context.state.contractVersion,
          toVersion: targetVersion,
          appliedAt: migratedAt,
          appliedSteps,
          recordCount:
            workingRecords.length,
          backupId: backup.id
        }
      };
      const appliedBackup = {
        ...clone(backup),
        status: "applied",
        updatedAt: migratedAt
      };

      await withTransaction(
        context.database,
        [
          STORE_NAMES.records,
          STORE_NAMES.metadata,
          STORE_NAMES.backups
        ],
        "readwrite",
        async transaction => {
          const recordStore =
            transaction.objectStore(
              STORE_NAMES.records
            );

          await requestAsPromise(
            recordStore.clear()
          );

          for (
            const record of workingRecords
          ) {
            await requestAsPromise(
              recordStore.add(
                clone(record)
              )
            );
          }

          await requestAsPromise(
            transaction
              .objectStore(
                STORE_NAMES.metadata
              )
              .put(updatedState)
          );
          await requestAsPromise(
            transaction
              .objectStore(
                STORE_NAMES.backups
              )
              .put(appliedBackup)
          );
        }
      );

      return Object.freeze({
        success: true,
        migrated: true,
        skipped: false,
        fromVersion:
          context.state.contractVersion,
        toVersion: targetVersion,
        appliedSteps:
          Object.freeze([
            ...appliedSteps
          ]),
        backupId: backup.id,
        recordCount:
          workingRecords.length
      });
    });
  }

  function close() {
    if (currentDatabase) {
      currentDatabase.close();
    }

    currentDatabase = null;
    openPromise = null;
  }

  window.TodayNutritionStorage =
    Object.freeze({
      STORAGE_API_VERSION,
      DATABASE_NAME,
      DATABASE_VERSION,
      DATA_SCHEMA_VERSION,
      SNAPSHOT_SCHEMA_ID,
      STORE_NAMES,
      INDEX_NAMES,
      PLANNED_TYPES,
      CONSUMED_TYPES,
      initialize,
      getStatus,
      getRecord,
      queryRecords,
      getPlannedRecords,
      getConsumedRecords,
      getAiDrafts,
      saveRecord,
      saveRecords,
      deleteRecord,
      createBackup,
      listBackups,
      restoreBackup,
      exportSnapshot,
      importSnapshot,
      replaceAllRecords,
      applyMigrationPlan,
      close
    });
})();
