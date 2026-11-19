// VINCULAR DESDE MOSS (18/11): Moss crea un código de un uso (`moss.crear_codigo_de_vinculo`) y abre
// `/vincular/<código>`; Ascent abre Moss en Stats con «Vincular», que lo canjea contra la base real
// (`moss.vincular_con_codigo`) y queda «Vinculada con Moss». El mismo código otra vez ya no sirve, y
// «Desvincular» lo deshace. La cuenta de Moss es otra cuenta descartable: son usuarios del mismo proyecto.
//
// En la vista web de la nativa (:8090): la ruta es la misma que la del enlace universal.
//
//   node --env-file=.env.local supabase/probar-vincular-moss.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);
const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'vincular-moss');
mkdirSync(SALIDA, { recursive: true });
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};
const nuevo = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const s = nuevo();
const m = nuevo();
const correo = `agusconde20+ascent-vm-${sello}@gmail.com`;
const clave = `Vm-${sello}-Kp3`;
const correoMoss = `agusconde20+moss-vm-${sello}@gmail.com`;
const claveMoss = `Mv-${sello}-Kp3`;
const { error: eA } = await s.auth.signUp({ email: correo, password: clave });
const { error: eM } = await m.auth.signUp({ email: correoMoss, password: claveMoss });
if (eA || eM) {
  console.log('No se pudieron crear las cuentas:', eA?.message, eM?.message);
  process.exit(1);
}
const uid = (await s.auth.getUser()).data.user.id;
await s.from('profiles').update({ username: `vm_${sello.slice(-6)}` }).eq('id', uid);
const vinculada = async () => (await s.schema('moss').rpc('estado_del_vinculo')).data?.vinculada ?? null;

console.log('Vincular desde Moss: ascent://vincular');
const nav = await chromium.launch();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
const texto = (t) => page.getByText(t, { exact: true }).last();
const visible = (id) => page.getByTestId(id).filter({ visible: true }).first();
// El rótulo también está en el cielo que asoma detrás: el de la pantalla de Moss es el que cuenta.
const rotulo = () => page.getByTestId('pantalla-de-moss').getByTestId('moss-rotulo').first().innerText();
try {
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.evaluate(([u]) => localStorage.setItem(`ascent:guia:${u}`, JSON.stringify({ uid: u, recorrido: true, paso: 0, globos: ['elegir', 'series', 'descanso', 'peso', 'terminar', 'carga', 'sugerido', 'mas', 'grupo', 'stats'] })), [uid]);
  // El tutorial de la sección ya visto: lo prueba probar-seccion-moss.
  await page.evaluate(() => localStorage.setItem('ascent:moss-tutorial-visto', '1'));
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(clave);
  await texto('Entrar').click({ timeout: 60000 });
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().waitFor({ timeout: 180000 });

  // Lo que hace Moss: crear el código y abrir el enlace.
  const { data: codigo, error: eCodigo } = await m.schema('moss').rpc('crear_codigo_de_vinculo');
  chequear('Moss crea el código', [!eCodigo, typeof codigo === 'string' && /^[A-Za-z0-9_-]{43}$/.test(codigo)], [true, true]);
  await page.goto(`http://localhost:8090/vincular/${codigo}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await visible('moss-vincular-codigo').waitFor({ timeout: 120000 });
  await page.waitForTimeout(1200);
  chequear('abre Moss en Stats, con «Vincular» y lo que pide Moss', [await visible('pantalla-de-moss').count(), (await rotulo()).trim().toLowerCase(), await page.getByText(TX.moss.mossQuiere, { exact: true }).filter({ visible: true }).count()], [1, TX.moss.vinculaTitulo.toLowerCase(), 1]);
  await page.screenshot({ path: join(SALIDA, '1-moss-quiere.png') });

  await visible('moss-vincular-codigo').click();
  await visible('moss-desvincular').waitFor({ timeout: 30000 }).catch(() => {});
  // Vinculada, la pantalla pasa a la sección de Moss (sin entrenamientos: tus músculos lo dice).
  await visible('moss-vinculada').waitFor({ timeout: 30000 }).catch(() => {});
  chequear('«Vincular» canjea el código: vinculada en la base, y la pantalla muestra lo de Moss', [await vinculada(), await visible('moss-vinculada').count(), await page.getByText(TX.moss.sec.tus.sinDatos, { exact: true }).filter({ visible: true }).count()], [true, 1, 1]);
  await page.screenshot({ path: join(SALIDA, '2-vinculada.png') });

  await visible('moss-desvincular').click();
  await page.waitForTimeout(2500);
  chequear('«Desvincular» lo deshace, en la base también', [await vinculada(), await visible('moss-vincular').count()], [false, 1]);

  // El mismo enlace otra vez: el código ya se usó.
  await page.goto(`http://localhost:8090/vincular/${codigo}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await visible('moss-vincular-codigo').waitFor({ timeout: 120000 });
  await visible('moss-vincular-codigo').click();
  await page.getByText(TX.moss.codigoViejo, { exact: true }).first().waitFor({ timeout: 20000 }).catch(() => {});
  chequear('el mismo código otra vez no vincula, y lo dice', [await page.getByText(TX.moss.codigoViejo, { exact: true }).count() > 0, await vinculada()], [true, false]);
  chequear('sin errores de la página', errores, []);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
  await page.screenshot({ path: join(SALIDA, 'error.png') }).catch(() => {});
}
await nav.close();
const { error: eBorrar } = await borrarCuentaDePrueba(s);
const { error: eBorrarM } = await borrarCuentaDePrueba(m);
console.log(`  ${eBorrar || eBorrarM ? 'FALLA' : 'ok  '} cuentas borradas`);
if (eBorrar || eBorrarM) fallos++;
process.exit(fallos ? 1 : 0);
