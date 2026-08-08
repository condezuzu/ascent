// Service worker mínimo: cachea el cascarón y los estáticos.
// Las páginas van network-first (los datos de racha tienen que estar frescos).
const CACHE = 'ascent-v1';
const ESTATICOS = ['/manifest.webmanifest', '/icons/icono.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESTATICOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // estáticos: cache-first
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copia));
            return res;
          })
      )
    );
    return;
  }

  // páginas: network-first con respaldo de cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
