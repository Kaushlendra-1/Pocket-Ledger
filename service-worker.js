/*
  service-worker.js
  --------------------------------------------------------
  Makes the app load and work with NO internet connection.

  Strategy:
  - On install: pre-cache the "app shell" (the core files
    needed to draw the UI), including the Chart.js library.
  - On fetch: try the cache first. If it's not there, go to
    the network and store a copy in the cache for next time.
  - If totally offline and a page is requested that isn't
    cached, fall back to index.html (so the app still opens).

  IMPORTANT: bump CACHE_NAME (e.g. v1 -> v2) whenever you
  change any of these files, so users get the new version
  instead of an old cached one.
--------------------------------------------------------- */

const CACHE_NAME = "pocket-ledger-v5";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./db.js",
  "./manifest.json",
  "./Icons/icon-192.png",
  "./Icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/chart.js@4",
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap",
];

self.addEventListener("install", (event) => {
  // Activate this new service worker immediately, without
  // waiting for old tabs/versions to close.
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  // Remove caches from older versions of the service worker
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline and not in cache — for page navigations,
          // fall back to the cached app shell.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});