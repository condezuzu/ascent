// LA SUBIDA DE RANGO QUE NADIE VIO (21/11, bug del dueño: «subí de rango y no me apareció nada»). Una cuenta con racha
// 5 abre la app —queda anotado que este teléfono vio el rango 1— y la cierra. El día entra con la app cerrada y la racha
// pasa a 6, el rango 2. Al volver a abrirla la ceremonia sale sola, sin tocar nada; cerrada, no vuelve. Y sin nada
// anotado (la primera vez con esta versión), un rango recién alcanzado también se festeja.
//
// «Con la app cerrada» acá es: la pestaña cerrada y el día registrado por la API con el mismo `registrar_dia` que usa la
// llegada al gimnasio de fondo. No es el despertar del iPhone, que la vista web no tiene.
//
// En la vista web de la nativa (:8090), con una cuenta descartable.
//
//   node --env-file=.env.local supabase/probar-subida-sin-ver.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'subida-sin-ver');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-sv-${sello}@gmail.com`;
const clave = `Sv-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `sv_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
await s.from('logs').insert([1, 2, 3, 4, 5].map((n) => ({ user_id: uid, fecha: dia(n) })));
await s.rpc('recalcular_desde_cero');

console.log('La subida de rango que nadie vio');
const nav = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const errores = [];
  const CLAVE = `ascent:rango-festejado:${uid}`;
  const abrir = async () => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
    await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
    return page;
  };
  const ceremonia = (page) => page.getByText(TX.sesion.nuevoRango, { exact: true });
  const anotado = (page) => page.evaluate((k) => localStorage.getItem(k), CLAVE);
  const iniciar = (page) => page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first();

  // La app abierta con racha 5: ve el rango 1 y lo deja anotado.
  let page = await abrir();
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas'] })), [uid]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  await iniciar(page).waitFor({ timeout: 120000 });
  await page.waitForTimeout(3000);
  chequear('con racha 5 no hay ceremonia, y queda anotado que este teléfono vio el rango 1', [await ceremonia(page).count(), await anotado(page)], [0, '1']);

  // Se cierra la app y el día entra sin ella: racha 6, el rango 2.
  await page.close();
  const { data: reg, error: eReg } = await s.rpc('registrar_dia', { p_origen: 'ubicacion' });
  chequear('el día entró con la app cerrada: racha 6', [!eReg, reg?.racha], [true, 6]);

  // Al abrirla, la ceremonia sale sola.
  // Con la sesión ya abierta no hay entrada que pasar: esperarla gastaba más de dos minutos en cada apertura, y con tres
  // la sonda se pasaba de su tope (27/11).
  page = await abrir();
  const salio = await ceremonia(page).first().waitFor({ timeout: 120000 }).then(() => true, () => false);
  await page.waitForTimeout(3600);
  await page.screenshot({ path: join(SALIDA, '1-al-abrir.png') });
  chequear('al abrir la app, la ceremonia del rango 2 sale sola', [salio, salio && (await page.getByText('Asteroide', { exact: true }).count()) > 0], [true, true]);
  await page.getByText(TX.sesion.rangoSeguir, { exact: true }).first().click({ timeout: 20000 });
  await page.waitForTimeout(1500);
  chequear('se cierra con un toque y queda anotado el rango 2', [await ceremonia(page).count(), await anotado(page)], [0, '2']);

  // Recargar no la repite.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await iniciar(page).waitFor({ timeout: 120000 });
  // Se le da tiempo a salir: la ceremonia aparece unos segundos después de Inicio, y mirar enseguida no vería nada.
  const volvio = await ceremonia(page).first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  chequear('ya vista, no vuelve al abrir de nuevo', volvio, false);

  // Sin nada anotado (la primera vez con esta versión): el rango se alcanzó hoy, y se festeja igual.
  await page.evaluate((k) => localStorage.removeItem(k), CLAVE);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const tarde = await ceremonia(page).first().waitFor({ timeout: 120000 }).then(() => true, () => false);
  chequear('sin nada anotado, un rango recién alcanzado se festeja igual', tarde, true);
  chequear('sin errores de la página', errores, []);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
} finally {
  await nav.close();
  const { error } = await borrarCuentaDePrueba(s);
  console.log(`  ${error ? 'FALLA' : 'ok  '} cuenta borrada${error ? ': ' + error.message : ''}`);
  if (error) fallos++;
}
process.exit(fallos ? 1 : 0);
