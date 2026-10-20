// LAS REPETICIONES DE LA ÚLTIMA VEZ (20/10): un ajuste apagado de fábrica. Prendido, al
// entrenar sale debajo del ejercicio la última marca de ese ejercicio con sus repeticiones.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y una marca de press de
// banca de ayer (62,5 kg × 5): se empieza a entrenar press de banca y la línea no está; se
// prende en Ajustes, se vuelve a Inicio y está, con las 5 repeticiones; se apaga y se va.
//
//   node --env-file=.env.local supabase/probar-reps-ultima-vez.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(7);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'reps-ultima-vez');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-reps-${sello}@gmail.com`;
const clave = `Rv-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `rep_${sello.slice(-6)}` }).eq('id', uid);
// Ayer, en Montevideo: el reloj del navegador de la prueba.
const ayer = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - 86400000));
const { error: eMarca } = await s.from('prs').insert({ user_id: uid, ejercicio: 'press_banca', peso: 62.5, reps: 5, es_real: false, fecha: ayer });
if (eMarca) console.log('  --   no se guardó la marca: ' + eMarca.message);

console.log('Las repeticiones de la última vez, con el ajuste');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
const linea = () => page.getByTestId('reps-ultima-vez').first().innerText({ timeout: 4000 }).catch(() => null);
// LA SESIÓN DE AYER, INYECTADA (20/10). Desde el pedido 3 las repeticiones son las de la marca
// guardada el día de la última sesión del ejercicio, y las sesiones solo se escriben por RPC y
// con la fecha de hoy: al historial que pide la app al empezar se le suma una de ayer con press
// de banca. La marca de ayer sí está en la base de verdad.
await page.route(
  (u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs!inner'),
  async (route) => {
    const r = await route.fetch();
    const filas = await r.json().catch(() => []);
    filas.push({ bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 62.5, 62.5], carga: 'total' }], logs: { fecha: ayer } });
    await route.fulfill({ response: r, json: filas });
  }
);
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);
  // Con la sesión de ayer, la app ya propone press de banca; si no, se elige.
  if (await texto('Cualquier cosa').isVisible().catch(() => false)) {
    await texto('Cualquier cosa').click({ timeout: 60000 });
    await page.waitForTimeout(1200);
    await texto('Press de banca').click({ timeout: 60000 });
  }
  await page.getByText(/^Press de banca/).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  chequear('apagado de fábrica: no sale', await linea(), null);

  await texto('Ajustes').click({ timeout: 30000 });
  const llave = page.getByLabel('Repeticiones de la última vez').first();
  await llave.scrollIntoViewIfNeeded({ timeout: 30000 });
  await llave.click();
  await page.waitForTimeout(800);
  await texto('Inicio').click({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const dice = await linea();
  await page.screenshot({ path: join(SALIDA, 'prendido.png') });
  chequear('prendido: la última marca de press, con sus repeticiones', dice ? /^Repeticiones la última vez, \d+ de \S+: 5 con 62,5 kg$/.test(dice) : dice, true);

  await texto('Ajustes').click({ timeout: 30000 });
  await page.getByLabel('Repeticiones de la última vez').first().click();
  await page.waitForTimeout(800);
  await texto('Inicio').click({ timeout: 30000 });
  await page.waitForTimeout(1500);
  chequear('apagado otra vez: se va', await linea(), null);
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
