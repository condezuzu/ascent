// LA LISTA DE HOY, AL DÍA Y DONDE ESTÁS (27/11, dos cosas que contó el dueño desde el gimnasio).
//
// 1. «Cambia la rutina, pero cuando vuelvo a entrar a la lista sigue estando la vieja.» «Editar este día» abre con lo
//    que ya estaba precargado y se toca enseguida. Con la red lenta, la lectura de las rutinas que salió al abrir
//    llegaba DESPUÉS del cambio y dejaba en el teléfono la rutina de antes; y lo precargado nunca se enteraba de lo
//    guardado, así que el editor volvía a abrir con la vieja. Acá la lectura de `mis_rutinas` tarda 4 s en llegar.
// 2. Al tocar «Terminar serie» se abre la lista: el ejercicio recién hecho tiene que quedar en el medio, y «Listo»,
//    siempre abajo y a la vista, sin desplazar.
//
// Vista web de la nativa (:8090), teléfono chico (390 × 667) para que la lista no entre. Cuenta descartable; la rutina
// y lo que se le quita van a la base real.
//
//   node --env-file=.env.local supabase/probar-lista-de-hoy.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(10);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'lista-de-hoy');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-lh-${sello}@gmail.com`;
const clave = `Lh-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `lh_${sello.slice(-6)}` }).eq('id', uid);
// Nueve ejercicios de una serie, todos los días: cada «Terminar serie» cierra un bloque y la lista crece rápido.
const IDS = ['sentadilla', 'press_banca', 'fondos', 'jalon', 'remo_maquina', 'pec_deck', 'press_inclinado', 'martillo', 'triceps_polea'];
const cadaDia = { descanso: false, ejercicios: IDS.map((ejercicio) => ({ ejercicio, series: 1 })) };
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Larga', p_dias: Array.from({ length: 7 }, () => cadaDia) });
const NOMBRE = Object.fromEntries(((await s.from('ejercicios').select('id, nombre').in('id', IDS)).data ?? []).map((e) => [e.id, e.nombre]));
const nombres = (ids) => ids.map((id) => NOMBRE[id]);
const deHoyEnLaBase = async (dia) => ((await s.rpc('mis_rutinas')).data ?? []).find((r) => r.activa)?.dias[dia]?.ejercicios.map((e) => e.ejercicio) ?? null;

console.log('La lista de hoy, al día y donde estás');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 667 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));

// LA RED LENTA: la lectura llega al servidor enseguida (lee lo que hay en ese momento) y la respuesta tarda 4 s.
let lenta = false;
let alLeer = null;
await page.route((u) => u.pathname.endsWith('/rest/v1/rpc/mis_rutinas'), async (route) => {
  const r = await route.fetch().catch(() => null);
  if (!r) return route.abort().catch(() => {});
  alLeer?.();
  if (lenta) await new Promise((ok) => setTimeout(ok, 4000));
  await route.fulfill({ response: r }).catch(() => {});
});
const proximaLectura = () => new Promise((ok) => (alLeer = () => { alLeer = null; ok(); }));

const hoja = page.getByTestId('hoja').filter({ visible: true }).first();
const sigue = async () => (await hoja.getByTestId('lo-que-sigue').innerText()).split('\n').map((x) => x.trim()).filter((x) => x && !/^\d/.test(x));
// Los ejercicios que el editor del día tiene dibujados, en orden.
const enElEditor = async (dia) => {
  const texto = await hoja.getByTestId(`rutina-filas-${dia}`).innerText({ timeout: 5000 }).catch(() => '');
  return Object.values(NOMBRE).filter((n) => texto.includes(n)).sort((a, b) => texto.indexOf(a) - texto.indexOf(b));
};
const abrirLista = async () => {
  await page.getByTestId('lista-de-hoy').first().click();
  await hoja.getByTestId('lo-que-sigue').waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
};
const cerrarLista = async () => {
  await hoja.getByTestId('lista-listo').click();
  await page.waitForTimeout(1200);
};
// Dónde quedó cada cosa de la hoja abierta: el desplazamiento, la fila de lo recién hecho y «Listo».
const medir = () => page.evaluate(() => {
  const hojas = [...document.querySelectorAll('[data-testid="hoja"]')].filter((n) => n.getClientRects().length);
  const h = hojas.at(-1);
  if (!h) return null;
  const lienzo = [...h.querySelectorAll('*')].find((n) => /(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1);
  const fila = h.querySelector('[data-testid="lista-reciente"]');
  const listo = h.querySelector('[data-testid="lista-listo"]');
  if (!lienzo || !fila || !listo) return { lienzo: !!lienzo, fila: !!fila, listo: !!listo };
  const L = lienzo.getBoundingClientRect(), F = fila.getBoundingClientRect(), B = listo.getBoundingClientRect();
  return {
    nombre: fila.innerText.split('\n')[0].trim(),
    // Cuánto se aparta el centro de la fila del centro de lo que se ve, en puntos.
    corrido: Math.round(F.top + F.height / 2 - (L.top + L.height / 2)),
    alFinal: lienzo.scrollTop + lienzo.clientHeight >= lienzo.scrollHeight - 1,
    desplazada: lienzo.scrollTop > 0,
    filaEntera: F.top >= L.top - 1 && F.bottom <= L.bottom + 1,
    listoFijo: !lienzo.contains(listo) && B.top >= L.bottom - 1,
    listoALaVista: B.bottom <= window.innerHeight && B.top >= 0,
  };
});

try {
  chequear('la rutina se guardó en la base real', eRutina?.message ?? null, null);
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas', 'grupo', 'stats', 'rutina', 'subir'] })), [uid]);
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).last().click({ timeout: 120000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.getByText(new RegExp(`^${NOMBRE.sentadilla}`)).filter({ visible: true }).first().waitFor({ timeout: 30000 });
  const HOY = await page.evaluate(() => new Date().getDay());

  // ---- 1. LA LISTA DESPUÉS DE EDITAR ----
  await abrirLista();
  chequear('lo que sigue, antes de tocar nada: los nueve', await sigue(), nombres(IDS));
  await hoja.getByTestId('editar-este-dia-abrir').click();
  await hoja.getByLabel(TX.rutina.quitar).first().click({ timeout: 20000 });
  await page.waitForTimeout(2500);
  await hoja.getByTestId('editar-este-dia-listo').click();
  await page.waitForTimeout(800);
  chequear('se quita la sentadilla de hoy: la lista queda con los otros ocho', await sigue(), nombres(IDS.slice(1)));
  await cerrarLista();

  // Desde acá la red es lenta. Se vuelve a abrir el editor: tiene que mostrar ya la rutina como quedó, sin esperar.
  lenta = true;
  await abrirLista();
  const leyo = proximaLectura();
  await hoja.getByTestId('editar-este-dia-abrir').click();
  await hoja.getByTestId('editar-este-dia').waitFor({ timeout: 20000 });
  await page.waitForTimeout(300);
  const alAbrir = await enElEditor(HOY);
  await page.screenshot({ path: join(SALIDA, '1-editor-al-volver.png') });
  chequear('al volver a «Editar este día», con la red lenta: abre con la rutina como quedó, sin la sentadilla', alAbrir, nombres(IDS.slice(1)));

  // Y se toca enseguida, con la lectura que salió al abrir todavía en viaje: se quita el press de banca.
  await leyo;
  const filaDelPress = alAbrir.indexOf(NOMBRE.press_banca);
  await hoja.getByLabel(TX.rutina.quitar).nth(Math.max(0, filaDelPress)).click({ timeout: 20000 });
  // Lo que tarda la lectura vieja en llegar, y la que se pide de nuevo después.
  await page.waitForTimeout(10000);
  await hoja.getByTestId('editar-este-dia-listo').click();
  await page.waitForTimeout(800);
  const alListo = await sigue();
  await cerrarLista();
  await abrirLista();
  await page.screenshot({ path: join(SALIDA, '2-lista-al-volver.png') });
  chequear('se quita el press con la lectura en viaje: la lista queda con los otros siete, y también al volver a entrar', [alListo, await sigue()], [nombres(IDS.slice(2)), nombres(IDS.slice(2))]);
  chequear('y la base quedó con el día de hoy sin la sentadilla ni el press', await deHoyEnLaBase(HOY), IDS.slice(2));
  await cerrarLista();
  lenta = false;

  // ---- 2. DONDE ESTÁS: lo recién hecho en el medio, y «Listo» fijo abajo ----
  // La sesión ya propone lo primero que queda (fondos). Cada vuelta: una serie, «Terminar serie», y la lista se abre sola.
  const medidas = [];
  for (let i = 0; i < 6; i++) {
    await page.getByLabel(TX.inicio.sumarSerie).first().click({ timeout: 30000 });
    await page.waitForTimeout(900);
    await page.getByText(TX.sesion.terminarSerie, { exact: true }).filter({ visible: true }).first().click({ timeout: 20000 });
    await hoja.getByTestId('lo-que-sigue').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    medidas.push(await medir());
    if (i === 3) await page.screenshot({ path: join(SALIDA, '3-el-cuarto-en-el-medio.png') });
    if (i === 5) await page.screenshot({ path: join(SALIDA, '4-el-sexto.png') });
    await cerrarLista();
  }
  const hechos = nombres(IDS.slice(2, 8));
  chequear('la fila marcada es la del ejercicio recién terminado, cada vez', medidas.map((m) => m?.nombre ?? null), hechos);
  chequear('«Listo» queda fijo abajo de la lista y a la vista, las seis veces', medidas.map((m) => !!m?.listoFijo && !!m?.listoALaVista), [true, true, true, true, true, true]);
  // Con cuatro hechos la lista ya no entra y quedan filas abajo: se puede centrar de verdad.
  const cuarta = medidas[3];
  chequear('con cuatro hechos, la lista se desplazó sola y el recién terminado quedó en el medio (a 24 puntos o menos)', [cuarta?.desplazada ?? null, cuarta ? Math.abs(cuarta.corrido) <= 24 : null], [true, true]);
  chequear('el recién terminado se ve entero las seis veces; al final de la lista, lo más al medio que se puede', medidas.map((m) => !!m?.filaEntera && (Math.abs(m.corrido) <= 24 || m.alFinal || !m.desplazada)), [true, true, true, true, true, true]);
  chequear('sin errores de la página', errores, []);
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
