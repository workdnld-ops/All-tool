const CACHE_NAME = "ops-toolbox-v6";
const APP_SHELL = [
  "./manifest.json",
  "./assets/toolbox-icon.svg"
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

  if (requestUrl.pathname.startsWith("/apps/drink-calculator/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    return;
  }

  if (event.request.destination === "document") return;

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
