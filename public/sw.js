// Service worker mínimo: cachea el cascarón y los estáticos.
// Las páginas van network-first (los datos de racha tienen que estar frescos).
// v2 (19/9): con 'ascent-v1' la limpieza de abajo nunca borraba nada —solo
// borra las cachés con OTRO nombre—, y cada deploy sumaba sus archivos nuevos
// (otro hash, otro nombre) a la misma caché, para siempre. Cambiar el nombre
// hace que esta versión, al activarse, se lleve la vieja entera.
const CACHE = 'ascent-v2';
// Y DE ACÁ EN MÁS CON TOPE: los estáticos de más que esto se van, los más
// viejos primero. Una app entera pesa unos 60 archivos; 150 alcanza para la
// versión de hoy y la anterior, y no crece con cada deploy.
const TOPE_ESTATICOS = 150;

async function guardarConTope(pedido, respuesta) {
  const c = await caches.open(CACHE);
  await c.put(pedido, respuesta);
  const claves = await c.keys();
  const estaticos = claves.filter((k) => new URL(k.url).pathname.startsWith('/_next/static'));
  // `keys()` devuelve en orden de inserción: los primeros son los más viejos.
  for (const k of estaticos.slice(0, Math.max(0, estaticos.length - TOPE_ESTATICOS))) await c.delete(k);
}
// `/icons/icono.svg` ESTUVO ACÁ Y NO EXISTE. Verificado en produccion el
// 16/9/2026: devuelve 404.
//
// Eso no era un archivo de mas en una lista: `addAll` es todo o nada. Si UNA
// de las URLs no responde 2xx, la promesa se rechaza, el `waitUntil` falla, y
// el evento `install` falla con el. Un service worker que no instala no se
// activa nunca. O sea que esto, que parece una linea de adorno, apagaba:
//
//   - el cascaron sin conexion (no se cacheo nunca nada),
//   - y el registro de los avisos push, que espera a
//     `navigator.serviceWorker.ready` y con el install fallado no llega.
//
// Ahora se pide un archivo que existe, y ademas se cachea de a uno con su
// propio catch: el dia que falte otro, se pierde ESE archivo y no el service
// worker entero. Un fallo tiene que costar lo que vale, no todo.
const ESTATICOS = ['/manifest.webmanifest', '/icons/icono-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(ESTATICOS.map((u) => c.add(u).catch(() => {})))
    )
  );
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
            guardarConTope(e.request, copia).catch(() => {});
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
