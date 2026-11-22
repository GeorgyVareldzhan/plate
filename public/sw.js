'use strict';

// При изменении любого файла приложения увеличьте версию — старый кэш удалится
// Открытое приложение само перезагрузится, когда новая версия установится (см. js/update.js)
const CACHE = 'calc-v48';

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
  'js/icons.js',
  'js/itemrow.js',
  'js/nav.js',
  'js/picker.js',
  'js/products.js',
  'js/seed.js',
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
      // cache: 'reload' — брать файлы с сервера, а не из HTTP-кэша браузера, иначе можно закэшировать старые
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: приложение работает полностью без сети
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

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
