const CACHE_NAME = "ops-toolbox-v13";
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

self.addEventListener("push", (event) => {
  const fallback = {
    title: "待辦事項提醒",
    body: "有一張待辦卡片需要處理。",
    url: "/apps/todo-board/index.html",
    badgeCount: 1,
  };
  const data = event.data ? { ...fallback, ...event.data.json() } : fallback;
  event.waitUntil((async () => {
    if ("setAppBadge" in self.navigator && Number(data.badgeCount) > 0) {
      await self.navigator.setAppBadge(Number(data.badgeCount));
    }
    await self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url || fallback.url },
      badge: "/assets/toolbox-icon.svg",
      icon: "/assets/toolbox-icon.svg",
      tag: data.url || "todo-board",
      renotify: true,
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/apps/todo-board/index.html", self.location.origin).href;
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = allClients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.navigate(targetUrl);
      return existing.focus();
    }
    return clients.openWindow(targetUrl);
  })());
});
