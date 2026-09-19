// ¿SE VE LA APP ANTES DE SABER? (19/9)
//
// Lo que se veía en todas las pantallas: primero el estado vacío o gris y
// después los datos. Inicio sin rango, "Buscar gente" sola en Ranking, "Tus
// días" que salta en Stats, la pestaña nueva que cambia de color al deslizar.
//
// Esto graba CADA CUADRO (requestAnimationFrame) desde que se abre la app o se
// cambia de pestaña, y en cada uno anota:
//   - el color del rango (`--pal-principal`): el gris de por omisión del CSS
//     (#6e6c66) no es el de ningún rango; si aparece, se vio la app sin rango;
//   - si la pantalla está visible, y su forma: el alto y los títulos.
// Y dice, por pantalla:
//   - cuándo apareció el contenido;
//   - cuántos cuadros hubo con el gris;
//   - cuántas veces CAMBIÓ LA FORMA después de aparecer (un salto: algo que
//     entró tarde y empujó). Tiene que ser 0.
//
// No escribe nada en la cuenta.
//
//   node --env-file=.env.local herramientas/probar-sin-parpadeo.mjs
//
// Necesita la web prendida en :3020.
import { chromium } from 'playwright';
import { limiteDeSonda, pasarLaEntrada } from '../supabase/utiles.mjs';

limiteDeSonda(8);

const BASE = 'http://localhost:3020';
const GRIS = '#6e6c66';

// Corre en la página desde antes de todo: graba cuadro por cuadro.
const GRABADOR = () => {
  const cuadros = [];
  let t0 = performance.now();
  window.__reiniciarGrabacion = () => {
    cuadros.length = 0;
    t0 = performance.now();
  };
  window.__cuadros = cuadros;
  const forma = (p) => {
    const titulos = [...p.querySelectorAll('h2, h3, .titulo-pantalla, .racha-numero, .fila-ranking, .ranking-fila, li')]
      .filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden')
      .map((e) => `${e.tagName}:${Math.round(e.getBoundingClientRect().top)}`);
    return `${Math.round(p.scrollHeight / 8)}|${titulos.length}|${titulos.slice(0, 12).join(',')}`;
  };
  const cuadro = () => {
    const pal = getComputedStyle(document.documentElement).getPropertyValue('--pal-principal').trim().toLowerCase();
    const p = document.querySelector('.deslizable .pantalla') ?? document.querySelector('.pantalla');
    // Visible = apareció entera: ni la pantalla ni una parte de ella (una
    // pestaña de Stats) siguen esperando.
    const visible =
      !!p &&
      !p.classList.contains('esperando') &&
      !p.querySelector('.parte-esperando') &&
      getComputedStyle(p).visibility !== 'hidden' &&
      p.innerText.trim().length > 0;
    cuadros.push({ t: Math.round(performance.now() - t0), ruta: location.pathname, pal, visible, forma: visible ? forma(p) : '' });
    if (cuadros.length < 600) requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
};

function resumir(nombre, cuadros, ruta) {
  const mios = cuadros.filter((c) => c.ruta === ruta);
  const grises = mios.filter((c) => c.pal === GRIS).length;
  const primero = mios.find((c) => c.visible);
  let saltos = 0;
  let anterior = null;
  const cuales = [];
  for (const c of mios) {
    if (!c.visible) continue;
    if (anterior !== null && c.forma !== anterior) {
      saltos++;
      if (cuales.length < 3) cuales.push(`${c.t} ms: ${anterior.slice(0, 110)}  →  ${c.forma.slice(0, 110)}`);
    }
    anterior = c.forma;
  }
  const ok = grises === 0 && saltos === 0 && !!primero;
  console.log(
    `  ${ok ? 'ok   ' : 'FALLA'} ${nombre.padEnd(34)} aparece ${primero ? String(primero.t).padStart(5) + ' ms' : '   nunca'}` +
      `  · cuadros grises ${grises}  · saltos después de aparecer ${saltos}`
  );
  for (const x of cuales) console.log(`           ${x}`);
  return ok;
}

const nav = await chromium.launch({
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(GRABADOR);
// SIN ANIMACIONES: la entrada escalonada de la primera apertura corre las
// cosas 1 a 3 px por cuadro, y eso no es un salto. Lo que se busca es algo que
// ENTRA tarde, y eso se ve igual sin animar.
await ctx.addInitScript(() => {
  const poner = () => {
    const e = document.createElement('style');
    e.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    document.documentElement.appendChild(e);
  };
  if (document.documentElement) poner();
  else document.addEventListener('DOMContentLoaded', poner);
});
const page = await ctx.newPage();
let fallas = 0;

try {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pasarLaEntrada(page);
  await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
  await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  await page.waitForTimeout(5000);
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.count()) await entendido.last().click();

  // Una vuelta por todo, para que el tema propio quede guardado (como en un
  // teléfono que ya usó la app) y el servidor de desarrollo compile todo.
  for (const r of ['/social', '/album', '/stats', '/ajustes', '/']) {
    await page.locator(`nav.nav a[href="${r}"]`).evaluate((a) => a.click());
    await page.waitForURL((u) => u.pathname === r, { timeout: 60000 });
    await page.waitForTimeout(2500);
  }

  console.log('\nAbrir la app desde cero (como el atajo):');
  await page.goto(BASE + '/', { waitUntil: 'commit' });
  await page.waitForTimeout(4000);
  if (!resumir('Inicio, apertura', await page.evaluate(() => window.__cuadros), '/')) fallas++;

  console.log('\nCambiar de pestaña con la barra:');
  for (const [nombre, r] of [
    ['Ranking', '/social'],
    ['Álbum', '/album'],
    ['Stats', '/stats'],
    ['Ajustes', '/ajustes'],
    ['Inicio', '/'],
  ]) {
    await page.evaluate(() => window.__reiniciarGrabacion());
    await page.locator(`nav.nav a[href="${r}"]`).evaluate((a) => a.click());
    await page.waitForURL((u) => u.pathname === r, { timeout: 60000 });
    await page.waitForTimeout(3500);
    if (!resumir(nombre, await page.evaluate(() => window.__cuadros), r)) fallas++;
  }

  console.log('\nStats, la pestaña Entrenamiento:');
  await page.locator('nav.nav a[href="/stats"]').evaluate((a) => a.click());
  await page.waitForURL((u) => u.pathname === '/stats', { timeout: 60000 });
  await page.waitForTimeout(3000);
  // Se graba desde el cuadro DESPUÉS del toque: los de antes son la pestaña
  // General, y cambiar de pestaña no es un salto.
  await page.evaluate(() => {
    document.querySelector('[role=tab][aria-selected=false]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    requestAnimationFrame(() => window.__reiniciarGrabacion());
  });
  await page.waitForTimeout(3500);
  if (!resumir('Stats → Entrenamiento', await page.evaluate(() => window.__cuadros), '/stats')) fallas++;
  // Vuelve a General para no dejar la pestaña cambiada (se recuerda).
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await page.waitForTimeout(800);

  console.log('\nRecargar Stats (sin nada en memoria):');
  await page.goto(BASE + '/stats', { waitUntil: 'commit' });
  await page.waitForTimeout(4000);
  if (!resumir('Stats, recarga', await page.evaluate(() => window.__cuadros), '/stats')) fallas++;
} catch (e) {
  fallas++;
  console.log(`\nFALLA ${e.message.split('\n')[0]}`);
} finally {
  await nav.close();
}
console.log(fallas ? `\n${fallas} con problemas` : '\ntodo bien');
process.exit(fallas ? 1 : 0);
