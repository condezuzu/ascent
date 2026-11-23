// LA SECCIÓN DE MOSS EN ASCENT (19/11, rehecha el mismo día; spec/musculos-compartido.md de Moss): vinculada contra
// la base real, el tutorial sale solo la primera vez y no deja seguir antes de 2 s (con serie y repetición en el paso
// 2 y el círculo en el 4); tus músculos de frente y de espalda con su lista, el detalle de un músculo con qué hacer,
// sus partes y los kilos de la próxima vez; «Para hoy»; los fatigados; tu año; un estancado con su porqué, y una meta
// que se guarda y se borra en la base (guardar_meta_de_fuerza / borrar_meta_de_fuerza de la 0016).
//
// La sesión de hoy es real (con su RIR). Las de las 19 semanas de antes son un doble: la base no deja anotar
// sesiones viejas. La sentadilla tuvo su marca hace 13 semanas con 2 sesiones de 5 series por semana; después,
// una sesión de 3 series por semana, siempre con lo mismo: estancada, por menos series y menos veces.
//
// En la vista web de la nativa (:8090).
//
//   node --env-file=.env.local supabase/probar-seccion-moss.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(10);
const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'seccion-moss');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};
const nuevo = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const s = nuevo();
const m = nuevo();
const correo = `agusconde20+ascent-sm-${sello}@gmail.com`;
const clave = `Sm-${sello}-Kp3`;
const { error: eA } = await s.auth.signUp({ email: correo, password: clave });
const { error: eM } = await m.auth.signUp({ email: `agusconde20+moss-sm-${sello}@gmail.com`, password: `Ms-${sello}-Kp3` });
if (eA || eM) {
  console.log('No se pudieron crear las cuentas:', eA?.message, eM?.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `sm_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => {
  const d = new Date(`${HOY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

// Un registro de hace 200 días: entrena hace más de medio año (el ruido de la fuerza es el de un entrenado).
await s.from('logs').insert([{ user_id: uid, fecha: dia(200) }]);
await s.rpc('recalcular_desde_cero');
const sesion = (await s.rpc('iniciar_sesion')).data?.id;
await s.rpc('fijar_series', { p_sesion: sesion, p_series: 3 });
await s.rpc('fijar_bloques', { p_sesion: sesion, p_bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [80, 80, 80], reps: [8, 8, 7], rir: [2, 1, 1], carga: 'total' }] });
await s.rpc('terminar_sesion');
await s.from('prs').insert([{ user_id: uid, ejercicio: 'sentadilla', peso: 100, reps: 5, es_real: false, fecha: dia(91) }]);

const sentadilla = (n, pesos) => ({ fecha: dia(n), bloques: [{ ejercicio: 'sentadilla', series: pesos.length, pesos, reps: pesos.map(() => 5), carga: 'total' }] });
const DOBLES = [];
for (let k = 1; k <= 11; k++) DOBLES.push(sentadilla(7 * k, [100, 100, 100]));
for (let j = 0; j < 6; j++) DOBLES.push(sentadilla(91 + 7 * j, [100, 100, 100, 100, 100].map((p) => p - j)), sentadilla(94 + 7 * j, [95, 95, 95, 95, 95]));

const { data: codigo } = await m.schema('moss').rpc('crear_codigo_de_vinculo');
const { error: eV } = await s.schema('moss').rpc('vincular_con_codigo', { p_codigo: codigo });
chequear('vinculadas por código, contra la base real', [!eV, (await s.schema('moss').rpc('estado_del_vinculo')).data?.vinculada ?? null], [true, true]);

console.log('La sección de Moss en Ascent');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
await page.route((u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs!inner(fecha)'), async (route) => {
  const r = await route.fetch();
  const reales = await r.json().catch(() => []);
  await route.fulfill({ response: r, json: [...reales, ...DOBLES.map((d) => ({ bloques: d.bloques, estado: 'terminada', logs: { fecha: d.fecha } }))] });
});
const texto = (t) => page.getByText(t, { exact: true }).last();
const visible = (id) => page.getByTestId(id).filter({ visible: true }).first();
const metasEnLaBase = async () => ((await s.schema('moss').rpc('metas_de_fuerza')).data ?? []).map((x) => [x.ejercicio, Number(x.kilos), x.reps]);
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas', 'grupo', 'stats'] })), [uid]);
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().waitFor({ timeout: 180000 });
  await texto(TX.nav.stats).click({ timeout: 30000 });
  await page.getByTestId('entrada-a-moss').first().click({ timeout: 120000 });

  // El tutorial, solo, la primera vez: el botón no deja seguir hasta los 2 s.
  await visible('moss-tutorial').waitFor({ timeout: 60000 });
  const paso = async () => (await page.getByTestId('moss-tutorial').innerText()).toLowerCase();
  const primero = await paso();
  await visible('moss-tutorial-siguiente').click({ force: true });
  chequear('el tutorial sale solo y, antes de 2 s, «Siguiente» no pasa', [primero.includes(TX.moss.sec.tutorial.titulos[0].toLowerCase()), (await paso()).includes(TX.moss.sec.tutorial.paso(1, 5).toLowerCase())], [true, true]);
  await page.screenshot({ path: join(SALIDA, '1-tutorial.png') });
  const pasos = [];
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(2150);
    await visible('moss-tutorial-siguiente').click();
    if (i < 4) pasos.push(await paso());
  }
  chequear('el paso 2 explica serie y repetición; el 4, el círculo que se llena', [
    pasos[0].includes(TX.moss.sec.tutorial.titulos[1].toLowerCase()) && pasos[0].includes(TX.moss.sec.tutorial.serieDura.toLowerCase()),
    pasos[2].includes(TX.moss.sec.fatigados.faltan(1).toLowerCase()),
  ], [true, true]);
  await page.waitForTimeout(600);
  chequear('cinco pasos y se cierra', await page.getByTestId('moss-tutorial').filter({ visible: true }).count(), 0);

  // Tus músculos: el press de hoy (3 series duras de pecho) en el cuerpo y en su barra; tocarla abre el detalle.
  await visible('moss-tus-musculos').waitFor({ timeout: 60000 });
  chequear('el cuerpo y la barra del pecho', [await visible('cuerpo-de-moss').count(), await visible('moss-barra-pecho').count()], [1, 1]);
  await page.getByTestId('cuerpo-de-moss').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, '2-tus-musculos.png') });
  await visible('moss-barra-pecho').click();
  await visible('moss-detalle').waitFor({ timeout: 20000 });
  const detalle = await visible('moss-detalle').innerText();
  const U = TX.moss.sec.tus;
  chequear('el detalle del pecho: sus series, qué hacer, que se recupera, sus partes y el press con sus kilos', [
    detalle.includes(U.seriesCorto(3)),
    detalle.includes(`${U.estados.poco}: ${U.acciones.poco}`),
    detalle.includes(`${U.estados.fatigado} · ${TX.moss.sec.fatigados.faltan(2)}`),
    detalle.includes(U.parteLinea(U.partes.pechoResto, 3)),
    detalle.includes('Press') && detalle.includes(U.proxima.sinObjetivo('80 kg')),
  ], [true, true, true, true, true]);
  await page.screenshot({ path: join(SALIDA, '3-detalle.png') });

  // De espalda, la lista cambia: el tríceps está, el pecho no.
  await visible('moss-lado-espalda').click();
  await page.screenshot({ path: join(SALIDA, '2b-de-espalda.png') });
  chequear('de espalda, la lista de ese lado', [await visible('moss-barra-triceps').count(), await page.getByTestId('moss-barra-pecho').filter({ visible: true }).count()], [1, 0]);
  await visible('moss-lado-frente').click();

  // Sugerencias para hoy (23/11, como en Moss), arriba de «Esta semana»: ya entrenó, así que sin el entrenamiento; la
  // comida, para recuperarse (proteína y carbohidratos, porque entrenó); el sueño, sin noches de Moss, las 8 h de fábrica.
  const P = TX.moss.sec.sugerencias;
  const paraHoy = await visible('moss-para-hoy').innerText();
  await page.getByTestId('moss-para-hoy').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, '2c-sugerencias.png') });
  const yDe =async (l) => (await l.boundingBox())?.y ?? -1;
  chequear('«Sugerencias para hoy», arriba de «Esta semana»: sin entrenamiento (ya entrenó), la comida para recuperarse y cuántas horas dormir', [
    paraHoy.includes(P.titulo.toUpperCase()) || paraHoy.includes(P.titulo),
    paraHoy.toLowerCase().includes(P.tipos.entreno.toLowerCase()),
    paraHoy.includes(P.comida.recuperar(`${P.macros.proteina} ${P.y} ${P.macros.carbohidratos}`)),
    paraHoy.includes(P.sueno.sinDatos('8 h')),
    paraHoy.includes(P.masEnSueno),
    (await yDe(visible('moss-para-hoy'))) < (await yDe(page.getByText(TX.moss.sec.tus.semana, { exact: true }).filter({ visible: true }).first())),
  ], [true, false, true, true, true, true]);

  // Fatigados: el pecho, con RIR 1, vuelve en 2 días.
  const fatigados = await visible('moss-fatigados').innerText();
  chequear('el pecho, fatigado: faltan 2 días', fatigados.includes(TX.moss.sec.fatigados.faltan(2)), true);

  // Tu año: un día por sesión de este año, y el estancado con su porqué.
  chequear('tu año tiene días', (await page.getByTestId('moss-anio').locator('[data-testid^="moss-dia-"]').count()) > 0, true);
  const estancados = await visible('moss-estancados').innerText();
  const porQue = await page.getByTestId('moss-por-que').innerText();
  chequear('la sentadilla, estancada; su porqué: menos series de cuádriceps y menos veces, y faltan comida y sueño', [
    estancados.includes('Sentadilla'),
    porQue.includes(TX.moss.sec.porQue.series(TX.moss.sec.musculos.cuadriceps.toLowerCase())),
    porQue.includes(TX.moss.sec.porQue.frecuencia),
    porQue.includes(TX.moss.sec.porQue.faltan),
  ], [true, true, true, true]);
  await page.getByTestId('moss-por-que').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, '4-por-que.png') });

  // Una meta: se guarda en la base y sale con cuándo llegas; después se borra.
  await page.getByTestId('moss-nueva-meta').scrollIntoViewIfNeeded();
  await visible('moss-nueva-meta').click();
  await page.getByTestId('moss-metas').getByText('Sentadilla', { exact: true }).first().click();
  await page.getByPlaceholder(TX.moss.sec.metas.kilos).fill('120');
  await page.getByPlaceholder(TX.moss.sec.metas.reps).fill('5');
  await texto(TX.moss.sec.metas.guardar).click();
  await page.waitForTimeout(2500);
  chequear('la meta se guarda en la base', await metasEnLaBase(), [['sentadilla', 120, 5]]);
  await page.getByTestId('moss-metas').getByText(TX.moss.sec.metas.noSube, { exact: true }).first().waitFor({ timeout: 30000 }).catch(() => {});
  chequear('y sale en Metas: así no llega (estancada)', (await visible('moss-metas').innerText()).includes(TX.moss.sec.metas.noSube), true);
  await page.screenshot({ path: join(SALIDA, '5-meta.png') });
  await page.getByTestId('moss-metas').getByText(TX.moss.sec.metas.borrar, { exact: true }).first().click();
  await page.waitForTimeout(2500);
  chequear('«Borrar» la saca de la base', await metasEnLaBase(), []);

  // CARGA DE UNA (23/11): lo guardado en el teléfono sale al instante. Para que se note, al volver a abrir la app la
  // pregunta del vínculo no llega y lo de Ascent tarda 4 s: sin lo guardado saldría «Vincula…» y después, nada.
  await page.route('**/rest/v1/rpc/estado_del_vinculo', (r) => r.abort());
  await page.route('**/rest/v1/rpc/mi_hoy', async (r) => {
    await new Promise((ok) => setTimeout(ok, 4000));
    await r.continue().catch(() => {});
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await texto(TX.nav.stats).click({ timeout: 120000 });
  await page.waitForTimeout(800);
  await page.getByTestId('entrada-a-moss').first().click({ timeout: 120000 });
  const rotulos = new Set();
  const t0 = Date.now();
  let llego = null;
  while (Date.now() - t0 < 2500) {
    for (const r of await page.evaluate(() => [...document.querySelectorAll('[data-testid="moss-rotulo"]')].map((x) => x.textContent))) rotulos.add(r);
    if (llego === null && (await page.getByTestId('moss-tus-musculos').filter({ visible: true }).count())) llego = Date.now() - t0;
    await page.waitForTimeout(60);
  }
  await page.screenshot({ path: join(SALIDA, '6-de-una.png') });
  chequear('al volver, la sección sale enseguida de lo guardado (sin la base), y nunca dice «Vincula Ascent con Moss»', [llego !== null && llego < 1500, rotulos.has(TX.moss.vinculaTitulo)], [true, false]);
  await page.unroute('**/rest/v1/rpc/estado_del_vinculo');
  await page.unroute('**/rest/v1/rpc/mi_hoy');

  // Otra vez: el tutorial ya no sale solo; el «!» lo abre.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await texto(TX.nav.stats).click({ timeout: 120000 });
  await page.getByTestId('entrada-a-moss').first().click({ timeout: 120000 });
  await visible('moss-tus-musculos').waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  const solo = await page.getByTestId('moss-tutorial').filter({ visible: true }).count();
  await visible('moss-tutorial-abrir').click();
  chequear('la segunda vez no sale solo, y el «!» lo abre', [solo, await visible('moss-tutorial').count()], [0, 1]);
  chequear('sin errores de la página', errores, []);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
  await page.screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();
const { error: eBorrar } = await borrarCuentaDePrueba(s);
const { error: eBorrarM } = await borrarCuentaDePrueba(m);
console.log(`  ${eBorrar || eBorrarM ? 'FALLA' : 'ok  '} cuentas borradas`);
if (eBorrar || eBorrarM) fallos++;
process.exit(fallos ? 1 : 0);
