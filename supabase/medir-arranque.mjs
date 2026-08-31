// ¿QUÉ TARDA EN ABRIR LA APP, Y CUÁNTO TARDA CADA PARTE?
//
// La pregunta no es "va lento": es cuántos milisegundos se va cada cosa, para
// saber cuál vale la pena tocar. Se mide el ARRANQUE, que es distinto del uso:
// una vez cargada la app anda bien, lo pesado es entrar.
//
// CÓMO SE MIDE, Y POR QUÉ ASÍ. Todo sale de la Performance API del propio
// navegador —navigation timing, resource timing y las marcas que la app ya
// pone—, leída DESDE ADENTRO de la página. Nada sale de esperas de Playwright:
// esas ya me mintieron dos veces en este proyecto, una diciendo veinte
// segundos donde el toque llegaba en treinta y seis milisegundos.
//
// Lo único que Playwright hace acá es abrir la página y leer números que el
// navegador ya calculó.
//
//   node --env-file=.env.local supabase/medir-arranque.mjs
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRENOS = (process.env.ARRANQUE_FRENOS ?? '1,4').split(',').map(Number);

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    s.listen(p, '127.0.0.1');
  });

let PUERTO = Number(process.env.ARRANQUE_PUERTO ?? 3028);
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

const entorno = { ...process.env, NEXT_DIST_DIR: '.next-arranque' };
console.log('  compilando…');
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
  if (await fetch(BASE + '/login', { redirect: 'manual' }).then(() => true).catch(() => false)) break;
  await new Promise((r) => setTimeout(r, 1000));
}

// Se instala ANTES de que corra nada de la página: anota el momento exacto en
// que la racha aparece con un número de verdad. Es el único instante que le
// importa a la persona — "ya puedo usar la app".
const ESPIA = `
  window.__listo = null;
  // LAS TAREAS LARGAS. Es la pieza que faltaba: si los datos vuelven a los mil
  // milisegundos y la pantalla recién aparece a los siete mil, o el hilo
  // principal está ocupado o nadie lo despertó. Esto distingue una cosa de la
  // otra sin adivinar.
  window.__largas = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__largas.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  const mirar = () => {
    const n = document.querySelector('.racha-numero');
    if (n && /^[0-9]+$/.test((n.textContent || '').trim())) {
      window.__listo = performance.now();
      return;
    }
    requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
`;

const nav = await chromium.launch();

// Se entra una sola vez y se guarda la sesión: medir el arranque no es medir
// el login.
const ctxLogin = await nav.newContext();
const pLogin = await ctxLogin.newPage();
await pLogin.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await pLogin.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await pLogin.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await pLogin.getByRole('button', { name: 'Entrar', exact: true }).click();
await pLogin.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });
const sesion = await ctxLogin.storageState();
await ctxLogin.close();

async function medir({ freno, cacheCaliente }) {
  const ctx = await nav.newContext({
    storageState: sesion,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.addInitScript(ESPIA);
  const cdp = await ctx.newCDPSession(page);
  if (freno > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: freno });

  // Una vuelta previa para llenar la caché del navegador cuando corresponde.
  if (cacheCaliente) {
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(2500);
  }

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  // Se espera a que la racha esté en pantalla, con tope: si no llega, el
  // número que interesa es "no llegó", no un promedio inventado.
  await page.waitForFunction(() => window.__listo !== null, null, { timeout: 60000 }).catch(() => {});
  // Y un rato más para que el motor termine de montarse y deje sus marcas.
  await page.waitForTimeout(4000);

  const datos = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const marcas = Object.fromEntries(
      performance.getEntriesByType('mark').map((e) => [e.name, e.startTime])
    );
    const d = (a, b) => (marcas[a] != null && marcas[b] != null ? marcas[b] - marcas[a] : null);

    const recursos = performance.getEntriesByType('resource');
    // CADA PEDIDO CON SU PROPIA DURACIÓN, y además CUÁNDO arrancó.
    //
    // La primera versión de esto reportaba el LAPSO —del primer pedido al
    // último— y lo llamaba tiempo de red. Con eso "supabase: 6633 ms" parecía
    // seis segundos de red cuando en realidad eran seis segundos de ESPERA con
    // unos pocos pedidos cortos adentro. Un número que mide la cosa equivocada
    // es peor que no medir: se usa para decidir.
    const suma = (filtro) => {
      const l = recursos.filter(filtro);
      return {
        cuantos: l.length,
        kb: Math.round(l.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
        // Cuánto estuvo la red OCUPADA de verdad: se unen los intervalos que
        // se superponen, así lo que bajó en paralelo cuenta una sola vez.
        ocupada: (() => {
          const iv = l
            .map((r) => [r.startTime, r.responseEnd])
            .sort((a, b) => a[0] - b[0]);
          let total = 0, finAnterior = -1;
          for (const [ini, fin] of iv) {
            const desde = Math.max(ini, finAnterior);
            if (fin > desde) total += fin - desde;
            finAnterior = Math.max(finAnterior, fin);
          }
          return Math.round(total);
        })(),
        primero: l.length ? Math.round(Math.min(...l.map((r) => r.startTime))) : null,
        ultimo: l.length ? Math.round(Math.max(...l.map((r) => r.responseEnd))) : null,
        // El más lento del grupo, con su nombre: es el que hay que mirar.
        peor: l.length
          ? (() => {
              const m = l.reduce((a, b) => (a.duration > b.duration ? a : b));
              return `${Math.round(m.duration)} ms ${m.name.split('/').pop().slice(0, 34)}`;
            })()
          : null,
      };
    };

    return {
      // --- la página ---
      html: Math.round(nav.responseEnd - nav.requestStart),
      domInteractive: Math.round(nav.domInteractive),
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
      load: Math.round(nav.loadEventEnd || nav.domComplete),
      // --- lo que se bajó ---
      js: suma((r) => r.name.includes('/_next/static/chunks/')),
      css: suma((r) => r.name.endsWith('.css')),
      fuentes: suma((r) => /\.(woff2?|ttf)/.test(r.name)),
      supabase: suma((r) => r.name.includes('/rest/v1/') || r.name.includes('/auth/v1/')),
      // Uno por uno y en orden: acá se ve si van en serie o en paralelo, que es
      // la diferencia entre "la red está lejos" y "los encadenamos mal".
      pedidos: recursos
        .filter((r) => r.name.includes('/rest/v1/') || r.name.includes('/auth/v1/'))
        .sort((a, b) => a.startTime - b.startTime)
        .map((r) => `${String(Math.round(r.startTime)).padStart(5)} +${String(Math.round(r.duration)).padStart(4)}  ${r.name.split('/').slice(-1)[0].split('?')[0]}`),
      // --- el motor ---
      importarMotor: d('ascent:motor-import-inicio', 'ascent:motor-import-fin'),
      montarMotor: d('ascent:motor-montar-inicio', 'ascent:motor-montar-fin'),
      particulas: d('ascent:particulas-inicio', 'ascent:particulas-fin'),
      shaders: d('ascent:shader-inicio', 'ascent:shader-fin'),
      motorArrancaEn: marcas['ascent:motor-import-inicio'] ?? null,
      motorListoEn: marcas['ascent:motor-montar-fin'] ?? null,
      // Cuándo apareció ALGO en pantalla, contra cuándo apareció lo que
      // sirve. La distancia entre los dos es la que se siente.
      primerPintado: (() => {
        const e = performance.getEntriesByType('paint').find((x) => x.name === 'first-contentful-paint');
        return e ? Math.round(e.startTime) : null;
      })(),
      // Tareas largas: cuántas, cuánto suman, y las tres peores con su hora.
      largas: {
        cuantas: window.__largas.length,
        suma: window.__largas.reduce((s, [, d]) => s + d, 0),
        peores: [...window.__largas].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t, d]) => `${d} ms a los ${t}`),
      },
      // --- lo único que le importa a la persona ---
      rachaEnPantalla: window.__listo === null ? null : Math.round(window.__listo),
    };
  });

  await ctx.close();
  return datos;
}

const fila = (n, v) => `  ${String(n).padEnd(26)} ${v === null ? '—' : v}`;

for (const freno of FRENOS) {
  for (const caliente of [false, true]) {
    const r = await medir({ freno, cacheCaliente: caliente });
    console.log(
      `\n${'='.repeat(58)}\nCPU ${freno === 1 ? 'sin frenar' : `frenada ${freno}x`} · caché ${caliente ? 'CALIENTE (segunda visita)' : 'FRÍA (primera visita)'}\n${'='.repeat(58)}`
    );
    console.log(fila('HTML (servidor)', `${r.html} ms`));
    console.log(fila('DOM interactivo', `${r.domInteractive} ms`));
    console.log(fila('load', `${r.load} ms`));
    console.log(fila('primer pintado', r.primerPintado === null ? null : `${r.primerPintado} ms`));
    console.log(fila('>> RACHA EN PANTALLA', r.rachaEnPantalla === null ? 'NO LLEGÓ' : `${r.rachaEnPantalla} ms`));
    console.log(fila('tareas largas', `${r.largas.cuantas} · ${r.largas.suma} ms en total`));
    for (const l of r.largas.peores) console.log('    ' + l);
    console.log('  ── lo que se bajó (red ocupada de verdad) ──');
    console.log(fila('javascript', `${r.js.cuantos} arch · ${r.js.kb} kB · ${r.js.ocupada} ms · último a los ${r.js.ultimo}`));
    console.log(fila('css', `${r.css.cuantos} · ${r.css.kb} kB · ${r.css.ocupada} ms`));
    console.log(fila('fuentes', `${r.fuentes.cuantos} · ${r.fuentes.kb} kB · ${r.fuentes.ocupada} ms · peor ${r.fuentes.peor}`));
    console.log(fila('supabase', `${r.supabase.cuantos} pedidos · ${r.supabase.ocupada} ms ocupada`));
    console.log('  ── los pedidos, en orden (arranca +dura) ──');
    for (const l of r.pedidos) console.log('    ' + l);
    console.log('  ── el motor ──');
    console.log(fila('arranca en', r.motorArrancaEn === null ? null : `${Math.round(r.motorArrancaEn)} ms`));
    console.log(fila('importar three.js', r.importarMotor === null ? null : `${Math.round(r.importarMotor)} ms`));
    console.log(fila('armar partículas', r.particulas === null ? null : `${Math.round(r.particulas)} ms`));
    console.log(fila('compilar shaders', r.shaders === null ? null : `${Math.round(r.shaders)} ms`));
    console.log(fila('montar (total)', r.montarMotor === null ? null : `${Math.round(r.montarMotor)} ms`));
    console.log(fila('listo en', r.motorListoEn === null ? null : `${Math.round(r.motorListoEn)} ms`));
  }
}

await nav.close();
cerrar();
process.exit(0);
