// ¿SE DESLIZA ENTRE PESTAÑAS EN LA APP NATIVA? (22/9)
//
// La hermana de `probar-deslizar.mjs`, que hace lo mismo en la web. Acá el
// gesto lo atiende `PanResponder` y la de al lado que asoma no es una copia
// congelada del DOM sino la pantalla real montada, así que hay que mirarlo por
// separado aunque las reglas —cuánto arrastrar, qué velocidad— sean las mismas
// (`nucleo/deslizar.ts`).
//
// Hace el gesto con el dedo de verdad (eventos táctiles por CDP, no clics) y
// mira cuatro cosas:
//   1. A mitad del arrastre: ¿asoma la pestaña de al lado, y es la que toca?
//   2. Al soltar lejos: queda la nueva.
//   3. Arrastrar poco y soltar: vuelve a la de antes.
//   4. En el borde (Inicio hacia la derecha) no pasa nada: no da la vuelta.
//
// No escribe nada en la cuenta: solo entra y mira.
//
//   node --env-file=.env.local herramientas/probar-deslizar-nativa.mjs
//
// Necesita la nativa prendida en :8090 (movil/dev-web.cmd) o en :8092
// (movil/con-diagnostico-web.cmd) con --puerto=8092.
import { chromium } from 'playwright';
import { limiteDeSonda } from '../supabase/utiles.mjs';

limiteDeSonda(10);

const PUERTO = (process.argv.find((a) => a.startsWith('--puerto=')) ?? '--puerto=8090').split('=')[1];
const BASE = `http://localhost:${PUERTO}`;

const vivo = await fetch(BASE).then(() => true).catch(() => false);
if (!vivo) {
  console.log(`la nativa no esta prendida en :${PUERTO}`);
  process.exit(1);
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
let fallas = 0;
const esperar = (que, cumple) => {
  console.log(`  ${cumple ? 'ok   ' : 'FALLA'} ${que}`);
  if (!cumple) fallas++;
};

const toque = (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });

/** Arrastra de x0 a x1 en `pasos`, a ~60 cuadros por segundo. No suelta. */
async function arrastrar(x0, x1, y = 420, pasos = 12) {
  await toque('touchStart', x0, y);
  for (let i = 1; i <= pasos; i++) {
    await toque('touchMove', x0 + ((x1 - x0) * i) / pasos, y);
    await page.waitForTimeout(16);
  }
}

/**
 * Cuál pestaña está marcada en la barra de abajo. SE MIRA EL COLOR y no
 * `aria-selected`: React Native Web no traduce `accessibilityState.selected` a
 * ese atributo, así que el único rastro en el DOM de cuál está activa es que
 * su texto está claro y el de las otras apagado. En el teléfono el atributo
 * sí existe y lo usa VoiceOver; esto es una limitación de mirarlo acá.
 */
const activa = () =>
  page.evaluate(() => {
    const claro = (e) => {
      const c = getComputedStyle(e).color.match(/\d+/g) ?? [];
      return Number(c[0]) > 150;
    };
    const t = [...document.querySelectorAll('[role="tab"]')].find((e) => [...e.querySelectorAll('*')].some(claro));
    return t?.innerText?.trim() ?? null;
  });

/** Los títulos de pantalla puestos, SIN la barra de abajo: con dos, una asoma. */
const pantallas = () =>
  page.evaluate(() => {
    const barra = document.querySelector('[role="tablist"]');
    return [...document.querySelectorAll('div')]
      .filter((e) => e.children.length === 0 && e.innerText && !barra?.contains(e))
      .map((e) => e.innerText.trim())
      .filter((t) => ['Ranking', 'Álbum', 'Stats', 'Ajustes'].includes(t));
  });

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email], input[inputmode=email]').first().fill(process.env.CONEXION_EMAIL, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(6000);
  // La ventana de las vidas, si aparece, tapa la pantalla.
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.isVisible().catch(() => false)) await entendido.click();
  await page.waitForTimeout(1500);

  console.log('\n1. A mitad del arrastre asoma la de al lado');
  esperar('se arranca en Inicio', (await activa()) === 'Inicio');
  await arrastrar(340, 150);
  const aMitad = await pantallas();
  esperar(`asoma Ranking mientras se arrastra (se ve: ${JSON.stringify(aMitad)})`, aMitad.includes('Ranking'));
  await page.screenshot({ path: 'capturas/nativa-deslizando.png' });

  console.log('\n2. Al soltar lejos queda la nueva');
  await toque('touchEnd', 150, 420);
  await page.waitForTimeout(900);
  esperar('quedo Ranking', (await activa()) === 'Ranking');

  console.log('\n3. Arrastrar poco y soltar vuelve');
  await arrastrar(340, 300);
  await toque('touchEnd', 300, 420);
  await page.waitForTimeout(900);
  esperar('sigue en Ranking', (await activa()) === 'Ranking');

  console.log('\n4. En el borde no da la vuelta');
  // Volver a Inicio y tirar hacia la derecha, que no tiene nada.
  await page.getByText('Inicio', { exact: true }).last().click();
  await page.waitForTimeout(1500);
  await arrastrar(60, 330);
  await toque('touchEnd', 330, 420);
  await page.waitForTimeout(900);
  esperar('sigue en Inicio', (await activa()) === 'Inicio');
} catch (e) {
  console.log('SE ROMPIO:', e.message.split('\n').slice(0, 3).join(' | '));
  await page.screenshot({ path: 'capturas/nativa-deslizando-roto.png' }).catch(() => {});
  fallas++;
} finally {
  await nav.close();
  console.log(fallas === 0 ? '\nOK: el gesto anda.' : `\n${fallas} fallas`);
  process.exit(fallas === 0 ? 0 : 1);
}
