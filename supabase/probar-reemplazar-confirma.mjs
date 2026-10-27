// «REEMPLAZAR» CONFIRMA CON LA RUTINA ENTERA (26/10, a pedido): antes de guardar, la ventana
// lista cómo va a quedar toda la rutina, con «¿Estás seguro?», sí y no. «No» vuelve sin
// cambiar nada; «Sí» guarda tal cual se mostró.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y una rutina con press de
// banca y sentadilla hoy, remo con barra el resto de los días y el día siguiente de descanso:
// se cambia el press por dominadas, una serie, se termina y se toca «Reemplazar».
//
//   node --env-file=.env.local supabase/probar-reemplazar-confirma.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'reemplazar-confirma');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-rc-${sello}@gmail.com`;
const clave = `Rc-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `rc_${sello.slice(-6)}` }).eq('id', uid);
const hoy = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Montevideo' }).format(new Date()));
const manana = (hoy + 1) % 7;
const dias = Array.from({ length: 7 }, (_, d) =>
  d === hoy
    ? { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3 }, { ejercicio: 'sentadilla', series: 3 }] }
    : d === manana
      ? { descanso: true, ejercicios: [] }
      : { descanso: false, ejercicios: [{ ejercicio: 'remo_barra', series: 4 }] },
);
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Entrenamiento 1', p_dias: dias });
if (eRutina) console.log('  --   no se guardó la rutina: ' + eRutina.message);
const guardada = async () => ((await s.rpc('mis_rutinas')).data ?? []).map((r) => r.dias.map((d) => (d.descanso ? 'descanso' : d.ejercicios.map((e) => `${e.ejercicio}×${e.series}`).join(','))));

console.log('«Reemplazar» confirma con la rutina entera');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.getByText(/^Press de banca · /).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByText(/^Press de banca · /).first().click();
  await page.getByTestId('buscar-ejercicio').first().fill('Dominadas', { timeout: 30000 });
  await page.waitForTimeout(800);
  await texto('Dominadas').click({ timeout: 30000 });
  await page.getByText(/^Dominadas · /).first().waitFor({ timeout: 30000 });
  await page.getByLabel('Sumar una serie').first().click();
  await page.waitForTimeout(2000);
  await texto('Terminar').click({ timeout: 30000 });
  await texto('Terminar').click({ timeout: 30000 });
  await page.getByTestId('ventana-rutina').first().waitFor({ timeout: 30000 });
  const antes = await guardada();

  await page.getByTestId('ventana-rutina-reemplazar').first().click();
  const lista = page.getByTestId('ventana-rutina-lista').first();
  await lista.waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SALIDA, 'confirmar.png') });
  const dice = (await lista.innerText()).replace(/\s+/g, ' ');
  console.log('  --   la lista: ' + dice.slice(0, 220));
  chequear('la confirmación lista la semana entera: lo nuevo de hoy, lo de los otros días y el descanso', [
    dice.includes('Dominadas'), dice.includes('Sentadilla'), dice.includes('Remo con barra'), dice.includes('Descanso'), dice.includes('Press de banca'),
    await texto('¿Estás seguro?').isVisible(),
  ], [true, true, true, true, false, true]);

  await page.getByTestId('ventana-rutina-no').first().click();
  await page.getByTestId('ventana-rutina-reemplazar').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  chequear('«No» vuelve a la pregunta y la rutina guardada no cambió', [await page.getByTestId('ventana-rutina-lista').count(), await guardada()], [0, antes]);

  await page.getByTestId('ventana-rutina-reemplazar').first().click();
  await page.getByTestId('ventana-rutina-si').first().click({ timeout: 15000 });
  await page.getByTestId('ventana-rutina').first().waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(1500);
  const despues = await guardada();
  // Dominadas con la serie que se hizo: la lista la muestra con un bloque.
  chequear('«Sí» guarda tal cual se mostró: hoy dominadas (1 serie) y sentadilla, el resto igual', [
    despues[0]?.[hoy], despues[0]?.[manana], despues[0]?.filter((d, i) => i !== hoy && i !== manana).every((d) => d === 'remo_barra×4'),
  ], ['dominadas×1,sentadilla×3', 'descanso', true]);
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
