// EL AVISO DE «NOVEDAD», COMO GLOBO (21/10, a pedido: "tapa botones y empuja el contenido").
// Era una tarjeta en el medio de la columna: les sacaba lugar a las pantallas y, entrenando,
// tapaba «Terminar». Ahora cuelga sobre la barra sin ocupar lugar, chico y apuntando a Ajustes,
// y mientras se entrena no sale.
//
// En la vista web de la nativa (:8090), con una cuenta descartable (a una nueva le toca el aviso
// de la rutina): con el globo a la vista, Inicio llega hasta la barra (la tarjeta le sacaba ese
// lugar); el globo es angosto, está arriba de la barra y no tapa el botón principal; entrenando
// no está y «Terminar» se puede tocar; al terminar vuelve, y «De acuerdo» lo saca.
//
//   node --env-file=.env.local supabase/probar-aviso-globo.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'aviso-globo');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-ag-${sello}@gmail.com`;
const clave = `Ag-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `ag_${sello.slice(-6)}` }).eq('id', uid);

console.log('El aviso de «Novedad», como globo');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
const caja = async (loc) => loc.boundingBox();
const globo = () => page.getByTestId('aviso-rutina');
// Lo que hay en el centro del botón, ¿es el botón (o algo adentro)?
const libre = (loc) => loc.evaluate((el) => {
  const b = el.getBoundingClientRect();
  const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return !!t && (el.contains(t) || t.contains(el));
});

try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await globo().first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SALIDA, 'inicio.png') });
  const boton = texto(TX.inicio.registrarPrimerDia);
  const g = await caja(globo().first());
  const barra = await caja(page.getByRole('tablist').first());
  const inicio = await caja(page.getByTestId('pantalla-inicio').first());
  chequear('con el globo a la vista, Inicio llega hasta la barra: no le saca lugar', Math.abs(inicio.y + inicio.height - barra.y) <= 2, true);
  chequear('el globo es angosto, está arriba de la barra y a la derecha, y no tapa el botón principal', [
    g.width <= 260, g.y + g.height <= barra.y, g.x + g.width > 300, await libre(boton),
  ], [true, true, true, true]);

  await texto(TX.inicio.iniciarEntrenamiento).click({ timeout: 30000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SALIDA, 'entrenando.png') });
  chequear('entrenando no sale, y «Terminar» se puede tocar', [await globo().count(), await libre(texto(TX.sesion.terminar))], [0, true]);

  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  chequear('al terminar vuelve, porque todavía no se vio', await globo().count(), 1);
  await page.getByTestId('aviso-rutina-entendido').first().click({ timeout: 30000 });
  await page.waitForTimeout(1200);
  chequear('«De acuerdo» lo saca', await globo().count(), 0);
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
