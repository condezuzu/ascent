// EL MOVIMIENTO (30/10): una curva para llegar, una salida más corta, y que lo que se va, se vaya.
// Antes casi nada salía: lo que se iba, se cortaba, y el velo de la hoja subía pegado a ella.
//
// Por la pantalla, cuadro por cuadro: un `requestAnimationFrame` anota dónde está cada cosa mientras se
// toca. La hoja de anotar el peso sube en varios cuadros y se va en menos tiempo del que tardó en
// llegar, con el velo quieto en su lugar. El pulgar de Stats viaja de una opción a la otra. Las cifras de
// Stats cuentan al aparecer. Los chips de arriba se cruzan sin ocupar lugar. Lo tocable se hunde con el
// dedo, y vuelve. Y con «reducir movimiento» todo eso aparece puesto.
//
// Lo que NO mide: en el iPhone estas animaciones corren en el hilo nativo y acá en JS, así que los
// tiempos son los de la vista web. Sirve para comparar entre sí, no como cifra exacta del teléfono.
//
//   node --env-file=.env.local supabase/probar-movimiento.mjs
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
const correo = `agusconde20+ascent-mo-${sello}@gmail.com`;
const clave = `Mo-${sello}-k9`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `mo_${sello.slice(-6)}`, sexo: 'm' }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (n) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const filas = [];
for (let a = 3; a >= 1; a--) filas.push({ user_id: uid, fecha: dia(a) });
await s.from('logs').insert(filas);
await s.rpc('recalcular_desde_cero');

// Anota cuadro por cuadro lo que devuelve `leer`, que corre en la página.
const grabar = (page, leer) => page.evaluate((cuerpo) => {
  const f = new Function(`return (${cuerpo})()`);
  window.__linea = [];
  window.__grabando = true;
  const paso = () => {
    if (!window.__grabando) return;
    window.__linea.push([performance.now(), f()]);
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}, leer.toString());
const parar = (page) => page.evaluate(() => {
  window.__grabando = false;
  return window.__linea;
});

const LEER_HOJA = () => {
  const h = document.querySelector('[data-testid="hoja"]');
  if (!h) return null;
  const velo = [...document.querySelectorAll('[aria-label]')].find((n) => n.getAttribute('aria-label') === 'Cerrar');
  return { y: Math.round(h.getBoundingClientRect().top), velo: velo ? Math.round(velo.getBoundingClientRect().top) : null };
};

console.log('El movimiento de la nativa');
// Con la GPU de la máquina: sin ella el motor se dibuja por CPU y quedan pocos cuadros para contar.
const nav = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader=false'] });
try {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas'] })), [uid]);
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText(TX.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  const iniciar = page.getByText(TX.inicio.iniciarEntrenamiento, { exact: true }).first();
  await iniciar.waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);

  // ---- LO TOCABLE SE HUNDE ----
  const anotar = page.getByTestId('pantalla-inicio').getByText(TX.peso.anotarPeso, { exact: true }).first();
  const caja = await anotar.boundingBox();
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(220);
  const escalaDe = () => anotar.evaluate((n) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(n.closest('button') ?? n.parentElement).transform);
    return Math.round(m.a * 100) / 100;
  });
  const hundido = await escalaDe();
  chequear('«Anotar peso» se hunde con el dedo', hundido < 1, true);
  await page.mouse.move(5, 5);
  await page.mouse.up();
  await page.waitForTimeout(600);
  chequear('y vuelve', await escalaDe(), 1);

  // ---- LA HOJA ----
  await grabar(page, LEER_HOJA);
  const clic = await page.evaluate(() => performance.now());
  await anotar.click({ timeout: 20000 });
  await page.waitForTimeout(800);
  const subida = (await parar(page)).filter(([t]) => t >= clic);
  const conHoja = subida.filter(([, v]) => v);
  const yes = conHoja.map(([, v]) => v.y);
  const yFinal = yes[yes.length - 1];
  const llegaEn = conHoja.find(([, v]) => v.y === yFinal)?.[0] - conHoja[0]?.[0];
  chequear('la hoja sube en varios cuadros', new Set(yes).size >= 3, true);
  chequear('el velo no sube con ella: se queda en su lugar', [...new Set(conHoja.map(([, v]) => v.velo))], [0]);

  await grabar(page, LEER_HOJA);
  const cierre = await page.evaluate(() => performance.now());
  await page.getByLabel(TX.general.cerrar, { exact: true }).last().click({ timeout: 8000, position: { x: 195, y: 60 } });
  await page.waitForTimeout(700);
  const bajada = (await parar(page)).filter(([t]) => t >= cierre);
  // Desde que empieza a bajar: el clic de la prueba tarda lo suyo en llegar.
  const yArriba = bajada.find(([, v]) => v)?.[1].y;
  const empieza = bajada.find(([, v]) => v && v.y !== yArriba);
  const ultimoConHoja = [...bajada].reverse().find(([, v]) => v);
  const seVaEn = ultimoConHoja && empieza ? ultimoConHoja[0] - empieza[0] : 0;
  chequear('al cerrar no se corta: sigue un rato y baja', [seVaEn > 90, new Set(bajada.filter(([, v]) => v).map(([, v]) => v.y)).size >= 3], [true, true]);
  chequear('y termina: no queda montada', await page.getByTestId('hoja').count(), 0);
  // Llegar son 340 ms y salir 230. Los números exactos los pinea test:db; acá, con la tolerancia de una página que dibuja en JS.
  chequear(`se va en menos de lo que tarda en llegar: ${Math.round(seVaEn)} ms contra 340 (llegó al último píxel en ${Math.round(llegaEn)})`, seVaEn > 90 && seVaEn < 340, true);

  // ---- LAS CIFRAS CUENTAN ----
  await grabar(page, () => document.querySelector('[data-testid="stats-cifra"]')?.textContent ?? null);
  await page.getByText(TX.nav.stats, { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const cuenta = (await parar(page)).map(([, v]) => v).filter((v) => v !== null);
  const distintas = [...new Set(cuenta)];
  chequear('las cifras de Stats cuentan al aparecer: pasan por más de un número', distintas.length >= 2, true);
  chequear('de menos a más, y terminan en su valor', distintas.map(Number).every((v, i, a) => i === 0 || v >= a[i - 1]) && Number(distintas[distintas.length - 1]) > 0, true);

  // ---- EL PULGAR ----
  await grabar(page, () => {
    const p = document.querySelector('[data-testid="stats-pulgar"]');
    return p ? Math.round(p.getBoundingClientRect().left) : null;
  });
  const alOtro = page.getByText(TX.stats.pestanaEntrenamiento, { exact: true }).last();
  await alOtro.click({ timeout: 20000 });
  await page.waitForTimeout(800);
  const pulgar = (await parar(page)).map(([, v]) => v).filter((v) => v !== null);
  chequear('el pulgar viaja: pasa por varios lugares', new Set(pulgar).size >= 4, true);
  const dondeLlega = pulgar[pulgar.length - 1];
  const lugarOpcion = await alOtro.evaluate((n) => Math.round(n.parentElement.getBoundingClientRect().left));
  chequear('y llega a la opción tocada', Math.abs(dondeLlega - lugarOpcion) <= 1, true);

  // ---- LOS CHIPS SE CRUZAN ----
  await page.getByText(TX.nav.inicio, { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(900);
  await grabar(page, () => {
    const q = document.querySelector('[data-testid="cruce-saliendo"]');
    return q ? { ninguno: getComputedStyle(q).pointerEvents, pos: getComputedStyle(q).position } : null;
  });
  await iniciar.click({ timeout: 30000 });
  // Lo que cambia el chip es la respuesta del servidor, no el toque.
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(700);
  const cruce = (await parar(page)).map(([, v]) => v).filter(Boolean);
  chequear('el que sale sigue un momento, sin ocupar lugar ni recibir toques', [cruce.length > 2, cruce[0]?.ninguno, cruce[0]?.pos], [true, 'none', 'absolute']);
  await page.waitForTimeout(400);
  chequear('y se va', await page.getByTestId('cruce-saliendo').count(), 0);
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  await s.from('logs').delete().eq('user_id', uid).eq('fecha', HOY);
  await s.rpc('recalcular_desde_cero');

  // ---- REDUCIR MOVIMIENTO ----
  const estado = await ctx.storageState();
  const ctx2 = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo', reducedMotion: 'reduce', storageState: estado });
  const p2 = await ctx2.newPage();
  await p2.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p2.getByTestId('pantalla-inicio').getByText(TX.peso.anotarPeso, { exact: true }).first().waitFor({ timeout: 120000 });
  await p2.waitForTimeout(1500);
  await grabar(p2, LEER_HOJA);
  await p2.getByTestId('pantalla-inicio').getByText(TX.peso.anotarPeso, { exact: true }).first().click({ timeout: 20000 });
  await p2.waitForTimeout(500);
  const quieta = (await parar(p2)).filter(([, v]) => v).map(([, v]) => v.y);
  chequear('con «reducir movimiento» la hoja aparece puesta, sin viaje', new Set(quieta).size <= 2, true);
  await ctx2.close();
} finally {
  await nav.close();
  await s.rpc('terminar_sesion').then(() => {}, () => {});
  const { error } = await borrarCuentaDePrueba(s);
  if (error) console.log('No se pudo borrar la cuenta:', error.message);
}
console.log(fallos ? `\n${fallos} fallas` : '\nLlega con la curva, se va más corto: bien');
process.exit(fallos ? 1 : 0);
