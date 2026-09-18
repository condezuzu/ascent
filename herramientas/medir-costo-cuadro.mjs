// ¿CUÁNTO CUESTA DIBUJAR UN CUADRO DE CADA CUERPO? Con GPU de verdad.
//
// Nació el 18/9 con el arreglo de los shaders: para que Direct3D no tarde
// minutos en compilar, los bucles de ruido pasaron a tener un límite que el
// compilador no conoce (`5 + uCero`), y un bucle que no se desenrolla puede
// correr más lento. Esto mide si el planeta —o cualquier cuerpo— pierde fps.
//
// CÓMO MIDE. Contar cuadros por segundo no sirve en una GPU buena: da 60
// siempre, porque el tope es la pantalla. Acá se mide el COSTO de cada
// cuadro: desde que el motor empieza a dibujar hasta que la GPU terminó
// (leer un píxel después del callback de `requestAnimationFrame`: obliga a
// esperar el dibujo; `gl.finish()` en Chrome no espera). Y en una
// pantalla grande (1920x1080 a 2x), para que la GPU trabaje de verdad.
// `requestAnimationFrame` NO se reemplaza —eso desconecta WebGL, ver
// spec/trampas.md—: solo se envuelve cada callback.
//
//   node herramientas/medir-costo-cuadro.mjs [etiqueta]
//
// Guarda `capturas/costo-cuadro/<etiqueta>.json`; si hay uno "antes", compara.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cerrarPuerto, limpiarPuertosDeSondas, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from '../supabase/utiles.mjs';
import { RANGOS } from '../nucleo/rangos.ts';

// Ninguna sonda corre sin limite (ver utiles.mjs). El "antes" compila el
// shader viejo, que con Direct3D tarda más de dos minutos.
limiteDeSonda(25);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'costo-cuadro');
mkdirSync(SALIDA, { recursive: true });
const ETIQUETA = process.argv[2] ?? 'antes';
const NOMBRE_R4 = RANGOS.find((r) => r.n === 4).nombre;
const CUERPOS = [
  { nombre: 'rango 4 · Júpiter' },
  ...['Tierra', 'Marte'].map((p) => ({ nombre: `rango 4 · ${p}`, planeta: p })),
  ...RANGOS.filter((r) => r.n !== 4).map((r) => ({ nombre: `rango ${r.n} · ${r.nombre}`, rango: r.nombre })),
];

limpiarPuertosDeSondas();
const PUERTO = 3093;
const BASE = `http://localhost:${PUERTO}`;
const entorno = { ...process.env, NEXT_DIST_DIR: '.next-costo' };
console.log('compilando…');
const b = spawnSync('npx', ['next', 'build'], { timeout: LIMITE_DE_COMPILACION_MS, cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (b.status !== 0) {
  console.log('NO COMPILA:\n' + (b.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
process.on('exit', () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
  cerrarPuerto(PUERTO);
});
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/galeria', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const nav = await chromium.launch({
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'],
});
const ctx = await nav.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  const contextos = [];
  const pixel = new Uint8Array(4);
  const getCtx = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...a) {
    const c = getCtx.apply(this, a);
    if (c && /webgl/.test(String(a[0])) && !contextos.includes(c)) contextos.push(c);
    return c;
  };
  window.__costos = [];
  window.__medir = false;
  window.__dibujos = 0;
  for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) for (const f of ['drawArrays', 'drawElements']) { const o = C.prototype[f]; C.prototype[f] = function (...a) { if (window.__medir) window.__dibujos++; return o.apply(this, a); }; }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) =>
    raf((t) => {
      const t0 = performance.now();
      fn(t);
      if (!window.__medir) return;
      // `finish()` en Chrome vuelve sin esperar a la GPU (medido: 0,1-0,2 ms en
      // 4K para todos los cuerpos). Leer un píxel sí obliga a esperar el dibujo.
      for (const c of contextos) if (!c.isContextLost()) c.readPixels(0, 0, 1, 1, c.RGBA, c.UNSIGNED_BYTE, pixel);
      window.__costos.push(performance.now() - t0);
    });
});
const page = await ctx.newPage();
await page.goto(BASE + '/galeria', { waitUntil: 'domcontentloaded' });
const nombreGpu = await page.evaluate(() => {
  const g = document.createElement('canvas').getContext('webgl2');
  const e = g?.getExtension('WEBGL_debug_renderer_info');
  return g ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'sin webgl2';
});
console.log(`WebGL: ${nombreGpu} | 1920x1080 a 2x`);

const esperarDibujo = () =>
  page.waitForFunction(() => performance.getEntriesByName('ascent:shader-fin').length > 0, null, { timeout: 600000, polling: 500 });
await esperarDibujo();

const res = {};
for (const c of CUERPOS) {
  const antes = await page.evaluate(() => performance.getEntriesByName('ascent:shader-fin').length);
  if (c.rango) await page.getByRole('button', { name: c.rango, exact: true }).click();
  if (c.planeta) {
    await page.getByRole('button', { name: NOMBRE_R4, exact: true }).click();
    await page.getByRole('button', { name: c.planeta, exact: true }).click();
  }
  if (c.rango || c.planeta)
    await page.waitForFunction((n) => performance.getEntriesByName('ascent:shader-fin').length > n, antes, { timeout: 600000, polling: 500 });
  // Despierto todo el rato: el motor baja de escalón si nadie toca, y ahí
  // mediría cuadros que no dibuja.
  const tocar = setInterval(() => page.mouse.move(400 + Math.random() * 50, 400).catch(() => {}), 150);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__costos = [];
    window.__dibujos = 0;
    window.__medir = true;
  });
  await page.waitForTimeout(4000);
  const { costos, dibujos, lienzos } = await page.evaluate(() => {
    window.__medir = false;
    return { costos: window.__costos, dibujos: window.__dibujos, lienzos: [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`).join(',') };
  });
  clearInterval(tocar);
  const orden = [...costos].sort((a, b) => a - b);
  const mediana = orden[Math.floor(orden.length / 2)] ?? NaN;
  const p90 = orden[Math.floor(orden.length * 0.9)] ?? NaN;
  res[c.nombre] = { mediana: +mediana.toFixed(2), p90: +p90.toFixed(2), cuadros: costos.length };
  console.log(`  ${c.nombre.padEnd(22)} mediana ${mediana.toFixed(2).padStart(6)} ms  p90 ${p90.toFixed(2).padStart(6)} ms  (${costos.length} cuadros, ${(dibujos / Math.max(1, costos.length)).toFixed(1)} dibujos/cuadro, canvas ${lienzos})`);
}
writeFileSync(join(SALIDA, `${ETIQUETA}.json`), JSON.stringify({ gpu: nombreGpu, res }, null, 2));

const rutaAntes = join(SALIDA, 'antes.json');
if (ETIQUETA !== 'antes' && existsSync(rutaAntes)) {
  const a = JSON.parse(readFileSync(rutaAntes, 'utf8')).res;
  console.log(`\ncontra "antes" (mediana; + es más lento):`);
  for (const [k, v] of Object.entries(res)) {
    const x = a[k];
    if (!x) continue;
    const pct = ((v.mediana - x.mediana) / x.mediana) * 100;
    console.log(`  ${k.padEnd(22)} ${x.mediana.toFixed(2).padStart(6)} → ${v.mediana.toFixed(2).padStart(6)} ms  (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%)`);
  }
}
await nav.close();
process.exit(0);
