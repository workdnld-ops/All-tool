const CACHE_NAME = "ops-toolbox-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/toolbox-icon.svg",
  "./apps/credit-card-slip-stats/index.html",
  "./apps/credit-card-slip-stats/manifest.json",
  "./apps/credit-card-slip-stats/sw.js",
  "./apps/purchase-accounting/dist/index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => undefined)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match("./index.html"));
    })
  );
});
