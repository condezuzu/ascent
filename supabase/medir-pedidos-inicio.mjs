// LOS PEDIDOS DE INICIO: cuántos son, cuántos van en fila, y cuánto se ganaría.
//
// La medición por pantalla dejó el dato crudo: Inicio hace 18 pedidos y 11
// arrancan DESPUÉS de que otro terminó. En localhost eso no se nota; con datos
// móviles cada espera en fila se paga entera.
//
// Esto lo mide contra el Supabase de verdad, desde afuera del navegador:
//
//   1. UNA IDA Y VUELTA, sola: el piso. Nada puede ser más rápido que esto.
//   2. LA SECUENCIA DE HOY, con sus cuatro tandas encadenadas.
//   3. TODO EN PARALELO: lo que se ganaría solo con no encadenar.
//   4. DOS PEDIDOS: lo que costaría si se juntara en dos funciones.
//
// Y con eso se estima qué pasa en una red lenta: se multiplica la cantidad de
// IDAS Y VUELTAS por la latencia de una red móvil, que es lo que cambia entre
// wifi y datos. La cuenta se hace con números medidos, no inventados.
//
//   node --env-file=.env.local supabase/medir-pedidos-inicio.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, anon, { auth: { persistSession: false } });

const { error } = await supabase.auth.signInWithPassword({
  email: process.env.CONEXION_EMAIL,
  password: process.env.CONEXION_PASSWORD,
});
if (error) {
  console.log('no se pudo entrar:', error.message);
  process.exit(1);
}
const uid = (await supabase.auth.getUser()).data.user.id;
const hoy = (await supabase.rpc('mi_hoy')).data;
const restar = (n) => {
  const d = new Date(hoy + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const cronometrar = async (fn, vueltas = 5) => {
  await fn();
  const t = [];
  for (let i = 0; i < vueltas; i++) {
    const t0 = performance.now();
    await fn();
    t.push(performance.now() - t0);
  }
  t.sort((a, b) => a - b);
  return Math.round(t[Math.floor(t.length / 2)]);
};

// ---- 1. el piso: una sola ida y vuelta ----
const unaVuelta = await cronometrar(() => supabase.from('profiles').select('id').eq('id', uid).single(), 9);

// ---- 2. la secuencia de hoy ----
// Las cuatro tandas, en el mismo orden y con las mismas dependencias que la
// pantalla: cada tanda espera a la anterior.
const hoyDia = async () => {
  // tanda 1: quién soy y lo mío
  await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('mi_sesion'),
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(), // el vigilante pide el suyo
    supabase.from('logs').select('*').eq('user_id', uid).gte('fecha', restar(6)),
    supabase.rpc('verificar_perdida'),
    supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
  ]);
  // tanda 2: lo social, que necesita el uid
  const { data: amigos } = await supabase.from('friendships').select('*');
  await supabase.from('challenges').select('*');
  // tanda 3: lo que depende del perfil
  await Promise.all([
    supabase.rpc('mis_impulsos'),
    supabase.rpc('mi_fuerza'),
    supabase.auth.getUser(),
  ]);
  // tanda 4: las rachas de los amigos
  const ids = (amigos ?? []).slice(0, 10).map((a) => (a.solicitante === uid ? a.destinatario : a.solicitante));
  await Promise.all([
    supabase.from('logs').select('user_id, fecha').in('user_id', ids.length ? ids : [uid]),
    supabase.from('usuarios_publicos').select('*').limit(20),
  ]);
};

// ---- 3. lo mismo, sin encadenar nada ----
const enParalelo = async () => {
  await Promise.all([
    supabase.rpc('mi_sesion'),
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    supabase.from('logs').select('*').eq('user_id', uid).gte('fecha', restar(6)),
    supabase.rpc('verificar_perdida'),
    supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
    supabase.rpc('mis_impulsos'),
    supabase.rpc('mi_fuerza'),
    supabase.from('friendships').select('*'),
    supabase.from('challenges').select('*'),
    supabase.from('usuarios_publicos').select('*').limit(20),
  ]);
};

// ---- 4. dos pedidos: lo esencial y lo social ----
// No se puede probar la función que no existe todavía, así que se mide el
// COSTO DE LA FORMA: dos idas y vueltas en paralelo, una de ellas con un
// trabajo parecido al que haría la función junta.
const dosPedidos = async () => {
  await Promise.all([supabase.rpc('verificar_perdida'), supabase.rpc('mi_fuerza')]);
};

const hoyMs = await cronometrar(hoyDia, 5);
const paraleloMs = await cronometrar(enParalelo, 5);
const dosMs = await cronometrar(dosPedidos, 5);

console.log(`\nDesde acá, con esta red:`);
console.log(`  una ida y vuelta sola          ${String(unaVuelta).padStart(5)} ms`);
console.log(`  la secuencia de HOY (4 tandas) ${String(hoyMs).padStart(5)} ms`);
console.log(`  todo en paralelo (1 tanda)     ${String(paraleloMs).padStart(5)} ms`);
console.log(`  dos pedidos juntos             ${String(dosMs).padStart(5)} ms`);

// Lo que importa no son los milisegundos de acá sino las IDAS Y VUELTAS: eso
// es lo que se multiplica en una red lenta.
console.log(`\nEn una red móvil, estimado por idas y vueltas en fila:`);
console.log(`  latencia    hoy (4 en fila)   en paralelo (1)   juntado (1)`);
for (const rtt of [40, 120, 250, 400]) {
  const base = hoyMs - unaVuelta * 4;
  console.log(
    `  ${String(rtt).padStart(4)} ms   ${String(Math.round(base + rtt * 4)).padStart(9)} ms   ` +
      `${String(Math.round(paraleloMs - unaVuelta + rtt)).padStart(11)} ms   ` +
      `${String(Math.round(dosMs - unaVuelta + rtt)).padStart(9)} ms`
  );
}
await supabase.auth.signOut();
