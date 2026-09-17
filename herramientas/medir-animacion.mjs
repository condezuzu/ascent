// ¿LA WEB SIGUE ANIMANDO IGUAL? Una huella determinista del movimiento.
//
// EL PROBLEMA QUE RESUELVE. `npm run capturas` saca UNA foto por pantalla. Si
// alguien rompe el bucle de animación sin romper el primer cuadro —que es
// exactamente lo que puede pasar al mover el motor a código compartido— las
// fotos salen idénticas y el informe da verde. El fondo quedaría congelado y
// nada avisaría.
//
// CÓMO. El movimiento se mira comparando cuadros a lo largo del tiempo, así
// que hay que poder repetir el MISMO tiempo dos veces. Antes de que corra una
// sola línea de la app se reemplazan las tres fuentes de no-determinismo:
//
//   Math.random            -> un PRNG con semilla fija (mulberry32)
//   performance.now        -> un reloj virtual que solo avanza cuando yo digo
//   requestAnimationFrame  -> una cola que yo vacío a mano
//
// Con eso, "el segundo 1,2 de la animación" es un pixel exacto y no una
// aproximación. Se sacan ocho cuadros a tiempos fijos y se guardan.
//
//   node --env-file=.env.local herramientas/medir-animacion.mjs antes
//   node --env-file=.env.local herramientas/medir-animacion.mjs despues
//
// El segundo compara contra el primero y falla si un cuadro cambió.
//
// DOS COSAS QUE COMPRUEBA, y son distintas:
//
//   1. QUE SE MUEVA. Los ocho cuadros tienen que diferir entre sí. Un motor
//      congelado da ocho fotos idénticas, y eso se caza sin necesitar huella
//      previa. Es la comprobación que ninguna captura puede dar.
//   2. QUE SE MUEVA IGUAL. Cuadro a cuadro contra la corrida anterior.
//
// LO QUE NO PRUEBA: el fps de verdad. Acá el reloj es de mentira a propósito
// —lo que se mide es QUÉ se dibuja, no cuán rápido—. La velocidad la mide
// `medir-quietud.mjs`, que corre con el reloj real.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { cerrarPuerto, limpiarPuertosDeSondas, pasarLaEntrada } from '../supabase/utiles.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ETIQUETA = process.argv[2] ?? 'antes';
const SALIDA = join(RAIZ, 'capturas', 'animacion');
mkdirSync(SALIDA, { recursive: true });

// LOS INSTANTES. Todos por debajo de los 3 s que tarda el motor en bajar al
// escalón 'lento' por inactividad: si se pasaran, la mitad de los cuadros
// medirían la quietud en vez del movimiento, y eso ya lo mide otra sonda.
const INSTANTES = [0, 400, 800, 1200, 1600, 2000, 2400, 2800];

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    s.listen(p, '0.0.0.0');
  });
limpiarPuertosDeSondas();
let PUERTO = 3091;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-animacion' };
console.log('compilando…');
const build = spawnSync('npx', ['next', 'build'], { cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('NO COMPILA:\n' + (build.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
  cwd: RAIZ,
  shell: true,
  env: entorno,
  stdio: 'ignore',
});
const cerrar = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
  cerrarPuerto(PUERTO);
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

// EL PARCHE VA ANTES QUE TODO, con `addInitScript`: si corriera después, el
// motor ya habría leído el reloj y sorteado las estrellas con el azar de
// verdad, y la huella cambiaría en cada corrida.
await ctx.addInitScript(() => {
  // mulberry32: un PRNG chico y conocido. La semilla es fija a proposito: lo
  // que se quiere es la MISMA nebulosa todas las veces, no una linda.
  let s = 0x9e3779b9;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // EL BUCLE DE CUADROS SIGUE SIENDO EL DE VERDAD. Lo virtual es SOLO el reloj.
  //
  // POR QUE, y me costo dos corridas entenderlo. La primera version reemplazaba
  // `requestAnimationFrame` por una cola propia. El motor dibujaba --278 cuadros
  // contados, la cola siempre llena-- y las ocho fotos salian IDENTICAS al byte.
  // La razon es que un canvas de WebGL sin `preserveDrawingBuffer` se presenta
  // cuando el compositor del navegador produce un cuadro, y el compositor se
  // mueve con el rAF de verdad. Al reemplazarlo, el motor seguia dibujando en un
  // buffer que ya nadie llevaba a la pantalla.
  //
  // O sea: la sonda mostraba un motor congelado que en realidad andaba. Es la
  // misma clase de señal falsa que un servidor huerfano, y la mas cara: no
  // rompe, miente.
  //
  // Ahora el navegador dibuja sus cuadros normalmente y lo unico que se falsea
  // es que cada uno avanza EXACTAMENTE 16 ms. El determinismo sale de que el
  // delta sea siempre el mismo, no de congelar el tiempo.
  const rafReal = window.requestAnimationFrame.bind(window);
  const MS_POR_CUADRO = 16;
  let ahora = 0;
  window.__cuadros = 0;
  performance.now = () => ahora;
  Date.now = () => 1800000000000 + ahora;
  // Los callbacks de la app reciben el reloj virtual, no el real.
  window.requestAnimationFrame = (fn) => rafReal(() => fn(ahora));
  // La bomba: un rAF de verdad que avanza el reloj una vez por cuadro. Va
  // aparte de los callbacks de la app para que el reloj avance UNA sola vez
  // aunque haya tres animaciones pidiendo cuadro.
  rafReal(function bomba() {
    ahora += MS_POR_CUADRO;
    window.__cuadros++;
    rafReal(bomba);
  });
  window.__esperar = (n) =>
    new Promise((listo) => {
      const ver = () => (window.__cuadros >= n ? listo(window.__cuadros) : rafReal(ver));
      ver();
    });

  window.requestIdleCallback = (fn) => setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 50 }), 0);
  window.cancelIdleCallback = () => {};

  window.__estado = () => ({
    lienzos: document.querySelectorAll('canvas').length,
    reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    oculto: document.hidden,
    motorMontado: performance.getEntriesByName('ascent:motor-montar-fin').length > 0,
  });
});

const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await pasarLaEntrada(page);
await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });
// El motor se carga con `import()` dinámico: hay que esperar al canvas, no al
// texto de la pantalla. Sin esto se fotografía el fondo de CSS solo.
await page.locator('canvas').first().waitFor({ state: 'attached', timeout: 60000 });

// SE ESPERA A QUE EL MOTOR MONTE. `FondoEspacial` no lo toca antes de
// `PISO_MS = 2000` medidos con `performance.now()` --que aca es el reloj
// virtual, o sea 125 cuadros--. Si se muestrea antes, lo que se fotografia es
// otra animacion: la primera version de esta sonda media la entrada de CSS y
// yo lei esos cuadros como si fueran el fondo.
for (let i = 0; i < 200 && !(await page.evaluate(() => window.__estado().motorMontado)); i++) {
  await page.evaluate(() => window.__esperar(window.__cuadros + 10));
}
const est = await page.evaluate(() => window.__estado());
console.log(est.motorMontado ? 'motor montado, empieza el muestreo' : 'EL MOTOR NUNCA SE MONTO');
if (!est.motorMontado) process.exit(1);
const CERO = await page.evaluate(() => window.__cuadros);

const cuadros = [];
for (const t of INSTANTES) {
  // Los instantes son milisegundos de animacion; a 16 ms por cuadro eso es
  // una cantidad exacta de cuadros, siempre la misma.
  // SE LO MANTIENE DESPIERTO. El motor baja a 12 fps a los 3 s sin que nadie
  // toque la pantalla (`lib/quietud.ts`), y eso es deseado: no es lo que esta
  // sonda quiere medir. Sin este toque los ultimos cuadros salian identicos
  // entre si y parecian un motor roto, cuando era el ahorro funcionando.
  await page.evaluate(() => window.dispatchEvent(new Event('pointermove')));
  await page.evaluate((n) => window.__esperar(n), CERO + t / 16);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 844 } });
  writeFileSync(join(SALIDA, `${ETIQUETA}-${String(t).padStart(4, '0')}.png`), png);
  cuadros.push({ t, png });
  const n = await page.evaluate(() => window.__cuadros);
  console.log(`  t=${String(t).padStart(4)} ms  ${String(png.length).padStart(7)} bytes  cuadro ${n}`);
}

await nav.close();

// --- 1. ¿SE MUEVE? ---
const distintos = new Set(cuadros.map((c) => c.png.toString('base64'))).size;
console.log(`\ncuadros distintos entre si: ${distintos} de ${cuadros.length}`);
const quieto = distintos <= 1;
if (quieto) console.log('EL MOTOR NO SE MUEVE: los ocho cuadros son el mismo pixel.');

// --- 2. ¿SE MUEVE IGUAL QUE ANTES? ---
const diferencias = [];
if (ETIQUETA !== 'antes') {
  for (const { t, png } of cuadros) {
    const ruta = join(SALIDA, `antes-${String(t).padStart(4, '0')}.png`);
    if (!existsSync(ruta)) {
      console.log(`\nno hay huella "antes" para t=${t}: corre primero con "antes".`);
      process.exit(1);
    }
    if (!readFileSync(ruta).equals(png)) diferencias.push(t);
  }
  console.log(
    diferencias.length
      ? `CAMBIO LA ANIMACION en los instantes: ${diferencias.join(', ')} ms`
      : `identica a la huella "antes" en los ${cuadros.length} instantes`
  );
}

process.exit(quieto || diferencias.length ? 1 : 0);
