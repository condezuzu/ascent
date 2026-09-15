// Fotos de la animación de entrada en segundos fijos. Sirve porque la pantalla
// se puede congelar: un navegador sin cabeza corre rAF a un cuadro por segundo
// y sin eso las capturas salen donde caiga.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const SALIDA = 'capturas/bienvenida';
mkdirSync(SALIDA, { recursive: true });
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-UY' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 200)); });
await page.goto('http://localhost:3020/galeria/bienvenida', { waitUntil: 'networkidle', timeout: 180000 });
await page.getByRole('button', { name: 'Solo la animación' }).click();
await page.waitForTimeout(3000);
const pico = page.getByLabel('Segundo de la animación');
for (const modo of ['motor', 'sin-motor']) {
  if (modo === 'sin-motor') {
    await page.getByRole('button', { name: 'Sin motor' }).click();
    await page.waitForTimeout(1500);
  }
  for (const s of [0.6, 1.4, 3.0, 4.6, 6.0, 7.2, 8.4, 9.4, 10.0]) {
    await pico.fill(String(Math.round(s * 100)));
    await pico.dispatchEvent('change');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SALIDA}/${modo}-${String(s).replace('.', '_')}s.png` });
  }
}
// Las tres primeras pantallas, con los tres juegos de texto.
await page.getByRole('button', { name: 'Correr' }).click();
for (const juego of ['A · Lo que hace', 'B · Aparecer', 'C · El objeto']) {
  await page.getByRole('button', { name: juego }).click();
  for (const n of ['1', '2', '3']) {
    await page.getByRole('button', { name: n, exact: true }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SALIDA}/texto-${juego[0]}-${n}.png` });
  }
}
console.log('errores:', errores.slice(0, 5));
await nav.close();
