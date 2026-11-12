const CACHE_NAME = 'bookmark-manager-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html', // Change this if your HTML file has a different name
  './manifest.json'
];

// Install event: Cache the core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up old caches if the version changes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Serve cached files if offline, otherwise fetch from network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version if found
      if (response) {
        return response;
      }
      // Otherwise, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Optionally cache new requests dynamically here if needed
        return networkResponse;
      }).catch(() => {
        // Fallback for offline (optional)
        // return caches.match('/offline.html');
      });
    })
  );
});