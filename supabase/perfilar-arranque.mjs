// ¿QUÉ FUNCIÓN SE COME EL PROCESADOR AL ARRANCAR?
//
// `medir-arranque` dice CUÁNTO tarda y `medir-sin-motor` dice que tres
// segundos son three.js. Queda una tarea larga de dos segundos y medio que
// sobrevive a cortar el motor, y "casi no se siente porque pasa después" no es
// una respuesta: son dos segundos y medio de procesador que alguien está
// pagando.
//
// Esto usa el perfilador de V8 por CDP —el mismo que hay detrás de la pestaña
// Performance— y suma el tiempo PROPIO de cada función: no el acumulado de
// ella y todo lo que llama, sino lo que se ejecutó adentro de ella misma. Es
// la diferencia entre "React tarda tres segundos" (verdadero e inútil) y
// "esta función tarda tres segundos" (accionable).
//
//   node --env-file=.env.local supabase/perfilar-arranque.mjs
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
let PUERTO = 3030;
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

const { readdirSync, readFileSync } = await import('node:fs');
const DIR = join(RAIZ, '.next-arranque', 'static', 'chunks');
const DEL_MOTOR = readdirSync(DIR).filter(
  (n) => n.endsWith('.js') && /WebGLRenderer|THREE\.REVISION/.test(readFileSync(join(DIR, n), 'utf8'))
);

async function perfilar(sinMotor) {
  const ctx = await nav.newContext({ storageState: sesion, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  if (sinMotor) {
    await page.route('**/*.js', (r) =>
      DEL_MOTOR.some((n) => r.request().url().includes(n)) ? r.abort() : r.continue()
    );
  }
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Profiler.enable');
  // Un microsegundo entre muestras: el arranque dura pocos segundos y hace
  // falta resolución para separar funciones cortas que se llaman mucho.
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const { profile } = await cdp.send('Profiler.stop');
  await ctx.close();

  // El tiempo PROPIO por nodo: cuántas muestras cayeron adentro de esa función
  // misma. `profile.timeDeltas` son los microsegundos entre muestra y muestra.
  const propio = new Map();
  for (let i = 0; i < (profile.samples ?? []).length; i++) {
    const id = profile.samples[i];
    propio.set(id, (propio.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0));
  }
  const porNodo = new Map(profile.nodes.map((n) => [n.id, n]));

  // Se agrupa por ARCHIVO: una función anónima minificada no dice nada, pero
  // "este chunk" sí, y con el chunk se sabe qué biblioteca es.
  const porArchivo = new Map();
  const porFuncion = [];
  for (const [id, us] of propio) {
    const n = porNodo.get(id);
    if (!n) continue;
    const cf = n.callFrame ?? {};
    const archivo = (cf.url || '(sin archivo)').split('/').pop().split('?')[0] || '(vm)';
    porArchivo.set(archivo, (porArchivo.get(archivo) ?? 0) + us);
    porFuncion.push([`${cf.functionName || '(anónima)'} · ${archivo}`, us]);
  }

  const ms = (us) => Math.round(us / 1000);
  return {
    total: ms([...propio.values()].reduce((a, b) => a + b, 0)),
    archivos: [...porArchivo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, ms(v)]),
    funciones: porFuncion.sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, ms(v)]),
  };
}

for (const sinMotor of [false, true]) {
  const r = await perfilar(sinMotor);
  console.log(`\n${'='.repeat(60)}\n${sinMotor ? 'SIN el motor' : 'CON el motor'} — ${r.total} ms de procesador en total\n${'='.repeat(60)}`);
  console.log('  por archivo:');
  for (const [k, v] of r.archivos) console.log(`   ${String(v).padStart(6)} ms  ${k}`);
  console.log('  las funciones que más se comen:');
  for (const [k, v] of r.funciones) console.log(`   ${String(v).padStart(6)} ms  ${k.slice(0, 70)}`);
}

await nav.close();
cerrar();
process.exit(0);
