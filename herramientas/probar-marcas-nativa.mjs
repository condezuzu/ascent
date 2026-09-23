// ¿ANDA LA PANTALLA DE MARCAS EN LA APP NATIVA? (§16, 24/9)
//
// ESCRIBE EN LA CUENTA DE PRUEBA Y LO DESHACE. Anota una marca de verdad
// —es la única forma de probar que se guarda— y la borra al final, mirando
// antes cuántas había para dejar exactamente esa cantidad. La limpieza va en
// `finally`: si algo revienta a la mitad, la marca inventada se borra igual.
// Ese `finally` existe por el 22/9, cuando una sonda que tiró dejó un día de
// descanso colgado en la cuenta.
//
// LO QUE COMPRUEBA, en orden de lo que más duele si se rompe:
//  - Que la marca se GUARDE y aparezca.
//  - Que la fila se despliegue y muestre el historial, que es lo que hace que
//    una carga no pise a la anterior (§16.5).
//  - Que se pueda BORRAR, porque una marca mal cargada que no se puede sacar
//    envenena el DOTS para siempre.
//  - Que se entre desde Stats y se pueda volver.
//
//   node --env-file=.env.local herramientas/probar-marcas-nativa.mjs [--puerto=8090]
//
// Necesita la nativa prendida.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { limiteDeSonda } from '../supabase/utiles.mjs';

limiteDeSonda(10);

const PUERTO = (process.argv.find((a) => a.startsWith('--puerto=')) ?? '--puerto=8090').split('=')[1];
const BASE = `http://localhost:${PUERTO}`;

if (!(await fetch(BASE).then(() => true).catch(() => false))) {
  console.log(`la nativa no esta prendida en :${PUERTO}`);
  process.exit(1);
}

// El cliente propio es para MIRAR y LIMPIAR, nunca para probar: lo que se
// prueba es lo que hace la app.
const base = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: quien, error: eEntrar } = await base.auth.signInWithPassword({
  email: process.env.CONEXION_EMAIL,
  password: process.env.CONEXION_PASSWORD,
});
if (eEntrar) {
  console.log('no pude entrar a la base:', eEntrar.message);
  process.exit(1);
}
const UID = quien.user.id;

const antes = await base.from('prs').select('id').eq('user_id', UID);
const IDS_DE_ANTES = new Set((antes.data ?? []).map((r) => r.id));

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errores = [];
page.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => errores.push('pageerror: ' + String(e.message).slice(0, 200)));

let fallas = 0;
const esperar = (que, cumple) => {
  console.log(`  ${cumple ? 'ok   ' : 'FALLA'} ${que}`);
  if (!cumple) fallas++;
};
const texto = () => page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
const ruta = () => page.evaluate(() => location.pathname);

/** Tocar por texto, subiendo al elemento que recibe el toque de verdad. */
async function tocar(rotulo, exacto = true) {
  const boton = page
    .getByText(rotulo, { exact: exacto })
    .last()
    .locator('xpath=ancestor-or-self::*[@tabindex][1]');
  if (!(await boton.isVisible().catch(() => false))) return false;
  await boton.click({ timeout: 20000 });
  return true;
}

// UN PESO QUE VA A SER EL MEJOR, y eso importa: la fila de arriba muestra LA
// MEJOR marca de cada ejercicio (16.5), no la ultima. La primera version de
// esta sonda anotaba 137 kg en una cuenta que ya tenia 140 de sentadilla, y
// despues se quejaba de que no aparecia -- cuando la app estaba haciendo
// exactamente lo correcto. 199 gana con comodidad y no se confunde con nada.
const PESO = 199;

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(9000);
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.isVisible().catch(() => false)) await entendido.click();
  await page.waitForTimeout(2000);

  console.log('\n1. Se entra desde Stats');
  await tocar('Stats');
  await page.waitForTimeout(3500);
  // El boton dice una cosa u otra segun si ya hay marcas: las dos valen.
  const entro = (await tocar('Mis marcas')) || (await tocar('Anotar una marca'));
  esperar('hay una puerta a las marcas en Stats', entro);
  await page.waitForTimeout(3000);
  esperar('la ruta es /marcas', (await ruta()) === '/marcas');

  console.log('\n2. Anotar una marca');
  await tocar('Anotar una marca');
  await page.waitForTimeout(1800);
  const t2 = await texto();
  esperar('se abre la hoja', /Cuantas veces|Cuántas veces/i.test(t2));
  // "De una" es lo que viene elegido: un 1RM real ES una repeticion.
  esperar('viene elegido "De una"', /De una/.test(t2));

  await page.locator('input').filter({ hasNotText: '' }).first().isVisible().catch(() => {});
  // El campo de peso es el unico numerico de la hoja.
  const campo = page.locator('input[inputmode="decimal"], input[type="number"], input').last();
  await campo.fill(String(PESO));
  await page.waitForTimeout(600);
  await tocar('Anotar');
  await page.waitForTimeout(4000);

  const { data: guardadas } = await base.from('prs').select('id, peso, reps, es_real').eq('user_id', UID).eq('peso', PESO);
  esperar('la marca llego a la base', (guardadas ?? []).length === 1);
  if ((guardadas ?? []).length === 1) {
    // "De una" tiene que guardar reps 1 y es_real true: es lo que distingue un
    // PR real de un maximo calculado, y se ve en toda la app despues.
    esperar('se guardo como "de una" (1 vez, real)', guardadas[0].reps === 1 && guardadas[0].es_real === true);
  }
  esperar('y se ve en la pantalla', (await texto()).includes(String(PESO)));

  console.log('\n3. La fila se despliega y muestra el historial');
  // Sin esto no se ve que una carga NO pisa a la anterior (§16.5).
  const antesDeAbrir = await texto();
  await tocar(String(PESO), false);
  await page.waitForTimeout(1500);
  const despues = await texto();
  esperar('desplegar muestra algo mas', despues.length > antesDeAbrir.length);
  esperar('y aparece Borrar', /Borrar/.test(despues));

  console.log('\n4. Se puede borrar');
  const toque = await tocar('Borrar');
  esperar('el boton de borrar se pudo tocar', toque);
  await page.waitForTimeout(5000);
  const { data: quedan } = await base.from('prs').select('id').eq('user_id', UID).eq('peso', PESO);
  esperar('la marca se fue de la base', (quedan ?? []).length === 0);
  if ((quedan ?? []).length) console.log('     lo que se ve ahora:', (await texto()).slice(0, 220));

  console.log('\n5. Se vuelve a las pestañas');
  await tocar('← Volver', false);
  await page.waitForTimeout(3000);
  esperar('la ruta vuelve a /', (await ruta()) === '/');
  esperar('y esta la barra', /Ranking/.test(await texto()));

  console.log('\n6. Nada tiro al dibujar');
  const graves = errores.filter((e) => !/UnableToResolveError|POP_TO_TOP|401/.test(e));
  esperar(`sin errores nuevos (${graves.length})`, graves.length === 0);
  for (const e of graves.slice(0, 5)) console.log('     ' + e);
} finally {
  // LA CUENTA QUEDA COMO ESTABA. Se borra cualquier marca que no estuviera
  // antes, no solo la del peso de prueba: si la sonda tiro justo despues de
  // guardar, ese es el unico rastro que queda.
  const { data: ahora } = await base.from('prs').select('id').eq('user_id', UID);
  const sobrantes = (ahora ?? []).map((r) => r.id).filter((id) => !IDS_DE_ANTES.has(id));
  if (sobrantes.length) {
    await base.from('prs').delete().in('id', sobrantes);
    console.log(`\n(limpieza: ${sobrantes.length} marca(s) inventada(s) borrada(s))`);
  }
  await nav.close();
}

console.log(fallas === 0 ? '\ntodo bien' : `\n${fallas} fallaron`);
process.exit(fallas === 0 ? 0 : 1);
