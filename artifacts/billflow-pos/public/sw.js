// BillFlow POS Service Worker for PWA installability and offline support
const CACHE_NAME = 'billflow-pos-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let browser network handle API requests directly; fallback to cache if offline
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match('/pos.html') || await caches.match('/');
        if (fallback) return fallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});

