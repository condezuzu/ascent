// LA PRIMERA VISITA, CON GPU Y CHROME DE WINDOWS. El peor caso del motor.
//
// El 18/9 se midió que compilar el shader de cuerpos con Direct3D (lo que usa
// Chrome en Windows) bloqueaba el hilo 134-140 s. La caché de shaders se
// invalida en cada deploy, así que no es "una vez por persona": es una vez por
// persona POR VERSIÓN. Y lo primero que ve alguien nuevo es la bienvenida y
// después el login.
//
// Esto recorre ese camino como una persona —cada paso de la bienvenida con su
// tiempo, la cuarta pantalla entera sin saltarla, "Ya tengo cuenta"— y por
// tramo anota:
//   - cada compilación/link de shader que tarde más de 50 ms, con su tamaño;
//   - las tareas largas (lo que la persona siente como página trabada);
//   - cuánto tarda el login en aceptar lo que se escribe.
//
//   node herramientas/medir-bienvenida.mjs [--chromium]
//
// Por defecto usa el Chrome instalado (con perfil nuevo: sin caché de
// shaders, como el primer día de cada versión). `--chromium` usa el de
// Playwright.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { cerrarPuerto, limpiarPuertosDeSondas, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = '.next-perfil';
const entorno = { ...process.env, NEXT_DIST_DIR: DIST };
limpiarPuertosDeSondas();
const PUERTO = 3094;
const BASE = `http://localhost:${PUERTO}`;

if (process.argv.includes('--compilar') || !existsSync(join(RAIZ, DIST, 'BUILD_ID'))) {
  console.log('compilando…');
  const b = spawnSync('npx', ['next', 'build'], { timeout: LIMITE_DE_COMPILACION_MS, cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
  if (b.status !== 0) {
    console.log('NO COMPILA:\n' + (b.stdout ?? '').slice(-2500));
    process.exit(1);
  }
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
process.on('exit', () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
  cerrarPuerto(PUERTO);
});
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const GPU = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'];
const conChrome = !process.argv.includes('--chromium');
const nav = await chromium.launch({ args: GPU, ...(conChrome ? { channel: 'chrome' } : {}) });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  window.__largas = [];
  window.__gl = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  // Lo que tarda cada llamada de WebGL que espera al compilador. Se mide en
  // las que bloquean de verdad: el link no espera, preguntar por el estado sí.
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const pr = C.prototype;
    const fuentes = new WeakMap();
    const deProg = new WeakMap();
    const ss = pr.shaderSource;
    pr.shaderSource = function (sh, src) {
      fuentes.set(sh, src);
      return ss.call(this, sh, src);
    };
    const at = pr.attachShader;
    pr.attachShader = function (p, sh) {
      (deProg.get(p) ?? deProg.set(p, []).get(p)).push(fuentes.get(sh) ?? '');
      return at.call(this, p, sh);
    };
    for (const f of ['getProgramParameter', 'getProgramInfoLog', 'getShaderParameter', 'getShaderInfoLog', 'linkProgram', 'compileShader']) {
      const orig = pr[f];
      pr[f] = function (...a) {
        const t = performance.now();
        const r = orig.apply(this, a);
        const d = performance.now() - t;
        if (d > 50) {
          const tam = (deProg.get(a[0]) ?? []).map((s) => s.length).join('+');
          window.__gl.push([Math.round(t), Math.round(d), f, tam]);
        }
        return r;
      };
    }
  }
});
const page = await ctx.newPage();
const version = nav.version();
const renderer = await page.evaluate(() => {
  const g = document.createElement('canvas').getContext('webgl2');
  const e = g?.getExtension('WEBGL_debug_renderer_info');
  return g ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'sin webgl2';
});
console.log(`${conChrome ? 'Chrome instalado' : 'Chromium de Playwright'} ${version} | ${renderer}`);

// Un cuadro, con tope: si la página no pinta, se dice cuánto no pintó.
const unCuadro = (tope) =>
  Promise.race([
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r('ok')))),
    new Promise((r) => setTimeout(() => r('NO PINTÓ'), tope)),
  ]);
const ahora = () => page.evaluate(() => Math.round(performance.now()));
const tramos = [];
let desde = 0;
async function cerrarTramo(nombre) {
  const hasta = await ahora();
  const largas = (await page.evaluate(() => window.__largas)).filter(([t]) => t >= desde && t < hasta);
  const gl = (await page.evaluate(() => window.__gl)).filter(([t]) => t >= desde && t < hasta);
  const peor = largas.reduce((m, [, d]) => Math.max(m, d), 0);
  const suma = largas.reduce((m, [, d]) => m + d, 0);
  tramos.push({ nombre, dura: hasta - desde, peor, suma, gl });
  console.log(
    `${nombre.padEnd(34)} ${String(hasta - desde).padStart(7)} ms | tareas largas: ${largas.length}, la peor ${peor} ms, suman ${suma} ms` +
      (gl.length ? `\n${gl.map(([t, d, f, tam]) => `      shader: ${d} ms en ${f} (fuentes ${tam} chars) a los ${t} ms`).join('\n')}` : '')
  );
  desde = hasta;
}

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.bienv', { timeout: 30000 });
await cerrarTramo('carga + primera pantalla');
for (let i = 1; i <= 3; i++) {
  // Una persona lee: dos segundos por pantalla.
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Siguiente' }).click({ timeout: 30000 });
  if (i < 3) await cerrarTramo(`pantalla ${i + 1}`);
}
// LA CUARTA, ENTERA: sin tocar para saltarla. Termina sola en "Ya tengo cuenta".
const tCuarta = Date.now();
await page.getByRole('button', { name: 'Ya tengo cuenta' }).waitFor({ state: 'visible', timeout: 60000 });
console.log(`  (la cuarta terminó sola a los ${Date.now() - tCuarta} ms)`);
await cerrarTramo('cuarta pantalla (animación entera)');
await page.waitForTimeout(1500);
await cerrarTramo('pantalla final de la bienvenida');

await page.getByRole('button', { name: 'Ya tengo cuenta' }).click({ timeout: 30000 });
const tLogin = Date.now();
await page.locator('input[type=email]').waitFor({ state: 'visible', timeout: 30000 });
// Se intenta escribir cada 2 s, como alguien que toca el campo y no pasa nada.
let escribio = false;
while (!escribio && Date.now() - tLogin < 240000) {
  const r = await unCuadro(2000);
  if (r === 'ok') {
    escribio = await page.locator('input[type=email]').fill('prueba@ejemplo.com', { timeout: 2000 }).then(() => true, () => false);
  }
  if (!escribio) await page.waitForTimeout(500);
}
// Unos segundos más: el motor monta después del piso de 2 s.
await page.waitForTimeout(6000);
const r = await unCuadro(240000);
console.log(`  (el login ${escribio ? 'aceptó texto' : 'NO aceptó texto'} a los ${Date.now() - tLogin - 6000} ms; último cuadro: ${r})`);
await cerrarTramo('login (hasta el motor montado)');
const marcas = await page.evaluate(() =>
  performance
    .getEntriesByType('mark')
    .filter((e) => e.name.startsWith('ascent:'))
    .map((e) => `${e.name.replace('ascent:', '')}@${Math.round(e.startTime)}`)
    .join('  ')
);
console.log(`marcas: ${marcas || '(ninguna)'}`);
const total = tramos.reduce((m, t) => m + t.suma, 0);
console.log(`\nTOTAL de hilo bloqueado en el recorrido: ${total} ms; la peor tarea: ${Math.max(...tramos.map((t) => t.peor))} ms`);
await nav.close();
process.exit(0);
