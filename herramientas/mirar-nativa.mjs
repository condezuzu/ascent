// ¿EL MOTOR DIBUJA EN LA APP NATIVA? Mirado en el navegador, a :8090.
//
// `expo-gl` tiene versión web: a :8090 el mismo `FondoEspacial` nativo corre
// sobre un canvas de verdad. Esto entra con la cuenta de prueba, espera el
// canvas del motor, saca la foto de Inicio, y lee el canvas dos veces con un
// segundo y medio de diferencia: si las dos lecturas difieren, el motor
// DIBUJA y además SE MUEVE. Junta los errores de consola, en particular el
// aviso de "No se pudo montar el motor".
//
// LO QUE NO PRUEBA, y hay que decirlo cada vez que se use: nada de lo que
// solo pasa en un iPhone. El WebGL de acá es el del navegador, no el de
// `expo-gl` nativo; el fps es el de esta computadora; y no hay app que se vaya
// al fondo y vuelva. Ver `movil/src/motorNativo.ts`.
//
// Necesita la nativa prendida en :8090 (movil/dev-web.cmd), como `test:real`.
//
//   node --env-file=.env.local herramientas/mirar-nativa.mjs [--escala=3]
//
// `--escala` es la densidad del aparato simulado (2 por omisión). Con 3, que es
// la de un iPhone, se comprueba además que el buffer del motor quedó topado en
// 2x como en la web.
//
// `--vueltas` además va a Stats y vuelve a Inicio dos veces, y cuenta cuántos
// shaders se compilan en cada vuelta. Inicio es la pantalla que más se abre:
// recompilar cada vez es el mismo problema que el arranque de 3 s de la web.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { limiteDeSonda } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas');
mkdirSync(SALIDA, { recursive: true });
const BASE = 'http://localhost:8090';
const VUELTAS = process.argv.includes('--vueltas');
// `--pantalla=Ranking` toca esa pestaña después de Inicio, espera y saca su
// foto en `capturas/nativa-<pantalla>.png`, con los errores de consola.
const PANTALLA = (process.argv.find((a) => a.startsWith('--pantalla=')) ?? '').split('=')[1] ?? '';
// `--bajar=N` baja N px el scroll de la pantalla antes de la foto. Las
// pantallas nativas desplazan un ScrollView propio, no la página: sin esto la
// foto corta en lo primero que entra.
const BAJAR = Number((process.argv.find((a) => a.startsWith('--bajar=')) ?? '--bajar=0').split('=')[1]);
const ESCALA = Number((process.argv.find((a) => a.startsWith('--escala=')) ?? '--escala=2').split('=')[1]);

const vivo = await fetch(BASE).then(() => true).catch(() => false);
if (!vivo) {
  console.log('la nativa no esta prendida en :8090 (movil/dev-web.cmd)');
  process.exit(1);
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: ESCALA });
// Para poder LEER el canvas sin pasar por la pantalla: ver `spec/trampas.md`,
// "Probar el motor". No cambia lo que se dibuja.
await ctx.addInitScript(() => {
  // CUÁNTO SE COMPILA: cada shader y cada programa que arma three pasa por
  // estas dos. Es lo que cuesta de verdad al montar una escena.
  window.__compilados = { shaders: 0, programas: 0 };
  for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!P) continue;
    const cs = P.prototype.compileShader;
    P.prototype.compileShader = function (...a) {
      window.__compilados.shaders++;
      return cs.apply(this, a);
    };
    const lp = P.prototype.linkProgram;
    P.prototype.linkProgram = function (...a) {
      window.__compilados.programas++;
      return lp.apply(this, a);
    };
  }
  const getCtx = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (tipo, opciones, ...resto) {
    if (/webgl/.test(String(tipo))) opciones = { ...(opciones ?? {}), preserveDrawingBuffer: true };
    return getCtx.call(this, tipo, opciones, ...resto);
  };
});
const page = await ctx.newPage();
const avisos = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') avisos.push(`${m.type()}: ${m.text().slice(0, 220)}`);
});
page.on('pageerror', (e) => avisos.push(`excepcion: ${String(e).slice(0, 220)}`));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 240000 });
await page.locator('input[type=email], input[inputmode=email], input[autocomplete=email]').first().fill(process.env.CONEXION_EMAIL);
await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });

let hayCanvas = false;
for (let i = 0; i < 60 && !hayCanvas; i++) {
  await page.waitForTimeout(1000);
  hayCanvas = (await page.locator('canvas').count()) > 0;
}
if (!hayCanvas) {
  await page.screenshot({ path: join(SALIDA, 'nativa-inicio.png') });
  console.log('NO APARECIO EL CANVAS DEL MOTOR (foto en capturas/nativa-inicio.png)');
  console.log(avisos.length ? '  - ' + avisos.slice(0, 8).join('\n  - ') : '  (sin errores en consola)');
  await nav.close();
  process.exit(1);
}

// EL AVISO DE VIDAS tapa la pantalla entera si la cuenta usó alguna. Se
// cierra con "Entendido", que solo marca la vida como vista en el
// almacenamiento de ESTE navegador —uno nuevo en cada corrida—: no toca nada
// de la cuenta.
const entendido = page.getByText('Entendido', { exact: true }).last();
if (await entendido.isVisible().catch(() => false)) await entendido.click();

// SE ESPERA AL MOTOR, NO UN RATO FIJO. El canvas aparece antes que la escena:
// desde que el motor vive en la raíz (18/9) entre el `GLView` y el primer
// cuadro hay un `import`, el renderer y el montaje. Con una espera fija, a
// veces las dos lecturas caían antes de que hubiera escena, daban el mismo
// canvas vacío, y la sonda decía "no se mueve" de un motor que todavía no
// había arrancado. `ascent:shader-fin` la pone el núcleo al terminar de montar.
let montado = false;
for (let i = 0; i < 40 && !montado; i++) {
  montado = await page.evaluate(() => performance.getEntriesByName('ascent:shader-fin').length > 0);
  if (!montado) await page.waitForTimeout(500);
}
if (!montado) console.log('EL MOTOR NO TERMINO DE MONTAR en 20 s');
// El fundido de entrada dura 900 ms: se espera a que termine para la foto.
await page.waitForTimeout(1200);
await page.screenshot({ path: join(SALIDA, 'nativa-inicio.png') });

const leer = () =>
  page.evaluate(() => {
    const c = document.querySelector('canvas');
    return c ? { w: c.width, h: c.height, datos: c.toDataURL() } : null;
  });
const hash = (x) => createHash('md5').update(x).digest('hex').slice(0, 8);
const a = await leer();
// El canvas solo, sin velo ni interfaz: lo que dibujó el motor y nada más.
writeFileSync(join(SALIDA, 'nativa-canvas.png'), Buffer.from(a.datos.split(',')[1], 'base64'));
await page.waitForTimeout(1500);
const b = await leer();

// Un canvas "dibujado" pero vacío pesa muy poco: es todo transparente. Un
// PNG con estrellas y un cuerpo pesa decenas de kB.
// EL TOPE: el buffer no puede pasar de 2 píxeles físicos por punto. Se mide
// contra el ancho de la pantalla, no contra el del canvas, que está achicado.
const densidadDelBuffer = a.w / 390;
console.log(`canvas ${a.w}x${a.h}, ${Math.round(a.datos.length / 1024)} kB, aparato a ${ESCALA}x`);
console.log(
  densidadDelBuffer <= 2.01
    ? `buffer a ${densidadDelBuffer.toFixed(2)}x: dentro del tope de 2x`
    : `BUFFER A ${densidadDelBuffer.toFixed(2)}x: PASA EL TOPE DE 2X`
);
console.log(
  `lectura 1: ${hash(a.datos)} (${Math.round(a.datos.length / 1024)} kB)   ` +
    `lectura 2 (1,5 s despues): ${hash(b.datos)} (${Math.round(b.datos.length / 1024)} kB)`
);
console.log(a.datos === b.datos ? 'EL CANVAS NO CAMBIO: no se mueve' : 'el motor dibuja y se mueve');
const delMotor = avisos.filter((x) => /motor|three|webgl|gl/i.test(x));
console.log(delMotor.length ? '\navisos del motor:\n  - ' + delMotor.join('\n  - ') : '\nsin avisos del motor en consola');
console.log('fotos: capturas/nativa-inicio.png y capturas/nativa-canvas.png');

let recompila = false;
if (VUELTAS) {
  const compilados = () => page.evaluate(() => ({ ...window.__compilados }));
  const antes = await compilados();
  console.log(`
al entrar: ${antes.shaders} shaders, ${antes.programas} programas`);
  for (let v = 1; v <= 2; v++) {
    await page.getByText('Stats', { exact: true }).last().click();
    await page.waitForTimeout(2500);
    const desde = await compilados();
    await page.getByText('Inicio', { exact: true }).last().click();
    // Lo que tarde el motor en volver: la espera de interacciones + el montaje.
    await page.waitForTimeout(5000);
    const hasta = await compilados();
    const s = hasta.shaders - desde.shaders;
    const pr = hasta.programas - desde.programas;
    if (s > 0 || pr > 0) recompila = true;
    const x = await leer();
    await page.waitForTimeout(1500);
    const y = await leer();
    console.log(
      `vuelta ${v} a Inicio: ${s} shaders y ${pr} programas compilados; ` +
        (x && y && x.datos !== y.datos ? 'dibuja y se mueve' : 'EL MOTOR NO SE MUEVE AL VOLVER')
    );
    if (!x || !y || x.datos === y.datos) recompila = true;
  }
}

let pantallaMal = false;
if (PANTALLA) {
  const antes = avisos.length;
  await page.getByText(PANTALLA, { exact: true }).last().click();
  await page.waitForTimeout(6000);
  if (BAJAR) {
    // El que más scroll tiene es el de la pantalla que está a la vista.
    await page.evaluate((px) => {
      const conScroll = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 20 && getComputedStyle(d).overflowY !== 'visible' && d.offsetParent !== null);
      conScroll.sort((a, b) => b.scrollHeight - a.scrollHeight);
      if (conScroll[0]) conScroll[0].scrollTop = px;
    }, BAJAR);
    await page.waitForTimeout(800);
  }
  const archivo = `nativa-${PANTALLA.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}${BAJAR ? '-' + BAJAR : ''}.png`;
  await page.screenshot({ path: join(SALIDA, archivo), fullPage: true });
  const nuevos = avisos.slice(antes).filter((x) => !/GPU stall/.test(x));
  const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 1500));
  console.log('');
  console.log(`${PANTALLA}: foto en capturas/${archivo}`);
  console.log(`  se lee: ${texto}`);
  if (nuevos.length) {
    console.log('  AVISOS:');
    for (const x of nuevos) console.log(`    - ${x}`);
  } else console.log('  sin avisos en consola');
  pantallaMal = nuevos.some((x) => /^(error|excepcion)/.test(x));
}

await nav.close();
process.exit(a.datos === b.datos || densidadDelBuffer > 2.01 || recompila || pantallaMal ? 1 : 0);
