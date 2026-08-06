const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE_PATH =
  "modules/error-manager.js";
const source = fs.readFileSync(
  SOURCE_PATH,
  "utf8"
);

class MockElement {
  constructor(tagName, ownerDocument) {
    this.tagName =
      String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.id = "";
    this.hidden = false;
    this.textContent = "";
    this.type = "";
  }

  setAttribute(name, value) {
    this.attributes[name] =
      String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(
      this.attributes,
      name
    )
      ? this.attributes[name]
      : null;
  }

  append(...children) {
    children.forEach(child =>
      this.appendChild(child)
    );
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }

    this.listeners[type].push(handler);
  }

  trigger(type) {
    (
      this.listeners[type] || []
    ).forEach(handler => handler({
      type,
      target: this
    }));
  }
}

class MockDocument {
  constructor() {
    this.documentElement =
      new MockElement("html", this);
    this.body =
      new MockElement("body", this);
    this.documentElement.appendChild(
      this.body
    );
  }

  createElement(tagName) {
    return new MockElement(
      tagName,
      this
    );
  }

  getElementById(id) {
    const visit = node => {
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

    return visit(
      this.documentElement
    );
  }
}

function createRuntime(options = {}) {
  const document =
    new MockDocument();
  const listeners = {};
  const events = [];
  const consoleCalls = [];
  const navigateCalls = [];
  let reloadCount = 0;

  const window = {
    document,
    console: {
      info(...args) {
        consoleCalls.push([
          "info",
          ...args
        ]);
      },
      warn(...args) {
        consoleCalls.push([
          "warn",
          ...args
        ]);
      },
      error(...args) {
        consoleCalls.push([
          "error",
          ...args
        ]);
      }
    },
    location: {
      reload() {
        reloadCount += 1;
      }
    },
    addEventListener(type, handler, capture) {
      if (!listeners[type]) {
        listeners[type] = [];
      }

      listeners[type].push({
        handler,
        capture: capture === true
      });
    },
    dispatchEvent(event) {
      if (!event.target) {
        event.target = window;
      }

      events.push(event);

      (
        listeners[event.type] || []
      ).forEach(({ handler }) => {
        handler(event);
      });

      return true;
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
        this.target = null;
      }
    },
    TodayRouter: {
      getState() {
        return {
          initialized: true
        };
      },
      navigate(route, routeOptions) {
        navigateCalls.push({
          route,
          options: routeOptions
        });

        if (options.routerRejects) {
          return {
            success: false
          };
        }

        if (options.routerThrows) {
          throw new Error(
            "Router unavailable"
          );
        }

        return {
          success: true,
          changed: true
        };
      }
    }
  };

  const context = {
    window,
    document,
    console: window.console,
    Date,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error
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
    document,
    listeners,
    events,
    consoleCalls,
    navigateCalls,
    emit(type, detail = {}) {
      window.dispatchEvent(
        new window.CustomEvent(
          type,
          {
            detail
          }
        )
      );
    },
    emitRaw(event) {
      window.dispatchEvent(event);
    },
    get reloadCount() {
      return reloadCount;
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
  "Genel API değişmez ve otomatik başlatılmış olarak yayımlanıyor",
  () => {
    const runtime = createRuntime();
    const api =
      runtime.window.TodayErrors;

    assert.ok(api);
    assert.equal(
      Object.isFrozen(api),
      true
    );
    assert.equal(
      api.ERROR_MANAGER_VERSION,
      1
    );
    assert.equal(
      api.MAX_RECORDS,
      25
    );
    assert.equal(
      api.getState().initialized,
      true
    );
  }
);

test(
  "On platform olayı ve iki global hata olayı dinleniyor",
  () => {
    const runtime = createRuntime();
    const api =
      runtime.window.TodayErrors;

    assert.deepEqual(
      [...api.LISTENED_EVENTS],
      [
        "today:startup-error",
        "today:routeerror",
        "today:routehistoryerror",
        "today:moduleerror",
        "today:stateerror",
        "today:migrationerror",
        "today:service-worker-error",
        "today:service-worker-update-error",
        "today:ai-adapter-error",
        "today:connect-adapter-error"
      ]
    );
    assert.equal(
      runtime.listeners.error.length,
      1
    );
    assert.equal(
      runtime.listeners.error[0]
        .capture,
      true
    );
    assert.equal(
      runtime.listeners
        .unhandledrejection.length,
      1
    );
  }
);

test(
  "Başlatma idempotent ve ikinci çağrı yeni dinleyici eklemiyor",
  () => {
    const runtime = createRuntime();
    const before =
      Object.fromEntries(
        Object.entries(
          runtime.listeners
        ).map(([name, handlers]) => [
          name,
          handlers.length
        ])
      );
    const result =
      runtime.window.TodayErrors.init();
    const after =
      Object.fromEntries(
        Object.entries(
          runtime.listeners
        ).map(([name, handlers]) => [
          name,
          handlers.length
        ])
      );

    assert.equal(
      result.success,
      true
    );
    assert.equal(
      result.changed,
      false
    );
    assert.deepEqual(after, before);
  }
);

test(
  "Hazır olayı sürüm ve dinlenen olaylarla yayımlanıyor",
  () => {
    const runtime = createRuntime();
    const readyEvent =
      runtime.events.find(
        event =>
          event.type ===
          "today:errors-ready"
      );

    assert.ok(readyEvent);
    assert.equal(
      readyEvent.detail.version,
      1
    );
    assert.equal(
      readyEvent.detail
        .listenedEvents.length,
      10
    );
  }
);

test(
  "Doğrudan capture standart ve değişmez hata kaydı üretiyor",
  () => {
    const runtime = createRuntime();
    const record =
      runtime.window.TodayErrors
        .capture({
          code: "TODAY-TEST-001",
          source: "test",
          severity: "warning",
          message: "Teknik test.",
          userMessage:
            "Güvenli test bildirimi.",
          recovery: "dismiss"
        });

    assert.equal(
      Object.isFrozen(record),
      true
    );
    assert.equal(
      record.code,
      "TODAY-TEST-001"
    );
    assert.equal(
      record.source,
      "test"
    );
    assert.equal(
      record.severity,
      "warning"
    );
    assert.match(
      record.timestamp,
      /^\d{4}-\d{2}-\d{2}T/
    );
  }
);

test(
  "Hata kaydı merkezi today:error olayına dönüştürülüyor",
  () => {
    const runtime = createRuntime();
    const record =
      runtime.window.TodayErrors
        .capture({
          code: "TODAY-TEST-002"
        });
    const centralEvent =
      runtime.events.find(
        event =>
          event.type ===
            "today:error" &&
          event.detail.id === record.id
      );

    assert.ok(centralEvent);
    assert.equal(
      centralEvent.detail.code,
      "TODAY-TEST-002"
    );
  }
);

test(
  "Yalnızca izin verilen teknik ayrıntılar kayda alınıyor",
  () => {
    const runtime = createRuntime();
    const record =
      runtime.window.TodayErrors
        .capture({
          code: "TODAY-TEST-003",
          details: {
            route: "sky",
            moduleId: "sky",
            note:
              "Kullanıcının özel notu",
            state: {
              days: {
                secret: true
              }
            },
            stack:
              "özel stack içeriği"
          }
        });

    assert.deepEqual(
      {
        ...record.details
      },
      {
        route: "sky",
        moduleId: "sky"
      }
    );
    assert.equal(
      "note" in record.details,
      false
    );
    assert.equal(
      "state" in record.details,
      false
    );
    assert.equal(
      "stack" in record.details,
      false
    );
  }
);

test(
  "Geçersiz kod, önem ve geri kazanım değerleri güvenli varsayılanlara düşüyor",
  () => {
    const runtime = createRuntime();
    const record =
      runtime.window.TodayErrors
        .capture({
          code: "geçersiz kod",
          severity: "panic",
          recovery: "delete"
        });

    assert.equal(
      record.code,
      "TODAY-ERROR-UNKNOWN"
    );
    assert.equal(
      record.severity,
      "error"
    );
    assert.equal(
      record.recovery,
      "dismiss"
    );
  }
);

test(
  "Oturum hata günlüğü son 25 kayıtla sınırlı",
  () => {
    const runtime = createRuntime();
    const api =
      runtime.window.TodayErrors;

    for (
      let index = 1;
      index <= 30;
      index += 1
    ) {
      api.capture({
        code:
          `TODAY-LIMIT-${index}`,
        userVisible: false
      });
    }

    const log = api.getLog();

    assert.equal(log.length, 25);
    assert.equal(
      log[0].code,
      "TODAY-LIMIT-6"
    );
    assert.equal(
      log[24].code,
      "TODAY-LIMIT-30"
    );
  }
);

test(
  "Router hatası erişilebilir ve ana ekran geri kazanımlı bildirime dönüşüyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:routeerror",
      {
        errorCode:
          "TODAY-ROUTER-001",
        message:
          "Bilinmeyen rota.",
        route: "unknown"
      }
    );

    const record =
      runtime.window.TodayErrors
        .getLog()[0];
    const surface =
      runtime.document.getElementById(
        "todayErrorNotice"
      );
    const recoverButton =
      runtime.document.getElementById(
        "todayErrorRecover"
      );

    assert.equal(
      record.source,
      "router"
    );
    assert.equal(
      record.code,
      "TODAY-ROUTER-001"
    );
    assert.equal(
      record.details.route,
      "unknown"
    );
    assert.equal(surface.hidden, false);
    assert.equal(
      surface.getAttribute("role"),
      "alert"
    );
    assert.equal(
      recoverButton.textContent,
      "Ana ekrana dön"
    );
  }
);

test(
  "Modül hatası merkezi modül kaydına dönüştürülüyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:moduleerror",
      {
        errorCode:
          "TODAY-MODULES-005",
        message:
          "Bilinmeyen modül.",
        moduleId: "unknown"
      }
    );

    const record =
      runtime.window.TodayErrors
        .getLog()[0];

    assert.equal(
      record.source,
      "module-registry"
    );
    assert.equal(
      record.code,
      "TODAY-MODULES-005"
    );
    assert.equal(
      record.details.moduleId,
      "unknown"
    );
  }
);

test(
  "History hatası polite durum bildirimi olarak gösteriliyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:routehistoryerror",
      {
        route: "calendar",
        mode: "push"
      }
    );

    const surface =
      runtime.document.getElementById(
        "todayErrorNotice"
      );
    const record =
      runtime.window.TodayErrors
        .getLog()[0];

    assert.equal(
      record.severity,
      "warning"
    );
    assert.equal(
      surface.getAttribute("role"),
      "status"
    );
    assert.equal(
      surface.getAttribute("aria-live"),
      "polite"
    );
  }
);

test(
  "Service Worker hatası sessiz kalmıyor ve uygulamanın kullanılabilir olduğunu bildiriyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:service-worker-error",
      {
        scriptUrl: "./sw.js"
      }
    );

    const record =
      runtime.window.TodayErrors
        .getLog()[0];
    const text =
      runtime.document.getElementById(
        "todayErrorNoticeText"
      );
    const recoverButton =
      runtime.document.getElementById(
        "todayErrorRecover"
      );
    const dismissButton =
      runtime.document.getElementById(
        "todayErrorDismiss"
      );

    assert.equal(
      record.code,
      "TODAY-SW-001"
    );
    assert.equal(
      record.details.scriptUrl,
      "./sw.js"
    );
    assert.match(
      text.textContent,
      /çevrimiçi/
    );
    assert.equal(
      recoverButton.hidden,
      true
    );
    assert.equal(
      dismissButton.textContent,
      "Tamam"
    );
  }
);

test(
  "Service Worker güncelleme hatası güvenli teknik ayrıntılarla kaydediliyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:service-worker-update-error",
      {
        errorCode:
          "TODAY-SW-UPDATE-009",
        stage: "activate",
        workerState: "installed",
        errorName: "Error",
        note:
          "Kullanıcı verisi kayda girmemeli"
      }
    );

    const record =
      runtime.window.TodayErrors
        .getLog()[0];
    const text =
      runtime.document.getElementById(
        "todayErrorNoticeText"
      );

    assert.equal(
      record.code,
      "TODAY-SW-UPDATE-009"
    );
    assert.equal(
      record.source,
      "service-worker-update"
    );
    assert.equal(
      record.severity,
      "warning"
    );
    assert.equal(
      record.details.stage,
      "activate"
    );
    assert.equal(
      record.details.workerState,
      "installed"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        record.details,
        "note"
      ),
      false
    );
    assert.match(
      text.textContent,
      /Mevcut sürümü/
    );
  }
);

test(
  "AI adaptör hatası yalnız güvenli sözleşme ayrıntılarını kaydediyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:ai-adapter-error",
      {
        errorCode:
          "TODAY-AI-ADAPTER-007",
        adapterId:
          "today-ai-test",
        capability:
          "reflection.summary",
        stage: "provider",
        input:
          "Kullanıcı günlüğü kayda girmemeli"
      }
    );

    const record =
      runtime.window.TodayErrors
        .getLog()[0];
    const text =
      runtime.document.getElementById(
        "todayErrorNoticeText"
      );

    assert.equal(
      record.source,
      "ai-adapter"
    );
    assert.equal(
      record.details.adapterId,
      "today-ai-test"
    );
    assert.equal(
      record.details.capability,
      "reflection.summary"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        record.details,
        "input"
      ),
      false
    );
    assert.match(
      text.textContent,
      /kullanmaya devam/
    );
  }
);

test(
  "Connect adaptör hatası payload taşımadan eylem aşamasını kaydediyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:connect-adapter-error",
      {
        errorCode:
          "TODAY-CONNECT-ADAPTER-017",
        adapterId:
          "today-connect-test",
        capability:
          "calendar.write",
        operation:
          "calendar.create",
        actionId: "action-1",
        stage: "execute",
        payload:
          "Takvim içeriği kayda girmemeli"
      }
    );

    const record =
      runtime.window.TodayErrors
        .getLog()[0];
    const text =
      runtime.document.getElementById(
        "todayErrorNoticeText"
      );

    assert.equal(
      record.source,
      "connect-adapter"
    );
    assert.equal(
      record.details.operation,
      "calendar.create"
    );
    assert.equal(
      record.details.actionId,
      "action-1"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        record.details,
        "payload"
      ),
      false
    );
    assert.match(
      text.textContent,
      /tamamlanamadı/
    );
  }
);

test(
  "State kayıt hatası güvenlik kopyası bilgisiyle merkezi bildirime dönüşüyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:stateerror",
      {
        errorCode:
          "TODAY-STATE-001",
        storageSaved: false,
        legacyBackupSaved: true,
        savedDayCount: 2
      }
    );

    const record =
      runtime.window.TodayErrors
        .getLog()[0];
    const text =
      runtime.document.getElementById(
        "todayErrorNoticeText"
      );

    assert.equal(
      record.source,
      "state"
    );
    assert.equal(
      record.code,
      "TODAY-STATE-001"
    );
    assert.equal(
      record.details.storageSaved,
      false
    );
    assert.equal(
      record.details
        .legacyBackupSaved,
      true
    );
    assert.match(
      text.textContent,
      /güvenlik kopyası/
    );
  }
);

test(
  "Migration hatası güvenli şema ayrıntılarıyla kaydediliyor ve başlangıç yüzeyini çoğaltmıyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:migrationerror",
      {
        errorCode:
          "TODAY-MIGRATION-005",
        phase: "commit",
        currentSchemaVersion: 1,
        targetSchemaVersion: 2,
        rolledBack: true,
        note:
          "Kullanıcı notu kayda girmemeli"
      }
    );

    const record =
      runtime.window.TodayErrors
        .getLog()[0];

    assert.equal(
      record.source,
      "migration"
    );
    assert.equal(
      record.severity,
      "fatal"
    );
    assert.equal(
      record.details.phase,
      "commit"
    );
    assert.equal(
      record.details
        .currentSchemaVersion,
      1
    );
    assert.equal(
      record.details
        .targetSchemaVersion,
      2
    );
    assert.equal(
      record.details.rolledBack,
      true
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        record.details,
        "note"
      ),
      false
    );
    assert.equal(
      runtime.document.getElementById(
        "todayErrorNotice"
      ),
      null
    );
  }
);

test(
  "Startup hatası kayda alınıyor fakat mevcut tam ekran yüzeyi çoğaltılmıyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:startup-error",
      {
        errorCode:
          "TODAY-STARTUP-003",
        missingDependencies: [
          "TodayState"
        ]
      }
    );

    const record =
      runtime.window.TodayErrors
        .getLog()[0];

    assert.equal(
      record.severity,
      "fatal"
    );
    assert.deepEqual(
      [...record.details
        .missingDependencies],
      ["TodayState"]
    );
    assert.equal(
      runtime.document.getElementById(
        "todayErrorNotice"
      ),
      null
    );
  }
);

test(
  "Beklenmeyen çalışma zamanı hatası yeniden dene bildirimi oluşturuyor",
  () => {
    const runtime = createRuntime();

    runtime.emitRaw({
      type: "error",
      target: runtime.window,
      filename:
        "https://today.test/index.html",
      lineno: 44,
      colno: 8,
      error: new TypeError(
        "Runtime failed"
      )
    });

    const record =
      runtime.window.TodayErrors
        .getLog()[0];
    const recoverButton =
      runtime.document.getElementById(
        "todayErrorRecover"
      );

    assert.equal(
      record.code,
      "TODAY-RUNTIME-001"
    );
    assert.equal(
      record.details.errorName,
      "TypeError"
    );
    assert.equal(
      recoverButton.textContent,
      "Yeniden dene"
    );
  }
);

test(
  "Yüklenemeyen uygulama kaynağı ayrı hata koduyla yakalanıyor",
  () => {
    const runtime = createRuntime();

    runtime.emitRaw({
      type: "error",
      target: {
        src:
          "https://today.test/modules/router.js"
      }
    });

    const record =
      runtime.window.TodayErrors
        .getLog()[0];

    assert.equal(
      record.code,
      "TODAY-RUNTIME-003"
    );
    assert.equal(
      record.source,
      "resource"
    );
    assert.match(
      record.details.filename,
      /router\.js$/
    );
  }
);

test(
  "Yakalanmamış Promise reddi ham nedeni saklamadan kayda alınıyor",
  () => {
    const runtime = createRuntime();

    runtime.emitRaw({
      type: "unhandledrejection",
      target: runtime.window,
      reason: new Error(
        "Kullanıcı verisi içerebilecek neden"
      )
    });

    const record =
      runtime.window.TodayErrors
        .getLog()[0];

    assert.equal(
      record.code,
      "TODAY-RUNTIME-002"
    );
    assert.equal(
      record.details.errorName,
      "Error"
    );
    assert.equal(
      JSON.stringify(record)
        .includes(
          "Kullanıcı verisi"
        ),
      false
    );
  }
);

test(
  "Kapat düğmesi bildirimi gizliyor",
  () => {
    const runtime = createRuntime();

    runtime.window.TodayErrors
      .capture({
        code: "TODAY-DISMISS-001"
      });

    const surface =
      runtime.document.getElementById(
        "todayErrorNotice"
      );
    const dismissButton =
      runtime.document.getElementById(
        "todayErrorDismiss"
      );

    dismissButton.trigger("click");

    assert.equal(surface.hidden, true);
    assert.equal(
      surface.getAttribute(
        "aria-hidden"
      ),
      "true"
    );
    assert.equal(
      runtime.window.TodayErrors
        .getState()
        .currentNoticeId,
      null
    );
  }
);

test(
  "Ana ekran geri kazanımı Router üzerinden tek güvenli rota açıyor",
  () => {
    const runtime = createRuntime();

    runtime.emit(
      "today:routeerror",
      {
        errorCode:
          "TODAY-ROUTER-TEST"
      }
    );

    const result =
      runtime.window.TodayErrors
        .recover();

    assert.equal(
      result.success,
      true
    );
    assert.equal(
      result.action,
      "home"
    );
    assert.equal(
      runtime.navigateCalls.length,
      1
    );
    assert.equal(
      runtime.navigateCalls[0].route,
      "home"
    );
    assert.equal(
      runtime.navigateCalls[0]
        .options.replace,
      true
    );
    assert.equal(
      runtime.navigateCalls[0]
        .options.source,
      "error-recovery"
    );
  }
);

test(
  "Router geri kazanımı başarısızsa sayfa yenilemeye düşüyor",
  () => {
    const runtime = createRuntime({
      routerRejects: true
    });

    runtime.emit(
      "today:moduleerror",
      {
        errorCode:
          "TODAY-MODULES-TEST"
      }
    );

    const result =
      runtime.window.TodayErrors
        .recover();

    assert.equal(
      result.success,
      true
    );
    assert.equal(
      result.action,
      "reload"
    );
    assert.equal(
      runtime.reloadCount,
      1
    );
  }
);

test(
  "Yeniden dene geri kazanımı sayfayı bir kez yeniliyor",
  () => {
    const runtime = createRuntime();

    runtime.window.TodayErrors
      .capture({
        code: "TODAY-RELOAD-001",
        recovery: "reload"
      });

    runtime.document
      .getElementById(
        "todayErrorRecover"
      )
      .trigger("click");

    assert.equal(
      runtime.reloadCount,
      1
    );
  }
);

test(
  "Hata günlüğünü temizleme kaydı ve açık bildirimi birlikte kaldırıyor",
  () => {
    const runtime = createRuntime();
    const api =
      runtime.window.TodayErrors;

    api.capture({
      code: "TODAY-CLEAR-001"
    });
    const surface =
      runtime.document.getElementById(
        "todayErrorNotice"
      );

    assert.equal(
      api.clearLog(),
      true
    );
    assert.equal(
      api.getLog().length,
      0
    );
    assert.equal(
      surface.hidden,
      true
    );
  }
);

test(
  "Merkezi hata günlüğü localStorage veya kullanıcı state anahtarı kullanmıyor",
  () => {
    assert.equal(
      source.includes(
        "localStorage"
      ),
      false
    );
    assert.equal(
      source.includes(
        "today_app_v10"
      ),
      false
    );
    assert.equal(
      source.includes(
        "today_store_v2"
      ),
      false
    );
  }
);

const failed = results.filter(
  result => !result.success
);

results.forEach(result => {
  const prefix =
    result.success
      ? "PASS"
      : "FAIL";
  const suffix =
    result.error
      ? ` — ${result.error}`
      : "";

  console.log(
    `${prefix}: ${result.name}${suffix}`
  );
});

console.log(
  `Central Error Manager: ${
    results.length - failed.length
  }/${results.length} başarılı`
);

if (failed.length > 0) {
  process.exitCode = 1;
}
