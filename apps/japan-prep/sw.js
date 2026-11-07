// Offline support. Network-first with the cache as a fallback, same as
// piano practice: Pages deploys on every push, and a cache-first worker
// would keep serving an old version with no sign anything was wrong.
// Online you always get the latest; the cache only answers when the
// network can't.
//
// This worker controls apps/japan-prep/ only. Moving or renaming the
// folder leaves this registration serving its cache at the old URL.
const CACHE = 'japan-prep-v1';
// Warmed on install so the first offline visit works. Anything else the
// page fetches (fonts, files added later) is cached the first time it
// loads online.
const CORE = [
  './', 'index.html', 'app.js', 'speech.js', 'session.js', 'srs.js', 'content.js', 'kana.js', 'numbers.js', 'styles.css',
  'manifest.json', 'icon-192.png', 'icon-512.png', '../../shared/base.css',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  // One at a time, so a file that fails doesn't stop the rest.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('japan-prep-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Only keep good copies: fetch resolves for a 404 or 503 too, and
        // caching that would replace the working offline copy. Opaque is a
        // cross-origin font or stylesheet, which can't be inspected.
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
