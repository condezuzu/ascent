// LAS VIDAS TITILAN (28/10, a pedido): en Inicio y en Stats, la que queda titila como la del
// aviso; la que falta ganar se queda quieta.
//
// En la vista web de la nativa (:8090), sin el fondo 3D (con él, el navegador sin pantalla va a
// cinco cuadros por segundo), con una cuenta descartable: se mira durante tres segundos la
// opacidad de cada estrella de la línea de vidas, en Inicio y en Stats.
//
//   node --env-file=.env.local supabase/probar-titilan.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-ti-${sello}@gmail.com`;
const clave = `Ti-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `ti_${sello.slice(-6)}` }).eq('id', uid);

// Cuántas opacidades distintas tuvo cada estrella de la línea, cada 50 ms durante tres segundos.
const mirar = (page, testid) =>
  page.evaluate(
    (id) =>
      new Promise((listo) => {
        const vistas = [];
        const fin = performance.now() + 3000;
        const reloj = setInterval(() => {
          const linea = [...document.querySelectorAll(`[data-testid="${id}"]`)].find((e) => e.offsetParent !== null);
          const estrellas = linea ? [...linea.querySelectorAll('svg')] : [];
          estrellas.forEach((e, i) => {
            let o = 1;
            for (let n = e; n && n !== linea; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
            (vistas[i] ??= new Set()).add(o.toFixed(2));
          });
          if (performance.now() >= fin) {
            clearInterval(reloj);
            listo(vistas.map((v) => v.size));
          }
        }, 50);
      }),
    testid,
  );

console.log('Las vidas titilan');
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
await ctx.addInitScript(() => localStorage.setItem('ascent:fondo', 'nunca'));
const page = await ctx.newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await page.getByTestId('vidas-inicio').first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  const inicio = await mirar(page, 'vidas-inicio');
  await page.getByRole('tab', { name: /^Stats/ }).first().click({ timeout: 30000 });
  await page.getByTestId('vidas-stats').filter({ visible: true }).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  const stats = await mirar(page, 'vidas-stats');
  console.log(`  --   opacidades distintas por estrella: Inicio ${inicio.join(' ')} · Stats ${stats.join(' ')}`);
  // Cuenta nueva: dos vidas y la tercera por ganar.
  chequear('en Inicio y en Stats, las dos vidas titilan y la tercera (por ganar) queda quieta', [
    inicio.length, inicio[0] >= 4 && inicio[1] >= 4, inicio[2], stats.length, stats[0] >= 4 && stats[1] >= 4, stats[2],
  ], [3, true, 1, 3, true, 1]);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
}
await nav.close();

const { error: eBorrar } = await borrarCuentaDePrueba(s);
console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
if (eBorrar) fallos++;
process.exit(fallos ? 1 : 0);
