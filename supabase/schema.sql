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

-- Catálogo de ejercicios. Es grande a propósito (§16.3): el usuario anota lo
-- que quiera. Pero al total DOTS entran SOLO los tres marcados con
-- cuenta_dots: la fórmula está calibrada sobre esos tres y sumarle otros no
-- la hace más completa, la invalida.
create table public.ejercicios (
  id text primary key,
  nombre text not null,
  grupo text not null,
  cuenta_dots boolean not null default false,
  orden int not null default 0
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
  ('aperturas',         'Aperturas',               'pecho',   false, 230),
  ('fondos',            'Fondos',                  'pecho',   false, 240),
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
  ('rueda_abdominal',   'Rueda abdominal',         'core',    false, 620)
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
begin
  if uid is null or p_zona is null then return; end if;
  -- Texto libre no: una zona inventada haría que `at time zone` reviente en
  -- cada consulta de fecha, o peor, que caiga en algo que no es la del
  -- usuario. Se comprueba contra la tabla de zonas de Postgres.
  if not exists (select 1 from pg_timezone_names where name = p_zona) then
    raise exception 'zona horaria desconocida: %', p_zona;
  end if;
  select zona into actual from profiles where id = uid;
  if actual is distinct from p_zona then
    update profiles set zona = p_zona, zona_cambiada = now() where id = uid;
  end if;
end;
$$;

create or replace function public.bloqueo_hasta(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(l.creado) + interval '20 hours'
    from logs l, profiles p
   where l.user_id = p_user and p.id = p_user
     and p.zona_cambiada is not null
     and l.creado > p.zona_cambiada - interval '20 hours'
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

-- Cada rango dura diez días; al 8 (agujero negro) se llega y se queda.
-- Rango 4 = rachas 30..39: Ceres..Júpiter, uno por día.
create or replace function public.rango_de_racha(r int)
returns int language sql immutable as $$
  select least(8, greatest(0, r) / 10 + 1);
$$;

create or replace function public.planeta_de_dia(r int)
returns text language sql immutable as $$
  select (array['Ceres','Plutón','Mercurio','Marte','Venus','Tierra','Neptuno','Urano','Saturno','Júpiter'])[r - 29];
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
      d := anterior + 1;
      while d < r.fecha loop
        if not (extract(dow from d)::int = any(descansos_vigentes(p_user, d))) then
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
  select * into perfil from profiles where id = new.user_id;
  if not new.es_descanso then
    r := perfil.racha_base + calcular_racha(new.user_id, new.fecha - 1) + 1;
    if r between 30 and 39 then
      new.planeta_del_dia := planeta_de_dia(r);
    end if;
  end if;
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
    -- el máximo sale del historial: si se borran días, baja
    mejor_racha = greatest(mejor_racha_real(uid), r),
    rango_actual = rango_de_racha(r)
  where id = uid;

  -- El planeta de un día depende de la racha que corría ESE día. Al corregir
  -- un día viejo a mano, los posteriores cambian de racha y su planeta queda
  -- viejo: el álbum mostraría la secuencia corrida. Se recalculan los días
  -- desde el que cambió en adelante.
  -- pg_trigger_depth() corta la recursión de este mismo update, y el
  -- "is distinct from" evita escrituras que no cambian nada.
  if pg_trigger_depth() = 1 then
    update logs l set planeta_del_dia = c.nuevo
      from (
        select id, case when r2 between 30 and 39 then planeta_de_dia(r2) else null end as nuevo
          from (
            select x.id, base + calcular_racha(uid, x.fecha) as r2
              from logs x
             where x.user_id = uid and not x.es_descanso and x.fecha >= desde
          ) t
      ) c
     where l.id = c.id and l.planeta_del_dia is distinct from c.nuevo;
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
create or replace function public.verificar_perdida()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  perfil profiles;
  viva int;
  nuevo_rango int;
  nueva_racha int;
  hoy date := mi_hoy();
  resuelto date;
begin
  -- primero el pendiente: si se registrara después, el día contaría recién
  -- mañana y la racha se podría cortar por un día que la persona sí entrenó
  resuelto := resolver_pendiente(uid);

  select * into perfil from profiles where id = uid;
  if perfil.id is null or perfil.racha_actual = 0 then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  if exists (select 1 from logs where user_id = uid and fecha = hoy) then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  viva := perfil.racha_base + calcular_racha(uid, hoy - 1);
  if viva >= perfil.racha_actual then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  nueva_racha := greatest(0, perfil.racha_actual - 10);
  nuevo_rango := rango_de_racha(nueva_racha);
  update profiles set
    racha_actual = nueva_racha,
    racha_base = nueva_racha,
    rango_actual = nuevo_rango,
    perdida_fecha = hoy - 1
  where id = uid;
  return jsonb_build_object('perdida', true, 'rango_anterior', perfil.rango_actual,
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha, 'pendiente_resuelto', resuelto);
end;
$$;

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
    mejor_racha = greatest(mejor_racha_real(uid), r),
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

-- La banda es lo ÚNICO que ve alguien que no sea el dueño (§16.7b). El DOTS
-- exacto al lado de un total conocido permite despejar el peso corporal con
-- una cuenta de dos líneas; la banda deja el dato en un intervalo demasiado
-- ancho para que sirva.
create or replace function public.banda_dots(p_dots numeric)
returns text language sql immutable as $$
  select case
    when p_dots is null then null
    when p_dots < 200 then 'menos de 200'
    when p_dots >= 600 then '600 o más'
    else (floor(p_dots / 50) * 50)::int || '–' || (floor(p_dots / 50) * 50 + 50)::int
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
    'banda', banda_dots(d),
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

-- Ranking entre amigos. Sale el total (los levantamientos ya los ven los
-- amigos) y la BANDA; el número exacto solo en la fila propia.
--
-- Ordena por DOTS exacto aunque muestre bandas: el orden filtra algo que la
-- banda oculta, y está aceptado a propósito (§16.7b) porque entre amigos el
-- peso corporal no es un secreto. Si alguna vez deja de valer, la salida es
-- ordenar por banda y mostrar los empates como empates.
create or replace function public.ranking_fuerza()
returns table (
  id uuid,
  username text,
  avatar_url text,
  total numeric,
  banda text,
  dots_propio numeric,
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
  select c.id, c.username, c.avatar_url, c.total, banda_dots(c.d),
         case when c.id = auth.uid() then c.d end,
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

-- -------------------------------------------------------------
-- Los dos números del cronómetro, en un solo lugar
--
-- Están también en `src/lib/reglas.ts`, porque la pantalla necesita las
-- mismas cuentas. La sección 26 de test:db compara las dos copias.
-- -------------------------------------------------------------

-- A las 4 horas la sesión se cierra sola y queda SIN duración (§17.3).
create or replace function public.tope_sesion()
returns interval language sql immutable as $$ select interval '4 hours' $$;

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
  update sesiones set estado = 'abandonada'
   where user_id = p_user and estado = 'corriendo' and now() - inicio >= tope_sesion();
$$;

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

  -- Ni en el futuro ni más atrás de lo permitido. `least` de `now()` primero
  -- porque un reloj adelantado en el teléfono es mucho más común que uno
  -- atrasado, y un inicio en el futuro daría duraciones negativas.
  arranque := least(now(), greatest(coalesce(p_desde, now()), now() - atraso_maximo()));

  select id into l from logs where user_id = uid and fecha = hoy;
  if l is null then
    registro := registrar_dia(p_origen);
    if (registro ->> 'bloqueado')::boolean then
      return registro;
    end if;
    l := (registro ->> 'log_id')::uuid;
  end if;
  insert into sesiones (user_id, log_id, inicio, origen, creo_el_dia)
    values (uid, l, arranque, p_origen, registro is not null)
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
  -- primero se cierran las vencidas: si pasaron 4 horas, esta llamada llega
  -- tarde y la sesión ya no tiene duración
  perform cerrar_sesiones_vencidas(uid);

  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is null then
    return jsonb_build_object('termino', false);
  end if;

  -- Nunca antes del inicio —eso daría duración negativa— ni después de ahora.
  cierre := least(now(), greatest(coalesce(p_hasta, now()), s.inicio));

  update sesiones set estado = 'terminada', fin = cierre
   where id = s.id
   returning * into s;

  -- EL TOQUE ACCIDENTAL. Tres condiciones y las tres tienen que darse:
  --   1. no llegó al piso de 5 minutos → no hubo entrenamiento;
  --   2. el día lo creó ESTA sesión    → no lo registró nadie más;
  --   3. no hay otra sesión ese día    → no entrenaste en otro momento.
  --
  -- Se borra el log y no la sesión: la cascada de `sesiones.log_id` se lleva la
  -- sesión sola, y el trigger de `logs` recalcula la racha. Las fotos NO se
  -- pierden: su `log_id` es `on delete set null`.
  if (s.fin - s.inicio) < piso_sesion()
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
    -- abajo del piso la sesión existe y el día cuenta, pero no suma duración
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


create or replace function public.mi_sesion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
begin
  if uid is null then return null; end if;
  perform cerrar_sesiones_vencidas(uid);
  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is null then
    return jsonb_build_object('corriendo', false, 'ahora', now());
  end if;
  return jsonb_build_object(
    'corriendo', true,
    'id', s.id,
    'inicio', s.inicio,
    -- el cliente lo necesita para decidir si al salir de la zona la cierra
    'origen', s.origen,
    'ahora', now(),
    'series', s.series,
    'tope_segundos', extract(epoch from tope_sesion())
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
  select 'catálogo de ejercicios',
         count(*) || ' ejercicios ' ||
         huella(string_agg(id || ' ' || nombre || ' ' || grupo || ' ' ||
                           cuenta_dots || ' ' || orden, '|' order by id))
    from ejercicios
$$;

revoke execute on function public.retrato_del_schema() from public;
grant execute on function public.retrato_del_schema() to authenticated;

-- -------------------------------------------------------------
-- BÚSQUEDA PÚBLICA: vista que expone SOLO lo mínimo.
-- La tabla profiles completa nunca se abre.
-- -------------------------------------------------------------
create view public.usuarios_publicos
with (security_invoker = off) as
  select id, username, avatar_url, racha_actual, rango_actual
  from public.profiles
  where username is not null;

grant select on public.usuarios_publicos to authenticated;

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

-- ¿Somos amigos aceptados? (contempla ambos sentidos)
create or replace function public.son_amigos(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where estado = 'aceptada'
      and ((solicitante = a and destinatario = b) or (solicitante = b and destinatario = a))
  );
$$;

-- profiles: solo el dueño (lo público sale por la vista)
create policy "perfil propio: leer" on public.profiles for select using (auth.uid() = id);
create policy "perfil propio: editar" on public.profiles for update using (auth.uid() = id);

-- descansos: el dueño los lee; escribirlos es tarea exclusiva del RPC,
-- que es el que garantiza que el cambio rija desde hoy y no hacia atrás
create policy "descansos: leer los propios" on public.descansos for select using (auth.uid() = user_id);

-- logs: dueño todo; amigos aceptados leen
create policy "logs: dueño" on public.logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "logs: amigos leen" on public.logs for select using (public.son_amigos(auth.uid(), user_id));

-- photos: dueño todo; amigos leen solo las visibles
create policy "fotos: dueño" on public.photos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fotos: amigos leen visibles" on public.photos for select
  using (visibilidad = 'amigos' and public.son_amigos(auth.uid(), user_id));

-- weights: SOLO el dueño, sin excepción
create policy "peso: solo dueño" on public.weights for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- friendships: las dos puntas leen; el solicitante crea; el destinatario acepta; cualquiera de los dos borra
create policy "amistad: leer" on public.friendships for select
  using (auth.uid() = solicitante or auth.uid() = destinatario);
create policy "amistad: pedir" on public.friendships for insert
  with check (auth.uid() = solicitante and estado = 'pendiente');
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

-- ejercicios: catálogo de solo lectura, igual para todos
create policy "ejercicios: catálogo con sesión" on public.ejercicios for select
  using (auth.uid() is not null);

-- prs: las marcas se ven igual que los logs — el dueño todo, los amigos
-- aceptados leen. El peso CORPORAL sigue afuera, siempre (§16.6).
create policy "marcas: dueño" on public.prs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
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

create policy "fotos storage: dueño" on storage.objects for all
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fotos storage: amigos leen visibles" on storage.objects for select
  using (
    bucket_id = 'fotos'
    and exists (
      select 1 from public.photos p
      where p.storage_path = name
        and p.visibilidad = 'amigos'
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
-- `anon` no recibe NADA: sin sesión solo se ve la pantalla de entrada.
-- -------------------------------------------------------------
grant usage on schema public to authenticated, anon;

revoke all on table
  public.profiles, public.logs, public.photos, public.weights,
  public.friendships, public.challenges, public.feedback, public.descansos,
  public.ejercicios, public.prs, public.sesiones
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
grant select                 on public.usuarios_publicos to authenticated;
-- el catálogo de ejercicios es de solo lectura: lo edita el schema, no la app
grant select                 on public.ejercicios   to authenticated;
-- prs sin update: una marca mal cargada se borra y se vuelve a cargar, igual
-- que un día de racha. Editarla en el lugar dejaría el historial sin rastro.
grant select, insert, delete on public.prs          to authenticated;
-- sesiones de solo lectura: empezar y terminar son RPC, para que nadie se
-- escriba el `inicio` que quiera ni resucite una sesión abandonada
grant select                 on public.sesiones     to authenticated;

-- lo único editable de cada tabla, columna por columna.
-- dias_descanso NO está: es un espejo que mantiene fijar_descansos, y si el
-- cliente pudiera escribirlo se desincronizaría del historial fechado.
-- visibilidad_default y unidad_peso son preferencias del dueño y no afectan a
-- nadie más, así que se escriben directo como username y avatar_url.
grant update (username, avatar_url, visibilidad_default, unidad_peso, sexo,
              duracion_descanso, gimnasio_lat, gimnasio_lon, gimnasio_radio)
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
  public.calcular_racha(uuid, date),
  public.mejor_racha_real(uuid),
  public.descansos_vigentes(uuid, date),
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
  public.anotar_peso(numeric),
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
-- sin devolver nunca el peso. un_rm, dots y banda_dots quedan abiertas como
-- rango_de_racha: son matemática pura y no tocan datos de nadie.
revoke execute on function
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
  public.calcular_racha(uuid, date),
  public.mejor_racha_real(uuid),
  public.descansos_vigentes(uuid, date),
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
  public.anotar_peso(numeric),
  public.iniciar_sesion(timestamptz, text),
  public.terminar_sesion(timestamptz),
  public.mi_sesion(),
  public.resumen_sesiones()
  to authenticated;
