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

// Fetch: Network-first for API, cache-first for static assets
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API calls: network-first
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
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
      .catch(() => {
        // Fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});
