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
//   node --env-file=.env.local herramientas/mirar-nativa.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas');
mkdirSync(SALIDA, { recursive: true });
const BASE = 'http://localhost:8090';

const vivo = await fetch(BASE).then(() => true).catch(() => false);
if (!vivo) {
  console.log('la nativa no esta prendida en :8090 (movil/dev-web.cmd)');
  process.exit(1);
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
// Para poder LEER el canvas sin pasar por la pantalla: ver `spec/trampas.md`,
// "Probar el motor". No cambia lo que se dibuja.
await ctx.addInitScript(() => {
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

// El fundido de entrada dura 900 ms: se espera a que termine para la foto.
await page.waitForTimeout(2500);
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
console.log(`canvas ${a.w}x${a.h}, ${Math.round(a.datos.length / 1024)} kB`);
console.log(`lectura 1: ${hash(a.datos)}   lectura 2 (1,5 s despues): ${hash(b.datos)}`);
console.log(a.datos === b.datos ? 'EL CANVAS NO CAMBIO: no se mueve' : 'el motor dibuja y se mueve');
const delMotor = avisos.filter((x) => /motor|three|webgl|gl/i.test(x));
console.log(delMotor.length ? '\navisos del motor:\n  - ' + delMotor.join('\n  - ') : '\nsin avisos del motor en consola');
console.log('fotos: capturas/nativa-inicio.png y capturas/nativa-canvas.png');

await nav.close();
process.exit(a.datos === b.datos ? 1 : 0);
