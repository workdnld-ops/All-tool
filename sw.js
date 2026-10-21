const CACHE_NAME = "ops-toolbox-v22";
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

async function retireTodoPush() {
  try {
    // Only retire this toolbox registration's old todo subscription, not other PWAs.
    const subscription = await self.registration.pushManager?.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch {
    // Subscription cleanup must not prevent the toolbox from updating.
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("ops-toolbox-") && key !== CACHE_NAME).map((key) => caches.delete(key)))
    ),
    retireTodoPush(),
    self.clients.claim(),
  ]));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.startsWith("/apps/drink-calculator/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/cleaning-schedule/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/celebration-calculator/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/day-off-record/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/schedule-record/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/todo-board/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/cash-change-planner/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/store-cost-sharing/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/acceptance-form/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/leave-lottery/")) {
    return;
  }

  if (requestUrl.pathname.startsWith("/apps/work-assignment/")) {
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
