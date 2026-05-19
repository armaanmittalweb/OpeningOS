/* OpeningOS — service worker
 * Network-first for HTML so users always get fresh app shell.
 * Cache-first for static assets (CSS/JS/fonts) once they've been seen.
 * No external API calls are cached.
 */
const VERSION = 'oos-v23-settings-games-repertoire-polish';
const STATIC_CACHE = 'oos-static-' + VERSION;

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './sitemap.xml',
  './robots.txt',
  './404.html',
  './icons/icon-512.svg',
  './icons/icon-192.svg',
  './vendor/chess.min.js',
  './js/env.js',
  './js/profile.js',
  './js/pgn.js',
  './js/api.js',
  './js/markdown.js',
  './js/audio.js',
  './js/idb_store.js',
  './js/fsrs.js',
  './js/analysis_engine.js',
  './js/engine_integration.js',
  './js/engine_connector.js',
  './js/data.js',
  './js/graph_native.js',
  './js/native_graph.js',
  './js/advanced_review.js',
  './js/game_review_pro.js',
  './js/board.js',
  './js/practice.js',
  './js/views.js',
  './js/product.js',
  './js/product_plus.js',
  './js/cloud_sync.js',
  './js/deployment_config.js',
  './js/saas_client.js',
  './js/enterprise_api.js',
  './js/stockfish_client.js',
  './js/engine_client.js',
  './js/backend_saas.js',
  './js/sync_engine.js',
  './js/product_release.js',
  './js/pro_content.js',
  './js/production_ready.js',
  './js/launch.js',
  './js/ui_polish.js',
  './js/saas_ui.js',
  './js/account_gateway.js',
  './js/settings_enforcement.js',
  './js/accessibility.js',
  './js/accessibility_complete.js',
  './js/observability.js',
  './js/product_auth.js',
  './js/product_experience.js',
  './js/player_experience_audit.js',
  './js/world_class_product_core.js',
  './js/app.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('oos-static-') && k !== STATIC_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Don't intercept external API calls (Lichess, Chess.com, fonts CDN).
  if (url.origin !== location.origin) return;

  // Network-first for HTML (so updates propagate quickly)
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(STATIC_CACHE).then(c => c.put(req, copy)).catch(() => {});
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then(r => r || fetch(req).then(resp => {
      const copy = resp.clone();
      caches.open(STATIC_CACHE).then(c => c.put(req, copy)).catch(() => {});
      return resp;
    }))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
