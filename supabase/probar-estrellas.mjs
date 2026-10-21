// LAS VIDAS SON ESTRELLAS (21/10, aprobado en la galería): en Inicio, arriba de los días, la
// que queda llena y la usada en contorno; en el aviso de la vida, las vidas arriba, la estrella
// arriba del cuadro y la estrella dentro de «Usar vida»; y en Estadísticas, la misma estrella.
//
// En la vista web de la nativa (:8090), con una cuenta descartable. Una cuenta nueva no tiene
// vidas usadas, así que la de ayer se inyecta en la respuesta de `pantalla_inicio`, como la
// sesión de ayer en probar-ultima-vez. Se mira el DOM: cada estrella es el mismo dibujo
// (`Estrella.tsx`, el trazo que empieza en M0,-48) y la usada no tiene relleno.
//
//   node --env-file=.env.local supabase/probar-estrellas.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'estrellas');
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
const ayer = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - 86400000));

console.log('Las vidas, como estrellas');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const texto = (t) => page.getByText(t, { exact: true }).last();
// Una vida usada ayer: de las que tiene la cuenta, queda una menos.
let total = null;
await page.route(
  (u) => u.pathname.endsWith('/rest/v1/rpc/pantalla_inicio'),
  async (route) => {
    const r = await route.fetch();
    const d = await r.json().catch(() => null);
    if (d?.impulsos) {
      total = Number(d.impulsos.total ?? 0);
      d.impulsos = { ...d.impulsos, ultimas: [ayer], vigentes: [ayer], quedan: Math.max(0, total - 1) };
    }
    await route.fulfill({ response: r, json: d });
  }
);
// Estadísticas las pide aparte (`mis_impulsos`): la misma vida usada.
await page.route(
  (u) => u.pathname.endsWith('/rest/v1/rpc/mis_impulsos'),
  async (route) => {
    const r = await route.fetch();
    const d = await r.json().catch(() => null);
    if (d && d.total !== undefined) d.quedan = Math.max(0, Number(d.total) - 1);
    await route.fulfill({ response: r, json: d });
  }
);
const ESTRELLA = 'path[d^="M0,-48"]';
const estrellas = async (id) => {
  const zona = page.getByTestId(id).first();
  return [await zona.locator(ESTRELLA).count(), await zona.locator(`${ESTRELLA}[fill="none"]`).count()];
};
const y = async (id) => (await page.getByTestId(id).first().boundingBox())?.y ?? -1;

try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });

  // EL AVISO.
  await page.getByTestId('vida-cuadro').first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(SALIDA, 'aviso.png') });
  chequear('la cuenta tiene vidas', total > 0, true);
  chequear('en el aviso, arriba, una estrella por vida: llenas las que quedan y en contorno la usada', await estrellas('aviso-vidas'), [total, 0]);
  chequear('las estrellas de las vidas van arriba del cuadro', (await y('aviso-vidas')) < (await y('vida-cuadro')), true);
  chequear('el cuadro tiene su estrella arriba', [await estrellas('vida-emblema'), (await y('vida-emblema')) <= (await y('vida-cuadro'))], [[1, 0], true]);
  chequear('y «Usar vida» tiene la estrella adentro', await estrellas('vida-usar'), [1, 0]);

  // Se usa y se cierra: Inicio.
  await page.getByTestId('vida-usar').first().click({ timeout: 30000 });
  await page.getByTestId('vida-listo').first().click({ timeout: 30000 });
  await page.getByTestId('vidas-inicio').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SALIDA, 'inicio.png') });

  // INICIO.
  chequear('en Inicio, una estrella por vida: la que queda llena, la usada en contorno', await estrellas('vidas-inicio'), [total, 1]);
  chequear('y van arriba de los días', (await y('vidas-inicio')) < (await y('tira-inicio')), true);

  // ESTADÍSTICAS.
  await texto('Stats').click({ timeout: 30000 });
  await page.getByTestId('vidas-stats').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(SALIDA, 'estadisticas.png') });
  chequear('en Estadísticas, la misma estrella: la que queda llena, la usada en contorno', await estrellas('vidas-stats'), [total, 1]);
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
