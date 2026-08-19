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
  const r = await db.query('select verificar_perdida(mi_hoy()) as v');
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
  await db.query('select fijar_descansos($1, mi_hoy())', [[nuevoA]]);

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

  await db.query('select fijar_descansos($1, mi_hoy())', [[]]); // sin descansos
  chequear('sacar los descansos no rompe el pasado', (await perfil(u)).racha_actual, 2);
}
{
  // El cambio rige de hoy en adelante: mañana ya no habrá descanso
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await db.query('select fijar_descansos($1, mi_hoy())', [[0, 1, 2, 3, 4, 5, 6]]);
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
  await db.query('select verificar_perdida(mi_hoy())');
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
    `select registrar_dia(mi_hoy(), false, 82.5) as v`
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
  await db.query(`select registrar_dia(mi_hoy(), false, null)`);
  let error = null;
  try {
    await db.query(`select registrar_dia(mi_hoy(), false, null)`);
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
  const r = (await db.query('select recalcular_desde_cero(mi_hoy()) as v')).rows[0].v;
  chequear('devuelve el final, no el del historial', [r.racha, r.racha_historial], [4, 14]);
  chequear('avisa que aplicó pérdida', r.perdida, true);
  chequear('la base coincide con lo devuelto', (await perfil(u)).racha_actual, 4);
  // recargar no cambia nada: no hay rebote
  const otra = await perder(u);
  chequear('recargar no mueve el número', [otra.perdida, (await perfil(u)).racha_actual], [false, 4]);
  // y volver a recalcular da lo mismo (idempotente)
  const r2 = (await db.query('select recalcular_desde_cero(mi_hoy()) as v')).rows[0].v;
  chequear('recalcular es idempotente', r2.racha, 4);
}
{
  // historial sano: recalcular NO castiga
  const u = await nuevoUsuario();
  await rachaDe(u, 12); // termina hoy
  await comoUsuario(u);
  const r = (await db.query('select recalcular_desde_cero(mi_hoy()) as v')).rows[0].v;
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
  await db.query(`select registrar_dia(mi_hoy(), false, 80)`);
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
  await db.query(`select registrar_dia(mi_hoy(), false, 75)`);
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
  await db.query(`select registrar_dia(mi_hoy(), false, null)`);
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
  await db.query(`select fijar_descansos(array[0,6]::int[], mi_hoy())`);

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

  // Percentil global: con poca gente es un podio disfrazado, así que no hay
  const p = (await db.query('select percentil_fuerza() as p')).rows[0].p;
  chequear('con poca gente no hay percentil', p.percentil, null);

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
  const empezar = async (uid, fecha = 'mi_hoy()') => {
    await comoUsuario(uid);
    const r = await db.query(`select iniciar_sesion(${fecha}) as v`);
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
      `select fijar_descansos(array[extract(dow from mi_hoy())::int], mi_hoy())`
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

    await db.query('select anotar_peso(mi_hoy(), 80.5)');
    await db.query('select anotar_peso(mi_hoy(), 81)'); // corrige el del día
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

  // ---- el cliente ya no elige la fecha ----
  // Antes se mandaba p_hoy y el servidor solo lo acotaba a ±1 día: alcanzaba
  // con adelantar la hora del teléfono para registrar "mañana", volverla
  // atrás y registrar "hoy". Dos días de racha en un día real.
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await db.query(`select registrar_dia('2020-01-01'::date)`);
  const cuando = await db.query(
    'select fecha::text as f from logs where user_id = $1',
    [u]
  );
  chequear('registrar_dia ignora la fecha que manda el cliente', cuando.rows.length, 1);
  chequear('y usa el día de Uruguay', cuando.rows[0].f, hoy.rows[0].h);

  // el segundo intento choca con la unicidad, no crea un día nuevo
  let dosVeces = null;
  try {
    await db.query(`select registrar_dia('2030-01-01'::date)`);
    dosVeces = false;
  } catch (e) {
    dosVeces = e.code === '23505';
  }
  chequear('pedir otra fecha no da un día extra', dosVeces, true);

  // anotar_peso también
  await db.query('select anotar_peso($1::date, 80)', ['2020-01-01']);
  const wp = await db.query('select fecha::text as f from weights where user_id = $1', [u]);
  chequear('anotar_peso tampoco le cree al cliente', wp.rows[0].f, hoy.rows[0].h);

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
  await db.query(`select fijar_descansos(array[0]::int[], '2020-01-01'::date)`);
  const cfg = await db.query('select desde::text as d from descansos where user_id = $1', [u]);
  chequear('los descansos se fechan con el día de Uruguay', cfg.rows[0].d, hoy.rows[0].h);
}


// =====================================================================
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

  // ---- la guarda: cambiar de zona no regala un día ----
  {
    const v = await nuevoUsuario();
    await comoUsuario(v);
    await db.query('select registrar_dia()');
    chequear('registró el día', (await perfil(v)).racha_actual, 1);

    // se mueve la zona hacia adelante, que es el ataque
    await db.exec('set role authenticated');
    await db.query(`select fijar_zona('Asia/Tokyo')`);
    await db.exec('reset role');

    let segundo = null;
    try {
      await db.query('select registrar_dia()');
      segundo = false;
    } catch (e) {
      segundo = /20 horas/i.test(e.message);
    }
    chequear('mover la zona no da un segundo día', segundo, true);
    chequear('y la racha no se movió', (await perfil(v)).racha_actual, 1);
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
console.log(`\n${ok} pasaron, ${fallos.length} fallaron`);
if (fallos.length) {
  console.log('\nFALLAS:');
  fallos.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
