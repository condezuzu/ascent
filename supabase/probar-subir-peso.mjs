// SUBIR EL PESO (21/10; desde el 21/11 con la regla de la sección de Moss, a pedido). Con 8 repeticiones objetivo en
// la rutina y las dos sesiones anteriores de press de banca con todas las series en 8 o más (60 kg), al empezar a
// entrenar el peso parpadea y arriba dice «↑ Puedes subir a 62,5 kg»; la primera vez, un globo explica qué quiere
// decir. Tocarlo pone el peso y apaga el parpadeo. Con una serie de la última sesión bajo el objetivo, no parpadea.
//
// Y LA LISTA DE HOY (22/11, a pedido): está siempre en la sesión; adentro, lo que sigue de la rutina de hoy y «Editar
// este día», que abre en la misma hoja el editor de un día, con los siete días arriba para cambiar. Con una rutina de
// verdad se quita el primer ejercicio de hoy en medio de la sesión: la lista, la sesión y la base quedan al día.
//
// En la vista web de la nativa (:8090), con una cuenta descartable. Las dos sesiones y la rutina se inyectan en las
// respuestas (historial y `mis_rutinas`): las sesiones solo se escriben con la fecha de hoy.
//
//   node --env-file=.env.local supabase/probar-subir-peso.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'subir-peso');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-sp-${sello}@gmail.com`;
const clave = `Sp-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `sp_${sello.slice(-6)}` }).eq('id', uid);
const diaAtras = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - n * 86400000));

console.log('Subir el peso: parpadea, se explica y se pone');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
const texto = (t) => page.getByText(t, { exact: true }).last();
let ultimaSerie = 8;
// La página del tramo sin dobles: si algo falla ahí, la foto del error es de esa.
let limpia = null;
await page.route(
  (u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs!inner'),
  async (route) => {
    const r = await route.fetch();
    const filas = await r.json().catch(() => []);
    filas.push({ bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 60, 60], carga: 'total', reps: [10, 10, 10] }], logs: { fecha: diaAtras(5) } });
    filas.push({ bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 60, 60], carga: 'total', reps: [10, 9, ultimaSerie] }], logs: { fecha: diaAtras(2) } });
    await route.fulfill({ response: r, json: filas });
  }
);
const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3, reps: 8 }] }));
await page.route((u) => u.pathname.endsWith('/rest/v1/rpc/mis_rutinas'), (route) => route.fulfill({ json: [{ id: '00000000-0000-0000-0000-000000000001', nombre: 'Prueba', activa: true, dias }] }));

async function entrar() {
  await texto(TX.inicio.iniciarEntrenamiento).click({ timeout: 120000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.getByText(/^Press de banca/).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
}
const globito = () => page.getByTestId('globito-subir').first().innerText({ timeout: 3000 }).then((t) => t.trim()).catch(() => null);
// La opacidad del peso, varias veces en un segundo y medio: en una foto quieta el parpadeo no se ve.
async function latido() {
  const vistas = [];
  for (let i = 0; i < 12; i++) {
    vistas.push(await page.getByTestId('peso-parpadea').first().evaluate((n) => Number(getComputedStyle(n).opacity)).catch(() => null));
    await page.waitForTimeout(125);
  }
  return vistas;
}

try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await entrar();

  chequear('dos sesiones con todas las series en 8 o más y objetivo 8: arriba dice a cuánto subir', await globito(), '↑ ' + TX.sesion.puedesSubirA('62,5', 'kg'));
  const vistas = (await latido()).filter((x) => x !== null);
  chequear('el peso parpadea: su opacidad va y vuelve', [vistas.length > 0, Math.min(...vistas) < 0.6, Math.max(...vistas) > 0.9], [true, true, true]);
  await page.screenshot({ path: join(SALIDA, '1-parpadea.png') });
  chequear('la primera vez, el globo que lo explica', (await page.getByTestId('globo-subir').first().innerText({ timeout: 5000 }).catch(() => '')).includes(TX.globos.subir), true);
  // Cuadro por cuadro, el peso solo: cuatro fotos en medio segundo.
  const peso = page.getByTestId('peso-parpadea').first();
  for (let i = 0; i < 4; i++) {
    await peso.screenshot({ path: join(SALIDA, `2-latido-${i + 1}.png`) }).catch(() => {});
    await page.waitForTimeout(140);
  }

  await page.getByTestId('globito-subir').first().click();
  await page.waitForTimeout(800);
  chequear('tocarlo pone 62,5 y el peso deja de parpadear', [await page.getByLabel(TX.sesion.pesoDelBloque).first().inputValue(), await page.getByTestId('peso-parpadea').count(), await globito()], ['62,5', 0, null]);

  // LA LISTA DE HOY, antes de contar ninguna serie: nada hecho, y lo que sigue es el press de la rutina, 3 × 8.
  await page.getByTestId('lista-de-hoy').first().click();
  const hojaDeLista = page.getByTestId('hoja').filter({ visible: true }).first();
  await hojaDeLista.waitFor({ timeout: 20000 });
  await hojaDeLista.getByText(/^Press de banca/).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SALIDA, '3-lista-de-hoy.png') });
  const enLaLista = await hojaDeLista.innerText();
  chequear('la lista de hoy: nada hecho todavía, y lo que sigue es el press con sus series', [
    enLaLista.includes(TX.sesion.listaTitulo), enLaLista.includes(TX.sesion.listaVacia),
    (await hojaDeLista.getByTestId('lo-que-sigue').innerText()).replace(/\s+/g, ' ').trim(),
  ], [true, true, 'Press de banca 3 × 8']);
  // «Editar este día»: el mismo lugar pasa a ser el editor de un día, con los siete días arriba y hoy elegido.
  await hojaDeLista.getByTestId('editar-este-dia-abrir').click();
  await hojaDeLista.getByTestId('editar-este-dia').waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SALIDA, '4-editar-este-dia.png') });
  const HOY_N = await page.evaluate(() => new Date().getDay());
  const OTRO = (HOY_N + 1) % 7;
  const elegido = () => hojaDeLista.getByTestId('dia-solo-nombre').innerText();
  const deHoy = await elegido();
  await hojaDeLista.getByTestId(`dia-solo-${OTRO}`).click();
  await page.waitForTimeout(400);
  chequear('el editor abre en hoy, con los siete días para elegir, y tocar otro lo cambia', [
    await hojaDeLista.locator('[data-testid^="dia-solo-"]:not([data-testid="dia-solo-nombre"])').count(),
    deHoy.toLowerCase(), (await elegido()).toLowerCase(),
  ], [7, TX.fechas.diasLargos[HOY_N].toLowerCase(), TX.fechas.diasLargos[OTRO].toLowerCase()]);
  await hojaDeLista.getByTestId('editar-este-dia-listo').click();
  await page.waitForTimeout(600);
  chequear('«Listo» vuelve a la lista', [await hojaDeLista.getByTestId('editar-este-dia').count(), await hojaDeLista.getByTestId('lo-que-sigue').count()], [0, 1]);
  await hojaDeLista.getByText(TX.sesion.listo, { exact: true }).first().click();
  await page.waitForTimeout(1200);
  chequear('se cierra y la sesión sigue ahí', [await page.getByTestId('hoja').filter({ visible: true }).count(), await page.getByLabel(TX.inicio.sumarSerie).first().isVisible()], [0, true]);

  // La última sesión con una serie de 7: no llega al objetivo. Se vuelve a entrar con el historial nuevo.
  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  ultimaSerie = 7;
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pasarLaEntradaNativa(page).catch(() => {});
  await entrar();
  chequear('con una serie de 7 en la sesión anterior, no parpadea ni avisa', [await globito(), await page.getByTestId('peso-parpadea').count()], [null, 0]);
  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await page.waitForTimeout(2500);

  // EDITARLA DE VERDAD EN MEDIO DEL ENTRENAMIENTO: sin dobles, en un navegador limpio. La rutina real tiene sentadilla
  // y press de banca todos los días; se empieza (propone la sentadilla), se quita la sentadilla de hoy desde la hoja y
  // la sesión pasa a proponer el press. La base queda con el día cambiado.
  const cadaDia = { descanso: false, ejercicios: [{ ejercicio: 'sentadilla', series: 3 }, { ejercicio: 'press_banca', series: 3 }] };
  const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Real', p_dias: Array.from({ length: 7 }, () => cadaDia) });
  limpia = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
  limpia.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
  await limpia.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(limpia);
  await limpia.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await limpia.locator('input[type=password]').first().fill(clave);
  await limpia.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await limpia.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).last().click({ timeout: 120000 });
  await limpia.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  const propone = async (nombre) => limpia.getByText(new RegExp(`^${nombre}`)).filter({ visible: true }).first().waitFor({ timeout: 20000 }).then(() => true, () => false);
  const alEmpezar = await propone('Sentadilla');
  await limpia.getByTestId('lista-de-hoy').first().click();
  // Los de la hoja: la rutina de Stats queda montada atrás, con los mismos botones.
  const hoja = limpia.getByTestId('hoja').filter({ visible: true }).first();
  const sigue = async () => (await hoja.getByTestId('lo-que-sigue').innerText()).split('\n').map((x) => x.trim()).filter((x) => x && !/^\d/.test(x));
  await hoja.getByText(/^Sentadilla/).first().waitFor({ timeout: 20000 });
  const sigueAntes = await sigue();
  await hoja.getByTestId('editar-este-dia-abrir').click();
  await hoja.getByLabel(TX.rutina.quitar).first().click({ timeout: 20000 });
  await limpia.waitForTimeout(2500);
  await limpia.screenshot({ path: join(SALIDA, '5-editada.png') });
  await hoja.getByTestId('editar-este-dia-listo').click();
  await limpia.waitForTimeout(800);
  const sigueDespues = await sigue();
  await limpia.screenshot({ path: join(SALIDA, '6-lista-despues.png') });
  await hoja.getByText(TX.sesion.listo, { exact: true }).first().click();
  await limpia.waitForTimeout(1200);
  const despues = await propone('Press de banca');
  await limpia.screenshot({ path: join(SALIDA, '7-la-sesion-la-tomo.png') });
  const enLaBase = ((await s.rpc('mis_rutinas')).data ?? []).find((r) => r.activa)?.dias.map((d) => d.ejercicios.map((e) => e.ejercicio).join('+')) ?? [];
  chequear('lo que sigue en la lista: antes los dos, y después de quitar la sentadilla, solo el press', [sigueAntes, sigueDespues], [['Sentadilla', 'Press de banca'], ['Press de banca']]);
  chequear('con una rutina de verdad: se quita la sentadilla de hoy en medio de la sesión, y la sesión pasa a proponer el press', [!eRutina, alEmpezar, despues, await limpia.getByText(/^Sentadilla/).filter({ visible: true }).count()], [true, true, true, 0]);
  chequear('y la base quedó con ese día cambiado, y solo ese', [enLaBase.filter((d) => d === 'press_banca').length, enLaBase.filter((d) => d === 'sentadilla+press_banca').length], [1, 6]);
  chequear('sin errores de la página', errores, []);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
  await (limpia ?? page).screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();

const { error: eBorrar } = await borrarCuentaDePrueba(s);
console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
if (eBorrar) fallos++;
process.exit(fallos ? 1 : 0);
