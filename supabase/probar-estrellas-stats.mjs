// LAS VIDAS EN STATS SON ESTRELLAS, EN PANTALLA (26/10). Se cambió dos veces en el código y el
// usuario seguía viendo círculos: esta prueba mira lo que se dibuja, no el archivo.
//
// En la vista web de la nativa (:8090), con una cuenta descartable con días entrenados: se abre
// Stats y, en la línea de las vidas, cada vida tiene que ser el trazo de la estrella (el `d` de
// Estrella.tsx) y ninguna un círculo (un `circle` de SVG o una vista redonda).
//
//   node --env-file=.env.local supabase/probar-estrellas-stats.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, '..', 'capturas', 'estrellas-stats');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-es-${sello}@gmail.com`;
const clave = `Es-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `es_${sello.slice(-6)}` }).eq('id', uid);
const dia = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - n * 86400000));
for (const n of [6, 5, 4, 3, 2, 1]) await s.from('logs').insert({ user_id: uid, fecha: dia(n) });

console.log('Las vidas de Stats, en pantalla');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await page.getByRole('tab', { name: /^Stats/ }).first().click({ timeout: 120000 });
  const linea = page.getByTestId('vidas-stats').filter({ visible: true }).first();
  await linea.waitFor({ timeout: 60000 });
  await linea.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SALIDA, "stats.png"), fullPage: true });
  await linea.screenshot({ path: join(SALIDA, 'vidas.png') });
  const forma = await linea.evaluate((el) => ({
    hijos: el.children.length,
    estrellas: [...el.children].filter((h) => h.querySelector('path')?.getAttribute('d')?.startsWith('M0,-48')).length,
    circulos: el.querySelectorAll('circle, ellipse').length + [...el.querySelectorAll('div')].filter((d) => parseFloat(getComputedStyle(d).borderRadius) > 0).length,
  }));
  console.log('  --   ' + JSON.stringify(forma));
  chequear('cada vida es la estrella y ninguna es un círculo', [forma.hijos > 0 && forma.estrellas === forma.hijos, forma.circulos], [true, 0]);
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
