// LA VUELTA GRANDE (2/11): lo de la sección 14 de la galería y lo que se pidió encima, tocando la pantalla.
// «Iniciar grupo» abre la lista de los que entrenan, y sin nadie lo dice; el número grande; las series
// ×2 ×3 ×4 ×5 +; la rutina que llega; la cascada al tocar la barra; y la entrada a Moss.
//
// En la vista web de la nativa, con cuentas descartables. Lo que NO mide: el iPhone. El tirón desde el tope de
// Stats no se puede hacer con el ratón (la web no rebota): acá se entra a Moss tocando. El calor del planeta
// a pantalla completa tampoco, y es lo primero que hay que mirar en un teléfono.
//
//   node --env-file=.env.local supabase/probar-vuelta-grande.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(12);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'vuelta-grande');
mkdirSync(SALIDA, { recursive: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

async function cuenta(letra) {
  const s = createClient(url, anon, { auth: { persistSession: false } });
  const correo = `agusconde20+ascent-vg-${letra}-${sello}@gmail.com`;
  const clave = `Vg-${sello}-${letra}9`;
  const { error } = await s.auth.signUp({ email: correo, password: clave });
  if (error) throw new Error(`alta ${letra}: ${error.message}`);
  const id = (await s.auth.getUser()).data.user.id;
  const nombre = `vg_${letra}${sello.slice(-5)}`;
  await s.from('profiles').update({ username: nombre, sexo: 'm' }).eq('id', id);
  return { s, id, correo, clave, nombre };
}

const A = await cuenta('a');
const B = await cuenta('b');
const nav = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'] });
const errores = [];
try {
  const { data: am } = await A.s.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id').single();
  await B.s.from('friendships').update({ estado: 'aceptada' }).eq('id', am.id);
  // Una rutina con algo todos los días menos el de hoy: se tiene que abrir el próximo.
  const hoyD = new Date().getDay();
  const dias = Array.from({ length: 7 }, (_, d) => ({ descanso: false, ejercicios: d === hoyD ? [] : [{ ejercicio: 'press_banca', series: 4 }, { ejercicio: 'sentadilla', series: 3 }] }));
  const { error: eRutina } = await A.s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Prueba', p_dias: dias });
  if (eRutina) console.log('  --   no se guardó la rutina: ' + eRutina.message);

  const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  const texto = (t) => page.getByText(t, { exact: true }).last();
  const seVe = (t) => page.getByText(t, { exact: true }).filter({ visible: true }).count();
  const foto = (n) => page.screenshot({ path: join(SALIDA, `${n}.png`) });
  const opacidad = (loc) => loc.evaluate((n) => { let o = 1; for (let a = n; a; a = a.parentElement) o *= Number(getComputedStyle(a).opacity); return o; });
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas', 'amigos', 'album', 'rutina'] })), [A.id]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(A.correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(A.clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  const grupo = page.getByTestId('iniciar-grupo').first();
  await grupo.waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);

  console.log('Iniciar grupo, sin nadie entrenando');
  await grupo.click();
  await page.getByTestId('iniciar-grupo-nadie').first().waitFor({ timeout: 10000 });
  chequear('lo dice, en una frase', await seVe(TX.inicio.nadieEntrenando), 1);
  chequear('no hay nada para invitar', await page.getByTestId('iniciar-grupo-invitar').count(), 0);
  await foto('grupo-nadie');
  await page.mouse.click(195, 790);
  await page.waitForTimeout(500);
  chequear('y no empezó a entrenar', await seVe(TX.inicio.iniciarEntrenamiento), 1);

  console.log('Iniciar grupo, con un amigo entrenando');
  await B.s.rpc('iniciar_sesion');
  await grupo.click();
  await page.getByTestId('iniciar-grupo-invitar').first().waitFor({ timeout: 15000 });
  chequear('está en la lista, con «Invitar»', [await page.getByTestId('iniciar-grupo-amigo').count(), await page.getByText(B.nombre, { exact: true }).filter({ visible: true }).count() >= 1], [1, true]);
  await foto('grupo-lista');
  await page.getByTestId('iniciar-grupo-invitar').first().click();
  await page.getByTestId('iniciar-grupo-dijo').first().waitFor({ timeout: 15000 });
  chequear('dice que salió, y el botón se va', [await seVe(TX.social.invitacionEnviada), await page.getByTestId('iniciar-grupo-invitar').count()], [1, 0]);
  const pendientes = ((await B.s.rpc('mis_uniones')).data ?? []).filter((u) => u.estado === 'pendiente' && u.tipo === 'invitacion');
  chequear('a B le llegó', pendientes.length, 1);
  await page.mouse.click(195, 790);
  await page.waitForTimeout(800);
  // Invitar empieza a entrenar: el grupo es de quien entrena.
  chequear('invitar empezó a entrenar', await page.getByLabel(TX.inicio.sumarSerie).count() > 0, true);

  console.log('Cifras, entrenando');
  await page.waitForTimeout(1500);
  // Desde el 5/11 las series son otra vez los puntitos, sin el número grande.
  const cuenta_ = page.getByTestId('cuenta-de-series').first();
  const llenos = () => cuenta_.locator('[data-testid="punto-lleno"]').count();
  chequear('los puntitos dicen las series, sin número grande', [await llenos(), await cuenta_.locator('[data-testid="punto-vacio"]').count() > 0, /\d/.test(await cuenta_.innerText())], [0, true, false]);
  for (const m of ['×2', '×3', '×4', '×5', '+']) chequear(`está ${m}`, await seVe(m) >= 1, true);
  for (const m of ['×1', '×6', '×8', '×10', '×12']) chequear(`no está ${m}`, await seVe(m), 0);
  await foto('entrenando');
  const suma = page.getByLabel(TX.inicio.sumarSerie).first();
  await suma.click();
  await page.waitForTimeout(120);
  await foto('entrenando-rueda');
  await page.waitForTimeout(900);
  chequear('al sumar, se llena un puntito', await llenos(), 1);
  const terminar = texto(TX.sesion.terminar);
  await terminar.click({ timeout: 10000 });
  await page.waitForTimeout(700);
  await terminar.click({ timeout: 10000 });
  await page.waitForTimeout(2200);

  console.log('El número grande de Inicio');
  const tamano = await page.evaluate(() => Math.max(...[...document.querySelectorAll('[data-testid="pantalla-inicio"] div')].map((e) => (e.children.length === 0 && /^\d+$/.test(e.textContent) ? parseFloat(getComputedStyle(e).fontSize) : 0))));
  chequear('la racha va a 148', tamano, 148);
  chequear('sin el rótulo de las vidas ni las letras de los días', await seVe(TX.impulso.titulo) === 0 || (await page.getByTestId('vidas-inicio').first().getAttribute('aria-label')) === TX.impulso.titulo, true);

  console.log('La cascada, al tocar la barra');
  await page.getByRole('tab', { name: /^Stats/ }).first().click();
  await page.getByTestId('cifras-del-ano').first().waitFor({ timeout: 30000 });
  const hero = page.getByTestId('cifras-del-ano').first();
  await page.getByRole('tab', { name: /^Inicio/ }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('tab', { name: /^Stats/ }).first().click();
  await page.waitForTimeout(60);
  const alLlegar = await opacidad(hero);
  await page.waitForTimeout(1200);
  chequear('lo de la pantalla llega de a poco, y termina entero', [alLlegar < 0.9, await opacidad(hero) > 0.99], [true, true]);

  console.log('Cifras, en Stats');
  chequear('la cifra de la pantalla, sin caja, y los meses', [await seVe(TX.stats.diasEsteAno), await page.getByTestId('meses-del-ano').count()], [1, 1]);
  chequear('el año entero no está hasta tocar los meses', await page.getByTestId('el-ano').count(), 0);
  await page.getByTestId('meses-del-ano').first().click();
  await page.waitForTimeout(700);
  chequear('y se abre', await page.getByTestId('el-ano').count(), 1);
  await foto('stats');
  await page.getByTestId('meses-del-ano').first().click();
  await page.waitForTimeout(500);

  console.log('Tu rutina llega');
  await texto(TX.stats.pestanaEntrenamiento).click();
  await page.waitForTimeout(150);
  await foto('rutina-llegando');
  const rayas = await page.getByTestId('raya-de-rutina').count();
  chequear('una raya por día, que se dibujan', rayas, 7);
  const proximo = (hoyD + 1) % 7;
  const filasAbiertas = () => page.locator('[data-testid="rutina-guardada"]').first().evaluate((n) => [...n.querySelectorAll('[aria-label]')].filter((e) => /serie/i.test(e.getAttribute('aria-label') ?? '')).length);
  chequear('al principio, nada abierto', await filasAbiertas(), 0);
  await page.waitForTimeout(1500);
  const abiertoEl = (d) => page.getByTestId(`rutina-dia-${d}`).first().evaluate((n) => [...n.parentElement.parentElement.querySelectorAll('[aria-label]')].some((e) => /serie/i.test(e.getAttribute('aria-label') ?? '')));
  chequear('hoy no tiene nada: se abre solo el próximo', [await abiertoEl(hoyD), await abiertoEl(proximo)], [false, true]);
  await foto('rutina-abierta');
  // El de abajo es el que sigue EN LA PANTALLA, no el día que sigue: la lista empieza el lunes, y un jueves
  // «hoy + 3» era el domingo, el último, con el lunes arriba de todo. Fallaba todos los jueves (5/11).
  const orden = [...new Set(await page.evaluate(() => [...document.querySelectorAll('[data-testid^="rutina-dia-"]')].map((n) => Number(n.getAttribute('data-testid').slice('rutina-dia-'.length)))))];
  const otro = orden.slice(0, -1).find((d) => d !== hoyD && d !== proximo);
  const deAbajo = orden[orden.indexOf(otro) + 1];
  await page.getByTestId(`rutina-dia-${otro}`).first().scrollIntoViewIfNeeded();
  const bajo = await page.getByTestId(`rutina-dia-${deAbajo}`).first().boundingBox();
  await page.getByTestId(`rutina-dia-${otro}`).first().click();
  const posiciones = new Set();
  for (let i = 0; i < 10; i++) {
    const b = await page.getByTestId(`rutina-dia-${deAbajo}`).first().boundingBox();
    if (b) posiciones.add(Math.round(b.y));
    await page.waitForTimeout(40);
  }
  chequear('abrir otro día corre: lo de abajo pasa por el medio, no salta', posiciones.size >= 3, true);
  void bajo;
  await texto(TX.stats.pestanaGeneral).click();
  await page.waitForTimeout(900);

  console.log('Moss, arriba de Stats');
  const entrada = page.getByTestId('entrada-a-moss').first();
  const caja = await entrada.boundingBox();
  const selector = await page.getByText(TX.stats.pestanaGeneral, { exact: true }).first().boundingBox();
  chequear('la entrada está arriba de todo, con «Pronto»', [caja.y < selector.y, await page.getByText(TX.moss.nombre, { exact: true }).filter({ visible: true }).count() >= 1, await page.getByText(TX.moss.pronto, { exact: true }).filter({ visible: true }).count() >= 1], [true, true, true]);
  await foto('moss-entrada');
  await entrada.click();
  await page.waitForTimeout(240);
  const moss = page.getByTestId('pantalla-de-moss').first();
  const bajando = await moss.boundingBox();
  await foto('moss-bajando');
  await page.waitForTimeout(1100);
  const puesta = await moss.boundingBox();
  chequear('el cielo baja, y termina ocupando la pantalla', [bajando.y < -1, Math.round(puesta.y), Math.round(puesta.height)], [true, 0, 844]);
  chequear('dice «Pronto»', await page.getByTestId('moss-pronto').filter({ visible: true }).count() >= 1, true);
  const conLetras = await page.evaluate(() => document.fonts.check('16px CormorantGaramond_400Regular_Italic') && document.fonts.check('13px Jost_400Regular'));
  chequear('con las letras de Moss', conLetras, true);
  const fondo = await page.getByTestId('moss-pronto').first().evaluate((n) => getComputedStyle(n).color);
  chequear('y sus colores, no los del rango', fondo, 'rgb(232, 196, 106)');
  await foto('moss');
  await page.getByTestId('moss-volver').first().click();
  await page.waitForTimeout(900);
  chequear('se vuelve a Ascent', await page.getByTestId('pantalla-de-moss').count(), 0);

  chequear('sin errores de la página', [...new Set(errores)], []);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 240));
  console.log(errores.length ? '  errores: ' + [...new Set(errores)].slice(0, 5).join(' | ') : '');
} finally {
  await nav.close();
  for (const x of [A, B]) {
    await x.s.rpc('terminar_sesion').then(() => x.s.rpc('dejar_de_entrenar'), () => {});
    const { error } = await borrarCuentaDePrueba(x.s);
    if (error) {
      fallos++;
      console.log(`  FALLA cuenta ${x.nombre}: ${error.message}`);
    }
  }
  console.log(`  ${fallos ? '' : 'ok   '}cuentas borradas`);
}
process.exit(fallos ? 1 : 0);
