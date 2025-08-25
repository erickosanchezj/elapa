const CACHE_VERSION = 'v1.1.0';
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
      Promise.all(keys.map(k => (k.startsWith('taqueria-admin-') && k !== CACHE_NAME) ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Network-first for same-origin HTML, cache-first for everything else
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
