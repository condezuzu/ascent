// ¿INICIO ENTRA EN UNA PANTALLA CON EL ENTRENAMIENTO ANDANDO? (19/9)
//
// Estaba decidido que sí, sin scroll, siempre, y en el gimnasio se pudo
// scrollear. Esto lo MIDE en la web, en varios tamaños de teléfono y en los
// estados que cambian el alto: recién empezado (con el globo de la primera
// vez), con una serie y el descanso andando, y con la pregunta de marca.
// Falla si sobra algo, si algo queda tapado detrás de lo anclado abajo, o si
// el + (que toma lo que sobra de la pantalla) llegó a su mínimo de 64 px: eso
// quiere decir que ya no entra. Reporta cuánto sobra y quién empuja (la misma cuenta que
// `supabase/medir-scroll.mjs`, sin compilar: contra el servidor de desarrollo).
//
// Deja la cuenta como estaba, como `reproducir-series-y-dia.mjs`.
//
//   node --env-file=.env.local herramientas/medir-inicio-en-sesion.mjs
//
// Necesita la web prendida en :3020.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { limiteDeSonda, pasarLaEntrada } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(12);

const BASE = 'http://localhost:3020';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { data: sesion, error: errEntrar } = await supabase.auth.signInWithPassword({
  email: process.env.CONEXION_EMAIL,
  password: process.env.CONEXION_PASSWORD,
});
if (errEntrar) {
  console.log('no pude entrar con la cuenta de prueba:', errEntrar.message);
  process.exit(1);
}
const uid = sesion.user.id;

// ---- LA FOTO DE LA CUENTA ----
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
function diferencias(a, b) {
  const d = [];
  for (const [t] of TABLAS) {
    const x = a[t], y = b[t];
    if (typeof x === 'string' || typeof y === 'string') {
      if (x !== y) d.push(`${t}: ${x} / ${y}`);
      continue;
    }
    const sx = new Set(x), sy = new Set(y);
    for (const f of x) if (!sy.has(f)) d.push(`${t} ANTES: ${f.slice(0, 300)}`);
    for (const f of y) if (!sx.has(f)) d.push(`${t} AHORA: ${f.slice(0, 300)}`);
  }
  return d;
}

const nav = await chromium.launch({
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'],
});
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
let n = 0;
let antes = null;
// Solo si las precondiciones pasaron el día de hoy es de la sonda y se borra.
let esMio = false;
const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Montevideo' });
let idsDeAntes = new Set();
let fallas = 0;


// QUIÉN SE PASA DE LA VENTANA (copiado de supabase/medir-scroll.mjs).
const CULPABLES = () => {
  const alto = window.innerHeight;
  const doc = document.documentElement;
  const sobra = doc.scrollHeight - alto;
  const malos = [];
  for (const el of document.querySelectorAll('body *')) {
    const est = getComputedStyle(el);
    if (est.position === 'fixed' || est.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0) continue;
    // El borde de abajo en coordenadas del DOCUMENTO.
    const abajo = r.bottom + window.scrollY;
    if (abajo > alto + 1) {
      malos.push({
        etiqueta: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
        abajo: Math.round(abajo),
        alto: Math.round(r.height),
        margenAbajo: est.marginBottom,
        padAbajo: est.paddingBottom,
        minAlto: est.minHeight,
      });
    }
  }
  // El que más abajo llega y que no tiene ningún hijo tan abajo: ese es el que
  // de verdad empuja; los de arriba solo lo contienen.
  malos.sort((a, b) => b.abajo - a.abajo);
  // LO QUE ESTÁ ANCLADO ABAJO. El hueco que `.pantalla` reserva con su
  // `padding-bottom` existe para que el contenido no quede tapado por esto.
  // Si el hueco es MÁS grande que lo anclado, sobra pantalla y se puede
  // scrollear sin que haya nada para ver — que es justo lo que se reportó.
  const anclado = [];
  for (const el of document.querySelectorAll('body *')) {
    const est = getComputedStyle(el);
    if (est.position !== 'fixed' || est.display === 'none') continue;
    const r = el.getBoundingClientRect();
    // Lo que vive en la franja de abajo. NO alcanza con pedir que toque el
    // borde inferior: la accion anclada ("Terminar") se apoya ENCIMA de la
    // barra de navegacion, asi que su borde de abajo queda a unos 60 px del
    // fondo y con ese filtro quedaba afuera. La primera version de esta
    // medicion dijo "hace falta reservar 62 px" contando solo la barra, que es
    // justo el numero que llevaria a tapar el boton.
    //
    // Se descarta lo que ocupa media pantalla o mas: eso es el fondo o un
    // dialogo, no algo anclado.
    if (r.height === 0 || r.height > alto * 0.5 || r.bottom < alto * 0.6) continue;
    anclado.push({
      etiqueta: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
      alto: Math.round(r.height),
      arriba: Math.round(r.top),
    });
  }
  anclado.sort((a, b) => a.arriba - b.arriba);
  // Lo que de verdad hay que reservar: desde el borde de arriba del más alto
  // hasta el fondo de la ventana.
  const reservaNecesaria = anclado.length ? Math.round(alto - anclado[0].arriba) : 0;

  const pantalla = document.querySelector('.pantalla');
  const reservaActual = pantalla ? parseFloat(getComputedStyle(pantalla).paddingBottom) : 0;

  return {
    ventana: alto,
    documento: doc.scrollHeight,
    sobra,
    body: Math.round(document.body.getBoundingClientRect().height),
    primeros: malos.slice(0, 8),
    anclado,
    reservaNecesaria,
    reservaActual: Math.round(reservaActual),
  };
};


// LO QUE QUEDA TAPADO. "No sobra" no alcanza: el 19/9 daba 0 px y "Registrar
// día" tapaba el último renglón, porque lo que está detrás de algo fijo no
// empuja el scroll. Se busca todo lo que se lee o se toca en la pantalla
// (hojas del árbol con texto, botones, campos) cuyo borde de abajo cae debajo
// del borde de arriba de lo anclado abajo (la acción y la barra).
const TAPADOS = () => {
  const alto = window.innerHeight;
  let techo = alto;
  for (const sel of ['.accion-anclada', 'nav.nav']) {
    const el = document.querySelector(sel);
    if (el && getComputedStyle(el).display !== 'none') techo = Math.min(techo, el.getBoundingClientRect().top);
  }
  const tapados = [];
  const pantalla = document.querySelector('.deslizable .pantalla');
  if (!pantalla) return { techo, tapados };
  for (const el of pantalla.querySelectorAll('*')) {
    if (el.closest('.accion-anclada')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const hoja = ['BUTTON', 'INPUT', 'A'].includes(el.tagName) || (el.children.length === 0 && el.textContent.trim());
    if (!hoja) continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.top >= alto) continue;
    if (r.bottom > techo + 1) tapados.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 30)}"`);
  }
  return { techo: Math.round(techo), tapados: [...new Set(tapados)].slice(0, 4) };
};
const MINIMO_MAS = 64;

const TAMANOS = [
  ['iPhone 12-16, app instalada', 390, 844],
  ['iPhone 12-16, Safari con barras', 390, 664],
  ['iPhone SE', 375, 667],
  ['iPhone Pro Max, app instalada', 430, 932],
];

async function medirTodos(estado) {
  console.log(`\n=== ${estado} ===`);
  const peores = [];
  for (const [nombre, w, h] of TAMANOS) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    await page.evaluate(() => window.scrollTo(0, 0));
    const d = await page.evaluate(CULPABLES);
    // Tapado es lo que no se ve NI bajando hasta el final: con scroll, lo de
    // abajo está detrás de la barra hasta que se baja, y eso no es tapar.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const t = await page.evaluate(TAPADOS);
    await page.evaluate(() => window.scrollTo(0, 0));
    const mas = await page.evaluate(() => {
      const b = document.querySelector('.bloque-mas');
      return b ? Math.round(b.getBoundingClientRect().height) : null;
    });
    const enElMinimo = mas !== null && mas <= MINIMO_MAS;
    const linea =
      `  ${nombre.padEnd(34)} ${w}×${h}  sobra ${String(d.sobra).padStart(4)} px` +
      (mas !== null ? `  · + ${String(mas).padStart(3)} px${enElMinimo ? ' EN EL MÍNIMO' : ''}` : '') +
      (t.tapados.length ? `  · TAPADO: ${t.tapados.join(', ')}` : '');
    console.log(linea + (d.sobra > 0 ? `  ← empuja: ${d.primeros.slice(0, 3).map((m) => `${m.etiqueta.slice(0, 40)} (${m.abajo})`).join(', ')}` : ''));
    if (d.sobra > 0 || enElMinimo || t.tapados.length) peores.push(nombre);
    // Con ALTOS=1, cuánto ocupa cada pieza (con sus márgenes): para decidir
    // qué sacar con números y no a ojo.
    if (process.env.ALTOS) {
      const altos = await page.evaluate(() => {
        const piezas = {
          cabecera: '.cabecera', racha: '.racha-bloque', globo: '.globo', ejercicio: '.bloque-fila', peso: '.bloque-peso',
          puntos: '.bloque-puntos', cuenta: '.bloque-cuenta', mas: '.bloque-mas', pregunta: '.marcas-sugeridas.en-el-momento',
          pie: '.bloque-pie', tira: '.tira-semanal', gimnasio: '.globo-quieto', marcas: '.linea-marcas', cita: '.cita', social: '.linea-social', accion: '.accion-anclada',
        };
        const r = {};
        for (const [k, sel] of Object.entries(piezas)) {
          const el = document.querySelector(sel);
          if (!el || getComputedStyle(el).display === 'none') continue;
          const cs = getComputedStyle(el);
          r[k] = Math.round(el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom));
        }
        return r;
      });
      console.log('      altos: ' + Object.entries(altos).map(([k, v]) => `${k} ${v}`).join(' · '));
    }
    // Foto SIEMPRE: que no sobre no prueba que no quede nada tapado detrás de
    // "Terminar" y la barra, que están fijos encima.
    await page.screenshot({ path: `capturas/inicio-sesion-${estado.replace(/[^a-z]+/gi, '-')}-${w}x${h}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  return peores;
}

let sobraAlguno = false;
try {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pasarLaEntrada(page);
  await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
  await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  await page.waitForTimeout(4000);
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.count()) await entendido.last().click();

  antes = await fotoDeLaCuenta();
  if (antes.logs.some((f) => JSON.parse(f).fecha === hoy)) {
    console.log('la cuenta YA tiene el día de hoy: al borrarlo al final se perdería uno real. No sigo.');
    throw new Error('precondición');
  }
  if (antes.sesiones.some((f) => JSON.parse(f).estado === 'corriendo')) {
    console.log('la cuenta tiene una sesión corriendo: no es mía. No sigo.');
    throw new Error('precondición');
  }
  esMio = true;

  // Sin sesión, de referencia.
  await medirTodos('sin entrenamiento');

  // El globo de la primera vez se muestra hasta que se cierra: se mide con él.
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.includes('globo')) localStorage.removeItem(k);
  });
  await page.getByRole('button', { name: 'Iniciar entrenamiento', exact: true }).first().click({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const empezar = page.getByText('Empezar', { exact: true });
  if (await empezar.count()) await empezar.last().click();
  await page.getByRole('button', { name: 'Sumar una serie', exact: true }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  if ((await medirTodos('recién empezado')).length) sobraAlguno = true;

  await page.getByRole('button', { name: 'Sumar una serie', exact: true }).first().click();
  await page.waitForTimeout(2000);
  if ((await medirTodos('una serie, descanso andando, con la pregunta de marca si sale')).length) sobraAlguno = true;

  const no = page.locator('.en-el-momento').getByText('No', { exact: true });
  if (await no.count()) await no.click();
  const cerrarGlobo = page.getByRole('button', { name: /cerrar/i }).first();
  await page.waitForTimeout(800);
  if ((await medirTodos('después de contestar la pregunta')).length) sobraAlguno = true;
  // DÍA REGISTRADO, SIN ENTRENAMIENTO: después de terminar. Abajo ya no está
  // "Registrar día" sino la foto y el peso, en el flujo. Solo se mide; no
  // cuenta para la falla (la de sin entrenamiento tampoco, todavía).
  try {
    await page.locator('.accion-anclada').getByRole('button', { name: 'Terminar', exact: true }).first().click({ timeout: 10000 });
    await page.waitForTimeout(600);
    await page.locator('.accion-anclada').getByRole('button', { name: 'Terminar', exact: true }).last().click({ timeout: 10000 });
    await page.waitForTimeout(2500);
    const resumen = page.locator('.resumen-sesion');
    if (await resumen.count()) await resumen.click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(1500);
    await medirTodos('día registrado, sin entrenamiento');
  } catch (e) {
    console.log(`\n(no pude terminar la sesión para medir el día registrado: ${e.message.split('\n')[0]})`);
  }
  if (await cerrarGlobo.count()) {
    await cerrarGlobo.click().catch(() => {});
    await page.waitForTimeout(800);
    if ((await medirTodos('sin el globo')).length) sobraAlguno = true;
  }
} catch (e) {
  fallas++;
  const donde = (e.stack ?? '').split('\n').find((l) => l.includes('medir-inicio')) ?? '';
  console.log(`\nFALLA ${e.message.split('\n')[0]}\n   en ${donde.trim()}`);
} finally {
  // ---- LA CUENTA COMO ESTABA ----
  await nav.close();
  if (!esMio) process.exit(1);
  await supabase.from('sesiones').delete().eq('user_id', uid).eq('estado', 'corriendo');
  const { error: eBorrar } = await supabase.from('logs').delete().eq('user_id', uid).eq('fecha', hoy);
  if (eBorrar) console.log('no pude borrar el día de hoy:', eBorrar.message);
  const despues = await fotoDeLaCuenta();
  const d = diferencias(antes, despues);
  if (d.length === 0) console.log('\ncuenta como estaba: todas las tablas, fila por fila, iguales a la foto del principio');
  else {
    fallas++;
    console.log(`\nLA CUENTA NO QUEDÓ IGUAL (${d.length} diferencias):`);
    for (const x of d.slice(0, 20)) console.log('  ' + x);
  }
}
process.exit(fallas || sobraAlguno ? 1 : 0);
