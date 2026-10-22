// EL PESO MÁXIMO CON SUS REPETICIONES (21/10). Las repeticiones se anotaban y no se veían en
// ningún lado: ahora, en Stats → Entrenamiento, cada ejercicio dice su máximo y con cuántas.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y una marca de verdad en la
// base (press de banca, 90 kg × 5): la fila de press de banca dice «90 kg × 5».
//
//   node --env-file=.env.local supabase/probar-maximo-reps.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'maximo-reps');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-mr-${sello}@gmail.com`;
const clave = `Mr-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `mr_${sello.slice(-6)}` }).eq('id', uid);
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date());
const { error: eMarca } = await s.from('prs').insert({ user_id: uid, ejercicio: 'press_banca', peso: 90, reps: 5, es_real: false, fecha: hoy });
if (eMarca) console.log('  --   no se guardó la marca: ' + eMarca.message);

console.log('El peso máximo con sus repeticiones');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await page.getByRole('tab', { name: /^Stats/ }).first().click({ timeout: 120000 });
  await texto('Entrenamiento').click({ timeout: 30000 });
  await page.waitForTimeout(1500);
  // El grupo de los del DOTS ya viene abierto: tiene un máximo.
  const fila = page.getByText('Press de banca', { exact: true }).filter({ visible: true }).first().locator('xpath=ancestor::div[2]');
  await fila.waitFor({ timeout: 15000 });
  await page.screenshot({ path: join(SALIDA, 'stats.png') });
  const dice = (await fila.innerText()).replace(/\s+/g, ' ');
  chequear('la fila de press de banca dice el máximo y con cuántas repeticiones', dice.includes('90 kg × 5'), true);
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
