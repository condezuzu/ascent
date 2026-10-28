// ANOTAR EL PESO CON LA PANTALLA NUEVA (20/10): el número grande, − y +, la regla.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y sin pesos: se abre
// «Anotar peso» desde Inicio, arranca en 70,0; tres toques al + dan 70,3; arrastrar la
// regla 90 px a la izquierda suma 1,0 (71,3); «Anotar» lo guarda, y la base tiene que
// tener 71,3. Al volver a abrir, arranca en 71,3 y dice cuándo fue la última.
//
// Y LA FOTO, con la hoja nueva del mismo estilo: la tarjeta vacía con sacar y elegir, la
// foto elegida adentro, «Registrar día», y en la base el día con la foto colgada.
//
//   node --env-file=.env.local supabase/probar-peso-y-fotos.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(7);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'peso-y-fotos');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-peso-${sello}@gmail.com`;
const clave = `Ps-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `pes_${sello.slice(-6)}` }).eq('id', uid);

console.log('Anotar el peso con el número grande, − y + y la regla');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const valor = () => page.getByTestId('anotar-peso-valor').first().innerText();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().waitFor({ timeout: 120000 });
  // CON EL GLOBO DE «NOVEDAD» A LA VISTA, como lo ve una cuenta nueva: se tocaba el globo y no el enlace (28/10).
  const globo = await page.getByTestId('aviso-rutina').first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  chequear('el globo de «Novedad» está a la vista', globo, true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SALIDA, 'inicio.png') });

  await page.getByText('Anotar peso', { exact: true }).first().click({ timeout: 30000 });
  await page.getByTestId('anotar-peso').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  chequear('sin pesos anotados, arranca en 70,0', await valor(), '70,0');
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('anotar-peso-mas').first().click();
    await page.waitForTimeout(150);
  }
  chequear('tres toques al + suben tres décimas', await valor(), '70,3');
  const caja = await page.getByTestId('anotar-peso-regla').first().boundingBox();
  const y = caja.y + caja.height / 2;
  await page.mouse.move(caja.x + caja.width / 2 + 45, y);
  await page.mouse.down();
  for (let i = 1; i <= 9; i++) await page.mouse.move(caja.x + caja.width / 2 + 45 - i * 10, y);
  await page.mouse.up();
  chequear('arrastrar la regla 90 px a la izquierda suma 1,0', await valor(), '71,3');
  await page.screenshot({ path: join(SALIDA, 'peso.png') });
  await page.getByTestId('anotar-peso-anotar').first().click();
  await page.getByTestId('anotar-peso').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const { data: pesos } = await s.from('weights').select('valor').eq('user_id', uid);
  chequear('la base guardó lo que decía el número', (pesos ?? []).map((p) => Number(p.valor)), [71.3]);

  await page.getByText('Anotar peso', { exact: true }).first().click({ timeout: 30000 });
  await page.getByTestId('anotar-peso').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const hoja = await page.getByTestId('anotar-peso').first().innerText();
  chequear('al volver a abrir, arranca en el último y dice cuándo fue', [await valor(), /La última: 71,3 kg · \d+ de \S+/.test(hoja)], ['71,3', true]);
  await page.getByText('Cancelar', { exact: true }).last().click();
  await page.getByTestId('anotar-peso').first().waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});

  // LA FOTO, con la hoja nueva: la tarjeta con sacar y elegir, la foto adentro, registrar.
  console.log('Registrar el día con foto, con la hoja nueva');
  const fotoReal = join(SALIDA, 'foto-real.jpg');
  await page.screenshot({ path: fotoReal, type: 'jpeg', quality: 80 });
  await page.getByText('Registra tu primer día', { exact: true }).first().click({ timeout: 30000 });
  await page.getByTestId('registrar-foto').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  chequear('la tarjeta vacía tiene sacar y elegir', [await page.getByTestId('registrar-foto-camara').count(), await page.getByTestId('registrar-foto-galeria').count()], [1, 1]);
  await page.screenshot({ path: join(SALIDA, 'foto-vacia.png') });
  const [elegidor] = await Promise.all([page.waitForEvent('filechooser', { timeout: 60000 }), page.getByTestId('registrar-foto-galeria').first().click()]);
  await elegidor.setFiles(fotoReal);
  await page.getByTestId('registrar-foto').locator('img').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  chequear('la foto elegida se ve en la tarjeta, con quién la ve', [await page.getByTestId('registrar-foto').locator('img').count() > 0, await page.getByTestId('registrar-foto-quien').count()], [true, 1]);
  await page.screenshot({ path: join(SALIDA, 'foto-elegida.png') });
  await page.getByTestId('registrar-confirmar').first().click();
  await page.getByTestId('registrar-foto').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const [{ data: logs }, { data: fotos }] = await Promise.all([s.from('logs').select('id').eq('user_id', uid), s.from('photos').select('log_id').eq('user_id', uid)]);
  chequear('la base tiene el día y la foto colgada de ese día', [(logs ?? []).length, (fotos ?? []).length, fotos?.[0]?.log_id === logs?.[0]?.id], [1, 1, true]);

  // Y EN EL ÁLBUM, con una sola foto este mes, ya no empuja a la segunda (20/10).
  await page.getByText('Álbum', { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(4000);
  const album = await page.locator('body').innerText();
  chequear('el álbum con una sola foto en el mes no dice «el antes y el después»', [/antes y el después/.test(album), await page.getByTestId('album-una-mas').count()], [false, 0]);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
  await page.screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();

const { data: archivos } = await s.storage.from('fotos').list(uid);
const rutas = (archivos ?? []).map((o) => `${uid}/${o.name}`);
if (rutas.length) await s.storage.from('fotos').remove(rutas);
const { error: eBorrar } = await borrarCuentaDePrueba(s);
console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
if (eBorrar) fallos++;
process.exit(fallos ? 1 : 0);
