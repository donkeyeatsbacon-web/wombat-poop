// Offline play. Pages come from the network whenever it's there, so updates
// arrive straight away, and from this cache when it isn't. Everything else is
// either stamped with a content hash (shared/…?v=…) or never changes (fonts,
// icons), so the cached copy is always right.
//
// tools/bump-version.js rewrites CACHE and PRECACHE: CACHE changes whenever any
// file changes, which makes browsers install this worker afresh.
const CACHE = 'wombat-2fe98b68';
const PRECACHE = [
  './',
  'index.html',
  'wombat-campaign.html',
  'wombat-poop.html',
  'manifest.webmanifest',
  'shared/art.js?v=c54f25b5',
  'shared/base.css?v=30c6dc38',
  'shared/core.js?v=73f95151',
  'shared/physics.js?v=ce40dcd2',
  'shared/sound.js?v=945a409e',
  'shared/wombat.js?v=4b3f92f6',
  'shared/fonts/comic-neue-400.woff2',
  'shared/fonts/comic-neue-700.woff2',
  'icons/favicon-32.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))   // skip the HTTP cache
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('wombat-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if(req.mode === 'navigate'){
    // a page: network first, keep a copy, fall back to the copy offline
    e.respondWith(
      fetch(req).then(res => {
        if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./')))
    );
    return;
  }
  // anything else: cache first
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
