'use strict';

// Bump the version whenever any app file changes — the old cache will be deleted
// An open app reloads itself once the new version is installed (see js/update.js)
const CACHE = 'calc-v92';
// Bump when the files in vendor/tesseract change
const OCR_CACHE = 'plate-ocr-v1';

const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'js/app.js',
  'js/calc.js',
  'js/days.js',
  'js/dishes.js',
  'js/db.js',
  'js/dom.js',
  'js/i18n.js',
  'js/i18n/en.js',
  'js/i18n/icon-rules.ru.js',
  'js/i18n/label-words.js',
  'js/i18n/ru.js',
  'js/i18n/search.ru.js',
  'js/icons.js',
  'js/itemrow.js',
  'js/label.js',
  'js/nav.js',
  'js/scrolllock.js',
  'js/reorder.js',
  'js/search.js',
  'js/searchbar.js',
  'js/usage.js',
  'js/ocr.js',
  'js/picker.js',
  'js/products.js',
  'js/seed.js',
  'js/share.js',
  'js/ui.js',
  'js/update.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/logo.svg',
];

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
