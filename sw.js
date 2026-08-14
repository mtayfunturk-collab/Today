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
const VERSION = "today-v2-foundation-065";
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
  "./vendor/moment/moment.min.js",
  "./vendor/moment-timezone/moment-timezone-with-data.min.js",
  "./vendor/astronomy-engine/astronomy.browser.min.js",
  "./modules/sky-birth-profile.js",
  "./modules/sky-place-catalog.js",
  "./modules/sky-house-core.js",
  "./modules/sky-calculation-core.js",
  "./modules/sky-observation-context.js",
  "./modules/sky-moment-core.js",
  "./modules/core-sky-link.js",
  "./modules/sky-periods-core.js",
  "./modules/sky-natal-ui.js",
  "./modules/sky-today-ui.js",
  "./modules/sky-periods-ui.js",
  "./modules/core-sky-link-ui.js",
  "./modules/sky-hub.js",
  "./modules/ai-context-source-adapters.js",
  "./modules/ai-context-bridge.mjs",
  "./modules/ai-analysis-bridge.mjs",
  "./modules/ai-approval-bridge.mjs",
  "./modules/ai-pattern-bridge.mjs",
  "./modules/ai-context-ui.mjs",
  "./Today-AI-Engine/src/context-builder.mjs",
  "./Today-AI-Engine/src/data-usage-consent.mjs",
  "./Today-AI-Engine/src/daily-support-analyzer.mjs",
  "./Today-AI-Engine/src/approval-decision-processor.mjs",
  "./Today-AI-Engine/src/decision-receipt-builder.mjs",
  "./Today-AI-Engine/src/pattern-observer.mjs",
  "./data/sky-cities-15000.json",

  "./assets/sport/bench-press.jpg",
  "./assets/sport/incline-dumbbell-press.jpg",
  "./assets/sport/decline-bench-press.jpg",
  "./assets/sport/cable-fly.jpg",
  "./assets/sport/push-up.jpg",
  "./assets/sport/chest-press.jpg",
  "./assets/sport/lat-pulldown.jpg",
  "./assets/sport/barbell-row.jpg",
  "./assets/sport/cable-row.jpg",
  "./assets/sport/t-bar-row.jpg",
  "./assets/sport/straight-arm-pulldown.jpg",
  "./assets/sport/pull-up.jpg",
  "./assets/sport/shoulder-press.jpg",
  "./assets/sport/lateral-raise.jpg",
  "./assets/sport/front-raise.jpg",
  "./assets/sport/rear-delt-fly.jpg",
  "./assets/sport/arnold-press.jpg",
  "./assets/sport/upright-row.jpg",
  "./assets/sport/biceps-curl.jpg",
  "./assets/sport/hammer-curl.jpg",
  "./assets/sport/triceps-pushdown.jpg",
  "./assets/sport/skull-crusher.jpg",
  "./assets/sport/concentration-curl.jpg",
  "./assets/sport/cable-curl.jpg",
  "./assets/sport/bodyweight-squat.jpg",
  "./assets/sport/leg-press.jpg",
  "./assets/sport/deadlift.jpg",
  "./assets/sport/leg-extension.jpg",
  "./assets/sport/leg-curl.jpg",
  "./assets/sport/calf-raise.jpg",
  "./assets/sport/plank.jpg",
  "./assets/sport/crunch.jpg",
  "./assets/sport/russian-twist.jpg",
  "./assets/sport/bicycle-crunch.jpg",
  "./assets/sport/dead-bug.jpg",
  "./assets/sport/mountain-climber.jpg",
  "./assets/sport/treadmill-run.jpg",
  "./assets/sport/cycling.jpg",
  "./assets/sport/elliptical.jpg",
  "./assets/sport/rowing-machine.jpg",
  "./assets/sport/jump-rope.jpg",
  "./assets/sport/brisk-walk.jpg",
  "./assets/sport/burpee.jpg",
  "./assets/sport/kettlebell-swing.jpg",
  "./assets/sport/battle-rope.jpg",
  "./assets/sport/medicine-ball-slam.jpg",
  "./assets/sport/farmer-walk.jpg",
  "./assets/sport/box-jump.jpg",
  "./assets/sport/cat-cow.jpg",
  "./assets/sport/hip-mobility.jpg",
  "./assets/sport/shoulder-mobility.jpg",
  "./assets/sport/full-stretch.jpg",
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
