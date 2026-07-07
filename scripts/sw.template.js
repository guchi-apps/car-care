// Generated from scripts/sw.template.js — do not edit public/sw.js directly.
// @version __APP_VERSION__
const CACHE_NAME = "car-care-v__APP_VERSION__";

const PRECACHE_URLS = ["/manifest.json"];

function isNextDataRequest(request) {
  return (
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Url")
  );
}

function isStaticAsset(url) {
  return (
    url.pathname === "/manifest.json" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(url.pathname)
  );
}

function shouldBypassCache(url, request) {
  return (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js" ||
    isNextDataRequest(request)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (shouldBypassCache(url, event.request)) {
    return;
  }

  const isDocument = event.request.mode === "navigate";

  if (isDocument) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // App Router のページデータ（RSC 等）はキャッシュしない。静的アセットのみ cache-first。
  if (!isStaticAsset(url)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (
          !response ||
          response.status !== 200 ||
          response.type !== "basic"
        ) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    }),
  );
});
