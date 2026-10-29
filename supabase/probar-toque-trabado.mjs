// DOS TOQUES CON EL TELÉFONO TRABADO (29/10). La traba del doble toque medía cuándo la app
// atendía cada toque: si el teléfono se trababa más de un segundo, dos toques de verdad se
// atendían juntos al destrabarse y el segundo no contaba. Se perdía una serie. Ahora mide desde
// el toque (movil/src/toques.ts).
//
// En la vista web de la nativa (:8090), con la CPU frenada 4x: se traba la página 2,5 s y en
// el medio caen dos toques en el + a 1,2 s uno del otro. Se comprueba que el caso pasó de
// verdad (la app los atendió a menos de un segundo) y que la pantalla y la base cuentan dos.
// Y que un doble toque de verdad, sin traba, sigue contando uno.
//
//   node --env-file=.env.local supabase/probar-toque-trabado.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const { TOQUE_REPETIDO_MS } = await import(pathToFileURL(join(AQUI, '..', 'movil', 'src', 'toques.ts')).href);
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-tt-${sello}@gmail.com`;
const clave = `Tt-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `tt_${sello.slice(-6)}` }).eq('id', uid);
const enLaBase = async () => (await s.from('sesiones').select('series').eq('user_id', uid).eq('estado', 'corriendo')).data?.[0]?.series ?? null;

console.log('Dos toques con el teléfono trabado');
const nav = await chromium.launch();
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  await page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first().click({ timeout: 120000 });
  const mas = page.getByLabel(TX.inicio.sumarSerie).first();
  await mas.waitFor({ timeout: 90000 });
  // Meta alta: que el + no se vuelva «Terminar serie» en el medio.
  await page.getByText('×5', { exact: true }).first().click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  const patron = new RegExp(TX.sesion.totalHoy(0).replace('0', '\\d+'));
  const total = async () => Number((await page.getByText(patron).first().innerText()).match(/\d+/)[0]);
  const caja = await mas.boundingBox();
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await page.evaluate(() => {
    window.__toques = [];
    document.addEventListener('click', (e) => window.__toques.push({ dedo: e.timeStamp, atendido: performance.now() }), true);
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const antes = await total();
  // La traba: la página no atiende nada por 2,5 s. Los dos toques caen adentro.
  const traba = page.evaluate(() => {
    const t = performance.now();
    while (performance.now() - t < 2500) {}
  });
  await new Promise((r) => setTimeout(r, 150));
  const uno = page.mouse.click(x, y);
  await new Promise((r) => setTimeout(r, 1200));
  const dos = page.mouse.click(x, y);
  await Promise.all([traba, uno, dos]);
  await page.waitForTimeout(2500);
  const t = await page.evaluate(() => window.__toques);
  const entreDedos = Math.round(t[1]?.dedo - t[0]?.dedo);
  const entreAtendidos = Math.round(t[1]?.atendido - t[0]?.atendido);
  console.log(`  --   entre los dedos ${entreDedos} ms, atendidos con ${entreAtendidos} ms de diferencia`);
  chequear('el caso pasó: dos toques a más de un segundo, que la app atendió a menos de uno', [t.length, entreDedos >= TOQUE_REPETIDO_MS, entreAtendidos < TOQUE_REPETIDO_MS], [2, true, true]);
  chequear('la pantalla cuenta las dos series', (await total()) - antes, 2);
  let base = null;
  for (let i = 0; i < 15 && base !== antes + 2; i++) {
    await page.waitForTimeout(1000);
    base = await enLaBase();
  }
  chequear('y la base también', base, antes + 2);

  console.log('Un doble toque de verdad, sin traba');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.waitForTimeout(TOQUE_REPETIDO_MS + 500);
  const antes2 = await total();
  await page.mouse.click(x, y);
  await page.waitForTimeout(250);
  await page.mouse.click(x, y);
  await page.waitForTimeout(2000);
  chequear('dos toques a un cuarto de segundo siguen contando uno', (await total()) - antes2, 1);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
}
await nav.close();
await s.rpc('terminar_sesion');
const { error } = await borrarCuentaDePrueba(s);
if (error) {
  fallos++;
  console.log(`  FALLA cuenta: ${error.message}`);
}
console.log(`  ${fallos ? '' : 'ok   '}cuenta borrada`);
process.exit(fallos ? 1 : 0);
