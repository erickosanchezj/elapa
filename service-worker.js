// --- service-worker.js ---
const CACHE_VERSION = 'v1.1.3'; // ⬅️ bump this when you ship changes
const CACHE_NAME = `taqueria-admin-${CACHE_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => (k.startsWith('taqueria-admin-') && k !== CACHE_NAME) ? caches.delete(k) : null)
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Network-first for navigation, cache-first for others
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./'))
    );
  } else {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});

// —— Version handshake ——
// Replies to page asking for version. Works with MessageChannel (port) and fallback.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'GET_VERSION') {
    const msg = { type: 'VERSION', version: CACHE_VERSION };
    // Prefer reply via the provided port (Safari/iOS friendly)
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(msg);
    } else if (event.source && event.source.postMessage) {
      event.source.postMessage(msg);
    } else {
      // Last resort: broadcast to all clients
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
        .then(clients => clients.forEach(c => c.postMessage(msg)));
    }
  }
});