// LA MARCA, SIN PREGUNTAR A CUÁNTAS (6/11, a pedido). Con «Registrar repeticiones» las
// repeticiones ya están en la serie, y preguntarlas otra vez "no tiene sentido". Ahora la serie
// que supera la marca se guarda con las anotadas, sin botones; la que no la supera no dice nada;
// y la que va sin repeticiones se pregunta como siempre.
//
// En la vista web de la nativa (:8090), con una cuenta descartable que tiene una marca de banca
// de 100 kg a una: se prende el ajuste, se pone el peso y se hacen tres series.
//
//   node --env-file=.env.local supabase/probar-marca-sin-preguntar.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'marca-sin-preguntar');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-ms-${sello}@gmail.com`;
const clave = `Ms-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `ms_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
// Las otras dos del DOTS y el peso corporal: así la marca de banca mueve el DOTS y el cajón lo dice.
const { error: eTres } = await s.from('prs').insert([
  { user_id: uid, ejercicio: 'sentadilla', peso: 120, reps: 1, es_real: true, fecha: '2026-10-01' },
  { user_id: uid, ejercicio: 'peso_muerto', peso: 150, reps: 1, es_real: true, fecha: '2026-10-01' },
]);
const { error: ePeso } = await s.rpc('anotar_peso', { p_valor: 80 });
if (eTres || ePeso) console.log('  --   preparación del DOTS: ' + (eTres ?? ePeso).message);
const { redondear } = await import(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'nucleo', 'fuerza.ts')).href);
const dotsAhora = async () => (await s.rpc('mi_fuerza')).data?.dots ?? null;
const { error: eMarca } = await s.from('prs').insert({ user_id: uid, ejercicio: 'press_banca', peso: 100, reps: 1, es_real: true, fecha: '2026-10-01' });
if (eMarca) console.log('  --   no se guardó la marca de antes: ' + eMarca.message);
// Una rutina con banca todos los días: así la sesión arranca en banca, con el campo del peso.
const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3 }] }));
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Entrenamiento 1', p_dias: dias });
if (eRutina) console.log('  --   no se guardó la rutina: ' + eRutina.message);
const marcas = async () =>
  ((await s.from('prs').select('peso, reps').eq('user_id', uid).eq('ejercicio', 'press_banca').order('reps')).data ?? []).map((m) => `${m.peso}×${m.reps}`);

const dotsAntes = await dotsAhora();
console.log('La marca, sin preguntar a cuántas');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
const texto = (t) => page.getByText(t, { exact: true }).last();
const pregunta = () => page.getByText('A cuántas repeticiones:', { exact: true });
const cuadradito = () => page.getByTestId('campo-reps').first();
async function ponerPeso(kg) {
  const campo = page.getByLabel('Peso de las próximas series').first();
  await campo.fill(String(kg), { timeout: 30000 });
  await campo.press('Enter');
  await page.waitForTimeout(500);
}
async function serie(reps) {
  if (reps !== null) await cuadradito().fill(String(reps));
  await page.waitForTimeout(300);
  await page.getByLabel('Sumar una serie').first().click({ timeout: 30000 });
  // Lo que tarda: pedir las marcas (la primera vez) y guardar.
  await page.waitForTimeout(3500);
}
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.getByText(/^Press de banca/).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);

  await texto('Ajustes').click({ timeout: 30000 });
  const llave = page.getByRole('switch', { name: 'Registrar repeticiones' }).first();
  await llave.scrollIntoViewIfNeeded({ timeout: 30000 });
  await llave.click();
  await page.waitForTimeout(800);
  await texto('Inicio').click({ timeout: 30000 });
  await cuadradito().waitFor({ timeout: 30000 });
  await ponerPeso(100);

  await serie(5);
  await page.screenshot({ path: join(SALIDA, 'marca-nueva.png') });
  // EL CAJÓN (16/11): tapa la racha y las vidas, dice la marca y cuánto subió el DOTS, y se va solo a los 5 s.
  const cajon = page.getByTestId('cajon-de-marca');
  const dotsDespues = await dotsAhora();
  chequear('el DOTS de la cuenta subió con la marca', dotsAntes !== null && dotsDespues > dotsAntes, true);
  chequear('el cajón: marca nueva, el ejercicio y los DOTS que subió',
    (await cajon.count()) ? (await cajon.first().innerText()).split('\n').map((l) => l.trim()).filter(Boolean) : null,
    ['MARCA NUEVA', 'Press de banca', `+${redondear(dotsDespues - dotsAntes)} puntos DOTS`]);
  chequear('la marca nueva no se repite en el recuadro del bloque', await page.getByText('Guardada. Es tu marca nueva.').count(), 0);
  await page.waitForTimeout(3500);
  chequear('a los 5 s se fue solo', await cajon.count(), 0);
  chequear('100 × 5 anotado supera la marca de 100: no pregunta a cuántas', await pregunta().count(), 0);
  chequear('y la guarda con las repeticiones anotadas', await marcas(), ['100×1', '100×5']);

  await serie(1);
  await page.screenshot({ path: join(SALIDA, 'sin-marca.png') });
  chequear('100 × 1 no supera los 100 × 5 de recién: ni pregunta ni guarda', [await pregunta().count(), await marcas()], [0, ['100×1', '100×5']]);

  await ponerPeso(105);
  // Las repes quedan escritas de la serie anterior (26/11): para que vaya sin repeticiones hay que borrarlas.
  await serie('');
  await pregunta().first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: join(SALIDA, 'pregunta.png') });
  chequear('sin repeticiones anotadas, pregunta como siempre', await pregunta().count(), 1);
  // El «No» de la pregunta, no otro: hay pantallas montadas atrás con el suyo.
  await pregunta().first().locator('xpath=..').getByText('No', { exact: true }).click({ timeout: 10000 });
  await page.waitForTimeout(600);
  chequear('y «No» la cierra', await pregunta().count(), 0);
  chequear('sin errores de la página', errores, []);
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
