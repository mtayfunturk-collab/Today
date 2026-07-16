/**
 * Today App
 * Service Worker
 *
 * Amaç:
 * - Uygulama kabuğunu çevrimdışı kullanıma hazırlamak
 * - Yeni sürümlerde eski cache dosyalarını temizlemek
 * - Sayfalarda network-first kullanarak güncellemeleri almak
 * - Statik dosyalarda cache-first kullanmak
 */

"use strict";

const VERSION = "today-v2-foundation-002";
const CACHE_NAME = `today-cache-${VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",

  "./modules/storage.js",
  "./modules/version.js",
  "./modules/day-manager.js",
  "./modules/state-manager.js",

  "./today-icon-v9-192.png",
  "./today-icon-v9-512.png",
  "./apple-touch-icon-v9.png"
];

/**
 * Uygulama dosyalarını önbelleğe alır.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
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
 * İnternet yoksa önbellekteki index.html dosyasını açar.
 */
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put("./index.html", response.clone());
    }

    return response;
  } catch (error) {
    return (
      (await caches.match(request)) ||
      (await caches.match("./index.html"))
    );
  }
}

/**
 * Statik dosyalarda önce cache kullanılır.
 * Cache yoksa dosya ağdan alınır ve saklanır.
 */
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (
    networkResponse &&
    networkResponse.ok &&
    networkResponse.type === "basic"
  ) {
    const cache = await caches.open(CACHE_NAME);
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
    (request.headers.get("accept") || "").includes(
      "text/html"
    );

  event.respondWith(
    isNavigation
      ? handleNavigationRequest(request)
      : handleStaticRequest(request)
  );
});