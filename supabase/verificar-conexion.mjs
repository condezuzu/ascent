// Chequeo de humo contra el Supabase real: confirma que .env.local está bien,
// que el schema está aplicado y que los permisos quedaron como corresponde.
// Correr con: npm run test:conexion
// Todo lo que hace es de lectura y sin sesión: no crea ni modifica nada.
//
// Se conecta como anónimo, así que lo ESPERADO es que casi todo esté cerrado:
// "permission denied" prueba que la tabla existe y está protegida. Lo que
// delataría un problema es que devuelva datos, o que diga que no existe.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key || key.startsWith('FALTA')) {
  console.log('Falta completar .env.local con la URL y la anon key.');
  process.exit(1);
}

try {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString());
  if (payload.role !== 'anon') {
    console.log(`PELIGRO: la clave es "${payload.role}", no "anon". La service_role saltea toda la RLS.`);
    process.exit(1);
  }
  console.log(`proyecto: ${payload.ref}   clave: rol ${payload.role}\n`);
} catch {
  console.log('La anon key no parece un JWT válido.');
  process.exit(1);
}

const db = createClient(url, key);
let ok = 0;
const fallos = [];
let faltaMigracion = false;

function chequear(nombre, real, esperado) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  ok   ${nombre}`);
  } else {
    fallos.push(nombre);
    console.log(`  FALLA ${nombre}: esperado ${b}, obtuve ${a}`);
  }
}

const noExiste = (m) => /could not find|does not exist|schema cache/i.test(m ?? '');
const denegado = (m) => /permission denied/i.test(m ?? '');

const TABLAS = [
  'profiles', 'descansos', 'logs', 'photos', 'weights',
  'friendships', 'challenges', 'feedback',
];

// --- el schema está aplicado ---
console.log('El schema está aplicado');
for (const tabla of TABLAS) {
  const { error } = await db.from(tabla).select('id').limit(1);
  chequear(`tabla ${tabla} existe`, !noExiste(error?.message), true);
}
{
  const { error } = await db.from('usuarios_publicos').select('username').limit(1);
  chequear('vista usuarios_publicos existe', !noExiste(error?.message), true);
}

// --- las funciones existen y calculan bien ---
console.log('\nLas funciones calculan bien');
{
  const { data, error } = await db.rpc('rango_de_racha', { r: 35 });
  chequear('rango_de_racha(35) = 4', error?.message ?? data, 4);
}
{
  const { data } = await db.rpc('rango_de_racha', { r: 150 });
  chequear('rango_de_racha(150) = 8 (tope)', data, 8);
}
{
  const { data } = await db.rpc('planeta_de_dia', { r: 30 });
  chequear('planeta_de_dia(30) = Ceres', data, 'Ceres');
}
{
  const { data } = await db.rpc('planeta_de_dia', { r: 39 });
  chequear('planeta_de_dia(39) = Júpiter', data, 'Júpiter');
}

// --- los permisos: sin sesión no se toca nada ---
// Ojo: hay que pasar los argumentos obligatorios, o PostgREST responde
// "could not find the function" por la firma y parece que no existiera.
console.log('\nSin sesión todo está cerrado');
const RPCS = [
  ['registrar_dia', { p_fecha: '2020-01-01', p_es_descanso: false, p_peso: null }],
  ['verificar_perdida', { p_hoy: '2020-01-01' }],
  ['recalcular_desde_cero', { p_hoy: '2020-01-01' }],
  ['cerrar_retos_vencidos', { p_hoy: '2020-01-01' }],
  ['eliminar_amigo', { p_otro: '00000000-0000-0000-0000-000000000001' }],
  ['calcular_racha', { p_user: '00000000-0000-0000-0000-000000000001', p_hasta: '2020-01-01' }],
  ['descansos_vigentes', { p_user: '00000000-0000-0000-0000-000000000001', p_fecha: '2020-01-01' }],
  ['fijar_descansos', { p_dias: [1], p_hoy: '2020-01-01' }],
];
for (const [fn, args] of RPCS) {
  const { error } = await db.rpc(fn, args);
  chequear(`${fn} existe`, !noExiste(error?.message), true);
  const cerrada = denegado(error?.message);
  if (!cerrada) faltaMigracion = true;
  chequear(`${fn} cerrada a anónimos`, cerrada, true);
}
for (const tabla of TABLAS) {
  const { data, error } = await db.from(tabla).select('id').limit(5);
  const cerrada = denegado(error?.message);
  // Si no está cerrada, al menos la RLS tiene que devolver vacío
  if (!cerrada) faltaMigracion = true;
  chequear(`${tabla} no entrega datos`, cerrada || (data ?? []).length === 0, true);
}
{
  const { error } = await db.from('profiles').insert({ id: '00000000-0000-0000-0000-000000000001' });
  chequear('un anónimo no puede insertar un perfil', !!error, true);
}

// --- módulo de fuerza (migración 08) ---
// Si la migración todavía no corrió, esto NO cuenta como falla: avisa y sigue.
// El código de fuerza está escrito para no romper nada mientras tanto.
console.log('\nMódulo de fuerza');
{
  const { error } = await db.from('prs').select('id').limit(1);
  if (noExiste(error?.message)) {
    console.log('  --   la migración 08 todavía no está aplicada (supabase/migracion-08-fuerza.sql)');
  } else {
    for (const tabla of ['ejercicios', 'prs']) {
      const { data, error: err } = await db.from(tabla).select('id').limit(5);
      chequear(`tabla ${tabla} existe`, !noExiste(err?.message), true);
      chequear(`${tabla} no entrega datos`, denegado(err?.message) || (data ?? []).length === 0, true);
    }

    // La matemática pura queda abierta, igual que rango_de_racha. El valor es
    // el caso publicado: si acá da otra cosa, los coeficientes de la base no
    // son los que se probaron.
    const { data: d } = await db.rpc('dots', { p_total: 650, p_peso: 90, p_sexo: 'm' });
    chequear('dots(650, 90, hombre) = 420.29', Number(d), 420.29);

    for (const fn of ['mi_fuerza', 'ranking_fuerza', 'percentil_fuerza']) {
      const { error: err } = await db.rpc(fn);
      chequear(`${fn} existe`, !noExiste(err?.message), true);
      const cerrada = denegado(err?.message);
      if (!cerrada) faltaMigracion = true;
      chequear(`${fn} cerrada a anónimos`, cerrada, true);
    }

    // Estas calculan con el peso corporal AJENO: no tienen que estar al
    // alcance de NADIE desde el cliente, ni siquiera con sesión.
    for (const [fn, args] of [
      ['peso_actual', { p_user: '00000000-0000-0000-0000-000000000001' }],
      ['dots_de', { p_user: '00000000-0000-0000-0000-000000000001' }],
      ['total_dots', { p_user: '00000000-0000-0000-0000-000000000001' }],
      ['mejores_marcas', { p_user: '00000000-0000-0000-0000-000000000001' }],
    ]) {
      const { error: err } = await db.rpc(fn, args);
      const inalcanzable = denegado(err?.message) || noExiste(err?.message);
      if (!inalcanzable) faltaMigracion = true;
      chequear(`${fn} fuera del alcance del cliente`, inalcanzable, true);
    }
  }
}

// --- cronómetro de sesión (migración 09) ---
console.log('\nCronómetro de sesión');
{
  const { error } = await db.from('sesiones').select('id').limit(1);
  if (noExiste(error?.message)) {
    console.log('  --   la migración 09 todavía no está aplicada (supabase/migracion-09-cronometro.sql)');
  } else {
    const { data, error: err } = await db.from('sesiones').select('id').limit(5);
    chequear('tabla sesiones existe', !noExiste(err?.message), true);
    chequear('sesiones no entrega datos', denegado(err?.message) || (data ?? []).length === 0, true);

    // las dos constantes están abiertas, como rango_de_racha: son números
    const { data: tope } = await db.rpc('tope_sesion');
    chequear('tope_sesion son 4 horas', tope, '04:00:00');

    for (const [fn, args] of [
      ['iniciar_sesion', { p_hoy: '2020-01-01' }],
      ['terminar_sesion', {}],
      ['mi_sesion', {}],
      ['resumen_sesiones', {}],
      ['anotar_peso', { p_fecha: '2020-01-01', p_valor: 80 }],
    ]) {
      const { error: e2 } = await db.rpc(fn, args);
      chequear(`${fn} existe`, !noExiste(e2?.message), true);
      const cerrada = denegado(e2?.message);
      if (!cerrada) faltaMigracion = true;
      chequear(`${fn} cerrada a anónimos`, cerrada, true);
    }

    // toca las sesiones de cualquiera: no puede estar al alcance del cliente
    const { error: e3 } = await db.rpc('cerrar_sesiones_vencidas', {
      p_user: '00000000-0000-0000-0000-000000000001',
    });
    const inalcanzable = denegado(e3?.message) || noExiste(e3?.message);
    if (!inalcanzable) faltaMigracion = true;
    chequear('cerrar_sesiones_vencidas fuera del alcance del cliente', inalcanzable, true);
  }
}

// --- descanso entre series (migración 10) ---
console.log('\nDescanso entre series');
{
  // La columna es lo único que agrega el descanso: si no está, la migración
  // 10 no corrió. No cuenta como falla, igual que las otras.
  const { error } = await db.from('profiles').select('duracion_descanso').limit(1);
  if (noExiste(error?.message)) {
    console.log('  --   la migración 10 todavía no está aplicada (supabase/migracion-10-descanso.sql)');
  } else {
    chequear('la columna duracion_descanso existe', !noExiste(error?.message), true);
    chequear('y sigue sin entregar datos', denegado(error?.message), true);
  }
}

// --- auth responde ---
console.log('\nAuth');
{
  const { error } = await db.auth.getSession();
  chequear('el endpoint de auth responde', error?.message ?? 'sin error', 'sin error');
}

console.log(`\n${ok} pasaron, ${fallos.length} fallaron`);
if (faltaMigracion) {
  console.log(
    '\nHay permisos más abiertos de lo que debería.\n' +
      'Pegá supabase/migracion-01-permisos.sql en el SQL Editor de Supabase.'
  );
}
if (fallos.length) process.exit(1);
