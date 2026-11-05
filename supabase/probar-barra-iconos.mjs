// LA BARRA DE PESTAÑAS CON ICONOS (28/10, a pedido): cada pestaña con su icono arriba y la
// palabra chica abajo, y el icono de la que está abierta, encendido.
//
// En la vista web de la nativa (:8090), con una cuenta descartable: en cada una de las cinco
// pestañas hay un dibujo (svg) que queda arriba de su rótulo; se toca Stats y su luz se prende.
//
//   node --env-file=.env.local supabase/probar-barra-iconos.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, '..', 'capturas', 'barra-iconos');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-bi-${sello}@gmail.com`;
const clave = `Bi-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `bi_${sello.slice(-6)}` }).eq('id', uid);

console.log('La barra de pestañas, con iconos');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await page.getByRole('tab', { name: /^Stats/ }).first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  const forma = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[role="tab"]')].filter((t) => t.querySelector('[data-testid^="luz-"]')).map((t) => {
        const svgs = [...t.querySelectorAll('svg')];
        const rotulo = t.querySelector('[data-testid^="nombre-"]');
        const caja = rotulo?.getBoundingClientRect();
        // La luz del icono encendido: el producto de las opacidades hasta la pestaña.
        let luz = svgs[1] ? 1 : null;
        for (let n = svgs[1]; n && n !== t; n = n.parentElement) luz *= Number(getComputedStyle(n).opacity);
        return { iconos: svgs.length, arriba: !!caja && svgs.length > 0 && svgs[0].getBoundingClientRect().bottom <= caja.top + 1, luz };
      }),
    );
  const antes = await forma();
  await page.getByRole('tab', { name: /^Stats/ }).first().click();
  await page.waitForTimeout(1200);
  const despues = await forma();
  console.log('  --   luces antes ' + antes.map((t) => t.luz?.toFixed(2)).join(' ') + ' / después ' + despues.map((t) => t.luz?.toFixed(2)).join(' '));
  await page.screenshot({ path: join(SALIDA, 'barra.png'), clip: { x: 0, y: 760, width: 390, height: 84 } });
  chequear('las cinco pestañas tienen su icono (apagado y encendido) arriba de su nombre', antes.map((t) => [t.iconos, t.arriba]), Array(5).fill([2, true]));
  chequear('en Inicio se enciende el icono de Inicio; al tocar Stats, el de Stats', [antes[0].luz > 0.9, antes[3].luz < 0.1, despues[3].luz > 0.9, despues[0].luz < 0.1], [true, true, true, true]);

  // ---- LA BARRA SE FUNDE EN UN ARCO (2/11) ----
  const barra = await page.evaluate(() => {
    const lista = document.querySelector('[role="tablist"]');
    const e = getComputedStyle(lista);
    return { borde: parseFloat(e.borderTopWidth), top: lista.getBoundingClientRect().top, arco: !!lista.querySelector('[data-testid="arco-de-la-barra"]') };
  });
  chequear('sin caja ni línea recta: un arco', [barra.borde, barra.arco], [0, true]);
  const opacidad = (id) => page.getByTestId(id).first().evaluate((n) => { let o = 1; for (let a = n; a; a = a.parentElement) o *= Number(getComputedStyle(a).opacity); return o; });
  await page.waitForTimeout(2200);
  chequear('el nombre se fue, y quedan los iconos solos', await opacidad('nombre-stats') < 0.05, true);
  await page.getByRole('tab', { name: /^Álbum/ }).first().click();
  // Sin GPU los cuadros tardan: lo que importa es que aparezca, no a qué milisegundo.
  let mas = 0;
  for (let i = 0; i < 16; i++) {
    mas = Math.max(mas, await opacidad('nombre-album'));
    await page.waitForTimeout(80);
  }
  const nombre = await page.getByTestId('nombre-album').first().boundingBox();
  const icono = await page.getByTestId('luz-album').first().boundingBox();
  chequear('al cambiar aparece, debajo del icono', [mas > 0.5, nombre.y >= icono.y + icono.height - 1], [true, true]);
  // El arco pasa arriba de los iconos: en el borde de la pantalla, por el borde de la barra.
  const { alturaDelArco, SUBE_EL_ARCO } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'arcoDeLaBarra.ts')).href);
  const arcoEn = (x) => barra.top - SUBE_EL_ARCO + alturaDelArco(x, 390);
  for (const t of ['inicio', 'ranking', 'album', 'stats', 'ajustes']) {
    const n = await page.getByTestId('nombre-' + t).first().boundingBox();
    chequear(`«${t}» no pisa el arco, ni en la punta`, [n.x, n.x + n.width].every((x) => n.y > arcoEn(x) + 1), true);
  }
  await page.screenshot({ path: join(SALIDA, 'barra-nombre.png'), clip: { x: 0, y: 720, width: 390, height: 124 } });
  const puntoEn = () => page.getByTestId('punto-del-arco').first().boundingBox();
  await page.waitForTimeout(600);
  const punto = await puntoEn();
  chequear('el punto del arco está arriba de la pestaña en la que se está', [Math.round(punto.x + punto.width / 2), Math.abs(punto.y + punto.height / 2 - arcoEn(195)) < 2], [195, true]);
  await page.waitForTimeout(1800);
  chequear('el nombre se va solo', await opacidad('nombre-album') < 0.05, true);
  // AL SOLTAR, NO AL LLEGAR (5/11): deslizando a Stats, su nombre se prende mientras la pantalla viaja.
  await page.mouse.move(340, 500);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) await page.mouse.move(340 - (280 * i) / 16, 500);
  await page.mouse.up();
  let alViajar = 0;
  for (const desde = Date.now(); Date.now() - desde < 280; ) {
    alViajar = Math.max(alViajar, await opacidad('nombre-stats'));
    await page.waitForTimeout(30);
  }
  chequear('deslizando, el nombre se prende al soltar, sin esperar a que la pantalla llegue', alViajar > 0.5, true);
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
