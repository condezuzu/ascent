// ¿schema.sql desde cero produce la MISMA base que schema.sql + las migraciones?
//
// El repo promete que "en una base nueva no hace falta ninguna migración:
// schema.sql ya las incluye a todas". Nadie lo había comprobado nunca, y son
// dieciséis. Si divergieron, el día que se recree la base —o que alguien clone
// el repo— va a tener una base distinta a producción, y el error no va a
// aparecer hasta que algo se rompa raro.
//
// Cómo: dos PGlite.
//
//   A · "base nueva"  = el schema.sql de HOY, tal cual.
//   B · "producción"  = el schema.sql ORIGINAL (el del primer commit, que es
//                       el que se corrió el día que se creó la base) y encima
//                       las migraciones 01 a 16 en orden.
//
// El primer intento fue aplicar las migraciones sobre el schema de hoy, y
// estaba mal: las migraciones son históricas, no idempotentes contra un
// schema más nuevo. La 09 revienta con "cannot remove parameter defaults"
// porque la 13 ya le cambió el default a esa función. Reproducir la historia
// desde el principio es la única forma de comparar lo que hay que comparar.
//
// La base original sale de git, no de un archivo congelado: un archivo copiado
// se desactualiza en silencio y volveríamos a tener el mismo problema una
// capa más arriba.
import { PGlite } from '@electric-sql/pglite';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));

export { RETRATOS };

/**
 * Fin de línea uniforme. El archivo en disco viene con CRLF —git lo convierte
 * al hacer checkout en Windows— y `git show` lo devuelve con LF. Sin esto, el
 * md5 del cuerpo de CADA función daba distinto y el test denunciaba deriva en
 * las treinta, que es justo el resultado que hace que nadie le crea a un test.
 */
const lf = (sql) => sql.replace(/\r\n/g, '\n');

let ok = 0;
const fallos = [];
function chequear(nombre, real, esperado) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log(`  ok   ${nombre}`);
  } else {
    fallos.push(nombre);
    console.log(`  FALLA ${nombre}`);
  }
}

/**
 * El schema.sql que se corrió el día que se creó la base: el del commit donde
 * el archivo aparece por primera vez. Sale de git para que no pueda quedar
 * viejo.
 */
function schemaOriginal() {
  const sha = execFileSync('git', ['log', '--diff-filter=A', '--format=%H', '--', 'supabase/schema.sql'], {
    cwd: join(DIR, '..'),
    encoding: 'utf8',
  }).trim().split('\n').pop();
  if (!sha) throw new Error('no encuentro el commit original de schema.sql');
  return execFileSync('git', ['show', `${sha}:supabase/schema.sql`], {
    cwd: join(DIR, '..'),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

/**
 * Saca la parte de storage, que PGlite no tiene.
 *
 * El schema original no tiene la sección de PERMISOS —esa la trajo la
 * migración 01— así que ahí el bloque de storage llega hasta el final del
 * archivo. Si no se contempla, el corte no encuentra dónde terminar y devuelve
 * el archivo entero, que después revienta con `storage.buckets does not exist`.
 */
function sinStorage(sql) {
  const iniStorage = sql.indexOf('-- STORAGE: bucket privado de fotos');
  if (iniStorage === -1) return sql;
  const desde = sql.lastIndexOf('-- ----', iniStorage);
  const iniPermisos = sql.indexOf('-- PERMISOS (capa extra debajo de la RLS)');
  if (iniPermisos === -1) return sql.slice(0, desde);
  return sql.slice(0, desde) + sql.slice(sql.lastIndexOf('-- ----', iniPermisos));
}

const schemaDeHoy = () => sinStorage(lf(readFileSync(join(DIR, 'schema.sql'), 'utf8')));

/**
 * Las migraciones, en orden numérico. Se saltean las que solo tocan storage:
 * PGlite no tiene ese schema, así que no se pueden correr ni comparar acá.
 * Quedan cubiertas por `test:conexion`, que sí habla con Supabase.
 */
function migraciones() {
  return readdirSync(DIR)
    .filter((f) => /^migracion-\d+/.test(f))
    .sort()
    .map((f) => ({ nombre: f, sql: lf(readFileSync(join(DIR, f), 'utf8')) }))
    .filter((m) => !/^migracion-0[67]/.test(m.nombre));
}

async function nueva() {
  const db = new PGlite();
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
  return db;
}

// El retrato lo arma la BASE, con `retrato_del_schema()`. Vive en schema.sql
// y no acá porque el mismo retrato lo usa `test:conexion` contra producción,
// donde no hay forma de correr SQL suelto: si la consulta estuviera duplicada
// en los dos lados, tendríamos justo el problema que estos tests persiguen.
const RETRATOS = [
  'columnas',
  'restricciones',
  'índices',
  'funciones',
  'políticas',
  'permisos',
  'permisos de tabla',
  'triggers',
  'catálogo de ejercicios',
];

export async function retrato(db) {
  const filas = (await db.query('select que, f from retrato_del_schema() order by 1, 2')).rows;
  const r = Object.fromEntries(RETRATOS.map((q) => [q, []]));
  for (const x of filas) (r[x.que] ??= []).push(x.f);
  return r;
}


// =====================================================================
console.log('Deriva: la base nueva contra producción\n');

// A — la base nueva: el schema de hoy y nada más
const baseNueva = await nueva();
await baseNueva.exec(schemaDeHoy());

// B — producción: el schema original y encima toda la historia
const comoProduccion = await nueva();
await comoProduccion.exec(sinStorage(lf(schemaOriginal())));
const lista = migraciones();
for (const m of lista) {
  try {
    await comoProduccion.exec(sinStorage(m.sql));
  } catch (e) {
    console.log(`  FALLA no se pudo aplicar ${m.nombre}: ${e.message.split('\n')[0]}`);
    fallos.push(m.nombre);
  }
}
console.log(`schema original + ${lista.length} migraciones`);

const a = await retrato(baseNueva);
const b = await retrato(comoProduccion);

for (const que of RETRATOS) {
  const soloEnA = (a[que] ?? []).filter((x) => !(b[que] ?? []).includes(x));
  const soloEnB = (b[que] ?? []).filter((x) => !(a[que] ?? []).includes(x));
  chequear(`${que}: sin diferencias`, { soloEnBaseNueva: soloEnA, soloEnProduccion: soloEnB }, {
    soloEnBaseNueva: [],
    soloEnProduccion: [],
  });
  for (const x of soloEnA) console.log(`         SOLO en base nueva:  ${x}`);
  for (const x of soloEnB) console.log(`         SOLO en producción:  ${x}`);
}

console.log(`\n${ok} pasaron, ${fallos.length} fallaron`);
if (fallos.length) {
  console.log(
    '\nLas dos bases divergieron. NO juntar a ciegas: hay que mirar cada\n' +
      'diferencia y decidir cuál de las dos es la correcta.'
  );
  process.exit(1);
}
