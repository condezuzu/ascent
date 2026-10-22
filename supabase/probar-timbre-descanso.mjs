// LA PÍLDORA DEL DESCANSO EN 0:00 (20/10): arriba a la derecha, al llegar a cero dice «Listo» y
// se sacude como un despertador, una vez por tanda de golpes (la vibración no se ve en la web:
// la prueba la sección de test:db).
//
// En la vista web de la nativa (:8090), con una cuenta descartable y el reloj de Playwright:
// se empieza a entrenar, se toca «Descansar» y «Empezar descanso» (desde el 21/10 el botón abre
// la pantalla quieta), se cierra la pantalla grande (queda la píldora) y
// se adelanta el reloj hasta el fin del descanso. La píldora tiene que girar a los dos lados
// en los segundos siguientes, y antes del cero no.
//
//   node --env-file=.env.local supabase/probar-timbre-descanso.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';
import { T } from '../nucleo/textos.ts';

limiteDeSonda(7);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'timbre-descanso');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-tim-${sello}@gmail.com`;
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
await s.from('profiles').update({ username: `tim_${sello.slice(-6)}` }).eq('id', uid);

console.log('La píldora del descanso se sacude en 0:00');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
// Los giros de la píldora, cuadro por cuadro, desde que se pide.
const mirarGiros = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((listo) => {
        const giros = [];
        const t0 = performance.now();
        const paso = () => {
          const el = document.querySelector('[data-testid="pildora-timbre"]');
          const m = el ? getComputedStyle(el).transform : 'none';
          const g = m && m !== 'none' ? Math.round((Math.atan2(Number(m.split(',')[1]), Number(m.split('(')[1].split(',')[0])) * 180) / Math.PI) : 0;
          giros.push(g);
          if (performance.now() - t0 < ms) requestAnimationFrame(paso);
          else listo(giros);
        };
        requestAnimationFrame(paso);
      }),
    ms
  );
try {
  await page.clock.install();
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await texto('Iniciar entrenamiento').click({ timeout: 120000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  await texto('Descansar').click({ timeout: 30000 });
  await page.getByTestId('descanso-empezar').first().click({ timeout: 30000 });
  await page.getByTestId('descanso-reloj').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.getByLabel('Cerrar').first().click();
  await page.getByTestId('pildora-descanso').first().waitFor({ timeout: 30000 });
  const antes = await mirarGiros(1500);
  chequear('antes del cero, la píldora quieta', Math.max(...antes.map(Math.abs)), 0);
  // Hasta un segundo antes del fin, y de ahí se mira mientras pasa el cero.
  const quedan = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="pildora-descanso"]')?.textContent ?? '';
    const [m, sg] = t.split(':').map(Number);
    return (m * 60 + sg) * 1000;
  });
  await page.clock.fastForward(Math.max(0, quedan - 1000));
  const giros = await mirarGiros(5000);
  await page.screenshot({ path: join(SALIDA, 'listo.png') });
  chequear('en el cero dice «Listo»', (await page.getByTestId('pildora-descanso').first().innerText()).trim(), T.sesion.listo);
  chequear('y se sacude a los dos lados', [Math.max(...giros) >= 3, Math.min(...giros) <= -3], [true, true]);
  // Tres tandas: cada vez que arranca a moverse después de estar quieta un rato (~⅓ s).
  let tandas = 0;
  let quieta = Infinity;
  for (const g of giros) {
    if (Math.abs(g) >= 3) {
      if (quieta > 20) tandas++;
      quieta = 0;
    } else quieta++;
  }
  chequear('tres tandas, como los golpes del despertador', tandas, 3);
  // CUÁNTO SE PASÓ (20/10, pedido 1): después del despertador, «+0:07» y sigue contando.
  await page.waitForTimeout(2500);
  const pildora = async () => (await page.getByTestId('pildora-descanso').first().innerText()).trim();
  const primero = await pildora();
  await page.waitForTimeout(2200);
  const segundo = await pildora();
  await page.screenshot({ path: join(SALIDA, 'pasado.png') });
  const seg = (t) => (/^\+(\d+):(\d\d)$/.test(t) ? Number(t.slice(1).split(':')[0]) * 60 + Number(t.split(':')[1]) : null);
  chequear('después del despertador dice cuánto se pasó del cero, y sigue contando', [seg(primero) !== null && seg(primero) >= 5, seg(segundo) !== null && seg(segundo) > seg(primero)], [true, true]);
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
