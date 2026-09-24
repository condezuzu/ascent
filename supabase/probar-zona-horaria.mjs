// ¿EL DÍA SE CUENTA EN EL HUSO DEL TELÉFONO? — la prueba de la zona horaria.
//
// La App Store es mundial. El servidor cuenta "hoy" con `hoy_de()`, que hace
// `now() at time zone profiles.zona`; la app fija esa zona con `fijar_zona` al
// entrar y al volver al frente (ver `movil/src/zonaHoraria.ts`). Esta prueba
// recorre el camino REAL —una cuenta de verdad, por la anon key y con RLS—
// en tres husos que cruzan la medianoche entre sí:
//
//   UTC-3   America/Argentina/Buenos_Aires
//   UTC+9   Asia/Tokyo
//   UTC+11  Pacific/Guadalcanal   (sin horario de verano: +11 estable)
//
// Para cada uno: `fijar_zona(zona)` y después `mi_hoy()`, y se compara contra
// la fecha que ese mismo instante tiene en ese huso, calculada con `Intl` (que
// en Node trae ICU completo). Si el servidor cuenta bien, las tres coinciden.
// En buena parte del día UTC las tres fechas NO son iguales —entre Buenos Aires
// y Guadalcanal hay 14 horas—, y ahí está la prueba de la medianoche: cada una
// tiene que dar SU fecha local, no la uruguaya.
//
// Al final borra la cuenta de prueba. NO usa la cuenta demo a propósito:
// `fijar_zona` marca `zona_cambiada = now()`, que activa el bloqueo antiabuso
// de 20 h, y dejar eso puesto en la cuenta del revisor sería sabotearla.
//
//   node --env-file=.env.local supabase/probar-zona-horaria.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (usá --env-file=.env.local).');
  process.exit(1);
}

const ZONAS = [
  { zona: 'America/Argentina/Buenos_Aires', etiqueta: 'UTC-3' },
  { zona: 'Asia/Tokyo', etiqueta: 'UTC+9' },
  { zona: 'Pacific/Guadalcanal', etiqueta: 'UTC+11' },
];

/** La fecha 'YYYY-MM-DD' que `instante` tiene mirado desde `zona`. */
function fechaEn(zona, instante) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

const cliente = () => createClient(url, anon, { auth: { persistSession: false } });

const sello = Date.now().toString(36);
const correo = `agusconde20+ascent-zona-${sello}@gmail.com`;
const clave = `Zn-${sello}-Kp3`;

const u = cliente();
console.log('\nZONA HORARIA — recorriendo el camino real (cuenta de prueba, anon + RLS)\n');

// signUp: este proyecto autoconfirma (lo hacen ya `cuenta-de-revision` y la
// batería), así que la cuenta queda usable en el acto.
let entrada = await u.auth.signUp({ email: correo, password: clave });
if (entrada.error) {
  entrada = await u.auth.signInWithPassword({ email: correo, password: clave });
}
if (entrada.error || !entrada.data?.user) {
  console.error('  ✗ no se pudo crear/entrar la cuenta de prueba:', entrada.error?.message);
  process.exit(1);
}

let fallas = 0;
const filas = [];
try {
  for (const { zona, etiqueta } of ZONAS) {
    const { error: eFijar } = await u.rpc('fijar_zona', { p_zona: zona });
    if (eFijar) {
      console.error(`  ✗ fijar_zona(${zona}) falló: ${eFijar.message}`);
      fallas++;
      continue;
    }
    // El instante se toma DESPUÉS de fijar y justo antes de leer, para comparar
    // contra el mismo "ahora" que verá el servidor (la diferencia es de ms).
    const instante = new Date();
    const { data: hoy, error: eHoy } = await u.rpc('mi_hoy');
    if (eHoy) {
      console.error(`  ✗ mi_hoy() falló con zona ${zona}: ${eHoy.message}`);
      fallas++;
      continue;
    }
    const esperado = fechaEn(zona, instante);
    const ok = hoy === esperado;
    if (!ok) fallas++;
    filas.push({ etiqueta, zona, servidor: hoy, esperado, ok });
  }
} finally {
  const { error: eBorrar } = await u.rpc('eliminar_cuenta');
  if (eBorrar) console.error('  (aviso: no se pudo borrar la cuenta de prueba:', eBorrar.message, ')');
}

const anchoZ = Math.max(...filas.map((f) => f.zona.length), 4);
console.log(`  ${'zona'.padEnd(anchoZ)}  huso    servidor      Intl (esperado)   `);
for (const f of filas) {
  console.log(
    `  ${f.zona.padEnd(anchoZ)}  ${f.etiqueta.padEnd(6)}  ${String(f.servidor).padEnd(12)}  ${f.esperado.padEnd(16)}  ${f.ok ? 'OK' : '✗ NO COINCIDE'}`
  );
}

const distintas = new Set(filas.map((f) => f.servidor)).size;
console.log('');
if (distintas > 1) {
  console.log(`  En este instante los husos caen en ${distintas} fechas distintas: la medianoche`);
  console.log('  está cruzada entre ellos y cada uno cuenta su día local, no el uruguayo.\n');
} else {
  console.log('  (En este instante los tres husos caen en la misma fecha; la comparación por');
  console.log('   huso igual vale: cada mi_hoy() coincide con su fecha local.)\n');
}

if (fallas) {
  console.error(`ZONA HORARIA: ${fallas} problema(s). El día NO se cuenta bien en algún huso.`);
  process.exit(1);
}
console.log('ZONA HORARIA: el día se cuenta en el huso del teléfono en los tres casos.\n');
