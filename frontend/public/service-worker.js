const CACHE_NAME = 'billsure-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo-horizontal.png',
  '/logo-icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json',
];

// Install — cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate — clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — only handle same-origin requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests to prevent SSRF
  if (url.origin !== self.location.origin) return;

  // Never cache API calls
  if (url.pathname.startsWith('/api')) return;

  // Network-first for navigation (SPA routes)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for same-origin static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
