// ¿EL BLOQUEO DEL ARRANQUE ES THREE.JS?
//
// La medición de arranque deja el diagnóstico a un paso: los datos vuelven al
// segundo, la pantalla aparece a los siete, y en el medio hay una tarea de
// cuatro segundos y medio que bloquea el hilo principal. Falta saber QUÉ es
// esa tarea.
//
// El motor se descarta solo con sus propias marcas —importar 0 ms, partículas
// 1 ms, shaders 9 ms— pero eso mide MONTAR la escena, no EVALUAR el módulo.
// three.js son 484 kB de JavaScript que el navegador tiene que parsear y
// ejecutar antes de que ese `import()` resuelva, y ese trabajo no lo cubre
// ninguna marca.
//
// Este experimento corta los chunks de three.js y compara. La app aguanta sin
// él: el fondo tiene un respaldo en CSS puro. Si el arranque mejora, era eso.
// Si no mejora, hay que buscar en otro lado — y eso también es una respuesta.
//
//   node --env-file=.env.local supabase/medir-sin-motor.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    s.listen(p, '127.0.0.1');
  });
let PUERTO = 3029;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-arranque' };
console.log('  compilando…');
const c = spawnSync('npx', ['next', 'build'], {
  cwd: RAIZ, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: entorno, encoding: 'utf8',
});
if (c.status !== 0) { console.log('NO COMPILA:\n' + (c.stdout ?? '')); process.exit(1); }
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
  cwd: RAIZ, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: entorno,
});
const cerrar = () => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const ESPIA = `
  window.__listo = null;
  window.__largas = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  const mirar = () => {
    const n = document.querySelector('.racha-numero');
    if (n && /^[0-9]+$/.test((n.textContent || '').trim())) { window.__listo = performance.now(); return; }
    requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
`;

const nav = await chromium.launch();
const ctxLogin = await nav.newContext();
const pL = await ctxLogin.newPage();
await pL.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await pL.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await pL.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await pL.getByRole('button', { name: 'Entrar', exact: true }).click();
await pL.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });
const sesion = await ctxLogin.storageState();
await ctxLogin.close();

// Los chunks que contienen three.js, encontrados por su contenido y no por su
// nombre: el hash cambia en cada build.
const { readdirSync, readFileSync } = await import('node:fs');
const DIR = join(RAIZ, '.next-arranque', 'static', 'chunks');
const DEL_MOTOR = readdirSync(DIR).filter(
  (n) => n.endsWith('.js') && /WebGLRenderer|THREE\.REVISION/.test(readFileSync(join(DIR, n), 'utf8'))
);
console.log(`  chunks de three.js: ${DEL_MOTOR.join(', ') || 'ninguno'}\n`);

async function medir(sinMotor) {
  const ctx = await nav.newContext({ storageState: sesion, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(ESPIA);
  if (sinMotor) {
    await page.route('**/*.js', (ruta) => {
      const u = ruta.request().url();
      return DEL_MOTOR.some((n) => u.includes(n)) ? ruta.abort() : ruta.continue();
    });
  }
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__listo !== null, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => ({
    racha: window.__listo === null ? null : Math.round(window.__listo),
    largas: window.__largas.length,
    sumaLargas: window.__largas.reduce((s, [, d]) => s + d, 0),
    peor: window.__largas.length ? Math.max(...window.__largas.map(([, d]) => d)) : 0,
    kbJs: Math.round(
      performance.getEntriesByType('resource')
        .filter((x) => x.name.includes('/_next/static/chunks/'))
        .reduce((s, x) => s + (x.transferSize || 0), 0) / 1024
    ),
  }));
  await ctx.close();
  return r;
}

// Tres vueltas de cada uno: una sola medición de algo que depende del hilo
// principal es una anécdota. Se informa la MEDIANA, que no la mueve un pico.
const mediana = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
const vueltas = async (sinMotor) => {
  const l = [];
  for (let i = 0; i < 3; i++) l.push(await medir(sinMotor));
  return {
    racha: mediana(l.map((x) => x.racha ?? 99999)),
    largas: mediana(l.map((x) => x.largas)),
    suma: mediana(l.map((x) => x.sumaLargas)),
    peor: mediana(l.map((x) => x.peor)),
    kb: mediana(l.map((x) => x.kbJs)),
  };
};

const con = await vueltas(false);
const sin = await vueltas(true);

console.log('                        con motor    sin motor    diferencia');
const linea = (n, a, b, u = 'ms') =>
  console.log(`  ${n.padEnd(20)} ${String(a).padStart(9)} ${String(b).padStart(12)} ${String(a - b).padStart(13)} ${u}`);
linea('racha en pantalla', con.racha, sin.racha);
linea('tareas largas', con.largas, sin.largas, '');
linea('suman', con.suma, sin.suma);
linea('la peor', con.peor, sin.peor);
linea('javascript', con.kb, sin.kb, 'kB');

await nav.close();
cerrar();
process.exit(0);
