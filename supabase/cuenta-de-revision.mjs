// LA CUENTA QUE VA A ABRIR APPLE, con contenido adentro.
//
// POR QUÉ EXISTE. App Review entra con el usuario y la contraseña que uno pone
// en la ficha, y lo que ve es lo primero y lo único que ve. Una cuenta recién
// creada muestra la app VACÍA: racha en cero, calendario en blanco, Stats sin
// una barra, el álbum sin una foto y el fondo en el rango 1. Una app de rachas
// vista vacía no se entiende, y lo que no se entiende se rechaza o se pregunta
// —y preguntar son dos días más—.
//
// SE CARGA POR EL MISMO CAMINO QUE UN USUARIO. No hay clave de servicio en
// ningún lado y está bien que no la haya: todo esto entra con la anon key, con
// RLS puesta y por los mismos RPC que usa el teléfono. O sea que si este script
// corre, la app también puede hacerlo.
//
// LO QUE LA BASE NO DEJA FALSEAR, a propósito, y por eso el resultado es el que
// es: `iniciar_sesion` usa el reloj DEL SERVIDOR (§18.4), y no hay política de
// insert ni de update sobre `sesiones`. O sea que las sesiones solo pueden
// empezar AHORA. El pasado entra por donde entra de verdad —filas de `logs` y
// `recalcular_desde_cero`, que es lo que hace el calendario al corregir—, las
// marcas y las fotos llevan fecha propia, y las sesiones con sus bloques son
// las de hoy. Es exactamente lo que vería alguien que viene usando la app hace
// seis semanas y hoy entrenó.
//
// ES IDEMPOTENTE: si la cuenta ya existe, entra y completa lo que falte. Se
// puede correr las veces que haga falta sin ensuciar nada.
//
// Y CON `--de-cero` LA BORRA Y LA REHACE. Hace falta porque hay cosas que no se
// pueden deshacer desde afuera: `sesiones` no tiene política de delete —a
// propósito, el historial de entrenamiento no se edita—, así que una sesión que
// salió mal se queda. Para eso está `eliminar_cuenta()`, que es exactamente el
// mismo botón que tiene cualquier usuario en Ajustes.
//
//   node --env-file=.env.local supabase/cuenta-de-revision.mjs [--de-cero]
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.log('Faltan NEXT_PUBLIC_SUPABASE_* en .env.local.');
  process.exit(1);
}

// FIJOS Y ESCRITOS ACÁ. Van en la ficha de la tienda, así que no pueden
// depender de un sello de tiempo: tienen que ser los mismos la próxima vez que
// esto corra.
//
// EL CORREO ES REAL Y CON ETIQUETA (`+`): Supabase rechaza los dominios
// inventados, y Apple no le manda nada a esta casilla — solo la escribe en un
// formulario de login. La etiqueta hace que se pueda borrar el día que la app
// esté publicada sin tocar nada más.
const CORREO = 'agusconde20+ascent-review@gmail.com';
const CLAVE = 'AscentReview-2026';
const USUARIO = 'demo';

// LAS DOS AMIGAS (ver el paso 7). Van declaradas acá arriba y no donde se usan
// porque `--de-cero` tiene que poder borrarlas también: una cuenta que quedó
// viva con la mitad de los datos es peor que no tenerla.
const OTRAS = [
  { correo: 'agusconde20+ascent-review-a@gmail.com', usuario: 'sofi_g', dias: 58, sexo: 'f', peso: 61 },
  { correo: 'agusconde20+ascent-review-b@gmail.com', usuario: 'martin_r', dias: 26, sexo: 'm', peso: 78 },
];

const supabase = createClient(url, anon, { auth: { persistSession: false } });

const DE_CERO = process.argv.includes('--de-cero');

console.log(`\nCuenta de App Review — ${CORREO}\n`);

if (DE_CERO) {
  let borradas = 0;
  for (const correo of [CORREO, ...OTRAS.map((o) => o.correo)]) {
    const suyo = createClient(url, anon, { auth: { persistSession: false } });
    const { error } = await suyo.auth.signInWithPassword({ email: correo, password: CLAVE });
    if (error) continue;
    await suyo.rpc('eliminar_cuenta');
    await suyo.auth.signOut();
    borradas++;
  }
  console.log(borradas ? `  ${borradas} cuenta(s) anterior(es) borrada(s)` : '  no había nada que borrar');
}

// ---------------------------------------------------------------
// ENTRAR (o crearla)
// ---------------------------------------------------------------
let { data: sesionAuth, error: eEntrar } = await supabase.auth.signInWithPassword({
  email: CORREO,
  password: CLAVE,
});
if (eEntrar) {
  const { data, error } = await supabase.auth.signUp({ email: CORREO, password: CLAVE });
  if (error) {
    console.log('No se pudo crear la cuenta:', error.message);
    process.exit(1);
  }
  sesionAuth = data;
  console.log('  cuenta creada');
} else {
  console.log('  la cuenta ya existía: se entra y se repone');
}
const uid = sesionAuth?.user?.id;
if (!uid) {
  console.log('El alta no devolvió sesión. ¿Está prendido "Confirm email" en Supabase?');
  process.exit(1);
}

const perfil = async () => (await supabase.from('profiles').select('*').eq('id', uid).single()).data;
const HOY = (await supabase.rpc('mi_hoy')).data;
const dia = (atras) => {
  const d = new Date(HOY + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - atras);
  return d.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------
// 1. QUIÉN ES
// ---------------------------------------------------------------
{
  await supabase
    .from('profiles')
    .update({
      username: USUARIO,
      // EL SEXO ES SOLO PARA EL DOTS (§16.7). Sin él las marcas se ven igual
      // pero el número de fuerza no existe, y es una de las pantallas que el
      // revisor va a abrir.
      sexo: 'm',
      visibilidad_default: 'privada',
    })
    .eq('id', uid);
  console.log(`  usuario: ${USUARIO}`);
}

// ---------------------------------------------------------------
// 2. SEIS SEMANAS DE HISTORIA
// ---------------------------------------------------------------
//
// CUARENTA Y SEIS DÍAS PARA UNA RACHA DE 41, y la cuenta importa: los cinco
// descansos marcados a mano NO suman a la racha (no la cortan, tampoco la
// alimentan). Con 46 filas menos 5 descansos quedan 41, y el rango sube cada
// diez: 41 es RANGO 5, el sol. Con 40 filas la racha daba 35 y el revisor
// abría la app en el rango 4. Es el fondo más vistoso de los ocho y es lo
// que conviene que vea.
//
// Y los descansos están además para que el calendario no sea un bloque macizo
// de cuarenta y seis puntos iguales: son días marcados a mano como libres, que
// es una de las cosas que hay que poder mostrar.
{
  const descansos = new Set([38, 31, 24, 12, 5]);
  const { data: yaHay } = await supabase.from('logs').select('fecha').eq('user_id', uid);
  const tengo = new Set((yaHay ?? []).map((l) => l.fecha));
  const nuevas = [];
  for (let atras = 45; atras >= 0; atras--) {
    if (tengo.has(dia(atras))) continue;
    nuevas.push({ user_id: uid, fecha: dia(atras), es_descanso: descansos.has(atras) });
  }
  if (nuevas.length) {
    const { error } = await supabase.from('logs').insert(nuevas);
    if (error) console.log('  aviso: no se pudieron cargar los días —', error.message);
  }
  // El mismo camino que el calendario al corregir un día: la racha no se
  // escribe, se vuelve a calcular desde las filas.
  await supabase.rpc('recalcular_desde_cero');
  const p = await perfil();
  console.log(
    `  ${(yaHay?.length ?? 0) + nuevas.length} días · racha ${p.racha_actual} · rango ${p.rango_actual}`
  );
}

// ---------------------------------------------------------------
// 3. LAS MARCAS
// ---------------------------------------------------------------
//
// Son las que encienden las medallas y las que le dan un número al DOTS. Van
// las tres del DOTS (sentadilla, banca, muerto) y dos más para que el ranking
// por músculo tenga de dónde agarrarse. Con fechas repartidas: una marca sola
// no muestra que la app guarda un historial.
{
  const marcas = [
    { ejercicio: 'sentadilla', peso: 110, reps: 1, es_real: true, fecha: dia(38) },
    { ejercicio: 'sentadilla', peso: 125, reps: 1, es_real: true, fecha: dia(16) },
    { ejercicio: 'sentadilla', peso: 132.5, reps: 1, es_real: true, fecha: dia(3) },
    { ejercicio: 'press_banca', peso: 82.5, reps: 1, es_real: true, fecha: dia(24) },
    { ejercicio: 'press_banca', peso: 90, reps: 1, es_real: true, fecha: dia(5) },
    { ejercicio: 'peso_muerto', peso: 150, reps: 1, es_real: true, fecha: dia(30) },
    { ejercicio: 'peso_muerto', peso: 170, reps: 1, es_real: true, fecha: dia(9) },
    { ejercicio: 'dominadas', peso: 20, reps: 5, es_real: false, fecha: dia(12) },
    { ejercicio: 'press_militar', peso: 55, reps: 3, es_real: false, fecha: dia(6) },
  ];
  const { data: yaHay } = await supabase.from('prs').select('ejercicio, fecha').eq('user_id', uid);
  const tengo = new Set((yaHay ?? []).map((m) => `${m.ejercicio}|${m.fecha}`));
  const nuevas = marcas.filter((m) => !tengo.has(`${m.ejercicio}|${m.fecha}`));
  for (const m of nuevas) {
    const { error } = await supabase.from('prs').insert({ user_id: uid, ...m });
    if (error) console.log(`  aviso: la marca ${m.ejercicio} no entró —`, error.message);
  }
  // EL DOTS NO SE MIRA ACÁ: es una función del peso corporal y del total, y el
  // peso se carga en el paso siguiente. Va al final, con todo puesto.
  console.log(`  ${marcas.length} marcas`);
}

// ---------------------------------------------------------------
// 4. EL PESO CORPORAL
// ---------------------------------------------------------------
//
// UNO SOLO, Y NO ES UNA ELECCIÓN: `weights` solo tiene permiso de lectura para
// un usuario autenticado, así que el único camino es `anotar_peso`, que escribe
// la fecha de HOY. Alcanza para lo que hace falta —sin peso no hay DOTS— y la
// tendencia con un punto se ve vacía a propósito, que es lo honesto.
{
  const { data: hay } = await supabase.from('weights').select('fecha').eq('user_id', uid);
  if (!hay?.length) await supabase.rpc('anotar_peso', { p_valor: 82 });
  console.log('  peso: 82 kg');
}

// ---------------------------------------------------------------
// 5. LAS FOTOS DEL ÁLBUM
// ---------------------------------------------------------------
//
// NO SON FOTOS DE NADIE, y eso es a propósito: una cuenta de demostración con
// la cara de una persona de verdad es un problema que no hace falta tener. Son
// imágenes abstractas en la paleta de la app —oscuras, con una luz al sesgo y
// grano—, que es lo que el álbum necesita para que se entienda: tres tarjetas,
// tres fechas distintas, y el gesto de pasar de una a otra con el dedo.
//
// VAN COLGADAS DE UN `log`, como todas: una foto sin día no existe en este
// modelo, y el álbum las agrupa por la fecha de su día.
{
  const { data: yaHay } = await supabase.from('photos').select('id').eq('user_id', uid);
  if ((yaHay?.length ?? 0) >= 3) {
    console.log(`  fotos: ya había ${yaHay.length}`);
  } else {
    const { data: logs } = await supabase
      .from('logs')
      .select('id, fecha')
      .eq('user_id', uid)
      .in('fecha', [dia(0), dia(4), dia(11)]);

    // Tres imágenes distintas, hechas acá. `sharp` arma el JPEG desde píxeles
    // crudos: un degradado diagonal del fondo de la app a un color de la
    // paleta, más grano, que es lo que hace que no se lea como un cuadrado de
    // color plano.
    const hacerFoto = async (r0, g0, b0, r1, g1, b1) => {
      const W = 900;
      const H = 1200;
      const px = Buffer.alloc(W * H * 3);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const t = Math.min(1, Math.max(0, (x / W) * 0.55 + (1 - y / H) * 0.65));
          const s = Math.pow(t, 1.8);
          const grano = (Math.random() - 0.5) * 14;
          const i = (y * W + x) * 3;
          px[i] = Math.min(255, Math.max(0, r0 + (r1 - r0) * s + grano));
          px[i + 1] = Math.min(255, Math.max(0, g0 + (g1 - g0) * s + grano));
          px[i + 2] = Math.min(255, Math.max(0, b0 + (b1 - b0) * s + grano));
        }
      }
      return sharp(px, { raw: { width: W, height: H, channels: 3 } })
        .jpeg({ quality: 82 })
        .toBuffer();
    };

    const colores = [
      [5, 6, 10, 122, 96, 62],
      [5, 6, 10, 62, 84, 138],
      [5, 6, 10, 108, 62, 120],
    ];
    for (let i = 0; i < (logs?.length ?? 0); i++) {
      const log = logs[i];
      const jpg = await hacerFoto(...colores[i % colores.length]);
      const ruta = `${uid}/${log.fecha}-${Date.now() + i}.jpg`;
      const sub = await supabase.storage.from('fotos').upload(ruta, jpg, { contentType: 'image/jpeg' });
      if (sub.error) {
        console.log('  aviso: la foto no subió —', sub.error.message);
        continue;
      }
      const { error } = await supabase.from('photos').insert({
        user_id: uid,
        log_id: log.id,
        storage_path: ruta,
        visibilidad: 'privada',
        es_subida_de_rango: false,
      });
      if (error) console.log('  aviso: la fila de la foto no entró —', error.message);
    }
    const { data: ahora } = await supabase.from('photos').select('id').eq('user_id', uid);
    console.log(`  fotos: ${ahora?.length ?? 0}`);
  }
}

// ---------------------------------------------------------------
// 6. EL ENTRENAMIENTO DE HOY
// ---------------------------------------------------------------
//
// LO QUE LLENA STATS. "Series por músculo" es de la SEMANA, así que sin una
// sesión con bloques el gráfico que más cuesta explicar se ve vacío justo
// cuando lo mira el revisor.
//
// DOS SESIONES Y NO UNA porque el día real son dos: el empuje y el tirón. Y
// porque así la lista de sesiones de Stats tiene más de una fila.
//
// SOLO PUEDEN SER DE HOY, y no es una limitación del script: `iniciar_sesion`
// usa el reloj del servidor y `sesiones` no tiene política de insert. Falsear
// el pasado acá querría decir que también se puede falsear desde el teléfono.
//
// LA DURACIÓN SÍ SE PUEDE, hasta 45 minutos: `iniciar_sesion` toma un
// `p_desde` que es la HORA DE LLEGADA y no la de la llamada (el cronómetro
// automático arranca a los siete minutos de estar en la zona, así que sin eso
// toda sesión saldría corta). El tope lo pone `atraso_maximo()`. Sin esto las
// dos sesiones duraban cero segundos y caían abajo de `piso_sesion()`: Stats
// las contaba como "cortas" y el promedio quedaba vacío, que es justo el
// número que el revisor mira.
//
// Y `marcar_actividad` VA ENSEGUIDA: una sesión que arrancó hace 45 minutos y
// no tocó nada ya está vencida por la ventana de inactividad (30 minutos), y
// la cerraría sola el próximo RPC que pase por ahí.
{
  const { data: hay } = await supabase
    .from('sesiones')
    .select('id, bloques')
    .eq('user_id', uid)
    .eq('estado', 'terminada');
  const conBloques = (hay ?? []).filter((s) => (s.bloques?.length ?? 0) > 0);
  if (conBloques.length >= 2) {
    console.log(`  sesiones: ya había ${conBloques.length} con bloques`);
  } else {
    const dias = [
      [
        { ejercicio: 'press_banca', series: 4, pesos: [70, 75, 80, 80], carga: 'total' },
        { ejercicio: 'press_inclinado_mancuernas', series: 3, pesos: [26, 28, 28], carga: 'una' },
        { ejercicio: 'fondos', series: 3 },
        { ejercicio: 'elevaciones_laterales', series: 4, pesos: [10, 10, 12, 12], carga: 'una' },
      ],
      [
        { ejercicio: 'sentadilla', series: 5, pesos: [90, 100, 110, 115, 115], carga: 'total' },
        { ejercicio: 'peso_muerto_rumano', series: 3, pesos: [100, 110, 110], carga: 'total' },
        { ejercicio: 'zancadas', series: 3, pesos: [22, 22, 24], carga: 'par' },
        { ejercicio: 'plancha', series: 3 },
      ],
    ];
    // Minutos hacia atrás para cada una. 45 es el tope; la segunda más corta,
    // que es como sale un día de dos entradas al gimnasio.
    const desde = [45, 20];
    for (let i = 0; i < dias.length; i++) {
      const bloques = dias[i];
      const r = (
        await supabase.rpc('iniciar_sesion', {
          p_desde: new Date(Date.now() - desde[i] * 60_000).toISOString(),
        })
      ).data;
      const id = r?.id;
      if (!id) {
        console.log('  aviso: no se pudo iniciar la sesión');
        continue;
      }
      await supabase.rpc('marcar_actividad', { p_sesion: id, p_hasta: new Date().toISOString() });
      // Las zancadas son ambiguas: hay que decir una vez con qué se hacen.
      await supabase.rpc('elegir_carga', { p_ejercicio: 'zancadas', p_carga: 'par' });
      const fb = (await supabase.rpc('fijar_bloques', { p_sesion: id, p_bloques: bloques })).data;
      const total = (fb?.bloques ?? []).reduce((t, b) => t + b.series, 0);
      await supabase.rpc('fijar_series', { p_sesion: id, p_series: total });
      await supabase.rpc('marcar_actividad', { p_sesion: id, p_hasta: new Date().toISOString() });
      await supabase.rpc('terminar_sesion');
    }
    const res = (await supabase.rpc('resumen_sesiones')).data;
    console.log(`  sesiones de hoy: ${res?.validas ?? 0} válidas, ${res?.cortas ?? 0} cortas`);
  }
}

// ---------------------------------------------------------------
// 7. DOS AMIGAS, PARA QUE RANKING NO ESTÉ VACÍO
// ---------------------------------------------------------------
//
// Ranking es una de las cinco pestañas y el revisor la va a abrir. Sin amigos
// muestra el estado vacío —"tu cielo todavía está vacío"—, que está bien
// escrito pero no deja ver la pantalla: el campo estelar, el orden por racha,
// el perfil de otra persona. La app ni siquiera dibuja el ranking con menos de
// dos, así que hacen falta dos y no una.
//
// SON CUENTAS DE VERDAD, con su propia historia, creadas por el mismo camino.
// Una arriba de demo y otra abajo, para que el orden se vea hacer algo.
//
// LA AMISTAD SE ARMA COMO SE ARMA: la otra pide y demo acepta. La base no deja
// otra cosa —una fila nace en 'pendiente' y solo el destinatario puede pasarla
// a 'aceptada' (lo prueba `probar-privacidad.mjs`)—, así que acá tampoco hay
// atajo.
{
  for (const o of OTRAS) {
    // Cliente propio: cada una tiene que hablar con su sesión, no con la de
    // demo. `persistSession: false` para que no se pisen entre ellas.
    const suyo = createClient(url, anon, { auth: { persistSession: false } });
    let entrada = await suyo.auth.signInWithPassword({ email: o.correo, password: CLAVE });
    if (entrada.error) {
      entrada = await suyo.auth.signUp({ email: o.correo, password: CLAVE });
    }
    const suId = entrada.data?.user?.id;
    if (!suId) {
      console.log(`  aviso: no se pudo entrar como ${o.usuario}`);
      continue;
    }

    await suyo.from('profiles').update({ username: o.usuario, sexo: o.sexo }).eq('id', suId);

    const { data: tiene } = await suyo.from('logs').select('fecha').eq('user_id', suId);
    if ((tiene?.length ?? 0) < o.dias) {
      const hay = new Set((tiene ?? []).map((l) => l.fecha));
      const filas = [];
      for (let atras = o.dias - 1; atras >= 0; atras--) {
        if (!hay.has(dia(atras))) filas.push({ user_id: suId, fecha: dia(atras) });
      }
      if (filas.length) await suyo.from('logs').insert(filas);
      await suyo.rpc('recalcular_desde_cero');
    }

    // Peso y una marca cada una: sin eso el ranking por fuerza las muestra
    // sin número y la pantalla queda a medias.
    const { data: pesos } = await suyo.from('weights').select('fecha').eq('user_id', suId);
    if (!pesos?.length) await suyo.rpc('anotar_peso', { p_valor: o.peso });
    const { data: marcas } = await suyo.from('prs').select('id').eq('user_id', suId);
    if (!marcas?.length) {
      await suyo.from('prs').insert([
        { user_id: suId, ejercicio: 'sentadilla', peso: Math.round(o.peso * 1.5), reps: 1, es_real: true, fecha: dia(7) },
        { user_id: suId, ejercicio: 'press_banca', peso: Math.round(o.peso * 0.95), reps: 1, es_real: true, fecha: dia(4) },
        { user_id: suId, ejercicio: 'peso_muerto', peso: Math.round(o.peso * 1.9), reps: 1, es_real: true, fecha: dia(2) },
      ]);
    }

    // La amistad, si no estaba.
    const yaEs = (await suyo.rpc('son_amigos', { a: suId, b: uid })).data;
    if (!yaEs) {
      const { data: pedido } = await suyo
        .from('friendships')
        .insert({ solicitante: suId, destinatario: uid })
        .select('id')
        .single();
      if (pedido?.id) {
        await supabase.from('friendships').update({ estado: 'aceptada' }).eq('id', pedido.id);
      }
    }
    const p = (await suyo.from('profiles').select('racha_actual').eq('id', suId).single()).data;
    console.log(`  amiga ${o.usuario}: racha ${p?.racha_actual ?? '—'}`);
    await suyo.auth.signOut();
  }
}

// ---------------------------------------------------------------
// LO QUE VA EN LA FICHA
// ---------------------------------------------------------------
{
  const p = await perfil();
  const f = (await supabase.rpc('mi_fuerza')).data;
  const { count: fotos } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid);
  const res = (await supabase.rpc('resumen_sesiones')).data;
  console.log('\n─────────────────────────────────────────');
  console.log('  Para la ficha de App Store Connect:');
  console.log(`    Usuario:    ${CORREO}`);
  console.log(`    Contraseña: ${CLAVE}`);
  console.log('─────────────────────────────────────────');
  console.log(`  Lo que va a ver: racha ${p.racha_actual} · rango ${p.rango_actual} · usuario "${p.username}"`);
  console.log(
    `  ${fotos ?? 0} fotos · ${res?.validas ?? 0} sesiones válidas (${Math.round((res?.promedio_segundos ?? 0) / 60)} min de promedio) · DOTS ${f?.dots ?? '—'}`
  );
  console.log('');
}
