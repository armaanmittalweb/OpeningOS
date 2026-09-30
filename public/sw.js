// OpeningOS service worker: offline app shell.
// Navigations: network first, falling back to the cached page for that route.
// Hashed assets, fonts and the Stockfish files: cache first (they never change
// under the same URL). Cross-origin requests (Lichess, Chess.com, sync) are
// never touched.
const CACHE = 'openingos-v2';
const SHELL = ['/', '/embed', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // /embed has different headers (no COOP/COEP), so it is cached separately.
    const key = url.pathname.startsWith('/embed') ? '/embed' : '/';
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key).then((r) => r || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/stockfish/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
