/* v11.0 — bump this to force update */
const CACHE_NAME = "shoe-tracker-cache-v11.0";
const CACHE_VERSION = "v11.0";

// Core assets that should be cached immediately on install
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// External CDN assets (will be cached when first loaded)
const EXTERNAL_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js"
];

// Install event - cache core assets immediately
self.addEventListener("install", (e) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting(); // Activate immediately
  
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching core assets...');
        return cache.addAll(CORE_ASSETS).catch(err => {
          console.error('[Service Worker] Failed to cache some assets:', err);
          // Don't fail the install if some assets can't be cached
        });
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (e) => {
  console.log('[Service Worker] Activating...');
  
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches that don't match current name
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activation complete');
      return self.clients.claim(); // Take control of all clients
    })
  );
});

// Fetch event - handle all network requests
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  
  // Skip non-GET requests
  if (e.request.method !== 'GET') return;
  
  // Skip browser extension requests
  if (url.protocol === 'chrome-extension:') return;
  
  // Handle external CDN requests
  if (EXTERNAL_ASSETS.includes(e.request.url)) {
    e.respondWith(
      caches.match(e.request)
        .then(cached => {
          // Return cached version if available
          if (cached) {
            console.log('[Service Worker] Serving from cache (external):', e.request.url);
            return cached;
          }
          
          // Otherwise fetch from network and cache
          return fetch(e.request)
            .then(response => {
              // Check if we received a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response to cache and return
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(e.request, responseToCache);
                  console.log('[Service Worker] Cached external resource:', e.request.url);
                });
              
              return response;
            })
            .catch(error => {
              console.error('[Service Worker] Fetch failed:', error);
              // Even if network fails, we don't have a cached version
              return new Response('Network error', {
                status: 408,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
    return;
  }
  
  // Handle local/same-origin requests with Cache-First strategy
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request)
        .then(cached => {
          // Return cached version if available
          if (cached) {
            console.log('[Service Worker] Serving from cache (local):', e.request.url);
            return cached;
          }
          
          // Otherwise fetch from network
          return fetch(e.request)
            .then(response => {
              // Check if we received a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response to cache and return
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(e.request, responseToCache);
                });
              
              return response;
            })
            .catch(error => {
              console.error('[Service Worker] Fetch failed, serving offline page:', error);
              
              // For navigation requests, return the offline page (index.html)
              if (e.request.mode === 'navigate') {
                return caches.match('./index.html');
              }
              
              // For API/data requests, return empty response
              return new Response('Offline', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
    return;
  }
  
  // For other cross-origin requests, use Network-First strategy
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200) {
          return response;
        }
        
        // Clone to cache
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(e.request, responseToCache);
          });
        
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(e.request);
      })
  );
});

// Handle service worker updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});