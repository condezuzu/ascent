// UNA SOLA PALETA PARA TODA LA APP (30/10). Antes los botones, los días y las pestañas tenían el
// color de la Luna fijo en todos los rangos. Una cuenta recorre los siete rangos y se lee lo que se
// ve en la pantalla: el sólido de «Registrar día» por el píxel, y el chip y la pestaña prendida por
// el color que el navegador les calculó.
//
// Y sube de rango delante de la prueba, sin recargar: con racha 5, entrena y termina. La paleta
// cambia con la app abierta y sin remontar nada: el lienzo del motor es el mismo elemento de antes y
// el resumen de la sesión sigue ahí.
//
// Lo que no se tiñe se sigue viendo igual: la estrella de las vidas y la hoja de anotar el peso.
//
// Es la vista web de la nativa: los colores son los calculados y los del píxel de la captura, no los
// de la pantalla del iPhone.
//
//   node --env-file=.env.local supabase/probar-rango.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(12);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const { DESDE_RANGO } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'reglas.ts')).href);
const { paletaDe } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'paletas.ts')).href);
const { cuerpoDe } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'rangos.ts')).href);
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};
const hexDe = (css) => {
  const m = css?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? '#' + m.slice(1, 4).map((v) => Number(v).toString(16).padStart(2, '0')).join('') : css;
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-ra-${sello}@gmail.com`;
const clave = `Ra-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `ra_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

let hasta = 0;
async function llevarARacha(racha) {
  const filas = [];
  for (let a = hasta + 1; a <= racha; a++) filas.push({ user_id: uid, fecha: dia(a) });
  for (let i = 0; i < filas.length; i += 50) {
    const { error } = await s.from('logs').insert(filas.slice(i, i + 50));
    if (error) throw new Error(`logs: ${error.message}`);
  }
  hasta = Math.max(hasta, racha);
  const { error } = await s.rpc('recalcular_desde_cero');
  if (error) throw new Error(`recalcular: ${error.message}`);
}

console.log('Toda la app sigue al rango');
const nav = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'] });
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));

  const iniciar = () => page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first();
  const solido = () => page.getByText(TX.inicio.registrarDia, { exact: true }).first();
  const luzDeInicio = () => page.getByTestId('luz-inicio').first();
  const colorDe = async (loc) => hexDe(await loc.evaluate((n) => getComputedStyle(n).color));

  // El color del sólido, por el píxel: a la izquierda del texto, adentro del octágono.
  async function pixelDelSolido() {
    const caja = await solido().boundingBox();
    const png = await page.screenshot({ clip: { x: caja.x - 20, y: caja.y + caja.height / 2, width: 1, height: 1 } });
    const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return '#' + [...data.subarray(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  async function leerInicio() {
    await iniciar().waitFor({ timeout: 120000 });
    await solido().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1200);
    return { solido: await pixelDelSolido(), chip: await colorDe(iniciar()), pestana: await colorDe(luzDeInicio()) };
  }
  const esperada = (racha) => {
    const { rango, planeta } = cuerpoDe(racha);
    const c = paletaDe(rango, planeta).claro.toLowerCase();
    return { solido: c, chip: c, pestana: c };
  };

  await llevarARacha(5);
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas'] })), [uid]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  await iniciar().waitFor({ timeout: 120000 });
  // La primera vez, con racha, se presenta el cuerpo a pantalla completa y tapa todo: se pasa recargando.
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'domcontentloaded' });

  // ---- SUBIR CON LA APP ABIERTA ----
  const delUno = await leerInicio();
  chequear('racha 5: el rango 1', delUno, esperada(5));
  const hayLienzo = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (c) c.dataset.marcaDeLaPrueba = '1';
    return !!c;
  });
  chequear('el motor está dibujando', hayLienzo, true);
  // Empezar a entrenar crea el día: con racha 5 pasa a 6 y sube de rango en ese mismo toque.
  await iniciar().click({ timeout: 30000 });
  const claroDel2 = paletaDe(2).claro.toLowerCase();
  let colorLuz = '';
  for (let i = 0; i < 60 && colorLuz !== claroDel2; i++) {
    await page.waitForTimeout(500);
    colorLuz = await colorDe(luzDeInicio()).catch(() => '');
  }
  chequear('al subir, sin recargar, la pestaña prendida ya es del rango 2', colorLuz, claroDel2);
  chequear('el lienzo del motor es el mismo elemento: no se remontó nada', await page.evaluate(() => !!document.querySelector('canvas[data-marca-de-la-prueba="1"]')), true);
  // La ceremonia se saltea con un toque y se cierra con otro.
  const ceremonia = page.locator('[aria-modal="true"]');
  await ceremonia.first().waitFor({ timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 12 && (await ceremonia.count()) > 0; i++) {
    await page.mouse.click(195, 420);
    await page.waitForTimeout(1000);
  }
  // Y lo que había sigue ahí: la sesión corre y cuenta.
  const mas = page.getByLabel(TX.inicio.sumarSerie).first();
  await mas.waitFor({ timeout: 60000 });
  await page.getByText('×5', { exact: true }).first().click({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
  await mas.click({ timeout: 20000 });
  await page.waitForTimeout(800);
  chequear('y la sesión sigue ahí: cuenta la serie', await page.getByText(TX.sesion.totalHoy(1), { exact: true }).count() > 0, true);
  await page.waitForTimeout(1200);

  // Se termina y se saca el día: para los otros rangos hace falta ver «Registrar día».
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  await s.from('logs').delete().eq('user_id', uid).eq('fecha', HOY);

  // ---- LOS SIETE ----
  const vistos = new Set([delUno.solido]);
  for (const r of [2, 3, 4, 5, 6, 7]) {
    const racha = (DESDE_RANGO[r - 1] ?? 0) + 2;
    await llevarARacha(racha);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const leido = await leerInicio();
    chequear(`rango ${r}: el sólido, el chip y la pestaña son el claro de su paleta`, leido, esperada(racha));
    vistos.add(leido.solido);

    if (r === 2 || r === 5) {
      // Lo que no se tiñe.
      const finDeEstrella = await page.evaluate(() => [...document.querySelectorAll('#luz stop')].pop()?.getAttribute('stop-color'));
      chequear(`rango ${r}: la estrella de las vidas no se tiñe`, finDeEstrella?.toLowerCase(), '#c4c2ba');
      await page.getByText(TX.peso.anotarPeso, { exact: true }).first().click({ timeout: 20000 });
      const boton = page.getByText(TX.peso.anotar, { exact: true }).last();
      await boton.waitFor({ timeout: 20000 });
      await page.waitForTimeout(500);
      // El botón es un octágono: su color es el del dibujo, el polígono que tiene relleno.
      const fondoDelBoton = await boton.evaluate((n) => [...n.parentElement.querySelectorAll('polygon')].find((p) => p.getAttribute('fill') !== 'none')?.getAttribute('fill') ?? null);
      chequear(`rango ${r}: la hoja de anotar el peso sigue con sus colores fijos`, fondoDelBoton?.toLowerCase(), '#c4c2ba');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await iniciar().waitFor({ timeout: 120000 });
    }
  }
  chequear('los siete se ven distintos, no siete veces la Luna', vistos.size, 7);
  chequear('sin errores de la página', errores, []);
} finally {
  await nav.close();
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  const { error } = await borrarCuentaDePrueba(s);
  if (error) console.log('No se pudo borrar la cuenta:', error.message);
}
console.log(fallos ? `\n${fallos} fallas` : '\nToda la app sigue al rango: bien');
process.exit(fallos ? 1 : 0);
