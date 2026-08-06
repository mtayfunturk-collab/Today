const fs = require("node:fs");
const vm = require("node:vm");

const SOURCE_PATH = "sw.js";
const ORIGIN = "https://today.test";
const ACTIVE_CACHE =
  "today-cache-today-v2-foundation-023";
const OLD_CACHE =
  "today-cache-today-v2-foundation-019";
const FOREIGN_CACHE = "unrelated-cache";

class MockRequest {
  constructor(input, init = {}) {
    const source =
      input instanceof MockRequest
        ? input
        : null;
    const rawUrl =
      typeof input === "string"
        ? input
        : input.url;

    this.url = new URL(rawUrl, `${ORIGIN}/`).href;
    this.method = (
      init.method ||
      source?.method ||
      "GET"
    ).toUpperCase();
    this.mode =
      init.mode ||
      source?.mode ||
      "same-origin";
    this.cache =
      init.cache ||
      source?.cache ||
      "default";
    this.headers = new Headers(
      init.headers ||
      source?.headers ||
      {}
    );
  }
}

class MockResponse {
  constructor(body = "", init = {}) {
    this.body = String(body);
    this.status = init.status ?? 200;
    this.ok =
      this.status >= 200 &&
      this.status < 300;
    this.type = init.type || "basic";
    this.headers = new Headers(init.headers || {});
  }

  clone() {
    return new MockResponse(this.body, {
      status: this.status,
      type: this.type,
      headers: this.headers
    });
  }

  async text() {
    return this.body;
  }
}

class MockCache {
  constructor() {
    this.entries = new Map();
  }

  normalize(input) {
    const rawUrl =
      typeof input === "string"
        ? input
        : input.url;

    return new URL(rawUrl, `${ORIGIN}/`).href;
  }

  async put(input, response) {
    this.entries.set(
      this.normalize(input),
      response.clone()
    );
  }

  async match(input) {
    const response = this.entries.get(
      this.normalize(input)
    );

    return response
      ? response.clone()
      : undefined;
  }

  async keys() {
    return Array.from(
      this.entries.keys(),
      url => new MockRequest(url)
    );
  }
}

class MockCacheStorage {
  constructor() {
    this.stores = new Map();
    this.globalMatchCalls = 0;
  }

  async open(name) {
    if (!this.stores.has(name)) {
      this.stores.set(name, new MockCache());
    }

    return this.stores.get(name);
  }

  async keys() {
    return Array.from(this.stores.keys());
  }

  async delete(name) {
    return this.stores.delete(name);
  }

  async match() {
    this.globalMatchCalls += 1;
    throw new Error(
      "Global caches.match kullanılmamalı."
    );
  }
}

function createRuntime(source, options = {}) {
  const handlers = {
    install: [],
    activate: [],
    message: [],
    fetch: []
  };
  const caches = new MockCacheStorage();
  const fetchCalls = [];
  const networkOverrides = new Map();
  let online = options.online !== false;
  let skipWaitingCalls = 0;
  let claimCalls = 0;

  const self = {
    location: {
      origin: ORIGIN
    },
    clients: {
      async claim() {
        claimCalls += 1;
      }
    },
    addEventListener(type, handler) {
      if (!handlers[type]) {
        handlers[type] = [];
      }

      handlers[type].push(handler);
    },
    async skipWaiting() {
      skipWaitingCalls += 1;
    }
  };

  async function fetchMock(input) {
    const request =
      input instanceof MockRequest
        ? input
        : new MockRequest(input);

    fetchCalls.push({
      url: request.url,
      cache: request.cache,
      method: request.method
    });

    if (!online) {
      throw new TypeError("Network unavailable");
    }

    if (networkOverrides.has(request.url)) {
      const override =
        networkOverrides.get(request.url);

      if (override instanceof Error) {
        throw override;
      }

      return override.clone();
    }

    return new MockResponse(
      `NETWORK:${new URL(request.url).pathname}${new URL(request.url).search}`,
      {
        status: 200,
        type: "basic",
        headers: {
          "content-type": "text/plain"
        }
      }
    );
  }

  const context = {
    self,
    caches,
    fetch: fetchMock,
    Request: MockRequest,
    Response: MockResponse,
    Headers,
    URL,
    Promise,
    Error,
    TypeError,
    console
  };

  vm.runInNewContext(source, context, {
    filename: SOURCE_PATH
  });

  async function triggerLifecycle(type) {
    let pending;
    const event = {
      waitUntil(value) {
        pending = Promise.resolve(value);
      }
    };

    handlers[type][0](event);

    if (!pending) {
      throw new Error(
        `${type} olayı waitUntil çağırmadı.`
      );
    }

    await pending;
  }

  async function triggerFetch(request) {
    let responsePromise;
    const event = {
      request,
      respondWith(value) {
        responsePromise = Promise.resolve(value);
      }
    };

    handlers.fetch[0](event);

    if (!responsePromise) {
      return {
        intercepted: false,
        response: undefined
      };
    }

    return {
      intercepted: true,
      response: await responsePromise
    };
  }

  async function triggerMessage(data) {
    let pending;
    const event = {
      data,
      waitUntil(value) {
        pending = Promise.resolve(value);
      }
    };

    handlers.message[0](event);

    if (pending) {
      await pending;
    }

    return {
      handled: Boolean(pending)
    };
  }

  return {
    handlers,
    caches,
    fetchCalls,
    networkOverrides,
    triggerLifecycle,
    triggerMessage,
    triggerFetch,
    setOnline(value) {
      online = value;
    },
    get skipWaitingCalls() {
      return skipWaitingCalls;
    },
    get claimCalls() {
      return claimCalls;
    }
  };
}

const results = [];

async function test(name, fn) {
  try {
    const detail = await fn();
    results.push({
      name,
      ok: true,
      detail: detail || ""
    });
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail:
        error && error.message
          ? error.message
          : String(error)
    });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const source = fs.readFileSync(
    SOURCE_PATH,
    "utf8"
  );

  await test(
    "JavaScript sözdizimi geçerli",
    async () => {
      new vm.Script(source);
    }
  );

  await test(
    "Cache sürümü foundation-023",
    async () => {
      assert(
        source.includes(
          'const VERSION = "today-v2-foundation-023"'
        ),
        "foundation-023 sürüm etiketi yok."
      );
    }
  );

  await test(
    "Kurulum istekleri cache reload kullanıyor",
    async () => {
      assert(
        source.includes(
          'new Request(url, { cache: "reload" })'
        ),
        'cache: "reload" bulunamadı.'
      );
    }
  );

  await test(
    "Global caches.match kullanılmıyor",
    async () => {
      assert(
        !source.includes("caches.match("),
        "Eski cache alanlarını tarayan global eşleşme bulundu."
      );
    }
  );

  await test(
    "Navigasyon index anahtarına da yazılıyor",
    async () => {
      assert(
        source.includes(
          'cache.put("./index.html", response.clone())'
        ),
        "Standart index.html cache yazımı yok."
      );
    }
  );

  const runtime = createRuntime(source);
  const oldCache =
    await runtime.caches.open(OLD_CACHE);
  await oldCache.put(
    "./old-only.txt",
    new MockResponse("OLD")
  );
  const foreignCache =
    await runtime.caches.open(FOREIGN_CACHE);
  await foreignCache.put(
    "./foreign-only.txt",
    new MockResponse("FOREIGN")
  );

  await test(
    "Install, message, activate ve fetch olayları kayıtlı",
    async () => {
      assert(
        runtime.handlers.install.length === 1 &&
          runtime.handlers.message.length === 1 &&
          runtime.handlers.activate.length === 1 &&
          runtime.handlers.fetch.length === 1,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(runtime.handlers).map(
              ([key, value]) => [
                key,
                value.length
              ]
            )
          )
        )
      );
    }
  );

  await test(
    "Install olayı tamamlanıyor",
    async () => {
      await runtime.triggerLifecycle("install");
    }
  );

  await test(
    "Install 28 uygulama kabuğu isteği yapıyor",
    async () => {
      assert(
        runtime.fetchCalls.length === 28,
        `${runtime.fetchCalls.length} istek yapıldı.`
      );
    }
  );

  await test(
    "Install isteklerinin tamamı reload modunda",
    async () => {
      assert(
        runtime.fetchCalls.every(
          call => call.cache === "reload"
        ),
        JSON.stringify(runtime.fetchCalls)
      );
    }
  );

  await test(
    "Install 28 dosyayı aktif cache'e yazıyor",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const keys = await cache.keys();
      assert(
        keys.length === 28,
        `${keys.length} cache girdisi var.`
      );
    }
  );

  await test(
    "AI, Connect ve beslenmenin servis ile görünür UI katmanları çevrimdışı kabuğa dahil",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const response =
        await cache.match(
          "./modules/adapter-interfaces.js"
        );

      assert(
        response &&
          (await response.text()) ===
            "NETWORK:/modules/adapter-interfaces.js",
        "AI ve Connect adaptör arayüzleri aktif cache içinde bulunamadı."
      );

      for (const path of [
        "./modules/nutrition-contracts.js",
        "./modules/nutrition-calculations.js",
        "./modules/nutrition-storage.js",
        "./modules/nutrition-migrations.js",
        "./modules/nutrition-profile.js",
        "./modules/nutrition-library.js",
        "./modules/nutrition-entry.js",
        "./modules/nutrition-planning.js",
        "./modules/nutrition-history.js",
        "./modules/nutrition-ui.js",
        "./modules/nutrition-library-ui.js"
      ]) {
        const nutritionResponse =
          await cache.match(path);

        assert(
          nutritionResponse &&
            (await nutritionResponse.text()) ===
              `NETWORK:${
                new URL(path, `${ORIGIN}/`)
                  .pathname
              }`,
          `${path} aktif cache içinde bulunamadı.`
        );
      }
    }
  );

  await test(
    "Central Error Manager çevrimdışı kabuğa dahil",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const response =
        await cache.match(
          "./modules/error-manager.js"
        );

      assert(
        response &&
          (await response.text()) ===
            "NETWORK:/modules/error-manager.js",
        "Central Error Manager aktif cache içinde bulunamadı."
      );
    }
  );

  await test(
    "Service Worker Update Manager çevrimdışı kabuğa dahil",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const response =
        await cache.match(
          "./modules/service-worker-manager.js"
        );

      assert(
        response &&
          (await response.text()) ===
            "NETWORK:/modules/service-worker-manager.js",
        "Service Worker Update Manager aktif cache içinde bulunamadı."
      );
    }
  );

  await test(
    "Schema & Migration Orchestrator çevrimdışı kabuğa dahil",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const response =
        await cache.match(
          "./modules/migration.js"
        );

      assert(
        response &&
          (await response.text()) ===
            "NETWORK:/modules/migration.js",
        "Migration Orchestrator aktif cache içinde bulunamadı."
      );
    }
  );

  await test(
    "Today Router çevrimdışı kabuğa dahil",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const response =
        await cache.match(
          "./modules/router.js"
        );

      assert(
        response &&
          (await response.text()) ===
            "NETWORK:/modules/router.js",
        "Today Router aktif cache içinde bulunamadı."
      );
    }
  );

  await test(
    "Today Modules çevrimdışı kabuğa dahil",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const response =
        await cache.match(
          "./modules/module-registry.js"
        );

      assert(
        response &&
          (await response.text()) ===
            "NETWORK:/modules/module-registry.js",
        "Today Modules aktif cache içinde bulunamadı."
      );
    }
  );

  await test(
    "Startup Manager çevrimdışı kabuğa dahil",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const response =
        await cache.match(
          "./modules/startup-manager.js"
        );

      assert(
        response &&
          (await response.text()) ===
            "NETWORK:/modules/startup-manager.js",
        "Startup Manager aktif cache içinde bulunamadı."
      );
    }
  );

  await test(
    "Install sonrası skipWaiting kendiliğinden çağrılmıyor",
    async () => {
      assert(
        runtime.skipWaitingCalls === 0,
        `${runtime.skipWaitingCalls} kez çağrıldı.`
      );
    }
  );

  await test(
    "Bilinmeyen mesaj bekleyen worker'ı etkinleştirmiyor",
    async () => {
      const result =
        await runtime.triggerMessage({
          type: "UNKNOWN_MESSAGE"
        });

      assert(
        result.handled === false,
        "Bilinmeyen mesaj waitUntil ile işlendi."
      );
      assert(
        runtime.skipWaitingCalls === 0,
        `${runtime.skipWaitingCalls} kez çağrıldı.`
      );
    }
  );

  await test(
    "Açık onay mesajı skipWaiting'i yalnızca bir kez çağırıyor",
    async () => {
      const result =
        await runtime.triggerMessage({
          type:
            "TODAY_ACTIVATE_UPDATE"
        });

      assert(
        result.handled === true,
        "Etkinleştirme mesajı waitUntil ile işlenmedi."
      );
      assert(
        runtime.skipWaitingCalls === 1,
        `${runtime.skipWaitingCalls} kez çağrıldı.`
      );
    }
  );

  await test(
    "Activate olayı tamamlanıyor",
    async () => {
      await runtime.triggerLifecycle("activate");
    }
  );

  await test(
    "Eski Today cache'i siliniyor",
    async () => {
      const names = await runtime.caches.keys();
      assert(
        !names.includes(OLD_CACHE),
        names.join(", ")
      );
    }
  );

  await test(
    "Today dışındaki cache korunuyor",
    async () => {
      const names = await runtime.caches.keys();
      assert(
        names.includes(FOREIGN_CACHE),
        names.join(", ")
      );
    }
  );

  await test(
    "Activate sonrası clients.claim çağrılıyor",
    async () => {
      assert(
        runtime.claimCalls === 1,
        `${runtime.claimCalls} kez çağrıldı.`
      );
    }
  );

  const navigationRequest = new MockRequest(
    `${ORIGIN}/index.html?nav=1`,
    {
      mode: "navigate",
      headers: {
        accept: "text/html"
      }
    }
  );

  await test(
    "Çevrimiçi navigasyon network-first çalışıyor",
    async () => {
      const result =
        await runtime.triggerFetch(
          navigationRequest
        );
      const text = await result.response.text();

      assert(
        result.intercepted &&
          text === "NETWORK:/index.html?nav=1",
        text
      );
    }
  );

  await test(
    "Navigasyon gerçek istek anahtarıyla cache'e yazılıyor",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const response =
        await cache.match(navigationRequest);

      assert(
        response &&
          (await response.text()) ===
            "NETWORK:/index.html?nav=1",
        "Sorgulu navigasyon anahtarı yok."
      );
    }
  );

  await test(
    "Navigasyon standart index anahtarıyla cache'e yazılıyor",
    async () => {
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const response =
        await cache.match("./index.html");

      assert(
        response &&
          (await response.text()) ===
            "NETWORK:/index.html?nav=1",
        "index.html anahtarına güncel yanıt yazılmadı."
      );
    }
  );

  runtime.setOnline(false);

  await test(
    "Çevrimdışı aynı navigasyon cache'den açılıyor",
    async () => {
      const result =
        await runtime.triggerFetch(
          navigationRequest
        );
      const text = await result.response.text();

      assert(
        text === "NETWORK:/index.html?nav=1",
        text
      );
    }
  );

  await test(
    "Çevrimdışı bilinmeyen navigasyon index'e düşüyor",
    async () => {
      const request = new MockRequest(
        `${ORIGIN}/unknown-route`,
        {
          mode: "navigate",
          headers: {
            accept: "text/html"
          }
        }
      );
      const result =
        await runtime.triggerFetch(request);
      const text = await result.response.text();

      assert(
        text === "NETWORK:/index.html?nav=1",
        text
      );
    }
  );

  await test(
    "Çevrimdışı statik kabuk dosyası aktif cache'den geliyor",
    async () => {
      const request = new MockRequest(
        `${ORIGIN}/modules/storage.js`
      );
      const result =
        await runtime.triggerFetch(request);
      const text = await result.response.text();

      assert(
        text === "NETWORK:/modules/storage.js",
        text
      );
    }
  );

  await test(
    "Statik istek başka cache alanından okunmuyor",
    async () => {
      const request = new MockRequest(
        `${ORIGIN}/foreign-only.txt`
      );
      let rejected = false;

      try {
        await runtime.triggerFetch(request);
      } catch (error) {
        rejected = true;
      }

      assert(
        rejected,
        "İstek bağımsız cache alanından çözülmüş olabilir."
      );
      assert(
        runtime.caches.globalMatchCalls === 0,
        "Global caches.match çağrıldı."
      );
    }
  );

  runtime.setOnline(true);

  await test(
    "Yeni statik dosya ağdan alınıp aktif cache'e yazılıyor",
    async () => {
      const request = new MockRequest(
        `${ORIGIN}/new-static.js`
      );
      const result =
        await runtime.triggerFetch(request);
      const text = await result.response.text();
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const cached = await cache.match(request);

      assert(
        text === "NETWORK:/new-static.js",
        text
      );
      assert(
        cached &&
          (await cached.text()) ===
            "NETWORK:/new-static.js",
        "Yeni statik yanıt aktif cache'e yazılmadı."
      );
    }
  );

  await test(
    "Basic olmayan statik yanıt cache'e yazılmıyor",
    async () => {
      const request = new MockRequest(
        `${ORIGIN}/opaque-static.js`
      );
      runtime.networkOverrides.set(
        request.url,
        new MockResponse("OPAQUE", {
          status: 200,
          type: "cors"
        })
      );

      const result =
        await runtime.triggerFetch(request);
      const cache =
        await runtime.caches.open(ACTIVE_CACHE);
      const cached = await cache.match(request);

      assert(
        (await result.response.text()) === "OPAQUE",
        "Ağ yanıtı dönmedi."
      );
      assert(
        !cached,
        "Basic olmayan yanıt cache'e yazıldı."
      );
    }
  );

  await test(
    "GET dışı istekler ele geçirilmiyor",
    async () => {
      const result =
        await runtime.triggerFetch(
          new MockRequest(
            `${ORIGIN}/submit`,
            { method: "POST" }
          )
        );

      assert(
        result.intercepted === false,
        "POST isteğine respondWith çağrıldı."
      );
    }
  );

  await test(
    "Farklı origin istekleri ele geçirilmiyor",
    async () => {
      const result =
        await runtime.triggerFetch(
          new MockRequest(
            "https://example.com/asset.js"
          )
        );

      assert(
        result.intercepted === false,
        "Cross-origin isteğe respondWith çağrıldı."
      );
    }
  );

  await test(
    "Eksik uygulama kabuğu dosyasında install başarısız oluyor",
    async () => {
      const failingRuntime =
        createRuntime(source);
      failingRuntime.networkOverrides.set(
        `${ORIGIN}/manifest.json`,
        new MockResponse("NOT FOUND", {
          status: 404
        })
      );

      let rejected = false;

      try {
        await failingRuntime.triggerLifecycle(
          "install"
        );
      } catch (error) {
        rejected = true;
      }

      assert(
        rejected,
        "Eksik kabuk dosyasına rağmen install tamamlandı."
      );
      assert(
        failingRuntime.skipWaitingCalls === 0,
        "Başarısız install sonrası skipWaiting çağrıldı."
      );
    }
  );

  const passed =
    results.filter(result => result.ok).length;
  const failed = results.length - passed;

  results.forEach((result, index) => {
    const marker =
      result.ok ? "PASS" : "FAIL";
    const detail =
      result.detail
        ? ` — ${result.detail}`
        : "";

    process.stdout.write(
      `${String(index + 1).padStart(2, "0")}. ${marker} ${result.name}${detail}\n`
    );
  });

  process.stdout.write(
    `RESULT ${passed}/${results.length} passed; ${failed} failed\n`
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
})();
