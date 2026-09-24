// CÓMO SE VE EL FONDO A CADA RESOLUCIÓN, una captura por tope.
//
// POR QUÉ. Medir dijo que el motor es puro relleno de píxeles: el costo es,
// casi exactamente, cuántos hay (1,32 M → 3,4 fps; 0,74 M → 6,4; 0,33 M →
// 19,6). O sea que la palanca más grande que existe es bajarle la resolución
// al lienzo, y la única pregunta que queda no es de rendimiento, es "¿se
// nota?". Esa no la contesta un número.
//
// LO QUE HAY QUE MIRAR, que es donde se va a notar primero:
//   - EL CANTO DEL CUERPO. Es lo único con un borde duro; el resto son
//     degradados, que aguantan cualquier resolución.
//   - LAS ESTRELLAS. Son puntos de uno o dos píxeles: a media resolución
//     pierden la mitad del tamaño y pueden titilar por aliasing en vez de por
//     el shader.
//
// El degradado, el velo y la nebulosa no son el riesgo: no tienen detalle fino
// que perder.
//
//   node --env-file=.env.local supabase/comparar-densidad.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { limiteDeSonda } from './utiles.mjs';

limiteDeSonda(10);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'densidad');
const FONDO_RAIZ = join(RAIZ, 'movil', 'src', 'FondoRaiz.tsx');
const BASE = 'http://localhost:8090';
// La cuenta demo sale de .env.local, no del repo (ver cuenta-de-revision).
const CORREO = process.env.DEMO_EMAIL;
const CLAVE = process.env.DEMO_PASSWORD;

// Los tres a comparar. 2 es lo de hoy.
const TOPES = [2, 1.5, 1];

mkdirSync(SALIDA, { recursive: true });
const original = readFileSync(FONDO_RAIZ, 'utf8');

/** Cambia la constante y espera a que Metro la sirva. */
function ponerTope(t) {
  writeFileSync(
    FONDO_RAIZ,
    original.replace(/const DENSIDAD_TOPE = [\d.]+;/, `const DENSIDAD_TOPE = ${t};`)
  );
}

try {
  for (const tope of TOPES) {
    ponerTope(tope);
    const nav = await chromium.launch();
    // DENSIDAD 3 COMO UN IPHONE: sin esto `factorDeTope()` ni se activa —con
    // densidad 1 no hay nada que topar— y las tres capturas saldrían iguales.
    const ctx = await nav.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      locale: 'es-UY',
    });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 240000 });
    for (let i = 0; i < 60; i++) {
      if (await page.locator('input[type=password]').first().isVisible().catch(() => false)) break;
      await page.waitForTimeout(1000);
    }
    await page
      .locator('input[type=email], input[inputmode=email], input[autocomplete=email]')
      .first()
      .fill(CORREO);
    await page.locator('input[type=password]').first().fill(CLAVE);
    await page.getByText('Entrar', { exact: true }).last().click();
    await page
      .locator('[data-testid="carril-inicio"]')
      .getByText('Iniciar entrenamiento', { exact: true })
      .last()
      .waitFor({ timeout: 120000 });
    // El motor tarda en montarse y el fundido de entrada dura medio segundo.
    await page.waitForTimeout(12000);

    const c = await page.evaluate(() => {
      const el = document.querySelector('canvas');
      return el ? [el.width, el.height] : null;
    });
    const nombre = `tope-${String(tope).replace('.', ',')}`;
    await page.screenshot({ path: join(SALIDA, `${nombre}.png`) });
    // Y UN RECORTE DEL CUERPO, que es donde se decide: en la captura entera,
    // a esta escala, un canto blando y uno duro se ven casi iguales.
    await page.screenshot({
      path: join(SALIDA, `${nombre}-cuerpo.png`),
      clip: { x: 130, y: 430, width: 260, height: 300 },
    });
    console.log(`  tope ${tope}: lienzo ${c ? c.join('x') : 'no hay'} → ${nombre}.png`);
    await nav.close();
  }
} finally {
  writeFileSync(FONDO_RAIZ, original);
  console.log('\n  FondoRaiz.tsx restaurado a como estaba.');
}
console.log(`  Capturas en ${SALIDA}\n`);
