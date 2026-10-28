// LA BURBUJA DE UN AMIGO QUE ENTRENA (29/10, como quedó en la galería). Tocarla en Inicio ya no
// lleva a su perfil: abre un globo encima. Si entrena sin grupo, «no está en un grupo» e «Invitar
// a un grupo»; si entrena con otros, «está en un grupo de N personas», las caras y «Unirse al
// entrenamiento».
//
// Contra la base real, con cuatro cuentas descartables: A mira; B entrena sola; C y D entrenan en
// grupo (C invitó a D por la API y D aceptó). A es amiga de B y de C, no de D. En la vista web de la
// nativa (:8090), a 390×844: el globo de C dice 2 personas con las dos caras, y «Unirse» le deja a C
// el pedido de A; el de B dice que no está en un grupo, e «Invitar» pone a A a entrenar y le deja a
// B la invitación, que al aceptarla la mete en el grupo de A.
//
//   node --env-file=.env.local supabase/probar-burbuja-amigo.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { pasarLaEntradaNativa, borrarCuentaDePrueba, limiteDeSonda } from './utiles.mjs';

limiteDeSonda(8);

const AQUI = dirname(fileURLToPath(import.meta.url));
const { TEXTOS_ES: TX } = await import(pathToFileURL(join(AQUI, '..', 'nucleo', 'textos.ts')).href);
const SALIDA = join(AQUI, '..', 'capturas', 'burbuja-amigo');
mkdirSync(SALIDA, { recursive: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sello = Date.now().toString(36);
let fallos = 0;
const chequear = (que, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos++;
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : `: esperado ${JSON.stringify(esperado)}, obtuve ${JSON.stringify(real)}`}`);
};

const { data: version } = await createClient(url, anon, { auth: { persistSession: false } }).rpc('version_del_esquema');
if (!(version >= 98)) {
  console.log(`  --   la base está en ${version}: sin la migración 98 no hay globo que probar`);
  process.exit(0);
}

async function cuenta(letra) {
  const s = createClient(url, anon, { auth: { persistSession: false } });
  const correo = `agusconde20+ascent-ba-${letra}-${sello}@gmail.com`;
  const clave = `Ba-${sello}-${letra}9`;
  const { error } = await s.auth.signUp({ email: correo, password: clave });
  if (error) throw new Error(`alta ${letra}: ${error.message}`);
  const id = (await s.auth.getUser()).data.user.id;
  const nombre = `ba_${letra}${sello.slice(-5)}`;
  await s.from('profiles').update({ username: nombre }).eq('id', id);
  return { s, id, correo, clave, nombre };
}
async function amigos(x, y) {
  const { data } = await x.s.from('friendships').insert({ solicitante: x.id, destinatario: y.id }).select('id').single();
  await y.s.from('friendships').update({ estado: 'aceptada' }).eq('id', data.id);
}
const uniones = async (x) => (await x.s.rpc('mis_uniones')).data ?? [];

const A = await cuenta('a');
const B = await cuenta('b');
const C = await cuenta('c');
const D = await cuenta('d');
const nav = await chromium.launch();
try {
  await amigos(A, B);
  await amigos(A, C);
  await amigos(C, D);
  for (const x of [B, C, D]) await x.s.rpc('iniciar_sesion');
  chequear('por la API: C invita a D, y D acepta', (await C.s.rpc('invitar_al_grupo', { p_a: D.id })).data, 'ok');
  await D.s.rpc('responder_union', { p_id: (await uniones(D))[0]?.id, p_acepta: true });
  chequear('C y D quedan en un grupo', (await uniones(D)).map((u) => [u.estado, u.otro.id]), [['aceptada', C.id]]);

  const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-UY', timezoneId: 'America/Montevideo' })).newPage();
  await page.goto('http://localhost:8090', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(A.correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(A.clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  const burbuja = (x) => page.getByTestId('burbuja-amigo').filter({ hasText: x.nombre }).first();
  await burbuja(C).waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  const globo = page.getByTestId('globo-amigo');

  console.log('Tocar a C, que entrena en grupo');
  await burbuja(C).click();
  await page.getByTestId('globo-amigo-dato').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SALIDA, 'en-grupo.png') });
  chequear('se abre el globo encima, sin ir al perfil: «está en un grupo de 2 personas», las dos caras y «Unirse al entrenamiento»', [
    await globo.count(),
    await page.getByTestId('globo-amigo-dato').first().innerText(),
    await page.getByTestId('globo-amigo-miembro').count(),
    await page.getByTestId('globo-amigo-boton').first().innerText(),
  ], [1, TX.social.estaEnGrupoDe(2), 2, TX.social.unirseAlEntrenamiento]);
  await page.getByTestId('globo-amigo-boton').first().click();
  await page.getByTestId('globo-amigo-dijo').first().waitFor({ timeout: 30000 });
  chequear('«Unirse» le deja a C el pedido de A', [
    await page.getByTestId('globo-amigo-dijo').first().innerText(),
    (await uniones(C)).filter((u) => u.estado === 'pendiente').map((u) => [u.tipo, u.otro.id, u.la_pedi_yo]),
  ], [TX.social.pedidoEnviado, [['union', A.id, false]]]);
  await globo.first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  chequear('y el globo se va solo', await globo.count(), 0);
  await A.s.rpc('salir_de_union', { p_otro: C.id });

  console.log('Tocar a B, que entrena sola');
  await burbuja(B).click();
  await page.getByTestId('globo-amigo-dato').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SALIDA, 'sin-grupo.png') });
  chequear('«no está en un grupo», sin caras, e «Invitar a un grupo»', [
    await page.getByTestId('globo-amigo-dato').first().innerText(),
    await page.getByTestId('globo-amigo-miembro').count(),
    await page.getByTestId('globo-amigo-boton').first().innerText(),
  ], [TX.social.noEstaEnGrupo, 0, TX.social.invitarAGrupo]);
  await page.getByTestId('globo-amigo-boton').first().click();
  await page.getByTestId('globo-amigo-dijo').first().waitFor({ timeout: 30000 });
  await page.screenshot({ path: join(SALIDA, 'invitacion-enviada.png') });
  const deB = (await uniones(B)).filter((u) => u.estado === 'pendiente');
  chequear('«Invitar» pone a A a entrenar y le deja a B la invitación', [
    await page.getByTestId('globo-amigo-dijo').first().innerText(),
    (await A.s.from('sesiones').select('estado').eq('user_id', A.id).eq('estado', 'corriendo')).data?.length,
    deB.map((u) => [u.tipo, u.otro.id, u.la_pedi_yo]),
  ], [TX.social.invitacionEnviada, 1, [['invitacion', A.id, false]]]);
  await B.s.rpc('responder_union', { p_id: deB[0]?.id, p_acepta: true });
  chequear('B acepta y entra al grupo de A, que es quien lo armó', (await uniones(B)).map((u) => [u.estado, u.otro.id, u.lider]), [['aceptada', A.id, true]]);
} catch (e) {
  fallos++;
  console.log('  FALLA ' + String(e).split('\n')[0].slice(0, 200));
}
await nav.close();

for (const x of [A, B, C, D]) {
  await x.s.rpc('terminar_sesion').then(() => x.s.rpc('dejar_de_entrenar'), () => {});
  const { error } = await borrarCuentaDePrueba(x.s);
  if (error) {
    fallos++;
    console.log(`  FALLA cuenta ${x.nombre}: ${error.message}`);
  }
}
console.log(`  ${fallos ? '' : 'ok   '}cuentas borradas`);
process.exit(fallos ? 1 : 0);
