// LA INVITACIÓN QUE LLEGA (29/10, la fusión de B y C de la galería). Cae como las burbujas de
// Inicio y se abre en píldora; la cuenta de 10 segundos es una mecha que se quema; al terminar se
// va volando y la invitación se cancela sola. Flota: no mueve nada de lo que hay en pantalla.
//
// Contra la base real, con dos cuentas descartables: B entrena y mira en la vista web de la nativa
// (:8090), a 390×844; A la invita por la API. Primera vez: se deja quemar la mecha. Segunda: B
// toca «Aceptar» y entra al grupo de A.
//
//   node --env-file=.env.local supabase/probar-invitacion-llega.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, '..', 'capturas', 'invitacion-llega');
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

const { data: version } = await createClient(url, anon, { auth: { persistSession: false } }).rpc('version_del_esquema');
if (!(version >= 98)) {
  console.log(`  --   la base está en ${version}: sin la migración 98 no hay invitaciones`);
  process.exit(0);
}

async function cuenta(letra) {
  const s = createClient(url, anon, { auth: { persistSession: false } });
  const correo = `agusconde20+ascent-il-${letra}-${sello}@gmail.com`;
  const clave = `Il-${sello}-${letra}9`;
  const { error } = await s.auth.signUp({ email: correo, password: clave });
  if (error) throw new Error(`alta ${letra}: ${error.message}`);
  const id = (await s.auth.getUser()).data.user.id;
  const nombre = `il_${letra}${sello.slice(-5)}`;
  await s.from('profiles').update({ username: nombre }).eq('id', id);
  return { s, id, correo, clave, nombre };
}
const uniones = async (x) => (await x.s.rpc('mis_uniones')).data ?? [];

// Lo alto de cada cosa de Inicio que se ve: si el aviso empujara algo, cambia.
const alturas = (page) =>
  page.evaluate(() => {
    const cartel = document.querySelector('[data-testid="cartel-de-arriba"]');
    const inicio = document.querySelector('[data-testid="pantalla-inicio"]');
    return [...inicio.querySelectorAll('[data-testid], [role="button"], [tabindex="0"]')]
      .filter((e) => !cartel?.contains(e) && e.getBoundingClientRect().height > 0)
      .map((e) => `${e.getAttribute('data-testid') ?? e.textContent.slice(0, 16)}@${Math.round(e.getBoundingClientRect().top)}`);
  });
const ancho = async (page, id) => (await page.getByTestId(id).first().boundingBox())?.width ?? null;

const A = await cuenta('a');
const B = await cuenta('b');
const nav = await chromium.launch();
try {
  const { data: am } = await A.s.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id').single();
  await B.s.from('friendships').update({ estado: 'aceptada' }).eq('id', am.id);
  await A.s.rpc('iniciar_sesion');
  await B.s.rpc('iniciar_sesion');

  const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(B.correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(B.clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.getByTestId('pantalla-inicio').first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(4000);
  const antes = await alturas(page);
  const cartel = page.getByTestId('cartel-de-arriba');

  console.log('A invita a B, y B la deja pasar');
  chequear('A invita por la API', (await A.s.rpc('invitar_al_grupo', { p_a: B.id })).data, 'ok');
  await cartel.first().waitFor({ timeout: 45000 });
  // Muestras del primer segundo y medio: de burbuja a píldora.
  const anchos = [];
  for (let i = 0; i < 30; i++) {
    anchos.push(await ancho(page, 'invitacion-pildora'));
    await page.waitForTimeout(50);
  }
  await page.getByTestId('cartel-aceptar').first().waitFor({ state: 'visible', timeout: 5000 });
  const abierta = Date.now();
  chequear('cae como burbuja (56 de ancho) y se abre en píldora (390 − 24)', [Math.round(Math.min(...anchos.filter(Boolean))), Math.round(Math.max(...anchos.filter(Boolean)))], [56, 366]);
  await page.waitForTimeout(1500);
  const mecha1 = await ancho(page, 'invitacion-mecha');
  await page.screenshot({ path: join(SALIDA, 'mecha.png') });
  await page.waitForTimeout(4000);
  const mecha2 = await ancho(page, 'invitacion-mecha');
  chequear('la mecha se va quemando', [mecha1 > mecha2 + 100, mecha2 > 0], [true, true]);
  chequear('no movió nada de Inicio, ni puso la tarjeta de pedido', [await alturas(page), await page.getByTestId('pedido-de-union').count()], [antes, 0]);
  await cartel.first().waitFor({ state: 'detached', timeout: 15000 });
  const duro = (Date.now() - abierta) / 1000;
  chequear('a los 10 segundos se va', duro > 9 && duro < 12.5, true);
  await page.waitForTimeout(1500);
  chequear('y la invitación se canceló sola: no le queda a ninguno de los dos', [
    (await uniones(B)).filter((u) => u.estado === 'pendiente').length,
    (await uniones(A)).filter((u) => u.estado === 'pendiente').length,
  ], [0, 0]);

  console.log('A invita otra vez, y B acepta');
  chequear('A invita de nuevo', (await A.s.rpc('invitar_al_grupo', { p_a: B.id })).data, 'ok');
  await cartel.first().waitFor({ timeout: 45000 });
  await page.getByTestId('cartel-aceptar').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);
  await page.getByTestId('cartel-aceptar').first().click();
  await cartel.first().waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(1500);
  chequear('B entra al grupo de A', (await uniones(B)).map((u) => [u.estado, u.otro.id]), [['aceptada', A.id]]);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
}
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
process.exit(fallos ? 1 : 0);
