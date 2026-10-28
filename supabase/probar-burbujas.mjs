// LAS BURBUJAS DEL MULTIJUGADOR EN INICIO (28/10, la variante B, más compacta): «Iniciar grupo»
// arriba de todo y una burbuja por amigo que entrena, y Inicio entero entra en la pantalla.
//
// En la vista web de la nativa (:8090), a 390×844, con una cuenta descartable con una rutina: la
// respuesta de `entrenando_ahora` se contesta desde acá con una amiga de muestra (una cuenta nueva
// no tiene amigos entrenando). Se mira que estén «Iniciar grupo» y la burbuja, debajo de la
// cabecera; que Inicio no se pueda desplazar; y que tocar la burbuja lleve a Social.
//
//   node --env-file=.env.local supabase/probar-burbujas.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'burbujas');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-bu-${sello}@gmail.com`;
const clave = `Bu-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `bu_${sello.slice(-6)}` }).eq('id', uid);
const dia = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - n * 86400000));
for (const n of [3, 2, 1]) await s.from('logs').insert({ user_id: uid, fecha: dia(n) });
const d = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 4 }] };
await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Prueba', p_dias: Array.from({ length: 7 }, () => d) });

console.log('Las burbujas del multijugador en Inicio');
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
const page = await ctx.newPage();
await page.route('**/rest/v1/rpc/entrenando_ahora', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: '00000000-0000-4000-8000-0000000000b1', username: 'lucia', avatar_url: null }]) }),
);
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await page.getByTestId('iniciar-grupo').first().waitFor({ timeout: 120000 });
  await page.getByText('De acuerdo', { exact: true }).last().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(SALIDA, 'inicio.png') });
  const forma = await page.evaluate(() => {
    const raiz = [...document.querySelectorAll('[data-testid="pantalla-inicio"]')].find((e) => e.offsetParent !== null);
    const desplazable = [...(raiz?.querySelectorAll('div') ?? [])].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY));
    const fila = document.querySelector('[data-testid="burbujas-del-grupo"]')?.getBoundingClientRect();
    const numero = document.querySelector('[data-testid="vidas-inicio"]')?.getBoundingClientRect();
    return {
      sobra: desplazable ? desplazable.scrollHeight - desplazable.clientHeight : null,
      alto: fila ? Math.round(fila.height) : null,
      arriba: !!fila && !!numero && fila.bottom <= numero.top,
    };
  });
  console.log(`  --   ${JSON.stringify(forma)}`);
  chequear('«Iniciar grupo» y la burbuja de la amiga, arriba (antes de las vidas), compactas', [
    await texto(TX.inicio.iniciarGrupo).isVisible(), await page.getByTestId('burbuja-amigo').count(), forma.arriba, forma.alto !== null && forma.alto <= 70,
  ], [true, 1, true, true]);
  chequear('Inicio entra entero en la pantalla: no hay nada que desplazar', forma.sobra !== null && forma.sobra <= 1, true);
  await page.getByTestId('burbuja-amigo').first().click();
  await page.waitForTimeout(1500);
  chequear('tocar la burbuja lleva a Social', await page.getByText(TX.social.titulo, { exact: true }).filter({ visible: true }).count() > 0, true);
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
