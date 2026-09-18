// CUÁNTO TARDA CADA PANTALLA EN SER USABLE, CON LA CPU FRENADA.
//
// `medir-arranque.mjs` mide ABRIR la app —la primera pantalla— y eso ya está
// contestado. Esto mide LO DEMÁS: entrar a Stats, a Fuerza, al Ranking, al
// Álbum, al perfil y a Ajustes, que es lo que se hace todo el día.
//
// QUÉ ES "USABLE" para cada una está escrito abajo, una por una: no es cuándo
// termina de cargar, es cuándo aparece lo que la persona fue a ver. Es el
// único instante que importa, y es distinto en cada pantalla.
//
// CON LA CPU FRENADA, que es el punto: un teléfono de hace cuatro años es
// entre cuatro y seis veces más lento que esta computadora. El freno lo hace
// Chrome de verdad (`Emulation.setCPUThrottlingRate`), no es una estimación.
//
// Lo que NO mide: la red. Todo corre en localhost, así que los tiempos de
// Supabase de acá son el piso. En un teléfono con datos móviles hay que
// sumarle la latencia de verdad — por eso se reporta aparte cuántos pedidos
// hace cada pantalla y si van en serie o en paralelo, que eso sí se arregla.
//
//   node --env-file=.env.local supabase/medir-pantallas.mjs [frenos]
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { cerrarPuerto, limpiarPuertosDeSondas, pasarLaEntrada, limiteDeSonda, LIMITE_DE_COMPILACION_MS } from './utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(20);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRENOS = (process.argv[2] ?? '1,4').split(',').map(Number);

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
// SE LIMPIA ANTES DE LEVANTAR NADA, siempre. Si la corrida anterior se cayo
// a la mitad, su servidor quedo vivo sirviendo un build viejo, y esta sonda
// terminaria hablandole a el sin enterarse. Ver `limpiarPuertosDeSondas`.
limpiarPuertosDeSondas();
let PUERTO = 3031;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-pantallas' };
console.log('compilando…');
const build = spawnSync('npx', ['next', 'build'], { timeout: LIMITE_DE_COMPILACION_MS, cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
if (build.status !== 0) {
  console.log('NO COMPILA:\n' + (build.stdout ?? '').slice(-2500));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], { cwd: RAIZ, shell: true, env: entorno, stdio: 'ignore' });
const cerrar = () => {
  // POR PID **Y** POR PUERTO. El pid es el del shell que lanza npx; el servidor
  // es un nieto y sobrevive. Matar por puerto no depende del arbol de procesos.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  else servidor.kill('SIGTERM');
  cerrarPuerto(PUERTO);
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

// QUÉ ES ESTAR USABLE, pantalla por pantalla. Siempre es "ya se ve el dato que
// fui a ver", nunca "terminó de cargar": una pantalla con el armazón puesto y
// los números en blanco no sirve para nada.
const PANTALLAS = [
  { nombre: 'Inicio', ruta: '/', usable: '.racha-numero' },
  { nombre: 'Stats', ruta: '/stats', usable: '.escalera-rangos' },
  { nombre: 'Fuerza', ruta: '/fuerza', usable: '.titulo-pantalla' },
  { nombre: 'Ranking', ruta: '/social', usable: '#buscar' },
  { nombre: 'Álbum', ruta: '/album', usable: '.album-grilla, .vacio-cosmico' },
  { nombre: 'Perfil', ruta: '/yo', usable: '.yo-cabecera' },
  { nombre: 'Ajustes', ruta: '/ajustes', usable: '.seccion' },
];

const ESPIA = (selector) => `
  window.__usable = null;
  window.__largas = [];
  window.__cuadros = 0;
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  const contar = () => { window.__cuadros++; requestAnimationFrame(contar); };
  requestAnimationFrame(contar);
  const mirar = () => {
    if (document.querySelector(${JSON.stringify(selector)})) {
      window.__usable = performance.now();
      return;
    }
    requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
`;

const nav = await chromium.launch();

// Se entra una vez y se guarda la sesión: medir una pantalla no es medir el login.
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

async function medir(pantalla, freno, sinFondo) {
  const ctx = await nav.newContext({ storageState: sesion, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  if (sinFondo) {
    // La preferencia del fondo vive en el aparato: se pone antes de abrir.
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('ascent:fondo', 'nunca');
      } catch {}
    });
  }
  const page = await ctx.newPage();
  await page.addInitScript(ESPIA(pantalla.usable));
  const cdp = await ctx.newCDPSession(page);
  if (freno > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: freno });

  await page.goto(BASE + pantalla.ruta, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__usable !== null, null, { timeout: 90000 }).catch(() => {});
  // Tres segundos QUIETO después de que se puede usar: ahí se ve lo que sigue
  // trabajando cuando ya no hay nada que hacer, que es lo que calienta el
  // teléfono y se come la batería.
  const antes = await page.evaluate(() => ({ largas: window.__largas.length, cuadros: window.__cuadros, t: performance.now() }));
  await page.waitForTimeout(3000);

  const datos = await page.evaluate((desde) => {
    const pintado = performance.getEntriesByType('paint').find((x) => x.name === 'first-contentful-paint');
    const largas = window.__largas;
    const enReposo = largas.filter((l) => l[0] >= desde.t);
    const recursos = performance.getEntriesByType('resource');
    const supa = recursos.filter((r) => r.name.includes('/rest/v1/') || r.name.includes('/auth/v1/'));
    return {
      pintado: pintado ? Math.round(pintado.startTime) : null,
      usable: window.__usable === null ? null : Math.round(window.__usable),
      largas: largas.length,
      largasMs: largas.reduce((s, l) => s + l[1], 0),
      peorLarga: largas.reduce((s, l) => Math.max(s, l[1]), 0),
      reposoLargas: enReposo.length,
      reposoMs: enReposo.reduce((s, l) => s + l[1], 0),
      cuadrosPorSegundo: Math.round(((window.__cuadros - desde.cuadros) / (performance.now() - desde.t)) * 1000),
      pedidos: supa.length,
      // Cuántos arrancaron DESPUÉS de que otro terminó: los encadenados son los
      // que se pagan enteros en una red lenta.
      encadenados: supa.filter((r) => supa.some((o) => o !== r && o.responseEnd <= r.startTime + 5)).length,
      js: Math.round(recursos.filter((r) => r.name.includes('/_next/static/chunks/')).reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
    };
  }, antes);

  await ctx.close();
  return datos;
}

for (const freno of FRENOS) {
  console.log(`\n================ CPU frenada ${freno}× ================`);
  console.log('pantalla     pintado  USABLE   tareas largas      en reposo      cuadros/s  pedidos  JS');
  for (const p of PANTALLAS) {
    const d = await medir(p, freno, process.env.SIN_FONDO === "1");
    console.log(
      `${p.nombre.padEnd(12)} ${String(d.pintado ?? '—').padStart(5)} ms ${String(d.usable ?? 'NO').padStart(6)} ms  ` +
        `${String(d.largas).padStart(2)} · ${String(d.largasMs).padStart(4)} ms (peor ${String(d.peorLarga).padStart(3)})  ` +
        `${String(d.reposoLargas).padStart(2)} · ${String(d.reposoMs).padStart(4)} ms   ${String(d.cuadrosPorSegundo).padStart(3)}      ` +
        `${String(d.pedidos).padStart(2)} (${d.encadenados} en fila)  ${String(d.js).padStart(3)} kB`
    );
  }
  // La misma primera pantalla sin el motor: es la única pieza que se puede
  // apagar entera, así que conviene saber cuánto pesa de verdad.
  const sin = await medir(PANTALLAS[0], freno, true);
  console.log(
    `${'Inicio SIN'.padEnd(12)} ${String(sin.pintado ?? '—').padStart(5)} ms ${String(sin.usable ?? 'NO').padStart(6)} ms  ` +
      `${String(sin.largas).padStart(2)} · ${String(sin.largasMs).padStart(4)} ms (peor ${String(sin.peorLarga).padStart(3)})  ` +
      `${String(sin.reposoLargas).padStart(2)} · ${String(sin.reposoMs).padStart(4)} ms   ${String(sin.cuadrosPorSegundo).padStart(3)}      ` +
      `${String(sin.pedidos).padStart(2)} (${sin.encadenados} en fila)  ${String(sin.js).padStart(3)} kB   ← motor apagado`
  );
}

await nav.close();
cerrar();
