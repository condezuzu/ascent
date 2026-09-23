// CUÁNTO CUESTA CADA TRANSICIÓN DE LA APP NATIVA, cuadro por cuadro.
//
// QUÉ CONTESTA. *"Optimización y pulido: que todas las transiciones se vean
// suaves y limpias. Deslizar entre pestañas, abrir y cerrar el perfil, entrar a
// una foto, la subida de rango, el globo de la medalla. Cualquier salto,
// parpadeo o tirón, arreglalo. Medí los fps donde puedas y decime dónde cae."*
//
// ────────────────────────────────────────────────────────────────────────
// LO QUE ESTOS NÚMEROS SON Y LO QUE NO SON. Hay que decirlo antes que nada
// porque decidir con ellos creyendo otra cosa es peor que no medir:
//
//   - NO SALEN DE UN IPHONE. Salen de Chromium corriendo la app nativa por su
//     vista web (:8090), con la CPU frenada por el protocolo de DevTools. Un
//     teléfono tiene otra GPU, otra memoria y térmica.
//   - Y NO ES EL MISMO MOTOR DE DIBUJO: en el teléfono `useNativeDriver` mueve
//     las animaciones del lado nativo, fuera del hilo de JavaScript. Acá eso no
//     existe: `react-native-web` las corre todas en JS. O sea que esta medición
//     es MÁS PESIMISTA que el teléfono en las animaciones y más optimista en
//     todo lo demás.
//
// PARA QUÉ SIRVE IGUAL, que es lo que la hace valer la pena: para COMPARAR una
// transición contra otra y una versión contra la siguiente, en las mismas
// condiciones. "Deslizar entre pestañas cuesta el triple que abrir una foto" es
// verdad acá y es verdad en el teléfono. El número absoluto no.
//
// PARA EL NÚMERO DE VERDAD está `Ajustes → Diagnóstico → Medir los cuadros`,
// que corre en el aparato y deja el resultado en la bitácora.
// ────────────────────────────────────────────────────────────────────────
//
// SE MIDE EL HUECO ENTRE CUADROS y no un promedio, porque lo que se siente es
// el peor: un segundo trabado repartido entre veinte buenos da un promedio
// lindo y se ve horrible.
//
// NECESITA LA NATIVA PRENDIDA en :8090 y la cuenta de revisión cargada
// (`cuenta-de-revision.mjs`): una cuenta vacía no tiene fotos que abrir ni
// medallas que tocar, que es justo lo que hay que medir.
//
//   node --env-file=.env.local supabase/medir-cuadros-nativa.mjs
import { chromium } from 'playwright';
import { limiteDeSonda } from './utiles.mjs';

limiteDeSonda(10);

const BASE = 'http://localhost:8090';
const CORREO = 'agusconde20+ascent-review@gmail.com';
const CLAVE = 'AscentReview-2026';
// 4x es, más o menos, un teléfono bueno contra esta máquina. El barrido y los
// medidores de la web usan 6 para simular un Android de gama media; acá se
// apunta a un iPhone, que es lo que se va a publicar.
const FRENO = Number(process.env.CUADROS_FRENO ?? 4);
// 60 Hz. Un hueco de más del doble es un cuadro perdido de verdad; desde 16,7
// contaría el temblor del reloj.
const LARGO_MS = (1000 / 60) * 2;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY' });
const page = await ctx.newPage();

// CONTAR LOS DIBUJOS DEL MOTOR. Se cuenta el `clear` de WebGL y no cada
// `drawArrays`: three.js hace varios dibujos por cuadro —cuerpo, estrellas,
// partículas— pero limpia el lienzo UNA vez al empezar cada uno. Se inyecta
// antes de cargar nada: después, el contexto ya está creado.
await page.addInitScript(() => {
  window.__dibujos = 0;
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    const antes = C.prototype.clear;
    C.prototype.clear = function (...a) { window.__dibujos++; return antes.apply(this, a); };
  }
});
const cdp = await ctx.newCDPSession(page);

const texto = (t, exact = true) => page.getByText(t, { exact }).last();
const enPestana = (p, t, exact = true) =>
  page.locator(`[data-testid="carril-${p}"]`).getByText(t, { exact }).last();

/**
 * Mide mientras corre `hacer`.
 *
 * EL BUCLE VIVE EN LA PÁGINA y no acá: medir desde el proceso de Playwright
 * mediría el protocolo, no el dibujado.
 */
async function medir(nombre, hacer) {
  await page.evaluate(() => {
    window.__cuadros = [];
    window.__dibujos0 = window.__dibujos ?? 0;
    let anterior = performance.now();
    window.__seguir = true;
    const paso = () => {
      const ahora = performance.now();
      window.__cuadros.push(ahora - anterior);
      anterior = ahora;
      if (window.__seguir) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
  await hacer();
  const { huecos, dibujos } = await page.evaluate(() => {
    window.__seguir = false;
    return {
      // El primero incluye todo lo que pasó antes de que arrancara el bucle.
      huecos: window.__cuadros.slice(1),
      dibujos: (window.__dibujos ?? 0) - (window.__dibujos0 ?? 0),
    };
  });
  if (huecos.length < 2) return { nombre, cuadros: huecos.length, fps: 0, peor: 0, largos: 0, gl: 0 };
  const total = huecos.reduce((a, b) => a + b, 0);
  return {
    nombre,
    cuadros: huecos.length,
    fps: Math.round((huecos.length / total) * 1000 * 10) / 10,
    peor: Math.round(Math.max(...huecos)),
    largos: huecos.filter((h) => h > LARGO_MS).length,
    // CUÁNTOS CUADROS DIBUJÓ EL MOTOR, por segundo. Es el otro número que hace
    // falta: sin él no se puede saber si el fondo respetó el escalón lento o
    // si siguió a sesenta, y las dos cosas se ven igual desde afuera.
    gl: Math.round((dibujos / total) * 1000 * 10) / 10,
  };
}

/** Un arrastre horizontal con el dedo, en varios pasos como uno de verdad. */
async function deslizar(x0, x1, y = 500, pasos = 24) {
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= pasos; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / pasos, y);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);
}

// CON EL MOTOR Y SIN EL MOTOR, y es la medición que de verdad importa.
//
// El primer intento midió solo con el fondo prendido y las cuatro filas dieron
// casi lo mismo —incluida "quieta en Inicio"—, que es la forma que tiene una
// medición de decir que no estás midiendo lo que creés: si la app QUIETA ya va
// al mismo ritmo que deslizando, el costo no es de la transición, es un piso
// que está abajo de todo. Correrlo dos veces lo separa.
//
// La preferencia es la misma llave que lee `FondoRaiz` y que se cambia en
// Ajustes → El fondo del espacio, así que esto no es un atajo de la prueba: es
// el mismo interruptor que tiene cualquiera.
const CLAVE_FONDO = 'ascent:fondo';
const SIN_MOTOR = process.argv.includes('--sin-motor');

console.log(`\nCuadros de la app nativa · CPU frenada ${FRENO}x · ${SIN_MOTOR ? 'SIN' : 'con'} el fondo\n`);

// ---- entrar ----
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 240000 });
if (SIN_MOTOR) {
  await page.evaluate((k) => localStorage.setItem(k, 'nunca'), CLAVE_FONDO);
  // El motor se monta UNA vez, al arrancar: hay que volver a cargar.
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 240000 });
}
for (let i = 0; i < 60; i++) {
  if (await page.locator('input[type=password]').first().isVisible().catch(() => false)) break;
  await page.waitForTimeout(1000);
}
await page.locator('input[type=email], input[inputmode=email], input[autocomplete=email]').first().fill(CORREO);
await page.locator('input[type=password]').first().fill(CLAVE);
await texto('Entrar').click();
await enPestana('inicio', 'Iniciar entrenamiento').waitFor({ timeout: 120000 });
// El motor tarda en montarse: medir antes mediría la carga, no la transición.
await page.waitForTimeout(6000);

// EL FRENO VA DESPUÉS DE ENTRAR: frenar la CPU durante el arranque hace que el
// login tarde minutos y no agrega nada a lo que se quiere medir.
await cdp.send('Emulation.setCPUThrottlingRate', { rate: FRENO });

const filas = [];

// ---- 1. DESLIZAR ENTRE PESTAÑAS ----
// Es la que más se usa y la que más JS mueve: un `PanResponder` que en cada
// evento corre la tira y recalcula el desenfoque del fondo.
filas.push(
  await medir('deslizar entre pestañas', async () => {
    await deslizar(340, 60);
    await deslizar(340, 60);
    await deslizar(60, 340);
    await deslizar(60, 340);
  })
);

// ---- 2. ABRIR Y CERRAR EL PERFIL ----
filas.push(
  await medir('abrir y cerrar el perfil', async () => {
    for (let i = 0; i < 2; i++) {
      await enPestana('inicio', 'demo', false).click({ timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(900);
      await page.goBack().catch(() => {});
      await page.waitForTimeout(900);
    }
  })
);

// ---- 3. ENTRAR A UNA FOTO ----
filas.push(
  await medir('entrar y salir de una foto', async () => {
    await page.getByRole('tab', { name: 'Álbum' }).click({ timeout: 20000 });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 2; i++) {
      await enPestana('album', 'de setiembre', false).click({ timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(900);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(900);
    }
  })
);

// ---- 4. QUIETA ----
// El piso: si la app quieta ya no llega a 60, el problema no es ninguna
// transición.
filas.push(
  await medir('quieta en Inicio', async () => {
    await page.getByRole('tab', { name: 'Inicio' }).click({ timeout: 20000 });
    await page.waitForTimeout(4000);
  })
);

await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await nav.close();

console.log('  transición                      fps   peor    largos    motor');
console.log('  ' + '─'.repeat(60));
for (const f of filas) {
  console.log(
    `  ${f.nombre.padEnd(30)} ${String(f.fps).padStart(5)} ${String(f.peor + ' ms').padStart(7)} ${String(f.largos).padStart(6)} ${String(f.gl).padStart(8)}`
  );
}
console.log('\n  "largos" = cuadros de más de 33 ms, que es lo que se ve como tirón.');
console.log('  Son de Chromium con la CPU frenada, no de un iPhone: sirven para');
console.log('  comparar entre sí y contra la próxima versión, no como número absoluto.\n');
