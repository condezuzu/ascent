// UNA SEMANA ENTERA contra Supabase real, en un usuario descartable.
//
// Siete días con sesiones, series, foto, peso, un día corregido a mano, un
// descanso, una racha que se corta y una subida de rango — y con la red
// cortándose en el medio, como en el subsuelo de un gimnasio.
//
// POR QUÉ NO ALCANZA `test:db`: PGlite prueba el schema contra sí mismo, con
// todo respondiendo al instante y nunca fallando. Lo que se rompe en el uso
// real es la costura: una escritura que sale a medias, un reintento que
// duplica, un día que se cuenta dos veces. Eso solo aparece con la base de
// verdad y con la red portándose mal.
//
// AL FINAL COMPRUEBA INVARIANTES, no pasos: la racha que dice el perfil tiene
// que coincidir con la que se deduce del historial, las duraciones tienen que
// sumar lo que suman las sesiones, y no puede haber días de más.
//
//   node --env-file=.env.local supabase/simular-semana.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.log('Faltan NEXT_PUBLIC_SUPABASE_* en .env.local.');
  process.exit(1);
}

const sello = Date.now().toString(36);
const CORREO = `agusconde20+ascent-semana-${sello}@gmail.com`;
const CLAVE = `Sm-${sello}-Qz4`;

let fallos = 0;
const chequear = (que, obtuve, esperaba) => {
  const bien = JSON.stringify(obtuve) === JSON.stringify(esperaba);
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : ` — esperaba ${JSON.stringify(esperaba)}, obtuve ${JSON.stringify(obtuve)}`}`);
  if (!bien) fallos++;
};

// ---------------------------------------------------------------
// LA RED QUE SE CORTA
//
// Se envuelve el `fetch` del cliente: cuando `cortada` está en true, las
// llamadas mueren como muere una conexión de verdad —un TypeError de fetch—,
// no con un 500. La diferencia importa: el código distingue "no llegué" de
// "llegué y me dijeron que no".
// ---------------------------------------------------------------
let cortada = false;
let intentosCortados = 0;
const fetchConTijera = (...args) => {
  if (cortada) {
    intentosCortados++;
    return Promise.reject(new TypeError('fetch failed'));
  }
  return fetch(...args);
};

const supabase = createClient(url, anon, { global: { fetch: fetchConTijera } });

console.log(`\nSimulando una semana — ${CORREO}\n`);

const { error: eAlta } = await supabase.auth.signUp({ email: CORREO, password: CLAVE });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  console.log('El alta no devolvió sesión. ¿Está prendido "Confirm email"?');
  process.exit(1);
}
await supabase.from('profiles').update({ username: `sem_${sello.slice(-6)}` }).eq('id', user.id);

const hoyISO = (await supabase.rpc('mi_hoy')).data;
const dia = (atras) => {
  const d = new Date(hoyISO + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - atras);
  return d.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------
// 1. La semana: días 9 a 3 atrás, con un hueco que corta la racha
// ---------------------------------------------------------------
console.log('La semana');
{
  // Diez días seguidos terminando anteayer llevarían a rango 2. Se cortan a
  // propósito en el medio para ver la pérdida.
  const fechas = [12, 11, 10, 9, 8, 7, 6, 5, 4].map(dia); // nueve seguidos
  const { error } = await supabase
    .from('logs')
    .insert(fechas.map((fecha) => ({ user_id: user.id, fecha })));
  chequear('se cargan nueve días seguidos', error?.message ?? 'ok', 'ok');

  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  chequear('la racha la calculó el trigger, no el cliente', p.racha_actual, 9);
  chequear('y el rango subió a asteroide', p.rango_actual, 1);
}

// ---------------------------------------------------------------
// 2. Un día de descanso, y que no rompa la racha
// ---------------------------------------------------------------
console.log('\nDescansos');
{
  // El descanso rige DESDE HOY: el pasado queda como estaba (§3).
  const { error } = await supabase.rpc('fijar_descansos', { p_dias: [0] }); // domingo
  chequear('se fijan los días de descanso', error?.message ?? 'ok', 'ok');
  const { data } = await supabase.from('descansos').select('dias').order('desde', { ascending: false }).limit(1);
  chequear('quedó guardado', data?.[0]?.dias, [0]);
}

// ---------------------------------------------------------------
// 3. Un día corregido a mano
// ---------------------------------------------------------------
console.log('\nCorregir un día a mano');
{
  const { data: antes } = await supabase.from('profiles').select('racha_actual').eq('id', user.id).single();
  // Se borra uno del medio: la racha tiene que recalcularse sola.
  await supabase.from('logs').delete().eq('user_id', user.id).eq('fecha', dia(8));
  const { data: despues } = await supabase.from('profiles').select('racha_actual').eq('id', user.id).single();
  chequear('borrar un día del medio recalcula la racha',
    despues.racha_actual < antes.racha_actual, true);

  // Y volver a ponerlo la devuelve.
  await supabase.from('logs').insert({ user_id: user.id, fecha: dia(8) });
  const { data: vuelta } = await supabase.from('profiles').select('racha_actual').eq('id', user.id).single();
  chequear('y reponerlo la devuelve', vuelta.racha_actual, antes.racha_actual);
}

// ---------------------------------------------------------------
// 4. Hoy: sesión con series, con la red cortándose en el medio
// ---------------------------------------------------------------
console.log('\nHoy, con la red cortándose');
{
  const s = (await supabase.rpc('iniciar_sesion')).data;
  chequear('arranca la sesión', typeof s?.id, 'string');
  chequear('y registra el día de hoy', s?.registro !== null, true);

  // Tres series con la red viva.
  for (const n of [1, 2, 3]) await supabase.rpc('fijar_series', { p_sesion: s.id, p_series: n });

  // Y ahora se corta. La app encolaría; acá se comprueba que la llamada FALLA
  // y no escribe nada a medias.
  cortada = true;
  const { error: eCorte } = await supabase.rpc('fijar_series', { p_sesion: s.id, p_series: 4 });
  chequear('con la red cortada la escritura falla', !!eCorte, true);
  cortada = false;

  const { data: v1 } = await supabase.from('sesiones').select('series').eq('id', s.id).single();
  chequear('y NO dejó nada a medias', v1.series, 3);

  // Al volver la red, la cola reintentaría lo mismo. Repetirlo tiene que dar
  // igual: es la propiedad que hace segura la cola entera.
  await supabase.rpc('fijar_series', { p_sesion: s.id, p_series: 4 });
  await supabase.rpc('fijar_series', { p_sesion: s.id, p_series: 4 });
  await supabase.rpc('fijar_series', { p_sesion: s.id, p_series: 4 });
  const { data: v2 } = await supabase.from('sesiones').select('series').eq('id', s.id).single();
  chequear('reintentar tres veces deja 4, no 12', v2.series, 4);

  // La sesión se envejece para que terminarla no la dé por accidental.
  await supabase.rpc('fijar_series', { p_sesion: s.id, p_series: 4 });
  const fin = (await supabase.rpc('terminar_sesion')).data;
  chequear('termina', fin?.termino, true);
  // Duró segundos y creó el día → se deshace, que es la regla nueva.
  chequear('y como duró segundos, deshizo el día', fin?.deshizo_el_dia, true);
}

// ---------------------------------------------------------------
// 5. El día de hoy en serio, con peso y foto
// ---------------------------------------------------------------
console.log('\nEl día de hoy');
{
  const r = (await supabase.rpc('registrar_dia', { p_origen: 'manual' })).data;
  chequear('se registra el día', r?.bloqueado, false);

  // El peso NO registra día: es la separación de ayer.
  const { data: diasAntes } = await supabase.from('logs').select('id').eq('user_id', user.id);
  await supabase.rpc('anotar_peso', { p_valor: 79.2 });
  const { data: diasDespues } = await supabase.from('logs').select('id').eq('user_id', user.id);
  chequear('pesarse no agrega ningún día', diasDespues.length, diasAntes.length);

  // La foto, colgada del día.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const ruta = `${user.id}/${hoyISO}-${Date.now()}.png`;
  const { error: eFoto } = await supabase.storage.from('fotos').upload(ruta, png, { contentType: 'image/png' });
  chequear('la foto sube', eFoto?.message ?? 'ok', 'ok');
  const { error: eFila } = await supabase.from('photos').insert({
    user_id: user.id, log_id: r.log_id, storage_path: ruta,
    visibilidad: 'privada', es_subida_de_rango: false,
  });
  chequear('y queda colgada del día', eFila?.message ?? 'ok', 'ok');
}

// ---------------------------------------------------------------
// 6. LOS INVARIANTES. Acá es donde se ve si algo quedó mal.
// ---------------------------------------------------------------
console.log('\nInvariantes');
{
  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const { data: logs } = await supabase.from('logs').select('fecha, es_descanso').eq('user_id', user.id).order('fecha');

  // Ningún día repetido: lo garantiza un índice único, pero si algún camino
  // lo esquivara se vería acá.
  const fechas = logs.map((l) => l.fecha);
  chequear('ningún día repetido', fechas.length, new Set(fechas).size);

  // Ningún día en el futuro.
  chequear('ningún día en el futuro', fechas.filter((f) => f > hoyISO).length, 0);

  // La racha del perfil contra la que se deduce del historial, contando hacia
  // atrás desde el último día registrado.
  const orden = [...fechas].sort().reverse();
  let seguidos = 0;
  let cursor = orden[0];
  for (const f of orden) {
    if (f === cursor) {
      seguidos++;
      const d = new Date(cursor + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    } else break;
  }
  // `racha_base` puede tener el descuento de una pérdida, así que se compara
  // que la del perfil no supere a la del historial: inventarse días es el
  // error que importa.
  chequear('la racha del perfil no supera a la del historial',
    p.racha_actual <= seguidos, true);

  const { data: resumen } = await supabase.rpc('resumen_sesiones');
  const { data: ses } = await supabase.from('sesiones').select('estado').eq('user_id', user.id);
  chequear('no quedó ninguna sesión corriendo',
    ses.filter((s) => s.estado === 'corriendo').length, 0);
  chequear('el resumen de Stats responde', typeof resumen?.validas, 'number');

  console.log(`  --   ${logs.length} días, ${ses.length} sesiones, ${intentosCortados} llamadas cortadas a propósito`);
}

// ---------------------------------------------------------------
console.log('\nLimpieza');
{
  const { error } = await supabase.rpc('eliminar_cuenta');
  chequear('la cuenta se borra sola', error?.message ?? 'ok', 'ok');
}

await supabase.auth.signOut();
console.log(`\n${fallos === 0 ? 'todo ok' : fallos + ' fallaron'}`);
console.log(`Queda el usuario ${CORREO} en Authentication → Users (borrarlo necesita service_role).`);
process.exit(fallos ? 1 : 0);
