/**
 * Today App
 * Service Worker
 *
 * Amaç:
 * - Uygulama kabuğunu çevrimdışı kullanıma hazırlamak
 * - Yeni sürümlerde eski cache dosyalarını temizlemek
 * - Yeni sürümü yalnız kullanıcı onayı mesajından sonra etkinleştirmek
 * - Sayfalarda network-first kullanarak güncellemeleri almak
 * - Statik dosyalarda cache-first kullanmak
 */

"use strict";

/*
 * ÖNEMLİ:
 * Uygulama kabuğunda (özellikle index.html) değişiklik yapıldığında
 * bu sürüm mutlaka artırılmalıdır.
 */
const VERSION = "today-v2-foundation-038";
const CACHE_NAME = `today-cache-${VERSION}`;
const ACTIVATE_MESSAGE =
  "TODAY_ACTIVATE_UPDATE";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",

  "./modules/error-manager.js",
  "./modules/service-worker-manager.js",
  "./modules/storage.js",
  "./modules/version.js",
  "./modules/migration.js",
  "./modules/day-manager.js",
  "./modules/state-manager.js",
  "./modules/adapter-interfaces.js",
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
  "./modules/nutrition-consumption-editor.js",
  "./modules/nutrition-library-ui.js",
  "./modules/health-hub.js",
  "./modules/router.js",
  "./modules/module-registry.js",
  "./modules/startup-manager.js",

  "./today-icon-v9-192.png",
  "./today-icon-v9-512.png",
  "./apple-touch-icon-v9.png"
];

/**
 * Uygulama kabuğunu HTTP önbelleğini atlayarak güncel haliyle yükler.
 * Böylece yeni Service Worker kurulurken eski index.html tekrar
 * cache'e alınmaz.
 */
async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(
    APP_SHELL.map(async (url) => {
      const request = new Request(url, { cache: "reload" });
      const response = await fetch(request);

      if (!response || !response.ok) {
        throw new Error(`App Shell alınamadı: ${url}`);
      }

      await cache.put(url, response);
    })
  );
}

/**
 * Uygulama dosyalarını önbelleğe alır.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
});

/**
 * Bekleyen yeni sürümü yalnız uygulamadaki açık kullanıcı
 * onayı sonrasında etkinleştirir.
 */
self.addEventListener("message", (event) => {
  if (
    !event.data ||
    event.data.type !== ACTIVATE_MESSAGE
  ) {
    return;
  }

  event.waitUntil(
    Promise.resolve(
      self.skipWaiting()
    )
  );
});

/**
 * Eski Today cache alanlarını temizler.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith("today-cache-") &&
                cacheName !== CACHE_NAME
            )
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * HTML sayfalarında önce ağı dener.
 * Başarılı yanıtı hem gerçek istek anahtarıyla hem de
 * standart index.html anahtarıyla saklar.
 * İnternet yoksa güncel önbelleğe düşer.
 */
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);

      await Promise.all([
        cache.put(request, response.clone()),
        cache.put("./index.html", response.clone())
      ]);
    }

    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);

    return (
      (await cache.match(request)) ||
      (await cache.match("./index.html")) ||
      (await cache.match("./"))
    );
  }
}

/**
 * Statik dosyalarda önce güncel Today cache'i kullanır.
 * Cache yoksa dosyayı ağdan alır ve saklar.
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (
    networkResponse &&
    networkResponse.ok &&
    networkResponse.type === "basic"
  ) {
    await cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigation =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  event.respondWith(
    isNavigation
      ? handleNavigationRequest(request)
      : handleStaticRequest(request)
  );
});
