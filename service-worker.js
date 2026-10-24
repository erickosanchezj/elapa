// /service-worker.js
// Caches the application files and serves them when the network is unavailable.
// This file exists so restaurant staff can keep using the PWA offline.
// RELEVANT FILES: index.html, js/app.js, js/floor.js
const CACHE_VERSION = 'v1.5.1'; // ⬅️ Versión actualizada por los cambios
const CACHE_NAME = `taqueria-admin-${CACHE_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './precios.html', // <-- AÑADIDO
  './menu.html',
  './ticket.html',
  './js/app.js', // <-- AÑADIDO
  './js/floor.js',
  './js/menu.js',
  './js/precios.js',
  './js/ticket.js',
  './js/theme.js',
  './js/styles.css',
  './js/tokens.css',
  './js/base.css',
  './js/fonts.css',
  './js/legacy.css',
  './js/receipt.css',
  './js/ticket-layout.css',
  './js/ui.js',
  './js/pwa.js',
  './js/table-sheet.js',
  './js/ios.css',
  './fonts/inter-0.ttf',
  './fonts/inter-1.ttf',
  './fonts/inter-2.ttf',
  './fonts/symbols-0.ttf',
  './manifest.webmanifest',
  './icons/icon-192.png', // <-- AÑADIDO
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  // Leave an update waiting until all existing app windows close.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k.startsWith('taqueria-admin-') && k !== CACHE_NAME) ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

// Each worker serves its own complete shell, preventing mixed HTML/JS versions.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (cached) return cached;
    try {
      const response = await fetch(req);
      if (response.ok) await cache.put(req, response.clone());
      return response;
    } catch (error) {
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      throw error;
    }
  })());
});

// --- Version handshake ---
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'GET_VERSION') {
    const msg = { type: 'VERSION', version: CACHE_VERSION };
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(msg);
    } else if (event.source) {
      event.source.postMessage(msg);
    } else {
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
        .then(clients => clients.forEach(c => c.postMessage(msg)));
    }
  }
});
