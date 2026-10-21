// LA SEGUNDA SESIÓN DEL MISMO DÍA SIGUE LA RUTINA (20/10): rutina del día A, B y C; una sesión
// cambiando A por X; la siguiente sesión de ese mismo día tiene que proponer B, no A.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y una rutina guardada con
// press de banca, sentadilla y remo con barra todos los días: se empieza (propone press), se
// cambia por press inclinado, una serie, se termina y se cierra la ventana de reemplazo sin
// contestar; se empieza otra sesión y tiene que proponer sentadilla.
//
//   node --env-file=.env.local supabase/probar-sesion-siguiente.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'sesion-siguiente');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-sig-${sello}@gmail.com`;
const clave = `Sg-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `sig_${sello.slice(-6)}` }).eq('id', uid);
// El día de hoy en Montevideo, que es el reloj del navegador de la prueba: «Reemplazar» toca ese.
const hoy = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Montevideo' }).format(new Date()));
const delDia = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3 }, { ejercicio: 'sentadilla', series: 3 }, { ejercicio: 'remo_barra', series: 3 }] };
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Entrenamiento 1', p_dias: Array.from({ length: 7 }, () => delDia) });
if (eRutina) console.log('  --   no se guardó la rutina: ' + eRutina.message);

console.log('La segunda sesión del día propone el siguiente de la rutina');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
const ejercicio = () => page.getByText(/^(Press de banca|Press inclinado|Sentadilla|Remo con barra) · /).first().innerText({ timeout: 30000 });
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });

  // Primera sesión: propone A (press de banca) y se cambia por X (press inclinado).
  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.getByText(/^Press de banca · /).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  chequear('la primera sesión propone A (press de banca)', (await ejercicio()).split(' · ')[0], 'Press de banca');
  await page.getByText(/^Press de banca · /).first().click();
  await page.getByTestId('buscar-ejercicio').first().fill('Press inclinado', { timeout: 30000 });
  await page.waitForTimeout(800);
  await texto('Press inclinado').click({ timeout: 30000 });
  await page.getByText(/^Press inclinado · /).first().waitFor({ timeout: 30000 });
  await page.getByLabel('Sumar una serie').first().click();
  await page.waitForTimeout(2000);
  await texto('Terminar').click({ timeout: 30000 });
  await texto('Terminar').click({ timeout: 30000 });
  await page.getByText(/Listo por hoy/i).first().waitFor({ timeout: 60000 });
  // La ventana de reemplazo se cierra sin contestar (tocando afuera).
  const ventana = await page.getByTestId('ventana-rutina').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  if (ventana) {
    await page.mouse.click(195, 40);
    await page.getByTestId('ventana-rutina').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  }
  await page.waitForTimeout(1500);

  // Segunda sesión, el mismo día: tiene que proponer B (sentadilla).
  await texto('Iniciar entrenamiento').click({ timeout: 60000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(3000);
  const propone = (await ejercicio()).split(' · ')[0];
  await page.screenshot({ path: join(SALIDA, 'segunda.png') });
  chequear('la segunda sesión del mismo día propone B (sentadilla), no A', propone, 'Sentadilla');
  const { data: rutinas } = await s.rpc('mis_rutinas');
  chequear('sin contestar la ventana, la rutina guardada quedó igual', (rutinas ?? []).map((r) => (r.dias?.[hoy]?.ejercicios ?? []).map((e) => e.ejercicio)), [['press_banca', 'sentadilla', 'remo_barra']]);

  // Y SI EN ESA SEGUNDA SE CAMBIA B POR OTRO (20/10, revisión): «Reemplazar» lo pone en el lugar
  // de B. Antes lo ponía en el de A, que ya se había cubierto en la primera.
  await page.getByText(/^Sentadilla · /).first().click();
  await page.getByTestId('buscar-ejercicio').first().fill('Dominadas', { timeout: 30000 });
  await page.waitForTimeout(800);
  await texto('Dominadas').click({ timeout: 30000 });
  await page.getByText(/^Dominadas · /).first().waitFor({ timeout: 30000 });
  await page.getByLabel('Sumar una serie').first().click();
  await page.waitForTimeout(2000);
  await texto('Terminar').click({ timeout: 30000 });
  await texto('Terminar').click({ timeout: 30000 });
  await page.getByTestId('ventana-rutina').first().waitFor({ timeout: 30000 });
  await page.getByTestId('ventana-rutina-reemplazar').first().click();
  await page.getByTestId('ventana-rutina-si').first().click({ timeout: 15000 });
  await page.getByTestId('ventana-rutina').first().waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(1500);
  const { data: despues } = await s.rpc('mis_rutinas');
  chequear('«Reemplazar» en la segunda sesión cambia B, no A', (despues ?? []).map((r) => (r.dias?.[hoy]?.ejercicios ?? []).map((e) => e.ejercicio)), [['press_banca', 'dominadas', 'remo_barra']]);
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
