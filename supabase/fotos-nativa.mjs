// FOTOS DE LA APP NATIVA, con datos de muestra (14/10/2026).
//
// `npm run capturas` saca la web; la gente usa la nativa. Esto abre la nativa en
// el navegador (Expo web, :8090) con una cuenta descartable, recorre una pantalla
// y saca la foto. ES UN SUSTITUTO DEL TELÉFONO: el mismo código dibujado por
// react-native-web, no el iPhone. Las tipografías y los márgenes se parecen; el
// teclado, la barra de estado y el tamaño exacto del texto, no.
//
// LOS DATOS: lo que una cuenta recién creada no tiene (una semana de rutina, una
// migración que todavía no se pegó) se le contesta desde acá, interceptando el
// pedido a la base (`page.route`). Así se puede ver una pantalla ANTES de
// aplicar su migración. Lo interceptado se dice en la consola.
//
//   node --env-file=.env.local supabase/fotos-nativa.mjs [receta ...]
//
// Sin recetas, saca todas. Deja los PNG en `capturas-nativa/`. Borra las cuentas al final.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limiteDeSonda, pasarLaEntradaNativa } from './utiles.mjs';

limiteDeSonda(12);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const NATIVA = process.env.NATIVA_URL ?? 'http://localhost:8090';
// Afuera de `capturas/`: `npm run capturas` borra esa carpeta entera.
const CARPETA = join(dirname(fileURLToPath(import.meta.url)), '..', 'capturas-nativa');
mkdirSync(CARPETA, { recursive: true });
const sello = String(Date.now()).slice(-7);

async function cuenta(letra) {
  const s = createClient(url, anon, { auth: { persistSession: false } });
  const correo = `agusconde20+ascent-foto-${letra}-${sello}@gmail.com`;
  const clave = `Fo-${sello}-${letra}9`;
  const { error } = await s.auth.signUp({ email: correo, password: clave });
  if (error) throw new Error(`alta ${letra}: ${error.message}`);
  const id = (await s.auth.getUser()).data.user.id;
  const nombre = `foto_${letra}${sello.slice(-4)}`;
  await s.from('profiles').update({ username: nombre }).eq('id', id);
  return { s, id, correo, clave, nombre };
}

// UNA SEMANA DE MUESTRA con ejercicios de verdad del catálogo (los ids cambian poco, pero se buscan).
async function semanaDeMuestra(s) {
  const { data } = await s.from('ejercicios').select('id, grupo, orden').order('orden');
  const de = (g, n = 1) => (data ?? []).filter((e) => e.grupo === g).slice(0, n).map((e) => e.id);
  const ej = (ids, series = 4) => ids.map((ejercicio) => ({ ejercicio, series }));
  const vacio = { descanso: false, ejercicios: [] };
  const dias = Array.from({ length: 7 }, () => vacio);
  dias[1] = { descanso: false, ejercicios: ej([...de('pecho', 2), ...de('hombros', 1), ...de('brazos', 2)]) };
  dias[2] = { descanso: false, ejercicios: ej([...de('espalda', 3), ...de('brazos', 1)], 3) };
  dias[3] = { descanso: true, ejercicios: [] };
  dias[4] = { descanso: false, ejercicios: ej([...de('piernas', 4), ...de('core', 1)]) };
  dias[5] = { descanso: false, ejercicios: ej([...de('pecho', 1), ...de('espalda', 1), ...de('hombros', 1)], 3) };
  dias[0] = { descanso: true, ejercicios: [] };
  return dias;
}

async function abrir(nav, quien, respuestas) {
  const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
  for (const [rpc, cuerpo] of Object.entries(respuestas ?? {})) {
    await page.route(`**/rest/v1/rpc/${rpc}*`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) }));
    console.log(`  (muestra) ${rpc}`);
  }
  await page.goto(NATIVA, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await pasarLaEntradaNativa(page);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(quien.correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(quien.clave);
  await page.getByText('Entrar', { exact: true }).last().click({ timeout: 60000 });
  const saltar = page.getByTestId('recorrido-saltar');
  await saltar.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  await saltar.click().catch(() => {});
  // El aviso de una vez de la cuenta nueva tapa la mitad de abajo: se cierra.
  const deAcuerdo = page.getByText('De acuerdo', { exact: true }).first();
  await deAcuerdo.waitFor({ state: 'visible', timeout: 8000 }).then(() => deAcuerdo.click(), () => {});
  await page.waitForTimeout(800);
  return { page, errores };
}

const foto = async (page, nombre) => {
  const ruta = join(CARPETA, `${nombre}.png`);
  await page.screenshot({ path: ruta });
  console.log(`  foto: capturas-nativa/${nombre}.png`);
};
const tocar = (page, testID) => page.getByTestId(testID).first().click({ timeout: 20000 });
const verTestId = (page, testID) => page.getByTestId(testID).first().scrollIntoViewIfNeeded({ timeout: 30000 });

async function irAStatsEntrenamiento(page) {
  await page.getByText('Stats', { exact: true }).last().click({ timeout: 30000 });
  await page.getByText('Entrenamiento', { exact: true }).first().click({ timeout: 30000 });
  await page.waitForTimeout(1500);
}

// EL CATÁLOGO DE LA MIGRACIÓN 76 antes de pegarla: el de la base, más el cardio y un propio.
const CARDIO_76 = [
  ['cinta', 'Cinta'], ['correr', 'Correr'], ['caminar', 'Caminar'], ['bicicleta_fija', 'Bicicleta fija'], ['eliptica', 'Elíptica'],
  ['remo_ergometro', 'Remo ergómetro'], ['escaladora', 'Escaladora'], ['soga', 'Saltar la soga'], ['natacion', 'Natación'],
].map(([id, nombre], i) => ({ id, nombre, grupo: 'cardio', cuenta_dots: false, admite_peso: false, orden: 900 + i, carga: 'total', mide: 'tiempo', creado_por: null }));
async function conCatalogo76(page, propios = []) {
  await page.route('**/rest/v1/ejercicios*', async (r) => {
    const real = await r.fetch();
    const filas = await real.json().catch(() => null);
    if (!Array.isArray(filas)) return r.fulfill({ response: real });
    const mas = [...CARDIO_76, ...propios].filter((x) => !filas.some((f) => f.id === x.id));
    r.fulfill({ response: real, body: JSON.stringify([...filas.map((f) => ({ mide: 'series', ...f })), ...mas]) });
  });
  console.log('  (muestra) catálogo con cardio y propios');
}
async function sesionConSelector(page) {
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().click({ timeout: 90000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.getByText('Cualquier cosa', { exact: true }).first().click({ timeout: 60000 });
  await page.waitForTimeout(1200);
}

// ── LAS RECETAS ──
const RECETAS = {
  async 'ejercicios-buscar'(nav, gente) {
    const A = gente.a;
    const propio = { id: 'propio_000000000001', nombre: 'Hip thrust en máquina', grupo: 'piernas', cuenta_dots: false, admite_peso: true, orden: 9000, carga: 'total', mide: 'series', creado_por: A.id };
    const { page } = await abrir(nav, A, { version_del_esquema: 76, crear_ejercicio: 'propio_000000000002' });
    await conCatalogo76(page, [propio]);
    await sesionConSelector(page);
    await foto(page, 'ejercicios-selector');
    await page.getByTestId('buscar-ejercicio').first().fill('press');
    await page.waitForTimeout(600);
    await foto(page, 'ejercicios-buscar-press');
    await page.getByTestId('buscar-ejercicio').first().fill('hip');
    await page.waitForTimeout(600);
    await foto(page, 'ejercicios-buscar-propio');
    await page.getByTestId('buscar-ejercicio').first().fill('empuje de trineo');
    await page.waitForTimeout(600);
    await foto(page, 'ejercicios-buscar-nada');
    await page.getByText('+ Agregar «empuje de trineo»', { exact: true }).first().click({ timeout: 20000 });
    await page.waitForTimeout(400);
    await page.getByText('Piernas', { exact: true }).last().click({ timeout: 20000 });
    await page.waitForTimeout(400);
    await foto(page, 'ejercicios-crear');
    return page;
  },
  async cartel(nav, gente) {
    // Datos de verdad: A le manda solicitud a B, y B abre la app.
    const { a: A, b: B } = gente;
    const { error: eAmistad } = await A.s.from('friendships').insert({ solicitante: A.id, destinatario: B.id });
    if (eAmistad) console.log('  no se pudo pedir amistad: ' + eAmistad.message);
    const { page, errores } = await abrir(nav, B);
    await page.getByTestId('cartel-de-arriba').first().waitFor({ state: 'visible', timeout: 60000 }).catch(async (e) => {
      await foto(page, 'cartel-fallo');
      console.log('  errores: ' + JSON.stringify(errores));
      throw e;
    });
    await page.waitForTimeout(900);
    await foto(page, 'cartel-amistad');
    await tocar(page, 'cartel-aceptar');
    await page.waitForTimeout(1500);
    await foto(page, 'cartel-aceptado');
    // Ya amigos: B entrena y A pide unirse.
    await B.s.rpc('iniciar_sesion');
    const { data: r } = await A.s.rpc('pedir_unirse', { p_a: B.id });
    console.log(`  pedir_unirse: ${r}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('cartel-de-arriba').first().waitFor({ state: 'visible', timeout: 90000 });
    await page.waitForTimeout(900);
    await foto(page, 'cartel-union');
    return page;
  },
  async 'rutina-cardio'(nav, gente) {
    const A = gente.a;
    const dias = await semanaDeMuestra(A.s);
    dias[2] = { descanso: false, ejercicios: [...dias[2].ejercicios, { ejercicio: 'cinta', series: 0, minutos: 25 }] };
    const rutinas = [{ id: '00000000-0000-4000-8000-000000000003', nombre: 'Entrenamiento 1', activa: true, dias }];
    const { page } = await abrir(nav, A, { version_del_esquema: 76, mis_rutinas: rutinas, rutina_activa_de: rutinas[0] });
    await conCatalogo76(page);
    await irAStatsEntrenamiento(page);
    await verTestId(page, 'mi-rutina');
    await tocar(page, 'rutina-dia-2');
    await page.waitForTimeout(500);
    await foto(page, 'rutina-con-cardio');
    return page;
  },
  async cardio(nav, gente) {
    // La otra cuenta: la de la receta de arriba ya tiene una sesión corriendo.
    const A = gente.b;
    const { page } = await abrir(nav, A, { version_del_esquema: 76 });
    await conCatalogo76(page);
    await sesionConSelector(page);
    await page.getByTestId('buscar-ejercicio').first().fill('cinta');
    await page.waitForTimeout(600);
    await foto(page, 'cardio-buscar');
    await page.getByText('Cinta', { exact: true }).first().click({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await foto(page, 'cardio-bloque');
    await page.getByText('Listo', { exact: true }).first().click({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await foto(page, 'cardio-hecho');
    return page;
  },
  async 'rutina-stats'(nav, gente) {
    const A = gente.a;
    const dias = await semanaDeMuestra(A.s);
    const rutinas = [
      { id: '00000000-0000-4000-8000-000000000001', nombre: 'Entrenamiento 1', activa: true, dias },
      { id: '00000000-0000-4000-8000-000000000002', nombre: 'Entrenamiento 2', activa: false, dias: dias.map((d, i) => (i === 1 ? dias[4] : i === 4 ? dias[1] : d)) },
    ];
    const { page } = await abrir(nav, A, { version_del_esquema: 75, mis_rutinas: rutinas, rutina_activa_de: rutinas[0], guardar_rutina: rutinas[0].id });
    await irAStatsEntrenamiento(page);
    await verTestId(page, 'mi-rutina');
    await foto(page, 'rutina-stats-plegada');
    await tocar(page, 'rutina-dia-1');
    await page.waitForTimeout(500);
    await foto(page, 'rutina-stats-lunes-abierto');
    await tocar(page, 'rutina-editar');
    await page.waitForTimeout(500);
    await verTestId(page, 'rutina-agregar-1');
    await foto(page, 'rutina-stats-editando');
    await page.getByText('Copiar a…', { exact: true }).first().click({ timeout: 20000 });
    await page.waitForTimeout(400);
    await tocar(page, 'rutina-copiar-a-5');
    await page.waitForTimeout(500);
    await page.getByText('Agregar al final', { exact: true }).first().scrollIntoViewIfNeeded({ timeout: 20000 });
    await foto(page, 'rutina-stats-copiar-pregunta');
    return page;
  },
  async 'rutina-deducida'(nav, gente) {
    // Antes de la migración 75: lo que se ve sin rutinas guardadas.
    const A = gente.a;
    const dias = await semanaDeMuestra(A.s);
    const historial = [1, 2, 4, 5].map((d) => ({ fecha: ['2026-10-12', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'][d], bloques: dias[d].ejercicios }));
    const { page } = await abrir(nav, A, { version_del_esquema: 74, rutina_de_amigo: historial });
    await irAStatsEntrenamiento(page);
    await verTestId(page, 'mi-rutina');
    await foto(page, 'rutina-stats-deducida');
    return page;
  },
  async 'rutina-perfil'(nav, gente) {
    const A = gente.a;
    const dias = await semanaDeMuestra(A.s);
    const { page } = await abrir(nav, A, { version_del_esquema: 75, rutina_activa_de: { id: 'x', nombre: 'Entrenamiento 1', dias } });
    await page.goto(`${NATIVA}/yo`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await verTestId(page, 'mi-rutina-en-perfil');
    await foto(page, 'rutina-perfil-propio');
    return page;
  },
  async 'rutina-amigo'(nav, gente) {
    const { a: A, b: B } = gente;
    const { data: pedido } = await A.s.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id').single();
    await B.s.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id);
    const dias = await semanaDeMuestra(A.s);
    const { page } = await abrir(nav, A, { version_del_esquema: 75, rutina_activa_de: { id: 'y', nombre: 'Push pull legs', dias } });
    await page.goto(`${NATIVA}/perfil/${B.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await verTestId(page, 'rutina-de-amigo');
    await tocar(page, 'rutina-dia-2');
    await page.waitForTimeout(400);
    await foto(page, 'rutina-amigo');
    return page;
  },
};

const pedidas = process.argv.slice(2).filter((x) => !x.startsWith('-'));
const correr = pedidas.length ? pedidas : Object.keys(RECETAS);
const gente = { a: await cuenta('a'), b: await cuenta('b') };
const nav = await chromium.launch();
let fallas = 0;
try {
  for (const r of correr) {
    if (!RECETAS[r]) {
      console.log(`no conozco la receta ${r}`);
      continue;
    }
    console.log(`\n${r}`);
    try {
      const page = await RECETAS[r](nav, gente);
      await page.context().close();
    } catch (e) {
      fallas++;
      console.log(`  NO SALIÓ: ${String(e).split('\n')[0].slice(0, 200)}`);
    }
  }
} finally {
  await nav.close();
  for (const x of Object.values(gente)) {
    const { error } = await x.s.rpc('eliminar_cuenta');
    if (error) console.log(`  no se borró la cuenta ${x.nombre}: ${error.message}`);
  }
}
process.exit(fallas ? 1 : 0);
