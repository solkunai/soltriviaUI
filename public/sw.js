// Service Worker for SOL Trivia PWA
const CACHE_NAME = 'sol-trivia-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

// Install: Cache static assets and activate immediately
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches (v1 etc.) and take control immediately
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

// Fetch strategies per resource type
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API / Supabase calls: network-only (never cache)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    e.respondWith(fetch(request));
    return;
  }

  // Vite hashed assets (/assets/*): cache-first (filenames change per deploy)
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML navigation (index.html, /): network-first so users always get latest deploy
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Everything else: network-first with cache fallback
  e.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ===================== PUSH NOTIFICATIONS =====================

// Receive push message from server and display as notification
self.addEventListener('push', (e) => {
  if (!e.data) return;

  let data;
  try {
    data = e.data.json();
  } catch {
    data = { title: 'SolTrivia', body: e.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon.png',
    tag: data.tag || 'soltrivia-default',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    renotify: true,
  };

  e.waitUntil(self.registration.showNotification(data.title || 'SolTrivia', options));
});

// Handle notification click — open the app to the relevant page
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || '/';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it and navigate
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(targetUrl);
    })
  );
});
