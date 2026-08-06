const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE_PATH =
  "modules/router.js";
const source = fs.readFileSync(
  SOURCE_PATH,
  "utf8"
);

class MockClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    if (force) {
      this.values.add(name);
      return true;
    }

    this.values.delete(name);
    return false;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class MockElement {
  constructor(ownerDocument, id = "") {
    this.ownerDocument = ownerDocument;
    this.id = id;
    this.attributes = {};
    this.children = [];
    this.classList = new MockClassList();
    this.dataset = {};
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);

    if (name === "id") {
      this.id = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    if (selector !== "[data-view-title]") {
      return null;
    }

    return (
      this.children.find(
        child =>
          child.getAttribute(
            "data-view-title"
          ) !== null
      ) ||
      null
    );
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }
}

class MockDocument {
  constructor({
    missingView = null,
    duplicateView = null
  } = {}) {
    this.title = "Today";
    this.activeElement = null;
    this.body = new MockElement(this, "body");
    this.views = [];
    this.byId = new Map();

    [
      "home",
      "modules",
      "pick",
      "health",
      "sky",
      "calendar"
    ].forEach((viewName) => {
      if (viewName === missingView) {
        return;
      }

      this.addView(viewName);
    });

    if (duplicateView) {
      this.addView(duplicateView);
    }

    this.addElement("accStatsHead");
    this.addElement("accSettingsHead");
  }

  addView(viewName) {
    const view = new MockElement(this);
    view.setAttribute("data-view", viewName);

    const title = new MockElement(
      this,
      `${viewName}Title`
    );
    title.setAttribute(
      "data-view-title",
      ""
    );
    view.appendChild(title);

    this.views.push(view);
    this.byId.set(title.id, title);
  }

  addElement(id) {
    const element = new MockElement(
      this,
      id
    );
    this.byId.set(id, element);
    return element;
  }

  querySelectorAll(selector) {
    if (selector === "[data-view]") {
      return this.views;
    }

    return [];
  }

  querySelector(selector) {
    if (selector.startsWith("#")) {
      return (
        this.byId.get(selector.slice(1)) ||
        null
      );
    }

    return null;
  }
}

class MockHistory {
  constructor(emitPopState) {
    this.entries = [
      {
        state: null
      }
    ];
    this.index = 0;
    this.emitPopState = emitPopState;
    this.goCalls = [];
  }

  get state() {
    return this.entries[this.index].state;
  }

  replaceState(state) {
    this.entries[this.index] = {
      state
    };
  }

  pushState(state) {
    this.entries = this.entries.slice(
      0,
      this.index + 1
    );
    this.entries.push({
      state
    });
    this.index += 1;
  }

  go(delta) {
    this.goCalls.push(delta);

    const nextIndex =
      this.index + delta;

    if (
      nextIndex < 0 ||
      nextIndex >= this.entries.length
    ) {
      return;
    }

    this.index = nextIndex;
    this.emitPopState(
      this.entries[this.index].state
    );
  }

  back() {
    this.go(-1);
  }
}

function createRuntime(options = {}) {
  const document = new MockDocument(options);
  const listeners = {};
  const events = [];
  const routeChanges = [];

  const window = {
    document,
    console: {
      error() {}
    },
    addEventListener(type, handler) {
      if (!listeners[type]) {
        listeners[type] = [];
      }

      listeners[type].push(handler);
    },
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
    requestAnimationFrame(callback) {
      callback();
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    }
  };

  if (options.history !== false) {
    window.history = new MockHistory(
      (state) => {
        (
          listeners.popstate || []
        ).forEach(handler =>
          handler({
            state
          })
        );
      }
    );
  }

  const context = {
    window,
    document,
    console: window.console,
    Object,
    Array,
    Map,
    Set,
    Number,
    String,
    Boolean,
    Error
  };

  vm.runInNewContext(source, context, {
    filename: SOURCE_PATH
  });

  const init = (initOptions = {}) =>
    window.TodayRouter.init({
      initialRoute: "home",
      moveFocus: false,
      onRouteChange(detail) {
        routeChanges.push(detail);
      },
      ...initOptions
    });

  return {
    window,
    document,
    listeners,
    events,
    routeChanges,
    init
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
  "Genel API ve sekiz rota yayımlanıyor",
  () => {
    const runtime = createRuntime();
    const router =
      runtime.window.TodayRouter;

    assert.ok(router);
    assert.equal(Object.isFrozen(router), true);
    assert.deepEqual(
      [...router.ROUTE_NAMES],
      [
        "home",
        "modules",
        "pick",
        "health",
        "sky",
        "calendar",
        "statistics",
        "settings"
      ]
    );
    assert.equal(
      router.ROUTES.statistics.view,
      "calendar"
    );
    assert.equal(
      router.ROUTES.settings.panel,
      "settings"
    );
  }
);

test(
  "Altı fiziksel görünüm sözleşmesi doğrulanıyor",
  () => {
    const runtime = createRuntime();
    const validation =
      runtime.window.TodayRouter
        .validateViews();

    assert.equal(validation.valid, true);
    assert.equal(validation.views.size, 6);
    assert.deepEqual(
      [...validation.missingViews],
      []
    );
    assert.deepEqual(
      [...validation.duplicateViews],
      []
    );
  }
);

test(
  "Eksik görünüm başlatmayı güvenli biçimde durduruyor",
  () => {
    const runtime = createRuntime({
      missingView: "sky"
    });
    const result = runtime.init();

    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-ROUTER-002"
    );
    assert.deepEqual(
      [...result.missingViews],
      ["sky"]
    );
    assert.equal(
      runtime.window.TodayRouter
        .getState().initialized,
      false
    );
  }
);

test(
  "Yinelenen görünüm başlatmayı güvenli biçimde durduruyor",
  () => {
    const runtime = createRuntime({
      duplicateView: "pick"
    });
    const result = runtime.init();

    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-ROUTER-002"
    );
    assert.deepEqual(
      [...result.duplicateViews],
      ["pick"]
    );
  }
);

test(
  "Başlangıç rotası home ve tek görünür ekran oluyor",
  () => {
    const runtime = createRuntime();
    const result = runtime.init();

    assert.equal(result.success, true);
    assert.equal(result.route, "home");
    assert.equal(
      runtime.document.body.dataset.route,
      "home"
    );

    runtime.document.views.forEach(
      (view) => {
        const isHome =
          view.getAttribute(
            "data-view"
          ) === "home";

        assert.equal(
          view.classList.contains("show"),
          isHome
        );
        assert.equal(
          view.getAttribute("aria-hidden"),
          String(!isHome)
        );
      }
    );

    assert.equal(
      runtime.window.history.state
        .todayRoute,
      "home"
    );
    assert.equal(
      runtime.routeChanges.length,
      1
    );
  }
);

test(
  "Rota geçişi görünümü ve history durumunu birlikte güncelliyor",
  () => {
    const runtime = createRuntime();
    runtime.init();

    runtime.window.TodayRouter
      .navigate("modules");
    const result =
      runtime.window.TodayRouter
        .navigate("pick");

    assert.equal(result.success, true);
    assert.equal(result.route, "pick");
    assert.equal(result.view, "pick");
    assert.equal(result.historyIndex, 2);
    assert.equal(
      runtime.window.history.state
        .todayRoute,
      "pick"
    );
    assert.equal(
      runtime.window.history.entries.length,
      3
    );
  }
);

test(
  "Aynı rotaya geçiş yinelenen history kaydı oluşturmuyor",
  () => {
    const runtime = createRuntime();
    runtime.init();
    runtime.window.TodayRouter
      .navigate("modules");

    const before =
      runtime.window.history.entries.length;
    const result =
      runtime.window.TodayRouter
        .navigate("modules");

    assert.equal(result.changed, false);
    assert.equal(
      runtime.window.history.entries.length,
      before
    );
  }
);

test(
  "Bilinmeyen rota mevcut görünümü değiştirmiyor",
  () => {
    const runtime = createRuntime();
    runtime.init();

    const result =
      runtime.window.TodayRouter
        .navigate("unknown");

    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-ROUTER-001"
    );
    assert.equal(
      runtime.window.TodayRouter
        .getState().route,
      "home"
    );
    assert.equal(
      runtime.events.at(-1).type,
      "today:routeerror"
    );
  }
);

test(
  "Normal rotada görünüm başlığına odak taşınıyor",
  () => {
    const runtime = createRuntime();
    runtime.init();

    runtime.window.TodayRouter.navigate(
      "modules",
      {
        moveFocus: true
      }
    );

    assert.equal(
      runtime.document.activeElement.id,
      "modulesTitle"
    );
  }
);

test(
  "İstatistik ve Ayarlar aynı Takvim görünümünde ayrı rota durumu taşıyor",
  () => {
    const runtime = createRuntime();
    runtime.init();

    let result =
      runtime.window.TodayRouter
        .navigate("statistics");

    assert.equal(result.view, "calendar");
    assert.equal(result.panel, "statistics");
    assert.equal(
      runtime.document.activeElement.id,
      "accStatsHead"
    );

    result =
      runtime.window.TodayRouter
        .navigate("settings");

    assert.equal(result.view, "calendar");
    assert.equal(result.panel, "settings");
    assert.equal(
      runtime.document.activeElement.id,
      "accSettingsHead"
    );
  }
);

test(
  "backTo önceki hedef rotayı history üzerinden buluyor",
  () => {
    const runtime = createRuntime();
    runtime.init();
    const router =
      runtime.window.TodayRouter;

    router.navigate("modules");
    router.navigate("pick");
    router.navigate("health");

    const result =
      router.backTo("modules");

    assert.equal(result.pending, true);
    assert.equal(
      runtime.window.history.goCalls.at(-1),
      -2
    );
    assert.equal(
      router.getState().route,
      "modules"
    );
    assert.equal(
      router.getState().historyIndex,
      1
    );
  }
);

test(
  "Tarayıcı geri hareketi önceki görünüm durumunu geri yüklüyor",
  () => {
    const runtime = createRuntime();
    runtime.init();
    const router =
      runtime.window.TodayRouter;

    router.navigate("modules");
    router.navigate("pick");
    runtime.window.history.back();

    assert.equal(
      router.getState().route,
      "modules"
    );
    assert.equal(
      runtime.routeChanges.at(-1).source,
      "popstate"
    );
  }
);

test(
  "Geri dönüşten sonraki yeni rota ileri geçmişini kesiyor",
  () => {
    const runtime = createRuntime();
    runtime.init();
    const router =
      runtime.window.TodayRouter;

    router.navigate("modules");
    router.navigate("pick");
    runtime.window.history.back();
    router.navigate("health");

    assert.equal(
      runtime.window.history.entries.length,
      3
    );
    assert.equal(
      runtime.window.history.state
        .todayRoute,
      "health"
    );
    assert.equal(
      router.getState().historyDepth,
      3
    );
  }
);

test(
  "History API yoksa görünüm geçişi ve backTo çalışmaya devam ediyor",
  () => {
    const runtime = createRuntime({
      history: false
    });
    runtime.init();
    const router =
      runtime.window.TodayRouter;

    router.navigate("modules");
    router.navigate("pick");
    const result =
      router.backTo("modules");

    assert.equal(result.success, true);
    assert.equal(result.pending, undefined);
    assert.equal(
      router.getState().route,
      "modules"
    );
    assert.equal(
      router.getState().historyEnabled,
      false
    );
  }
);

test(
  "Yinelenen init yeni dinleyici veya rota kaydı oluşturmuyor",
  () => {
    const runtime = createRuntime();
    runtime.init();

    const beforeEntries =
      runtime.window.history.entries.length;
    const beforeListeners =
      runtime.listeners.popstate.length;
    const result = runtime.init({
      initialRoute: "sky"
    });

    assert.equal(result.changed, false);
    assert.equal(result.route, "home");
    assert.equal(
      runtime.window.history.entries.length,
      beforeEntries
    );
    assert.equal(
      runtime.listeners.popstate.length,
      beforeListeners
    );
  }
);

const failed = results.filter(
  result => !result.success
);

results.forEach((result) => {
  const prefix =
    result.success ? "PASS" : "FAIL";
  const suffix =
    result.error
      ? ` — ${result.error}`
      : "";

  console.log(
    `${prefix}: ${result.name}${suffix}`
  );
});

console.log(
  `\nRouter: ${
    results.length - failed.length
  }/${results.length} başarılı`
);

if (failed.length) {
  process.exitCode = 1;
}
