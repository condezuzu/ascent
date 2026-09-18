// ¿QUÉ BLOQUEA EL HILO PRINCIPAL CUANDO MONTA EL MOTOR?
//
// La sonda de "Cómo se compara" midió el 18/9 que, cuando el motor monta
// durante una visita, la página deja de atender eventos entre 7 y 20 s (4 de
// 4), y que las marcas del propio motor no ven ese tiempo (4 ms de import,
// ~10 ms de shaders). Esto contesta QUÉ corre en ese lapso, sin suponer:
//
//   1. Un PERFIL DE CPU del hilo principal (CDP `Profiler`) desde que se entra
//      a la página hasta que el motor montó y la página volvió a atender. De
//      ahí sale el tiempo propio de cada función y la pila de la más cara.
//   2. Las TAREAS LARGAS que ve el navegador (`longtask`), con inicio y
//      duración, para ubicar el bloqueo en el tiempo.
//   3. QUÉ WEBGL tiene este navegador: por software (SwiftShader) o con GPU.
//      Es lo que decide si lo medido acá le pasa a un teléfono.
//
//   node --env-file=.env.local herramientas/perfilar-bloqueo.mjs [visitas] [--gpu]
//
// `--gpu` lanza Chromium pidiendo la GPU de la máquina en vez del WebGL por
// software. Si el bloqueo desaparece con `--gpu`, es del WebGL por software.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { cerrarPuerto, limpiarPuertosDeSondas, pasarLaEntrada, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'perfil-bloqueo');
mkdirSync(SALIDA, { recursive: true });
const VISITAS = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 3);
const CON_GPU = process.argv.includes('--gpu');
const RUTA = process.argv.find((a) => a.startsWith('--ruta='))?.split('=')[1] ?? '/ajustes';

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    s.listen(p, '0.0.0.0');
  });
limpiarPuertosDeSondas();
let PUERTO = 3097;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-perfil' };
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
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const nav = await chromium.launch({
  args: CON_GPU ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'] : [],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
// Las tareas largas, anotadas desde el primer instante de cada página.
await ctx.addInitScript(() => {
  window.__largas = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas.push({ desde: Math.round(e.startTime), dura: Math.round(e.duration) });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);

await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 60000 });
await pasarLaEntrada(page);
await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });

// QUÉ WEBGL HAY. `WEBGL_debug_renderer_info` dice el renderizador de verdad.
const webgl = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return 'sin webgl2';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
});
console.log(`\nWebGL de este navegador: ${webgl}${CON_GPU ? '  (lanzado con --gpu)' : ''}`);

/** Tiempo propio por función, a partir de las muestras del perfil. */
function resumir(perfil) {
  const porId = new Map(perfil.nodes.map((n) => [n.id, n]));
  const padre = new Map();
  for (const n of perfil.nodes) for (const h of n.children ?? []) padre.set(h, n.id);
  const propio = new Map();
  for (let i = 0; i < perfil.samples.length; i++) {
    const id = perfil.samples[i];
    const dt = (perfil.timeDeltas[i + 1] ?? 0) / 1000;
    propio.set(id, (propio.get(id) ?? 0) + dt);
  }
  const nombre = (n) => {
    const f = n.callFrame;
    const archivo = (f.url || '').split('/').pop().split('?')[0];
    return `${f.functionName || '(anónima)'} ${archivo ? archivo + ':' + (f.lineNumber + 1) : ''}`.trim();
  };
  // Agrupado por función (varios nodos pueden ser la misma función).
  const porFuncion = new Map();
  for (const [id, ms] of propio) {
    const k = nombre(porId.get(id));
    porFuncion.set(k, (porFuncion.get(k) ?? 0) + ms);
  }
  const top = [...porFuncion].sort((a, b) => b[1] - a[1]).slice(0, 15);
  // La pila del nodo más caro.
  const [idMax] = [...propio].sort((a, b) => b[1] - a[1])[0] ?? [];
  const pila = [];
  for (let id = idMax; id !== undefined; id = padre.get(id)) pila.push(nombre(porId.get(id)));
  const total = [...propio.values()].reduce((a, b) => a + b, 0);
  return { top, pila, total };
}

const informe = [];
for (let v = 1; v <= VISITAS; v++) {
  await page.goto(BASE + '/stats', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(500);

  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  await page.goto(BASE + RUTA, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Se espera a que el motor MONTE (la marca la pone el núcleo al terminar) y
  // después a que la página vuelva a atender: dos cuadros de animación.
  let montado = false;
  for (let i = 0; i < 120 && !montado; i++) {
    montado = await page.evaluate(() => performance.getEntriesByName('ascent:shader-fin').length > 0);
    if (!montado) await page.waitForTimeout(250);
  }
  const tMonto = Date.now() - t0;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const tLibre = Date.now() - t0;

  const { profile } = await cdp.send('Profiler.stop');
  const largas = await page.evaluate(() => window.__largas);
  const marcas = await page.evaluate(() =>
    performance
      .getEntriesByType('mark')
      .filter((e) => e.name.startsWith('ascent:'))
      .map((e) => `${e.name}@${Math.round(e.startTime)}`)
  );
  writeFileSync(join(SALIDA, `visita-${v}${CON_GPU ? '-gpu' : ''}.cpuprofile`), JSON.stringify(profile));

  const r = resumir(profile);
  informe.push({ visita: v, montado, tMonto, tLibre, largas, marcas, top: r.top, pila: r.pila });
  console.log(`\n=== visita ${v}: motor ${montado ? 'montó' : 'NO montó'} a los ${tMonto} ms; página libre a los ${tLibre} ms ===`);
  console.log(`tareas largas: ${largas.map((l) => `${l.desde}+${l.dura}`).join(', ') || '(ninguna)'}`);
  console.log(`marcas: ${marcas.join('  ')}`);
  console.log('tiempo propio por función (ms):');
  for (const [k, ms] of r.top.slice(0, 10)) console.log(`  ${String(Math.round(ms)).padStart(7)}  ${k}`);
  console.log('pila de lo más caro (de adentro hacia afuera):');
  for (const f of r.pila.slice(0, 14)) console.log(`    ${f}`);
}

writeFileSync(join(SALIDA, `informe${CON_GPU ? '-gpu' : ''}.json`), JSON.stringify({ webgl, informe }, null, 2));
await nav.close();
console.log(`\nperfiles en capturas/perfil-bloqueo/ (se abren en las DevTools de Chrome, pestaña Performance)`);
// SALIR A MANO. El servidor hijo mantiene vivo el proceso: sin esto la corrida
// junta sus datos y se queda colgada para siempre esperando un `exit` que no
// llega (18/9: dos horas así). `process.exit` dispara `cerrar`.
process.exit(0);
