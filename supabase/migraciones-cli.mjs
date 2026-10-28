// LAS MIGRACIONES POR LA CLI DE SUPABASE (28/10/2026: desde ahora las aplica Claude, no el SQL Editor).
//
// La fuente sigue siendo `supabase/migracion-NN-nombre.sql`: test:db, la deriva y los comentarios
// las nombran así. La CLI, en cambio, lee `supabase/migrations/<versión>_<nombre>.sql`. Este script
// arma esa carpeta copiando cada una con la versión en tres cifras (001…097, que ordenan bien como
// texto) y le pasa el resto de los argumentos a la CLI. La carpeta es generada: va en .gitignore.
//
//   node supabase/migraciones-cli.mjs migration list --linked
//   node supabase/migraciones-cli.mjs db push --linked --dry-run
import { readdirSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(AQUI, 'migrations');
rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO);
let n = 0;
for (const f of readdirSync(AQUI)) {
  const m = /^migracion-(\d+)-(.+)\.sql$/.exec(f);
  if (!m) continue;
  copyFileSync(join(AQUI, f), join(DESTINO, `${m[1].padStart(3, '0')}_${m[2].replace(/-/g, '_')}.sql`));
  n++;
}
console.log(`${n} migraciones copiadas a supabase/migrations/`);
const args = process.argv.slice(2);
if (args.length === 0) process.exit(0);
const r = spawnSync('npx', ['--no-install', 'supabase', ...args], { cwd: join(AQUI, '..'), stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
