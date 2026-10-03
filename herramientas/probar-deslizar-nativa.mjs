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
import { limiteDeSonda, pasarLaEntradaNativa } from '../supabase/utiles.mjs';

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
    // SOLO LA BARRA DE ABAJO, que es la ultima lista de pestañas del documento:
    // Stats trae las suyas adentro ("General"...), y con Stats montada esto
    // devolvia la de Stats en vez de la de la barra.
    const barras = document.querySelectorAll('[role="tablist"]');
    const barra = barras[barras.length - 1];
    const t = [...(barra?.querySelectorAll('[role="tab"]') ?? [])].find((e) => [...e.querySelectorAll('*')].some(claro));
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
  // La bienvenida va antes del login desde el 29/9; sin cruzarla, esta sonda se
  // quedaba esperando un correo que no aparecia.
  await pasarLaEntradaNativa(page);
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
  await page.waitForTimeout(1500);
  esperar('quedo Ranking', (await activa()) === 'Ranking');

  console.log('\n3. Arrastrar poco y soltar vuelve');
  await arrastrar(340, 300);
  await toque('touchEnd', 300, 420);
  await page.waitForTimeout(1500);
  esperar('sigue en Ranking', (await activa()) === 'Ranking');

  console.log('\n4. En el borde no da la vuelta');
  // Volver a Inicio y tirar hacia la derecha, que no tiene nada.
  await page.getByText('Inicio', { exact: true }).last().click();
  await page.waitForTimeout(1500);
  await arrastrar(60, 330);
  await toque('touchEnd', 330, 420);
  await page.waitForTimeout(1500);
  esperar('sigue en Inicio', (await activa()) === 'Inicio');

  // EL TITILEO AL DESLIZAR RAPIDO (3/10). El gesto leia la pestaña activa del
  // estado de React, que cambia recien cuando el viaje TERMINA y la pantalla se
  // vuelve a dibujar. Un segundo gesto en ese rato colocaba la tira en la
  // pestaña de antes: se veia la anterior un cuadro o dos, y despues la nueva.
  console.log('\n5. Dos gestos pegados no devuelven la tira a la pestaña de antes');
  // Las tres montadas de antemano, para que montar no entre en la cuenta.
  for (const p of ['Álbum', 'Inicio']) {
    await page.getByText(p, { exact: true }).last().click();
    await page.waitForTimeout(1500);
  }
  // CON EL PROCESADOR FRENADO. El salto dura lo que tarda la app en volver a
  // dibujarse despues del primer gesto: en una computadora eso es menos de un
  // cuadro y no se llega a ver; en el telefono son varios. Sin frenar, esta
  // comprobacion pasaba en verde con el codigo roto.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
  // La tira, cuadro por cuadro. Inicio vive en left 0: su borde ES el corrimiento.
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="carril-inicio"]');
    window.__tira = [];
    const medir = () => {
      window.__tira.push(Math.round(el.getBoundingClientRect().left));
      requestAnimationFrame(medir);
    };
    medir();
  });
  await arrastrar(340, 150);
  await toque('touchEnd', 150, 420);
  // El segundo entra PEGADO: el toque y el primer movimiento juntos, antes del
  // cuadro siguiente, para que el gesto se decida con el viaje todavia en curso.
  await Promise.all([toque('touchStart', 340, 420), toque('touchMove', 310, 420)]);
  for (let i = 2; i <= 8; i++) {
    await toque('touchMove', 340 - (190 * i) / 8, 420);
    await page.waitForTimeout(16);
  }
  await toque('touchEnd', 150, 420);
  await page.waitForTimeout(4000);
  // Los dos gestos van hacia la izquierda: la tira solo puede bajar. Un cuadro
  // en el que SUBE mas de 30 px es la pestaña de antes volviendo a aparecer.
  const atras = await page.evaluate(() => {
    const saltos = [];
    window.__tira.forEach((x, i, xs) => {
      if (i > 0 && x > xs[i - 1] + 30) saltos.push(xs[i - 1] + ' -> ' + x);
    });
    return saltos;
  });
  esperar(`la tira no salta hacia atras (${atras.length ? atras.join(', ') : 'ningun salto'})`, atras.length === 0);
  esperar('y avanzo las dos pestañas', (await activa()) === 'Álbum');

  console.log('\n6. Tocar la barra durante el viaje deja la barra y la tira de acuerdo');
  await page.getByText('Inicio', { exact: true }).last().click();
  await page.waitForTimeout(4000);
  // Donde esta el boton de Stats, medido ANTES: el toque tiene que caer dentro
  // de los 340 ms del viaje, y buscarlo despues de soltar no llega a tiempo.
  const caja = await page.getByText('Stats', { exact: true }).last().boundingBox();
  const bx = caja.x + caja.width / 2;
  const by = caja.y + caja.height / 2;
  await arrastrar(340, 150);
  // Soltar y tocar la barra SIN ESPERAR ENTRE LOS TRES: el viaje hacia Ranking
  // arranca y el toque en Stats lo corta.
  await Promise.all([toque('touchEnd', 150, 420), toque('touchStart', bx, by), toque('touchEnd', bx, by)]);
  await page.waitForTimeout(4000);
  const donde = await page.evaluate(() =>
    Math.round(document.querySelector('[data-testid="carril-inicio"]').getBoundingClientRect().left)
  );
  esperar(`la tira quedo en Stats (corrida ${donde})`, donde === -3 * 390);
  esperar('y la barra marca Stats', (await activa()) === 'Stats');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
} catch (e) {
  console.log('SE ROMPIO:', e.message.split('\n').slice(0, 3).join(' | '));
  await page.screenshot({ path: 'capturas/nativa-deslizando-roto.png' }).catch(() => {});
  fallas++;
} finally {
  await nav.close();
  console.log(fallas === 0 ? '\nOK: el gesto anda.' : `\n${fallas} fallas`);
  process.exit(fallas === 0 ? 0 : 1);
}
