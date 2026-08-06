const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const MODULE_PATHS = [
  "modules/storage.js",
  "modules/version.js",
  "modules/migration.js",
  "modules/day-manager.js",
  "modules/state-manager.js"
];

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

function createRuntime(entries = {}) {
  const localStorage =
    new MockLocalStorage(entries);
  const events = [];
  const window = {
    localStorage,
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
  const navigator = {
    language: "tr-TR",
    userAgent: "Today Test"
  };
  const context = {
    window,
    localStorage,
    navigator,
    console: {
      info() {},
      warn() {},
      error() {}
    },
    Intl,
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

  MODULE_PATHS.forEach(path => {
    vm.runInNewContext(
      fs.readFileSync(path, "utf8"),
      context,
      {
        filename: path
      }
    );
  });

  return {
    window,
    localStorage,
    events
  };
}

function readJson(storage, key) {
  const raw = storage.getItem(key);
  return raw ? JSON.parse(raw) : null;
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
  "Gerçek Storage, Version, Migration, Day ve State modülleri birlikte yükleniyor",
  () => {
    const { window } =
      createRuntime();

    [
      "TodayStorage",
      "TodayVersion",
      "TodayMigration",
      "TodayDay",
      "TodayState"
    ].forEach(name => {
      assert.ok(window[name], name);
    });
  }
);

test(
  "Gerçek Storage ve Version sürüm sözleşmeleri Migration tarafından doğrulanıyor",
  () => {
    const { window } =
      createRuntime();
    const result =
      window.TodayMigration
        .validateDependencies();

    assert.equal(result.valid, true);
    assert.equal(
      result.storageSchemaVersion,
      2
    );
    assert.equal(
      result.targetSchemaVersion,
      2
    );
  }
);

test(
  "Boş kurulumda v2 store oluşturulup migration metadata tamamlanıyor",
  () => {
    const runtime =
      createRuntime();
    const result =
      runtime.window.TodayMigration
        .run();
    const store = readJson(
      runtime.localStorage,
      "today_store_v2"
    );

    assert.equal(
      result.success,
      true
    );
    assert.equal(
      store.schemaVersion,
      2
    );
    assert.equal(
      store.migration.completed,
      true
    );
  }
);

test(
  "Gerçek modüller today_app_v10 kaydını v2 store'a veri kaybetmeden aktarıyor",
  () => {
    const legacy = {
      v: 10,
      theme: "dark",
      days: {
        "2026-07-30": {
          choice: "C",
          color: "red",
          note: "Zor ama fark edildi"
        }
      },
      logs: {}
    };
    const runtime =
      createRuntime({
        today_app_v10: legacy
      });

    runtime.window.TodayMigration
      .run();

    const store = readJson(
      runtime.localStorage,
      "today_store_v2"
    );

    assert.equal(
      store.days["2026-07-30"]
        .choice,
      "C"
    );
    assert.equal(
      store.days["2026-07-30"]
        .note,
      "Zor ama fark edildi"
    );
    assert.equal(
      store.settings.theme,
      "dark"
    );
  }
);

test(
  "Migration öncesi gerçek v2 store yedek anahtarında korunuyor",
  () => {
    const runtime =
      createRuntime();

    runtime.window.TodayStorage
      .loadStore();
    const before =
      runtime.localStorage.getItem(
        "today_store_v2"
      );

    runtime.window.TodayMigration
      .run();

    assert.equal(
      runtime.localStorage.getItem(
        "today_store_v2_backup"
      ),
      before
    );
  }
);

test(
  "Migration sonrasında gerçek TodayState aynı Core kaydını okuyor",
  () => {
    const runtime =
      createRuntime({
        today_app_v10: {
          v: 10,
          theme: "system",
          days: {
            "2026-07-30": {
              choice: "A",
              color: "deep",
              note: "Adı yok"
            }
          },
          logs: {}
        }
      });

    runtime.window.TodayMigration
      .run();
    const state =
      runtime.window.TodayState.load();

    assert.equal(
      state.days["2026-07-30"]
        .choice,
      "A"
    );
    assert.equal(
      state.days["2026-07-30"]
        .color,
      "deep"
    );
    assert.equal(
      state.days["2026-07-30"]
        .note,
      "Adı yok"
    );
  }
);

test(
  "Migration sonrası gerçek TodayState çift yazma sözleşmesini koruyor",
  () => {
    const runtime =
      createRuntime();

    runtime.window.TodayMigration
      .run();
    const state =
      runtime.window.TodayState.load();

    state.days["2026-07-30"] = {
      choice: "B",
      color: "blue",
      note: "Net"
    };

    const saveResult =
      runtime.window.TodayState
        .save(state);
    const legacy = readJson(
      runtime.localStorage,
      "today_app_v10"
    );
    const store = readJson(
      runtime.localStorage,
      "today_store_v2"
    );

    assert.equal(
      saveResult.success,
      true
    );
    assert.equal(
      legacy.days["2026-07-30"]
        .choice,
      "B"
    );
    assert.equal(
      store.days["2026-07-30"]
        .choice,
      "B"
    );
  }
);

test(
  "İkinci gerçek migration çalıştırması store içeriğini yeniden yazmıyor",
  () => {
    const runtime =
      createRuntime();

    runtime.window.TodayMigration
      .run();
    const before =
      runtime.localStorage.getItem(
        "today_store_v2"
      );
    const second =
      runtime.window.TodayMigration
        .run();
    const after =
      runtime.localStorage.getItem(
        "today_store_v2"
      );

    assert.equal(
      second.skipped,
      true
    );
    assert.equal(after, before);
  }
);

test(
  "Legacy anahtar gerçek entegrasyonda migration sonrasında aynen kalıyor",
  () => {
    const legacy = {
      v: 10,
      days: {
        "2026-07-30": {
          choice: "B"
        }
      },
      logs: {}
    };
    const runtime =
      createRuntime({
        today_app_v10: legacy
      });
    const before =
      runtime.localStorage.getItem(
        "today_app_v10"
      );

    runtime.window.TodayMigration
      .run();

    assert.equal(
      runtime.localStorage.getItem(
        "today_app_v10"
      ),
      before
    );
  }
);

test(
  "Uygulamadan yeni gerçek store değiştirilmeden engelleniyor",
  () => {
    const futureStore = {
      schemaVersion: 3,
      appVersion: "3.0.0",
      createdAt:
        "2026-07-30T10:00:00.000Z",
      updatedAt:
        "2026-07-30T10:00:00.000Z",
      settings: {
        theme: "system"
      },
      days: {},
      usage: {},
      migration: {
        completed: true
      }
    };
    const runtime =
      createRuntime({
        today_store_v2:
          futureStore
      });
    const before =
      runtime.localStorage.getItem(
        "today_store_v2"
      );
    const result =
      runtime.window.TodayMigration
        .run();

    assert.equal(
      result.errorCode,
      "TODAY-MIGRATION-003"
    );
    assert.equal(
      runtime.localStorage.getItem(
        "today_store_v2"
      ),
      before
    );
    assert.equal(
      runtime.localStorage.getItem(
        "today_store_v2_backup"
      ),
      null
    );
  }
);

const failed = results.filter(
  result => !result.success
);

results.forEach(result => {
  console.log(
    `${result.success ? "PASS" : "FAIL"}: ${result.name}${
      result.error
        ? ` — ${result.error}`
        : ""
    }`
  );
});

console.log(
  `Migration Integration: ${
    results.length - failed.length
  }/${results.length} başarılı`
);

if (failed.length) {
  process.exitCode = 1;
}
