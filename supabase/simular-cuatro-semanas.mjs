// CUATRO SEMANAS contra Supabase real, en una cuenta descartable.
//
// Reemplaza a `simular-semana.mjs`, que había quedado vieja: esperaba que una
// sesión de segundos deshiciera el día aunque tuviera series, y la regla
// cambió (el toque accidental exige cero series). Al fallar ahí, cortaba antes
// de borrar la cuenta.
//
// LO QUE SE PUEDE Y LO QUE NO. El pasado entra por el mismo camino que usa el
// calendario para corregir: filas de `logs` con fecha vieja y después
// `recalcular_desde_cero`. Las sesiones, en cambio, solo pueden empezar AHORA
// (`iniciar_sesion` usa el reloj del servidor, a propósito). Por eso la
// historia son cuatro semanas de días y el presente es un día entero con
// sesiones, pesos, foto y marcas. Lo que depende de "que pasen los días de a
// uno" —la pérdida que corre cada mañana— se arma dejando el hueco justo antes
// de hoy, que es el único lugar donde la base lo mira.
//
// DOS FORMAS DE QUE FALLE LA RED, y no una:
// - CORTADA: la llamada no llega. Tiene que devolver error, nunca "ok".
// - RESPUESTA PERDIDA: la llamada LLEGA y escribe, pero la respuesta no vuelve.
//   Es la de verdad en un subsuelo, y la que duplica: el cliente reintenta algo
//   que ya se hizo.
//
// AL FINAL, INVARIANTES contra un ORÁCULO: la racha se vuelve a calcular acá,
// en JavaScript y desde las filas, con la misma regla escrita de nuevo. Si el
// perfil y el oráculo difieren, uno de los dos está mal.
//
//   node --env-file=.env.local supabase/simular-cuatro-semanas.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.log('Faltan NEXT_PUBLIC_SUPABASE_* en .env.local.');
  process.exit(1);
}

const sello = Date.now().toString(36);
const CORREO = `agusconde20+ascent-cuatro-${sello}@gmail.com`;
const CLAVE = `Cs-${sello}-Wq7`;

let fallos = 0;
const hallazgos = [];
const chequear = (que, obtuve, esperaba) => {
  const bien = JSON.stringify(obtuve) === JSON.stringify(esperaba);
  console.log(`  ${bien ? 'ok  ' : 'FALLA'} ${que}${bien ? '' : ` — esperaba ${JSON.stringify(esperaba)}, obtuve ${JSON.stringify(obtuve)}`}`);
  if (!bien) {
    fallos++;
    hallazgos.push(que);
  }
};
const nota = (t) => console.log(`  --   ${t}`);

// ---------------------------------------------------------------
// LA RED
// ---------------------------------------------------------------
let modo = 'viva'; // 'viva' | 'cortada' | 'sin-respuesta'
let cortes = 0;
const fetchDelSubsuelo = async (...args) => {
  if (modo === 'cortada') {
    cortes++;
    throw new TypeError('fetch failed');
  }
  if (modo === 'sin-respuesta') {
    cortes++;
    await fetch(...args); // llega y escribe…
    throw new TypeError('fetch failed'); // …y la respuesta se pierde
  }
  return fetch(...args);
};
const supabase = createClient(url, anon, {
  global: { fetch: fetchDelSubsuelo },
  auth: { persistSession: false },
});
/** Corre `fn` con la red en `m` y la deja viva después, pase lo que pase. */
async function conRed(m, fn) {
  modo = m;
  try {
    return await fn();
  } finally {
    modo = 'viva';
  }
}

console.log(`\nCuatro semanas — ${CORREO}\n`);

const { error: eAlta } = await supabase.auth.signUp({ email: CORREO, password: CLAVE });
if (eAlta) {
  console.log('No se pudo crear la cuenta:', eAlta.message);
  process.exit(1);
}
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  console.log('El alta no devolvió sesión. ¿Está prendido "Confirm email"?');
  process.exit(1);
}
const uid = user.id;
await supabase.from('profiles').update({ username: `cua_${sello.slice(-6)}` }).eq('id', uid);

const HOY = (await supabase.rpc('mi_hoy')).data;
const dia = (atras) => {
  const d = new Date(HOY + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - atras);
  return d.toISOString().slice(0, 10);
};
const perfil = async () => (await supabase.from('profiles').select('*').eq('id', uid).single()).data;
const archivosSubidos = [];

try {
  // ---------------------------------------------------------------
  // 1. LA HISTORIA: D28 a D3, por el camino del calendario
  // ---------------------------------------------------------------
  console.log('Cuatro semanas de historia');
  {
    // Dos descansos marcados a mano (D21 y D14): no suman y no cortan.
    const descansos = new Set([21, 14]);
    const rangos = [];
    for (let atras = 28; atras >= 3; atras--) {
      const { error } = await supabase
        .from('logs')
        .insert({ user_id: uid, fecha: dia(atras), es_descanso: descansos.has(atras) });
      if (error) chequear(`se carga ${dia(atras)}`, error.message, 'ok');
      rangos.push((await perfil()).rango_actual);
    }
    const p = await perfil();
    chequear('24 días entrenados y 2 descansos dan racha 24', p.racha_actual, 24);
    chequear('la mejor racha es la misma', p.mejor_racha, 24);
    chequear('subió de rango dos veces, a los 10 y a los 20', [...new Set(rangos)], [1, 2, 3]);
  }

  // ---------------------------------------------------------------
  // 2. UN DÍA CORREGIDO: se borra uno del medio y se vuelve a poner
  // ---------------------------------------------------------------
  console.log('\nUn día corregido a mano');
  {
    await supabase.from('logs').delete().eq('user_id', uid).eq('fecha', dia(10));
    const corta = (await supabase.rpc('recalcular_desde_cero')).data;
    chequear('sin el día 10 la racha es lo de después (7)', corta?.racha_historial, 7);
    await supabase.from('logs').insert({ user_id: uid, fecha: dia(10) });
    const vuelta = (await supabase.rpc('recalcular_desde_cero')).data;
    chequear('reponerlo devuelve los 24', vuelta?.racha, 24);
    chequear('y el recálculo no se inventa una pérdida', vuelta?.perdida, false);
    chequear('la mejor racha no quedó inflada ni rota', (await perfil()).mejor_racha, 24);
  }

  // ---------------------------------------------------------------
  // 3. EL HUECO: ayer y anteayer sin nada → las vidas
  // ---------------------------------------------------------------
  console.log('\nDos días sin entrenar: las vidas');
  {
    // El recálculo del paso anterior YA corrió la verificación (la hace en la
    // misma transacción): ayer y anteayer quedaron cubiertos ahí. Las vidas
    // no se gastan cuando la app se abre sino cuando la base mira el hueco.
    const imp = (await supabase.rpc('mis_impulsos')).data;
    chequear('con racha 24 hay tres ganadas y queda una', [imp?.total, imp?.quedan], [3, 1]);
    chequear('cubrieron ayer y anteayer', imp?.vigentes, [dia(2), dia(1)]);
    chequear('la racha sigue en 24', (await perfil()).racha_actual, 24);

    // Abrir la app muchas veces no gasta más.
    const otra = (await supabase.rpc('verificar_perdida')).data;
    chequear('abrir la app otra vez no gasta más vidas', [otra?.perdida, otra?.vidas_usadas ?? null], [false, null]);

    // GUARDAR UNA: se devuelve la de ayer. La racha se corta con la regla del -10.
    const dev = (await supabase.rpc('devolver_impulsos', { p_fechas: [dia(1)] })).data;
    chequear('se devuelve una', dev?.devueltas, 1);
    chequear('y la racha se corta', dev?.perdida?.perdida, true);
    const p = await perfil();
    chequear('baja 10, no a cero', p.racha_actual, 14);
    chequear('y baja un rango', p.rango_actual, 2);

    const imp2 = (await supabase.rpc('mis_impulsos')).data;
    // Con racha 14 se ganan dos (la tercera es a los 20): una usada, una libre.
    chequear('con la racha en 14 quedan dos ganadas y una libre', [imp2?.total, imp2?.quedan], [2, 1]);
    chequear('la otra sigue usada', imp2?.vigentes, [dia(2)]);

    const reintento = (await supabase.rpc('devolver_impulsos', { p_fechas: [dia(1)] })).data;
    chequear('devolver dos veces la misma no hace nada', reintento?.devueltas, 0);
    chequear('y no vuelve a cortar la racha', (await perfil()).racha_actual, 14);
  }

  // ---------------------------------------------------------------
  // 4. HOY, EN EL SUBSUELO
  // ---------------------------------------------------------------
  console.log('\nHoy: el peso, con la respuesta perdida');
  {
    const r1 = await conRed('sin-respuesta', () => supabase.rpc('anotar_peso', { p_valor: 80.4 }));
    chequear('la llamada da error aunque escribió', !!r1.error, true);
    await supabase.rpc('anotar_peso', { p_valor: 80.4 });
    const { data: pesos } = await supabase.from('weights').select('fecha, valor').eq('user_id', uid);
    chequear('reintentar deja UN peso, no dos', pesos?.length, 1);
    const antes = (await supabase.from('logs').select('id').eq('user_id', uid)).data.length;
    chequear('pesarse no registró el día', antes, 26);
  }

  console.log('\nHoy: la sesión');
  let sesion;
  {
    // Empezar con la respuesta perdida: la sesión y el día se crean, el
    // teléfono no se entera, y reintenta.
    const perdido = await conRed('sin-respuesta', () => supabase.rpc('iniciar_sesion'));
    chequear('empezar sin respuesta da error', !!perdido.error, true);
    const r = (await supabase.rpc('iniciar_sesion')).data;
    sesion = r?.id;
    chequear('el reintento encuentra la misma sesión', r?.yaEstaba, true);
    const { data: corriendo } = await supabase.from('sesiones').select('id').eq('user_id', uid);
    chequear('hay UNA sesión', corriendo?.length, 1);
    chequear('el día de hoy quedó registrado', (await supabase.from('logs').select('id').eq('user_id', uid).eq('fecha', HOY)).data.length, 1);
    chequear('y la racha subió a 15', (await perfil()).racha_actual, 15);
    // HALLAZGO POSIBLE: la respuesta que se perdió traía `registro` (subió de
    // rango, el log_id para la foto). El reintento trae `registro: null`.
    nota(`el reintento devuelve registro=${JSON.stringify(r?.registro)}: la celebración y el log_id se pierden si la primera respuesta no llega`);

    // Series: tres con red, una cortada (no llega), y reintentos sin respuesta.
    for (const n of [1, 2, 3]) await supabase.rpc('fijar_series', { p_sesion: sesion, p_series: n });
    const cortada = await conRed('cortada', () => supabase.rpc('fijar_series', { p_sesion: sesion, p_series: 4 }));
    chequear('con la red cortada, error (nunca un ok silencioso)', !!cortada.error, true);
    chequear('y no escribió', (await supabase.from('sesiones').select('series').eq('id', sesion).single()).data.series, 3);
    for (let i = 0; i < 3; i++) {
      await conRed('sin-respuesta', () => supabase.rpc('fijar_series', { p_sesion: sesion, p_series: 6 }));
    }
    await supabase.rpc('fijar_series', { p_sesion: sesion, p_series: 6 });
    chequear('reintentar el total deja 6, no 18', (await supabase.from('sesiones').select('series').eq('id', sesion).single()).data.series, 6);

    // Bloques con pesos y modos. Zancadas es ambigua: se elige una vez.
    const elegida = await supabase.rpc('elegir_carga', { p_ejercicio: 'zancadas', p_carga: 'par' });
    chequear('se elige con qué se hacen las zancadas', elegida.error?.message ?? 'ok', 'ok');
    const arranca = (await supabase.rpc('como_arranca', { p_ejercicio: 'zancadas' })).data;
    nota(`como_arranca(zancadas) = ${JSON.stringify(arranca)}`);

    const bloques = [
      { ejercicio: 'press_banca', series: 3, pesos: [60, 62.5, 62.5], carga: 'total' },
      { ejercicio: 'zancadas', series: 2, pesos: [20, null], carga: 'par' },
      { ejercicio: 'plancha', series: 1 },
    ];
    const sinResp = await conRed('sin-respuesta', () => supabase.rpc('fijar_bloques', { p_sesion: sesion, p_bloques: bloques }));
    chequear('los bloques sin respuesta dan error', !!sinResp.error, true);
    const fb = (await supabase.rpc('fijar_bloques', { p_sesion: sesion, p_bloques: bloques })).data;
    chequear('el reintento guarda lo mismo', fb?.bloques?.map((b) => [b.ejercicio, b.series, b.pesos ?? null, b.carga ?? null]), [
      ['press_banca', 3, [60, 62.5, 62.5], 'total'],
      ['zancadas', 2, [20, null], 'par'],
      ['plancha', 1, null, null],
    ]);
    const sumaBloques = fb.bloques.reduce((t, b) => t + b.series, 0);
    chequear('las series de los bloques suman el total del contador', sumaBloques, fb.total_series);

    // Un bloque basura no rompe los buenos.
    const raro = (await supabase.rpc('fijar_bloques', {
      p_sesion: sesion,
      p_bloques: [...bloques, { ejercicio: 'no_existe', series: 2 }, { ejercicio: 'curl_barra', series: -3 }],
    })).data;
    chequear('los bloques inválidos se descartan sin tirar los buenos', raro?.bloques?.length, 3);

    await supabase.rpc('marcar_actividad', { p_sesion: sesion, p_hasta: new Date().toISOString() });
    chequear('el último peso de banca es el que se anotó', Number((await supabase.rpc('ultimo_peso', { p_ejercicio: 'press_banca' })).data), 62.5);

    // Terminar con la respuesta perdida: el teléfono reintenta.
    const finPerdido = await conRed('sin-respuesta', () => supabase.rpc('terminar_sesion'));
    chequear('terminar sin respuesta da error', !!finPerdido.error, true);
    const fin = (await supabase.rpc('terminar_sesion')).data;
    nota(`el reintento de terminar devuelve ${JSON.stringify(fin)} (la sesión ya estaba terminada)`);
    const { data: s1 } = await supabase.from('sesiones').select('estado, series, bloques').eq('id', sesion).single();
    chequear('la sesión quedó terminada con sus 6 series y 3 bloques', [s1.estado, s1.series, s1.bloques.length], ['terminada', 6, 3]);
    chequear('el día NO se deshizo (tenía series)', (await supabase.from('logs').select('id').eq('user_id', uid).eq('fecha', HOY)).data.length, 1);

    // Un toque accidental después: arranca y para sin series. No es la sesión
    // que creó el día, así que no puede borrarlo.
    const s2 = (await supabase.rpc('iniciar_sesion')).data;
    chequear('la segunda sesión se cuelga del día que ya estaba', s2?.registro, null);
    const fin2 = (await supabase.rpc('terminar_sesion')).data;
    chequear('el toque accidental no deshace un día que no creó', fin2?.deshizo_el_dia, false);
    chequear('el día sigue ahí', (await supabase.from('logs').select('id').eq('user_id', uid).eq('fecha', HOY)).data.length, 1);

    const res = (await supabase.rpc('resumen_sesiones')).data;
    chequear('Stats: dos sesiones cortas, ninguna válida, ninguna abandonada', [res?.validas, res?.cortas, res?.abandonadas], [0, 2, 0]);
  }

  console.log('\nHoy: la foto');
  {
    const log = (await supabase.from('logs').select('id').eq('user_id', uid).eq('fecha', HOY).single()).data;
    const jpg = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
      'base64'
    );
    // Igual que `compartido/foto.ts`: primero el archivo, después la fila. La
    // fila se pierde en el subsuelo; el archivo ya subió.
    const ruta1 = `${uid}/${HOY}-${Date.now()}.jpg`;
    const sub = await supabase.storage.from('fotos').upload(ruta1, jpg, { contentType: 'image/jpeg' });
    chequear('el archivo sube', sub.error?.message ?? 'ok', 'ok');
    archivosSubidos.push(ruta1);
    const fila = await conRed('cortada', () =>
      supabase.from('photos').insert({ user_id: uid, log_id: log.id, storage_path: ruta1, visibilidad: 'privada', es_subida_de_rango: false })
    );
    chequear('la fila con la red cortada da error', !!fila.error, true);
    // El reintento de la app vuelve a subir con OTRO nombre.
    const ruta2 = `${uid}/${HOY}-${Date.now() + 1}.jpg`;
    await supabase.storage.from('fotos').upload(ruta2, jpg, { contentType: 'image/jpeg' });
    archivosSubidos.push(ruta2);
    await supabase.from('photos').insert({ user_id: uid, log_id: log.id, storage_path: ruta2, visibilidad: 'privada', es_subida_de_rango: false });
    const { data: filas } = await supabase.from('photos').select('storage_path').eq('user_id', uid);
    const { data: objetos } = await supabase.storage.from('fotos').list(uid);
    chequear('queda una foto en la galería', filas?.length, 1);
    nota(`archivos en el bucket: ${objetos?.length} (los que no tienen fila quedan huérfanos)`);
  }

  console.log('\nLas marcas');
  {
    const marcas = [
      { ejercicio: 'sentadilla', peso: 120, reps: 1, es_real: true, fecha: dia(20) },
      { ejercicio: 'sentadilla', peso: 125, reps: 1, es_real: true, fecha: dia(6) },
      { ejercicio: 'press_banca', peso: 80, reps: 5, es_real: false, fecha: dia(12) },
      { ejercicio: 'peso_muerto', peso: 160, reps: 1, es_real: true, fecha: dia(4) },
    ];
    for (const m of marcas) {
      const { error } = await supabase.from('prs').insert({ user_id: uid, ...m });
      if (error) chequear(`se carga la marca ${m.ejercicio}`, error.message, 'ok');
    }
    // La de hoy, con la respuesta perdida y reintento.
    const hoyMarca = { user_id: uid, ejercicio: 'press_banca', peso: 85, reps: 3, es_real: false, fecha: HOY };
    await conRed('sin-respuesta', () => supabase.from('prs').insert(hoyMarca));
    await supabase.from('prs').insert(hoyMarca);
    const { data: deHoy } = await supabase.from('prs').select('id').eq('user_id', uid).eq('fecha', HOY);
    nota(`marcas de hoy tras un reintento: ${deHoy?.length} (más de una = duplicada)`);
    if (deHoy?.length > 1) hallazgos.push('una marca reintentada con la respuesta perdida queda duplicada');

    const f = (await supabase.rpc('mi_fuerza')).data;
    nota(`mi_fuerza: dots=${f?.dots} marcas=${f?.marcas?.length}`);
    chequear('mi_fuerza responde con las tres del DOTS', (f?.marcas ?? []).filter((m) => ['sentadilla', 'press_banca', 'peso_muerto'].includes(m.ejercicio)).length, 3);
  }

  // ---------------------------------------------------------------
  // 5. LO QUE VEN LAS DOS APPS: el núcleo sobre estos datos
  // ---------------------------------------------------------------
  console.log('\nEl núcleo sobre los datos de verdad');
  {
    const V = await import('../nucleo/volumen.ts');
    const { data: ses } = await supabase.from('sesiones').select('id, bloques, logs(fecha)').eq('user_id', uid);
    const { data: cat } = await supabase.from('ejercicios').select('*');
    const { data: prs } = await supabase.from('prs').select('ejercicio, peso, fecha').eq('user_id', uid);
    const sesiones = V.sesionesConFecha(ses);
    const catalogo = new Map(cat.map((e) => [e.id, { nombre: e.nombre, grupo: e.grupo }]));
    chequear('las sesiones traen su día', sesiones.map((s) => s.fecha), [HOY, HOY]);
    const { totales } = V.filasPorMusculo(sesiones, catalogo, { hoy: HOY, semanas: 8, umbral: 6 });
    chequear('series de la semana = las de los bloques', totales.at(-1).series, 6);
    // 3 series de banca (60 + 62,5 + 62,5) + zancadas con 20 por mancuerna (40).
    chequear('kilos de la semana, con el modo de cada bloque', totales.at(-1).kilos, 225);
    const maximos = V.maximosDelCatalogo(sesiones, prs, cat);
    const fila = (id) => maximos.flatMap((g) => g.filas).find((f) => f.ejercicio === id)?.maximo;
    chequear('máximo de banca: la marca de 85 le gana a la serie de 62,5', fila('press_banca')?.peso, 85);
    chequear('máximo de zancadas: 20 por mancuerna', [fila('zancadas')?.peso, fila('zancadas')?.carga], [20, 'par']);
    chequear('la plancha no aparece', maximos.flatMap((g) => g.filas).some((f) => f.ejercicio === 'plancha'), false);
  }

  // ---------------------------------------------------------------
  // 6. INVARIANTES, con un oráculo
  // ---------------------------------------------------------------
  console.log('\nInvariantes');
  {
    const p = await perfil();
    const { data: logs } = await supabase.from('logs').select('fecha, es_descanso').eq('user_id', uid);
    const { data: vidas } = await supabase.from('vidas_usadas').select('fecha, devuelta').eq('user_id', uid);
    const { data: cfgs } = await supabase.from('descansos').select('desde, dias').eq('user_id', uid);
    const fechas = logs.map((l) => l.fecha);
    chequear('ningún día repetido', fechas.length, new Set(fechas).size);
    chequear('ningún día en el futuro', fechas.filter((f) => f > HOY).length, 0);

    // EL ORÁCULO: la misma regla, escrita otra vez. Desde el último día hacia
    // atrás hasta la última pérdida; los descansos y las vidas no cortan.
    const porFecha = new Map(logs.map((l) => [l.fecha, l]));
    const cubierta = new Set(vidas.filter((v) => !v.devuelta).map((v) => v.fecha));
    const descansoVigente = (f) => {
      const c = cfgs.filter((x) => x.desde <= f).sort((a, b) => (a.desde < b.desde ? 1 : -1))[0];
      return c ? c.dias.includes(new Date(f + 'T12:00:00Z').getUTCDay()) : false;
    };
    let d = [...fechas].sort().at(-1);
    let cuenta = 0;
    for (let i = 0; i < 400; i++) {
      if (p.perdida_fecha && d <= p.perdida_fecha) break;
      const l = porFecha.get(d);
      if (l) {
        if (!l.es_descanso) cuenta++;
      } else if (!descansoVigente(d) && !cubierta.has(d)) break;
      const x = new Date(d + 'T12:00:00Z');
      x.setUTCDate(x.getUTCDate() - 1);
      d = x.toISOString().slice(0, 10);
    }
    chequear('racha del perfil = racha_base + la del oráculo', p.racha_actual, p.racha_base + cuenta);
    chequear('rango del perfil = el de su racha', p.rango_actual, Math.min(8, Math.floor(p.racha_actual / 10) + 1));
    chequear('la mejor racha no es menor que la actual', p.mejor_racha >= p.racha_actual, true);

    const { data: ses } = await supabase.from('sesiones').select('estado, series, bloques').eq('user_id', uid);
    chequear('ninguna sesión corriendo', ses.filter((s) => s.estado === 'corriendo').length, 0);
    chequear('ninguna sesión con más series en los bloques que en el contador',
      ses.filter((s) => s.bloques.reduce((t, b) => t + b.series, 0) > s.series).length, 0);
    const { data: w } = await supabase.from('weights').select('fecha').eq('user_id', uid);
    chequear('un peso por día como mucho', w.length, new Set(w.map((x) => x.fecha)).size);
    nota(`${logs.length} días, ${ses.length} sesiones, ${vidas.length} vidas, ${cortes} llamadas cortadas o sin respuesta`);
  }
} catch (e) {
  fallos++;
  hallazgos.push('la simulación reventó: ' + String(e?.message ?? e));
  console.log('\nREVENTÓ:', e);
} finally {
  // ---------------------------------------------------------------
  // LIMPIEZA, como la hace la app: primero los archivos, después la cuenta.
  // ---------------------------------------------------------------
  modo = 'viva';
  console.log('\nLimpieza');
  const { data: objetos } = await supabase.storage.from('fotos').list(uid);
  const rutas = [...new Set([...(objetos ?? []).map((o) => `${uid}/${o.name}`), ...archivosSubidos])];
  if (rutas.length) {
    const { error } = await supabase.storage.from('fotos').remove(rutas);
    chequear('se borran los archivos del bucket', error?.message ?? 'ok', 'ok');
  }
  const { error } = await supabase.rpc('eliminar_cuenta');
  chequear('la cuenta se borra', error?.message ?? 'ok', 'ok');
  await supabase.auth.signOut();
  console.log(`\n${fallos === 0 ? 'todo ok' : fallos + ' fallaron'}`);
  if (hallazgos.length) console.log('HALLAZGOS:\n- ' + hallazgos.join('\n- '));
  process.exit(fallos ? 1 : 0);
}
