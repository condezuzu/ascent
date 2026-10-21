// «REGISTRAR REPETICIONES» (21/10): un ajuste apagado de fábrica. Apagado, al entrenar no hay
// nada de repeticiones; prendido, al lado del peso aparece un cuadradito vacío con, en gris, las
// de la misma serie la última vez. Lo tecleado se anota con el + y el cuadradito queda vacío.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y una sesión de ayer con press
// de banca (3 series: 10, 9 y 8 repeticiones), inyectada en la respuesta del historial como en
// probar-ultima-vez. Lo que se anota se mira en lo que la app MANDA a `fijar_bloques` y, con la
// base en la 94, también en lo que quedó guardado.
//
// SIN LA MIGRACIÓN 94 la app no muestra el ajuste: hasta pegarla, la versión se simula en la
// respuesta de `version_del_esquema` y se avisa. Lo guardado se mira recién con la 94.
//
//   node --env-file=.env.local supabase/probar-reps.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'reps');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-rp-${sello}@gmail.com`;
const clave = `Rp-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `rp_${sello.slice(-6)}` }).eq('id', uid);
const { data: version } = await s.rpc('version_del_esquema');
const simulada = !(typeof version === 'number' && version >= 94);
const diaAtras = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - n * 86400000));

console.log('«Registrar repeticiones», con el ajuste');
if (simulada) console.log(`  --   la base real está en la ${version}: la 94 se simula en la app, y lo guardado no se mira`);
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
const cuadradito = () => page.getByTestId('campo-reps');
await page.route(
  (u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs!inner'),
  async (route) => {
    const r = await route.fetch();
    const filas = await r.json().catch(() => []);
    filas.push({ bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 60, 60], carga: 'total', reps: [10, 9, 8] }], logs: { fecha: diaAtras(1) } });
    await route.fulfill({ response: r, json: filas });
  }
);
if (simulada) await page.route((u) => u.pathname.endsWith('/rest/v1/rpc/version_del_esquema'), (route) => route.fulfill({ json: 94 }));
// Lo que la app manda a la base con cada serie: los bloques de press, con sus repeticiones.
const enviados = [];
page.on('request', (q) => {
  if (!q.url().includes('/rest/v1/rpc/fijar_bloques')) return;
  try {
    enviados.push(JSON.parse(q.postData() ?? '{}').p_bloques ?? []);
  } catch {}
});
const repsMandadas = () => (enviados.at(-1) ?? []).filter((b) => b.ejercicio === 'press_banca').map((b) => b.reps ?? 'sin llave');
async function enAjustes(alPrender) {
  await texto('Ajustes').click({ timeout: 30000 });
  // El interruptor no dice su estado en la web (accessibilityState no llega al DOM): lo que se
  // mira es lo que hace, el cuadradito al volver a Inicio.
  const llave = page.getByRole('switch', { name: 'Registrar repeticiones' }).first();
  await llave.scrollIntoViewIfNeeded({ timeout: 30000 });
  await alPrender?.();
  await llave.click();
  await page.waitForTimeout(800);
  await texto('Inicio').click({ timeout: 30000 });
  await page.waitForTimeout(1500);
}
async function sumar() {
  await page.getByLabel('Sumar una serie').first().click({ timeout: 30000 });
  await page.waitForTimeout(2500);
}
const cuadro = async () => [await cuadradito().first().inputValue(), await cuadradito().first().getAttribute('placeholder')];

try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.getByText(/^Press de banca/).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(SALIDA, 'apagado.png') });
  chequear('apagado de fábrica: al entrenar no se piden repeticiones', await cuadradito().count(), 0);

  // Ajustes: los tres grupos en orden, y el interruptor en Entrenamiento, apagado.
  await enAjustes(async () => {
    const y = async (id) => (await page.getByTestId(id).first().boundingBox())?.y ?? -1;
    const [e, p, g] = [await y('ajustes-entrenamiento'), await y('ajustes-perfil'), await y('ajustes-general')];
    const r = (await page.getByRole('switch', { name: 'Registrar repeticiones' }).first().boundingBox())?.y ?? -1;
    chequear('Ajustes: Entrenamiento, Perfil y General, en ese orden, y el interruptor en Entrenamiento', [e >= 0 && e < p, p < g, e < r && r < p], [true, true, true]);
    await page.getByTestId('ajustes-general').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(SALIDA, 'ajustes-abajo.png') });
    await page.getByTestId('ajustes-entrenamiento').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(SALIDA, 'ajustes.png') });
  });

  // Prendido, con la sesión abierta: el cuadradito, vacío, con las de la primera serie de ayer.
  await cuadradito().first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: join(SALIDA, 'prendido.png') });
  chequear('prendido: el cuadradito vacío, con la pista de la primera serie de ayer', await cuadro(), ['', '10']);

  await cuadradito().first().fill('12');
  await page.waitForTimeout(400);
  await sumar();
  chequear('el + anota las tecleadas y el cuadradito queda vacío, con la pista de la serie siguiente', [await cuadro(), repsMandadas()], [['', '9'], [[12]]]);
  await page.screenshot({ path: join(SALIDA, 'despues-del-mas.png') });

  await sumar();
  chequear('una serie sin teclear va sin repeticiones; la pista sigue con la tercera', [await cuadro(), repsMandadas()], [['', '8'], [[12, null]]]);

  if (!simulada) {
    await page.waitForTimeout(2000);
    const { data } = await s.from('sesiones').select('bloques').eq('user_id', uid).eq('estado', 'corriendo');
    const guardadas = (data?.[0]?.bloques ?? []).filter((b) => b.ejercicio === 'press_banca').map((b) => b.reps ?? 'sin llave');
    chequear('y la base las guardó, serie por serie', guardadas, [[12, null]]);
  }

  await enAjustes();
  chequear('apagado otra vez: no se piden ni se muestran', await cuadradito().count(), 0);
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
