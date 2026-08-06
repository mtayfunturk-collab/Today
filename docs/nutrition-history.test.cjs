const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(
  "modules/nutrition-history.js",
  "utf8"
);

const T1 = "2026-08-05T08:00:00.000Z";
const T2 = "2026-08-06T08:00:00.000Z";
const T3 = "2026-08-06T09:00:00.000Z";
const T4 = "2026-08-06T10:00:00.000Z";

function clone(value) {
  return value === undefined
    ? undefined
    : JSON.parse(JSON.stringify(value));
}

function entryRecord(
  id = "meal-entry-1",
  overrides = {}
) {
  const type =
    overrides.type || "meal_entry";

  return {
    id,
    schemaVersion: 1,
    type,
    createdAt: overrides.createdAt || T1,
    updatedAt: overrides.updatedAt || T2,
    eventAt: overrides.eventAt || T2,
    recordStatus:
      overrides.recordStatus || "active",
    knowledgeStatus: "unknown",
    source: clone(
      overrides.source || {
        kind: "manual",
        referenceId: null,
        version: null
      }
    ),
    verificationStatus: "user_confirmed",
    calculationVersion: null,
    userEdited: false,
    payload: clone(
      overrides.payload || (
        type === "hydration_entry"
          ? {
              consumedAt: T2,
              beverageType: "water",
              amount: {
                status: "known",
                value: 250,
                unit: "ml",
                basis: null
              }
            }
          : {
              consumedAt: T2,
              mealType: "breakfast",
              itemSnapshotIds: [],
              coverage: "unspecified",
              plannedMealId: null
            }
      )
    ),
    extensions: clone(
      overrides.extensions || {}
    )
  };
}

function planRecord(
  id = "planned-meal-1"
) {
  return {
    id,
    type: "planned_meal",
    eventAt: T3,
    recordStatus: "active",
    source: { kind: "manual" },
    payload: {
      plannedFor: T3,
      status: "planned",
      itemSnapshotIds: []
    }
  };
}

function confirmation(
  action,
  at = T3,
  operationId = `${action}-operation-1`
) {
  return {
    userInitiated: true,
    userConfirmed: true,
    [
      action === "archive"
        ? "confirmEntryArchive"
        : "confirmEntryRestore"
    ]: true,
    at,
    clientOperationId: operationId
  };
}

function createRuntime(options = {}) {
  const initialRecords =
    options.records || [];
  const records = new Map(
    initialRecords.map(record => [
      record.id,
      clone(record)
    ])
  );
  const entries = clone(
    options.entries || initialRecords
  );
  const plannedMeals = clone(
    options.plannedMeals || []
  );
  const calls = {
    listEntries: [],
    listPlannedMeals: [],
    getRecord: [],
    saveRecord: []
  };
  const window = {
    structuredClone:
      globalThis.structuredClone,
    TodayNutritionEntry: {
      async listEntries(query) {
        calls.listEntries.push(clone(query));

        if (options.failRead) {
          throw Object.assign(
            new Error("read failed"),
            { todayCode: "TEST-READ" }
          );
        }

        return clone(entries);
      }
    },
    TodayNutritionPlanning: {
      async listPlannedMeals(query) {
        calls.listPlannedMeals.push(
          clone(query)
        );
        return clone(plannedMeals);
      }
    },
    TodayNutritionStorage: {
      async getRecord(id, readOptions) {
        calls.getRecord.push({
          id,
          options: clone(readOptions)
        });
        return clone(records.get(id) || null);
      },
      async saveRecord(record, saveOptions) {
        calls.saveRecord.push({
          record: clone(record),
          options: clone(saveOptions)
        });

        if (options.failWrite) {
          throw Object.assign(
            new Error("write failed"),
            { todayCode: "TEST-WRITE" }
          );
        }

        const current = records.get(record.id);
        const expected = saveOptions
          ?.expectedUpdatedAtById
          ?.[record.id];

        if (
          expected !== undefined &&
          current?.updatedAt !== expected
        ) {
          throw Object.assign(
            new Error("conflict"),
            {
              todayCode:
                "TODAY-NUTRITION-STORAGE-009"
            }
          );
        }

        records.set(record.id, clone(record));
        return clone(record);
      }
    }
  };

  if (options.missing) {
    const [api, method] =
      options.missing.split(".");
    delete window[api][method];
  }

  const context = {
    window,
    console,
    Date,
    structuredClone:
      globalThis.structuredClone
  };

  vm.runInNewContext(
    SOURCE,
    context,
    {
      filename:
        "modules/nutrition-history.js"
    }
  );

  return {
    window,
    api: window.TodayNutritionHistory,
    records,
    calls
  };
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test(
  "Geçmiş API'si v1 kimliğiyle değişmez yayımlanıyor",
  () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.HISTORY_API_VERSION,
      1
    );
    assert.equal(
      runtime.api.HISTORY_RULESET_ID,
      "today:nutrition:history:v1"
    );
    assert.ok(Object.isFrozen(runtime.api));
  }
);

test(
  "Tüketim türleri değişmez ve yalnız gerçek kayıtları içeriyor",
  () => {
    const runtime = createRuntime();
    assert.deepEqual(
      [...runtime.api.ENTRY_TYPES],
      ["meal_entry", "hydration_entry"]
    );
    assert.ok(
      Object.isFrozen(runtime.api.ENTRY_TYPES)
    );
  }
);

test(
  "Geçmiş modülü UI, ağ, Core, AI veya fiziksel silme API'si kullanmıyor",
  () => {
    [
      "document.",
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "today_store_v2",
      "TodayAI",
      "TodayConnect",
      ".deleteRecord("
    ].forEach(forbidden => {
      assert.equal(
        SOURCE.includes(forbidden),
        false,
        forbidden
      );
    });
  }
);

test(
  "Modül yüklenirken veri okunmuyor veya yazılmıyor",
  () => {
    const runtime = createRuntime();
    assert.deepEqual(
      Object.values(runtime.calls)
        .map(value => value.length),
      [0, 0, 0, 0]
    );
  }
);

[
  "TodayNutritionEntry.listEntries",
  "TodayNutritionPlanning.listPlannedMeals",
  "TodayNutritionStorage.getRecord",
  "TodayNutritionStorage.saveRecord"
].forEach(missing => {
  test(
    `Eksik ${missing} bağımlılığı açık hata veriyor`,
    async () => {
      const runtime = createRuntime({ missing });
      await assert.rejects(
        runtime.api.loadDay(
          "2026-08-06",
          { now: new Date(T4) }
        ),
        error =>
          error.todayCode ===
            "TODAY-NUTRITION-HISTORY-001" &&
          error.detail.missing.includes(missing)
      );
    }
  );
});

test(
  "Geçerli gün anahtarı aynen normalize ediliyor",
  () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.normalizeDayKey(
        "2026-08-06"
      ),
      "2026-08-06"
    );
  }
);

test(
  "Gün anahtarının yalnız kenar boşlukları temizleniyor",
  () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.normalizeDayKey(
        " 2026-08-06 "
      ),
      "2026-08-06"
    );
  }
);

test(
  "Biçimi yanlış gün anahtarı reddediliyor",
  () => {
    const runtime = createRuntime();
    assert.throws(
      () => runtime.api.normalizeDayKey(
        "06.08.2026"
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-002"
    );
  }
);

test(
  "Takvimde olmayan gün reddediliyor",
  () => {
    const runtime = createRuntime();
    assert.throws(
      () => runtime.api.normalizeDayKey(
        "2026-02-30"
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-002"
    );
  }
);

test(
  "Artık yılın 29 Şubat günü kabul ediliyor",
  () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.normalizeDayKey(
        "2028-02-29"
      ),
      "2028-02-29"
    );
  }
);

test(
  "Yerel tarih gün anahtarına saat dilimi kaydırılmadan çevriliyor",
  () => {
    const runtime = createRuntime();
    const local = new Date(
      2026,
      7,
      6,
      1,
      30
    );
    assert.equal(
      runtime.api.dayKeyFromDate(local),
      "2026-08-06"
    );
  }
);

test(
  "Geçersiz Date gün anahtarına çevrilemiyor",
  () => {
    const runtime = createRuntime();
    assert.throws(
      () => runtime.api.dayKeyFromDate(
        new Date("invalid")
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-002"
    );
  }
);

test(
  "Gün aralığı aynı yerel günün başlangıç ve bitişini kapsıyor",
  () => {
    const runtime = createRuntime();
    const range = runtime.api.dayRange(
      "2026-08-06"
    );
    assert.ok(range.start < range.end);
    assert.equal(
      new Date(range.start).getDate(),
      6
    );
    assert.equal(
      new Date(range.end).getDate(),
      6
    );
  }
);

test(
  "Gün aralığı dışarıdan değiştirilemiyor",
  () => {
    const runtime = createRuntime();
    assert.ok(
      Object.isFrozen(
        runtime.api.dayRange("2026-08-06")
      )
    );
  }
);

test(
  "Bugün karşılaştırması yerel gün anahtarını kullanıyor",
  () => {
    const runtime = createRuntime();
    const now = new Date(
      2026,
      7,
      6,
      22,
      30
    );
    assert.equal(
      runtime.api.isToday(
        "2026-08-06",
        now
      ),
      true
    );
  }
);

test(
  "Önceki gün ay sınırını doğru geçiyor",
  () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.shiftDay(
        "2026-08-01",
        -1
      ),
      "2026-07-31"
    );
  }
);

test(
  "Gün kaydırma artık yıl sınırını doğru geçiyor",
  () => {
    const runtime = createRuntime();
    assert.equal(
      runtime.api.shiftDay(
        "2028-02-28",
        1
      ),
      "2028-02-29"
    );
  }
);

test(
  "Geleceğe kaydırma istendiğinde bugün sınırında kalıyor",
  () => {
    const runtime = createRuntime();
    const now = new Date(
      2026,
      7,
      6,
      12
    );
    assert.equal(
      runtime.api.shiftDay(
        "2026-08-06",
        1,
        { preventFuture: true, now }
      ),
      "2026-08-06"
    );
  }
);

test(
  "Kesirli gün kaydırma reddediliyor",
  () => {
    const runtime = createRuntime();
    assert.throws(
      () => runtime.api.shiftDay(
        "2026-08-06",
        1.5
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-002"
    );
  }
);

test(
  "Gün yükleme tüketim ve plan sorgularını aynı aralıkla yapıyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.loadDay(
      "2026-08-06",
      { now: new Date(T4) }
    );
    const entryQuery =
      runtime.calls.listEntries[0];
    const planQuery =
      runtime.calls.listPlannedMeals[0];
    assert.equal(
      entryQuery.eventFrom,
      planQuery.from
    );
    assert.equal(
      entryQuery.eventTo,
      planQuery.to
    );
  }
);

test(
  "Gün yükleme tüketimi azalan planı artan sırada ister",
  async () => {
    const runtime = createRuntime();
    await runtime.api.loadDay(
      "2026-08-06",
      { now: new Date(T4) }
    );
    assert.equal(
      runtime.calls.listEntries[0]
        .sortDirection,
      "desc"
    );
    assert.equal(
      runtime.calls.listPlannedMeals[0]
        .sortDirection,
      "asc"
    );
  }
);

test(
  "Gün yükleme 500 kayıt sınırını açık gönderiyor",
  async () => {
    const runtime = createRuntime();
    await runtime.api.loadDay(
      "2026-08-06",
      { now: new Date(T4) }
    );
    assert.equal(
      runtime.calls.listEntries[0].limit,
      500
    );
  }
);

test(
  "Etkin ve arşivlenmiş tüketimler ayrı listeleniyor",
  async () => {
    const runtime = createRuntime({
      entries: [
        entryRecord("meal-active"),
        entryRecord("water-archived", {
          type: "hydration_entry",
          recordStatus: "archived"
        })
      ]
    });
    const day = await runtime.api.loadDay(
      "2026-08-06",
      { now: new Date(T4) }
    );
    assert.deepEqual(
      day.entries.map(record => record.id),
      ["meal-active"]
    );
    assert.deepEqual(
      day.archivedEntries.map(
        record => record.id
      ),
      ["water-archived"]
    );
  }
);

test(
  "AI taslağı gün geçmişine karıştırılmıyor",
  async () => {
    const runtime = createRuntime({
      entries: [
        entryRecord("ai-draft", {
          recordStatus: "draft",
          source: {
            kind: "ai_draft",
            referenceId: "ai-request",
            version: "ai-v1"
          }
        })
      ]
    });
    const day = await runtime.api.loadDay(
      "2026-08-06",
      { now: new Date(T4) }
    );
    assert.equal(day.entries.length, 0);
    assert.equal(
      day.archivedEntries.length,
      0
    );
  }
);

test(
  "Plan kayıtları tüketimden ayrı korunuyor",
  async () => {
    const runtime = createRuntime({
      plannedMeals: [planRecord()]
    });
    const day = await runtime.api.loadDay(
      "2026-08-06",
      { now: new Date(T4) }
    );
    assert.equal(day.entries.length, 0);
    assert.equal(day.plannedMeals.length, 1);
  }
);

test(
  "Yüklenen gün sonucu derin değişmez dönüyor",
  async () => {
    const runtime = createRuntime({
      entries: [entryRecord()]
    });
    const day = await runtime.api.loadDay(
      "2026-08-06",
      { now: new Date(T4) }
    );
    assert.ok(Object.isFrozen(day));
    assert.ok(Object.isFrozen(day.entries));
    assert.ok(Object.isFrozen(day.entries[0]));
  }
);

test(
  "Gelecek gün geçmiş olarak açılamıyor",
  async () => {
    const runtime = createRuntime();
    await assert.rejects(
      runtime.api.loadDay(
        "2026-08-07",
        { now: new Date(T4) }
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-003"
    );
  }
);

test(
  "Açık teknik seçenek gelecek gün plan okumasına izin veriyor",
  async () => {
    const runtime = createRuntime();
    const day = await runtime.api.loadDay(
      "2026-08-07",
      {
        now: new Date(T4),
        allowFuture: true
      }
    );
    assert.equal(day.dayKey, "2026-08-07");
  }
);

test(
  "Okuma hatası mevcut hata kodunu koruyor",
  async () => {
    const runtime = createRuntime({
      failRead: true
    });
    await assert.rejects(
      runtime.api.loadDay(
        "2026-08-06",
        { now: new Date(T4) }
      ),
      error => error.todayCode === "TEST-READ"
    );
  }
);

test(
  "Arşivleme kullanıcı başlatması olmadan çalışmıyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    assert.throws(
      () => runtime.api.archiveEntry(
        "meal-entry-1",
        {
          ...confirmation("archive"),
          userInitiated: false
        }
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-005"
    );
  }
);

test(
  "Arşivleme özel onay olmadan çalışmıyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    assert.throws(
      () => runtime.api.archiveEntry(
        "meal-entry-1",
        {
          ...confirmation("archive"),
          confirmEntryArchive: false
        }
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-005"
    );
  }
);

test(
  "Geçersiz tüketim kimliği veri okunmadan reddediliyor",
  async () => {
    const runtime = createRuntime();
    await assert.rejects(
      runtime.api.archiveEntry(
        "BAD ID",
        confirmation("archive")
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-004"
    );
    assert.equal(
      runtime.calls.getRecord.length,
      0
    );
  }
);

test(
  "Bulunmayan tüketim kaydı arşivlenmiyor",
  async () => {
    const runtime = createRuntime();
    await assert.rejects(
      runtime.api.archiveEntry(
        "meal-entry-missing",
        confirmation("archive")
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-006"
    );
  }
);

test(
  "Plan kaydı tüketim düzeltmesi olarak arşivlenmiyor",
  async () => {
    const runtime = createRuntime({
      records: [planRecord()]
    });
    await assert.rejects(
      runtime.api.archiveEntry(
        "planned-meal-1",
        confirmation("archive")
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-006"
    );
  }
);

test(
  "AI taslağı gerçek tüketim düzeltmesine alınmıyor",
  async () => {
    const runtime = createRuntime({
      records: [
        entryRecord("ai-entry", {
          recordStatus: "draft",
          source: {
            kind: "ai_draft",
            referenceId: "ai-request",
            version: "ai-v1"
          }
        })
      ]
    });
    await assert.rejects(
      runtime.api.archiveEntry(
        "ai-entry",
        confirmation("archive")
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-006"
    );
  }
);

test(
  "Etkin öğün kaydı fiziksel silinmeden arşivleniyor",
  async () => {
    const original = entryRecord();
    const runtime = createRuntime({
      records: [original]
    });
    const archived =
      await runtime.api.archiveEntry(
        original.id,
        confirmation("archive")
      );
    assert.equal(
      archived.recordStatus,
      "archived"
    );
    assert.equal(
      runtime.records.has(original.id),
      true
    );
  }
);

test(
  "Arşivleme tüketim zamanı, payload, kaynak ve oluşturma zamanını koruyor",
  async () => {
    const original = entryRecord();
    const runtime = createRuntime({
      records: [original]
    });
    const archived =
      await runtime.api.archiveEntry(
        original.id,
        confirmation("archive")
      );
    assert.equal(
      archived.createdAt,
      original.createdAt
    );
    assert.equal(
      archived.eventAt,
      original.eventAt
    );
    assert.deepEqual(
      archived.payload,
      original.payload
    );
    assert.deepEqual(
      archived.source,
      original.source
    );
  }
);

test(
  "Arşivleme kullanıcı düzeltmesi denetim izi ekliyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    const archived =
      await runtime.api.archiveEntry(
        "meal-entry-1",
        confirmation("archive")
      );
    const history = archived.extensions[
      runtime.api.HISTORY_EXTENSION_KEY
    ];
    assert.equal(
      history.rulesetId,
      runtime.api.HISTORY_RULESET_ID
    );
    assert.deepEqual(
      history.events[0],
      {
        action: "archive",
        at: T3,
        actor: "user",
        reason: "user_correction",
        clientOperationId:
          "archive-operation-1"
      }
    );
  }
);

test(
  "Arşivleme iyimser updatedAt korumasıyla yazılıyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    await runtime.api.archiveEntry(
      "meal-entry-1",
      confirmation("archive")
    );
    assert.deepEqual(
      runtime.calls.saveRecord[0]
        .options.expectedUpdatedAtById,
      { "meal-entry-1": T2 }
    );
  }
);

test(
  "Eski zamanlı arşivleme daha yeni kaydı değiştirmiyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    await assert.rejects(
      runtime.api.archiveEntry(
        "meal-entry-1",
        confirmation("archive", T1)
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-007"
    );
    assert.equal(
      runtime.calls.saveRecord.length,
      0
    );
  }
);

test(
  "Aynı işlem kimliğiyle yinelenen arşivleme idempotent kalıyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    await runtime.api.archiveEntry(
      "meal-entry-1",
      confirmation("archive")
    );
    const second =
      await runtime.api.archiveEntry(
        "meal-entry-1",
        confirmation("archive")
      );
    assert.equal(
      runtime.calls.saveRecord.length,
      1
    );
    assert.equal(
      second.recordStatus,
      "archived"
    );
  }
);

test(
  "Farklı işlemle ikinci arşivleme reddediliyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    await runtime.api.archiveEntry(
      "meal-entry-1",
      confirmation("archive")
    );
    await assert.rejects(
      runtime.api.archiveEntry(
        "meal-entry-1",
        confirmation(
          "archive",
          T4,
          "archive-operation-2"
        )
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-009"
    );
  }
);

test(
  "Depolama arşivleme hatası mevcut hata kodunu koruyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()],
      failWrite: true
    });
    await assert.rejects(
      runtime.api.archiveEntry(
        "meal-entry-1",
        confirmation("archive")
      ),
      error => error.todayCode === "TEST-WRITE"
    );
  }
);

test(
  "Geri alma özel kullanıcı onayı olmadan çalışmıyor",
  async () => {
    const runtime = createRuntime({
      records: [
        entryRecord("meal-entry-1", {
          recordStatus: "archived"
        })
      ]
    });
    assert.throws(
      () => runtime.api.restoreEntry(
        "meal-entry-1",
        {
          ...confirmation("restore"),
          confirmEntryRestore: false
        }
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-005"
    );
  }
);

test(
  "Bu akışta arşivlenmeyen kayıt geri alınamıyor",
  async () => {
    const runtime = createRuntime({
      records: [
        entryRecord("meal-entry-1", {
          recordStatus: "archived"
        })
      ]
    });
    await assert.rejects(
      runtime.api.restoreEntry(
        "meal-entry-1",
        confirmation("restore")
      ),
      error =>
        error.todayCode ===
          "TODAY-NUTRITION-HISTORY-010"
    );
  }
);

test(
  "Arşivlenen kayıt açık onayla yeniden etkinleşiyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    await runtime.api.archiveEntry(
      "meal-entry-1",
      confirmation("archive", T3)
    );
    const restored =
      await runtime.api.restoreEntry(
        "meal-entry-1",
        confirmation("restore", T4)
      );
    assert.equal(
      restored.recordStatus,
      "active"
    );
  }
);

test(
  "Geri alma arşiv ve geri alma olaylarını sıralı koruyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    await runtime.api.archiveEntry(
      "meal-entry-1",
      confirmation("archive", T3)
    );
    const restored =
      await runtime.api.restoreEntry(
        "meal-entry-1",
        confirmation("restore", T4)
      );
    const events = restored.extensions[
      runtime.api.HISTORY_EXTENSION_KEY
    ].events;
    assert.deepEqual(
      events.map(event => event.action),
      ["archive", "restore"]
    );
  }
);

test(
  "Aynı işlem kimliğiyle yinelenen geri alma idempotent kalıyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    await runtime.api.archiveEntry(
      "meal-entry-1",
      confirmation("archive", T3)
    );
    await runtime.api.restoreEntry(
      "meal-entry-1",
      confirmation("restore", T4)
    );
    const again =
      await runtime.api.restoreEntry(
        "meal-entry-1",
        confirmation("restore", T4)
      );
    assert.equal(
      again.recordStatus,
      "active"
    );
    assert.equal(
      runtime.calls.saveRecord.length,
      2
    );
  }
);

test(
  "Arşivle ve geri al döngüsü tüketim payloadını değiştirmiyor",
  async () => {
    const original = entryRecord();
    const runtime = createRuntime({
      records: [original]
    });
    await runtime.api.archiveEntry(
      original.id,
      confirmation("archive", T3)
    );
    const restored =
      await runtime.api.restoreEntry(
        original.id,
        confirmation("restore", T4)
      );
    assert.deepEqual(
      restored.payload,
      original.payload
    );
    assert.equal(
      restored.eventAt,
      original.eventAt
    );
  }
);

test(
  "Geçmiş olay listesi güvenlik sınırında son 100 işlemi tutuyor",
  async () => {
    const previousEvents = Array.from(
      { length: 100 },
      (_, index) => ({
        action:
          index % 2 === 0
            ? "archive"
            : "restore",
        at: T1,
        actor: "user",
        reason: "test",
        clientOperationId: `old-${index}`
      })
    );
    const runtime = createRuntime({
      records: [
        entryRecord("meal-entry-1", {
          extensions: {
            "today.nutrition.history": {
              rulesetId:
                "today:nutrition:history:v1",
              events: previousEvents
            }
          }
        })
      ]
    });
    const archived =
      await runtime.api.archiveEntry(
        "meal-entry-1",
        confirmation("archive")
      );
    const events = archived.extensions[
      runtime.api.HISTORY_EXTENSION_KEY
    ].events;
    assert.equal(events.length, 100);
    assert.equal(
      events.at(-1).clientOperationId,
      "archive-operation-1"
    );
  }
);

test(
  "Arşivleme ve geri alma sonuçları derin değişmez dönüyor",
  async () => {
    const runtime = createRuntime({
      records: [entryRecord()]
    });
    const archived =
      await runtime.api.archiveEntry(
        "meal-entry-1",
        confirmation("archive", T3)
      );
    const restored =
      await runtime.api.restoreEntry(
        "meal-entry-1",
        confirmation("restore", T4)
      );
    assert.ok(Object.isFrozen(archived));
    assert.ok(Object.isFrozen(archived.payload));
    assert.ok(Object.isFrozen(restored));
    assert.ok(Object.isFrozen(restored.extensions));
  }
);

async function run() {
  const results = [];

  for (const entry of tests) {
    try {
      await entry.callback();
      results.push({
        name: entry.name,
        success: true
      });
    } catch (error) {
      results.push({
        name: entry.name,
        success: false,
        error:
          `${error?.stack || error?.message || error}${
            error?.todayCode
              ? ` [${error.todayCode}]`
              : ""
          }`
      });
    }
  }

  results.forEach(result => {
    const prefix = result.success
      ? "PASS"
      : "FAIL";
    const suffix = result.error
      ? ` — ${result.error}`
      : "";

    console.log(
      `${prefix}: ${result.name}${suffix}`
    );
  });

  const failed = results.filter(
    result => !result.success
  );

  console.log(
    `Nutrition History: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run();
