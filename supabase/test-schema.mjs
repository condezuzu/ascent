// Corre supabase/schema.sql contra un Postgres real (PGlite, WASM) y verifica
// la matemática de racha / rangos / pérdida. Sustituye lo que Supabase aporta
// (auth.users, auth.uid(), storage, roles) por stubs mínimos.
// Correr con: npm run test:db
import { PGlite } from '@electric-sql/pglite';
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
      `insert into logs (user_id, fecha) values ($1, current_date - $2::int)`,
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
  const r = await db.query('select verificar_perdida(current_date) as v');
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
  await db.query(`insert into logs (user_id, fecha) values ($1, current_date)`, [u]);
  chequear('4 + 1 = 5 (no 15)', (await perfil(u)).racha_actual, 5);
}

// =====================================================================
console.log('\n7. Corregir un día viejo no saltea la regla de -10');
{
  const u = await nuevoUsuario();
  await rachaDe(u, 14, 2);
  // corrección manual de un día suelto muy anterior, estando ya cortado
  await db.query(`insert into logs (user_id, fecha) values ($1, current_date - 40)`, [u]);
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
    await db.query(`select extract(dow from current_date - 1)::int as d`)
  ).rows[0].d;
  // la configuración se fecha bien atrás para que cubra los días de la prueba
  await db.query('insert into descansos (user_id, desde, dias) values ($1, current_date - 60, array[$2::int])', [u, dow]);
  await rachaDe(u, 5, 2); // días -6..-2
  await db.query(`insert into logs (user_id, fecha) values ($1, current_date)`, [u]);
  // ayer no tiene log pero es descanso fijo → no corta
  chequear('descanso fijo no corta', (await perfil(u)).racha_actual, 6);
  const r = await perder(u);
  chequear('no hay pérdida', r.perdida, false);
}
{
  const u = await nuevoUsuario();
  await rachaDe(u, 3);
  await db.query(
    `insert into logs (user_id, fecha, es_descanso) values ($1, current_date - 3, true)`,
    [u]
  );
  await db.query(`insert into logs (user_id, fecha) values ($1, current_date - 4)`, [u]);
  chequear('log de descanso no suma pero no corta', (await perfil(u)).racha_actual, 4);
}

// =====================================================================
console.log('\n8b. Cambiar los descansos NO altera ningún día anterior');
{
  // Alguien que entrena de lunes a viernes y descansa sábado y domingo.
  const u = await nuevoUsuario();
  await comoUsuario(u);
  const dowHoy = (await db.query('select extract(dow from current_date)::int as d')).rows[0].d;
  // configuración vieja: descansan los dos días de hace 3 y 4 días
  const viejoA = (dowHoy - 3 + 7) % 7;
  const viejoB = (dowHoy - 4 + 7) % 7;
  await db.query('insert into descansos (user_id, desde, dias) values ($1, current_date - 30, $2)', [
    u,
    [viejoA, viejoB],
  ]);
  // entrena hoy, ayer, anteayer y hace 5 días; los de hace 3 y 4 eran descanso
  for (const i of [5, 2, 1, 0]) {
    await db.query('insert into logs (user_id, fecha) values ($1, current_date - $2::int)', [u, i]);
  }
  chequear('racha con la config vieja', (await perfil(u)).racha_actual, 4);

  // ahora cambia de rutina: pasa a descansar OTROS días
  const nuevoA = (dowHoy - 1 + 7) % 7;
  await db.query(`select set_config('test.uid', $1, false)`, [u]);
  await db.query('select fijar_descansos($1, current_date)', [[nuevoA]]);

  chequear('la racha del pasado no se movió', (await perfil(u)).racha_actual, 4);
  const dv = await db.query(
    `select descansos_vigentes($1, current_date - 3) as antes,
            descansos_vigentes($1, current_date) as ahora`,
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
  const dowAyer = (await db.query('select extract(dow from current_date - 1)::int as d')).rows[0].d;
  await db.query('insert into descansos (user_id, desde, dias) values ($1, current_date - 60, $2)', [
    u,
    [dowAyer],
  ]);
  // entrena hoy y hace 2 días; ayer fue descanso, así que la racha vale 2
  await db.query('insert into logs (user_id, fecha) values ($1, current_date - 2)', [u]);
  await db.query('insert into logs (user_id, fecha) values ($1, current_date)', [u]);
  chequear('racha apoyada en un descanso', (await perfil(u)).racha_actual, 2);

  await db.query('select fijar_descansos($1, current_date)', [[]]); // sin descansos
  chequear('sacar los descansos no rompe el pasado', (await perfil(u)).racha_actual, 2);
}
{
  // El cambio rige de hoy en adelante: mañana ya no habrá descanso
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await db.query('select fijar_descansos($1, current_date)', [[0, 1, 2, 3, 4, 5, 6]]);
  const r = await db.query(
    `select descansos_vigentes($1, current_date - 1) as ayer,
            descansos_vigentes($1, current_date) as hoy`,
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
    await db.query('insert into descansos (user_id, desde, dias) values ($1, current_date - 90, $2)', [u, [1]]);
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
console.log('\n9. registrar_dia: RPC devuelve el salto de rango');
{
  const u = await nuevoUsuario();
  await comoUsuario(u);
  await rachaDe(u, 9, 1); // 9 días terminando ayer
  const r = await db.query(
    `select registrar_dia(current_date, false, 82.5) as v`
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
  await db.query(`select registrar_dia(current_date, false, null)`);
  let error = null;
  try {
    await db.query(`select registrar_dia(current_date, false, null)`);
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
  const r = (await db.query('select recalcular_desde_cero(current_date) as v')).rows[0].v;
  chequear('devuelve el final, no el del historial', [r.racha, r.racha_historial], [4, 14]);
  chequear('avisa que aplicó pérdida', r.perdida, true);
  chequear('la base coincide con lo devuelto', (await perfil(u)).racha_actual, 4);
  // recargar no cambia nada: no hay rebote
  const otra = await perder(u);
  chequear('recargar no mueve el número', [otra.perdida, (await perfil(u)).racha_actual], [false, 4]);
  // y volver a recalcular da lo mismo (idempotente)
  const r2 = (await db.query('select recalcular_desde_cero(current_date) as v')).rows[0].v;
  chequear('recalcular es idempotente', r2.racha, 4);
}
{
  // historial sano: recalcular NO castiga
  const u = await nuevoUsuario();
  await rachaDe(u, 12); // termina hoy
  await comoUsuario(u);
  const r = (await db.query('select recalcular_desde_cero(current_date) as v')).rows[0].v;
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
  await db.query(`select registrar_dia(current_date, false, 80)`);
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
  await db.query(`select registrar_dia(current_date, false, 75)`);
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
    `insert into logs (user_id, fecha, planeta_del_dia) values ($1, current_date, 'Júpiter')`,
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
     values ($1, $2, current_date, current_date + 6, 'activo')`,
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
     values ($1, $2, current_date, current_date + 6, 'pendiente')`,
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
  await db.query(`select registrar_dia(current_date, false, null)`);
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
    await db.query(`insert into logs (user_id, fecha) values ($1, current_date - $2::int)`, [u, i]);
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
  await db.query(`insert into logs (user_id, fecha) values ($1, current_date - $2::int)`, [u, faltante]);
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
  await db.query(`delete from logs where user_id = $1 and fecha = current_date - $2::int`, [u, faltante]);
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
    await db.query('insert into logs (user_id, fecha) values ($1, current_date)', [u]);
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
    await db.query('select calcular_racha($1, current_date)', [
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
console.log(`\n${ok} pasaron, ${fallos.length} fallaron`);
if (fallos.length) {
  console.log('\nFALLAS:');
  fallos.forEach((f) => console.log(' - ' + f));
  process.exit(1);
}
