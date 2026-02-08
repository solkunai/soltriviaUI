// Service Worker for SOL Trivia PWA
const CACHE_NAME = 'sol-trivia-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

// Install: Cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Only GET requests can be cached (Cache API does not support POST/PATCH/etc.)
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') {
    e.respondWith(fetch(request));
    return;
  }

  const url = new URL(request.url);

  // API calls: network-only (do not cache)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase')) {
    e.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
      .catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return fetch(request);
      })
  );
});
