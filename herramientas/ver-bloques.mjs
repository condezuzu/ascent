// VER, EN LA CUENTA DE PRUEBA, LO QUE SOLO SE VE ENTRENANDO: la pregunta de
// marca al confirmar la serie y corregir el ejercicio de un bloque cerrado
// (18/9). Y DEJAR LA CUENTA COMO ESTABA.
//
// Empezar un entrenamiento registra el día (`iniciar_sesion` → `registrar_dia`)
// y eso mueve la racha. Por eso, antes de tocar nada, se saca una FOTO de todas
// las tablas de la cuenta; al final se borra el día de hoy —la sesión se va en
// cascada y el trigger recalcula la racha desde el historial— y se compara la
// cuenta entera con la foto. Si no quedó igual, lo dice fila por fila.
//
// Los pasos, en la web y como una persona:
//   1. Iniciar entrenamiento, elegir press de banca, confirmar una serie con el
//      peso que propone la app → tiene que salir "¿lo guardo como marca?".
//   2. Pasar a otro ejercicio, abrir "Ver lista", tocar el nombre del bloque de
//      banca y cambiarlo → las series y el peso se quedan.
// Cada paso deja su foto en `capturas/bloques-*.png`.
//
//   node --env-file=.env.local herramientas/ver-bloques.mjs [--nativa]
//
// Necesita la web prendida en :3020, o con `--nativa` la nativa en :8090.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { limiteDeSonda, pasarLaEntrada } from '../supabase/utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(12);

const NATIVA = process.argv.includes('--nativa');
const BASE = NATIVA ? 'http://localhost:8090' : 'http://localhost:3020';
const PREFIJO = NATIVA ? 'bloques-nativa' : 'bloques';
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

const antes = await fotoDeLaCuenta();
const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Montevideo' });
if (antes.logs.some((f) => JSON.parse(f).fecha === hoy)) {
  console.log('la cuenta YA tiene el día de hoy: al borrarlo al final se perdería uno real. No sigo.');
  process.exit(1);
}
if (antes.sesiones.some((f) => JSON.parse(f).estado === 'corriendo')) {
  console.log('la cuenta tiene una sesión corriendo: no es mía. No sigo.');
  process.exit(1);
}
console.log(`foto de la cuenta: ${TABLAS.map(([t]) => `${t} ${antes[t].length}`).join(', ')}`);

const nav = await chromium.launch({
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'],
});
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
let n = 0;
let fallas = 0;
async function paso(nombre, fn) {
  n++;
  try {
    await fn();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `capturas/${PREFIJO}-${String(n).padStart(2, '0')}.png` });
    console.log(`  ${String(n).padStart(2)} ok     ${nombre}`);
    return true;
  } catch (e) {
    fallas++;
    await page.screenshot({ path: `capturas/${PREFIJO}-${String(n).padStart(2, '0')}-falla.png` }).catch(() => {});
    const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)).catch(() => '');
    console.log(`  ${String(n).padStart(2)} FALLA  ${nombre}: ${e.message.split('\n')[0]}\n           se ve: ${texto}`);
    return false;
  }
}

try {
  // Lo que cambia entre las dos apps es CÓMO se encuentra cada cosa: la web
  // tiene roles y clases; la nativa, textos y etiquetas de accesibilidad.
  const boton = (nombre) => (NATIVA ? page.getByText(nombre, { exact: true }).last() : page.getByRole('button', { name: nombre, exact: true }).first());
  const etiqueta = (nombre) => (NATIVA ? page.getByLabel(nombre, { exact: true }).last() : page.getByRole('button', { name: nombre, exact: true }).first());
  const nombreDelBloque = () => (NATIVA ? page.getByText(/^Press de banca|^Sentadilla/).first() : page.locator('.bloque-ejercicio').first());

  if (NATIVA) {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 240000 });
    await page.locator('input[type=email], input[inputmode=email], input[autocomplete=email]').first().fill(process.env.CONEXION_EMAIL);
    await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
    await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  } else {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pasarLaEntrada(page);
    await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
    await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  }
  await page.waitForTimeout(4000);
  // "La racha sigue" (las vidas usadas) tapa Inicio en esta cuenta. "Entendido"
  // solo la cierra; "Guardarlas" escribe, y no se toca.
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.count()) await entendido.last().click();

  let ok = await paso('iniciar el entrenamiento', async () => {
    await boton('Iniciar entrenamiento').click({ timeout: 30000 });
    await page.waitForTimeout(1500);
    const empezar = page.getByText('Empezar', { exact: true });
    if (await empezar.count()) await empezar.last().click();
    await etiqueta('Sumar una serie').waitFor({ timeout: 30000 });
  });
  // El bloque arranca con el último ejercicio que se usó (press de banca en
  // esta cuenta) y el peso que propone la base.
  if (ok)
    ok = await paso('el bloque arranca en press de banca, con el último peso', async () => {
      await page.getByText(/Press de banca/).first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(2500);
    });
  if (ok) {
    const campos = await page.locator('input').evaluateAll((l) => l.map((i) => i.value).filter(Boolean));
    console.log(`           peso propuesto: ${JSON.stringify(campos)}`);
  }
  if (ok)
    ok = await paso('confirmar una serie → "¿lo guardo como marca?" en el momento', async () => {
      await etiqueta('Sumar una serie').click();
      await page.getByText(/Puede ser marca nueva|¿La guardo como marca?/).first().waitFor({ timeout: 20000 });
      await page.waitForTimeout(1200);
    });
  if (ok)
    await paso('contestar "No" (no se guarda ninguna marca)', async () => {
      await page.getByText('No', { exact: true }).last().click();
    });
  if (ok)
    ok = await paso('pasar a otro ejercicio: "eran de press de banca" cierra el bloque', async () => {
      await nombreDelBloque().click();
      await page.waitForTimeout(1200);
      await boton('Sentadilla').click({ timeout: 15000 });
      await boton('Eran de Press de banca').click({ timeout: 15000 });
    });
  if (ok)
    ok = await paso('abrir la lista: el nombre del bloque cerrado se toca', async () => {
      await boton('Ver lista').click({ timeout: 15000 });
      await etiqueta('Press de banca: cambiar el ejercicio').waitFor({ timeout: 15000 });
    });
  if (ok)
    ok = await paso('tocarlo abre el selector', async () => {
      await etiqueta('Press de banca: cambiar el ejercicio').click();
      await page.waitForTimeout(1500);
    });
  if (ok)
    ok = await paso('elegir press inclinado', async () => {
      // Zona y músculo, como una persona.
      // En la web cada fila es un botón con el nombre y la cuenta ("Pecho 12"):
      // se busca por rol. En la nativa, por texto.
      if (NATIVA) {
        if (!(await page.getByText('Press inclinado', { exact: true }).count())) {
          if (!(await page.getByText(/^Pecho/).count())) await page.getByText(/Superior/i).last().click();
          await page.waitForTimeout(800);
          await page.getByText(/^Pecho/).last().click();
          await page.waitForTimeout(800);
        }
        await page.getByText('Press inclinado', { exact: true }).last().click({ timeout: 15000 });
      } else {
        if (!(await page.getByRole('button', { name: 'Press inclinado', exact: true }).count())) {
          if (!(await page.getByRole('button', { name: /pecho/i }).count()))
            await page.getByRole('button', { name: /superior/i }).first().click();
          await page.getByRole('button', { name: /pecho/i }).first().click();
        }
        await page.getByRole('button', { name: 'Press inclinado', exact: true }).first().click({ timeout: 15000 });
      }
    });
  if (ok)
    await paso('la lista dice press inclinado, con su serie y su peso', async () => {
      await etiqueta('Press inclinado: cambiar el ejercicio').waitFor({ timeout: 15000 });
    });
  // Lo que quedó guardado en la sesión, que es lo que importa.
  const { data: corriendo } = await supabase.from('sesiones').select('bloques').eq('user_id', uid).eq('estado', 'corriendo');
  console.log(`           bloques guardados en la sesión: ${JSON.stringify(corriendo?.[0]?.bloques ?? null)}`);
} finally {
  // ---- LA CUENTA COMO ESTABA ----
  await nav.close();
  const { error: eBorrar } = await supabase.from('logs').delete().eq('user_id', uid).eq('fecha', hoy);
  if (eBorrar) console.log('no pude borrar el día de hoy:', eBorrar.message);
  // Por si la sesión no colgaba del día (no debería).
  await supabase.from('sesiones').delete().eq('user_id', uid).eq('estado', 'corriendo');
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
