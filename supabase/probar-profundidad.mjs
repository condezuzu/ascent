// LA PROFUNDIDAD (30/10): luz de color en vez de sombra negra, y bordes de 1 pt. Sobre un fondo casi
// negro una sombra negra no se ve: lo que da profundidad es que las cosas emitan.
//
// Por la pantalla: en Inicio, entrenando, el descanso y Stats le pregunta al navegador por cada sombra
// y cada borde. Ninguna sombra negra, ningún borde más fino que un punto. Y lo que tiene que emitir,
// emite, en el color del rango: la punta de la barra de progreso, el aro de hoy, el sólido (con su luz
// dibujada, porque una sombra no sigue la diagonal), la pestaña prendida, y el arco del descanso.
//
// Lo que NO mide: cómo se ve en el iPhone. Las luces de lo redondo son sombras nativas de iOS y acá son
// `box-shadow`, parecidas; las dibujadas son iguales en los dos. Y el desenfoque de la barra es el del
// navegador: el de iOS no se puede probar en esta máquina.
//
//   node --env-file=.env.local supabase/probar-profundidad.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const { paletaDe } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'paletas.ts')).href);
const { cuerpoDe } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'rangos.ts')).href);
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-pr-${sello}@gmail.com`;
const clave = `Pr-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `pr_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
// Racha 8: el rango 2, naranja. Que la luz no sea blanca ni de la Luna por casualidad.
const RACHA = 8;
const filas = [];
for (let a = RACHA; a >= 1; a--) filas.push({ user_id: uid, fecha: dia(a) });
await s.from('logs').insert(filas);
await s.rpc('recalcular_desde_cero');
const { rango, planeta } = cuerpoDe(RACHA);
const CLARO = paletaDe(rango, planeta).claro.toLowerCase();
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');

console.log('La profundidad de la nativa');
const nav = await chromium.launch();
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const page = await ctx.newPage();
  // Sombras negras y bordes finos de lo que se ve.
  const mirar = () => page.evaluate(() => {
    const negras = [];
    const finos = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      const c = el.getBoundingClientRect();
      if (c.width < 1 || c.height < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (c.right < 0 || c.bottom < 0 || c.left > innerWidth || c.top > innerHeight) continue;
      const q = (el.textContent || '').trim().slice(0, 18) || el.tagName;
      const sombra = cs.boxShadow;
      if (sombra && sombra !== 'none') {
        const m = sombra.match(/rgba?\((\d+), (\d+), (\d+)/);
        if (m && Number(m[1]) + Number(m[2]) + Number(m[3]) < 30) negras.push(`${q}: ${sombra.slice(0, 40)}`);
      }
      for (const lado of ['Top', 'Right', 'Bottom', 'Left']) {
        const a = parseFloat(cs[`border${lado}Width`]);
        if (a > 0 && a < 1 && cs[`border${lado}Style`] !== 'none') finos.push(`${q}: ${a}`);
      }
    }
    return { negras: [...new Set(negras)], finos: [...new Set(finos)] };
  });
  const sombraDe = (loc) => loc.evaluate((n) => getComputedStyle(n).boxShadow);

  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas'] })), [uid]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  await page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first().waitFor({ timeout: 120000 });
  // La presentación del cuerpo tapa todo la primera vez: se pasa recargando y tocando.
  await page.waitForTimeout(2500);
  const ceremonia = page.locator('[aria-modal="true"]');
  for (let i = 0; i < 12 && (await ceremonia.count()) > 0; i++) {
    await page.mouse.click(195, 420);
    await page.waitForTimeout(1000);
  }
  const iniciar = page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first();
  await iniciar.waitFor({ timeout: 60000 });
  await page.waitForTimeout(1200);

  chequear('Inicio: ninguna sombra negra y ningún borde fino', await mirar(), { negras: [], finos: [] });

  // ---- LO QUE EMITE, EN EL COLOR DEL RANGO ----
  const punta = await page.getByTestId('punta-del-progreso').first().evaluate((n) => getComputedStyle(n).boxShadow);
  chequear('la punta de la barra emite en el claro del rango', punta.includes(`rgb(${rgb(CLARO)})`) || punta.includes(`rgba(${rgb(CLARO)}`), true);
  const aura = await page.locator('#aura stop').first().evaluate((n) => (n.getAttribute('stop-color') ?? '').toLowerCase());
  chequear('el número tiene su aura, en el claro del rango', aura, CLARO);
  // El sólido: la luz dibujada son los anillos alrededor del polígono.
  const anillos = await page.getByText(TX.inicio.registrarDia, { exact: true }).first().evaluate((n) => {
    const svg = n.closest('button, [role="button"], div')?.parentElement?.querySelector('polygon')?.ownerSVGElement ?? n.parentElement.querySelector('svg');
    if (!svg) return { poligonos: 0, color: '' };
    const p = [...svg.querySelectorAll('polygon')];
    return { poligonos: p.length, color: (p[0].getAttribute('stroke') ?? '').toLowerCase() };
  });
  chequear('el sólido lleva su luz dibujada, cuatro anillos', anillos, { poligonos: 5, color: CLARO });
  const barra = await page.locator('[role="tablist"]').first().evaluate((n) => {
    // Desde el 3/11 sin desenfoque: el recortado por un círculo enorme es el sospechoso del reinicio del teléfono.
    const hijos = [...n.querySelectorAll('*')];
    return {
      desenfoque: hijos.some((h) => /blur/.test(getComputedStyle(h).backdropFilter || getComputedStyle(h).webkitBackdropFilter || '')),
      oscuro: !!n.querySelector('[data-testid="arco-de-la-barra"] path[fill^="url("]'),
      fondo: getComputedStyle(n).backgroundColor,
    };
  });
  chequear('la barra de abajo es translúcida: oscura con la forma del arco, sin desenfoque', barra, { desenfoque: false, oscuro: true, fondo: 'rgba(0, 0, 0, 0)' });
  const luzDelIcono = await page.getByTestId('luz-inicio').first().evaluate((n) => {
    const boton = n.closest('button') ?? n.parentElement.parentElement;
    return [...boton.querySelectorAll('[stroke-opacity]')].some((p) => Number(p.getAttribute('stroke-opacity')) < 0.3);
  });
  chequear('la pestaña prendida emite', luzDelIcono, true);

  // ---- ENTRENANDO ----
  await iniciar.click({ timeout: 30000 });
  for (let i = 0; i < 8 && (await ceremonia.count()) > 0; i++) {
    await page.mouse.click(195, 420);
    await page.waitForTimeout(800);
  }
  const mas = page.getByLabel(TX.inicio.sumarSerie).first();
  await mas.waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  chequear('entrenando: ninguna sombra negra y ningún borde fino', await mirar(), { negras: [], finos: [] });
  // Las cifras de Stats perdieron su caja (2/11): la superficie se mira en las que quedan.
  chequear('las cajas llevan superficie con luz de arriba', await page.locator('[id="superficie"]').count() > 0, true);
  await page.getByText('×3', { exact: true }).first().click({ timeout: 20000 });
  await page.waitForTimeout(300);
  await mas.click();
  await page.waitForTimeout(900);

  // ---- EL DESCANSO ----
  await page.getByTestId('pildora-descanso').first().click({ timeout: 20000 });
  await page.getByTestId('descanso-reloj').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(700);
  chequear('el descanso: ninguna sombra negra y ningún borde fino', await mirar(), { negras: [], finos: [] });
  const neblina = await page.locator('#neblina').first().evaluate((n) => {
    const c = n.ownerSVGElement.getBoundingClientRect();
    return { llena: c.width >= innerWidth - 2 && c.height >= innerHeight - 2 };
  });
  chequear('la neblina ocupa toda la pantalla', neblina, { llena: true });
  await page.getByText(TX.descanso.saltar, { exact: true }).last().click({ timeout: 8000 });
  await page.waitForTimeout(700);

  // ---- STATS ----
  await page.getByText(TX.nav.stats, { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(1800);
  chequear('Stats: ninguna sombra negra y ningún borde fino', await mirar(), { negras: [], finos: [] });
  void sombraDe;
} finally {
  await nav.close();
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  const { error } = await borrarCuentaDePrueba(s);
  if (error) console.log('No se pudo borrar la cuenta:', error.message);
}
console.log(fallos ? `\n${fallos} fallas` : '\nLuz de color y bordes de 1 pt: bien');
process.exit(fallos ? 1 : 0);
