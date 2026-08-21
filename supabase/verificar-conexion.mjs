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
let faltaRetrato = false;

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

    {
      // La 21 la dropeó: el percentil sale de una tabla del repo y se calcula
      // en el teléfono. Mientras la migración no corra sigue estando, y eso no
      // es una falla —el cliente ya no la llama—, así que se avisa nomás.
      const { error: err } = await db.rpc('percentil_fuerza');
      if (noExiste(err?.message)) {
        chequear('percentil_fuerza ya no existe', true, true);
      } else {
        console.log('  --   falta correr supabase/migracion-21-percentil-contra-el-mundo.sql');
      }
    }

    for (const fn of ['mi_fuerza', 'ranking_fuerza']) {
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

// Lo que vive SOLO en producción a propósito, y por qué. Todo lo demás que
// aparezca de más es deriva.
//
//   sugerencia-nueva — el webhook de sugerencias, creado desde el panel de
//   Supabase (Database Webhooks). Su definición lleva la service_role key
//   incrustada, así que no puede ir a un repo público. Que exista se
//   comprueba acá; que siga igual, por el md5 del retrato... que justamente
//   por eso no se compara. Si el correo de sugerencias deja de llegar,
//   empezá por mirarlo en el panel.
const SOLO_EN_PRODUCCION = [/^feedback sugerencia-nueva /];

// --- producción contra el repo (migración 18) ---
//
// Las migraciones se corren pegando SQL a mano en el SQL Editor. `test:db`
// compara schema.sql contra las migraciones, pero las dos salen del repo: si
// producción se separó de las DOS, ninguna se entera. Esto es lo único que
// mira la base de verdad.
//
// Es la única parte del archivo que necesita SESIÓN: el retrato refleja la
// base viva y no se le entrega a un anónimo. Va en un cliente aparte para no
// tocar los chequeos de arriba, que valen justamente por ser anónimos.
console.log('\nProducción tiene la forma del repo');
{
  const correo = process.env.CONEXION_EMAIL;
  const clave = process.env.CONEXION_PASSWORD;
  let remoto = null, error = null, sinCuenta = false;
  if (!correo || !clave) {
    sinCuenta = true;
  } else {
    const conSesion = createClient(url, key);
    const { error: eLogin } = await conSesion.auth.signInWithPassword({
      email: correo, password: clave,
    });
    if (eLogin) {
      error = { message: `no pude entrar como ${correo}: ${eLogin.message}` };
    } else {
      ({ data: remoto, error } = await conSesion.rpc('retrato_del_schema'));
    }
    await conSesion.auth.signOut();
  }

  if (sinCuenta) {
    console.log('  --   falta CONEXION_EMAIL / CONEXION_PASSWORD en .env.local: no se comparó');
    faltaRetrato = true;
  } else if (noExiste(error?.message)) {
    console.log('  --   la migración 18 todavía no está aplicada (supabase/migracion-18-retrato-del-schema.sql)');
    faltaRetrato = true;
  } else if (error) {
    chequear(`retrato_del_schema responde (${error.message.slice(0, 70)})`, false, true);
  } else {
    // El mismo retrato, sacado de una base levantada solo con schema.sql.
    // La consulta es la MISMA de los dos lados porque vive en la base: acá
    // solo se la llama.
    const { PGlite } = await import('@electric-sql/pglite');
    const local = new PGlite();
    await local.exec(`set timezone = 'UTC'`);
    await local.exec(`
      create schema if not exists auth;
      create table auth.users (id uuid primary key default gen_random_uuid(),
        raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $fn$
        select nullif(current_setting('test.uid', true), '')::uuid; $fn$;
      create role authenticated; create role anon;
    `);
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const DIR = dirname(fileURLToPath(import.meta.url));
    let sql = readFileSync(join(DIR, 'schema.sql'), 'utf8').replace(/\r\n/g, '\n');
    // el bloque de storage no corre en PGlite y tampoco lo devuelve el retrato
    const iniStorage = sql.indexOf('-- STORAGE: bucket privado de fotos');
    const iniPermisos = sql.indexOf('-- PERMISOS (capa extra debajo de la RLS)');
    sql = sql.slice(0, sql.lastIndexOf('-- ----', iniStorage)) +
          sql.slice(sql.lastIndexOf('-- ----', iniPermisos));
    await local.exec(sql);
    const filas = (await local.query('select que, f from retrato_del_schema() order by 1, 2')).rows;

    const agrupar = (xs) => {
      const m = {};
      for (const x of xs) (m[x.que] ??= []).push(x.f);
      return m;
    };
    const enElRepo = agrupar(filas);
    const enProduccion = agrupar(remoto);
    const temas = [...new Set([...Object.keys(enElRepo), ...Object.keys(enProduccion)])].sort();

    // Si el retrato de producción no es el mismo código que el del repo, lo
    // que salga de compararlos no significa nada: las diferencias serían de
    // la consulta, no de la base. Se detecta con la línea que el retrato da
    // de sí mismo.
    const suyo = (xs) => (xs.funciones ?? []).find((x) => x.startsWith('retrato_del_schema('));
    if (suyo(enElRepo) !== suyo(enProduccion)) {
      // El nombre sale del directorio, no escrito a mano: cada vez que el
      // retrato cambia hay una migración nueva, y un número viejo acá manda a
      // correr el archivo equivocado.
      const { readdirSync } = await import('node:fs');
      const ultima = readdirSync(DIR).filter((f) => /^migracion-\d+/.test(f)).sort().pop();
      console.log(`  --   falta correr supabase/${ultima}:`);
      console.log('       el retrato de producción es de otra versión, comparar no diría nada');
      faltaRetrato = true;
    } else {
      for (const tema of temas) {
        const r = enElRepo[tema] ?? [];
        const p = enProduccion[tema] ?? [];
        const faltaEnProd = r.filter((x) => !p.includes(x));
        const sobraEnProd = p
          .filter((x) => !r.includes(x))
          .filter((x) => !SOLO_EN_PRODUCCION.some((re) => re.test(x)));
        chequear(`${tema}: producción coincide con el repo`, [faltaEnProd, sobraEnProd], [[], []]);
        for (const x of faltaEnProd) console.log(`         FALTA en producción: ${x}`);
        for (const x of sobraEnProd) console.log(`         SOBRA en producción: ${x}`);
      }
    }
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
if (faltaRetrato) {
  console.log(
    '\nLA FORMA DE PRODUCCIÓN NO SE COMPARÓ. Verde acá no quiere decir que la\n' +
      'base real coincida con el repo: ese chequeo no llegó a correr.'
  );
}
if (fallos.length) process.exit(1);
