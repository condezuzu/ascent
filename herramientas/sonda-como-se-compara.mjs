// ¿POR QUÉ FALLA "CÓMO SE COMPARA" EN LA PASADA MÓVIL DE LAS CAPTURAS?
//
// Falló tres veces el 17 y 18/9, de dos formas: el botón nunca pasaba a
// "visible" en 20 s aunque estaba en el DOM, o se veía y el click agotaba sus
// 30 s. Es intermitente —pasa una de cada tres corridas, más o menos— y
// `capturas.mjs` corta el error en la primera línea, que es justo la parte que
// no dice nada.
//
// Esto repite la secuencia EXACTA en la que falla —Stats, pestaña
// Entrenamiento, Ajustes, el desplegable— muchas veces en una misma sesión, y
// en cada intento vuelca lo que hace falta para no tener que adivinar:
//
//   - la caja del botón y si está adentro de la ventana
//   - QUÉ ELEMENTO hay en el centro del botón (si no es el botón, algo lo tapa)
//   - display, visibility, opacity, transform, pointer-events y overflow del
//     botón y de cada ancestro
//   - el error COMPLETO de Playwright, con su registro de llamadas, que es
//     donde dice por qué no pudo hacer click
//
// No arregla nada: mide. La corrección, si la hay, va después y con el dato.
//
//   node --env-file=.env.local herramientas/sonda-como-se-compara.mjs [intentos]
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { cerrarPuerto, limpiarPuertosDeSondas, pasarLaEntrada } from '../supabase/utiles.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'sonda-compara');
mkdirSync(SALIDA, { recursive: true });
const INTENTOS = Number(process.argv[2] ?? 12);

const librePara = (p) =>
  new Promise((r) => {
    const s = createServer();
    s.once('error', () => r(false));
    s.once('listening', () => s.close(() => r(true)));
    s.listen(p, '0.0.0.0');
  });
limpiarPuertosDeSondas();
let PUERTO = 3095;
while (!(await librePara(PUERTO))) PUERTO++;
const BASE = `http://localhost:${PUERTO}`;

// El MISMO build de producción que usan las capturas: con `next dev` la
// primera visita a cada ruta compila adentro del `goto`, y eso es otra falla.
const entorno = { ...process.env, NEXT_DIST_DIR: '.next-sonda-compara' };
console.log('compilando…');
const build = spawnSync('npx', ['next', 'build'], { cwd: RAIZ, shell: true, env: entorno, encoding: 'utf8' });
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

// El tamaño de la pasada que falla: la móvil.
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 60000 });
await pasarLaEntrada(page);
await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });

/** Todo lo que puede estar pasando con el botón, medido en la página. */
async function volcar(boton) {
  return boton
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const encima = document.elementFromPoint(cx, cy);
      const describir = (n) =>
        n ? `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().replace(/\s+/g, '.') : ''}` : '(nada)';
      const cadena = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        cadena.push({
          quien: describir(n),
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          transform: cs.transform,
          pointerEvents: cs.pointerEvents,
          overflow: cs.overflow,
          // `style` en línea: `PantallaDeslizable` pone su transform ahí.
          enLinea: n.getAttribute('style') ?? '',
        });
      }
      return {
        caja: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        ventana: { w: innerWidth, h: innerHeight, scrollY: Math.round(scrollY) },
        adentro: r.top >= 0 && r.bottom <= innerHeight && r.width > 0 && r.height > 0,
        enElCentro: describir(encima),
        loTapa: !!encima && encima !== el && !el.contains(encima),
        cadena,
      };
    })
    .catch((e) => ({ error: String(e).slice(0, 300) }));
}

const resultados = [];
for (let i = 1; i <= INTENTOS; i++) {
  const r = { intento: i };
  try {
    // La secuencia de `capturas.mjs`: la pantalla anterior a esta es Stats
    // con la pestaña Entrenamiento abierta.
    await page.goto(BASE + '/stats', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.escalera-rangos').first().waitFor({ timeout: 30000 });
    await page.getByRole('tab', { name: 'Entrenamiento' }).click({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.goto(BASE + '/ajustes', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.seccion').first().waitFor({ timeout: 30000 });

    const boton = page.locator('button.fila-plegable', { hasText: /compara/i }).first();
    const t0 = Date.now();
    try {
      await boton.waitFor({ state: 'visible', timeout: 20000 });
      r.visibleEn = Date.now() - t0;
    } catch (e) {
      r.falla = 'no paso a visible en 20 s';
      r.error = String(e);
    }
    if (!r.falla) {
      // LA HORA DEL CLICK, en el reloj de la página, para poder ponerla al
      // lado de las marcas del motor. La primera corrida mostró que el click
      // no se traba por CSS: Playwright pasa todos sus chequeos y se queda en
      // "performing click action", o sea esperando que la página atienda el
      // evento. Esto dice si en ese momento el motor estaba compilando.
      r.clickEnPagina = await page.evaluate(() => Math.round(performance.now()));
      try {
        await boton.click({ timeout: 15000 });
        r.clickEn = Date.now() - t0;
      } catch (e) {
        r.falla = 'el click agoto el tiempo';
        // EL ERROR ENTERO: el registro de llamadas de Playwright dice qué
        // condición no se cumplió ("intercepts pointer events", "not stable"...).
        r.error = String(e);
      }
    }
    // LO QUE HIZO EL MOTOR en esta visita, con inicio y duración, siempre —
    // en los que andan también, para comparar—.
    r.motor = await page
      .evaluate(() =>
        performance
          .getEntriesByType('measure')
          .filter((e) => e.name.startsWith('ascent:'))
          .map((e) => ({ que: e.name, desde: Math.round(e.startTime), dura: Math.round(e.duration) }))
      )
      .catch(() => []);
    if (r.falla) {
      r.estado = await volcar(boton);
      await page.screenshot({ path: join(SALIDA, `falla-${i}.png`) });
    }
  } catch (e) {
    r.falla = 'la secuencia misma fallo';
    r.error = String(e);
  }
  resultados.push(r);
  const compila = (r.motor ?? []).find((m) => m.que === 'ascent:shader-compilacion');
  const importa = (r.motor ?? []).find((m) => m.que === 'ascent:motor-import');
  const motor = compila
    ? `motor: import ${importa ? importa.desde + '+' + importa.dura : '?'} ms, shaders ${compila.desde}+${compila.dura} ms; click en ${r.clickEnPagina ?? '?'} ms`
    : `motor: sin marcas; click en ${r.clickEnPagina ?? '?'} ms`;
  console.log(
    (r.falla
      ? `  intento ${String(i).padStart(2)}: FALLA — ${r.falla}`
      : `  intento ${String(i).padStart(2)}: ok (visible ${r.visibleEn} ms, click ${r.clickEn} ms)`) +
      `
              ${motor}`
  );
}

await nav.close();
writeFileSync(join(SALIDA, 'resultados.json'), JSON.stringify(resultados, null, 2));
const fallas = resultados.filter((r) => r.falla);
console.log(`\n${fallas.length} fallas en ${resultados.length} intentos`);
for (const f of fallas) {
  console.log(`\n=== intento ${f.intento}: ${f.falla} ===`);
  console.log((f.error ?? '').split('\n').slice(0, 25).join('\n'));
  if (f.estado) console.log(JSON.stringify(f.estado, null, 2).slice(0, 3000));
}
console.log(`\ndetalle completo: capturas/sonda-compara/resultados.json`);
