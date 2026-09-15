// Corre supabase/schema.sql contra un Postgres real (PGlite, WASM) y verifica
// la matemática de racha / rangos / pérdida. Sustituye lo que Supabase aporta
// (auth.users, auth.uid(), storage, roles) por stubs mínimos.
// Correr con: npm run test:db
import { PGlite } from '@electric-sql/pglite';
// Las reglas que están escritas dos veces, una acá y otra en el schema. Se
// importan del código real —no una copia— para poder correr las dos contra
// los mismos valores. `reglas.ts` no importa nada justamente para que Node
// pueda cargarlo sin el alias `@/` ni el resolvedor de Next.
import {
  DESCANSO_MAXIMO,
  DESCANSO_MINIMO,
  DESCANSO_PREDETERMINADO,
  PISO_SESION_SEGUNDOS,
  PLANETAS,
  TOPE_SESION_SEGUNDOS,
  VENTANA_INACTIVIDAD_SEGUNDOS,
  descansosVigentes,
  numeroDeRango,
  planetaDeDia,
  unRM,
} from '../nucleo/reglas.ts';
import { PLANETAS_CFG } from '../src/motor/cuerpos.ts';
import { agruparPorDia, ESTADO_CON_DURACION, etiquetaDeDia } from '../nucleo/dias.ts';
import {
  CATEGORIAS,
  EJERCICIOS_ESTANDAR,
  muestraFina,
  esSexoEstandar,
  ubicar,
  umbrales,
} from '../nucleo/estandares.ts';
import {
  EJERCICIOS_DOTS,
  ESTADOS_AMISTAD,
  ESTADOS_RETO,
  ESTADOS_SESION,
  ORIGENES_DIA,
  SEXOS,
  TIPOS_FEEDBACK,
  UNIDADES_PESO,
  VISIBILIDADES,
  ORIGENES_SESION,
} from '../nucleo/tipos.ts';
import { decidir } from '../nucleo/llegada.ts';
import {
  clasificar,
  decidirRuta,
  hayCookiesDeSesion,
  llevarCookies,
} from '../nucleo/veredicto.ts';
// `next/server.js` y no `next/server`: node necesita el especificador exacto.
// Se usa el NextResponse DE VERDAD porque el bug era de esa clase, no de una
// imitación nuestra.
import { NextResponse } from 'next/server.js';
import { ESPERA_LLEGADA_MS } from '../nucleo/reglas.ts';
import { eventos } from '../compartido/eventos.ts';
import { estaAdentro, medicionSirve, metrosEntre, PRECISION_MAXIMA } from '../nucleo/geo.ts';
import {
  bloquesVacios,
  cambiarEjercicio,
  cambiarMeta,
  metaCumplida,
  paraGuardar,
  restar,
  corregirBloque,
  mudarEjercicio,
  quitarBloque,
  sembrar,
  siguiente,
  sumar,
} from '../nucleo/bloques.ts';
import { cargarElMotor, esPreferenciaFondo } from '../nucleo/fondo.ts';
import { ORDEN_ZONAS, gruposDeZona, gruposSinZona } from '../nucleo/ejercicios.ts';
import { detectar, idDeSenal, umbralValido, unRm } from '../nucleo/estancamiento.ts';
import { suavizarPorFecha, ultimosDias } from '../nucleo/peso.ts';
import { PATRON_USUARIO, nombreValido } from '../nucleo/usuario.ts';
import { tokensDeUrl } from '../nucleo/enlace.ts';
import {
  alturaDelPulso,
  siguePulsando,
  SUBIDA_MS,
  VUELTA_MS,
  DURACION_MS,
} from '../src/lib/pulso.ts';
import {
  desarmeEn,
  brilloEn,
  sigueSalvando,
  dispersionDesde,
  posicionesEn,
  DESARME_MS,
  SUELTO_MS,
  DURACION_MS as SALVADA_MS,
} from '../src/lib/salvada.ts';
import { impulsosSinVer, hastaDondeVisto, rachaSiSeDevuelve } from '../nucleo/impulsos.ts';
import { cacheTrasConfirmar } from '../nucleo/sesiones.ts';
import {
  veloDeRango,
  msDeTransicion,
  faltanParaSubir,
  hayPresagio,
  MS_ABRIR,
  MS_CERRAR,
} from '../nucleo/atmosfera.ts';
import * as SUB from '../src/lib/subida.ts';
import { avisoDiario } from '../nucleo/avisoDiario.ts';
import { hayQueContar, valorContado, SALTO_MAXIMO } from '../src/lib/contar.ts';
import { bordeDePalabra, retrocesosEnTemplate, sinComentarios } from './utiles.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RUTA_SCHEMA = join(dirname(fileURLToPath(import.meta.url)), 'schema.sql');

let ok = 0;
let fallos = [];

function chequear(nombre, real, esperado) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  ok   ${nombre}`);
  } else {
    fallos.push(`${nombre}: esperado ${b}, obtuve ${a}`);
    console.log(`  FALLA ${nombre}: esperado ${b}, obtuve ${a}`);
  }
}

const db = new PGlite();

// ---- stubs de lo que pone Supabase ----
// UTC como en Supabase: si el test corriera en la zona local, `mi_hoy()` y
// `mi_hoy()` coincidirían y el problema que la migración 12 arregla
// quedaría invisible justo en el lugar que tiene que cazarlo.
await db.exec(`set timezone = 'UTC'`);
await db.exec(`
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $fn$
    select nullif(current_setting('test.uid', true), '')::uuid;
  $fn$;
  create role authenticated;
  create role anon;
  create role service_role;
`);

// ---- schema real, sin la parte de storage (que PGlite no tiene) ----
// NO se inyecta ningún grant: el schema tiene que traer los suyos. Si alguien
// vuelve a depender de los privilegios por defecto del host, esto lo caza.
let sql = readFileSync(RUTA_SCHEMA, 'utf8');
const iniStorage = sql.indexOf('-- STORAGE: bucket privado de fotos');
const iniPermisos = sql.indexOf('-- PERMISOS (capa extra debajo de la RLS)');
if (iniStorage === -1 || iniPermisos === -1) throw new Error('no encuentro los marcadores');
sql =
  sql.slice(0, sql.lastIndexOf('-- ----', iniStorage)) +
  sql.slice(sql.lastIndexOf('-- ----', iniPermisos));

await db.exec(sql);
console.log('schema cargado sin errores\n');

// ---- helpers ----
async function nuevoUsuario() {
  const r = await db.query('insert into auth.users default values returning id');
  const id = r.rows[0].id;
  await db.query('update profiles set username = $1 where id = $2', [
    'u' + id.slice(0, 8).replace(/-/g, ''),
    id,
  ]);
  return id;
}
async function comoUsuario(id) {
  await db.query(`select set_config('test.uid', $1, false)`, [id]);
}
// inserta días consecutivos que TERMINAN hace `finHace` días
async function rachaDe(uid, dias, finHace = 0) {
  for (let i = dias - 1; i >= 0; i--) {
    await db.query(
      `insert into logs (user_id, fecha) values ($1, mi_hoy() - $2::int)`,
      [uid, i + finHace]
    );
  }
}
async function perfil(uid) {
  const r = await db.query(
    'select racha_actual, mejor_racha, rango_actual, racha_base from profiles where id = $1',
    [uid]
  );
  return r.rows[0];
}
/**
 * LAS VIDAS, PRENDIDAS O APAGADAS, para el resto de los tests.
 *
 * Sin esto, cada test de pérdida pasaría a hablar de dos cosas: la regla del
 * -10 y si había una vida a mano. Los de acá abajo son de la regla, así que
 * corren con la cuota en cero; las vidas tienen su propia sección, que las
 * prende, prueba lo suyo y las vuelve a apagar.
 *
 * Se cambia la CUOTA y no se tocan las filas: es el único punto donde la
 * regla vive, y así el resto de la maquinaria —cubrir, contar, no devolver—
 * es exactamente la de producción.
 */
// Cuantos impulsos tiene TODO el mundo, para las pruebas.
//
// Se redefine `impulsos_ganados` y no el tope: la regla de verdad es "dos, y
// el tercero a los 20 dias de racha", y casi ningun test de perdida quiere
// pensar en eso. Con esto se fija el numero y se prueba una cosa por vez; la
// regla que los gana tiene su propia seccion, que es donde debe probarse.
async function cuotaDeVidas(n) {
  await db.query(
    `create or replace function public.impulsos_ganados(p_user uuid)
     returns int language sql stable security definer set search_path = public
     as $fn$ select case when p_user is null then 0 else ${n} end $fn$`
  );
}

async function perder(uid) {
  await comoUsuario(uid);
  const r = await db.query('select verificar_perdida() as v');
  return r.rows[0].v;
}

await cuotaDeVidas(0);

// =====================================================================
console.log('1. Umbrales de rango (cada 10 días, tope en 8)');
{
  const r = await db.query(`
    select array_agg(rango_de_racha(x) order by x) as g
    from unnest(array[0,1,9,10,19,20,29,30,39,40,49,50,59,60,69,70,79,80,150]) x
  `);
  chequear(
    'racha → rango',
    r.rows[0].g,
    [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 8, 8]
  );
}

// =====================================================================
console.log('\n2. Racha se acumula y el rango sube solo');
{
  const u = await nuevoUsuario();
  await rachaDe(u, 30);
  chequear('30 días', await perfil(u), {
    racha_actual: 30,
    mejor_racha: 30,
    rango_actual: 4,
    racha_base: 0,
  });
}

// =====================================================================
console.log('\n3. Planeta del día: rachas 30..39 = Ceres..Júpiter');
{
  const u = await nuevoUsuario();
  await rachaDe(u, 41);
  const r = await db.query(
    `select planeta_del_dia from logs where user_id = $1 and planeta_del_dia is not null order by fecha`,
    [u]
  );
  chequear(
    'secuencia de planetas',
    r.rows.map((x) => x.planeta_del_dia),
    ['Ceres', 'Plutón', 'Mercurio', 'Marte', 'Venus', 'Tierra', 'Neptuno', 'Urano', 'Saturno', 'Júpiter']
  );
  chequear('racha 41 no tiene planeta', (await perfil(u)).rango_actual, 5);
}

// =====================================================================
console.log('\n4. Pérdida: resta 10 días (los tres casos de la spec)');
{
  // racha 14 → 4
  const a = await nuevoUsuario();
  await rachaDe(a, 14, 2); // termina anteayer: ayer quedó vacío
  chequear('previo 14', (await perfil(a)).racha_actual, 14);
  const ra = await perder(a);
  chequear('14 → 4', [ra.perdida, ra.racha], [true, 4]);
  chequear('rango tras perder', (await perfil(a)).rango_actual, 1);

  // racha 47 → 37
  const b = await nuevoUsuario();
  await rachaDe(b, 47, 2);
  const rb = await perder(b);
  chequear('47 → 37', [rb.perdida, rb.racha], [true, 37]);
  chequear('rango 5 → 4', (await perfil(b)).rango_actual, 4);

  // racha 6 → 0
  const c = await nuevoUsuario();
  await rachaDe(c, 6, 2);
  const rc = await perder(c);
  chequear('6 → 0', [rc.perdida, rc.racha], [true, 0]);
  chequear('rango vuelve a 1', (await perfil(c)).rango_actual, 1);

  // mejor_racha sobrevive
  chequear('mejor racha se conserva', (await perfil(b)).mejor_racha, 47);
}

// =====================================================================
console.log('\n5. No castiga dos veces por el mismo corte');
{
  const u = await nuevoUsuario();
  await rachaDe(u, 25, 3);
  await perder(u);
  chequear('primera pérdida', (await perfil(u)).racha_actual, 15);
  const otra = await perder(u);
  chequear('segunda llamada no resta', otra.perdida, false);
  chequear('racha intacta', (await perfil(u)).racha_actual, 15);
}

// =====================================================================
console.log('\n6. Volver después de perder suma sobre lo conservado');
{
  const u = await nuevoUsuario();
  await rachaDe(u, 14, 2);
  await perder(u); // → 4
  await db.query(`insert into logs (user_id, fecha) values ($1, mi_hoy())`, [u]);
  chequear('4 + 1 = 5 (no 15)', (await perfil(u)).racha_actual, 5);
}

// =====================================================================
console.log('\n7. Corregir un día viejo no saltea la regla de -10');
{
  const u = await nuevoUsuario();
  await rachaDe(u, 14, 2);
  // corrección manual de un día suelto muy anterior, estando ya cortado
  await db.query(`insert into logs (user_id, fecha) values ($1, mi_hoy() - 40)`, [u]);
  chequear('racha no se desploma a 0', (await perfil(u)).racha_actual, 14);
  const r = await perder(u);
  chequear('la pérdida sí aplica -10', [r.perdida, r.racha], [true, 4]);
}

// =====================================================================
console.log('\n8. Días de descanso no cortan la racha');
{
  const u = await nuevoUsuario();
  // descanso fijo: el día de la semana de "ayer"
  const dow = (
    await db.query(`select extract(dow from mi_hoy() - 1)::int as d`)
  ).rows[0].d;
  // la configuración se fecha bien atrás para que cubra los días de la prueba
  await db.query('insert into descansos (user_id, desde, dias) values ($1, mi_hoy() - 60, array[$2::int])', [u, dow]);
  await rachaDe(u, 5, 2); // días -6..-2
  await db.query(`insert into logs (user_id, fecha) values ($1, mi_hoy())`, [u]);
  // ayer no tiene log pero es descanso fijo → no corta
  chequear('descanso fijo no corta', (await perfil(u)).racha_actual, 6);
  const r = await perder(u);
  chequear('no hay pérdida', r.perdida, false);
}
{
  const u = await nuevoUsuario();
  await rachaDe(u, 3);
  await db.query(
    `insert into logs (user_id, fecha, es_descanso) values ($1, mi_hoy() - 3, true)`,
    [u]
  );
  await db.query(`insert into logs (user_id, fecha) values ($1, mi_hoy() - 4)`, [u]);
  chequear('log de descanso no suma pero no corta', (await perfil(u)).racha_actual, 4);
}

// =====================================================================
console.log('\n8b. Cambiar los descansos NO altera ningún día anterior');
{
  // Alguien que entrena de lunes a viernes y descansa sábado y domingo.
  const u = await nuevoUsuario();
  await comoUsuario(u);
  const dowHoy = (await db.query('select extract(dow from mi_hoy())::int as d')).rows[0].d;
  // configuración vieja: descansan los dos días de hace 3 y 4 días
  const viejoA = (dowHoy - 3 + 7) % 7;
  const viejoB = (dowHoy - 4 + 7) % 7;
  await db.query('insert into descansos (user_id, desde, dias) values ($1, mi_hoy() - 30, $2)', [
    u,
    [viejoA, viejoB],
  ]);
  // entrena hoy, ayer, anteayer y hace 5 días; los de hace 3 y 4 eran descanso
  for (const i of [5, 2, 1, 0]) {
    await db.query('insert into logs (user_id, fecha) values ($1, mi_hoy() - $2::int)', [u, i]);
  }
  chequear('racha con la config vieja', (await perfil(u)).racha_actual, 4);

  // ahora cambia de rutina: pasa a descansar OTROS días
  const nuevoA = (dowHoy - 1 + 7) % 7;
  await db.query(`select set_config('test.uid', $1, false)`, [u]);
  await db.query('select fijar_descansos($1)', [[nuevoA]]);

  chequear('la racha del pasado no se movió', (await perfil(u)).racha_actual, 4);
  const dv = await db.query(
    `select descansos_vigentes($1, mi_hoy() - 3) as antes,
            descansos_vigentes($1, mi_hoy()) as ahora`,
    [u]
  );
  chequear('el día viejo conserva su configuración', dv.rows[0].antes.sort(), [viejoA, viejoB].sort());
  chequear('hoy rige la nueva', dv.rows[0].ahora, [nuevoA]);
}
{
  // El caso concreto que reportó el humano: sacar todos los descansos no
  // puede romper una racha que dependía de ellos.
  const u = await nuevoUsuario();
  await comoUsuario(u);
  const dowAyer = (await db.query('select extract(dow from mi_hoy() - 1)::int as d')).rows[0].d;
  await db.query('insert into descansos (user_id, desde, dias) values ($1, mi_hoy() - 60, $2)', [
    u,
    [dowAyer],
  ]);
  // entrena hoy y hace 2 días; ayer fue descanso, así que la racha vale 2
  await db.query('insert into logs (user_id, fecha) values ($1, mi_hoy() - 2)', [u]);
  await db.query('insert into logs (user_id, fecha) values ($1, mi_hoy())', [u]);
  chequear('racha apoyada en un descanso', (await perfil(u)).racha_actual, 2);

  await db.query('select fijar_descansos($1)', [[]]); // sin descansos
  chequear('sacar los descansos no rompe el pasado', (await perfil(u)).racha_actual, 2);
}
{
  // El cambio rige de hoy en adelante: mañana ya no habrá descanso
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await db.query('select fijar_descansos($1)', [[0, 1, 2, 3, 4, 5, 6]]);
  const r = await db.query(
    `select descansos_vigentes($1, mi_hoy() - 1) as ayer,
            descansos_vigentes($1, mi_hoy()) as hoy`,
    [u]
  );
  chequear('ayer no hereda la config nueva', r.rows[0].ayer, []);
  chequear('hoy sí la tiene', r.rows[0].hoy.length, 7);
}
{
  // Un usuario no puede escribir descansos a mano ni fecharlos hacia atrás
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await db.exec('set role authenticated');
  let bloqueado = null;
  try {
    await db.query('insert into descansos (user_id, desde, dias) values ($1, mi_hoy() - 90, $2)', [u, [1]]);
    bloqueado = false;
  } catch (e) {
    bloqueado = /permission denied|policy|row-level/i.test(e.message);
  }
  chequear('no se pueden insertar descansos con fecha vieja', bloqueado, true);

  let perfilBloqueado = null;
  try {
    await db.query('update profiles set dias_descanso = $1 where id = $2', [[3], u]);
    perfilBloqueado = false;
  } catch (e) {
    perfilBloqueado = /permission denied/i.test(e.message);
  }
  chequear('tampoco se puede pisar el espejo del perfil', perfilBloqueado, true);
  await db.exec('reset role');
}

// =====================================================================
console.log('\n8c. La mejor racha sale del historial (baja si se borran días)');
{
  const u = await nuevoUsuario();
  await rachaDe(u, 12);
  chequear('12 días seguidos', (await perfil(u)).mejor_racha, 12);
  // se borran 6 registrados por error
  for (let i = 11; i >= 6; i--) {
    await db.query('delete from logs where user_id = $1 and fecha = mi_hoy() - $2::int', [u, i]);
  }
  chequear('el récord baja al borrarlos', (await perfil(u)).mejor_racha, 6);
  chequear('y la racha también', (await perfil(u)).racha_actual, 6);
}
{
  // Pero un récord legítimo NO se pierde al cortarse la racha
  const u = await nuevoUsuario();
  await rachaDe(u, 15, 5); // 15 días que terminaron hace 5
  await rachaDe(u, 2); // y 2 días ahora
  const p = await perfil(u);
  chequear('la racha actual es la corta', p.racha_actual, 2);
  chequear('pero el récord conserva los 15', p.mejor_racha, 15);
}
{
  // El piso de misericordia no puede quedar por encima del récord
  const u = await nuevoUsuario();
  await rachaDe(u, 25, 2);
  await comoUsuario(u);
  await db.query('select verificar_perdida()');
  const p = await perfil(u);
  chequear('tras perder, el récord sigue siendo el real', p.mejor_racha, 25);
  chequear('y la racha bajó 10', p.racha_actual, 15);
}

// =====================================================================
console.log('\n9. registrar_dia: RPC devuelve el salto de rango');
{
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await rachaDe(u, 9, 1); // 9 días terminando ayer
  const r = await db.query(
    `select anotar_peso(82.5), registrar_dia() as v`
  );
  const v = r.rows[0].v;
  chequear('subió de rango', [v.racha, v.rango_antes, v.rango_despues, v.subio_rango], [10, 1, 2, true]);
  const p = await db.query('select valor from weights where user_id = $1', [u]);
  chequear('peso guardado', Number(p.rows[0].valor), 82.5);
}

// =====================================================================
console.log('\n10. Un día no se puede registrar dos veces');
{
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await db.query(`select registrar_dia()`);
  let error = null;
  try {
    await db.query(`select registrar_dia()`);
  } catch (e) {
    error = e.message.includes('duplicate') || e.message.includes('unique');
  }
  chequear('segundo registro rechazado', error, true);
}

// =====================================================================
console.log('\n11. recalcular_desde_cero devuelve el número FINAL (sin rebote)');
{
  // historial cortado: recalcular tiene que aplicar el -10 en la misma
  // transacción y no mostrar un número que después baja solo al recargar
  const u = await nuevoUsuario();
  await rachaDe(u, 14, 2);
  await perder(u); // → 4
  await comoUsuario(u);
  const r = (await db.query('select recalcular_desde_cero() as v')).rows[0].v;
  chequear('devuelve el final, no el del historial', [r.racha, r.racha_historial], [4, 14]);
  chequear('avisa que aplicó pérdida', r.perdida, true);
  chequear('la base coincide con lo devuelto', (await perfil(u)).racha_actual, 4);
  // recargar no cambia nada: no hay rebote
  const otra = await perder(u);
  chequear('recargar no mueve el número', [otra.perdida, (await perfil(u)).racha_actual], [false, 4]);
  // y volver a recalcular da lo mismo (idempotente)
  const r2 = (await db.query('select recalcular_desde_cero() as v')).rows[0].v;
  chequear('recalcular es idempotente', r2.racha, 4);
}
{
  // historial sano: recalcular NO castiga
  const u = await nuevoUsuario();
  await rachaDe(u, 12); // termina hoy
  await comoUsuario(u);
  const r = (await db.query('select recalcular_desde_cero() as v')).rows[0].v;
  chequear('historial continuo no pierde nada', [r.racha, r.perdida], [12, false]);
}

// =====================================================================
console.log('\n12. Seguridad: un usuario NO puede escribir su racha');
{
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await db.exec('set role authenticated');
  let bloqueado = null;
  try {
    await db.query('update profiles set racha_actual = 9999 where id = $1', [u]);
    bloqueado = false;
  } catch (e) {
    bloqueado = /permission denied|denegado/i.test(e.message);
  }
  chequear('update de racha_actual bloqueado', bloqueado, true);

  let permitido = null;
  try {
    await db.query('update profiles set username = $1 where id = $2', ['nuevo_nombre', u]);
    permitido = true;
  } catch (e) {
    permitido = e.message;
  }
  chequear('update de username permitido', permitido, true);
  await db.exec('reset role');
}

// =====================================================================
console.log('\n13. Seguridad: el peso de otro no se lee, ni con amistad');
{
  const a = await nuevoUsuario();
  const b = await nuevoUsuario();
  await comoUsuario(a);
  await db.query(`select anotar_peso(80), registrar_dia()`);
  // se hacen amigos
  await db.query(
    `insert into friendships (solicitante, destinatario, estado) values ($1, $2, 'aceptada')`,
    [a, b]
  );
  await comoUsuario(b);
  await db.exec('set role authenticated');
  const pesos = await db.query('select * from weights where user_id = $1', [a]);
  chequear('peso del amigo invisible', pesos.rows.length, 0);
  const logs = await db.query('select * from logs where user_id = $1', [a]);
  chequear('logs del amigo sí visibles', logs.rows.length, 1);
  await db.exec('reset role');
}

// =====================================================================
console.log('\n14. Seguridad: sin amistad no se ve nada del otro');
{
  const a = await nuevoUsuario();
  const b = await nuevoUsuario();
  await comoUsuario(a);
  await db.query(`select anotar_peso(75), registrar_dia()`);
  await comoUsuario(b);
  await db.exec('set role authenticated');
  const logs = await db.query('select * from logs where user_id = $1', [a]);
  chequear('logs de un extraño invisibles', logs.rows.length, 0);
  const perfiles = await db.query('select * from profiles where id = $1', [a]);
  chequear('perfil de un extraño invisible', perfiles.rows.length, 0);
  const publico = await db.query('select * from usuarios_publicos where id = $1', [a]);
  chequear('la vista pública sí lo muestra', publico.rows.length, 1);
  await db.exec('reset role');
}

// =====================================================================
console.log('\n15. Seguridad: no se puede forjar una amistad ajena');
{
  const a = await nuevoUsuario();
  const b = await nuevoUsuario();
  await comoUsuario(b);
  await db.exec('set role authenticated');
  let bloqueado = null;
  try {
    const r = await db.query(
      `insert into friendships (solicitante, destinatario, estado)
       values ($1, $2, 'aceptada') returning id`,
      [a, b]
    );
    bloqueado = r.rows.length === 0;
  } catch (e) {
    bloqueado = /row-level security|policy/i.test(e.message);
  }
  chequear('amistad auto-aceptada rechazada', bloqueado, true);
  await db.exec('reset role');
}

// =====================================================================
console.log('\n16. El planeta lo decide el trigger, no el cliente');
{
  const u = await nuevoUsuario();
  await db.query(
    `insert into logs (user_id, fecha, planeta_del_dia) values ($1, mi_hoy(), 'Júpiter')`,
    [u]
  );
  const r = await db.query('select planeta_del_dia from logs where user_id = $1', [u]);
  chequear('planeta mentido descartado', r.rows[0].planeta_del_dia, null);
}

// =====================================================================
console.log('\n17. Eliminar amigo: corta la amistad y el reto vigente');
{
  const a = await nuevoUsuario();
  const b = await nuevoUsuario();
  await db.query(
    `insert into friendships (solicitante, destinatario, estado) values ($1, $2, 'aceptada')`,
    [a, b]
  );
  await db.query(
    `insert into challenges (retador, rival, desde, hasta, estado)
     values ($1, $2, mi_hoy(), mi_hoy() + 6, 'activo')`,
    [a, b]
  );
  await comoUsuario(b); // lo elimina el OTRO lado, no el que pidió la amistad
  await db.query('select eliminar_amigo($1)', [a]);
  const am = await db.query(
    `select * from friendships where (solicitante = $1 and destinatario = $2)
     or (solicitante = $2 and destinatario = $1)`,
    [a, b]
  );
  chequear('amistad borrada desde cualquier lado', am.rows.length, 0);
  const re = await db.query(
    `select * from challenges where estado in ('pendiente','activo')`
  );
  chequear('reto vigente cerrado', re.rows.length, 0);
  // y se pueden volver a agregar sin que el índice único los bloquee
  await db.query(
    `insert into friendships (solicitante, destinatario, estado) values ($1, $2, 'aceptada')`,
    [b, a]
  );
  await db.query(
    `insert into challenges (retador, rival, desde, hasta, estado)
     values ($1, $2, mi_hoy(), mi_hoy() + 6, 'pendiente')`,
    [b, a]
  );
  chequear('se pueden volver a retar', true, true);
}

// =====================================================================
console.log('\n18. Eliminar amigo ajeno no toca nada de terceros');
{
  const a = await nuevoUsuario();
  const b = await nuevoUsuario();
  const c = await nuevoUsuario();
  await db.query(
    `insert into friendships (solicitante, destinatario, estado) values ($1, $2, 'aceptada')`,
    [a, b]
  );
  await comoUsuario(c); // c no tiene nada que ver
  await db.query('select eliminar_amigo($1)', [a]);
  const am = await db.query(
    `select * from friendships where (solicitante = $1 and destinatario = $2)`,
    [a, b]
  );
  chequear('la amistad de otros sobrevive', am.rows.length, 1);
}

// =====================================================================
console.log('\n19. Borrar foto: solo el dueño');
{
  const a = await nuevoUsuario();
  const b = await nuevoUsuario();
  await comoUsuario(a);
  await db.query(`select registrar_dia()`);
  const log = await db.query('select id from logs where user_id = $1', [a]);
  await db.query(
    `insert into photos (user_id, log_id, storage_path, visibilidad)
     values ($1, $2, $3, 'amigos')`,
    [a, log.rows[0].id, a + '/foto.jpg']
  );
  await db.query(
    `insert into friendships (solicitante, destinatario, estado) values ($1, $2, 'aceptada')`,
    [a, b]
  );
  // el amigo la ve pero no la puede borrar
  await comoUsuario(b);
  await db.exec('set role authenticated');
  const vistas = await db.query('select * from photos where user_id = $1', [a]);
  chequear('el amigo la ve', vistas.rows.length, 1);
  await db.query('delete from photos where user_id = $1', [a]);
  await db.exec('reset role');
  const siguen = await db.query('select * from photos where user_id = $1', [a]);
  chequear('el amigo no la pudo borrar', siguen.rows.length, 1);
  // el dueño sí
  await comoUsuario(a);
  await db.exec('set role authenticated');
  await db.query('delete from photos where user_id = $1', [a]);
  await db.exec('reset role');
  const final = await db.query('select * from photos where user_id = $1', [a]);
  chequear('el dueño sí la borra', final.rows.length, 0);
}

// =====================================================================
console.log('\n19b. Corregir un día viejo recalcula los planetas posteriores');
{
  const u = await nuevoUsuario();
  // 39 días seguidos, pero salteando uno en el medio y agregándolo al final:
  // así se fuerza el caso de la corrección manual.
  const faltante = 20;
  for (let i = 38; i >= 0; i--) {
    if (i === faltante) continue;
    await db.query(`insert into logs (user_id, fecha) values ($1, mi_hoy() - $2::int)`, [u, i]);
  }
  const antes = await db.query(
    `select planeta_del_dia from logs where user_id = $1 and planeta_del_dia is not null order by fecha`,
    [u]
  );
  chequear(
    'con el hueco, la racha corta y no hay planetas',
    antes.rows.map((x) => x.planeta_del_dia),
    []
  );
  // ahora se corrige el día que faltaba
  await db.query(`insert into logs (user_id, fecha) values ($1, mi_hoy() - $2::int)`, [u, faltante]);
  chequear('la racha se completa', (await perfil(u)).racha_actual, 39);
  const despues = await db.query(
    `select planeta_del_dia from logs where user_id = $1 and planeta_del_dia is not null order by fecha`,
    [u]
  );
  chequear(
    'los diez planetas quedan bien, sin corrimiento',
    despues.rows.map((x) => x.planeta_del_dia),
    ['Ceres', 'Plutón', 'Mercurio', 'Marte', 'Venus', 'Tierra', 'Neptuno', 'Urano', 'Saturno', 'Júpiter']
  );
  // y borrar un día viejo tiene que limpiarlos de nuevo
  await db.query(`delete from logs where user_id = $1 and fecha = mi_hoy() - $2::int`, [u, faltante]);
  const tras = await db.query(
    `select count(*)::int as n from logs where user_id = $1 and planeta_del_dia is not null`,
    [u]
  );
  chequear('al volver a romperlo se limpian', tras.rows[0].n, 0);
}

// =====================================================================
console.log('\n20. El schema trae sus propios permisos (no los del host)');
{
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await db.exec('set role authenticated');
  // lo que la app necesita de verdad
  let leer = null;
  try {
    await db.query('select racha_actual from profiles where id = $1', [u]);
    await db.query('select id from logs where user_id = $1', [u]);
    await db.query('select id from weights where user_id = $1', [u]);
    await db.query('select id from usuarios_publicos limit 1');
    leer = true;
  } catch (e) {
    leer = e.message;
  }
  chequear('un usuario con sesión puede leer lo suyo', leer, true);

  let insertar = null;
  try {
    await db.query('insert into logs (user_id, fecha) values ($1, mi_hoy())', [u]);
    insertar = true;
  } catch (e) {
    insertar = e.message;
  }
  chequear('puede registrar un día', insertar, true);

  let feedback = null;
  try {
    await db.query('insert into feedback (user_id, texto) values ($1, $2)', [u, 'hola']);
    feedback = true;
  } catch (e) {
    feedback = e.message;
  }
  chequear('puede mandar feedback', feedback, true);

  let leerFeedback = null;
  try {
    await db.query('select * from feedback');
    leerFeedback = false; // no debería poder
  } catch (e) {
    leerFeedback = /permission denied/i.test(e.message);
  }
  chequear('no puede leer el feedback de nadie', leerFeedback, true);
  await db.exec('reset role');
}
{
  // anon no recibe nada
  await db.exec('set role anon');
  let bloqueado = null;
  try {
    await db.query('select * from profiles');
    bloqueado = false;
  } catch (e) {
    bloqueado = /permission denied/i.test(e.message);
  }
  chequear('sin sesión no se toca ninguna tabla', bloqueado, true);

  let fnBloqueada = null;
  try {
    await db.query('select calcular_racha($1, mi_hoy())', [
      '00000000-0000-0000-0000-000000000001',
    ]);
    fnBloqueada = false;
  } catch (e) {
    fnBloqueada = /permission denied/i.test(e.message);
  }
  chequear('sin sesión no se llama a calcular_racha', fnBloqueada, true);

  const r = await db.query('select rango_de_racha(35) as g');
  chequear('la matemática pura sí queda abierta', r.rows[0].g, 4);
  await db.exec('reset role');
}

// =====================================================================
console.log('\n21. Preferencias de perfil');
{
  const u = await nuevoUsuario();
  const p = (
    await db.query('select visibilidad_default, unidad_peso from profiles where id = $1', [u])
  ).rows[0];
  chequear('las fotos nuevas nacen privadas', p.visibilidad_default, 'privada');
  chequear('el peso arranca en kilos', p.unidad_peso, 'kg');

  let visInvalida = null;
  try {
    await db.query(`update profiles set visibilidad_default = 'publica' where id = $1`, [u]);
    visInvalida = false;
  } catch (e) {
    visInvalida = /check constraint/i.test(e.message);
  }
  chequear('no se puede inventar una visibilidad', visInvalida, true);

  let unidadInvalida = null;
  try {
    await db.query(`update profiles set unidad_peso = 'piedras' where id = $1`, [u]);
    unidadInvalida = false;
  } catch (e) {
    unidadInvalida = /check constraint/i.test(e.message);
  }
  chequear('no se puede inventar una unidad de peso', unidadInvalida, true);

  // el dueño las cambia solo; la racha sigue fuera de su alcance
  await comoUsuario(u);
  await db.exec('set role authenticated');
  let cambia = null;
  try {
    await db.query(
      `update profiles set visibilidad_default = 'amigos', unidad_peso = 'lb' where id = $1`,
      [u]
    );
    cambia = true;
  } catch (e) {
    cambia = e.message;
  }
  chequear('el dueño cambia sus preferencias', cambia, true);

  let racha = null;
  try {
    await db.query('update profiles set racha_actual = 999 where id = $1', [u]);
    racha = false;
  } catch (e) {
    racha = /permission denied/i.test(e.message);
  }
  chequear('pero sigue sin poder tocarse la racha', racha, true);
  await db.exec('reset role');
}

// =====================================================================
console.log('\n22. Eliminar la cuenta');
{
  const u = await nuevoUsuario();
  const otro = await nuevoUsuario();
  await rachaDe(u, 12);
  await db.query(`insert into weights (user_id, fecha, valor) values ($1, mi_hoy(), 80)`, [u]);
  await db.query(
    `insert into photos (user_id, storage_path) values ($1, $2)`,
    [u, `${u}/foto.jpg`]
  );
  await db.query(`insert into feedback (user_id, texto) values ($1, 'chau')`, [u]);
  await db.query(
    `insert into friendships (solicitante, destinatario, estado) values ($1, $2, 'aceptada')`,
    [u, otro]
  );
  // un reto ya cerrado y GANADO: challenges.ganador no tiene cascade, así que
  // es justo la fila que bloquearía el borrado si no se sacara a mano
  await db.query(
    `insert into challenges (retador, rival, desde, hasta, estado, ganador)
       values ($1, $2, mi_hoy() - 7, mi_hoy() - 1, 'terminado', $1)`,
    [u, otro]
  );
  await db.query(`select fijar_descansos(array[0,6]::int[])`);

  await comoUsuario(u);
  await db.exec('set role authenticated');
  let borro = null;
  try {
    await db.query('select eliminar_cuenta()');
    borro = true;
  } catch (e) {
    borro = e.message;
  }
  await db.exec('reset role');
  chequear('la cuenta se borra sin que la trabe el reto ganado', borro, true);

  const quedan = async (tabla, col = 'user_id') =>
    (await db.query(`select count(*)::int as n from ${tabla} where ${col} = $1`, [u])).rows[0].n;

  chequear('no queda el usuario', (await db.query('select count(*)::int as n from auth.users where id = $1', [u])).rows[0].n, 0);
  chequear('no queda el perfil', await quedan('profiles', 'id'), 0);
  chequear('no quedan logs', await quedan('logs'), 0);
  chequear('no quedan pesos', await quedan('weights'), 0);
  chequear('no quedan fotos', await quedan('photos'), 0);
  chequear('no quedan descansos', await quedan('descansos'), 0);
  chequear('no quedan sugerencias', await quedan('feedback'), 0);
  chequear(
    'no quedan amistades',
    (await db.query(
      'select count(*)::int as n from friendships where solicitante = $1 or destinatario = $1',
      [u]
    )).rows[0].n,
    0
  );
  chequear(
    'no quedan retos',
    (await db.query('select count(*)::int as n from challenges where retador = $1 or rival = $1', [u]))
      .rows[0].n,
    0
  );
  // el amigo tiene que seguir existiendo: se borra una cuenta, no las dos
  chequear(
    'el amigo sigue en pie',
    (await db.query('select count(*)::int as n from profiles where id = $1', [otro])).rows[0].n,
    1
  );
}
{
  // sin sesión no se borra nada
  await db.query(`select set_config('test.uid', '', false)`);
  await db.exec('set role authenticated');
  let sinSesion = null;
  try {
    await db.query('select eliminar_cuenta()');
    sinSesion = false;
  } catch (e) {
    sinSesion = /sin sesión/i.test(e.message);
  }
  chequear('sin sesión no borra nada', sinSesion, true);
  await db.exec('reset role');
}

// =====================================================================
console.log('\n23. Fuerza: 1RM y DOTS');
{
  // Epley: 1RM = peso × (1 + reps/30). Un "real" de una repetición y un
  // estimado de una repetición tienen que dar lo mismo.
  const e = await db.query(`
    select un_rm(100, 5, false)::float8 as est,
           un_rm(150, 1, true)::float8  as real1,
           un_rm(150, 1, false)::float8 as est1`);
  chequear('Epley con 5 repeticiones', Math.round(e.rows[0].est * 10) / 10, 116.7);
  chequear('un 1RM real es el peso tal cual', e.rows[0].real1, 150);
  // Epley crudo da 155 acá (peso × 31/30): una repetición no se extrapola
  chequear('real y estimado a 1 repetición coinciden', e.rows[0].est1, 150);

  // DOTS contra un caso PUBLICADO, no contra nuestra propia cuenta: es la
  // única forma de cazar un coeficiente mal tipeado. Un DOTS mal calculado
  // ordena mal el ranking y nadie lo nota, porque el número igual parece
  // razonable. Hombre de 90 kg con 650 kg de total = 420,3.
  const d = await db.query(`
    select dots(650, 90, 'm')::float8  as h,
           dots(400, 60, 'f')::float8  as m,
           dots(650, 90, 'f')::float8  as cruzado,
           dots(700, 300, 'm')::float8 as gigante,
           dots(700, 210, 'm')::float8 as tope,
           dots(650, 90, null)::float8 as sin_sexo,
           dots(null, 90, 'm')::float8 as sin_total`);
  chequear('DOTS hombre 90 kg / 650 kg = 420,29', d.rows[0].h, 420.29);
  chequear('DOTS mujer 60 kg / 400 kg = 443,42', d.rows[0].m, 443.42);
  chequear('los dos juegos de coeficientes son distintos', d.rows[0].h !== d.rows[0].cruzado, true);
  // fuera del rango calibrado el polinomio se dispara: se acota, no se extrapola
  chequear('300 kg se acota al tope de 210', d.rows[0].gigante, d.rows[0].tope);
  chequear('sin sexo no hay DOTS', d.rows[0].sin_sexo, null);
  chequear('sin total no hay DOTS', d.rows[0].sin_total, null);

  // Las bandas se fueron en la migración 28: el DOTS exacto lo ven los amigos.
  // `banda_dots` se borró en vez de quedarse sin llamadores — el próximo que
  // la encontrara iba a creer que la regla sigue vigente y la iba a usar.
}

// =====================================================================
console.log('\n24. Fuerza: marcas, total y lo que falta');
{
  const u = await nuevoUsuario();
  const cargar = (ej, peso, reps, real, dias) =>
    db.query(
      `insert into prs (user_id, ejercicio, peso, reps, es_real, fecha)
         values ($1, $2, $3, $4, $5, mi_hoy() - $6::int)`,
      [u, ej, peso, reps, real, dias]
    );

  // un 1RM "real" con más de una repetición es una contradicción
  let contradiccion = null;
  try {
    await cargar('sentadilla', 200, 5, true, 0);
    contradiccion = false;
  } catch (err) {
    contradiccion = /check constraint/i.test(err.message);
  }
  chequear('un 1RM real no puede tener 5 repeticiones', contradiccion, true);

  await comoUsuario(u);
  const falta = async () => (await db.query('select mi_fuerza() as f')).rows[0].f;

  chequear('sin marcas, lo que falta son las marcas', (await falta()).falta, 'marcas');

  // la marca VIEJA es mejor que la nueva: gana la mejor, no la más reciente
  await cargar('sentadilla', 140, 1, true, 400);
  await cargar('sentadilla', 120, 1, true, 1);
  await cargar('press_banca', 100, 1, true, 30);
  chequear('con dos de tres todavía no hay total', (await falta()).total, null);

  await cargar('peso_muerto', 150, 3, false, 10); // Epley: 150 × 1,1 = 165
  let f = await falta();
  chequear('el total suma los tres mejores', Number(f.total), 140 + 100 + 165);
  chequear('gana la mejor marca, no la más reciente', f.falta, 'sexo');

  // un ejercicio fuera de los tres NO entra al total (la fórmula está
  // calibrada sobre sentadilla, banca y peso muerto: sumarle otros la invalida)
  await cargar('dominadas', 300, 1, true, 5);
  f = await falta();
  chequear('un ejercicio ajeno no infla el total', Number(f.total), 405);
  chequear('pero sí aparece en la lista de marcas', f.marcas.length, 4);

  // sexo cargado pero sin peso corporal: sigue sin haber DOTS
  await db.query(`update profiles set sexo = 'm' where id = $1`, [u]);
  chequear('sin peso corporal tampoco hay DOTS', (await falta()).falta, 'peso');

  await db.query(
    `insert into weights (user_id, fecha, valor) values ($1, mi_hoy() - 5, 95),
                                                       ($1, mi_hoy(), 90)`,
    [u]
  );
  f = await falta();
  chequear('con todo cargado ya no falta nada', f.falta, null);
  // total 405 con 90 kg de peso corporal. Usa el peso MÁS RECIENTE (90), no
  // el más viejo (95): con 95 daría 255,26.
  chequear('el DOTS usa el peso corporal más reciente', Number(f.dots), 261.87);
  chequear('cada marca trae su fecha', typeof f.marcas[0].fecha, 'string');

  // el DOTS NO se guarda como columna: depende del peso corporal de hoy.
  // Se corrige el peso de HOY, no se inventa uno de mañana: desde la
  // migración 12 el futuro está prohibido y eso es lo correcto.
  await db.query(`update weights set valor = 110 where user_id = $1 and fecha = mi_hoy()`, [u]);
  chequear('al cambiar el peso corporal el DOTS cambia solo', Number((await falta()).dots) !== 261.87, true);

  let sexoInvalido = null;
  try {
    await db.query(`update profiles set sexo = 'x' where id = $1`, [u]);
    sexoInvalido = false;
  } catch (err) {
    sexoInvalido = /check constraint/i.test(err.message);
  }
  chequear('no se puede inventar un sexo', sexoInvalido, true);
}

// =====================================================================
console.log('\n25. Fuerza: quién ve qué');
{
  const yo = await nuevoUsuario();
  const amigo = await nuevoUsuario();
  const extrano = await nuevoUsuario();
  await db.query(
    `insert into friendships (solicitante, destinatario, estado) values ($1, $2, 'aceptada')`,
    [yo, amigo]
  );
  // yo: 650 kg de total a 90 kg de peso corporal, que es el caso publicado
  // del punto 23 — el número tiene que sobrevivir todo el camino
  for (const [quien, sq, bp, dl, peso] of [
    [yo, 240, 150, 260, 90],
    [amigo, 280, 180, 300, 100],
  ]) {
    for (const [ej, kg] of [['sentadilla', sq], ['press_banca', bp], ['peso_muerto', dl]]) {
      await db.query(
        `insert into prs (user_id, ejercicio, peso, reps, es_real, fecha)
           values ($1, $2, $3, 1, true, mi_hoy())`,
        [quien, ej, kg]
      );
    }
    await db.query(`update profiles set sexo = 'm' where id = $1`, [quien]);
    await db.query(`insert into weights (user_id, fecha, valor) values ($1, mi_hoy(), $2)`, [
      quien,
      peso,
    ]);
  }

  await comoUsuario(yo);
  await db.exec('set role authenticated');

  const marcasVisibles = async (de) =>
    (await db.query('select count(*)::int as n from prs where user_id = $1', [de])).rows[0].n;
  chequear('veo mis marcas', await marcasVisibles(yo), 3);
  chequear('veo las de mi amigo, igual que sus logs', await marcasVisibles(amigo), 3);
  chequear('las de un extraño no', await marcasVisibles(extrano), 0);

  const r = await db.query('select * from ranking_fuerza()');
  chequear('el ranking trae a los dos', r.rows.length, 2);
  chequear('ordenado por DOTS, el amigo primero', r.rows[0].id, amigo);
  const mio = r.rows.find((x) => x.id === yo);
  const suyo = r.rows.find((x) => x.id === amigo);
  chequear('mi fila trae mi DOTS', Number(mio.dots), 420.29);
  // MIGRACIÓN 28: el DOTS exacto lo ven todos, no solo el dueño. La
  // consecuencia —que con el total a la vista se despeje el peso corporal—
  // está aceptada a propósito y se avisa al activar el DOTS (§16.7b).
  chequear('y la del otro TAMBIÉN, que es el cambio', suyo.dots !== null, true);
  chequear('con su número exacto', Number(suyo.dots) > 0, true);
  chequear('el total sí se ve: los levantamientos ya se ven', Number(suyo.total), 760);
  chequear('y el detalle por ejercicio también', suyo.marcas.length, 3);

  // el peso corporal no sale ni por la puerta de atrás
  let pesoAjeno = null;
  try {
    await db.query('select peso_actual($1)', [amigo]);
    pesoAjeno = false;
  } catch (err) {
    pesoAjeno = /permission denied/i.test(err.message);
  }
  chequear('peso_actual no se puede llamar desde el cliente', pesoAjeno, true);

  for (const fn of ['mejores_marcas', 'total_dots', 'dots_de']) {
    let cerrada = null;
    try {
      await db.query(`select ${fn}($1)`, [amigo]);
      cerrada = false;
    } catch (err) {
      cerrada = /permission denied/i.test(err.message);
    }
    chequear(`${fn} tampoco`, cerrada, true);
  }

  await db.exec('reset role');

  // la baja de cuenta se lleva las marcas
  await comoUsuario(yo);
  await db.exec('set role authenticated');
  await db.query('select eliminar_cuenta()');
  await db.exec('reset role');
  chequear(
    'al borrar la cuenta no quedan marcas',
    (await db.query('select count(*)::int as n from prs where user_id = $1', [yo])).rows[0].n,
    0
  );
}

// =====================================================================
console.log('\n26. Las reglas escritas dos veces: SQL contra cliente');
// La base manda, pero el cliente repite las mismas cuentas para no pedir un
// viaje de red por tecla. Acá se corren las dos contra los mismos valores: si
// alguna se toca sola, esto falla en vez de que la app pinte una cosa y la
// base guarde otra.
{
  // ---- Epley / 1RM ----
  const casos = [];
  for (const peso of [60, 100, 142.5, 227.5]) {
    for (const reps of [1, 2, 3, 5, 8, 12, 20]) casos.push([peso, reps, false]);
    casos.push([peso, 1, true]);
  }
  let difieren = [];
  for (const [peso, reps, real] of casos) {
    const r = await db.query('select un_rm($1, $2, $3)::float8 as v', [peso, reps, real]);
    const cliente = unRM(peso, reps, real);
    // el margen es por el ida y vuelta numeric/float, no por tolerancia: una
    // diferencia de fórmula de verdad se ve mucho antes de la sexta decimal
    if (Math.abs(r.rows[0].v - cliente) > 1e-6) {
      difieren.push(`${peso}x${reps}${real ? ' real' : ''}: sql ${r.rows[0].v} vs cliente ${cliente}`);
    }
  }
  chequear(`un_rm y unRM coinciden en los ${casos.length} casos`, difieren, []);

  // el caso que ya nos mordió una vez, explícito
  const unaRep = await db.query('select un_rm(150, 1, false)::float8 as v');
  chequear(
    'con 1 repetición ninguna de las dos aplica Epley',
    [unaRep.rows[0].v, unRM(150, 1, false)],
    [150, 150]
  );

  // ---- número de rango ----
  difieren = [];
  for (let racha = 0; racha <= 100; racha++) {
    const r = await db.query('select rango_de_racha($1)::int as v', [racha]);
    if (r.rows[0].v !== numeroDeRango(racha)) {
      difieren.push(`racha ${racha}: sql ${r.rows[0].v} vs cliente ${numeroDeRango(racha)}`);
    }
  }
  chequear('rango_de_racha y numeroDeRango coinciden de 0 a 100', difieren, []);

  // ---- planeta del día ----
  difieren = [];
  for (let racha = 25; racha <= 45; racha++) {
    const r = await db.query('select planeta_de_dia($1) as v', [racha]);
    const sql = r.rows[0].v ?? null;
    if (sql !== planetaDeDia(racha)) {
      difieren.push(`racha ${racha}: sql ${sql} vs cliente ${planetaDeDia(racha)}`);
    }
  }
  chequear('planeta_de_dia y planetaDeDia coinciden, nombre por nombre', difieren, []);

  // Tercera copia de los nombres: las claves de PLANETAS_CFG en el motor. Si
  // alguien renombra un planeta, el motor no encuentra su config y dibuja otra
  // cosa sin avisar.
  chequear(
    'cada planeta tiene su cuerpo en el motor',
    PLANETAS.filter((p) => !PLANETAS_CFG[p]),
    []
  );

  // ---- descansos vigentes ----
  const u = await nuevoUsuario();
  const configs = [
    { desde: '2026-01-01', dias: [0, 6] },
    { desde: '2026-03-15', dias: [3] },
    { desde: '2026-07-01', dias: [] },
  ];
  for (const c of configs) {
    await db.query('insert into descansos (user_id, desde, dias) values ($1, $2, $3)', [
      u,
      c.desde,
      c.dias,
    ]);
  }
  // el cliente las recibe de más nueva a más vieja, como se las pasa la pantalla
  const alReves = [...configs].reverse();
  difieren = [];
  for (const fecha of [
    '2025-12-31', '2026-01-01', '2026-03-14', '2026-03-15',
    '2026-06-30', '2026-07-01', '2026-12-31',
  ]) {
    const r = await db.query('select descansos_vigentes($1, $2) as v', [u, fecha]);
    const sql = JSON.stringify(r.rows[0].v ?? []);
    const cliente = JSON.stringify(descansosVigentes(alReves, fecha));
    if (sql !== cliente) difieren.push(`${fecha}: sql ${sql} vs cliente ${cliente}`);
  }
  chequear('descansos_vigentes y descansosVigentes coinciden, fecha por fecha', difieren, []);

  // ---- las dos constantes del cronómetro ----
  const topes = await db.query(`
    select extract(epoch from tope_sesion())::float8 as tope,
           extract(epoch from ventana_inactividad())::float8 as ventana,
           extract(epoch from piso_sesion())::float8 as piso`);
  chequear(
    'el tope sin actividad, la ventana y el piso son el mismo número de los dos lados',
    [topes.rows[0].tope, topes.rows[0].ventana, topes.rows[0].piso],
    [TOPE_SESION_SEGUNDOS, VENTANA_INACTIVIDAD_SEGUNDOS, PISO_SESION_SEGUNDOS]
  );

  // ---- el descanso entre series ----
  // El predeterminado y los límites viven en la columna y en `reglas.ts`. Si
  // el cliente ofrece un valor que la columna rechaza, el usuario ve un error
  // sin entender por qué.
  const u2 = await nuevoUsuario();
  const suDefault = await db.query(
    'select duracion_descanso from profiles where id = $1',
    [u2]
  );
  chequear(
    'el predeterminado de la columna es el del cliente',
    suDefault.rows[0].duracion_descanso,
    DESCANSO_PREDETERMINADO
  );

  const acepta = async (v) => {
    try {
      await db.query('update profiles set duracion_descanso = $1 where id = $2', [v, u2]);
      return true;
    } catch {
      return false;
    }
  };
  chequear(
    'la columna acepta justo los límites que ofrece el cliente',
    [await acepta(DESCANSO_MINIMO), await acepta(DESCANSO_MAXIMO)],
    [true, true]
  );
  chequear(
    'y rechaza lo que queda afuera',
    [await acepta(DESCANSO_MINIMO - 1), await acepta(DESCANSO_MAXIMO + 1)],
    [false, false]
  );
  const { PRESETS_DESCANSO } = await import('../nucleo/reglas.ts');
  const fuera = [];
  for (const p of PRESETS_DESCANSO) if (!(await acepta(p))) fuera.push(p);
  chequear('todos los presets entran en la columna', fuera, []);
}

// =====================================================================
console.log('\n27. Cronómetro de sesión');
{
  const empezar = async (uid) => {
    await comoUsuario(uid);
    const r = await db.query('select iniciar_sesion() as v');
    return r.rows[0].v;
  };
  const laSesion = async (uid) =>
    (await db.query('select * from sesiones where user_id = $1 order by inicio desc limit 1', [uid]))
      .rows[0];
  const diaDeLaSesion = async (uid) =>
    (
      await db.query(
        `select l.fecha::text as f from sesiones s join logs l on l.id = s.log_id
          where s.user_id = $1 order by s.inicio desc limit 1`,
        [uid]
      )
    ).rows[0]?.f;

  // ---- empezar registra el día ----
  {
    const u = await nuevoUsuario();
    const r = await empezar(u);
    chequear('empezar registra el día', (await perfil(u)).racha_actual, 1);
    chequear('y devuelve el registro para poder animar la subida', r.registro !== null, true);
    chequear('la sesión arranca corriendo', (await laSesion(u)).estado, 'corriendo');
    // el cronómetro se dibuja con estos dos: el inicio del servidor y su ahora
    chequear('devuelve inicio y el ahora del servidor', [!!r.inicio, !!r.ahora], [true, true]);
  }

  // ---- si el día ya estaba, no se duplica nada ----
  {
    const u = await nuevoUsuario();
    await db.query(`insert into logs (user_id, fecha) values ($1, mi_hoy())`, [u]);
    const r = await empezar(u);
    chequear('el día ya registrado no se vuelve a registrar', r.registro, null);
    chequear(
      'y hay un solo log para hoy',
      (await db.query('select count(*)::int as n from logs where user_id = $1', [u])).rows[0].n,
      1
    );
    chequear('la racha no se movió', (await perfil(u)).racha_actual, 1);
  }

  // ---- una sola corriendo ----
  {
    const u = await nuevoUsuario();
    await empezar(u);
    await empezar(u);
    const r = await db.query(
      `select estado, count(*)::int as n from sesiones where user_id = $1 group by estado order by estado`,
      [u]
    );
    // ESTO CAMBIÓ EN LA MIGRACIÓN 26, y el test cambió con intención.
    //
    // Antes la anterior quedaba ABANDONADA y se creaba otra: su duración se
    // perdía sin que nadie dijera nada. El razonamiento era "no sabemos cuándo
    // terminó, así que no puede quedarse con una duración inventada" — correcto
    // sobre la duración, equivocado sobre qué hacer: la respuesta no era tirar
    // la sesión, era no crear una segunda.
    //
    // Y podía pasar solo, sin que el usuario empezara dos veces: el estado del
    // cliente y el de la base se separan con la caché borrada, con dos miradas
    // del vigilante a la vez, o volviendo de segundo plano.
    chequear(
      'empezar de nuevo NO pisa la que está corriendo',
      r.rows.map((x) => [x.estado, x.n]),
      [['corriendo', 1]]
    );
  }

  // ---- terminar ----
  {
    const u = await nuevoUsuario();
    await empezar(u);
    await db.query(`update sesiones set inicio = now() - interval '75 minutes' where user_id = $1`, [u]);
    const r = (await db.query('select terminar_sesion() as v')).rows[0].v;
    chequear('terminar devuelve la duración', [r.termino, Math.round(r.segundos / 60), r.cuenta], [true, 75, true]);
    const s = await laSesion(u);
    chequear('la sesión queda terminada y con fin', [s.estado, s.fin !== null], ['terminada', true]);

    const otra = (await db.query('select terminar_sesion() as v')).rows[0].v;
    chequear('terminar sin nada corriendo no hace nada', otra.termino, false);
  }

  // ---- SIN NINGUNA ACTIVIDAD, a las 2 horas se cierra sola y SIN duración ----
  //
  // Era a las 4. Con la migración 37 esta regla queda solo para la sesión en la
  // que nunca se tocó nada: ahí no hay última actividad que usar.
  {
    const u = await nuevoUsuario();
    await empezar(u);
    await db.query(
      `update sesiones set inicio = now() - interval '2 hours 1 minute', ultima_actividad = now() - interval '2 hours 1 minute' where user_id = $1`,
      [u]
    );
    const r = (await db.query('select mi_sesion() as v')).rows[0].v;
    chequear('pasadas 2 horas sin actividad ya no hay sesión corriendo', r.corriendo, false);
    const s = await laSesion(u);
    chequear('quedó abandonada', s.estado, 'abandonada');
    // "sin duración" es la AUSENCIA de fin, no un número especial
    chequear('y sin fin: no se inventa una duración', s.fin, null);
    // el día sigue registrado: perder el día por olvidarse de parar sería peor
    chequear('el día sigue contando', (await perfil(u)).racha_actual, 1);

    let conFin = null;
    try {
      await db.query(`update sesiones set fin = now() where id = $1`, [s.id]);
      conFin = false;
    } catch (e) {
      conFin = /sesiones_fin_solo_si_termino|check constraint/i.test(e.message);
    }
    chequear('la base impide ponerle un fin a una abandonada', conFin, true);

    // a las 3:59 todavía está viva: el corte es a las 4 en punto
    const v = await nuevoUsuario();
    await empezar(v);
    await db.query(`update sesiones set inicio = now() - interval '3 hours 59 minutes' where user_id = $1`, [v]);
    const r2 = (await db.query('select mi_sesion() as v')).rows[0].v;
    chequear('a las 3 h 59 sigue corriendo', r2.corriendo, true);
  }

  // ---- MEDIANOCHE: la sesión pertenece al día en que EMPEZÓ ----
  {
    // Empieza a las 23:00 y se cierra pasada la medianoche. El log se fija al
    // iniciar y nada lo mueve después: ni el cierre automático ni terminar.
    //
    // El día de ayer se arma directo porque desde la migración 12 el cliente
    // ya no puede pedir una fecha: iniciar_sesion siempre usa mi_hoy().
    const u = await nuevoUsuario();
    const ayer = (await db.query(`select (mi_hoy() - 1)::text as f`)).rows[0].f;
    const log = (
      await db.query(
        `insert into logs (user_id, fecha) values ($1, mi_hoy() - 1) returning id`,
        [u]
      )
    ).rows[0].id;
    await db.query(
      `insert into sesiones (user_id, log_id, inicio) values ($1, $2, now() - interval '2 hours')`,
      [u, log]
    );
    await comoUsuario(u);
    const r = (await db.query('select terminar_sesion() as v')).rows[0].v;
    chequear('cruzar la medianoche no cambia la duración', Math.round(r.segundos / 3600), 2);
    chequear('la sesión sigue siendo del día en que empezó', await diaDeLaSesion(u), ayer);
    chequear(
      'y no aparece un día nuevo al terminar',
      (await db.query('select count(*)::int as n from logs where user_id = $1', [u])).rows[0].n,
      1
    );

    // lo mismo cuando se cierra sola del otro lado de la medianoche
    const v = await nuevoUsuario();
    const log2 = (
      await db.query(
        `insert into logs (user_id, fecha) values ($1, mi_hoy() - 1) returning id`,
        [v]
      )
    ).rows[0].id;
    await db.query(
      `insert into sesiones (user_id, log_id, inicio) values ($1, $2, now() - interval '5 hours')`,
      [v, log2]
    );
    await comoUsuario(v);
    await db.query('select mi_sesion() as v');
    chequear('la abandonada tampoco se muda de día', await diaDeLaSesion(v), ayer);
    chequear(
      'y sigue habiendo un solo día',
      (await db.query('select count(*)::int as n from logs where user_id = $1', [v])).rows[0].n,
      1
    );
  }

  // ---- día de descanso ----
  {
    const u = await nuevoUsuario();
    await comoUsuario(u);
    // hoy es día fijo de descanso: no ir no corta la racha, pero ir cuenta
    await db.query(
      `select fijar_descansos(array[extract(dow from mi_hoy())::int])`
    );
    await empezar(u);
    const l = (await db.query('select es_descanso from logs where user_id = $1', [u])).rows[0];
    chequear('en un día de descanso el cronómetro registra un día ENTRENADO', l.es_descanso, false);
    chequear('y la racha sube igual', (await perfil(u)).racha_actual, 1);
  }

  // ---- resumen para Stats ----
  {
    const u = await nuevoUsuario();
    await comoUsuario(u);
    const l = (
      await db.query(
        `insert into logs (user_id, fecha) values ($1, mi_hoy()) returning id`,
        [u]
      )
    ).rows[0].id;
    const meter = (minutos, estado) =>
      db.query(
        `insert into sesiones (user_id, log_id, inicio, fin, estado)
           values ($1, $2, now() - ($3 || ' minutes')::interval,
                   case when $4 = 'terminada' then now() end, $4)`,
        [u, l, minutos, estado]
      );
    await meter(60, 'terminada');
    await meter(90, 'terminada');
    await meter(2, 'terminada'); // corta: cuenta como día, no como duración
    await meter(240, 'abandonada');
    const r = (await db.query('select resumen_sesiones() as v')).rows[0].v;
    chequear('el promedio sale solo de las válidas', Number(r.promedio_segundos), 75 * 60);
    chequear('el total también', Number(r.total_segundos), 150 * 60);
    chequear('las cortas y las abandonadas se cuentan aparte', [r.validas, r.cortas, r.abandonadas], [2, 1, 1]);
  }

  // ---- borrar el día se lleva la sesión ----
  {
    const u = await nuevoUsuario();
    await empezar(u);
    await db.query('delete from logs where user_id = $1', [u]);
    chequear(
      'sacar el día del calendario borra su sesión',
      (await db.query('select count(*)::int as n from sesiones where user_id = $1', [u])).rows[0].n,
      0
    );
  }

  // ---- quién ve qué, y quién puede escribir ----
  {
    const u = await nuevoUsuario();
    const amigo = await nuevoUsuario();
    await db.query(
      `insert into friendships (solicitante, destinatario, estado) values ($1, $2, 'aceptada')`,
      [u, amigo]
    );
    await empezar(u);

    await comoUsuario(amigo);
    await db.exec('set role authenticated');
    // la duración es privada incluso entre amigos (§17.8): más tiempo no es
    // mejor entrenamiento, y competir por eso empuja a entrenar de más
    chequear(
      'ni un amigo ve mis sesiones',
      (await db.query('select count(*)::int as n from sesiones where user_id = $1', [u])).rows[0].n,
      0
    );

    let escribe = null;
    try {
      await db.query(
        `insert into sesiones (user_id, log_id, inicio) select $1, id, now() - interval '3 hours' from logs limit 1`,
        [amigo]
      );
      escribe = false;
    } catch (e) {
      escribe = /permission denied/i.test(e.message);
    }
    chequear('nadie se escribe una sesión a mano', escribe, true);
    await db.exec('reset role');

    // y la baja de cuenta se las lleva
    await comoUsuario(u);
    await db.exec('set role authenticated');
    await db.query('select eliminar_cuenta()');
    await db.exec('reset role');
    chequear(
      'al borrar la cuenta no quedan sesiones',
      (await db.query('select count(*)::int as n from sesiones where user_id = $1', [u])).rows[0].n,
      0
    );
  }

  // ---- anotar el peso sin registrar un día ----
  {
    const u = await nuevoUsuario();
    await comoUsuario(u);
    await db.exec('set role authenticated');
    let directo = null;
    try {
      await db.query(`insert into weights (user_id, fecha, valor) values ($1, mi_hoy(), 80)`, [u]);
      directo = false;
    } catch (e) {
      directo = /permission denied/i.test(e.message);
    }
    chequear('el peso sigue sin poder escribirse directo', directo, true);

    await db.query('select anotar_peso(80.5)');
    await db.query('select anotar_peso(81)'); // corrige el del día
    await db.exec('reset role');
    const w = await db.query('select fecha::text as f, valor::float8 as v from weights where user_id = $1', [u]);
    chequear('anotar_peso deja una sola fila por día, con el último valor', w.rows.length, 1);
    chequear('y con el valor corregido', w.rows[0].v, 81);
    chequear(
      'sin haber registrado ningún día',
      (await db.query('select count(*)::int as n from logs where user_id = $1', [u])).rows[0].n,
      0
    );
  }
}

// =====================================================================
console.log('\n28. El día lo corta Uruguay, no UTC ni el teléfono');
// El harness corre en UTC como Supabase (ver el stub de arriba). Si esto se
// corriera en la zona local, mi_hoy() y current_date coincidirían y el
// problema quedaría invisible justo donde hay que cazarlo.
{
  const tz = await db.query(`select current_setting('TimeZone') as tz`);
  chequear('el harness corre en UTC, como Supabase', tz.rows[0].tz, 'UTC');

  // La regla en sí, sin depender de qué hora sea al correr el test: a la
  // 01:00 UTC en Uruguay todavía es el día anterior. Ese es exactamente el
  // rato en que el servidor contaba mañana y el usuario estaba en hoy.
  const r = await db.query(`
    select ('2026-03-10 01:00:00+00'::timestamptz at time zone 'America/Montevideo')::date::text as madrugada,
           ('2026-03-10 01:00:00+00'::timestamptz)::date::text as en_utc,
           ('2026-03-10 23:00:00+00'::timestamptz at time zone 'America/Montevideo')::date::text as noche`);
  chequear('a la 01:00 UTC en Uruguay es el día anterior', r.rows[0].madrugada, '2026-03-09');
  chequear('y en UTC ya es el siguiente: esa era la diferencia', r.rows[0].en_utc, '2026-03-10');
  chequear('a las 23:00 UTC en Uruguay es el mismo día', r.rows[0].noche, '2026-03-10');

  const hoy = await db.query(`select mi_hoy()::text as h,
    (now() at time zone 'America/Montevideo')::date::text as esperado`);
  chequear('mi_hoy() es la fecha de Uruguay', hoy.rows[0].h, hoy.rows[0].esperado);

  // ---- el cliente NO puede elegir la fecha ----
  // Antes se mandaba p_hoy y el servidor solo lo acotaba a ±1 día: alcanzaba
  // con adelantar la hora del teléfono para registrar "mañana", volverla
  // atrás y registrar "hoy". Dos días de racha en un día real.
  //
  // La migración 12 lo tapó ignorando el parámetro, y la 22 lo BORRÓ. Que no
  // exista es más fuerte que ignorarlo: un parámetro ignorado se sigue
  // pudiendo pasar, y quien lo pasa cree que controla algo. La sección 34
  // comprueba que no queden más así.
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await db.query('select registrar_dia()');
  const cuando = await db.query(
    'select fecha::text as f from logs where user_id = $1',
    [u]
  );
  chequear('registrar_dia usa el día del usuario', cuando.rows.length, 1);
  chequear('y es el que dice mi_hoy()', cuando.rows[0].f, hoy.rows[0].h);

  // el segundo intento choca con la unicidad, no crea un día nuevo
  let dosVeces = null;
  try {
    await db.query('select registrar_dia()');
    dosVeces = false;
  } catch (e) {
    dosVeces = e.code === '23505';
  }
  chequear('registrar dos veces no da un día extra', dosVeces, true);

  // anotar_peso también fecha con el día del usuario
  await db.query('select anotar_peso(80)');
  const wp = await db.query('select fecha::text as f from weights where user_id = $1', [u]);
  chequear('anotar_peso fecha con el día del usuario', wp.rows[0].f, hoy.rows[0].h);

  // Y la base rechaza un día futuro venga de donde venga, incluido el insert
  // directo del calendario. El CHECK de la tabla es un tope grosero —no puede
  // mirar el perfil— así que el que corta fino es el trigger.
  let futuro = null;
  try {
    await db.query(`insert into logs (user_id, fecha) values ($1, mi_hoy() + 1)`, [u]);
    futuro = false;
  } catch (e) {
    futuro = /todavía no llegó/i.test(e.message);
  }
  chequear('no se puede registrar un día que todavía no llegó', futuro, true);

  // fijar_descansos fecha la configuración con el día de Uruguay
  await db.query('select fijar_descansos(array[0]::int[])');
  const cfg = await db.query('select desde::text as d from descansos where user_id = $1', [u]);
  chequear('los descansos se fechan con el día de Uruguay', cfg.rows[0].d, hoy.rows[0].h);
}


// =====================================================================
// El par de zonas con el que se prueba la guarda del cambio de zona, acá
// arriba porque lo usan la sección 29 y la 30. Antes cada una usaba
// Montevideo -> Tokio, que son doce horas: caen en el mismo día del
// calendario buena parte de la jornada, y ahí no hay ningún día que ganar.
// El test pasaba en verde sin probar nada media vuelta al reloj y en rojo la
// otra media. Midway (UTC-11) y Kiritimati (UTC+14) están a VEINTICINCO
// horas: no pueden caer en el mismo día, sea la hora que sea.
const CASA = 'Pacific/Midway';
const ADELANTE = 'Pacific/Kiritimati';

console.log('\n29. La zona sale del teléfono, y cambiarla no regala días');
{
  const zona = (uid, z) => db.query('update profiles set zona = $2 where id = $1', [uid, z]);

  // Tres husos bien separados: Montevideo (UTC-3), Madrid (UTC+1/+2) y
  // Tokio (UTC+9). Con el mismo instante, el día puede ser distinto.
  const u = await nuevoUsuario();
  await comoUsuario(u);
  const dias = {};
  for (const z of ['America/Montevideo', 'Europe/Madrid', 'Asia/Tokyo']) {
    await zona(u, z);
    dias[z] = (await db.query('select mi_hoy()::text as d')).rows[0].d;
  }
  chequear(
    'cada zona da su propio día',
    Object.values(dias).every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    true
  );
  // Tokio nunca puede ir atrás de Montevideo: son doce horas adelante
  chequear('Tokio nunca va atrás de Montevideo', dias['Asia/Tokyo'] >= dias['America/Montevideo'], true);

  // ---- la zona se valida, no es texto libre ----
  await zona(u, 'America/Montevideo');
  await db.exec('set role authenticated');
  let inventada = null;
  try {
    await db.query(`select fijar_zona('Marte/Olympus')`);
    inventada = false;
  } catch (e) {
    inventada = /zona horaria desconocida/i.test(e.message);
  }
  chequear('una zona inventada se rechaza', inventada, true);

  const ok = await db.query(`select fijar_zona('Europe/Madrid')`).then(() => true).catch(() => false);
  chequear('una zona IANA real se acepta', ok, true);
  const z = await db.query('select zona, zona_cambiada is not null as marcada from profiles where id = $1', [u]);
  chequear('queda guardada y marcada', [z.rows[0].zona, z.rows[0].marcada], ['Europe/Madrid', true]);
  await db.exec('reset role');

  // el cliente no puede escribirla por la puerta de al lado
  await db.exec('set role authenticated');
  let directo = null;
  try {
    await db.query(`update profiles set zona = 'Marte/Olympus' where id = $1`, [u]);
    directo = false;
  } catch (e) {
    directo = /permission denied/i.test(e.message);
  }
  chequear('la columna zona no se escribe directo', directo, true);
  await db.exec('reset role');

  // ---- la guarda: cambiar de zona no regala un día, pero no lo pierde ----
  //
  // El par de zonas NO es decorativo. Antes era Montevideo -> Tokio, que son
  // doce horas: caen en el mismo día del calendario buena parte de la jornada
  // y ahí el ataque no tiene nada que ganar, así que el test pasaba en verde
  // sin probar nada media vuelta al reloj, y en rojo la otra media. Midway
  // (UTC-11) y Kiritimati (UTC+14) están a VEINTICINCO horas: nunca pueden
  // caer en el mismo día, sea la hora que sea.
  {
    const c = await nuevoUsuario();
    await zona(c, CASA);
    await comoUsuario(c);
    const dCasa = (await db.query('select mi_hoy()::text as d')).rows[0].d;
    await zona(c, ADELANTE);
    const dAdelante = (await db.query('select mi_hoy()::text as d')).rows[0].d;
    chequear('el par de zonas cae en días distintos, a cualquier hora', dAdelante > dCasa, true);
  }
  {
    const v = await nuevoUsuario();
    await zona(v, CASA);
    await comoUsuario(v);
    await db.query('select registrar_dia()');
    chequear('registró el día', (await perfil(v)).racha_actual, 1);

    // se mueve la zona hacia adelante, que es el ataque
    await db.exec('set role authenticated');
    await db.query(`select fijar_zona($1)`, [ADELANTE]);
    await db.exec('reset role');

    const r = (await db.query('select registrar_dia() as v')).rows[0].v;
    chequear('mover la zona no da un segundo día', r.bloqueado, true);
    chequear('y la racha no se movió', (await perfil(v)).racha_actual, 1);

    // ---- pero el día NO se pierde ----
    chequear('el día queda pendiente', !!r.pendiente, true);
    chequear('y dice hasta cuándo, no solo que no', !!r.hasta, true);
    const guardado = await db.query(
      'select dia_pendiente::text as d, pendiente_desde is not null as marcado from profiles where id = $1',
      [v]
    );
    chequear('guardado en el perfil', [guardado.rows[0].d, guardado.rows[0].marcado], [r.pendiente, true]);

    // mientras la ventana no pase, sigue pendiente y no se registra solo
    await db.query('select verificar_perdida()');
    chequear(
      'antes de la ventana no se registra solo',
      (await db.query('select count(*)::int as n from logs where user_id = $1', [v])).rows[0].n,
      1
    );

    // pasa la ventana: el día entra solo la próxima vez que se abre la app
    await db.query(
      `update logs set creado = now() - interval '21 hours' where user_id = $1`,
      [v]
    );
    const vp = (await db.query('select verificar_perdida() as v')).rows[0].v;
    chequear('pasada la ventana se registra solo', vp.pendiente_resuelto, r.pendiente);
    chequear(
      'y ahora son dos días',
      (await db.query('select count(*)::int as n from logs where user_id = $1', [v])).rows[0].n,
      2
    );
    const limpio = await db.query('select dia_pendiente from profiles where id = $1', [v]);
    chequear('el pendiente queda limpio', limpio.rows[0].dia_pendiente, null);
  }

  // ---- el pendiente no duplica si el día ya entró por otro lado ----
  {
    const x = await nuevoUsuario();
    await zona(x, CASA);
    await comoUsuario(x);
    await db.query('select registrar_dia()');
    await db.exec('set role authenticated');
    await db.query(`select fijar_zona($1)`, [ADELANTE]);
    await db.exec('reset role');
    const r = (await db.query('select registrar_dia() as v')).rows[0].v;
    // el usuario lo agrega a mano desde el calendario mientras tanto
    await db.query(`insert into logs (user_id, fecha) values ($1, $2::date)`, [x, r.pendiente]);
    await db.query(
      `update logs set creado = now() - interval '21 hours' where user_id = $1`,
      [x]
    );
    await db.query('select verificar_perdida()');
    chequear(
      'no duplica el día que ya estaba',
      (await db.query('select count(*)::int as n from logs where user_id = $1 and fecha = $2::date', [x, r.pendiente])).rows[0].n,
      1
    );
  }

  // ---- pero NO molesta al que no cambió de zona ----
  // Entrenar a las 23:00 y a las 07:00 del día siguiente son ocho horas y dos
  // días de verdad. La guarda incondicional lo rechazaba; ésta no.
  {
    const w = await nuevoUsuario();
    await comoUsuario(w);
    await db.query(
      `insert into logs (user_id, fecha, creado) values ($1, mi_hoy() - 1, now() - interval '8 hours')`,
      [w]
    );
    let hoy = null;
    try {
      await db.query('select registrar_dia()');
      hoy = true;
    } catch (e) {
      hoy = e.message;
    }
    chequear('sin cambio de zona, ocho horas después se puede registrar', hoy, true);
    chequear('y suma', (await perfil(w)).racha_actual, 2);
  }
}


// =====================================================================
console.log('\n30. El día pendiente espera, no vence, y entra con SU fecha');
{
  const bloquear = async (uid) => {
    await db.query('update profiles set zona = $2 where id = $1', [uid, CASA]);
    await comoUsuario(uid);
    await db.query('select registrar_dia()');
    await db.exec('set role authenticated');
    await db.query(`select fijar_zona($1)`, [ADELANTE]);
    await db.exec('reset role');
    const r = (await db.query('select registrar_dia() as v')).rows[0].v;
    // Si esto no bloquea, lo de abajo no prueba nada: no hay pendiente que
    // resolver y el test se cae más adelante por un lado que no es el suyo.
    chequear('bloqueó y dejó un pendiente', !!r.pendiente, true);
    return r;
  };

  // ---- no vuelve en días y el día entra igual, con SU fecha ----
  {
    const u = await nuevoUsuario();
    const r = await bloquear(u);
    const suDia = r.pendiente;

    // Pasan seis días sin abrir la app. Se envejece el `creado` de los logs
    // Y se atrasa el propio pendiente: lo que se quiere probar es que entre
    // con la fecha de ENTONCES, y para eso esa fecha tiene que ser distinta
    // de la de hoy.
    await db.query(
      `update logs set creado = creado - interval '6 days' where user_id = $1`,
      [u]
    );
    await db.query(
      `update profiles set dia_pendiente = dia_pendiente - 6,
                           pendiente_desde = pendiente_desde - interval '6 days'
        where id = $1`,
      [u]
    );
    const original = (
      await db.query('select dia_pendiente::text as d from profiles where id = $1', [u])
    ).rows[0].d;
    chequear('el pendiente quedó seis días atrás', original !== suDia, true);

    const vp = (await db.query('select verificar_perdida() as v')).rows[0].v;
    chequear('el pendiente no vence: entra aunque pasen días', vp.pendiente_resuelto, original);

    const hoy = (await db.query('select mi_hoy()::text as h')).rows[0].h;
    const puesto = await db.query(
      'select fecha::text as f from logs where user_id = $1 and fecha = $2::date',
      [u, original]
    );
    // Lo que importa: entra con la fecha del día que entrenó, no con la de
    // hoy. Con la de hoy la app inventaría un día que no ocurrió y perdería
    // el que sí.
    chequear('entra con su fecha original', puesto.rows.length, 1);
    chequear('y esa fecha NO es la de hoy', original !== hoy, true);
  }

  // ---- entrar tarde no le salva la racha a nadie ----
  {
    const v = await nuevoUsuario();
    const r = await bloquear(v);
    // se envejece todo seis días: la racha quedó cortada de verdad
    await db.query(`update logs set creado = creado - interval '6 days' where user_id = $1`, [v]);
    await db.query(
      `update logs set fecha = fecha - 6 where user_id = $1 and fecha < $2::date`,
      [v, r.pendiente]
    );
    const vp = (await db.query('select verificar_perdida() as v')).rows[0].v;
    chequear('el pendiente entra', !!vp.pendiente_resuelto, true);
    // el día entra en el pasado y no tapa el hueco de los días que faltaron
    const p2 = await perfil(v);
    chequear('pero no resucita una racha cortada', p2.racha_actual <= 2, true);
  }

  // ---- si el usuario borró ese día a mano, el pendiente se cancela ----
  {
    const w = await nuevoUsuario();
    const r = await bloquear(w);
    // lo agrega a mano y después se arrepiente y lo borra
    await db.query(`insert into logs (user_id, fecha) values ($1, $2::date)`, [w, r.pendiente]);
    await db.query(`delete from logs where user_id = $1 and fecha = $2::date`, [w, r.pendiente]);
    const limpio = await db.query('select dia_pendiente from profiles where id = $1', [w]);
    chequear('borrar el día a mano cancela el pendiente', limpio.rows[0].dia_pendiente, null);

    await db.query(`update logs set creado = creado - interval '21 hours' where user_id = $1`, [w]);
    await db.query('select verificar_perdida()');
    chequear(
      'y no vuelve a aparecer solo',
      (await db.query('select count(*)::int as n from logs where user_id = $1 and fecha = $2::date', [w, r.pendiente])).rows[0].n,
      0
    );
  }
}


// =====================================================================
console.log('\n31. Los días de sesión que se leen en Stats');
{
  // Se arma a mano y no desde la base: lo que se prueba es la agrupación del
  // cliente, y con datos de verdad nunca coincidirían dos sesiones el mismo
  // día ni una abandonada al lado de una buena.
  const s = (fecha, inicio, fin, estado = 'terminada') => ({
    inicio, fin, estado, series: 0, logs: { fecha },
  });
  const dia = (n) => `2026-08-${String(n).padStart(2, '0')}`;
  const t = (n, h, m = 0) => `${dia(n)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;

  const filas = [
    s(dia(20), t(20, 18), t(20, 19)),           // 1 h
    s(dia(20), t(20, 8), t(20, 8, 30)),          // media hora, MISMO día
    s(dia(19), t(19, 10), null, 'abandonada'),   // sin duración
    s(dia(18), t(18, 10), t(18, 11, 15)),        // 1 h 15
  ];
  const r = agruparPorDia(filas);

  chequear('un día por fecha, no uno por sesión', r.length, 3);
  chequear('el más reciente primero', r.map((d) => d.fecha), [dia(20), dia(19), dia(18)]);
  chequear('las del mismo día se suman', r[0].segundos, 5400);
  chequear('y dice cuántas fueron', r[0].cuantas, 2);
  // Se cerró sola a las 4 horas y no se sabe cuánto entrenó. Poner 4 h sería
  // inventar; poner el tope, peor todavía.
  chequear('la abandonada no inventa una duración', [r[1].segundos, r[1].cuantas], [0, 1]);

  // el embebido de PostgREST puede venir como objeto o como array de uno
  chequear(
    'da igual cómo venga el embebido',
    agruparPorDia([{ ...filas[3], logs: [{ fecha: dia(18) }] }])[0].segundos,
    4500
  );
  chequear('una fila sin día se descarta en vez de romper', agruparPorDia([{ ...filas[0], logs: null }]), []);

  // ---- las etiquetas ----
  const hoy = new Date(2026, 7, 21);
  chequear('hoy y ayer se dicen con palabras', [etiquetaDeDia(dia(21), hoy), etiquetaDeDia(dia(20), hoy)], ['Hoy', 'Ayer']);
  // El 18/8/2026 es martes. `new Date('2026-08-18')` es UTC y en UTC−3 cae el
  // 17, que es lunes: si esto dice "lun 17", la fecha se leyó como UTC.
  chequear('el día de la semana no se corre por leer el ISO como UTC', etiquetaDeDia(dia(18), hoy), 'mar 18');
}

console.log('\n32. Los estándares de fuerza: contra quién se compara');
{
  // ---- la tabla en sí, que se tipeó a mano desde la fuente ----
  // Un dígito cambiado da un percentil creíble y equivocado, igual que con los
  // coeficientes del DOTS (ver spec/trampas.md). Esto no verifica el dato
  // contra la fuente, pero sí que la tabla sea una tabla: pesos en orden y
  // umbrales que crecen.
  const rotas = [];
  for (const e of EJERCICIOS_ESTANDAR) {
    for (const sexo of ['m', 'f']) {
      let anterior = null;
      for (let bw = 40; bw <= 140; bw += 0.5) {
        const { valores } = umbrales(e, sexo, bw);
        for (let i = 1; i < 5; i++) {
          if (!(valores[i] > valores[i - 1])) rotas.push(`${e}/${sexo}/${bw}: umbral ${i} no crece`);
        }
        // más peso corporal nunca puede pedir MENOS kilos para la misma categoría
        if (anterior && valores.some((v, i) => v < anterior[i] - 1e-9)) {
          rotas.push(`${e}/${sexo}/${bw}: los umbrales bajan al subir el peso`);
        }
        anterior = valores;
      }
    }
  }
  chequear('la tabla crece por categoría y por peso corporal', rotas.slice(0, 3), []);

  // ---- los puntos publicados salen tal cual ----
  // Hombre de 80 kg: la fuente publica 132 de sentadilla como intermedio, que
  // es la mitad de la gente. Es el número del que cuelga toda la elección de
  // población, así que va explícito.
  const medio = ubicar('sentadilla', 'm', 80, 132);
  chequear('80 kg y 132 de sentadilla es intermedio, la mitad', [medio.categoria, medio.supera], ['Intermedio', 50]);
  const elite = ubicar('sentadilla', 'm', 80, 206);
  chequear('y 206 es élite', [elite.categoria, elite.supera], ['Élite', 95]);
  const prin = ubicar('press_banca', 'f', 60, 19);
  chequear('mujer de 60 kg, 19 de banca: principiante', [prin.categoria, prin.supera], ['Principiante', 5]);

  // ---- interpolar por peso corporal ----
  // 82,5 kg cae justo entre las filas de 80 y 85: 132 y 140 dan 136.
  chequear('el peso corporal se interpola entre filas', umbrales('sentadilla', 'm', 82.5).valores[2], 136);
  const entre = ubicar('sentadilla', 'm', 82.5, 136);
  chequear('y ahí 136 vuelve a ser la mitad', entre.supera, 50);

  // ---- fuera de la tabla NO se extrapola ----
  const flaco = umbrales('sentadilla', 'm', 30);
  chequear(
    'debajo de la tabla se usa el borde y se avisa',
    [flaco.valores[2], flaco.fueraDeTabla],
    [78, true]
  );
  const pesado = umbrales('sentadilla', 'm', 200);
  chequear('y arriba también', [pesado.valores[2], pesado.fueraDeTabla], [215, true]);
  chequear('adentro no avisa nada', umbrales('sentadilla', 'm', 82.5).fueraDeTabla, false);

  // ---- los extremos ----
  const arranca = ubicar('sentadilla', 'm', 80, 20);
  chequear('debajo del primer umbral no hay categoría inventada', arranca.categoria, 'Arrancando');
  chequear('pero el porcentaje no baja de 1', arranca.supera >= 1, true);
  const bestia = ubicar('sentadilla', 'm', 80, 400);
  chequear('arriba de élite no se promete más precisión de la que hay', bestia.supera, 95);

  // ---- monotonía: más kilos nunca baja el porcentaje ----
  let baja = null;
  let previo = -1;
  for (let kg = 10; kg <= 320; kg += 2) {
    const u = ubicar('peso_muerto', 'm', 82, kg);
    if (u.supera < previo) baja = `${kg} kg dio ${u.supera} después de ${previo}`;
    previo = u.supera;
  }
  chequear('levantar más nunca baja el porcentaje', baja, null);

  // ---- lo que falta para la primera categoría ----
  // El umbral de principiante para un hombre de 80 kg en sentadilla es 75.
  chequear('debajo del primero dice cuánto falta', arranca.faltaParaPrincipiante, 55);
  chequear('y arriba del primero ya no dice nada', medio.faltaParaPrincipiante, null);
  chequear('justo en el umbral tampoco', ubicar('sentadilla', 'm', 80, 75).faltaParaPrincipiante, null);
  // interpolado: a 82,5 kg el umbral es 78, así que a 70 kg le faltan 8
  chequear(
    'la distancia usa el umbral interpolado, no el de la fila',
    ubicar('sentadilla', 'm', 82.5, 70).faltaParaPrincipiante,
    8
  );

  // ---- las categorías son las de la fuente ----
  chequear(
    'las cinco categorías y sus cortes',
    CATEGORIAS.map((c) => c.supera),
    [5, 20, 50, 80, 95]
  );
  chequear('la muestra fina es la de mujeres', [muestraFina('f'), muestraFina('m')], [true, false]);

  // ---- las letras del sexo son las MISMAS que acepta la base ----
  // Este es el bug que la primera versión tuvo y ningún test agarró: el
  // archivo usaba 'M'/'F' y la base guarda 'm'/'f', así que el filtro daba
  // falso y el bloque no se dibujaba nunca. Sin error y sin nada en pantalla.
  const u = await nuevoUsuario();
  const aceptaLaBase = [];
  for (const letra of ['m', 'f', 'M', 'F', 'x']) {
    const entra = await db
      .query('update profiles set sexo = $2 where id = $1', [u, letra])
      .then(() => true)
      .catch(() => false);
    if (entra) aceptaLaBase.push(letra);
  }
  chequear(
    'las letras de sexo del cliente son las que acepta la base',
    aceptaLaBase.filter((l) => !esSexoEstandar(l)).concat(
      aceptaLaBase.length !== ['m', 'f'].length ? ['la base acepta ' + aceptaLaBase.join(',')] : []
    ),
    []
  );
}

console.log('\n33. El vocabulario del cliente contra el que acepta la base');
{
  // La familia entera del bug de 'M' contra 'm': cualquier literal que el
  // cliente compare contra un valor guardado puede estar roto en silencio.
  // Acá NO se repiten los valores a mano —eso comprobaría que el test coincide
  // consigo mismo—: se le pregunta a Postgres qué acepta cada `check` y se
  // compara contra `nucleo/tipos.ts`, que es de donde sale el cliente.
  const checks = (
    await db.query(`
      select conrelid::regclass::text as tabla, pg_get_constraintdef(oid) as def
        from pg_constraint
       where contype = 'c' and connamespace = 'public'::regnamespace
    `)
  ).rows;

  // Postgres NO devuelve el `in (...)` que uno escribió: lo normaliza a
  // `= ANY (ARRAY['a'::text, 'b'::text])`. Se lee de ahí, que es la forma en
  // la que la base de verdad lo tiene guardado.
  const laBaseAcepta = (tabla, columna) => {
    const suyos = checks.filter(
      // `\\b` y no `\b`: adentro de un template literal, `\b` es el carácter
      // de retroceso, no el borde de palabra del regex. Buscaba un byte 0x08.
      (c) => c.tabla === tabla && bordeDePalabra(columna).test(c.def) && /ARRAY\[/.test(c.def)
    );
    if (suyos.length !== 1) return `esperaba UN check con lista para ${tabla}.${columna}, hay ${suyos.length}`;
    const lista = suyos[0].def.match(/ARRAY\[([^\]]*)\]/);
    if (!lista) return `no pude leer la lista de ${tabla}.${columna}`;
    return [...lista[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).sort();
  };

  const PINEADOS = [
    ['profiles', 'sexo', SEXOS],
    ['profiles', 'visibilidad_default', VISIBILIDADES],
    ['profiles', 'unidad_peso', UNIDADES_PESO],
    ['photos', 'visibilidad', VISIBILIDADES],
    ['friendships', 'estado', ESTADOS_AMISTAD],
    ['challenges', 'estado', ESTADOS_RETO],
    ['sesiones', 'estado', ESTADOS_SESION],
    ['feedback', 'tipo', TIPOS_FEEDBACK],
    ['logs', 'origen', ORIGENES_DIA],
    ['sesiones', 'origen', ORIGENES_SESION],
  ];

  for (const [tabla, columna, delCliente] of PINEADOS) {
    chequear(
      `${tabla}.${columna}`,
      laBaseAcepta(tabla, columna),
      [...delCliente].sort()
    );
  }

  // Los tres del DOTS no son un `check` sino FILAS del catálogo, así que se
  // preguntan igual pero a la tabla. Si a alguno le cambian el id, los
  // estándares de fuerza dejan de encontrarlo y la sección se apaga sola.
  const delDots = (
    await db.query(`select id from ejercicios where cuenta_dots order by id`)
  ).rows.map((f) => f.id);
  chequear('los ejercicios que cuentan para el DOTS', delDots, [...EJERCICIOS_DOTS].sort());

  // EL CATALOGO GRANDE (migracion 29). Se prueban las dos mitades de la
  // decision, que tiran para lados opuestos: que haya MUCHOS para contar
  // series, y que sigan siendo TRES los que mueven el DOTS. Sin la segunda, la
  // primera se lleva puesta la formula sin que nadie lo note: el numero
  // seguiria saliendo, mas alto y sin significado.
  const cat = (await db.query(`select grupo, count(*)::int n from ejercicios group by 1`)).rows;
  const cuantos = (await db.query(`select count(*)::int n from ejercicios`)).rows[0].n;
  chequear('el catalogo tiene 100 ejercicios', cuantos, 100);
  chequear('y solo 3 mueven el DOTS', delDots.length, 3);
  chequear(
    'los grupos son los seis de siempre',
    cat.map((f) => f.grupo).sort(),
    ['brazos', 'core', 'espalda', 'hombros', 'pecho', 'piernas'].sort()
  );
  // El `orden` es lo que AGRUPA en el selector: la lista se ordena por el, sin
  // ordenar por grupo. Si dos grupos se entreveran en la numeracion, la lista
  // sale mezclada y no lo nota nadie hasta verla en el gimnasio.
  //
  // Se miran solo los que NO cuentan para el DOTS: los tres del DOTS viven en
  // el 10, 20 y 30 —y en tres grupos distintos— porque en el selector van
  // aparte, arriba de todo. Meterlos aca haria fallar al test por la unica
  // excepcion que esta bien.
  const arranques = (
    await db.query(`
      with x as (
        select grupo, lag(grupo) over (order by orden) ant
          from ejercicios where not cuenta_dots
      )
      select distinct grupo from x where ant is not null and ant <> grupo
    `)
  ).rows.length;
  chequear('cada grupo ocupa un tramo seguido de `orden`', arranques, 5);

  // Los literales sueltos de los módulos que no pueden importar nada, pineados
  // igual: son los que ningún tipo protege.
  chequear(
    'el estado con duración que usa Stats existe en la base',
    ESTADOS_SESION.includes(ESTADO_CON_DURACION),
    true
  );

  // Y los mismos tres tienen que ser los que conoce la tabla de estándares,
  // que vive aparte porque no puede importar nada.
  chequear(
    'y son los mismos que conocen los estándares',
    [...EJERCICIOS_ESTANDAR].sort(),
    [...EJERCICIOS_DOTS].sort()
  );
}

console.log('\n34. Ningun parametro se ignora en silencio');
{
  // Un parametro que la funcion nunca usa MIENTE: quien lo pasa cree que
  // controla algo. Siete funciones tenian uno —quedaron de cuando el cliente
  // mandaba la fecha— y el costo real fue que la seccion 6 del e2e "probaba"
  // la subida de rango pasando `p_fecha: ayer`, registraba hoy, chocaba con el
  // dia que ya estaba y devolvia nulls. Nueve migraciones sin probar nada.
  //
  // Esto no es una revision que alguien tiene que acordarse de hacer: falla
  // sola en cuanto aparezca el proximo.
  // Solo los parámetros de ENTRADA. `proargnames` trae también los nombres de
  // las columnas de salida de las funciones `returns table(...)`, y esos por
  // definición no aparecen en el cuerpo: sin filtrar, el chequeo denunciaba
  // media base.
  const fns = (
    await db.query(`
      select p.proname as nombre,
             pg_get_function_identity_arguments(p.oid) as firma,
             p.prosrc as cuerpo,
             coalesce(
               (select array_agg(n order by i)
                  from unnest(p.proargnames) with ordinality as a(n, i)
                 where p.proargmodes is null or p.proargmodes[i] in ('i', 'b')),
               '{}'
             ) as entradas
        from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.proargnames is not null
    `)
  ).rows;

  const ignorados = [];
  for (const f of fns) {
    const cuerpo = f.cuerpo.replace(/--[^\n]*/g, '');
    for (const arg of f.entradas ?? []) {
      if (!bordeDePalabra(arg).test(cuerpo)) {
        ignorados.push(`${f.nombre}(${f.firma}) nunca usa ${arg}`);
      }
    }
  }
  chequear('ninguna funcion recibe algo que despues no mira', ignorados.sort(), []);
}

console.log('\n35. Nada del navegador fuera de src/plataforma');
{
  // El puerto de almacenamiento no sirve de nada si alguien vuelve a llamar a
  // `localStorage` directo: al pasar a Expo ese archivo no compila y hay que
  // encontrarlo a mano. Esto lo encuentra ahora.
  //
  // La lista crece con cada puerto. `navigator.userAgent`,
  // `navigator.serviceWorker` y `navigator.hardwareConcurrency` NO estan: son
  // del navegador y de la PWA, que desaparecen enteros al migrar en vez de
  // tener equivalente nativo.
  const PROHIBIDAS = [
    'localStorage',
    'sessionStorage',
    'AudioContext',
    'audioSession',
    'geolocation',
    'wakeLock',
    'vibrate',
    // El puerto de ciclo de vida. Sostiene el cronómetro, el descanso, el
    // vigilante del gimnasio, el de la sesión y el motor: es el que más cosas
    // aguanta, y por eso el que menos puede filtrarse de a poco.
    'visibilityState',
    'visibilitychange',
    // El puerto de avisos remotos (el de las 20:30). En nativo es el token de
    // Expo: si Ajustes llamara a `pushManager` directo, no compilaria.
    'pushManager',
    'requestPermission',
  ];

  const { readdirSync, readFileSync: leerArchivo, statSync } = await import('node:fs');
  const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const archivos = [];
  const recorrer = (d) => {
    for (const n of readdirSync(d)) {
      const ruta = join(d, n);
      if (statSync(ruta).isDirectory()) {
        if (n !== 'plataforma') recorrer(ruta);
      } else if (/\.tsx?$/.test(n)) {
        archivos.push(ruta);
      }
    }
  };
  recorrer(SRC);
  // Lo compartido con la app nativa también es código de la app.
  recorrer(join(SRC, '..', 'compartido'));

  const culpables = [];
  for (const a of archivos) {
    // Sin comentarios: la prosa puede nombrarlas y no pasa nada.
    const codigo = sinComentarios(leerArchivo(a, 'utf8'));
    for (const api of PROHIBIDAS) {
      if (bordeDePalabra(api).test(codigo)) {
        culpables.push(`${a.split('src')[1]} usa ${api}`);
      }
    }
  }
  chequear('solo el puerto toca las APIs del navegador', culpables.sort(), []);
}

console.log('\n36. Ningun `\\b` suelto adentro de un template literal');
{
  // Documentarlo no alcanzo: mordio TRES veces, la ultima adentro del chequeo
  // que existe para cazar esta familia. Asi que ahora falla solo.
  //
  // Adentro de un template literal `\\b` es el caracter de retroceso (0x08), no
  // el borde de palabra del regex: el patron busca un byte de control y no
  // matchea nunca, en silencio y sin error. La forma correcta es
  // `bordeDePalabra()` de utiles.mjs, que lo arma concatenando.
  const { readdirSync, readFileSync: leerArchivo, statSync } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const archivos = [];
  const recorrer = (d) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n === '.next' || n.startsWith('.next-')) continue;
      const ruta = join(d, n);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.(mjs|tsx?)$/.test(n)) archivos.push(ruta);
    }
  };
  recorrer(join(RAIZ, 'src'));
  recorrer(join(RAIZ, 'compartido'));
  recorrer(join(RAIZ, 'nucleo'));
  recorrer(join(RAIZ, 'supabase'));

  const culpables = [];
  for (const a of archivos) {
    for (const tramo of retrocesosEnTemplate(sinComentarios(leerArchivo(a, 'utf8')))) {
      culpables.push(`${a.split(RAIZ)[1]}: ...${tramo}`);
    }
  }
  chequear('ningun retroceso disfrazado de borde de palabra', culpables.sort(), []);
}

console.log('\n37. El bus de avisos');
{
  // Reemplaza al `window.dispatchEvent` que hacia aparecer la franja de sesion
  // sin recargar. En Expo no hay window; un emisor en memoria hace lo mismo.
  let a = 0;
  let b = 0;
  const cortarA = eventos.escuchar('x', () => a++);
  eventos.escuchar('x', () => b++);
  eventos.escuchar('otro', () => a++);

  eventos.emitir('x');
  chequear('el aviso llega a todos los que escuchan ese nombre', [a, b], [1, 1]);

  eventos.emitir('otro');
  chequear('y solo a ese nombre', [a, b], [2, 1]);

  cortarA();
  eventos.emitir('x');
  chequear('desuscribirse corta', [a, b], [2, 2]);

  eventos.emitir('nadie escucha esto');
  chequear('un nombre sin oyentes no rompe', true, true);

  // La garantia: el que estaba escuchando cuando se emitio recibe el aviso,
  // aunque OTRO oyente lo desuscriba en el medio. Sin la copia, borrar un
  // elemento que la iteracion todavia no visito hace que no se visite.
  //
  // Ojo: que un oyente se baje a SI MISMO no prueba esto —ese caso es seguro
  // con copia y sin ella—, y era lo que probaba la primera version de este
  // test: pasaba en verde con el codigo roto.
  let c = 0;
  let d = 0;
  const cortarD = () => bajarD();
  eventos.escuchar('y', () => {
    c++;
    cortarD();
  });
  const bajarD = eventos.escuchar('y', () => d++);
  eventos.emitir('y');
  chequear('el que ya estaba escuchando recibe el aviso igual', [c, d], [1, 1]);
}

console.log('\n38. Distancias y el punto del gimnasio');
{
  // Aca un error da un numero creible y equivocado, que es la peor clase: si
  // la distancia diera de mas, el dia no se registraria nunca y no habria
  // ningun error que mirar.
  const MONTEVIDEO = { lat: -34.9011, lon: -56.1645 };
  const BUENOS_AIRES = { lat: -34.6037, lon: -58.3816 };

  // Distancia publicada entre las dos ciudades: ~205 km en linea recta.
  const km = metrosEntre(MONTEVIDEO, BUENOS_AIRES) / 1000;
  chequear('Montevideo a Buenos Aires da ~205 km', Math.abs(km - 205) < 5, true);

  chequear('el mismo punto da cero', metrosEntre(MONTEVIDEO, MONTEVIDEO), 0);

  // Un grado de latitud son ~111,3 km en cualquier meridiano.
  const grado = metrosEntre({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  chequear('un grado de latitud son ~111 km', Math.abs(grado - 111195) < 500, true);

  // Y a 100 m: el caso que de verdad importa, medido en la latitud de casa.
  // 0,0009 grados de latitud son ~100 m.
  const cien = metrosEntre(MONTEVIDEO, { lat: MONTEVIDEO.lat + 0.0009, lon: MONTEVIDEO.lon });
  chequear('0,0009 grados son ~100 m', Math.abs(cien - 100) < 3, true);

  // ---- el radio ----
  const cerca = { lat: MONTEVIDEO.lat + 0.0005, lon: MONTEVIDEO.lon }; // ~55 m
  const lejos = { lat: MONTEVIDEO.lat + 0.005, lon: MONTEVIDEO.lon }; // ~555 m
  chequear('adentro del radio', estaAdentro(cerca, MONTEVIDEO, 100), true);
  chequear('afuera del radio', estaAdentro(lejos, MONTEVIDEO, 100), false);

  // La precision del GPS SUMA al radio: con 40 m de error, estar a 110 de un
  // radio de 100 puede ser estar adentro. Se prefiere el falso positivo porque
  // el costo no es simetrico —un dia de mas se corrige a mano, uno de menos
  // corta la racha— y porque el registro manual nunca desaparece.
  const justoAfuera = { lat: MONTEVIDEO.lat + 0.001, lon: MONTEVIDEO.lon }; // ~111 m
  chequear('sin precision, 111 m queda afuera de 100', estaAdentro(justoAfuera, MONTEVIDEO, 100), false);
  chequear('con 40 m de error, entra', estaAdentro(justoAfuera, MONTEVIDEO, 100, 40), true);
  // Con un punto de AFUERA esto pasaba igual con `Math.max(0, ...)` y sin él
  // —los dos dan false— así que no probaba nada. Tiene que ser un punto de
  // adentro: ahí una precisión negativa lo sacaría, y el `max` lo impide.
  chequear('una precision negativa no achica el radio', estaAdentro(cerca, MONTEVIDEO, 100, -1000), true);

  // ---- el arreglo viejo no puede descartar, pero si confirmar ----
  // Abrir la app en casa deja un arreglo cacheado; cuatro minutos despues
  // llegas al gimnasio y ese arreglo dice que estas en casa. Un "no estas"
  // viejo NO sirve, y un "si estas" viejo si: estuviste ahi hace un rato.
  const gim = { lat: MONTEVIDEO.lat, lon: MONTEVIDEO.lon };
  const enCasa = { lat: MONTEVIDEO.lat + 0.02, lon: MONTEVIDEO.lon, precision: 20 };
  const enElGim = { lat: MONTEVIDEO.lat, lon: MONTEVIDEO.lon, precision: 20 };
  chequear('un arreglo que dice adentro alcanza', estaAdentro(enElGim, gim, 100, 20), true);
  chequear('y uno que dice afuera, no', estaAdentro(enCasa, gim, 100, 20), false);

  // ---- los limites que acepta la base ----
  const u = await nuevoUsuario();
  const guardar = (lat, lon, radio) =>
    db.query('update profiles set gimnasio_lat = $2, gimnasio_lon = $3, gimnasio_radio = $4 where id = $1',
      [u, lat, lon, radio]).then(() => true).catch(() => false);

  chequear('un punto valido entra', await guardar(-34.901, -56.164, 100), true);
  chequear('media coordenada no', await guardar(-34.901, null, 100), false);
  chequear('sin punto si entra', await guardar(null, null, 100), true);
  chequear('un radio de 10 m no', await guardar(-34.901, -56.164, 10), false);
  chequear('uno de 1000 m tampoco', await guardar(-34.901, -56.164, 1000), false);
  chequear('una latitud imposible no', await guardar(-200, -56.164, 100), false);

  // ---- el origen queda guardado ----
  await comoUsuario(u);
  await db.query(`select registrar_dia('ubicacion')`);
  const o = await db.query('select origen from logs where user_id = $1', [u]);
  chequear('el dia guarda de donde salio', o.rows[0].origen, 'ubicacion');
  await db.exec('reset role');
}

// =====================================================================
console.log('\n39. Dos personas no pueden llamarse igual');
{
  // Lo garantiza un indice unico sobre lower(username), no una consulta
  // previa: preguntar "esta libre?" y despues escribir deja una ventana en el
  // medio donde otro se lo lleva. El indice no tiene ventana.
  const a = await nuevoUsuario();
  const b = await nuevoUsuario();

  async function ponerNombre(uid, nombre) {
    await comoUsuario(uid);
    try {
      await db.query('update profiles set username = $1 where id = $2', [nombre, uid]);
      await db.exec('reset role');
      return true;
    } catch (e) {
      await db.exec('reset role');
      return e.code === '23505' ? 'duplicado' : e.message;
    }
  }

  chequear('el primero se queda con el nombre', await ponerNombre(a, 'agustin'), true);
  chequear('el segundo no lo puede repetir', await ponerNombre(b, 'agustin'), 'duplicado');
  // Y tampoco cambiandole las mayusculas, que es como se cuela un impostor.
  chequear('ni con otras mayusculas', await ponerNombre(b, 'AgUsTiN'), 'duplicado');
  chequear('uno parecido si', await ponerNombre(b, 'agustin_b'), true);

  // La busqueda encuentra por PARTE del nombre: buscar "agustin" tiene que
  // traer agustin, agustin_b y cualquier otro que lo contenga.
  const encontrados = await db.query(
    `select username from usuarios_publicos where username ilike $1 order by username`,
    ['%agustin%']
  );
  chequear(
    'la busqueda parcial los trae a los dos',
    encontrados.rows.map((f) => f.username).join(','),
    'agustin,agustin_b'
  );
}

// =====================================================================
console.log('\n40. Llegar al gimnasio: cuando arranca la sesion y cuando se cierra');
{
  // `decidir` es pura, asi que esto prueba la logica DE VERDAD y no un espejo
  // de si misma: no hay GPS, ni reloj, ni base. Es la unica parte del
  // automatico que se puede probar sin caminar hasta un gimnasio, y por eso
  // esta separada del resto.
  const T0 = 1_000_000_000_000;
  const ESPERA = ESPERA_LLEGADA_MS;
  const libre = { corriendo: false, porUbicacion: false };
  const corriendoSola = { corriendo: true, porUbicacion: true };
  const corriendoAMano = { corriendo: true, porUbicacion: false };

  // ---- no saber no es estar afuera ----
  {
    const v = { desde: T0, ultimoAdentro: T0, arranco: false };
    const d = decidir(null, T0 + 1000, T0 + 1000, v, corriendoSola);
    chequear('sin senal no pasa nada', d.hacer, 'nada');
    // Lo importante: NO borra la vigilancia ni cierra la sesion. Un GPS que se
    // pierde en un subsuelo apagaria el cronometro de alguien que entrena.
    chequear('sin senal la visita sigue viva', d.vigilancia?.desde, T0);
  }

  // ---- llegar y esperar ----
  {
    const d = decidir(true, T0, T0, null, libre);
    chequear('la primera vez adentro solo anota la llegada', d.hacer, 'nada');
    chequear('y la llegada es cuando se MIDIO el punto', d.vigilancia?.desde, T0);
  }
  {
    const v = { desde: T0, ultimoAdentro: T0, arranco: false };
    const d = decidir(true, T0 + ESPERA - 1, T0 + ESPERA - 1, v, libre);
    chequear('un segundo antes de la espera todavia no arranca', d.hacer, 'nada');
  }
  {
    const v = { desde: T0, ultimoAdentro: T0, arranco: false };
    const d = decidir(true, T0 + ESPERA, T0 + ESPERA, v, libre);
    chequear('cumplida la espera, arranca', d.hacer, 'arrancar');
    // EL PUNTO DE TODO: arranca ahora pero la sesion dice que empezo cuando
    // llego. Si dijera la hora del disparo, la duracion saldria corta siempre.
    chequear('y arranca desde la LLEGADA, no desde el disparo', d.desde, T0);
    chequear('la visita queda marcada como usada', d.vigilancia?.arranco, true);
  }

  // ---- no dispara dos veces ----
  {
    const v = { desde: T0, ultimoAdentro: T0, arranco: true };
    const d = decidir(true, T0 + ESPERA * 3, T0 + ESPERA * 3, v, libre);
    // Si volviera a arrancar, parar el cronometro a mano estando todavia en el
    // gimnasio lo encenderia de nuevo a los dos minutos.
    chequear('si ya arranco en esta visita, no vuelve a arrancar', d.hacer, 'nada');
  }
  {
    const v = { desde: T0, ultimoAdentro: T0, arranco: false };
    const d = decidir(true, T0 + ESPERA, T0 + ESPERA, v, corriendoAMano);
    chequear('con una sesion ya corriendo no arranca otra', d.hacer, 'nada');
  }

  // ---- el reloj de la salida ----
  {
    const v = { desde: T0, ultimoAdentro: T0 + 1000, arranco: false };
    const d = decidir(true, T0 + 500, T0 + 2000, v, corriendoSola);
    // Un arreglo de GPS viejo no puede ATRASAR la ultima vez que se lo vio.
    chequear('un punto viejo no atrasa el ultimo visto', d.vigilancia?.ultimoAdentro, T0 + 1000);
  }

  // ---- irse ----
  {
    const v = { desde: T0, ultimoAdentro: T0 + 3600_000, arranco: true };
    const d = decidir(false, T0 + 7200_000, T0 + 7200_000, v, corriendoSola);
    chequear('salir cierra la que arranco sola', d.hacer, 'terminar');
    // No se cierra con AHORA: si la app estuvo cerrada nos enteramos tarde, y
    // cerrar con ahora daria una sesion de dos horas.
    chequear('y se cierra con la ultima vez que se lo vio', d.hasta, T0 + 3600_000);
    chequear('la visita se termina', d.vigilancia, null);
  }
  {
    const v = { desde: T0, ultimoAdentro: T0 + 1000, arranco: false };
    const d = decidir(false, T0 + 2000, T0 + 2000, v, corriendoAMano);
    // Quiza salio a correr afuera. Apagarsela seria peor que dejarla.
    chequear('salir NO cierra la que empezaste vos', d.hacer, 'nada');
    chequear('pero la visita igual se termina', d.vigilancia, null);
  }
  {
    const d = decidir(false, T0, T0, null, libre);
    chequear('afuera y sin sesion no hace nada', d.hacer, 'nada');
  }

  // ---- la vuelta completa: llego, entreno, me voy ----
  {
    let v = null;
    let d = decidir(true, T0, T0, v, libre);
    v = d.vigilancia;
    d = decidir(true, T0 + ESPERA, T0 + ESPERA, v, libre);
    chequear('la vuelta completa arranca', d.hacer, 'arrancar');
    v = d.vigilancia;
    const fin = T0 + ESPERA + 3600_000;
    d = decidir(true, fin, fin, v, corriendoSola);
    v = d.vigilancia;
    d = decidir(false, fin + 120_000, fin + 120_000, v, corriendoSola);
    chequear('y cierra al salir', d.hacer, 'terminar');
    chequear('con una hora de sesion desde la llegada', (d.hasta - T0) / 60000, 67);
  }
}

// =====================================================================
console.log('\n41. La base no le cree al cliente la hora de llegada');
{
  const u = await nuevoUsuario();
  await comoUsuario(u);

  // Por el id que devuelve el RPC, no por `order by inicio desc`: una sesion
  // que arranca diez minutos ANTES queda mas atras en ese orden, asi que el
  // test miraba la sesion anterior y la daba por buena. El propio test tenia
  // el bug que venia a buscar.
  // Se cierra la anterior antes de cada arranque. Desde la migración 26
  // `iniciar_sesion` DEVUELVE la que ya está corriendo en vez de pisarla, así
  // que sin esto el segundo arranque no crearía nada y el test estaría
  // mirando la sesión del caso anterior — y dando por buenos sus valores.
  const arrancar = async (sql) => {
    // Se envejece la que esté corriendo antes de cerrarla: desde la migración
    // 26, cerrar una sesión de segundos que creó el día DESHACE el día, y
    // entonces el arranque siguiente crearía uno nuevo — con lo que este
    // bloque estaría probando otra cosa de la que cree.
    await db.query(
      `update sesiones set inicio = now() - interval '40 minutes'
        where user_id = $1 and estado = 'corriendo'`,
      [u]
    );
    await db.query('select terminar_sesion()');
    const v = (await db.query(sql)).rows[0].v;
    return (await db.query('select * from sesiones where id = $1', [v.id])).rows[0];
  };

  // ---- una sesion normal sigue siendo normal ----
  let s = await arrancar('select iniciar_sesion() as v');
  chequear('sin argumentos el origen es manual', s.origen, 'manual');
  const recien = (await db.query('select extract(epoch from (now() - $1::timestamptz)) as d', [s.inicio])).rows[0].d;
  chequear('y arranca ahora', Math.abs(Number(recien)) < 5, true);

  // ---- la llegada corre el inicio hacia atras ----
  s = await arrancar(`select iniciar_sesion(now() - interval '10 minutes', 'ubicacion') as v`);
  chequear('el origen queda guardado', s.origen, 'ubicacion');
  const atras = (await db.query('select extract(epoch from (now() - $1::timestamptz)) as d', [s.inicio])).rows[0].d;
  chequear('y el inicio es la llegada, diez minutos atras', Math.round(Number(atras) / 60), 10);

  // El dia YA estaba de la sesion anterior, asi que conserva SU origen: el dia
  // se registro a mano y eso no se reescribe porque despues llegues al
  // gimnasio. El origen dice de donde salio el dia, no la ultima sesion.
  const diaViejo = (await db.query('select origen from logs where id = $1', [s.log_id])).rows[0];
  chequear('un dia que ya estaba conserva su origen', diaViejo.origen, 'manual');

  // Con el dia sin registrar, en cambio, lo crea la sesion y lo hereda: si el
  // cronometro arranco porque llegaste, el dia tambien entro por eso.
  {
    const limpio = await nuevoUsuario();
    await comoUsuario(limpio);
    const v = (await db.query(
      `select iniciar_sesion(now() - interval '8 minutes', 'ubicacion') as v`
    )).rows[0].v;
    const log = (await db.query(
      'select origen from logs where id = ($1::jsonb ->> $2)::uuid',
      [JSON.stringify(v.registro), 'log_id']
    )).rows[0];
    chequear('el dia que crea la sesion hereda el origen', log.origen, 'ubicacion');
    await comoUsuario(u);
  }

  // ---- pero no le cree cualquier cosa ----
  // Sin esto, un cliente manipulado se fabrica sesiones de seis horas.
  s = await arrancar(`select iniciar_sesion(now() - interval '9 hours', 'ubicacion') as v`);
  const acotado = (await db.query('select extract(epoch from (now() - $1::timestamptz)) as d', [s.inicio])).rows[0].d;
  chequear('nueve horas atras se acotan a cuarenta y cinco minutos', Math.round(Number(acotado) / 60), 45);

  s = await arrancar(`select iniciar_sesion(now() + interval '3 hours', 'ubicacion') as v`);
  const futuro = (await db.query('select extract(epoch from ($1::timestamptz - now())) as d', [s.inicio])).rows[0].d;
  // Un reloj adelantado en el telefono daria duraciones NEGATIVAS.
  chequear('y el futuro se acota a ahora', Number(futuro) <= 0, true);

  // ---- `mi_sesion` lo cuenta ----
  await db.query('select terminar_sesion()');
  await db.query(`select iniciar_sesion(now() - interval '2 minutes', 'ubicacion') as v`);
  const mia = (await db.query('select mi_sesion() as v')).rows[0].v;
  chequear('mi_sesion dice de donde salio', mia.origen, 'ubicacion');

  // ---- la salida cierra con la hora de la salida ----
  await db.query('select terminar_sesion()');
  await db.query(`select iniciar_sesion(now() - interval '40 minutes', 'ubicacion') as v`);
  let fin = (await db.query(`select terminar_sesion(now() - interval '10 minutes') as v`)).rows[0].v;
  chequear('cierra con la hora que se le pasa', Math.round(Number(fin.segundos) / 60), 30);
  chequear('y esa duracion cuenta', fin.cuenta, true);

  // ---- ni antes del inicio ni despues de ahora ----
  await db.query('select terminar_sesion()');
  await db.query(`select iniciar_sesion(now() - interval '20 minutes', 'ubicacion') as v`);
  fin = (await db.query(`select terminar_sesion(now() - interval '5 hours') as v`)).rows[0].v;
  // Una duracion negativa romperia el promedio de Stats sin que nadie lo note.
  chequear('un fin anterior al inicio da cero, no negativo', Number(fin.segundos), 0);

  await db.query('select terminar_sesion()');
  await db.query(`select iniciar_sesion(now() - interval '20 minutes', 'ubicacion') as v`);
  fin = (await db.query(`select terminar_sesion(now() + interval '5 hours') as v`)).rows[0].v;
  chequear('y un fin en el futuro se acota a ahora', Math.round(Number(fin.segundos) / 60), 20);

  await db.exec('reset role');
}

// =====================================================================
console.log('\n42. A /login solo se manda cuando se SABE que no hay sesion');
{
  // La decision mas peligrosa de la app. Mandar a /login a alguien que si
  // tiene sesion lo deja AFUERA: hoy no hay recuperacion de contrasena porque
  // el SMTP esta apagado. Por eso los dos errores no valen lo mismo y ante la
  // duda se sigue.
  const caso = (extra) =>
    decidirRuta({
      hayCookiesDeSesion: true,
      hayUsuario: false,
      fallo: 'no',
      esPublica: false,
      ...extra,
    });

  // ---- lo normal ----
  chequear('con usuario confirmado, pasa', caso({ hayUsuario: true }), 'seguir');
  chequear('sin cookies, a entrar', caso({ hayCookiesDeSesion: false }), 'a-login');
  chequear('sin cookies pero en pantalla publica, pasa',
    caso({ hayCookiesDeSesion: false, esPublica: true }), 'seguir');
  chequear('con cookies que el servidor rechazo, a entrar',
    caso({ fallo: 'de-auth' }), 'a-login');

  // ---- EL BUG ----
  // Esto es lo que rebotaba a /login a alguien con sesion valida: `getUser()`
  // sale a la red en cada pedido, y su error se tiraba a la basura.
  chequear('CON COOKIES Y LA RED CAIDA, SIGUE', caso({ fallo: 'de-red' }), 'seguir');

  // ---- que cada error caiga donde tiene que caer ----
  chequear('el fetch que no llego es de red',
    clasificar({ name: 'AuthRetryableFetchError' }), 'de-red');
  chequear('un 401 es de auth', clasificar({ status: 401 }), 'de-auth');
  chequear('un 403 es de auth', clasificar({ status: 403 }), 'de-auth');
  chequear('un 500 es de red', clasificar({ status: 500 }), 'de-red');
  chequear('un 503 es de red', clasificar({ status: 503 }), 'de-red');
  // Que Supabase nos frene por exceso de pedidos no significa que la persona
  // no tenga sesion. Tratarlo como de-auth desloguearia a todos a la vez.
  chequear('un 429 es de red', clasificar({ status: 429 }), 'de-red');
  chequear('sin error, no hay fallo', clasificar(null), 'no');
  // Un error que no sabemos leer NO puede costar la sesion.
  chequear('uno raro se trata como de red', clasificar({ status: 418 }), 'de-red');
  chequear('uno sin status tambien', clasificar({ name: 'Vaya' }), 'de-red');

  // ---- reconocer las cookies de Supabase, incluso partidas ----
  chequear('reconoce la cookie de sesion',
    hayCookiesDeSesion(['sb-okeanaihymbvbdmrdqph-auth-token']), true);
  // Cuando el token no entra en 4 KB, Supabase la parte en pedazos.
  chequear('y la reconoce partida en pedazos',
    hayCookiesDeSesion(['sb-abc-auth-token.0', 'sb-abc-auth-token.1']), true);
  chequear('no confunde otras cookies', hayCookiesDeSesion(['ascent:sesion', 'sb-abc-otra']), false);
  chequear('sin cookies, false', hayCookiesDeSesion([]), false);

  // ---- EL SEGUNDO BUG: el rebote se comia el token nuevo ----
  // Supabase ROTA el refresh token en cada refresco. Si el redirect no lleva
  // los nuevos, el navegador se queda con uno ya consumido y el proximo
  // refresco muere con `refresh_token_already_used`: sesion muerta de verdad,
  // no un parpadeo. Es lo que convertia un hipo de red en un deslogueo.
  {
    const refrescada = NextResponse.next();
    refrescada.cookies.set('sb-abc-auth-token', 'NUEVO');
    const rebote = NextResponse.redirect('https://ascent.test/login?rebote=1');
    chequear('el redirect nace sin cookies', rebote.cookies.getAll().length, 0);
    llevarCookies(rebote, refrescada);
    chequear('y se va con el token refrescado puesto',
      rebote.cookies.get('sb-abc-auth-token')?.value, 'NUEVO');
  }
  {
    // Partido en pedazos tambien: es como viaja cuando no entra en 4 KB.
    const refrescada = NextResponse.next();
    refrescada.cookies.set('sb-abc-auth-token.0', 'parte0');
    refrescada.cookies.set('sb-abc-auth-token.1', 'parte1');
    const rebote = llevarCookies(NextResponse.redirect('https://ascent.test/login'), refrescada);
    chequear('lleva todos los pedazos', rebote.cookies.getAll().length, 2);
  }
}

// =====================================================================
console.log('\n43. Pesarse NO es haber ido al gimnasio');
{
  // El peso corporal se anota a la manana, antes de entrenar o sin entrenar.
  // Vivia adentro de la hoja de registrar el dia, asi que pesarse un domingo
  // sin ir al gimnasio contaba como dia entrenado e inflaba la racha: un
  // numero falso en la unica cifra que la app dice que importa.
  const u = await nuevoUsuario();
  await comoUsuario(u);

  const dias = async () =>
    Number((await db.query('select count(*) as n from logs where user_id = $1', [u])).rows[0].n);
  const pesos = async () =>
    Number((await db.query('select count(*) as n from weights where user_id = $1', [u])).rows[0].n);

  chequear('arranca sin dias', await dias(), 0);
  await db.query('select anotar_peso(80.5)');
  chequear('anotar el peso guarda el peso', await pesos(), 1);
  chequear('Y NO REGISTRA NINGUN DIA', await dias(), 0);

  // Dos veces el mismo dia pisa el valor, no acumula filas.
  await db.query('select anotar_peso(81)');
  chequear('pesarse de nuevo pisa el valor', await pesos(), 1);
  chequear('y sigue sin registrar dias', await dias(), 0);
  const v = (await db.query('select valor from weights where user_id = $1', [u])).rows[0].valor;
  chequear('con el ultimo valor', Number(v), 81);

  // Y la racha, que es lo que se estaba inflando.
  const racha = (await db.query('select racha_actual from profiles where id = $1', [u])).rows[0];
  chequear('la racha sigue en cero', racha.racha_actual, 0);
  await db.exec('reset role');
}

// =====================================================================
console.log('\n45. Ningun parametro de RPC es en realidad una constante');
{
  // LA OTRA MITAD DE LA SECCION 34, y la que faltaba.
  //
  // La 34 pregunta si la FUNCION lee lo que recibe. `registrar_dia` si lee
  // `p_peso` —lo guarda en `weights`— asi que para la 34 estaba todo bien.
  // Pero ningun llamador le pasaba nunca otra cosa que `null`. Son dos
  // mentiras distintas y solo una estaba cubierta:
  //
  //   la funcion ignora lo que le pasas  → creias que controlabas algo (34)
  //   nadie le pasa nunca nada distinto  → el parametro no es un parametro,
  //                                        es una constante disfrazada (45)
  //
  // La segunda pudre igual: el que lee la firma dentro de seis meses asume
  // que sirve y escribe codigo alrededor de algo que no hace nada.
  const fns = (
    await db.query(`
      select p.proname as nombre,
             coalesce(
               (select array_agg(n order by i)
                  from unnest(p.proargnames) with ordinality as a(n, i)
                 where p.proargmodes is null or p.proargmodes[i] in ('i', 'b')),
               '{}'
             ) as entradas
        from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.proargnames is not null
    `)
  ).rows;
  const entradasDe = new Map(fns.map((f) => [f.nombre, f.entradas ?? []]));

  const { readdirSync, readFileSync: leerArchivo, statSync } = await import('node:fs');
  const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const archivos = [];
  const recorrer = (d) => {
    for (const n of readdirSync(d)) {
      const r = join(d, n);
      if (statSync(r).isDirectory()) recorrer(r);
      else if (/\.tsx?$/.test(n)) archivos.push(r);
    }
  };
  recorrer(SRC);
  // Lo compartido con la app nativa también es código de la app.
  recorrer(join(SRC, '..', 'compartido'));

  const pasados = new Map(); // "fn.param" → Set de los textos que se le pasan
  const llamadas = new Set(); // que RPC llama el cliente

  for (const a of archivos) {
    const codigo = sinComentarios(leerArchivo(a, 'utf8'));
    // Se busca el `.rpc('nombre'` y despues se lee el objeto de argumentos
    // CONTANDO LLAVES, no con una expresion regular. Cortar en el primer
    // parentesis partia `new Date(x).toISOString()` al medio, y entonces los
    // argumentos que venian despues parecian no pasarse nunca: la primera
    // version de este chequeo denuncio por eso un parametro que estaba sano.
    for (const m of codigo.matchAll(/\.rpc\(\s*['"]([a-z_]+)['"]/g)) {
      const fn = m[1];
      llamadas.add(fn);
      const resto = codigo.slice(m.index + m[0].length);
      const abre = resto.indexOf('{');
      const cierraLlamada = resto.indexOf(')');
      let cuerpo = '';
      // Hay objeto de argumentos solo si la llave aparece ANTES de que se
      // cierre la llamada. Si no, es un `.rpc('x')` pelado.
      if (abre !== -1 && (cierraLlamada === -1 || abre < cierraLlamada)) {
        let nivel = 0;
        for (let k = abre; k < resto.length; k++) {
          if (resto[k] === '{') nivel++;
          else if (resto[k] === '}') {
            nivel--;
            if (nivel === 0) {
              cuerpo = resto.slice(abre + 1, k);
              break;
            }
          }
        }
      }
      for (const arg of entradasDe.get(fn) ?? []) {
        const v = cuerpo.match(new RegExp(arg + '\\s*:\\s*([^,\\n}]+)'));
        const clave = `${fn}.${arg}`;
        if (!pasados.has(clave)) pasados.set(clave, new Set());
        pasados.get(clave).add(v ? v[1].trim() : '(no se pasa)');
      }
    }
  }

  const constantes = [];
  for (const fn of llamadas) {
    for (const arg of entradasDe.get(fn) ?? []) {
      const vistos = pasados.get(`${fn}.${arg}`);
      if (!vistos || vistos.size !== 1) continue;
      const unico = [...vistos][0];
      // Una expresion puede dar valores distintos en tiempo de ejecucion
      // aunque se escriba una sola vez en el codigo. Solo se denuncia lo que
      // es literalmente siempre lo mismo.
      const esLiteral = /^(null|undefined|true|false|'[^']*'|[0-9.]+|\(no se pasa\))$/.test(unico);
      if (esLiteral) constantes.push(`${fn}(${arg}) siempre vale ${unico}`);
    }
  }
  chequear('ningun parametro de RPC es siempre el mismo valor', constantes.sort(), []);
}

// =====================================================================
console.log('\n46. El toque accidental se deshace, y la sesion viva no se pisa');
{
  const u = await nuevoUsuario();
  await comoUsuario(u);

  const dias = async () =>
    Number((await db.query('select count(*) as n from logs where user_id = $1', [u])).rows[0].n);
  const arrancar = async () => (await db.query('select iniciar_sesion() as v')).rows[0].v;
  const terminar = async (hasta = 'null') =>
    (await db.query(`select terminar_sesion(${hasta}) as v`)).rows[0].v;

  // ---- el toque accidental ----
  {
    const s = await arrancar();
    chequear('la sesion creo el dia', await dias(), 1);
    chequear('y quedo anotado que lo creo ella',
      (await db.query('select creo_el_dia from sesiones where id = $1', [s.id])).rows[0].creo_el_dia,
      true);

    // Se para a los veinte segundos: no hubo entrenamiento.
    const fin = await terminar(`now() - interval '0 seconds'`);
    chequear('se deshizo el dia', fin.deshizo_el_dia, true);
    chequear('y el dia ya no esta', await dias(), 0);
    const racha = (await db.query('select racha_actual from profiles where id = $1', [u])).rows[0];
    chequear('la racha volvio a cero', racha.racha_actual, 0);
  }

  // ---- una sesion de verdad NO se deshace ----
  {
    const s = await arrancar();
    await db.query(`update sesiones set inicio = now() - interval '40 minutes' where id = $1`, [s.id]);
    const fin = await terminar();
    chequear('cuarenta minutos NO se deshacen', fin.deshizo_el_dia, false);
    chequear('y el dia queda', await dias(), 1);
  }

  // ---- si el dia YA estaba, no se toca ----
  {
    await db.query('delete from logs where user_id = $1', [u]);
    // El dia se registra a mano primero: la sesion no lo creo.
    await db.query('select registrar_dia()');
    const s = await arrancar();
    chequear('la sesion no creo este dia',
      (await db.query('select creo_el_dia from sesiones where id = $1', [s.id])).rows[0].creo_el_dia,
      false);
    const fin = await terminar(`now()`);
    // Aunque dure cero: el dia lo registraste vos, y eso manda.
    chequear('un dia registrado a mano NO se deshace', fin.deshizo_el_dia, false);
    chequear('y sigue ahi', await dias(), 1);
  }

  // ---- con otra sesion ese dia, tampoco ----
  {
    await db.query('delete from logs where user_id = $1', [u]);
    const larga = await arrancar();
    await db.query(`update sesiones set inicio = now() - interval '40 minutes' where id = $1`, [larga.id]);
    await terminar();
    // Segunda sesion del mismo dia, cortita.
    const corta = await arrancar();
    chequear('la segunda no creo el dia',
      (await db.query('select creo_el_dia from sesiones where id = $1', [corta.id])).rows[0].creo_el_dia,
      false);
    const fin = await terminar(`now()`);
    chequear('con otra sesion ese dia no se deshace', fin.deshizo_el_dia, false);
    chequear('el dia sigue', await dias(), 1);
  }

  // ---- LA SESION VIVA NO SE PISA ----
  {
    await db.query('delete from logs where user_id = $1', [u]);
    const primera = await arrancar();
    const segunda = await arrancar();
    // Antes esto marcaba la primera 'abandonada' y creaba otra: su duracion se
    // perdia sin que nadie dijera nada, y podia pasar solo porque el estado
    // del cliente y el de la base se pueden separar.
    chequear('empezar de nuevo devuelve la que ya estaba', segunda.id, primera.id);
    chequear('y lo dice', segunda.yaEstaba, true);
    const cuantas = (
      await db.query(`select count(*) as n from sesiones where user_id = $1 and estado = 'abandonada'`, [u])
    ).rows[0].n;
    chequear('no quedo ninguna abandonada', Number(cuantas), 0);
  }

  await db.exec('reset role');
}

// =====================================================================
console.log('\n47. Las series se pueden reintentar sin contar de mas');
{
  // El `+` del gimnasio escribe a traves de una cola, y una cola solo sirve si
  // repetir la escritura es inofensivo. `sumar_serie` era `series + 1`: si la
  // escritura llegaba pero la respuesta se perdia, el reintento contaba dos.
  const u = await nuevoUsuario();
  await comoUsuario(u);
  const s = (await db.query('select iniciar_sesion() as v')).rows[0].v;
  // Cuarenta minutos atrás: si durara segundos, terminarla desharía el día
  // —regla nueva de la 26— y la cascada se llevaría la sesión con él. Lo
  // aprendí rompiendo este test.
  await db.query(`update sesiones set inicio = now() - interval '40 minutes' where id = $1`, [s.id]);
  const series = async () =>
    (await db.query('select series from sesiones where id = $1', [s.id])).rows[0].series;

  await db.query('select fijar_series($1, 3)', [s.id]);
  chequear('fija el total', await series(), 3);
  await db.query('select fijar_series($1, 3)', [s.id]);
  await db.query('select fijar_series($1, 3)', [s.id]);
  chequear('REPETIRLA NO CUENTA DE MAS', await series(), 3);

  await db.query('select fijar_series($1, 2)', [s.id]);
  chequear('y puede bajar', await series(), 2);

  // El conteo llega del telefono, asi que se acota acá.
  await db.query('select fijar_series($1, -5)', [s.id]);
  chequear('un negativo se acota a cero', await series(), 0);
  await db.query('select fijar_series($1, 99999)', [s.id]);
  chequear('y un absurdo al tope', await series(), 999);

  // La cola puede vaciarse cuando la sesion ya termino: por eso lleva el id.
  await db.query('select terminar_sesion()');
  await db.query('select fijar_series($1, 7)', [s.id]);
  chequear('sigue funcionando con la sesion ya terminada', await series(), 7);

  // Y nunca sobre la sesion de otro.
  const otro = await nuevoUsuario();
  await comoUsuario(otro);
  await db.query('select fijar_series($1, 42)', [s.id]);
  await comoUsuario(u);
  chequear('otro usuario no puede tocarla', await series(), 7);

  await db.exec('reset role');
}

// =====================================================================
console.log('\n48. El bloque: qué estás haciendo y cuántas te propusiste');
{
  // LA REGLA QUE MÁS IMPORTA: llegar a la meta no cierra nada. Que la app
  // decida por vos que terminaste es justo lo que no se quiere.
  {
    let b = bloquesVacios('sentadilla', 3);
    b = sumar(sumar(sumar(b)));
    chequear('con la meta cumplida el bloque SIGUE abierto', [b.hechas, b.cerrados.length], [3, 0]);
    chequear('y la meta se marca como cumplida', metaCumplida(b), true);
    b = sumar(b);
    chequear('se puede pasar de la meta', b.hechas, 4);
    chequear('pasarse tampoco cierra nada', b.cerrados.length, 0);
  }

  // Sin elegir ejercicio nunca: tiene que funcionar igual.
  {
    let b = bloquesVacios(null, 3);
    b = sumar(sumar(b));
    chequear('cuenta sin ejercicio', b.hechas, 2);
    chequear('pero NO se guarda como bloque', paraGuardar(b), []);
    b = siguiente(b);
    chequear('y al pasar al siguiente tampoco', paraGuardar(b), []);
  }

  // Cerrar y seguir.
  {
    let b = bloquesVacios('press_banca', 3);
    b = siguiente(sumar(sumar(sumar(b))));
    chequear('siguiente cierra el bloque', b.cerrados, [{ ejercicio: 'press_banca', series: 3 }]);
    chequear('y arranca en cero', b.hechas, 0);
    chequear('conservando ejercicio y meta', [b.ejercicio, b.meta], ['press_banca', 3]);
    const antes = b.cerrados.length;
    b = siguiente(b);
    chequear('siguiente sin nada hecho no cierra un bloque vacio', b.cerrados.length, antes);
  }

  // Cambiar de ejercicio cierra el anterior, sin pedir confirmacion.
  {
    let b = bloquesVacios('sentadilla', 3);
    b = cambiarEjercicio(sumar(sumar(b)), 'peso_muerto');
    chequear('cambiar de ejercicio cierra el anterior', b.cerrados, [
      { ejercicio: 'sentadilla', series: 2 },
    ]);
    chequear('y el actual arranca limpio', [b.ejercicio, b.hechas], ['peso_muerto', 0]);
    const igual = cambiarEjercicio(sumar(b), 'peso_muerto');
    chequear('elegir el MISMO ejercicio no corta el bloque', igual.cerrados.length, 1);
  }

  // La meta es un objetivo, no una validacion.
  {
    let b = bloquesVacios('curl_barra', 5);
    b = sumar(sumar(sumar(b)));
    b = cambiarMeta(b, 2);
    chequear('la meta se puede bajar por debajo de lo ya hecho', [b.meta, b.hechas], [2, 3]);
    chequear('una meta absurda cae en la de omision', cambiarMeta(b, 99).meta, 3);
  }

  // Restar corrige de menos y nunca toca lo cerrado.
  {
    let b = bloquesVacios('dominadas', 3);
    b = siguiente(sumar(sumar(b)));
    b = restar(restar(sumar(b)));
    chequear('restar no baja de cero', b.hechas, 0);
    chequear('y no toca los bloques cerrados', b.cerrados, [{ ejercicio: 'dominadas', series: 2 }]);
  }

  // LA SEMILLA NO PUEDE PISAR LO QUE YA CONTASTE. Era el bug del tercer día:
  // la semilla se pide a la base sin bloquear, y en un gimnasio con mala senal
  // llegaba cuando ya habias tocado el + dos veces.
  {
    let b = bloquesVacios(null, 3);
    b = sumar(sumar(b));
    const despues = sembrar(b, 'sentadilla', 4);
    chequear('con series ya contadas la semilla NO toca nada', despues, b);
    chequear('y devuelve el MISMO objeto, para poder no escribir', despues === b, true);
  }
  {
    // Tampoco si el bloque actual esta en cero pero ya hay bloques cerrados.
    let b = siguiente(sumar(sumar(bloquesVacios('dominadas', 3))));
    chequear('con bloques cerrados tampoco siembra', sembrar(b, 'sentadilla', 5), b);
  }
  {
    // Y si esta limpio, siembra.
    const b = sembrar(bloquesVacios(null, 3), 'press_banca', 4);
    chequear('en un bloque limpio si siembra', [b.ejercicio, b.meta, b.hechas], ['press_banca', 4, 0]);
    const sinMeta = sembrar(bloquesVacios(null, 5), 'press_banca');
    chequear('sin meta nueva conserva la que habia', sinMeta.meta, 5);
  }

  // Lo que se manda a la base.
  {
    let b = bloquesVacios('sentadilla', 3);
    b = cambiarEjercicio(sumar(sumar(sumar(b))), 'press_banca');
    b = sumar(sumar(b));
    chequear('se manda lo cerrado MAS el actual', paraGuardar(b), [
      { ejercicio: 'sentadilla', series: 3 },
      { ejercicio: 'press_banca', series: 2 },
    ]);
  }
}


// =====================================================================
console.log('\n49. El pulso del dia: la curva');
{
  // EL BUG QUE ESTO GUARDA. El timestamp de requestAnimationFrame es el del
  // COMIENZO del cuadro y puede ser anterior al performance.now() de un
  // instante antes: medido, llegaba con t = -3 ms. La primera version daba
  // altura NEGATIVA —el objeto se oscurecia en vez de brillar— y como la
  // condicion de seguir era "altura > 0", cortaba en el primer cuadro y lo
  // dejaba apagado para siempre.
  chequear('un tiempo NEGATIVO da cero, no un valor negativo', alturaDelPulso(-3), 0);
  chequear('y en cero tambien es cero', alturaDelPulso(0), 0);
  chequear('pero el pulso NO se da por terminado en el primer cuadro', siguePulsando(-3), true);

  // La forma.
  chequear('a mitad de la subida va por la mitad', alturaDelPulso(SUBIDA_MS / 2), 0.5);
  chequear('en el pico vale uno', alturaDelPulso(SUBIDA_MS), 1);
  chequear('a mitad de la vuelta va por la mitad', alturaDelPulso(SUBIDA_MS + VUELTA_MS / 2), 0.5);

  // El final: cero exacto y sin residuos.
  chequear('al final vale cero exacto', alturaDelPulso(DURACION_MS), 0);
  chequear('y mucho despues tambien', alturaDelPulso(DURACION_MS * 10), 0);
  chequear('y ahi si se da por terminado', siguePulsando(DURACION_MS), false);

  // Nunca se pasa de rango, para cualquier t.
  {
    let fuera = 0;
    for (let t = -100; t <= DURACION_MS + 100; t += 7) {
      const f = alturaDelPulso(t);
      if (!(f >= 0 && f <= 1)) fuera++;
    }
    chequear('la altura NUNCA sale de 0..1', fuera, 0);
  }

  // Basura de entrada no puede apagar el objeto.
  chequear('NaN da cero', alturaDelPulso(NaN), 0);
  chequear('infinito da cero', alturaDelPulso(Infinity), 0);
}


// =====================================================================
console.log('\n50. El diccionario no junta frases muertas');
{
  // `textos.ts` tiene casi cuatrocientas claves y hasta ahora no habia forma de
  // saber cuales seguian vivas. Un diccionario asi se llena de frases muertas:
  // cambias una pantalla, la clave vieja queda, y a los meses hay tres
  // versiones de lo mismo y nadie sabe cual se ve. La primera corrida encontro
  // diez.
  //
  // Y pesa mas de lo que parece: cuando se traduzca al ingles, cada clave
  // muerta es una frase que alguien va a traducir para nada.
  const { readdirSync: leerDir, readFileSync: leerArch, statSync: estado } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const DIC = join(RAIZ, 'nucleo', 'textos.ts');

  const archivos = [];
  const recorrer = (d) => {
    for (const n of leerDir(d)) {
      const r = join(d, n);
      if (estado(r).isDirectory()) recorrer(r);
      else if (/\.tsx?$/.test(n) && r !== DIC) archivos.push(r);
    }
  };
  // LAS DOS CARPETAS. Trece claves —las de fechas y las de marcas— solo las
  // usa el núcleo, que desde la mudanza ya no vive adentro de `src`. Mirando
  // una sola, este test las daba por muertas: se usan todos los días.
  recorrer(join(RAIZ, 'src'));
  recorrer(join(RAIZ, 'compartido'));
  recorrer(join(RAIZ, 'nucleo'));
  // Y la app nativa: hay textos que solo usa ella (las dos puertas de la foto).
  recorrer(join(RAIZ, 'movil', 'src'));

  const codigo = archivos.map((a) => leerArch(a, 'utf8')).join('\n');
  const dic = leerArch(DIC, 'utf8');
  // Cuatro espacios o mas de sangria son las claves hoja; las de dos son las
  // secciones, y esas siempre se usan.
  const claves = [...new Set([...dic.matchAll(/^ {4,}([a-zA-Z][a-zA-Z0-9]*):/gm)].map((m) => m[1]))];
  // Se busca `.laClave` y que no siga un nombre mas largo. Buscar la palabra
  // suelta no sirve: `titulo` aparece en comentarios de media app.
  const muertas = claves.filter((k) => !new RegExp(`\.${k}(?![a-zA-Z0-9])`).test(codigo));

  chequear(`las ${claves.length} claves se usan todas`, muertas, []);
}


// =====================================================================
console.log('\n51. El nucleo no se puede ensuciar');
{
  // ES LA APUESTA ENTERA DE LA MIGRACION. `nucleo/` se comparte tal cual entre
  // la web y la app nativa: las reglas de la racha, los bloques, la llegada al
  // gimnasio, las cuentas de fuerza y los textos. Si algo de ahi adentro toca
  // el navegador o importa de `src/`, en React Native no compila — y se
  // descubre en la tanda 4, cuando ya hay medio port encima.
  //
  // Dos reglas, y las dos se comprueban leyendo los archivos:
  //   1. No importa NADA de afuera de `nucleo/`.
  //   2. No nombra ninguna API del navegador.
  const { readdirSync: leerDir, readFileSync: leerArch } = await import('node:fs');
  const NUCLEO = join(dirname(fileURLToPath(import.meta.url)), '..', 'nucleo');

  // `document` y `window` no estan porque ya los cubre la regla de importar:
  // lo que se busca son los nombres que se pueden usar SIN importar nada.
  const DEL_NAVEGADOR = [
    'document', 'window', 'navigator', 'localStorage', 'sessionStorage',
    'performance.', 'requestAnimationFrame', 'AudioContext', 'fetch(',
    'HTMLElement', 'addEventListener',
  ];

  const afuera = [];
  const sucios = [];
  for (const n of leerDir(NUCLEO)) {
    if (!/\.tsx?$/.test(n)) continue;
    const codigo = sinComentarios(leerArch(join(NUCLEO, n), 'utf8'));
    for (const m of codigo.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const destino = m[1];
      // Solo se permiten rutas relativas al propio nucleo. Ni alias, ni
      // paquetes: un paquete de npm que ande en web puede no andar en RN.
      if (!destino.startsWith('./')) afuera.push(`${n} importa ${destino}`);
    }
    for (const api of DEL_NAVEGADOR) {
      if (codigo.includes(api)) sucios.push(`${n} usa ${api}`);
    }
  }

  chequear('no importa nada de afuera de nucleo/', afuera, []);
  chequear('no toca ninguna API del navegador', sucios, []);

  // Y que no este vacio: un nucleo sin archivos pasaria las dos de arriba.
  const cuantos = leerDir(NUCLEO).filter((n) => /\.ts$/.test(n)).length;
  chequear('y tiene archivos de verdad', cuantos >= 15, true);
}

// =====================================================================
console.log('\n52. El fondo se puede apagar, y el automatico no manda');
{
  // El motor cuesta TRES SEGUNDOS de arranque, medidos. La deteccion
  // automatica lo apaga en equipos flojos, pero es un valor por omision y no
  // un veredicto: quien quiera el fondo igual tiene que poder tenerlo.
  chequear('en auto, equipo bueno: se carga', cargarElMotor('auto', false), true);
  chequear('en auto, equipo flojo: NO se carga', cargarElMotor('auto', true), false);
  // No saber NO es lo mismo que flojo: negarle el fondo a alguien por no poder
  // medirlo seria castigar la falta de dato.
  chequear('en auto, sin saber: se carga', cargarElMotor('auto', null), true);

  // La eleccion de la persona gana SIEMPRE, en los dos sentidos.
  chequear('"siempre" gana en un equipo flojo', cargarElMotor('siempre', true), true);
  chequear('"nunca" gana en un equipo bueno', cargarElMotor('nunca', false), false);
  chequear('"nunca" gana aunque no se sepa', cargarElMotor('nunca', null), false);

  // Lo que llega del almacenamiento es texto de afuera: se valida.
  chequear('una preferencia valida se reconoce', esPreferenciaFondo('siempre'), true);
  chequear('basura no', [esPreferenciaFondo('si'), esPreferenciaFondo(null), esPreferenciaFondo(3)], [false, false, false]);
}

// =====================================================================
console.log('\n53. Corregir un bloque ya cerrado');
{
  // El - de la pantalla solo arregla el bloque EN CURSO. Sin esto, contar una
  // serie de mas hace veinte minutos quedaba mal para siempre.
  const base = () => {
    let b = bloquesVacios('sentadilla', 3);
    b = cambiarEjercicio(sumar(sumar(sumar(b))), 'press_banca'); // cierra [sentadilla,3]
    b = siguiente(sumar(sumar(b)));                              // cierra [press_banca,2]
    return b;
  };

  {
    const b = base();
    chequear('arranco con dos bloques cerrados', b.cerrados, [
      { ejercicio: 'sentadilla', series: 3 },
      { ejercicio: 'press_banca', series: 2 },
    ]);
  }

  // Bajar de a una, y DECIR cuanto cambio el total: el total se lleva aparte a
  // proposito, asi que quien llama tiene que poder ajustarlo sin recalcularlo
  // desde los bloques.
  {
    const r = corregirBloque(base(), 0, -1);
    chequear('bajar una deja el bloque en 2', r.estado.cerrados[0].series, 2);
    chequear('y avisa que el total baja 1', r.cambioEnTotal, -1);
  }
  {
    const r = corregirBloque(base(), 1, 2);
    chequear('subir dos deja el bloque en 4', r.estado.cerrados[1].series, 4);
    chequear('y avisa que el total sube 2', r.cambioEnTotal, 2);
  }

  // Llegar a cero NO borra el bloque: sacarlo es otra decision y tiene su
  // propio boton. Que desaparezca solo en el ultimo toque hace dudar de si se
  // toco bien.
  {
    let r = corregirBloque(base(), 1, -2);
    chequear('llegar a cero deja el bloque en la lista', r.estado.cerrados.length, 2);
    chequear('con cero series', r.estado.cerrados[1].series, 0);
    // Y no baja de cero.
    r = corregirBloque(r.estado, 1, -5);
    chequear('no baja de cero', r.estado.cerrados[1].series, 0);
    chequear('y ahi no cambia el total', r.cambioEnTotal, 0);
  }

  // Quitar el bloque entero.
  {
    const r = quitarBloque(base(), 0);
    chequear('quitar saca el bloque', r.estado.cerrados, [{ ejercicio: 'press_banca', series: 2 }]);
    chequear('y descuenta sus series del total', r.cambioEnTotal, -3);
  }

  // Un indice que no existe no puede romper nada ni mover el total.
  {
    const b = base();
    const r = quitarBloque(b, 99);
    chequear('un indice inexistente no toca nada', [r.estado === b, r.cambioEnTotal], [true, 0]);
    const c = corregirBloque(b, -1, 5);
    chequear('ni al corregir', [c.estado === b, c.cambioEnTotal], [true, 0]);
  }

  // Corregir NO toca el bloque en curso: ese se maneja afuera.
  {
    let b = base();
    b = sumar(sumar(b)); // dos en el bloque actual
    const r = corregirBloque(b, 0, -1);
    chequear('el bloque en curso queda intacto', r.estado.hechas, 2);
  }
}

// =====================================================================
console.log('\n54. Espanol neutro: las reglas de spec/idioma.md');
{
  // POR QUE ESTO ES UN TEST Y NO UNA GUIA DE ESTILO. Sin algo que falle, en
  // seis meses hay tres estilos mezclados: cada texto nuevo se escribe con el
  // gusto de ese dia. Las reglas viven en spec/idioma.md y esto las aplica.
  //
  // MIRA DOS LUGARES, y la segunda mitad se agrego despues de que la primera
  // dejara pasar dos cosas reales: "toma el porcentaje" en textos.ts —la lista
  // de formas estaba incompleta— y toda la explicacion de Ajustes, que es
  // prosa escrita a mano en JSX y no pasa por el diccionario. Un test que
  // cubre el archivo prolijo y no el que se escribe a mano protege del caso
  // facil.
  //
  // Los COMENTARIOS del codigo siguen en rioplatense a proposito: los lee
  // quien programa, no quien entrena. Por eso se sacan antes de mirar.
  const { readFileSync: leer, readdirSync: listar } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

  // Regla 1: nada de voseo. Lista curada y no una regex de terminaciones,
  // porque "-as" tambien termina "mas", "quizas", "atras" y "estas" —que es
  // legitimo en tu—. Una regex que da falsos positivos se termina apagando.
  const VOSEO = [
    'vos', 'tenés', 'podés', 'querés', 'sabés', 'hacés', 'ponés', 'venís',
    'salís', 'elegís', 'seguís', 'entrenás', 'registrás', 'anotás', 'comparás',
    'buscás', 'sumás', 'mirás', 'tocás', 'apretás', 'llevás', 'dejás',
    'cambiás', 'terminás', 'empezás', 'usás', 'marcás', 'perdés', 'ganás',
    'subís', 'bajás', 'abrís', 'cerrás', 'escribís', 'decís', 'faltás',
    'levantás', 'cargás', 'descansás', 'necesitás', 'pesás', 'sos',
    'tocá', 'mirá', 'poné', 'andá', 'fijate', 'decime', 'pasame', 'avisame',
    'acordate', 'sacate', 'elegí', 'anotá', 'registrá', 'empezá', 'usá',
    'hacé', 'marcá', 'apretá', 'probá', 'contá', 'volvé', 'seguí', 'entrá',
    'agregá', 'guardá', 'mandá', 'sacá', 'sumá', 'quitá', 'corregí',
    'tomá', 'llevá', 'esperá', 'revisá', 'pedí', 'comprobá', 'compará',
    'marcalo', 'apretalo', 'tocala', 'tocalo', 'ponete', 'quedate', 'mirate',
    // Se agregaron despues de que la lista dejara pasar dos: "no volvés a
    // cero" vivia en el recorrido de bienvenida desde el principio, y
    // "contás series" lo escribi yo mismo agregando un paso nuevo. Las dos
    // son terminaciones que la lista no tenia.
    'volvés', 'contás', 'llegás', 'salís', 'entrenás', 'descansás', 'anotás',
    // "Repetila" vivía en la pantalla de contraseña nueva (15/9).
    'repetila', 'repetilo', 'escribila', 'elegila', 'sacala', 'probala',
  ];

  // Regla 3: modismos rioplatenses. Se entienden en tres paises.
  // "de una" NO está en la lista, y se sacó a propósito: pega en "levantar de
  // una vez", que es español correcto y aparece tres veces en el diccionario de
  // fuerza. Una regla que salta sobre texto bien escrito se termina apagando, y
  // ahí deja de proteger de nada. Más vale una lista incompleta que una que se
  // ignora.
  const MODISMOS = ['acá', 'al toque', 'che', 'laburo', 'pileta', 'ojo:', 'ojo,'];

  const fallas = [];
  const revisar = (donde, s) => {
    // Un `\n` escrito en la cadena es una barra y una ENE para esta cuenta: la
    // "n" pegada a "Registrá" le sacaba la frontera de palabra y el voseo
    // pasaba (15/9). Se cambian las secuencias de escape por un espacio.
    const bajo = s.replace(/\\[nrt]/g, ' ').toLowerCase();
    for (const v of VOSEO) {
      if (new RegExp(`(^|[^a-záéíóúñ])${v}([^a-záéíóúñ]|$)`, 'i').test(bajo)) {
        fallas.push(`${donde} -> voseo "${v}"`);
      }
    }
    for (const m of MODISMOS) {
      // Con frontera de palabra, igual que el voseo: buscado por substring,
      // "ojo," pegaba adentro de "[flojo, setFlojo]".
      const esc = m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|[^a-záéíóúñ])${esc}`, 'i').test(bajo)) {
        fallas.push(`${donde} -> modismo "${m}"`);
      }
    }
  };

  // Los comentarios se sacan con `sinComentarios`, el helper compartido que
  // ya se importa arriba: esta seccion tenia su propia copia, que es como
  // empiezan las dos versiones que se van separando.

  let miradas = 0;

  // Todos los .ts y .tsx de `src` y `nucleo`, que es donde puede haber texto.
  const fuentes = [];
  const recorrer = (dir) => {
    for (const e of listar(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const r = join(dir, e.name);
      if (e.isDirectory()) recorrer(r);
      else if (/\.tsx?$/.test(e.name)) fuentes.push(r);
    }
  };
  recorrer(join(RAIZ, 'src'));
  recorrer(join(RAIZ, 'compartido'));
  recorrer(join(RAIZ, 'nucleo'));
  // Y la nativa, que no se miraba (15/9).
  recorrer(join(RAIZ, 'movil', 'src'));

  // a) LAS CADENAS, en todos lados y no solo en el diccionario.
  //
  // Empezo mirando `textos.ts` nada mas, que es donde DEBERIA vivir todo el
  // texto. La diferencia entre donde deberia vivir y donde vive es
  // exactamente lo que se le escapaba: una cadena suelta en el componente de
  // Sexo ("Proba de nuevo") y las citas enteras, traducidas en rioplatense.
  // Un test que cubre el archivo prolijo y no el resto protege del caso facil.
  for (const ruta of fuentes) {
    const crudo = sinComentarios(leer(ruta, 'utf8'));
    const corto = ruta.split(/[\\/]/).pop();
    for (const linea of crudo.split('\n')) {
      for (const m of linea.matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
        const s = m[1] ?? m[2] ?? '';
        // Solo lo que parece prosa: una cadena sin tres letras seguidas es un
        // id, una clase de CSS o una unidad, y ahi no hay idioma que cuidar.
        if (!/[a-zaeiouñ]{3}/i.test(s)) continue;
        miradas++;
        revisar(`${corto}: ${linea.trim().slice(0, 40)}`, s);
      }
    }
  }

  // b) La prosa escrita a mano en los componentes. Se mira el TEXTO JSX —lo
  // que hay entre > y <— y no las cadenas: las cadenas de un .tsx son casi
  // todas clases CSS y claves, y meterlas solo agrega ruido.
  for (const ruta of fuentes.filter((r) => r.endsWith('.tsx'))) {
    const limpio = sinComentarios(leer(ruta, 'utf8'));
    const corto = ruta.split(/[\\/]/).pop();
    for (const m of limpio.matchAll(/>([^<>{}]+)</g)) {
      const texto = m[1].replace(/\s+/g, ' ').trim();
      if (!texto || !/[a-záéíóúñ]{3}/i.test(texto)) continue;
      // `>...<` tambien pega en un generico de TypeScript: `useState<X>(null);
      // const [flojo, setFlojo] = useSta<`. La prosa no lleva estos signos.
      if (/[;={}()]/.test(texto)) continue;
      miradas++;
      revisar(`${corto}: ${texto.slice(0, 40)}`, texto);
    }
  }

  chequear(`los ${miradas} textos estan en espanol neutro`, fallas.slice(0, 12), []);
  if (fallas.length > 12) console.log(`       (y ${fallas.length - 12} mas)`);
}

console.log('\n55. Me equivoque de ejercicio: las series se mudan');
{
  // DOS COSAS DISTINTAS QUE SE PARECEN. "Cambie de ejercicio" cierra el bloque
  // y abre otro; "me equivoque de ejercicio" tiene que llevarse las series ya
  // contadas, porque nunca fueron del ejercicio que decia el selector.
  //
  // La app no puede adivinar cual de las dos fue —el error puede estar en el
  // dedo o en la memoria— asi que pregunta. Lo que se prueba aca es que las
  // dos ramas existan y hagan cosas distintas de verdad: si `mudarEjercicio`
  // cerrara el bloque como la otra, la pregunta seria decorativa.
  let e = bloquesVacios('press_banca', 3);
  e = sumar(e);
  e = sumar(e);
  e = sumar(e);
  chequear('van tres en press de banca', [e.ejercicio, e.hechas, e.cerrados.length], ['press_banca', 3, 0]);

  const cambiado = cambiarEjercicio(e, 'sentadilla');
  chequear('cambiar cierra el bloque viejo', cambiado.cerrados, [{ ejercicio: 'press_banca', series: 3 }]);
  chequear('y arranca el nuevo en cero', [cambiado.ejercicio, cambiado.hechas], ['sentadilla', 0]);

  const mudado = mudarEjercicio(e, 'sentadilla');
  chequear('mudar NO cierra nada', mudado.cerrados, []);
  chequear('y las tres se van con el ejercicio nuevo', [mudado.ejercicio, mudado.hechas], ['sentadilla', 3]);

  // El total de la sesion no lo tocan ninguna de las dos: las series hechas
  // son las mismas, lo unico que cambia es de que fueron.
  chequear('lo guardado despues de mudar', paraGuardar(mudado), [{ ejercicio: 'sentadilla', series: 3 }]);
  chequear(
    'lo guardado despues de cambiar',
    paraGuardar(cambiado),
    [{ ejercicio: 'press_banca', series: 3 }]
  );

  chequear('mudar al mismo ejercicio no hace nada', mudarEjercicio(e, 'press_banca'), e);
  const sinNada = bloquesVacios('press_banca', 3);
  chequear('sin series contadas, mudar es igual a cambiar', mudarEjercicio(sinNada, 'x').hechas, cambiarEjercicio(sinNada, 'x').hechas);
}

console.log('\n56. El arbol del selector llega a los 100');
{
  // EL AGUJERO QUE ESTO TAPA: un grupo muscular nuevo en la base, sin zona en
  // `nucleo/ejercicios.ts`. No falla nada —el catalogo sigue completo y el
  // selector sigue abriendo— pero a esos ejercicios NO SE LLEGA, y eso no se
  // ve mirando ninguna de las dos mitades por separado.
  const grupos = (await db.query('select distinct grupo from ejercicios')).rows.map((f) => f.grupo);
  chequear('todos los grupos tienen zona', gruposSinZona(grupos), []);

  // Y al reves: que ninguna zona ofrezca una puerta a una pieza vacia.
  const alcanzables = new Set();
  for (const z of ORDEN_ZONAS) for (const g of gruposDeZona(z, grupos)) alcanzables.add(g);
  chequear('y todas las zonas llevan a algun grupo', [...alcanzables].sort(), [...grupos].sort());

  // La cuenta de verdad: a cuantos ejercicios se puede tocar bajando el arbol.
  // Los tres del DOTS van sueltos arriba de todo, asi que entran igual.
  const porGrupo = (
    await db.query('select grupo, count(*)::int n from ejercicios where not cuenta_dots group by 1')
  ).rows;
  let llegan = 3;
  for (const z of ORDEN_ZONAS) {
    for (const g of gruposDeZona(z, grupos)) {
      llegan += porGrupo.find((f) => f.grupo === g)?.n ?? 0;
    }
  }
  chequear('se llega a los 100 ejercicios', llegan, 100);

  // QUE ADMITEN PESO (migracion 31). Una marca es peso por repeticiones, asi
  // que la pantalla de marcas filtra por esta columna. Se fija la lista de
  // excepciones y no solo la cantidad: el dia que alguien marque medio
  // catalogo como "sin peso", el numero cambiaria y la lista dice cual.
  const sinPeso = (
    await db.query('select id from ejercicios where not admite_peso order by id')
  ).rows.map((f) => f.id);
  chequear('los que no admiten peso son los isometricos', sinPeso, ['dead_bug', 'plancha', 'plancha_lateral']);
  const dotsConPeso = (
    await db.query('select count(*)::int n from ejercicios where cuenta_dots and admite_peso')
  ).rows[0].n;
  chequear('y los tres del DOTS admiten peso, obviamente', dotsConPeso, 3);
}

console.log('\n57. El detector de estancamiento');
{
  // Fechas fijas: un detector que se prueba con `hoy` de verdad falla solo el
  // dia que cambia el mes.
  const HOY = '2026-09-09';
  const marca = (ejercicio, fecha, peso, reps = 1, es_real = true) =>
    ({ ejercicio, fecha, peso, reps, es_real });

  chequear('el 1RM de una sola repeticion es el peso', unRm(marca('x', HOY, 100)), 100);
  chequear(
    'y con varias lo estima Epley',
    Math.round(unRm({ peso: 100, reps: 6, es_real: false })),
    120
  );

  // ---- la marca que no se mueve ----
  //
  // El mejor es viejo Y despues siguio anotando: eso es estancarse. Sin lo
  // segundo seria "lo dejo de medir", que es otra cosa y otro mensaje.
  const quieta = detectar({
    marcas: [
      marca('press_banca', '2026-05-01', 100),
      marca('press_banca', '2026-07-20', 97.5),
      marca('press_banca', '2026-08-30', 97.5),
    ],
    sesiones: [],
    hoy: HOY,
    umbral: 6,
  });
  chequear('marca quieta: la detecta', quieta?.tipo, 'marca_quieta');
  chequear('y dice de cuando es el mejor', quieta?.semanas, 18);

  // Con umbral de 3 semanas tambien; con uno de 8, tambien (19 > 8). Lo que
  // cambia el umbral es el caso de al lado:
  const reciente = [
    marca('sentadilla', '2026-08-12', 140), // cuatro semanas justas
    marca('sentadilla', '2026-08-27', 138),
    marca('sentadilla', '2026-09-03', 138),
  ];
  chequear(
    'con umbral 3 semanas, tres semanas alcanzan',
    detectar({ marcas: reciente, sesiones: [], hoy: HOY, umbral: 3 })?.tipo,
    'marca_quieta'
  );
  chequear(
    'con umbral 6, todavia no',
    detectar({ marcas: reciente, sesiones: [], hoy: HOY, umbral: 6 }),
    null
  );

  // ---- lo que NO es estancamiento ----
  chequear(
    'con menos de tres marcas no dice nada',
    detectar({
      marcas: [marca('curl_barra', '2026-04-01', 40), marca('curl_barra', '2026-04-08', 40)],
      sesiones: [],
      hoy: HOY,
      umbral: 6,
    }),
    null
  );
  chequear(
    'si el mejor es el ULTIMO, no hay estancamiento',
    detectar({
      marcas: [
        marca('peso_muerto', '2026-05-01', 150),
        marca('peso_muerto', '2026-06-01', 160),
        marca('peso_muerto', '2026-06-20', 170),
      ],
      sesiones: [],
      hoy: HOY,
      umbral: 6,
    })?.tipo,
    'ejercicio_dejado'
  );

  // ---- el ejercicio dejado ----
  const dejado = detectar({
    marcas: [
      marca('dominadas', '2026-03-01', 10),
      marca('dominadas', '2026-03-10', 12),
      marca('dominadas', '2026-03-20', 14),
    ],
    sesiones: [],
    hoy: HOY,
    umbral: 6,
  });
  chequear('ejercicio dejado: lo detecta', dejado?.tipo, 'ejercicio_dejado');

  // ---- la sesion que se achica ----
  const dia = (n) => `2026-0${n < 10 ? '8' : '8'}-${String(n).padStart(2, '0')}`;
  const sesiones = [];
  // Las 4 anteriores: ocho sesiones de 60 minutos.
  for (let d = 16; d <= 23; d++) sesiones.push({ fecha: `2026-07-${d}`, minutos: 60 });
  // Las ultimas 4: ocho de 25.
  for (let d = 20; d <= 27; d++) sesiones.push({ fecha: `2026-08-${d}`, minutos: 25 });
  const corta = detectar({ marcas: [], sesiones, hoy: HOY, umbral: 6 });
  chequear('la sesion que se achica: la detecta', corta?.tipo, 'sesion_mas_corta');
  chequear('con las dos medianas', [corta?.ahora.minutos, corta?.antes.minutos], [25, 60]);

  // Y NO la detecta con pocas sesiones: dos datos no son una mediana.
  chequear(
    'con menos de cuatro sesiones por ventana, nada',
    detectar({
      marcas: [],
      sesiones: [
        { fecha: '2026-07-20', minutos: 60 },
        { fecha: '2026-08-25', minutos: 20 },
      ],
      hoy: HOY,
      umbral: 6,
    }),
    null
  );

  // ---- una sola señal por vez, y la sesion primero ----
  const dos = detectar({
    marcas: [
      marca('press_banca', '2026-05-01', 100),
      marca('press_banca', '2026-07-20', 97.5),
      marca('press_banca', '2026-08-30', 97.5),
    ],
    sesiones,
    hoy: HOY,
    umbral: 6,
  });
  chequear('con dos cosas a la vez, se muestra UNA', dos?.tipo, 'sesion_mas_corta');

  // ---- descartar calla esa señal, y solo esa ----
  const id = idDeSenal(dos);
  const calladas = { [id]: '2026-09-01' };
  chequear(
    'descartada, no vuelve',
    detectar({ marcas: [], sesiones, hoy: HOY, umbral: 6, silenciadas: calladas }),
    null
  );
  chequear(
    'pero vuelve pasadas las seis semanas',
    detectar({
      marcas: [],
      sesiones,
      hoy: HOY,
      umbral: 6,
      silenciadas: { [id]: '2026-07-01' },
    })?.tipo,
    'sesion_mas_corta'
  );
  chequear(
    'y callar una NO calla la otra',
    detectar({
      marcas: [
        marca('press_banca', '2026-05-01', 100),
        marca('press_banca', '2026-07-20', 97.5),
        marca('press_banca', '2026-08-30', 97.5),
      ],
      sesiones,
      hoy: HOY,
      umbral: 6,
      silenciadas: calladas,
    })?.tipo,
    'marca_quieta'
  );

  // ---- el umbral que llega de la base ----
  chequear('un umbral raro cae en el de siempre', umbralValido(5), 6);
  chequear('y uno valido se respeta', umbralValido(3), 3);
  chequear('sin dato tambien', umbralValido(undefined), 6);
}

console.log('\n58. Las vidas');
{
  await cuotaDeVidas(3);

  // ---- una falta suelta ya no corta ----
  {
    const u = await nuevoUsuario();
    await rachaDe(u, 14, 2); // termina anteayer: ayer quedo vacio
    const r = await perder(u);
    chequear('un dia suelto no corta la racha', r.perdida, false);
    chequear('y se gasto una vida', (r.vidas_usadas ?? []).length, 1);
    chequear('quedan dos', r.vidas_quedan, 2);
    chequear('la racha queda igual, no sube', (await perfil(u)).racha_actual, 14);
  }

  // ---- el dia cubierto NO cuenta como entrenado ----
  {
    const u = await nuevoUsuario();
    await rachaDe(u, 5, 2);
    await perder(u);
    // 5 dias entrenados + 1 cubierto: la racha sigue siendo 5.
    chequear('cubrir no infla la racha', (await perfil(u)).racha_actual, 5);
    await db.query('insert into logs (user_id, fecha) values ($1, mi_hoy())', [u]);
    const p2 = await db.query('select racha_actual from profiles where id = $1', [u]);
    chequear('y al entrenar hoy suma uno', p2.rows[0].racha_actual, 6);
  }

  // ---- cuatro faltas contra tres vidas ----
  {
    const u = await nuevoUsuario();
    await rachaDe(u, 20, 5); // faltaron los ultimos cuatro dias
    const r = await perder(u);
    chequear('cuatro faltas cortan igual', r.perdida, true);
    chequear('y se gastaron las tres', (r.vidas_usadas ?? []).length, 3);
    chequear('no quedan vidas', r.vidas_quedan, 0);
    chequear('la racha bajo 10', (await perfil(u)).racha_actual, 10);
  }

  // ---- una vida gastada NO se devuelve ----
  {
    const u = await nuevoUsuario();
    await rachaDe(u, 20, 5);
    await perder(u);
    const antes = (
      await db.query('select count(*)::int n from vidas_usadas where user_id = $1', [u])
    ).rows[0].n;
    await perder(u); // segunda llamada, ya perdida
    const despues = (
      await db.query('select count(*)::int n from vidas_usadas where user_id = $1', [u])
    ).rows[0].n;
    chequear('las vidas gastadas quedan gastadas', [antes, despues], [3, 3]);
  }

  // ---- vuelven a los 30 dias, y no el 1 del mes ----
  //
  // LA REGLA VIEJA ERA POR MES y el humano le encontro el agujero solo: si
  // faltabas el 30 y el 31, el 1 tenias los tres de nuevo. El mes es una
  // frontera arbitraria y premiaba faltar justo antes de cruzarla. Ahora cada
  // impulso vuelve 30 dias despues del dia que cubrio: no hay ninguna fecha en
  // que convenga faltar.
  {
    await cuotaDeVidas(3);
    const u = await nuevoUsuario();
    const gastadoHace = async (dias) => {
      await db.query(
        `insert into vidas_usadas (user_id, fecha) values ($1, mi_hoy() - $2::int)`,
        [u, dias]
      );
      return (await db.query('select impulsos_disponibles($1, mi_hoy()) as v', [u])).rows[0].v;
    };
    chequear('uno de hace 31 dias ya volvio', await gastadoHace(31), 3);
    chequear('uno de hace 29 todavia no', await gastadoHace(29), 2);
    chequear('y uno de ayer tampoco', await gastadoHace(1), 1);
    // El de hace 29 vuelve pasado manana. Se mira el dia, no el mes.
    const en2 = (
      await db.query('select impulsos_disponibles($1, mi_hoy() + 2) as v', [u])
    ).rows[0].v;
    chequear('pasado manana vuelve el de 29', en2, 2);
  }

  // ---- se ganan: dos, y el tercero a los 20 dias ----
  //
  // El que empieza no puede arrancar en cero —el primer tropiezo lo sacaria de
  // la app— y tampoco con todos, o no son nada que se gane.
  {
    await db.query(
      `create or replace function public.impulsos_ganados(p_user uuid)
       returns int language sql stable security definer set search_path = public as $fn$
         select least(impulsos_tope(),
           2 + case when coalesce((select racha_actual from profiles where id = p_user), 0) >= 20
                    then 1 else 0 end)
       $fn$`
    );
    const u = await nuevoUsuario();
    const conRacha = async (r) => {
      await db.query('update profiles set racha_actual = $2 where id = $1', [u, r]);
      return (await db.query('select impulsos_ganados($1) as v', [u])).rows[0].v;
    };
    chequear('el que empieza tiene dos', await conRacha(0), 2);
    chequear('a los 19 sigue con dos', await conRacha(19), 2);
    chequear('a los 20 gana el tercero', await conRacha(20), 3);
    chequear('y no hay un cuarto', await conRacha(300), 3);
    // Perder la racha se lleva el tercero: era de la racha.
    chequear('perder la racha lo devuelve a dos', await conRacha(9), 2);
    await cuotaDeVidas(3);
  }

  // ---- un dia de descanso no gasta vida ----
  {
    const u = await nuevoUsuario();
    const dow = (await db.query('select extract(dow from mi_hoy() - 1)::int as d')).rows[0].d;
    await db.query(
      'insert into descansos (user_id, desde, dias) values ($1, mi_hoy() - 60, array[$2::int])',
      [u, dow]
    );
    await rachaDe(u, 10, 2);
    const r = await perder(u);
    chequear('ayer era descanso: no se gasta vida', (r.vidas_usadas ?? []).length, 0);
    chequear('y no hay perdida', r.perdida, false);
  }

  // ---- con la racha en cero no hay nada que salvar ----
  {
    const u = await nuevoUsuario();
    const r = await perder(u);
    chequear('sin racha no se gasta ninguna', r.vidas_usadas, undefined);
  }

  // ---- la mejor racha historica tambien sabe de vidas ----
  {
    const u = await nuevoUsuario();
    // Seis dias que terminan hace siete, UN dia cubierto en el medio, y seis
    // mas hasta hoy. El hueco tiene que ser de un solo dia: con dos, el
    // segundo corta y el test estaria probando otra cosa.
    await rachaDe(u, 6, 7); // hoy-12 .. hoy-7
    await db.query(
      `insert into vidas_usadas (user_id, fecha) values ($1, mi_hoy() - 6)`,
      [u]
    );
    await rachaDe(u, 6, 0); // hoy-5 .. hoy
    const m = (await db.query('select mejor_racha_real($1) as m', [u])).rows[0].m;
    chequear('el hueco cubierto no parte el record', m, 12);
  }

  // ---- devolver una vida: "guardarla para despues" ----
  //
  // EL PROBLEMA QUE RESUELVE: cuando abris la app el dia ya paso, asi que
  // preguntar antes deja la racha en limbo hasta que contestes. La vida se
  // aplica sola y el aviso ofrece devolverla; elegis igual, sin limbo.
  {
    const u = await nuevoUsuario();
    await rachaDe(u, 14, 2); // termina anteayer: ayer quedo vacio
    const r = await perder(u);
    chequear('primero la cubre sola', r.perdida, false);
    const dia = r.vidas_usadas[0];
    chequear('la racha sobrevivio', (await perfil(u)).racha_actual, 14);

    await comoUsuario(u);
    const d = (await db.query('select devolver_vidas($1::date[]) as v', [[dia]])).rows[0].v;
    chequear('devolvio una', d.devueltas, 1);
    chequear('y al devolverla, la racha se corta', d.perdida.perdida, true);
    chequear('con el -10 de siempre', (await perfil(u)).racha_actual, 4);
    // Y ES EL NUMERO QUE LA VENTANA PROMETIO. El precio se dice antes de
    // cobrarlo, o sea que la cuenta esta escrita dos veces: en SQL adentro de
    // `verificar_perdida` y en TypeScript en `nucleo/vidas.ts`. Dos copias de
    // una regla se separan solas; esto las ata.
    chequear(
      'y es exactamente lo que la ventana prometio',
      rachaSiSeDevuelve(14),
      (await perfil(u)).racha_actual
    );

    // La vida vuelve al pozo: eso es "guardarla".
    const vidas = (await db.query('select mis_vidas() as v')).rows[0].v;
    chequear('y la vida volvio', vidas.quedan, 3);

    // Y el dia devuelto NO se puede volver a cubrir: sin esto, la proxima
    // llamada gastaria otra vida en el mismo dia y el boton no haria nada.
    const otra = await perder(u);
    chequear('no se vuelve a cubrir', otra.vidas_usadas, undefined);
    chequear('ni se gasta otra vida', (await db.query('select mis_vidas() as v')).rows[0].v.quedan, 3);
  }

  // ---- lo que `mis_vidas` le da al aviso ----
  //
  // EL BUG QUE ESTO ARREGLA: el aviso salia de `verificar_perdida`, que
  // reporta los dias cubiertos SOLO en la llamada que los cubrio. Si esa
  // llamada pasaba con una sesion corriendo, o la pantalla se volvia a montar,
  // o cualquier otra llamada llegaba primero, no te enterabas nunca. Ahora
  // sale del ESTADO: se puede preguntar mil veces y contesta lo mismo.
  {
    const u = await nuevoUsuario();
    await rachaDe(u, 14, 3); // faltaron dos dias
    await perder(u);
    await comoUsuario(u);
    const v1 = (await db.query('select mis_vidas() as v')).rows[0].v;
    chequear('dice las dos que uso', v1.ultimas.length, 2);
    // Y otra vez, sin que pase nada en el medio.
    const v2 = (await db.query('select mis_vidas() as v')).rows[0].v;
    chequear('y lo sigue diciendo', v2.ultimas, v1.ultimas);
    chequear('con la ultima primero', v2.ultima, v1.ultimas[0]);

    // Devolverlas las saca del aviso y del pozo.
    await db.query('select devolver_vidas($1::date[])', [v1.ultimas]);
    const v3 = (await db.query('select mis_vidas() as v')).rows[0].v;
    chequear('devueltas, ya no se anuncian', v3.ultimas, []);
    chequear('y no cuentan como gastadas', v3.quedan, 3);
  }

  // ---- una vida vieja no se devuelve ----
  //
  // Sin el limite de siete dias esto seria una maquina de reescribir historia:
  // devolver una vida de hace tres meses recalcularia una racha de entonces.
  {
    const u = await nuevoUsuario();
    await db.query(
      `insert into vidas_usadas (user_id, fecha) values ($1, mi_hoy() - 30)`,
      [u]
    );
    await comoUsuario(u);
    const d = (await db.query('select devolver_vidas($1::date[]) as v', [['2026-01-01']])).rows[0].v;
    chequear('una fecha vieja no devuelve nada', d.devueltas, 0);
  }

  await cuotaDeVidas(0);
}

console.log('\n59. El peso: media movil POR FECHA');
{
  // EL BUG QUE ESTO FIJA. La version anterior promediaba los ultimos SIETE
  // REGISTROS. Para quien se pesa todos los dias eso son siete dias; para
  // quien se pesa tres veces por semana son dos semanas y media, y el rotulo
  // decia "tendencia 7 dias". Un numero que dice ser una cosa y es otra.
  //
  // Se prueba con alguien que se pesa cada cinco dias: por registros, el
  // promedio se comeria un mes entero.
  const cada5 = [
    { fecha: '2026-06-01', valor: 80 },
    { fecha: '2026-06-06', valor: 82 },
    { fecha: '2026-06-11', valor: 84 },
    { fecha: '2026-06-16', valor: 86 },
  ];
  const s = suavizarPorFecha(cada5, 7);
  // Cada punto solo puede promediarse con lo que cae dentro de sus 7 dias:
  // el del 06 con el del 01 (cinco dias antes), el del 11 con el del 06.
  chequear('el primero es el mismo', s[0].suave, 80);
  chequear('el segundo promedia dos', s[1].suave, 81);
  chequear('el tercero NO arrastra el primero', s[2].suave, 83);
  chequear('y el crudo viaja al lado', s.map((x) => x.valor), [80, 82, 84, 86]);

  // Con datos diarios el promedio de siete dias sí toma siete.
  const diarios = [];
  for (let d = 1; d <= 10; d++) {
    diarios.push({ fecha: `2026-07-${String(d).padStart(2, '0')}`, valor: 100 + d });
  }
  const sd = suavizarPorFecha(diarios, 7);
  // El dia 10 promedia del 4 al 10: 104..110 -> 107.
  chequear('con datos diarios toma siete', sd[9].suave, 107);

  // Un dia repetido no rompe nada y el hueco tampoco.
  chequear('sin datos no explota', suavizarPorFecha([], 7), []);

  // ---- la ventana ----
  chequear('todo devuelve todo', ultimosDias(diarios, null).length, 10);
  chequear('los ultimos 3 dias', ultimosDias(diarios, 3).map((x) => x.fecha.slice(-2)), ['08', '09', '10']);
  chequear('mas dias que datos no recorta', ultimosDias(diarios, 90).length, 10);
}

console.log('\n60. Los dos lados de plataforma/');
{
  // POR QUE ESTE TEST NO IMPORTA NADA. La implementacion nativa depende de
  // `expo-location`, `expo-audio` y compania, que no se pueden cargar con node
  // pelado: son modulos nativos. Asi que se leen los archivos, que es
  // exactamente lo que hace la seccion 51 con el nucleo.
  //
  // QUE AGUJERO TAPA. El contrato vive en `nucleo/plataforma.ts` y TypeScript
  // ya obliga a que cada `Plataforma` tenga sus nueve llaves... en el proyecto
  // donde se compila. Son DOS proyectos con dos `tsc` distintos, y el de la
  // web no mira `movil/`: agregar un puerto al contrato y olvidarse del lado
  // nativo compila perfecto de este lado y explota en el telefono.
  const { readFileSync: leerArch } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

  const contrato = leerArch(join(RAIZ, 'nucleo', 'plataforma.ts'), 'utf8');
  // Las llaves del tipo `Plataforma`, que es lo ultimo del archivo.
  const bloque = contrato.slice(contrato.indexOf('export type Plataforma = {'));
  const puertos = [...sinComentarios(bloque).matchAll(/^  (\w+):/gm)].map((m) => m[1]).sort();
  chequear('el contrato tiene nueve puertos', puertos.length, 9);

  const llaves = (ruta) => {
    const codigo = sinComentarios(leerArch(ruta, 'utf8'));
    const desde = codigo.indexOf(': Plataforma = {');
    return [...codigo.slice(desde).matchAll(/^  (\w+):/gm)].map((m) => m[1]).sort();
  };

  chequear(
    'la web implementa los nueve',
    llaves(join(RAIZ, 'src', 'plataforma', 'index.ts')),
    puertos
  );
  chequear(
    'y la nativa tambien',
    llaves(join(RAIZ, 'movil', 'src', 'plataforma', 'index.ts')),
    puertos
  );

  // Y QUE LA NATIVA NO IMPORTE DEL ARBOL DE LA WEB. Es la misma apuesta que la
  // seccion 51 pero del otro lado: si `movil/` empieza a tirar de `src/`, se
  // lleva puesto Next, el DOM y medio ecosistema del navegador — y se descubre
  // cuando el bundler falla, no ahora.
  const { readdirSync: leerDir } = await import('node:fs');
  const NATIVO = join(RAIZ, 'movil', 'src', 'plataforma');
  const colados = [];
  for (const n of leerDir(NATIVO)) {
    if (!/\.tsx?$/.test(n)) continue;
    const codigo = sinComentarios(leerArch(join(NATIVO, n), 'utf8'));
    for (const m of codigo.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const destino = m[1];
      const propio =
        destino.startsWith('./') ||
        destino.startsWith('../../assets') ||
        destino.startsWith('@nucleo/') ||
        !destino.startsWith('.');
      if (!propio) colados.push(`${n} importa ${destino}`);
      if (destino.includes('src/plataforma/web') || destino.startsWith('@/')) {
        colados.push(`${n} importa del arbol de la web: ${destino}`);
      }
    }
  }
  chequear('la nativa no importa del arbol de la web', colados, []);
}

console.log('\n61. El nombre de usuario: una regla, dos lugares');
{
  // ESTABA ESCRITA TRES VECES: onboarding, Ajustes y el `check` de la base. Y
  // la app nativa iba a ser la cuarta. Ahora hay dos —el nucleo y la base— y
  // eso es lo minimo posible: la base no puede confiar en el cliente.
  //
  // Lo que este test cuida es que las dos DIGAN LO MISMO. Si alguien afloja la
  // del cliente, la pantalla deja pasar un nombre que la base rechaza y el
  // usuario ve un error tecnico; si afloja la de la base, no lo nota nadie.
  const fila = (
    await db.query(`
      select pg_get_constraintdef(oid) def
        from pg_constraint
       where conrelid = 'profiles'::regclass and pg_get_constraintdef(oid) like '%username%'
    `)
  ).rows[0];
  chequear('la base tiene el mismo patron', fila.def.includes(PATRON_USUARIO), true);

  // Y que la funcion haga lo que dice.
  chequear('tres letras alcanzan', nombreValido('ana'), true);
  chequear('dos no', nombreValido('an'), false);
  chequear('veinte alcanzan', nombreValido('a'.repeat(20)), true);
  chequear('veintiuno no', nombreValido('a'.repeat(21)), false);
  chequear('guion bajo si', nombreValido('agus_conde'), true);
  chequear('espacios no', nombreValido('agus conde'), false);
  chequear('acentos no', nombreValido('agustin_ñ'), false);
  chequear('vacio no', nombreValido(''), false);

  // Y que la base rechace lo mismo, de verdad y no de palabra.
  const u = await nuevoUsuario();
  let rechazo = null;
  try {
    await db.query('update profiles set username = $1 where id = $2', ['ab', u]);
  } catch (e) {
    rechazo = e.code;
  }
  chequear('la base rechaza el de dos letras', rechazo, '23514');
}

console.log('\n62. Los andamios tienen fecha de vencimiento');
{
  // LOS ANDAMIOS SE QUEDAN. Un comentario que dice "esto es temporal" no saca
  // nada: dentro de dos meses sigue ahí y ya nadie se acuerda de que era
  // provisorio. Lo unico que los saca es algo que falle mientras existan.
  //
  // Cada entrada dice tres cosas: DONDE esta, QUE lo mata, y CUANDO se vence
  // igual. Falla por cualquiera de las tres:
  //
  //   1. La condicion se cumplio  -> el andamio ya no tiene excusa.
  //   2. Se paso la fecha         -> hay que decidir, aunque sea renovarla.
  //   3. La marca no esta         -> alguien borro el codigo y dejo la entrada,
  //                                  o al reves. El registro tiene que decir
  //                                  la verdad sobre lo que hay.
  //
  // Renovar una fecha es una decision legitima. Lo que no se puede es que
  // pase sola.
  const { readFileSync: leerArch, existsSync: hay } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const leer = (r) => (hay(join(RAIZ, r)) ? leerArch(join(RAIZ, r), 'utf8') : '');

  const ANDAMIOS = [
    {
      id: 'andamio-rango-en-texto',
      donde: 'movil/src/Inicio.tsx',
      que: 'Inicio nativo NOMBRA el rango, y en web no se nombra nunca (§7)',
      // El motor no se puede portar sin `expo-gl`: es la firma mas chica y mas
      // dificil de falsear de "el motor llego a nativo".
      muereCuando: () => leer('movil/package.json').includes('expo-gl'),
      porQue: 'el motor esta en nativo: el objeto ya dice el rango y el texto sobra',
      vence: '2026-12-10',
    },
  ];

  const problemas = [];
  const hoyDeVerdad = new Date().toISOString().slice(0, 10);

  for (const a of ANDAMIOS) {
    const codigo = leer(a.donde);
    if (!codigo.includes(a.id)) {
      problemas.push(
        `${a.id}: no esta en ${a.donde}. Si ya se saco, sacar tambien esta entrada`
      );
      continue;
    }
    if (a.muereCuando()) {
      problemas.push(`${a.id}: SE MURIO — ${a.porQue}. Sacar el andamio de ${a.donde}`);
    }
    if (hoyDeVerdad > a.vence) {
      problemas.push(
        `${a.id}: vencio el ${a.vence}. Sacarlo, o renovar la fecha a proposito`
      );
    }
  }

  chequear('ningun andamio vencido ni sin excusa', problemas, []);
  // Y que el registro no quede vacio por accidente: una lista vacia pasa el
  // test de arriba sin decir nada.
  chequear('el registro tiene entradas', ANDAMIOS.length > 0, true);
}

console.log('\n63. El enlace del correo que vuelve a la app');
{
  // EL ERROR QUE ESTO EVITA NO HACE RUIDO. Si el parseo falla, la app
  // simplemente NO entra: el que confirmo la cuenta se queda mirando el login
  // sin entender por que, y del lado del codigo no hay ninguna excepcion que
  // mirar. Por eso se prueba con las URLs raras y no con un telefono.
  const ok = { access_token: 'aaa', refresh_token: 'bbb' };

  // El caso real: Supabase manda los tokens en el FRAGMENTO.
  chequear(
    'los saca del fragmento',
    tokensDeUrl('ascent://confirmar#access_token=aaa&refresh_token=bbb&type=signup'),
    ok
  );
  // Y en algunos flujos, en la query.
  chequear(
    'y de la query',
    tokensDeUrl('ascent://confirmar?access_token=aaa&refresh_token=bbb'),
    ok
  );
  // El esquema con host, que es como lo arma `Linking.createURL` en un
  // development build.
  chequear(
    'con host tambien',
    tokensDeUrl('ascent://ascent/confirmar#access_token=aaa&refresh_token=bbb'),
    ok
  );
  // En Expo Go el esquema es `exp://` con la IP adentro.
  chequear(
    'y en Expo Go, con exp:// y puerto',
    tokensDeUrl('exp://192.168.1.228:8081/--/confirmar#access_token=aaa&refresh_token=bbb'),
    ok
  );

  // Lo que NO tiene que entrar.
  chequear('sin tokens, nada', tokensDeUrl('ascent://confirmar'), null);
  chequear('con uno solo, nada', tokensDeUrl('ascent://c#access_token=aaa'), null);
  chequear('vacio', tokensDeUrl(''), null);
  chequear('null', tokensDeUrl(null), null);
  chequear('basura que no es URL', tokensDeUrl('no soy una url'), null);
  // Un error de auth vuelve por el mismo camino: no hay tokens y no se entra.
  chequear(
    'un enlace vencido no abre sesion',
    tokensDeUrl('ascent://confirmar#error=access_denied&error_code=otp_expired'),
    null
  );
}

console.log('\n64. El aviso de la vida sale del ESTADO, no del evento');
{
  // EL BUG QUE ESTO ARREGLA, y es el unico de esta tanda que reporto el
  // humano: falto un dia, la vida lo cubrio, y la app NO LE AVISO NADA.
  //
  // La causa no estaba en el aviso sino en de donde salia. Salia de
  // `verificar_perdida`, que reporta los dias que cubrio SOLO en la llamada
  // que los cubrio. El comentario del componente decia que eso era una
  // ventaja: "no hace falta guardar si ya se mostro, porque el hecho no se
  // repite". El hecho no se repite, pero el REPORTE es de una sola llamada, y
  // hay por lo menos tres formas de perderselo: que esa llamada caiga con una
  // sesion corriendo (habia un `!entrenando` en el render), que la pantalla se
  // vuelva a montar, o que otra llamada llegue primero.
  //
  // LA PROPIEDAD QUE SE PRUEBA ACA es la que faltaba: preguntar no consume.
  // Con la misma entrada, la respuesta es siempre la misma.
  const dias = ['2026-09-08', '2026-09-07'];

  // Sin marca —cuenta nueva, primer aviso— se anuncia todo, y ordenado del
  // mas viejo al mas nuevo: la base las manda al reves porque pide las
  // ultimas cinco.
  chequear('sin marca, se anuncia todo', impulsosSinVer(dias, null), ['2026-09-07', '2026-09-08']);

  // Y mil veces seguidas da lo mismo. Esto es literalmente lo que el aviso
  // viejo no podia hacer.
  chequear('preguntar no consume', impulsosSinVer(dias, null), impulsosSinVer(dias, null));

  // Con marca: solo lo posterior.
  chequear('con marca vieja, lo nuevo', impulsosSinVer(dias, '2026-09-07'), ['2026-09-08']);
  chequear('con marca al dia, nada', impulsosSinVer(dias, '2026-09-08'), []);
  chequear('con marca mas nueva, nada', impulsosSinVer(dias, '2026-10-01'), []);
  chequear('sin dias cubiertos, nada', impulsosSinVer([], '2026-09-08'), []);

  // La marca que queda despues de mostrar: el maximo de TODO lo que vino y no
  // solo de lo que se anuncio. Si la base manda un dia mas viejo que la marca,
  // ya se anuncio alguna vez y no puede hacerla retroceder.
  chequear('la marca es el maximo', hastaDondeVisto(dias, null), '2026-09-08');
  chequear('y no retrocede', hastaDondeVisto(['2026-08-01'], '2026-09-08'), '2026-09-08');
  chequear('sin nada, queda como estaba', hastaDondeVisto([], '2026-09-08'), '2026-09-08');
  chequear('sin nada y sin marca, nada', hastaDondeVisto([], null), null);

  // EL CICLO COMPLETO, que es el test de regresion de verdad: se anuncia, se
  // marca al cerrar, y no vuelve.
  {
    const marca1 = hastaDondeVisto(dias, null);
    chequear('anunciado y marcado, no vuelve', impulsosSinVer(dias, marca1), []);
    // Y una falta nueva al dia siguiente si aparece.
    const despues = ['2026-09-10', ...dias];
    chequear('pero una falta nueva si', impulsosSinVer(despues, marca1), ['2026-09-10']);
  }

  // El precio de guardarla, que la ventana dice ANTES de cobrarlo.
  chequear('el precio son diez dias', rachaSiSeDevuelve(14), 4);
  chequear('y nunca baja de cero', rachaSiSeDevuelve(3), 0);
}

console.log('\n65. El gesto de "te salvaste": la curva');
{
  // MISMO CUIDADO QUE CON EL PULSO, y por el mismo error ya cometido: el
  // timestamp de requestAnimationFrame llega con el tiempo del COMIENZO del
  // cuadro, que puede ser ANTERIOR al performance.now() de un instante antes
  // —medido: -3 ms—. Si la curva no acota eso, el primer cuadro dibuja el
  // objeto desarmado al reves y con brillo negativo.
  chequear('un tiempo negativo es reposo', desarmeEn(-3), 0);
  chequear('y no apaga nada', brilloEn(-3), 1);
  chequear('pero NO se da por terminado en el primer cuadro', sigueSalvando(-3), true);

  chequear('empieza entero', desarmeEn(0), 0);
  chequear('a mitad del desarme ya se solto algo', desarmeEn(DESARME_MS / 2) > 0.5, true);
  chequear('al final del desarme esta suelto', Math.round(desarmeEn(DESARME_MS - 1) * 10) / 10, 1);
  chequear('y se queda suelto un rato', desarmeEn(DESARME_MS + SUELTO_MS - 1), 1);
  chequear('al terminar vuelve a estar entero', desarmeEn(SALVADA_MS), 0);
  chequear('y despues tambien', desarmeEn(SALVADA_MS + 500), 0);
  chequear('ahi si se da por terminado', sigueSalvando(SALVADA_MS), false);

  // El brillo: baja mientras esta suelto —es la racha yendose— y pasa de 1 en
  // el fulgor de cerrarse. Las dos cosas tienen que pasar, o el gesto no
  // cuenta nada.
  chequear('suelto, la luz baja', brilloEn(DESARME_MS + 100) < 0.5, true);
  let pico = 0;
  let minimo = 9;
  let saltoMaximo = 0;
  let anterior = brilloEn(0);
  let negativo = false;
  for (let t = 0; t <= SALVADA_MS + 20; t++) {
    const b = brilloEn(t);
    if (b > pico) pico = b;
    if (b < minimo) minimo = b;
    if (b < 0) negativo = true;
    saltoMaximo = Math.max(saltoMaximo, Math.abs(b - anterior));
    anterior = b;
  }
  chequear('al cerrarse da un fulgor', pico > 1.2, true);
  chequear('y nunca se apaga del todo', minimo > 0.2, true);
  chequear('el brillo nunca es negativo', negativo, false);
  // SIN ESCALONES. Un salto grande entre dos milisegundos seguidos es un
  // parpadeo en pantalla, y es justo lo que pasa cuando dos tramos de una
  // curva por partes no se tocan en el borde. Se mide en vez de mirarse.
  chequear('no hay saltos entre tramos', saltoMaximo < 0.02, true);
  chequear('y termina exactamente en reposo', brilloEn(SALVADA_MS), 1);

  // ---- que el objeto se DESHAGA, y no que se infle ----
  //
  // ESTO NO SE PUEDE MIRAR, Y POR ESO SE CUENTA. El navegador sin cabeza corre
  // requestAnimationFrame a UN cuadro por segundo —medido acá mismo: 3 cuadros
  // en 3641 ms— asi que dos capturas separadas por un segundo devuelven la
  // misma imagen y no prueban nada. La primera version de esto mandaba cada
  // particula en una direccion al azar, se veia como la misma nube un poco mas
  // grande, y las capturas decian que estaba bien.
  //
  // Lo que hace que se lea como "se esta rompiendo" es que el CENTRO SE VACIE.
  // Eso es un numero: el radio de la particula mas cercana al centro.
  {
    // Una esfera de 300 puntos, que es la forma de la luna y del planeta.
    const base = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const u = (i / 300) * 2 - 1;
      const th = i * 2.39996; // angulo aureo: reparte parejo y sin azar
      const s = Math.sqrt(1 - u * u);
      base[i * 3] = Math.cos(th) * s * 0.4;
      base[i * 3 + 1] = u * 0.4;
      base[i * 3 + 2] = Math.sin(th) * s * 0.4;
    }
    // Azar fijo, para que el test no dependa de la suerte del dia.
    let semilla = 1;
    const azar = () => {
      semilla = (semilla * 16807) % 2147483647;
      return semilla / 2147483647;
    };
    const fuera = dispersionDesde(base, azar);
    const donde = new Float32Array(base.length);
    const radios = (a) => {
      const r = [];
      for (let i = 0; i < a.length; i += 3) r.push(Math.hypot(a[i], a[i + 1], a[i + 2]));
      return r;
    };

    // En reposo, EXACTAMENTE la forma original. No "casi": el objeto tiene que
    // quedar como estaba, sin la pizca de error de multiplicar por cero.
    posicionesEn(base, fuera, 0, donde);
    chequear('en reposo es la forma original', [...donde], [...base]);
    posicionesEn(base, fuera, SALVADA_MS, donde);
    chequear('y al terminar tambien', [...donde], [...base]);

    // Suelto del todo: todas se van hacia afuera y se separan entre ellas.
    const antes = radios(base);
    posicionesEn(base, fuera, DESARME_MS + 10, donde);
    const despues = radios(donde);
    const minAntes = Math.min(...antes);
    const minDespues = Math.min(...despues);
    chequear('ninguna se queda donde estaba', minDespues > minAntes * 1.15, true);
    const medio = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    chequear('y la nube crece', medio(despues) > medio(antes) * 1.8, true);
    // Y NO ES UN GLOBO: si todas se fueran lo mismo seria la misma cascara mas
    // grande, que se lee como el mismo objeto y no como uno que se rompe. La
    // cascara tiene que quedar DESPAREJA.
    const max = Math.max(...despues);
    chequear('con unas mas lejos que otras', max > minDespues * 1.8, true);

    // Cada particula sale POR SU PROPIO RADIO: la direccion se conserva.
    let torcidas = 0;
    for (let i = 0; i < base.length; i += 3) {
      const ra = Math.hypot(base[i], base[i + 1], base[i + 2]);
      const rd = Math.hypot(donde[i], donde[i + 1], donde[i + 2]);
      const cos =
        (base[i] * donde[i] + base[i + 1] * donde[i + 1] + base[i + 2] * donde[i + 2]) / (ra * rd);
      if (cos < 0.9) torcidas++;
    }
    chequear('ninguna se va para el otro lado', torcidas, 0);

    // Y EN LAS FORMAS QUE SI TIENEN CENTRO —el polvo del rango 1, el nucleo
    // del sistema— el centro se vacia de verdad. Es el caso donde mas se nota
    // que se rompe, y el que la version de direcciones al azar no lograba.
    const nube = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      const r = Math.sqrt((i + 0.5) / 300) * 0.8;
      const th = i * 2.39996;
      nube[i * 3] = Math.cos(th) * r;
      nube[i * 3 + 1] = Math.sin(th) * r;
      nube[i * 3 + 2] = 0;
    }
    semilla = 1;
    const fuera2 = dispersionDesde(nube, azar);
    const donde2 = new Float32Array(nube.length);
    posicionesEn(nube, fuera2, DESARME_MS + 10, donde2);
    chequear('la mas cercana al centro, antes', Math.min(...radios(nube)) < 0.04, true);
    chequear('y el centro queda vacio', Math.min(...radios(donde2)) > 0.2, true);
  }
}

console.log('\n66. El contador de series no se resetea solo');
{
  // LOS DOS BUGS QUE ESTO ARREGLA, reportados juntos porque se veian iguales.
  //
  // "SI MANDO LA APP AL FONDO, SE RESETEAN". `mi_sesion` volvia y se
  // REESCRIBIA la cache entera con lo que dice el servidor. `bloques` no esta
  // en esa lista —es del telefono, la meta es intencion y no un hecho— asi que
  // cada confirmacion lo borraba de la cache sin tocar la pantalla. No se veia
  // nada hasta el proximo montaje, que leia la cache y encontraba el bloque en
  // cero. Y pasaba DOS veces por carga: la pantalla y el vigilante del
  // gimnasio son dos instancias del mismo hook.
  //
  // "A VECES SE RESETEAN SOLAS". El error del RPC se tiraba a la basura, y sin
  // el, un fallo de red es identico a "no hay sesion": `data` en null. En un
  // subsuelo con mala senal eso borraba la sesion entera.
  const previo = { inicio: 'a', desfasaje: 0, id: 's1', series: 7, bloques: { hechas: 3 } };
  const servidor = { inicio: 'a', desfasaje: 0, id: 's1', series: 7, porUbicacion: false };

  // 1. Confirmacion normal: se guarda lo del servidor Y se conservan los
  //    bloques, que el servidor no manda.
  {
    const q = cacheTrasConfirmar(previo, servidor, false);
    chequear('confirmar guarda', q.accion, 'guardar');
    chequear('y los bloques sobreviven', q.cache.bloques, { hechas: 3 });
    chequear('con lo que dice el servidor', q.cache.series, 7);
  }

  // 2. La pregunta que no se pudo hacer no es una respuesta.
  {
    const q = cacheTrasConfirmar(previo, null, true);
    chequear('con error no se toca nada', q.accion, 'mantener');
    // Y tampoco si el error viene con sesion: el error manda.
    chequear('ni aunque venga algo', cacheTrasConfirmar(previo, servidor, true).accion, 'mantener');
  }

  // 3. El servidor dice que NO hay sesion: ahi si se borra. Es la unica forma
  //    de que se borre, y tiene que seguir existiendo — si no, una sesion
  //    cerrada en otro aparato quedaria viva para siempre en este.
  chequear('sin sesion, se borra', cacheTrasConfirmar(previo, null, false).accion, 'borrar');

  // 4. OTRA sesion: los bloques NO se arrastran. Serian las series de ayer
  //    contadas en el entrenamiento de hoy.
  {
    const otra = { ...servidor, id: 's2' };
    const q = cacheTrasConfirmar(previo, otra, false);
    chequear('otra sesion no hereda bloques', q.cache.bloques, undefined);
  }

  // 5. Sin cache previa —la sesion arranco en otro aparato— se guarda lo que
  //    vino y listo.
  {
    const q = cacheTrasConfirmar(null, servidor, false);
    chequear('sin cache previa, se guarda igual', q.cache, servidor);
  }
}
console.log('\n67. La atmosfera: el velo que se abre con el rango');
{
  // POR QUE APARECE RECIEN AHORA. Haciendo el inventario de animaciones salio
  // esto: `atmosfera.ts` ya era puro y ya vivia en el nucleo —o sea que
  // probarlo no costaba nada— y no tenia un solo test. Es la animacion mas
  // LARGA de la app: el velo tarda hasta siete segundos, y si sale mal la
  // pantalla queda demasiado oscura o demasiado clara sin que nada falle.
  //
  // Es exactamente el caso que las capturas no pueden ver: no hay error, no
  // hay excepcion, solo un numero mal.

  // El velo se ABRE con el rango: mas rango, menos velo.
  const velos = [1, 2, 3, 4, 5, 6, 7, 8].map(veloDeRango);
  chequear('el rango 1 es el mas cerrado', velos[0], 0.58);
  chequear('y el 8 el mas abierto', velos[7], 0.38);
  let baja = true;
  for (let i = 1; i < velos.length; i++) if (velos[i] >= velos[i - 1]) baja = false;
  chequear('y no hay ningun escalon al reves', baja, true);

  // Fuera de rango NO explota ni devuelve cualquier cosa: se acota. Un rango 0
  // —o un 99 de una version futura— tiene que dar un velo dibujable.
  chequear('un rango 0 se acota al 1', veloDeRango(0), velos[0]);
  chequear('un rango 99 se acota al 8', veloDeRango(99), velos[7]);
  chequear('y un rango roto tambien', veloDeRango(NaN), velos[0]);

  // NUNCA transparente y nunca opaco: con velo 0 el texto se pierde contra el
  // fondo, y con 1 no se ve el objeto, que es toda la pantalla.
  chequear('siempre queda algo de velo', velos.every((v) => v > 0.2 && v < 0.9), true);

  // Subir y bajar NO tardan lo mismo, y es a proposito: bajar rapido se lee
  // como un error de la app en vez de como una perdida.
  chequear('subir abre rapido', msDeTransicion(3, 4), MS_ABRIR);
  chequear('perder cierra lento', msDeTransicion(4, 3), MS_CERRAR);
  chequear('quedarse igual no es subir', msDeTransicion(4, 4), MS_CERRAR);
  chequear('y cerrar tarda mas que abrir', MS_CERRAR > MS_ABRIR, true);

  // El presagio: los ultimos dias antes de subir.
  chequear('faltan 10 desde cero', faltanParaSubir(0), 10);
  chequear('faltan 3 en el dia 7', faltanParaSubir(7), 3);
  chequear('en el 9 falta uno', faltanParaSubir(9), 1);
  chequear('despues del ultimo rango no falta nada', faltanParaSubir(80), null);
  chequear('no hay presagio a mitad de rango', hayPresagio(5), false);
  chequear('si en los ultimos tres dias', [7, 8, 9].map(hayPresagio), [true, true, true]);
  // Y NO en el dia exacto en que subis: ahi ya no es un presagio, es el rango.
  chequear('y no el dia que subis', hayPresagio(10), false);
  chequear('ni en el ultimo rango', hayPresagio(85), false);
}
console.log('\n68. La subida de rango: formas, fases y que entre en la pantalla');
{
  // LA ANIMACION QUE PAGA LOS OCHENTA DIAS, y hasta esta tanda no tenia un solo
  // test: toda la cuenta vivia adentro del bucle del motor. Sacarla encontro
  // tres cosas que las capturas no podian ver —el navegador sin cabeza anima a
  // un cuadro por segundo— y que ninguna excepcion delataba.
  let semilla = 7;
  const azar = () => {
    semilla = (semilla * 16807) % 2147483647;
    return semilla / 2147483647;
  };

  // ---- 1. las ocho formas existen y son numeros ----
  for (let r = 1; r <= 8; r++) {
    const f = SUB.formaDeRango(r, azar);
    chequear(`rango ${r}: ${SUB.N} particulas`, f.length, SUB.N * 3);
    chequear(`rango ${r}: ninguna es NaN`, [...f].every(Number.isFinite), true);
  }

  // ---- 2. QUE ENTRE EN UN TELEFONO ----
  //
  // EL BUG. La camara muestra x entre +-aspecto, y en un telefono vertical el
  // aspecto es 0,46. Medido antes de arreglarlo: el sol dejaba afuera el 24%
  // de sus particulas, el sistema el 26%, la galaxia el 19% y el agujero negro
  // el 10%. Las subidas mas raras eran justo las que se veian cortadas.
  const telefonos = [
    ['vertical 390x844', 390 / 844],
    ['vertical chico 320x568', 320 / 568],
    ['horizontal 844x390', 844 / 390],
    ['escritorio 1440x900', 1440 / 900],
  ];
  for (const [nombre, asp] of telefonos) {
    const fuera = [];
    for (let r = 1; r <= 8; r++) {
      const f = SUB.formaDeRango(r, azar);
      const k = SUB.escalaParaEntrar(SUB.extension(f), asp);
      let peor = 0;
      for (let i = 0; i < f.length; i += 3) {
        peor = Math.max(peor, Math.abs(f[i] * k) / asp, Math.abs(f[i + 1] * k));
      }
      if (peor > SUB.MARGEN + 1e-6) fuera.push(`rango ${r} llega a ${peor.toFixed(3)}`);
    }
    chequear(`${nombre}: las ocho formas entran`, fuera, []);
  }
  // Y NUNCA AGRANDA: el asteroide es chico a proposito, y en una pantalla ancha
  // tiene que seguir siendolo.
  {
    const ast = SUB.extension(SUB.formaDeRango(2, azar));
    chequear('en pantalla ancha no agranda nada', SUB.escalaParaEntrar(ast, 1440 / 900), 1);
    chequear('con un aspecto roto no hace nada raro', SUB.escalaParaEntrar(ast, NaN), 1);
    chequear('ni con cero', SUB.escalaParaEntrar(ast, 0), 1);
  }

  // ---- 3. las fases ----
  {
    const f0 = SUB.fasesEn(0);
    chequear('al principio nada se movio', [f0.disp, f0.junta, f0.caos], [0, 0, 0]);
    const f4 = SUB.fasesEn(SUB.FIN_DISPERSION);
    chequear('al 40% esta dispersado del todo', f4.disp, 1);
    chequear('y todavia no empezo a juntarse', f4.junta, 0);
    const f1 = SUB.fasesEn(1);
    chequear('al final esta junto del todo', f1.junta, 1);
    // EL SEGUNDO HALLAZGO. El remolino se apagaba con sin(pi), que da
    // 1,2e-16 y no cero: la forma nunca terminaba de quedar quieta del todo.
    chequear('y el remolino vale cero EXACTO', f1.caos, 0);
    chequear('desde el 75% ya no hay remolino', SUB.fasesEn(SUB.FIN_CAOS).caos, 0);
    chequear('un progreso roto es el principio', SUB.fasesEn(NaN), f0);
  }

  // ---- 4. los bordes quedan exactos ----
  //
  // Al principio tiene que ser la forma vieja y al final la nueva, sin UNA
  // particula corrida: el objeto que queda es el que se ve todos los dias.
  {
    const desde = SUB.formaDeRango(4, azar);
    const hasta = SUB.formaDeRango(5, azar);
    const disp = SUB.azarDeDispersion(azar);
    const dest = new Float32Array(desde.length);
    SUB.posicionesSubida(desde, hasta, disp, 0, 0, true, dest);
    chequear('el primer cuadro es la forma vieja', [...dest], [...desde]);
    SUB.posicionesSubida(desde, hasta, disp, 1, 5.2, true, dest);
    chequear('el ultimo es la nueva, exacta', [...dest], [...hasta]);

    // Y en el medio no hay saltos: entre dos cuadros seguidos (60 por segundo)
    // ninguna particula puede teletransportarse.
    const antes = new Float32Array(desde.length);
    SUB.posicionesSubida(desde, hasta, disp, 0, 0, true, antes);
    let salto = 0;
    const dur = SUB.DURACION_IGNICION_S;
    for (let c = 1; c <= dur * 60; c++) {
      const s = c / 60;
      SUB.posicionesSubida(desde, hasta, disp, SUB.progresoEn(s, dur), s, true, dest);
      for (let i = 0; i < dest.length; i++) salto = Math.max(salto, Math.abs(dest[i] - antes[i]));
      antes.set(dest);
    }
    chequear('ninguna particula salta entre dos cuadros', salto < 0.08, true);
  }

  // ---- 5. EL TERCER HALLAZGO: el remolino leia el cuadro anterior ----
  //
  // Desplazaba x segun la y de la particula, pero el bucle calculaba x ANTES
  // que y, asi que la y era la del cuadro pasado. Esto lo fija: con la misma
  // entrada, el resultado no depende de lo que habia antes en el destino.
  {
    const desde = SUB.formaDeRango(3, azar);
    const hasta = SUB.formaDeRango(4, azar);
    const disp = SUB.azarDeDispersion(azar);
    const limpio = new Float32Array(desde.length);
    const sucio = new Float32Array(desde.length).fill(99);
    SUB.posicionesSubida(desde, hasta, disp, 0.3, 1.2, false, limpio);
    SUB.posicionesSubida(desde, hasta, disp, 0.3, 1.2, false, sucio);
    chequear('el cuadro no depende del anterior', [...sucio], [...limpio]);
  }

  // ---- 6. el tiempo ----
  chequear('un tiempo negativo es el principio', SUB.progresoEn(-0.003, 4), 0);
  chequear('un tiempo roto tambien', SUB.progresoEn(NaN, 4), 0);
  chequear('pasado el final queda en 1', SUB.progresoEn(9, 4), 1);
  chequear('la ignicion dura mas', SUB.duracionDeSubida(4, 5) > SUB.duracionDeSubida(3, 4), true);
  chequear(
    'y solo 4 a 5 es ignicion',
    [SUB.esIgnicion(4, 5), SUB.esIgnicion(5, 6), SUB.esIgnicion(3, 5)],
    [true, false, false]
  );

  // ---- 7. el flash ----
  {
    let alguno = false;
    let max = 0;
    let negativo = false;
    for (let i = 0; i <= 1000; i++) {
      const q = i / 1000;
      if (SUB.flashEn(q, false) !== 0) alguno = true;
      const f = SUB.flashEn(q, true);
      max = Math.max(max, f);
      if (f < 0) negativo = true;
    }
    chequear('sin ignicion no hay flash nunca', alguno, false);
    chequear('con ignicion pega', max > 0.8, true);
    chequear('y nunca pasa de 1', max <= 1, true);
    chequear('ni es negativo', negativo, false);
    // Si el ultimo cuadro tuviera flash, la subida del Sol terminaria con la
    // pantalla blanca congelada.
    chequear('el ultimo cuadro no tiene flash', SUB.flashEn(1, true), 0);
    chequear('el pico cae al juntarse', SUB.flashEn(SUB.PICO_FLASH, true) > SUB.flashEn(0.7, true), true);
  }

  // ---- 8. la luz y la escala ----
  {
    let fueraDeRango = false;
    for (let i = 0; i <= 100; i++) {
      const o = SUB.opacidadEn(i / 100);
      if (o < 0.55 || o > 1) fueraDeRango = true;
    }
    chequear('la luz nunca se apaga ni se pasa', fueraDeRango, false);
    chequear('la escala arranca en la del objeto viejo', SUB.escalaEn(0, 0.5, 0.8), 0.5);
    chequear('y termina en la del nuevo', SUB.escalaEn(1, 0.5, 0.8), 0.8);
  }
}
console.log('\n69. El numero que cuenta');
{
  // Es poco codigo, pero es la racha: el numero mas mirado de la app. Vivia
  // adentro de un efecto de React, donde no se podia probar.

  // ---- cuando se cuenta ----
  chequear('la primera pintada no cuenta', hayQueContar(47, 47, false), false);
  chequear('46 a 47 si', hayQueContar(46, 47, false), true);
  chequear('perder tambien cuenta, para abajo', hayQueContar(47, 37, false), true);
  chequear('un salto grande no se cuenta', hayQueContar(3, 47, false), false);
  chequear('el borde, 12, todavia si', hayQueContar(0, SALTO_MAXIMO, false), true);
  chequear('con reducir movimiento no', hayQueContar(46, 47, true), false);
  // Un NaN contando serian 700 ms de un numero roto en pantalla.
  chequear('un numero roto no cuenta', hayQueContar(NaN, 47, false), false);

  // ---- que numero se ve ----
  chequear('al arrancar es el viejo', valorContado(46, 47, 0), 46);
  chequear('al final es el nuevo exacto', valorContado(46, 47, 1), 47);
  chequear('pasado el final tambien', valorContado(46, 47, 1.7), 47);
  // El primer cuadro puede llegar con tiempo negativo: la trampa del pulso.
  chequear('un tiempo negativo es el viejo', valorContado(0, 12, -0.004), 0);
  chequear('y no es -0', Object.is(valorContado(0, 12, -0.004), -0), false);
  chequear('un tiempo roto tambien es el viejo', valorContado(46, 47, NaN), 46);

  // Nunca se sale del tramo, nunca retrocede, siempre entero. En las dos
  // direcciones, porque perder la racha tambien cuenta.
  for (const [a, b] of [[46, 47], [35, 47], [47, 37], [0, 12], [5, 0]]) {
    let fuera = false;
    let retrocede = false;
    let noEntero = false;
    let prev = a;
    for (let i = -5; i <= 1005; i++) {
      const v = valorContado(a, b, i / 1000);
      if (v < Math.min(a, b) || v > Math.max(a, b)) fuera = true;
      if (!Number.isInteger(v)) noEntero = true;
      if (b > a ? v < prev : v > prev) retrocede = true;
      prev = v;
    }
    chequear(`${a} a ${b}: no se sale, no retrocede, siempre entero`, [fuera, retrocede, noEntero], [false, false, false]);
  }

  // Llega rapido y se asienta: a mitad de tiempo ya recorrio mas de la mitad.
  chequear('a mitad de tiempo ya paso la mitad', valorContado(0, 12, 0.5) > 6, true);
}
console.log('\n70. El aviso de las 20:30: a quien, y una sola vez');
{
  // LO QUE NO SE PUEDE EQUIVOCAR. Un aviso que llega el dia que SI fuiste es
  // peor que no tener aviso: ensena a ignorarlo. Y uno repetido es spam. Las
  // dos cosas las decide `tomar_avisos_del_dia`, que es SQL, asi que se prueba
  // aca y no mandando notificaciones.
  const suscribir = async (u, n) => {
    await comoUsuario(u);
    await db.query('select guardar_suscripcion_push($1, $2, $3)', [
      `https://push.ejemplo/${n}`,
      'p256dh-' + n,
      'auth-' + n,
    ]);
  };
  const tomar = async () =>
    (await db.query('select endpoint, racha from tomar_avisos_del_dia()')).rows.map((r) => r.endpoint).sort();

  // Se vacia lo que hubiera de otras secciones.
  await db.query('delete from suscripciones_push');

  const noFue = await nuevoUsuario();
  await rachaDe(noFue, 5, 1); // fue hasta ayer
  await suscribir(noFue, 'nofue');

  const fue = await nuevoUsuario();
  await rachaDe(fue, 5, 0); // fue hoy
  await suscribir(fue, 'fue');

  const descansa = await nuevoUsuario();
  await comoUsuario(descansa);
  const dow = (await db.query('select extract(dow from mi_hoy())::int as d')).rows[0].d;
  await db.query('insert into descansos (user_id, desde, dias) values ($1, mi_hoy() - 10, $2)', [descansa, [dow]]);
  await suscribir(descansa, 'descansa');

  // Estuvo en el gimnasio y la guarda todavia no confirmo el dia: fue, solo
  // que no se sabe. Avisarle "no fuiste" seria mentirle.
  const pendiente = await nuevoUsuario();
  await comoUsuario(pendiente);
  await db.query('update profiles set dia_pendiente = mi_hoy() where id = $1', [pendiente]);
  await suscribir(pendiente, 'pendiente');

  // Sin suscripcion no hay nada que mandar, aunque no haya ido.
  const sinAviso = await nuevoUsuario();
  await rachaDe(sinAviso, 3, 2);

  chequear('solo le avisa al que no fue', await tomar(), ['https://push.ejemplo/nofue']);
  // EL REINTENTO. El cron puede correr dos veces; la segunda no encuentra a
  // nadie porque la primera ya anoto el dia.
  chequear('y una sola vez por dia', await tomar(), []);

  // ---- prender el aviso ----
  {
    await suscribir(noFue, 'nofue'); // otra vez el mismo aparato
    const filas = (await db.query("select count(*)::int n from suscripciones_push where endpoint = 'https://push.ejemplo/nofue'")).rows[0].n;
    chequear('prenderlo dos veces no duplica', filas, 1);
    // Y volver a prenderlo no resetea el "ya le avise hoy".
    chequear('ni le vuelve a avisar hoy', await tomar(), []);

    // Un telefono prestado: el aparato pasa a la cuenta que lo prendio ahora.
    await suscribir(sinAviso, 'nofue');
    const duenio = (await db.query("select user_id from suscripciones_push where endpoint = 'https://push.ejemplo/nofue'")).rows[0].user_id;
    chequear('el aparato es de quien lo tiene en la mano', duenio, sinAviso);
  }

  // ---- apagarlo ----
  {
    await comoUsuario(fue);
    await db.query('select borrar_suscripcion_push($1)', ['https://push.ejemplo/descansa']);
    const sigue = (await db.query("select count(*)::int n from suscripciones_push where endpoint = 'https://push.ejemplo/descansa'")).rows[0].n;
    chequear('no se puede apagar el aviso de otro', sigue, 1);
    await db.query('select borrar_suscripcion_push($1)', ['https://push.ejemplo/fue']);
    const quedo = (await db.query("select count(*)::int n from suscripciones_push where endpoint = 'https://push.ejemplo/fue'")).rows[0].n;
    chequear('el propio si', quedo, 0);
  }

  // ---- lo que no entra ----
  {
    let rechazo = false;
    try {
      await comoUsuario(fue);
      await db.query("select guardar_suscripcion_push('http://inseguro/x', 'a', 'b')");
    } catch {
      rechazo = true;
    }
    chequear('una direccion sin https no entra', rechazo, true);
  }

  // ---- y los permisos: la lista de a quien avisar es SOLO del servidor ----
  //
  // Devuelve direcciones de push de otra gente. Si un usuario la pudiera
  // llamar, cualquiera podria mandarle notificaciones a todos.
  {
    let bloqueado = false;
    await db.exec('set role authenticated');
    try {
      await db.query('select * from tomar_avisos_del_dia()');
    } catch (e) {
      bloqueado = /permission denied/i.test(String(e.message));
    }
    await db.exec('reset role');
    chequear('un usuario no puede pedir la lista', bloqueado, true);

    let olvidar = false;
    await db.exec('set role authenticated');
    try {
      await db.query("select olvidar_suscripcion_push('https://push.ejemplo/descansa')");
    } catch (e) {
      olvidar = /permission denied/i.test(String(e.message));
    }
    await db.exec('reset role');
    chequear('ni borrar suscripciones ajenas por la puerta del servidor', olvidar, true);

    let servidor = true;
    await db.exec('set role service_role');
    try {
      await db.query('select * from tomar_avisos_del_dia()');
    } catch {
      servidor = false;
    }
    await db.exec('reset role');
    chequear('el servidor si', servidor, true);
  }
}
console.log('\n71. Lo que el codigo nombra, existe');
{
  // EL BUG QUE ESTO HABRIA AGARRADO. Al renombrar las vidas a impulsos cambie
  // `T.vidas` por `T.impulso` en la web, corri el tsc de la web, dio verde, y
  // commitee. La app nativa seguia leyendo `T.vidas.titulo`: son dos proyectos
  // con dos tsc distintos, y el de la web no mira `movil/`. Estuvo roto una
  // tanda entera sin que nada lo dijera.
  //
  // Esto no compila nada: lee los archivos de LOS DOS lados y comprueba dos
  // cosas que son las que se rompen al renombrar.
  //   - Cada `T.seccion.clave` que se usa existe en los textos.
  //   - Cada `rpc('funcion')` que se llama existe en el schema.
  const { readdirSync: leerDir, readFileSync: leerArch, statSync: estado } = await import('node:fs');
  const { T } = await import('../nucleo/textos.ts');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const esquema = leerArch(join(RAIZ, 'supabase', 'schema.sql'), 'utf8');

  const archivos = [];
  const recorrer = (d) => {
    for (const n of leerDir(d)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const r = join(d, n);
      if (estado(r).isDirectory()) recorrer(r);
      else if (/\.tsx?$/.test(n)) archivos.push(r);
    }
  };
  recorrer(join(RAIZ, 'src'));
  recorrer(join(RAIZ, 'compartido'));
  recorrer(join(RAIZ, 'movil', 'src'));
  recorrer(join(RAIZ, 'nucleo'));

  const textosQueNoEstan = new Set();
  const funcionesQueNoEstan = new Set();
  let textos = 0;
  let llamadas = 0;
  for (const a of archivos) {
    const codigo = sinComentarios(leerArch(a, 'utf8'));
    const donde = a.slice(RAIZ.length + 1).replace(/\\/g, '/');
    for (const m of codigo.matchAll(/(?<![A-Za-z0-9_$.])T\.([a-zA-Z]+)\.([a-zA-Z]+)(?![A-Za-z0-9_])/g)) {
      textos++;
      if (T[m[1]] === undefined || T[m[1]][m[2]] === undefined) {
        textosQueNoEstan.add(`${donde}: T.${m[1]}.${m[2]}`);
      }
    }
    for (const m of codigo.matchAll(/\.rpc\(\s*'([a-z_0-9]+)'/g)) {
      llamadas++;
      if (!new RegExp(`function public\\.${m[1]}\\(`).test(esquema)) {
        funcionesQueNoEstan.add(`${donde}: ${m[1]}`);
      }
    }
  }
  chequear(`los ${textos} textos que se usan existen`, [...textosQueNoEstan].sort(), []);
  chequear(`las ${llamadas} llamadas a la base van a funciones que existen`, [...funcionesQueNoEstan].sort(), []);
  // Y que de verdad miro la app nativa: si el recorrido no la encontrara, el
  // test pasaria sin haber mirado lo que vino a mirar.
  chequear('y miro la app nativa', archivos.some((a) => a.includes('movil')), true);
}
console.log('\n72. Lo que dice el aviso de las 20:30');
{
  // Es la unica vez que la app le habla a alguien que no la abrio. Dice un
  // hecho, nombra la racha si hay, y NUNCA menciona los impulsos: "tranquilo,
  // tenes dos" convierte el aviso en un permiso para no ir.
  const con = avisoDiario(25);
  chequear('con racha, la nombra', con.cuerpo.includes('25'), true);
  chequear('y lleva a Inicio', con.url, '/');
  const sin = avisoDiario(0);
  chequear('sin racha no dice "va en 0"', sin.cuerpo.includes('0'), false);
  chequear('una racha rota es sin racha', avisoDiario(null).cuerpo, sin.cuerpo);
  chequear('una racha con coma no sale con coma', avisoDiario(12.7).cuerpo.includes('12.7'), false);
  const todo = [con.titulo, con.cuerpo, sin.cuerpo].join(' ').toLowerCase();
  chequear('no nombra los impulsos', /impulso/.test(todo), false);
  chequear('ni asusta', /pierd|perder|cuidado|!/.test(todo), false);
}
console.log('\n73. El resumen de un dia');
{
  // Los casos que en la pantalla son raros y en la vida no.
  const { resumenDelDia } = await import('../nucleo/resumenDia.ts');
  const catalogo = new Map([
    ['press_banca', 'Press de banca'],
    ['sentadilla', 'Sentadilla'],
  ]);
  const base = { catalogo, esFuturo: false, esDescansoConfigurado: false, ejercicioSinNombre: '?' };
  const ses = (inicio, fin, estado, series, bloques = []) => ({ inicio, fin, estado, series, bloques });

  // ---- el estado ----
  chequear('sin nada, sin registrar', resumenDelDia({ ...base, log: null, sesiones: [] }).estado, 'sin-registrar');
  chequear('con dia, entrenado', resumenDelDia({ ...base, log: { es_descanso: false }, sesiones: [] }).estado, 'entrenado');
  chequear('descanso marcado', resumenDelDia({ ...base, log: { es_descanso: true }, sesiones: [] }).estado, 'descanso');
  chequear('descanso de la rutina', resumenDelDia({ ...base, log: null, sesiones: [], esDescansoConfigurado: true }).estado, 'descanso');
  // Entrenar un dia de descanso es entrenar: el dia manda sobre la rutina.
  chequear('entrenar en dia de descanso es entrenado', resumenDelDia({ ...base, log: { es_descanso: false }, sesiones: [], esDescansoConfigurado: true }).estado, 'entrenado');
  chequear('manana es futuro', resumenDelDia({ ...base, log: null, sesiones: [], esFuturo: true }).estado, 'futuro');

  // ---- un dia normal ----
  {
    const r = resumenDelDia({
      ...base,
      log: { es_descanso: false, origen: 'manual' },
      sesiones: [
        ses('2026-09-10T18:00:00Z', '2026-09-10T18:52:30Z', 'terminada', 8, [
          { ejercicio: 'press_banca', series: 4 },
          { ejercicio: 'sentadilla', series: 4 },
        ]),
      ],
    });
    chequear('la duracion sale de inicio y fin', r.duracionSegundos, 3150);
    chequear('las series, del total', r.series, 8);
    chequear('los ejercicios, con nombre', r.ejercicios.map((e) => `${e.nombre} ${e.series}`), ['Press de banca 4', 'Sentadilla 4']);
    chequear('y nada sin anotar', r.sinEjercicio, 0);
  }

  // ---- dos sesiones el mismo dia ----
  {
    const r = resumenDelDia({
      ...base,
      log: { es_descanso: false },
      // Llegan desordenadas a proposito: la de la tarde primero.
      sesiones: [
        ses('2026-09-10T20:00:00Z', '2026-09-10T20:30:00Z', 'terminada', 3, [{ ejercicio: 'press_banca', series: 3 }]),
        ses('2026-09-10T08:00:00Z', '2026-09-10T08:20:00Z', 'terminada', 4, [
          { ejercicio: 'sentadilla', series: 2 },
          { ejercicio: 'press_banca', series: 2 },
        ]),
      ],
    });
    chequear('las duraciones se suman', r.duracionSegundos, 50 * 60);
    chequear('y las series', r.series, 7);
    // En el orden en que se HICIERON: la sesion de la manana empezo con
    // sentadilla. Y volver a banca a la tarde suma a la fila de banca.
    chequear('en orden de lo que se hizo primero', r.ejercicios.map((e) => e.id), ['sentadilla', 'press_banca']);
    chequear('volver a un ejercicio suma a su fila', r.ejercicios.find((e) => e.id === 'press_banca').series, 5);
  }

  // ---- la sesion que se cerro sola ----
  //
  // Una sesion abandonada no tiene duracion real: se cerro por el tope de
  // cuatro horas. Mostrar "4 h" seria inventar un entrenamiento.
  {
    const r = resumenDelDia({
      ...base,
      log: { es_descanso: false },
      sesiones: [ses('2026-09-10T18:00:00Z', null, 'abandonada', 6)],
    });
    chequear('abandonada: sin duracion', r.duracionSegundos, null);
    chequear('pero las series si cuentan', r.series, 6);
    chequear('y todas sin ejercicio', r.sinEjercicio, 6);
  }

  // ---- el dia que entro solo, sin sesion ----
  {
    const r = resumenDelDia({ ...base, log: { es_descanso: false, origen: 'ubicacion' }, sesiones: [] });
    chequear('por ubicacion, sin sesion', [r.estado, r.origen, r.series, r.duracionSegundos], ['entrenado', 'ubicacion', 0, null]);
  }

  // ---- hoy, con la sesion corriendo ----
  {
    const r = resumenDelDia({
      ...base,
      log: { es_descanso: false },
      sesiones: [ses('2026-09-10T18:00:00Z', null, 'corriendo', 2)],
    });
    chequear('la de hoy esta en curso', r.enCurso, true);
  }

  // ---- lo que viene raro de la base ----
  {
    const r = resumenDelDia({
      ...base,
      log: { es_descanso: false },
      sesiones: [
        ses('2026-09-10T18:00:00Z', '2026-09-10T19:00:00Z', 'terminada', 5, [
          { ejercicio: 'curl_de_1998', series: 2 }, // ya no esta en el catalogo
          { ejercicio: 'sentadilla', series: 'tres' }, // basura
          null,
          'no soy un bloque',
          { ejercicio: 'sentadilla', series: -4 },
        ]),
      ],
    });
    chequear('un ejercicio que ya no existe se muestra igual', r.ejercicios.map((e) => e.nombre), ['?']);
    chequear('la basura no suma', r.ejercicios.length, 1);
    chequear('y lo que falta queda sin ejercicio', r.sinEjercicio, 3);
    chequear('bloques que no son lista no rompen', resumenDelDia({ ...base, log: { es_descanso: false }, sesiones: [ses('2026-09-10T18:00:00Z', null, 'abandonada', 1, { no: 'lista' })] }).ejercicios, []);
  }

  // Los bloques suman MAS que el total —se corrigio el total a mano—: el
  // total manda, y no hay series negativas sin anotar.
  {
    const r = resumenDelDia({
      ...base,
      log: { es_descanso: false },
      sesiones: [ses('2026-09-10T18:00:00Z', null, 'abandonada', 2, [{ ejercicio: 'sentadilla', series: 5 }])],
    });
    chequear('sin ejercicio nunca es negativo', r.sinEjercicio, 0);
  }
}
console.log('\n74. Toda hoja se monta en el body');
{
  // LA TERCERA VEZ. Una hoja abierta desde adentro de una pantalla queda
  // atrapada en el contexto de apilado de `.pantalla` —que tiene z-index— y se
  // dibuja DEBAJO de la barra de navegacion, con el boton de cerrar tapado.
  // Paso con el selector de ejercicios y se arreglo solo ahi; volvio a pasar
  // con la hoja del dia y con la lista de bloques. Arreglarlo hoja por hoja es
  // garantizar la cuarta, asi que se prueba el patron: si un archivo dibuja
  // una hoja, usa `EnElBody`.
  const { readdirSync: leerDir, readFileSync: leerArch, statSync: estado } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const hojas = [];
  const sueltas = [];
  const recorrer = (d) => {
    for (const n of leerDir(d)) {
      const r = join(d, n);
      if (estado(r).isDirectory()) recorrer(r);
      else if (n.endsWith('.tsx') && n !== 'EnElBody.tsx') {
        const codigo = sinComentarios(leerArch(r, 'utf8'));
        if (codigo.includes('hoja-fondo')) {
          hojas.push(n);
          if (!codigo.includes('<EnElBody>')) sueltas.push(n);
        }
      }
    }
  };
  recorrer(RAIZ);
  chequear(`las ${hojas.length} hojas se montan en el body`, sueltas, []);
  // Y que encontro hojas: si el patron cambiara de nombre, esto pasaria sin
  // mirar nada.
  chequear('y encontro las hojas', hojas.length >= 6, true);
}
console.log('\n75. El peso por serie, y la app sin el');
{
  const B = await import('../nucleo/bloques.ts');

  // ---- 1. LA INVARIANTE, antes que nada ----
  //
  // "El peso es OPCIONAL. La app tiene que funcionar entera sin el, igual que
  // hoy." No es una preferencia de diseno: es la condicion del humano. Una
  // sesion entera sin anotar un solo peso tiene que dar EXACTAMENTE el mismo
  // estado y lo mismo para guardar que antes de que existiera el peso: ni una
  // llave nueva, ni un `pesos: []`, ni un `peso: null`.
  {
    let e = B.bloquesVacios('sentadilla', 3);
    e = B.sumar(e);
    e = B.sumar(e);
    e = B.restar(e);
    e = B.sumar(e);
    e = B.sumar(e);
    e = B.siguiente(e);
    e = B.cambiarEjercicio(e, 'press_banca');
    e = B.sumar(e);
    e = B.mudarEjercicio(e, 'peso_muerto');
    e = B.sumar(e);
    e = B.cambiarPeso(e, null); // borrar un peso que nunca estuvo
    ({ estado: e } = B.corregirBloque(e, 0, 1));
    const json = JSON.stringify(e);
    // Se buscan LLAVES y no la palabra: `peso_muerto` es un ejercicio.
    chequear('sin anotar pesos, el estado no tiene ni una llave de peso', /"pesos?":/.test(json), false);
    chequear('y es el de siempre', e, {
      cerrados: [{ ejercicio: 'sentadilla', series: 4 }],
      ejercicio: 'peso_muerto',
      meta: 3,
      hechas: 2,
    });
    chequear('lo que se guarda, tambien', B.paraGuardar(e), [
      { ejercicio: 'sentadilla', series: 4 },
      { ejercicio: 'peso_muerto', series: 2 },
    ]);
  }

  // ---- 2. el peso es del bloque ----
  {
    let e = B.bloquesVacios('press_banca', 4);
    e = B.cambiarPeso(e, 60);
    e = B.sumar(e);
    e = B.sumar(e);
    e = B.cambiarPeso(e, '62,5'); // con coma, como se escribe en un telefono en espanol
    e = B.sumar(e);
    e = B.sumar(e);
    chequear('cada serie se anota con el peso que habia', e.pesos, [60, 60, 62.5, 62.5]);
    chequear('y el peso vigente queda', e.peso, 62.5);
    chequear('se guarda con los pesos', B.paraGuardar(e), [
      { ejercicio: 'press_banca', series: 4, pesos: [60, 60, 62.5, 62.5] },
    ]);

    // Cerrar el bloque: el siguiente es del mismo ejercicio y el peso se queda.
    const s = B.siguiente(e);
    chequear('cerrar se lleva los pesos al bloque cerrado', s.cerrados[0].pesos, [60, 60, 62.5, 62.5]);
    chequear('y el bloque nuevo arranca sin series pero con el peso', [s.hechas, s.peso, s.pesos], [0, 62.5, undefined]);

    // Cambiar de ejercicio: el peso NO pasa. 100 de sentadilla no es un peso
    // de press de banca.
    const c = B.cambiarEjercicio(e, 'sentadilla');
    chequear('otro ejercicio no hereda el peso', c.peso, undefined);
    // Mudar las series al ejercicio correcto: ahi si, lo que levantaste fue eso.
    const m = B.mudarEjercicio(e, 'press_inclinado');
    chequear('mudar se lleva los pesos', [m.peso, m.pesos], [62.5, [60, 60, 62.5, 62.5]]);
  }

  // ---- 3. series con y sin peso en el mismo bloque ----
  {
    let e = B.bloquesVacios('remo', 3);
    e = B.sumar(e); // sin peso
    e = B.cambiarPeso(e, 40);
    e = B.sumar(e);
    chequear('una serie sin peso queda en null', e.pesos, [null, 40]);
    e = B.cambiarPeso(e, '');
    e = B.sumar(e);
    chequear('borrar el peso sigue sin peso', e.pesos, [null, 40, null]);
    e = B.restar(e);
    chequear('restar se lleva la ultima', e.pesos, [null, 40]);
    e = B.restar(e);
    // Queda una serie sin peso: la lista entera se va, no queda un [null].
    chequear('si no queda ningun peso, se va la llave', 'pesos' in e, false);
  }

  // ---- 4. corregir desde la lista ----
  {
    let e = B.bloquesVacios('sentadilla', 3);
    e = B.cambiarPeso(e, 100);
    e = B.sumar(B.sumar(B.sumar(e)));
    e = B.siguiente(e);
    e = B.corregirPeso(e, 0, 2, 95); // la tercera fue con menos
    chequear('se corrige una sola serie', e.cerrados[0].pesos, [100, 100, 95]);
    ({ estado: e } = B.corregirBloque(e, 0, 1));
    chequear('una serie agregada a mano repite el ultimo peso', e.cerrados[0].pesos, [100, 100, 95, 95]);
    ({ estado: e } = B.corregirBloque(e, 0, -2));
    chequear('sacar series se lleva sus pesos', e.cerrados[0].pesos, [100, 100]);
    e = B.corregirPeso(e, 0, 0, null);
    e = B.corregirPeso(e, 0, 1, null);
    chequear('borrar todos los pesos saca la llave', 'pesos' in e.cerrados[0], false);
    chequear('una serie que no existe no se toca', B.corregirPeso(e, 0, 9, 50), e);
    chequear('ni un bloque que no existe', B.corregirPeso(e, 7, 0, 50), e);
    // El bloque en curso, con indice -1.
    let a = B.cambiarPeso(B.bloquesVacios('dominadas', 3), 10);
    a = B.sumar(B.sumar(a));
    chequear('tambien el bloque en curso', B.corregirPeso(a, -1, 1, 12.5).pesos, [10, 12.5]);
  }

  // ---- 5. lo que no es un peso ----
  chequear('cero no es un peso', B.pesoValido(0), null);
  chequear('negativo tampoco', B.pesoValido(-5), null);
  chequear('texto tampoco', B.pesoValido('mucho'), null);
  chequear('con coma si', B.pesoValido('61,25'), 61.25);
  chequear('las libras pasadas a kilos se redondean a centesimas', B.pesoValido(135 * 0.45359237), 61.23);
  chequear('y hay un tope', B.pesoValido(5000), B.PESO_MAXIMO);
  // Una cache vieja o rota no puede meter basura en lo que se guarda.
  chequear(
    'lo que se guarda limpia la basura',
    B.paraGuardar({ cerrados: [{ ejercicio: 'remo', series: 2, pesos: ['x', -1, 50] }], ejercicio: null, meta: 3, hechas: 0 }),
    [{ ejercicio: 'remo', series: 2 }]
  );
}
console.log('\n76. La base guarda los pesos, y no le cree al telefono');
{
  const u = await nuevoUsuario();
  await comoUsuario(u);
  const s = (await db.query('select iniciar_sesion() as v')).rows[0].v;
  const id = s.id ?? (await db.query('select id from sesiones where user_id = $1 order by inicio desc limit 1', [u])).rows[0].id;
  await db.query('select fijar_series($1, 8)', [id]);
  // jsonb ordena las llaves a su manera (por largo): se comparan ordenadas, o
  // el test fallaria por el orden de las llaves y no por lo que guardan.
  const ordenar = (x) =>
    Array.isArray(x)
      ? x.map(ordenar)
      : x && typeof x === 'object'
        ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, ordenar(x[k])]))
        : x;
  const fijar = async (bloques) =>
    ordenar((await db.query('select fijar_bloques($1, $2::jsonb) as v', [id, JSON.stringify(bloques)])).rows[0].v.bloques);

  // ---- LA INVARIANTE, del lado de la base ----
  chequear(
    'sin pesos, se guarda lo mismo que siempre',
    await fijar([{ ejercicio: 'sentadilla', series: 4 }]),
    ordenar([{ ejercicio: 'sentadilla', series: 4 }])
  );

  // ---- con pesos ----
  chequear(
    'con pesos, los guarda',
    await fijar([{ ejercicio: 'press_banca', series: 4, pesos: [60, 60, 62.5, 62.5] }]),
    // Desde la 38 los pesos van con su modo (seccion 82).
    ordenar([{ ejercicio: 'press_banca', series: 4, pesos: [60, 60, 62.5, 62.5], carga: 'total' }])
  );

  // ---- lo que manda un telefono roto, o alguien con la consola abierta ----
  chequear(
    'mas pesos que series: se cortan',
    (await fijar([{ ejercicio: 'sentadilla', series: 2, pesos: [100, 100, 100, 100] }]))[0].pesos,
    [100, 100]
  );
  chequear(
    'la basura queda en null',
    (await fijar([{ ejercicio: 'sentadilla', series: 4, pesos: [100, 'mucho', -5, 5000] }]))[0].pesos,
    [100, null, null, null]
  );
  chequear(
    'y si no queda ningun peso, no hay llave',
    await fijar([{ ejercicio: 'sentadilla', series: 2, pesos: [null, 0] }]),
    ordenar([{ ejercicio: 'sentadilla', series: 2 }])
  );
  chequear(
    'pesos que no son lista no rompen nada',
    await fijar([{ ejercicio: 'sentadilla', series: 2, pesos: { no: 'lista' } }]),
    ordenar([{ ejercicio: 'sentadilla', series: 2 }])
  );
  chequear(
    'centesimas, igual que el telefono',
    (await fijar([{ ejercicio: 'sentadilla', series: 1, pesos: [61.23456] }]))[0].pesos,
    [61.23]
  );

  // ---- los pesos NO tocan el total ni la racha ----
  const ses = (await db.query('select series from sesiones where id = $1', [id])).rows[0];
  chequear('el total de la sesion no se entero', ses.series, 8);

  // ---- con que peso arranca el bloque ----
  {
    await fijar([
      { ejercicio: 'press_banca', series: 3, pesos: [60, 62.5, null] }, // la ultima sin anotar
      { ejercicio: 'sentadilla', series: 2, pesos: [100, 105] },
    ]);
    const ultimo = async (e) => (await db.query('select ultimo_peso($1) as v', [e])).rows[0].v;
    // La ultima serie CON peso, no la ultima serie.
    chequear('el ultimo peso anotado, no la ultima serie', Number(await ultimo('press_banca')), 62.5);
    chequear('por ejercicio', Number(await ultimo('sentadilla')), 105);
    chequear('un ejercicio sin pesos no propone nada', await ultimo('peso_muerto'), null);
    // Y es de ESTA persona.
    const otro = await nuevoUsuario();
    await comoUsuario(otro);
    chequear('los pesos de otro no se proponen', await ultimo('sentadilla'), null);
  }
}
console.log('\n77. Los pesos en el resumen del dia');
{
  const { resumenDelDia } = await import('../nucleo/resumenDia.ts');
  const { pesoCorto, pasoDePeso } = await import('../nucleo/peso.ts');
  const base = {
    catalogo: new Map([['press_banca', 'Press de banca'], ['sentadilla', 'Sentadilla']]),
    esFuturo: false,
    esDescansoConfigurado: false,
    ejercicioSinNombre: '?',
    log: { es_descanso: false },
  };
  const ses = (inicio, bloques) => ({ inicio, fin: null, estado: 'abandonada', series: 20, bloques });

  const r = resumenDelDia({
    ...base,
    sesiones: [
      ses('2026-09-10T20:00:00Z', [{ ejercicio: 'press_banca', series: 2, pesos: [65, 65] }]),
      ses('2026-09-10T08:00:00Z', [
        { ejercicio: 'press_banca', series: 3, pesos: [60, null, 62.5] },
        { ejercicio: 'sentadilla', series: 2 },
      ]),
    ],
  });
  const banca = r.ejercicios.find((e) => e.id === 'press_banca');
  chequear('los pesos van en el orden en que se hicieron, de las dos sesiones', banca.pesos, [60, null, 62.5, 65, 65]);
  // El ejercicio sin pesos se resume igual que antes: sin la llave.
  chequear('un ejercicio sin pesos no tiene la llave', 'pesos' in r.ejercicios.find((e) => e.id === 'sentadilla'), false);

  // Lo que viene raro: mas pesos que series, basura.
  const raro = resumenDelDia({
    ...base,
    sesiones: [ses('2026-09-10T08:00:00Z', [{ ejercicio: 'sentadilla', series: 2, pesos: [100, 'x', 110, 120] }])],
  });
  chequear('uno por serie, sin basura', raro.ejercicios[0].pesos, [100, null]);

  // ---- como se muestra ----
  chequear('kilos sin ceros de mas, con coma', [pesoCorto(60, 'kg'), pesoCorto(62.5, 'kg'), pesoCorto(61.25, 'kg')], ['60', '62,5', '61,25']);
  // En libras nadie carga 137,21: al medio, que es como son los discos.
  chequear('libras al medio', pesoCorto(61.23, 'lb'), '135');
  chequear('el disco chico de cada lado', [pasoDePeso('kg'), pasoDePeso('lb')], [2.5, 5]);
}
console.log('\n78. La sesion se cierra sola cuando se deja de entrenar');
{
  // "Me olvide de terminar y quedo en tres horas." Media hora sin actividad y
  // se cierra, fechada en la ULTIMA actividad: la duracion no incluye el
  // tiempo muerto. Los tiempos se mueven a mano en la base; ningun test espera
  // media hora.
  const arrancar = async (hace) => {
    const u = await nuevoUsuario();
    await comoUsuario(u);
    await db.query('select iniciar_sesion()');
    await db.query(
      `update sesiones set inicio = now() - $2::interval, ultima_actividad = now() - $2::interval where user_id = $1`,
      [u, hace]
    );
    const id = (await db.query('select id from sesiones where user_id = $1', [u])).rows[0].id;
    return { u, id };
  };
  const marcar = (id, cuando) => db.query(`select marcar_actividad($1, now() + $2::interval)`, [id, cuando]);
  const sesion = async (id) =>
    (await db.query(
      `select estado, cerro_sola,
              round(extract(epoch from (now() - fin)) / 60)::int as fin_hace,
              round(extract(epoch from (fin - inicio)) / 60)::int as duro
         from sesiones where id = $1`,
      [id]
    )).rows[0];
  const miSesion = async () => (await db.query('select mi_sesion() as v')).rows[0].v;

  // ---- media hora quieta: se cierra en la ultima actividad ----
  {
    const { u, id } = await arrancar('90 minutes');
    await marcar(id, '-40 minutes');
    const r = await miSesion();
    chequear('pasada la media hora ya no corre', r.corriendo, false);
    const s = await sesion(id);
    chequear('terminada, fechada en la ultima actividad', [s.estado, s.cerro_sola, s.fin_hace, s.duro], ['terminada', true, 40, 50]);
    chequear('y lo avisa una vez', [r.cerrada_sola?.id === id, r.cerrada_sola?.estado], [true, 'terminada']);
    chequear('el dia no se toca', (await perfil(u)).racha_actual, 1);
  }

  // ---- adentro de la media hora, sigue ----
  {
    const { id } = await arrancar('60 minutes');
    await marcar(id, '-20 minutes');
    chequear('con actividad hace 20 minutos sigue corriendo', (await miSesion()).corriendo, true);
  }

  // ---- EL DESCANSO CORRIENDO CUENTA ----
  //
  // El telefono marca hasta cuando dura el descanso. Ultima serie hace 35
  // minutos, pero un descanso que termina en dos: esta entrenando.
  {
    const { id } = await arrancar('60 minutes');
    await marcar(id, '-35 minutes');
    await marcar(id, '2 minutes');
    chequear('un descanso corriendo la mantiene viva', (await miSesion()).corriendo, true);
    // Y el telefono no puede fabricar actividad a futuro: se acota a 15 minutos.
    await marcar(id, '5 hours');
    const t = (await db.query(`select round(extract(epoch from (ultima_actividad - now())) / 60)::int m from sesiones where id = $1`, [id])).rows[0].m;
    chequear('la actividad a futuro se acota', t, 15);
  }

  // ---- TOCAR TERMINAR TARDE no suma el tiempo muerto ----
  {
    const { id } = await arrancar('90 minutes');
    await marcar(id, '-50 minutes');
    // Sin que nadie haya leido la sesion: el cierre lo decide terminar.
    const r = (await db.query('select terminar_sesion() as v')).rows[0].v;
    chequear('terminar tarde cierra en la ultima actividad', Math.round(r.segundos / 60), 40);
  }

  // ---- el toque accidental ya no se lleva un dia con series ----
  {
    const { u, id } = await arrancar('4 minutes');
    await db.query('select fijar_series($1, 3)', [id]);
    await marcar(id, '-1 minutes');
    const r = (await db.query('select terminar_sesion() as v')).rows[0].v;
    chequear('tres series en cuatro minutos no borran el dia', [r.deshizo_el_dia, (await perfil(u)).racha_actual], [false, 1]);
  }

  // ---- el cierre automatico nunca borra el dia ----
  {
    const { u, id } = await arrancar('40 minutes');
    await marcar(id, '-38 minutes'); // dos minutos de actividad
    await miSesion();
    chequear('una sesion corta cerrada sola deja el dia', [(await sesion(id)).estado, (await perfil(u)).racha_actual], ['terminada', 1]);
  }

  // ---- SIN NINGUNA ACTIVIDAD: la media hora no aplica ----
  //
  // La persona usa el cronometro y no el contador. Cerrarla en el inicio le
  // daria duracion cero, y si arranco sola al llegar al gimnasio le borraria
  // el dia. Esas siguen hasta el tope.
  {
    const { id } = await arrancar('50 minutes');
    chequear('sin actividad, a los 50 minutos sigue corriendo', (await miSesion()).corriendo, true);
  }

  // ---- LA COLA SIN SENAL LLEGA TARDE ----
  {
    const { id } = await arrancar('100 minutes');
    await marcar(id, '-70 minutes');
    await miSesion(); // se cierra con lo que sabe: fin hace 70
    chequear('se cerro con datos viejos', (await sesion(id)).fin_hace, 70);
    // Suben toques que pasaron adentro de la media hora siguiente: el cierre
    // estaba mal y se corre.
    await marcar(id, '-55 minutes');
    chequear('un toque tardio adentro de la ventana corre el fin', (await sesion(id)).fin_hace, 55);
    // Uno que paso mucho despues es otra cosa: la persona volvio. No se mete
    // ese rato en la duracion.
    await marcar(id, '-2 minutes');
    chequear('uno de cuando volvio no estira la sesion', (await sesion(id)).fin_hace, 55);
  }
}

console.log('\n79. La base dice que version es');
{
  // EL BUG: la interfaz del peso se mostro antes de la migracion 36, y la
  // funcion vieja tiraba los pesos sin dar error. La interfaz ahora pregunta la
  // version; esto garantiza que la respuesta sea verdad: la ultima migracion
  // tiene que reescribir `version_del_esquema` con SU numero.
  const { readdirSync: leerDir, readFileSync: leerArch } = await import('node:fs');
  const DIR = dirname(fileURLToPath(import.meta.url));
  const numeros = leerDir(DIR)
    .map((n) => /^migracion-(\d+)/.exec(n))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  const ultima = Math.max(...numeros);
  const v = (await db.query('select version_del_esquema() as v')).rows[0].v;
  chequear('la version es la de la ultima migracion', v, ultima);
  const archivo = leerDir(DIR).find((n) => n.startsWith(`migracion-${ultima}`));
  const texto = leerArch(join(DIR, archivo), 'utf8');
  chequear(
    'y la ultima migracion la escribe',
    new RegExp(`function public\\.version_del_esquema\\(\\)[\\s\\S]*?select ${ultima};`).test(texto),
    true
  );
}
console.log('\n80. El telefono aplica la misma regla de cierre que la base');
{
  // Sin senal, el telefono decide solo si la sesion ya se cerro. Si su regla
  // y la de la base se separan, la pantalla muestra corriendo algo que la base
  // cerro, o al reves. Se corren los dos contra los mismos casos.
  const { cierreSolo, masReciente } = await import('../nucleo/sesiones.ts');
  const casos = [
    // [inicio hace (min), ultima actividad hace (min) o null, se espera]
    [90, 40, 'terminada'],
    [60, 20, null],
    [60, 31, 'terminada'],
    [60, 29, null],
    [50, null, null], // sin actividad: todavia no
    [121, null, 'abandonada'],
    [121, 121, 'abandonada'], // actividad igual al inicio es "sin actividad"
    [130, 5, null], // sesion larga pero activa: sigue
  ];
  const difieren = [];
  for (const [inicioHace, ultimaHace, espera] of casos) {
    const u = await nuevoUsuario();
    await comoUsuario(u);
    await db.query('select iniciar_sesion()');
    await db.query(
      `update sesiones set inicio = now() - $2::interval, ultima_actividad = now() - $3::interval where user_id = $1`,
      [u, `${inicioHace} minutes`, `${ultimaHace ?? inicioHace} minutes`]
    );
    const fila = (await db.query('select inicio, ultima_actividad, now() as ahora from sesiones where user_id = $1', [u])).rows[0];
    const cliente = cierreSolo(
      { inicio: fila.inicio.toISOString(), ultimaActividad: ultimaHace === null ? null : fila.ultima_actividad.toISOString() },
      fila.ahora.getTime()
    );
    await db.query('select mi_sesion()');
    const base = (await db.query('select estado from sesiones where user_id = $1', [u])).rows[0].estado;
    const baseCerro = base === 'corriendo' ? null : base;
    if ((cliente?.estado ?? null) !== espera || baseCerro !== espera) {
      difieren.push(`${inicioHace}/${ultimaHace}: cliente ${cliente?.estado ?? null}, base ${baseCerro}, esperado ${espera}`);
    }
  }
  chequear(`los ${casos.length} casos dan lo mismo en el telefono y en la base`, difieren, []);

  // La fecha del cierre, tambien igual: la ultima actividad.
  {
    const inicio = new Date(Date.now() - 90 * 60000).toISOString();
    const ultima = new Date(Date.now() - 40 * 60000).toISOString();
    chequear('el telefono lo fecha en la ultima actividad', cierreSolo({ inicio, ultimaActividad: ultima }, Date.now()).fin, ultima);
  }

  // La actividad nunca retrocede: un toque que sube tarde no la hace mas vieja.
  chequear('la mas reciente gana', masReciente('2026-09-14T10:00:00Z', '2026-09-14T09:00:00Z'), '2026-09-14T10:00:00Z');
  chequear('sin una, la otra', masReciente(null, '2026-09-14T09:00:00Z'), '2026-09-14T09:00:00Z');
  chequear('basura no gana', masReciente('2026-09-14T09:00:00Z', 'x'), '2026-09-14T09:00:00Z');
}

console.log('\n81. Lo que depende de una migracion pregunta si esta');
{
  // EL BUG: el campo de peso se mostro sin la migracion 36 y los pesos se
  // tiraban sin error. La regla nueva: una pantalla que llama a una funcion de
  // la base creada en la migracion 35 o despues tiene que preguntar
  // `disponible(...)` antes. Se lee de donde nacio cada funcion —las
  // migraciones— y de donde se llama.
  //
  // LO QUE ESTE TEST NO VE, y hay que decirlo: una dependencia que no es una
  // funcion nueva. El bug del peso fue exactamente eso —una llave nueva en una
  // funcion vieja— y ahi solo protege `REQUIERE` en `nucleo/esquema.ts`.
  const { readdirSync: leerDir, readFileSync: leerArch, statSync: estado } = await import('node:fs');
  const { disponible, REQUIERE } = await import('../nucleo/esquema.ts');
  const SUPA = dirname(fileURLToPath(import.meta.url));
  const RAIZ = join(SUPA, '..');

  // Donde nace cada funcion.
  const nacio = new Map();
  for (const n of leerDir(SUPA).filter((x) => /^migracion-\d+/.test(x)).sort()) {
    const num = Number(/^migracion-(\d+)/.exec(n)[1]);
    for (const m of leerArch(join(SUPA, n), 'utf8').matchAll(/function public\.([a-z_0-9]+)\(/g)) {
      if (!nacio.has(m[1])) nacio.set(m[1], num);
    }
  }

  const archivos = [];
  const recorrer = (d) => {
    for (const n of leerDir(d)) {
      if (n === 'node_modules') continue;
      const r = join(d, n);
      if (estado(r).isDirectory()) recorrer(r);
      else if (/\.tsx?$/.test(n)) archivos.push(r);
    }
  };
  recorrer(join(RAIZ, 'src'));
  recorrer(join(RAIZ, 'compartido'));

  // Los que no aplican: la ruta del cron (la llama el servidor, no una
  // pantalla), el propio detector de version, y la cola, que tiene la LISTA de
  // lo que se puede encolar: la pregunta va donde se encola (`usarSesion`).
  const exentos = [/src[\\/]app[\\/]api[\\/]/, /compartido[\\/]esquema\.ts$/, /compartido[\\/]cola\.ts$/];
  const sinPreguntar = [];
  let revisadas = 0;
  for (const a of archivos) {
    if (exentos.some((x) => x.test(a))) continue;
    const lineas = sinComentarios(leerArch(a, 'utf8')).split('\n');
    lineas.forEach((l, i) => {
      for (const m of l.matchAll(/rpc(?:\(\s*|:\s*)'([a-z_0-9]+)'/g)) {
        const num = nacio.get(m[1]);
        if (num === undefined || num < 35) continue;
        revisadas++;
        // La pregunta tiene que estar CERCA de la llamada: veinte lineas antes.
        const antes = lineas.slice(Math.max(0, i - 20), i + 1).join('\n');
        if (!antes.includes('disponible(')) {
          sinPreguntar.push(`${a.slice(RAIZ.length + 1)}:${i + 1} llama a ${m[1]} (migracion ${num})`);
        }
      }
    });
  }
  chequear(`las ${revisadas} llamadas a funciones nuevas preguntan si estan`, sinPreguntar, []);
  chequear('y encontro llamadas para revisar', revisadas >= 3, true);

  // La regla de `disponible`: sin saber, no.
  chequear('sin saber la version, no se muestra', disponible('pesoPorSerie', null), false);
  chequear('con la version justa, si', disponible('pesoPorSerie', REQUIERE.pesoPorSerie), true);
  chequear('con una anterior, no', disponible('pesoPorSerie', REQUIERE.pesoPorSerie - 1), false);
}
console.log('\n82. Que significa el numero del peso: la base');
{
  const ordenar = (x) =>
    Array.isArray(x)
      ? x.map(ordenar)
      : x && typeof x === 'object'
        ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, ordenar(x[k])]))
        : x;
  const u = await nuevoUsuario();
  await comoUsuario(u);
  const s = (await db.query('select iniciar_sesion() as v')).rows[0].v;
  const id = s.id ?? (await db.query('select id from sesiones where user_id = $1 order by inicio desc limit 1', [u])).rows[0].id;
  await db.query('select fijar_series($1, 20)', [id]);
  const fijar = async (bloques) =>
    ordenar((await db.query('select fijar_bloques($1, $2::jsonb) as v', [id, JSON.stringify(bloques)])).rows[0].v.bloques);
  const catalogo = async (e) => (await db.query('select carga, carga_ambigua from ejercicios where id = $1', [e])).rows[0];

  // ---- el catalogo ----
  chequear('la barra es total', (await catalogo('sentadilla')).carga, 'total');
  chequear('las mancuernas son par', (await catalogo('press_mancuernas')).carga, 'par');
  chequear('la goblet es una', (await catalogo('sentadilla_goblet')).carga, 'una');
  chequear('las dominadas con lastre son lastre', (await catalogo('dominadas_lastradas')).carga, 'lastre');
  chequear('las zancadas son par y se preguntan', await catalogo('zancadas'), { carga: 'par', carga_ambigua: true });
  chequear('el remo al menton es barra y se pregunta', await catalogo('remo_menton'), { carga: 'total', carga_ambigua: true });
  let rechazo = null;
  try {
    await db.query("update ejercicios set carga = 'discos' where id = 'sentadilla'");
    rechazo = false;
  } catch (e) {
    rechazo = /ejercicios_carga_valida/.test(e.message);
  }
  chequear('un modo que no existe no entra al catalogo', rechazo, true);

  // ---- LA REGLA 4, del lado de la base: sin pesos, ni una llave nueva ----
  chequear('sin pesos no hay carga', await fijar([{ ejercicio: 'zancadas', series: 3 }]), [{ ejercicio: 'zancadas', series: 3 }]);

  // ---- con pesos, el bloque guarda su modo ----
  chequear(
    'el modo que manda el telefono se guarda',
    (await fijar([{ ejercicio: 'zancadas', series: 2, pesos: [60, 60], carga: 'total' }]))[0].carga,
    'total'
  );
  chequear(
    'sin modo, el del catalogo',
    (await fijar([{ ejercicio: 'zancadas', series: 2, pesos: [20, 20] }]))[0].carga,
    'par'
  );
  chequear(
    'basura, el del catalogo',
    (await fijar([{ ejercicio: 'sentadilla_goblet', series: 1, pesos: [30], carga: 'discos' }]))[0].carga,
    'una'
  );
  chequear(
    'pesos que se limpian a nada no dejan modo',
    await fijar([{ ejercicio: 'zancadas', series: 2, pesos: [null, 0], carga: 'par' }]),
    [{ ejercicio: 'zancadas', series: 2 }]
  );

  // ---- EL PUNTO 6: reclasificar el catalogo NO reescribe la historia ----
  {
    await fijar([{ ejercicio: 'sentadilla_goblet', series: 2, pesos: [30, 30] }]);
    await db.query("update ejercicios set carga = 'par' where id = 'sentadilla_goblet'");
    const guardado = (await db.query('select bloques from sesiones where id = $1', [id])).rows[0].bloques;
    chequear('la goblet de ayer sigue siendo una aunque el catalogo cambie', guardado[0].carga, 'una');
    const { resumenDelDia } = await import('../nucleo/resumenDia.ts');
    const r = resumenDelDia({
      log: { es_descanso: false },
      sesiones: [{ inicio: '2026-09-10T10:00:00Z', fin: null, estado: 'abandonada', series: 2, bloques: guardado }],
      catalogo: new Map([['sentadilla_goblet', 'Sentadilla goblet']]),
      esFuturo: false,
      esDescansoConfigurado: false,
      ejercicioSinNombre: '?',
    });
    chequear('y el resumen la lee del bloque, no del catalogo', r.ejercicios[0].cargas, ['una', 'una']);
    await db.query("update ejercicios set carga = 'una' where id = 'sentadilla_goblet'");
  }

  // ---- con que lo haces, recordado, y con cuanto arranca ----
  {
    const arranca = async (e) => (await db.query('select como_arranca($1) as v', [e])).rows[0].v;
    const antes = await arranca('curl_martillo_no_existe');
    chequear('un ejercicio que no existe no devuelve nada', antes, null);

    await fijar([
      { ejercicio: 'zancadas', series: 2, pesos: [60, 60], carga: 'total' },
      { ejercicio: 'zancadas', series: 2, pesos: [20, 22], carga: 'par' },
    ]);
    const sinElegir = await arranca('zancadas');
    chequear('sin elegir: el del catalogo, y hay que preguntar', [sinElegir.carga, sinElegir.elegida, sinElegir.ambigua], ['par', false, true]);
    chequear('el peso propuesto es el ultimo EN ESE MODO', Number(sinElegir.peso), 22);

    await db.query("select elegir_carga('zancadas', 'total')");
    const conBarra = await arranca('zancadas');
    chequear('elegida: se recuerda', [conBarra.carga, conBarra.elegida], ['total', true]);
    chequear('y el peso es el de la barra, no el de las mancuernas', Number(conBarra.peso), 60);

    await db.query("select elegir_carga('zancadas', 'total')");
    chequear(
      'elegir lo mismo dos veces deja una fila',
      (await db.query('select count(*)::int n from cargas_elegidas where user_id = $1', [u])).rows[0].n,
      1
    );
    await db.query("select elegir_carga('zancadas', 'discos')");
    await db.query("select elegir_carga('no_existe', 'par')");
    chequear('basura no cambia nada', (await arranca('zancadas')).carga, 'total');

    // ES DE ESTA PERSONA
    const otro = await nuevoUsuario();
    await comoUsuario(otro);
    const delOtro = await arranca('zancadas');
    chequear('otro no hereda la eleccion ni los pesos', [delOtro.carga, delOtro.elegida, delOtro.peso], ['par', false, null]);
    await db.exec('set role authenticated');
    chequear('y no la puede leer', (await db.query('select count(*)::int n from cargas_elegidas')).rows[0].n, 0);
    await db.exec('reset role');
    await comoUsuario(u);
  }
  {
    await db.exec('set role anon');
    let bloqueada = null;
    try {
      await db.query("select elegir_carga('zancadas', 'par')");
      bloqueada = false;
    } catch (e) {
      bloqueada = /permission denied/i.test(e.message);
    }
    await db.exec('reset role');
    chequear('sin sesion no se elige nada', bloqueada, true);
  }

  // ---- LOS BLOQUES DE ANTES DE LA 38 ----
  //
  // Se corre el `update` de la migracion tal cual, sobre un bloque escrito
  // como lo dejaba la 36: con pesos y sin modo.
  {
    const mig = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'migracion-38-carga-del-peso.sql'), 'utf8');
    const i = mig.indexOf('update public.sesiones s');
    const relleno = mig.slice(i, mig.indexOf(';', mig.indexOf('   );', i)) + 1);
    const viejos = [
      { ejercicio: 'curl_mancuernas', series: 2, pesos: [12, 12] },
      { ejercicio: 'sentadilla', series: 1 },
      { ejercicio: 'zancadas', series: 1, pesos: [20], carga: 'total' },
    ];
    await db.query('update sesiones set bloques = $2::jsonb where id = $1', [id, JSON.stringify(viejos)]);
    await db.query(relleno);
    const b = (await db.query('select bloques from sesiones where id = $1', [id])).rows[0].bloques;
    chequear('al de pesos sin modo se le pone el del catalogo', b[0].carga, 'par');
    chequear('al que no tiene pesos no se le pone nada', 'carga' in b[1], false);
    chequear('al que ya tenia modo no se lo toca', b[2].carga, 'total');
    await db.query(relleno);
    chequear('correrlo dos veces no cambia nada', (await db.query('select bloques from sesiones where id = $1', [id])).rows[0].bloques, b);
  }

  // ---- borrar la cuenta se lleva lo elegido ----
  {
    await db.query("select elegir_carga('zancadas', 'una')");
    await db.exec('set role authenticated');
    await db.query('select eliminar_cuenta()');
    await db.exec('reset role');
    chequear('no quedan cargas elegidas', (await db.query('select count(*)::int n from cargas_elegidas where user_id = $1', [u])).rows[0].n, 0);
  }
}

console.log('\n83. Que significa el numero del peso: el telefono');
{
  const C = await import('../nucleo/carga.ts');
  const B = await import('../nucleo/bloques.ts');

  chequear('par multiplica por dos', C.kilosMovidos(30, 'par'), 60);
  chequear('una, total y lastre no', ['una', 'total', 'lastre'].map((c) => C.kilosMovidos(30, c)), [30, 30, 30]);
  chequear('la linea del total, solo en par', C.CARGAS.filter(C.muestraTotal), ['par']);
  chequear('el elegido gana al catalogo', C.cargaVigente('total', 'par'), 'total');
  chequear('sin elegir, el catalogo', C.cargaVigente(undefined, 'una'), 'una');
  chequear('sin catalogo (base sin la 38), total', C.cargaVigente(undefined, undefined), 'total');
  chequear('las poleas dicen de cada lado', [C.claveDeEtiqueta('par', 'cruce_polea_alta'), C.claveDeEtiqueta('par', 'zancadas')], ['parPolea', 'par']);

  // LA PREGUNTA
  const q = (ambigua, cargaDelBloque, yaSeConsulto) => C.hayQuePreguntar({ ambigua, cargaDelBloque, yaSeConsulto });
  chequear('se pregunta el ambiguo sin modo, ya consultado', q(true, undefined, true), true);
  chequear('no antes de que conteste la base', q(true, undefined, false), false);
  chequear('no si ya se sabe', q(true, 'par', true), false);
  chequear('no si el nombre lo dice', q(false, undefined, true), false);

  // EL BLOQUE
  let e = B.cambiarPeso(B.bloquesVacios('zancadas'), 20);
  e = B.cambiarCarga(e, 'par');
  e = B.sumar(B.sumar(e));
  chequear('el modo va con los pesos al guardar', B.paraGuardar(e), [{ ejercicio: 'zancadas', series: 2, pesos: [20, 20], carga: 'par' }]);
  const s = B.siguiente(e);
  chequear('cerrar se lleva el modo, y el siguiente lo mantiene', [s.cerrados[0].carga, s.carga], ['par', 'par']);
  chequear('cambiar de ejercicio no arrastra el modo', 'carga' in B.cambiarEjercicio(e, 'press_banca'), false);
  chequear('basura no cambia el modo', B.cambiarCarga(e, 'discos'), e);

  // Sin pesos: ni una llave en lo que se guarda.
  {
    let sinPesos = B.cambiarCarga(B.bloquesVacios('zancadas'), 'total');
    sinPesos = B.siguiente(B.sumar(sinPesos));
    chequear('sin pesos, el bloque cerrado no lleva modo', 'carga' in sinPesos.cerrados[0], false);
    chequear('ni lo que se guarda', JSON.stringify(B.paraGuardar(sinPesos)).includes('carga'), false);
  }

  // Me equivoque de ejercicio: el modo que se veia queda fijo.
  {
    const conPesos = B.sumar(B.cambiarPeso(B.bloquesVacios('zancadas'), 30));
    chequear('mudar fija el modo que se veia', B.mudarEjercicio(conPesos, 'sentadilla', 'par').carga, 'par');
    chequear('y si ya habia uno elegido, ese', B.mudarEjercicio(B.cambiarCarga(conPesos, 'una'), 'sentadilla', 'par').carga, 'una');
  }

  // Corregir el modo de un bloque cerrado.
  {
    const cerrado = B.siguiente(B.sumar(B.cambiarPeso(B.bloquesVacios('zancadas'), 20)));
    const corregido = B.corregirCarga(cerrado, 0, 'total');
    chequear('se corrige el modo de un bloque cerrado', corregido.cerrados[0].carga, 'total');
    chequear('y sobrevive a corregir un peso', B.corregirPeso(corregido, 0, 0, 25).cerrados[0], { ejercicio: 'zancadas', series: 1, pesos: [25], carga: 'total' });
    chequear('borrar todos los pesos se lleva el modo', 'carga' in B.corregirPeso(corregido, 0, 0, null).cerrados[0], false);
    const sinPesos = B.siguiente(B.sumar(B.bloquesVacios('zancadas')));
    chequear('un bloque sin pesos no tiene modo que corregir', B.corregirCarga(sinPesos, 0, 'total'), sinPesos);
  }

  // EL RESUMEN, agrupado por modo
  chequear(
    'dos formas el mismo dia, dos grupos',
    C.gruposDePesos([60, 60, 20, null], ['total', 'total', 'par', 'par']),
    [{ carga: 'total', pesos: [60, 60] }, { carga: 'par', pesos: [20, null] }]
  );
  chequear('sin modos (antes de la 38), total', C.gruposDePesos([50], undefined), [{ carga: 'total', pesos: [50] }]);
}

console.log('\n84. El catalogo y el telefono dicen lo mismo del modo');
{
  const C = await import('../nucleo/carga.ts');
  const filas = (await db.query('select id, carga, carga_ambigua, admite_peso from ejercicios')).rows;
  const por = new Map(filas.map((f) => [f.id, f]));
  // Las poleas dobles tienen que existir y ser par: si no, la etiqueta
  // "de cada lado" apunta a un ejercicio que no la usa.
  chequear('las poleas dobles existen y son par', C.PAR_EN_POLEA.map((id) => por.get(id)?.carga), C.PAR_EN_POLEA.map(() => 'par'));
  // La pregunta ofrece tres respuestas. Un ambiguo cuyo modo por omision no
  // esta entre ellas mostraria una etiqueta que no se puede contestar.
  chequear(
    'el modo de cada ambiguo se puede contestar en la pregunta',
    filas.filter((f) => f.carga_ambigua && !C.OPCIONES_DE_LA_PREGUNTA.includes(f.carga)).map((f) => f.id),
    []
  );
  chequear('no se pregunta por un ejercicio sin peso', filas.filter((f) => f.carga_ambigua && !f.admite_peso).map((f) => f.id), []);
  chequear('los cuatro modos estan en uso', [...new Set(filas.map((f) => f.carga))].sort(), ['lastre', 'par', 'total', 'una']);
  chequear('los del telefono son los de la base', [...C.CARGAS].sort(), ['lastre', 'par', 'total', 'una']);
}
console.log('\n85. Los pesos de antes de los modos: marcados y revisables');
{
  const mig = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'migracion-39-revisar-cargas-viejas.sql'), 'utf8').replace(/\r\n/g, '\n');
  const i = mig.indexOf('update public.sesiones s');
  const marcar = mig.slice(i, mig.indexOf('   );', i) + 5);

  const u = await nuevoUsuario();
  await comoUsuario(u);
  const s = (await db.query('select iniciar_sesion() as v')).rows[0].v;
  const id = s.id ?? (await db.query('select id from sesiones where user_id = $1 order by inicio desc limit 1', [u])).rows[0].id;
  const bloques = async (sid = id) => (await db.query('select bloques from sesiones where id = $1', [sid])).rows[0].bloques;
  const poner = async (b, inicio, sid = id) =>
    db.query('update sesiones set bloques = $2::jsonb, inicio = $3::timestamptz where id = $1', [sid, JSON.stringify(b), inicio]);

  const viejos = [
    { ejercicio: 'curl_mancuernas', series: 2, pesos: [24, 24], carga: 'par' }, // el riesgo del doble
    { ejercicio: 'sentadilla', series: 3, pesos: [100, 100, 100], carga: 'total' }, // barra: no hay duda
    { ejercicio: 'peso_muerto_rumano', series: 1, pesos: [40], carga: 'total' }, // ambiguo
    { ejercicio: 'press_mancuernas', series: 2 }, // sin pesos: nada que revisar
  ];
  await poner(viejos, '2026-09-14T18:00:00-03');
  await db.query(marcar);
  let b = await bloques();
  chequear(
    'se marcan el par y el ambiguo, no la barra ni el que no tiene pesos',
    b.map((x) => x.carga_supuesta === true),
    [true, false, true, false]
  );
  chequear('no cambia ningun peso ni ningun modo', b.map((x) => [x.pesos ?? null, x.carga ?? null]), viejos.map((x) => [x.pesos ?? null, x.carga ?? null]));
  await db.query(marcar);
  chequear('correrlo dos veces no cambia nada', await bloques(), b);

  // EL CORTE: despues del 15 de septiembre en Uruguay no se marca.
  {
    await poner([{ ejercicio: 'curl_mancuernas', series: 1, pesos: [24], carga: 'par' }], '2026-09-16T08:00:00-03');
    await db.query(marcar);
    chequear('una sesion del 16 no se marca', (await bloques())[0].carga_supuesta, undefined);
    await poner([{ ejercicio: 'curl_mancuernas', series: 1, pesos: [24], carga: 'par' }], '2026-09-15T23:30:00-03');
    await db.query(marcar);
    // Del 15 a la noche SI, salvo que "ahora" sea antes: el corte nunca pasa de now().
    const seMarca = Date.parse('2026-09-15T23:30:00-03:00') < Math.min(Date.now(), Date.parse('2026-09-16T00:00:00-03:00'));
    chequear('una del 15 a la noche, si ya paso', (await bloques())[0].carga_supuesta === true, seMarca);
    await poner(viejos, '2026-09-14T18:00:00-03');
    await db.query(marcar);
    b = await bloques();
  }

  const revisar = async (orden, carga) =>
    (await db.query('select revisar_carga($1, $2, $3) as v', [id, orden, carga])).rows[0].v;

  // ANOTE LA SUMA: se pasa a total, el numero no se toca.
  let r = await revisar(1, 'total');
  chequear('revisar cambia el modo y saca la marca', [r[0].carga, 'carga_supuesta' in r[0], r[0].pesos], ['total', false, [24, 24]]);
  // ESTABA BIEN: el mismo modo que tenia.
  r = await revisar(3, 'total');
  chequear('elegir el mismo modo saca la marca', [r[2].carga, 'carga_supuesta' in r[2]], ['total', false]);
  // No es una puerta para reescribir cualquier bloque.
  r = await revisar(2, 'par');
  chequear('un bloque sin marca no se toca', r[1].carga, 'total');
  chequear('basura no hace nada', await revisar(1, 'discos'), null);
  r = await revisar(99, 'par');
  chequear('un orden que no existe no rompe nada', r, null);

  // ES DE ESTA PERSONA
  {
    await poner(viejos, '2026-09-14T18:00:00-03');
    await db.query(marcar);
    const otro = await nuevoUsuario();
    await comoUsuario(otro);
    chequear('otro no revisa mis bloques', await revisar(1, 'total'), null);
    await comoUsuario(u);
    chequear('y siguen marcados', (await bloques())[0].carga_supuesta, true);
  }
  {
    await db.exec('set role anon');
    let bloqueada = null;
    try {
      await db.query('select revisar_carga($1, 1, $2)', [id, 'total']);
      bloqueada = false;
    } catch (e) {
      bloqueada = /permission denied/i.test(e.message);
    }
    await db.exec('reset role');
    chequear('sin sesion no se revisa nada', bloqueada, true);
  }

  // EL TELEFONO LEE LA MARCA, y el resumen del dia la ofrece por bloque.
  {
    const { resumenDelDia } = await import('../nucleo/resumenDia.ts');
    const res = resumenDelDia({
      log: { es_descanso: false },
      sesiones: [{ id, inicio: '2026-09-14T18:00:00Z', fin: null, estado: 'abandonada', series: 8, bloques: await bloques() }],
      catalogo: new Map([['curl_mancuernas', 'Curl con mancuernas'], ['sentadilla', 'Sentadilla'], ['peso_muerto_rumano', 'Peso muerto rumano']]),
      esFuturo: false,
      esDescansoConfigurado: false,
      ejercicioSinNombre: '?',
    });
    chequear('el resumen ofrece revisar los dos marcados, con su orden', res.porRevisar.map((x) => [x.ejercicio, x.orden]), [['curl_mancuernas', 1], ['peso_muerto_rumano', 3]]);
    const sinId = resumenDelDia({
      log: { es_descanso: false },
      sesiones: [{ inicio: '2026-09-14T18:00:00Z', fin: null, estado: 'abandonada', series: 8, bloques: await bloques() }],
      catalogo: new Map(),
      esFuturo: false,
      esDescansoConfigurado: false,
      ejercicioSinNombre: '?',
    });
    chequear('sin id de sesion no se ofrece revisar', sinId.porRevisar, []);
  }
}

console.log('\n86. El volumen');
{
  const V = await import('../nucleo/volumen.ts');
  const catalogo = new Map([
    ['sentadilla', { nombre: 'Sentadilla', grupo: 'piernas' }],
    ['zancadas', { nombre: 'Zancadas', grupo: 'piernas' }],
    ['press_banca', { nombre: 'Press de banca', grupo: 'pecho' }],
    ['press_mancuernas', { nombre: 'Press con mancuernas', grupo: 'pecho' }],
    ['dominadas_lastradas', { nombre: 'Dominadas con lastre', grupo: 'espalda' }],
    ['sentadilla_goblet', { nombre: 'Sentadilla goblet', grupo: 'piernas' }],
  ]);

  // LOS KILOS SON LOS QUE SE MOVIERON, con el modo del bloque.
  chequear('par: 30 por mancuerna son 60 por serie', V.kilosDelBloque({ pesos: [30, 30], carga: 'par' }), 120);
  chequear('una: la goblet de 30 son 30', V.kilosDelBloque({ pesos: [30, null], carga: 'una' }), 30);
  chequear('lastre: sin peso corporal', V.kilosDelBloque({ pesos: [20, 20, 20], carga: 'lastre' }), 60);
  chequear('las series sin peso no suman kilos', V.kilosDelBloque({ pesos: [null, null], carga: 'total' }), 0);

  // POR MUSCULO, en el orden de la interfaz, y las series cuentan sin peso.
  {
    const bloques = V.leerBloques([
      { ejercicio: 'sentadilla', series: 3, pesos: [100, 100, 100], carga: 'total' },
      { ejercicio: 'press_mancuernas', series: 2, pesos: [30, 30], carga: 'par' },
      { ejercicio: 'zancadas', series: 2 },
      { ejercicio: 'ya_no_existe', series: 5, pesos: [50, 50, 50, 50, 50] },
    ]);
    chequear(
      'volumen por musculo de un dia',
      V.volumenPorGrupo(bloques, catalogo),
      [
        { grupo: 'pecho', kilos: 120, series: 2 },
        { grupo: 'piernas', kilos: 300, series: 5 },
      ]
    );
  }

  // RECLASIFICAR EL CATALOGO NO CAMBIA EL VOLUMEN: el modo es del bloque.
  {
    const sesion = [{ fecha: '2026-09-10', bloques: [{ ejercicio: 'sentadilla_goblet', series: 2, pesos: [30, 30], carga: 'una' }] }];
    const antes = V.volumenPorSemana(sesion, catalogo, { hoy: '2026-09-15', semanas: 2 });
    chequear('la goblet de la semana pasada son 60', antes.map((s) => s.kilos), [60, 0]);
    // El catalogo no se lee para los kilos: el mismo bloque da lo mismo.
    chequear('el volumen no lee el modo del catalogo', V.volumenPorSemana(sesion, new Map([['sentadilla_goblet', { nombre: 'x', grupo: 'piernas' }]]), { hoy: '2026-09-15', semanas: 2 }), antes);
  }

  // LAS SEMANAS: de lunes a domingo, la vieja primero, las vacias en su lugar.
  {
    chequear('el lunes de un martes', V.lunesDe('2026-09-15'), '2026-09-14');
    chequear('el lunes de un domingo es el de antes', V.lunesDe('2026-09-20'), '2026-09-14');
    chequear('el lunes de un lunes', V.lunesDe('2026-09-14'), '2026-09-14');
    const sesiones = [
      { fecha: '2026-09-14', bloques: [{ ejercicio: 'press_banca', series: 3, pesos: [60, 60, 60], carga: 'total' }] },
      { fecha: '2026-09-13', bloques: [{ ejercicio: 'sentadilla', series: 2, pesos: [100, 100], carga: 'total' }] },
      { fecha: '2026-08-31', bloques: [{ ejercicio: 'sentadilla', series: 4 }] },
      { fecha: '2026-06-01', bloques: [{ ejercicio: 'sentadilla', series: 9, pesos: [1, 1, 1, 1, 1, 1, 1, 1, 1] }] }, // fuera
    ];
    const semanas = V.volumenPorSemana(sesiones, catalogo, { hoy: '2026-09-15', semanas: 3 });
    chequear('tres semanas con la vacia en su lugar', semanas, [
      { desde: '2026-08-31', kilos: 0, series: 4 },
      { desde: '2026-09-07', kilos: 200, series: 2 },
      { desde: '2026-09-14', kilos: 180, series: 3 },
    ]);
    chequear(
      'filtrado por musculo',
      V.volumenPorSemana(sesiones, catalogo, { hoy: '2026-09-15', semanas: 3, grupo: 'pecho' }).map((s) => s.series),
      [0, 0, 3]
    );
  }

  // EL MAXIMO se compara por kilos movidos, y la fecha es la PRIMERA vez.
  {
    const sesiones = [
      { fecha: '2026-09-01', bloques: [{ ejercicio: 'zancadas', series: 1, pesos: [60], carga: 'total' }] },
      { fecha: '2026-09-05', bloques: [{ ejercicio: 'zancadas', series: 2, pesos: [30, 32], carga: 'par' }] },
      { fecha: '2026-09-08', bloques: [{ ejercicio: 'zancadas', series: 1, pesos: [32], carga: 'par' }] },
      { fecha: '2026-09-12', bloques: [{ ejercicio: 'zancadas', series: 3 }] },
      { fecha: '2026-09-10', bloques: [{ ejercicio: 'dominadas_lastradas', series: 2, pesos: [20, 25], carga: 'lastre' }] },
    ];
    const m = V.maximosPorEjercicio(sesiones, catalogo);
    chequear('64 por dos mancuernas le gana a 60 con barra, aunque 32 < 60', [m[0].peso, m[0].carga, m[0].kilos], [32, 'par', 64]);
    chequear('la fecha es la primera vez que se llego', m[0].fecha, '2026-09-05');
    chequear('ordenado por lo ultimo que hiciste', m.map((x) => x.ejercicio), ['zancadas', 'dominadas_lastradas']);
    chequear('el lastre se ve como se escribio', [m[1].peso, m[1].kilos], [25, 25]);
  }

  // DONDE NO ESTAS ENTRENANDO
  {
    const sesiones = [
      { fecha: '2026-07-20', bloques: [{ ejercicio: 'sentadilla', series: 3 }] },
      { fecha: '2026-09-10', bloques: [{ ejercicio: 'press_banca', series: 3 }] },
    ];
    chequear(
      'piernas: nada desde julio',
      V.gruposDejados(sesiones, catalogo, { hoy: '2026-09-15', semanas: 6 }),
      [{ grupo: 'piernas', ultima: '2026-07-20', semanas: 8 }]
    );
    chequear(
      'si en esas semanas no se anoto nada, no se dice nada',
      V.gruposDejados([sesiones[0]], catalogo, { hoy: '2026-09-15', semanas: 6 }),
      []
    );
    chequear(
      'con 8 semanas de umbral todavia se dice',
      V.gruposDejados(sesiones, catalogo, { hoy: '2026-09-15', semanas: 8 }).length,
      1
    );
    chequear(
      'con umbral mas largo que la ausencia, nada',
      V.gruposDejados(sesiones, catalogo, { hoy: '2026-09-15', semanas: 9 }),
      []
    );
  }

  // Los grupos del volumen son los del selector.
  {
    const { ZONAS } = await import('../nucleo/ejercicios.ts');
    chequear('el orden de grupos cubre todas las zonas', [...V.ORDEN_GRUPOS].sort(), Object.values(ZONAS).flat().sort());
  }
}
console.log('\n87. Lo que leen igual la web y la app nativa');
{
  const V = await import('../nucleo/volumen.ts');
  // Las filas como las devuelve Supabase con `logs(fecha)` embebido: objeto o lista.
  chequear(
    'las filas de la base pasan a sesiones con dia',
    V.sesionesConFecha([
      { id: 'a', bloques: [], logs: { fecha: '2026-09-14' } },
      { id: 'b', bloques: [], logs: [{ fecha: '2026-09-13' }] },
      { id: 'c', bloques: [], logs: null },
      'basura',
    ]),
    [
      { id: 'a', fecha: '2026-09-14', bloques: [] },
      { id: 'b', fecha: '2026-09-13', bloques: [] },
    ]
  );
  chequear('sin lista, nada', V.sesionesConFecha(null), []);
  const semanas = [
    { desde: '2026-08-31', kilos: 0, series: 2 },
    { desde: '2026-09-07', kilos: 0, series: 0 },
    { desde: '2026-09-14', kilos: 0, series: 0 },
  ];
  chequear('se lee la ultima semana con algo', V.semanaParaLeer(semanas, null), 0);
  chequear('o la tocada', V.semanaParaLeer(semanas, 2), 2);
  chequear('una tocada que no existe no rompe', V.semanaParaLeer(semanas, 9), 0);
  const cat = new Map([['sentadilla', { nombre: 'Sentadilla', grupo: 'piernas' }], ['press_banca', { nombre: 'Press', grupo: 'pecho' }]]);
  const ses = [
    { fecha: '2026-09-01', bloques: [{ ejercicio: 'sentadilla', series: 1 }] },
    { fecha: '2026-09-02', bloques: [{ ejercicio: 'press_banca', series: 1, pesos: [60], carga: 'total', carga_supuesta: true }] },
  ];
  chequear('los filtros en el orden de la interfaz', V.gruposAnotados(ses, cat), ['pecho', 'piernas']);
  chequear('los dias por revisar', [...V.fechasPorRevisar(ses)], ['2026-09-02']);

  // La app nativa no hace sus propias cuentas de volumen: importa las del nucleo.
  const { readFileSync: leer } = await import('node:fs');
  const stats = leer(join(dirname(fileURLToPath(import.meta.url)), '..', 'movil', 'src', 'Stats.tsx'), 'utf8');
  chequear('Stats nativo usa el volumen del nucleo', stats.includes("from '@nucleo/volumen'"), true);
  chequear('y no suma kilos por su cuenta', /kilosMovidos|factorDeCarga|\.pesos[^A-Za-z]/.test(stats), false);
}
console.log('\n88. La cola no pierde lo que se encola mientras manda');
{
  const { quedanTrasPasada } = await import('../nucleo/cola.ts');
  const a = { id: 'fijar_series:s1', args: { p_series: 3 } };
  const b = { id: 'fijar_bloques:s1', args: { p_bloques: [] } };
  const a4 = { id: 'fijar_series:s1', args: { p_series: 4 } };
  const c = { id: 'marcar_actividad:s1', args: { p_hasta: 'x' } };
  chequear('lo mandado sale', quedanTrasPasada([a, b], [a, b]), []);
  chequear('lo que no entro se queda', quedanTrasPasada([a, b], [a]), [b]);
  // EL BUG: se encolo `c` mientras se mandaban `a` y `b`.
  chequear('lo encolado en el medio se queda', quedanTrasPasada([a, b, c], [a, b]), [c]);
  // "Las series son 4" reemplazo a "son 3" mientras se mandaba "son 3".
  chequear('lo que reemplazo a uno mandado se queda', quedanTrasPasada([b, a4], [a, b]), [a4]);
  chequear('se compara por contenido, no por objeto', quedanTrasPasada([JSON.parse(JSON.stringify(a))], [a]), []);
}
console.log('\n89. Ninguna explicacion pasa de dos renglones');
{
  // LA REGLA DEL HUMANO: "si necesita mas de dos lineas, esta mal disenado, no
  // mal explicado". Dos renglones en un telefono son unos 95 caracteres. Un
  // texto mas largo no se arregla aca subiendo el numero: se redisena lo que
  // obliga a explicarlo.
  const { readFileSync: leer } = await import('node:fs');
  const lineas = leer(join(dirname(fileURLToPath(import.meta.url)), '..', 'nucleo', 'textos.ts'), 'utf8').split(/\r?\n/);
  const largos = [];
  lineas.forEach((l, i) => {
    if (/^\s*\/\//.test(l)) return;
    for (const m of l.matchAll(/'([^']*)'|`([^`]*)`/g)) {
      const s = m[1] ?? m[2];
      if (s.length > 95) largos.push(`textos.ts:${i + 1} (${s.length}) ${s.slice(0, 50)}`);
    }
  });
  chequear('ningun texto de mas de dos renglones', largos, []);

  // VIDAS, no impulsos: lo que se ve dice "vidas".
  const { T } = await import('../nucleo/textos.ts');
  const visibles = JSON.stringify(T.impulso, (k, v) => (typeof v === 'function' ? v(2, 3) : v));
  chequear('las vidas se llaman vidas', /[Ii]mpuls/.test(visibles), false);
}

console.log('\n90. El recorrido de la primera vez');
{
  const { PASOS_DEL_RECORRIDO, pasoValido } = await import('../nucleo/recorrido.ts');
  const { existsSync: existe, readFileSync: leer } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  // Cada paso lleva a una pantalla que existe: un paso a una ruta borrada deja
  // a la persona nueva en un 404 en su primer minuto.
  const faltan = PASOS_DEL_RECORRIDO.filter(
    (p) => !existe(join(RAIZ, 'src', 'app', ...p.ruta.split('/').filter(Boolean), 'page.tsx'))
  ).map((p) => p.ruta);
  chequear('cada paso lleva a una pantalla que existe', faltan, []);
  // Lo primero, el gimnasio: es lo que hace distinta a la app.
  chequear('el primer paso es el gimnasio', [PASOS_DEL_RECORRIDO[0].ruta, PASOS_DEL_RECORRIDO[0].ancla], ['/ajustes', 'gimnasio']);
  const gimnasio = leer(join(RAIZ, 'src', 'components', 'ajustes', 'Gimnasio.tsx'), 'utf8');
  chequear('y la seccion a la que apunta existe', gimnasio.includes('id="gimnasio"'), true);
  chequear('una linea por pantalla', PASOS_DEL_RECORRIDO.filter((p) => p.texto.length > 80).map((p) => p.ruta), []);
  chequear('un paso guardado que ya no existe vuelve al principio', [pasoValido(99), pasoValido('x'), pasoValido(2)], [0, 0, 2]);
}

console.log('\n91. Series por musculo: una escala para todas las filas');
{
  const V = await import('../nucleo/volumen.ts');
  const cat = new Map([
    ['sentadilla', { nombre: 'Sentadilla', grupo: 'piernas' }],
    ['plancha', { nombre: 'Plancha', grupo: 'core' }],
    ['press_banca', { nombre: 'Press', grupo: 'pecho' }],
  ]);
  const ses = [
    { fecha: '2026-09-14', bloques: [{ ejercicio: 'sentadilla', series: 30, pesos: [], carga: 'total' }, { ejercicio: 'plancha', series: 3 }] },
    { fecha: '2026-07-01', bloques: [{ ejercicio: 'press_banca', series: 4, pesos: [60, 60, 60, 60], carga: 'total' }] },
  ];
  const r = V.filasPorMusculo(ses, cat, { hoy: '2026-09-15', semanas: 2, umbral: 6 });
  // Los seis siempre (pedido del 15/9): con una sola fila no hay contra que comparar.
  chequear('los seis musculos, aunque esten vacios, en el orden de la interfaz', r.filas.map((f) => f.grupo), V.ORDEN_GRUPOS);
  chequear('y los seis son los de siempre', V.ORDEN_GRUPOS, ['pecho', 'espalda', 'hombros', 'brazos', 'piernas', 'core']);
  chequear('las vacias lo saben', r.filas.filter((f) => f.vacia).map((f) => f.grupo), ['pecho', 'espalda', 'hombros', 'brazos']);
  chequear('el total de la semana suma las filas', r.totales.map((s) => s.series), [0, 33]);
  chequear('se lee la ultima semana con algo, con el total', V.semanaParaLeer(r.totales, null), 1);
  chequear('con algo anotado alguna vez, hay pantalla', r.hayAnotado, true);
  const nada = V.filasPorMusculo([], cat, { hoy: '2026-09-15', semanas: 2, umbral: 6 });
  chequear('sin nada anotado nunca, el vacio se dice aparte', [nada.hayAnotado, nada.filas.length], [false, 6]);
  const { fechaCorta } = await import('../nucleo/fechas.ts');
  chequear('el eje rotula corto', fechaCorta('2026-07-21'), '21/7');
  // Con una escala por fila, 3 de core y 30 de pierna serian barras iguales.
  chequear('el tope es uno solo para todas', [r.topeSeries, r.topeKilos], [30, 0]);
  chequear('la fila dejada lo dice', r.filas.find((f) => f.grupo === 'pecho').dejado?.ultima, '2026-07-01');
  chequear('las que no, no', r.filas.find((f) => f.grupo === 'piernas').dejado, null);
}
console.log('\n92. Lo compartido no es de ninguna de las dos apps');
{
  // `compartido/` (la sesion, la cola, el descanso) lo usan la web y la app
  // nativa. Si un archivo de ahi importa del arbol de la web (`@/...`), la
  // nativa no compila; si importa algo de React Native, la web no compila.
  // Y cada app pone SU plataforma y SU cliente con los alias `@plataforma` y
  // `@cliente`: pedirlos por otro camino es atarse a una de las dos.
  const { readdirSync: leerDir, readFileSync: leerArch } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const DIR = join(RAIZ, 'compartido');
  const permitido = (d) =>
    d.startsWith('@nucleo/') || d.startsWith('@compartido/') || d === '@plataforma' || d === '@cliente' ||
    d === 'react' || d.startsWith('./');
  const colados = [];
  for (const n of leerDir(DIR).filter((x) => /\.tsx?$/.test(x))) {
    const codigo = sinComentarios(leerArch(join(DIR, n), 'utf8'));
    for (const m of codigo.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (!permitido(m[1])) colados.push(`${n} importa ${m[1]}`);
    }
  }
  chequear('compartido/ solo importa del nucleo, de si mismo, de React y de los dos alias', colados, []);

  // La app nativa usa la MISMA sesion, no una copia.
  const inicio = leerArch(join(RAIZ, 'movil', 'src', 'Inicio.tsx'), 'utf8');
  chequear('Inicio nativo usa la sesion compartida', inicio.includes("from '@compartido/usarSesion'"), true);
  chequear("y no llama a iniciar_sesion por su cuenta", /rpc\(\s*'(iniciar|terminar)_sesion'/.test(inicio), false);
  // Los dos lados ponen los alias.
  const tsWeb = leerArch(join(RAIZ, 'tsconfig.json'), 'utf8');
  const tsNativo = leerArch(join(RAIZ, 'movil', 'tsconfig.json'), 'utf8');
  const metro = leerArch(join(RAIZ, 'movil', 'metro.config.js'), 'utf8');
  chequear('la web define @plataforma y @cliente', ['"@plataforma"', '"@cliente"', '"@compartido/*"'].every((a) => tsWeb.includes(a)), true);
  chequear('la nativa tambien', ['"@plataforma"', '"@cliente"', '"@compartido/*"'].every((a) => tsNativo.includes(a)), true);
  chequear('y Metro los encuentra', ["'@plataforma'", "'@cliente'", "'@compartido'"].every((a) => metro.includes(a)), true);
}
console.log('\n93. Dos toques seguidos no le devuelven al total el numero de antes');
{
  // EL BUG (15/9, visto en la app nativa, estaba tambien en la web): cada
  // escritura de la cache avisaba "la sesion cambio", y la MISMA instancia del
  // hook releia la cache. La relectura es asincrona: con dos toques seguidos
  // una lectura vieja terminaba despues de una nueva y el total volvia atras
  // ("2 de 3 · 1 en total"). La regla: la instancia firma sus escrituras y no
  // relee las suyas. No se puede cargar el hook con node, asi que se lee.
  const { readFileSync: leer } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const hook = sinComentarios(leer(join(RAIZ, 'compartido', 'usarSesion.ts'), 'utf8'));
  const cuerpo = hook.slice(hook.indexOf('export function usarSesion('));
  const sinFirma = [];
  for (const m of cuerpo.matchAll(/(guardar|actualizar|borrar)SesionCache\(/g)) {
    // hasta el parentesis que cierra la llamada
    let prof = 1;
    let k = m.index + m[0].length;
    while (prof > 0 && k < cuerpo.length) {
      if (cuerpo[k] === '(') prof++;
      else if (cuerpo[k] === ')') prof--;
      k++;
    }
    const args = cuerpo.slice(m.index + m[0].length, k - 1);
    if (!/(^|,)\s*yo\s*$/.test(args)) sinFirma.push(`${m[1]}SesionCache(${args.slice(0, 40)})`);
  }
  chequear('toda escritura de la cache desde el hook va firmada', sinFirma, []);
  chequear('y el hook no relee las suyas', /escuchar\(AVISO,[^]*?esMio\(dato, yo\)/.test(cuerpo), true);

  // EL RECORRIDO NO ARRANCA SOLO en un aparato nuevo: lo enciende elegir el
  // nombre o "Ver la guia de nuevo".
  const guia = sinComentarios(leer(join(RAIZ, 'compartido', 'guia.ts'), 'utf8'));
  chequear('sin paso guardado no hay recorrido', /g\.paso === undefined\s*\?\s*null/.test(guia), true);
  const onboarding = leer(join(RAIZ, 'src', 'app', 'onboarding', 'page.tsx'), 'utf8');
  chequear('elegir el nombre lo enciende', onboarding.includes('reiniciarGuia(user.id)'), true);
}
console.log('\n94. La consulta que encuentra sesiones con el total contado de menos');
{
  // `supabase/revisar-series-mal-contadas.sql` la corre el humano a mano. Se
  // prueba aca, con el archivo tal cual, para no mandarle una consulta que no
  // encuentra nada por estar mal escrita.
  const { readFileSync: leer } = await import('node:fs');
  const sql = leer(join(dirname(fileURLToPath(import.meta.url)), 'revisar-series-mal-contadas.sql'), 'utf8').replace(/\r\n/g, '\n');
  const i = sql.indexOf('select\n  l.fecha');
  const consulta = sql.slice(i, sql.indexOf(';', i)).replaceAll('(select id from yo)', '$1');
  const j = sql.indexOf('-- update sesiones s');
  const correccion = sql
    .slice(j, sql.indexOf(';', j) + 1)
    .split('\n')
    .map((l) => l.replace(/^-- ?/, ''))
    .join('\n')
    .replaceAll('(select id from yo)', '$1');

  const u = await nuevoUsuario();
  await comoUsuario(u);
  const s = (await db.query('select iniciar_sesion() as v')).rows[0].v;
  const id = s.id ?? (await db.query('select id from sesiones where user_id = $1 order by inicio desc limit 1', [u])).rows[0].id;
  // El bug: los bloques suman 5 y el total quedo en 4.
  await db.query('update sesiones set series = 4, bloques = $2::jsonb where id = $1', [
    id,
    JSON.stringify([{ ejercicio: 'sentadilla', series: 3 }, { ejercicio: 'press_banca', series: 2 }]),
  ]);
  // Otra persona con una sesion sana (series sin ejercicio de mas): no aparece.
  const otro = await nuevoUsuario();
  await comoUsuario(otro);
  const s2 = (await db.query('select iniciar_sesion() as v')).rows[0].v;
  const id2 = s2.id ?? (await db.query('select id from sesiones where user_id = $1 order by inicio desc limit 1', [otro])).rows[0].id;
  await db.query('update sesiones set series = 7, bloques = $2::jsonb where id = $1', [id2, JSON.stringify([{ ejercicio: 'sentadilla', series: 3 }])]);

  const filas = (await db.query(consulta, [u])).rows;
  chequear('encuentra la sesion con el total de menos', filas.map((f) => [f.total_guardado, Number(f.series_en_bloques), Number(f.faltan)]), [[4, 5, 1]]);
  chequear('una sesion con series sin ejercicio no aparece', (await db.query(consulta, [otro])).rows.length, 0);
  await db.query(correccion, [u]);
  chequear('la correccion pone el total en lo que suman los bloques', (await db.query('select series from sesiones where id = $1', [id])).rows[0].series, 5);
  chequear('y despues ya no aparece', (await db.query(consulta, [u])).rows.length, 0);
  await db.query(correccion, [otro]);
  chequear('a la sesion sana no la toca', (await db.query('select series from sesiones where id = $1', [id2])).rows[0].series, 7);
}
console.log('\n95. El aviso del descanso se programa donde se guarda el descanso');
{
  // §13d: el descanso tiene que avisar con el telefono en el bolsillo. El
  // aviso se programa en las TRES funciones que tocan el descanso guardado
  // (empezar, cambiar la duracion, borrar), asi ningun boton puede dejar un
  // aviso viejo sonando o uno nuevo sin programar. No se puede cargar con
  // node (usa la plataforma), asi que se lee.
  const { readFileSync: leer } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const codigo = sinComentarios(leer(join(RAIZ, 'compartido', 'descanso.ts'), 'utf8'));
  const cuerpoDe = (nombre) => {
    const i = codigo.indexOf(`export function ${nombre}(`);
    return i < 0 ? '' : codigo.slice(i, codigo.indexOf('\n}', i));
  };
  chequear(
    'empezar, cambiar y borrar el descanso tocan el aviso',
    ['guardarDescanso', 'cambiarDuracion', 'borrarDescanso'].map((f) => cuerpoDe(f).includes('avisarAlTerminar(')),
    [true, true, true]
  );
  chequear('solo donde el aviso llega con la pantalla bloqueada', /conPantallaBloqueada\(\)\)\s*return/.test(codigo), true);
  // Con un identificador propio: cerrar la app con el descanso andando y
  // saltarlo al volver tiene que poder cancelar el aviso.
  const avisos = sinComentarios(leer(join(RAIZ, 'movil', 'src', 'plataforma', 'avisos.ts'), 'utf8'));
  chequear('el aviso nativo usa un identificador fijo', /identifier:\s*delSistema\(id\)/.test(avisos), true);
  chequear('y cancela por ese mismo', /cancelScheduledNotificationAsync\(delSistema\(id\)\)/.test(avisos), true);
}
console.log('\n96. Hiciste 102 en banca: ¿lo guardo como marca?');
{
  const M = await import('../nucleo/marcaSugerida.ts');
  const catalogo = new Map([
    ['press_banca', { carga: 'total', cuenta_dots: true }],
    ['sentadilla', { carga: 'total', cuenta_dots: true }],
    ['peso_muerto', { carga: 'total', cuenta_dots: true }],
    ['press_mancuernas', { carga: 'par', cuenta_dots: false }],
    ['prensa', { carga: 'total', cuenta_dots: false }],
    ['remo_barra', { carga: 'total', cuenta_dots: false }],
  ]);
  const marcas = [
    { ejercicio: 'press_banca', peso: 100, reps: 1, es_real: true },
    { ejercicio: 'sentadilla', peso: 120, reps: 5, es_real: false }, // 1RM 140
    { ejercicio: 'prensa', peso: 200, reps: 1, es_real: true },
  ];
  const propone = (bloques) => M.marcasParaProponer({ bloques, marcas, catalogo });

  chequear(
    'mas que la marca: se propone con la de antes',
    propone([{ ejercicio: 'press_banca', series: 3, pesos: [95, 102, 100], carga: 'total' }]),
    [{ ejercicio: 'press_banca', peso: 102, antes: 100 }]
  );
  chequear('igual a la marca: no', propone([{ ejercicio: 'press_banca', series: 1, pesos: [100], carga: 'total' }]), []);
  // Contra el 1RM, no contra el peso escrito: 130x5 de antes son 140 de 1RM.
  chequear('contra el 1RM de la marca', propone([{ ejercicio: 'sentadilla', series: 1, pesos: [135], carga: 'total' }]), []);
  chequear('por mancuerna: no se propone', propone([{ ejercicio: 'press_mancuernas', series: 1, pesos: [60], carga: 'par' }]), []);
  chequear(
    'un ejercicio del DOTS sin marca: si',
    propone([{ ejercicio: 'peso_muerto', series: 1, pesos: [150], carga: 'total' }]),
    [{ ejercicio: 'peso_muerto', peso: 150, antes: null }]
  );
  chequear('uno cualquiera sin marca: no (seria una encuesta)', propone([{ ejercicio: 'remo_barra', series: 1, pesos: [80], carga: 'total' }]), []);
  chequear(
    'uno con marca aunque no sea del DOTS: si',
    propone([{ ejercicio: 'prensa', series: 1, pesos: [210], carga: 'total' }]).map((s) => s.ejercicio),
    ['prensa']
  );
  chequear('sin modo en el bloque, el del catalogo', propone([{ ejercicio: 'press_mancuernas', series: 1, pesos: [60] }]), []);
  chequear(
    'los del DOTS primero, y tres como mucho',
    propone([
      { ejercicio: 'prensa', series: 1, pesos: [300], carga: 'total' },
      { ejercicio: 'press_banca', series: 1, pesos: [105], carga: 'total' },
      { ejercicio: 'peso_muerto', series: 1, pesos: [150], carga: 'total' },
      { ejercicio: 'sentadilla', series: 1, pesos: [150], carga: 'total' },
    ]).map((s) => s.ejercicio),
    ['peso_muerto', 'sentadilla', 'press_banca']
  );
  chequear('sin bloques, nada', propone([]), []);

  // La fila que se guarda entra en la tabla de verdad (peso 1-600, reps 1-20,
  // 1RM real solo con una repeticion).
  const u = await nuevoUsuario();
  const s = { ejercicio: 'press_banca', peso: 102.5, antes: 100 };
  for (const reps of [1, 5]) {
    const f = M.filaDeMarca(s, reps, '2026-09-15');
    await db.query('insert into prs (user_id, ejercicio, peso, reps, es_real, fecha) values ($1, $2, $3, $4, $5, $6)', [
      u, f.ejercicio, f.peso, f.reps, f.es_real, f.fecha,
    ]);
  }
  chequear(
    'las dos filas entran, una real y una estimada',
    (await db.query('select reps, es_real from prs where user_id = $1 order by reps', [u])).rows,
    [{ reps: 1, es_real: true }, { reps: 5, es_real: false }]
  );
  chequear('las repeticiones ofrecidas caben en la tabla', M.REPETICIONES_PARA_MARCA.every((r) => r >= 1 && r <= 20), true);

  // Y lo compartido pide SOLO las marcas propias: la tabla deja leer las de los
  // amigos. Lo mismo el detector de estancamiento, que las mezclaba.
  const { readFileSync: leer } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const compartido = leer(join(RAIZ, 'compartido', 'marcaSugerida.ts'), 'utf8');
  chequear("la busqueda filtra por user_id", /from\('prs'\)\.select\([^)]*\)\.eq\('user_id'/.test(compartido), true);
  const estancamiento = leer(join(RAIZ, 'src', 'components', 'Estancamiento.tsx'), 'utf8');
  chequear("el estancamiento tambien", /from\('prs'\)\.select\([^)]*\)\.eq\('user_id'/.test(estancamiento), true);
}
console.log('\n97. La app nativa usa las mismas vidas, la misma foto y el mismo sonido');
{
  const F = await import('../nucleo/foto.ts');
  chequear('una foto grande se achica al lado maximo', F.medidasParaSubir(2400, 3000), { ancho: 1280, alto: 1600 });
  chequear('una chica no se agranda', F.medidasParaSubir(800, 600), { ancho: 800, alto: 600 });
  chequear('la ruta queda en la carpeta del usuario', F.rutaDeFoto('u1', '2026-09-15', 5), 'u1/2026-09-15-5.jpg');

  const { readFileSync: leer } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const archivo = (...r) => leer(join(RAIZ, ...r), 'utf8');
  // La misma marca de "ya vista" en las dos apps: con dos nombres, el mismo
  // telefono anunciaria dos veces la misma vida.
  chequear('la web usa la clave del nucleo', archivo('src', 'app', 'page.tsx').includes('CLAVE_VIDA_VISTA'), true);
  chequear('la nativa tambien', archivo('movil', 'src', 'Inicio.tsx').includes('CLAVE_VIDA_VISTA'), true);
  // La foto: la subida es una sola, y ninguna app sube el archivo sin preparar.
  chequear('la web sube por lo compartido', archivo('src', 'components', 'RegistrarSheet.tsx').includes('subirFotoDelDia('), true);
  chequear('la nativa tambien', archivo('movil', 'src', 'RegistrarDia.tsx').includes('subirFotoDelDia('), true);
  chequear('y la nativa prepara antes de subir', /prepararFoto\([^]*?subirFotoDelDia\(/.test(archivo('movil', 'src', 'RegistrarDia.tsx')), true);
  // El sonido del descanso se puede prender en la nativa (pedido para N4).
  chequear('Ajustes nativo tiene el interruptor del sonido', archivo('movil', 'src', 'Ajustes.tsx').includes('guardarSonido('), true);
}
console.log('\n98. El peso maximo de todo el catalogo');
{
  const V = await import('../nucleo/volumen.ts');
  const cat = [
    { id: 'sentadilla', nombre: 'Sentadilla', grupo: 'piernas', cuenta_dots: true, orden: 1 },
    { id: 'press_banca', nombre: 'Press banca', grupo: 'pecho', cuenta_dots: true, orden: 2 },
    { id: 'aperturas', nombre: 'Aperturas', grupo: 'pecho', orden: 5 },
    { id: 'press_inclinado', nombre: 'Press inclinado', grupo: 'pecho', orden: 4 },
    { id: 'plancha', nombre: 'Plancha', grupo: 'core', admite_peso: false, orden: 9 },
    { id: 'zancadas', nombre: 'Zancadas', grupo: 'piernas', orden: 7 },
  ];
  const sesiones = [
    { fecha: '2026-09-14', bloques: [{ ejercicio: 'zancadas', series: 2, pesos: [30, 30], carga: 'par' }] },
    { fecha: '2026-09-15', bloques: [{ ejercicio: 'press_banca', series: 1, pesos: [80] }] },
  ];
  // Una marca de antes de que se guardaran los pesos: tambien cuenta.
  const marcas = [
    { ejercicio: 'sentadilla', peso: 120, fecha: '2026-08-01' },
    { ejercicio: 'press_banca', peso: 75, fecha: '2026-08-01' },
    { ejercicio: 'zancadas', peso: 60, fecha: '2026-07-01' },
  ];
  const g = V.maximosDelCatalogo(sesiones, marcas, cat);
  chequear('los del DOTS arriba, despues cada musculo en el orden del selector', g.map((x) => x.grupo), [null, 'pecho', 'piernas']);
  chequear('los del DOTS van solo arriba', g[0].filas.map((f) => f.ejercicio), ['sentadilla', 'press_banca']);
  chequear('dentro del grupo, el orden del catalogo', g[1].filas.map((f) => f.ejercicio), ['press_inclinado', 'aperturas']);
  chequear('lo que nunca se hizo queda sin maximo (el guion)', g[1].filas.map((f) => f.maximo), [null, null]);
  chequear('y la cuenta del grupo lo dice', [g[1].conPeso, g[1].filas.length], [0, 2]);
  chequear('una marca sola alcanza para tener maximo', g[0].filas[0].maximo?.peso, 120);
  chequear('la serie de hoy le gana a la marca vieja', g[0].filas[1].maximo?.peso, 80);
  chequear('el isometrico no aparece', g.flatMap((x) => x.filas).some((f) => f.ejercicio === 'plancha'), false);
  // 30 por mancuerna son 60: empata con la marca de 60, y gana la fecha vieja.
  const z = g[2].filas.find((f) => f.ejercicio === 'zancadas').maximo;
  chequear('se compara lo que se movio, y el empate lo gana la primera vez', [z.kilos, z.fecha], [60, '2026-07-01']);
}

console.log('\n99. El aviso de estancamiento a las 2 semanas');
{
  const E = await import('../nucleo/estancamiento.ts');
  const HOY = '2026-09-15';
  const m = (fecha, peso) => ({ ejercicio: 'press_banca', fecha, peso, reps: 1, es_real: true });
  chequear('el 2 esta entre los umbrales', E.umbralValido(2), 2);
  chequear('antes de la 40 no se ofrece', E.umbralesDisponibles(39), [3, 6, 8]);
  chequear('con la 40 si', E.umbralesDisponibles(40), [2, 3, 6, 8]);
  chequear('sin saber la version, tampoco', E.umbralesDisponibles(null), [3, 6, 8]);

  // El mejor, hace dos semanas y media, y UNA marca despues: a 2 semanas es un
  // mal dia, no un estancamiento.
  const una = [m('2026-08-01', 90), m('2026-08-30', 100), m('2026-09-08', 97.5)];
  chequear('a 2 semanas, un intento no alcanza', E.detectar({ marcas: una, sesiones: [], hoy: HOY, umbral: 2 }), null);
  chequear('a 3, con el mismo caso, uno si (como siempre)', E.detectar({ marcas: [m('2026-08-01', 90), m('2026-08-20', 100), m('2026-09-08', 97.5)], sesiones: [], hoy: HOY, umbral: 3 })?.tipo, 'marca_quieta');
  const dos = [...una, m('2026-09-12', 97.5)];
  chequear('a 2 semanas, dos intentos si', E.detectar({ marcas: dos, sesiones: [], hoy: HOY, umbral: 2 })?.tipo, 'marca_quieta');

  // Dos semanas sin una marca no es haberlo dejado.
  const pausa = [m('2026-08-01', 90), m('2026-08-10', 95), m('2026-08-30', 100)];
  chequear('"lo dejaste" nunca antes de tres semanas', E.detectar({ marcas: pausa, sesiones: [], hoy: HOY, umbral: 2 }), null);
  chequear('a las tres, si', E.detectar({ marcas: pausa, sesiones: [], hoy: '2026-09-20', umbral: 2 })?.tipo, 'ejercicio_dejado');

  // La base acepta justo lo que ofrece la app.
  const u = await nuevoUsuario();
  const acepta = async (v) => {
    try {
      await db.query('update profiles set umbral_estancamiento = $1 where id = $2', [v, u]);
      return true;
    } catch {
      return false;
    }
  };
  const aceptados = [];
  for (const v of [1, 2, 3, 4, 5, 6, 7, 8, 9]) if (await acepta(v)) aceptados.push(v);
  chequear('la columna acepta los mismos umbrales que Ajustes', aceptados, E.UMBRALES);
}

console.log('\n100. El campo de peso con coma decimal');
{
  // EL RIESGO: el campo leia de vuelta con Number() el texto que mostraba. Con
  // coma, Number('62,5') es NaN y el + y el - dejarian de andar en el gimnasio.
  const P = await import('../nucleo/peso.ts');
  const C = await import('../nucleo/campoPeso.ts');
  const F = await import('../nucleo/fuerza.ts');

  chequear('asi era el problema: el texto con coma no es un Number', Number.isNaN(Number(P.pesoCorto(62.5, 'kg'))), true);
  chequear('el numero para cuentas sigue siendo numero', [P.pesoRedondeado(62.5, 'kg'), P.pesoRedondeado(61.23, 'lb')], [62.5, 135]);
  chequear('la coma solo cambia el separador', [P.conComa(1.5), P.conComa('97.3'), P.conComa(140)], ['1,5', '97,3', '140']);
  chequear('las marcas y el DOTS tambien con coma', [F.redondear(97.26), F.redondear(140)], ['97,3', '140']);

  // ---- lo que se escribe ----
  chequear('con coma y con punto es el mismo peso', [C.confirmarCampo('62,5', null, 'kg'), C.confirmarCampo('62.5', null, 'kg')], [{ cambia: true, kg: 62.5 }, { cambia: true, kg: 62.5 }]);
  chequear('las centesimas con coma', C.confirmarCampo('61,25', null, 'kg').kg, 61.25);
  chequear('en libras se guarda en kilos', C.confirmarCampo('135', null, 'lb').kg, 61.23);
  chequear('borrarlo es quedar sin peso', C.confirmarCampo('  ', 60, 'kg'), { cambia: true, kg: null });
  chequear('vacio sobre vacio no escribe nada', C.confirmarCampo('', null, 'kg'), { cambia: false, kg: null });
  chequear('basura no es un peso', C.confirmarCampo('abc', null, 'kg'), { cambia: false, kg: null });
  chequear('al teclear quedan solo numeros, punto y coma', C.limpiarTecleo('62,5 kg!'), '62,5');

  // ---- salir del campo sin tocarlo no cambia NADA, para todos los pesos ----
  // Cada cuarto de kilo de 1 a 400, las centesimas que existen, y cada media
  // libra: lo que el campo muestra, confirmado tal cual, es el mismo peso.
  const movidos = [];
  const probar = (kg, unidad) => {
    const texto = C.textoDelCampo(kg, unidad);
    const r = C.confirmarCampo(texto, kg, unidad);
    if (r.cambia) movidos.push(`${kg} ${unidad} -> "${texto}" -> ${r.kg}`);
  };
  for (let x = 100; x <= 40000; x += 25) probar(x / 100, 'kg');
  for (const kg of [61.25, 63.75, 101.25, 1.25, 0.5]) probar(kg, 'kg');
  for (let lb = 2; lb <= 880; lb += 0.5) probar(P.aKilos(lb, 'lb') > 0 ? Math.round(P.aKilos(lb, 'lb') * 100) / 100 : 1, 'lb');
  chequear('confirmar lo que se ve nunca cambia el peso (kg y lb)', movidos.slice(0, 5), []);

  // ---- el + y el - ----
  chequear('un toque suma el disco chico', [C.pasoDelCampo(62.5, 'kg', 1), C.pasoDelCampo(62.5, 'kg', -1)], [65, 60]);
  chequear('en libras, de a cinco', C.pasoDelCampo(61.23, 'lb', 1), 63.5);
  chequear('sin peso no hace nada', C.pasoDelCampo(null, 'kg', 1), undefined);
  chequear('bajar del disco chico es quedar sin peso', C.pasoDelCampo(2.5, 'kg', -1), null);
  const rotos = [];
  for (let x = 25; x <= 40000; x += 25) {
    for (const u of ['kg', 'lb']) {
      for (const s of [1, -1]) {
        const r = C.pasoDelCampo(x / 100, u, s);
        if (r !== null && !(Number.isFinite(r) && r > 0)) rotos.push(`${x / 100} ${u} ${s}`);
      }
    }
  }
  chequear('el + y el - dan siempre un peso de verdad, con decimales o sin', rotos.slice(0, 5), []);

  // Y nadie vuelve a leer con Number() un peso que se muestra.
  const { readdirSync: leerDir, readFileSync: leerArch, statSync: estado } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const hallados = [];
  const recorrer = (d) => {
    for (const n of leerDir(d)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const r = join(d, n);
      if (estado(r).isDirectory()) recorrer(r);
      else if (/\.tsx?$/.test(n) && /Number\((pesoCorto|redondear|conComa|pesoLindo)\(/.test(leerArch(r, 'utf8'))) hallados.push(n);
    }
  };
  for (const d of ['src', 'compartido', 'nucleo', join('movil', 'src')]) recorrer(join(RAIZ, d));
  chequear('ningun archivo pasa un texto con coma por Number()', hallados, []);
  chequear('las dos apps usan el campo del nucleo', [
    leerArch(join(RAIZ, 'src', 'components', 'CampoPeso.tsx'), 'utf8').includes('pasoDelCampo('),
    leerArch(join(RAIZ, 'movil', 'src', 'CampoPeso.tsx'), 'utf8').includes('pasoDelCampo('),
  ], [true, true]);
}

console.log('\n101. La caza del 15/9: lo que perdia datos o dejaba afuera');
{
  const { readFileSync: leer } = await import('node:fs');
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
  const archivo = (...r) => sinComentarios(leer(join(RAIZ, ...r), 'utf8'));

  // ---- 1. Terminar sube la cola ANTES de cerrar ----
  // Sin senal, las series quedan en la cola. Si la red vuelve y se toca
  // Terminar, la base ve una sesion sin series: corta, borra el dia; de mas de
  // dos horas, la da por abandonada. La base ya se prueba en su seccion; esto
  // prueba que el cliente no le pregunte antes de subir.
  const ses = archivo('compartido', 'usarSesion.ts');
  const cuerpo = ses.slice(ses.indexOf('async function terminar('), ses.indexOf('async function marcar('));
  const iVaciar = cuerpo.indexOf('vaciar(supabase)');
  const iCerrar = cuerpo.indexOf('cerrar(supabase');
  chequear('terminar vacia la cola', iVaciar > -1, true);
  chequear('y la vacia ANTES de cerrar', iVaciar > -1 && iCerrar > iVaciar, true);
  chequear('si quedan series de esa sesion esperando, no cierra', /estaPendiente\('fijar_series'/.test(cuerpo), true);
  chequear('empezar sin senal lo dice', /setAviso\(T\.sesion\.noEmpezo\)/.test(ses), true);
  chequear('terminar sin senal lo dice', /setAviso\(T\.sesion\.noTermino\)/.test(cuerpo), true);

  // ---- 2. "Guardar la vida" solo dice que se guardo si se guardo ----
  for (const [app, ventana, pantalla] of [
    ['web', ['src', 'components', 'RachaSalvada.tsx'], ['src', 'app', 'page.tsx']],
    ['nativa', ['movil', 'src', 'RachaSalvada.tsx'], ['movil', 'src', 'Inicio.tsx']],
  ]) {
    const v = archivo(...ventana);
    chequear(`${app}: la ventana espera un si o un no`, v.includes('Promise<boolean>'), true);
    chequear(`${app}: y solo pasa a "guardada" con un si`, /setPaso\(ok \? 'guardada' : 'confirmar'\)/.test(v), true);
    const p = archivo(...pantalla);
    const i = p.indexOf("rpc('devolver_impulsos'");
    chequear(`${app}: devolver mira el error`, /if \(error \|\| !data\) return false/.test(p.slice(i, i + 300)), true);
  }

  // ---- 3. La foto que no sube no se tira en la nativa ----
  const reg = archivo('movil', 'src', 'RegistrarDia.tsx');
  chequear('nativa: si la foto falla, la hoja queda abierta con la foto', /if \(!ok\) return setRegistradoAca\(resultado\)/.test(reg), true);
  chequear('y el reintento la cuelga del dia que ya entro', reg.includes('logId ?? registradoAca?.log_id'), true);

  // ---- 4. Una visita de ayer no es la de hoy ----
  const { decidir, VISITA_VENCIDA_MS } = await import('../nucleo/llegada.ts');
  const { ESPERA_LLEGADA_MS: ESPERA } = await import('../nucleo/reglas.ts');
  const libre = { corriendo: false, porUbicacion: false };
  const AYER = 1_000_000_000_000;
  const HOY = AYER + 20 * 3600 * 1000;
  // Ayer arranco sola y la app no lo vio salir: la visita quedo con `arranco`.
  const vieja = { desde: AYER, ultimoAdentro: AYER + 3600 * 1000, arranco: true };
  const llega = decidir(true, HOY, HOY, vieja, libre);
  chequear('llegar hoy con la visita de ayer guardada es una llegada nueva', [llega.hacer, llega.vigilancia?.desde, llega.vigilancia?.arranco], ['nada', HOY, false]);
  const arranca = decidir(true, HOY + ESPERA, HOY + ESPERA, llega.vigilancia, libre);
  chequear('y a la espera arranca, desde la llegada de HOY', [arranca.hacer, arranca.desde], ['arrancar', HOY]);
  // La que no llego a disparar tampoco puede arrancar al instante con la hora de ayer.
  const sinDisparar = decidir(true, HOY, HOY, { ...vieja, arranco: false }, libre);
  chequear('una visita vieja sin disparar no arranca al instante', sinDisparar.hacer, 'nada');
  // Dentro del mismo entrenamiento sigue siendo la misma visita.
  const misma = decidir(true, AYER + 90 * 60 * 1000, AYER + 90 * 60 * 1000, { desde: AYER, ultimoAdentro: AYER, arranco: true }, libre);
  chequear('noventa minutos sin mirar sigue siendo la misma visita', [misma.hacer, misma.vigilancia?.desde], ['nada', AYER]);
  chequear('el vencimiento es mas largo que una sesion entera', VISITA_VENCIDA_MS > (2 * 3600 + 30 * 60) * 1000, true);
}

console.log('\n102. Nadie pregunta por los datos de otro (migracion 41)');
{
  // LA FUGA: funciones SECURITY DEFINER que reciben el id de otro y estaban
  // abiertas a cualquiera con sesion. Con los ids publicos, el calendario de
  // cualquiera se reconstruia con calcular_racha dia por dia. Probado contra
  // la base real en supabase/probar-privacidad.mjs; esto lo fija aca.
  const ajenas = [
    'calcular_racha(uuid, date)', 'mejor_racha_real(uuid)', 'descansos_vigentes(uuid, date)',
    'impulsos_ganados(uuid)', 'impulsos_disponibles(uuid, date)', 'vidas_disponibles(uuid, date)',
    'peso_actual(uuid)', 'mejores_marcas(uuid)', 'dots_de(uuid)', 'hoy_de(uuid)', 'bloqueo_hasta(uuid)',
  ];
  const abiertas = [];
  for (const f of ajenas) {
    const r = await db.query(`select has_function_privilege('authenticated', 'public.${f}', 'execute') as si`);
    if (r.rows[0].si) abiertas.push(f);
  }
  chequear('ninguna funcion con el id de otro se puede llamar con sesion', abiertas, []);
  // Las que usa la RLS se quedan: cerrarlas romperia las lecturas de amigos.
  const rls = await db.query(`select has_function_privilege('authenticated', 'public.son_amigos(uuid, uuid)', 'execute') as si`);
  chequear('son_amigos sigue abierta, porque la usan las politicas', rls.rows[0].si, true);

  // Pero solo contesta sobre una amistad de quien pregunta.
  const x = await nuevoUsuario();
  const y = await nuevoUsuario();
  const z = await nuevoUsuario();
  await db.query(`insert into friendships (solicitante, destinatario, estado) values ($1, $2, 'aceptada')`, [x, y]);
  await comoUsuario(x);
  chequear('x pregunta por su amistad con y: si', (await db.query('select son_amigos($1, $2) as s', [x, y])).rows[0].s, true);
  await comoUsuario(z);
  chequear('z pregunta por la amistad de x con y: no contesta', (await db.query('select son_amigos($1, $2) as s', [x, y])).rows[0].s, false);
  // Y las funciones de adentro siguen andando: la racha la calcula el trigger.
  await comoUsuario(x);
  await db.query(`insert into logs (user_id, fecha) values ($1, mi_hoy() - 1)`, [x]);
  chequear('la racha la sigue calculando el trigger', (await db.query('select racha_actual from profiles where id = $1', [x])).rows[0].racha_actual, 1);
}

console.log(`\n${ok} pasaron, ${fallos.length} fallaron`);
if (fallos.length) {
  console.log('\nFALLAS:');
  fallos.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
