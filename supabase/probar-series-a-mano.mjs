// LAS SERIES A MANO (26/10, a pedido): además de ×2…×5, un «+» para escribir cuántas, como
// el del descanso.
//
// En la vista web de la nativa (:8090), con una cuenta descartable: se empieza a entrenar,
// se toca «+», se escribe 7 y «Usar»; la píldora ×7 aparece elegida y la cuenta dice «0 de 7».
// Y un número que no va (0) deja «Usar» apagado.
//
//   node --env-file=.env.local supabase/probar-series-a-mano.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'series-a-mano');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-sm-${sello}@gmail.com`;
const clave = `Sm-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `sm_${sello.slice(-6)}` }).eq('id', uid);

console.log('Las series a mano');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto(TX.inicio.iniciarEntrenamiento).click({ timeout: 120000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);

  await page.getByTestId('meta-a-mano').first().click({ timeout: 30000 });
  const campo = page.getByTestId('meta-a-mano-campo').first();
  await campo.fill('0');
  const apagadoConCero = await page.getByTestId('meta-a-mano-usar').first().getAttribute('aria-disabled');
  await campo.fill('7');
  await page.getByTestId('meta-a-mano-usar').first().click({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SALIDA, 'siete.png') });
  chequear('con 0 «Usar» no anda; con 7, queda ×7 y la cuenta dice 0 de 7, y el campo se cierra', [
    apagadoConCero,
    await texto('×7').isVisible(),
    await page.getByLabel(TX.sesion.deMeta(0, 7), { exact: true }).count() > 0,
    await page.getByTestId('meta-a-mano-campo').count(),
  ], ['true', true, true, 0]);
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
