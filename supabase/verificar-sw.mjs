// ¿EL SERVICE WORKER SE INSTALA Y SE ACTIVA EN PRODUCCIÓN?
//
// POR QUÉ EXISTE. Estuvo roto desde siempre y nadie se enteró. El `install`
// hacía `caches.addAll([...])` con una URL que no existe —`/icons/icono.svg`,
// 404— y `addAll` es todo o nada: una sola URL que no responde 2xx rechaza la
// promesa, falla el `waitUntil` y falla el evento. Un service worker que no
// instala no se activa nunca.
//
// Eso apagaba el cascarón sin conexión y el registro de los avisos push, que
// espera a `navigator.serviceWorker.ready`. Sin ningún síntoma: la app anda
// igual, solo que sin nada de lo que el service worker aporta.
//
// LA LECCIÓN, QUE ES LA RAZÓN DE ESTE ARCHIVO: no alcanza con que el código
// esté escrito. Un service worker no corre en desarrollo (`RegistroPWA` solo
// registra en producción), no da error visible, y ningún test lo tocaba. Era
// una pieza entera que dábamos por funcionando sin haberla mirado nunca.
//
// QUÉ MIRA, contra el sitio publicado y no contra localhost:
//   1. Que cada URL de `ESTATICOS` exista de verdad.
//   2. Que el service worker llegue al estado ACTIVADO en un navegador real.
//   3. Que después de activarse, el cascarón quede cacheado.
//
//   node supabase/verificar-sw.mjs [url]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { limiteDeSonda } from './utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITIO = (process.argv[2] ?? 'https://ascent-blush-seven.vercel.app').replace(/\/$/, '');

const fallos = [];
const bien = [];
const juzgar = (ok, texto) => (ok ? bien : fallos).push(texto);

console.log(`Mirando ${SITIO}\n`);

// ---- 1. las URLs que el service worker pide al instalarse ----
//
// Se leen DEL ARCHIVO y no se copian acá: una lista copiada se desactualiza y
// el test pasaría mientras el service worker falla, que es exactamente la
// forma de fallo que esto viene a evitar.
const sw = readFileSync(join(RAIZ, 'public', 'sw.js'), 'utf8');
const lista = /const ESTATICOS = \[([^\]]*)\]/.exec(sw);
if (!lista) {
  console.log('NO encontré la lista ESTATICOS en public/sw.js: ¿cambió de nombre?');
  process.exit(1);
}
const estaticos = [...lista[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
console.log(`ESTATICOS (${estaticos.length}): ${estaticos.join(', ')}`);

for (const ruta of estaticos) {
  const r = await fetch(SITIO + ruta, { redirect: 'manual' }).catch(() => null);
  const codigo = r ? r.status : 'sin respuesta';
  juzgar(r != null && r.ok, `${ruta} -> ${codigo}`);
}

// ---- 2. que llegue a ACTIVADO en un navegador de verdad ----
const nav = await chromium.launch();
const ctx = await nav.newContext();
const page = await ctx.newPage();
await page.goto(SITIO + '/login', { waitUntil: 'domcontentloaded' });

const estado = await page
  .evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'sin soporte';
    // `ready` no resuelve nunca si el install falló, así que se corre contra
    // un reloj: quedarse esperando sería el mismo silencio del bug original.
    const listo = navigator.serviceWorker.ready.then((r) => (r.active ? 'activado' : 'registrado sin activar'));
    const tarde = new Promise((r) => setTimeout(() => r('no se activó en 25 s'), 25000));
    return Promise.race([listo, tarde]);
  })
  .catch((e) => `error: ${e.message}`);

juzgar(estado === 'activado', `estado del service worker: ${estado}`);

// ---- 3. que el cascarón quede cacheado ----
const cacheado = await page
  .evaluate(async () => {
    if (!('caches' in window)) return null;
    const nombres = await caches.keys();
    let total = 0;
    for (const n of nombres) total += (await (await caches.open(n)).keys()).length;
    return { nombres, total };
  })
  .catch(() => null);

if (cacheado) {
  juzgar(cacheado.total > 0, `cacheó ${cacheado.total} cosas en [${cacheado.nombres.join(', ')}]`);
} else {
  fallos.push('no pude leer las cachés');
}

await nav.close();

console.log('');
for (const b of bien) console.log('  ok   ' + b);
for (const f of fallos) console.log('  MAL  ' + f);
console.log(
  fallos.length
    ? `\n${fallos.length} problema(s): el service worker NO está sano en produccion.`
    : '\nEl service worker se instala, se activa y cachea.'
);
process.exit(fallos.length ? 1 : 0);
