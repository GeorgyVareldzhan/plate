'use strict';

// Filled in by the build (vite.config.js): a hash of the app files and their list.
// Any change to the app changes the version — the old cache is deleted and an open app
// reloads itself once the new version is installed (see js/update.js)
const CACHE = `plate-${'__VERSION__'}`;
// Bump when the files in vendor/tesseract change
const OCR_CACHE = 'plate-ocr-v1';

const ASSETS = [/* __ASSETS__ */];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' — fetch files from the server, not the browser HTTP cache, otherwise stale ones may get cached
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OCR_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: the app works fully offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Firebase and other services: straight to the network (the SDK handles offline itself)
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Text recognition files: large and rarely needed — cached on first use, kept across versions
  if (new URL(event.request.url).pathname.includes('/vendor/tesseract/')) {
    event.respondWith(caches.open(OCR_CACHE).then((cache) => cache.match(event.request).then((hit) => hit
      || fetch(event.request).then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }))));
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
