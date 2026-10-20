// «OLVIDAR ESTE DÍA» EN LA VENTANA DE REEMPLAZO (20/10): no toca la rutina guardada y ese
// día la ventana no vuelve a preguntar.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y una rutina guardada con
// hoy vacío (el resto de los días, remo): se entrena press de banca, se termina, sale la
// ventana y se toca «Olvidar este día». La base tiene que tener la misma rutina (una sola, con
// hoy vacío). Una segunda sesión el mismo día, con press otra vez, ya no pregunta.
//
//   node --env-file=.env.local supabase/probar-olvidar-dia.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'olvidar-dia');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-olv-${sello}@gmail.com`;
const clave = `Ol-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `olv_${sello.slice(-6)}` }).eq('id', uid);
// El día de hoy en Montevideo, que es el reloj del navegador de la prueba.
const hoy = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Montevideo' }).format(new Date()));
const dias = Array.from({ length: 7 }, (_, d) => (d === hoy ? { descanso: false, ejercicios: [] } : { descanso: false, ejercicios: [{ ejercicio: 'remo_barra', series: 3 }] }));
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Entrenamiento 1', p_dias: dias });
if (eRutina) console.log('  --   no se guardó la rutina: ' + eRutina.message);
const rutinasEnLaBase = async () => {
  const { data } = await s.rpc('mis_rutinas');
  return (data ?? []).map((r) => [r.nombre, (r.dias?.[hoy]?.ejercicios ?? []).map((e) => e.ejercicio)]);
};

console.log('«Olvidar este día» no toca la rutina y ese día no vuelve a preguntar');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
async function sesionDePress() {
  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);
  if (await texto('Cualquier cosa').isVisible().catch(() => false)) {
    await texto('Cualquier cosa').click({ timeout: 60000 });
    await page.waitForTimeout(1200);
    await texto('Press de banca').click({ timeout: 60000 });
    await page.waitForTimeout(1500);
  }
  await page.getByLabel('Sumar una serie').first().click();
  await page.waitForTimeout(1500);
  const no = page.getByText('No', { exact: true }).first();
  if (await page.getByText(/La guardo como marca/i).first().isVisible().catch(() => false)) await no.click().catch(() => {});
  await texto('Terminar').click({ timeout: 30000 });
  await texto('Terminar').click({ timeout: 30000 });
  await page.getByText(/Listo por hoy/i).first().waitFor({ timeout: 60000 });
}
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await sesionDePress();
  await page.getByTestId('ventana-rutina').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SALIDA, 'ventana.png') });
  chequear('la ventana tiene «Olvidar este día» aparte, al final', (await page.getByTestId('ventana-rutina').first().innerText()).trim().split('\n').at(-1), 'Olvidar este día');
  await page.getByTestId('ventana-rutina-olvidar').first().click();
  await page.getByTestId('ventana-rutina').first().waitFor({ state: 'detached', timeout: 15000 });
  await page.waitForTimeout(1500);
  chequear('la rutina guardada no cambió: una sola, con hoy vacío', await rutinasEnLaBase(), [['Entrenamiento 1', []]]);

  // Otra sesión el mismo día, con el mismo cambio: la ventana no vuelve a salir.
  await page.getByText(/Listo por hoy/i).first().waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sesionDePress();
  const volvio = await page.getByTestId('ventana-rutina').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  chequear('el mismo día, otra sesión con lo mismo: no vuelve a preguntar', volvio, false);
  const { data: sesiones } = await s.from('sesiones').select('id').eq('user_id', uid);
  chequear('las dos sesiones quedaron en la base', (sesiones ?? []).length, 2);
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
