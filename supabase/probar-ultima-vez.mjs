// «MOSTRAR LA ÚLTIMA VEZ» (20/10): un ajuste apagado de fábrica. Prendido, al entrar a
// entrenar sale debajo del ejercicio lo que se hizo la última sesión que lo tuvo; apagado, nada.
//
// En la vista web de la nativa (:8090), con una cuenta descartable, una sesión de ayer con press
// de banca y la marca de esa sesión (62,5 kg × 5): se empieza a entrenar (la app propone press)
// y no sale nada; se prende en Ajustes, se empieza otra vez y está; se apaga y se va.
//
// LA SESIÓN DE AYER SE INYECTA en la respuesta del historial: las sesiones solo se escriben por
// RPC y con la fecha de hoy. La marca de ayer sí está en la base de verdad.
//
//   node --env-file=.env.local supabase/probar-ultima-vez.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'ultima-vez');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-uv-${sello}@gmail.com`;
const clave = `Uv-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `uv_${sello.slice(-6)}` }).eq('id', uid);
// Ayer, en Montevideo: el reloj del navegador de la prueba.
const ayer = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - 86400000));
const { error: eMarca } = await s.from('prs').insert({ user_id: uid, ejercicio: 'press_banca', peso: 62.5, reps: 5, es_real: false, fecha: ayer });
if (eMarca) console.log('  --   no se guardó la marca: ' + eMarca.message);

console.log('«Mostrar la última vez», con el ajuste');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
const lineas = async () => {
  const leer = (id) => page.getByTestId(id).first().innerText({ timeout: 3000 }).catch(() => null);
  return [await leer('ultima-vez'), await leer('reps-ultima-vez')].filter(Boolean);
};
await page.route(
  (u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs!inner'),
  async (route) => {
    const r = await route.fetch();
    const filas = await r.json().catch(() => []);
    filas.push({ bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 62.5, 62.5], carga: 'total' }], logs: { fecha: ayer } });
    await route.fulfill({ response: r, json: filas });
  }
);
// Empieza a entrenar y espera el ejercicio propuesto (press, por la sesión de ayer).
async function entrar() {
  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.getByText(/^Press de banca/).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
}
async function terminar() {
  await texto('Terminar').click({ timeout: 30000 });
  await texto('Terminar').click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 120000 });
}
async function llave() {
  await texto('Ajustes').click({ timeout: 30000 });
  const l = page.getByLabel('Mostrar la última vez').first();
  await l.scrollIntoViewIfNeeded({ timeout: 30000 });
  await l.click();
  await page.waitForTimeout(800);
  await texto('Inicio').click({ timeout: 30000 });
  await page.waitForTimeout(1200);
}
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await entrar();
  chequear('apagado de fábrica: al entrar a entrenar no sale', await lineas(), []);
  await terminar();

  await llave();
  await entrar();
  const dice = await lineas();
  await page.screenshot({ path: join(SALIDA, 'prendido.png') });
  chequear('prendido: al entrar a entrenar sale la última vez del ejercicio propuesto', dice.length > 0 && /^La última vez, \d+ de \S+: /.test(dice[0]), true);

  await llave();
  chequear('apagado otra vez: se va', await lineas(), []);
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
