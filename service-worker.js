// /service-worker.js
// Caches the application files and serves them when the network is unavailable.
// This file exists so restaurant staff can keep using the PWA offline.
// RELEVANT FILES: index.html, js/app.js, js/floor.js
const CACHE_VERSION = 'v1.5.0'; // ⬅️ Versión actualizada por los cambios
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
  './fonts/inter-0.ttf',
  './fonts/inter-1.ttf',
  './fonts/inter-2.ttf',
  './fonts/symbols-0.ttf',
  './manifest.webmanifest',
  './icons/icon-192.png', // <-- AÑADIDO
  './icons/icon-512.png', // <-- AÑADIDO
  'https://cdn.tailwindcss.com',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k.startsWith('taqueria-admin-') && k !== CACHE_NAME) ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Network-first para navegación
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        // CORREGIDO: Usa la petición 'req' como clave, no solo './'
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(res => res || caches.match('./index.html'))) // Fallback a la página principal
    );
  } else { // Cache-first para otros assets
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
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
