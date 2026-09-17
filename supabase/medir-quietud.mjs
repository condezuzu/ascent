// ¿DE VERDAD DEJA DE DIBUJAR CUANDO NO HAY NADIE?
//
// `lib/quietud.ts` tiene la decisión de cada cuadro y está probada con
// números. Pero que la aritmética sea correcta no prueba que el motor la esté
// usando: el bucle podría no llamarla, o algo podría estar despertándolo solo.
// Esto lo mira en un navegador de verdad.
//
// CÓMO SE MIDE. No se cuentan cuadros del navegador —eso cuenta lo que pide el
// compositor, no lo que dibuja el motor— sino LLAMADAS DE DIBUJO a WebGL:
// `drawArrays` y `drawElements`, interceptadas antes de que cargue la página.
// Es el trabajo que se le pide a la GPU, que es exactamente lo que se quiere
// bajar.
//
// LOS TRES ESCALONES, mirados de a uno:
//   VIVO   — recién tocado. Tiene que dibujar todo el tiempo.
//   LENTO  — pasados los tres segundos. Tiene que bajar a unos doce por segundo.
//   QUIETO — pasado el minuto. Tiene que ser CERO.
//   Y DESPERTAR — un toque y vuelve arriba en el acto.
//
// Tarda un minuto y pico a propósito: el escalón de quieto no se puede ver
// más rápido sin mentirle al reloj.
//
// LOS NÚMEROS ABSOLUTOS DE ACÁ NO SON UN TELÉFONO. Chrome sin ventana dibuja
// WebGL por software (SwiftShader) y le da cuadros al rAF con cuentagotas:
// ni siquiera el escalón de arriba llega a sesenta por segundo. Por eso lo
// que se verifica acá son RELACIONES —que lento sea bastante menos que vivo,
// que quieto sea exactamente cero, que un toque lo resucite— y no valores.
// Las relaciones sí se sostienen en cualquier máquina; los valores no.
//
//   node --env-file=.env.local supabase/medir-quietud.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { pasarLaEntrada } from './utiles.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    // SE ESCUCHA EN 0.0.0.0, NO EN 127.0.0.1, y esa diferencia costo cinco
    // corridas. `next start` se ata a 0.0.0.0; en Windows, atarse a
    // 127.0.0.1 cuando otro proceso ya tiene 0.0.0.0 PUEDE funcionar, asi
    // que este chequeo decia "libre" sobre un puerto ocupado.
    //
    // Lo que pasaba despues: `next start` no podia atarse y moria en
    // silencio (stdio ignorado), y la sonda terminaba hablando con un
    // servidor HUERFANO de una corrida anterior, que servia un build viejo
    // con chunks que ya no existian. La pagina quedaba en blanco.
    s.listen(p, '0.0.0.0');
  });
let PUERTO = 3041;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-quietud' };
console.log('compilando…');
const build = spawnSync('npx', ['next', 'build'], { cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('NO COMPILA:\n' + (build.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
const cerrar = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

// El espía va ANTES de que cargue nada, para agarrar el contexto en cuanto
// three.js lo crea.
const ESPIA = () => {
  window.__dibujos = 0;
  for (const proto of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
    if (!proto) continue;
    for (const m of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const orig = proto[m];
      if (!orig) continue;
      proto[m] = function (...args) {
        window.__dibujos++;
        return orig.apply(this, args);
      };
    }
  }
};

const nav = await chromium.launch();
const ctxLogin = await nav.newContext();
const pLogin = await ctxLogin.newPage();
await pLogin.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await pasarLaEntrada(pLogin);
await pLogin.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await pLogin.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await pLogin.getByRole('button', { name: 'Entrar', exact: true }).click();
await pLogin.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });
await pLogin.waitForTimeout(3000);
const sesion = await ctxLogin.storageState();
await ctxLogin.close();

const ctx = await nav.newContext({ storageState: sesion, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(ESPIA);
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
// Se espera a que el motor esté montado: antes de eso no hay nada que contar.
await page
  .waitForFunction(() => window.__dibujos > 0, null, { timeout: 90000 })
  .catch(() => console.log('  (el motor no dibujó nunca: ¿fondo apagado?)'));

// Una ventana de medición: cuántos dibujos por segundo en este rato.
async function ventana(etiqueta, ms, { tocarAntes = false, seguirTocando = false } = {}) {
  if (tocarAntes) await page.mouse.move(195, 700);
  const a = await page.evaluate(() => window.__dibujos);
  const t0 = Date.now();
  // Para medir el escalon de arriba hay que SEGUIR tocando: si no, a los tres
  // segundos baja solo y la ventana mide una mezcla de los dos. La primera
  // version de esto media 2,5 s que tardaban 6,9 s de reloj y daba un numero
  // que no era ni un escalon ni el otro.
  if (seguirTocando) {
    while (Date.now() - t0 < ms) {
      await page.mouse.move(195, 700 + (Date.now() % 2));
      await page.waitForTimeout(250);
    }
  } else {
    await page.waitForTimeout(ms);
  }
  const b = await page.evaluate(() => window.__dibujos);
  const seg = (Date.now() - t0) / 1000;
  const porSeg = (b - a) / seg;
  console.log(`  ${etiqueta.padEnd(34)} ${porSeg.toFixed(1).padStart(6)} dibujos/s   (${b - a} en ${seg.toFixed(1)} s)`);
  return porSeg;
}

console.log('\n================ los tres escalones ================');
// El toque reinicia el reloj de quietud: la ventana que sigue es el escalón de
// arriba entero.
const vivo = await ventana('VIVO (tocando todo el tiempo)', 4000, { seguirTocando: true });
// Ya pasaron mas de tres segundos sin tocar.
const lento = await ventana('LENTO (pasados los 3 s)', 6000);
console.log('  … esperando a que se cumpla el minuto sin tocar …');
await page.waitForTimeout(56000);
const quieto = await ventana('QUIETO (pasado el minuto)', 5000);
const despierto = await ventana('DESPERTADO (un toque)', 4000, { seguirTocando: true });

console.log('\n================ veredicto ================');
const bien = [];
const mal = [];
const juzgar = (ok, texto) => (ok ? bien : mal).push(texto);

juzgar(vivo > 0, `vivo dibuja (${vivo.toFixed(1)}/s)`);
juzgar(lento > 0, `lento sigue dibujando, no se congela (${lento.toFixed(1)}/s)`);
juzgar(lento < vivo * 0.6, `lento dibuja bastante menos que vivo`);
juzgar(quieto === 0, `quieto no dibuja NADA (${quieto.toFixed(1)}/s)`);
juzgar(despierto > 0, `un toque lo resucita desde cero (${despierto.toFixed(1)}/s)`);
juzgar(despierto > lento, `y lo devuelve al escalon de arriba`);

for (const b of bien) console.log('  ok   ' + b);
for (const m of mal) console.log('  MAL  ' + m);

if (vivo > 0) {
  const ahorroLento = (1 - lento / vivo) * 100;
  console.log(`\n  En el escalón del medio se dibuja ${ahorroLento.toFixed(0)}% menos.`);
  console.log(`  Quieto, el 100%: el motor deja de pedirle trabajo a la GPU.`);
}

await nav.close();
process.exit(mal.length ? 1 : 0);
