// LA LISTA DE EJERCICIOS EN TU PERFIL (20/10): la rutina de tu perfil salía con todos los
// días cerrados —solo «Lunes — Pecho y pierna»— y los ejercicios aparecían recién al tocar un
// día. En el perfil de un amigo ya salían todos abiertos.
//
// En la vista web de la nativa (:8090), con una cuenta descartable y una rutina guardada de
// lunes y martes: al abrir el perfil, sin tocar nada, tienen que verse los ejercicios.
//
//   node --env-file=.env.local supabase/probar-rutina-en-perfil.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(6);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'rutina-en-perfil');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-rper-${sello}@gmail.com`;
const clave = `Rp-${sello}-Kp3`;
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
await s.from('profiles').update({ username: `rpe_${sello.slice(-6)}` }).eq('id', uid);
const dias = Array.from({ length: 7 }, () => ({ descanso: false, ejercicios: [] }));
dias[1] = { descanso: false, ejercicios: [{ ejercicio: 'press_banca', series: 4 }, { ejercicio: 'sentadilla', series: 3 }] };
dias[2] = { descanso: false, ejercicios: [{ ejercicio: 'remo_barra', series: 3 }] };
const { error: eRutina } = await s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Entrenamiento 1', p_dias: dias });
if (eRutina) console.log('  --   no se guardó la rutina: ' + eRutina.message);

console.log('La rutina de tu perfil muestra sus ejercicios al abrir');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().waitFor({ timeout: 120000 });
  await page.goto('http://localhost:8090/yo', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('mi-rutina-en-perfil').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  const texto = (await page.getByTestId('mi-rutina-en-perfil').first().innerText()).replace(/\n+/g, ' | ');
  await page.getByTestId('mi-rutina-en-perfil').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, 'perfil.png') });
  chequear('sin tocar nada, los ejercicios del lunes y del martes', ['Press de banca', 'Sentadilla', 'Remo con barra'].filter((n) => texto.includes(n)), ['Press de banca', 'Sentadilla', 'Remo con barra']);
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
