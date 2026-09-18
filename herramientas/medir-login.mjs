// ¿POR QUÉ EL LOGIN TARDA 149 s CON GPU Y ES RÁPIDO SIN ELLA?
//
// El 18/9 `perfilar-bloqueo --gpu` tardó 149 s en entrar (y la primera vez ni
// entró: el campo de contraseña no apareció en 30 s). Sin GPU entra rápido. Es
// al revés de todo lo demás, y si las sondas de animación pasan a `--gpu` se
// vuelven inusables. Esto cronometra CADA paso de la entrada, con y sin GPU,
// y dice cuál espera se vence en vez de tragársela como `pasarLaEntrada`.
//
//   node --env-file=.env.local herramientas/medir-login.mjs [--compilar]
//
// Sin `--compilar` usa el build que haya en `.next-perfil` (lo deja
// `perfilar-bloqueo`); el código de la entrada no cambia entre corridas.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { cerrarPuerto, limpiarPuertosDeSondas, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'medir-login');
mkdirSync(SALIDA, { recursive: true });
const DIST = '.next-perfil';
const entorno = { ...process.env, NEXT_DIST_DIR: DIST };

limpiarPuertosDeSondas();
const PUERTO = 3096;
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

async function medir(conGpu) {
  const nav = await chromium.launch({ args: conGpu ? GPU : [] });
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.__largas = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__largas.push([Math.round(e.startTime), Math.round(e.duration)]);
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const pasos = [];
  // Cada paso con su tiempo y si se venció. Nada se traga.
  const paso = async (nombre, fn) => {
    const t = Date.now();
    let res = 'ok';
    try {
      await fn();
    } catch (e) {
      res = 'VENCIÓ/FALLÓ: ' + e.message.split('\n')[0].slice(0, 110);
    }
    const linea = `  ${String(Date.now() - t).padStart(6)} ms  ${nombre}  ${res}`;
    pasos.push(linea);
    console.log(linea);
  };

  console.log(`\n### ${conGpu ? 'CON GPU' : 'SIN GPU (SwiftShader)'}`);
  await paso('goto /login (domcontentloaded)', () => page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 }));
  await paso('aparece .bienv o el correo', () =>
    page.waitForFunction(() => !!document.querySelector('.bienv') || !!document.querySelector('input[type=email]'), null, { timeout: 30000 })
  );
  for (let i = 1; i <= 3; i++) {
    const b = page.getByRole('button', { name: 'Siguiente' });
    if (!(await b.count())) {
      console.log(`  (no hay "Siguiente" en la vuelta ${i})`);
      break;
    }
    await paso(`click Siguiente ${i}`, () => b.click({ timeout: 30000 }));
  }
  await paso('click .bienv-tocar (saltar la animación)', () => page.locator('.bienv-tocar').click({ timeout: 30000 }));
  await paso('click "Ya tengo cuenta"', () => page.getByRole('button', { name: 'Ya tengo cuenta' }).click({ timeout: 30000 }));
  await paso('correo visible', () => page.locator('input[type=email]').waitFor({ state: 'visible', timeout: 30000 }));
  await paso('llenar correo', () => page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL, { timeout: 30000 }));
  await paso('llenar contraseña', () => page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD, { timeout: 30000 }));
  await paso('click Entrar', () => page.getByRole('button', { name: 'Entrar', exact: true }).click({ timeout: 30000 }));
  await paso('salir de /login', () => page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }));

  const largas = await page.evaluate(() => window.__largas).catch(() => []);
  const marcas = await page
    .evaluate(() => performance.getEntriesByType('mark').filter((e) => e.name.startsWith('ascent:')).map((e) => `${e.name}@${Math.round(e.startTime)}`))
    .catch(() => []);
  console.log(`  TOTAL ${Date.now() - t0} ms`);
  console.log(`  tareas largas (inicio+dura): ${largas.map(([a, b]) => `${a}+${b}`).join(', ') || '(ninguna)'}`);
  console.log(`  marcas: ${marcas.join('  ') || '(ninguna)'}`);
  await page.screenshot({ path: join(SALIDA, `final-${conGpu ? 'gpu' : 'sw'}.png`), timeout: 15000 }).catch(() => {});
  await nav.close();
}

await medir(false);
await medir(true);
process.exit(0);
