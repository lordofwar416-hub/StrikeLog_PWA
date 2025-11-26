// File: service-worker.js
// Version: StrikeLog PWA v1.0
// Timestamp: 2025-11-25 07:22 (UTC+2)
// -----------------------------------------

// StrikeLog Service Worker
// Handles offline caching, updates, and asset control.

const SL_CACHE_VERSION = 'sl-cache-v1-0-0';
const SL_CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',

  // CSS
  './css/style.css',

  // JS Modules
  './js/app.js',
  './js/ui.js',
  './js/storage.js',
  './js/geo.js',
  './js/lunar.js',
  './js/env.js',

  // Icons
  './icons/icon-192.png',
  './icons/icon-512.png',

  // Fallback
  './icons/icon-192.png'
];

// ----------------------------
// INSTALL
// ----------------------------
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SL_CACHE_VERSION).then(cache => {
      return cache.addAll(SL_CACHE_FILES);
    })
  );
  self.skipWaiting();
});

// ----------------------------
// ACTIVATE
// ----------------------------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== SL_CACHE_VERSION)
          .map(oldKey => caches.delete(oldKey))
      );
    })
  );
  self.clients.claim();
});

// ----------------------------
// FETCH HANDLER
// ----------------------------
self.addEventListener('fetch', event => {
  const req = event.request;

  // Non-GET requests bypass cache
  if (req.method !== 'GET') {
    return event.respondWith(fetch(req));
  }

  event.respondWith(
    caches.match(req).then(
      cacheRes =>
        cacheRes ||
        fetch(req)
          .then(networkRes => {
            return caches.open(SL_CACHE_VERSION).then(cache => {
              cache.put(req, networkRes.clone());
              return networkRes;
            });
          })
          .catch(() => caches.match('./icons/icon-192.png'))
    )
  );
});
