// LA LISTA DE AMIGOS CON CINCO Y UNA FLECHITA (20/10): se ven cinco, la flechita la abre
// entera y la vuelve a cerrar.
//
// En la vista web de la nativa (:8090), con seis cuentas descartables: una entra y las
// otras cinco son sus amigas (la lista son las seis). En Social tienen que verse cinco
// filas; la flechita muestra las seis y otra vez cinco.
//
//   node --env-file=.env.local supabase/probar-lista-de-amigos.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(7);

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas', 'lista-de-amigos');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const cuentas = [];
async function cuenta(n) {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const correo = `agusconde20+ascent-lam${n}-${sello}@gmail.com`;
  const clave = `La-${sello}-Kp3`;
  const { error } = await s.auth.signUp({ email: correo, password: clave });
  if (error) throw new Error('alta: ' + error.message);
  const id = (await s.auth.getUser()).data.user.id;
  await s.from('profiles').update({ username: `lam${n}_${sello.slice(-5)}` }).eq('id', id);
  const c = { s, id, correo, clave };
  cuentas.push(c);
  return c;
}

console.log('La lista de amigos: cinco y la flechita');
const nav = await chromium.launch();
try {
  const yo = await cuenta(0);
  for (let n = 1; n <= 5; n++) {
    const otra = await cuenta(n);
    const { data: pedido, error: e1 } = await otra.s.from('friendships').insert({ solicitante: otra.id, destinatario: yo.id }).select('id').single();
    if (e1) throw new Error('pedido: ' + e1.message);
    const { error: e2 } = await yo.s.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id);
    if (e2) throw new Error('aceptar: ' + e2.message);
  }
  const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(yo.correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(yo.clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().waitFor({ timeout: 120000 });
  await page.getByText('Social', { exact: true }).last().click({ timeout: 30000 });
  await page.getByTestId('ranking-fila').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  const filas = () => page.getByTestId('ranking-fila').count();
  chequear('con seis en la lista, se ven cinco', await filas(), 5);
  await page.getByTestId('ranking-ver-mas').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(SALIDA, 'cerrada.png') });
  await page.getByTestId('ranking-ver-mas').first().click();
  await page.waitForTimeout(800);
  chequear('la flechita la abre entera', await filas(), 6);
  await page.screenshot({ path: join(SALIDA, 'abierta.png') });
  await page.getByTestId('ranking-ver-mas').first().click();
  await page.waitForTimeout(800);
  chequear('y la vuelve a cerrar', await filas(), 5);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
}
await nav.close();

for (const c of cuentas.reverse()) {
  const { error } = await borrarCuentaDePrueba(c.s);
  if (error) {
    fallos++;
    console.log('  FALLA cuenta sin borrar: ' + error.message);
  }
}
console.log(`  ${fallos ? '--  ' : 'ok  '} ${cuentas.length} cuentas borradas`);
process.exit(fallos ? 1 : 0);
