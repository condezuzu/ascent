// LO DE MOSS EN ASCENT, VINCULADA (19/11). Las funciones de Moss (migración 0015 de Moss) todavía no
// están en la base: acá son un doble en el navegador con el contrato propuesto, y también el estado del
// vínculo. Lo real: la cuenta, la app y el dibujo. Mira que estén los bloques en el orden de Moss, que
// se llegue abajo y que «qué esperar» diga lo de Moss.
//
//   node --env-file=.env.local supabase/probar-moss-en-ascent.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);
const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'moss-en-ascent');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const correo = `agusconde20+ascent-ma-${sello}@gmail.com`;
const clave = `Ma-${sello}-Kp3`;
const { error: eAlta } = await s.auth.signUp({ email: correo, password: clave });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `ma_${sello.slice(-6)}` }).eq('id', uid);

const hoy = new Date();
const iso = (h, m) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), h, m).toISOString();
const MOSS = {
  estado_del_vinculo: { vinculada: true, nombre: 'Agus', desde: '2026-11-18' },
  moss_hoy: { fecha: '2026-11-19', sin_deficit: false, noche: { dormido: 412, necesidad: 480, cara: 4, deuda: 290, deuda_palabra: 'baja' }, energia: null, comida: { total: { kcal: 1450, proteina: 30, carbohidratos: 160, grasas: 48 }, meta: { kcal: 2300, proteina: 150, carbohidratos: 250, grasas: 70 }, comidas: [{ momento: iso(Math.max(0, hoy.getHours() - 5), 0), comida: 'almuerzo', proteina: 30, carbohidratos: 160, grasas: 48 }] } },
  moss_semanas: [{ lunes: '2026-11-10', noches: 6, dormido: 431, dias_con_comida: 5, proteina_g_kg: 1.4, balance: -420, peso: 78.6 }, { lunes: '2026-11-17', noches: 2, dormido: 405, dias_con_comida: 2, proteina_g_kg: 1.5, balance: -250, peso: 78.4 }],
  moss_objetivo: { objetivo: 'bajar', ritmo: 'recomendado', peso_meta: 75, peso: 78.4, desde: '2026-10-01', sin_deficit: false },
  moss_anio: { dias_con_comida: 210, dias_completos: 140, noches: 190, dormido: 428, peso_inicio: 82.1, peso_hoy: 78.4 },
};

console.log('Lo de Moss en Ascent, vinculada');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
await page.route(
  (u) => Object.keys(MOSS).some((n) => u.pathname.endsWith(`/rest/v1/rpc/${n}`)),
  (route) => route.fulfill({ json: MOSS[new URL(route.request().url()).pathname.split('/').pop()] })
);
const texto = (t) => page.getByText(t, { exact: true }).last();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas', 'grupo', 'stats'] })), [uid]);
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().waitFor({ timeout: 180000 });
  await texto('Stats').click({ timeout: 30000 });
  await page.getByTestId('entrada-a-moss').first().click({ timeout: 60000 });
  const lista = page.getByTestId('moss-vinculada').first();
  await lista.waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SALIDA, '1-se-llega-abajo.png') });
  const orden = await lista.evaluate((n) => [...n.querySelectorAll('div')].map((d) => d.childNodes.length === 1 && d.firstChild.nodeType === 3 ? d.textContent : null).filter(Boolean));
  const pos = (t) => orden.indexOf(t);
  chequear('los bloques en el orden de Moss: año, objetivo, semana, hoy y la noche abajo', [TX.moss.tuAnio, TX.moss.tuObjetivo, TX.moss.estaSemana, TX.moss.antesDeEntrenar, TX.moss.tuNoche].map(pos).every((p, i, a) => p >= 0 && (i === 0 || p > a[i - 1])), true);
  chequear('se llega abajo: la noche a la vista', await page.getByText(TX.moss.tuNoche, { exact: true }).first().isVisible(), true);
  chequear('qué esperar: lo de Moss (5 h sin comer y poca proteína)', [await page.getByTestId('moss-esperar-sinComer').count(), await page.getByTestId('moss-esperar-pocaProteina').count()], [1, 1]);
  chequear('sin el logo grande detrás de los datos', await page.getByTestId('moss-rotulo').filter({ visible: true }).count(), 1);
  await lista.evaluate((n) => n.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SALIDA, '2-arriba.png') });
  chequear('sin errores de la página', errores, []);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
  await page.screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();
const { error: eBorrar } = await borrarCuentaDePrueba(s);
console.log(`  ${eBorrar ? 'FALLA' : 'ok  '} cuenta borrada`);
if (eBorrar) fallos++;
process.exit(fallos ? 1 : 0);
