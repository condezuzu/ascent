// ¿SE PUEDE CORREGIR Y BORRAR UN PESO? (migración 45, 22/9)
//
// Contra la base DE VERDAD y por la interfaz de las DOS apps, porque lo que
// hay que comprobar no es el SQL —eso ya lo cubre `test:db` contra PGlite—
// sino que la migración esté corrida en producción y que los dos botones
// hagan lo que dicen desde cada pantalla.
//
// EL CASO ES LITERALMENTE EL BUG QUE ORIGINÓ LA MIGRACIÓN: una sonda de
// capturas fabricó un peso en la cuenta de prueba y no pudo sacarlo, porque
// `weights` solo tenía lectura. Esta sonda usa ese mismo camino al revés: crea
// un peso, lo corrige, lo borra, y comprueba en la base después de cada paso.
//
//   node --env-file=.env.local herramientas/probar-pesos.mjs
//
// Necesita la web en :3020 y la nativa en :8090.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { limiteDeSonda, pasarLaEntrada } from '../supabase/utiles.mjs';

limiteDeSonda(12);

const WEB = 'http://localhost:3020';
const NATIVA = 'http://localhost:8090';

for (const [nombre, url] of [['la web', WEB], ['la nativa', NATIVA]]) {
  if (!(await fetch(url).then(() => true).catch(() => false))) {
    console.log(`${nombre} no esta prendida en ${url}`);
    process.exit(1);
  }
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

// `anotar_peso` escribe SIEMPRE el día de la cuenta: comparar contra otro
// sería mirar una fila que no existe.
const hoy = await diaDeLaCuenta();

let fallas = 0;
const esperar = (que, cumple) => {
  console.log(`  ${cumple ? 'ok   ' : 'FALLA'} ${que}`);
  if (!cumple) fallas++;
};

/** El peso de hoy en la base, o `null`. En kilos, que es como se guarda. */
async function enLaBase() {
  const { data } = await supabase.from('weights').select('valor').eq('user_id', uid).eq('fecha', hoy).maybeSingle();
  return data ? Number(data.valor) : null;
}

// LA VERSIÓN PRIMERO: sin la 45 corrida, la lista ni siquiera se dibuja, y
// buscar botones que la app esconde a propósito daría un error que parece otra
// cosa.
const { data: version } = await supabase.rpc('version_del_esquema');
console.log(`\nversion del esquema en produccion: ${version}`);
esperar('la migracion 45 esta corrida', Number(version) >= 45);
if (Number(version) < 45) process.exit(1);

const antes = await enLaBase();

/**
 * Corrige y borra el peso de hoy desde una de las dos apps.
 *
 * Las dos pantallas son la misma lista con distinto dibujo, así que el guion
 * es uno solo: se busca la fila por el número que muestra, se toca "Corregir",
 * se escribe, se guarda, y después "Borrar" → "Borrarlo".
 */
async function probarEn(app, { url, entrar, irAPesos }) {
  console.log(`\n--- ${app}`);
  // Siempre se arranca con un peso puesto: la lista no existe sin datos.
  await supabase.rpc('anotar_peso', { p_valor: 80 });

  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await entrar(page);
    await irAPesos(page);

    esperar('la lista de pesos esta a la vista', await page.getByText('Lo que anotaste').first().isVisible());

    // CORREGIR
    await page.getByText('Corregir', { exact: true }).first().click({ timeout: 30000 });
    await page.waitForTimeout(600);
    const campo = page.locator('input').last();
    await campo.fill('');
    await campo.type('84,2');
    await page.getByText('Guardar', { exact: true }).first().click();
    await page.waitForTimeout(2500);
    esperar('corregir escribio 84,2 en la base', (await enLaBase()) === 84.2);

    // BORRAR, que pregunta antes
    await page.getByText('Borrar', { exact: true }).first().click({ timeout: 30000 });
    await page.waitForTimeout(600);
    esperar('borrar avisa que ese dia no se puede volver a anotar',
      await page.getByText(/no se puede volver a anotar/i).first().isVisible());
    await page.getByText('Borrarlo', { exact: true }).first().click();
    await page.waitForTimeout(2500);
    esperar('y el peso se fue de la base', (await enLaBase()) === null);
  } catch (e) {
    esperar(`${app}: se rompio (${e.message.split('\n')[0]})`, false);
    await page.screenshot({ path: `capturas/pesos-${app.replace(/\W/g, '')}-roto.png` }).catch(() => {});
  } finally {
    const otros = errores.filter((e) => !/Failed to load resource/i.test(e));
    if (otros.length) console.log('  errores de consola:', otros.slice(0, 3).join(' | '));
    await nav.close();
  }
}

await probarEn('la web', {
  url: `${WEB}/login`,
  entrar: async (page) => {
    await pasarLaEntrada(page);
    await page.locator('input[type=email]').first().fill(process.env.CONEXION_EMAIL);
    await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
    await page.getByRole('button', { name: /Entrar/i }).first().click();
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 90000 });
  },
  irAPesos: async (page) => {
    await page.goto(`${WEB}/stats`, { waitUntil: 'networkidle' });
    await page.getByText('Lo que anotaste').first().waitFor({ timeout: 30000 });
  },
});

await probarEn('la nativa', {
  url: NATIVA,
  entrar: async (page) => {
    await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
    await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
    await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
    await page.waitForTimeout(8000);
    const entendido = page.getByText('Entendido', { exact: true });
    if (await entendido.isVisible().catch(() => false)) await entendido.click();
  },
  irAPesos: async (page) => {
    await page.getByText('Stats', { exact: true }).last().click();
    await page.waitForTimeout(3000);
    // La lista vive abajo, en la pestaña General: hay que bajar hasta ella.
    for (let i = 0; i < 6; i++) {
      if (await page.getByText('Lo que anotaste').first().isVisible().catch(() => false)) break;
      await page.evaluate(() => {
        const sc = [...document.querySelectorAll('div')].find((e) => e.scrollHeight > e.clientHeight + 100);
        if (sc) sc.scrollTop += 600;
      });
      await page.waitForTimeout(600);
    }
    await page.getByText('Lo que anotaste').first().waitFor({ timeout: 30000 });
  },
});

// ---- LA CUENTA ----
// Las dos pasadas terminan borrando el peso de hoy, así que no hay nada que
// devolver salvo que la cuenta lo tuviera antes de empezar.
const despues = await enLaBase();
console.log('\n================');
if (antes !== null && despues === null) {
  console.log(`la cuenta tenia un peso de hoy (${antes} kg) y las pruebas lo borraron: se avisa, no se repone en silencio.`);
} else if (despues !== null) {
  console.log(`quedo un peso de hoy en la base (${despues} kg) y no tendria que haber quedado.`);
  fallas++;
}
console.log(fallas === 0 ? 'OK: corregir y borrar andan en las dos apps, contra la base de verdad.' : `${fallas} fallas`);
process.exit(fallas === 0 ? 0 : 1);
