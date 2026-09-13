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

// ---- el aviso de las 20:30 ----
//
// Lo manda `/api/avisos/diario` con Web Push. Llega con la app cerrada, que es
// la única razón de que exista: con la app abierta ya se ve que el día no está.
self.addEventListener('push', (e) => {
  let datos = {};
  try {
    datos = e.data ? e.data.json() : {};
  } catch (_) {
    // un push sin JSON igual se muestra: mejor un aviso genérico que ninguno
  }
  e.waitUntil(
    self.registration.showNotification(datos.titulo || 'Ascent', {
      body: datos.cuerpo || '',
      icon: '/icons/icono-192.png',
      // `tag` hace que un aviso nuevo REEMPLACE al anterior en vez de apilarse.
      // Si por algún motivo llegaran dos, en la pantalla hay uno.
      tag: 'aviso-diario',
      data: { url: datos.url || '/' },
    })
  );
});

// Tocar el aviso lleva a Inicio, que es donde se registra el día. Si la app
// ya estaba abierta en algún lado se usa esa ventana en vez de abrir otra.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          if ('navigate' in v) v.navigate(url);
          return v.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
