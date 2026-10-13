/* Public static assets only. Payment APIs, account pages and documents must
 * always reach the network; never persist their responses in Cache Storage. */
const CACHE = 'tazdan-public-assets-v1';
const MAX_ENTRIES = 192;

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Earlier workers used several runtime-cache names for pages. Clear all
    // legacy Cache Storage on this app origin so none retain account data.
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function publicAsset(request) {
  if (request.method !== 'GET' || request.mode === 'navigate' || request.headers.has('authorization')) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.search) return false;
  return url.pathname.startsWith('/_next/static/') ||
    /^\/(?:app\/(?:screens|loops)|icons)\/.*\.(?:png|jpe?g|webp|avif|svg|woff2?)$/i.test(url.pathname) ||
    /^\/(?:icon[^/]*|logo[^/]*|favicon|apple-touch-icon|og-image)\.(?:png|svg|ico)$/i.test(url.pathname);
}

self.addEventListener('fetch', event => {
  if (!publicAsset(event.request)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const existing = await cache.match(event.request);
    if (existing) return existing;
    const response = await fetch(event.request);
    const control = response.headers.get('cache-control') || '';
    if (response.ok && !response.redirected && response.type === 'basic' && !/no-store|private/i.test(control)) {
      try {
        await cache.put(event.request, response.clone());
        const keys = await cache.keys();
        await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map(key => cache.delete(key)));
      } catch { /* Storage quota must not prevent the network response. */ }
    }
    return response;
  })());
});
