// EL RIR, LA ÚLTIMA VEZ AL TOCAR LA FECHA Y EL GLOBO DE SUBIR (12/11, galería 21, migración 102). Y de paso
// lo otro de esa tanda: Stats → Vidas con el mes (galería 22) y la barra de una sola pieza.
//
// En la vista web de la nativa (:8090), con una cuenta descartable. Lo real: la cuenta, la rutina con
// objetivo de 10, los ajustes, la serie que se anota y lo que llega a la base. Un doble: la sesión de
// la vez anterior (3 × 10 a 40 kg con RIR 3, 2, 2), porque una sesión solo puede empezar hoy.
//
//   node --env-file=.env.local supabase/probar-rir.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(10);
const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'rir');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-ri-${sello}@gmail.com`;
const clave = `Ri-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `ri_${sello.slice(-6)}` }).eq('id', uid);
const HOY = (await s.rpc('mi_hoy')).data;
const dia = (a) => { const d = new Date(`${HOY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - a); return d.toISOString().slice(0, 10); };
const filas = [];
for (let a = 12; a >= 1; a--) if (a !== 4) filas.push({ user_id: uid, fecha: dia(a) });
await s.from('logs').insert(filas);
const d = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3, reps: 10 }] };
await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Pecho', p_dias: Array.from({ length: 7 }, () => d) });
const anterior = { fecha: dia(3), bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [40, 40, 40], reps: [10, 10, 10], rir: [3, 2, 2], carga: 'total' }] };

console.log('El RIR, la última vez y el globo de subir');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
await page.route((u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs'), async (route) => {
  const r = await route.fetch();
  const reales = await r.json().catch(() => []);
  if (!Array.isArray(reales)) return route.fulfill({ response: r });
  await route.fulfill({ response: r, json: [...reales, { id: '00000000-0000-0000-0000-000000000001', bloques: anterior.bloques, logs: { fecha: anterior.fecha } }] });
});
const enviados = [];
page.on('request', (q) => {
  if (q.url().includes('/rest/v1/rpc/fijar_bloques')) enviados.push(JSON.parse(q.postData() ?? '{}').p_bloques ?? []);
});
const texto = (t) => page.getByText(t, { exact: true }).last();
const yDelMas = async () => Math.round((await page.getByLabel('Sumar una serie').first().boundingBox())?.y ?? -1);
const foto = (n) => page.screenshot({ path: join(SALIDA, n) });
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas', 'grupo', 'stats'] })), [uid]);
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(4000);

  // La barra: una sola pieza con la forma del arco, sin desenfoque.
  const barra = await page.locator('[role="tablist"]').first().evaluate((n) => ({
    piezas: n.querySelectorAll('[data-testid="arco-de-la-barra"] path[fill-opacity]').length,
    desenfoque: [...n.querySelectorAll('*')].filter((h) => /blur/.test(getComputedStyle(h).backdropFilter || '')).length,
  }));
  chequear('la barra de abajo: una sola pieza con el arco, sin desenfoque', barra, { piezas: 1, desenfoque: 0 });

  await texto('Ajustes').click({ timeout: 30000 });
  for (const n of ['Mostrar la última vez', 'Registrar repeticiones', 'Registrar RIR']) {
    const l = page.getByRole('switch', { name: n }).first();
    await l.scrollIntoViewIfNeeded({ timeout: 30000 });
    await l.click();
    await page.waitForTimeout(600);
  }
  await page.getByRole('switch', { name: 'Registrar RIR' }).first().scrollIntoViewIfNeeded();
  await foto('ajustes.png');
  await texto('Inicio').click({ timeout: 30000 });
  await page.waitForTimeout(4000);
  await texto('Iniciar entrenamiento').click({ timeout: 30000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.getByText(/^Press de banca/).first().waitFor({ timeout: 30000 });

  // El globo de subir: aparece arriba del peso, no mueve el +, y se va solo a los cuatro segundos.
  const globo = page.getByTestId('globito-subir').first();
  const aparecio = await globo.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
  const yConGlobo = await yDelMas();
  await foto('globo-subir.png');
  chequear('con todas a 10 y RIR 2 o más, el globo dice cuánto subir', [aparecio, aparecio ? (await globo.innerText()).trim() : ''], [true, '↑ Puedes subir a 41 kg']);
  await page.waitForTimeout(4500);
  chequear('a los cuatro segundos se fue, y el + no se movió', [await globo.count(), await yDelMas()], [0, yConGlobo]);

  // La última vez: un botón con la fecha; al tocarlo, cada serie, y el + sigue en su lugar.
  const ultima = page.getByTestId('ultima-vez').first();
  chequear('la última vez es un botón con la fecha', (await ultima.innerText()).trim(), `↺ ${Number(dia(3).slice(8))}/${Number(dia(3).slice(5, 7))}`);
  await ultima.click();
  await page.waitForTimeout(500);
  await foto('ultima-vez-abierta.png');
  chequear('abierta: cada serie con su peso, sus repeticiones y su RIR, sin empujar el +', [
    (await page.getByTestId('ultima-vez-abierta').first().innerText()).split('\n').slice(1).map((x) => x.trim()),
    await yDelMas(),
  ], [['40 kg × 10 · RIR 3', '40 kg × 10 · RIR 2', '40 kg × 10 · RIR 2'], yConGlobo]);
  await page.getByTestId('ultima-vez-abierta').first().click();

  // El RIR: un botón; al tocarlo, «Rep. en Reserva» con 0 a 4+; elegido, el botón lo dice y el + lo anota.
  await page.getByTestId('boton-rir').first().click();
  await page.waitForTimeout(400);
  await foto('rir-abierto.png');
  chequear('el globo dice «Rep. en Reserva» y ofrece 0 a 4+, sin mover el +', [
    (await page.getByTestId('rir-abierto').first().innerText()).split('\n').map((x) => x.trim()).filter(Boolean),
    await yDelMas(),
  ], [['Rep. en Reserva', '0', '1', '2', '3', '4+'], yConGlobo]);
  await page.getByTestId('rir-2').first().click();
  await page.waitForTimeout(400);
  chequear('elegido, el botón dice «RIR 2»', (await page.getByTestId('boton-rir').first().innerText()).trim(), 'RIR 2');
  await foto('rir-elegido.png');
  const campo = page.getByLabel('Peso de las próximas series').first();
  await campo.fill('41');
  await campo.press('Enter');
  await page.getByTestId('campo-reps').first().fill('10');
  await page.waitForTimeout(300);
  await page.getByLabel('Sumar una serie').first().click();
  await page.waitForTimeout(3000);
  chequear('el + lo manda con la serie, y el botón vuelve a «RIR»', [(enviados.at(-1) ?? []).find((b) => b.ejercicio === 'press_banca')?.rir, (await page.getByTestId('boton-rir').first().innerText()).trim()], [[2], 'RIR']);
  const { data: ses } = await s.from('sesiones').select('bloques').eq('user_id', uid).eq('estado', 'corriendo');
  chequear('y la base lo guardó (migración 102)', (ses?.[0]?.bloques ?? []).find((b) => b.ejercicio === 'press_banca')?.rir, [2]);

  // Stats → Vidas: el mes, sin la racha repetida ni el número de días.
  await page.getByRole('tab', { name: /^Stats/ }).first().click({ timeout: 30000 });
  await page.getByTestId('mes-de-vidas').first().waitFor({ timeout: 30000 });
  await page.getByTestId('mes-de-vidas').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await foto('stats-vidas.png');
  chequear('Stats: el mes con lo que fuiste, sin la racha repetida ni los días que faltan', [
    await page.getByTestId('mes-fui').count() > 0,
    await page.getByTestId('vidas-racha').count(),
    await page.getByTestId('vidas-faltan').count(),
  ], [true, 0, 0]);
  chequear('sin errores de la página', errores, []);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
  await foto('error.png').catch(() => {});
}
await nav.close();
const { error: eBorrar } = await borrarCuentaDePrueba(s);
console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada${eBorrar ? ': ' + eBorrar.message : ''}`);
if (eBorrar) fallos++;
process.exit(fallos ? 1 : 0);
