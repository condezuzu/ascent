// ¿LA WEB TARDA MÁS EN ABRIR QUE HACE UNOS DÍAS? (19/9)
//
// "Tarda cada vez más en abrir desde el atajo." Se mide, no se supone: la
// MISMA medición sobre el código de distintos días, cada uno compilado en
// producción en su propio worktree y su propio puerto.
//
// Qué se mide, desde adentro de la página (Performance API, no esperas de
// Playwright):
//   - RACHA VISIBLE: el número de la racha en pantalla y VISIBLE (desde el
//     19/9 la pantalla espera sus datos oculta: contar el número oculto sería
//     mentirse a favor);
//   - el primer pintado, y cuándo el motor quedó listo;
//   - las tareas largas (el hilo principal trabado).
// Primera visita (caché fría) y segunda (caliente, lo más parecido al atajo:
// el navegador ya tiene los archivos), con la CPU normal y frenada 4x (un
// teléfono), tres veces cada una, y se da la mediana.
//
// Todo con GPU de verdad: sin ella los commits de antes del 17/9 correrían el
// motor en SwiftShader y se verían lentos por eso y no por su código.
//
//   node --env-file=.env.local herramientas/comparar-arranque.mjs [commit ...]
//
// No necesita nada prendido y NO puede correr con el servidor de desarrollo
// prendido (compila). Deja los worktrees borrados al terminar.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cerrarPuerto, pasarLaEntrada, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from '../supabase/utiles.mjs';

limiteDeSonda(90);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_WT = join(RAIZ, '..', 'ascent-comparar');
const COMMITS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['87cf316', '9c66081', '5917d70', '681024c', 'HEAD'];
const VECES = 3;
const PUERTO = 3061;
// LA SESIÓN SE REUSA ENTRE COMMITS (19/9): la pantalla de entrada cambió en
// estos días y la sonda de hoy no sabe recorrer las viejas. Mismo origen
// (mismo puerto) y la misma librería de Supabase (node_modules compartido): la
// sesión de un commit sirve para los otros. Por eso conviene poner primero uno
// que entre bien (HEAD).
let sesionGuardada = null;

const ESPIA = `
  window.__listo = null;
  window.__largas = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas.push(Math.round(e.duration));
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  const mirar = () => {
    const n = document.querySelector('.racha-numero');
    const visible = n && !n.closest('.esperando') && getComputedStyle(n).visibility !== 'hidden';
    if (visible && /^[0-9]+$/.test((n.textContent || '').trim())) {
      window.__listo = performance.now();
      return;
    }
    requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
`;

const mediana = (l) => {
  const v = l.filter((x) => x !== null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};

function prepararWorktree(commit) {
  const dir = join(BASE_WT, commit.replace(/[^a-z0-9]/gi, ''));
  if (existsSync(dir)) {
    spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: RAIZ });
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(BASE_WT, { recursive: true });
  const r = spawnSync('git', ['worktree', 'add', '--detach', dir, commit], { cwd: RAIZ, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`worktree ${commit}: ${r.stderr}`);
  // node_modules compartido: un junction, no una copia de 1 GB.
  const j = spawnSync('cmd', ['/c', 'mklink', '/J', join(dir, 'node_modules'), join(RAIZ, 'node_modules')], { encoding: 'utf8' });
  if (j.status !== 0) throw new Error(`junction: ${j.stderr || j.stdout}`);
  return dir;
}

function borrarWorktree(dir) {
  // El junction primero: que borrar el worktree no entre al node_modules real.
  spawnSync('cmd', ['/c', 'rmdir', join(dir, 'node_modules')]);
  spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: RAIZ });
  rmSync(dir, { recursive: true, force: true });
}

async function medirCommit(commit, nav) {
  const dir = prepararWorktree(commit);
  const entorno = { ...process.env, NEXT_DIST_DIR: '.next-comparar' };
  let servidor = null;
  try {
    const t0 = Date.now();
    const b = spawnSync('npx', ['next', 'build'], { cwd: dir, shell: true, env: entorno, encoding: 'utf8', timeout: LIMITE_DE_COMPILACION_MS });
    if (b.status !== 0) throw new Error('no compila: ' + (b.stdout ?? '').slice(-600));
    console.log(`  ${commit}: compilado en ${Math.round((Date.now() - t0) / 1000)} s`);
    cerrarPuerto(PUERTO);
    servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: dir, shell: true, stdio: 'ignore', env: entorno });
    const BASE = `http://localhost:${PUERTO}`;
    for (let i = 0; i < 90; i++) {
      if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    const ctxLogin = await nav.newContext();
    const pl = await ctxLogin.newPage();
    let sesion = null;
    try {
      await pl.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
      await pasarLaEntrada(pl);
      await pl.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
      await pl.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
      await pl.getByRole('button', { name: 'Entrar', exact: true }).click({ timeout: 15000 });
      await pl.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });
      await pl.waitForTimeout(3000);
      sesion = await ctxLogin.storageState();
      sesionGuardada = sesion;
    } catch (e) {
      if (!sesionGuardada) {
        // Dónde se trabó: la foto y lo que dice la pantalla.
        await pl.screenshot({ path: join(RAIZ, 'capturas', `comparar-login-${commit}.png`) }).catch(() => {});
        const texto = await pl.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)).catch(() => '');
        throw new Error(`${e.message.split('\n')[0]} · se ve: ${texto}`);
      }
      console.log(`  ${commit}: la entrada de ese día es otra; uso la sesión de un commit anterior de esta corrida`);
      sesion = sesionGuardada;
    }
    await ctxLogin.close();

    const resultado = {};
    for (const freno of [1, 4]) {
      for (const caliente of [false, true]) {
        const filas = [];
        for (let v = 0; v < VECES; v++) {
          const ctx = await nav.newContext({ storageState: sesion, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
          const page = await ctx.newPage();
          await page.addInitScript(ESPIA);
          const cdp = await ctx.newCDPSession(page);
          if (caliente) {
            await page.goto(BASE + '/', { waitUntil: 'load' });
            await page.waitForTimeout(2500);
          }
          if (freno > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: freno });
          await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => window.__listo !== null, null, { timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(3000);
          filas.push(
            await page.evaluate(() => {
              const m = Object.fromEntries(performance.getEntriesByType('mark').map((e) => [e.name, e.startTime]));
              const fcp = performance.getEntriesByType('paint').find((x) => x.name === 'first-contentful-paint');
              return {
                racha: window.__listo === null ? null : Math.round(window.__listo),
                fcp: fcp ? Math.round(fcp.startTime) : null,
                motor: m['ascent:motor-montar-fin'] != null ? Math.round(m['ascent:motor-montar-fin']) : null,
                largas: window.__largas.reduce((s, d) => s + d, 0),
              };
            })
          );
          await ctx.close();
        }
        resultado[`${freno}x ${caliente ? 'caliente' : 'fría'}`] = {
          racha: mediana(filas.map((f) => f.racha)),
          fcp: mediana(filas.map((f) => f.fcp)),
          motor: mediana(filas.map((f) => f.motor)),
          largas: mediana(filas.map((f) => f.largas)),
          noLlego: filas.filter((f) => f.racha === null).length,
        };
      }
    }
    return resultado;
  } finally {
    if (servidor) {
      spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
      cerrarPuerto(PUERTO);
    }
    borrarWorktree(dir);
  }
}

const nav = await chromium.launch({
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'],
});
const todos = {};
try {
  for (const c of COMMITS) {
    const nombre = spawnSync('git', ['log', '-1', '--format=%h %ad', '--date=format:%d/%m %H:%M', c], { cwd: RAIZ, encoding: 'utf8' }).stdout.trim();
    try {
      todos[nombre] = await medirCommit(c, nav);
    } catch (e) {
      console.log(`  ${c}: FALLA ${e.message.split('\n')[0]}`);
    }
  }
} finally {
  await nav.close();
  rmSync(BASE_WT, { recursive: true, force: true });
}

const casos = ['1x fría', '1x caliente', '4x fría', '4x caliente'];
console.log('\nRACHA VISIBLE (mediana de 3, ms desde que se pide la página)');
console.log('commit'.padEnd(22) + casos.map((c) => c.padStart(14)).join(''));
for (const [n, r] of Object.entries(todos)) {
  console.log(n.padEnd(22) + casos.map((c) => String(r[c]?.racha ?? '—').padStart(14) + (r[c]?.noLlego ? '*' : '')).join(''));
}
for (const [titulo, clave] of [['PRIMER PINTADO', 'fcp'], ['MOTOR LISTO', 'motor'], ['TAREAS LARGAS (ms en total)', 'largas']]) {
  console.log(`\n${titulo}`);
  for (const [n, r] of Object.entries(todos)) {
    console.log(n.padEnd(22) + casos.map((c) => String(r[c]?.[clave] ?? '—').padStart(14)).join(''));
  }
}
console.log('\n(* = en alguna de las tres no llegó en 30 s)');
