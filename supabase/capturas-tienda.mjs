// LAS CAPTURAS PARA LA FICHA DE LA APP STORE, crudas.
//
// CRUDAS A PROPÓSITO: sin marco de teléfono, sin títulos, sin flechas. Las
// edita una persona después, y una captura ya decorada no se puede volver a
// decorar — se recorta, se le tapa algo, o se termina rehaciéndola.
//
// EL TAMAÑO ES EL QUE PIDE APPLE: 1290×2796, que es la medida de 6,7" y la que
// acepta para las pantallas grandes. Sale de un lienzo de 430×932 a densidad
// 3, o sea exactamente como lo dibuja el teléfono.
//
// ─────────────────────────────────────────────────────────────────────
// CÓMO SE CONSIGUE CADA UNA, que es la parte que no es obvia:
//
// 1, 2 y 3 (Inicio en tres rangos) SON LA MISMA CUENTA, y el orden importa.
//    La racha sale de los días que hay en `logs`, así que se vacía y se
//    vuelve a llenar entre foto y foto. Van de menor a mayor —4, 38, 99— y no
//    al revés porque `mejor_racha` no baja: yendo para atrás, la segunda foto
//    tendría el FANTASMA del récord anterior dibujado en el fondo, que es un
//    cuerpo de más que nadie pidió.
//
//    Y EL 38 NO ES CAPRICHO: el planeta del día sale de la racha
//    (`planetaDeDia`), y Saturno es el noveno de diez, o sea el día 38. No hay
//    otra racha que dé Saturno.
//
//    Con 38 viene ADEMÁS el presagio —el fondo se carga los tres días antes de
//    subir de rango— y no se puede separar: son el mismo número. Queda dicho
//    porque se ve.
//
// 4 (Ranking) ES OTRA CUENTA, con cinco amigos. No se puede reusar la de
//    arriba: la amistad se arma de a dos y las cinco cuentas tienen que
//    existir de verdad. Las rachas están repartidas alrededor de la propia
//    para que la tabla tenga gente arriba y gente abajo, que es lo que hace
//    que se lea como una tabla y no como una lista.
//
// 5 (la galaxia) SALE DE LA APP, no de la galería, y no era el plan.
//
//    La galería dibuja cualquier cuerpo sin esperar semanas de racha y además
//    lo trae al centro, así que era el lugar obvio. Pero NO DIBUJA NADA desde
//    una sonda, y a propósito: el motor de la web mira el nombre del
//    renderizador y se apaga si es uno por software — ver el bloque de los
//    tres filtros en `src/motor/escena.ts`, que nombra justamente "el Chromium
//    de las sondas". Un Chromium sin cabeza no tiene GPU: usa SwiftShader. Y
//    uno CON cabeza no arranca en esta máquina.
//
//    La app nativa no tiene ese filtro —expo-gl dibuja igual— así que la
//    galaxia sale de ahí, con la racha que le toca (65). Queda en la esquina y
//    con la interfaz encima, como las otras tres, lo que para un set de la
//    tienda es más coherente que mezclar dos orígenes.
//
//    El agujero negro ya es la número 3, así que no hace falta dos veces.
//
//    EL CÓDIGO DE LA GALERÍA SE QUEDA, detrás de `--solo-galeria`: en una
//    máquina con GPU anda, y es la única forma de tener un cuerpo centrado.
//
// TODO SE BORRA AL FINAL. Son siete cuentas en la base de producción que no
// tienen por qué sobrevivir a una sesión de fotos.
//
// NECESITA LA NATIVA EN :8090 y la web en :3020.
//
//   node --env-file=.env.local supabase/capturas-tienda.mjs
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { limiteDeSonda, pasarLaEntrada } from './utiles.mjs';

limiteDeSonda(25);

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'capturas', 'tienda');
mkdirSync(SALIDA, { recursive: true });

const NATIVA = 'http://localhost:8090';
const WEB = 'http://localhost:3020';

// 430×932 a densidad 3 = 1290×2796, la medida de 6,7" de la App Store.
const ANCHO = 430;
const ALTO = 932;
const DENSIDAD = 3;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.log('Faltan NEXT_PUBLIC_SUPABASE_* en .env.local.');
  process.exit(1);
}

const sello = Date.now().toString(36);
const CLAVE = `Ct-${sello}-Zx9`;
const correoDe = (n) => `agusconde20+ascent-tienda-${sello}-${n}@gmail.com`;

const nuevoCliente = () => createClient(url, anon, { auth: { persistSession: false } });

/** Crea una cuenta, le pone nombre y le deja `dias` días seguidos hasta hoy. */
async function cuenta(n, usuario, dias) {
  const s = nuevoCliente();
  const correo = correoDe(n);
  const { data, error } = await s.auth.signUp({ email: correo, password: CLAVE });
  if (error || !data?.user) throw new Error(`no se pudo crear ${usuario}: ${error?.message}`);
  const uid = data.user.id;
  // EL NOMBRE SE CHEQUEA, Y NO ES CEREMONIA. La primera corrida perdió a una
  // de las cinco amigas sin decir nada: `martina` ya estaba tomado —el nombre
  // es único—, el update falló, el perfil quedó sin nombre, y la fila
  // desapareció de la tabla del ranking (que sale de `usuarios_publicos`, que
  // pide nombre). En la captura se veía como cuatro amigos en vez de cinco y
  // dos renglones de "¿? registró el 23 de setiembre" en la actividad.
  const { error: eNombre } = await s.from('profiles').update({ username: usuario, sexo: 'm' }).eq('id', uid);
  if (eNombre) {
    throw new Error(
      eNombre.code === '23505'
        ? `el nombre "${usuario}" ya está tomado: elegí otro en AMIGOS`
        : `no se le pudo poner el nombre a ${usuario}: ${eNombre.message}`
    );
  }
  if (dias > 0) await ponerRacha(s, uid, dias);
  return { s, uid, correo, usuario };
}

/** Vacía los días y deja exactamente `dias` seguidos terminando hoy. */
async function ponerRacha(s, uid, dias) {
  const HOY = (await s.rpc('mi_hoy')).data;
  const dia = (atras) => {
    const d = new Date(HOY + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - atras);
    return d.toISOString().slice(0, 10);
  };
  await s.from('logs').delete().eq('user_id', uid);
  const filas = [];
  for (let atras = dias - 1; atras >= 0; atras--) filas.push({ user_id: uid, fecha: dia(atras) });
  // DE A CINCUENTA, y el número está medido: 99 filas en una sentencia entran
  // y 147 ya no —"canceling statement due to statement timeout"—. No es el
  // tamaño del insert, es que CADA FILA dispara el trigger que recalcula la
  // racha, así que el costo crece con el cuadrado y no con el largo.
  for (let i = 0; i < filas.length; i += 50) {
    const { error } = await s.from('logs').insert(filas.slice(i, i + 50));
    if (error) throw new Error(`no se pudieron cargar los días: ${error.message}`);
  }
  await s.rpc('recalcular_desde_cero');
  return (await s.from('profiles').select('racha_actual, rango_actual').eq('id', uid).single()).data;
}

const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: ANCHO, height: ALTO },
  deviceScaleFactor: DENSIDAD,
  locale: 'es-UY',
  timezoneId: 'America/Montevideo',
});
const page = await ctx.newPage();

/** Entra a la app nativa. Si ya había sesión, sale primero. */
async function entrarEnLaNativa(correo) {
  await page.goto(NATIVA, { waitUntil: 'networkidle', timeout: 240000 });
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('sb-')) localStorage.removeItem(k);
  });
  await page.goto(NATIVA, { waitUntil: 'networkidle', timeout: 240000 });
  for (let i = 0; i < 90; i++) {
    if (await page.locator('input[type=password]').first().isVisible().catch(() => false)) break;
    await page.waitForTimeout(1000);
  }
  await page
    .locator('input[type=email], input[inputmode=email], input[autocomplete=email]')
    .first()
    .fill(correo);
  await page.locator('input[type=password]').first().fill(CLAVE);
  await page.getByText('Entrar', { exact: true }).last().click();
  await page
    .locator('[data-testid="carril-inicio"]')
    .getByText('Iniciar entrenamiento', { exact: true })
    .last()
    .waitFor({ timeout: 180000 });
}

/**
 * Espera a que el motor esté dibujando de verdad antes de disparar.
 *
 * NO ES UN `waitForTimeout` GENEROSO Y LISTO: el motor tarda distinto según el
 * rango —el agujero negro compila más shaders que el polvo— y una captura
 * sacada un segundo antes sale con el degradado y sin cuerpo, que es
 * exactamente la foto que no sirve. Se espera al lienzo y después se le da
 * tiempo al fundido de entrada, que dura medio segundo.
 */
async function esperarElFondo() {
  await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 120000 });
  await page.waitForTimeout(9000);
}

const hechas = [];
async function foto(nombre, nota) {
  const archivo = join(SALIDA, `${nombre}.png`);
  await page.screenshot({ path: archivo });
  hechas.push({ nombre, nota });
  console.log(`  ${nombre.padEnd(28)} ${nota}`);
}

// SOLO LA GALERÍA: las cuatro de la app tardan —siete cuentas, cada una con
// sus días y el trigger de la racha por fila— y las dos de la galería no
// necesitan ninguna. Sirve para reintentar esas dos sin rehacer las otras.
const SOLO_GALERIA = process.argv.includes('--solo-galeria');
const SOLO_RANKING = process.argv.includes('--solo-ranking');
const SOLO_INICIO = process.argv.includes('--solo-inicio');
// Cada parte se puede correr sola: las cuatro de la app tardan minutos y
// reintentar una no tiene por que rehacer las otras tres.
const HACER_INICIO = !SOLO_GALERIA && !SOLO_RANKING;
const HACER_RANKING = !SOLO_GALERIA && !SOLO_INICIO;
const HACER_GALERIA = !SOLO_RANKING && !SOLO_INICIO;

const cuentas = [];
try {
  console.log(`\nCapturas para la tienda · ${ANCHO * DENSIDAD}×${ALTO * DENSIDAD}\n`);
  if (SOLO_GALERIA) console.log('  (solo la galería)\n');

  // ─────────────────────────────────────────────────────────────
  // 1, 2 y 3: Inicio en tres rangos, con la misma cuenta
  // ─────────────────────────────────────────────────────────────
  if (HACER_INICIO) {
  const yo = await cuenta('yo', 'agustin', 4);
  cuentas.push(yo);
  await entrarEnLaNativa(yo.correo);
  await esperarElFondo();
  await foto('1-rango-1-polvo', 'racha 4 · rango 1, el polvo');

  // ASCENDENTE, SIEMPRE: `mejor_racha` no baja, y yendo para atrás la foto
  // siguiente tendría el fantasma del récord anterior dibujado en el fondo.
  for (const [dias, nombre, nota] of [
    [38, '2-rango-4-saturno', 'racha 38 · rango 4, Saturno (y el presagio, que viene con el 38)'],
    [65, '5-galaxia', 'racha 65 · rango 7, la galaxia'],
    [99, '3-rango-8-agujero-negro', 'racha 99 · rango 8, el agujero negro'],
  ]) {
    const p = await ponerRacha(yo.s, yo.uid, dias);
    if (p.racha_actual !== dias) console.log(`  aviso: quedó en racha ${p.racha_actual}, no ${dias}`);
    await page.reload({ waitUntil: 'networkidle', timeout: 240000 });
    await esperarElFondo();
    await foto(nombre, nota);
  }
  }

  // ─────────────────────────────────────────────────────────────
  // 4: Ranking con cinco amigos
  // ─────────────────────────────────────────────────────────────
  //
  // Las rachas van repartidas ALREDEDOR de la propia y no todas por debajo:
  // una tabla donde uno va primero por goleada no muestra para qué sirve la
  // pantalla. Con gente arriba y gente abajo se lee lo que es.
  if (HACER_RANKING) {
  const AMIGOS = [
    // `martina` a secas ya estaba tomado en producción.
    ['martina_p', 147],
    ['fede_rossi', 112],
    ['lucia_g', 63],
    ['juanma', 28],
    ['nico_b', 12],
  ];
  const mio = await cuenta('r0', 'agustin_c', 86);
  cuentas.push(mio);
  for (const [usuario, dias] of AMIGOS) {
    const c = await cuenta(usuario, usuario, dias);
    cuentas.push(c);
    // La amistad se arma como se arma: el otro pide y uno acepta. La base no
    // deja otra cosa —una fila nace pendiente y solo el destinatario la pasa a
    // aceptada— así que acá tampoco hay atajo.
    const { data: pedido } = await c.s
      .from('friendships')
      .insert({ solicitante: c.uid, destinatario: mio.uid })
      .select('id')
      .single();
    if (pedido?.id) await mio.s.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id);
  }
  await entrarEnLaNativa(mio.correo);
  await page.getByRole('tab', { name: 'Ranking' }).click({ timeout: 60000 });
  await page.waitForTimeout(6000);
  await foto('4-ranking', 'seis en la tabla, rachas de 12 a 147');
  }

  // ─────────────────────────────────────────────────────────────
  // 5 y 6: la galaxia y el agujero negro, de la galería
  // ─────────────────────────────────────────────────────────────
  //
  // SIN EL PANEL DE CONTROLES: la galería es un banco de trabajo, con botones
  // por todos lados. Lo que sirve para la tienda es lo que hay DETRÁS de esos
  // botones, así que se esconde el panel y queda el fondo a sangre.
  if (HACER_GALERIA) {
  await page.goto(WEB + '/login', { waitUntil: 'domcontentloaded', timeout: 240000 });
  // LA PANTALLA DE BIENVENIDA VA PRIMERO. La web abre con ella y el formulario
  // no existe hasta pasarla, así que buscar el campo de correo de una da un
  // timeout de treinta segundos contra una pantalla que está perfecta.
  await pasarLaEntrada(page);
  await page.locator('input[type=email]').first().fill(process.env.CONEXION_EMAIL ?? '');
  await page.locator('input[type=password]').first().fill(process.env.CONEXION_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 180000 });
  // EL MOTOR, A LA FUERZA. La web mira el equipo antes de cargar three.js
  // —cuatro núcleos o menos, o 4 GB o menos, y no lo carga (`equipoFlojo` en
  // `src/lib/fondo.ts`)— y un Chromium sin cabeza informa números de equipo
  // flojo. Resultado: la galería no dibujaba nada y la captura salía siendo un
  // degradado con cuatro estrellas. Es la misma preferencia que se elige en
  // Ajustes, puesta en "siempre".
  await page.evaluate(() => localStorage.setItem('ascent:fondo', 'siempre'));
  await page.goto(WEB + '/galeria', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.getByRole('heading', { name: 'Rango', exact: true }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'al centro (para mirarlo)' }).click();
  await page.waitForTimeout(1500);

  for (const [etiqueta, nombre] of [
    ['Galaxia', '5-galaxia'],
    ['Agujero negro', '6-agujero-negro'],
  ]) {
    await page.getByRole('button', { name: etiqueta, exact: false }).first().click();
    // EL MOTOR SE REMONTA ENTERO con `key`, así que hay que esperar a que
    // compile. NO CON UN TIMEOUT GENEROSO: nueve segundos no alcanzaron y la
    // primera galaxia salió siendo un degradado violeta con cuatro estrellas
    // —el lienzo estaba, vacío—. La web ya tiene la señal que hace falta: le
    // pone la clase `listo` al contenedor cuando el primer cuadro se dibujó, y
    // es lo que usa para su propio fundido de entrada.
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => !!document.querySelector('.fondo-lienzo.listo'), null, {
      timeout: 120000,
    });
    // Y el fundido dura lo suyo.
    await page.waitForTimeout(4000);
    // SE ESCONDE TODO MENOS EL FONDO. `.pantalla` es el panel de controles,
    // pero no es lo único encima: hay otro `div` con el logo, y en la primera
    // corrida quedaron dos enes flotando en una captura por lo demás vacía.
    const soloElFondo = (mostrar) =>
      page.evaluate((v) => {
        for (const e of document.body.children) {
          if (e.classList?.contains('fondo-espacial')) continue;
          if (e.tagName !== 'DIV') continue;
          e.style.display = v;
        }
      }, mostrar);
    await soloElFondo('none');
    await page.waitForTimeout(600);
    await foto(nombre, `de la galería, al centro`);
    await soloElFondo('');
    await page.waitForTimeout(600);
  }
  }
} finally {
  await nav.close();
  console.log('\n  borrando las cuentas de la sesión de fotos…');
  for (const c of cuentas) {
    const { error } = await c.s.rpc('eliminar_cuenta');
    if (error) console.log(`  aviso: ${c.usuario} no se borró — ${error.message}`);
  }
  console.log(`  ${cuentas.length} borradas.`);
  console.log(`\n  ${hechas.length} capturas en ${SALIDA}\n`);
}
