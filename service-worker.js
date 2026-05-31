/* ==========================================
   UMOJA Tracker - Service Worker v12.1
   Provides full offline functionality & caching
========================================== */
const CACHE_NAME = "umoja-tracker-cache-v12.1";
const CACHE_VERSION = "v12.1";

// Core assets that must be cached immediately on install
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./Umoja_Audit_Pro.html",
  "./app.js",
  "./style.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// External CDN assets (cached when first requested)
const EXTERNAL_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js",
  "https://cdn.jsdelivr.net/npm/marked/marked.min.js"
];

// 1. INSTALL EVENT - Pre-cache core assets
self.addEventListener("install", (e) => {
  console.log(`[Service Worker] Installing ${CACHE_VERSION}...`);
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Pre-caching core assets...');
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.error('[Service Worker] Failed to cache some core assets:', err);
      });
    })
  );
});

// 2. ACTIVATE EVENT - Clean up old caches
self.addEventListener("activate", (e) => {
  console.log(`[Service Worker] Activating ${CACHE_VERSION}...`);
  
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activation complete. Claiming clients.');
      return self.clients.claim(); // Take control of all open pages immediately
    })
  );
});

// 3. FETCH EVENT - Network interception for offline mode
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  
  // Skip non-GET requests and browser extensions
  if (e.request.method !== 'GET' || url.protocol === 'chrome-extension:') return;
  
  // STRATEGY A: External CDN Assets (Cache First, then Network)
  if (EXTERNAL_ASSETS.includes(e.request.url)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        
        return fetch(e.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseToCache));
          return response;
        }).catch(err => console.error('[Service Worker] CDN Fetch failed:', err));
      })
    );
    return;
  }
  
  // STRATEGY B: Local/Same-Origin Requests (Cache First, fallback to Network, fallback to Offline Page)
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        
        return fetch(e.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseToCache));
          return response;
        }).catch(error => {
          console.error('[Service Worker] Local fetch failed, device is offline:', error);
          // If it's a page navigation request and we are offline, return index.html
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        });
      })
    );
    return;
  }
  
  // STRATEGY C: All other requests (Network First, fallback to Cache)
  e.respondWith(
    fetch(e.request).then(response => {
      if (!response || response.status !== 200) return response;
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseToCache));
      return response;
    }).catch(() => caches.match(e.request))
  );
});

// 4. MESSAGE EVENT - Listen for manual update triggers
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
