// Network-first, cache as a fallback for when there's no connection at all.
// A cache-first strategy would be the classic PWA footgun for this app: it
// auto-deploys on every push to main, and a stale cache-first worker would
// keep serving yesterday's version indefinitely with no visible sign anything
// was wrong. Network-first means online users always get the latest push;
// the cache only ever matters when the network request itself fails.
const CACHE = 'piano-practice-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // Only this app's old caches: every app on the Pages origin shares
      // the same CacheStorage, and flex-training keeps one too.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('piano-practice-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Only keep good copies: fetch resolves for a 404 or 503 too, and
  // caching that would replace the working offline copy. Opaque is a
  // cross-origin font or stylesheet, which can't be inspected.
  const net = fetch(e.request).then((res) => ({ res, copy: res.ok || res.type === 'opaque' ? res.clone() : null }));
  e.respondWith(net.then(({ res }) => res).catch(() => caches.match(e.request)));
  // The cache write gets its own waitUntil so the browser doesn't stop the
  // worker halfway through it; a failed write doesn't affect the response.
  e.waitUntil(net.then(({ copy }) => copy && caches.open(CACHE).then((c) => c.put(e.request, copy))).catch(() => {}));
});
