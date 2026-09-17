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
  // mulberry32: un PRNG chico y conocido. La semilla es fija a propósito: lo
  // que se quiere es la MISMA nebulosa todas las veces, no una linda.
  let s = 0x9e3779b9;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // El reloj virtual. Arranca en 0 y solo se mueve desde `window.__avanzar`.
  let ahora = 0;
  performance.now = () => ahora;
  Date.now = () => 1800000000000 + ahora;

  // rAF a mano. Se guardan los pedidos y se vacían de a tandas: así un cuadro
  // que pide el siguiente no se dispara solo, que es lo que haría imposible
  // parar el tiempo en un instante exacto.
  let cola = [];
  let id = 1;
  // CUANTOS CUADROS CORRIERON DE VERDAD. Sin esto, dos fotos iguales tienen
  // dos causas que desde afuera se ven idénticas: el bucle se cortó, o el
  // bucle corre y lo que dibuja no cambia. Son problemas distintos.
  window.__cuadros = 0;
  window.requestAnimationFrame = (fn) => {
    cola.push({ id, fn });
    return id++;
  };
  window.cancelAnimationFrame = (x) => {
    cola = cola.filter((c) => c.id !== x);
  };
  window.__estado = () => ({
    enCola: cola.length,
    lienzos: document.querySelectorAll('canvas').length,
    reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    oculto: document.hidden,
  });
  // Avanza a `t` en pasos de 16 ms, vaciando la cola en cada paso: es lo que
  // haría el navegador a 60 Hz, pero sin depender de cuánto tardó la máquina.
  // ES ASINCRONO, Y ESA ES LA PARTE QUE COSTO. La primera version era un
  // `while` sincronico, y mientras corre un `while` NO se resuelve ninguna
  // promesa ni corre ningun timer: el motor se re-monta de forma asincrona
  // --`await import('@/motor/escena')`-- cuando llegan los datos, y ese
  // re-montaje no podia completarse nunca adentro del bucle. El contador lo
  // mostro: 103 cuadros y despues cero, para siempre.
  //
  // El `setTimeout(0)` de cada paso le devuelve el control al navegador. Sin
  // eso, la sonda mide una app a la que ella misma le corto la respiracion, y
  // el resultado --cuadros identicos-- se lee como "el motor se congelo".
  window.__avanzar = async (t) => {
    while (ahora < t) {
      ahora = Math.min(t, ahora + 16);
      const tanda = cola;
      cola = [];
      for (const c of tanda) {
        try {
          window.__cuadros++;
          c.fn(ahora);
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  };
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

const cuadros = [];
for (const t of INSTANTES) {
  await page.evaluate((ms) => window.__avanzar(ms), t);
  // LA PANTALLA ENTERA, y no un recorte de arriba. El primer intento cortaba
  // en y=500 y daba cuatro cuadros identicos seguidos: el cuerpo se dibuja
  // ABAJO A LA DERECHA --`grupo.position.set(asp * 0.8, -0.72, 0)`-- asi que
  // el recorte se estaba perdiendo justo lo que se mueve. Lo que cambiaba en
  // los primeros cuadros era la animacion de entrada de CSS, no el motor.
  //
  // Una sonda que mira al lado equivocado es peor que no tenerla: da verde.
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 844 } });
  writeFileSync(join(SALIDA, `${ETIQUETA}-${String(t).padStart(4, '0')}.png`), png);
  cuadros.push({ t, png });
  const e = await page.evaluate(() => ({ n: window.__cuadros, ...window.__estado() }));
  console.log(
    `  t=${String(t).padStart(4)} ms  ${String(png.length).padStart(7)} bytes  ` +
      `${String(e.n).padStart(4)} cuadros  enCola=${e.enCola}  lienzos=${e.lienzos}  ` +
      `reduce=${e.reduce}  oculto=${e.oculto}`
  );
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
