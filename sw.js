/* Wigglefeast service worker: offline play and versioned releases.
   Bump VERSION for every release that changes a shipped file (a PR check enforces this).
   Never reuse a version; roll back by publishing the old code under a higher version. */
const VERSION = '1.26.0';
const CACHE = `wigglefeast-${VERSION}`;
const FILES = [
  'index.html',
  'style.css',
  'engine.js',
  'main.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-64.png',
];

// Download the whole release, bypassing the HTTP cache, before it can be used.
// If any file fails the install fails, and the current release keeps running.
// No skipWaiting() here: the page asks for it when the player chooses Reload.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wigglefeast-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  const msg = e.data || {};
  if (msg.type === 'skipWaiting') self.skipWaiting();
  else if (msg.type === 'version' && e.ports[0]) e.ports[0].postMessage({ version: VERSION });
});

// Serve this release's files only, so a page never mixes two releases.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE)
      .then((c) => c.match(req.mode === 'navigate' ? 'index.html' : req, { ignoreSearch: true }))
      .then((hit) => hit || fetch(req)),
  );
});
