// Offline cache. `scripts/build-web.js` rewrites the next two lines with a build hash and every exported file.
// (They are valid as-is, so a plain `expo export` still gives a working, if less complete, worker.)
// Navigations: network-first (so updates arrive), falling back to cache. Everything else: cache-first.
const CACHE = 'todo-dev';
const PRECACHE = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // Reload any open window once the new worker takes over, so a stale installed copy picks up the new version.
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((windows) => windows.forEach((w) => w.navigate(w.url).catch(() => {}))),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  event.respondWith(
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
});
