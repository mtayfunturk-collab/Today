const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {
  IDBFactory,
  IDBKeyRange
} = require("fake-indexeddb");

const PATHS = Object.freeze({
  contracts:
    "modules/nutrition-contracts.js",
  storage:
    "modules/nutrition-storage.js",
  migrations:
    "modules/nutrition-migrations.js"
});

const sources = Object.freeze(
  Object.fromEntries(
    Object.entries(PATHS).map(
      ([key, path]) => [
        key,
        fs.readFileSync(path, "utf8")
      ]
    )
  )
);

const NOW =
  "2026-08-05T12:00:00.000Z";
const LATER =
  "2026-08-05T12:05:00.000Z";

function profile(
  id = "nutrition-profile-1"
) {
  return {
    id,
    type: "nutrition_profile",
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
    payload: {
      trackingMode: "simple",
      dietaryConstraintIds: [],
      primaryGoalVersionId: null
    },
    extensions: {}
  };
}

function createRuntime(options = {}) {
  const factory =
    options.factory ||
    new IDBFactory();
  const window = {
    indexedDB:
      options.withIndexedDb === false
        ? undefined
        : factory,
    IDBKeyRange,
    structuredClone:
      globalThis.structuredClone,
    crypto: {
      randomUUID() {
        return "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
      }
    },
    localStorage: {
      getItem() {
        throw new Error(
          "Core localStorage okunmamalı"
        );
      },
      setItem() {
        throw new Error(
          "Core localStorage yazılmamalı"
        );
      }
    },
    console: {
      info() {},
      warn() {},
      error() {}
    }
  };
  const context = vm.createContext({
    window,
    console: window.console
  });

  if (options.loadContracts !== false) {
    vm.runInContext(
      sources.contracts,
      context,
      { filename: PATHS.contracts }
    );
  }

  if (options.loadStorage !== false) {
    vm.runInContext(
      sources.storage,
      context,
      { filename: PATHS.storage }
    );
  }

  vm.runInContext(
    sources.migrations,
    context,
    { filename: PATHS.migrations }
  );

  return {
    factory,
    window,
    storage:
      window.TodayNutritionStorage,
    api:
      window.TodayNutritionMigration
  };
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () =>
      resolve(request.result);
    request.onerror = () =>
      reject(request.error);
  });
}

function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () =>
      reject(transaction.error);
    transaction.onerror = () => {};
  });
}

async function openDatabase(runtime) {
  const request = runtime.factory.open(
    "today_nutrition",
    1
  );
  return requestPromise(request);
}

async function updateState(runtime, updates) {
  runtime.storage.close();
  const database = await openDatabase(runtime);
  const transaction = database.transaction(
    ["metadata"],
    "readwrite"
  );
  const done =
    transactionPromise(transaction);
  const store =
    transaction.objectStore("metadata");
  const state = await requestPromise(
    store.get("database_state")
  );

  await requestPromise(
    store.put({
      ...state,
      ...updates
    })
  );
  await done;
  database.close();
}

async function directPut(runtime, record) {
  runtime.storage.close();
  const database = await openDatabase(runtime);
  const transaction = database.transaction(
    ["records"],
    "readwrite"
  );
  const done =
    transactionPromise(transaction);

  await requestPromise(
    transaction
      .objectStore("records")
      .put(record)
  );
  await done;
  database.close();
}

async function directGet(runtime, recordId) {
  runtime.storage.close();
  const database = await openDatabase(runtime);
  const transaction = database.transaction(
    ["records"],
    "readonly"
  );
  const done =
    transactionPromise(transaction);
  const record = await requestPromise(
    transaction
      .objectStore("records")
      .get(recordId)
  );
  await done;
  database.close();
  return record;
}

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

test(
  "Migration API ve ilk geçiş adımı sürümlü",
  async () => {
    const { api } = createRuntime();
    assert.equal(api.MIGRATION_API_VERSION, 1);
    assert.equal(api.MIGRATION_PLAN_VERSION, 1);
    assert.equal(api.MIGRATION_STEPS.length, 1);
    assert.equal(
      api.MIGRATION_STEPS[0].id,
      "nutrition-contract-0-to-1"
    );
  }
);

test(
  "Eksik bağımlılıklar açık migration hatası veriyor",
  async () => {
    const { api } = createRuntime({
      loadContracts: false,
      loadStorage: false
    });
    const result = await api.run();
    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-NUTRITION-MIGRATION-001"
    );
  }
);

test(
  "Taze depo incelemesi migration gerekmediğini gösteriyor",
  async () => {
    const runtime = createRuntime();
    const result = await runtime.api.inspect();
    assert.equal(result.currentContractVersion, 1);
    assert.equal(result.targetContractVersion, 1);
    assert.equal(result.migrationRequired, false);
    runtime.storage.close();
  }
);

test(
  "Taze depoda migration yazma yapmadan atlanıyor",
  async () => {
    const runtime = createRuntime();
    const result = await runtime.api.run();
    assert.equal(result.success, true);
    assert.equal(result.migrated, false);
    assert.equal(result.skipped, true);
    runtime.storage.close();
  }
);

test(
  "Başarılı çalışmadan sonra durum ready oluyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.run();
    const status = runtime.api.getStatus();
    assert.equal(status.phase, "ready");
    assert.equal(status.running, false);
    assert.equal(status.lastResult.success, true);
    runtime.storage.close();
  }
);

test(
  "Güncel depoda tekrarlanan run çağrısı yine no-op kalıyor",
  async () => {
    const runtime = createRuntime();
    const first = await runtime.api.run();
    const second = await runtime.api.run();
    assert.equal(first.skipped, true);
    assert.equal(second.skipped, true);
    assert.equal(
      (await runtime.storage.getStatus())
        .backupCount,
      0
    );
    runtime.storage.close();
  }
);

test(
  "Eşzamanlı run çağrıları aynı işlemi paylaşıyor",
  async () => {
    const runtime = createRuntime();
    const first = runtime.api.run();
    const second = runtime.api.run();
    assert.equal(first, second);
    const result = await first;
    assert.equal(result.success, true);
    runtime.storage.close();
  }
);

test(
  "Güncel depodaki no-op migration yedek oluşturmuyor",
  async () => {
    const runtime = createRuntime();
    const result = await runtime.api.run();
    assert.equal(result.backupId, null);
    assert.equal(
      (await runtime.storage.listBackups())
        .length,
      0
    );
    runtime.storage.close();
  }
);

test(
  "v0 metadata incelemesi geçiş gereksinimini gösteriyor",
  async () => {
    const runtime = createRuntime();
    await runtime.storage.initialize();
    await updateState(runtime, {
      contractVersion: 0
    });
    const result = await runtime.api.inspect();
    assert.equal(result.currentContractVersion, 0);
    assert.equal(result.migrationRequired, true);
    runtime.storage.close();
  }
);

test(
  "Boş v0 depo onaylı 0→1 adımıyla ilerliyor",
  async () => {
    const runtime = createRuntime();
    await runtime.storage.initialize();
    await updateState(runtime, {
      contractVersion: 0
    });
    const result = await runtime.api.run();
    assert.equal(result.success, true);
    assert.equal(result.migrated, true);
    assert.deepEqual(
      Array.from(result.appliedSteps),
      ["nutrition-contract-0-to-1"]
    );
    runtime.storage.close();
  }
);

test(
  "Başarılı 0→1 geçişinin yedeği applied işaretleniyor",
  async () => {
    const runtime = createRuntime();
    await runtime.storage.initialize();
    await updateState(runtime, {
      contractVersion: 0
    });
    const result = await runtime.api.run();
    const backups =
      await runtime.storage.listBackups();
    assert.equal(backups.length, 1);
    assert.equal(backups[0].id, result.backupId);
    assert.equal(backups[0].status, "applied");
    runtime.storage.close();
  }
);

test(
  "Başarılı geçiş migration kimliği ve kayıt sayısını saklıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.storage.initialize();
    await updateState(runtime, {
      contractVersion: 0
    });
    await runtime.api.run();
    const status = await runtime.storage.getStatus();
    assert.equal(
      status.lastMigration.fromVersion,
      0
    );
    assert.equal(
      status.lastMigration.toVersion,
      1
    );
    assert.equal(
      status.lastMigration.recordCount,
      0
    );
    runtime.storage.close();
  }
);

test(
  "Metadata işareti geride kalmış geçerli v1 kayıt korunuyor",
  async () => {
    const runtime = createRuntime();
    await runtime.storage.saveRecord(profile());
    await updateState(runtime, {
      contractVersion: 0
    });
    const result = await runtime.api.run();
    assert.equal(result.success, true);
    assert.equal(result.recordCount, 1);
    assert.ok(
      await runtime.storage.getRecord(
        "nutrition-profile-1"
      )
    );
    runtime.storage.close();
  }
);

test(
  "Onaylanmamış eski kayıt otomatik dönüştürülmüyor",
  async () => {
    const runtime = createRuntime();
    await runtime.storage.initialize();
    await directPut(runtime, {
      id: "legacy-record",
      schemaVersion: 0,
      payload: { guessed: true }
    });
    await updateState(runtime, {
      contractVersion: 0
    });
    const result = await runtime.api.run();
    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-NUTRITION-MIGRATION-003"
    );
    runtime.storage.close();
  }
);

test(
  "Başarısız geçiş özgün eski kaydı değiştirmiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.storage.initialize();
    await directPut(runtime, {
      id: "legacy-record",
      schemaVersion: 0,
      payload: { original: true }
    });
    await updateState(runtime, {
      contractVersion: 0
    });
    await runtime.api.run();
    const record = await directGet(
      runtime,
      "legacy-record"
    );
    assert.deepEqual(record.payload, {
      original: true
    });
    runtime.storage.close();
  }
);

test(
  "Başarısız geçişin kurtarma noktası failed işaretli kalıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.storage.initialize();
    await directPut(runtime, {
      id: "legacy-record",
      schemaVersion: 0
    });
    await updateState(runtime, {
      contractVersion: 0
    });
    await runtime.api.run();
    const backups =
      await runtime.storage.listBackups();
    assert.equal(backups.length, 1);
    assert.equal(backups[0].status, "failed");
    runtime.storage.close();
  }
);

test(
  "Uygulamadan yeni şema güvenli biçimde bloke ediliyor",
  async () => {
    const runtime = createRuntime();
    await runtime.storage.initialize();
    await updateState(runtime, {
      contractVersion: 2
    });
    const result = await runtime.api.run();
    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-NUTRITION-STORAGE-012"
    );
    runtime.storage.close();
  }
);

test(
  "IndexedDB desteği yoksa storage hata kodu korunuyor",
  async () => {
    const runtime = createRuntime({
      withIndexedDb: false
    });
    const result = await runtime.api.run();
    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-NUTRITION-STORAGE-002"
    );
  }
);

test(
  "Migration sonucu ve adım listesi değiştirilemiyor",
  async () => {
    const runtime = createRuntime();
    const result = await runtime.api.run();
    assert.equal(Object.isFrozen(result), true);
    assert.equal(
      Object.isFrozen(result.appliedSteps),
      true
    );
    runtime.storage.close();
  }
);

test(
  "Yayımlanan migration API ve planı değiştirilemiyor",
  async () => {
    const { api } = createRuntime();
    assert.equal(Object.isFrozen(api), true);
    assert.equal(
      Object.isFrozen(api.MIGRATION_STEPS),
      true
    );
    assert.equal(
      Object.isFrozen(
        api.MIGRATION_STEPS[0]
      ),
      true
    );
  }
);

(async () => {
  const results = [];

  for (const item of tests) {
    try {
      await item.run();
      results.push({
        name: item.name,
        success: true
      });
    } catch (error) {
      results.push({
        name: item.name,
        success: false,
        error
      });
    }
  }

  const failed = results.filter(
    result => !result.success
  );

  results.forEach(result => {
    const prefix = result.success
      ? "PASS"
      : "FAIL";
    const suffix = result.error
      ? ` — ${
          result.error.stack ||
          result.error.message
        }`
      : "";
    console.log(
      `${prefix}: ${result.name}${suffix}`
    );
  });

  console.log(
    `Nutrition Migrations: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
