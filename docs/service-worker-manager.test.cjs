const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE_PATH =
  "modules/service-worker-manager.js";
const source = fs.readFileSync(
  SOURCE_PATH,
  "utf8"
);

class MockEventTarget {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }

    this.listeners[type].push(handler);
  }

  emit(type, event = {}) {
    (
      this.listeners[type] || []
    ).forEach(handler =>
      handler({
        type,
        ...event
      })
    );
  }

  listenerCount(type) {
    return (
      this.listeners[type] || []
    ).length;
  }
}

class MockElement extends MockEventTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this.id = "";
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.type = "";
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name];
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

  trigger(type) {
    this.emit(type, {
      target: this
    });
  }
}

class MockDocument {
  constructor() {
    this.visibilityState = "visible";
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

class MockWorker extends MockEventTarget {
  constructor(
    state = "installing",
    options = {}
  ) {
    super();
    this.state = state;
    this.messages = [];
    this.postMessageThrows =
      options.postMessageThrows === true;
  }

  postMessage(message) {
    if (this.postMessageThrows) {
      throw new Error(
        "postMessage failed"
      );
    }

    this.messages.push(message);
  }

  setState(state) {
    this.state = state;
    this.emit("statechange", {
      target: this
    });
  }
}

class MockRegistration extends MockEventTarget {
  constructor(options = {}) {
    super();
    this.waiting =
      options.waiting || null;
    this.installing =
      options.installing || null;
    this.updateCount = 0;
    this.updateRejects =
      options.updateRejects === true;
  }

  update() {
    this.updateCount += 1;

    if (this.updateRejects) {
      return Promise.reject(
        new Error("Update failed")
      );
    }

    return Promise.resolve(this);
  }

  emitUpdateFound(worker) {
    this.installing = worker;
    this.emit("updatefound");
  }
}

function createRuntime(options = {}) {
  const document = new MockDocument();
  const windowEvents =
    new MockEventTarget();
  const serviceWorkerEvents =
    new MockEventTarget();
  const dispatchedEvents = [];
  let registerCount = 0;
  let discoveryCount = 0;
  let reloadCount = 0;

  const registration =
    options.registration ||
    new MockRegistration();
  const serviceWorker = {
    controller:
      options.controller === undefined
        ? {}
        : options.controller,
    addEventListener(type, handler) {
      serviceWorkerEvents.addEventListener(
        type,
        handler
      );
    },
    register(scriptUrl) {
      registerCount += 1;

      if (options.registerThrows) {
        throw new Error(
          "Register threw"
        );
      }

      if (options.registerRejects) {
        return Promise.reject(
          new Error(
            "Register rejected"
          )
        );
      }

      registration.scriptUrl =
        scriptUrl;
      return Promise.resolve(
        registration
      );
    }
  };

  if (
    Array.isArray(
      options.getRegistrationSequence
    )
  ) {
    serviceWorker.getRegistration =
      () => {
        const index = Math.min(
          discoveryCount,
          options
            .getRegistrationSequence
            .length - 1
        );
        const value =
          options
            .getRegistrationSequence[
              index
            ];

        discoveryCount += 1;
        return Promise.resolve(
          value || null
        );
      };
  }
  const navigator = {};

  if (options.supported !== false) {
    navigator.serviceWorker =
      serviceWorker;
  }

  const window = {
    document,
    navigator,
    location: {
      reload() {
        reloadCount += 1;
      }
    },
    addEventListener(type, handler) {
      windowEvents.addEventListener(
        type,
        handler
      );
    },
    dispatchEvent(event) {
      dispatchedEvents.push(event);
      windowEvents.emit(
        event.type,
        event
      );
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
    navigator,
    console: {
      info() {},
      warn() {},
      error() {}
    },
    Promise,
    Object,
    Array,
    String,
    Boolean,
    Error,
    TypeError,
    WeakSet
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
    navigator,
    serviceWorker,
    serviceWorkerEvents,
    registration,
    dispatchedEvents,
    async flushPromises() {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
    emitControllerChange() {
      serviceWorkerEvents.emit(
        "controllerchange"
      );
    },
    eventCount(type) {
      return dispatchedEvents.filter(
        event => event.type === type
      ).length;
    },
    get registerCount() {
      return registerCount;
    },
    get discoveryCount() {
      return discoveryCount;
    },
    get reloadCount() {
      return reloadCount;
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
      error:
        error && error.message
          ? error.message
          : String(error)
    });
  }
}

(async () => {
  await test(
    "Genel API değişmez ve otomatik başlatılmış olarak yayımlanıyor",
    () => {
      const runtime =
        createRuntime();
      const api =
        runtime.window
          .TodayServiceWorker;

      assert.ok(api);
      assert.equal(
        Object.isFrozen(api),
        true
      );
      assert.equal(
        api.MANAGER_VERSION,
        1
      );
      assert.equal(
        api.ACTIVATE_MESSAGE,
        "TODAY_ACTIVATE_UPDATE"
      );
      assert.equal(
        api.getState().initialized,
        true
      );
    }
  );

  await test(
    "Controller değişimi tek kez dinleniyor ve init idempotent",
    () => {
      const runtime =
        createRuntime();
      const api =
        runtime.window
          .TodayServiceWorker;

      assert.equal(
        runtime.serviceWorkerEvents
          .listenerCount(
            "controllerchange"
          ),
        1
      );
      assert.equal(
        runtime.window
          .TodayServiceWorker
          .getState()
          .listenersBound,
        true
      );
      assert.equal(
        api.init().changed,
        false
      );
      assert.equal(
        runtime.serviceWorkerEvents
          .listenerCount(
            "controllerchange"
          ),
        1
      );
    }
  );

  await test(
    "foundation-010 hazır olayı registration taşımadan yeni yöneticiyi kayda bağlıyor",
    async () => {
      const waiting =
        new MockWorker("installed");
      const legacyRegistration =
        new MockRegistration({
          waiting
        });
      const runtime =
        createRuntime({
          getRegistrationSequence: [
            null,
            legacyRegistration
          ]
        });

      await runtime.flushPromises();

      runtime.window.dispatchEvent(
        new runtime.window.CustomEvent(
          "today:service-worker-ready",
          {
            detail: {
              scriptUrl:
                "./sw.js"
            }
          }
        )
      );
      await runtime.flushPromises();

      assert.equal(
        runtime.discoveryCount,
        2
      );
      assert.equal(
        legacyRegistration
          .listenerCount(
            "updatefound"
          ),
        1
      );
      assert.equal(
        runtime.window
          .TodayServiceWorker
          .getState().phase,
        "update-ready"
      );
      assert.equal(
        runtime.document
          .getElementById(
            "todayUpdateNotice"
          ).hidden,
        false
      );
      assert.equal(
        runtime.registerCount,
        0
      );
    }
  );

  await test(
    "Yeni hazır olayı registration nesnesini doğrudan ve tek kez izliyor",
    async () => {
      const waiting =
        new MockWorker("installed");
      const directRegistration =
        new MockRegistration({
          waiting
        });
      const runtime =
        createRuntime();
      const readyEvent =
        new runtime.window.CustomEvent(
          "today:service-worker-ready",
          {
            detail: {
              registration:
                directRegistration
            }
          }
        );

      runtime.window.dispatchEvent(
        readyEvent
      );
      runtime.window.dispatchEvent(
        readyEvent
      );

      assert.equal(
        directRegistration
          .listenerCount(
            "updatefound"
          ),
        1
      );
      assert.equal(
        runtime.eventCount(
          "today:service-worker-update-ready"
        ),
        1
      );
    }
  );

  await test(
    "Desteklenmeyen tarayıcı kontrollü biçimde çevrimiçi kullanıma devam ediyor",
    async () => {
      const runtime =
        createRuntime({
          supported: false
        });
      const result =
        await runtime.window
          .TodayServiceWorker
          .start();

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.supported,
        false
      );
      assert.equal(
        result.phase,
        "unsupported"
      );
      assert.equal(
        runtime.registerCount,
        0
      );
    }
  );

  await test(
    "Service Worker verilen URL ile bir kez kaydediliyor",
    async () => {
      const runtime =
        createRuntime();
      const result =
        await runtime.window
          .TodayServiceWorker
          .start({
            scriptUrl:
              "./sw.js"
          });

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        runtime.registration
          .scriptUrl,
        "./sw.js"
      );
      assert.equal(
        runtime.registerCount,
        1
      );
      assert.equal(
        result.registered,
        true
      );
    }
  );

  await test(
    "İkinci start kaydı ve registration dinleyicisini çoğaltmıyor",
    async () => {
      const runtime =
        createRuntime();
      const api =
        runtime.window
          .TodayServiceWorker;

      await Promise.all([
        api.start(),
        api.start()
      ]);
      await api.start();

      assert.equal(
        runtime.registerCount,
        1
      );
      assert.equal(
        runtime.registration
          .listenerCount(
            "updatefound"
          ),
        1
      );
    }
  );

  await test(
    "Kayıt reddi failed durumuna geçiyor ve yeniden denemeye izin veriyor",
    async () => {
      const runtime =
        createRuntime({
          registerRejects: true
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await assert.rejects(
        api.start()
      );
      await assert.rejects(
        api.start()
      );

      assert.equal(
        runtime.registerCount,
        2
      );
      assert.equal(
        api.getState().phase,
        "failed"
      );
      assert.equal(
        api.getState().errorCode,
        "TODAY-SW-REGISTER-001"
      );
    }
  );

  await test(
    "Senkron kayıt hatası Promise reddine dönüştürülüyor",
    async () => {
      const runtime =
        createRuntime({
          registerThrows: true
        });

      await assert.rejects(
        runtime.window
          .TodayServiceWorker
          .start()
      );
      assert.equal(
        runtime.window
          .TodayServiceWorker
          .getState().phase,
        "failed"
      );
    }
  );

  await test(
    "Önceden bekleyen worker güncelleme bildirimi açıyor",
    async () => {
      const waiting =
        new MockWorker("installed");
      const runtime =
        createRuntime({
          registration:
            new MockRegistration({
              waiting
            })
        });

      await runtime.window
        .TodayServiceWorker
        .start();

      const surface =
        runtime.document
          .getElementById(
            "todayUpdateNotice"
          );

      assert.ok(surface);
      assert.equal(
        surface.hidden,
        false
      );
      assert.equal(
        surface.getAttribute(
          "aria-hidden"
        ),
        "false"
      );
      assert.equal(
        runtime.window
          .TodayServiceWorker
          .getState()
          .updateAvailable,
        true
      );
    }
  );

  await test(
    "Güncelleme bildirimi polite ve açıklamalı erişilebilir yüzey kullanıyor",
    async () => {
      const runtime =
        createRuntime({
          registration:
            new MockRegistration({
              waiting:
                new MockWorker(
                  "installed"
                )
            })
        });

      await runtime.window
        .TodayServiceWorker
        .start();

      const surface =
        runtime.document
          .getElementById(
            "todayUpdateNotice"
          );

      assert.equal(
        surface.getAttribute("role"),
        "status"
      );
      assert.equal(
        surface.getAttribute(
          "aria-live"
        ),
        "polite"
      );
      assert.equal(
        surface.getAttribute(
          "aria-labelledby"
        ),
        "todayUpdateTitle"
      );
      assert.equal(
        surface.getAttribute(
          "aria-describedby"
        ),
        "todayUpdateText"
      );
    }
  );

  await test(
    "Bildirim açık onay ve erteleme seçeneklerini doğru metinlerle sunuyor",
    async () => {
      const runtime =
        createRuntime({
          registration:
            new MockRegistration({
              waiting:
                new MockWorker(
                  "installed"
                )
            })
        });

      await runtime.window
        .TodayServiceWorker
        .start();

      assert.equal(
        runtime.document
          .getElementById(
            "todayUpdateTitle"
          ).textContent,
        "Yeni sürüm hazır"
      );
      assert.match(
        runtime.document
          .getElementById(
            "todayUpdateText"
          ).textContent,
        /sen onayladığında/
      );
      assert.equal(
        runtime.document
          .getElementById(
            "todayUpdateApply"
          ).textContent,
        "Şimdi güncelle"
      );
      assert.equal(
        runtime.document
          .getElementById(
            "todayUpdateLater"
          ).textContent,
        "Daha sonra"
      );
    }
  );

  await test(
    "Hazır olayı aynı worker için yalnızca bir kez yayımlanıyor",
    async () => {
      const waiting =
        new MockWorker("installed");
      const registration =
        new MockRegistration({
          waiting
        });
      const runtime =
        createRuntime({
          registration
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      waiting.setState(
        "installed"
      );
      await api.start();

      assert.equal(
        runtime.eventCount(
          "today:service-worker-update-ready"
        ),
        1
      );
    }
  );

  await test(
    "Daha sonra seçimi bildirimi kapatıyor ve worker'ı etkinleştirmiyor",
    async () => {
      const waiting =
        new MockWorker("installed");
      const runtime =
        createRuntime({
          registration:
            new MockRegistration({
              waiting
            })
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      const result =
        api.deferUpdate();

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.action,
        "defer"
      );
      assert.equal(
        result.phase,
        "deferred"
      );
      assert.equal(
        result.deferred,
        true
      );
      assert.equal(
        waiting.messages.length,
        0
      );
      assert.equal(
        runtime.document
          .getElementById(
            "todayUpdateNotice"
          ).hidden,
        true
      );
      assert.equal(
        runtime.reloadCount,
        0
      );
    }
  );

  await test(
    "Erteleme olayı bir kez yayımlanıyor",
    async () => {
      const runtime =
        createRuntime({
          registration:
            new MockRegistration({
              waiting:
                new MockWorker(
                  "installed"
                )
            })
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      api.deferUpdate();

      assert.equal(
        runtime.eventCount(
          "today:service-worker-update-deferred"
        ),
        1
      );
    }
  );

  await test(
    "Şimdi güncelle yalnız bekleyen worker'a etkinleştirme mesajı gönderiyor",
    async () => {
      const waiting =
        new MockWorker("installed");
      const runtime =
        createRuntime({
          registration:
            new MockRegistration({
              waiting
            })
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      const result =
        api.activateUpdate();

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        result.action,
        "activate"
      );
      assert.equal(
        waiting.messages.length,
        1
      );
      assert.equal(
        waiting.messages[0].type,
        "TODAY_ACTIVATE_UPDATE"
      );
      assert.equal(
        result.userAccepted,
        true
      );
      assert.equal(
        runtime.reloadCount,
        0
      );
    }
  );

  await test(
    "Etkinleştirme sırasında iki bildirim düğmesi devre dışı kalıyor",
    async () => {
      const runtime =
        createRuntime({
          registration:
            new MockRegistration({
              waiting:
                new MockWorker(
                  "installed"
                )
            })
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      api.activateUpdate();

      assert.equal(
        runtime.document
          .getElementById(
            "todayUpdateApply"
          ).disabled,
        true
      );
      assert.equal(
        runtime.document
          .getElementById(
            "todayUpdateLater"
          ).disabled,
        true
      );
      assert.match(
        runtime.document
          .getElementById(
            "todayUpdateText"
          ).textContent,
        /güncelleniyor/
      );
    }
  );

  await test(
    "Onay sonrası controllerchange sayfayı yalnızca bir kez yeniliyor",
    async () => {
      const runtime =
        createRuntime({
          registration:
            new MockRegistration({
              waiting:
                new MockWorker(
                  "installed"
                )
            })
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      api.activateUpdate();
      runtime.emitControllerChange();
      runtime.emitControllerChange();

      assert.equal(
        runtime.reloadCount,
        1
      );
      assert.equal(
        api.getState()
          .reloadTriggered,
        true
      );
      assert.equal(
        runtime.eventCount(
          "today:service-worker-update-activated"
        ),
        1
      );
    }
  );

  await test(
    "Kullanıcı onayı olmadan controllerchange sayfayı yenilemiyor",
    async () => {
      const runtime =
        createRuntime();

      await runtime.window
        .TodayServiceWorker
        .start();
      runtime.emitControllerChange();

      assert.equal(
        runtime.reloadCount,
        0
      );
      assert.equal(
        runtime.window
          .TodayServiceWorker
          .getState().phase,
        "registered"
      );
    }
  );

  await test(
    "İlk kurulum controller yokken bildirim ve yeniden yükleme üretmiyor",
    async () => {
      const installing =
        new MockWorker(
          "installing"
        );
      const runtime =
        createRuntime({
          controller: null,
          registration:
            new MockRegistration({
              installing
            })
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      installing.setState(
        "installed"
      );

      assert.equal(
        api.getState()
          .updateAvailable,
        false
      );
      assert.equal(
        runtime.document
          .getElementById(
            "todayUpdateNotice"
          ),
        null
      );
      assert.equal(
        runtime.reloadCount,
        0
      );
    }
  );

  await test(
    "updatefound ile bulunan worker kurulunca güncelleme hazır oluyor",
    async () => {
      const registration =
        new MockRegistration();
      const runtime =
        createRuntime({
          registration
        });
      const api =
        runtime.window
          .TodayServiceWorker;
      const worker =
        new MockWorker(
          "installing"
        );

      await api.start();
      registration.emitUpdateFound(
        worker
      );

      assert.equal(
        api.getState().phase,
        "installing"
      );
      assert.equal(
        worker.listenerCount(
          "statechange"
        ),
        1
      );

      registration.waiting =
        worker;
      worker.setState(
        "installed"
      );

      assert.equal(
        api.getState().phase,
        "update-ready"
      );
      assert.equal(
        api.getState()
          .updateAvailable,
        true
      );
    }
  );

  await test(
    "Aynı installing worker için statechange dinleyicisi çoğalmıyor",
    async () => {
      const worker =
        new MockWorker(
          "installing"
        );
      const registration =
        new MockRegistration({
          installing: worker
        });
      const runtime =
        createRuntime({
          registration
        });

      await runtime.window
        .TodayServiceWorker
        .start();
      registration.emitUpdateFound(
        worker
      );

      assert.equal(
        worker.listenerCount(
          "statechange"
        ),
        1
      );
    }
  );

  await test(
    "Redundant worker güvenli güncelleme hatası yayımlıyor",
    async () => {
      const worker =
        new MockWorker(
          "installing"
        );
      const registration =
        new MockRegistration({
          installing: worker
        });
      const runtime =
        createRuntime({
          registration
        });

      await runtime.window
        .TodayServiceWorker
        .start();
      worker.setState(
        "redundant"
      );

      const event =
        runtime.dispatchedEvents.find(
          item =>
            item.type ===
            "today:service-worker-update-error"
        );

      assert.ok(event);
      assert.equal(
        event.detail.errorCode,
        "TODAY-SW-UPDATE-003"
      );
      assert.equal(
        event.detail.stage,
        "install"
      );
      assert.equal(
        event.detail.workerState,
        "redundant"
      );
    }
  );

  await test(
    "Bekleyen worker yoksa etkinleştirme kontrollü hata dönüyor",
    async () => {
      const runtime =
        createRuntime();
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      const result =
        api.activateUpdate();

      assert.equal(
        result.success,
        false
      );
      assert.equal(
        result.errorCode,
        "TODAY-SW-UPDATE-008"
      );
      assert.equal(
        runtime.eventCount(
          "today:service-worker-update-error"
        ),
        1
      );
    }
  );

  await test(
    "postMessage hatası bildirimi yeniden kullanılabilir bırakıyor",
    async () => {
      const waiting =
        new MockWorker(
          "installed",
          {
            postMessageThrows: true
          }
        );
      const runtime =
        createRuntime({
          registration:
            new MockRegistration({
              waiting
            })
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      const result =
        api.activateUpdate();

      assert.equal(
        result.success,
        false
      );
      assert.equal(
        result.errorCode,
        "TODAY-SW-UPDATE-009"
      );
      assert.equal(
        api.getState().phase,
        "update-ready"
      );
      assert.equal(
        runtime.document
          .getElementById(
            "todayUpdateApply"
          ).disabled,
        false
      );
    }
  );

  await test(
    "Kayıt öncesi güncelleme kontrolü kalıcı yazma yapmadan reddediliyor",
    async () => {
      const runtime =
        createRuntime();
      const result =
        await runtime.window
          .TodayServiceWorker
          .checkForUpdate();

      assert.equal(
        result.success,
        false
      );
      assert.equal(
        result.errorCode,
        "TODAY-SW-UPDATE-005"
      );
      assert.equal(
        runtime.registerCount,
        0
      );
    }
  );

  await test(
    "Manuel güncelleme kontrolü registration.update kullanıyor ve bekleyen worker'ı buluyor",
    async () => {
      const registration =
        new MockRegistration();
      const runtime =
        createRuntime({
          registration
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      registration.waiting =
        new MockWorker(
          "installed"
        );
      const result =
        await api.checkForUpdate();

      assert.equal(
        result.success,
        true
      );
      assert.equal(
        registration.updateCount,
        1
      );
      assert.equal(
        result.updateAvailable,
        true
      );
    }
  );

  await test(
    "Güncelleme kontrolü hatası mevcut sürümü kullanılabilir bırakıyor",
    async () => {
      const registration =
        new MockRegistration({
          updateRejects: true
        });
      const runtime =
        createRuntime({
          registration
        });
      const api =
        runtime.window
          .TodayServiceWorker;

      await api.start();
      const result =
        await api.checkForUpdate();

      assert.equal(
        result.success,
        false
      );
      assert.equal(
        result.phase,
        "registered"
      );
      assert.equal(
        result.errorCode,
        "TODAY-SW-UPDATE-006"
      );
      assert.equal(
        runtime.eventCount(
          "today:service-worker-update-error"
        ),
        1
      );
    }
  );

  await test(
    "Güncelleme yöneticisi kalıcı kullanıcı verisi veya Today state anahtarı kullanmıyor",
    () => {
      [
        "localStorage",
        "sessionStorage",
        "today_app_v10",
        "today_store_v2",
        "today_store_v2_backup"
      ].forEach(text => {
        assert.equal(
          source.includes(text),
          false,
          text
        );
      });
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
    `Service Worker Update Manager: ${
      results.length - failed.length
    }/${results.length} başarılı`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
})();
