// LOS BOTONES DE INICIO, CON LAS ESQUINAS CORTADAS EN DIAGONAL (21/10, a pedido). Eran
// rectángulos casi rectos; ahora un octágono dibujado detrás (`FondoOctogonal`).
//
// En la vista web de la nativa (:8090), con una cuenta descartable: «Registra tu primer día»,
// y entrenando el +, el − y «Terminar». Cada uno tiene su octágono de ocho puntas con la
// esquina cortada, y el botón ya no pinta un fondo rectangular propio.
//
//   node --env-file=.env.local supabase/probar-octogonos.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'octogonos');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-oc-${sello}@gmail.com`;
const clave = `Oc-${sello}-Kp3`;
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `oc_${sello.slice(-6)}` }).eq('id', uid);

console.log('Los botones de Inicio, en octágono');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
// El botón que contiene ese texto o esa etiqueta: su octágono (puntas, primera x) y si pinta fondo propio.
const forma = (loc) =>
  loc.evaluate((el) => {
    let b = el;
    while (b && !b.querySelector?.('[data-testid="fondo-octogonal"]')) b = b.parentElement;
    if (!b) return null;
    const p = b.querySelector('[data-testid="fondo-octogonal"] polygon');
    const pts = (p?.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean);
    const fondo = getComputedStyle(b).backgroundColor;
    return { puntas: pts.length, corta: Number((pts[0] ?? '0').split(',')[0]) > 0, fondoPropio: !/rgba\(0, 0, 0, 0\)|transparent/.test(fondo) };
  });
const octogono = { puntas: 8, corta: true, fondoPropio: false };

try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto(TX.inicio.registrarPrimerDia).waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SALIDA, 'inicio.png') });
  chequear('«Registra tu primer día»: octágono, sin el rectángulo de antes', await forma(texto(TX.inicio.registrarPrimerDia)), octogono);

  await texto(TX.inicio.iniciarEntrenamiento).click({ timeout: 30000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SALIDA, 'entrenando.png') });
  chequear('entrenando, el + y el −: octágonos', [await forma(page.getByLabel(TX.inicio.sumarSerie).first()), await forma(page.getByLabel(TX.inicio.sacarSerie).first())], [octogono, octogono]);
  chequear('y «Terminar»', await forma(texto(TX.sesion.terminar)), octogono);
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
