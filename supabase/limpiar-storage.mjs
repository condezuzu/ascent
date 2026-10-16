// LIMPIAR EL BUCKET DE FOTOS (15/10/2026).
//
// Borra lo que NO está en ningún álbum: archivos sin fila en `photos` (restos de
// pruebas: grande.bin, x.sh, e2e-*.png, *-priv.jpg, cuentas borradas) y miniaturas
// de fotos que ya no existen. NUNCA toca una foto que esté en un álbum ni su
// miniatura.
//
// Por la API de Storage y no con SQL: borrar la fila de `storage.objects` deja el
// archivo en el almacenamiento, y Supabase lo bloquea. La API necesita la llave de
// servicio, que NO está en el repo: va en `.env.local` como SUPABASE_SERVICE_ROLE_KEY
// y no se imprime nunca.
//
//   node --env-file=.env.local supabase/limpiar-storage.mjs            (solo lista)
//   node --env-file=.env.local supabase/limpiar-storage.mjs --borrar   (borra lo listado)
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !servicio) {
  console.log('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local (Supabase → Project Settings → API).');
  process.exit(1);
}
const borrar = process.argv.includes('--borrar');
const s = createClient(url, servicio, { auth: { persistSession: false } });

async function listar(carpeta) {
  const todo = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await s.storage.from('fotos').list(carpeta, { limit: 1000, offset: desde });
    if (error) throw new Error(`listar ${carpeta || '(raíz)'}: ${error.message}`);
    todo.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return todo;
}

// Las carpetas son una por cuenta; adentro, los archivos.
const archivos = [];
for (const c of await listar('')) {
  if (c.id) {
    archivos.push({ ruta: c.name, kb: Math.round((c.metadata?.size ?? 0) / 1024) });
    continue;
  }
  for (const a of await listar(c.name)) archivos.push({ ruta: `${c.name}/${a.name}`, kb: Math.round((a.metadata?.size ?? 0) / 1024) });
}

const { data: fotos, error: eFotos } = await s.from('photos').select('storage_path');
if (eFotos) throw new Error(`photos: ${eFotos.message}`);
const enAlbum = new Set();
for (const f of fotos ?? []) {
  enAlbum.add(f.storage_path);
  enAlbum.add(f.storage_path.replace(/\.jpe?g$/i, '') + '.mini.jpg');
}

const sobran = archivos.filter((a) => !enAlbum.has(a.ruta));
console.log(`En el bucket: ${archivos.length}. En algún álbum (o su miniatura): ${archivos.length - sobran.length}. Sin álbum: ${sobran.length}.\n`);
for (const a of sobran) console.log(`  ${a.kb.toString().padStart(6)} KB  ${a.ruta}`);

if (!borrar) {
  console.log('\nNo se borró nada. Para borrar estos, de nuevo con --borrar.');
  process.exit(0);
}
let borrados = 0;
for (let i = 0; i < sobran.length; i += 100) {
  const tanda = sobran.slice(i, i + 100).map((a) => a.ruta);
  const { data, error } = await s.storage.from('fotos').remove(tanda);
  if (error) {
    console.log(`  no se pudo borrar una tanda: ${error.message}`);
    continue;
  }
  borrados += data?.length ?? 0;
}
console.log(`\nBorrados: ${borrados} de ${sobran.length}.`);
