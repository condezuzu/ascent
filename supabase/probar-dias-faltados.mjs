// LOS DÍAS FALTADOS DEL AÑO EN STATS (26/10, a pedido): con las vidas al máximo, donde estaba
// el ✓ de «Vidas al máximo», va cuántos días de este año la rutina decía de entrenar y no se fue.
//
// En la vista web de la nativa (:8090), con una cuenta descartable: veinticinco días seguidos
// hasta ayer (las tres vidas) y una rutina guardada hoy. La rutina recién empieza a contar desde
// hoy, así que la celda dice 0, y no hay ningún ✓. Necesita la migración 97: sin ella, avisa y
// no prueba nada.
//
//   node --env-file=.env.local supabase/probar-dias-faltados.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'dias-faltados');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-df-${sello}@gmail.com`;
const clave = `Df-${sello}-Kp3`;
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
console.log('Los días faltados del año en Stats');
const { data: version } = await s.rpc('version_del_esquema');
if ((version ?? 0) < 97) {
  console.log(`  --   la base está en la ${version}: sin la migración 97 no hay días faltados que mirar`);
  process.exit(0);
}
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `df_${sello.slice(-6)}` }).eq('id', uid);
const dia = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - n * 86400000));
for (let n = 25; n >= 1; n--) await s.from('logs').insert({ user_id: uid, fecha: dia(n) });
const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3 }] }));
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Prueba', p_dias: dias });
if (eRutina) console.log('  --   no se guardó la rutina: ' + eRutina.message);
const { data: sem } = await s.from('rutina_semanas').select('desde, entrena');
chequear('guardar la rutina la anotó desde hoy, con los siete días', (sem ?? []).map((r) => [r.desde, r.entrena]), [[dia(0), [0, 1, 2, 3, 4, 5, 6]]]);

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
  await page.getByTestId('vidas-stats').filter({ visible: true }).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SALIDA, 'stats.png'), fullPage: true });
  const rotulo = page.getByText(TX.stats.diasFaltados, { exact: true }).filter({ visible: true });
  const valor = (await rotulo.count()) ? await rotulo.first().locator('xpath=preceding-sibling::*[1]').innerText() : null;
  chequear('con las vidas al máximo, la cuarta celda son los días faltados (0: la rutina cuenta desde hoy) y no hay ✓', [valor, await page.getByText('✓', { exact: true }).filter({ visible: true }).count()], ['0', 0]);
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
