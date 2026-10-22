// «TU RUTINA» EN STATS NO APARECE DE GOLPE (21/10, a pedido). Entrenamiento recién la pedía al
// abrirse —tres viajes seguidos— y no dibujaba nada mientras tanto: aparecía después y empujaba
// lo de abajo. Ahora Stats la pide junto con lo suyo.
//
// En la vista web de la nativa (:8090), con una cuenta descartable que tiene una rutina guardada:
// se entra a Stats, se espera a que cargue, y al tocar «Entrenamiento» la rutina ya está en el
// primer momento, y el título de abajo («Series por músculo») no se mueve en los segundos de
// después.
//
//   node --env-file=.env.local supabase/probar-rutina-stats.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'rutina-stats');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-rs-${sello}@gmail.com`;
const clave = `Rs-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `rs_${sello.slice(-6)}` }).eq('id', uid);
const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 4 }, { ejercicio: 'sentadilla', series: 3 }] }));
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Prueba', p_dias: dias });
if (eRutina) console.log('  --   no se guardó la rutina: ' + eRutina.message);

console.log('«Tu rutina» en Stats, sin aparecer de golpe');
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
  await texto(TX.volumen.maximos).waitFor({ state: 'attached', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await texto('Entrenamiento').click({ timeout: 30000 });
  await page.waitForTimeout(150);
  const rutinaEnSeguida = await page.getByTestId('mi-rutina').filter({ visible: true }).count();
  const titulo = page.getByText(TX.volumen.titulo, { exact: true }).filter({ visible: true }).first();
  const y1 = (await titulo.boundingBox())?.y ?? null;
  await page.waitForTimeout(3000);
  const y2 = (await titulo.boundingBox())?.y ?? null;
  await page.screenshot({ path: join(SALIDA, 'entrenamiento.png') });
  chequear('al tocar «Entrenamiento», la rutina ya está, y lo de abajo no se mueve después', [rutinaEnSeguida > 0, y1 !== null && y1 === y2], [true, true]);
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
