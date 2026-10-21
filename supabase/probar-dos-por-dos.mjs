// SUBIR EL PESO CON LA REGLA 2 POR 2 (21/10). Con 8 repeticiones objetivo en la rutina y las dos
// sesiones anteriores de press de banca terminadas con 10 en la última serie (60 kg), al empezar a
// entrenar el globito dice que ya se puede subir, con el rango: de 61,5 a 63 kg (2 a 5 %).
//
// En la vista web de la nativa (:8090), con una cuenta descartable. Las dos sesiones y la rutina
// se inyectan en las respuestas (historial y `mis_rutinas`): con la base en la 94 la rutina no
// guarda el objetivo, y las sesiones solo se escriben con la fecha de hoy.
//
//   node --env-file=.env.local supabase/probar-dos-por-dos.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'dos-por-dos');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-dd-${sello}@gmail.com`;
const clave = `Dd-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `dd_${sello.slice(-6)}` }).eq('id', uid);
const diaAtras = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - n * 86400000));

console.log('Subir el peso con la regla 2 por 2');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
let ultimaSerie = 10;
await page.route(
  (u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs!inner'),
  async (route) => {
    const r = await route.fetch();
    const filas = await r.json().catch(() => []);
    filas.push({ bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 60, 60], carga: 'total', reps: [10, 10, 10] }], logs: { fecha: diaAtras(5) } });
    filas.push({ bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 60, 60], carga: 'total', reps: [10, 9, ultimaSerie] }], logs: { fecha: diaAtras(2) } });
    await route.fulfill({ response: r, json: filas });
  }
);
const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3, reps: 8 }] }));
await page.route((u) => u.pathname.endsWith('/rest/v1/rpc/mis_rutinas'), (route) => route.fulfill({ json: [{ id: '00000000-0000-0000-0000-000000000001', nombre: 'Prueba', activa: true, dias }] }));

async function entrar() {
  await texto(TX.inicio.iniciarEntrenamiento).click({ timeout: 120000 });
  await page.getByLabel(TX.inicio.sumarSerie).first().waitFor({ timeout: 90000 });
  await page.getByText(/^Press de banca/).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
}
const globito = () => page.getByTestId('globito-subir').first().innerText({ timeout: 3000 }).then((t) => t.trim()).catch(() => null);

try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await entrar();
  await page.screenshot({ path: join(SALIDA, 'avisa.png') });
  chequear('dos sesiones con 10 en la última serie y objetivo 8: avisa, con el rango de 2 a 5 %', await globito(), TX.sesion.yaPuedesSubirRango('61,5 kg', '63 kg', 2, 5));

  // La última sesión terminó con 9: no llega a 8 + 2. Se vuelve a entrar con el historial nuevo.
  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await texto(TX.sesion.terminar).click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  ultimaSerie = 9;
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pasarLaEntradaNativa(page).catch(() => {});
  await entrar();
  chequear('con 9 en la última serie de la sesión anterior, no avisa', await globito(), null);
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
