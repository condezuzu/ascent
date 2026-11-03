// LA FORMA (30/10): octágono o píldora. El radio intermedio es la huella dactilar de la plantilla
// (`spec/estetica.md` §19.1), y la nativa tenía 26 radios distintos.
//
// Por la pantalla: recorre Inicio, una sesión, el descanso, Stats, Social, Álbum, Ajustes y la hoja de
// anotar el peso, y le pregunta al navegador el radio de cada elemento visible. Vale recto (hasta 2),
// y vale redondo del todo (círculo o píldora: la mitad de su lado corto). Lo del medio falla.
//
// Y lo que tiene una forma pedida: las cuatro cifras de Stats en caja cortada, la hoja con las esquinas
// de arriba cortadas y lo secundario subrayado.
//
// Es la vista web de la nativa, no el iPhone: los radios son los que React Native le pasa a la web.
//
//   node --env-file=.env.local supabase/probar-forma.mjs
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
const correo = `agusconde20+ascent-fo-${sello}@gmail.com`;
const clave = `Fo-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `fo_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const filas = [];
for (let a = 3; a >= 1; a--) filas.push({ user_id: uid, fecha: dia(a) });
await s.from('logs').insert(filas);
await s.rpc('recalcular_desde_cero');

console.log('La forma de la nativa');
const nav = await chromium.launch();
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const page = await ctx.newPage();
  const texto = (t) => page.getByText(t, { exact: true }).last();
  // Los radios del medio de lo que se ve.
  const delMedio = () => page.evaluate(() => {
    const salida = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      const r = Math.max(...['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].map((k) => parseFloat(cs[k]) || 0));
      if (r <= 2) continue;
      const c = el.getBoundingClientRect();
      if (c.width < 1 || c.height < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (c.right < 0 || c.bottom < 0 || c.left > innerWidth || c.top > innerHeight) continue;
      // Sin nada que se le vea (ni fondo, ni borde, ni recorte de una foto), el radio no dibuja nada.
      const seVe = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0 || cs.overflow === 'hidden';
      if (!seVe) continue;
      // El alto y el ancho sin transformaciones: un aro que late sigue siendo un aro.
      const ancho = el.offsetWidth ?? c.width;
      const alto = el.offsetHeight ?? c.height;
      if (r >= Math.min(ancho, alto) / 2 - 1) continue;
      salida.push(`${(el.textContent || '').trim().slice(0, 22) || el.tagName} r=${r} ${Math.round(ancho)}×${Math.round(alto)}`);
    }
    return [...new Set(salida)];
  });

  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas'] })), [uid]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  const iniciar = page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first();
  await iniciar.waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);

  chequear('Inicio: ningún radio del medio', await delMedio(), []);

  // ---- LA HOJA ----
  await page.getByText(TX.peso.anotarPeso, { exact: true }).first().click({ timeout: 20000 });
  const hoja = page.getByTestId('hoja').last();
  await hoja.waitFor({ timeout: 20000 });
  await page.waitForTimeout(700);
  chequear('la hoja: ningún radio del medio', await delMedio(), []);
  const puntos = await hoja.locator('polygon').first().getAttribute('points');
  const [primero] = puntos.split(' ');
  chequear('la hoja lleva las esquinas de arriba cortadas: el dibujo no arranca en la esquina', primero.split(',').map(Number)[0] > 10, true);
  const ultimas = puntos.split(' ').map((p) => p.split(',').map(Number));
  const alto = Math.max(...ultimas.map((p) => p[1]));
  chequear('y las de abajo rectas: toca el borde de abajo en las dos puntas', ultimas.filter((p) => p[1] === alto).length, 2);
  await page.getByTestId('anotar-peso-valor').first().waitFor({ timeout: 5000 }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' });
  await iniciar.waitFor({ timeout: 120000 });
  await page.waitForTimeout(1000);

  // ---- LO SECUNDARIO ----
  const subrayado = await page.getByTestId('pantalla-inicio').getByText(TX.peso.anotarPeso, { exact: true }).first().evaluate((n) => {
    const cs = getComputedStyle(n.parentElement);
    return { linea: parseFloat(cs.borderBottomWidth) >= 1, fondo: getComputedStyle(n.closest('button') ?? n).backgroundColor };
  });
  chequear('«Anotar peso» es texto subrayado, no una caja', subrayado, { linea: true, fondo: 'rgba(0, 0, 0, 0)' });

  // ---- ENTRENANDO ----
  await iniciar.click({ timeout: 30000 });
  const mas = page.getByLabel(TX.inicio.sumarSerie).first();
  await mas.waitFor({ timeout: 60000 });
  await page.waitForTimeout(1000);
  chequear('entrenando: ningún radio del medio', await delMedio(), []);
  await page.getByText('×3', { exact: true }).first().click({ timeout: 20000 });
  await page.waitForTimeout(300);
  await mas.click();
  await page.waitForTimeout(800);

  // ---- EL DESCANSO ----
  await page.getByTestId('pildora-descanso').first().click({ timeout: 20000 });
  await page.getByTestId('descanso-reloj').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  chequear('el descanso: ningún radio del medio', await delMedio(), []);
  chequear('«Serie hecha» va en octágono', await page.getByText(TX.descanso.serieHecha, { exact: true }).last().evaluate((n) => !!n.parentElement.querySelector('polygon')), true);

  await s.rpc('terminar_sesion').then(() => {}, () => {});
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('luz-stats').first().waitFor({ timeout: 120000, state: 'attached' });
  await page.waitForTimeout(1200);

  // ---- STATS ----
  await texto(TX.nav.stats).click({ timeout: 30000 });
  await page.waitForTimeout(1800);
  chequear('Stats: ningún radio del medio', await delMedio(), []);
  const cifras = page.getByTestId('stats-cifra');
  chequear('las cuatro cifras', await cifras.count(), 4);
  // Desde «Cifras» (2/11) no van en caja: una grande, y tres chicas en una fila, del mismo ancho.
  const enCaja = await cifras.evaluateAll((ns) => ns.map((n) => !!n.parentElement.querySelector('polygon')));
  chequear('sin caja', enCaja, [false, false, false, false]);
  const cajas = await cifras.evaluateAll((ns) => ns.map((n) => { const c = n.parentElement.getBoundingClientRect(); return [Math.round(c.x), Math.round(c.y), Math.round(c.width), Math.round(n.getBoundingClientRect().height)]; }));
  chequear('la grande arriba, y las chicas en una fila', [cajas[0][3] > cajas[1][3] * 2, cajas[0][1] < cajas[1][1], cajas[1][1] === cajas[2][1], cajas[2][1] === cajas[3][1]], [true, true, true, true]);
  await page.mouse.move(195, 500);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(600);
  chequear('Stats, más abajo: ningún radio del medio', await delMedio(), []);
  await texto(TX.stats.pestanaEntrenamiento).click({ timeout: 20000 });
  await page.waitForTimeout(1500);
  chequear('Entrenamiento: ningún radio del medio', await delMedio(), []);

  // ---- LAS OTRAS ----
  await texto(TX.nav.social).click({ timeout: 20000 });
  await page.waitForTimeout(1500);
  chequear('Social: ningún radio del medio', await delMedio(), []);
  await texto(TX.nav.album).click({ timeout: 20000 });
  await page.waitForTimeout(1500);
  chequear('Álbum: ningún radio del medio', await delMedio(), []);
  await texto(TX.nav.ajustes).click({ timeout: 20000 });
  await page.waitForTimeout(1500);
  chequear('Ajustes: ningún radio del medio', await delMedio(), []);
} finally {
  await nav.close();
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  const { error } = await borrarCuentaDePrueba(s);
  if (error) console.log('No se pudo borrar la cuenta:', error.message);
}
console.log(fallos ? `\n${fallos} fallas` : '\nOctágono o píldora: bien');
process.exit(fallos ? 1 : 0);
