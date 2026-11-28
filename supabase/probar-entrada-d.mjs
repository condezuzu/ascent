// LA ENTRADA D (28/11, la de la galería 31): con sesión, el cuerpo del rango sale del logo y aterriza
// en su lugar de Inicio, del tamaño exacto, que es donde el motor lo está dibujando debajo.
//
// En la vista web de la nativa (:8090), con una cuenta descartable. Para mirar varios rangos sin
// juntar rachas largas se cambia la racha en la respuesta del perfil: lo que llega a la app es lo que
// llegaría de la base con esa racha. Se registra cada cuadro dónde está la foto del cuerpo, y lo último
// antes de irse tiene que ser el lugar y el radio de `nucleo/horizonte.ts` (altura «alta», la de Inicio)
// para ese rango y ese planeta. Deja fotos en capturas/entrada-d/.
//
//   node --env-file=.env.local supabase/probar-entrada-d.mjs [racha…]
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(10);
const AQUI = dirname(fileURLToPath(import.meta.url));
const { cuerpoEn } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'horizonte.ts')).href);
const { cuerpoDe } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'rangos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'entrada-d');
mkdirSync(SALIDA, { recursive: true });
// Polvo, planeta (Marte), sol y agujero negro: un horizonte grande, uno de cada esquina.
const RACHAS = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n));
const rachas = RACHAS.length ? RACHAS : [40, 60, 110, 2];

let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-ed-${sello}@gmail.com`;
const clave = `Ed-${sello}-Kp3`;
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
console.log('La entrada D: el cuerpo aterriza en su lugar de Inicio');
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `ed_${sello.slice(-6)}` }).eq('id', uid);

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
const page = await ctx.newPage();
const errores = [];
page.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 160)));
let racha = 0;
// La racha que la app recibe: Inicio la trae en pantalla_inicio (y el perfil, por las dudas).
const cambiarRacha = (x) => (Array.isArray(x) ? x.map(cambiarRacha) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'racha_actual' ? racha : cambiarRacha(v)])) : x);
for (const patron of ['**/rest/v1/rpc/pantalla_inicio*', '**/rest/v1/profiles*']) {
  await page.route(patron, async (ruta) => {
    const r = await ruta.fetch();
    let cuerpo;
    try { cuerpo = await r.json(); } catch { return ruta.fulfill({ response: r }); }
    return ruta.fulfill({ response: r, json: cambiarRacha(cuerpo) });
  });
}
// Cada cuadro, dónde está la foto del cuerpo y si sigue la entrada.
await page.addInitScript(() => {
  window.__entradaD = [];
  const t0 = performance.now();
  const mirar = () => {
    const f = document.querySelector('[data-testid="entrada-cuerpo"]');
    const e = document.querySelector('[data-testid="entrada-de-la-app"]');
    if (f) {
      const b = f.getBoundingClientRect();
      window.__entradaD.push({ t: Math.round(performance.now() - t0), x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, o: Number(getComputedStyle(f).opacity) });
    }
    if (e || window.__entradaD.length === 0 || performance.now() - t0 < 15000) requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
});
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.getByRole('tab', { name: /^Stats/ }).first().waitFor({ timeout: 120000 });
  for (const r of rachas) {
    racha = r;
    const { rango, planeta } = cuerpoDe(r);
    const c = cuerpoEn(rango, planeta, 'alta');
    const fotos = [];
    // Con la sesión abierta, recargar es abrir la app: la entrada corre con el cuerpo de esa racha.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 240000 });
    // La entrada aparece cuando carga el paquete de la app: recién ahí se empieza a mirar.
    await page.locator('[data-testid="entrada-de-la-app"]').first().waitFor({ state: 'attached', timeout: 120000 });
    const t0 = Date.now();
    while (Date.now() - t0 < 7000) {
      const hay = await page.locator('[data-testid="entrada-de-la-app"]').count();
      if (!hay && fotos.length > 2) break;
      const f = join(SALIDA, `r${r}-${String(fotos.length).padStart(2, '0')}.png`);
      await page.screenshot({ path: f });
      fotos.push(f);
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(SALIDA, `r${r}-inicio.png`) });
    const cuadros = (await page.evaluate(() => window.__entradaD)) ?? [];
    // Lo último con la foto entera, antes de que se vaya: tiene que ser el lugar y el radio de Inicio.
    const llegada = cuadros.filter((x) => x.o > 0.9).at(-1);
    const salida = cuadros.find((x) => x.o > 0.9);
    const ancho = llegada?.w;
    console.log(`  racha ${r} → rango ${rango}${planeta ? ' (' + planeta + ')' : ''}: ${cuadros.length} cuadros, ${fotos.length} fotos`);
    chequear(`rango ${rango}: arranca en el logo (centro de la pantalla) y chico`, salida ? [Math.round(salida.x), Math.round(salida.y), salida.w < ancho] : null, [195, 422, true]);
    chequear(`rango ${rango}: aterriza en su lugar de Inicio`, llegada ? [Math.round(llegada.x), Math.round(llegada.y)] : null, [c.x, c.y]);
    // Sale achicada desde el tamaño de Inicio: lo que crece es el radio de Inicio sobre el del planeta del logo.
    chequear(`rango ${rango}: del tamaño de Inicio (la foto se agranda ${c.R > 300 ? 'diez' : 'unas'} veces)`, llegada && salida ? Math.round(llegada.w / salida.w) : null, Math.round(c.R / (26 * (202 / 120))));
    // Y después ya no hay entrada.
    chequear(`rango ${rango}: la entrada se va`, await page.locator('[data-testid="entrada-de-la-app"]').count(), 0);
    racha = 0;
  }
  chequear('sin errores de consola', errores, []);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
  await page.screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();
const { error: eBorrar } = await borrarCuentaDePrueba(s);
console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
if (eBorrar) fallos++;
process.exit(fallos ? 1 : 0);
