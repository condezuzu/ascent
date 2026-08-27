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
  descansosVigentes,
  numeroDeRango,
  planetaDeDia,
  unRM,
} from '../src/lib/reglas.ts';
import { PLANETAS_CFG } from '../src/motor/cuerpos.ts';
import { agruparPorDia, ESTADO_CON_DURACION, etiquetaDeDia } from '../src/lib/dias.ts';
import {
  CATEGORIAS,
  EJERCICIOS_ESTANDAR,
  muestraFina,
  esSexoEstandar,
  ubicar,
  umbrales,
} from '../src/lib/estandares.ts';
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
} from '../src/lib/tipos.ts';
import { decidir } from '../src/lib/llegada.ts';
import {
  clasificar,
  decidirRuta,
  hayCookiesDeSesion,
  llevarCookies,
} from '../src/lib/supabase/veredicto.ts';
// `next/server.js` y no `next/server`: node necesita el especificador exacto.
// Se usa el NextResponse DE VERDAD porque el bug era de esa clase, no de una
// imitación nuestra.
import { NextResponse } from 'next/server.js';
import { ESPERA_LLEGADA_MS } from '../src/lib/reglas.ts';
import { eventos } from '../src/plataforma/eventos.ts';
import { estaAdentro, metrosEntre } from '../src/lib/geo.ts';
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
async function perder(uid) {
  await comoUsuario(uid);
  const r = await db.query('select verificar_perdida() as v');
  return r.rows[0].v;
}

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
    `select registrar_dia(false, 82.5) as v`
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
  await db.query(`select registrar_dia(false, null)`);
  let error = null;
  try {
    await db.query(`select registrar_dia(false, null)`);
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
  await db.query(`select registrar_dia(false, 80)`);
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
  await db.query(`select registrar_dia(false, 75)`);
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
  await db.query(`select registrar_dia(false, null)`);
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
console.log('\n23. Fuerza: 1RM, DOTS y bandas');
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

  const b = await db.query(`
    select banda_dots(423.7) as media, banda_dots(180) as baja,
           banda_dots(700) as alta, banda_dots(null) as nada`);
  chequear('la banda agrupa de a 50', b.rows[0].media, '400–450');
  chequear('abajo de 200 no se abre en bandas', b.rows[0].baja, 'menos de 200');
  chequear('arriba de 600 tampoco', b.rows[0].alta, '600 o más');
  chequear('sin DOTS no hay banda', b.rows[0].nada, null);
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
  chequear('y viene con su banda', f.banda, '250–300');
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
  // ordena por DOTS EXACTO aunque muestre bandas: es la consecuencia
  // aceptada de §16.7b, no un descuido
  chequear('ordenado por DOTS, el amigo primero', r.rows[0].id, amigo);
  const mio = r.rows.find((x) => x.id === yo);
  const suyo = r.rows.find((x) => x.id === amigo);
  chequear('mi fila trae mi DOTS exacto', Number(mio.dots_propio), 420.29);
  chequear('la del otro NO trae el número exacto', suyo.dots_propio, null);
  chequear('del otro solo se ve la banda', typeof suyo.banda, 'string');
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
           extract(epoch from piso_sesion())::float8 as piso`);
  chequear(
    'el tope de 4 h y el piso de 5 min son el mismo número de los dos lados',
    [topes.rows[0].tope, topes.rows[0].piso],
    [TOPE_SESION_SEGUNDOS, PISO_SESION_SEGUNDOS]
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
  const { PRESETS_DESCANSO } = await import('../src/lib/reglas.ts');
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
    // la anterior queda ABANDONADA, no terminada: no sabemos cuándo terminó,
    // así que no puede quedarse con una duración inventada
    chequear(
      'empezar de nuevo abandona la anterior',
      r.rows.map((x) => [x.estado, x.n]),
      [['abandonada', 1], ['corriendo', 1]]
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

  // ---- a las 4 horas se cierra sola, SIN duración ----
  {
    const u = await nuevoUsuario();
    await empezar(u);
    await db.query(`update sesiones set inicio = now() - interval '4 hours 1 minute' where user_id = $1`, [u]);
    const r = (await db.query('select mi_sesion() as v')).rows[0].v;
    chequear('pasadas 4 horas ya no hay sesión corriendo', r.corriendo, false);
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
  // compara contra `src/lib/tipos.ts`, que es de donde sale el cliente.
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
  await db.query(`select registrar_dia(false, null, 'ubicacion')`);
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
  const arrancar = async (sql) => {
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
  const mia = (await db.query('select mi_sesion() as v')).rows[0].v;
  chequear('mi_sesion dice de donde salio', mia.origen, 'ubicacion');

  // ---- la salida cierra con la hora de la salida ----
  await db.query(`select iniciar_sesion(now() - interval '40 minutes', 'ubicacion') as v`);
  let fin = (await db.query(`select terminar_sesion(now() - interval '10 minutes') as v`)).rows[0].v;
  chequear('cierra con la hora que se le pasa', Math.round(Number(fin.segundos) / 60), 30);
  chequear('y esa duracion cuenta', fin.cuenta, true);

  // ---- ni antes del inicio ni despues de ahora ----
  await db.query(`select iniciar_sesion(now() - interval '20 minutes', 'ubicacion') as v`);
  fin = (await db.query(`select terminar_sesion(now() - interval '5 hours') as v`)).rows[0].v;
  // Una duracion negativa romperia el promedio de Stats sin que nadie lo note.
  chequear('un fin anterior al inicio da cero, no negativo', Number(fin.segundos), 0);

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

console.log(`\n${ok} pasaron, ${fallos.length} fallaron`);
if (fallos.length) {
  console.log('\nFALLAS:');
  fallos.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
