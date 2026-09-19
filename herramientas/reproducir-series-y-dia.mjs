// REPRODUCIR "EL TOTAL DICE UNA COSA Y LOS CIRCULITOS OTRA" (19/9).
//
// Lo que se vio en el gimnasio: había una serie registrada, se corrigió algo
// del día, y al volver el total de la sesión seguía contando pero los
// circulitos del bloque estaban en cero. Son dos lecturas: el total es
// `series` (la base lo tiene en `sesiones.series`) y los circulitos son
// `bloques.hechas`, que la pantalla lee de la caché del teléfono.
//
// Esto no adivina cuál de los caminos fue: los recorre en la web, como una
// persona, y en cada parada imprime LAS TRES FUENTES —la pantalla, la caché
// del teléfono (`ascent:sesion`) y la base—, para ver dónde se separan.
//
// Deja la cuenta como estaba, igual que `ver-bloques.mjs`: foto de todas las
// tablas al principio, y al final se borra el día de hoy y se compara.
//
//   node --env-file=.env.local herramientas/reproducir-series-y-dia.mjs
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

/** Lo que TIENE que dar. Si no, la sonda sale con error: sirve de prueba. */
function esperar(que, cumple) {
  if (cumple) return;
  fallas++;
  console.log(`   FALLA: ${que}`);
}

/** Las tres fuentes, una al lado de la otra. */
async function leer(nombre, pg = page) {
  n++;
  await pg.waitForTimeout(1500);
  const ui = await pg.evaluate(() => {
    const puntos = document.querySelector('.bloque-puntos');
    let cache = null;
    try {
      const c = JSON.parse(localStorage.getItem('ascent:sesion') ?? 'null');
      cache = c && {
        id: c.id ? c.id.slice(0, 8) : c.id,
        series: c.series,
        hechas: c.bloques ? c.bloques.hechas : 'SIN BLOQUES',
        cerrados: c.bloques ? c.bloques.cerrados.length : '-',
      };
    } catch {}
    return {
      llenos: puntos ? puntos.querySelectorAll('.punto.lleno').length : null,
      numero: document.querySelector('.bloque-cuenta .numero')?.textContent ?? null,
      total: document.querySelector('.bloque-cuenta .palabra')?.textContent ?? null,
      cache,
    };
  });
  const { data } = await supabase.from('sesiones').select('id, estado, series, bloques').eq('user_id', uid);
  const nuevas = (data ?? []).filter((s) => !idsDeAntes.has(s.id));
  const base = nuevas.map((s) => ({
    id: s.id.slice(0, 8),
    estado: s.estado,
    series: s.series,
    bloquesGuardados: Array.isArray(s.bloques) ? s.bloques.map((b) => b.series).join('+') || '[]' : JSON.stringify(s.bloques),
  }));
  await pg.screenshot({ path: `capturas/series-dia-${String(n).padStart(2, '0')}.png` });
  console.log(`\n${String(n).padStart(2)} ${nombre}`);
  console.log(`   pantalla: circulitos llenos ${ui.llenos ?? '—'} · "${ui.numero ?? '—'}" · "${ui.total ?? '—'}"`);
  console.log(`   caché:    ${JSON.stringify(ui.cache)}`);
  console.log(`   base:     ${JSON.stringify(base)}`);
  return { ui, base };
}

async function aStats() {
  await page.getByRole('link', { name: 'Stats', exact: true }).first().click();
  await page.waitForURL((u) => u.pathname === '/stats', { timeout: 30000 });
  await page.getByRole('tab', { name: 'Entrenamiento', exact: true }).click({ timeout: 30000 });
}
async function aInicio() {
  // El chip de la sesión (la N) está encima del botón de Inicio.
  await page.locator('nav.nav a[href="/"]').evaluate((a) => a.click());
  await page.waitForURL((u) => u.pathname === '/', { timeout: 30000 });
}
async function abrirHoy() {
  const dia = Number(hoy.slice(8));
  const celda = page.getByRole('button', { name: `Ver el día ${dia}`, exact: true });
  await celda.waitFor({ timeout: 30000 });
  // Con `evaluate` y no con `click`: la barra de abajo tapa la última fila del
  // calendario y Playwright espera a que se destape. Lo que se mira acá no es
  // el toque sino lo que pasa después.
  await celda.evaluate((b) => b.click());
  await page.locator('.hoja-dia .dia-estado').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
}
async function cerrarHoja() {
  await page.locator('.hoja-dia').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.waitForTimeout(600);
}

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

  // LA FOTO VA DESPUÉS DE ENTRAR, no antes. Al abrir, la app aplica sola lo
  // que le toque al día —la pérdida de racha de ayer, las vidas—: eso le iba a
  // pasar a la cuenta igual la próxima vez que alguien la abriera, y no es algo
  // que la sonda pueda deshacer (esas columnas no se escriben desde afuera).
  // Sacada antes, la sonda se lo achacaba a sí misma (19/9).
  antes = await fotoDeLaCuenta();
  if (antes.logs.some((f) => JSON.parse(f).fecha === hoy)) {
    console.log('la cuenta YA tiene el día de hoy: al borrarlo al final se perdería uno real. No sigo.');
    throw new Error('precondición');
  }
  if (antes.sesiones.some((f) => JSON.parse(f).estado === 'corriendo')) {
    console.log('la cuenta tiene una sesión corriendo: no es mía. No sigo.');
    throw new Error('precondición');
  }
  idsDeAntes = new Set(antes.sesiones.map((f) => JSON.parse(f).id));
  esMio = true;

  await page.getByRole('button', { name: 'Iniciar entrenamiento', exact: true }).first().click({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const empezar = page.getByText('Empezar', { exact: true });
  if (await empezar.count()) await empezar.last().click();
  await page.getByRole('button', { name: 'Sumar una serie', exact: true }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Sumar una serie', exact: true }).first().click();
  // La pregunta de marca, si sale, se contesta que no: no es lo que se mira.
  const no = page.locator('.en-el-momento').getByText('No', { exact: true });
  await no.waitFor({ timeout: 6000 }).then(() => no.click(), () => {});
  await leer('una serie registrada');

  // ---- LA MISMA SESIÓN, DESDE OTRO LADO SIN LA CACHÉ ----
  // Otra pestaña en limpio: es lo que ve el teléfono si la caché no está
  // —Safari en vez de la app instalada (en iPhone no comparten nada), la caché
  // borrada, otro teléfono—. La base tiene la serie y sus bloques.
  const otra = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await otra.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pasarLaEntrada(otra);
  await otra.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
  await otra.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
  await otra.getByRole('button', { name: 'Entrar', exact: true }).click();
  await otra.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  await otra.getByRole('button', { name: 'Sumar una serie', exact: true }).first().waitFor({ timeout: 60000 }).catch(() => {});
  const o1 = await leer('OTRA PESTAÑA, sin caché: abrir Inicio con la sesión corriendo', otra);
  esperar('los circulitos muestran la serie que está en la base', o1.ui.llenos === 1);
  await otra.getByRole('button', { name: 'Sumar una serie', exact: true }).first().click();
  const noOtra = otra.locator('.en-el-momento').getByText('No', { exact: true });
  await noOtra.waitFor({ timeout: 6000 }).then(() => noOtra.click(), () => {});
  await otra.waitForTimeout(2500);
  const o2 = await leer('OTRA PESTAÑA: sumar una serie ahí', otra);
  esperar('la base conserva el bloque de antes más la serie nueva', o2.base[0]?.bloquesGuardados === '2');
  await otra.context().close();
  await aStats();
  await aInicio();
  const o3 = await leer('la primera pestaña, después (ir a Stats y volver)');
  esperar('la primera pestaña ve la serie que se sumó en la otra', o3.ui.llenos === 2);

  await aStats();
  await abrirHoy();
  await cerrarHoja();
  await aInicio();
  await leer('abrir el día en el calendario, cerrar sin tocar, volver a Inicio');

  await aStats();
  await abrirHoy();
  await page.locator('.hoja-dia').getByRole('button', { name: 'Fui', exact: true }).click();
  await page.waitForTimeout(1500);
  await cerrarHoja();
  await aInicio();
  await leer('tocar "Fui" (lo que ya era) y volver');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sumar una serie', exact: true }).first().waitFor({ timeout: 60000 }).catch(() => {});
  await leer('recargar la página');

  // ---- LAS CORRECCIONES DE LA LISTA, en la sesión ----
  const lista = async (fn) => {
    await page.getByRole('button', { name: 'Ver lista', exact: true }).first().click({ timeout: 15000 });
    await page.waitForTimeout(800);
    await fn();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Listo', exact: true }).last().click();
    await page.waitForTimeout(800);
  };
  const irYVolver = async (nombre) => {
    await aStats();
    await aInicio();
    await leer(`${nombre} → ir a Stats y volver`);
  };

  await lista(async () => {
    const campo = page.getByLabel('Peso de la serie 1', { exact: true }).last();
    await campo.fill('71');
    await campo.press('Tab');
  });
  const o4 = await leer('lista: corregir el peso de la serie 1 del bloque en curso');
  esperar('corregir un peso no se lleva series de la base', o4.base[0]?.bloquesGuardados === '2');
  await irYVolver('corregir el peso');

  await page.locator('.bloque-ejercicio').first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Sentadilla', exact: true }).first().click({ timeout: 15000 });
  await page.getByRole('button', { name: /^Eran de Press de banca/ }).first().click({ timeout: 15000 });
  await leer('cambiar a sentadilla, "eran de press de banca" (cierra el bloque)');

  await lista(async () => {
    await page.getByRole('button', { name: 'Sumar una serie', exact: true }).last().click();
  });
  await leer('lista: +1 al bloque cerrado de press de banca');
  await irYVolver('+1 al bloque cerrado');

  await lista(async () => {
    await page.getByRole('button', { name: 'Press de banca: cambiar el ejercicio', exact: true }).click();
    await page.waitForTimeout(1200);
    if (!(await page.getByRole('button', { name: 'Press inclinado', exact: true }).count())) {
      if (!(await page.getByRole('button', { name: /pecho/i }).count()))
        await page.getByRole('button', { name: /superior/i }).first().click();
      await page.getByRole('button', { name: /pecho/i }).first().click();
    }
    await page.getByRole('button', { name: 'Press inclinado', exact: true }).first().click({ timeout: 15000 });
  });
  await leer('lista: el bloque cerrado era press inclinado');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sumar una serie', exact: true }).first().waitFor({ timeout: 60000 }).catch(() => {});
  await leer('recargar la página');

  await aStats();
  await abrirHoy();
  await page.locator('.hoja-dia').getByRole('button', { name: 'Descansé', exact: true }).click();
  await page.locator('.hoja-dia').getByRole('button', { name: 'Cambiarlo igual', exact: true }).click({ timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.locator('.hoja-dia').getByRole('button', { name: 'Fui', exact: true }).click();
  await page.waitForTimeout(2500);
  await cerrarHoja();
  await aInicio();
  await leer('pasar hoy a "Descansé" (borra la sesión) y de vuelta a "Fui", volver a Inicio');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await leer('recargar la página');
} catch (e) {
  fallas++;
  await page.screenshot({ path: 'capturas/series-dia-falla.png' }).catch(() => {});
  const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)).catch(() => '');
  const donde = (e.stack ?? '').split('\n').find((l) => l.includes('reproducir-series')) ?? '';
  console.log(`\nFALLA ${e.message.split('\n')[0]}\n   en ${donde.trim()}\n   se ve: ${texto}`);
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
process.exit(fallas ? 1 : 0);
