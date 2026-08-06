const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {
  IDBFactory,
  IDBKeyRange
} = require("fake-indexeddb");

const CONTRACT_SOURCE_PATH =
  "modules/nutrition-contracts.js";
const STORAGE_SOURCE_PATH =
  "modules/nutrition-storage.js";
const contractSource = fs.readFileSync(
  CONTRACT_SOURCE_PATH,
  "utf8"
);
const storageSource = fs.readFileSync(
  STORAGE_SOURCE_PATH,
  "utf8"
);

const NOW =
  "2026-08-05T12:00:00.000Z";
const LATER =
  "2026-08-05T12:05:00.000Z";
const EVENT =
  "2026-08-05T09:00:00.000Z";
const EVENT_LATER =
  "2026-08-05T18:00:00.000Z";

function createRuntime(options = {}) {
  const factory =
    options.factory ||
    new IDBFactory();
  const localStorage =
    options.localStorage || {
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
    };
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
        return "11111111-2222-4333-8444-555555555555";
      }
    },
    localStorage,
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

  vm.runInContext(
    contractSource,
    context,
    { filename: CONTRACT_SOURCE_PATH }
  );
  vm.runInContext(
    storageSource,
    context,
    { filename: STORAGE_SOURCE_PATH }
  );

  return {
    factory,
    window,
    contracts:
      window.TodayNutritionContracts,
    api: window.TodayNutritionStorage
  };
}

function baseRecord(
  type,
  payload,
  overrides = {}
) {
  return {
    id: `${type}-1`,
    type,
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
    payload,
    extensions: {},
    ...overrides
  };
}

function known(value, unit) {
  return {
    status: "known",
    value,
    unit,
    basis: null
  };
}

function profile(
  id = "nutrition-profile-1",
  trackingMode = "simple",
  overrides = {}
) {
  return baseRecord(
    "nutrition_profile",
    {
      trackingMode,
      dietaryConstraintIds: [],
      primaryGoalVersionId: null
    },
    { id, ...overrides }
  );
}

function itemSnapshot(
  id = "meal-item-snapshot-1"
) {
  return baseRecord(
    "meal_item_snapshot",
    {
      itemKind: "custom",
      referenceId: null,
      name: "Ev yapımı sandviç",
      amount: known(1, "portion"),
      nutrients: {},
      sourceVersion: null
    },
    { id }
  );
}

function mealEntry(
  id = "meal-entry-1",
  snapshotId =
    "meal-item-snapshot-1",
  eventAt = EVENT
) {
  return baseRecord(
    "meal_entry",
    {
      consumedAt: eventAt,
      mealType: "breakfast",
      itemSnapshotIds: [snapshotId],
      coverage: "complete",
      plannedMealId: null
    },
    { id, eventAt }
  );
}

function hydrationEntry(
  id = "hydration-entry-1",
  eventAt = EVENT_LATER
) {
  return baseRecord(
    "hydration_entry",
    {
      consumedAt: eventAt,
      beverageType: "water",
      amount: known(350, "ml")
    },
    { id, eventAt }
  );
}

function plannedMeal(
  id = "planned-meal-1",
  snapshotId =
    "meal-item-snapshot-1"
) {
  return baseRecord(
    "planned_meal",
    {
      plannedFor: EVENT,
      mealType: "breakfast",
      itemSnapshotIds: [snapshotId],
      status: "planned",
      mealEntryId: null
    },
    { id, eventAt: EVENT }
  );
}

function mealPlan(
  id = "meal-plan-1",
  plannedMealId = "planned-meal-1"
) {
  return baseRecord(
    "meal_plan",
    {
      startDate: "2026-08-05",
      endDate: "2026-08-11",
      status: "active",
      plannedMealIds: [plannedMealId]
    },
    { id }
  );
}

function aiDraftProfile() {
  return profile(
    "nutrition-profile-ai-1",
    "simple",
    {
      source: {
        kind: "ai_draft",
        referenceId: "proposal-1",
        version: "today-ai-1"
      },
      knowledgeStatus: "estimated",
      recordStatus: "draft",
      verificationStatus:
        "unverified"
    }
  );
}

function assertTodayCode(code) {
  return error => {
    assert.equal(error.todayCode, code);
    return true;
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

async function directDatabase(factory) {
  const request = factory.open(
    "today_nutrition",
    1
  );
  const database =
    await requestPromise(request);
  return database;
}

async function updateDatabaseState(
  runtime,
  updates
) {
  runtime.api.close();
  const database = await directDatabase(
    runtime.factory
  );
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

async function directRecords(runtime) {
  runtime.api.close();
  const database = await directDatabase(
    runtime.factory
  );
  const transaction = database.transaction(
    ["records"],
    "readonly"
  );
  const done =
    transactionPromise(transaction);
  const records = await requestPromise(
    transaction
      .objectStore("records")
      .getAll()
  );
  await done;
  database.close();
  return records;
}

async function directPutRecord(
  runtime,
  record
) {
  runtime.api.close();
  const database = await directDatabase(
    runtime.factory
  );
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

const tests = [];

function test(name, run) {
  tests.push({ name, run });
}

test(
  "API sürümü ve depo adları sabit",
  async () => {
    const { api } = createRuntime();
    assert.equal(api.STORAGE_API_VERSION, 1);
    assert.equal(api.DATABASE_NAME, "today_nutrition");
    assert.equal(api.DATABASE_VERSION, 1);
    assert.equal(api.DATA_SCHEMA_VERSION, 1);
    assert.equal(api.STORE_NAMES.records, "records");
  }
);

test(
  "IndexedDB olmayan ortam açık hata koduyla reddediliyor",
  async () => {
    const { api } = createRuntime({
      withIndexedDb: false
    });
    await assert.rejects(
      api.initialize(),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-002"
      )
    );
  }
);

test(
  "İlk başlatma boş beslenme veritabanını oluşturuyor",
  async () => {
    const { api } = createRuntime();
    const result = await api.initialize();
    assert.equal(result.success, true);
    assert.equal(result.databaseVersion, 1);
    assert.equal(result.recordCount, 0);
    assert.equal(result.migrationRequired, false);
    api.close();
  }
);

test(
  "Başlatma yinelendiğinde veri tabanı yeniden yazılmıyor",
  async () => {
    const { api } = createRuntime();
    const first = await api.initialize();
    const second = await api.initialize();
    assert.deepEqual(second, first);
    api.close();
  }
);

test(
  "Fiziksel şema üç store ve zorunlu indeksleri taşıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.initialize();
    runtime.api.close();
    const database = await directDatabase(
      runtime.factory
    );
    assert.deepEqual(
      Array.from(database.objectStoreNames),
      ["metadata", "migration_backups", "records"]
    );
    const transaction = database.transaction(
      ["records"],
      "readonly"
    );
    const indexes = Array.from(
      transaction
        .objectStore("records")
        .indexNames
    );
    assert.equal(indexes.includes("by_type"), true);
    assert.equal(
      indexes.includes("by_source_kind"),
      true
    );
    assert.equal(
      indexes.includes("by_type_and_status"),
      true
    );
    database.close();
  }
);

test(
  "Beslenme deposu Core localStorage alanına dokunmuyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.initialize();
    await runtime.api.saveRecord(profile());
    assert.equal(
      (await runtime.api.getStatus()).recordCount,
      1
    );
    runtime.api.close();
  }
);

test(
  "Geçerli tek kayıt kaydedilip okunuyor",
  async () => {
    const { api } = createRuntime();
    const saved = await api.saveRecord(profile());
    const loaded = await api.getRecord(saved.id);
    assert.equal(loaded.id, saved.id);
    assert.equal(
      loaded.payload.trackingMode,
      "simple"
    );
    api.close();
  }
);

test(
  "Okunan kayıt bağımsız kopya olarak dönüyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    const loaded = await api.getRecord(
      "nutrition-profile-1"
    );
    loaded.payload.trackingMode = "detailed";
    const reread = await api.getRecord(
      "nutrition-profile-1"
    );
    assert.equal(
      reread.payload.trackingMode,
      "simple"
    );
    api.close();
  }
);

test(
  "Bağlantılı kayıtlar tek atomik işlemde kaydediliyor",
  async () => {
    const { api } = createRuntime();
    const saved = await api.saveRecords([
      itemSnapshot(),
      mealEntry()
    ]);
    assert.equal(saved.length, 2);
    assert.equal(
      (await api.getStatus()).recordCount,
      2
    );
    api.close();
  }
);

test(
  "Geçersiz kayıt bütün atomik yazmayı reddediyor",
  async () => {
    const { api } = createRuntime();
    const invalid = profile("bad-profile");
    invalid.schemaVersion = 99;
    await assert.rejects(
      api.saveRecords([profile(), invalid]),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-005"
      )
    );
    assert.equal(
      (await api.getStatus()).recordCount,
      0
    );
    api.close();
  }
);

test(
  "Bilinmeyen ölçüm sıfıra dönüştürülerek yazılamıyor",
  async () => {
    const { api } = createRuntime();
    const invalid = itemSnapshot();
    invalid.payload.amount = {
      status: "unknown",
      value: 0,
      unit: "portion",
      basis: null
    };
    await assert.rejects(
      api.saveRecord(invalid),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-005"
      )
    );
    api.close();
  }
);

test(
  "Eksik referanslı tüketim kaydı reddediliyor",
  async () => {
    const { api } = createRuntime();
    await assert.rejects(
      api.saveRecord(mealEntry()),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-006"
      )
    );
    api.close();
  }
);

test(
  "Aynı işlemde yinelenen kimlik reddediliyor",
  async () => {
    const { api } = createRuntime();
    await assert.rejects(
      api.saveRecords([
        profile(),
        profile()
      ]),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-006"
      )
    );
    api.close();
  }
);

test(
  "Add modu var olan kaydı ezmiyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    await assert.rejects(
      api.saveRecord(
        profile(
          "nutrition-profile-1",
          "detailed"
        ),
        { mode: "add" }
      ),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-007"
      )
    );
    api.close();
  }
);

test(
  "Upsert modu var olan kaydı güncelliyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    await api.saveRecord(
      profile(
        "nutrition-profile-1",
        "detailed"
      )
    );
    const loaded = await api.getRecord(
      "nutrition-profile-1"
    );
    assert.equal(
      loaded.payload.trackingMode,
      "detailed"
    );
    api.close();
  }
);

test(
  "Eşleşen updatedAt ile iyimser güncelleme kabul ediliyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    const updated = profile(
      "nutrition-profile-1",
      "detailed",
      {
        updatedAt:
          "2026-08-05T13:00:00.000Z"
      }
    );
    await api.saveRecord(updated, {
      expectedUpdatedAtById: {
        "nutrition-profile-1": LATER
      }
    });
    assert.equal(
      (
        await api.getRecord(
          "nutrition-profile-1"
        )
      ).updatedAt,
      "2026-08-05T13:00:00.000Z"
    );
    api.close();
  }
);

test(
  "Eski updatedAt ile yapılan güncelleme çatışma veriyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    await assert.rejects(
      api.saveRecord(profile(), {
        expectedUpdatedAtById: {
          "nutrition-profile-1": NOW
        }
      }),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-007"
      )
    );
    api.close();
  }
);

test(
  "Eşzamanlı API yazmaları sıraya alınıp ikisi de korunuyor",
  async () => {
    const { api } = createRuntime();
    await Promise.all([
      api.saveRecord(
        profile("nutrition-profile-a")
      ),
      api.saveRecord(
        profile("nutrition-profile-b")
      )
    ]);
    assert.equal(
      (await api.queryRecords()).length,
      2
    );
    api.close();
  }
);

test(
  "Varsayılan sorgu AI taslağını sessizce karıştırmıyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      profile(),
      aiDraftProfile()
    ]);
    const records = await api.queryRecords();
    assert.deepEqual(
      records.map(record => record.id),
      ["nutrition-profile-1"]
    );
    api.close();
  }
);

test(
  "Tekil okuma AI taslağını varsayılan olarak gizliyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(aiDraftProfile());
    assert.equal(
      await api.getRecord(
        "nutrition-profile-ai-1"
      ),
      null
    );
    assert.equal(
      (
        await api.getRecord(
          "nutrition-profile-ai-1",
          { includeAiDraft: true }
        )
      ).recordStatus,
      "draft"
    );
    api.close();
  }
);

test(
  "AI taslak sorgusu yalnız taslak kaynağını döndürüyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      profile(),
      aiDraftProfile()
    ]);
    const drafts = await api.getAiDrafts();
    assert.equal(drafts.length, 1);
    assert.equal(
      drafts[0].source.kind,
      "ai_draft"
    );
    api.close();
  }
);

test(
  "Tür filtresi yalnız istenen kayıt türünü döndürüyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      itemSnapshot(),
      mealEntry(),
      hydrationEntry()
    ]);
    const records = await api.queryRecords({
      types: ["hydration_entry"]
    });
    assert.equal(records.length, 1);
    assert.equal(records[0].type, "hydration_entry");
    api.close();
  }
);

test(
  "Kayıt durumu filtresi taslakları ayırıyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      profile(),
      aiDraftProfile()
    ]);
    const records = await api.queryRecords({
      recordStatuses: ["draft"],
      includeAiDrafts: true
    });
    assert.equal(records.length, 1);
    assert.equal(records[0].recordStatus, "draft");
    api.close();
  }
);

test(
  "Kaynak filtresi manuel kayıtları seçiyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      profile(),
      aiDraftProfile()
    ]);
    const records = await api.queryRecords({
      sourceKinds: ["manual"],
      includeAiDrafts: true
    });
    assert.equal(records.length, 1);
    assert.equal(records[0].source.kind, "manual");
    api.close();
  }
);

test(
  "Olay tarih aralığı sorgusu dış kayıtları ayıklıyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      hydrationEntry(
        "hydration-morning",
        EVENT
      ),
      hydrationEntry(
        "hydration-evening",
        EVENT_LATER
      )
    ]);
    const records = await api.queryRecords({
      eventFrom:
        "2026-08-05T12:00:00.000Z"
    });
    assert.deepEqual(
      records.map(record => record.id),
      ["hydration-evening"]
    );
    api.close();
  }
);

test(
  "Sorgu artan ve azalan sırayı koruyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      hydrationEntry(
        "hydration-morning",
        EVENT
      ),
      hydrationEntry(
        "hydration-evening",
        EVENT_LATER
      )
    ]);
    const asc = await api.queryRecords();
    const desc = await api.queryRecords({
      sortDirection: "desc"
    });
    assert.deepEqual(
      asc.map(record => record.id),
      ["hydration-morning", "hydration-evening"]
    );
    assert.deepEqual(
      desc.map(record => record.id),
      ["hydration-evening", "hydration-morning"]
    );
    api.close();
  }
);

test(
  "Sorgu offset ve limit uygular",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      profile("nutrition-profile-a"),
      profile("nutrition-profile-b"),
      profile("nutrition-profile-c")
    ]);
    const records = await api.queryRecords({
      offset: 1,
      limit: 1
    });
    assert.equal(records.length, 1);
    assert.equal(records[0].id, "nutrition-profile-b");
    api.close();
  }
);

test(
  "Plan sorgusu tüketim kaydını içermiyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      itemSnapshot(),
      plannedMeal(),
      mealPlan(),
      mealEntry(),
      hydrationEntry()
    ]);
    const records = await api.getPlannedRecords();
    assert.deepEqual(
      records.map(record => record.type).sort(),
      ["meal_plan", "planned_meal"]
    );
    api.close();
  }
);

test(
  "Tüketim sorgusu plan kaydını içermiyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      itemSnapshot(),
      plannedMeal(),
      mealPlan(),
      mealEntry(),
      hydrationEntry()
    ]);
    const records = await api.getConsumedRecords();
    assert.deepEqual(
      records.map(record => record.type).sort(),
      ["hydration_entry", "meal_entry"]
    );
    api.close();
  }
);

test(
  "Bulunmayan kaydı silmek false döndürüyor",
  async () => {
    const { api } = createRuntime();
    assert.equal(
      await api.deleteRecord("missing-record"),
      false
    );
    api.close();
  }
);

test(
  "Başka kayıtça kullanılan referans silinemiyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      itemSnapshot(),
      mealEntry()
    ]);
    await assert.rejects(
      api.deleteRecord(
        "meal-item-snapshot-1"
      ),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-006"
      )
    );
    api.close();
  }
);

test(
  "Bağımlı kayıt kaldırılınca kaynak kayıt silinebiliyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecords([
      itemSnapshot(),
      mealEntry()
    ]);
    assert.equal(
      await api.deleteRecord("meal-entry-1"),
      true
    );
    assert.equal(
      await api.deleteRecord(
        "meal-item-snapshot-1"
      ),
      true
    );
    api.close();
  }
);

test(
  "Manuel yedek kayıtların anlık kopyasını tutuyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    const backup = await api.createBackup(
      "test_backup"
    );
    assert.equal(backup.recordCount, 1);
    assert.equal(backup.records[0].id, "nutrition-profile-1");
    assert.equal(backup.status, "available");
    api.close();
  }
);

test(
  "Yedek listesi hassas kayıt içeriğini döndürmüyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    await api.createBackup("test_backup");
    const backups = await api.listBackups();
    assert.equal(backups.length, 1);
    assert.equal(
      Object.hasOwn(backups[0], "records"),
      false
    );
    api.close();
  }
);

test(
  "Yedekten dönüş önce mevcut durumun kurtarma kopyasını alıyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    const backup = await api.createBackup(
      "before_change"
    );
    await api.saveRecord(
      profile(
        "nutrition-profile-1",
        "detailed"
      )
    );
    const result = await api.restoreBackup(
      backup.id
    );
    assert.equal(result.restoredBackupId, backup.id);
    assert.ok(result.backupId);
    assert.equal(
      (
        await api.getRecord(
          "nutrition-profile-1"
        )
      ).payload.trackingMode,
      "simple"
    );
    api.close();
  }
);

test(
  "Dışa aktarılan anlık görüntü sürüm ve kapsam taşıyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    const snapshot = await api.exportSnapshot();
    assert.equal(
      snapshot.snapshotSchemaId,
      "today:nutrition:storage-snapshot:v1"
    );
    assert.equal(snapshot.contractVersion, 1);
    assert.equal(snapshot.recordCount, 1);
    api.close();
  }
);

test(
  "Geçerli anlık görüntü yeni depoya aktarılabiliyor",
  async () => {
    const source = createRuntime();
    await source.api.saveRecord(profile());
    const snapshot =
      await source.api.exportSnapshot();
    const target = createRuntime();
    await target.api.importSnapshot(snapshot);
    assert.equal(
      (
        await target.api.getRecord(
          "nutrition-profile-1"
        )
      ).id,
      "nutrition-profile-1"
    );
    source.api.close();
    target.api.close();
  }
);

test(
  "Geçersiz anlık görüntü mevcut veriyi değiştirmiyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    await assert.rejects(
      api.importSnapshot({
        snapshotSchemaId: "wrong",
        records: []
      }),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-009"
      )
    );
    assert.equal(
      (await api.getStatus()).recordCount,
      1
    );
    api.close();
  }
);

test(
  "Dışa aktarılan anlık görüntü depo verisini geriye doğru değiştirmiyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    const snapshot = await api.exportSnapshot();
    snapshot.records[0].payload.trackingMode =
      "detailed";
    assert.equal(
      (
        await api.getRecord(
          "nutrition-profile-1"
        )
      ).payload.trackingMode,
      "simple"
    );
    api.close();
  }
);

test(
  "Tam depo değiştirme önce otomatik yedek oluşturuyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    const result = await api.replaceAllRecords([
      profile("nutrition-profile-new")
    ]);
    assert.ok(result.backupId);
    assert.equal(
      await api.getRecord(
        "nutrition-profile-1"
      ),
      null
    );
    assert.ok(
      await api.getRecord(
        "nutrition-profile-new"
      )
    );
    api.close();
  }
);

test(
  "Geçersiz tam depo değiştirme mevcut kaydı koruyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    await assert.rejects(
      api.replaceAllRecords([
        mealEntry()
      ]),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-006"
      )
    );
    assert.ok(
      await api.getRecord(
        "nutrition-profile-1"
      )
    );
    api.close();
  }
);

test(
  "Kapatılıp yeniden açılan depo kayıtları koruyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.saveRecord(profile());
    runtime.api.close();
    await runtime.api.initialize();
    assert.ok(
      await runtime.api.getRecord(
        "nutrition-profile-1"
      )
    );
    runtime.api.close();
  }
);

test(
  "Güncel sözleşmede migration işlemi yinelenmeden atlanıyor",
  async () => {
    const { api } = createRuntime();
    const result = await api.applyMigrationPlan({
      targetVersion: 1,
      migrationId: "noop",
      steps: []
    });
    assert.equal(result.migrated, false);
    assert.equal(result.skipped, true);
    assert.equal(result.backupId, null);
    api.close();
  }
);

test(
  "Etkin sözleşmeyle eşleşmeyen migration hedefi reddediliyor",
  async () => {
    const { api } = createRuntime();
    await assert.rejects(
      api.applyMigrationPlan({
        targetVersion: 2,
        steps: []
      }),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-012"
      )
    );
    api.close();
  }
);

test(
  "Eksik migration adımı veri yazmadan reddediliyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.initialize();
    await updateDatabaseState(runtime, {
      contractVersion: 0
    });
    await assert.rejects(
      runtime.api.applyMigrationPlan({
        targetVersion: 1,
        steps: []
      }),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-011"
      )
    );
    runtime.api.close();
  }
);

test(
  "Boş v0 depo yedekli ve atomik biçimde v1'e geçiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.initialize();
    await updateDatabaseState(runtime, {
      contractVersion: 0
    });
    const result =
      await runtime.api.applyMigrationPlan({
        targetVersion: 1,
        migrationId: "v0-to-v1",
        steps: [
          {
            id: "v0-to-v1",
            fromVersion: 0,
            toVersion: 1,
            migrateRecord(record) {
              return record;
            }
          }
        ]
      });
    assert.equal(result.migrated, true);
    assert.ok(result.backupId);
    assert.equal(
      (await runtime.api.getStatus())
        .storedContractVersion,
      1
    );
    assert.equal(
      (await runtime.api.listBackups())[0]
        .status,
      "applied"
    );
    runtime.api.close();
  }
);

test(
  "Başarısız migration özgün kaydı ve başarısız yedeği koruyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.initialize();
    await directPutRecord(runtime, {
      id: "legacy-record",
      schemaVersion: 0,
      payload: { legacy: true }
    });
    await updateDatabaseState(runtime, {
      contractVersion: 0
    });
    await assert.rejects(
      runtime.api.applyMigrationPlan({
        targetVersion: 1,
        migrationId: "failing",
        steps: [
          {
            id: "failing-step",
            fromVersion: 0,
            toVersion: 1,
            migrateRecord() {
              throw new Error("boom");
            }
          }
        ]
      }),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-011"
      )
    );
    const records = await directRecords(runtime);
    assert.equal(records.length, 1);
    assert.equal(records[0].id, "legacy-record");
    assert.equal(
      (await runtime.api.listBackups())[0]
        .status,
      "failed"
    );
    runtime.api.close();
  }
);

test(
  "Daha yeni sözleşme işaretli depo güvenli biçimde bloke ediliyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.initialize();
    await updateDatabaseState(runtime, {
      contractVersion: 2
    });
    await assert.rejects(
      runtime.api.getStatus(),
      assertTodayCode(
        "TODAY-NUTRITION-STORAGE-012"
      )
    );
    runtime.api.close();
  }
);

test(
  "Durum özeti kayıt, yedek ve migration bilgisini gösteriyor",
  async () => {
    const { api } = createRuntime();
    await api.saveRecord(profile());
    await api.createBackup("status_test");
    const status = await api.getStatus();
    assert.equal(status.recordCount, 1);
    assert.equal(status.backupCount, 1);
    assert.equal(status.migrationRequired, false);
    api.close();
  }
);

test(
  "Yayımlanan storage API değiştirilemiyor",
  async () => {
    const { api } = createRuntime();
    assert.equal(Object.isFrozen(api), true);
    assert.equal(
      Object.isFrozen(api.STORE_NAMES),
      true
    );
    assert.equal(
      Object.isFrozen(api.PLANNED_TYPES),
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
    `Nutrition Storage: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
