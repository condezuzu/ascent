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
import { limiteDeSonda, pasarLaEntradaNativa, borrarCuentaDePrueba } from './utiles.mjs';
import { TEXTOS_ES } from '../nucleo/textos.ts';
import { EN } from '../nucleo/textos-en.ts';

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

// `ingles`: el navegador en inglés, como un teléfono en inglés: la app tiene que salir en inglés sola.
async function abrir(nav, quien, respuestas, ingles = false) {
  const tx = ingles ? EN : TEXTOS_ES;
  const page = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: ingles ? 'en-US' : 'es-UY' })).newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
  for (const [rpc, cuerpo] of Object.entries(respuestas ?? {})) {
    await page.route(`**/rest/v1/rpc/${rpc}*`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) }));
    console.log(`  (muestra) ${rpc}`);
  }
  await page.goto(NATIVA, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await pasarLaEntradaNativa(page, 60000, tx);
  await page.locator('input[type=email], input[inputmode=email]').first().fill(quien.correo, { timeout: 90000 });
  await page.locator('input[type=password]').first().fill(quien.clave);
  await page.getByText(tx.entrar.entrar, { exact: true }).last().click({ timeout: 60000 });
  // Sin recorrido desde el 15/10: se espera a que Inicio esté.
  await page.getByText(tx.inicio.iniciarEntrenamiento, { exact: true }).first().waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
  // El aviso de una vez de la cuenta nueva tapa la mitad de abajo: se cierra.
  const deAcuerdo = page.getByText(tx.social.avisoRutinaEntendido, { exact: true }).first();
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
    // ¿YA ESTÁ? (15/10): "press plano" es Press de banca; se avisa y se ofrece usar ese.
    await page.getByTestId('crear-ejercicio').locator('input').first().fill('press plano');
    await page.waitForTimeout(500);
    await page.getByTestId('ya-esta').first().waitFor({ state: 'visible', timeout: 10000 });
    await foto(page, 'ejercicios-ya-esta');
    const aviso = await page.getByTestId('ya-esta').first().innerText();
    if (!aviso.includes('Press de banca')) throw new Error(`el aviso dice "${aviso}"`);
    console.log('  ya está: avisó Press de banca');
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
  async 'stats-vidas'(nav, gente) {
    const A = gente.a;
    const hoy = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const haceDias = (n) => iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n));
    const vuelve = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 26));
    const { page } = await abrir(nav, A, {
      version_del_esquema: 79,
      mis_impulsos: { total: 2, tope: 3, quedan: 0, falta_para_ganar: 20, vigentes: [haceDias(4), haceDias(2)], vuelve, ultimas: [haceDias(2), haceDias(4)], ultima: haceDias(2) },
    });
    // Dos días de este mes cubiertos por una vida (la base de prueba no los tiene).
    await page.route('**/rest/v1/vidas_usadas*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ fecha: haceDias(4) }, { fecha: haceDias(2) }]) }));
    await page.getByText(TEXTOS_ES.nav.stats, { exact: true }).last().click({ timeout: 30000 });
    await page.waitForTimeout(2500);
    await foto(page, 'stats-vidas');
    await verTestId(page, 'corregir-dias');
    await foto(page, 'stats-corregir-boton');
    await tocar(page, 'corregir-dias');
    await page.waitForTimeout(1500);
    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(700);
    await foto(page, 'stats-calendario-vidas');
    return page;
  },
  async ajustes(nav, gente) {
    const sufijo = process.env.FOTOS_SUFIJO ?? '';
    const { page } = await abrir(nav, gente.a);
    await page.getByText('Ajustes', { exact: true }).last().click({ timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.mouse.move(195, 500);
    for (let i = 0; i < 4; i++) {
      await foto(page, `ajustes${sufijo}-${i + 1}`);
      await page.mouse.wheel(0, 650);
      await page.waitForTimeout(700);
    }
    await page.getByText('Ajustes avanzados', { exact: false }).first().click({ timeout: 20000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    for (let i = 4; i < 9; i++) {
      await page.mouse.wheel(0, 650);
      await page.waitForTimeout(700);
      await foto(page, `ajustes${sufijo}-${i + 1}`);
    }
    return page;
  },
  async ingles(nav, gente) {
    const A = gente.a;
    const { page } = await abrir(nav, A, { version_del_esquema: 76 }, true);
    await conCatalogo76(page);
    await page.waitForTimeout(1500);
    await foto(page, 'ingles-inicio');
    await page.getByText(EN.inicio.iniciarEntrenamiento, { exact: true }).first().click({ timeout: 60000 });
    await page.getByLabel(EN.inicio.sumarSerie).first().waitFor({ timeout: 60000 });
    await page.getByText(EN.sesion.sinEjercicio, { exact: true }).first().click({ timeout: 60000 });
    await page.waitForTimeout(1000);
    await page.getByTestId('buscar-ejercicio').first().fill('press');
    await page.waitForTimeout(600);
    await foto(page, 'ingles-selector');
    await page.getByText('Bench press', { exact: true }).first().click({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await foto(page, 'ingles-sesion');
    await page.getByText(EN.nav.stats, { exact: true }).last().click({ timeout: 30000 });
    await page.waitForTimeout(2500);
    await foto(page, 'ingles-stats');
    await page.getByText(EN.nav.ajustes, { exact: true }).last().click({ timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.getByText(EN.ajustes.idioma, { exact: true }).first().scrollIntoViewIfNeeded({ timeout: 20000 });
    await foto(page, 'ingles-ajustes');
    // A mano, a español: la app entera se redibuja en español.
    await tocar(page, 'idioma-es');
    await page.waitForTimeout(3000);
    await foto(page, 'ingles-a-espanol');
    return page;
  },
  async ranking(nav, gente) {
    const { a: A, b: B } = gente;
    const { data: pedido } = await A.s.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id').single();
    if (pedido) await B.s.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id);
    const { page } = await abrir(nav, A, {
      medallas_de_muchos: [
        { user_id: B.id, ejercicio: 'press_banca', percentil: 92 },
        { user_id: B.id, ejercicio: 'sentadilla', percentil: 70 },
      ],
    });
    // Rachas de muestra: B lleva 12 días y su mejor racha fue de 58.
    await page.route('**/rest/v1/usuarios_publicos*', async (r) => {
      const real = await r.fetch();
      const filas = await real.json().catch(() => null);
      if (!Array.isArray(filas)) return r.fulfill({ response: real });
      r.fulfill({ response: real, body: JSON.stringify(filas.map((f) => (f.id === B.id ? { ...f, racha_actual: 12, mejor_racha: 58 } : { ...f, racha_actual: 3, mejor_racha: 21 }))) });
    });
    console.log('  (muestra) rachas de usuarios_publicos');
    await page.getByText(TEXTOS_ES.nav.social, { exact: true }).last().click({ timeout: 30000 });
    await page.waitForTimeout(3500);
    await foto(page, 'ranking-medallas');
    await page.screenshot({ path: join(CARPETA, 'ranking-fila.png'), clip: { x: 0, y: 120, width: 390, height: 100 } });
    console.log('  foto: capturas-nativa/ranking-fila.png');
    return page;
  },
  async perfiles(nav, gente) {
    const { a: A, b: B } = gente;
    const { data: pedido } = await A.s.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id').single();
    if (pedido) await B.s.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id);
    // Una foto de perfil cualquiera, para ver la foto en grande.
    const { error: eFoto } = await A.s.from('profiles').update({ avatar_url: 'https://picsum.photos/id/1011/600/600' }).eq('id', A.id);
    if (eFoto) console.log(`  sin foto de perfil: ${eFoto.message}`);
    // Los amigos de B (la 78 todavía no está): A mismo.
    const { page } = await abrir(nav, A, { version_del_esquema: 78, amigos_de: [A.id] });
    await page.goto(`${NATIVA}/yo`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await page.getByText(B.nombre, { exact: true }).first().scrollIntoViewIfNeeded({ timeout: 30000 });
    await foto(page, 'perfil-propio-amigos');
    await page.getByLabel('Cambiar la foto de perfil').first().scrollIntoViewIfNeeded();
    await page.getByLabel('Cambiar la foto de perfil').first().click({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await foto(page, 'perfil-foto-grande');
    await page.getByText('Cerrar', { exact: true }).last().click({ timeout: 20000 });
    await page.waitForTimeout(600);
    await page.getByText(B.nombre, { exact: true }).first().click({ timeout: 20000 });
    await page.waitForTimeout(3500);
    await verTestId(page, 'amigos-de-amigo');
    await foto(page, 'perfil-amigos-de-amigo');
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
    // EL CRONÓMETRO (15/10): elegir la cinta ya lo arranca.
    await page.getByTestId('cronometro-cardio').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(2200);
    await foto(page, 'cardio-cronometro');
    await tocar(page, 'cardio-principal');
    await page.waitForTimeout(1500);
    await foto(page, 'cardio-hecho');
    const principal = await page.getByTestId('cardio-principal').first().innerText();
    if (principal.trim() !== TEXTOS_ES.sesion.cardioOtraVuelta) throw new Error(`después de Listo el botón dice "${principal}"`);
    if (await page.getByTestId('cronometro-cardio').count()) throw new Error('el cronómetro sigue corriendo después de Listo');
    console.log('  cardio: arrancó al elegirlo, Listo lo cerró y ofrece otra vuelta');
    return page;
  },
  // EL "+" DEL DESCANSO (15/10): cuatro minutos a mano, como lo escribe el dedo.
  async 'descanso-a-mano'(nav, gente) {
    const A = gente.a;
    const { page } = await abrir(nav, A, { version_del_esquema: 79 });
    await sesionConSelector(page);
    await page.getByText('Press de banca', { exact: true }).first().click({ timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.getByLabel(TEXTOS_ES.inicio.sumarSerie, { exact: true }).first().click({ timeout: 20000 });
    await page.waitForTimeout(1000);
    await tocar(page, 'pildora-descanso');
    await page.getByTestId('descanso-a-mano').first().waitFor({ state: 'visible', timeout: 20000 });
    await tocar(page, 'descanso-a-mano');
    await page.getByTestId('descanso-a-mano-campo').first().fill('4');
    await page.waitForTimeout(300);
    await foto(page, 'descanso-a-mano-escribiendo');
    await tocar(page, 'descanso-a-mano-usar');
    await page.waitForTimeout(1200);
    await foto(page, 'descanso-a-mano');
    const texto = await page.locator('body').innerText();
    if (!/\b3:5\d\b|\b4:00\b/.test(texto)) throw new Error('la cuenta atrás no quedó en cuatro minutos');
    console.log('  descanso: quedó en cuatro minutos');
    return page;
  },
  // LOS GLOBITOS (15/10): flotan sin correr nada, y el nuevo de "ya puedes subir".
  async globitos(nav, gente) {
    const A = gente.a;
    // Dos sesiones de press de banca con 60 en las tres series: listo para subir.
    const vez = { bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 60, 60], carga: 'total' }] };
    const { page } = await abrir(nav, A, { version_del_esquema: 79 });
    await page.route('**/rest/v1/sesiones?select=bloques&estado=neq*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([vez, vez]) }));
    await page.getByText('Iniciar entrenamiento', { exact: true }).first().click({ timeout: 90000 });
    const mas = page.getByLabel('Sumar una serie').first();
    await mas.waitFor({ timeout: 90000 });
    const globo = page.getByTestId('globo-series').first();
    await globo.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(600);
    const yCon = (await mas.boundingBox())?.y ?? -1;
    await foto(page, 'globito-series');
    await globo.click();
    await page.waitForTimeout(600);
    const ySin = (await mas.boundingBox())?.y ?? -1;
    if (Math.abs(yCon - ySin) > 1) throw new Error(`el globito corrió el contenido ${Math.round(yCon - ySin)} px`);
    console.log('  globito: flota, el + no se movió');
    await page.getByText('Cualquier cosa', { exact: true }).first().click({ timeout: 60000 });
    await page.getByText('Press de banca', { exact: true }).first().click({ timeout: 20000 });
    await page.getByTestId('globito-subir').first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(400);
    await foto(page, 'globito-subir');
    await tocar(page, 'globito-subir');
    await page.waitForTimeout(600);
    if (await page.getByTestId('globito-subir').count()) throw new Error('el globito de subir no se fue con el toque');
    console.log('  ya puedes subir: apareció al volver al press y se fue con un toque');
    return page;
  },
  async 'stats-kilos'(nav, gente) {
    const A = gente.a;
    const hoy = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Seis semanas de muestra, una sesión por semana, cada una un poco más pesada.
    const sesiones = Array.from({ length: 6 }, (_, i) => {
      const extra = i * 2.5;
      return {
        id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
        logs: { fecha: iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (5 - i) * 7)) },
        bloques: [
          { ejercicio: 'press_banca', series: 4, pesos: [60 + extra, 60 + extra, 60 + extra, 60 + extra] },
          { ejercicio: 'sentadilla', series: 3, pesos: [80 + extra, 80 + extra, 80 + extra] },
        ],
      };
    });
    const { page } = await abrir(nav, A, { version_del_esquema: 79 });
    await page.route('**/rest/v1/sesiones?select=id%2Cbloques%2Clogs*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sesiones) }));
    await irAStatsEntrenamiento(page);
    await verTestId(page, 'kilos-por-semana');
    await foto(page, 'stats-kilos');
    return page;
  },
  // TU RUTINA DESDE INICIO, Y ARRASTRAR (15/10): apretar largo el primero de hoy y
  // soltarlo dos filas más abajo, como lo hace el dedo. Lo que vale es lo que se GUARDA.
  async 'rutina-inicio'(nav, gente) {
    const A = gente.a;
    const dias = await semanaDeMuestra(A.s);
    const hoy = new Date().getDay();
    dias[hoy] = dias[1];
    const rutina = { id: '00000000-0000-4000-8000-000000000001', nombre: 'Entrenamiento 1', activa: true, dias };
    const { page } = await abrir(nav, A, { version_del_esquema: 79, mis_rutinas: [rutina], rutina_activa_de: rutina, guardar_rutina: rutina.id });
    const guardadas = [];
    page.on('request', (q) => {
      if (q.url().includes('/rpc/guardar_rutina')) guardadas.push(JSON.parse(q.postData() ?? 'null'));
    });
    await verTestId(page, 'inicio-rutina');
    await page.waitForTimeout(800);
    await foto(page, 'rutina-inicio');
    await tocar(page, 'inicio-rutina');
    await page.waitForTimeout(1500);
    await foto(page, 'rutina-pantalla');
    await tocar(page, 'rutina-editar');
    await page.waitForTimeout(600);
    const filas = page.getByTestId(`rutina-filas-${hoy}`).locator(':scope > div');
    const caja = await filas.nth(0).boundingBox();
    if (!caja) throw new Error('no está la primera fila de hoy');
    const x = caja.x + caja.width * 0.3;
    const y = caja.y + caja.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.move(x, y + caja.height * 2 + 4, { steps: 12 });
    await page.waitForTimeout(300);
    await foto(page, 'rutina-arrastrando');
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await foto(page, 'rutina-arrastrada');
    const antes = dias[hoy].ejercicios.map((e) => e.ejercicio);
    const esperado = [antes[1], antes[2], antes[0], ...antes.slice(3)];
    const ultima = guardadas.at(-1)?.p_dias?.[hoy]?.ejercicios?.map((e) => e.ejercicio) ?? null;
    if (JSON.stringify(ultima) !== JSON.stringify(esperado)) {
      throw new Error(`arrastrar guardó ${JSON.stringify(ultima)}, se esperaba ${JSON.stringify(esperado)}`);
    }
    console.log('  arrastrar: guardó el orden nuevo');
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
    // Copiar un día y pegarlo en otro (16/10).
    await tocar(page, 'rutina-copiar-dia-1');
    await page.waitForTimeout(400);
    await tocar(page, 'rutina-dia-5');
    await page.waitForTimeout(400);
    await tocar(page, 'rutina-pegar-5');
    await page.waitForTimeout(500);
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
    // Una rutina propia activa de verdad, para que copiar tenga a cuál volver.
    await A.s.rpc('guardar_rutina', { p_id: null, p_nombre: 'Entrenamiento 1', p_dias: dias });
    const { page } = await abrir(nav, A, { version_del_esquema: 75, rutina_activa_de: { id: 'y', nombre: 'Push pull legs', dias } });
    await page.goto(`${NATIVA}/perfil/${B.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await verTestId(page, 'rutina-de-amigo');
    await tocar(page, 'rutina-dia-2');
    await page.waitForTimeout(400);
    await foto(page, 'rutina-amigo');
    // Copiarla (16/10): una rutina más, y la tuya sigue activa.
    await tocar(page, 'rutina-copiar');
    await page.waitForTimeout(2500);
    await foto(page, 'rutina-amigo-copiada');
    return page;
  },
  // LA META DE LA RUTINA (15/10): hoy press de banca con 6 series. La fila de píldoras
  // suma la ×6, prendida.
  async 'meta-de-rutina'(nav, gente) {
    const A = gente.a;
    const dias = await semanaDeMuestra(A.s);
    const hoy = new Date().getDay();
    dias[hoy] = { descanso: false, ejercicios: [{ ejercicio: dias[1].ejercicios[0].ejercicio, series: 6 }, ...dias[1].ejercicios.slice(1)] };
    const rutina = { id: '00000000-0000-4000-8000-000000000001', nombre: 'Entrenamiento 1', activa: true, dias };
    const { page } = await abrir(nav, A, { version_del_esquema: 86, mis_rutinas: [rutina], rutina_activa_de: rutina });
    await page.evaluate(([de, d]) => localStorage.setItem('ascent:rutina-activa', JSON.stringify({ de, id: '00000000-0000-4000-8000-000000000001', dias: d })), [A.id, dias]);
    await page.getByText(TEXTOS_ES.inicio.iniciarEntrenamiento, { exact: true }).first().click({ timeout: 30000 });
    await page.waitForTimeout(3500);
    await foto(page, 'meta-de-rutina');
    return page;
  },
  // ENTRENAR EN GRUPO (15/10): la tira en Inicio y la lista de Ranking, con un grupo de
  // tres (A armó; B descansa; C hace su serie) y un pedido de D. La respuesta de la
  // base es de mentira (la migración 88 todavía no está en producción).
  async grupo(nav, gente) {
    const A = gente.a;
    const ahora = new Date();
    const en = (s) => new Date(ahora.getTime() + s * 1000).toISOString();
    const otro = (id, username) => ({ id, username, avatar_url: null });
    const uniones = [
      { id: 'g', estado: 'aceptada', la_pedi_yo: false, grupo: 'g', lider: false, yo_lider: true, otro: otro('00000000-0000-4000-8000-0000000000b1', 'lucia'), ahora: ahora.toISOString(), en_vivo: { ejercicio: 'sentadilla', serie: 2, meta: 4, descanso_fin: en(74), actualizado: ahora.toISOString() } },
      { id: 'g', estado: 'aceptada', la_pedi_yo: false, grupo: 'g', lider: false, yo_lider: true, otro: otro('00000000-0000-4000-8000-0000000000c1', 'mateo'), ahora: ahora.toISOString(), en_vivo: { ejercicio: 'remo_barra', serie: 1, meta: 3, descanso_fin: null, actualizado: ahora.toISOString() } },
      { id: 'p', estado: 'pendiente', la_pedi_yo: false, grupo: null, lider: false, yo_lider: true, otro: otro('00000000-0000-4000-8000-0000000000d1', 'sofi'), ahora: ahora.toISOString(), en_vivo: null },
    ];
    const { page } = await abrir(nav, A, { version_del_esquema: 88, mis_uniones: uniones });
    await page.getByText(TEXTOS_ES.inicio.iniciarEntrenamiento, { exact: true }).first().click({ timeout: 30000 });
    await page.getByTestId('tira-del-grupo').first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1500);
    await foto(page, 'grupo-tira');
    await page.getByText('Social', { exact: true }).last().click({ timeout: 30000 });
    await page.getByTestId('juntos').first().scrollIntoViewIfNeeded({ timeout: 30000 });
    await page.waitForTimeout(1200);
    await foto(page, 'grupo-ranking');
    return page;
  },
  // LA ZONA SEGURA (15/10): el navegador no tiene isla ni hora, así que se le dice a
  // Chrome que la zona de arriba mide 59 (un iPhone con isla) y se pinta esa franja.
  async 'zona-segura'(nav, gente) {
    const A = gente.a;
    const dias = await semanaDeMuestra(A.s);
    const rutina = { id: '00000000-0000-4000-8000-000000000001', nombre: 'Entrenamiento 1', activa: true, dias };
    const { page } = await abrir(nav, A, { version_del_esquema: 79, mis_rutinas: [rutina], rutina_activa_de: rutina });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, topMax: 59, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const franja = () =>
      page.evaluate(() => {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:59px;background:rgba(232,112,95,.35);z-index:99999;pointer-events:none;font:12px sans-serif;color:#fff;padding:4px 8px;box-sizing:border-box';
        d.textContent = 'zona de la hora y la isla (59)';
        document.body.appendChild(d);
      });
    await verTestId(page, 'inicio-rutina');
    await page.waitForTimeout(1200);
    await franja();
    await foto(page, 'zona-inicio');
    await tocar(page, 'inicio-rutina');
    await page.waitForTimeout(1500);
    await foto(page, 'zona-rutina');
    return page;
  },
  // VOLVER DESLIZANDO, RECONSTRUIDO (15/10): en el navegador no hay gesto nativo. Se
  // sacan Inicio y Tu rutina por separado (Tu rutina sin el fondo) y se arma el cuadro
  // del gesto a mitad de camino: hoy (las dos encimadas) y la propuesta (lo de atrás
  // borroso bajo la pantalla que se va, aclarándose con el avance).
  async 'volver-deslizando'(nav, gente) {
    const A = gente.a;
    const dias = await semanaDeMuestra(A.s);
    dias[new Date().getDay()] = dias[1];
    const rutina = { id: '00000000-0000-4000-8000-000000000001', nombre: 'Entrenamiento 1', activa: true, dias };
    const { page } = await abrir(nav, A, { version_del_esquema: 79, mis_rutinas: [rutina], rutina_activa_de: rutina });
    await verTestId(page, 'inicio-rutina');
    await page.waitForTimeout(1500);
    const inicio = (await page.screenshot()).toString('base64');
    await tocar(page, 'inicio-rutina');
    await page.waitForTimeout(1800);
    // Sin el motor ni los fondos llenos: queda solo lo que dibuja la pantalla.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('canvas')) el.style.visibility = 'hidden';
      for (const el of document.querySelectorAll('div')) {
        const r = el.getBoundingClientRect();
        if (r.width >= innerWidth && r.height >= innerHeight * 0.9) {
          el.style.backgroundColor = 'transparent';
          el.style.backdropFilter = 'none';
          el.style.webkitBackdropFilter = 'none';
        }
      }
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    });
    await page.waitForTimeout(300);
    const arriba = (await page.screenshot({ omitBackground: true })).toString('base64');
    const cuadro = (p, borroso) => `
      <div class="cuadro">
        <img class="base" src="data:image/png;base64,${inicio}">
        <div class="carta" style="left:${p * 390}px">
          ${borroso ? `<div class="velo" style="backdrop-filter:blur(${Math.round((1 - p) * 14)}px) brightness(${1 - (1 - p) * 0.35})"></div>` : ''}
          <img src="data:image/png;base64,${arriba}">
        </div>
        <div class="pie">${Math.round(p * 100)} % del gesto</div>
      </div>`;
    const html = `<style>
      body{margin:0;background:#111;font:15px sans-serif;color:#ccc;padding:16px}
      h2{font-weight:500;font-size:16px;margin:8px 0}
      .fila{display:flex;gap:16px;margin-bottom:24px}
      .cuadro{position:relative;width:390px;height:844px;overflow:hidden;border-radius:18px}
      .base{position:absolute;inset:0;width:390px}
      .carta{position:absolute;top:0;width:390px;height:844px;box-shadow:-12px 0 24px rgba(0,0,0,.35)}
      .carta img{position:absolute;inset:0;width:390px}
      .velo{position:absolute;inset:0}
      .pie{position:absolute;bottom:8px;left:12px;background:#000a;padding:2px 8px;border-radius:6px;font-size:13px}
    </style>
    <h2>Hoy: las dos pantallas encimadas</h2><div class="fila">${[0.2, 0.5, 0.8].map((p) => cuadro(p, false)).join('')}</div>
    <h2>Propuesta: lo de atrás borroso, que se aclara con el avance</h2><div class="fila">${[0.2, 0.5, 0.8].map((p) => cuadro(p, true)).join('')}</div>`;
    const lienzo = await (await nav.newContext({ viewport: { width: 1250, height: 1850 }, deviceScaleFactor: 1 })).newPage();
    await lienzo.setContent(html);
    await lienzo.waitForTimeout(500);
    await lienzo.screenshot({ path: join(CARPETA, 'volver-deslizando.png'), fullPage: true });
    console.log('  foto: capturas-nativa/volver-deslizando.png (reconstrucción)');
    await lienzo.context().close();
    return page;
  },
};

// LAS CAPTURAS DE FONDO DE LAS PROPUESTAS (15/10). Regla: en una propuesta visual el
// fondo es la pantalla REAL y lo único dibujado es lo que se propone cambiar. Van a
// `public/galeria-propuestas/` (las sirve la web) y, al lado, dónde quedó cada cosa
// en la pantalla (`cajas.json`), para que la galería dibuje encima en su lugar exacto.
const DE_PROPUESTAS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'galeria-propuestas');
RECETAS['propuestas'] = async function (nav, gente) {
  const { a: A, b: B } = gente;
  const { readFileSync, writeFileSync } = await import('node:fs');
  mkdirSync(DE_PROPUESTAS, { recursive: true });
  const rutaCajas = join(DE_PROPUESTAS, 'cajas.json');
  let cajas = {};
  try {
    cajas = JSON.parse(readFileSync(rutaCajas, 'utf8'));
  } catch {}
  const caja = async (loc) => {
    const b = await loc.first().boundingBox({ timeout: 15000 }).catch(() => null);
    return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const sinGlobos = async (page) => {
    for (const g of await page.locator('[data-testid^="globo-"], [data-testid="globito-subir"]').all()) await g.click().catch(() => {});
    await page.waitForTimeout(400);
  };
  const sacar = async (page, nombre, medir = {}) => {
    await sinGlobos(page);
    await page.screenshot({ path: join(DE_PROPUESTAS, `${nombre}.jpg`), type: 'jpeg', quality: 86 });
    cajas[nombre] = {};
    for (const [k, loc] of Object.entries(medir)) cajas[nombre][k] = await caja(loc);
    writeFileSync(rutaCajas, JSON.stringify(cajas, null, 1));
    console.log(`  foto: public/galeria-propuestas/${nombre}.jpg ${JSON.stringify(cajas[nombre])}`);
  };
  const texto = (page, t) => page.getByText(t, { exact: true });
  const dias = (page) => Object.fromEntries(['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => [d, texto(page, d).last()]));
  const tx = TEXTOS_ES;

  const { page } = await abrir(nav, A);
  // 1. Inicio, la cuenta vacía: la semana y el cuerpo.
  await texto(page, tx.inicio.registrarPrimerDia).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);
  await sacar(page, 'inicio', { ...dias(page), registrar: texto(page, tx.inicio.registrarPrimerDia) });

  // 2. Las pestañas, sin nada todavía: donde irían los globitos de la primera vez.
  await texto(page, tx.nav.social).last().click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await sacar(page, 'ranking-vacio', { buscar: page.getByTestId('buscar-gente'), titulo: page.getByText('Ranking', { exact: true }) });
  await texto(page, tx.nav.album).last().click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await sacar(page, 'album-vacio', { titulo: texto(page, tx.album.titulo) });
  // La rutina ya no está en Stats: se edita en su pantalla, desde "HOY" en Inicio.
  await texto(page, tx.nav.inicio).last().click({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await tocar(page, 'inicio-rutina');
  await page.waitForTimeout(1800);
  await sacar(page, 'rutina', { rutina: page.getByTestId('mi-rutina') });
  await page.goBack();
  await page.waitForTimeout(1500);
  await texto(page, tx.nav.album).last().click({ timeout: 30000 });
  await page.waitForTimeout(800);

  // 3. Mi gimnasio en Ajustes, sin marcar.
  await texto(page, tx.nav.ajustes).last().click({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const seccion = texto(page, tx.ajustes.gimnasio).first();
  if (!(await seccion.isVisible().catch(() => false))) await texto(page, tx.ajustes.avanzados).first().click().catch(() => {});
  await seccion.scrollIntoViewIfNeeded({ timeout: 20000 });
  await page.evaluate(() => window.scrollBy(0, -200));
  await page.waitForTimeout(800);
  await sacar(page, 'gimnasio-sin-marcar', { titulo: seccion, marcar: texto(page, tx.ajustes.gimnasioMarcar) });

  // 4. Registrar el día a mano: el día registrado y la insistencia de marcar el gimnasio.
  await texto(page, tx.nav.inicio).last().click({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await texto(page, tx.inicio.registrarPrimerDia).first().click({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await sacar(page, 'registrar-hoja', { guardar: texto(page, tx.inicio.registrarDia).last() });
  await texto(page, tx.inicio.registrarDia).last().click({ timeout: 30000 });
  await page.waitForTimeout(3500);
  await sacar(page, 'dia-registrado', dias(page));
  // La insistencia sale con los días ya releídos: se recarga Inicio.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await texto(page, tx.inicio.insistirGimnasio).first().waitFor({ timeout: 60000 }).catch(() => {});
  await texto(page, tx.social.avisoRutinaEntendido).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await sacar(page, 'insistir', { accion: texto(page, tx.inicio.insistirGimnasio) });

  // 5. La sesión: el selector, el bloque con el + y el descanso.
  await texto(page, 'Iniciar entrenamiento').first().click({ timeout: 90000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1200);
  await sacar(page, 'sesion-sin-ejercicio', { mas: page.getByLabel('Sumar una serie'), chip: texto(page, tx.sesion.sinEjercicio) });
  await texto(page, tx.sesion.sinEjercicio).first().click({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await sacar(page, 'elegir', { buscar: page.getByTestId('buscar-ejercicio') });
  await texto(page, 'Press de banca').first().click({ timeout: 60000 });
  await page.waitForTimeout(1800);
  await sacar(page, 'serie', { mas: page.getByLabel('Sumar una serie'), ejercicio: page.getByText(/Press de banca/).first() });
  await page.getByLabel('Sumar una serie').first().click({ timeout: 30000 });
  await page.waitForTimeout(1800);
  // El descanso es el relojito de arriba a la derecha (el que cuenta para atrás).
  await sacar(page, 'descanso', { reloj: page.getByText(/^[0-9]:[0-9]{2}$/).last(), sesion: page.getByText(/^[0-9]:[0-9]{2}$/).first() });
  await page.context().close();

  // 6. Mi gimnasio ya marcado (el punto lo pone la base, no un GPS).
  await A.s.from('profiles').update({ gimnasio_lat: -34.9, gimnasio_lon: -56.16 }).eq('id', A.id);
  const { page: p2 } = await abrir(nav, A);
  await texto(p2, tx.nav.ajustes).last().click({ timeout: 30000 });
  await p2.waitForTimeout(1500);
  const sec2 = texto(p2, tx.ajustes.gimnasio).first();
  if (!(await sec2.isVisible().catch(() => false))) await texto(p2, tx.ajustes.avanzados).first().click().catch(() => {});
  await sec2.scrollIntoViewIfNeeded({ timeout: 20000 });
  await p2.evaluate(() => window.scrollBy(0, -200));
  await p2.waitForTimeout(800);
  await sacar(p2, 'gimnasio-marcado', { titulo: sec2, remarcar: texto(p2, tx.ajustes.gimnasioRemarcar), borrar: texto(p2, tx.ajustes.gimnasioBorrar) });
  await p2.context().close();

  // 7. Las medallas, en Ranking con un amigo (los mismos datos de muestra que `ranking`).
  const { data: pedido } = await A.s.from('friendships').insert({ solicitante: A.id, destinatario: B.id }).select('id').single();
  if (pedido) await B.s.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id);
  const { page: p3 } = await abrir(nav, A, {
    medallas_de_muchos: [
      { user_id: B.id, ejercicio: 'press_banca', percentil: 92 },
      { user_id: B.id, ejercicio: 'sentadilla', percentil: 70 },
    ],
  });
  await p3.route('**/rest/v1/usuarios_publicos*', async (r) => {
    const real = await r.fetch();
    const filas = await real.json().catch(() => null);
    if (!Array.isArray(filas)) return r.fulfill({ response: real });
    r.fulfill({ response: real, body: JSON.stringify(filas.map((f) => (f.id === B.id ? { ...f, racha_actual: 12, mejor_racha: 58 } : { ...f, racha_actual: 3, mejor_racha: 21 }))) });
  });
  await texto(p3, tx.nav.social).last().click({ timeout: 30000 });
  await p3.waitForTimeout(3500);
  await sacar(p3, 'medallas', { fila: p3.getByText(B.nombre, { exact: true }) });
  return p3;
};

// LA UBICACIÓN YA HECHA (15/10): la línea de Inicio, el salto a Ajustes con el botón
// resaltado, y Mi gimnasio marcado. Van a `capturas-nativa/`, no a la galería.
RECETAS['ubicacion-hecha'] = async function (nav, gente) {
  const A = gente.a;
  const tx = TEXTOS_ES;
  const { page } = await abrir(nav, A);
  await page.getByText(tx.inicio.registrarPrimerDia, { exact: true }).first().click({ timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.getByText(tx.inicio.registrarDia, { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('insistir-gimnasio').first().waitFor({ timeout: 60000 });
  await page.getByText(tx.social.avisoRutinaEntendido, { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await foto(page, 'ubicacion-inicio');
  await tocar(page, 'insistir-gimnasio');
  // El resaltado pasa dos veces en un segundo y medio: la foto, en el pico.
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-testid="gimnasio-luz"]') ?? document.body).opacity) > 0.6 && !!document.querySelector('[data-testid="gimnasio-luz"]'), null, { timeout: 5000, polling: 16 }).catch(() => {});
  // RECONSTRUCCIÓN DEL PICO: en el navegador dura menos que una foto. Se fija la luz al máximo solo para sacarla.
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const e = document.querySelector('[data-testid="gimnasio-luz"]'); if (e) e.style.opacity = '1'; });
  await foto(page, 'ubicacion-resaltado');
  await A.s.from('profiles').update({ gimnasio_lat: -34.9, gimnasio_lon: -56.16 }).eq('id', A.id);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText(tx.nav.ajustes, { exact: true }).last().click({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await foto(page, 'ubicacion-marcado');
  return page;
};

// EL ÁLBUM CON FOTOS (15/10): el globito del álbum apunta a las fotos, así que hacen
// falta fotos. Tres imágenes lisas de colores distintos, subidas como las sube la app.
RECETAS['propuestas-album'] = async function (nav, gente) {
  const A = gente.a;
  const { readFileSync, writeFileSync } = await import('node:fs');
  const lienzo = await (await nav.newContext({ viewport: { width: 600, height: 750 } })).newPage();
  const hoy = new Date().toISOString().slice(0, 10);
  for (const [i, color] of ['#3d4a66', '#6a5a7e', '#4f6b5c'].entries()) {
    await lienzo.setContent(`<body style="margin:0;background:radial-gradient(circle at 40% 35%, #c9c4b8, ${color} 60%, #111 100%)"></body>`);
    const jpg = await lienzo.screenshot({ type: 'jpeg', quality: 80 });
    const ruta = `${A.id}/${hoy}-${900 + i}.jpg`;
    await A.s.storage.from('fotos').upload(ruta, jpg, { contentType: 'image/jpeg' });
    await A.s.from('photos').insert({ user_id: A.id, storage_path: ruta, visibilidad: 'privada' });
  }
  await lienzo.context().close();
  const { page } = await abrir(nav, A);
  await page.getByText(TEXTOS_ES.nav.album, { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(4000);
  for (const g of await page.locator('[data-testid^="globo-"]').all()) await g.click().catch(() => {});
  await page.screenshot({ path: join(DE_PROPUESTAS, 'album-fotos.jpg'), type: 'jpeg', quality: 86 });
  const rutaCajas = join(DE_PROPUESTAS, 'cajas.json');
  const cajas = JSON.parse(readFileSync(rutaCajas, 'utf8'));
  const img = await page.locator('img').first().boundingBox().catch(() => null);
  cajas['album-fotos'] = { foto: img && { x: Math.round(img.x), y: Math.round(img.y), w: Math.round(img.width), h: Math.round(img.height) } };
  writeFileSync(rutaCajas, JSON.stringify(cajas, null, 1));
  console.log(`  foto: public/galeria-propuestas/album-fotos.jpg ${JSON.stringify(cajas['album-fotos'])}`);
  return page;
};

// LA ENTRADA NUEVA Y LOS SEIS GLOBITOS (15/10), en la app de verdad: las cuatro
// pantallas en sus momentos, y cada globito con una cuenta recién creada.
RECETAS['entrada-y-globitos'] = async function (nav, gente) {
  const A = gente.a;
  const tx = TEXTOS_ES;
  // 1. La entrada, en un navegador limpio.
  const limpio = await (await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-UY' })).newPage();
  await limpio.goto(NATIVA, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await limpio.getByTestId('bienvenida').first().waitFor({ timeout: 90000 });
  for (const p of ['pesos', 'llegar', 'amigo']) {
    await limpio.waitForTimeout(2600);
    await foto(limpio, `entrada-${p}`);
    await limpio.getByTestId('bienvenida-siguiente').first().click({ timeout: 10000 });
  }
  const t0 = Date.now();
  for (const [nombre, s] of [['lista', 1.6], ['sofi-pasa', 3.8], ['luz', 5.0], ['boton', 7.2]]) {
    const falta = s * 1000 - (Date.now() - t0);
    if (falta > 0) await limpio.waitForTimeout(falta);
    await foto(limpio, `entrada-ranking-${nombre}`);
  }
  await limpio.getByTestId('bienvenida-entrar').first().click({ timeout: 10000 });
  await limpio.locator('input[type=email], input[inputmode=email]').first().waitFor({ timeout: 30000 });
  await foto(limpio, 'entrada-login');
  await limpio.context().close();

  // 2. Los globitos, con la cuenta recién creada (nace después del 15/10: los ve).
  const { page } = await abrir(nav, A);
  await page.getByText('Iniciar entrenamiento', { exact: true }).first().click({ timeout: 90000 });
  await page.getByLabel('Sumar una serie').first().waitFor({ timeout: 90000 });
  await page.getByTestId('globo-series').first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  await foto(page, 'globito-series');
  await page.getByText(tx.sesion.sinEjercicio, { exact: true }).first().click({ timeout: 60000 });
  await page.getByTestId('globo-elegir').first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  await foto(page, 'globito-elegir');
  await page.getByText('Press de banca', { exact: true }).first().click({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByLabel('Sumar una serie').first().click({ timeout: 30000 });
  await page.getByTestId('globo-descanso').first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  await foto(page, 'globito-descanso');
  await page.getByText(tx.nav.social, { exact: true }).last().click({ timeout: 30000 });
  await page.getByTestId('globo-amigos').first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  await foto(page, 'globito-amigos');
  // Fotos para el álbum: tres imágenes lisas, subidas como las sube la app.
  const lienzo = await (await nav.newContext({ viewport: { width: 600, height: 750 } })).newPage();
  const hoy = new Date().toISOString().slice(0, 10);
  for (const [i, color] of ['#3d4a66', '#6a5a7e', '#4f6b5c'].entries()) {
    await lienzo.setContent(`<body style="margin:0;background:radial-gradient(circle at 40% 35%, #c9c4b8, ${color} 60%, #111 100%)"></body>`);
    const jpg = await lienzo.screenshot({ type: 'jpeg', quality: 80 });
    const ruta = `${A.id}/${hoy}-${800 + i}.jpg`;
    await A.s.storage.from('fotos').upload(ruta, jpg, { contentType: 'image/jpeg' });
    await A.s.from('photos').insert({ user_id: A.id, storage_path: ruta, visibilidad: 'privada' });
  }
  await lienzo.context().close();
  await page.getByText(tx.nav.album, { exact: true }).last().click({ timeout: 30000 });
  await page.getByTestId('globo-album').first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await foto(page, 'globito-album');
  await page.getByText(tx.nav.inicio, { exact: true }).last().click({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.context().close();

  // 3. La rutina: con una de muestra, editándola. Con la otra cuenta: esta quedó con
  // la sesión abierta, y con sesión Inicio no muestra "HOY".
  const B = gente.b;
  const dias = await semanaDeMuestra(B.s);
  const rutina = { id: '00000000-0000-4000-8000-000000000001', nombre: 'Entrenamiento 1', activa: true, dias };
  const { page: p2 } = await abrir(nav, B, { mis_rutinas: [rutina], rutina_activa_de: rutina });
  await verTestId(p2, 'inicio-rutina');
  await tocar(p2, 'inicio-rutina');
  await p2.waitForTimeout(1500);
  await tocar(p2, 'rutina-editar');
  await p2.getByTestId('globo-rutina').first().waitFor({ timeout: 20000 }).catch(() => {});
  await p2.waitForTimeout(900);
  await foto(p2, 'globito-rutina');
  return p2;
};

// Tu rutina, editándola: donde va el globito de la rutina.
RECETAS['propuestas-rutina'] = async function (nav, gente) {
  const A = gente.a;
  const { readFileSync, writeFileSync } = await import('node:fs');
  const dias = await semanaDeMuestra(A.s);
  const hoy = new Date().getDay();
  dias[hoy] = dias[1];
  const rutina = { id: '00000000-0000-4000-8000-000000000001', nombre: 'Entrenamiento 1', activa: true, dias };
  const { page } = await abrir(nav, A, { mis_rutinas: [rutina], rutina_activa_de: rutina });
  await verTestId(page, 'inicio-rutina');
  await tocar(page, 'inicio-rutina');
  await page.waitForTimeout(1500);
  await tocar(page, 'rutina-editar');
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(DE_PROPUESTAS, 'rutina-editando.jpg'), type: 'jpeg', quality: 86 });
  const rutaCajas = join(DE_PROPUESTAS, 'cajas.json');
  const cajas = JSON.parse(readFileSync(rutaCajas, 'utf8'));
  const b = await page.getByTestId(`rutina-filas-${hoy}`).first().boundingBox().catch(() => null);
  cajas['rutina-editando'] = { filasDeHoy: b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } };
  writeFileSync(rutaCajas, JSON.stringify(cajas, null, 1));
  console.log(`  foto: public/galeria-propuestas/rutina-editando.jpg ${JSON.stringify(cajas['rutina-editando'])}`);
  return page;
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
    const { error } = await borrarCuentaDePrueba(x.s);
    if (error) console.log(`  no se borró la cuenta ${x.nombre}: ${error.message}`);
  }
}
process.exit(fallas ? 1 : 0);
