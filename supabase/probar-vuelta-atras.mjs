// ¿El cliente nuevo aguanta una producción SIN la migración 24?
//
// Entre el push y la migración —que la corre una persona a mano— hay una
// ventana en la que el código nuevo le pide a la base una función que todavía
// no existe. Si la vuelta atrás de `usarSesion` no funciona, en esa ventana no
// se puede ni empezar ni terminar una sesión: la app está rota y el error es un
// `PGRST202` que no le dice nada a nadie.
//
// Esto lo comprueba contra la base de verdad, que es el único lugar donde el
// código de error es el que es. Se corre ANTES de la migración; después pasa a
// decir que ya no hace falta, que también es una respuesta útil.
//
//   node --env-file=.env.local supabase/probar-vuelta-atras.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const correo = process.env.CONEXION_EMAIL;
const clave = process.env.CONEXION_PASSWORD;

if (!url || !key || !correo || !clave) {
  console.log('Faltan variables en .env.local. No se comprobó nada.');
  process.exit(0);
}

const supabase = createClient(url, key);
const { error: eLogin } = await supabase.auth.signInWithPassword({
  email: correo,
  password: clave,
});
if (eLogin) {
  console.log(`No pude entrar como ${correo}: ${eLogin.message}`);
  process.exit(1);
}

let fallos = 0;
const chequear = (que, bien, detalle = '') => {
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${detalle ? ' — ' + detalle : ''}`);
  if (!bien) fallos++;
};

// Estado limpio: si quedó una sesión de una corrida anterior, se cierra.
await supabase.rpc('terminar_sesion');

console.log('\nLa firma nueva contra la producción de ahora');
const nueva = await supabase.rpc('iniciar_sesion', {
  p_desde: new Date(Date.now() - 60_000).toISOString(),
  p_origen: 'ubicacion',
});

const migracionCorrida = !nueva.error;

if (migracionCorrida) {
  console.log('  --   la migración 24 YA está corrida: la vuelta atrás no se usa más');
  const s = await supabase.rpc('mi_sesion');
  chequear('la sesión arrancó y dice de dónde salió', s.data?.origen === 'ubicacion',
    `origen = ${s.data?.origen}`);
  const atras = (Date.now() - Date.parse(s.data?.inicio ?? 0)) / 1000;
  chequear('y arrancó un minuto atrás, no ahora', atras > 30 && atras < 300,
    `${Math.round(atras)} s`);
} else {
  chequear(
    'sin la migración, la firma nueva da PGRST202',
    nueva.error.code === 'PGRST202',
    `código = ${nueva.error.code}: ${nueva.error.message?.slice(0, 90)}`
  );
  // Y ESTO es lo que importa: que la vuelta atrás salve la situación.
  const vieja = await supabase.rpc('iniciar_sesion');
  chequear(
    'y la firma vieja sigue funcionando: la app NO se rompe',
    !vieja.error,
    vieja.error ? vieja.error.message : ''
  );
}

console.log('\nCerrar');
const cierreNuevo = await supabase.rpc('terminar_sesion', { p_hasta: null });
if (cierreNuevo.error) {
  chequear('sin la migración, cerrar con la firma nueva da PGRST202',
    cierreNuevo.error.code === 'PGRST202', `código = ${cierreNuevo.error.code}`);
  const cierreViejo = await supabase.rpc('terminar_sesion');
  chequear('y la firma vieja cierra igual', !cierreViejo.error,
    cierreViejo.error ? cierreViejo.error.message : '');
} else {
  chequear('la sesión quedó cerrada', cierreNuevo.data?.termino === true);
}

await supabase.auth.signOut();
console.log(`\n${fallos === 0 ? 'todo ok' : fallos + ' fallaron'}`);
process.exit(fallos ? 1 : 0);
