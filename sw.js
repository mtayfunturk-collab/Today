/* sw.js - TODAY PWA
   Goal: keep it simple, update-friendly, and avoid "stuck icon/manifest" issues.
*/

const CACHE_VERSION = "today-v9"; // BUNU her büyük değişiklikte +1 yap (v8, v9...)
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192-v2.png",
  "./icon-512-v2.png",
  "./apple-touch-icon.png",
  "./sw.js"
];

// Install: cache core assets
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate: delete old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => (key === CACHE_VERSION ? null : caches.delete(key)))
      );
      await self.clients.claim();
    })()
  );
});

// Allow page to tell SW to update immediately
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch strategy:
// - For HTML: network-first (always try to get latest)
// - For others: cache-first (fast), fallback to network
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Same-origin only
  if (url.origin !== self.location.origin) return;

  // HTML (including navigation)
  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        }
      })()
    );
    return;
  }

  // Other assets
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return cached;
      }
    })()
  );
});
