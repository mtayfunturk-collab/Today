const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE_PATH =
  "modules/module-registry.js";
const source = fs.readFileSync(
  SOURCE_PATH,
  "utf8"
);

class MockElement {
  constructor(attributes = {}) {
    this.attributes = {
      ...attributes
    };
    this.parentElement = null;
    this.children = [];
    this.disabled = false;
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(
      this.attributes,
      name
    )
      ? this.attributes[name]
      : null;
  }

  setAttribute(name, value) {
    this.attributes[name] =
      String(value);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  closest(selector) {
    if (
      selector ===
        "[data-module], [data-open-module]" &&
      (
        this.getAttribute(
          "data-module"
        ) !== null ||
        this.getAttribute(
          "data-open-module"
        ) !== null
      )
    ) {
      return this;
    }

    return this.parentElement
      ? this.parentElement.closest(selector)
      : null;
  }
}

class MockDocument {
  constructor(options = {}) {
    this.listeners = {};
    this.triggers = [];

    [
      "core",
      "health",
      "sky"
    ].forEach(moduleId => {
      if (
        moduleId !== options.missingCard
      ) {
        this.triggers.push(
          new MockElement({
            "data-module": moduleId
          })
        );
      }

      if (
        moduleId !==
          options.missingOpenTrigger
      ) {
        for (
          let index = 0;
          index < 3;
          index += 1
        ) {
          this.triggers.push(
            new MockElement({
              "data-open-module":
                moduleId
            })
          );
        }
      }
    });

    if (options.duplicateCard) {
      this.triggers.push(
        new MockElement({
          "data-module":
            options.duplicateCard
        })
      );
    }

    if (options.unknownTrigger) {
      this.triggers.push(
        new MockElement({
          "data-open-module":
            options.unknownTrigger
        })
      );
    }

    if (options.conflictingTrigger) {
      this.triggers.push(
        new MockElement({
          "data-module": "core",
          "data-open-module": "sky"
        })
      );
    }
  }

  querySelectorAll(selector) {
    if (selector === "[data-module]") {
      return this.triggers.filter(
        trigger =>
          trigger.getAttribute(
            "data-module"
          ) !== null
      );
    }

    if (
      selector ===
      "[data-open-module]"
    ) {
      return this.triggers.filter(
        trigger =>
          trigger.getAttribute(
            "data-open-module"
          ) !== null
      );
    }

    return [];
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }

    this.listeners[type].push(handler);
  }

  dispatchClick(target) {
    let prevented = false;

    (
      this.listeners.click || []
    ).forEach(handler => {
      handler({
        target,
        preventDefault() {
          prevented = true;
        }
      });
    });

    return prevented;
  }
}

function createRouter(options = {}) {
  const routes = {
    pick: {
      name: "pick",
      view: "pick"
    },
    health: {
      name: "health",
      view:
        options.healthView ||
        "health"
    },
    sky: {
      name: "sky",
      view: "sky"
    }
  };
  const navigateCalls = [];

  return {
    routes,
    navigateCalls,
    isValidRoute(routeName) {
      return (
        routeName !==
          options.invalidRoute &&
        Object.prototype.hasOwnProperty.call(
          routes,
          routeName
        )
      );
    },
    getRoute(routeName) {
      return routes[routeName] || null;
    },
    navigate(routeName, routeOptions) {
      navigateCalls.push({
        routeName,
        options: routeOptions
      });

      if (options.rejectNavigation) {
        return {
          success: false,
          errorCode:
            "TODAY-ROUTER-TEST"
        };
      }

      return {
        success: true,
        changed:
          options.unchanged !== true,
        route: routeName
      };
    }
  };
}

function createRuntime(options = {}) {
  const document =
    options.document ||
    new MockDocument(options);
  const router =
    options.router ||
    createRouter(options);
  const events = [];
  const errors = [];

  const window = {
    document,
    TodayRouter: router,
    console: {
      error(...args) {
        errors.push(args);
      }
    },
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
    document,
    console: window.console,
    Object,
    Array,
    Map,
    Set,
    String,
    Boolean,
    Number,
    Error
  };

  vm.runInNewContext(source, context, {
    filename: SOURCE_PATH
  });

  return {
    window,
    document,
    router,
    events,
    errors,
    registry: window.TodayModules
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
  "Genel API ve üç görünür modül değişmez olarak yayımlanıyor",
  () => {
    const { registry } =
      createRuntime();

    assert.ok(registry);
    assert.equal(
      Object.isFrozen(registry),
      true
    );
    assert.equal(
      Object.isFrozen(registry.MODULES),
      true
    );
    assert.deepEqual(
      [...registry.MODULE_IDS],
      [
        "core",
        "health",
        "sky"
      ]
    );
    assert.deepEqual(
      [
        ...registry.list()
      ].map(module => [
          module.id,
          module.route,
          module.view
        ]),
      [
        ["core", "pick", "pick"],
        [
          "health",
          "health",
          "health"
        ],
        ["sky", "sky", "sky"]
      ]
    );
  }
);

test(
  "Modül kimliği güvenli biçimde çözülüyor",
  () => {
    const { registry } =
      createRuntime();

    assert.equal(
      registry.get(" CORE ").route,
      "pick"
    );
    assert.equal(
      registry.has("health"),
      true
    );
    assert.equal(
      registry.get("unknown"),
      null
    );
    assert.equal(
      registry.has("unknown"),
      false
    );
  }
);

test(
  "Kanonik tanımlar doğrulanıyor",
  () => {
    const { registry } =
      createRuntime();
    const validation =
      registry.validateDefinitions();

    assert.equal(validation.valid, true);
    assert.deepEqual(
      [...validation.errors],
      []
    );
  }
);

test(
  "Yinelenen modül veya rota tanımı reddediliyor",
  () => {
    const { registry } =
      createRuntime();
    const validation =
      registry.validateDefinitions([
        {
          id: "core",
          route: "pick",
          view: "pick"
        },
        {
          id: "core",
          route: "pick",
          view: "health"
        }
      ]);

    assert.equal(validation.valid, false);
    assert.ok(
      validation.errors.includes(
        "module:core:duplicate"
      )
    );
    assert.ok(
      validation.errors.includes(
        "route:pick:duplicate"
      )
    );
  }
);

test(
  "Router rotaları ve fiziksel görünüm eşleşmeleri doğrulanıyor",
  () => {
    const { registry, router } =
      createRuntime();
    const validation =
      registry.validateRouter(router);

    assert.equal(validation.valid, true);
    assert.deepEqual(
      [
        ...validation.invalidRoutes
      ],
      []
    );
    assert.deepEqual(
      [
        ...validation.viewMismatches
      ],
      []
    );
  }
);

test(
  "Eksik rota ve görünüm uyuşmazlığı belirleniyor",
  () => {
    let runtime = createRuntime({
      invalidRoute: "sky"
    });
    let validation =
      runtime.registry.validateRouter(
        runtime.router
      );

    assert.equal(validation.valid, false);
    assert.deepEqual(
      [...validation.invalidRoutes],
      ["sky"]
    );

    runtime = createRuntime({
      healthView: "pick"
    });
    validation =
      runtime.registry.validateRouter(
        runtime.router
      );

    assert.equal(validation.valid, false);
    assert.deepEqual(
      [...validation.viewMismatches],
      ["health:health"]
    );
  }
);

test(
  "Üç kart ve dokuz alt navigasyon tetikleyicisi doğrulanıyor",
  () => {
    const runtime = createRuntime();
    const validation =
      runtime.registry.validateDom(
        runtime.document
      );

    assert.equal(validation.valid, true);
    assert.equal(
      validation.cards.length,
      3
    );
    assert.equal(
      validation.openTriggers.length,
      9
    );
  }
);

test(
  "Eksik veya yinelenen modül kartı başlatmayı durduruyor",
  () => {
    let runtime = createRuntime({
      missingCard: "health"
    });
    let result =
      runtime.registry.init({
        router: runtime.router,
        root: runtime.document
      });

    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-MODULES-003"
    );
    assert.deepEqual(
      [...result.missingCards],
      ["health"]
    );

    runtime = createRuntime({
      duplicateCard: "core"
    });
    result =
      runtime.registry.init({
        router: runtime.router,
        root: runtime.document
      });

    assert.equal(result.success, false);
    assert.deepEqual(
      [...result.duplicateCards],
      ["core"]
    );
  }
);

test(
  "Bilinmeyen ve çelişkili tetikleyici reddediliyor",
  () => {
    let runtime = createRuntime({
      unknownTrigger: "future"
    });
    let validation =
      runtime.registry.validateDom(
        runtime.document
      );

    assert.equal(validation.valid, false);
    assert.deepEqual(
      [...validation.unknownTriggers],
      ["future"]
    );

    runtime = createRuntime({
      conflictingTrigger: true
    });
    validation =
      runtime.registry.validateDom(
        runtime.document
      );

    assert.equal(validation.valid, false);
    assert.deepEqual(
      [
        ...validation.conflictingTriggers
      ],
      ["core:sky"]
    );
  }
);

test(
  "Eksik Router API kontrollü başlangıç hatası üretiyor",
  () => {
    const runtime = createRuntime();
    const invalidRouter = {
      navigate() {}
    };
    const result =
      runtime.registry.init({
        router: invalidRouter,
        root: runtime.document
      });

    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-MODULES-002"
    );
    assert.deepEqual(
      [...result.missingMethods],
      [
        "isValidRoute",
        "getRoute"
      ]
    );
  }
);

test(
  "Başlatma tek olay kapısı kuruyor ve hazır olayını yayımlıyor",
  () => {
    const runtime = createRuntime();
    const result =
      runtime.registry.init({
        router: runtime.router,
        root: runtime.document
      });

    assert.equal(result.success, true);
    assert.equal(result.changed, true);
    assert.equal(result.moduleCount, 3);
    assert.equal(result.triggerCount, 12);
    assert.equal(
      runtime.document.listeners.click
        .length,
      1
    );
    assert.equal(
      runtime.events.at(-1).type,
      "today:modules-ready"
    );
  }
);

test(
  "Yinelenen init yeni olay dinleyicisi oluşturmuyor",
  () => {
    const runtime = createRuntime();

    runtime.registry.init({
      router: runtime.router,
      root: runtime.document
    });

    const result =
      runtime.registry.init({
        router: runtime.router,
        root: runtime.document
      });

    assert.equal(result.success, true);
    assert.equal(result.changed, false);
    assert.equal(
      runtime.document.listeners.click
        .length,
      1
    );
  }
);

test(
  "Modül kartı Registry üzerinden Core rotasını açıyor",
  () => {
    const runtime = createRuntime();

    runtime.registry.init({
      router: runtime.router,
      root: runtime.document
    });

    const coreCard =
      runtime.document
        .querySelectorAll(
          "[data-module]"
        )[0];
    const child =
      coreCard.appendChild(
        new MockElement()
      );
    const prevented =
      runtime.document.dispatchClick(
        child
      );
    const call =
      runtime.router.navigateCalls[0];

    assert.equal(prevented, true);
    assert.equal(
      call.routeName,
      "pick"
    );
    assert.equal(
      call.options.source,
      "module-card"
    );
    assert.equal(
      runtime.events.at(-1).type,
      "today:moduleopen"
    );
  }
);

test(
  "Alt navigasyon Registry üzerinden Health rotasını açıyor",
  () => {
    const runtime = createRuntime();

    runtime.registry.init({
      router: runtime.router,
      root: runtime.document
    });

    const healthTrigger =
      runtime.document
        .querySelectorAll(
          "[data-open-module]"
        )
        .find(
          trigger =>
            trigger.getAttribute(
              "data-open-module"
            ) === "health"
        );

    runtime.document.dispatchClick(
      healthTrigger
    );

    const call =
      runtime.router.navigateCalls[0];

    assert.equal(
      call.routeName,
      "health"
    );
    assert.equal(
      call.options.source,
      "module-navigation"
    );
  }
);

test(
  "Üç kayıt doğru Router rotasına açılıyor",
  () => {
    const runtime = createRuntime();

    runtime.registry.init({
      router: runtime.router,
      root: runtime.document
    });

    [
      "core",
      "health",
      "sky"
    ].forEach(moduleId => {
      const result =
        runtime.registry.open(
          moduleId,
          {
            moveFocus: false,
            source: "test"
          }
        );

      assert.equal(
        result.success,
        true
      );
    });

    assert.deepEqual(
      runtime.router.navigateCalls.map(
        call => call.routeName
      ),
      [
        "pick",
        "health",
        "sky"
      ]
    );
    assert.ok(
      runtime.router.navigateCalls.every(
        call =>
          call.options.moveFocus ===
            false &&
          call.options.source === "test"
      )
    );
  }
);

test(
  "Başlatılmadan açma ve bilinmeyen modül kontrollü reddediliyor",
  () => {
    let runtime = createRuntime();
    let result =
      runtime.registry.open("core");

    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-MODULES-004"
    );

    runtime = createRuntime();
    runtime.registry.init({
      router: runtime.router,
      root: runtime.document
    });
    result =
      runtime.registry.open(
        "unknown"
      );

    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-MODULES-005"
    );
    assert.equal(
      runtime.events.at(-1).type,
      "today:moduleerror"
    );
  }
);

test(
  "Router reddi modül hatasına dönüştürülüyor",
  () => {
    const runtime = createRuntime({
      rejectNavigation: true
    });

    runtime.registry.init({
      router: runtime.router,
      root: runtime.document
    });
    const result =
      runtime.registry.open("sky");

    assert.equal(result.success, false);
    assert.equal(
      result.errorCode,
      "TODAY-MODULES-006"
    );
    assert.equal(
      result.routeError,
      "TODAY-ROUTER-TEST"
    );
  }
);

test(
  "Devre dışı tetikleyici rota açmıyor",
  () => {
    const runtime = createRuntime();

    runtime.registry.init({
      router: runtime.router,
      root: runtime.document
    });

    const trigger =
      runtime.document
        .querySelectorAll(
          "[data-open-module]"
        )[0];
    trigger.setAttribute(
      "aria-disabled",
      "true"
    );

    const prevented =
      runtime.document.dispatchClick(
        trigger
      );

    assert.equal(prevented, false);
    assert.equal(
      runtime.router.navigateCalls.length,
      0
    );
  }
);

const failed = results.filter(
  result => !result.success
);

results.forEach(result => {
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
  `Module Registry: ${
    results.length - failed.length
  }/${results.length} başarılı`
);

if (failed.length > 0) {
  process.exitCode = 1;
}
