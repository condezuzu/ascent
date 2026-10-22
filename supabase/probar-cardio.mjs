// EL CARDIO ES UN CRONÓMETRO, Y ANOTA LA DISTANCIA (21/10). Antes de arrancar se veía «20 min»
// con − y +, que se leía como un timer. Ahora el reloj está quieto en 0:00 y cuenta para arriba;
// después de la vuelta se corrigen los minutos y se escribe la distancia.
//
// En la vista web de la nativa (:8090), con una cuenta descartable: se elige la cinta (arranca
// sola) y el reloj sube; el − la apaga sin anotar y queda en 0:00, sin el «20 min»; «Arrancar»
// la vuelve a correr; «Listo» la anota y aparece la distancia; 3,5 llega a la base.
//
// SIN LA MIGRACIÓN 95 el campo de la distancia no aparece: hasta pegarla, la versión se simula
// en la respuesta de `version_del_esquema` y se avisa; lo guardado se mira recién con la 95.
//
//   node --env-file=.env.local supabase/probar-cardio.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'cardio');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-ca-${sello}@gmail.com`;
const clave = `Ca-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `ca_${sello.slice(-6)}` }).eq('id', uid);
const { data: version } = await s.rpc('version_del_esquema');
const simulada = !(typeof version === 'number' && version >= 95);

console.log('El cardio: cronómetro y distancia');
if (simulada) console.log(`  --   la base real está en la ${version}: la 95 se simula en la app, y lo guardado no se mira`);
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
if (simulada) await page.route((u) => u.pathname.endsWith('/rest/v1/rpc/version_del_esquema'), (route) => route.fulfill({ json: 95 }));
const enviados = [];
page.on('request', (q) => {
  if (!q.url().includes('/rest/v1/rpc/fijar_bloques')) return;
  try {
    enviados.push(JSON.parse(q.postData() ?? '{}').p_bloques ?? []);
  } catch {}
});
const reloj = async (id) => page.getByTestId(id).first().innerText().then((t) => t.split('\n')[0].trim()).catch(() => null);
const segundos = (t) => (t ? t.split(':').reduce((a, x) => a * 60 + Number(x), 0) : -1);

try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto(TX.inicio.iniciarEntrenamiento).click({ timeout: 120000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.getByText(new RegExp('^' + TX.sesion.sinEjercicio)).first().click({ timeout: 30000 });
  await page.getByTestId('buscar-ejercicio').first().fill('Cinta', { timeout: 30000 });
  await page.waitForTimeout(800);
  await texto('Cinta').click({ timeout: 30000 });
  await page.getByTestId('cronometro-cardio').first().waitFor({ timeout: 30000 });
  const a = segundos(await reloj('cronometro-cardio'));
  await page.waitForTimeout(3200);
  const b = segundos(await reloj('cronometro-cardio'));
  chequear('al elegir la cinta, el reloj cuenta para arriba', b - a >= 2, true);

  // El − la apaga sin anotar: queda quieta.
  await page.getByLabel(TX.inicio.sacarSerie).first().click({ timeout: 30000 });
  await page.getByTestId('cronometro-cardio-quieto').first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: join(SALIDA, 'quieto.png') });
  chequear('quieta: el reloj en 0:00 y sin los minutos para elegir (no es un timer)', [await reloj('cronometro-cardio-quieto'), await page.getByTestId('minutos-de-cardio').count()], ['0:00', 0]);

  await page.getByTestId('cardio-principal').first().click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  chequear('«Arrancar» la vuelve a correr desde cero, para arriba', segundos(await reloj('cronometro-cardio')) >= 1, true);
  await page.getByTestId('cardio-principal').first().click({ timeout: 30000 });
  await page.getByTestId('minutos-de-cardio').first().waitFor({ timeout: 30000 });
  await page.getByTestId('campo-distancia').first().fill('3,5');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(SALIDA, 'despues.png') });
  const ultima = (enviados.at(-1) ?? []).filter((x) => x.ejercicio === 'cinta').map((x) => [x.minutos, x.distancia ?? 'sin llave']);
  chequear('después de la vuelta: los minutos se corrigen y la distancia escrita viaja a la base en km', ultima, [[1, 3.5]]);
  if (!simulada) {
    const { data } = await s.from('sesiones').select('bloques').eq('user_id', uid).eq('estado', 'corriendo');
    chequear('y la base la guardó', (data?.[0]?.bloques ?? []).filter((x) => x.ejercicio === 'cinta').map((x) => x.distancia ?? 'sin llave'), [3.5]);
  }
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
