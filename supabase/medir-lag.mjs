// ¿QUÉ TARDA AL CAMBIAR DE PANTALLA, Y CUÁNTO DE ESO ES EL MOTOR?
//
// ACLARACIÓN IMPORTANTE SOBRE ESTOS NÚMEROS: no salen de un teléfono. Salen de
// Chromium con la CPU frenada por el protocolo de DevTools, que es la mejor
// aproximación que se puede hacer desde acá. Un teléfono real además tiene GPU
// más lenta, memoria más lenta y térmica; estos números son un PISO, no una
// medición.
//
// Para números de verdad está `Ajustes → Diagnóstico → Medir esta pantalla`,
// que corre en el teléfono y deja el resultado en la bitácora.
//
//   node --env-file=.env.local supabase/medir-lag.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.LAG_PUERTO ?? 3026);
const BASE = `http://localhost:${PUERTO}`;
// 6x es un Android de gama media contra esta máquina; 4x, uno bueno.
const FRENO = Number(process.env.LAG_FRENO ?? 6);

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-primera' };
const compilacion = spawnSync('npx', ['next', 'build'], {
  cwd: RAIZ, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: entorno, encoding: 'utf8',
});
if (compilacion.status !== 0) {
  console.log('NO COMPILA:\n' + (compilacion.stdout ?? ''));
  process.exit(1);
}
const servidor = spawn('npx', ['next', 'start', '-p', String(PUERTO)], {
  cwd: RAIZ, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: entorno,
});
const cerrar = () => {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(servidor.pid), '/f', '/t'], { stdio: 'ignore' });
  } else servidor.kill('SIGTERM');
};
process.on('exit', cerrar);
for (let i = 0; i < 90; i++) {
  const vivo = await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false);
  if (vivo) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const nav = await chromium.launch();

/** Recorre las pantallas y devuelve cuánto tardó cada una. */
async function recorrer({ freno, sinMotor }) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (freno > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: freno });

  if (sinMotor) {
    // Se corta el chunk del motor: lo que quede es todo lo demás. La app
    // aguanta sin él —el fondo tiene un respaldo en CSS puro— así que la
    // diferencia entre las dos corridas ES el costo del motor.
    await page.route('**/*.js', (ruta) => {
      const u = ruta.request().url();
      if (/three|motor|escena/i.test(u)) return ruta.abort();
      return ruta.continue();
    });
  }

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
  await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });

  const tiempos = {};
  const pantallas = [
    ['inicio', '/', '.tira-semanal'],
    ['stats', '/stats', '.escalera-rangos'],
    ['album', '/album', '.album-grilla, .vacio-cosmico'],
    ['ranking', '/social', '#buscar'],
    ['inicio', '/', '.tira-semanal'],
  ];
  // POR LA BARRA DE ABAJO, no con `goto`. La primera versión de esto medía
  // recargas completas, que no es lo que hace nadie: la app navega del lado
  // del cliente y cambiar de pestaña no vuelve a pedir la página. Medir la
  // recarga daba catorce segundos donde el usuario ve mucho menos.
  //
  // Y se cronometra DESDE ADENTRO del navegador, entre el toque y el momento
  // en que el contenido está en pantalla: sin Playwright en el medio, que ya
  // me mintió una vez con sus esperas.
  const irA = async (nombre, ruta, listo) => {
    const ms = await page.evaluate(
      async ([ruta, listo]) => {
        const enlace = document.querySelector(`.nav a[href="${ruta}"]`);
        if (!enlace) return -1;
        const t = performance.now();
        enlace.click();
        for (let i = 0; i < 1200; i++) {
          if (document.querySelector(listo)) return Math.round(performance.now() - t);
          await new Promise((r) => requestAnimationFrame(r));
        }
        return -2;
      },
      [ruta, listo]
    );
    tiempos[nombre] = ms;
    await page.waitForTimeout(500);
  };

  // Una vuelta completa por la barra, dos veces: la primera paga cargar el
  // código de cada pantalla, la segunda es la que se repite todo el día.
  for (const [nombre, ruta, listo] of pantallas) await irA(nombre, ruta, listo);
  for (const [nombre, ruta, listo] of pantallas) await irA(nombre + ' (2ª vez)', ruta, listo);

  // Las marcas que la app ya deja puestas.
  const marcas = await page.evaluate(() => {
    const m = Object.fromEntries(
      performance.getEntriesByType('mark').map((e) => [e.name, Math.round(e.startTime)])
    );
    const d = (a, b) => (m[a] != null && m[b] != null ? m[b] - m[a] : null);
    return {
      importarMotor: d('ascent:motor-import-inicio', 'ascent:motor-import-fin'),
      montarMotor: d('ascent:motor-montar-inicio', 'ascent:motor-montar-fin'),
      particulas: d('ascent:particulas-inicio', 'ascent:particulas-fin'),
      shaders: d('ascent:shader-inicio', 'ascent:shader-fin'),
    };
  });

  await ctx.close();
  return { tiempos, marcas };
}

console.log(`\nCPU frenada ${FRENO}x — un Android de gama media, aproximado\n`);

const con = await recorrer({ freno: FRENO, sinMotor: false });
const sin = await recorrer({ freno: FRENO, sinMotor: true });

console.log('Cambiar de pantalla (ms):');
console.log('  pantalla     con motor   sin motor   el motor cuesta');
for (const k of Object.keys(con.tiempos)) {
  const c = con.tiempos[k];
  const s = sin.tiempos[k];
  console.log(
    `  ${k.padEnd(12)} ${String(c).padStart(8)}   ${String(s).padStart(9)}   ${String(c - s).padStart(9)}`
  );
}

console.log('\nAdentro del motor (ms, primera carga):');
for (const [k, v] of Object.entries(con.marcas)) {
  console.log(`  ${k.padEnd(16)} ${v == null ? '—' : v}`);
}

await nav.close();
cerrar();
process.exit(0);
