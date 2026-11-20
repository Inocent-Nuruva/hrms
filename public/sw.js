const STATIC_CACHE = "hrms-static-v3";
const RUNTIME_CACHE = "hrms-runtime-v3";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = ["/offline", "/login", "/manifest.webmanifest", "/icon.png", "/apple-icon.png", "/favicon.ico"];
const IS_DEV = new URL(self.location.href).searchParams.has("dev");

self.addEventListener("install", (event) => {
  if (IS_DEV) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (IS_DEV) return;
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // Never share user-specific responses between sessions on the same device.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/") ||
      url.pathname === "/uploads" || url.pathname.startsWith("/uploads/") ||
      url.pathname.startsWith("/socket.io") || request.headers.has("Authorization")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Only immutable build assets are safe to cache without session isolation.
  if (!url.pathname.startsWith("/_next/static/")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => Response.error());
    })
  );
});

function safeNotificationPath(value) {
  try {
    const url = new URL(value || "/dashboard", self.location.origin);
    if (url.origin !== self.location.origin) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      const decoded = event.data?.json();
      payload = decoded && typeof decoded === "object" ? decoded : {};
    } catch { /* Show a generic alert. */ }
    const notification = {
      id: Number(payload.id) || 0,
      title: typeof payload.title === "string" ? payload.title : "New HRMS notification",
      message: typeof payload.body === "string" ? payload.body : "Open HRMS to view your notification.",
      action_url: safeNotificationPath(payload.actionUrl),
    };
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const focused = windows.find((client) => client.focused && new URL(client.url).origin === self.location.origin);
    if (focused) {
      focused.postMessage({ type: "hrms:web-push", notification });
      return;
    }
    await self.registration.showNotification(notification.title, {
      body: notification.message,
      icon: "/icon.png",
      badge: "/favicon.ico",
      tag: notification.id ? `hrms-notification-${notification.id}` : undefined,
      data: { url: notification.action_url },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = safeNotificationPath(event.notification.data?.url);
    const url = new URL(path, self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      await existing.focus();
    } else {
      await self.clients.openWindow(url);
    }
  })());
});
