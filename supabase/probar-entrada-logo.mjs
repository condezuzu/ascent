// LA ENTRADA DE LA APP (20/10, la «rápida» de la galería): el aro del logo se dibuja,
// destella el puntito, zoom al centro, y recién ahí se monta la app.
//
// En la vista web de la nativa (:8090), sin cuenta: se mira la página cada pocos
// milisegundos desde que carga. Mientras el logo está solo, la app no tiene que tener nada
// montado; el aro tiene que dibujarse (el trazo va de largo a cero); y al final el logo se
// va y queda la app (la bienvenida o el login).
//
//   node supabase/probar-entrada-logo.mjs
import { chromium } from 'playwright';
import { limiteDeSonda } from './utiles.mjs';

limiteDeSonda(4);

let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

console.log('La entrada del logo antes de la app');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY' })).newPage();
try {
  // Lo anota la propia página desde el primer cuadro, sin depender de la latencia de Playwright.
  await page.addInitScript(() => {
    const linea = [];
    window.__entrada = linea;
    const t0 = performance.now();
    const mirar = () => {
      const capa = document.querySelector('[data-testid="entrada-de-la-app"]');
      const trazo = capa?.querySelector('path[stroke-dasharray]');
      const fuera = [...document.querySelectorAll('[data-testid]')].filter((e) => !capa || !capa.contains(e)).length;
      const texto = (document.body?.innerText ?? '').trim().length;
      linea.push({ t: Math.round(performance.now() - t0), capa: !!capa, trazo: trazo ? Number(trazo.getAttribute('stroke-dashoffset')) : null, fuera, texto });
      if (linea.length < 4000) requestAnimationFrame(mirar);
    };
    requestAnimationFrame(mirar);
  });
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => window.__entrada?.some((m) => m.capa), null, { timeout: 180000 });
  await page.waitForFunction(() => {
    const l = window.__entrada;
    const i = l.findIndex((m) => m.capa);
    return i >= 0 && l.slice(i).some((m) => !m.capa);
  }, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const linea = await page.evaluate(() => window.__entrada);
  const desde = linea.findIndex((m) => m.capa);
  const conCapa = linea.slice(desde).filter((m) => m.capa);
  const sinApp = conCapa.filter((m) => m.fuera === 0 && m.texto === 0);
  const trazos = conCapa.map((m) => m.trazo).filter((x) => x !== null);
  const hasta = linea.slice(desde).find((m) => !m.capa);
  const fin = linea[linea.length - 1];
  chequear('al aparecer el logo, la app todavía no montó nada', [conCapa[0].fuera, conCapa[0].texto], [0, 0]);
  chequear('el logo solo dura al menos el dibujo del aro (600 ms)', sinApp.length > 0 && sinApp[sinApp.length - 1].t - sinApp[0].t >= 600, true);
  chequear('el aro se dibuja: el trazo arranca sin dibujar y termina entero', [trazos.length > 0 && trazos[0] > 100, trazos.length > 0 && Math.min(...trazos) < 1], [true, true]);
  chequear('el logo se va en menos de 4 s', !!hasta && hasta.t - conCapa[0].t < 4000, true);
  chequear('al irse, queda la app', fin.capa === false && fin.fuera > 0, true);
  console.log(`  --   logo solo ${sinApp.length ? sinApp[sinApp.length - 1].t - sinApp[0].t : 0} ms; el logo se fue a los ${hasta ? hasta.t - conCapa[0].t : '?'} ms`);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
}
await nav.close();
process.exit(fallos ? 1 : 0);
