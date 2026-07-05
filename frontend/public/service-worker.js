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

// Security: validate request is same-origin and safe.
// BUG FIX: the previous version was `a && b || c`, which due to operator
// precedence (&& binds tighter than ||) evaluated as `(a && b) || c` —
// meaning ANY http: request, regardless of origin, was treated as "safe".
// The intent was clearly "same origin AND (https or http)".
function isSafeRequest(request) {
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin && (url.protocol === 'https:' || url.protocol === 'http:');
  } catch {
    return false;
  }
}

// Fetch — only handle validated same-origin requests
self.addEventListener('fetch', (event) => {
  if (!isSafeRequest(event.request)) return;

  const url = new URL(event.request.url);

  // Skip API calls — always go to network
  if (url.pathname.startsWith('/api')) return;

  // Navigation — serve cached shell as fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => cached || new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Static assets — cache-first from pre-cached assets only
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || new Response('', { status: 404 });
    })
  );
});
