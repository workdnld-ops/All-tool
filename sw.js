const CACHE_NAME = "ops-toolbox-v4";
const APP_SHELL = [
  "./index.html",
  "./manifest.json",
  "./assets/toolbox-icon.svg",
  "./apps/credit-card-slip-stats/index.html",
  "./apps/credit-card-slip-stats/manifest.json",
  "./apps/credit-card-slip-stats/sw.js",
  "./apps/purchase-accounting/dist/index.html",
  "./apps/drink-calculator/index.html",
  "./apps/drink-calculator/settings.html",
  "./apps/drink-calculator/drink-data.js"
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload", redirect: "follow" });
        if (response.ok && !response.redirected) {
          await cache.put(url, response);
        }
      } catch {
        // Best effort cache. Network failures should not block activation.
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
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

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { redirect: "follow" })
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached && !cached.redirected) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && !response.redirected) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
