// Fotos de la animación de entrada en segundos fijos. Sirve porque la pantalla
// se puede congelar: un navegador sin cabeza corre rAF a un cuadro por segundo
// y sin eso las capturas salen donde caiga.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const SALIDA = 'capturas/bienvenida';
mkdirSync(SALIDA, { recursive: true });
// Los segundos en que cada objeto está formado: el final de cada tramo.
const SEGUNDOS = [];
{
  const B = await import('../src/lib/bienvenida.ts');
  let t = B.ANTES_S;
  SEGUNDOS.push(0.5);
  for (const d of B.duracionesDeTramos()) {
    t += d;
    SEGUNDOS.push(Math.round(t * 100) / 100);
  }
  const h = B.hitos();
  // El final, en sus tres tiempos: quieto, tragando la racha, tragando la cámara.
  SEGUNDOS.push(
    h.quieto,
    Math.round((h.quieto + B.TRAGO_RACHA_S * 0.6) * 100) / 100,
    Math.round((h.racha + B.TRAGO_CAMARA_S * 0.45) * 100) / 100,
    Math.round((B.DURACION_S - 0.05) * 100) / 100
  );
}

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
  // Un segundo por objeto: el final de cada tramo, que es donde la forma está
  // hecha. Salen del módulo puro para no quedar desfasados si cambian.
  for (const s of SEGUNDOS) {
    // La barra va de a 5 centésimas: un valor que no sea múltiplo lo rechaza.
    await pico.fill(String(Math.round((s * 100) / 5) * 5));
    await pico.dispatchEvent('change');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SALIDA}/${modo}-${String(s).replace('.', '_')}s.png` });
  }
}
// EL FINAL DE VERDAD: se deja correr sin congelar, hasta que aparecen los
// botones. Es lo que no se puede ver con la barra.
await page.getByRole('button', { name: 'Correr' }).click();
await page.getByRole('button', { name: 'Solo la animación' }).click();
for (const s of [11.6, 12.4]) {
  await page.waitForTimeout(s === 11.6 ? 11600 : 800);
  await page.screenshot({ path: `${SALIDA}/final-${String(s).replace('.', '_')}s.png` });
}

// Las tres primeras pantallas, con sus fondos, y las variantes del título 3.
await page.getByRole('button', { name: 'Correr' }).click();
await page.getByRole('button', { name: 'Sin motor' }).click(); // volver al motor
for (const n of ['1', '2', '3']) {
  await page.getByRole('button', { name: n, exact: true }).click();
  // La segunda tiene la lista que viaja: se la mira a mitad de camino y al final.
  for (const espera of n === '2' ? [900, 1800, 3600] : [1200]) {
    await page.waitForTimeout(espera === 900 ? 900 : espera - 900);
    await page.screenshot({ path: `${SALIDA}/pantalla-${n}${espera === 1200 ? '' : '-' + espera}.png` });
  }
}
const titulos = await page.getByRole('button', { name: /^Título 3/ }).all();
for (let i = 0; i < titulos.length; i++) {
  await titulos[i].click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SALIDA}/titulo3-${i + 1}.png` });
}
console.log('errores:', errores.slice(0, 5));
await nav.close();
