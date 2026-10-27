// LO QUE ENTRA NO EMPUJA DE UN SALTO, Y LOS BOTONES SE HUNDEN (26/10, a pedido: microanimaciones).
//
// En la vista web de la nativa (:8090), con una cuenta descartable: se empieza a entrenar y se
// abre el campo de las series a mano («+»). Cuadro a cuadro se mira dónde está la fila de los
// círculos, que queda debajo: tiene que bajar pasando por varios lugares intermedios, no saltar
// de un lugar al otro. Y una píldora de series, apretada, tiene que estar más chica.
//
//   node --env-file=.env.local supabase/probar-sin-saltos.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'sin-saltos');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-ss-${sello}@gmail.com`;
const clave = `Ss-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `ss_${sello.slice(-6)}` }).eq('id', uid);

console.log('Lo que entra no empuja de un salto');
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
// Sin el fondo 3D (la preferencia «nunca» de Ajustes): con él, el navegador sin pantalla dibuja
// a cinco cuadros por segundo y ninguna animación de 280 ms deja ver un cuadro intermedio.
await ctx.addInitScript(() => localStorage.setItem('ascent:fondo', 'nunca'));
const page = await ctx.newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto(TX.inicio.iniciarEntrenamiento).click({ timeout: 120000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);

  // Dónde está la fila de los círculos cada 15 ms, durante dos segundos y medio.
  const etiqueta = TX.sesion.deMeta(0, 3);
  const muestras = page.evaluate(
    (et) =>
      new Promise((listo) => {
        const ys = [];
        const fin = performance.now() + 2500;
        const reloj = setInterval(() => {
          const el = document.querySelector(`[aria-label="${et}"]`);
          if (el) ys.push(Math.round(el.getBoundingClientRect().top * 2) / 2);
          if (performance.now() >= fin) {
            clearInterval(reloj);
            listo(ys);
          }
        }, 15);
      }),
    etiqueta,
  );
  await page.getByTestId('meta-a-mano').first().click({ timeout: 15000 });
  const ys = await muestras;
  const distintas = [...new Set(ys)];
  console.log(`  --   ${ys.length} cuadros, ${distintas.length} lugares: ${distintas.slice(0, 12).join(' ')}`);
  chequear('al abrirse el campo, la fila de abajo baja pasando por lugares intermedios (no salta)', [distintas.length >= 5, ys[ys.length - 1] > ys[0]], [true, true]);
  await page.screenshot({ path: join(SALIDA, 'abierto.png') });

  // La píldora ×4, apretada, se hunde.
  const pildora = page.getByText('×4', { exact: true }).last();
  const caja = await pildora.boundingBox();
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const ancho = await pildora.evaluate((el) => {
    let p = el;
    while (p && !(p.getAttribute('role') === 'button' || p.tabIndex === 0)) p = p.parentElement;
    return (p ?? el).getBoundingClientRect().width;
  });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const anchoSuelto = await pildora.evaluate((el) => {
    let p = el;
    while (p && !(p.getAttribute('role') === 'button' || p.tabIndex === 0)) p = p.parentElement;
    return (p ?? el).getBoundingClientRect().width;
  });
  console.log(`  --   la píldora: ${ancho.toFixed(1)} apretada, ${anchoSuelto.toFixed(1)} suelta`);
  chequear('una píldora de series, apretada, está más chica, y vuelve al soltarla', ancho < anchoSuelto * 0.98, true);
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
