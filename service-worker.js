/* v11.0 — bump this to force update */
const CACHE_NAME = "shoe-tracker-cache-v11.0";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.log('Failed to cache some assets:', err);
      });
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  
  // Cache-first for same-origin, network-first for others (like CDN)
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(resp => {
          // Only cache successful responses
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          }
          return resp;
        }).catch(() => caches.match("./index.html"))
      )
    );
  } else {
    // For CDN resources like XLSX library
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).then(resp => {
          // Cache the CDN resource for future use
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          }
          return resp;
        }).catch(() => {
          // If both cache and network fail, provide a fallback
          if (e.request.url.includes('xlsx')) {
            return caches.match("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
          }
          return new Response('Offline - Resource not available');
        });
      })
    );
  }
});