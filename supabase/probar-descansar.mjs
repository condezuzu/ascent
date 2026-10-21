// EL BOTÓN «DESCANSAR» LLEVA AL CRONÓMETRO GRANDE, SIN ARRANCAR (21/10, a pedido). Antes
// arrancaba un descanso en el acto: para cambiar los minutos había que cambiar uno que ya corría.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y un entrenamiento andando:
// «Descansar» abre la pantalla grande con el reloj quieto y sin descanso en la píldora; elegir
// 90 s cambia el reloj sin arrancarlo; «Empezar descanso» lo arranca (la píldora cuenta); y
// «Cancelar» desde la pantalla quieta no arranca nada.
//
//   node --env-file=.env.local supabase/probar-descansar.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'descansar');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-de-${sello}@gmail.com`;
const clave = `De-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `de_${sello.slice(-6)}` }).eq('id', uid);

console.log('«Descansar» lleva al cronómetro grande sin arrancar');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
const reloj = () => page.getByTestId('descanso-reloj').last().innerText().then((t) => t.trim()).catch(() => null);
const pildora = () => page.getByTestId('pildora-descanso').count();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto(TX.inicio.iniciarEntrenamiento).click({ timeout: 120000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);

  await page.getByTestId('boton-descansar').first().click({ timeout: 30000 });
  await page.getByTestId('descanso-empezar').first().waitFor({ timeout: 15000 });
  const a = await reloj();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(SALIDA, 'quieto.png') });
  chequear('«Descansar» abre la pantalla grande con el reloj quieto, y no arranca ningún descanso', [a === (await reloj()), await pildora()], [true, 0]);
  await texto('90 s').click({ timeout: 15000 });
  await page.waitForTimeout(800);
  chequear('elegir 90 s cambia el reloj sin arrancarlo', [await reloj(), await pildora()], ['1:30', 0]);

  await page.getByTestId('descanso-empezar').first().click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  chequear('«Empezar descanso» lo arranca con los 90 s: cuenta para atrás y está en la píldora', [await pildora(), (await reloj()) < '1:30'], [1, true]);
  await page.getByText('✕', { exact: true }).last().click({ timeout: 15000 });
  await page.waitForTimeout(800);
  // Se corta este y se prueba el «Cancelar» desde la pantalla quieta.
  await page.getByTestId('pildora-descanso').first().click({ timeout: 15000 });
  await page.waitForTimeout(800);
  await texto(TX.descanso.seguir).click({ timeout: 15000 }).catch(async () => {
    await page.getByText('✕', { exact: true }).last().click();
  });
  await page.waitForTimeout(1200);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
  await page.screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();

// «Cancelar» con otra cuenta y otro entrenamiento: la pantalla quieta no deja nada andando.
const s2 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo2 = `agusconde20+ascent-de2-${sello}@gmail.com`;
await s2.auth.signUp({ email: correo2, password: clave });
await s2.from('profiles').update({ username: `d2_${sello.slice(-6)}` }).eq('id', (await s2.auth.getUser()).data.user.id);
const nav2 = await chromium.launch();
const page2 = await (await nav2.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
try {
  await page2.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page2);
  await page2.locator('input[type=email], input[inputmode=email]').first().fill(correo2, { timeout: 90000 });
  await page2.locator('input[type=password]').first().fill(clave);
  await page2.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page2.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).last().click({ timeout: 120000 });
  await page2.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page2.getByTestId('boton-descansar').first().click({ timeout: 30000 });
  await page2.getByTestId('descanso-empezar').first().waitFor({ timeout: 15000 });
  await page2.getByText(TX.general.cancelar, { exact: true }).last().click({ timeout: 15000 });
  await page2.waitForTimeout(1500);
  chequear('«Cancelar» desde la pantalla quieta no arranca nada', [await page2.getByTestId('pildora-descanso').count(), await page2.getByTestId('boton-descansar').count()], [0, 1]);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
}
await nav2.close();

for (const c of [s, s2]) {
  const { error: eBorrar } = await borrarCuentaDePrueba(c);
  console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
  if (eBorrar) fallos++;
}
process.exit(fallos ? 1 : 0);
