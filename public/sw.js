const STATIC_CACHE = "hrms-static-v3";
const RUNTIME_CACHE = "hrms-runtime-v3";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = ["/offline", "/login", "/manifest.webmanifest", "/icon.png", "/apple-icon.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
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
