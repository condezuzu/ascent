// DOBLE TOQUE EN «TERMINAR SERIE» (19/10): el segundo toque caía en el «+» del ejercicio
// siguiente, que aparece en el mismo lugar, y contaba una serie que nadie hizo.
//
// En la vista web de la nativa (:8090), con una cuenta descartable: dos series, y dos toques
// seguidos en el mismo punto de «Terminar serie», como un dedo. La sesión tiene que quedar
// con dos series en la base, no tres.
//
//   node --env-file=.env.local supabase/probar-doble-toque.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';
import { T } from '../nucleo/textos.ts';

limiteDeSonda(6);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'doble-toque');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-doble-${sello}@gmail.com`;
const clave = `Dt-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `dob_${sello.slice(-6)}` }).eq('id', uid);
// Con una rutina guardada, como en el gimnasio: al terminar el press, el bloque que sigue
// viene propuesto (fondos), y su «+» es el que queda debajo del dedo.
const diaDeRutina = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 2 }, { ejercicio: 'fondos', series: 3 }] };
await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Entrenamiento 1', p_dias: Array.from({ length: 7 }, () => diaDeRutina) });

console.log('\nDoble toque en «Terminar serie»');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'networkidle', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email]').first().fill(correo);
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 30000 });
  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);
  if (await texto('Cualquier cosa').isVisible().catch(() => false)) {
    await texto('Cualquier cosa').click({ timeout: 60000 });
    await page.waitForTimeout(1200);
    await texto('Press de banca').click({ timeout: 60000 });
    await page.waitForTimeout(1500);
  }
  await texto('×2').click({ timeout: 60000 });
  await page.waitForTimeout(800);
  const mas = page.getByLabel('Sumar una serie').first();
  for (let i = 0; i < 2; i++) {
    await mas.click();
    await page.waitForTimeout(1500);
  }
  // Si salió la pregunta de la marca, se descarta: es otra cosa.
  const no = page.getByText(T.marcaSugerida.no, { exact: true }).first();
  if (await no.isVisible().catch(() => false)) await no.click();
  await page.waitForTimeout(800);
  const terminar = texto(T.sesion.terminarSerie);
  await terminar.waitFor({ timeout: 15000 });
  const caja = await terminar.boundingBox();
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(Number(process.env.ENTRE_TOQUES_MS ?? 300));
  await page.mouse.click(x, y);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(SALIDA, 'despues.png') });
  console.log('  --   el bloque que siguió: ' + ((await page.getByText(/Fondos|Cualquier cosa/).first().innerText().catch(() => '?')) || '?'));
  const { data } = await s.from('sesiones').select('series').eq('user_id', uid);
  chequear('doble toque en «Terminar serie»: la sesión queda con las dos series que se hicieron', (data ?? []).map((x) => x.series), [2]);
  // Y dos toques seguidos en el «+» del bloque que sigue (lo que hace alguien que creyó que el
  // primero no entró): es una serie, no dos.
  const masAhora = page.getByLabel('Sumar una serie').first();
  const c2 = await masAhora.boundingBox();
  await page.mouse.click(c2.x + c2.width / 2, c2.y + c2.height / 2);
  await page.waitForTimeout(Number(process.env.ENTRE_TOQUES_MS ?? 300));
  await page.mouse.click(c2.x + c2.width / 2, c2.y + c2.height / 2);
  await page.waitForTimeout(4000);
  const { data: d2 } = await s.from('sesiones').select('series').eq('user_id', uid);
  chequear('doble toque en el «+»: suma una serie, no dos', (d2 ?? []).map((x) => x.series), [3]);
} catch (e) {
  fallos++;
  console.log('  FALLA el recorrido: ' + String(e).split('\n')[0].slice(0, 200));
  await page.screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();

const { error: eBorrar } = await borrarCuentaDePrueba(s);
if (eBorrar) {
  fallos++;
  console.log('  FALLA no se borró la cuenta: ' + eBorrar.message);
} else console.log('  ok   cuenta borrada');
process.exit(fallos ? 1 : 0);
