const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE_PATH =
  "modules/migration.js";
const source = fs.readFileSync(
  SOURCE_PATH,
  "utf8"
);

function clone(value) {
  return value === undefined
    ? undefined
    : JSON.parse(JSON.stringify(value));
}

function createStore(overrides = {}) {
  return {
    schemaVersion: 2,
    appVersion: "2.0.0",
    createdAt:
      "2026-07-30T10:00:00.000Z",
    updatedAt:
      "2026-07-30T10:00:00.000Z",
    metadata: {
      language: "tr-TR",
      timezone: "Europe/Istanbul",
      platform: "web"
    },
    settings: {
      theme: "system"
    },
    days: {},
    usage: {},
    migration: {
      completed: false,
      sourceKeys: [],
      migratedAt: null,
      migratedDayCount: 0
    },
    ...clone(overrides)
  };
}

class MockLocalStorage {
  constructor(entries = {}) {
    this.values = new Map(
      Object.entries(entries).map(
        ([key, value]) => [
          key,
          typeof value === "string"
            ? value
            : JSON.stringify(value)
        ]
      )
    );
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return (
      [...this.values.keys()][index] ??
      null
    );
  }

  getItem(key) {
    return this.values.has(key)
      ? this.values.get(key)
      : null;
  }

  setItem(key, value) {
    this.values.set(
      String(key),
      String(value)
    );
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function createRuntime(options = {}) {
  const storageKey =
    "today_store_v2";
  const backupKey =
    "today_store_v2_backup";
  const initialStore =
    options.store ||
    createStore();
  const initialEntries = {
    [storageKey]: initialStore,
    ...(options.entries || {})
  };
  const localStorage =
    new MockLocalStorage(initialEntries);
  const calls = {
    load: 0,
    save: 0,
    backup: 0,
    restore: 0
  };
  const events = [];

  const storageSchemaVersion =
    options.storageSchemaVersion ?? 2;
  const versionSchemaVersion =
    options.versionSchemaVersion ?? 2;
  const storageAppVersion =
    options.storageAppVersion ??
    "2.0.0";
  const versionAppVersion =
    options.versionAppVersion ??
    "2.0.0";

  const storageApi = {
    STORAGE_KEY: storageKey,
    BACKUP_KEY: backupKey,
    SCHEMA_VERSION:
      storageSchemaVersion,
    APP_VERSION: storageAppVersion,

    loadStore() {
      calls.load += 1;

      const raw =
        localStorage.getItem(
          storageKey
        );
      const parsed = raw
        ? JSON.parse(raw)
        : null;

      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.days &&
        typeof parsed.days ===
          "object"
      ) {
        return clone(parsed);
      }

      const backupRaw =
        localStorage.getItem(
          backupKey
        );
      const backup = backupRaw
        ? JSON.parse(backupRaw)
        : null;

      if (
        backup &&
        typeof backup === "object" &&
        backup.days &&
        typeof backup.days ===
          "object"
      ) {
        localStorage.setItem(
          storageKey,
          backupRaw
        );
        return clone(backup);
      }

      const empty =
        createStore({
          schemaVersion:
            storageSchemaVersion,
          appVersion:
            storageAppVersion
        });

      localStorage.setItem(
        storageKey,
        JSON.stringify(empty)
      );

      return clone(empty);
    },

    saveStore(store, saveOptions = {}) {
      calls.save += 1;

      if (
        saveOptions.backup !== false
      ) {
        this.createBackup();
      }

      if (options.saveThrows) {
        throw new Error(
          "save failed"
        );
      }

      const saved = {
        ...clone(store),
        schemaVersion:
          storageSchemaVersion,
        appVersion:
          storageAppVersion,
        updatedAt:
          "2026-07-30T12:00:00.000Z"
      };

      if (options.corruptAfterSave) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            schemaVersion:
              storageSchemaVersion,
            days: {}
          })
        );
      } else {
        localStorage.setItem(
          storageKey,
          JSON.stringify(saved)
        );
      }

      return clone(saved);
    },

    createBackup() {
      calls.backup += 1;

      if (options.backupFails) {
        return false;
      }

      const raw =
        localStorage.getItem(
          storageKey
        );

      if (!raw) {
        return false;
      }

      localStorage.setItem(
        backupKey,
        raw
      );
      return true;
    },

    restoreBackup() {
      calls.restore += 1;

      if (options.restoreThrows) {
        throw new Error(
          "restore failed"
        );
      }

      const raw =
        localStorage.getItem(
          backupKey
        );

      if (!raw) {
        return {
          success: false
        };
      }

      localStorage.setItem(
        storageKey,
        raw
      );

      return {
        success: true,
        store: JSON.parse(raw)
      };
    }
  };

  if (options.missingStorageMethod) {
    storageApi[
      options.missingStorageMethod
    ] = undefined;
  }

  const versionApi = {
    APP_VERSION: versionAppVersion,
    SCHEMA_VERSION:
      versionSchemaVersion,

    inspectStore(store) {
      if (
        !store ||
        typeof store !== "object"
      ) {
        return {
          valid: false,
          migrationRequired: true
        };
      }

      const currentSchema =
        Number(
          store.schemaVersion || 0
        );

      return {
        valid: true,
        currentSchemaVersion:
          currentSchema,
        targetSchemaVersion:
          versionSchemaVersion,
        migrationRequired:
          currentSchema <
          versionSchemaVersion,
        schemaIsNewerThanApp:
          currentSchema >
          versionSchemaVersion
      };
    },

    stampStore(store) {
      return {
        ...clone(store),
        schemaVersion:
          versionSchemaVersion,
        appVersion:
          versionAppVersion,
        updatedAt:
          "2026-07-30T11:00:00.000Z"
      };
    }
  };

  const window = {
    localStorage,
    TodayStorage: storageApi,
    TodayVersion: versionApi,
    structuredClone:
      globalThis.structuredClone,
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    }
  };

  const context = {
    window,
    console: {
      info() {},
      warn() {},
      error() {}
    },
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    Set
  };

  vm.runInNewContext(
    source,
    context,
    {
      filename: SOURCE_PATH
    }
  );

  return {
    window,
    api: window.TodayMigration,
    localStorage,
    storageApi,
    versionApi,
    calls,
    events,
    readStore() {
      return JSON.parse(
        localStorage.getItem(
          storageKey
        )
      );
    },
    readBackup() {
      const raw =
        localStorage.getItem(
          backupKey
        );
      return raw
        ? JSON.parse(raw)
        : null;
    }
  };
}

const results = [];

function test(name, callback) {
  try {
    callback();
    results.push({
      name,
      success: true
    });
  } catch (error) {
    results.push({
      name,
      success: false,
      error: error.message
    });
  }
}

test(
  "Genel API, legacy anahtarları ve şema adımları değişmez yayımlanıyor",
  () => {
    const runtime = createRuntime();
    const api = runtime.api;

    assert.ok(api);
    assert.equal(
      Object.isFrozen(api),
      true
    );
    assert.equal(
      api.ORCHESTRATOR_VERSION,
      1
    );
    assert.equal(
      Object.isFrozen(
        api.KNOWN_LEGACY_KEYS
      ),
      true
    );
    assert.deepEqual(
      [...api.getStepDefinitions()]
        .map(step => step.id),
      [
        "schema-0-to-1",
        "schema-1-to-2"
      ]
    );
  }
);

test(
  "Storage ve Version sözleşmeleri aynı sürümlerdeyse bağımlılıklar geçiyor",
  () => {
    const validation =
      createRuntime().api
        .validateDependencies();

    assert.equal(
      validation.valid,
      true
    );
    assert.equal(
      validation.targetSchemaVersion,
      2
    );
    assert.equal(
      validation.appVersion,
      "2.0.0"
    );
  }
);

test(
  "Eksik Storage API üyesi tam adıyla reddediliyor",
  () => {
    const validation =
      createRuntime({
        missingStorageMethod:
          "restoreBackup"
      }).api.validateDependencies();

    assert.equal(
      validation.valid,
      false
    );
    assert.ok(
      validation
        .missingDependencies
        .includes(
          "TodayStorage.restoreBackup"
        )
    );
  }
);

test(
  "Storage ve Version şema uyuşmazlığı geçişi engelliyor",
  () => {
    const runtime = createRuntime({
      storageSchemaVersion: 2,
      versionSchemaVersion: 1
    });
    const result =
      runtime.api.run();

    assert.equal(
      result.success,
      false
    );
    assert.equal(
      result.errorCode,
      "TODAY-MIGRATION-001"
    );
    assert.equal(
      runtime.calls.backup,
      0
    );
    assert.equal(
      runtime.calls.save,
      0
    );
  }
);

test(
  "Storage ve Version uygulama sürümü uyuşmazlığı geçişi engelliyor",
  () => {
    const result =
      createRuntime({
        storageAppVersion:
          "2.0.0",
        versionAppVersion:
          "2.1.0"
      }).api.run();

    assert.equal(
      result.success,
      false
    );
    assert.equal(
      result.phase,
      "dependencies"
    );
  }
);

test(
  "Güncel ve tamamlanmış store için plan değişiklik istemiyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        migration: {
          completed: true,
          sourceKeys: [],
          migratedAt:
            "2026-07-29T10:00:00.000Z",
          migratedDayCount: 0
        }
      })
    });
    const plan =
      runtime.api.inspect();

    assert.equal(
      plan.success,
      true
    );
    assert.equal(
      plan.required,
      false
    );
    assert.deepEqual(
      [...plan.appliedSteps],
      []
    );
    assert.equal(
      runtime.calls.backup,
      0
    );
    assert.equal(
      runtime.calls.save,
      0
    );
  }
);

test(
  "Inspect bilinen legacy kaynaklarını yalnız metadata olarak bildiriyor",
  () => {
    const runtime = createRuntime({
      entries: {
        today_app_v10: {
          v: 10,
          days: {
            "2026-07-29": {
              choice: "B",
              note:
                "Özel kullanıcı notu"
            }
          }
        }
      }
    });
    const sources =
      runtime.api
        .inspectLegacySources();

    assert.deepEqual(
      [...sources].map(source => ({
        key: source.key,
        dayCount:
          source.dayCount
      })),
      [
        {
          key: "today_app_v10",
          dayCount: 1
        }
      ]
    );
    assert.equal(
      JSON.stringify(sources)
        .includes(
          "Özel kullanıcı notu"
        ),
      false
    );
  }
);

test(
  "Bilinmeyen localStorage anahtarı tarih haritası taşısa da taranmıyor",
  () => {
    const runtime = createRuntime({
      entries: {
        unrelated_app: {
          "2026-07-29": {
            choice: "C"
          }
        }
      }
    });

    assert.deepEqual(
      [
        ...runtime.api
          .inspectLegacySources()
      ],
      []
    );
  }
);

test(
  "Tamamlanmış güncel store tekrar yazılmadan atlanıyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        migration: {
          completed: true,
          sourceKeys: [],
          migratedAt:
            "2026-07-29T10:00:00.000Z"
        }
      })
    });
    const result =
      runtime.api.run();

    assert.equal(
      result.success,
      true
    );
    assert.equal(
      result.skipped,
      true
    );
    assert.equal(
      result.migrated,
      false
    );
    assert.equal(
      runtime.calls.backup,
      0
    );
    assert.equal(
      runtime.calls.save,
      0
    );
  }
);

test(
  "Legacy kaynak yoksa migration bayrağı tek yedek ve tek kayıtla tamamlanıyor",
  () => {
    const runtime = createRuntime();
    const original =
      runtime.readStore();
    const result =
      runtime.api.run();
    const saved =
      runtime.readStore();

    assert.equal(
      result.success,
      true
    );
    assert.equal(
      result.migrated,
      true
    );
    assert.equal(
      result.migratedDayCount,
      0
    );
    assert.equal(
      runtime.calls.backup,
      1
    );
    assert.equal(
      runtime.calls.save,
      1
    );
    assert.equal(
      runtime.readBackup()
        .migration.completed,
      original.migration.completed
    );
    assert.equal(
      saved.migration.completed,
      true
    );
  }
);

test(
  "today_app_v10 seçimi, rengi, notu ve değişiklik kaydı v2 store'a taşınıyor",
  () => {
    const runtime = createRuntime({
      entries: {
        today_app_v10: {
          v: 10,
          theme: "dark",
          days: {
            "2026-07-29": {
              choice:
                "Her şey çok net",
              color: "mavi",
              note: "Bugün netti"
            }
          },
          logs: {
            "2026-07-29": {
              changes: [
                {
                  t:
                    "2026-07-29T18:00:00.000Z",
                  what:
                    "choice"
                }
              ]
            }
          }
        }
      }
    });

    const result =
      runtime.api.run();
    const saved =
      runtime.readStore();
    const day =
      saved.days["2026-07-29"];

    assert.equal(
      result.migratedDayCount,
      1
    );
    assert.equal(day.choice, "B");
    assert.equal(day.color, "blue");
    assert.equal(
      day.note,
      "Bugün netti"
    );
    assert.equal(
      day.changeLog.length,
      1
    );
    assert.equal(
      saved.settings.theme,
      "dark"
    );
  }
);

test(
  "Mevcut v2 alanları legacy değerlerden öncelikli kalıyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        days: {
          "2026-07-29": {
            choice: "A",
            color: "deep",
            note: "V2 notu",
            changeCount: 0,
            changeLog: []
          }
        }
      }),
      entries: {
        today_app_v10: {
          days: {
            "2026-07-29": {
              choice: "C",
              color: "red",
              note: "Legacy not"
            }
          }
        }
      }
    });

    runtime.api.run();

    const day =
      runtime.readStore()
        .days["2026-07-29"];

    assert.equal(day.choice, "A");
    assert.equal(day.color, "deep");
    assert.equal(
      day.note,
      "V2 notu"
    );
  }
);

test(
  "V2 içinde bilinçli boşaltılmış alanlar legacy veriden yeniden doldurulmuyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        days: {
          "2026-07-29": {
            choice: "",
            color: "",
            note: "",
            changeCount: 0,
            changeLog: []
          }
        }
      }),
      entries: {
        today_app_v10: {
          days: {
            "2026-07-29": {
              choice: "C",
              color: "red",
              note: "Geri gelmemeli"
            }
          }
        }
      }
    });

    runtime.api.run();

    const day =
      runtime.readStore()
        .days["2026-07-29"];

    assert.equal(day.choice, "");
    assert.equal(day.color, "");
    assert.equal(day.note, "");
  }
);

test(
  "Aynı değişiklik kayıtları yinelenmeden birleştiriliyor",
  () => {
    const change = {
      timestamp:
        "2026-07-29T18:00:00.000Z",
      type: "choice",
      description: "choice"
    };
    const runtime = createRuntime({
      store: createStore({
        days: {
          "2026-07-29": {
            choice: "B",
            color: "blue",
            note: "",
            changeCount: 1,
            changeLog: [change]
          }
        }
      }),
      entries: {
        today_data_v10: {
          days: {
            "2026-07-29": {
              choice: "B",
              changeLog: [change]
            }
          }
        }
      }
    });

    runtime.api.run();

    const day =
      runtime.readStore()
        .days["2026-07-29"];

    assert.equal(
      day.changeLog.length,
      1
    );
    assert.equal(
      day.changeCount,
      1
    );
  }
);

test(
  "Legacy anahtarları başarılı geçişten sonra silinmiyor",
  () => {
    const runtime = createRuntime({
      entries: {
        today_data: {
          "2026-07-29": {
            choice: "A"
          }
        }
      }
    });
    const before =
      runtime.localStorage.getItem(
        "today_data"
      );

    runtime.api.run();

    assert.equal(
      runtime.localStorage.getItem(
        "today_data"
      ),
      before
    );
  }
);

test(
  "Şema 1 store yalnız schema-1-to-2 adımıyla yükseltiliyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        schemaVersion: 1,
        migration: {
          completed: true,
          sourceKeys: [
            "today_app_v10"
          ],
          migratedDayCount: 1
        }
      })
    });
    const result =
      runtime.api.run();
    const saved =
      runtime.readStore();

    assert.deepEqual(
      [...result.appliedSteps],
      ["schema-1-to-2"]
    );
    assert.equal(
      saved.schemaVersion,
      2
    );
    assert.deepEqual(
      saved.migration.sourceKeys,
      ["today_app_v10"]
    );
  }
);

test(
  "Şema 0 store iki sıralı adımla hedef şemaya yükseltiliyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        schemaVersion: 0,
        appVersion: "0.0.0",
        migration: {
          completed: true
        }
      })
    });
    const result =
      runtime.api.run();

    assert.deepEqual(
      [...result.appliedSteps],
      [
        "schema-0-to-1",
        "schema-1-to-2"
      ]
    );
    assert.equal(
      runtime.readStore()
        .schemaVersion,
      2
    );
  }
);

test(
  "Bilinmeyen kök ve günlük alanları şema geçişinde korunuyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        schemaVersion: 1,
        futureRoot: {
          keep: true
        },
        days: {
          "2026-07-29": {
            choice: "B",
            customField:
              "korunmalı"
          }
        },
        migration: {
          completed: true
        }
      })
    });

    runtime.api.run();

    const saved =
      runtime.readStore();

    assert.deepEqual(
      saved.futureRoot,
      {
        keep: true
      }
    );
    assert.equal(
      saved.days["2026-07-29"]
        .customField,
      "korunmalı"
    );
  }
);

test(
  "Uygulamadan yeni şema hiçbir yazma yapmadan engelleniyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        schemaVersion: 3,
        migration: {
          completed: true
        }
      })
    });
    const before =
      runtime.localStorage.getItem(
        "today_store_v2"
      );
    const result =
      runtime.api.run();

    assert.equal(
      result.success,
      false
    );
    assert.equal(
      result.errorCode,
      "TODAY-MIGRATION-003"
    );
    assert.equal(
      runtime.calls.backup,
      0
    );
    assert.equal(
      runtime.calls.save,
      0
    );
    assert.equal(
      runtime.localStorage.getItem(
        "today_store_v2"
      ),
      before
    );
  }
);

test(
  "Kayıt hatasında migration yedeği geri yükleniyor",
  () => {
    const original =
      createStore({
        days: {
          "2026-07-28": {
            choice: "A"
          }
        }
      });
    const runtime = createRuntime({
      store: original,
      saveThrows: true
    });
    const result =
      runtime.api.run();

    assert.equal(
      result.success,
      false
    );
    assert.equal(
      result.rolledBack,
      true
    );
    assert.equal(
      runtime.calls.restore,
      1
    );
    assert.deepEqual(
      runtime.readStore(),
      original
    );
  }
);

test(
  "Kayıt sonrası doğrulama başarısızsa ana veri yedekten geri alınıyor",
  () => {
    const original =
      createStore({
        days: {
          "2026-07-28": {
            choice: "C"
          }
        }
      });
    const runtime = createRuntime({
      store: original,
      corruptAfterSave: true
    });
    const result =
      runtime.api.run();

    assert.equal(
      result.success,
      false
    );
    assert.equal(
      result.errorCode,
      "TODAY-MIGRATION-005"
    );
    assert.equal(
      result.rolledBack,
      true
    );
    assert.deepEqual(
      runtime.readStore(),
      original
    );
  }
);

test(
  "Yedek oluşturulamıyorsa ana store yazılmıyor",
  () => {
    const runtime = createRuntime({
      backupFails: true
    });
    const before =
      runtime.localStorage.getItem(
        "today_store_v2"
      );
    const result =
      runtime.api.run();

    assert.equal(
      result.success,
      false
    );
    assert.equal(
      result.errorCode,
      "TODAY-MIGRATION-004"
    );
    assert.equal(
      runtime.calls.save,
      0
    );
    assert.equal(
      runtime.calls.restore,
      0
    );
    assert.equal(
      runtime.localStorage.getItem(
        "today_store_v2"
      ),
      before
    );
  }
);

test(
  "İkinci run çağrısı yeni yedek veya kayıt oluşturmuyor",
  () => {
    const runtime = createRuntime();
    const first =
      runtime.api.run();
    const second =
      runtime.api.run();

    assert.equal(
      first.success,
      true
    );
    assert.equal(
      second.skipped,
      true
    );
    assert.equal(
      runtime.calls.backup,
      1
    );
    assert.equal(
      runtime.calls.save,
      1
    );
  }
);

test(
  "Başarılı geçiş güvenli özet olayı yayımlıyor",
  () => {
    const runtime = createRuntime();

    runtime.api.run();

    const event =
      runtime.events.find(
        item =>
          item.type ===
          "today:migrationready"
      );

    assert.ok(event);
    assert.equal(
      event.detail.schemaVersion,
      2
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        event.detail,
        "store"
      ),
      false
    );
  }
);

test(
  "Başarısız geçiş yalnız güvenli teknik ayrıntılarla hata olayı yayımlıyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        schemaVersion: 3,
        secretNote:
          "Kayda girmemeli"
      })
    });

    runtime.api.run();

    const event =
      runtime.events.find(
        item =>
          item.type ===
          "today:migrationerror"
      );
    const serialized =
      JSON.stringify(event.detail);

    assert.ok(event);
    assert.equal(
      event.detail.errorCode,
      "TODAY-MIGRATION-003"
    );
    assert.equal(
      serialized.includes(
        "Kayda girmemeli"
      ),
      false
    );
  }
);

test(
  "Dizi biçimindeki legacy kayıtlar tarih alanından içe aktarılıyor",
  () => {
    const runtime = createRuntime({
      entries: {
        today_entries: [
          {
            date: "2026-07-27",
            pick: "Zordu bugün",
            col: "kırmızı",
            note: "Yoğundu"
          }
        ]
      }
    });

    runtime.api.run();

    const day =
      runtime.readStore()
        .days["2026-07-27"];

    assert.equal(day.choice, "C");
    assert.equal(day.color, "red");
    assert.equal(day.note, "Yoğundu");
  }
);

test(
  "Bozuk JSON legacy kaydı geçişi durdurmadan yok sayılıyor",
  () => {
    const runtime = createRuntime({
      entries: {
        today_data_v1:
          "{bozuk-json"
      }
    });
    const result =
      runtime.api.run();

    assert.equal(
      result.success,
      true
    );
    assert.equal(
      result.migratedDayCount,
      0
    );
    assert.deepEqual(
      [...result.sourceKeys],
      []
    );
  }
);

test(
  "Geçersiz tarih anahtarları legacy içe aktarmaya alınmıyor",
  () => {
    const runtime = createRuntime({
      entries: {
        todaySelections: {
          selections: {
            invalid: {
              choice: "A"
            },
            "2026-07-26": {
              choice: "A"
            }
          }
        }
      }
    });

    runtime.api.run();

    const days =
      runtime.readStore().days;

    assert.ok(days["2026-07-26"]);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        days,
        "invalid"
      ),
      false
    );
  }
);

test(
  "Mevcut geçerli tema legacy tema tarafından ezilmiyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        settings: {
          theme: "contrast"
        }
      }),
      entries: {
        today_app_v10: {
          theme: "dark",
          days: {
            "2026-07-25": {
              choice: "B"
            }
          }
        }
      }
    });

    runtime.api.run();

    assert.equal(
      runtime.readStore()
        .settings.theme,
      "contrast"
    );
  }
);

test(
  "Migration metadata kaynak, sürüm ve uygulanan adımları kaydediyor",
  () => {
    const runtime = createRuntime({
      store: createStore({
        schemaVersion: 1
      }),
      entries: {
        today_data_v2: {
          days: {
            "2026-07-24": {
              choice: "A"
            }
          }
        }
      }
    });

    runtime.api.run();

    const metadata =
      runtime.readStore().migration;

    assert.equal(
      metadata.completed,
      true
    );
    assert.equal(
      metadata.orchestratorVersion,
      1
    );
    assert.equal(
      metadata.fromSchemaVersion,
      1
    );
    assert.equal(
      metadata.toSchemaVersion,
      2
    );
    assert.deepEqual(
      metadata.appliedSteps,
      ["schema-1-to-2"]
    );
    assert.deepEqual(
      metadata.sourceKeys,
      ["today_data_v2"]
    );
  }
);

test(
  "Durum API'si başarılı çalışmadan sonra ready sonucunu döndürüyor",
  () => {
    const runtime = createRuntime();

    runtime.api.run();

    const status =
      runtime.api.getStatus();

    assert.equal(
      status.phase,
      "ready"
    );
    assert.equal(
      status.lastResult.success,
      true
    );
    assert.equal(
      status.lastResult
        .targetSchemaVersion,
      2
    );
  }
);

const failed = results.filter(
  result => !result.success
);

results.forEach(result => {
  console.log(
    `${result.success ? "✓" : "✗"} ${result.name}`
  );

  if (!result.success) {
    console.log(
      `  ${result.error}`
    );
  }
});

console.log(
  `\n${results.length - failed.length}/${results.length} migration testi başarılı.`
);

if (failed.length) {
  process.exitCode = 1;
}
