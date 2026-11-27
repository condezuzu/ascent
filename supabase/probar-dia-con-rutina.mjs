// «REGISTRAR EL DÍA» SE LLEVA LO DEL ÚLTIMO ENTRENAMIENTO DE ESA RUTINA (26/11, migración 103). Una cuenta nueva con
// una rutina de press y fondos todos los días registra solo el día, desde la hoja de Inicio, sin entrenar con la app.
// La base tiene que quedar con una sesión de hoy, terminada y `copiada`, con lo de la última de press y fondos.
//
// Vista web de la nativa (:8090). Las sesiones de antes se agregan a la respuesta de la base, como en probar-reps: las
// sesiones solo se escriben con la fecha de hoy. Lo que se anota sí va a la base real.
//
//   node --env-file=.env.local supabase/probar-dia-con-rutina.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'dia-con-rutina');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-dr-${sello}@gmail.com`;
const clave = `Dr-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `dr_${sello.slice(-6)}` }).eq('id', uid);
const cadaDia = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 3 }, { ejercicio: 'fondos', series: 2 }] };
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Pecho', p_dias: Array.from({ length: 7 }, () => cadaDia) });

const diaAtras = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date(Date.now() - n * 86400000));
const haceDias = (n, min = 0) => new Date(Date.now() - n * 86400000 + min * 60000).toISOString();
console.log('Registrar el día, con lo de la rutina');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
// Hace 5 días, press y fondos (la de esa rutina); hace 2, sentadilla (otra).
await page.route(
  (u) => u.pathname.endsWith('/rest/v1/sesiones') && decodeURIComponent(u.search).includes('logs!inner'),
  async (route) => {
    const r = await route.fetch();
    const filas = await r.json().catch(() => []);
    filas.push(
      { bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 60, 60], carga: 'total', reps: [10, 9, 8] }, { ejercicio: 'fondos', series: 2 }], estado: 'terminada', inicio: haceDias(5), fin: haceDias(5, 50), copiada: false, logs: { fecha: diaAtras(5) } },
      { bloques: [{ ejercicio: 'sentadilla', series: 4, pesos: [100, 100, 100, 100], carga: 'total' }], estado: 'terminada', inicio: haceDias(2), fin: haceDias(2, 40), copiada: false, logs: { fecha: diaAtras(2) } },
    );
    await route.fulfill({ response: r, json: filas });
  }
);

try {
  chequear('la rutina se guardó en la base real', eRutina?.message ?? null, null);
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.getByText('Registra tu primer día', { exact: true }).first().click({ timeout: 120000 });
  await page.getByTestId('registrar-confirmar').first().waitFor({ timeout: 30000 });
  await page.getByTestId('registrar-confirmar').first().click();
  await page.getByTestId('registrar-confirmar').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  // Se pide sin esperarla: se le da tiempo.
  let sesiones = [];
  for (let i = 0; i < 20 && !sesiones.length; i++) {
    await page.waitForTimeout(1000);
    sesiones = (await s.from('sesiones').select('estado, copiada, series, bloques, inicio, fin, logs(fecha)').eq('user_id', uid)).data ?? [];
  }
  await page.screenshot({ path: join(SALIDA, 'despues.png') });
  const x = sesiones[0];
  chequear('la base: el día de hoy con una sesión terminada y copiada, con lo de la última de press y fondos (no la de sentadilla)', [
    sesiones.length, x?.estado, x?.copiada, x?.series, (x?.bloques ?? []).map((b) => [b.ejercicio, b.series, b.pesos ?? null, b.reps ?? null]),
    (Array.isArray(x?.logs) ? x.logs[0] : x?.logs)?.fecha === diaAtras(0), x ? Math.round((Date.parse(x.fin) - Date.parse(x.inicio)) / 60000) : null,
  ], [1, 'terminada', true, 5, [['press_banca', 3, [60, 60, 60], [10, 9, 8]], ['fondos', 2, null, null]], true, 50]);
  chequear('sin errores de la página', errores, []);
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
