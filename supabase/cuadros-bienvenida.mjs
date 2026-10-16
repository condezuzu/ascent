// Fotos de la entrada (15/10): las cuatro pantallas y la del ranking en sus momentos
// —la lista, sofi que pasa a mateo, la luz que baja y el botón—. Usa el banco de
// /galeria/bienvenida (`?pantalla=`), que monta la pantalla de verdad.
//
//   npm run capturas:bienvenida     (con el dev server en :3020)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { limiteDeSonda } from './utiles.mjs';

// Ninguna sonda corre sin limite (ver utiles.mjs).
limiteDeSonda(10);
const SALIDA = 'capturas/bienvenida';
mkdirSync(SALIDA, { recursive: true });
const BASE = process.env.BASE ?? 'http://localhost:3020';

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-UY' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
page.on('console', (m) => {
  if (m.type() === 'error') errores.push(m.text().slice(0, 200));
});

for (const pantalla of ['pesos', 'llegar', 'amigo']) {
  await page.goto(`${BASE}/galeria/bienvenida?pantalla=${pantalla}`, { waitUntil: 'load', timeout: 180000 });
  // El circulito cargado (1,5 s) y el motor ya dibujando.
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SALIDA}/${pantalla}.png` });
  console.log(`  ${SALIDA}/${pantalla}.png`);
}
await page.goto(`${BASE}/galeria/bienvenida?pantalla=ranking`, { waitUntil: 'load', timeout: 180000 });
const t0 = Date.now();
for (const [nombre, s] of [['lista', 1.6], ['sofi-pasa', 3.8], ['luz', 5.0], ['boton', 7.2]]) {
  const falta = s * 1000 - (Date.now() - t0);
  if (falta > 0) await page.waitForTimeout(falta);
  await page.screenshot({ path: `${SALIDA}/ranking-${nombre}.png` });
  console.log(`  ${SALIDA}/ranking-${nombre}.png (${s} s)`);
}
await nav.close();
console.log(errores.length ? `\nERRORES:\n  ${[...new Set(errores)].join('\n  ')}` : '\nsin errores en la consola');
process.exit(errores.length ? 1 : 0);
