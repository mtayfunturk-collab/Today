const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE_PATH =
  "modules/startup-manager.js";
const source = fs.readFileSync(
  SOURCE_PATH,
  "utf8"
);

class MockElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this.listeners = {};
    this.id = "";
    this.tabIndex = 0;
    this.textContent = "";
    this.type = "";
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  append(...children) {
    children.forEach((child) =>
      this.appendChild(child)
    );
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) {
      return;
    }

    this.parentNode.children =
      this.parentNode.children.filter(
        (child) => child !== this
      );
    this.parentNode = null;
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  trigger(type) {
    if (this.listeners[type]) {
      this.listeners[type]();
    }
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }
}

class MockDocument {
  constructor(readyState = "loading") {
    this.readyState = readyState;
    this.activeElement = null;
    this.documentElement =
      new MockElement("html", this);
    this.body = new MockElement("body", this);
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName) {
    return new MockElement(tagName, this);
  }

  getElementById(id) {
    const visit = (node) => {
      if (node.id === id) {
        return node;
      }

      for (const child of node.children) {
        const match = visit(child);

        if (match) {
          return match;
        }
      }

      return null;
    };

    return visit(this.documentElement);
  }
}

function createModules() {
  return {
    TodayStorage: {
      STORAGE_KEY: "today_store_v2",
      BACKUP_KEY: "today_store_v2_backup",
      loadStore() {},
      saveStore() {},
      saveDay() {}
    },
    TodayVersion: {
      APP_VERSION: "2.0.0",
      SCHEMA_VERSION: 2,
      getCurrentVersion() {}
    },
    TodayMigration: {
      ORCHESTRATOR_VERSION: 1,
      validateDependencies() {},
      inspect() {},
      run() {},
      getStatus() {}
    },
    TodayDay: {
      pad2() {},
      todayKey() {},
      parseKey() {},
      prettyTR() {},
      ymKey() {},
      isSameDay() {},
      getOrCreateDay() {},
      getOrCreateLog() {}
    },
    TodayState: {
      APP_KEY: "today_app_v10",
      load() {},
      save() {}
    },
    TodayAI: {
      ADAPTER_INTERFACE_VERSION: 1,
      registerAdapter() {},
      unregisterAdapter() {},
      getStatus() {},
      getCapabilities() {},
      requestProposal() {}
    },
    TodayConnect: {
      ADAPTER_INTERFACE_VERSION: 1,
      MAX_PENDING_ACTIONS: 20,
      registerAdapter() {},
      unregisterAdapter() {},
      getStatus() {},
      getCapabilities() {},
      prepareAction() {},
      approveAction() {},
      cancelAction() {},
      getPendingActions() {}
    }
  };
}

function createRuntime(options = {}) {
  const document = new MockDocument(
    options.readyState || "loading"
  );
  const windowListeners = {};
  const dispatchedEvents = [];
  let reloadCount = 0;
  let registerCount = 0;
  let updateManagerStartCount = 0;

  const window = {
    document,
    navigator: {},
    location: {
      reload() {
        reloadCount += 1;
      }
    },
    addEventListener(type, handler) {
      windowListeners[type] = handler;
    },
    dispatchEvent(event) {
      dispatchedEvents.push(event);
      return true;
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    requestAnimationFrame(callback) {
      callback();
    },
    ...createModules(),
    ...(options.modules || {})
  };

  if (options.serviceWorker !== false) {
    window.navigator.serviceWorker = {
      register(scriptUrl) {
        registerCount += 1;

        if (options.serviceWorkerRejects) {
          return Promise.reject(
            new Error("Registration failed")
          );
        }

        return Promise.resolve({
          scriptURL: scriptUrl
        });
      }
    };

    if (options.updateManager !== false) {
      window.TodayServiceWorker = {
        start({ scriptUrl }) {
          updateManagerStartCount += 1;

          if (
            options.updateManagerResultFalse
          ) {
            return Promise.resolve({
              success: false,
              errorCode:
                "TODAY-SW-REGISTER-TEST"
            });
          }

          return window.navigator
            .serviceWorker
            .register(scriptUrl)
            .then(registration => ({
              success: true,
              registration
            }));
        }
      };
    }
  }

  const silentConsole = {
    info() {},
    warn() {},
    error() {}
  };

  const context = {
    window,
    document,
    console: silentConsole,
    Promise,
    Object,
    Array,
    String,
    Error
  };

  vm.runInNewContext(source, context, {
    filename: SOURCE_PATH
  });

  return {
    window,
    document,
    windowListeners,
    dispatchedEvents,
    async flushPromises() {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
    get reloadCount() {
      return reloadCount;
    },
    get registerCount() {
      return registerCount;
    },
    get updateManagerStartCount() {
      return updateManagerStartCount;
    }
  };
}

const results = [];

async function test(name, callback) {
  try {
    await callback();
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

(async () => {
  await test(
    "Genel API ve modül sırası yayımlanıyor",
    () => {
      const runtime = createRuntime();
      const api = runtime.window.TodayStartup;

      assert.ok(api);
      assert.equal(Object.isFrozen(api), true);
      assert.deepEqual(
        [...api.MODULE_ORDER],
        [
          "TodayStorage",
          "TodayVersion",
          "TodayMigration",
          "TodayDay",
          "TodayState",
          "TodayAI",
          "TodayConnect"
        ]
      );
      assert.equal(
        api.getStatus().phase,
        "idle"
      );
    }
  );

  await test(
    "Geçerli yedi temel ve adaptör sözleşmesi doğrulanıyor",
    () => {
      const runtime = createRuntime();
      const validation =
        runtime.window.TodayStartup
          .validateDependencies();

      assert.equal(validation.valid, true);
      assert.equal(
        validation.validatedModules.length,
        7
      );
      assert.equal(
        validation.missingDependencies.length,
        0
      );
    }
  );

  await test(
    "Eksik AI veya Connect adaptör arayüzü uygulama başlamadan bulunuyor",
    () => {
      const runtime = createRuntime({
        modules: {
          TodayAI: undefined,
          TodayConnect: undefined
        },
        serviceWorker: false
      });
      const validation =
        runtime.window.TodayStartup
          .validateDependencies();

      assert.equal(
        validation.valid,
        false
      );
      assert.ok(
        validation
          .missingDependencies
          .includes("TodayAI")
      );
      assert.ok(
        validation
          .missingDependencies
          .includes("TodayConnect")
      );
    }
  );

  await test(
    "Eksik Connect onay metodu tam adıyla raporlanıyor",
    () => {
      const modules =
        createModules();
      modules.TodayConnect
        .approveAction = null;
      const runtime = createRuntime({
        modules,
        serviceWorker: false
      });
      const validation =
        runtime.window.TodayStartup
          .validateDependencies();

      assert.equal(
        validation.valid,
        false
      );
      assert.ok(
        validation
          .missingDependencies
          .includes(
            "TodayConnect.approveAction"
          )
      );
    }
  );

  await test(
    "Eksik modül başlangıcı durduruyor ve hata yüzeyi gösteriyor",
    () => {
      const runtime = createRuntime({
        modules: {
          TodayDay: undefined
        },
        serviceWorker: false
      });
      let initializeCount = 0;

      const result =
        runtime.window.TodayStartup.start({
          initialize() {
            initializeCount += 1;
          }
        });

      assert.equal(result.success, false);
      assert.equal(initializeCount, 0);
      assert.equal(
        result.status.errorCode,
        "TODAY-STARTUP-001"
      );
      assert.ok(
        result.status.missingDependencies
          .includes("TodayDay")
      );
      assert.ok(
        runtime.document.getElementById(
          "todayStartupError"
        )
      );
    }
  );

  await test(
    "Eksik API üyesi tam adıyla raporlanıyor",
    () => {
      const modules = createModules();
      modules.TodayState.save = null;

      const runtime = createRuntime({
        modules
      });
      const validation =
        runtime.window.TodayStartup
          .validateDependencies();

      assert.equal(validation.valid, false);
      assert.ok(
        validation.missingDependencies
          .includes("TodayState.save")
      );
    }
  );

  await test(
    "Başlatıcı bir kez çalışıyor ve ready durumuna geçiyor",
    () => {
      const runtime = createRuntime();
      let initializeCount = 0;

      const first =
        runtime.window.TodayStartup.start({
          initialize() {
            initializeCount += 1;
            return "initialized";
          }
        });

      const second =
        runtime.window.TodayStartup.start({
          initialize() {
            initializeCount += 1;
          }
        });

      assert.equal(first.success, true);
      assert.equal(
        first.value,
        "initialized"
      );
      assert.equal(
        first.status.phase,
        "ready"
      );
      assert.equal(
        second.alreadyStarted,
        true
      );
      assert.equal(initializeCount, 1);
      assert.ok(
        runtime.dispatchedEvents.some(
          (event) =>
            event.type ===
            "today:startup-ready"
        )
      );
    }
  );

  await test(
    "Başlatıcı hatası yakalanıyor ve boş ekran oluşmuyor",
    () => {
      const runtime = createRuntime({
        serviceWorker: false
      });

      const result =
        runtime.window.TodayStartup.start({
          initialize() {
            throw new Error("Init failed");
          }
        });

      assert.equal(result.success, false);
      assert.equal(
        result.status.errorCode,
        "TODAY-STARTUP-003"
      );
      assert.ok(
        runtime.document.getElementById(
          "todayStartupError"
        )
      );
      assert.ok(
        runtime.dispatchedEvents.some(
          (event) =>
            event.type ===
            "today:startup-error"
        )
      );
    }
  );

  await test(
    "Migration hata kodu korunuyor ve veri güvenliği mesajı gösteriliyor",
    () => {
      const runtime = createRuntime({
        serviceWorker: false
      });

      const result =
        runtime.window.TodayStartup.start({
          initialize() {
            const error =
              new Error(
                "Migration failed"
              );
            error.todayCode =
              "TODAY-MIGRATION-005";
            throw error;
          }
        });
      const text =
        runtime.document.getElementById(
          "todayStartupErrorText"
        );
      const event =
        runtime.dispatchedEvents.find(
          item =>
            item.type ===
            "today:startup-error"
        );

      assert.equal(
        result.status.errorCode,
        "TODAY-MIGRATION-005"
      );
      assert.match(
        text.textContent,
        /güvenlik kopyan korundu/
      );
      assert.equal(
        event.detail.errorCode,
        "TODAY-MIGRATION-005"
      );
    }
  );

  await test(
    "Başlatıcı callback yoksa kontrollü hata gösteriliyor",
    () => {
      const runtime = createRuntime({
        serviceWorker: false
      });
      const result =
        runtime.window.TodayStartup.start(null);

      assert.equal(result.success, false);
      assert.equal(
        result.status.errorCode,
        "TODAY-STARTUP-002"
      );
    }
  );

  await test(
    "Service Worker load olayında yalnızca bir kez kaydediliyor",
    async () => {
      const runtime = createRuntime();

      runtime.window.TodayStartup.start({
        serviceWorkerUrl: "./sw.js",
        initialize() {}
      });

      assert.equal(
        runtime.window.TodayStartup
          .getStatus()
          .serviceWorker,
        "scheduled"
      );

      runtime.windowListeners.load();
      await runtime.flushPromises();

      assert.equal(runtime.registerCount, 1);
      assert.equal(
        runtime.updateManagerStartCount,
        1
      );
      assert.equal(
        runtime.window.TodayStartup
          .getStatus()
          .serviceWorker,
        "registered"
      );
      const readyEvent =
        runtime.dispatchedEvents.find(
          event =>
            event.type ===
            "today:service-worker-ready"
        );

      assert.equal(
        readyEvent.detail.managed,
        true
      );
      assert.equal(
        readyEvent.detail
          .registration.scriptURL,
        "./sw.js"
      );
    }
  );

  await test(
    "Güncelleme yöneticisi yoksa kayıt korunuyor ve kontrollü uyarı yayımlanıyor",
    async () => {
      const runtime = createRuntime({
        updateManager: false
      });

      runtime.window.TodayStartup.start({
        initialize() {}
      });
      runtime.windowListeners.load();
      await runtime.flushPromises();

      assert.equal(
        runtime.registerCount,
        1
      );
      assert.equal(
        runtime.updateManagerStartCount,
        0
      );

      const warning =
        runtime.dispatchedEvents.find(
          event =>
            event.type ===
            "today:service-worker-update-error"
        );

      assert.ok(warning);
      assert.equal(
        warning.detail.errorCode,
        "TODAY-SW-UPDATE-010"
      );
      assert.equal(
        warning.detail.stage,
        "manager"
      );
    }
  );

  await test(
    "Güncelleme yöneticisinin kontrollü kayıt hatası başlangıcı bozmuyor",
    async () => {
      const runtime = createRuntime({
        updateManagerResultFalse: true
      });
      const result =
        runtime.window.TodayStartup.start({
          initialize() {}
        });

      runtime.windowListeners.load();
      await runtime.flushPromises();

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        runtime.window.TodayStartup
          .getStatus()
          .serviceWorker,
        "failed"
      );
      assert.ok(
        runtime.dispatchedEvents.some(
          event =>
            event.type ===
            "today:service-worker-error"
        )
      );
    }
  );

  await test(
    "Service Worker hatası uygulama başlangıcını bozmuyor",
    async () => {
      const runtime = createRuntime({
        serviceWorkerRejects: true
      });

      const result =
        runtime.window.TodayStartup.start({
          initialize() {}
        });

      runtime.windowListeners.load();
      await runtime.flushPromises();

      const current =
        runtime.window.TodayStartup.getStatus();

      assert.equal(result.success, true);
      assert.equal(current.phase, "ready");
      assert.equal(
        current.serviceWorker,
        "failed"
      );
      assert.ok(
        runtime.dispatchedEvents.some(
          (event) =>
            event.type ===
            "today:service-worker-error"
        )
      );
    }
  );

  await test(
    "Yeniden dene düğmesi sayfayı yeniliyor",
    () => {
      const runtime = createRuntime({
        modules: {
          TodayStorage: undefined
        },
        serviceWorker: false
      });

      runtime.window.TodayStartup.start({
        initialize() {}
      });

      const surface =
        runtime.document.getElementById(
          "todayStartupError"
        );
      const card = surface.children[0];
      const retryButton = card.children[2];

      retryButton.trigger("click");
      assert.equal(runtime.reloadCount, 1);
    }
  );

  const failed = results.filter(
    (result) => !result.success
  );

  results.forEach((result) => {
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

  console.log(
    `Startup Manager: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
