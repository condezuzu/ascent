// "EL TOTAL DICE UNA COSA Y LOS CIRCULITOS OTRA", pero EN LA APP NATIVA (22/9).
//
// La hermana de `reproducir-series-y-dia.mjs`, que recorre la web a :3020.
// Esta recorre la NATIVA a :8090, que es donde ahora se prueba todo. Importa
// que sean dos y no una: el arreglo del 19/9 vive en `compartido/useSesion` y
// lo comparten las dos, pero la caché no. En web es `localStorage`, que
// contesta al toque; en nativo es AsyncStorage, que contesta despues. Todo el
// arreglo se apoya en LEER la caché antes de subir la primera lista de
// bloques, asi que la unica forma de saber si tambien aguanta con una caché
// asincronica es correrlo contra el codigo nativo.
//
// EL CASO, que es el que rompia:
//   1. La sesión arranca en OTRO lado (acá: por RPC, como lo haria el otro
//      teléfono) y queda con una serie hecha y su bloque con ejercicio y peso.
//   2. Se abre la app nativa SIN NADA GUARDADO — sesión nueva del navegador,
//      que es lo mismo que otro aparato o la caché borrada.
//   3. Se toca el + una vez.
//
// Lo que tiene que pasar: los circulitos muestran la serie que ya estaba, y el
// + la lleva a 2 SIN BORRAR el bloque de antes en la base. Lo que pasaba: la
// pantalla arrancaba en cero y ese primer + subia una lista vacia que pisaba
// los bloques de la base.
//
// En cada parada imprime LAS TRES FUENTES —la pantalla, la caché del aparato
// (`ascent:sesion`) y la base—, que es como se ve en qué punto se separan.
//
// Deja la cuenta como estaba: foto de todas las tablas al principio, y al
// final se cierra la sesión, se borra el día si lo creó, y se compara.
//
//   node --env-file=.env.local herramientas/reproducir-series-nativa.mjs
//
// Necesita la nativa prendida en :8090 (movil/dev-web.cmd).
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { limiteDeSonda } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(15);

const BASE = 'http://localhost:8090';
const EJERCICIO = 'press_banca';
const PESO = 60;

const vivo = await fetch(BASE).then(() => true).catch(() => false);
if (!vivo) {
  console.log('la nativa no esta prendida en :8090 (movil/dev-web.cmd)');
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { data: quien, error: errEntrar } = await supabase.auth.signInWithPassword({
  email: process.env.CONEXION_EMAIL,
  password: process.env.CONEXION_PASSWORD,
});
if (errEntrar) {
  console.log('no pude entrar con la cuenta de prueba:', errEntrar.message);
  process.exit(1);
}
const uid = quien.user.id;

// ---- LA FOTO DE LA CUENTA, para dejarla como estaba ----
const TABLAS = [
  ['profiles', 'id'],
  ['logs', 'user_id'],
  ['sesiones', 'user_id'],
  ['prs', 'user_id'],
  ['weights', 'user_id'],
  ['photos', 'user_id'],
  ['descansos', 'user_id'],
  ['cargas_elegidas', 'user_id'],
  ['vidas_usadas', 'user_id'],
];
async function fotoDeLaCuenta() {
  const foto = {};
  for (const [t, col] of TABLAS) {
    const { data, error } = await supabase.from(t).select('*').eq(col, uid);
    foto[t] = error ? `ERROR ${error.message}` : (data ?? []).map((f) => JSON.stringify(f)).sort();
  }
  return foto;
}
function diferencias(antes, despues) {
  const cambios = [];
  for (const [t] of TABLAS) {
    const a = new Set(antes[t]);
    const d = new Set(despues[t]);
    for (const f of d) if (!a.has(f)) cambios.push(`+ ${t}: ${f}`);
    for (const f of a) if (!d.has(f)) cambios.push(`- ${t}: ${f}`);
  }
  return cambios;
}

/**
 * EL DÍA DE LA CUENTA, no el de la máquina. `mi_hoy()` es la función que usa
 * la app para decidir qué día es, con la zona horaria del perfil.
 *
 * SE PREGUNTA Y NO SE CALCULA porque acá se borra por fecha: con UTC, entre
 * las nueve de la noche y la medianoche de Montevideo la sonda limpiaría un
 * día que todavía no llegó y dejaría puesto el de hoy. Pasó (23/9, 00:05 UTC).
 */
async function diaDeLaCuenta() {
  const { data } = await supabase.rpc('mi_hoy');
  return data;
}

const antes = await fotoDeLaCuenta();

// ---- LAS TRES FUENTES ----
// LOS BLOQUES SE LEEN DE LA TABLA Y NO DE `mi_sesion`: esa RPC devuelve la
// sesión sin ellos —por eso la app los va a buscar aparte, en
// `recuperarBloques`— y leerlos de ahí daba una lista vacía que parecía el bug
// que estamos buscando. Una sonda que miente para el mismo lado que la
// sospecha es peor que no tenerla.
async function deLaBase() {
  const { data } = await supabase.from('sesiones').select('id,series,bloques').eq('id', idSesion).maybeSingle();
  if (!data) return { hay: false };
  return {
    hay: true,
    series: data.series,
    bloques: (data.bloques ?? []).map((b) => `${b.ejercicio}×${b.series}${b.pesos ? ` (${b.pesos.join(',')})` : ''}`),
  };
}
async function deLaCache(page) {
  const crudo = await page.evaluate(() => {
    try {
      // AsyncStorage en web guarda con este prefijo.
      return localStorage.getItem('ascent:sesion') ?? localStorage.getItem('@ascent:sesion');
    } catch {
      return null;
    }
  });
  if (!crudo) return { hay: false };
  try {
    const c = JSON.parse(crudo);
    return {
      hay: true,
      series: c.series,
      faltanBloques: c.faltanBloques,
      bloques: [...(c.bloques?.cerrados ?? []).map((b) => `${b.ejercicio}×${b.series}`), `en curso: ${c.bloques?.ejercicio}×${c.bloques?.hechas}`],
    };
  } catch {
    return { hay: 'ilegible' };
  }
}
async function deLaPantalla(page) {
  const texto = await page.evaluate(() => document.body.innerText);
  const total = texto.match(/(\d+)\s+en total/);
  // "1 de 3", el rótulo de los circulitos (`T.sesion.deMeta`). Se busca por la
  // forma exacta: hay otros rótulos con " de " adentro y el primero que
  // aparecía era "Peso de las próximas series".
  const circulos = await page.evaluate(
    () =>
      [...document.querySelectorAll('[aria-label]')]
        .map((e) => e.getAttribute('aria-label'))
        .find((r) => /^\d+ de \d+$/.test(r ?? '')) ?? null
  );
  return { total: total ? Number(total[1]) : null, bloque: circulos };
}
/**
 * TOCAR EL +, QUE NO SIEMPRE ES EL +. Al llegar a la meta del bloque el botón
 * grande se vuelve "Terminar serie" y sumar otra pasa a ser un renglón de
 * texto. La sonda se cayó ahí la primera vez, esperando un botón que en esa
 * pantalla ya no existía.
 */
async function sumarSerie(page) {
  const mas = page.getByLabel('Sumar una serie');
  if (await mas.isVisible().catch(() => false)) return mas.click();
  return page.getByText('Sumar otra', { exact: true }).last().click({ timeout: 30000 });
}

async function parada(page, nombre) {
  const [base, cache, pantalla] = [await deLaBase(), await deLaCache(page), await deLaPantalla(page)];
  console.log(`\n--- ${nombre}`);
  console.log('  pantalla:', JSON.stringify(pantalla));
  console.log('  caché:   ', JSON.stringify(cache));
  console.log('  base:    ', JSON.stringify(base));
  return { base, cache, pantalla };
}

// ---- 1. LA SESIÓN ARRANCA EN OTRO LADO ----
const { data: yaHabia } = await supabase.rpc('mi_sesion');
if ((Array.isArray(yaHabia) ? yaHabia[0] : yaHabia)?.id) {
  console.log('la cuenta ya tenia una sesion abierta: la cierro antes de empezar');
  await supabase.rpc('terminar_sesion');
}
const { data: arranque, error: errArranque } = await supabase.rpc('iniciar_sesion');
if (errArranque) {
  console.log('no pude iniciar la sesion:', errArranque.message);
  process.exit(1);
}
const idSesion = (Array.isArray(arranque) ? arranque[0] : arranque).id;
await supabase.rpc('fijar_series', { p_sesion: idSesion, p_series: 1 });
await supabase.rpc('fijar_bloques', {
  p_sesion: idSesion,
  p_bloques: [{ ejercicio: EJERCICIO, series: 1, pesos: [PESO] }],
});
console.log(`sesion ${idSesion.slice(0, 8)} abierta desde "el otro telefono": 1 serie de ${EJERCICIO} a ${PESO}`);

// ---- 2. SE ABRE LA NATIVA SIN NADA GUARDADO ----
// DESDE ACÁ, TODO ADENTRO DE UN `try`. La primera versión de esta sonda se
// cayó en un `click` y dejó la cuenta con un día de descanso puesto: la
// limpieza estaba al final, que es el único lugar donde no corre cuando algo
// falla. La cuenta de prueba se deja como estaba SIEMPRE, incluso cuando la
// sonda se rompe.
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errores = [];
const fallas = [];
let roto = null;
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
try {
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.locator('input[type=email], input[inputmode=email], input[autocomplete=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 60000 });
await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
await page.getByLabel('Sumar una serie').waitFor({ timeout: 60000 });
// La caché se escribe después del primer dibujo, y los bloques de la base
// llegan en otro viaje: se le da aire, que es lo que pasa en un teléfono.
await page.waitForTimeout(2500);

const alAbrir = await parada(page, 'la app abre con la sesión que arrancó en otro lado');

// ---- 3. EL + QUE BORRABA TODO ----
await sumarSerie(page);
await page.waitForTimeout(2500);
const alSumar = await parada(page, 'después de tocar el + una vez');

// ---- 3b. ABRIR Y TOCAR EL + EN SEGUIDA, SIN DARLE AIRE ----
// LO MÁS PARECIDO AL TELÉFONO QUE SE PUEDE HACER ACÁ. En el iPhone el
// almacenamiento va por el puente y contesta en milisegundos de verdad; a
// :8090 es `localStorage` y contesta casi al toque. Esa diferencia importa
// justo acá, porque todo el arreglo se apoya en leer la caché ANTES del primer
// +. No se puede simular la lentitud del puente, pero sí se puede sacar el
// tiempo del otro lado: arrancar de cero y tocar el + apenas aparece, sin
// esperar nada, que es lo que hace cualquiera que abre la app entre series.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByLabel('Sumar una serie').waitFor({ timeout: 60000 });
await sumarSerie(page);
await page.waitForTimeout(2500);
const alTocarEnSeguida = await parada(page, 'abrir de cero y tocar el + sin esperar');

// ---- 4. IR A OTRA PESTAÑA Y VOLVER ----
// ESTO NO EXISTE EN LA WEB, y por eso no lo cubría la sonda de la web: acá
// solo se monta la pestaña activa (ver `movil/src/Pestanas.tsx`), así que
// volver a Inicio lo monta DE CERO. El hook vuelve a leer la caché, y esa
// lectura es asíncrona: si la pantalla dibuja antes de que conteste, arranca
// con los bloques vacíos. Es la forma exacta del síntoma que se contó —el
// total puesto y los circulitos en cero—, así que se mira acá.
await page.getByText('Stats', { exact: true }).last().click();
await page.waitForTimeout(1500);
await page.getByText('Inicio', { exact: true }).last().click();
await page.waitForTimeout(2500);
const alVolver = await parada(page, 'después de ir a Stats y volver a Inicio');

// Y el + de después de volver: si al montar quedó en cero, este es el toque
// que sube una lista incompleta y borra lo de antes en la base.
await sumarSerie(page);
await page.waitForTimeout(2500);
const alSumarDeVuelta = await parada(page, 'el + después de volver');

// ---- 5. SIN SEÑAL, QUE ES DONDE SE ENTRENA ----
// El sótano del gimnasio. Los dos toques tienen que quedar en la pantalla y en
// la caché, la base no se entera hasta que vuelve la señal, y cuando vuelve
// sube todo SIN que se toque nada (la cola se reintenta sola: 5 s, después el
// doble, ver `nucleo/cola.ts`). Perder acá es perder series de verdad.
await ctx.setOffline(true);
await sumarSerie(page);
await page.waitForTimeout(600);
await sumarSerie(page);
await page.waitForTimeout(2000);
const sinSenal = await parada(page, 'dos + sin señal');
await ctx.setOffline(false);
// Se espera al reintento solo, sin tocar nada: es lo que hace el teléfono
// cuando sale del sótano. Se corta apenas la base llega a 5.
let vueltaLaSenal = null;
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(3000);
  vueltaLaSenal = await deLaBase();
  if (vueltaLaSenal.series === 6) break;
}
const alVolverLaSenal = await parada(page, 'cuando vuelve la señal (sin tocar nada)');

// ---- 6. CORREGIR EL DÍA CON LA SESIÓN ANDANDO ----
// ESTE ES EL CAMINO QUE SE CONTÓ EN EL GIMNASIO: "registré series, corregí
// algo del día, y al volver el total había subido pero los circulitos estaban
// en cero". En nativo existe: Stats > Entrenamiento > tocar el día > Corregir.
// Y corregir BORRA el día, que se lleva la sesión en cascada (ver
// `compartido/dia.ts`). O sea que al volver a Inicio la caché tiene una sesión
// que en la base ya no existe: justo el desencuentro que se vio.
const hoyNumero = Number((await diaDeLaCuenta()).slice(-2));
await page.getByText('Stats', { exact: true }).last().click();
await page.getByText('Entrenamiento', { exact: true }).last().click({ timeout: 30000 });
await page.getByLabel(`Ver el día ${hoyNumero}`).click({ timeout: 30000 });
await page.getByText('Descansé', { exact: true }).last().click({ timeout: 30000 });
// "Cambiarlo igual" solo aparece si la sesión estaba corriendo: es la pregunta
// de que se va a borrar.
const confirmar = page.getByText('Cambiarlo igual', { exact: true });
if (await confirmar.isVisible().catch(() => false)) await confirmar.click();
await page.waitForTimeout(1500);
// LA HOJA SE CIERRA ANTES DE CAMBIAR DE PESTAÑA. Es un `Modal`: mientras está
// abierta tapa la barra de abajo, y el toque en "Inicio" no llega nunca.
await page.getByText('Cerrar', { exact: true }).last().click({ timeout: 30000 });
await page.getByText('Inicio', { exact: true }).last().click({ timeout: 30000 });
await page.waitForTimeout(2500);
const alCorregir = await parada(page, 'después de corregir el día a "Descansé" y volver a Inicio');

// ---- EL VEREDICTO ----
// CUÁNTAS SERIES GUARDÓ LA BASE EN LOS BLOQUES. Es el número que se perdía: el
// contador (`sesiones.series`) podía estar bien y los bloques vacíos.
const enLosBloques = (p) => (p.base.bloques ?? []).reduce((n, b) => n + Number(b.match(/×(\d+)/)?.[1] ?? 0), 0);
// Cada parada con el número que le toca, para no tener que renumerar a mano
// cuando se agrega un paso en el medio.
const cuenta = (p, nombre, n) => {
  if (p.pantalla.total !== n) fallas.push(`${nombre}: la pantalla decia ${p.pantalla.total} y tenian que ser ${n}`);
  if (p.base.series !== n) fallas.push(`${nombre}: la base quedo en ${p.base.series} series y tenian que ser ${n}`);
  if (enLosBloques(p) !== n)
    fallas.push(`${nombre}: los bloques de la base suman ${enLosBloques(p)} (${(p.base.bloques ?? []).join(' | ')}) y tenian que sumar ${n}`);
  if (!(p.base.bloques ?? []).some((b) => b.includes(String(PESO))))
    fallas.push(`${nombre}: el peso ${PESO} ya no esta en la base: ${(p.base.bloques ?? []).join(' | ')}`);
};

if (!/1 de /.test(alAbrir.pantalla.bloque ?? '')) fallas.push(`al abrir, los circulitos decian "${alAbrir.pantalla.bloque}" en vez de "1 de N"`);
cuenta(alAbrir, 'al abrir con la sesion de otro lado', 1);
cuenta(alSumar, 'el primer +', 2);
// El que más se parece al teléfono: abrir de cero y tocar sin esperar.
if (alTocarEnSeguida.pantalla.bloque !== '3 de 3')
  fallas.push(`al abrir y tocar en seguida, los circulitos decian "${alTocarEnSeguida.pantalla.bloque}" en vez de "3 de 3": es el sintoma del gimnasio`);
cuenta(alTocarEnSeguida, 'abrir de cero y tocar el + sin esperar', 3);
// Volver a Inicio no puede perder nada: ni en la pantalla ni en la base. En
// nativo solo se monta la pestaña activa, así que esto monta Inicio DE CERO.
if (alVolver.pantalla.bloque !== '3 de 3')
  fallas.push(`al volver de Stats, los circulitos decian "${alVolver.pantalla.bloque}" en vez de "3 de 3": es el sintoma del gimnasio`);
cuenta(alVolver, 'volver de Stats a Inicio', 3);
cuenta(alSumarDeVuelta, 'el + despues de volver', 4);

// Sin señal: la pantalla sigue contando y la base espera. Cuando vuelve, sube
// todo junto y con los pesos, sin que se toque nada.
if (sinSenal.pantalla.total !== 6) fallas.push(`sin señal, la pantalla decia ${sinSenal.pantalla.total} y tenia que decir 6`);
if (sinSenal.base.series !== 4) fallas.push(`sin señal, la base tendria que haberse quedado en 4 y quedo en ${sinSenal.base.series}`);
cuenta(alVolverLaSenal, 'cuando vuelve la señal', 6);

// Corregir el día borró la sesión: la pantalla NO puede seguir mostrando un
// total de una sesión que ya no existe, y mucho menos un total con los
// circulitos en cero, que es el sintoma que se conto.
if (alCorregir.base.hay) fallas.push('corregir el dia tenia que borrar la sesion en la base y quedo viva');
if (alCorregir.pantalla.total !== null && alCorregir.pantalla.bloque === null)
  fallas.push(`despues de corregir, la pantalla mostraba "${alCorregir.pantalla.total} en total" sin circulitos: es el sintoma del gimnasio`);
if (alCorregir.pantalla.total !== null && !alCorregir.base.hay)
  fallas.push(`despues de corregir, la pantalla seguia contando ${alCorregir.pantalla.total} series de una sesion que ya no existe`);
if (alCorregir.cache.hay && !alCorregir.base.hay)
  fallas.push('despues de corregir, la cache del aparato quedo con una sesion que la base ya no tiene');
} catch (e) {
  roto = e;
  // LA FOTO ANTES DE LA TEORÍA: cuando un toque no entra, lo que hay que ver
  // es qué había en pantalla, no imaginarlo.
  await page.screenshot({ path: 'capturas/sonda-series-rota.png' }).catch(() => {});
} finally {
  // ---- DEJAR LA CUENTA COMO ESTABA ----
  await nav.close().catch(() => {});
  await supabase.rpc('terminar_sesion');
  const hoy = await diaDeLaCuenta();
  const teniaHoy = antes.logs.some((f) => JSON.parse(f).fecha === hoy);
  if (!teniaHoy) await supabase.from('logs').delete().eq('user_id', uid).eq('fecha', hoy);
  await supabase.from('sesiones').delete().eq('id', idSesion);
  const cambios = diferencias(antes, await fotoDeLaCuenta());

  console.log('\n================ VEREDICTO');
  // Los de 'sin internet' son los que la sonda provoca a proposito.
  const otrosErrores = errores.filter((e) => !/INTERNET_DISCONNECTED|Failed to fetch/i.test(e));
  if (otrosErrores.length) console.log('errores de consola:', otrosErrores.slice(0, 5).join(' | '));
  if (roto) console.log('LA SONDA SE ROMPIO:', roto.message?.split('\n').slice(0, 6).join('\n  '), '\n  (foto en capturas/sonda-series-rota.png)');
  else if (fallas.length === 0) console.log('OK: la nativa abre con lo que hay en la base, el + no pisa nada y corregir el dia no deja fantasmas.');
  for (const f of fallas) console.log('FALLA:', f);
  console.log(cambios.length === 0 ? 'la cuenta quedo como estaba.' : `LA CUENTA NO QUEDO IGUAL:\n${cambios.join('\n')}`);
  process.exit(!roto && fallas.length === 0 && cambios.length === 0 ? 0 : 1);
}
