// ¿QUÉ MIGRACIONES FALTAN EN PRODUCCIÓN?
//
//   npm run migraciones
//
// Lista las `migracion-NN-*.sql` del repo y, al lado, si producción ya la tiene.
// El estado sale de la BASE REAL (`version_del_esquema()`, anon, solo lectura),
// no de git ni de una etiqueta: git dice cuándo se escribió el archivo, no
// cuándo se aplicó, y una etiqueta a mano se desactualiza.
//
// LO QUE ESTO NO PUEDE SABER: la versión es una marca de agua —cada migración
// la sube a su número—, así que "aplicada" quiere decir "producción llegó a ese
// número o más". Si alguien salteara una del medio, esto no lo ve. La forma
// real de la base contra el repo la compara `npm run test:conexion`.
import { createClient } from '@supabase/supabase-js';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('Falta .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const migraciones = readdirSync(DIR)
  .map((f) => f.match(/^migracion-(\d+)-(.+)\.sql$/))
  .filter(Boolean)
  .map((m) => ({ n: Number(m[1]), nombre: m[2].replace(/-/g, ' ') }))
  .sort((a, b) => a.n - b.n);
const delRepo = Math.max(...migraciones.map((m) => m.n));

const { data: prod, error } = await createClient(url, key).rpc('version_del_esquema');
if (error || typeof prod !== 'number') {
  // No se adivina: sin la respuesta de la base no hay estado que mostrar.
  console.log(`No pude preguntarle la versión a producción: ${error?.message ?? `respondió ${JSON.stringify(prod)}`}`);
  process.exit(2);
}

const ancho = Math.max(...migraciones.map((m) => m.nombre.length));
// Las más nuevas arriba: lo que importa es lo que falta.
for (const m of [...migraciones].reverse()) {
  console.log(`  ${String(m.n).padStart(2)}  ${m.nombre.padEnd(ancho)}  ${m.n > prod ? 'PENDIENTE' : 'aplicada'}`);
}

const faltan = migraciones.filter((m) => m.n > prod);
console.log(`\nProducción: esquema ${prod}`);
console.log(`Repo:       ${delRepo}`);
console.log(faltan.length ? `Faltan:     ${faltan.length} (${faltan.map((m) => m.n).join(', ')})` : 'Faltan:     ninguna');
// LA LIMITACIÓN VA EN LA SALIDA y no solo en este comentario: el que lo usa
// mira la terminal, no el fuente.
console.log(
  '\nOJO: "aplicada" quiere decir que producción LLEGÓ a ese número o más, no que' +
    '\ncada una se haya aplicado. La versión es una marca de agua: si alguien' +
    '\nsalteara una del medio, esto no lo ve. La forma real de la base contra el' +
    '\nrepo la compara `npm run test:conexion`.'
);
// cron-racha.sql no sube la versión y su tabla (cron.job) no la lee un anónimo.
console.log('\ncron-racha.sql no cambia la versión: desde acá no se puede saber si corrió.');
