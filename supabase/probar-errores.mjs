// ¿EL BUZÓN DE ERRORES ACEPTA ESCRITURAS Y NO DEJA LEER? — la prueba de RLS.
//
// El contrato de `errores_js` (migración 49): inserta CUALQUIERA —incluso sin
// sesión, porque un error puede pasar en el login—, y NADIE lee desde el
// cliente (solo el dueño, por el panel). Esto lo comprueba por la anon key, sin
// sesión, que es el peor caso:
//
//   1. insertar sin sesión  → tiene que ENTRAR
//   2. leer sin sesión      → tiene que volver VACÍO (RLS, sin policy de select)
//
// NO borra la fila de prueba: anon no tiene grant de delete (correcto). La fila
// va marcada para que se reconozca y se pueda limpiar del panel.
//
//   node --env-file=.env.local supabase/probar-errores.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (usá --env-file=.env.local).');
  process.exit(1);
}

const s = createClient(url, anon, { auth: { persistSession: false } });
const sello = Date.now().toString(36);
let fallas = 0;

console.log('\nBUZÓN DE ERRORES — anon, sin sesión (el peor caso)\n');

// 1. insertar sin sesión
const { error: eIns } = await s.from('errores_js').insert({
  mensaje: `PRUEBA test:errores ${sello} — se puede borrar`,
  stack: 'sin pila (prueba)',
  pantalla: 'probar-errores.mjs',
  version_app: 'prueba',
  version_ota: 'prueba',
  plataforma: 'node',
  id_anonimo: `prueba-${sello}`,
});
if (eIns) {
  console.error('  ✗ un anon NO pudo insertar (debería):', eIns.message);
  fallas++;
} else {
  console.log('  ✓ un anon inserta sin sesión');
}

// 2. leer sin sesión → vacío (no error: RLS sin policy de select devuelve 0 filas)
const { data: leido, error: eLeer } = await s.from('errores_js').select('id').limit(5);
if (eLeer) {
  // Un error también sirve: significa que no puede leer. Pero lo normal es 0 filas.
  console.log('  ✓ un anon NO puede leer (error de permiso):', eLeer.message.slice(0, 60));
} else if ((leido?.length ?? 0) === 0) {
  console.log('  ✓ un anon lee VACÍO (RLS no expone ninguna fila)');
} else {
  console.error(`  ✗ un anon LEYÓ ${leido.length} fila(s) — la tabla NO debería exponerse`);
  fallas++;
}

// 3. un check de largo rebota (el tope que acota un insert abierto)
const { error: eLargo } = await s.from('errores_js').insert({ mensaje: 'x'.repeat(2001) });
if (eLargo) {
  console.log('  ✓ un mensaje demasiado largo rebota (check de largo)');
} else {
  console.error('  ✗ un mensaje de 2001 caracteres entró — el check de largo no está');
  fallas++;
}

console.log('');
if (fallas) {
  console.error(`BUZÓN DE ERRORES: ${fallas} problema(s).`);
  process.exit(1);
}
console.log('BUZÓN DE ERRORES: inserta cualquiera, no lee nadie, y el largo está acotado.\n');
