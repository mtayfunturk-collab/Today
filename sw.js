const VERSION = "today-v10-app-002";
const CACHE = `cache-${VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./sw.js",
  "./today-icon-v9-192.png",
  "./today-icon-v9-512.png",
  "./apple-touch-icon-v9.png"
];

// Install: cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - index.html: network-first (güncellemeler gelsin)
// - others: cache-first
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // sadece aynı origin
  if (url.origin !== location.origin) return;

  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
      return res;
    }))
  );
});