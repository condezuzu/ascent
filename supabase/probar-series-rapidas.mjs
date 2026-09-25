// ¿EL CONTADOR, LA LISTA Y LA BASE COINCIDEN DESPUÉS DE VARIAS SERIES SEGUIDAS?
//
// El bug del gimnasio (27/9): terminar series rápido dejaba el contador una
// atrás mientras la lista llegaba entera. La raíz estaba en el cliente —leía el
// número del render y dos toques se pisaban—; se arregló en `useSesion` +
// `nucleo/conteo.ts`. Esta prueba mira el OTRO extremo, la base: recorre el
// camino real (cuenta de verdad, anon + RLS) y comprueba que, con la secuencia
// que manda el cliente ARREGLADO, `sesiones.series` y `sesiones.bloques` quedan
// en el mismo número.
//
// Y documenta la carrera que el humano sospechaba: `fijar_series` guarda el
// TOTAL absoluto, así que si dos escrituras llegan desordenadas la más vieja
// pisa a la nueva. La cola (`compartido/cola.ts`) es la que evita el desorden:
// colapsa por sesión y manda en orden. Acá se muestran las dos cosas.
//
//   node --env-file=.env.local supabase/probar-series-rapidas.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (usá --env-file=.env.local).');
  process.exit(1);
}

const cliente = () => createClient(url, anon, { auth: { persistSession: false } });
const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-series-${sello}@gmail.com`;
const clave = `Sr-${sello}-Kp3`;

const u = cliente();
let entrada = await u.auth.signUp({ email: correo, password: clave });
if (entrada.error) entrada = await u.auth.signInWithPassword({ email: correo, password: clave });
if (entrada.error || !entrada.data?.user) {
  console.error('  ✗ no se pudo crear/entrar la cuenta de prueba:', entrada.error?.message);
  process.exit(1);
}

console.log('\nSERIES RÁPIDAS — camino real (cuenta de prueba, anon + RLS)\n');
let fallas = 0;

try {
  const { data: ini, error: eIni } = await u.rpc('iniciar_sesion', { p_desde: null, p_origen: 'manual' });
  const idSesion = (ini && (ini.id ?? ini.sesion ?? ini.sesion_id)) || null;
  if (eIni || !idSesion) {
    console.error('  ✗ no se pudo iniciar la sesión:', eIni?.message ?? '(sin id)');
    process.exit(1);
  }

  // 1. LA SECUENCIA DEL CLIENTE ARREGLADO. Diez series al hilo: el total sube
  //    1..10 y la lista acumula 10. El cliente sube el TOTAL de cada paso; acá
  //    se mandan en orden, como los manda la cola.
  const N = 10;
  const bloques = [];
  for (let i = 1; i <= N; i++) {
    const { error: eS } = await u.rpc('fijar_series', { p_sesion: idSesion, p_series: i });
    if (eS) { console.error(`  ✗ fijar_series(${i}) falló: ${eS.message}`); fallas++; break; }
  }
  // La lista final: un bloque de N series de un ejercicio.
  bloques.push({ ejercicio: 'press_banca', series: N });
  const { error: eB } = await u.rpc('fijar_bloques', { p_sesion: idSesion, p_bloques: bloques });
  if (eB) { console.error(`  ✗ fijar_bloques falló: ${eB.message}`); fallas++; }

  const { data: fila } = await u.from('sesiones').select('series, bloques').eq('id', idSesion).single();
  const totalBase = fila?.series;
  const enLista = Array.isArray(fila?.bloques) ? fila.bloques.reduce((n, b) => n + (b.series ?? 0), 0) : 0;
  console.log(`  contador (base): ${totalBase}   lista (base): ${enLista}   esperado: ${N}`);
  if (totalBase === N && enLista === N) {
    console.log('  ✓ contador, lista y base coinciden en ' + N);
  } else {
    console.error('  ✗ NO coinciden');
    fallas++;
  }

  // 2. LA CARRERA, mostrada a propósito: una escritura vieja que llega última
  //    pisa a la nueva, porque el total es absoluto. Es lo que la cola evita al
  //    mandar en orden; acá se fuerza el desorden para dejarlo documentado.
  await u.rpc('fijar_series', { p_sesion: idSesion, p_series: 9 }); // "vieja" que llega tarde
  const { data: f2 } = await u.from('sesiones').select('series').eq('id', idSesion).single();
  console.log(`\n  (carrera) una escritura desordenada de 9 deja la base en: ${f2?.series}`);
  if (f2?.series === 9) {
    console.log('  ✓ confirmado: el total es absoluto, la última escritura gana.');
    console.log('    Por eso el cliente NO debe mandar números viejos (arreglado) y la');
    console.log('    cola manda en orden y colapsa por sesión (compartido/cola.ts).');
  } else {
    console.error('  ✗ comportamiento inesperado de fijar_series');
    fallas++;
  }
} finally {
  const { error: eBorrar } = await u.rpc('eliminar_cuenta');
  if (eBorrar) console.error('  (aviso: no se pudo borrar la cuenta de prueba:', eBorrar.message, ')');
}

console.log('');
if (fallas) {
  console.error(`SERIES RÁPIDAS: ${fallas} problema(s).`);
  process.exit(1);
}
console.log('SERIES RÁPIDAS: el contador y la lista terminan en el mismo número.\n');
