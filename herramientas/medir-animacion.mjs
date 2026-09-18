// ¿EL MOTOR SIGUE ANIMANDO IGUAL? Una huella determinista del movimiento.
//
// EL PROBLEMA QUE RESUELVE. `npm run capturas` saca UNA foto por pantalla. Si
// alguien rompe el bucle de animación sin romper el primer cuadro —que es
// exactamente lo que puede pasar al mover el motor a código compartido— las
// fotos salen idénticas y el informe da verde con el fondo congelado.
//
// QUÉ HACE. Para cada cuerpo que el motor sabe dibujar (los 8 rangos y 4
// planetas del rango 4) saca 8 cuadros a instantes fijos de la animación y
// guarda un hash de cada uno. Comprueba dos cosas distintas:
//
//   1. QUE SE MUEVA. Los 8 cuadros de cada cuerpo tienen que ser distintos
//      entre sí. No necesita huella previa: es lo que ninguna captura da.
//   2. QUE SE MUEVA IGUAL. Cada hash contra la corrida "antes".
//
//   node herramientas/medir-animacion.mjs antes
//   node herramientas/medir-animacion.mjs despues
//
// ANTES DE CONFIAR EN UNA HUELLA, CORRERLA DOS VECES SIN TOCAR NADA. Tiene que
// dar idéntica. Una huella que varía sola da rojos falsos, y el día que dé un
// rojo de verdad nadie le va a creer. Para eso sirve correrla como `control`
// sin haber tocado el código.
//
// SEIS TRAMPAS, TODAS PISADAS AL ARMAR ESTO. Están explicadas en
// `spec/trampas.md`, "Probar el motor". En corto:
//
//   - No reemplazar `requestAnimationFrame`: desconecta WebGL de la pantalla.
//     Lo único virtual es el RELOJ, que avanza exactamente 16 ms por cuadro.
//   - No fotografiar la página: la foto se queda vieja a los ~1,6 s aunque el
//     motor siga dibujando. Se lee el canvas directo, con `toDataURL`.
//   - Virtualizar un reloj obliga a virtualizar TODOS: `requestIdleCallback`
//     con un piso medido en `performance.now` no se cruzaba nunca.
//   - No medir en Inicio: el motor monta tres veces según lleguen los datos,
//     y cuál queda último lo decide la red. `/galeria` monta una vez, con
//     opciones fijas, sin cuenta ni datos.
//   - El cero es el MONTAJE, no la página: ahí se resetean reloj y semilla.
//
// LO QUE NO PRUEBA: el fps de verdad. El reloj es de mentira a propósito —lo
// que se mide es QUÉ se dibuja, no cuán rápido—. La velocidad la mide
// `medir-quietud.mjs`, con el reloj real.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { cerrarPuerto, limpiarPuertosDeSondas, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from '../supabase/utiles.mjs';
import { RANGOS } from '../nucleo/rangos.ts';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ETIQUETA = process.argv[2] ?? 'antes';
const SALIDA = join(RAIZ, 'capturas', 'animacion');
mkdirSync(SALIDA, { recursive: true });

// LA HUELLA "ANTES" NO VIVE EN `capturas/`. Vivía ahí y `npm run capturas`,
// que al arrancar borra lo viejo para no mostrar fotos de ayer, se la llevó:
// la comparación siguiente dijo "no hay huella antes" y la de verdad había
// que reconstruirla de los hashes impresos en otra corrida. Ahora vive en
// `herramientas/huellas/`, commiteada, que es donde se revisa lo que cambia.
//
// VALE PARA ESTA MÁQUINA. Los hashes salen del WebGL de este Chromium sobre
// esta GPU: en otra computadora pueden dar distinto sin que el motor haya
// cambiado. En una máquina nueva se regenera con `antes` y se valida
// corriendo `control` sin tocar nada, como la primera vez.
const HUELLAS = join(RAIZ, 'herramientas', 'huellas');
mkdirSync(HUELLAS, { recursive: true });

// Milisegundos de animación desde el montaje. Todos por debajo de los 3 s en
// que el motor baja a 12 fps sin que nadie toque; igual se lo despierta antes
// de cada muestra.
const INSTANTES = [0, 400, 800, 1200, 1600, 2000, 2400, 2800];

// QUÉ CUERPOS. El rango 4 arranca en Júpiter —el estado inicial de la
// galería— y se suman tres planetas que el motor dibuja distinto: el anillo
// de Saturno, las nubes de la Tierra y Marte, que es la cuenta de prueba.
// Después los otros siete rangos.
const NOMBRE_R4 = RANGOS.find((r) => r.n === 4).nombre;
const CUERPOS = [
  { nombre: 'rango 4 · Júpiter' },
  ...['Saturno', 'Tierra', 'Marte'].map((p) => ({ nombre: `rango 4 · ${p}`, planeta: p })),
  ...RANGOS.filter((r) => r.n !== 4).map((r) => ({ nombre: `rango ${r.n} · ${r.nombre}`, rango: r.nombre })),
];

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
const build = spawnSync('npx', ['next', 'build'], { timeout: LIMITE_DE_COMPILACION_MS, cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
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
  if (await fetch(BASE + '/galeria', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

// CON LA GPU DE LA MÁQUINA (18/9). Desde que el motor no se prende sin GPU de
// verdad, el WebGL por software de Chromium (SwiftShader) deja la galería sin
// motor y la huella no mediría nada. La base se regeneró con GPU ese día: una
// huella tomada con SwiftShader no se compara con una de GPU, porque las dos
// redondean distinto.
const nav = await chromium.launch({
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
{
  const p = await ctx.newPage();
  const nombre = await p.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const e = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl ? String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'sin webgl2';
  });
  await p.close();
  console.log(`WebGL: ${nombre}`);
  if (/swiftshader|llvmpipe|software|sin webgl2/i.test(nombre)) {
    console.log('SIN GPU: el motor no se prende por software, así que no hay huella que sacar.');
    process.exit(1);
  }
}

// TODO LO QUE HACE REPETIBLE LA CORRIDA va antes de que exista la página.
await ctx.addInitScript(() => {
  // mulberry32, semilla fija. Se vuelve a sembrar en cada montaje: ver abajo.
  const SEMILLA = 0x9e3779b9;
  let s = SEMILLA;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // EL RELOJ. Arranca EN PAUSA y en 5000: así el piso de 2 s de `FondoEspacial`
  // ya está cruzado y el motor puede montar sin que el reloj se mueva.
  let ahora = 5000;
  let pausa = true;
  performance.now = () => ahora;
  Date.now = () => 1800000000000 + ahora;
  window.__pausar = () => {
    pausa = true;
  };
  window.__soltar = () => {
    pausa = false;
  };

  // `requestIdleCallback` inmediato: si queda en tiempo real mientras el resto
  // mira un reloj virtual, sus plazos dejan de tener relación con nada.
  window.requestIdleCallback = (fn) => setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 50 }), 0);
  window.cancelIdleCallback = () => {};

  // EL CERO ES EL MONTAJE. `escena.ts` marca 'ascent:motor-montar-inicio' justo
  // antes de armar la escena: ahí se resetean el reloj y la semilla, y los
  // cuadros se cuentan desde ahí.
  //
  // LA SEMILLA Y EL RELOJ SE RESETEAN EN MARCAS DISTINTAS (18/9). Desde que el
  // primer cuadro espera a que compilen los shaders (`compileAsync`), entre
  // armar la escena y dibujarla pasan cuadros, y cuántos depende de la GPU. La
  // semilla va al armar —ahí se sortean las partículas— y el reloj al primer
  // cuadro dibujado ('ascent:shader-fin'). Antes de ese cambio las dos marcas
  // caían en el mismo instante del reloj virtual, así que una base tomada
  // entonces se compara igual.
  window.__montajes = 0;
  window.__desdeMontaje = 0;
  const marcaReal = performance.mark.bind(performance);
  performance.mark = (nombre, ...resto) => {
    // El reloj TAMBIÉN al armar: el núcleo anota ahí la hora del último toque,
    // y tiene que ser la misma que la del primer cuadro, como antes.
    if (nombre === 'ascent:motor-montar-inicio') {
      s = SEMILLA;
      ahora = 100000;
    }
    if (nombre === 'ascent:shader-fin') {
      ahora = 100000;
      window.__desdeMontaje = 0;
      window.__montajes++;
    }
    return marcaReal(nombre, ...resto);
  };

  // EL BUCLE DE CUADROS ES EL DEL NAVEGADOR, no uno propio: reemplazarlo
  // desconecta WebGL del compositor. Esta bomba solo avanza el reloj, una vez
  // por cuadro real, y nada mientras está en pausa.
  const rafReal = window.requestAnimationFrame.bind(window);
  rafReal(function bomba() {
    if (!pausa) {
      ahora += 16;
      window.__desdeMontaje++;
    }
    rafReal(bomba);
  });
  window.__esperarCuadro = (n) =>
    new Promise((listo) => {
      const ver = () => (window.__desdeMontaje >= n ? listo() : rafReal(ver));
      ver();
    });

  // `preserveDrawingBuffer` SOLO ACÁ: no cambia lo que se dibuja, solo guarda
  // el buffer para poder leerlo con `toDataURL` sin pasar por la pantalla.
  const getCtx = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (tipo, opciones, ...resto) {
    if (/webgl/.test(String(tipo))) opciones = { ...(opciones ?? {}), preserveDrawingBuffer: true };
    return getCtx.call(this, tipo, opciones, ...resto);
  };
});

const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
await page.goto(BASE + '/galeria', { waitUntil: 'domcontentloaded' });

/** Espera a que la cuenta de montajes pase de `previos` y se quede quieta. */
async function esperarMontaje(previos) {
  let ultimo = -1;
  let estable = 0;
  for (let i = 0; i < 120 && estable < 4; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const m = await page.evaluate(() => window.__montajes);
    estable = m > previos && m === ultimo ? estable + 1 : 0;
    ultimo = m;
  }
  return ultimo > previos;
}

const huella = [];
let repetidos = 0;
for (const c of CUERPOS) {
  await page.evaluate(() => window.__pausar());
  const previos = await page.evaluate(() => window.__montajes);
  if (c.rango) await page.getByRole('button', { name: c.rango, exact: true }).click();
  if (c.planeta) {
    // Los planetas solo aparecen estando en el rango 4.
    await page.getByRole('button', { name: NOMBRE_R4, exact: true }).click();
    await page.getByRole('button', { name: c.planeta, exact: true }).click();
  }
  // El primero es el montaje inicial de la página: no hay click, y `previos`
  // es 0 o ya 1. Se pide "más que antes" salvo en ese caso.
  const ok = c.rango || c.planeta ? await esperarMontaje(previos) : await esperarMontaje(0);
  if (!ok) {
    console.log(`  ${c.nombre}: EL MOTOR NO MONTO`);
    process.exit(1);
  }
  // SE LO DESPIERTA Y SE DEJAN PASAR TRES CUADROS REALES, TODAVIA EN PAUSA.
  // Sin esto, t=0 se leia en el mismo instante del `pointermove`, y segun el
  // timing real salia el render del montaje o el del primer cuadro despierto.
  // En diez cuerpos esos dos son iguales; en el agujero negro no, y el control
  // lo agarro: 87 de 88 hashes repetibles y ese uno no.
  await page.evaluate(() => window.dispatchEvent(new Event('pointermove')));
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))
  );
  await page.evaluate(() => window.__soltar());

  const hashes = [];
  for (const t of INSTANTES) {
    await page.evaluate(() => window.dispatchEvent(new Event('pointermove')));
    await page.evaluate((n) => window.__esperarCuadro(n), t / 16);
    const lienzos = await page.evaluate(() => [...document.querySelectorAll('canvas')].map((x) => x.toDataURL()));
    hashes.push(createHash('md5').update(lienzos.join('|')).digest('hex'));
    if (t === 0 || t === 2800) {
      const grande = lienzos.reduce((a, b) => (b.length > a.length ? b : a), '');
      const archivo = `${ETIQUETA}-${c.nombre.replace(/[^a-z0-9]+/gi, '-')}-${t}.png`;
      if (grande) writeFileSync(join(SALIDA, archivo), Buffer.from(grande.split(',')[1], 'base64'));
    }
  }
  const distintos = new Set(hashes).size;
  if (distintos < hashes.length) repetidos++;
  huella.push({ cuerpo: c.nombre, hashes });
  console.log(
    `  ${c.nombre.padEnd(24)} ${distintos}/${hashes.length} distintos  ${hashes.map((h) => h.slice(0, 6)).join(' ')}`
  );
}

await nav.close();
writeFileSync(
  join(ETIQUETA === 'antes' ? HUELLAS : SALIDA, `huella-${ETIQUETA}.json`),
  JSON.stringify(huella, null, 2)
);
if (errores.length) console.log('\nerrores de la pagina:\n  - ' + [...new Set(errores)].slice(0, 5).join('\n  - '));

// --- 1. ¿SE MUEVE? ---
console.log(repetidos ? `\n${repetidos} cuerpo(s) con cuadros repetidos: una parte no se mueve` : '\ntodos los cuerpos se mueven');

// --- 2. ¿SE MUEVE IGUAL QUE ANTES? ---
let cambiaron = 0;
if (ETIQUETA !== 'antes') {
  const ruta = join(HUELLAS, 'huella-antes.json');
  if (!existsSync(ruta)) {
    console.log('no hay huella "antes": corre primero con "antes".');
    process.exit(1);
  }
  const antes = new Map(JSON.parse(readFileSync(ruta, 'utf8')).map((x) => [x.cuerpo, x.hashes]));
  for (const { cuerpo, hashes } of huella) {
    const a = antes.get(cuerpo);
    const malos = INSTANTES.filter((_, i) => !a || a[i] !== hashes[i]);
    if (malos.length) {
      cambiaron++;
      console.log(`  CAMBIO ${cuerpo}: en ${malos.join(', ')} ms`);
    }
  }
  console.log(cambiaron ? `\n${cambiaron} de ${huella.length} cuerpos cambiaron` : `\nidentica a "antes" en los ${huella.length} cuerpos`);
}

process.exit(repetidos || cambiaron ? 1 : 0);
