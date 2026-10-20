-- =============================================================
-- ÓRBITA — schema completo (tablas + triggers + RLS + storage)
-- Ejecutar entero en el SQL Editor de Supabase (una sola vez).
-- =============================================================

-- -------------------------------------------------------------
-- QUÉ DÍA ES HOY (en la zona de cada usuario)
--
-- `current_date` en Supabase es UTC, así que el día del servidor cambiaba a
-- las 21:00 de Uruguay. Y para tapar eso la fecha la mandaba el CLIENTE, lo
-- que dejaba una ventana de tres días para elegir: adelantar la hora del
-- teléfono, registrar "mañana", volverla atrás y registrar "hoy" daba dos
-- días de racha en un día real, repetible.
--
-- La fecha la decide el SERVIDOR y el cliente no participa. Lo que sí manda
-- el cliente es la ZONA del teléfono, y ahí está toda la diferencia: una zona
-- se verifica contra `pg_timezone_names`, una fecha es un número inventado.
--
-- Así el día corta donde está el usuario, aunque viaje. Es automático: la app
-- la lee del teléfono sola, no hay campo en Ajustes y el usuario nunca la ve.
-- Que la zona se pueda mover no reabre el agujero, porque hay una guarda: si
-- la zona cambió, entre dos días tienen que pasar 20 horas de reloj real.
-- -------------------------------------------------------------
create or replace function public.tope_calendario()
returns date language sql stable as $$
  select (now() at time zone 'Pacific/Kiritimati')::date;
$$;

-- Redundante con el permiso por omisión de Postgres —EXECUTE para PUBLIC, que
-- ya incluye a los dos— pero explícito, porque la migración 13 lo otorgó así
-- y una base nueva tiene que quedar igual a producción. Lo encontró el retrato
-- la primera vez que miró quién puede ejecutar qué.
grant execute on function public.tope_calendario() to authenticated, anon;

-- -------------------------------------------------------------
-- TABLAS
-- -------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$'),
  avatar_url text,
  racha_actual int not null default 0,
  mejor_racha int not null default 0,
  rango_actual int not null default 1,
  -- Piso de misericordia: al perder una racha no se vuelve a cero.
  -- racha_actual = racha_base + racha calculada desde los logs.
  racha_base int not null default 0,
  -- Fecha de la última pérdida: los días anteriores o iguales a esta fecha
  -- ya están representados por racha_base y NO se vuelven a contar.
  -- Sin esto, corregir a mano un día anterior a la pérdida duplicaría racha.
  perdida_fecha date,
  -- Espejo de la configuración de descansos VIGENTE, para que la interfaz
  -- no tenga que buscarla. El historial real vive en la tabla `descansos`
  -- y lo mantiene el RPC fijar_descansos: acá no se escribe a mano.
  dias_descanso int[] not null default '{}',
  -- Con qué visibilidad NACE cada foto nueva. La visibilidad sigue siendo por
  -- foto: esto solo evita tener que elegir una por una.
  visibilidad_default text not null default 'privada'
    check (visibilidad_default in ('privada','amigos')),
  -- Unidad en la que el usuario escribe y lee su peso. El valor SIEMPRE se
  -- guarda en kilos: la unidad es de presentación, no de almacenamiento. Si
  -- se guardaran libras, cambiar la preferencia reinterpretaría el historial
  -- entero y la tendencia daría un salto que no ocurrió.
  unidad_peso text not null default 'kg' check (unidad_peso in ('kg','lb')),
  -- QUÉ VERSIÓN ABRIÓ LA APP POR ÚLTIMA VEZ (migración 63). Las escribe
  -- `pantalla_inicio`, que se llama en cada apertura, con lo que la app manda
  -- en el encabezado `X-Client-Info`. `version_vista` queda en null cuando
  -- abrió algo que no la manda (la build de la tienda sin OTA encima).
  ultima_apertura timestamptz,
  version_vista text,
  -- El detector de estancamiento (migración 30). Van en la CUENTA y no en el
  -- aparato: cada cuánto querés que te avisen es una pregunta sobre tu
  -- entrenamiento, y la respuesta es la misma en el teléfono y en la
  -- computadora. Por omisión seis semanas: ocho llega cuando ya lo sabías y
  -- tres le da la lata a quien está en mantenimiento. Dos (migración 40), para
  -- quien lo pidió: con más evidencia por semana (`nucleo/estancamiento.ts`).
  umbral_estancamiento int not null default 6
    check (umbral_estancamiento in (2, 3, 6, 8)),
  -- Un aviso que no se puede apagar deja de ser un aviso: es una condición de
  -- uso.
  avisos_estancamiento boolean not null default true,
  -- Sexo del levantador, SOLO para elegir los coeficientes del DOTS (§16.7).
  -- Es opcional y null significa "sin DOTS", no "por defecto": calcularlo con
  -- la fórmula equivocada da un dato falso que ordena mal el ranking y que
  -- nadie notaría, porque el número igual parece razonable.
  sexo text check (sexo is null or sexo in ('m','f')),
  -- Cuánto dura el descanso entre series, en SEGUNDOS (§18.5). 180 = 3 min.
  -- Es lo ÚNICO del temporizador de descanso que toca la base: el descanso en
  -- curso vive en localStorage y no deja rastro, porque no hay ningún dato
  -- que valga guardar y son quince o veinte por sesión.
  duracion_descanso int not null default 180
    check (duracion_descanso between 15 and 600),
  -- Zona horaria del TELÉFONO, en identificador IANA. La manda la app sola en
  -- cada sesión y el usuario nunca la ve: no hay campo en Ajustes. Sin grant
  -- de update — se escribe solo por fijar_zona(), que la valida contra
  -- pg_timezone_names. Una zona es verificable; una fecha, no.
  zona text not null default 'America/Montevideo',
  -- Cuándo cambió: sin esto no hay forma de distinguir un viaje de un cambio
  -- de hora a mano, que es lo que separa la guarda de §12b.
  zona_cambiada timestamptz,
  -- La zona que estaba ANTES de la actual. Sirve para detectar el flip-flop
  -- del que hace trampa (A -> B -> A), que es una de las dos señales que arman
  -- el bloqueo (migración 50).
  zona_previa text,
  -- Cuándo se armó el bloqueo por un cambio SOSPECHOSO. Es lo que mira
  -- `bloqueo_hasta`, y no `zona_cambiada`: un viaje real (un solo cambio) o el
  -- primer cambio de un usuario nuevo NO lo tocan, así que no bloquean. Se
  -- separó de `zona_cambiada` en la migración 50 justo por eso.
  zona_bloqueo_desde timestamptz,
  -- El día que la guarda dejó esperando. Se registra solo apenas pasa la
  -- ventana: un rechazo mudo cuando lo que está en juego es la racha se lee
  -- como que la app está rota (§11).
  dia_pendiente date,
  -- El punto del gimnasio, para el registro automático (§13). Dato PRIVADO:
  -- nunca se comparte con amigos. No hace falta nada especial —`profiles` es
  -- solo del dueño y lo público sale por `usuarios_publicos`, que no los
  -- incluye—, pero queda dicho para que nadie los agregue ahí.
  gimnasio_lat numeric(9, 6),
  gimnasio_lon numeric(9, 6),
  -- El GPS bajo techo tiene 20 a 50 m de error: menos de 50 promete una
  -- precisión que no existe, más de 300 agarra la cuadra entera.
  gimnasio_radio int not null default 100
    constraint profiles_gimnasio_radio_rango check (gimnasio_radio between 50 and 300),
  constraint profiles_gimnasio_completo
    check ((gimnasio_lat is null) = (gimnasio_lon is null)),
  constraint profiles_gimnasio_rango check (
    (gimnasio_lat is null or gimnasio_lat between -90 and 90) and
    (gimnasio_lon is null or gimnasio_lon between -180 and 180)
  ),
  pendiente_desde timestamptz,
  -- Actividad en vivo (migración 51): si tus amigos ven "estás entrenando
  -- ahora" al llegar al gimnasio. Opt-in, apagado por defecto. Se escribe solo
  -- por `fijar_comparte_gimnasio`.
  -- Nace PRENDIDO desde la migración 68: apagado no arrancaba nunca.
  comparte_gimnasio boolean not null default true,
  -- Si los amigos ven qué ejercicios hace cada día (migración 64). Se cambia
  -- por `fijar_comparte_rutina`.
  comparte_rutina boolean not null default true,
  creado timestamptz not null default now()
);

-- Configuraciones de descanso FECHADAS.
-- Cada cambio guarda desde cuándo rige, y el cálculo de cada día usa la que
-- estaba vigente ESE día. Con una sola columna que se pisa, cambiar de
-- rutina en marzo recalculaba enero y hacía perder rachas ya ganadas.
create table public.descansos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  desde date not null,
  dias int[] not null default '{}',
  creado timestamptz not null default now(),
  unique (user_id, desde)
);
create index descansos_vigente on public.descansos (user_id, desde desc);

-- Username único e insensible a mayúsculas
create unique index profiles_username_unico on public.profiles (lower(username));

create table public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- El tope es el día de la zona MÁS ADELANTADA del planeta: un CHECK corre
  -- por fila y no tiene a quién preguntarle cuál es la zona del usuario. La
  -- comprobación fina —el día de ESTE usuario— la hacen los RPC.
  fecha date not null check (fecha <= tope_calendario()),
  es_descanso boolean not null default false,
  -- De dónde salió el día. Ubicación y salud registran por una señal que no es
  -- un toque, y las dos entran por `registrar_dia` con su origen: una sola
  -- lógica de "¿ya estaba?, ¿pido la foto?, ¿aviso?" en vez de una por señal.
  origen text not null default 'manual'
    constraint logs_origen_valido check (origen in ('manual', 'ubicacion', 'salud')),
  planeta_del_dia text,
  -- LA RACHA DE ESE DÍA (item 6.4): "día 41". Se anota al registrar y sirve para
  -- que cada foto sea un registro, no una foto suelta. Nullable: los días viejos
  -- se rellenan una vez (aprox. con calcular_racha), y sin dato la foto no lo
  -- muestra. El rango NO se escribe: vive en el color del marco.
  racha_del_dia int,
  creado timestamptz not null default now(),
  unique (user_id, fecha)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_id uuid references public.logs(id) on delete set null,
  storage_path text not null,
  visibilidad text not null default 'privada' check (visibilidad in ('privada','amigos')),
  es_subida_de_rango boolean not null default false,
  creado timestamptz not null default now()
);

-- Tabla propia (NO columna en logs): los días de descanso no generan log
-- y el peso se tiene que poder anotar igual. Nunca se comparte.
create table public.weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fecha date not null check (fecha <= tope_calendario()),
  valor numeric(5,2) not null check (valor between 20 and 400),
  unique (user_id, fecha)
);

-- Relación bidireccional con una sola fila
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  solicitante uuid not null references public.profiles(id) on delete cascade,
  destinatario uuid not null references public.profiles(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptada')),
  creado timestamptz not null default now(),
  check (solicitante <> destinatario)
);
create unique index friendships_par_unico on public.friendships
  (least(solicitante, destinatario), greatest(solicitante, destinatario));

-- Fuera de la primera beta a nivel UI, pero la tabla ya existe
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  retador uuid not null references public.profiles(id) on delete cascade,
  rival uuid not null references public.profiles(id) on delete cascade,
  desde date not null,
  hasta date not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','activo','terminado','rechazado')),
  ganador uuid references public.profiles(id),
  creado timestamptz not null default now(),
  check (retador <> rival),
  check (hasta >= desde)
);
-- un solo reto vigente por pareja
create unique index challenges_vigente_unico on public.challenges
  (least(retador, rival), greatest(retador, rival))
  where estado in ('pendiente', 'activo');

-- BLOQUEOS (migración 53). Quién bloqueó a quién. Bloquear corta la amistad,
-- borra las solicitudes en las dos direcciones, impide nuevas (por policy) y los
-- saca del ranking, del buscador y de la vista del otro (por RLS/vista/función).
create table public.bloqueos (
  bloqueador uuid not null references public.profiles(id) on delete cascade,
  bloqueado  uuid not null references public.profiles(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (bloqueador, bloqueado),
  check (bloqueador <> bloqueado)
);
create index bloqueos_por_bloqueado on public.bloqueos (bloqueado);
alter table public.bloqueos enable row level security;

-- REPORTES / denuncias (migración 53). denunciante + denunciado + motivo (de una
-- lista cerrada, no texto libre). Una fila por par (la última gana). Se lee desde
-- el dashboard, como el feedback; NO es el buzón de errores.
create table public.reportes (
  denunciante uuid not null references public.profiles(id) on delete cascade,
  denunciado  uuid not null references public.profiles(id) on delete cascade,
  motivo text not null check (motivo in ('spam','acoso','inapropiado','suplantacion','otro')),
  creado timestamptz not null default now(),
  primary key (denunciante, denunciado),
  check (denunciante <> denunciado)
);
create index reportes_por_denunciado on public.reportes (denunciado);
alter table public.reportes enable row level security;

-- Catálogo de ejercicios. Es grande a propósito (§16.3): el usuario anota lo
-- que quiera. Pero al total DOTS entran SOLO los tres marcados con
-- cuenta_dots: la fórmula está calibrada sobre esos tres y sumarle otros no
-- la hace más completa, la invalida.
create table public.ejercicios (
  id text primary key,
  nombre text not null,
  grupo text not null,
  cuenta_dots boolean not null default false,
  -- Si una marca en kilos significa algo (migración 31). Por omisión sí: casi
  -- todo admite peso aunque no se use así —flexiones con chaleco, crunch con
  -- un disco—. Quedan afuera los isométricos, donde lo que se mide es tiempo.
  admite_peso boolean not null default true,
  orden int not null default 0,
  -- QUÉ SIGNIFICA EL NÚMERO DEL PESO (migración 38): 'total' (barra o
  -- máquina), 'par' (el peso de UNA de dos mancuernas o poleas, × 2), 'una'
  -- (una sola mancuerna) o 'lastre' (lo que va encima del peso corporal, que
  -- no se suma). Decide solo los bloques que VIENEN: cada bloque guarda el
  -- suyo, así que reclasificar no reescribe la historia.
  carga text not null default 'total',
  -- El nombre no dice con qué se hace ("Zancadas"): se pregunta una vez.
  carga_ambigua boolean not null default false,
  -- QUIÉN LO AGREGÓ (migración 76): null es el catálogo de todos; con un id, es
  -- un ejercicio propio de esa cuenta. Desde la 80 lo ve solo ella.
  -- Al darse de baja queda sin dueño (`on delete set null`) si otra cuenta lo usó:
  -- ver `huerfano` y `eliminar_cuenta` (migración 83).
  creado_por uuid references public.profiles(id) on delete set null,
  -- HUÉRFANO (migración 83): era propio de una cuenta que se dio de baja y otra lo
  -- había usado. Queda con su nombre para que el historial del otro sobreviva, pero
  -- sin dueño no es catálogo: no lo ve nadie.
  huerfano boolean not null default false,
  -- QUÉ SE ANOTA (migración 76): 'series' (series y peso, lo de siempre) o
  -- 'tiempo' (minutos: el cardio). El cardio es un ejercicio más del catálogo,
  -- no un modo aparte: entra en la rutina, el historial y el día igual que todos.
  mide text not null default 'series',
  constraint ejercicios_carga_valida check (carga in ('total', 'par', 'una', 'lastre', 'corporal')),
  constraint ejercicios_mide_valido check (mide in ('series', 'tiempo'))
);

-- Las marcas. Se guarda lo que el usuario LEVANTÓ (peso y repeticiones), no
-- el 1RM: el 1RM se deriva. Guardar el derivado perdería el dato original y
-- cualquier cambio de fórmula reescribiría el historial.
--
-- El peso va SIEMPRE en kilos, igual que weights: la unidad del usuario es de
-- presentación. Los PRs no caducan y no se pisan entre sí; cada carga es una
-- fila y la mejor gana, por eso siempre se muestra su fecha al lado (§16.5).
create table public.prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ejercicio text not null references public.ejercicios(id),
  peso numeric(6,2) not null check (peso between 1 and 600),
  reps int not null check (reps between 1 and 20),
  -- true = 1RM real; false = estimado con Epley a partir de las repeticiones
  es_real boolean not null default false,
  fecha date not null check (fecha <= tope_calendario()),
  creado timestamptz not null default now(),
  -- Un 1RM "real" con más de una repetición es una contradicción: es el peso
  -- que se levantó UNA vez. Si tiene más reps, es un estimado.
  constraint prs_real_es_una_rep check (not es_real or reps = 1)
);
create index prs_por_usuario on public.prs (user_id, ejercicio);

insert into public.ejercicios (id, nombre, grupo, cuenta_dots, orden) values
  ('sentadilla',        'Sentadilla',              'piernas', true,  10),
  ('press_banca',       'Press de banca',          'pecho',   true,  20),
  ('peso_muerto',       'Peso muerto',             'espalda', true,  30),
  ('sentadilla_frontal','Sentadilla frontal',      'piernas', false, 110),
  ('peso_muerto_rumano','Peso muerto rumano',      'piernas', false, 120),
  ('prensa',            'Prensa',                  'piernas', false, 130),
  ('hip_thrust',        'Hip thrust',              'piernas', false, 140),
  ('zancadas',          'Zancadas',                'piernas', false, 150),
  ('extension_cuadriceps','Extensión de cuádriceps','piernas',false, 160),
  ('curl_femoral',      'Curl femoral',            'piernas', false, 170),
  ('gemelos',           'Gemelos de pie',          'piernas', false, 180),
  ('press_inclinado',   'Press inclinado',         'pecho',   false, 210),
  ('press_mancuernas',  'Press con mancuernas',    'pecho',   false, 220),
  ('aperturas',         'Aperturas con mancuernas',               'pecho',   false, 230),
  ('fondos',            'Fondos en paralelas',                  'pecho',   false, 240),
  ('dominadas',         'Dominadas',               'espalda', false, 310),
  ('remo_barra',        'Remo con barra',          'espalda', false, 320),
  ('remo_mancuerna',    'Remo con mancuerna',      'espalda', false, 330),
  ('jalon',             'Jalón al pecho',          'espalda', false, 340),
  ('remo_polea',        'Remo en polea',           'espalda', false, 350),
  ('press_militar',     'Press militar',           'hombros', false, 410),
  ('press_arnold',      'Press Arnold',            'hombros', false, 420),
  ('elevaciones_laterales','Elevaciones laterales','hombros', false, 430),
  ('pajaros',           'Pájaros',                 'hombros', false, 440),
  ('curl_barra',        'Curl con barra',          'brazos',  false, 510),
  ('curl_mancuernas',   'Curl con mancuernas',     'brazos',  false, 520),
  ('martillo',          'Curl martillo',           'brazos',  false, 530),
  ('press_frances',     'Press francés',           'brazos',  false, 540),
  ('triceps_polea',     'Tríceps en polea',        'brazos',  false, 550),
  ('abdominales_polea', 'Abdominales en polea',    'core',    false, 610),
  ('rueda_abdominal',   'Rueda abdominal',         'core',    false, 620),
  -- Migración 29: de 31 a 100. El catálogo grande es para CONTAR SERIES;
  -- `cuenta_dots` sigue en tres. Un selector que no tiene lo que hacés te
  -- enseña a no usarlo. Agrupa el `orden`: una centena por grupo muscular.
  ('sentadilla_bulgara',    'Sentadilla búlgara',          'piernas', false, 111),
  ('sentadilla_goblet',     'Sentadilla goblet',           'piernas', false, 112),
  ('sentadilla_hack',       'Sentadilla hack',             'piernas', false, 113),
  ('sentadilla_smith',      'Sentadilla en Smith',    'piernas', false, 114),
  ('peso_muerto_sumo',      'Peso muerto sumo',            'piernas', false, 121),
  ('peso_muerto_rigidas',   'Peso muerto stiff', 'piernas', false, 122),
  ('peso_muerto_una_pierna','Peso muerto a una pierna',    'piernas', false, 123),
  ('buenos_dias',           'Good morning',                 'piernas', false, 124),
  ('prensa_una_pierna',     'Prensa a una pierna',         'piernas', false, 131),
  ('zancadas_caminando',    'Zancadas caminando',          'piernas', false, 151),
  ('zancada_inversa',       'Zancada inversa',             'piernas', false, 152),
  ('subida_cajon',          'Step up',             'piernas', false, 153),
  ('curl_femoral_pie',      'Curl femoral de pie',         'piernas', false, 171),
  ('gemelos_sentado',       'Gemelos sentado',             'piernas', false, 181),
  ('gemelos_prensa',        'Gemelos en prensa',           'piernas', false, 182),
  ('aductores',             'Aductores en máquina',        'piernas', false, 191),
  ('abductores',            'Abductores en máquina',       'piernas', false, 192),
  ('puente_gluteo',         'Puente de glúteos',           'piernas', false, 193),
  ('patada_gluteo',         'Patada de glúteo en polea',   'piernas', false, 194),
  ('press_declinado',       'Press declinado',             'pecho',   false, 211),
  ('press_inclinado_mancuernas','Press inclinado con mancuernas','pecho', false, 221),
  ('press_pecho_maquina',   'Press de pecho en máquina',   'pecho',   false, 222),
  ('cruce_polea_alta',      'Cruces en polea alta',        'pecho',   false, 231),
  ('cruce_polea_baja',      'Cruces en polea baja',        'pecho',   false, 232),
  ('pec_deck',              'Peck deck',      'pecho',   false, 233),
  ('flexiones',             'Flexiones',         'pecho',   false, 241),
  ('pullover',              'Pullover con mancuerna',      'pecho',   false, 251),
  ('dominadas_supinas',     'Dominadas supinas',           'espalda', false, 311),
  ('dominadas_lastradas',   'Dominadas con lastre',        'espalda', false, 312),
  ('remo_invertido',        'Remo invertido',              'espalda', false, 313),
  ('remo_pendlay',          'Remo Pendlay',                'espalda', false, 321),
  ('remo_t',                'Remo en T',                   'espalda', false, 322),
  ('remo_maquina',          'Remo en máquina',             'espalda', false, 331),
  ('remo_unilateral_polea', 'Remo unilateral en polea',    'espalda', false, 332),
  ('jalon_cerrado',         'Jalón con agarre cerrado',    'espalda', false, 341),
  ('jalon_unilateral',      'Jalón unilateral',            'espalda', false, 342),
  ('pullover_polea',        'Pullover en polea',           'espalda', false, 351),
  ('rack_pull',             'Rack pull',                   'espalda', false, 361),
  ('hiperextensiones',      'Hiperextensiones',            'espalda', false, 362),
  ('press_militar_mancuernas','Press militar con mancuernas','hombros', false, 411),
  ('press_hombro_maquina',  'Press de hombro en máquina',  'hombros', false, 412),
  ('elevaciones_frontales', 'Elevaciones frontales',       'hombros', false, 431),
  ('elevaciones_polea',     'Elevaciones laterales en polea','hombros',false, 432),
  ('elevaciones_maquina',   'Elevaciones laterales en máquina','hombros',false,433),
  ('face_pull',             'Face pull',                   'hombros', false, 441),
  ('remo_menton',           'Remo al mentón',              'hombros', false, 442),
  ('rotacion_externa',      'Rotación externa',            'hombros', false, 443),
  ('encogimientos',         'Shrugs',               'hombros', false, 451),
  ('curl_predicador',       'Curl predicador',             'brazos',  false, 511),
  ('curl_inclinado',        'Curl inclinado',              'brazos',  false, 521),
  ('curl_concentrado',      'Curl concentrado',            'brazos',  false, 522),
  ('curl_polea',            'Curl en polea',               'brazos',  false, 523),
  ('curl_barra_z',          'Curl con barra Z',            'brazos',  false, 524),
  ('curl_muneca',           'Curl de muñeca',              'brazos',  false, 531),
  ('press_cerrado',         'Press de banca agarre cerrado','brazos', false, 541),
  ('triceps_mancuerna',     'Extensión de tríceps con mancuerna','brazos',false,542),
  ('triceps_sobre_cabeza',  'Tríceps sobre la cabeza en polea','brazos',false, 551),
  ('patada_triceps',        'Patada de tríceps',           'brazos',  false, 552),
  ('fondos_banco',          'Fondos en banco',             'brazos',  false, 553),
  ('triceps_maquina',       'Tríceps en máquina',          'brazos',  false, 554),
  ('plancha',               'Plancha',                     'core',    false, 601),
  ('plancha_lateral',       'Plancha lateral',             'core',    false, 602),
  ('crunch',                'Crunch',                      'core',    false, 611),
  ('crunch_declinado',      'Crunch en banco declinado',   'core',    false, 612),
  ('elevacion_piernas',     'Elevación de piernas colgado','core',    false, 613),
  ('elevacion_rodillas',    'Elevación de rodillas',       'core',    false, 614),
  ('giros_rusos',           'Russian twist',                 'core',    false, 621),
  ('bicicleta_abdominal',   'Abdominales bicicleta',       'core',    false, 622),
  ('dead_bug',              'Dead bug',                    'core',    false, 623),
  ('press_pallof',          'Press Pallof',                'core',    false, 624)
on conflict (id) do nothing;

-- Los isométricos: lo que se mide es tiempo, y un número en kilos no tiene
-- con qué compararse. Va como `update` y no en el `insert` para que la lista
-- de excepciones se lea de un vistazo, en vez de esconderse en una columna
-- más de cien filas.
update public.ejercicios
   set admite_peso = false
 where id in ('plancha', 'plancha_lateral', 'dead_bug');

-- QUÉ SIGNIFICA EL NÚMERO (migración 38).
-- Los que no son `total`. La lista va entera acá y no repartida en el insert
-- del catálogo, para que se lea de un vistazo qué se decidió.
update public.ejercicios set carga = 'par' where id in (
  -- dos mancuernas
  'press_mancuernas', 'press_inclinado_mancuernas', 'aperturas',
  'press_militar_mancuernas', 'press_arnold', 'elevaciones_laterales',
  'elevaciones_frontales', 'pajaros', 'encogimientos',
  'curl_mancuernas', 'martillo', 'curl_inclinado', 'curl_muneca',
  'zancadas', 'zancadas_caminando', 'zancada_inversa', 'sentadilla_bulgara',
  'subida_cajon', 'peso_muerto_una_pierna',
  -- dos poleas: el número de cada lado
  'cruce_polea_alta', 'cruce_polea_baja'
);

-- EL MODO "una" ES "UN LADO POR VEZ" Y MULTIPLICA POR DOS (migracion 47).
-- Antes valia ademas para "una mancuerna con las dos manos", que es otra cosa:
-- ahi el numero escrito ES el total movido, asi que la sentadilla goblet, el
-- pullover y el triceps con mancuerna pasaron a "total".
update public.ejercicios set carga = 'una' where id in (
  -- una mancuerna, un brazo por vez: el numero se mueve dos veces
  'remo_mancuerna', 'curl_concentrado', 'patada_triceps'
);

update public.ejercicios set carga = 'lastre' where id in (
  'dominadas', 'dominadas_supinas', 'dominadas_lastradas', 'remo_invertido',
  'fondos', 'fondos_banco', 'flexiones', 'hiperextensiones',
  'crunch', 'elevacion_piernas', 'elevacion_rodillas', 'bicicleta_abdominal',
  'rueda_abdominal'
);

-- Los que se preguntan. Además de los nueve que se propusieron —el nombre no
-- dice el equipo—, los que en el gimnasio se hacen seguido de las dos formas.
update public.ejercicios set carga_ambigua = true where id in (
  'zancadas', 'zancadas_caminando', 'zancada_inversa', 'sentadilla_bulgara',
  'martillo', 'curl_inclinado', 'press_arnold', 'remo_menton', 'curl_muneca',
  'peso_muerto_rumano', 'peso_muerto_rigidas', 'peso_muerto_una_pierna',
  'subida_cajon', 'puente_gluteo', 'gemelos',
  'aperturas', 'pajaros', 'elevaciones_frontales', 'encogimientos',
  'rotacion_externa', 'press_frances', 'curl_predicador', 'patada_triceps'
);

-- EL CARDIO (migración 76): ejercicios que se miden en minutos. Sin peso, fuera
-- del DOTS, con su propio grupo.
insert into public.ejercicios (id, nombre, grupo, cuenta_dots, admite_peso, orden, carga, mide) values
  ('cinta',           'Cinta',             'cardio', false, false, 900, 'total', 'tiempo'),
  ('correr',          'Correr afuera',     'cardio', false, false, 901, 'total', 'tiempo'),
  ('caminar',         'Caminar',           'cardio', false, false, 902, 'total', 'tiempo'),
  ('bicicleta_fija',  'Bicicleta fija',    'cardio', false, false, 903, 'total', 'tiempo'),
  ('eliptica',        'Elíptica',          'cardio', false, false, 904, 'total', 'tiempo'),
  ('remo_ergometro',  'Remo ergómetro',    'cardio', false, false, 905, 'total', 'tiempo'),
  ('escaladora',      'Escaladora',        'cardio', false, false, 906, 'total', 'tiempo'),
  ('soga',            'Saltar la soga',    'cardio', false, false, 907, 'total', 'tiempo'),
  ('natacion',        'Natación',          'cardio', false, false, 908, 'total', 'tiempo')
on conflict (id) do nothing;


-- -------------------------------------------------------------
-- Las sesiones
--
-- La duración NO es una columna: es `fin - inicio`. Guardar el derivado
-- dejaría que quedara en desacuerdo con sus propias puntas.
--
-- "Sin duración" es la AUSENCIA de `fin`, no un valor especial: el check hace
-- que una sesión abandonada no pueda tener fin, así la regla de "no inventes
-- un número" la sostiene la base y no la memoria de quien programe después.
--
-- log_id con cascade: si el día se borra desde el calendario, la sesión se va
-- con él. Una sesión de un día que no existe no mide nada.
-- -------------------------------------------------------------
create table public.sesiones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_id uuid not null references public.logs(id) on delete cascade,
  inicio timestamptz not null default now(),
  fin timestamptz,
  estado text not null default 'corriendo'
    check (estado in ('corriendo', 'terminada', 'abandonada')),
  -- Cuántas series tuvo. Un toque por serie, sin ejercicio ni peso (§20.3):
  -- cuarenta minutos con doce series y cuarenta con tres no son el mismo
  -- entrenamiento, así que dice más que los minutos solos.
  series int not null default 0 check (series >= 0),
  -- De dónde salió la sesión. Solo se cierran solas al salir del gimnasio las
  -- que arrancaron solas al llegar (§13): la que empezaste vos con el botón se
  -- queda corriendo aunque salgas — quizá te fuiste a correr afuera.
  --
  -- No lleva 'salud' como `logs.origen`: una pulsera puede decir que
  -- entrenaste, no cuándo arrancaste ni cuándo paraste.
  origen text not null default 'manual',
  -- Si el día de gimnasio lo creó ESTA sesión. Sirve para deshacerlo cuando
  -- queda claro que no hubo entrenamiento: tocar "Iniciar" sin querer
  -- registraba el día y ese día ya no se iba nunca.
  creo_el_dia boolean not null default false,
  -- EN QUÉ ESTABAS. Lista ordenada de {ejercicio, series}: una anotación
  -- encima del contador, no un reemplazo. `series` sigue siendo el total y la
  -- única verdad del conteo, así que con `bloques` en [] la app funciona
  -- exactamente igual que antes — que es lo que hace que se pueda ignorar sin
  -- perder nada. Desde la 36 un bloque puede llevar `pesos` (en kilos) y,
  -- con ellos, desde la 38 `carga`: qué significa el número ese día. La 39
  -- marcó con `carga_supuesta` los que se anotaron antes de la etiqueta y
  -- pueden estar mal; `revisar_carga` saca la marca.
  bloques jsonb not null default '[]'::jsonb,
  -- La última vez que pasó algo: una serie, un cambio de ejercicio o de peso,
  -- o el FIN de un descanso corriendo (migración 37). La sesión se cierra sola
  -- media hora después, fechada acá y no en "ahora".
  ultima_actividad timestamptz not null default now(),
  -- Si la cerró el automático y no la persona: el teléfono lo avisa una vez.
  cerro_sola boolean not null default false,
  constraint sesiones_bloques_es_lista check (jsonb_typeof(bloques) = 'array'),
  constraint sesiones_origen_valido check (origen in ('manual', 'ubicacion')),
  constraint sesiones_fin_solo_si_termino check ((estado = 'terminada') = (fin is not null))
);

-- una sola corriendo por usuario, garantizado por la base y no por el cliente
create unique index sesiones_una_corriendo
  on public.sesiones (user_id) where estado = 'corriendo';
create index sesiones_por_usuario
  on public.sesiones (user_id, inicio desc);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000),
  tipo text not null default 'idea' check (tipo in ('bug','idea')),
  fecha timestamptz not null default now(),
  version_app text,
  plataforma text,
  pantalla_origen text
);

-- -------------------------------------------------------------
-- ERRORES DE JS SIN ATRAPAR (el buzón de errores de la app)
--
-- POR QUÉ EXISTE. Una actualización por el aire le llega a todos en segundos,
-- y un error de JS —no un crash nativo— NO aparece en el reporte de fallos de
-- App Store Connect: pasa en silencio. Este es el único lugar donde queda
-- rastro de que a alguien, en algún teléfono, la app le tiró.
--
-- QUÉ GUARDA Y QUÉ NO. El mensaje, la pila, la pantalla/contexto, la versión de
-- la app y la de OTA, la plataforma y un id anónimo por instalación. NADA de
-- datos personales ni contenido del usuario: el id no se puede volver a una
-- persona, es un número al azar que solo sirve para saber si diez errores son
-- de diez teléfonos o del mismo.
--
-- QUIÉN ESCRIBE Y QUIÉN LEE. Inserta CUALQUIERA, con sesión o sin ella (un
-- error puede pasar en el login, antes de entrar). NADIE lee desde el cliente:
-- no hay policy de select, así que solo el dueño lo ve por el panel o con la
-- service key. Los `check` de largo acotan lo que un insert abierto puede meter.
-- -------------------------------------------------------------
create table public.errores_js (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  mensaje text check (mensaje is null or char_length(mensaje) <= 2000),
  stack text check (stack is null or char_length(stack) <= 8000),
  pantalla text check (pantalla is null or char_length(pantalla) <= 300),
  version_app text check (version_app is null or char_length(version_app) <= 100),
  version_ota text check (version_ota is null or char_length(version_ota) <= 100),
  plataforma text check (plataforma is null or char_length(plataforma) <= 40),
  id_anonimo text check (id_anonimo is null or char_length(id_anonimo) <= 100)
);

-- -------------------------------------------------------------
-- EL DÍA DE CADA USUARIO
-- -------------------------------------------------------------

create or replace function public.hoy_de(p_user uuid)
returns date language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(
    (select zona from profiles where id = p_user), 'America/Montevideo'))::date;
$$;

create or replace function public.mi_hoy()
returns date language sql stable security definer set search_path = public as $$
  select hoy_de(auth.uid());
$$;

create or replace function public.fijar_zona(p_zona text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  actual text;
  previa text;
  cambiada timestamptz;
  sospechoso boolean;
begin
  if uid is null or p_zona is null then return; end if;
  -- Texto libre no: una zona inventada haría que `at time zone` reviente en
  -- cada consulta de fecha, o peor, que caiga en algo que no es la del
  -- usuario. Se comprueba contra la tabla de zonas de Postgres.
  if not exists (select 1 from pg_timezone_names where name = p_zona) then
    raise exception 'zona horaria desconocida: %', p_zona;
  end if;
  select zona, zona_previa, zona_cambiada into actual, previa, cambiada
    from profiles where id = uid;
  if actual is distinct from p_zona then
    -- SOSPECHOSO = el patrón del que hace trampa, no el del que viaja. Dos
    -- señales, y solo estas arman el bloqueo (migración 50, "B+C"):
    --   - dos cambios en menos de 24 h (el flip-flop: registrar, cambiar de
    --     huso, registrar de nuevo), o
    --   - volver a la zona inmediatamente anterior (A -> B -> A).
    -- Un cambio ÚNICO (un viaje real) NO es sospechoso, y el PRIMER cambio de
    -- un usuario nuevo tampoco: ahí `zona_cambiada` es null y `zona_previa`
    -- también, así que ninguna de las dos señales se cumple. Resultado: el
    -- viajero honesto y el que recién baja la app fuera de Uruguay nunca ven
    -- "tu día quedó pendiente".
    sospechoso := (cambiada is not null and now() - cambiada < interval '24 hours')
                  or (p_zona is not distinct from previa);
    update profiles set
      zona_previa = actual,
      zona = p_zona,
      zona_cambiada = now(),
      zona_bloqueo_desde = case when sospechoso then now() else zona_bloqueo_desde end
    where id = uid;
  end if;
end;
$$;

create or replace function public.bloqueo_hasta(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(l.creado) + interval '20 hours'
    from logs l, profiles p
   where l.user_id = p_user and p.id = p_user
     -- Solo un cambio SOSPECHOSO arma el bloqueo (ver `fijar_zona`), y solo por
     -- 20 h: pasada la ventana ya no frena nada. Sin el segundo `and`, un
     -- cambio sospechoso de hace meses bloquearía para siempre el registro
     -- diario, porque el resto del filtro se cumple con cualquier log reciente.
     and p.zona_bloqueo_desde is not null
     and p.zona_bloqueo_desde > now() - interval '20 hours'
     and l.creado > p.zona_bloqueo_desde - interval '20 hours'
     and now() - l.creado < interval '20 hours';
$$;

create or replace function public.puede_registrar_hoy(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select bloqueo_hasta(p_user) is null;
$$;

create or replace function public.resolver_pendiente(p_user uuid)
returns date language plpgsql security definer set search_path = public as $$
declare
  pend date;
  puesto date := null;
begin
  select dia_pendiente into pend from profiles where id = p_user;
  if pend is null then return null; end if;
  if bloqueo_hasta(p_user) is not null then return null; end if;

  -- Si mientras tanto el día ya se registró por otro camino —el calendario,
  -- por ejemplo— no se duplica: se limpia el pendiente y listo.
  if not exists (select 1 from logs where user_id = p_user and fecha = pend)
     and pend <= hoy_de(p_user) then
    insert into logs (user_id, fecha) values (p_user, pend);
    puesto := pend;
  end if;

  update profiles set dia_pendiente = null, pendiente_desde = null where id = p_user;
  return puesto;
end;
$$;

-- -------------------------------------------------------------
-- FUNCIONES DE RACHA
-- -------------------------------------------------------------

-- Duraciones crecientes (migración 54), siete rangos, sin "Sistema":
-- Polvo 1-5 · Asteroide 6-15 · Luna 16-30 · Planeta 31-50 · Sol 51-75 ·
-- Galaxia 76-105 · Agujero negro 106+. Mismos umbrales que DESDE_RANGO en
-- `nucleo/reglas.ts`; `test:db` los compara día por día del 1 al 200.
create or replace function public.rango_de_racha(r int)
returns int language sql immutable as $$
  select case
    when r >= 106 then 7
    when r >= 76  then 6
    when r >= 51  then 5
    when r >= 31  then 4
    when r >= 16  then 3
    when r >= 6   then 2
    else 1
  end;
$$;

-- Rango 4 (Planeta) = rachas 31..50: cuatro días por planeta.
create or replace function public.planeta_de_dia(r int)
returns text language sql immutable as $$
  select case when r between 31 and 50
    then (array['Ceres','Mercurio','Marte','Venus','Saturno'])[(r - 31) / 4 + 1]
  end;
$$;

-- Racha calculada caminando hacia atrás desde p_hasta:
-- día con log de entrenamiento -> suma 1; día de descanso (log o día fijo) -> no corta;
-- día vacío que no era descanso -> corta.
-- Qué días de descanso regían en una fecha dada. Devuelve la configuración
-- más reciente que ya estaba vigente ese día; si no había ninguna, ninguno.
create or replace function public.descansos_vigentes(p_user uuid, p_fecha date)
returns int[] language sql stable security definer set search_path = public as $$
  select coalesce(
    (select dias from descansos
      where user_id = p_user and desde <= p_fecha
      order by desde desc limit 1),
    '{}'::int[]);
$$;

-- -------------------------------------------------------------
-- LAS VIDAS (migración 32)
-- -------------------------------------------------------------
-- Se aplican solas y no se acumulan (el porqué, en
-- `supabase/migracion-32-vidas.sql` y `spec/producto.md`). CUÁNTAS: no son
-- "tres por mes" desde la migración 34 — son DOS, y la tercera se tiene
-- mientras la racha esté en 20 o más (`impulsos_ganados`, abajo).
create table if not exists public.vidas_usadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- El día que quedó cubierto. Único por usuario: cubrir dos veces el mismo
  -- día sería gastar dos vidas por una sola falta.
  fecha date not null,
  creado timestamptz not null default now(),
  -- Devolver una vida (migración 33): "guardarla para después". La fila NO se
  -- borra, se marca — un día devuelto no se puede volver a cubrir, o la
  -- devolución sería un botón que no hace nada.
  devuelta boolean not null default false,
  unique (user_id, fecha)
);
create index if not exists vidas_por_usuario on public.vidas_usadas (user_id, fecha);

alter table public.vidas_usadas enable row level security;

-- Solo el dueño las ve. Y NADIE las escribe desde el cliente: las pone
-- `verificar_perdida`, que es SECURITY DEFINER. Una vida que el teléfono
-- pudiera insertar sería una racha que el teléfono puede inventar.
drop policy if exists "vidas: solo dueño" on public.vidas_usadas;
create policy "vidas: solo dueño" on public.vidas_usadas for select
  using (user_id = auth.uid());

grant select on public.vidas_usadas to authenticated;

create or replace function public.impulsos_tope()
returns int language sql immutable as $$ select 3; $$;

/**
 * Cuántos tenés GANADOS: dos al empezar y el tercero a los 20 días de racha.
 * Ver la migración 34 — se ganan, no se recargan.
 */
create or replace function public.impulsos_ganados(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select least(
    impulsos_tope(),
    2 + case when coalesce((select racha_actual from profiles where id = p_user), 0) >= 20
             then 1 else 0 end
  );
$$;

-- -------------------------------------------------------------
-- LAS VIDAS VUELVEN TODAS JUNTAS (migración 79)
-- -------------------------------------------------------------
-- Hasta la 78 cada vida volvía treinta días después de usarla, de a una. Desde
-- el 15/10 (pedido del humano) vuelven TODAS JUNTAS: la primera vida que se usa
-- abre un ciclo de treinta días, y al cerrarse vuelven todas las que se usaron
-- en ese ciclo. La próxima que se use abre otro.
--
-- Cuántas se tienen no cambia (dos, y la tercera con racha de 20: ver
-- `impulsos_ganados`). Las devueltas no cuentan, como antes.

-- UNA VIDA DE UN DÍA QUE AL FINAL FUISTE NO CUENTA (migración 84): marcarlo "Fui"
-- después arreglaba la racha y dejaba la vida gastada todo el ciclo. Se decide al
-- leer: si el día vuelve a "Sin registrar", la vida vuelve a contar.
--
-- El día en que empezó el ciclo vigente el día `p_dia`, o null si no hay uno
-- abierto. Mira solo las vidas usadas hasta ese día: un día pasado se juzga con
-- lo que había entonces.
create or replace function public.inicio_ciclo_vidas(p_user uuid, p_dia date)
returns date language plpgsql stable security definer set search_path = public as $$
declare
  inicio date := null;
  f date;
begin
  for f in
    select v.fecha from vidas_usadas v
     where v.user_id = p_user and not v.devuelta and v.fecha <= p_dia
       and not exists (select 1 from logs l where l.user_id = p_user and l.fecha = v.fecha and not l.es_descanso)
     order by v.fecha
  loop
    if inicio is null or f >= inicio + 30 then inicio := f; end if;
  end loop;
  if inicio is not null and p_dia >= inicio + 30 then return null; end if;
  return inicio;
end;
$$;
revoke execute on function public.inicio_ciclo_vidas(uuid, date) from public, anon, authenticated;

-- TODAS LAS DEL CICLO, TAMBIÉN LAS DE DESPUÉS DE p_dia (cacería del 15/10): la pérdida
-- recorre las faltas del día más nuevo al más viejo, y cada día tiene que contar las
-- vidas que acaba de poner en los siguientes. Si no, con dos vidas se cubrían tres.
-- El INICIO del ciclo sí sale solo de lo anterior; sin ciclo abierto, p_dia lo abre.
create or replace function public.impulsos_disponibles(p_user uuid, p_dia date)
returns int language sql stable security definer set search_path = public as $$
  with c as (select coalesce(inicio_ciclo_vidas(p_user, p_dia), p_dia) as ini)
  select greatest(0, impulsos_ganados(p_user) - coalesce((
    select count(*)::int from vidas_usadas v, c
     where v.user_id = p_user
       and not v.devuelta
       and v.fecha >= c.ini
       and v.fecha < c.ini + 30
       and not exists (select 1 from logs l where l.user_id = p_user and l.fecha = v.fecha and not l.es_descanso)
  ), 0));
$$;

create or replace function public.mis_impulsos()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', impulsos_ganados(auth.uid()),
    'tope', impulsos_tope(),
    'quedan', impulsos_disponibles(auth.uid(), mi_hoy()),
    -- Cuánta racha falta para ganar el que viene. `null` si ya están todos.
    'falta_para_ganar', case
      when impulsos_ganados(auth.uid()) >= impulsos_tope() then null
      else greatest(0, 20 - coalesce((select racha_actual from profiles where id = auth.uid()), 0))
    end,
    -- Las usadas en el ciclo abierto, y el día en que vuelven todas.
    'vigentes', coalesce((
      select jsonb_agg(v.fecha order by v.fecha)
        from vidas_usadas v
       where v.user_id = auth.uid()
         and not v.devuelta
         and v.fecha >= inicio_ciclo_vidas(auth.uid(), mi_hoy())
         and v.fecha <= mi_hoy()
         and not exists (select 1 from logs l where l.user_id = v.user_id and l.fecha = v.fecha and not l.es_descanso)
    ), '[]'::jsonb),
    'vuelve', inicio_ciclo_vidas(auth.uid(), mi_hoy()) + 30,
    'ultimas', coalesce((
      select jsonb_agg(fecha order by fecha desc)
        from (
          select v.fecha from vidas_usadas v
           where v.user_id = auth.uid() and not v.devuelta
             and not exists (select 1 from logs l where l.user_id = v.user_id and l.fecha = v.fecha and not l.es_descanso)
           order by v.fecha desc limit 5
        ) x
    ), '[]'::jsonb),
    'ultima', (
      select max(v.fecha) from vidas_usadas v
       where v.user_id = auth.uid() and not v.devuelta
         and not exists (select 1 from logs l where l.user_id = v.user_id and l.fecha = v.fecha and not l.es_descanso)
    )
  );
$$;
revoke execute on function public.mis_impulsos() from public, anon;
grant execute on function public.mis_impulsos() to authenticated;

/**
 * Devolver las vidas de una ausencia: se guardan para después y la racha se
 * corta como si nunca se hubieran usado.
 *
 * ES IRREVERSIBLE Y TIENE QUE SERLO: deshacerlo sería devolver una racha que
 * ya se dio por perdida, y ahí la racha deja de significar algo.
 *
 * SOLO DÍAS RECIENTES. Sin el límite, esto sería una máquina de reescribir
 * historia: alguien podría devolver una vida de hace tres meses y recalcular
 * una racha de entonces. Siete días es más que suficiente para el caso real,
 * que es "me enteré hoy y prefiero guardarla".
 */
create or replace function public.devolver_impulsos(p_fechas date[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cuantas int;
  d date;
  hoy_descanso boolean;
  perfil profiles;
  previa int;
  viva int;
  nueva int;
  racha int;
begin
  if uid is null then return null; end if;

  update vidas_usadas
     set devuelta = true
   where user_id = uid
     and fecha = any(p_fechas)
     and not devuelta
     and fecha >= mi_hoy() - 7;
  get diagnostics cuantas = row_count;

  if cuantas = 0 then
    return jsonb_build_object('devueltas', 0);
  end if;

  -- CON EL DÍA DE HOY YA ANOTADO (migración 85): es el caso normal —la vida se gasta
  -- cuando entra hoy al llegar al gimnasio, y la pregunta sale al terminar—, y
  -- `aplicar_perdida_al` se va sin cobrar nada si hoy tiene log. La racha seguía
  -- entera con un día sin cubrir debajo, y la primera corrección la tiraba a 1. Se
  -- cobra acá: la racha de antes de hoy menos 10, y hoy encima.
  d := mi_hoy();
  select es_descanso into hoy_descanso from logs where user_id = uid and fecha = d;
  if found then
    select * into perfil from profiles where id = uid;
    previa := perfil.racha_actual - case when hoy_descanso then 0 else 1 end;
    viva := perfil.racha_base + calcular_racha(uid, d - 1);
    if viva >= previa then
      return jsonb_build_object('devueltas', cuantas, 'perdida', jsonb_build_object('perdida', false));
    end if;
    nueva := greatest(0, previa - 10);
    update profiles set racha_base = nueva, perdida_fecha = d - 1 where id = uid;
    racha := nueva + calcular_racha(uid, d);
    update profiles set racha_actual = racha, rango_actual = rango_de_racha(racha) where id = uid;
    -- El día de hoy lleva el número nuevo (es una etiqueta: no vuelve a contar nada).
    update logs set racha_del_dia = racha, planeta_del_dia = planeta_de_dia(racha)
     where user_id = uid and fecha = d and not es_descanso;
    return jsonb_build_object('devueltas', cuantas, 'perdida', jsonb_build_object(
      'perdida', true, 'rango_anterior', perfil.rango_actual, 'rango_nuevo', rango_de_racha(racha),
      'racha', racha, 'vidas_quedan', impulsos_disponibles(uid, d)));
  end if;

  return jsonb_build_object('devueltas', cuantas, 'perdida', verificar_perdida());
end;
$$;

revoke execute on function public.devolver_impulsos(date[]) from public, anon;
grant execute on function public.devolver_impulsos(date[]) to authenticated;

create or replace function public.calcular_racha(p_user uuid, p_hasta date)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  d date := p_hasta;
  cnt int := 0;
  tope date;
  tiene_log boolean;
  log_descanso boolean;
begin
  select perdida_fecha into tope from profiles where id = p_user;
  loop
    -- los días hasta la última pérdida ya viven en racha_base: no se recuentan
    if tope is not null and d <= tope then exit; end if;
    select true, es_descanso into tiene_log, log_descanso
      from logs where user_id = p_user and fecha = d;
    if tiene_log then
      if not log_descanso then cnt := cnt + 1; end if;
    -- El descanso se evalúa con la configuración que regía ESE día, no con
    -- la de hoy: cambiar de rutina nunca puede alterar el pasado.
    elsif extract(dow from d)::int = any(descansos_vigentes(p_user, d)) then
      null; -- día de descanso sin log: no corta
    -- Un día cubierto por una vida: tampoco corta, y tampoco suma. `not
    -- devuelta` porque devolver la vida es justamente decir "que este día
    -- corte".
    elsif exists (
      select 1 from vidas_usadas
       where user_id = p_user and fecha = d and not devuelta
    ) then
      null;
    else
      exit;
    end if;
    d := d - 1;
    if d < p_hasta - 3650 then exit; end if; -- tope de seguridad
  end loop;
  return cnt;
end;
$$;

-- La mejor racha SALE DEL HISTORIAL: recorre todos los días registrados y
-- devuelve la racha más larga que hubo. No es un contador que solo sube.
-- Si alguien registra días por error y los borra, el récord tiene que bajar:
-- un máximo inflado que no se puede corregir es un dato falso para siempre.
create or replace function public.mejor_racha_real(p_user uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  anterior date := null;
  corriente int := 0;
  maximo int := 0;
  d date;
begin
  for r in
    select fecha, es_descanso from logs where user_id = p_user order by fecha
  loop
    if anterior is not null then
      -- se revisan los días entre medio: cortan salvo que fueran de descanso
      -- o que una vida NO devuelta los haya cubierto
      d := anterior + 1;
      while d < r.fecha loop
        if not (extract(dow from d)::int = any(descansos_vigentes(p_user, d)))
           and not exists (
             select 1 from vidas_usadas
              where user_id = p_user and fecha = d and not devuelta
           )
        then
          corriente := 0;
          exit;
        end if;
        d := d + 1;
      end loop;
    end if;
    if not r.es_descanso then corriente := corriente + 1; end if;
    if corriente > maximo then maximo := corriente; end if;
    anterior := r.fecha;
  end loop;
  return maximo;
end;
$$;

-- EL TECHO DEL RÉCORD: hasta dónde puede haber llegado la racha con ESTE
-- historial, contando como cuenta la racha —un corte resta 10, una vez por
-- corte, y no vuelve a cero (§12)—.
--
-- No es el récord: es su tope cuando se BORRAN días (migración 61). El récord
-- sube con la racha de verdad; este número solo sirve para bajarlo si el
-- historial ya no lo sostiene. Puede dar más que lo que la persona tuvo (la
-- racha no siempre arrastra: borrar un día del medio o recalcular desde cero
-- cortan en seco), y por eso nunca se usa para SUBIR nada.
create or replace function public.techo_de_mejor_racha(p_user uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  anterior date := null;
  corriente int := 0;
  maximo int := 0;
  d date;
begin
  for r in
    select fecha, es_descanso from logs where user_id = p_user order by fecha
  loop
    if anterior is not null then
      d := anterior + 1;
      while d < r.fecha loop
        if not (extract(dow from d)::int = any(descansos_vigentes(p_user, d)))
           and not exists (
             select 1 from vidas_usadas
              where user_id = p_user and fecha = d and not devuelta
           )
        then
          corriente := greatest(0, corriente - 10);
          exit;
        end if;
        d := d + 1;
      end loop;
    end if;
    if not r.es_descanso then corriente := corriente + 1; end if;
    if corriente > maximo then maximo := corriente; end if;
    anterior := r.fecha;
  end loop;
  return maximo;
end;
$$;

-- Cambiar los días de descanso. Rige desde hoy hacia adelante: el pasado
-- queda congelado con la configuración que estaba vigente entonces.
create or replace function public.fijar_descansos(p_dias int[])
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio int[] := coalesce(p_dias, '{}'::int[]);
begin
  if uid is null then return; end if;
  if exists (select 1 from unnest(limpio) x where x < 0 or x > 6) then
    raise exception 'día de semana inválido';
  end if;
  insert into descansos (user_id, desde, dias) values (uid, mi_hoy(), limpio)
    on conflict (user_id, desde) do update set dias = excluded.dias;
  update profiles set dias_descanso = limpio where id = uid;
end;
$$;

-- Antes de insertar: fijar el planeta del día si el día cae en el rango 4
create or replace function public.logs_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r int;
  perfil profiles;
begin
  -- el planeta lo decide siempre el trigger, nunca el cliente
  new.planeta_del_dia := null;
  -- EL DÍA DE RACHA TAMPOCO LO TRAE EL CLIENTE (migración 62). Lo escribe
  -- `logs_after_change`, por donde pasan todos los caminos: antes lo ponía solo
  -- `registrar_dia`, y un día que entraba por el pendiente de cambio de zona o
  -- marcado a mano desde el calendario nacía sin número.
  new.racha_del_dia := null;
  select * into perfil from profiles where id = new.user_id;
  -- Un día de ANTES de la última pérdida no tiene cuenta posible: la racha se
  -- mide desde ahí. Queda sin número y sin planeta, en vez de con uno inventado.
  --
  -- UNA ETIQUETA NO PUEDE FRENAR EL DÍA (migración 62). Un error en un
  -- disparador aborta la sentencia entera: si esta cuenta fallara, nadie podría
  -- registrar. El planeta es un dato derivado; si no se puede calcular, el día
  -- entra sin él y queda un aviso en el registro de la base.
  begin
    if not new.es_descanso and (perfil.perdida_fecha is null or new.fecha > perfil.perdida_fecha) then
      r := perfil.racha_base + calcular_racha(new.user_id, new.fecha - 1) + 1;
      -- SIN BORDE PROPIO. Qué días tienen planeta lo dice `planeta_de_dia`, que
      -- devuelve null fuera del rango. Acá había un "entre 30 y 39" copiado, y
      -- cuando la migración 54 corrió el rango a 31..50 los días 40 a 50
      -- quedaban sin planeta guardado.
      new.planeta_del_dia := planeta_de_dia(r);
    end if;
  exception when others then
    new.planeta_del_dia := null;
    raise warning 'logs_before_insert: el planeta del día no se pudo calcular (%)', sqlerrm;
  end;
  return new;
end;
$$;

-- Después de cualquier cambio en logs: recalcular racha, mejor racha y rango.
-- La racha vive como columna (duplicación deliberada) para que la tabla de
-- posiciones no recorra los logs de todos los amigos en cada carga.
create or replace function public.logs_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  desde date := coalesce(new.fecha, old.fecha);
  hasta date;
  base int;
  r int;
begin
  -- UN CAMBIO QUE NO MUEVE LA RACHA NO RECALCULA NADA (migración 57). Desde que
  -- el log guarda etiquetas —el día de racha, el planeta—, escribirlas es un
  -- UPDATE, y este disparador lo trataba como una corrección: volvía a contar
  -- la racha y a calcular los planetas de ese día en adelante. Para los días de
  -- antes de la última pérdida esa cuenta da "sin planeta", así que el relleno
  -- de la 57 —que toca todos los logs— borraba los planetas de las rachas
  -- viejas. Lo que mueve la racha es de quién es el día, qué día es y si es
  -- descanso; lo demás son etiquetas.
  if tg_op = 'UPDATE'
     and new.user_id = old.user_id and new.fecha = old.fecha and new.es_descanso = old.es_descanso then
    return new;
  end if;

  -- Perfil borrado (baja de cuenta): al borrar el perfil, la cascada arrastra
  -- todos sus logs y este trigger correría una vez por fila, recorriendo el
  -- historial completo cada vez, para terminar escribiendo sobre un perfil
  -- que ya no existe. Si no está, no hay nada que recalcular.
  if not exists (select 1 from profiles where id = uid) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Si el usuario borró a mano justo el día que estaba esperando, es una
  -- decisión suya y gana: sin esto, `resolver_pendiente` lo volvía a poner
  -- solo la próxima vez que se abría la app, deshaciendo un borrado adrede.
  if tg_op = 'DELETE' then
    update profiles set dia_pendiente = null, pendiente_desde = null
     where id = uid and dia_pendiente = old.fecha;
  end if;

  -- La racha se mide hasta el último día registrado, NO hasta ayer.
  -- Con "hasta ayer", corregir a mano un día viejo estando cortado dejaba la
  -- racha en 0 al instante, salteándose la regla de -10: bajar la racha es
  -- tarea exclusiva de verificar_perdida.
  select coalesce(max(fecha), current_date) into hasta from logs where user_id = uid;
  select racha_base into base from profiles where id = uid;
  r := base + calcular_racha(uid, hasta);
  update profiles set
    racha_actual = r,
    -- EL RÉCORD NO BAJA SOLO (migración 61). Antes era
    -- `greatest(mejor_racha_real, r)` a secas: un récord hecho con racha
    -- arrastrada (40 días, se pierde, 25 más: 55) no salía del historial, que
    -- da 40, así que lo sostenía solo la racha y con la pérdida siguiente
    -- bajaba a 46 sin que se borrara nada.
    --  - Al ENTRAR un día, el récord guardado se queda: solo puede subir.
    --  - Al BORRAR o cambiar un día, el historial es el techo: si ya no lo
    --    sostiene, baja. Es la regla de siempre —un récord de días anotados
    --    por error tiene que poder corregirse—.
    mejor_racha = greatest(
      case when tg_op = 'INSERT' then mejor_racha
           else least(mejor_racha, techo_de_mejor_racha(uid)) end,
      mejor_racha_real(uid),
      r),
    rango_actual = rango_de_racha(r)
  where id = uid;

  -- El planeta de un día depende de la racha que corría ESE día. Al corregir
  -- un día viejo a mano, los posteriores cambian de racha y su planeta queda
  -- viejo: el álbum mostraría la secuencia corrida. Se recalculan los días
  -- desde el que cambió en adelante.
  -- pg_trigger_depth() corta la recursión de este mismo update, y el
  -- "is distinct from" evita escrituras que no cambian nada.
  --
  -- EL DÍA DE RACHA VA CON ÉL (migración 62): meter o sacar un día viejo corre
  -- el número de todos los de después, y el planeta sale de ese número. Solo
  -- los posteriores a la última pérdida: los de antes no tienen cuenta posible
  -- y se quedan como estén.
  --
  -- Y NINGUNO DE LOS DOS PUEDE FRENAR EL DÍA: son etiquetas. Van en su propio
  -- bloque: si fallan, se deshace SOLO esto —el día y la racha de arriba ya
  -- quedaron— y se deja un aviso en el registro de la base. Antes de la 62 el
  -- recálculo del planeta ya corría acá sin esta red.
  if pg_trigger_depth() = 1 then
    begin
      update logs l set racha_del_dia = c.dia, planeta_del_dia = planeta_de_dia(c.dia)
        from (
          select x.id, base + calcular_racha(uid, x.fecha) as dia
            from logs x
           where x.user_id = uid and not x.es_descanso and x.fecha >= desde
             and x.fecha > coalesce((select perdida_fecha from profiles where id = uid), '-infinity'::date)
        ) c
       where l.id = c.id
         and (l.racha_del_dia is distinct from c.dia or l.planeta_del_dia is distinct from planeta_de_dia(c.dia));
    exception when others then
      raise warning 'logs_after_change: el día de racha y el planeta no se pudieron escribir (%)', sqlerrm;
    end;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- El CHECK de la tabla es un tope grosero —el día de la zona más adelantada
-- del planeta— porque un CHECK corre por fila y no puede mirar el perfil. La
-- comprobación fina va acá, que sí puede, y cubre también el insert directo
-- del calendario de corrección: sin esto se podía escribir un día futuro en
-- la zona propia y la racha lo contaba.
create or replace function public.logs_no_futuros()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fecha > hoy_de(new.user_id) then
    raise exception 'ese día todavía no llegó';
  end if;
  return new;
end;
$$;

create trigger trg_logs_no_futuros before insert or update on public.logs
  for each row execute function public.logs_no_futuros();

create trigger trg_logs_before_insert before insert on public.logs
  for each row execute function public.logs_before_insert();
create trigger trg_logs_after_change after insert or update or delete on public.logs
  for each row execute function public.logs_after_change();

-- -------------------------------------------------------------
-- PÉRDIDA DE RACHA (se dispersa, no explota: baja un rango, nunca a cero)
-- Llamar al abrir la app. Devuelve si hubo pérdida para animarla.
-- -------------------------------------------------------------
-- p_hoy viene del cliente: el servidor corre en UTC y el usuario en UTC-3;
-- sin esto, a la noche uruguaya el servidor evaluaría "hoy" un día adelantado
-- y quitaría rachas con el día todavía en curso.

-- LA CUENTA DE LA PÉRDIDA, "A TAL DÍA" (migración 59).
--
-- Es la lógica de siempre —¿quedó un hueco?, ¿lo cubre una vida?, y si no,
-- restar 10— mirando la racha como estaba la mañana de `p_dia`. Con `p_dia` =
-- hoy es lo que hace `verificar_perdida` al abrir Inicio. Se separó para que la
-- pueda correr también el disparador de los logs ANTES de que entre un día: ver
-- `logs_antes_revisar_perdida`, más abajo.
--
-- NO resuelve el día pendiente: eso es de `verificar_perdida_de`. Si lo hiciera,
-- el día pendiente —que entra con un insert— volvería a llamarla desde adentro.
create or replace function public.aplicar_perdida_al(p_user uuid, p_dia date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  perfil profiles;
  viva int;
  nuevo_rango int;
  nueva_racha int;
  d date;
  cubiertos date[] := '{}';
begin
  select * into perfil from profiles where id = p_user;
  if perfil.id is null or perfil.racha_actual = 0 then
    return jsonb_build_object('perdida', false);
  end if;
  if exists (select 1 from logs where user_id = p_user and fecha = p_dia) then
    return jsonb_build_object('perdida', false);
  end if;
  viva := perfil.racha_base + calcular_racha(p_user, p_dia - 1);
  if viva >= perfil.racha_actual then
    return jsonb_build_object('perdida', false);
  end if;

  d := p_dia - 1;
  loop
    exit when perfil.perdida_fecha is not null and d <= perfil.perdida_fecha;
    -- Tope de seguridad: un año atrás la racha ya sería 0 y no hay nada que
    -- cubrir. Sin esto, saltar descansos podría no terminar.
    exit when p_dia - d > 366;
    exit when exists (select 1 from logs where user_id = p_user and fecha = d);
    -- UN DÍA DE DESCANSO NO CORTA LA COBERTURA (arreglo del 30/9). Antes hacía
    -- `exit` y una falta real MÁS VIEJA que un descanso quedaba sin cubrir aunque
    -- hubiera vidas: quien descansa el finde perdía la racha injustamente. Ahora
    -- se SALTA —igual que un día ya cubierto— y se sigue mirando más atrás.
    if extract(dow from d)::int = any(descansos_vigentes(p_user, d))
       or exists (select 1 from vidas_usadas where user_id = p_user and fecha = d) then
      d := d - 1;
      continue;
    end if;
    -- ¿queda un impulso disponible para ESE día?
    exit when impulsos_disponibles(p_user, d) <= 0;
    insert into vidas_usadas (user_id, fecha) values (p_user, d)
      on conflict (user_id, fecha) do nothing;
    cubiertos := cubiertos || d;
    d := d - 1;
    exit when array_length(cubiertos, 1) >= impulsos_tope();
  end loop;

  if array_length(cubiertos, 1) > 0 then
    viva := perfil.racha_base + calcular_racha(p_user, p_dia - 1);
    if viva >= perfil.racha_actual then
      return jsonb_build_object(
        'perdida', false,
        'vidas_usadas', to_jsonb(cubiertos),
        'vidas_quedan', impulsos_disponibles(p_user, p_dia)
      );
    end if;
  end if;

  -- No alcanzó: la racha se corta igual, y los impulsos gastados NO se
  -- devuelven —el día que cubrieron sigue cubierto—. Devolverlos sería premiar
  -- la falta larga: el que faltó seis días terminaría con más que el que faltó
  -- dos.
  nueva_racha := greatest(0, perfil.racha_actual - 10);
  nuevo_rango := rango_de_racha(nueva_racha);
  update profiles set
    racha_actual = nueva_racha,
    racha_base = nueva_racha,
    rango_actual = nuevo_rango,
    perdida_fecha = p_dia - 1
  where id = p_user;
  return jsonb_build_object('perdida', true, 'rango_anterior', perfil.rango_actual,
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha,
    'vidas_usadas', to_jsonb(cubiertos),
    'vidas_quedan', impulsos_disponibles(p_user, p_dia));
end;
$$;

-- POR ID, para que la pueda correr el trabajo nocturno (sin sesión). Ver
-- migración 55. `hoy_de(p_user)` usa la zona de cada usuario, así una sola
-- corrida sirve para todos los husos. Primero entra el día que estaba
-- pendiente, y después se hace la cuenta a hoy.
create or replace function public.verificar_perdida_de(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  resuelto date;
begin
  resuelto := resolver_pendiente(p_user);
  return aplicar_perdida_al(p_user, hoy_de(p_user))
    || jsonb_build_object('pendiente_resuelto', resuelto);
end;
$$;

-- ANTES DE QUE ENTRE UN DÍA NUEVO SE REVISA LO QUE QUEDÓ SIN REVISAR ATRÁS
-- (migración 59).
--
-- EL BUG (4/10): LA RACHA SE CAÍA A 1. La pérdida la aplicaba solo
-- `verificar_perdida`, que corre al abrir Inicio. Si el día de hoy entraba
-- ANTES —el registro por ubicación con la app cerrada, la sesión que arranca
-- sola al llegar, marcar hoy desde el calendario— `logs_after_change` contaba
-- hacia atrás desde hoy, se topaba con el hueco de ayer y dejaba la racha en 1.
-- Y la revisión, cuando por fin llegaba, veía que hoy ya tenía día y salía sin
-- hacer nada. Ni vida ni -10: cuarenta días perdidos por llegar al gimnasio con
-- la app cerrada.
--
-- VA EN UN DISPARADOR, y no adentro de `registrar_dia`, porque el día entra por
-- más de un camino y el calendario lo inserta directo. Acá no lo puede saltear
-- ningún cliente, viejo o nuevo.
--
-- SOLO CUANDO EL DÍA QUE ENTRA ES MÁS NUEVO QUE TODOS LOS REGISTRADOS. Corregir
-- un día viejo es otra cosa: "ayer sí fui" tapa el hueco y no cobra nada, y un
-- día de hace un mes no dice nada de la racha de hoy.
create or replace function public.logs_antes_revisar_perdida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from logs where user_id = new.user_id and fecha >= new.fecha) then
    perform aplicar_perdida_al(new.user_id, new.fecha);
  end if;
  return new;
end;
$$;

-- EL NOMBRE DECIDE EL ORDEN: los disparadores de un mismo momento corren por
-- orden alfabético, y este tiene que ir ANTES que `trg_logs_before_insert`, que
-- calcula el planeta del día con la racha que quede después de la pérdida.
create trigger trg_logs_antes_perdida before insert on public.logs
  for each row execute function public.logs_antes_revisar_perdida();

-- El envoltorio: el camino de abrir la app. UNA línea, para que no pueda diverger
-- del batch. Mantiene la firma y los permisos de siempre.
create or replace function public.verificar_perdida()
returns jsonb language sql security definer set search_path = public as $$
  select public.verificar_perdida_de(auth.uid());
$$;

-- El barrido: corre la pérdida por cada cuenta con racha viva. Cada una en su
-- propio bloque, para que una fila mala no aborte el barrido entero.
create or replace function public.barrer_perdidas()
returns int language plpgsql security definer set search_path = public as $$
declare
  u uuid;
  n int := 0;
begin
  for u in select id from profiles where racha_actual > 0 loop
    begin
      perform verificar_perdida_de(u);
      n := n + 1;
    exception when others then
      null;
    end;
  end loop;
  return n;
end;
$$;

revoke execute on function public.verificar_perdida_de(uuid) from public, anon, authenticated;
-- Con la cuenta "a tal día" suelta, cualquiera podría cobrarle una pérdida a
-- otra cuenta: solo la llaman el disparador y `verificar_perdida_de`.
revoke execute on function public.aplicar_perdida_al(uuid, date) from public, anon, authenticated;
revoke execute on function public.logs_antes_revisar_perdida() from public, anon, authenticated;
revoke execute on function public.barrer_perdidas() from public, anon, authenticated;
grant execute on function public.barrer_perdidas() to service_role;

-- Corrección manual: recalcular todo desde los logs, sin piso de misericordia,
-- y aplicar la pérdida en la MISMA transacción. Devuelve el número final:
-- el usuario nunca puede ver una racha que después baja sola al recargar.
create or replace function public.recalcular_desde_cero()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hasta date;
  r int;
  perdida jsonb;
  perfil profiles;
begin
  select coalesce(max(fecha), mi_hoy()) into hasta from logs where user_id = uid;
  update profiles set racha_base = 0, perdida_fecha = null where id = uid;
  r := calcular_racha(uid, hasta);
  update profiles set
    racha_actual = r,
    -- Recalcular es mirar el historial de nuevo: el techo vale (ver `logs_after_change`).
    mejor_racha = greatest(least(mejor_racha, techo_de_mejor_racha(uid)), mejor_racha_real(uid), r),
    rango_actual = rango_de_racha(r)
  where id = uid;
  perdida := verificar_perdida();
  select * into perfil from profiles where id = uid;
  return jsonb_build_object(
    'racha', perfil.racha_actual,
    'rango', perfil.rango_actual,
    'racha_historial', r,
    'perdida', coalesce((perdida ->> 'perdida')::boolean, false)
  );
end;
$$;

-- Eliminar un amigo. Va por RPC y no por delete directo porque además hay que
-- cerrar el reto vigente entre los dos: si queda abierto, el índice único
-- parcial impide crear uno nuevo si vuelven a agregarse.
create or replace function public.eliminar_amigo(p_otro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_otro is null or uid = p_otro then return; end if;
  delete from friendships
   where (solicitante = uid and destinatario = p_otro)
      or (solicitante = p_otro and destinatario = uid);
  delete from challenges
   where estado in ('pendiente', 'activo')
     and ((retador = uid and rival = p_otro) or (retador = p_otro and rival = uid));
end;
$$;

-- BLOQUEAR (migración 53). Crea el bloqueo, borra la amistad en las dos
-- direcciones (cualquier estado: también una solicitud pendiente) y cierra el
-- reto vigente. Es eliminar_amigo + registrar el bloqueo, en una sola operación.
create or replace function public.bloquear(p_otro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_otro is null or uid = p_otro then return; end if;
  insert into bloqueos (bloqueador, bloqueado) values (uid, p_otro)
    on conflict (bloqueador, bloqueado) do nothing;
  delete from friendships
   where (solicitante = uid and destinatario = p_otro)
      or (solicitante = p_otro and destinatario = uid);
  delete from challenges
   where estado in ('pendiente', 'activo')
     and ((retador = uid and rival = p_otro) or (retador = p_otro and rival = uid));
end;
$$;
revoke execute on function public.bloquear(uuid) from public, anon;
grant execute on function public.bloquear(uuid) to authenticated;

-- DESBLOQUEAR. Solo saca la fila de bloqueo; no recompone la amistad (si se
-- quieren volver a agregar, uno pide y el otro acepta, como cualquiera).
create or replace function public.desbloquear(p_otro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_otro is null then return; end if;
  delete from bloqueos where bloqueador = uid and bloqueado = p_otro;
end;
$$;
revoke execute on function public.desbloquear(uuid) from public, anon;
grant execute on function public.desbloquear(uuid) to authenticated;

-- MIS BLOQUEADOS, para Ajustes. Lee `profiles` directo (y no `usuarios_publicos`)
-- a propósito: la vista justamente esconde a los bloqueados, así que para
-- LISTARLOS hay que saltearla, cosa que este SECURITY DEFINER puede.
create or replace function public.mis_bloqueados()
returns table (id uuid, username text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_url
    from bloqueos b
    join profiles p on p.id = b.bloqueado
   where b.bloqueador = auth.uid()
   order by b.creado desc;
$$;
revoke execute on function public.mis_bloqueados() from public, anon;
grant execute on function public.mis_bloqueados() to authenticated;

-- DENUNCIAR. Registra denunciante→denunciado con un motivo de la lista. Una por
-- par (la última gana). El dueño la lee desde el dashboard.
create or replace function public.denunciar(p_denunciado uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_denunciado is null or uid = p_denunciado then return; end if;
  if p_motivo is null or p_motivo not in ('spam','acoso','inapropiado','suplantacion','otro') then
    raise exception 'motivo inválido';
  end if;
  insert into reportes (denunciante, denunciado, motivo)
    values (uid, p_denunciado, p_motivo)
    on conflict (denunciante, denunciado) do update
      set motivo = excluded.motivo, creado = now();
end;
$$;
revoke execute on function public.denunciar(uuid, text) from public, anon;
grant execute on function public.denunciar(uuid, text) to authenticated;

-- Eliminar la cuenta. Borra la fila de auth.users; el resto se va en cascada
-- desde profiles (logs, fotos, pesos, descansos, amistades, retos, sugerencias).
--
-- Los ARCHIVOS del storage NO se borran acá: SQL puede sacar las filas de
-- storage.objects pero deja los archivos colgados en el bucket. El cliente los
-- borra por la API de storage ANTES de llamar a esto, y si eso falla no llama:
-- es preferible una cuenta viva a archivos huérfanos que nadie puede alcanzar
-- después, porque sin cuenta ya no hay quien tenga permiso sobre ellos.
--
-- No recibe parámetros a propósito: siempre borra al que la llama. Con un
-- p_usuario habría que confiar en que la RLS lo frene, y esto es SECURITY
-- DEFINER, así que la RLS no lo frenaría.
create or replace function public.eliminar_cuenta()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;
  -- challenges.ganador apunta a profiles SIN cascade: si esta cuenta ganó un
  -- reto ya cerrado, esa fila bloquearía el borrado. Se van primero, a mano.
  delete from challenges where retador = uid or rival = uid or ganador = uid;
  -- Los propios que OTRA cuenta usó quedan huérfanos (migración 83): su historial
  -- no se borra. Al borrarse la cuenta pierden el dueño y nadie más los ve.
  update ejercicios e set huerfano = true
   where e.creado_por = uid
     and (exists (select 1 from prs p where p.ejercicio = e.id and p.user_id <> uid)
       or exists (select 1 from cargas_elegidas c where c.ejercicio = e.id and c.user_id <> uid)
       or exists (select 1 from subidas_marcadas s where s.ejercicio = e.id and s.user_id <> uid));
  -- Los demás se borran, y antes lo propio que apunta a ellos (no tiene cascada).
  delete from cargas_elegidas  where user_id = uid and ejercicio in (select id from ejercicios where creado_por = uid and not huerfano);
  delete from subidas_marcadas where user_id = uid and ejercicio in (select id from ejercicios where creado_por = uid and not huerfano);
  delete from prs              where user_id = uid and ejercicio in (select id from ejercicios where creado_por = uid and not huerfano);
  delete from ejercicios where creado_por = uid and not huerfano;
  delete from auth.users where id = uid;
end;
$$;

-- -------------------------------------------------------------
-- REGISTRAR DÍA (RPC transaccional: la animación de subida de rango
-- se dispara SOLO después de que esto confirme)
-- -------------------------------------------------------------
-- `p_es_descanso` y `p_peso` estuvieron acá y se fueron en la migración 25:
-- ningún llamador les pasaba nunca otra cosa que `false` y `null`. Un
-- parámetro que siempre vale lo mismo no es un parámetro, es una constante
-- disfrazada que el que lea la firma va a creer que sirve.
create or replace function public.registrar_dia(p_origen text default 'manual')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rango_antes int;
  perfil profiles;
  nuevo_log logs;
  hoy date := mi_hoy();
  hasta timestamptz := bloqueo_hasta(uid);
begin
  if hasta is not null then
    -- el día queda anotado; se registra solo cuando pase la ventana
    update profiles set dia_pendiente = hoy, pendiente_desde = now() where id = uid;
    return jsonb_build_object('bloqueado', true, 'pendiente', hoy, 'hasta', hasta);
  end if;

  select rango_actual into rango_antes from profiles where id = uid;
  insert into logs (user_id, fecha, origen)
    values (uid, hoy, p_origen)
    returning * into nuevo_log;
  select * into perfil from profiles where id = uid;
  -- La racha de ESTE día queda anotada en el log (item 6.4): el trigger del
  -- insert ya subió profiles.racha_actual, así que es la de recién.
  update logs set racha_del_dia = perfil.racha_actual where id = nuevo_log.id;
  return jsonb_build_object(
    'bloqueado', false,
    'log_id', nuevo_log.id,
    'racha', perfil.racha_actual,
    'rango_antes', rango_antes,
    'rango_despues', perfil.rango_actual,
    'planeta', nuevo_log.planeta_del_dia,
    'subio_rango', perfil.rango_actual > rango_antes
  );
end;
$$;

-- -------------------------------------------------------------
-- RETOS: cerrar los vencidos del usuario y decidir ganador
-- (ganador = más días entrenados dentro del rango; empate = null)
-- Se llama al abrir la pantalla social.
-- -------------------------------------------------------------
create or replace function public.cerrar_retos_vencidos()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  reto record;
  dias_retador int;
  dias_rival int;
begin
  for reto in
    select * from challenges
    where estado = 'activo' and hasta < mi_hoy()
      and (retador = uid or rival = uid)
  loop
    select count(*) into dias_retador from logs
      where user_id = reto.retador and not es_descanso
        and fecha between reto.desde and reto.hasta;
    select count(*) into dias_rival from logs
      where user_id = reto.rival and not es_descanso
        and fecha between reto.desde and reto.hasta;
    update challenges set
      estado = 'terminado',
      ganador = case
        when dias_retador > dias_rival then reto.retador
        when dias_rival > dias_retador then reto.rival
        else null
      end
    where id = reto.id;
  end loop;
end;
$$;

-- -------------------------------------------------------------
-- ALTA DE USUARIO: fila en profiles al registrarse
-- -------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- FUERZA: 1RM, DOTS, bandas y ranking (§16)
-- -------------------------------------------------------------

-- 1RM de una marca. Real: el peso tal cual. Estimado: Epley (§16.4).
--
-- El caso de UNA repetición se saca a mano: Epley crudo devuelve
-- peso × 31/30, un 3% de más, porque la fórmula está pensada para extrapolar
-- desde varias repeticiones. Una repetición ya ES el 1RM, no hay nada que
-- extrapolar, y sin este corte el mismo levantamiento daba distinto según
-- cómo lo hubieran cargado.
create or replace function public.un_rm(p_peso numeric, p_reps int, p_es_real boolean)
returns numeric language sql immutable as $$
  select case
    when p_es_real or p_reps = 1 then p_peso
    else p_peso * (1 + p_reps / 30.0)
  end;
$$;

-- DOTS. Coeficientes tomados de la implementación de OpenPowerlifting
-- (crates/coefficients/src/dots.rs), NO de memoria: un DOTS mal calculado
-- ordena mal el ranking y nadie se da cuenta, porque el número igual parece
-- razonable. Verificado contra un caso publicado: hombre de 90 kg con 650 kg
-- de total da 420,3 (ver test-schema.mjs).
create or replace function public.dots(p_total numeric, p_peso numeric, p_sexo text)
returns numeric language plpgsql immutable as $$
declare
  pc numeric;
  den numeric;
begin
  if p_total is null or p_peso is null or p_sexo is null then return null; end if;
  if p_total <= 0 then return null; end if;
  -- La fórmula está calibrada entre 40 y 210 kg (hombres) y entre 40 y 150
  -- (mujeres). Fuera de ese rango el polinomio de grado 4 se dispara y
  -- devuelve valores absurdos, así que el peso se ACOTA, no se extrapola.
  if p_sexo = 'm' then
    pc := least(greatest(p_peso, 40), 210);
    den := -0.000001093 * pc^4
         +  0.0007391293 * pc^3
         -  0.1918759221 * pc^2
         + 24.0900756 * pc
         - 307.75076;
  elsif p_sexo = 'f' then
    pc := least(greatest(p_peso, 40), 150);
    den := -0.0000010706 * pc^4
         +  0.0005158568 * pc^3
         -  0.1126655495 * pc^2
         + 13.6175032 * pc
         -  57.96288;
  else
    return null;
  end if;
  if den <= 0 then return null; end if;
  return round(500 * p_total / den, 2);
end;
$$;

-- peso_actual devuelve el peso corporal de CUALQUIERA, que es el dato más
-- privado de la app (§4). Existe porque el DOTS lo necesita, y las funciones
-- que la usan devuelven el resultado sin devolver nunca el peso. No se otorga
-- a nadie: si alguien se la otorga a `authenticated`, la regla se rompe.
create or replace function public.peso_actual(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select valor from weights where user_id = p_user order by fecha desc limit 1;
$$;

-- El mejor 1RM por ejercicio: el máximo entre TODAS las marcas cargadas, con
-- la fecha de la que lo produjo. Empate: la más reciente. Se redondea acá y
-- no al mostrar, para que el total sea exactamente la suma de los tres
-- números que el usuario ve.
create or replace function public.mejores_marcas(p_user uuid)
returns table (ejercicio text, kg numeric, peso numeric, reps int, es_real boolean, fecha date)
language sql stable security definer set search_path = public as $$
  select distinct on (p.ejercicio)
    p.ejercicio,
    round(un_rm(p.peso, p.reps, p.es_real), 1),
    p.peso, p.reps, p.es_real, p.fecha
  from prs p
  where p.user_id = p_user
  order by p.ejercicio, un_rm(p.peso, p.reps, p.es_real) desc, p.fecha desc;
$$;

-- El total del DOTS: los tres, o nada. Con dos de tres no hay un total
-- "parcial" que valga: no sería comparable con el de nadie.
create or replace function public.total_dots(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when count(*) = 3 then sum(m.kg) end
    from mejores_marcas(p_user) m
    join ejercicios e on e.id = m.ejercicio and e.cuenta_dots;
$$;

create or replace function public.dots_de(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select dots(
    total_dots(p_user),
    peso_actual(p_user),
    (select sexo from profiles where id = p_user)
  );
$$;

-- Mis marcas y mi DOTS. El único lugar donde sale el número exacto, y sale
-- solo para el dueño.
create or replace function public.mi_fuerza()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  marcas jsonb;
  total numeric;
  d numeric;
  s text;
  pc numeric;
begin
  if uid is null then return null; end if;
  select sexo into s from profiles where id = uid;
  pc := peso_actual(uid);
  total := total_dots(uid);
  d := dots(total, pc, s);
  select coalesce(jsonb_agg(jsonb_build_object(
      'ejercicio', m.ejercicio,
      'nombre', e.nombre,
      'grupo', e.grupo,
      'cuenta_dots', e.cuenta_dots,
      'kg', m.kg,
      'peso', m.peso,
      'reps', m.reps,
      'es_real', m.es_real,
      'fecha', m.fecha
    ) order by e.orden), '[]'::jsonb)
    into marcas
    from mejores_marcas(uid) m
    join ejercicios e on e.id = m.ejercicio;
  return jsonb_build_object(
    'marcas', marcas,
    'total', total,
    'dots', d,
    -- POR QUÉ no hay DOTS, para que la interfaz diga qué falta en vez de
    -- mostrar un cero o un error (§16.7)
    'falta', case
      when total is null then 'marcas'
      when s is null then 'sexo'
      when pc is null then 'peso'
      else null
    end
  );
end;
$$;

-- Ranking entre amigos. Sale el total y el DOTS EXACTO de todos.
--
-- Antes iba una banda y el número exacto solo en la fila propia, porque DOTS
-- es una función del peso corporal y del total: con los dos a la vista, el
-- peso se despeja con una cuenta de dos líneas. El razonamiento sigue siendo
-- correcto; lo que cambió es la premisa. El humano decidió (2026-08-31) que su
-- peso no le parece un dato tan personal y que prefiere ver el número exacto.
--
-- La consecuencia está ACEPTADA y se avisa al activar el DOTS, que es cuando
-- todavía se puede decidir no hacerlo. Lo que no cambia: `weights` no se
-- comparte nunca y `peso_actual` no se le otorga a nadie. Se acepta que el
-- peso se pueda DEDUCIR, no que se publique. Ver spec/fuerza.md §16.7b.
create or replace function public.ranking_fuerza()
returns table (
  id uuid,
  username text,
  avatar_url text,
  total numeric,
  dots numeric,
  marcas jsonb
) language sql stable security definer set search_path = public as $$
  with gente as (
    select auth.uid() as quien
    union
    select case when f.solicitante = auth.uid() then f.destinatario else f.solicitante end
      from friendships f
     where f.estado = 'aceptada'
       and (f.solicitante = auth.uid() or f.destinatario = auth.uid())
  ),
  calc as (
    select p.id, p.username, p.avatar_url, total_dots(p.id) as total, dots_de(p.id) as d
      from profiles p
      join gente g on g.quien = p.id
  )
  select c.id, c.username, c.avatar_url, c.total, c.d,
         -- el detalle por ejercicio viaja con la fila: son levantamientos, que
         -- los amigos ya ven, y así el 1RM lo calcula un solo lugar
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'ejercicio', m.ejercicio, 'nombre', e.nombre,
                   'kg', m.kg, 'fecha', m.fecha) order by e.orden), '[]'::jsonb)
            from mejores_marcas(c.id) m
            join ejercicios e on e.id = m.ejercicio and e.cuenta_dots)
    from calc c
   where c.d is not null
   order by c.d desc;
$$;

-- Percentil global: "estás en el 15% más fuerte". Nunca posiciones ni
-- nombres (§16.6). Entre amigos nadie miente porque se conocen; en un ranking
-- global de desconocidos, ser el número uno es justo el premio que hace que

-- -------------------------------------------------------------
-- Anotar el peso corporal sin registrar un día
--
-- Hasta ahora el peso solo se podía cargar dentro de registrar_dia, así que
-- quien ya había registrado hoy y nunca había anotado su peso no tenía forma
-- de hacerlo: la pantalla de fuerza le decía "se anota al registrar un día" y
-- en ese momento eso ya no se podía. Sin peso no hay DOTS (§16.4), así que
-- quedaba en un callejón sin salida hasta el día siguiente.
--
-- Va por RPC y no por grant de insert sobre weights: la tabla sigue siendo de
-- solo lectura para el cliente, y así el peso no se puede escribir en la
-- fecha de otro ni saltear el rango permitido.
-- -------------------------------------------------------------
create or replace function public.anotar_peso(p_valor numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  insert into weights (user_id, fecha, valor) values (uid, mi_hoy(), p_valor)
    on conflict (user_id, fecha) do update set valor = excluded.valor;
end;
$$;

-- CORREGIR Y BORRAR (migración 45). `weights` solo tiene `select` para el
-- dueño, así que hasta acá un peso mal anotado se quedaba para siempre
-- torciendo la tendencia, que es lo único que ese dato hace.
--
-- SON DOS FUNCIONES Y NO UN `grant update, delete`: con los permisos directos
-- la app podría escribir CUALQUIER fecha, y ahí entra un peso de hace tres
-- meses que nunca se pesó. `corregir_peso` SOLO actualiza una fila que ya
-- existe —corregir es arreglar lo anotado, no inventar historia— y anotar
-- sigue siendo `anotar_peso`, que solo escribe hoy.
--
-- Devuelven si tocaron algo: la pantalla no puede decir "listo" cuando no
-- hizo nada.
create or replace function public.corregir_peso(p_fecha date, p_valor numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tocadas int;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  update weights set valor = p_valor where user_id = uid and fecha = p_fecha;
  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$$;

create or replace function public.borrar_peso(p_fecha date)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tocadas int;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  delete from weights where user_id = uid and fecha = p_fecha;
  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$$;

-- -------------------------------------------------------------
-- Los dos números del cronómetro, en un solo lugar
--
-- Están también en `src/lib/reglas.ts`, porque la pantalla necesita las
-- mismas cuentas. La sección 26 de test:db compara las dos copias.
-- -------------------------------------------------------------

-- A las 2 horas sin tocar nada la sesión se cierra sola y queda SIN duración
-- (§17.3). Eran cuatro hasta la migración 37, que agregó el cierre por
-- inactividad: con media hora de inactividad cerrando sesiones, cuatro horas
-- era un tope que ya no se alcanzaba nunca.
create or replace function public.ventana_inactividad()
returns interval language sql immutable as $$ select interval '30 minutes' $$;

create or replace function public.tope_sesion()
returns interval language sql immutable as $$ select interval '2 hours' $$;

-- Abajo de 5 minutos cuenta como día pero no como duración (§17.7): empezar
-- y parar sin querer es una duración real que ensucia el promedio.
create or replace function public.piso_sesion()
returns interval language sql immutable as $$ select interval '5 minutes' $$;

-- Cuánto se puede correr hacia atrás el inicio de una sesión (§13). El cliente
-- manda la hora en que lo vio llegar; es un dato suyo, o sea que no es un
-- dato. Acotarlo es lo único que impide que alguien se fabrique duraciones.
--
-- Cuarenta y cinco minutos porque el atraso legítimo son los siete de la
-- espera más lo que la app haya estado mirando antes de disparar.
create or replace function public.atraso_maximo()
returns interval language sql immutable as $$ select interval '45 minutes' $$;

-- -------------------------------------------------------------
-- El cierre automático
--
-- No hay tarea programada: la sesión se evalúa cuando algo la lee, igual que
-- la pérdida de racha (§12). Así se cierra aunque el usuario no vuelva a
-- abrir la app, y el corte lo decide el servidor contra el `inicio` guardado
-- —nunca el reloj del teléfono, que se puede atrasar a propósito—.
--
-- Ojo con la medianoche: acá NO se toca el log. Una sesión que empezó a las
-- 23:00 y se cierra a las 03:00 pertenece al día en que EMPEZÓ, porque su
-- log_id se fijó al iniciar y nada lo mueve después.
-- -------------------------------------------------------------
create or replace function public.cerrar_sesiones_vencidas(p_user uuid)
returns void language sql security definer set search_path = public as $$
  update sesiones
     set estado = 'terminada', fin = greatest(inicio, ultima_actividad), cerro_sola = true
   where user_id = p_user and estado = 'corriendo'
     and ultima_actividad > inicio
     and now() >= ultima_actividad + ventana_inactividad();

  update sesiones
     set estado = 'abandonada', cerro_sola = true
   where user_id = p_user and estado = 'corriendo'
     and ultima_actividad <= inicio
     and now() - inicio >= tope_sesion();
$$;

-- Con p_bajar (migración 82) la promesa a futuro se achica a ahora.
create or replace function public.marcar_actividad(p_sesion uuid, p_hasta timestamptz, p_bajar boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
  t timestamptz;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  select * into s from sesiones where id = p_sesion and user_id = uid;
  if s.id is null then return; end if;

  t := least(greatest(coalesce(p_hasta, now()), s.inicio), now() + interval '60 minutes');

  if s.estado = 'corriendo' and p_bajar then
    -- Una promesa a futuro baja a la hora que dice el teléfono —aunque llegue tarde,
    -- sin señal—; una marca vieja sube, como siempre.
    update sesiones
       set ultima_actividad = case when ultima_actividad > now() then least(ultima_actividad, t) else greatest(ultima_actividad, t) end
     where id = s.id;
  elsif s.estado = 'corriendo' then
    update sesiones set ultima_actividad = greatest(ultima_actividad, t) where id = s.id;
  elsif s.estado = 'terminada' and s.cerro_sola and t > s.fin and t <= s.fin + ventana_inactividad() then
    update sesiones
       set ultima_actividad = greatest(ultima_actividad, t),
           fin = least(t, now())
     where id = s.id;
  end if;
end;
$$;

revoke execute on function public.marcar_actividad(uuid, timestamptz, boolean) from public, anon;
grant execute on function public.marcar_actividad(uuid, timestamptz, boolean) to authenticated;

-- -------------------------------------------------------------
-- Empezar
--
-- El día se registra ACÁ, al iniciar, no al terminar (§17.2): el que se
-- olvida de parar el cronómetro perdería el día, y eso es peor que perder la
-- duración.
--
-- Si el día ya estaba registrado no se duplica nada: la sesión se cuelga del
-- log que ya existe y lo único que agrega es la duración.
-- -------------------------------------------------------------
-- `p_desde` es la hora de LLEGADA, que no es la hora de la llamada: el
-- cronómetro arranca a los siete minutos de estar en la zona, pero la sesión
-- tiene que decir la hora en que llegaste o la duración sale corta (§13).
create or replace function public.iniciar_sesion(
  p_desde timestamptz default null,
  p_origen text default 'manual'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l uuid;
  registro jsonb := null;
  s sesiones;
  hoy date := mi_hoy();
  arranque timestamptz;
begin
  if uid is null then raise exception 'sin sesión'; end if;

  perform cerrar_sesiones_vencidas(uid);

  -- ¿Ya hay una viva? Se sigue esa. Nunca se pisa.
  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is not null then
    return jsonb_build_object('bloqueado', false, 'id', s.id, 'inicio', s.inicio,
      'origen', s.origen, 'series', s.series, 'ahora', now(),
      'yaEstaba', true, 'registro', null);
  end if;

  arranque := least(now(), greatest(coalesce(p_desde, now()), now() - atraso_maximo()));

  select id into l from logs where user_id = uid and fecha = hoy;
  if l is null then
    registro := registrar_dia(p_origen);
    if (registro ->> 'bloqueado')::boolean then
      return registro;
    end if;
    l := (registro ->> 'log_id')::uuid;
  end if;
  -- `ultima_actividad` en el inicio: todavía no pasó nada. Es lo que hace que
  -- una sesión en la que nunca se toca el contador caiga en la regla de las
  -- dos horas y no en la de la media hora.
  insert into sesiones (user_id, log_id, inicio, origen, creo_el_dia, ultima_actividad)
    values (uid, l, arranque, p_origen, registro is not null, arranque)
    returning * into s;
  return jsonb_build_object('bloqueado', false, 'id', s.id, 'inicio', s.inicio,
    'origen', s.origen, 'series', s.series, 'ahora', now(),
    'yaEstaba', false, 'registro', registro);
end;
$$;

-- -------------------------------------------------------------
-- Terminar
-- -------------------------------------------------------------
-- `p_hasta` es la ÚLTIMA VEZ QUE SE LO VIO ADENTRO, no la hora de la llamada.
-- El que usa el automático es justo el que no se va a acordar de parar el
-- cronómetro; pero si la app estaba cerrada, nos enteramos de que se fue
-- recién cuando la vuelve a abrir —capaz en la cena— y cerrar con `now()` le
-- daría una sesión de cinco horas.
create or replace function public.terminar_sesion(p_hasta timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
  cierre timestamptz;
  deshizo boolean := false;
begin
  if uid is null then raise exception 'sin sesión'; end if;

  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is null then
    return jsonb_build_object('termino', false);
  end if;

  -- Sin actividad y pasado el tope: la cierra el automático, sin duración.
  if s.ultima_actividad <= s.inicio and now() - s.inicio >= tope_sesion() then
    perform cerrar_sesiones_vencidas(uid);
    return jsonb_build_object('termino', false);
  end if;

  if s.ultima_actividad > s.inicio and now() >= s.ultima_actividad + ventana_inactividad() then
    cierre := s.ultima_actividad;
  else
    -- Nunca antes del inicio —eso daría duración negativa— ni después de ahora.
    cierre := least(now(), greatest(coalesce(p_hasta, now()), s.inicio));
  end if;

  update sesiones set estado = 'terminada', fin = cierre
   where id = s.id
   returning * into s;

  -- EL TOQUE ACCIDENTAL. Cuatro condiciones y las cuatro tienen que darse:
  --   1. no llegó al piso de 5 minutos → no hubo entrenamiento;
  --   2. no se contó ninguna serie       → tampoco lo dice el contador;
  --   3. el día lo creó ESTA sesión      → no lo registró nadie más;
  --   4. no hay otra sesión ese día      → no entrenaste en otro momento.
  if (s.fin - s.inicio) < piso_sesion()
     and s.series = 0
     and s.creo_el_dia
     and not exists (
       select 1 from sesiones o where o.log_id = s.log_id and o.id <> s.id
     )
  then
    delete from logs where id = s.log_id and user_id = uid;
    deshizo := true;
  end if;

  return jsonb_build_object(
    'termino', true,
    'segundos', extract(epoch from (s.fin - s.inicio)),
    'cuenta', (s.fin - s.inicio) >= piso_sesion(),
    'deshizo_el_dia', deshizo
  );
end;
$$;

-- -------------------------------------------------------------
-- La sesión que está corriendo, si hay
-- -------------------------------------------------------------
-- `sumar_serie` era `series = series + 1`. Con la red cortada —un gimnasio en
-- un subsuelo es el caso normal, no el raro— el toque se perdía en silencio, y
-- no se podía reintentar: si la escritura llegó pero la respuesta se perdió,
-- el reintento contaba dos.
--
-- Esta manda el TOTAL, así que repetirla es inofensiva y la cola del cliente
-- puede insistir hasta que entre. Lleva el id de la sesión porque esa cola
-- puede vaciarse cuando la sesión ya terminó.
create or replace function public.fijar_series(p_sesion uuid, p_series int)
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  total int;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  -- Acotado acá y no en el cliente: el conteo llega del teléfono.
  update sesiones set series = greatest(0, least(p_series, 999))
   where id = p_sesion and user_id = uid
   returning series into total;
  return coalesce(total, 0);
end;
$$;


-- Los bloques se guardan ENTEROS, igual que `fijar_series` y por lo mismo:
-- repetir la llamada tiene que ser inofensiva para poder encolarla cuando la
-- red del subsuelo se corta (ver `lib/cola.ts`).
-- Limpia la lista que manda el teléfono. La base no le cree al cliente:
--   - si no es una lista, no hay pesos;
--   - se toman como mucho `n` —las series del bloque—, nunca más;
--   - un peso tiene que ser un número entre 0 y 999; lo demás es `null`;
--   - centésimas, igual que el cliente (61,25 existe);
--   - una lista de puros `null` no dice nada y no se guarda.
create or replace function public.pesos_limpios(p jsonb, n int)
returns jsonb language sql immutable set search_path = public as $$
  select case
    when p is null or jsonb_typeof(p) <> 'array' or n <= 0 then null
    else (
      select case when bool_or(v is not null) then jsonb_agg(v order by o) else null end
        from (
          select o,
                 case
                   when jsonb_typeof(x) = 'number'
                    and (x #>> '{}')::numeric > 0
                    and (x #>> '{}')::numeric <= 999
                   then to_jsonb(round((x #>> '{}')::numeric, 2))
                   else null
                 end as v
            from jsonb_array_elements(p) with ordinality as t(x, o)
           where o <= n
        ) q
    )
  end;
$$;

revoke execute on function public.pesos_limpios(jsonb, int) from public, anon, authenticated;

create or replace function public.fijar_bloques(p_sesion uuid, p_bloques jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio jsonb;
  total int;
  guardado jsonb;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if jsonb_typeof(p_bloques) <> 'array' then raise exception 'bloques tiene que ser una lista'; end if;

  select series into total from sesiones where id = p_sesion and user_id = uid;
  if total is null then return null; end if;

  select coalesce(jsonb_agg(
           case when p is null
                then jsonb_build_object('ejercicio', e, 'series', s)
                else jsonb_build_object('ejercicio', e, 'series', s, 'pesos', p, 'carga', c)
           end
           -- LOS MINUTOS (migración 76): solo de un ejercicio que se mide en tiempo.
           || case when m is null then '{}'::jsonb else jsonb_build_object('minutos', m) end
           order by i), '[]'::jsonb)
    into limpio
  from (
    select
      f.e, f.s, f.i,
      -- UN EJERCICIO QUE NO LLEVA PESO NO GUARDA PESOS (migración 74). La plancha
      -- no muestra el campo, pero el bloque podía llegar con los kilos del
      -- ejercicio anterior: quedaban guardados sin verse, la app los volvía a
      -- proponer y el "+" los anotaba en cada serie, sesión tras sesión.
      case when (select x.admite_peso from ejercicios x where x.id = f.e) is false then null
           else pesos_limpios(f.pesos, f.s)
      end as p,
      case when f.carga in ('total', 'par', 'una', 'lastre', 'corporal') then f.carga
           else (select carga from ejercicios where id = f.e)
      end as c,
      -- Igual que el teléfono (minutosValidos): menos de 1 no es un dato, más de 600 se topa.
      case when (select x.mide from ejercicios x where x.id = f.e) = 'tiempo' and jsonb_typeof(f.minutos) = 'number'
                and (f.minutos #>> '{}')::numeric >= 1
           then least(round((f.minutos #>> '{}')::numeric), 600)::int
      end as m
    from (
      select
        b.valor->>'ejercicio' as e,
        greatest(0, least((b.valor->>'series')::int, 999)) as s,
        b.valor->'pesos' as pesos,
        b.valor->>'carga' as carga,
        b.valor->'minutos' as minutos,
        b.orden as i
      from jsonb_array_elements(p_bloques) with ordinality as b(valor, orden)
      where b.valor->>'ejercicio' in (select id from ejercicios)
        and (b.valor->>'series') ~ '^[0-9]+$'
        and b.orden <= 40
    ) f
  ) filtrados;

  update sesiones set bloques = limpio
   where id = p_sesion and user_id = uid
   returning bloques into guardado;

  return jsonb_build_object('bloques', coalesce(guardado, '[]'::jsonb), 'total_series', total);
end;
$$;

-- UN EJERCICIO PROPIO (migración 76). Hay muchos que no están y no se van a
-- poner todos los del mundo: cada cuenta agrega los suyos con un "+". Un nombre
-- que ya tiene (sin importar mayúsculas) devuelve ese mismo: tocar dos veces no
-- crea dos. Hasta cien por cuenta. Devuelve el id.
create or replace function public.crear_ejercicio(p_nombre text, p_grupo text, p_mide text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio text := left(regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g'), 40);
  mide text := case when p_mide = 'tiempo' or p_grupo = 'cardio' then 'tiempo' else 'series' end;
  ya text;
  v_id text;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if char_length(limpio) < 2 then raise exception 'el nombre es muy corto'; end if;
  if p_grupo is null or p_grupo not in ('pecho', 'espalda', 'hombros', 'brazos', 'piernas', 'core', 'cardio') then
    raise exception 'grupo desconocido';
  end if;
  select id into ya from ejercicios where creado_por = uid and lower(nombre) = lower(limpio) limit 1;
  if ya is not null then return ya; end if;
  if (select count(*) from ejercicios where creado_por = uid) >= 100 then raise exception 'ya hay cien ejercicios propios'; end if;
  v_id := 'propio_' || substr(md5(uid::text || clock_timestamp()::text || random()::text), 1, 12);
  insert into ejercicios (id, nombre, grupo, cuenta_dots, admite_peso, orden, carga, mide, creado_por)
       values (v_id, limpio, p_grupo, false, mide = 'series', 9000, 'total', mide, uid);
  return v_id;
end;
$$;
revoke execute on function public.crear_ejercicio(text, text, text) from public, anon;
grant execute on function public.crear_ejercicio(text, text, text) to authenticated;

-- En qué terminaste la última vez, para que la app abra ahí. Si entrenás
-- siempre parecido, cambiar de ejercicio es la excepción; elegirlo cada día
-- sería el impuesto que hace que se deje de usar.
--
-- No es "la última sesión" sino "la última que anotó algo": si ayer no
-- anotaste nada, la respuesta útil es la de anteayer, no null.
create or replace function public.ultimo_ejercicio()
returns text language sql stable security definer set search_path = public as $$
  select s.bloques -> -1 ->> 'ejercicio'
    from sesiones s
   where s.user_id = auth.uid()
     and jsonb_array_length(s.bloques) > 0
     and s.inicio > now() - interval '35 days'
   order by s.inicio desc
   limit 1;
$$;

-- El último peso que anotaste para ESE ejercicio. Es la misma idea que
-- `ultimo_ejercicio`: si hacés press de banca con 60, escribir 60 cada vez es
-- el impuesto que hace que se deje de anotar.
--
-- La última serie CON peso, no la última serie: si la última de ayer fue sin
-- anotar, la respuesta útil es la anterior, no "nada".
--
-- Noventa días y no para siempre: un peso de hace un año no es con lo que vas
-- a arrancar hoy, y proponerlo es peor que dejar el campo vacío.
create or replace function public.ultimo_peso(p_ejercicio text)
returns numeric language sql stable security definer set search_path = public as $$
  select x.v::numeric
    from sesiones s,
         jsonb_array_elements(s.bloques) with ordinality as b(bloque, ob),
         jsonb_array_elements_text(
           case when jsonb_typeof(b.bloque->'pesos') = 'array' then b.bloque->'pesos' else '[]'::jsonb end
         ) with ordinality as x(v, ox)
   where s.user_id = auth.uid()
     and b.bloque->>'ejercicio' = p_ejercicio
     and x.v is not null
     and s.inicio > now() - interval '90 days'
   order by s.inicio desc, b.ob desc, x.ox desc
   limit 1;
$$;

revoke execute on function public.ultimo_peso(text) from public, anon;
grant execute on function public.ultimo_peso(text) to authenticated;

-- -------------------------------------------------------------
-- CON QUÉ LO HACÉS, recordado (migración 38)
-- -------------------------------------------------------------
-- El último modo que ELEGISTE para cada ejercicio: al contestar la pregunta o
-- al cambiarlo en un bloque. Es de la cuenta y no del teléfono, porque la app
-- nativa viene y un teléfono nuevo no puede volver a preguntarte todo.
--
-- Es una preferencia y no historia: la historia es el modo que quedó en cada
-- bloque (`fijar_bloques`). Cambiar esto no toca ningún bloque ya guardado.
create table if not exists public.cargas_elegidas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ejercicio text not null references public.ejercicios(id),
  carga text not null,
  elegida timestamptz not null default now(),
  primary key (user_id, ejercicio),
  constraint cargas_elegidas_valida check (carga in ('total', 'par', 'una', 'lastre', 'corporal'))
);

alter table public.cargas_elegidas enable row level security;

drop policy if exists "cargas: solo dueño" on public.cargas_elegidas;
create policy "cargas: solo dueño" on public.cargas_elegidas for select
  using (user_id = auth.uid());

grant select on public.cargas_elegidas to authenticated;

-- Idempotente: elegir lo mismo dos veces deja lo mismo. Por eso entra a la
-- cola del teléfono (`lib/cola.ts`).
create or replace function public.elegir_carga(p_ejercicio text, p_carga text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre', 'corporal') then return; end if;
  -- Solo sobre un ejercicio que se ve (migración 83): un propio ajeno o huérfano no.
  if not exists (select 1 from ejercicios where id = p_ejercicio and ((creado_por is null and not huerfano) or creado_por = uid)) then return; end if;
  insert into cargas_elegidas (user_id, ejercicio, carga)
       values (uid, p_ejercicio, p_carga)
  on conflict (user_id, ejercicio) do update set carga = excluded.carga, elegida = now();
end;
$$;

revoke execute on function public.elegir_carga(text, text) from public, anon;
grant execute on function public.elegir_carga(text, text) to authenticated;

-- CORREGIR UN DÍA, DE UNA (migración 74). El teléfono lo hacía en dos pedidos
-- sueltos —borrar el día y volver a ponerlo—: si el primero entraba y el
-- segundo no (la señal del gimnasio), el día quedaba BORRADO, con su sesión, y
-- la racha caía en seco. Acá las dos cosas van en una transacción: o entran las
-- dos, o no pasa nada.
--
-- `security invoker` A PROPÓSITO: corre con los permisos de quien llama, así
-- que valen las mismas reglas y disparadores que cuando lo hacía a mano.
create or replace function public.corregir_dia(p_fecha date, p_destino text)
returns void language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_fecha is null or p_destino is null or p_destino not in ('fui', 'descanso', 'nada') then
    raise exception 'no sé qué hacer con ese día';
  end if;
  delete from logs where user_id = uid and fecha = p_fecha;
  if p_destino <> 'nada' then
    insert into logs (user_id, fecha, es_descanso) values (uid, p_fecha, p_destino = 'descanso');
  end if;
end;
$$;
revoke execute on function public.corregir_dia(date, text) from public, anon;
grant execute on function public.corregir_dia(date, text) to authenticated;

-- -------------------------------------------------------------
-- CÓMO ARRANCA EL BLOQUE (migración 38): el modo y el último peso EN ESE MODO
-- -------------------------------------------------------------
-- Reemplaza a `ultimo_peso` para el cliente nuevo (la vieja queda para el
-- cliente viejo). El peso propuesto tiene que ser del MISMO modo: si la última
-- vez hiciste zancadas con barra y 60, hoy con mancuernas proponer "60 por
-- mancuerna" es proponer el doble.
--
-- `elegida` dice si el modo lo dijo la persona o es el del catálogo: con eso el
-- teléfono sabe si tiene que preguntar.
-- EL PESO QUE SE PROPONE. ES LA MISMA REGLA que `nucleo/pesoRecordado.ts`, que
-- es quien propone en el teléfono; esto es su respaldo, y dos reglas para el
-- mismo número ya costaron tres veces. En este orden:
--   1. LO DE HOY (migración 71): la última serie de la sesión que está
--      corriendo. Quien reabre un ejercicio a los veinte minutos sigue desde
--      donde quedó. La 70 la había dejado afuera, y un teléfono recién
--      instalado que retoma una sesión abierta —sin sus bloques todavía y sin
--      historial— recibía de acá el tope de otro día.
--   2. Si hoy no se hizo: LO MÁS PESADO DE LA ÚLTIMA SESIÓN CERRADA
--      (migración 70), no su última serie: casi todos arrancan con el peso
--      más alto y bajan al cansarse. De los últimos 90 días.
-- El bloque que no dice su modo usa el del catálogo.
create or replace function public.como_arranca(p_ejercicio text)
returns jsonb language sql stable security definer set search_path = public as $$
  with modo as (
    select e.carga_ambigua as ambigua,
           c.carga as elegida,
           coalesce(c.carga, e.carga) as carga,
           e.carga as catalogo
      from ejercicios e
      left join cargas_elegidas c on c.ejercicio = e.id and c.user_id = auth.uid()
     where e.id = p_ejercicio
  )
  select jsonb_build_object(
           'carga', m.carga,
           'elegida', m.elegida is not null,
           'ambigua', m.ambigua,
           'peso', coalesce(
             (
               select x.v::numeric
                 from sesiones s,
                      jsonb_array_elements(s.bloques) with ordinality as b(bloque, ob),
                      jsonb_array_elements_text(
                        case when jsonb_typeof(b.bloque->'pesos') = 'array' then b.bloque->'pesos' else '[]'::jsonb end
                      ) with ordinality as x(v, ox)
                where s.user_id = auth.uid()
                  and s.estado = 'corriendo'
                  and b.bloque->>'ejercicio' = p_ejercicio
                  and coalesce(b.bloque->>'carga', m.catalogo) = m.carga
                  and x.v is not null
                order by s.inicio desc, b.ob desc, x.ox desc
                limit 1
             ),
             (
               select max(x.v::numeric)
                 from sesiones s,
                      jsonb_array_elements(s.bloques) as b(bloque),
                      jsonb_array_elements_text(
                        case when jsonb_typeof(b.bloque->'pesos') = 'array' then b.bloque->'pesos' else '[]'::jsonb end
                      ) as x(v)
                where s.id = (
                        select s2.id
                          from sesiones s2,
                               jsonb_array_elements(s2.bloques) as b2(bloque),
                               jsonb_array_elements_text(
                                 case when jsonb_typeof(b2.bloque->'pesos') = 'array' then b2.bloque->'pesos' else '[]'::jsonb end
                               ) as y(v)
                         where s2.user_id = auth.uid()
                           and s2.estado <> 'corriendo'
                           and s2.inicio > now() - interval '90 days'
                           and b2.bloque->>'ejercicio' = p_ejercicio
                           and coalesce(b2.bloque->>'carga', m.catalogo) = m.carga
                           and y.v is not null
                         order by s2.inicio desc
                         limit 1
                      )
                  and b.bloque->>'ejercicio' = p_ejercicio
                  and coalesce(b.bloque->>'carga', m.catalogo) = m.carga
                  and x.v is not null
             )
           )
         )
    from modo m;
$$;

revoke execute on function public.como_arranca(text) from public, anon;
grant execute on function public.como_arranca(text) to authenticated;

-- -------------------------------------------------------------
-- "LA PRÓXIMA, MÁS" (migración 65)
-- -------------------------------------------------------------
-- La app no anota repeticiones, así que no puede saber sola si un peso ya
-- quedó chico. Lo dice la persona, con un toque, cuando llegó a la meta con el
-- mismo peso en todas las series. Queda acá —y no en el teléfono— porque es una
-- decisión sobre el futuro: cambiar de teléfono no puede llevarse la progresión.
--
-- UNA POR EJERCICIO, y dice lo que se HIZO ese día (peso, modo, series), no lo
-- que hay que hacer: el disco de más lo suma el teléfono, en la unidad de la
-- persona. Marcar de nuevo pisa.
create table if not exists public.subidas_marcadas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ejercicio text not null references public.ejercicios(id),
  carga text not null,
  peso numeric not null,
  series int not null,
  -- El día en que se marcó, en el huso de la persona. Lo manda el teléfono: una
  -- marca que sube tarde desde el subsuelo es del día del toque.
  dia date not null,
  marcada timestamptz not null default now(),
  -- Por ejercicio Y POR MODO (migración 69): el remo con mancuernas y el remo
  -- en la máquina son dos progresiones, y una marca no pisa ni gasta la otra.
  primary key (user_id, ejercicio, carga),
  constraint subidas_carga_valida check (carga in ('total', 'par', 'una', 'lastre')),
  constraint subidas_peso_valido check (peso > 0 and peso <= 1000),
  constraint subidas_series_validas check (series between 1 and 99)
);

alter table public.subidas_marcadas enable row level security;

drop policy if exists "subidas: solo dueño" on public.subidas_marcadas;
create policy "subidas: solo dueño" on public.subidas_marcadas for select
  using (user_id = auth.uid());

grant select on public.subidas_marcadas to authenticated;

-- Idempotente: guarda LA marca, no "sumá una". Con `p_peso` nulo la saca. Por
-- eso entra a la cola del teléfono (`compartido/cola.ts`).
create or replace function public.marcar_subida(p_ejercicio text, p_carga text, p_peso numeric, p_series int, p_dia date)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_ejercicio is null then return; end if;
  if p_peso is null then
    -- Con el modo, saca la de ESE modo; sin modo (la app de antes), todas las del ejercicio.
    delete from subidas_marcadas
     where user_id = uid and ejercicio = p_ejercicio and (p_carga is null or carga = p_carga);
    return;
  end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre') then return; end if;
  if p_peso <= 0 or p_peso > 1000 or p_series is null or p_series < 1 or p_series > 99 then return; end if;
  -- Ni del futuro ni de hace un mes: es la marca de una sesión reciente.
  if p_dia is null or p_dia > mi_hoy() + 1 or p_dia < mi_hoy() - 14 then return; end if;
  -- Solo sobre un ejercicio que se ve (migración 83): un propio ajeno o huérfano no.
  if not exists (select 1 from ejercicios where id = p_ejercicio and ((creado_por is null and not huerfano) or creado_por = uid)) then return; end if;
  insert into subidas_marcadas (user_id, ejercicio, carga, peso, series, dia)
       values (uid, p_ejercicio, p_carga, p_peso, p_series, p_dia)
  on conflict (user_id, ejercicio, carga) do update
     set peso = excluded.peso, series = excluded.series, dia = excluded.dia, marcada = now();
end;
$$;

-- LAS QUE SIGUEN VALIENDO. Una marca se gasta sola: vale hasta la próxima vez
-- que se hace ese ejercicio con peso, en un día POSTERIOR al de la marca. No
-- hace falta que el teléfono avise que la usó, y por eso no se desincroniza.
create or replace function public.mis_subidas()
returns table (ejercicio text, carga text, peso numeric, series int, dia date)
language sql stable security definer set search_path = public as $$
  select m.ejercicio, m.carga, m.peso, m.series, m.dia
    from subidas_marcadas m
   where m.user_id = auth.uid()
     and not exists (
       select 1
         from sesiones s
         join logs l on l.id = s.log_id,
              jsonb_array_elements(s.bloques) as b(bloque)
        where s.user_id = m.user_id
          and l.fecha > m.dia
          and b.bloque ->> 'ejercicio' = m.ejercicio
          -- EN ESE MODO (migración 69). El bloque que no dice el suyo usa el del catálogo.
          and coalesce(b.bloque ->> 'carga', (select e.carga from ejercicios e where e.id = m.ejercicio), 'total') = m.carga
          and jsonb_typeof(b.bloque -> 'pesos') = 'array'
          and jsonb_array_length(b.bloque -> 'pesos') > 0
     );
$$;

revoke execute on function public.marcar_subida(text, text, numeric, int, date), public.mis_subidas() from public, anon;
grant execute on function public.marcar_subida(text, text, numeric, int, date), public.mis_subidas() to authenticated;

-- -------------------------------------------------------------
-- REVISAR LOS PESOS DE ANTES DE LOS MODOS (migración 39)
-- -------------------------------------------------------------
-- Desde el resumen del día: se elige qué significaba el número y la marca se
-- va. Elegir el mismo modo que tenía es "estaba bien", y también la saca.
--
-- Arreglar "anoté la suma" NO toca el número: se cambia el modo a `total`.
-- 40 en total son exactamente lo que se levantó, y el número queda como se
-- escribió ese día.
--
-- `p_orden` es la posición del bloque en la lista, desde 1. Solo toca bloques
-- marcados: no es una puerta para reescribir la historia de cualquier bloque.
create or replace function public.revisar_carga(p_sesion uuid, p_orden int, p_carga text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  guardado jsonb;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre', 'corporal') then return null; end if;

  update sesiones s
     set bloques = (
       select jsonb_agg(
                case when b.orden = p_orden and (b.valor ? 'carga_supuesta')
                     then (b.valor - 'carga_supuesta') || jsonb_build_object('carga', p_carga)
                     else b.valor
                end order by b.orden)
         from jsonb_array_elements(s.bloques) with ordinality as b(valor, orden)
     )
   where s.id = p_sesion and s.user_id = uid
     and jsonb_typeof(s.bloques) = 'array'
     and jsonb_array_length(s.bloques) >= p_orden
     and p_orden >= 1
   returning bloques into guardado;

  return guardado;
end;
$$;

revoke execute on function public.revisar_carga(uuid, int, text) from public, anon;
grant execute on function public.revisar_carga(uuid, int, text) to authenticated;


create or replace function public.mi_sesion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
  sola sesiones;
begin
  if uid is null then return null; end if;
  perform cerrar_sesiones_vencidas(uid);
  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is null then
    select * into sola from sesiones
     where user_id = uid and cerro_sola and inicio > now() - interval '12 hours'
     order by inicio desc limit 1;
    return jsonb_build_object(
      'corriendo', false,
      'ahora', now(),
      'cerrada_sola', case when sola.id is null then null else jsonb_build_object(
        'id', sola.id,
        'inicio', sola.inicio,
        'fin', sola.fin,
        'estado', sola.estado,
        'series', sola.series
      ) end
    );
  end if;
  return jsonb_build_object(
    'corriendo', true,
    'id', s.id,
    'inicio', s.inicio,
    'origen', s.origen,
    'ahora', now(),
    'series', s.series,
    'ultima_actividad', s.ultima_actividad,
    'tope_segundos', extract(epoch from tope_sesion()),
    'ventana_segundos', extract(epoch from ventana_inactividad())
  );
end;
$$;

-- -------------------------------------------------------------
-- El resumen para Stats
--
-- Promedio y total salen SOLO de las sesiones con duración válida. Las
-- abandonadas y las muy cortas se cuentan aparte y se muestran: si no, el
-- promedio parecería calculado sobre más sesiones de las que entran.
-- -------------------------------------------------------------
create or replace function public.resumen_sesiones()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  validas int;
  total numeric;
  abandonadas int;
  cortas int;
begin
  if uid is null then return null; end if;
  perform cerrar_sesiones_vencidas(uid);

  select count(*), coalesce(sum(extract(epoch from (fin - inicio))), 0)
    into validas, total
    from sesiones
   where user_id = uid and estado = 'terminada' and (fin - inicio) >= piso_sesion();

  select count(*) into abandonadas
    from sesiones where user_id = uid and estado = 'abandonada';

  select count(*) into cortas
    from sesiones
   where user_id = uid and estado = 'terminada' and (fin - inicio) < piso_sesion();

  return jsonb_build_object(
    'validas', validas,
    'total_segundos', total,
    'promedio_segundos', case when validas > 0 then round(total / validas) end,
    'abandonadas', abandonadas,
    'cortas', cortas
  );
end;
$$;


-- -------------------------------------------------------------
-- EL RETRATO DE LA BASE (para comparar producción contra el repo)
-- -------------------------------------------------------------

-- Las migraciones se corren pegando SQL a mano en el SQL Editor, así que
-- producción es justo donde puede haber deriva que nadie ve: un `create` que
-- se pegó a medias, un bloque que se salteó, algo que se tocó a mano y no
-- quedó en ninguna migración.
--
-- `test-deriva` compara schema.sql contra las migraciones, pero las dos salen
-- del repo: si producción se separó de las dos, ninguna se entera. Esto es lo
-- que permite preguntarle a la base REAL qué forma tiene.
--
-- SOLO PARA AUTENTICADOS. El retrato refleja la base VIVA, que es justo lo
-- que no está en GitHub, y entregar las políticas de RLS y la forma de cada
-- función legibles por máquina y siempre al día es un mapa de cómo funciona
-- la seguridad. `test:conexion` inicia sesión con la cuenta de prueba.
--
-- Y no puede llevar un secreto adentro, porque NO devuelve ningún cuerpo en
-- claro: nombres sí, contenido hasheado. Un md5 distinto delata el cambio
-- igual y el nombre dice dónde ir a mirar. La versión vieja devolvía la
-- definición de cada trigger tal cual, y los webhooks que crea el panel de
-- Supabase llevan la service_role key adentro (ver spec/trampas.md).
-- Una sola normalización para todo el retrato. Antes vivía copiada en la rama
-- de funciones y en la de triggers; ahora los dos lados de cada comparación
-- pasan por acá, que es la única forma de que un md5 signifique algo.
create or replace function public.huella(t text)
returns text language sql immutable as $$
  select case
    when t is null then '-'
    -- Sin comentarios y con los espacios colapsados: importa que las dos
    -- bases se COMPORTEN igual, no que la prosa coincida.
    else md5(btrim(regexp_replace(
      regexp_replace(t, '--[^' || chr(10) || ']*', '', 'g'), '\s+', ' ', 'g')))
  end;
$$;

create or replace function public.retrato_del_schema()
returns table (que text, f text)
language sql stable security definer set search_path = public as $$
  -- El default va hasheado: es una expresión libre y puede llevar un literal
  -- adentro. El tipo y el not null son la forma, y esos sí se leen.
  select 'columnas'::text,
         c.table_name || '.' || c.column_name || ' ' || c.data_type ||
         coalesce('(' || c.character_maximum_length || ')', '') ||
         coalesce('(' || c.numeric_precision || ',' || c.numeric_scale || ')', '') ||
         case when c.is_nullable = 'NO' then ' not null' else '' end ||
         case when c.column_default is null then ''
              else ' default ' || huella(c.column_default) end
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and t.table_type = 'BASE TABLE'

  union all
  -- `contype <> 'n'` saca los NOT NULL: desde PG 17 tienen fila propia en
  -- pg_constraint y en la versión de Supabase todavía no, así que las 66
  -- filas de diferencia eran ruido de versión. El NOT NULL ya viaja arriba,
  -- en 'columnas', que es donde de verdad se compara.
  select 'restricciones',
         conrelid::regclass || ' ' || conname || ' ' || huella(pg_get_constraintdef(oid))
    from pg_constraint
   where connamespace = 'public'::regnamespace and contype <> 'n'

  union all
  select 'índices', tablename || ' ' || indexname || ' ' || huella(indexdef)
    from pg_indexes where schemaname = 'public'

  union all
  select 'funciones',
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') -> ' ||
         pg_get_function_result(p.oid) || ' ' || p.prosecdef || ' ' ||
         p.provolatile::text || ' ' || huella(p.prosrc)
    from pg_proc p where p.pronamespace = 'public'::regnamespace

  union all
  -- `qual` y `with_check` son expresiones libres. El comando queda en claro
  -- porque saber que una política es de INSERT y no de SELECT es la mitad de
  -- entender qué protege.
  select 'políticas',
         tablename || ' ' || policyname || ' ' || cmd || ' ' ||
         huella(qual) || ' ' || huella(with_check)
    from pg_policies where schemaname = 'public'

  union all
  select 'permisos',
         grantee || ' ' || table_name || ' ' || privilege_type || ' ' || column_name
    from information_schema.column_privileges
   where table_schema = 'public' and grantee in ('authenticated', 'anon')

  union all
  select 'permisos de tabla',
         grantee || ' ' || table_name || ' ' || privilege_type
    from information_schema.table_privileges
   where table_schema = 'public' and grantee in ('authenticated', 'anon')

  union all
  -- Quién puede EJECUTAR cada función. Sin esto el retrato no habría podido
  -- ver el agujero que lo estrenó: una función SECURITY DEFINER otorgada a
  -- `anon` se ve idéntica a una cerrada. `acldefault` cubre el caso peor, el
  -- de la función que nunca se tocó: `proacl` viene en NULL y el permiso por
  -- omisión de Postgres es EXECUTE para PUBLIC.
  select 'permisos de función',
         coalesce(g.rolname, 'PUBLIC') || ' ' || p.proname || '(' ||
         pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    left join pg_roles g on g.oid = a.grantee
   where p.pronamespace = 'public'::regnamespace
     and a.privilege_type = 'EXECUTE'
     and coalesce(g.rolname, 'PUBLIC') in ('anon', 'authenticated', 'PUBLIC')

  union all
  -- Los webhooks que crea el panel de Supabase llevan la service_role key
  -- adentro de su propia definición. Esta rama es la que la filtró.
  select 'triggers',
         event_object_table || ' ' || trigger_name || ' ' || action_timing || ' ' ||
         event_manipulation || ' ' || huella(action_statement)
    from information_schema.triggers where trigger_schema = 'public'

  union all
  -- La única rama que devuelve FILAS de una tabla, aunque sea un catálogo fijo
  -- y público. Va entera en un solo hash: no hay motivo para que el retrato
  -- sepa recitar datos.
  -- SOLO EL CATÁLOGO (migración 91): los ejercicios propios son de cada usuario,
  -- y el 16/10 siete propios nuevos hacían fallar la comparación con el repo.
  select 'catálogo de ejercicios',
         count(*) || ' ejercicios ' ||
         huella(string_agg(id || ' ' || nombre || ' ' || grupo || ' ' ||
                           cuenta_dots || ' ' || admite_peso || ' ' || orden || ' ' ||
                           carga || ' ' || carga_ambigua, '|' order by id))
    from ejercicios
   where creado_por is null and not huerfano
$$;

revoke execute on function public.retrato_del_schema() from public;
grant execute on function public.retrato_del_schema() to authenticated;

-- -------------------------------------------------------------
-- BÚSQUEDA PÚBLICA: vista que expone SOLO lo mínimo.
-- La tabla profiles completa nunca se abre.
-- -------------------------------------------------------------
-- El buscador no muestra a los bloqueados (en los dos sentidos) (migración 53):
-- la vista lee auth.uid() aunque corra como su dueño, así que el que busca no ve
-- a quien bloqueó ni a quien lo bloqueó.
create view public.usuarios_publicos
with (security_invoker = off) as
  -- `mejor_racha` (migración 66): para la medalla del rango más alto que
  -- alcanzó cada uno, en Ranking. Es tan pública como la racha de hoy.
  select id, username, avatar_url, racha_actual, rango_actual, mejor_racha
  from public.profiles p
  where username is not null
    and not exists (
      select 1 from public.bloqueos b
       where (b.bloqueador = auth.uid() and b.bloqueado = p.id)
          or (b.bloqueador = p.id and b.bloqueado = auth.uid())
    );

grant select on public.usuarios_publicos to authenticated;

-- -------------------------------------------------------------
-- INICIO EN UNA SOLA CONSULTA (migración 43)
-- -------------------------------------------------------------
-- Abrir Inicio eran cuatro tandas de pedidos encadenadas. Las tres últimas
-- —impulsos, fuerza y la línea social— se contestan acá de una sola vez.
--
-- Va DESPUÉS de `usuarios_publicos` porque la usa para la línea social.
--
-- CADA PEDAZO EN SU PROPIO `exception`: un error en uno devuelve `null` en esa
-- clave y el resto llega igual. Sin eso, un error en la última sección haría
-- rollback de la escritura de `verificar_perdida`, que corre primero.
create or replace function public.pantalla_inicio()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hoy date;
  r jsonb := '{}'::jsonb;
  pedazo jsonb;
  cliente text;
begin
  -- Sin sesión no se contesta nada. No es un error: la pantalla de entrada
  -- monta cosas que preguntan, y un 401 por carga ensucia el informe.
  if uid is null then
    return null;
  end if;

  begin
    hoy := mi_hoy();
  exception when others then
    hoy := current_date;
  end;
  r := r || jsonb_build_object('hoy', hoy);

  -- LA PÉRDIDA VA PRIMERO, y ese orden es la mitad del valor de esta función.
  -- Hoy la web pide `verificar_perdida` EN PARALELO con el perfil: si hubo
  -- pérdida, el perfil que llegó ya está viejo y hay que leerlo de nuevo — una
  -- ida y vuelta más, justo el día que perdiste la racha. Acá el perfil se lee
  -- después, así que siempre viene fresco y esa relectura desaparece por
  -- construcción, no por acordarse.
  begin
    pedazo := verificar_perdida();
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('perdida', pedazo);

  begin
    pedazo := (select to_jsonb(p) from profiles p where p.id = uid);
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('perfil', pedazo);

  -- QUÉ VERSIÓN ABRIÓ LA APP (migración 63). No había forma de saber qué versión
  -- corre la gente: solo se veía a quien tuvo un error o mandó una sugerencia.
  -- La app la manda en `X-Client-Info` ("ascent/1.0.0 <ota>"); lo que no empieza
  -- así —la build de la tienda sin OTA, que manda el de la librería— deja la
  -- versión en null, y eso es "sigue en la vieja". En su propio bloque: es un
  -- dato para mirar, y no puede frenar que alguien abra la app.
  begin
    cliente := nullif(current_setting('request.headers', true), '')::json ->> 'x-client-info';
    -- SOLO LA APP ANOTA (migración 69). Antes cualquier pedido pisaba la versión
    -- con null: una cuenta al día que abría la web —o un script de prueba—
    -- pasaba a contarse como "sigue en la vieja". La app de la tienda sin OTA
    -- manda el encabezado de la librería para React Native: esa SÍ anota, en null.
    if cliente like 'ascent/%' or cliente like '%react-native%' then
      update profiles
         set ultima_apertura = now(),
             version_vista = case when cliente like 'ascent/%' then left(cliente, 100) end
       where id = uid;
    end if;
  exception when others then
    null;
  end;

  -- Los últimos siete días, que es lo que dibuja la tira. El orden lo pone la
  -- base para que el cliente no tenga que ordenar nada.
  begin
    pedazo := coalesce((
      select jsonb_agg(to_jsonb(l) order by l.fecha)
        from logs l
       where l.user_id = uid and l.fecha >= hoy - 6
    ), '[]'::jsonb);
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('logs', pedazo);

  -- Las configuraciones de descanso, de la más nueva a la más vieja: el
  -- cliente elige la vigente para cada fecha con `descansosVigentes`.
  begin
    pedazo := coalesce((
      select jsonb_agg(jsonb_build_object('desde', d.desde, 'dias', d.dias) order by d.desde desc)
        from descansos d
       where d.user_id = uid
    ), '[]'::jsonb);
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('descansos', pedazo);

  begin
    pedazo := mis_impulsos();
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('impulsos', pedazo);

  begin
    pedazo := mi_fuerza();
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('fuerza', pedazo);

  -- LA LÍNEA SOCIAL: "alguien más entrenó hoy". Del lado del cliente son TRES
  -- pedidos encadenados —los amigos, después el último día de esos amigos,
  -- después quién es— porque el cliente no puede hacer un join. Acá es una
  -- consulta.
  --
  -- CUIDADO CON SECURITY DEFINER (migración 41): adentro de esta función RLS
  -- no filtra nada, así que la pertenencia se pide explícita. `usuarios_
  -- publicos` ya es pública —username, avatar, racha y rango— y es lo único
  -- que sale de acá: no se devuelve el perfil del amigo ni sus días.
  begin
    pedazo := (
      select jsonb_build_object('username', u.username, 'racha', u.racha_actual)
        from logs l
        join usuarios_publicos u on u.id = l.user_id
       where l.es_descanso = false
         and l.user_id in (
           select case when f.solicitante = uid then f.destinatario else f.solicitante end
             from friendships f
            where f.estado = 'aceptada'
              and (f.solicitante = uid or f.destinatario = uid)
         )
       order by l.fecha desc
       limit 1
    );
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('social', pedazo);

  return r;
end;
$$;

revoke execute on function public.pantalla_inicio() from public, anon;
grant execute on function public.pantalla_inicio() to authenticated;

-- -------------------------------------------------------------
-- LOS EJERCICIOS QUE CADA PERSONA USA DE VERDAD (migración 44)
-- -------------------------------------------------------------
-- Sale de `sesiones.bloques`, que es la lista {ejercicio, series, pesos, carga}
-- de cada sesión: no hay tabla de series por ejercicio. Alcanza, porque lo que
-- se busca es cuáles repite y no cuántos kilos movió.
--
-- SE CUENTAN BLOQUES, NO SERIES: dos sesiones distintas con el mismo ejercicio
-- pesan más que una sola sesión con veinte series de ese ejercicio. Lo que hace
-- que algo sea "tuyo" es que vuelva.
--
-- ENTRAN LAS ABANDONADAS Y LAS CORTAS: una sesión que no llegó al piso de
-- duración igual dice qué ejercicio elegiste, que es lo único que se pregunta.
create or replace function public.mis_ejercicios_usados()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  filas jsonb;
begin
  if uid is null then return null; end if;

  select coalesce(jsonb_agg(f order by f.veces desc, f.ultima desc), '[]'::jsonb)
    into filas
    from (
      select
        b->>'ejercicio'      as ejercicio,
        count(*)::int        as veces,
        max(s.inicio)        as ultima
      from sesiones s
      cross join lateral jsonb_array_elements(s.bloques) b
      where s.user_id = uid
        and b->>'ejercicio' is not null
        and exists (select 1 from ejercicios e where e.id = b->>'ejercicio')
      group by 1
    ) f;

  return filas;
end;
$$;

revoke all on function public.mis_ejercicios_usados() from public;
grant execute on function public.mis_ejercicios_usados() to authenticated;

-- -------------------------------------------------------------
-- RLS (activo en TODAS las tablas desde el principio)
-- -------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.descansos enable row level security;
alter table public.logs enable row level security;
alter table public.photos enable row level security;
alter table public.weights enable row level security;
alter table public.friendships enable row level security;
alter table public.challenges enable row level security;
alter table public.feedback enable row level security;
alter table public.ejercicios enable row level security;
alter table public.prs enable row level security;
alter table public.sesiones enable row level security;
alter table public.errores_js enable row level security;

-- ¿Hay un bloqueo entre dos? (en cualquiera de los dos sentidos) (migración 53)
-- La llama la policy de "amistad: pedir" (evaluada como el usuario), así que
-- necesita execute; para que no sea una sonda —averiguar si dos ajenos se
-- bloquearon— solo contesta cuando el que pregunta es una de las dos puntas,
-- igual que son_amigos (migración 41).
create or replace function public.hay_bloqueo(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() in (a, b) and exists (
    select 1 from bloqueos
     where (bloqueador = a and bloqueado = b)
        or (bloqueador = b and bloqueado = a)
  );
$$;
revoke execute on function public.hay_bloqueo(uuid, uuid) from public, anon;
grant execute on function public.hay_bloqueo(uuid, uuid) to authenticated;

-- ¿Somos amigos aceptados? (contempla ambos sentidos)
-- Solo contesta sobre una amistad de QUIEN PREGUNTA (migración 41): con los
-- ids públicos, cualquiera podía averiguar si otras dos personas eran amigas.
-- Las políticas la llaman siempre con `auth.uid()` en una punta.
-- Y respeta el bloqueo (migración 53): un bloqueo corta el acceso a logs y fotos
-- aunque quedara una amistad suelta (cinturón y tirantes; bloquear ya la borra).
create or replace function public.son_amigos(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and auth.uid() in (a, b)
    and not public.hay_bloqueo(a, b)
    and exists (
      select 1 from friendships
      where estado = 'aceptada'
        and ((solicitante = a and destinatario = b) or (solicitante = b and destinatario = a))
    );
$$;

-- -------------------------------------------------------------
-- QUIÉN ESTÁ ENTRENANDO AHORA (migración 51; UNA SOLA FUENTE desde la 72)
--
-- Está entrenando quien tiene UNA SESIÓN CORRIENDO QUE LA BASE TODAVÍA DA POR
-- VIVA, y tiene prendido "Avisar cuando entreno" (`profiles.comparte_gimnasio`).
-- Nada más: sale de `sesiones`, la misma tabla que dice cuándo empezó y cuándo
-- terminó el entrenamiento.
--
-- Hasta la 72 salía de una tabla aparte, `en_el_gimnasio`, con una marca de dos
-- horas que ponía también el vigilante con solo estar adentro del radio del
-- gimnasio. Eran dos fuentes para lo mismo: aparecía entrenando quien había
-- terminado hacía dos horas y quien vivía al lado. La tabla se fue.
--
-- CON EL TELÉFONO BLOQUEADO NO SALE NADA (iOS congela la app, y la tarjeta de
-- la pantalla bloqueada no tiene botones): no hay "sigo acá" posible. Por eso
-- no se pide una señal aparte y se usa la regla con la que la base YA cierra
-- las sesiones: media hora sin series, o dos horas si nunca hubo una.
-- NUNCA dice dónde ni desde cuándo: nombre y avatar. La hora de inicio de la
-- sesión dejaría calcular cuánto dura, y la duración no se muestra a nadie.
-- -------------------------------------------------------------

-- ¿LA BASE TODAVÍA DA POR VIVA ESTA SESIÓN? Es la regla de
-- `cerrar_sesiones_vencidas`, dicha al revés; `test:db` comprueba que las dos
-- coinciden en el borde, para que no se separen.
create or replace function public.sesion_sigue_viva(p_inicio timestamptz, p_ultima_actividad timestamptz)
returns boolean language sql stable set search_path = public as $$
  select case
           when p_ultima_actividad > p_inicio then now() < p_ultima_actividad + public.ventana_inactividad()
           else now() - p_inicio < public.tope_sesion()
         end;
$$;
revoke execute on function public.sesion_sigue_viva(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.fijar_comparte_gimnasio(p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  -- Al apagarlo deja de aparecer YA: `entrenando_ahora` lo lee de acá.
  update profiles set comparte_gimnasio = coalesce(p_valor, false) where id = uid;
end;
$$;

-- YA NO HACE NADA (migración 72). Queda porque los teléfonos sin actualizar la
-- siguen llamando: al llegar al gimnasio y al iniciar una sesión.
create or replace function public.marcar_en_gimnasio()
returns void language plpgsql security definer set search_path = public as $$
begin
  return;
end;
$$;

create or replace function public.entrenando_ahora()
returns table (id uuid, username text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select u.id, u.username, u.avatar_url
    from sesiones s
    join profiles p on p.id = s.user_id and p.comparte_gimnasio
    join usuarios_publicos u on u.id = s.user_id
   where s.estado = 'corriendo'
     and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
     and s.user_id <> auth.uid()
     and public.son_amigos(auth.uid(), s.user_id)
   order by s.inicio desc;
$$;

revoke execute on function public.fijar_comparte_gimnasio(boolean), public.marcar_en_gimnasio(), public.entrenando_ahora() from public, anon;
grant execute on function public.fijar_comparte_gimnasio(boolean), public.marcar_en_gimnasio(), public.entrenando_ahora() to authenticated;

-- LA RUTINA QUE VE UN AMIGO (migración 64). Qué ejercicios hizo cada día de las
-- últimas cuatro semanas, en orden, y cuántas series de cada uno. NADA MÁS: ni
-- pesos, ni cuánto duró ni a qué hora. `sesiones` sigue siendo solo del dueño
-- (§17.8) —competir por tiempo de gimnasio empuja a entrenar de más—; esto es
-- una ventana chica sobre ella, y la persona la puede cerrar
-- (`profiles.comparte_rutina`).
create or replace function public.fijar_comparte_rutina(p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  update profiles set comparte_rutina = coalesce(p_valor, true) where id = uid;
end;
$$;

create or replace function public.rutina_de_amigo(p_quien uuid)
returns table (fecha date, bloques jsonb)
language sql stable security definer set search_path = public as $$
  select l.fecha,
         -- Se arma de nuevo con SOLO esas dos claves: el bloque guardado lleva
         -- además los pesos, y esos no salen de acá.
         (select jsonb_agg(jsonb_build_object('ejercicio', b.value ->> 'ejercicio', 'series', b.value -> 'series')
                           || case when jsonb_typeof(b.value -> 'minutos') = 'number' then jsonb_build_object('minutos', b.value -> 'minutos') else '{}'::jsonb end
                           order by b.ordinality)
            from jsonb_array_elements(s.bloques) with ordinality b
           where coalesce(b.value ->> 'ejercicio', '') <> '')
    from sesiones s
    join logs l on l.id = s.log_id
    join profiles p on p.id = s.user_id
   where s.user_id = p_quien
     and auth.uid() is not null
     and s.estado = 'terminada'
     and jsonb_array_length(s.bloques) > 0
     and l.fecha >= current_date - 28
     and (p_quien = auth.uid() or (p.comparte_rutina and public.son_amigos(auth.uid(), p_quien)))
   order by l.fecha desc, s.inicio desc;
$$;
revoke execute on function public.fijar_comparte_rutina(boolean), public.rutina_de_amigo(uuid) from public, anon;
grant execute on function public.fijar_comparte_rutina(boolean), public.rutina_de_amigo(uuid) to authenticated;

-- -------------------------------------------------------------
-- LAS RUTINAS GUARDADAS (migración 75)
-- -------------------------------------------------------------
-- Hasta acá la rutina se deducía de las sesiones (`rutina_de_amigo`). Ahora
-- también se guarda: VARIAS por cuenta ("Entrenamiento 1", "Entrenamiento 2"),
-- cada una con su semana entera —días de descanso incluidos— y UNA activa.
--
-- `dias` es una lista de 7, en el orden de `Date.getDay()` (0 = domingo):
-- [{ descanso, ejercicios: [{ ejercicio, series, minutos? }] }]. NUNCA PESOS.
-- Lo que llega del teléfono pasa por `rutina_dias_limpios`, que le pone esa
-- forma y los topes: lo que no se entienda se tira, no revienta.
--
-- Sin acceso directo: se lee y se escribe por las funciones, como el resto de
-- las tablas nuevas. Copiar la rutina de un amigo es leerla (por las funciones
-- de siempre, que miran la amistad y "mostrar mi rutina") y guardarla como
-- una propia: una copia libre, sin atadura con la de él.
create table if not exists public.rutinas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null,
  activa boolean not null default false,
  dias jsonb not null,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  constraint rutinas_nombre_valido check (char_length(nombre) between 1 and 40)
);
create unique index if not exists rutinas_una_activa on public.rutinas (user_id) where activa;
create index if not exists rutinas_de on public.rutinas (user_id);
alter table public.rutinas enable row level security;

create or replace function public.rutina_dias_limpios(p_dias jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_agg(
           jsonb_build_object(
             'descanso', coalesce(jsonb_typeof(d.valor -> 'descanso') = 'boolean' and (d.valor ->> 'descanso')::boolean, false),
             'ejercicios', case
               when coalesce(jsonb_typeof(d.valor -> 'descanso') = 'boolean' and (d.valor ->> 'descanso')::boolean, false) then '[]'::jsonb
               else coalesce((
                 select jsonb_agg(
                          jsonb_build_object(
                            'ejercicio', left(e.valor ->> 'ejercicio', 80),
                            'series', case when jsonb_typeof(e.valor -> 'series') = 'number'
                                           then greatest(0, least(round((e.valor ->> 'series')::numeric), 99)) else 0 end
                          ) || case when jsonb_typeof(e.valor -> 'minutos') = 'number'
                                    then jsonb_build_object('minutos', greatest(0, least(round((e.valor ->> 'minutos')::numeric), 600)))
                                    else '{}'::jsonb end
                          order by e.i)
                   from jsonb_array_elements(case when jsonb_typeof(d.valor -> 'ejercicios') = 'array' then d.valor -> 'ejercicios' else '[]'::jsonb end)
                        with ordinality as e(valor, i)
                  where jsonb_typeof(e.valor) = 'object'
                    and coalesce(e.valor ->> 'ejercicio', '') <> ''
                    and e.i <= 30
               ), '[]'::jsonb)
             end
           ) order by g.n)
    from generate_series(0, 6) as g(n)
    cross join lateral (select case when jsonb_typeof(p_dias) = 'array' then p_dias -> g.n end as valor) as d;
$$;
revoke execute on function public.rutina_dias_limpios(jsonb) from public, anon, authenticated;

-- MIS RUTINAS, de la más vieja a la más nueva.
create or replace function public.mis_rutinas()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre, 'activa', r.activa, 'dias', r.dias) order by r.creada, r.id), '[]'::jsonb)
    from rutinas r
   where r.user_id = auth.uid();
$$;

-- GUARDAR: sin id crea una (activa si es la primera); con id cambia la mía.
-- Devuelve el id, o null si el id no era mío. Hasta diez por cuenta.
create or replace function public.guardar_rutina(p_id uuid, p_nombre text, p_dias jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio text := left(btrim(coalesce(p_nombre, '')), 40);
  v_id uuid;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if limpio = '' then limpio := 'Entrenamiento'; end if;
  if p_id is null then
    if (select count(*) from rutinas where user_id = uid) >= 10 then raise exception 'ya hay diez rutinas'; end if;
    insert into rutinas (user_id, nombre, dias, activa)
         values (uid, limpio, rutina_dias_limpios(p_dias), not exists (select 1 from rutinas where user_id = uid and activa))
      returning id into v_id;
  else
    update rutinas set nombre = limpio, dias = rutina_dias_limpios(p_dias), actualizada = now()
     where id = p_id and user_id = uid
     returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ACTIVAR una mía: queda esa sola. En dos pasos, para que el índice de "una
-- activa" no vea dos por un instante.
create or replace function public.activar_rutina(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if not exists (select 1 from rutinas where id = p_id and user_id = uid) then return; end if;
  update rutinas set activa = false where user_id = uid and activa and id <> p_id;
  update rutinas set activa = true where id = p_id;
end;
$$;

create or replace function public.borrar_rutina(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  delete from rutinas where id = p_id and user_id = auth.uid();
end;
$$;

-- LA RUTINA ACTIVA DE ALGUIEN: la mía, o la de un amigo que la muestra (la
-- misma regla que `rutina_de_amigo`). Null si no tiene ninguna guardada.
create or replace function public.rutina_activa_de(p_quien uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'nombre', r.nombre, 'dias', r.dias)
    from rutinas r
    join profiles p on p.id = r.user_id
   where r.user_id = p_quien
     and r.activa
     and auth.uid() is not null
     and (p_quien = auth.uid() or (p.comparte_rutina and public.son_amigos(auth.uid(), p_quien)));
$$;

revoke execute on function public.mis_rutinas(), public.guardar_rutina(uuid, text, jsonb), public.activar_rutina(uuid),
  public.borrar_rutina(uuid), public.rutina_activa_de(uuid) from public, anon;
grant execute on function public.mis_rutinas(), public.guardar_rutina(uuid, text, jsonb), public.activar_rutina(uuid),
  public.borrar_rutina(uuid), public.rutina_activa_de(uuid) to authenticated;


-- -------------------------------------------------------------
-- ENTRENAR CON OTRO (migración 67) — la versión chica, de a dos
-- -------------------------------------------------------------
-- Uno pide unirse al entrenamiento de un amigo; si acepta, mientras dure cada
-- uno ve del otro EN QUÉ EJERCICIO ESTÁ, QUÉ SERIE y CUÁNDO TERMINA SU DESCANSO.
-- Nunca los pesos ni cuánto lleva: no hay columna donde ponerlos.
--
-- Son dos tablas sin acceso directo: se entra y se lee por las funciones.

-- LO QUE ESTOY HACIENDO AHORA. Una fila por persona, que su teléfono pisa.
create table if not exists public.en_vivo (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ejercicio text,
  serie int not null default 0,
  meta int not null default 0,
  -- Cuándo termina el descanso, EN EL RELOJ DE LA BASE: el teléfono manda
  -- cuánto falta y no una hora, porque dos teléfonos no tienen la misma.
  descanso_fin timestamptz,
  actualizado timestamptz not null default now()
);
alter table public.en_vivo enable row level security;

-- EL VÍNCULO ENTRE DOS. Uno por par, y vence solo: sin cron ni limpieza.
create table if not exists public.entrenos_compartidos (
  id uuid primary key default gen_random_uuid(),
  solicitante uuid not null references public.profiles(id) on delete cascade,
  destinatario uuid not null references public.profiles(id) on delete cascade,
  estado text not null default 'pendiente',
  creado timestamptz not null default now(),
  hasta timestamptz not null,
  constraint entrenos_estado_valido check (estado in ('pendiente', 'aceptada')),
  constraint entrenos_no_con_uno_mismo check (solicitante <> destinatario)
);
create unique index if not exists entrenos_par_unico on public.entrenos_compartidos
  (least(solicitante, destinatario), greatest(solicitante, destinatario));
alter table public.entrenos_compartidos enable row level security;

-- ENTRENAR EN GRUPO (migración 88): el par de antes pasó a ser un grupo de hasta 10.
create table if not exists public.grupos_entreno (
  id uuid primary key default gen_random_uuid(),
  -- Para el link de invitación: corto, sin significado y sin la hora.
  codigo text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  creado timestamptz not null default now()
);
alter table public.grupos_entreno enable row level security;

create table if not exists public.grupo_miembros (
  -- Una fila por persona: nadie está en dos grupos.
  user_id uuid primary key references public.profiles(id) on delete cascade,
  grupo_id uuid not null references public.grupos_entreno(id) on delete cascade,
  entro timestamptz not null default clock_timestamp(),
  -- Desempata a los que entraron en el mismo instante: el orden de llegada.
  n bigint generated always as identity
);
create index if not exists grupo_miembros_grupo on public.grupo_miembros (grupo_id);
alter table public.grupo_miembros enable row level security;

create or replace function public.tope_grupo()
returns int language sql immutable as $$ select 10; $$;

-- ¿Sigue entrenando? Lo mismo que mira "Entrenando ahora": una sesión viva.
create or replace function public.entrena_ahora(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sesiones s
     where s.user_id = p_user and s.estado = 'corriendo'
       and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
  );
$$;

-- ¿Sigue en el grupo? Como el par de antes (vinculo_vivo): tres horas desde que entró, o
-- más si sigue entrenando; y nunca si dejó una sesión que la base ya no da por viva.
-- Quien todavía no empezó y solo mira, cuenta.
create or replace function public.miembro_vivo(p_user uuid, p_entro timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select (p_entro > now() - interval '3 hours' or public.entrena_ahora(p_user))
     and not exists (
       select 1 from sesiones s
        where s.user_id = p_user and s.estado = 'corriendo'
          and not public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
     );
$$;

-- Saca a los que ya no entrenan y borra los grupos vacíos. Se llama al entrar a
-- cualquier función de grupo: no hace falta un trabajo nocturno.
create or replace function public.limpiar_grupos()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from grupo_miembros m where not public.miembro_vivo(m.user_id, m.entro);
  delete from grupos_entreno g where not exists (select 1 from grupo_miembros m where m.grupo_id = g.id);
  -- Los pedidos de quien ya no entrena tampoco sirven.
  delete from entrenos_compartidos e where e.estado = 'pendiente' and e.hasta < now();
end;
$$;

create or replace function public.grupo_de(p_user uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select grupo_id from grupo_miembros where user_id = p_user;
$$;

-- ¿Está en un grupo DE VERDAD? Uno de uno (el que armó el link y nadie entró, o el
-- que quedó solo) no cuenta: no le impide unirse a otro.
create or replace function public.en_grupo(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from grupo_miembros where grupo_id = public.grupo_de(p_user)) >= 2;
$$;

-- ¿Son amigos? Sin mirar quién pregunta: un pedido lo ve todo el grupo.
create or replace function public.amigos_entre(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.hay_bloqueo(a, b)
     and exists (select 1 from friendships where estado = 'aceptada'
                  and least(solicitante, destinatario) = least(a, b) and greatest(solicitante, destinatario) = greatest(a, b));
$$;

-- Quien armó el grupo: el que lleva más tiempo adentro.
create or replace function public.lider_de(p_grupo uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from grupo_miembros where grupo_id = p_grupo order by entro, n limit 1;
$$;

-- ¿Hay un bloqueo entre estos dos? (migración 90) Sin mirar quién pregunta
-- (`hay_bloqueo` solo contesta si uno de los dos es quien llama, y a un pedido lo
-- acepta cualquiera del grupo). Interna: abierta, cualquiera podría preguntar
-- quién bloqueó a quién.
create or replace function public.bloqueo_entre(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bloqueos
     where (bloqueador = a and bloqueado = b) or (bloqueador = b and bloqueado = a)
  );
$$;

create or replace function public.bloqueo_con_el_grupo(p_quien uuid, p_grupo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from grupo_miembros m
     where m.grupo_id = p_grupo and public.bloqueo_entre(p_quien, m.user_id)
  );
$$;

-- Mete a alguien en el grupo de `p_con` (o arma uno con los dos). Devuelve el resultado.
-- Lleno o con alguien bloqueado (migración 90): "ocupado", que no delata el bloqueo,
-- y ANTES de sacarlo de su grupo de uno.
create or replace function public.entrar_al_grupo(p_quien uuid, p_con uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  g uuid := public.grupo_de(p_con);
begin
  if public.en_grupo(p_quien) then return 'ya-unido'; end if;
  if g is null then
    if public.bloqueo_entre(p_quien, p_con) then return 'ocupado'; end if;
  elsif (select count(*) from grupo_miembros where grupo_id = g) >= public.tope_grupo()
        or public.bloqueo_con_el_grupo(p_quien, g) then
    return 'ocupado';
  end if;
  -- El que estaba solo deja su grupo de uno.
  delete from grupo_miembros where user_id = p_quien;
  delete from grupos_entreno x where not exists (select 1 from grupo_miembros m where m.grupo_id = x.id);
  if g is null then
    insert into grupos_entreno default values returning id into g;
    insert into grupo_miembros (user_id, grupo_id) values (p_con, g);
  end if;
  insert into grupo_miembros (user_id, grupo_id) values (p_quien, g);
  delete from entrenos_compartidos where estado = 'pendiente' and solicitante = p_quien;
  return 'ok';
end;
$$;


-- ¿ESTE VÍNCULO SIGUE VIVO? (migración 73). No alcanza con que no haya vencido:
-- quien se va sin tocar "Terminar" deja la sesión `corriendo` en la base hasta
-- que vuelva a abrir la app, y el disparador que corta el vínculo no dispara.
-- El otro lo seguía viendo en "Entrenando contigo" hasta tres horas, mientras
-- "Entrenando ahora" ya lo había sacado. Una sola regla para las dos listas: si
-- alguno de los dos tiene una sesión que la base ya no da por viva, no hay
-- vínculo. Quien no tiene sesión y solo mira no cuenta.
create or replace function public.vinculo_vivo(p_solicitante uuid, p_destinatario uuid, p_hasta timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select p_hasta > now()
     and not exists (
           select 1
             from sesiones s
            where s.user_id in (p_solicitante, p_destinatario)
              and s.estado = 'corriendo'
              and not public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
         );
$$;
revoke execute on function public.vinculo_vivo(uuid, uuid, timestamptz) from public, anon, authenticated;

-- ¿YA ENTRENA CON ALGUIEN? DE A DOS, DE VERDAD (migración 73). El índice es por
-- par, no por persona: quien ya estaba unido podía aceptar a un segundo y
-- quedaba una estrella donde los otros dos no se veían entre sí. Los grupos de
-- verdad llegan con el multijugador completo; hasta entonces, uno solo.
create or replace function public.entrena_con_otro(p_quien uuid, p_salvo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from grupo_miembros a join grupo_miembros b on b.grupo_id = a.grupo_id
     where a.user_id = p_quien and b.user_id <> p_quien and b.user_id <> p_salvo
  );
$$;
revoke execute on function public.entrena_con_otro(uuid, uuid) from public, anon, authenticated;

-- PEDIR UNIRSE. Solo a un amigo QUE ESTÉ ENTRENANDO AHORA (la misma regla que
-- `entrenando_ahora`: la lista del teléfono puede ser de hace un rato) y que no
-- esté ya con otro. Si el otro ya me lo había pedido a mí, pedir es aceptar.
-- Repetirlo no hace nada: se puede reintentar. Contesta qué pasó, para que el
-- teléfono pueda decirlo: 'ok', 'no-entrena', 'ocupado' (el otro ya entrena con
-- alguien) o 'ya-unido' (yo ya entreno con alguien). "Ocupado" también si en el
-- grupo del otro hay alguien bloqueado (migración 90).
create or replace function public.pedir_unirse(p_a uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_a is null or p_a = uid or not public.son_amigos(uid, p_a) then return 'no-entrena'; end if;
  perform public.limpiar_grupos();
  if public.en_grupo(uid) then return 'ya-unido'; end if;
  if public.grupo_de(p_a) is not null
     and ((select count(*) from grupo_miembros where grupo_id = public.grupo_de(p_a)) >= public.tope_grupo()
          or public.bloqueo_con_el_grupo(uid, public.grupo_de(p_a))) then
    return 'ocupado';
  end if;
  -- Él me lo había pedido a mí: con pedirlo de vuelta alcanza para estar juntos.
  if exists (select 1 from entrenos_compartidos where estado = 'pendiente' and solicitante = p_a and destinatario = uid) then
    delete from entrenos_compartidos where estado = 'pendiente' and solicitante = p_a and destinatario = uid;
    return public.entrar_al_grupo(p_a, uid);
  end if;
  if not exists (
       select 1 from sesiones s join profiles p on p.id = s.user_id and p.comparte_gimnasio
        where s.user_id = p_a and s.estado = 'corriendo'
          and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)) then
    return 'no-entrena';
  end if;
  insert into entrenos_compartidos (solicitante, destinatario, hasta)
       values (uid, p_a, now() + interval '3 hours')
  on conflict do nothing;
  return 'ok';
end;
$$;

-- CONTESTAR. Solo quien la recibió. Decir que no la borra: el otro puede volver
-- a pedir. Aceptar pide que el vínculo siga vivo y que ninguno de los dos esté
-- ya con otro (migración 73); si no se puede, el pedido se borra: ya no sirve.
-- Al aceptar se van los demás pedidos pendientes de los dos. No hace falta
-- mirar si quien acepta entrena: si cerró su sesión, el disparador ya se llevó
-- el pedido, y si la dejó abierta y se fue, el vínculo no está vivo.
create or replace function public.responder_union(p_id uuid, p_acepta boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c entrenos_compartidos;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform public.limpiar_grupos();
  select * into c from entrenos_compartidos
   where id = p_id and estado = 'pendiente'
     and (destinatario = uid or (public.grupo_de(uid) is not null and public.grupo_de(destinatario) = public.grupo_de(uid)));
  if c.id is null then return; end if;
  delete from entrenos_compartidos where id = c.id;
  if not coalesce(p_acepta, false) then return; end if;
  if not public.miembro_vivo(c.solicitante, now()) or not public.miembro_vivo(c.destinatario, now())
     or not public.miembro_vivo(uid, now()) then
    return;
  end if;
  perform public.entrar_al_grupo(c.solicitante, c.destinatario);
end;
$$;

-- SALIR de lo que tengo con UNA persona (cualquiera de los dos, pedido o aceptado).
create or replace function public.salir_de_union(p_otro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_otro is null then return; end if;
  delete from entrenos_compartidos
   where (solicitante = uid and destinatario = p_otro) or (solicitante = p_otro and destinatario = uid);
  if public.grupo_de(uid) is not null and public.grupo_de(uid) = public.grupo_de(p_otro) then
    perform public.salir_del_grupo();
  end if;
end;
$$;

-- PUBLICAR LO QUE ESTOY HACIENDO. Idempotente: pisa la fila. Los números se
-- acotan acá: lo que llega del teléfono no se cree.
create or replace function public.publicar_en_vivo(p_ejercicio text, p_serie int, p_meta int, p_descanso_faltan int)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  insert into en_vivo (user_id, ejercicio, serie, meta, descanso_fin, actualizado)
       values (
         uid,
         case when p_ejercicio is not null and exists (select 1 from ejercicios where id = p_ejercicio) then p_ejercicio end,
         least(99, greatest(0, coalesce(p_serie, 0))),
         least(99, greatest(0, coalesce(p_meta, 0))),
         case when p_descanso_faltan is not null and p_descanso_faltan > 0
              then now() + make_interval(secs => least(p_descanso_faltan, 3600)) end,
         now())
  on conflict (user_id) do update
     set ejercicio = excluded.ejercicio, serie = excluded.serie, meta = excluded.meta,
         descanso_fin = excluded.descanso_fin, actualizado = now();
end;
$$;

-- TERMINÉ DE ENTRENAR: dejo de aparecer, se va lo que publiqué y se cortan mis
-- vínculos. El otro sigue con su entrenamiento; solo deja de verme.
create or replace function public.dejar_de_entrenar()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  delete from en_vivo where user_id = uid;
  delete from entrenos_compartidos where solicitante = uid or destinatario = uid;
  delete from grupo_miembros where user_id = uid;
  delete from grupos_entreno g where not exists (select 1 from grupo_miembros m where m.grupo_id = g.id);
end;
$$;

-- LO QUE VE MI PANTALLA: mis vínculos vigentes, con quién, quién pidió, y —solo
-- si está aceptado y seguimos siendo amigos— lo que el otro publicó. `ahora` es
-- el reloj de la base: con eso el teléfono hace la cuenta del descanso sin
-- depender del suyo.
create or replace function public.mis_uniones()
returns jsonb language sql stable security definer set search_path = public as $$
  with g as (
    select m.grupo_id as id from grupo_miembros m
     where m.user_id = auth.uid() and public.miembro_vivo(m.user_id, m.entro)
  ),
  lider as (select public.lider_de((select id from g)) as id),
  companeros as (
    select jsonb_build_object(
             'id', m.grupo_id,
             'estado', 'aceptada',
             -- Para la app de la tienda: "la pedí yo" = entré después que él.
             'la_pedi_yo', (select x.n from grupo_miembros x where x.user_id = auth.uid()) > m.n,
             'grupo', m.grupo_id,
             'lider', m.user_id = (select id from lider),
             'yo_lider', auth.uid() = (select id from lider),
             'otro', jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url),
             'ahora', now(),
             'en_vivo', (
               select jsonb_build_object(
                        'ejercicio', v.ejercicio, 'serie', v.serie, 'meta', v.meta,
                        'descanso_fin', v.descanso_fin, 'actualizado', v.actualizado)
                 from en_vivo v where v.user_id = m.user_id and v.actualizado >= m.entro - interval '1 minute')
           ) as j, 0 as tipo, m.entro as orden
      from grupo_miembros m
      join usuarios_publicos u on u.id = m.user_id
     where m.grupo_id = (select id from g) and m.user_id <> auth.uid()
       and public.miembro_vivo(m.user_id, m.entro)
  ),
  pedidos as (
    select jsonb_build_object(
             'id', c.id,
             'estado', 'pendiente',
             'la_pedi_yo', c.solicitante = auth.uid(),
             'grupo', null,
             'lider', false,
             'yo_lider', auth.uid() = (select id from lider),
             'otro', jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url),
             'ahora', now(),
             'en_vivo', null
           ) as j, 1 as tipo, c.creado as orden
      from entrenos_compartidos c
      join usuarios_publicos u on u.id = case when c.solicitante = auth.uid() then c.destinatario else c.solicitante end
     where c.estado = 'pendiente' and c.hasta > now()
       and public.amigos_entre(c.solicitante, c.destinatario)
       and (c.solicitante = auth.uid() or c.destinatario = auth.uid()
            or ((select id from g) is not null and public.grupo_de(c.destinatario) = (select id from g)))
  )
  -- Primero los compañeros, después los pedidos.
  select coalesce((select jsonb_agg(j order by tipo, orden) from (select * from companeros union all select * from pedidos) t), '[]'::jsonb);
$$;

-- ¿ESTA PERSONA ME MUESTRA SU RUTINA? Para que el perfil de un amigo pueda
-- distinguir "la escondió" (no se dibuja nada) de "no hay datos" (se explica).
-- Solo contesta que sí a un amigo: a cualquier otro le dice que no.
create or replace function public.me_muestra_su_rutina(p_quien uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.comparte_rutina from profiles p
     where p.id = p_quien and (p_quien = auth.uid() or public.son_amigos(auth.uid(), p_quien))
  ), false);
$$;

create or replace function public.salir_del_grupo()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  delete from grupo_miembros where user_id = uid;
  delete from grupos_entreno g where not exists (select 1 from grupo_miembros m where m.grupo_id = g.id);
end;
$$;

create or replace function public.echar_del_grupo(p_quien uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g uuid := public.grupo_de(auth.uid());
begin
  if uid is null or g is null or p_quien is null or p_quien = uid then return false; end if;
  if public.lider_de(g) <> uid or public.grupo_de(p_quien) is distinct from g then return false; end if;
  delete from grupo_miembros where user_id = p_quien;
  return true;
end;
$$;

create or replace function public.link_del_grupo()
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g uuid;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform public.limpiar_grupos();
  if not public.entrena_ahora(uid) then return null; end if;
  g := public.grupo_de(uid);
  if g is null then
    insert into grupos_entreno default values returning id into g;
    insert into grupo_miembros (user_id, grupo_id) values (uid, g);
  end if;
  return (select codigo from grupos_entreno where id = g);
end;
$$;

create or replace function public.unirse_por_link(p_codigo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g uuid;
  lider uuid;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform public.limpiar_grupos();
  select id into g from grupos_entreno where codigo = p_codigo;
  if g is null then return 'no-existe'; end if;
  lider := public.lider_de(g);
  if lider is null or lider = uid then return case when lider = uid then 'ya-unido' else 'no-existe' end; end if;
  if public.hay_bloqueo(uid, lider) then return 'no-existe'; end if;
  -- Amigos en el acto: el link lo compartió quien armó el grupo.
  update friendships set estado = 'aceptada'
   where least(solicitante, destinatario) = least(uid, lider) and greatest(solicitante, destinatario) = greatest(uid, lider);
  if not found then
    insert into friendships (solicitante, destinatario, estado) values (lider, uid, 'aceptada');
  end if;
  if public.grupo_de(uid) = g then return 'ya-unido'; end if;
  return public.entrar_al_grupo(uid, lider);
end;
$$;

revoke execute on function public.pedir_unirse(uuid), public.responder_union(uuid, boolean), public.salir_de_union(uuid),
  public.publicar_en_vivo(text, int, int, int), public.dejar_de_entrenar(), public.mis_uniones(),
  public.me_muestra_su_rutina(uuid) from public, anon;
grant execute on function public.pedir_unirse(uuid), public.responder_union(uuid, boolean), public.salir_de_union(uuid),
  public.publicar_en_vivo(text, int, int, int), public.dejar_de_entrenar(), public.mis_uniones(),
  public.me_muestra_su_rutina(uuid) to authenticated;

-- -------------------------------------------------------------
-- ENTRENAR CON OTRO, DOS ARREGLOS (migración 68)
-- -------------------------------------------------------------
-- 1. EL VÍNCULO SE CORTA CUANDO LA SESIÓN SE CIERRA, LA CIERRE QUIEN LA CIERRE.
--    Antes solo cortaba el botón "Terminar" del teléfono. Si la cerraba el
--    vigilante del gimnasio, la inactividad o deshacer el día, el otro seguía
--    viendo un entrenamiento viejo hasta tres horas. Va en un disparador y no
--    en cada función que cierra: la próxima que se agregue también corta.
--
--    NUNCA PUEDE IMPEDIR QUE LA SESIÓN SE CIERRE: si esto falla, se traga el
--    error. Cerrar la sesión es el dato; cortar el vínculo es limpieza.
create or replace function public.sesion_cerrada_corta_el_entreno()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    delete from en_vivo where user_id = old.user_id;
    delete from entrenos_compartidos where solicitante = old.user_id or destinatario = old.user_id;
    delete from grupo_miembros where user_id = old.user_id;
    delete from grupos_entreno g where not exists (select 1 from grupo_miembros m where m.grupo_id = g.id);
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- TIEMPO REAL: los del grupo leen lo del grupo, y nada más. Las políticas corren con
-- los permisos de quien lee: por eso dos funciones que solo hablan de MI grupo (con
-- grupo_de abierto, cualquiera podría preguntar en qué grupo está otro).
create or replace function public.mi_grupo()
returns uuid language sql stable security definer set search_path = public as $$
  select public.grupo_de(auth.uid());
$$;
-- Dos que se bloquearon no se leen aunque estén en el mismo grupo: el bloqueo pudo
-- llegar con los dos adentro (migración 90). La fila propia también pasa por acá.
create or replace function public.en_mi_grupo(p_otro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.grupo_de(auth.uid()) is not null and public.grupo_de(p_otro) = public.grupo_de(auth.uid())
     and not public.bloqueo_entre(auth.uid(), p_otro);
$$;
revoke execute on function public.mi_grupo(), public.en_mi_grupo(uuid) from public, anon;
grant execute on function public.mi_grupo(), public.en_mi_grupo(uuid) to authenticated;

drop policy if exists "en vivo: mi grupo" on public.en_vivo;
create policy "en vivo: mi grupo" on public.en_vivo for select
  using (user_id = auth.uid() or public.en_mi_grupo(user_id));
drop policy if exists "grupo: los del grupo" on public.grupo_miembros;
create policy "grupo: los del grupo" on public.grupo_miembros for select
  using (public.en_mi_grupo(user_id));
grant select on public.en_vivo to authenticated;
grant select on public.grupo_miembros to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.en_vivo;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.grupo_miembros;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

revoke execute on function public.tope_grupo(), public.entrena_ahora(uuid), public.miembro_vivo(uuid, timestamptz), public.limpiar_grupos(), public.grupo_de(uuid), public.en_grupo(uuid), public.amigos_entre(uuid, uuid),
  public.lider_de(uuid), public.entrar_al_grupo(uuid, uuid), public.entrena_con_otro(uuid, uuid),
  public.bloqueo_entre(uuid, uuid), public.bloqueo_con_el_grupo(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.salir_del_grupo(), public.echar_del_grupo(uuid), public.link_del_grupo(), public.unirse_por_link(text) from public, anon;
grant execute on function public.salir_del_grupo(), public.echar_del_grupo(uuid), public.link_del_grupo(), public.unirse_por_link(text) to authenticated;
-- Las de siempre ya tenían sus permisos; `create or replace` no los cambia.

revoke execute on function public.sesion_cerrada_corta_el_entreno() from public, anon, authenticated;

drop trigger if exists sesiones_al_cerrar_corta on public.sesiones;
create trigger sesiones_al_cerrar_corta
  after update of estado on public.sesiones
  for each row when (old.estado = 'corriendo' and new.estado <> 'corriendo')
  execute function public.sesion_cerrada_corta_el_entreno();

-- La sesión que se BORRA estando corriendo (deshacer el día se lleva el log, y
-- el log se lleva la sesión).
drop trigger if exists sesiones_al_borrar_corta on public.sesiones;
create trigger sesiones_al_borrar_corta
  after delete on public.sesiones
  for each row when (old.estado = 'corriendo')
  execute function public.sesion_cerrada_corta_el_entreno();

-- profiles: solo el dueño (lo público sale por la vista)
create policy "perfil propio: leer" on public.profiles for select using (auth.uid() = id);
create policy "perfil propio: editar" on public.profiles for update using (auth.uid() = id);

-- descansos: el dueño los lee; escribirlos es tarea exclusiva del RPC,
-- que es el que garantiza que el cambio rija desde hoy y no hacia atrás
create policy "descansos: leer los propios" on public.descansos for select using (auth.uid() = user_id);

-- logs: dueño todo; amigos aceptados leen
create policy "logs: dueño" on public.logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Los días de un amigo NO se leen de la tabla (migración 86): la política abría
-- todas las columnas, y `creado` y `origen` dicen a qué hora entrenó y si llegó al
-- gimnasio, aunque tenga "Avisar cuando entreno" apagado. Van por esta vista, que
-- corre como su dueño (como `usuarios_publicos`) y filtra en el where.
create view public.logs_de_amigos
with (security_invoker = off) as
  select id, user_id, fecha, es_descanso, planeta_del_dia, racha_del_dia
    from public.logs
   where public.son_amigos(auth.uid(), user_id);
revoke all on public.logs_de_amigos from public, anon;
grant select on public.logs_de_amigos to authenticated;

-- photos: dueño todo; amigos leen solo las visibles
-- LA RUTA Y EL DÍA TIENEN QUE SER DE QUIEN ANOTA LA FOTO (migración 60). Con
-- solo `auth.uid() = user_id` se podía anotar una fila propia con la ruta del
-- archivo de OTRO, y esa fila le abría el archivo a los amigos de quien la
-- anotaba (ver la regla del storage, más abajo): una foto privada, leída por
-- dos cuentas puestas de acuerdo. La app siempre subió a su carpeta y anotó esa
-- misma ruta, así que para ella no cambia nada.
create policy "fotos: dueño" on public.photos for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and storage_path like auth.uid()::text || '/%'
    and (
      photos.log_id is null
      or exists (select 1 from public.logs l where l.id = photos.log_id and l.user_id = auth.uid())
    )
  );
create policy "fotos: amigos leen visibles" on public.photos for select
  using (visibilidad = 'amigos' and public.son_amigos(auth.uid(), user_id));

-- weights: SOLO el dueño, sin excepción
create policy "peso: solo dueño" on public.weights for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- friendships: las dos puntas leen; el solicitante crea; el destinatario acepta; cualquiera de los dos borra
create policy "amistad: leer" on public.friendships for select
  using (auth.uid() = solicitante or auth.uid() = destinatario);
-- No se puede pedir amistad si hay un bloqueo en cualquier sentido (migración 53).
create policy "amistad: pedir" on public.friendships for insert
  with check (
    auth.uid() = solicitante
    and estado = 'pendiente'
    and not public.hay_bloqueo(solicitante, destinatario)
  );
create policy "amistad: aceptar" on public.friendships for update
  using (auth.uid() = destinatario) with check (estado = 'aceptada');
create policy "amistad: borrar" on public.friendships for delete
  using (auth.uid() = solicitante or auth.uid() = destinatario);

-- challenges: las dos puntas leen; solo se reta a amigos aceptados;
-- el rival responde (aceptar/rechazar); el cierre lo hace cerrar_retos_vencidos()
create policy "retos: leer" on public.challenges for select using (auth.uid() = retador or auth.uid() = rival);
create policy "retos: crear" on public.challenges for insert
  with check (auth.uid() = retador and public.son_amigos(retador, rival) and estado = 'pendiente');
create policy "retos: responder" on public.challenges for update
  using (auth.uid() = rival and estado = 'pendiente')
  with check (estado in ('activo', 'rechazado'));
create policy "retos: borrar pendiente" on public.challenges for delete
  using (auth.uid() = retador and estado = 'pendiente');

-- feedback: cualquiera logueado inserta; nadie lee desde el cliente
-- (el dueño de la app lo lee desde el dashboard de Supabase)
create policy "feedback: insertar" on public.feedback for insert with check (auth.uid() = user_id);

-- errores_js: inserta CUALQUIERA, con sesión o sin ella (un error puede pasar
-- en el login). Nadie lee desde el cliente: sin policy de select, solo el dueño
-- lo ve por el panel / service key. `with check (true)` porque no hay dueño de
-- fila que validar — es un buzón, no datos de una cuenta.
create policy "errores: insertar" on public.errores_js for insert with check (true);

-- ejercicios: catálogo de solo lectura, igual para todos
-- Los propios (migración 76): los ve SOLO quien los creó (migración 80; antes también sus amigos).
-- Un huérfano (migración 83) no tiene dueño y no es catálogo: no lo ve nadie.

create policy "ejercicios: catálogo con sesión" on public.ejercicios for select
  using (auth.uid() is not null and ((creado_por is null and not huerfano) or creado_por = auth.uid()));

-- prs: las marcas se ven igual que los logs — el dueño todo, los amigos
-- aceptados leen. El peso CORPORAL sigue afuera, siempre (§16.6).
-- Una marca nueva, solo sobre un ejercicio que se ve (migración 83): el `exists` pasa
-- por la RLS de ejercicios, así que un propio ajeno o huérfano no entra.
create policy "marcas: dueño" on public.prs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.ejercicios e where e.id = ejercicio));
create policy "marcas: amigos leen" on public.prs for select
  using (public.son_amigos(auth.uid(), user_id));

-- sesiones: SOLO el dueño, ni siquiera los amigos (§17.8). Competir por quién
-- pasa más tiempo en el gimnasio empuja a entrenar de más, y tres horas no son
-- mejores que una.
create policy "sesiones: solo dueño" on public.sesiones for select
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- STORAGE: bucket privado de fotos
-- Rutas: fotos/{user_id}/... y avatares/{user_id}/...
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatares', 'avatares', true)
  on conflict (id) do nothing;
-- Tope (migración 89): 3 MB por archivo y solo JPG y PNG. Sin esto aceptaban
-- cualquier cosa de cualquier tamaño.
update storage.buckets
set file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg', 'image/png']
where id in ('fotos', 'avatares');

create policy "fotos storage: dueño" on storage.objects for all
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fotos storage: amigos leen visibles" on storage.objects for select
  using (
    bucket_id = 'fotos'
    and exists (
      select 1 from public.photos p
      -- LA FOTO O SU MINIATURA (migración 63): la miniatura es un archivo al
      -- lado de la entera, con `.mini.jpg` al final. La ve quien ve la foto.
      where (p.storage_path = name or regexp_replace(p.storage_path, '\.jpe?g$', '', 'i') || '.mini.jpg' = name)
        and p.visibilidad = 'amigos'
        -- La fila que da permiso tiene que ser del DUEÑO DE LA CARPETA
        -- (migración 60): sin esto alcanzaba con cualquier fila que nombrara
        -- la ruta, aunque la hubiera anotado otro.
        and (storage.foldername(name))[1] = p.user_id::text
        and public.son_amigos(auth.uid(), p.user_id)
    )
  );

create policy "avatares: dueño escribe" on storage.objects for insert
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatares: dueño actualiza" on storage.objects for update
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
-- Sin esta política, borrar un avatar fallaba EN SILENCIO: con RLS activa
-- "no hay política" es "prohibido", y la API de storage devuelve éxito con
-- cero archivos borrados. Al dar de baja una cuenta el avatar quedaba
-- huérfano en un bucket público, descargable por cualquiera con la URL.
create policy "avatares: dueño borra" on storage.objects for delete
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
-- Leer SOLO la carpeta propia, no el bucket entero. Los avatares se muestran
-- por la URL pública, que al ser bucket público NO consulta la RLS, así que
-- acotar esto no rompe ninguna foto: lo único que necesita listar es
-- eliminar_cuenta, para borrar el avatar antes de dar de baja.
-- Con `using (bucket_id = 'avatares')` a secas, cualquiera con sesión podía
-- pedir el listado completo y quedarse con los ids de todos los usuarios.
create policy "avatares: dueño lista lo suyo" on storage.objects for select
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- -------------------------------------------------------------
-- PERMISOS (capa extra debajo de la RLS)
-- La RLS dice QUÉ filas se tocan; esto dice QUÉ tablas, columnas y funciones.
-- Sin esto, un usuario podría hacer UPDATE de su propia racha_actual
-- (adulterando la tabla de posiciones), el destinatario de una amistad
-- podría reescribir quién la pidió, o el rival de un reto cambiar las fechas.
-- Los triggers y RPCs son security definer (dueño postgres): no los afecta.
--
-- Se parte de cero a propósito y se otorga solo lo necesario, en vez de
-- confiar en los privilegios por defecto del host: así el schema funciona
-- igual en un proyecto nuevo, en una restauración o en un Postgres pelado.
-- `anon` casi no recibe NADA: sin sesión solo se ve la pantalla de entrada. La
-- ÚNICA excepción es insertar en `errores_js` —un error de JS puede tirar en el
-- login, antes de haber entrado, y ese es justo el que hay que poder ver.
-- -------------------------------------------------------------
grant usage on schema public to authenticated, anon;

revoke all on table
  public.profiles, public.logs, public.photos, public.weights,
  public.friendships, public.challenges, public.feedback, public.descansos,
  public.ejercicios, public.prs, public.sesiones, public.errores_js,
  public.bloqueos, public.reportes, public.rutinas
  from anon, authenticated;

-- lectura y escritura mínimas, siempre acotadas después por la RLS
grant select                 on public.profiles     to authenticated;
-- descansos: solo lectura. Se escriben por RPC para que el cambio no pueda
-- fecharse hacia atrás y reescribir el pasado.
grant select                 on public.descansos    to authenticated;
grant select, insert, delete on public.logs         to authenticated;
grant select, insert, delete on public.photos       to authenticated;
grant select                 on public.weights      to authenticated;
grant select, insert, delete on public.friendships  to authenticated;
grant select, insert, delete on public.challenges   to authenticated;
grant insert                 on public.feedback     to authenticated;
-- errores_js: SOLO insert, y para los DOS roles (un error puede pasar sin
-- sesión). Sin select para nadie: el buzón lo lee el dueño por fuera del cliente.
grant insert                 on public.errores_js   to authenticated, anon;
grant select                 on public.usuarios_publicos to authenticated;
-- el catálogo de ejercicios es de solo lectura: lo edita el schema, no la app
grant select                 on public.ejercicios   to authenticated;
-- prs sin update: una marca mal cargada se borra y se vuelve a cargar, igual
-- que un día de racha. Editarla en el lugar dejaría el historial sin rastro.
grant insert, delete         on public.prs          to authenticated;
-- Sin `creado` (migración 87): dice a qué hora se guardó la marca, y los amigos la leían.
grant select (id, user_id, ejercicio, peso, reps, es_real, fecha) on public.prs to authenticated;
-- sesiones de solo lectura: empezar y terminar son RPC, para que nadie se
-- escriba el `inicio` que quiera ni resucite una sesión abandonada
grant select                 on public.sesiones     to authenticated;

-- lo único editable de cada tabla, columna por columna.
-- dias_descanso NO está: es un espejo que mantiene fijar_descansos, y si el
-- cliente pudiera escribirlo se desincronizaría del historial fechado.
-- visibilidad_default y unidad_peso son preferencias del dueño y no afectan a
-- nadie más, así que se escriben directo como username y avatar_url.
grant update (username, avatar_url, visibilidad_default, unidad_peso, sexo,
              duracion_descanso, gimnasio_lat, gimnasio_lon, gimnasio_radio,
              umbral_estancamiento, avisos_estancamiento)
  on public.profiles to authenticated;
grant update (estado)      on public.friendships to authenticated;
grant update (estado)      on public.challenges  to authenticated;
grant update (visibilidad) on public.photos      to authenticated;
-- logs: no se editan nunca (se crean y se borran); el planeta lo pone el trigger
-- weights: se corrigen re-registrando el día vía RPC, no por update directo
-- feedback: no se edita ni se borra, y nadie lo lee desde el cliente

-- Funciones: las que tocan datos de alguien solo para usuarios con sesión.
-- rango_de_racha y planeta_de_dia quedan abiertas: son matemática pura.
revoke execute on function
  public.son_amigos(uuid, uuid),
  public.registrar_dia(text),
  public.verificar_perdida(),
  public.recalcular_desde_cero(),
  public.cerrar_retos_vencidos(),
  public.eliminar_amigo(uuid),
  public.eliminar_cuenta(),
  public.fijar_descansos(int[]),
  public.mi_hoy(),
  public.fijar_zona(text),
  public.mi_fuerza(),
  public.ranking_fuerza(),
  public.fijar_series(uuid, int),
  public.fijar_bloques(uuid, jsonb),
  public.ultimo_ejercicio(),
  public.anotar_peso(numeric),
  public.corregir_peso(date, numeric),
  public.borrar_peso(date),
  public.iniciar_sesion(timestamptz, text),
  public.terminar_sesion(timestamptz),
  public.mi_sesion(),
  public.resumen_sesiones()
  from public, anon;

-- cerrar_sesiones_vencidas toca las sesiones de cualquiera: solo la llaman
-- por dentro las funciones de arriba.
revoke execute on function public.cerrar_sesiones_vencidas(uuid)
  from public, anon, authenticated;

-- Los internos del DOTS calculan con el peso corporal AJENO y no se otorgan a
-- nadie: solo los llaman las funciones de arriba, que devuelven el resultado
-- sin devolver nunca el peso. un_rm y dots quedan abiertas como
-- rango_de_racha: son matemática pura y no tocan datos de nadie.
-- Y las que reciben el id de OTRO y leen por encima de la RLS (migración 41):
-- con los ids públicos, el calendario, los descansos y las vidas de cualquiera
-- se reconstruían llamándolas día por día. Solo las usan otras funciones.
revoke execute on function
  public.calcular_racha(uuid, date),
  public.mejor_racha_real(uuid),
  public.techo_de_mejor_racha(uuid),
  public.descansos_vigentes(uuid, date),
  public.impulsos_ganados(uuid),
  public.impulsos_disponibles(uuid, date),
  public.hoy_de(uuid),
  public.puede_registrar_hoy(uuid),
  public.bloqueo_hasta(uuid),
  public.resolver_pendiente(uuid),
  public.peso_actual(uuid),
  public.mejores_marcas(uuid),
  public.total_dots(uuid),
  public.dots_de(uuid)
  from public, anon, authenticated;

grant execute on function
  public.son_amigos(uuid, uuid),
  public.registrar_dia(text),
  public.verificar_perdida(),
  public.recalcular_desde_cero(),
  public.cerrar_retos_vencidos(),
  public.eliminar_amigo(uuid),
  public.eliminar_cuenta(),
  public.fijar_descansos(int[]),
  public.mi_hoy(),
  public.fijar_zona(text),
  public.mi_fuerza(),
  public.ranking_fuerza(),
  public.fijar_series(uuid, int),
  public.fijar_bloques(uuid, jsonb),
  public.ultimo_ejercicio(),
  public.anotar_peso(numeric),
  public.corregir_peso(date, numeric),
  public.borrar_peso(date),
  public.iniciar_sesion(timestamptz, text),
  public.terminar_sesion(timestamptz),
  public.mi_sesion(),
  public.resumen_sesiones()
  to authenticated;

-- -------------------------------------------------------------
-- AVISOS PUSH (migración 35) — 1. LAS SUSCRIPCIONES
-- -------------------------------------------------------------
-- Una por APARATO, no por cuenta: el mismo usuario puede tener el aviso
-- prendido en el teléfono y apagado en la computadora, y los dos tienen
-- direcciones distintas. Por eso la clave es el `endpoint`, que es la dirección
-- que el servicio de push del navegador le dio a ese aparato.
--
-- `ultimo_aviso` es lo que garantiza "uno por día, nunca dos". El cron de
-- Vercel puede reintentar, y un reintento no puede mandarte el mismo aviso
-- dos veces: la base anota el día ANTES de que se mande.
create table if not exists public.suscripciones_push (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creado timestamptz not null default now(),
  ultimo_aviso date,
  constraint suscripciones_endpoint_https check (endpoint like 'https://%'),
  constraint suscripciones_claves_cortas check (length(p256dh) < 200 and length(auth) < 100)
);

create index if not exists suscripciones_push_por_usuario on public.suscripciones_push (user_id);

alter table public.suscripciones_push enable row level security;

-- El dueño ve las suyas, y nada más. Escribir va por las funciones de abajo:
-- así el `user_id` lo pone la base y no el cliente.
drop policy if exists "suscripciones: solo dueño" on public.suscripciones_push;
create policy "suscripciones: solo dueño" on public.suscripciones_push for select
  using (user_id = auth.uid());

grant select on public.suscripciones_push to authenticated;

-- -------------------------------------------------------------
-- 2. PRENDER Y APAGAR, desde el teléfono
-- -------------------------------------------------------------
-- Guardar es idempotente: prender el aviso dos veces en el mismo aparato
-- actualiza la fila en vez de duplicarla. Y si el aparato estaba a nombre de
-- OTRA cuenta —un teléfono prestado— pasa a ser de la que lo prendió ahora: el
-- aviso le llega a quien tiene el teléfono en la mano.
create or replace function public.guardar_suscripcion_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  insert into suscripciones_push (endpoint, user_id, p256dh, auth)
  values (p_endpoint, uid, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth;
end;
$$;

-- Apagar solo borra lo propio: con el endpoint de otro no hace nada.
create or replace function public.borrar_suscripcion_push(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from suscripciones_push where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.guardar_suscripcion_push(text, text, text) from public, anon;
grant execute on function public.guardar_suscripcion_push(text, text, text) to authenticated;
revoke execute on function public.borrar_suscripcion_push(text) from public, anon;
grant execute on function public.borrar_suscripcion_push(text) to authenticated;

-- -------------------------------------------------------------
-- 3. A QUIÉN AVISARLE HOY — solo para el servidor
-- -------------------------------------------------------------
-- La llama la ruta del cron con la clave de servicio. NO la puede llamar
-- ningún usuario: devuelve direcciones de push de otra gente.
--
-- A QUIÉN SÍ: a quien prendió el aviso, en un día que no registró, que no es
-- de descanso, y que no tiene un día esperando confirmación de la guarda del
-- gimnasio —ese fue, solo que todavía no se sabe—.
--
-- Y la marca: devuelve las filas Y anota `ultimo_aviso = hoy` en la misma
-- sentencia. Si el cron corre dos veces, la segunda no encuentra a nadie.
create or replace function public.tomar_avisos_del_dia()
returns table (endpoint text, p256dh text, auth text, racha int)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidatos as (
    select s.endpoint
      from suscripciones_push s
      join profiles p on p.id = s.user_id
     where (s.ultimo_aviso is null or s.ultimo_aviso < hoy_de(s.user_id))
       and not exists (
         select 1 from logs l where l.user_id = s.user_id and l.fecha = hoy_de(s.user_id)
       )
       and not (extract(dow from hoy_de(s.user_id))::int = any(descansos_vigentes(s.user_id, hoy_de(s.user_id))))
       and (p.dia_pendiente is null or p.dia_pendiente <> hoy_de(s.user_id))
  )
  update suscripciones_push s
     set ultimo_aviso = hoy_de(s.user_id)
    from candidatos c, profiles p
   where s.endpoint = c.endpoint and p.id = s.user_id
  returning s.endpoint, s.p256dh, s.auth, p.racha_actual;
end;
$$;

-- El servicio de push dice que esa dirección ya no existe —desinstalaron la
-- app, borraron los datos, revocaron el permiso—: se borra, para no
-- intentarlo todos los días para siempre.
create or replace function public.olvidar_suscripcion_push(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from suscripciones_push where endpoint = p_endpoint;
$$;

revoke execute on function public.tomar_avisos_del_dia() from public, anon, authenticated;
grant execute on function public.tomar_avisos_del_dia() to service_role;
revoke execute on function public.olvidar_suscripcion_push(text) from public, anon, authenticated;
grant execute on function public.olvidar_suscripcion_push(text) to service_role;

-- LA VERSIÓN DEL ESQUEMA (migración 37). Cada migración la reescribe con su número.
-- ---------------------------------------------------------------
-- MEDALLAS POR MARCA (migración 46)
-- ---------------------------------------------------------------
-- El percentil de una medalla se calcula con la mejor marca, el peso
-- corporal y el sexo, y el peso corporal de otra persona NO SE VE NUNCA, ni
-- entre amigos (§16.7). Así que lo calcula el dueño y lo deja escrito acá;
-- el amigo lee el número ya derivado y nunca el peso.
--
-- SE GUARDA EL PERCENTIL Y NADA MÁS: el material y la regla de la galaxia se
-- derivan de él en `nucleo/medallas.ts`, que es de las dos apps. Guardar el
-- material además sería la misma verdad dos veces, con dos formas de
-- contradecirse.
create table if not exists public.medallas (
  user_id   uuid not null references auth.users(id) on delete cascade,
  ejercicio text not null,
  percentil smallint not null check (percentil between 1 and 99),
  actualizado timestamptz not null default now(),
  primary key (user_id, ejercicio)
);

alter table public.medallas enable row level security;

drop policy if exists "medallas: leer" on public.medallas;
create policy "medallas: leer" on public.medallas for select
  using (auth.uid() = user_id or public.son_amigos(auth.uid(), user_id));

drop policy if exists "medallas: escribir" on public.medallas;
create policy "medallas: escribir" on public.medallas for insert
  with check (auth.uid() = user_id);

drop policy if exists "medallas: actualizar" on public.medallas;
create policy "medallas: actualizar" on public.medallas for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "medallas: borrar" on public.medallas;
create policy "medallas: borrar" on public.medallas for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.medallas to authenticated;

create or replace function public.medallas_de(p_user uuid)
returns table (ejercicio text, percentil smallint)
language sql
stable
security invoker
set search_path = public
as $$
  select m.ejercicio, m.percentil
    from public.medallas m
   where m.user_id = p_user
$$;

grant execute on function public.medallas_de(uuid) to authenticated;

-- Las medallas de varios amigos en una sola consulta (migración 52). Misma
-- seguridad que `medallas_de`: `security invoker`, la RLS de `medallas` filtra a
-- las propias y las de los amigos, así que un id ajeno en la lista no da nada.
create or replace function public.medallas_de_muchos(p_users uuid[])
returns table (user_id uuid, ejercicio text, percentil smallint)
language sql
stable
security invoker
set search_path = public
as $$
  select m.user_id, m.ejercicio, m.percentil
    from public.medallas m
   where m.user_id = any(p_users)
$$;

grant execute on function public.medallas_de_muchos(uuid[]) to authenticated;

-- -------------------------------------------------------------
-- AVISOS PUSH DE LA APP (migración 77): enterarse afuera de la app
-- -------------------------------------------------------------
-- Cuando alguien te quiere agregar o quiere unirse a tu entrenamiento, el
-- teléfono avisa aunque la app esté cerrada. El aviso lo manda la BASE, al
-- crearse el pedido, a través de Expo: no hay servidor en el medio.
--
-- Un token por APARATO (el de Expo). Si el teléfono pasa a otra cuenta, el token
-- se muda: los avisos de la anterior dejan de llegar ahí.

-- `pg_net` es lo que deja a Postgres hacer un pedido HTTP. Si no se puede
-- prender, la migración sigue: los pedidos se crean igual y el aviso no sale.
do $pgnet$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'Sin pg_net: los avisos push no van a salir (%).', sqlerrm;
end $pgnet$;

create table if not exists public.tokens_push (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- En qué idioma se le escribe (el del teléfono, o el que eligió en Ajustes).
  idioma text not null default 'es',
  actualizado timestamptz not null default now(),
  constraint tokens_push_forma check (token like 'ExponentPushToken[%]' and length(token) < 200),
  constraint tokens_push_idioma check (idioma in ('es', 'en'))
);
create index if not exists tokens_push_de on public.tokens_push (user_id);
alter table public.tokens_push enable row level security;
revoke all on table public.tokens_push from anon, authenticated;

create or replace function public.guardar_token_push(p_token text, p_idioma text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  insert into tokens_push (token, user_id, idioma)
       values (p_token, uid, case when p_idioma = 'en' then 'en' else 'es' end)
  on conflict (token) do update
     set user_id = excluded.user_id, idioma = excluded.idioma, actualizado = now();
  -- Diez aparatos por cuenta alcanzan; los más viejos se olvidan.
  delete from tokens_push
   where user_id = uid
     and token not in (select token from tokens_push where user_id = uid order by actualizado desc limit 10);
end;
$$;

-- Al cerrar sesión. Solo borra lo propio.
create or replace function public.borrar_token_push(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from tokens_push where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.guardar_token_push(text, text), public.borrar_token_push(text) from public, anon;
grant execute on function public.guardar_token_push(text, text), public.borrar_token_push(text) to authenticated;

-- MANDAR. Nunca frena lo que lo disparó: un aviso que no sale no puede
-- impedir que se cree una solicitud.
create or replace function public.mandar_push(p_a uuid, p_es text, p_en text, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  mensajes jsonb;
begin
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return; end if;
  select jsonb_agg(jsonb_build_object(
           'to', t.token, 'title', 'Ascent', 'body', case when t.idioma = 'en' then p_en else p_es end,
           'data', p_datos, 'sound', 'default'))
    into mensajes
    from tokens_push t
   where t.user_id = p_a;
  if mensajes is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using 'https://exp.host/--/api/v2/push/send', mensajes,
          '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
exception when others then
  raise warning 'aviso push: %', sqlerrm;
end;
$$;
revoke execute on function public.mandar_push(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.avisar_pedido_de_amistad()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quien text;
begin
  if new.estado <> 'pendiente' then return new; end if;
  select username into quien from profiles where id = new.solicitante;
  perform mandar_push(new.destinatario,
    coalesce(quien, 'Alguien') || ' te quiere agregar.',
    coalesce(quien, 'Someone') || ' wants to add you.',
    jsonb_build_object('aviso', 'amistad'));
  return new;
end;
$$;
drop trigger if exists friendships_avisar on public.friendships;
create trigger friendships_avisar after insert on public.friendships
  for each row execute function public.avisar_pedido_de_amistad();

create or replace function public.avisar_pedido_de_union()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quien text;
begin
  if new.estado <> 'pendiente' then return new; end if;
  select username into quien from profiles where id = new.solicitante;
  perform mandar_push(new.destinatario,
    coalesce(quien, 'Alguien') || ' quiere unirse a tu entrenamiento.',
    coalesce(quien, 'Someone') || ' wants to join your workout.',
    jsonb_build_object('aviso', 'union'));
  return new;
end;
$$;
drop trigger if exists entrenos_avisar on public.entrenos_compartidos;
create trigger entrenos_avisar after insert on public.entrenos_compartidos
  for each row execute function public.avisar_pedido_de_union();

revoke execute on function public.avisar_pedido_de_amistad(), public.avisar_pedido_de_union() from public, anon, authenticated;

-- ¿Salen los avisos? Para comprobarlo después de pegar esta migración, sin mirar nada más.
create or replace function public.avisos_push_listos()
returns boolean language sql stable security definer set search_path = public as $$
  select to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null;
$$;
revoke execute on function public.avisos_push_listos() from public;
grant execute on function public.avisos_push_listos() to anon, authenticated;

-- -------------------------------------------------------------
-- LOS AMIGOS DE UN AMIGO (migración 78)
-- -------------------------------------------------------------
-- En el perfil de un amigo se ven sus amigos, y se toca para entrar al perfil
-- de cada uno (pedido del 14/10). Devuelve solo los ids: quién es cada uno lo
-- dice `usuarios_publicos`, que ya saca a los bloqueados en los dos sentidos.
-- De un extraño no se ve nada: la amistad de dos personas que no conocés no es
-- asunto tuyo (por eso `son_amigos` solo contesta sobre una amistad propia).
create or replace function public.amigos_de(p_quien uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select case when f.solicitante = p_quien then f.destinatario else f.solicitante end
    from friendships f
   where auth.uid() is not null
     and (p_quien = auth.uid() or public.son_amigos(auth.uid(), p_quien))
     and f.estado = 'aceptada'
     and p_quien in (f.solicitante, f.destinatario);
$$;
revoke execute on function public.amigos_de(uuid) from public, anon;
grant execute on function public.amigos_de(uuid) to authenticated;

-- EL CORAZÓN EN LAS RUTINAS (migración 92): cuántos tiene es público; quién lo dio no se
-- lee nunca. Todo pasa por las funciones.
create table if not exists public.me_gusta_rutinas (
  rutina_id uuid not null references public.rutinas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (rutina_id, user_id)
);
-- Para borrar la cuenta sin recorrer la tabla entera.
create index if not exists me_gusta_rutinas_usuario on public.me_gusta_rutinas (user_id);
alter table public.me_gusta_rutinas enable row level security;
revoke all on public.me_gusta_rutinas from anon, authenticated;

-- La regla de `rutina_activa_de`, para una rutina por su id.
create or replace function public.puedo_ver_rutina(p_rutina uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from rutinas r
      join profiles p on p.id = r.user_id
     where r.id = p_rutina
       and (r.user_id = auth.uid()
            or (r.activa and p.comparte_rutina and public.son_amigos(auth.uid(), r.user_id)))
  );
$$;
revoke execute on function public.puedo_ver_rutina(uuid) from public, anon;
grant execute on function public.puedo_ver_rutina(uuid) to authenticated;

-- Cuántos corazones tiene una rutina (público) y si uno es de quien pregunta.
create or replace function public.me_gusta_de_rutina(p_rutina uuid)
returns table (cantidad int, mio boolean)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from me_gusta_rutinas m where m.rutina_id = p_rutina),
         exists (select 1 from me_gusta_rutinas m where m.rutina_id = p_rutina and m.user_id = auth.uid())
   where auth.uid() is not null;
$$;
revoke execute on function public.me_gusta_de_rutina(uuid) from public, anon;
grant execute on function public.me_gusta_de_rutina(uuid) to authenticated;

-- Dar o sacar el corazón, diciendo cuál de las dos: la pantalla manda lo contrario de lo
-- que ve, y dos toques seguidos con el mismo pedido dejan lo mismo. Devuelve cómo quedó.
create or replace function public.marcar_me_gusta_rutina(p_rutina uuid, p_mio boolean)
returns table (cantidad int, mio boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.puedo_ver_rutina(p_rutina)
     or exists (select 1 from rutinas r where r.id = p_rutina and r.user_id = auth.uid()) then
    raise exception 'No se puede dar corazón a esta rutina.' using errcode = '42501';
  end if;
  if p_mio then
    insert into me_gusta_rutinas (rutina_id, user_id) values (p_rutina, auth.uid()) on conflict do nothing;
  else
    delete from me_gusta_rutinas m where m.rutina_id = p_rutina and m.user_id = auth.uid();
  end if;
  return query select * from public.me_gusta_de_rutina(p_rutina);
end;
$$;
revoke execute on function public.marcar_me_gusta_rutina(uuid, boolean) from public, anon;
grant execute on function public.marcar_me_gusta_rutina(uuid, boolean) to authenticated;

create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 92; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
