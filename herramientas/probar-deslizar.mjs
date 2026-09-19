// ¿LA PESTAÑA DE AL LADO ASOMA MIENTRAS SE ARRASTRA? (19/9)
//
// En la web, deslizar entre pestañas se sentía "se mueve, carga, se mueve,
// carga": la de al lado no aparecía hasta soltar, y aparecía entera y de
// golpe. Esto hace el gesto con el dedo de verdad (eventos táctiles por CDP,
// no clics) y mira:
//   1. A mitad del arrastre: ¿hay una pestaña asomando, pegada a la actual y
//      en el lugar que le toca? (foto)
//   2. Al soltar: una línea de tiempo cada 30 ms hasta que está la pestaña
//      nueva. En ningún cuadro puede faltar todo: o está la copia o la de
//      verdad.
//   3. Arrastrar poco y soltar: vuelve, y la copia se va.
//
// No escribe nada en la cuenta: solo entra y mira.
//
//   node --env-file=.env.local herramientas/probar-deslizar.mjs
//
// Necesita la web prendida en :3020.
import { chromium } from 'playwright';
import { limiteDeSonda, pasarLaEntrada } from '../supabase/utiles.mjs';

limiteDeSonda(8);

const BASE = 'http://localhost:3020';
const nav = await chromium.launch({
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'],
});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
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

const estado = () =>
  page.evaluate(() => {
    const a = document.querySelector('.asomo');
    const r = a?.getBoundingClientRect();
    const pantallas = [...document.querySelectorAll('.deslizable')].map((d) => Math.round(d.getBoundingClientRect().left));
    return {
      ruta: location.pathname,
      asomo: a ? { izquierda: Math.round(r.left), texto: a.innerText.replace(/\s+/g, ' ').slice(0, 40) } : null,
      pantallas,
    };
  });

try {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pasarLaEntrada(page);
  await page.locator('input[type=email]').fill(process.env.CONEXION_EMAIL);
  await page.locator('input[type=password]').fill(process.env.CONEXION_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120000 });
  await page.waitForFunction(() => performance.getEntriesByName('ascent:pantalla-lista').length > 0, null, { timeout: 60000 });
  const entendido = page.getByText('Entendido', { exact: true });
  if (await entendido.count()) await entendido.last().click();
  await page.waitForTimeout(1500);

  // Ranking visto una vez (con la barra) para que tenga foto; y de vuelta.
  await page.locator('nav.nav a[href="/social"]').evaluate((a) => a.click());
  await page.waitForURL((u) => u.pathname === '/social', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('nav.nav a[href="/"]').evaluate((a) => a.click());
  await page.waitForURL((u) => u.pathname === '/', { timeout: 30000 });
  await page.waitForTimeout(2500);

  console.log('\n1. Inicio → Ranking, a mitad del arrastre (120 px)');
  await arrastrar(330, 210);
  let e = await estado();
  await page.screenshot({ path: 'capturas/deslizar-01-mitad.png' });
  console.log(`     ${JSON.stringify(e)}`);
  esperar('asoma una pestaña', !!e.asomo);
  esperar('pegada a la actual: su borde izquierdo en 390 − 120 = 270', !!e.asomo && Math.abs(e.asomo.izquierda - 270) <= 3);
  esperar('la actual corrida 120', e.pantallas[0] !== undefined && Math.abs(e.pantallas[0] + 120) <= 3);
  esperar('la que asoma es Ranking, con su contenido', !!e.asomo && /ranking/i.test(e.asomo.texto));

  console.log('\n2. Seguir hasta 200 y soltar: línea de tiempo');
  for (let i = 1; i <= 5; i++) {
    await toque('touchMove', 210 - i * 16, 420);
    await page.waitForTimeout(16);
  }
  const t0 = Date.now();
  await toque('touchEnd');
  const linea = [];
  let vacio = 0;
  while (Date.now() - t0 < 4000) {
    e = await estado();
    // Algo cubre la ventana si la copia está en su lugar o hay una pantalla
    // de verdad en su lugar.
    const cubre = (e.asomo && Math.abs(e.asomo.izquierda) < 40) || e.pantallas.some((x) => Math.abs(x) < 40);
    const enMovimiento = e.asomo && Math.abs(e.asomo.izquierda) >= 40;
    if (!cubre && !enMovimiento) vacio++;
    linea.push(`${String(Date.now() - t0).padStart(5)} ms  ${e.ruta.padEnd(8)} copia ${e.asomo ? String(e.asomo.izquierda).padStart(4) : '   —'}  pantallas ${JSON.stringify(e.pantallas)}`);
    if (e.ruta === '/social' && !e.asomo) break;
    await page.waitForTimeout(30);
  }
  for (const l of linea) console.log('     ' + l);
  e = await estado();
  esperar('terminó en Ranking', e.ruta === '/social');
  esperar('la copia se fue', !e.asomo);
  esperar('ningún cuadro sin nada en pantalla', vacio === 0);
  await page.screenshot({ path: 'capturas/deslizar-02-llego.png' });

  console.log('\n3. Ranking → Inicio, poquito (40 px) y soltar: vuelve');
  await arrastrar(60, 100, 420, 6);
  e = await estado();
  esperar('asoma Inicio del lado izquierdo', !!e.asomo && e.asomo.izquierda < 0);
  await toque('touchEnd');
  await page.waitForTimeout(700);
  e = await estado();
  esperar('se quedó en Ranking', e.ruta === '/social');
  esperar('la copia se fue', !e.asomo);
  esperar('la pantalla volvió a su lugar', e.pantallas[0] === 0);

  console.log('\n4. Ranking → Álbum, que nunca se abrió: asoma con su título');
  await arrastrar(330, 190);
  e = await estado();
  await page.screenshot({ path: 'capturas/deslizar-03-sin-foto.png' });
  esperar('asoma con el título "Álbum"', !!e.asomo && /álbum/i.test(e.asomo.texto));
  await toque('touchEnd');
  await page.waitForURL((u) => u.pathname === '/album', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  e = await estado();
  esperar('llegó al Álbum y la copia se fue', e.ruta === '/album' && !e.asomo);
} catch (err) {
  fallas++;
  console.log(`\nFALLA ${err.message.split('\n')[0]}`);
  await page.screenshot({ path: 'capturas/deslizar-falla.png' }).catch(() => {});
} finally {
  await nav.close();
}
console.log(fallas ? `\n${fallas} fallas` : '\ntodo bien');
process.exit(fallas ? 1 : 0);
