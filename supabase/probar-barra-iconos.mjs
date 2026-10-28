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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'barra-iconos');
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
        const rotulo = t.querySelector('[data-testid^="luz-"]');
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
  chequear('las cinco pestañas tienen su icono (apagado y encendido) arriba de la palabra', antes.map((t) => [t.iconos, t.arriba]), Array(5).fill([2, true]));
  chequear('en Inicio se enciende el icono de Inicio; al tocar Stats, el de Stats', [antes[0].luz > 0.9, antes[3].luz < 0.1, despues[3].luz > 0.9, despues[0].luz < 0.1], [true, true, true, true]);
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
