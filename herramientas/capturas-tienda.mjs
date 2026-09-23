// LAS CAPTURAS DE LA FICHA DE LA APP STORE, al tamaño que pide Apple.
//
// 1290 × 2796 es el tamaño del iPhone de 6.9 pulgadas, que es el único juego
// obligatorio: Apple escala ese hacia abajo para los demás. Sale de una
// ventana de 430 × 932 con densidad 3, que es exactamente el aparato.
//
// SE SACAN DE LA APP NATIVA (:8090) Y NO DE LA WEB, aunque la web tenga las
// mismas pantallas: lo que se publica en la tienda tiene que ser la app que se
// baja. Las diferencias son chicas y se notan igual — la barra de abajo, los
// márgenes, el tipo de botón.
//
// CON `--con-datos` LA CUENTA SE LLENA ANTES Y SE VACÍA DESPUÉS. La primera
// corrida salió con la racha en cero y media pantalla vacía: honesto, e
// inservible para una tienda — la pantalla principal de una app de rachas no
// puede decir 0. Así que se fabrican trece días, un entrenamiento, tres marcas
// y seis pesos, se sacan las fotos, y se borra EXACTAMENTE lo que se creó.
//
// LA CUENTA DE PRUEBA SE DEJA COMO ESTABA, y no de palabra: se le saca una
// foto a todas las tablas al principio, se compara al final, y si algo no
// coincide se dice. Las sesiones no se pueden insertar a mano —la base solo
// deja leerlas, se crean por RPC— así que el entrenamiento es de hoy.
//
//   node --env-file=.env.local herramientas/capturas-tienda.mjs [--con-datos] [--puerto=8090]
//
// Necesita la nativa prendida (movil/dev-web.cmd).
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limiteDeSonda } from '../supabase/utiles.mjs';

limiteDeSonda(10);

const PUERTO = (process.argv.find((a) => a.startsWith('--puerto=')) ?? '--puerto=8090').split('=')[1];
const BASE = `http://localhost:${PUERTO}`;
// CARPETA PROPIA Y NO `capturas/tienda`: `npm run capturas` borra `capturas/`
// entero antes de escribir (rmSync recursivo), asi que las de la tienda
// desaparecian en el cierre de la tanda siguiente. Se perdieron una vez.
const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas-tienda');
mkdirSync(SALIDA, { recursive: true });

const vivo = await fetch(BASE).then(() => true).catch(() => false);
if (!vivo) {
  console.log(`la nativa no esta prendida en :${PUERTO}`);
  process.exit(1);
}

// ---- LOS DATOS FABRICADOS, si se piden ----
const CON_DATOS = process.argv.includes('--con-datos');
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
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
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

// Los días que se fabrican se cuentan desde el día de la cuenta, por lo mismo:
// con UTC, "hace un día" puede ser hoy.
let HOY = null;
const hoyISO = () => HOY;
const diasAtras = (n) => {
  const d = new Date(`${HOY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

async function fotoDeLaCuenta(uid) {
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

let uid = null;
let antes = null;
const creado = { logs: [], prs: [], sesion: null };

if (CON_DATOS) {
  const { data: quien, error } = await supabase.auth.signInWithPassword({
    email: process.env.CONEXION_EMAIL,
    password: process.env.CONEXION_PASSWORD,
  });
  if (error) {
    console.log('no pude entrar con la cuenta de prueba:', error.message);
    process.exit(1);
  }
  uid = quien.user.id;
  HOY = await diaDeLaCuenta();
  antes = await fotoDeLaCuenta(uid);

  // TRECE DÍAS, con dos de descanso en el medio: una racha de doce que se ve
  // como una semana de alguien, no como una fila perfecta de trece.
  const yaEstan = new Set((antes.logs ?? []).map((f) => JSON.parse(f).fecha));
  for (let i = 12; i >= 0; i--) {
    const fecha = diasAtras(i);
    if (yaEstan.has(fecha)) continue;
    const esDescanso = i === 4 || i === 11;
    const { data, error: e } = await supabase
      .from('logs')
      .insert({ user_id: uid, fecha, es_descanso: esDescanso })
      .select('id')
      .single();
    if (!e && data) creado.logs.push(data.id);
  }

  // EL PESO NO SE FABRICA, Y ESTO SE APRENDIÓ ROMPIÉNDOLO (22/9). `weights`
  // solo tiene `select` para el dueño: se escribe por `anotar_peso` y NO HAY
  // camino de borrado desde el cliente, a propósito. O sea que un peso puesto
  // acá no se puede sacar después, y esta sonda tiene una sola regla: deja la
  // cuenta como estaba. Una corrida dejó 82,4 kg del 22/9 que hubo que sacar
  // a mano en el editor de SQL.
  //
  // La consecuencia para las fotos: si la cuenta no tiene pesos anotados, la
  // sección de peso sale en su estado vacío. Eso se arregla con datos de
  // verdad, no acá.

  // Las tres que cuentan para el DOTS, que es lo que hace que Stats tenga algo
  // que mostrar arriba de todo.
  for (const [ejercicio, peso, reps] of [
    // UNA MARCA REAL ES DE UNA REPETICIÓN: la base lo exige
    // (`prs_real_es_una_rep`), porque un máximo estimado y uno levantado de
    // verdad no son el mismo dato.
    ['sentadilla', 120, 1],
    ['press_banca', 90, 1],
    ['peso_muerto', 150, 1],
  ]) {
    const { data, error: e } = await supabase
      .from('prs')
      .insert({ user_id: uid, ejercicio, peso, reps, es_real: true, fecha: diasAtras(6) })
      .select('id')
      .single();
    if (!e && data) creado.prs.push(data.id);
  }

  // EL ENTRENAMIENTO DE HOY VA POR RPC: la base no deja insertar sesiones a
  // mano, y está bien que no deje.
  const { data: yaHabia } = await supabase.rpc('mi_sesion');
  if ((Array.isArray(yaHabia) ? yaHabia[0] : yaHabia)?.id) await supabase.rpc('terminar_sesion');
  const { data: arranque } = await supabase.rpc('iniciar_sesion');
  const ses = Array.isArray(arranque) ? arranque[0] : arranque;
  if (ses?.id) {
    creado.sesion = ses.id;
    await supabase.rpc('fijar_series', { p_sesion: ses.id, p_series: 9 });
    await supabase.rpc('fijar_bloques', {
      p_sesion: ses.id,
      p_bloques: [
        { ejercicio: 'press_banca', series: 4, pesos: [80, 80, 82.5, 82.5], carga: 'total' },
        { ejercicio: 'remo_barra', series: 5, pesos: [70, 70, 70, 72.5, 72.5], carga: 'total' },
      ],
    });
    await supabase.rpc('terminar_sesion');
  }
  console.log(`datos puestos: ${creado.logs.length} días, ${creado.prs.length} marcas, 1 entrenamiento`);
}

const nav = await chromium.launch();
// 430 × 932 con densidad 3 = 1290 × 2796. El iPhone de 6.9", exacto.
const ctx = await nav.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
});
const page = await ctx.newPage();
const errores = [];
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

/**
 * TOCAR EL +, QUE NO SIEMPRE ES EL +: al llegar a la meta del bloque el botón
 * grande se vuelve "Terminar serie" y sumar otra pasa a ser un renglón de
 * texto. Es la misma trampa que se comió `reproducir-series-nativa.mjs`.
 */
async function sumarSerie(page) {
  // `.last()` Y NO EL LOCALIZADOR PELADO: con las cinco pestañas montadas a la
  // vez, un `getByLabel` puede encontrar más de un candidato, y ahí Playwright
  // no elige —tira por modo estricto—. El `catch` de abajo se lo tragaba y
  // caíamos al camino de "Sumar otra", que solo existe con la meta cumplida:
  // o sea que el fallo se veía como un timeout de treinta segundos esperando
  // un botón que no tenía por qué estar. Es lo mismo que ya hacía el barrido.
  const mas = page.getByLabel('Sumar una serie').last();
  if (await mas.isVisible().catch(() => false)) return mas.click();
  return page.getByText('Sumar otra', { exact: true }).last().click({ timeout: 30000 });
}

async function foto(nombre) {
  const ruta = join(SALIDA, `${nombre}.png`);
  await page.screenshot({ path: ruta });
  console.log(`  ${nombre}.png`);
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(8000);
  // La ventana de las vidas tapa Inicio. Es de esta cuenta, no del producto.
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.isVisible().catch(() => false)) await entendido.click();
  // El motor tarda en dibujar y es la mitad de lo que se ve en la foto.
  await page.waitForTimeout(4000);

  console.log(`\n1290 × 2796, en capturas-tienda:`);

  // INICIO CON EL ENTRENAMIENTO ANDANDO, y no en reposo. La primera versión
  // sacaba la pantalla quieta: la racha arriba y media pantalla vacía abajo.
  // Es la pantalla real, pero de una app de gimnasio en una tienda lo que hay
  // que mostrar es lo que se hace CON ella — el bloque, las series, el peso, el
  // cronómetro corriendo. La quieta la ve cualquiera después de instalarla.
  //
  // El entrenamiento se empieza tocando, como una persona, y no por RPC: así la
  // foto sale del mismo camino que recorre quien usa la app, con el cronómetro
  // contando de verdad.
  await page.getByText('Iniciar entrenamiento', { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  // Tres series, para que los circulitos tengan algo que contar y el bloque no
  // salga vacío.
  for (let i = 0; i < 3; i++) {
    await sumarSerie(page);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(2500);
  await foto('1-inicio');

  // Y se termina, que además deja la cuenta como la encontró: la sesión se
  // borra igual al final, pero una sesión abierta cambiaría las fotos de las
  // otras pantallas.
  await page.getByText('Terminar', { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(1200);
  const terminar = page.getByText('Terminar', { exact: true });
  if (await terminar.isVisible().catch(() => false)) await terminar.click();
  await page.waitForTimeout(2500);
  const listo = page.getByText(/Listo por hoy/i).first();
  if (await listo.isVisible().catch(() => false)) await listo.click();
  await page.waitForTimeout(1500);

  for (const [pestana, nombre] of [
    ['Ranking', '2-ranking'],
    ['Álbum', '3-album'],
    ['Stats', '4-stats'],
  ]) {
    await page.getByText(pestana, { exact: true }).last().click();
    await page.waitForTimeout(4000);
    await foto(nombre);
  }

  // Stats → Entrenamiento, que es la pantalla con más sustancia de la app.
  await page.getByText('Entrenamiento', { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(3000);
  await foto('5-entrenamiento');
} catch (e) {
  console.log('SE ROMPIO:', e.message.split('\n').slice(0, 3).join(' | '));
} finally {
  await nav.close();
  console.log('\nerrores de consola:', errores.slice(0, 3).join(' | ') || 'ninguno');

  // ---- DEVOLVER LA CUENTA ----
  if (CON_DATOS && uid) {
    if (creado.sesion) {
      await supabase.rpc('terminar_sesion');
      await supabase.from('sesiones').delete().eq('id', creado.sesion);
    }
    // Los días VAN ÚLTIMOS: borrar un día borra su sesión en cascada, y si se
    // hiciera antes se llevaría puesta una sesión que no creamos nosotros.
    for (const id of creado.prs) await supabase.from('prs').delete().eq('id', id);
    for (const id of creado.logs) await supabase.from('logs').delete().eq('id', id);
    // El día de hoy lo pudo crear la sesión, no solo el bucle de arriba.
    const teniaHoy = (antes.logs ?? []).some((f) => JSON.parse(f).fecha === hoyISO());
    if (!teniaHoy) await supabase.from('logs').delete().eq('user_id', uid).eq('fecha', hoyISO());

    const cambios = diferencias(antes, await fotoDeLaCuenta(uid));
    console.log(cambios.length === 0 ? 'la cuenta quedo como estaba.' : `LA CUENTA NO QUEDO IGUAL:\n${cambios.join('\n')}`);
  }
}
