// COMPARTIR LA SUBIDA DE RANGO (16/11, galería 23). Una cuenta con racha 5 empieza a entrenar, sube al
// rango 2 delante de la prueba, y al terminar la coreografía toca «Compartir»: se lee lo que le llega a la
// hoja de compartir (la tarjeta del rango y el mensaje) y que la ceremonia sigue abierta.
//
// Es la vista web de la nativa: la hoja es `navigator.share`, interceptada; en el iPhone es la del sistema.
//
//   node --env-file=.env.local supabase/probar-compartir-rango.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-cr-${sello}@gmail.com`;
const clave = `Cr-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `cr_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
await s.from('logs').insert([1, 2, 3, 4, 5].map((n) => ({ user_id: uid, fecha: dia(n) })));
await s.rpc('recalcular_desde_cero');

console.log('Compartir la subida de rango');
const nav = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  // La hoja de compartir de la vista web: se anota lo que recibe en vez de abrirla.
  await ctx.addInitScript(() => {
    window.__compartido = [];
    navigator.share = async (d) => { window.__compartido.push(d); };
    navigator.canShare = () => true;
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
  const iniciar = () => page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first();

  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas'] })), [uid]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  await iniciar().waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await iniciar().waitFor({ timeout: 120000 });

  await iniciar().click({ timeout: 30000 });
  await page.getByText(TX.sesion.nuevoRango, { exact: true }).first().waitFor({ timeout: 30000 });
  const boton = page.getByTestId('compartir-rango');
  await boton.waitFor({ timeout: 15000 });
  await page.waitForTimeout(3600);
  await page.screenshot({ path: join(AQUI, '..', 'capturas-nativa', 'compartir-rango.png') });
  await boton.click();
  let compartido = [];
  for (let i = 0; i < 20 && !compartido.length; i++) {
    await page.waitForTimeout(250);
    compartido = await page.evaluate(() => window.__compartido);
  }
  const d = compartido[0] ?? {};
  chequear('se compartió una vez', compartido.length, 1);
  chequear('el mensaje', d.text, TX.sesion.mensajeRango('Asteroide', 6));
  chequear('la tarjeta del rango 2', /rango-2(\.[0-9a-f]+)?\.jpg/.test(d.url ?? ''), true);
  const img = d.url ? await page.evaluate(async (u) => { const r = await fetch(u); return { ok: r.ok, tipo: r.headers.get('content-type') }; }, d.url) : null;
  chequear('la tarjeta se puede bajar y es una imagen', img && img.ok && /image\/jpeg/.test(img.tipo ?? ''), true);
  chequear('tocar Compartir no cierra la ceremonia', await page.getByText(TX.sesion.nuevoRango, { exact: true }).count() > 0, true);
  chequear('sin errores de la página', errores, []);
} finally {
  await nav.close();
  const { error } = await borrarCuentaDePrueba(s);
  if (error) console.log('No se pudo borrar la cuenta de prueba:', error.message);
}
console.log(fallos ? `\n${fallos} fallaron` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
