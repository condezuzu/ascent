-- =============================================================
-- ÓRBITA — schema completo (tablas + triggers + RLS + storage)
-- Ejecutar entero en el SQL Editor de Supabase (una sola vez).
-- =============================================================

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
  -- current_date + 1 y no current_date: el servidor está en UTC y el usuario
  -- en UTC-3; a la noche uruguaya "hoy" local ya es "mañana" en el servidor.
  fecha date not null check (fecha <= current_date + 1),
  es_descanso boolean not null default false,
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
  fecha date not null check (fecha <= current_date + 1),
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
  fecha date not null check (fecha <= current_date + 1),
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
create or replace function public.fijar_descansos(p_dias int[], p_hoy date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio int[] := coalesce(p_dias, '{}'::int[]);
begin
  if uid is null then return; end if;
  if p_hoy > current_date + 1 or p_hoy < current_date - 1 then p_hoy := current_date; end if;
  if exists (select 1 from unnest(limpio) x where x < 0 or x > 6) then
    raise exception 'día de semana inválido';
  end if;
  insert into descansos (user_id, desde, dias) values (uid, p_hoy, limpio)
    on conflict (user_id, desde) do update set dias = excluded.dias;
  -- espejo para la interfaz
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
create or replace function public.verificar_perdida(p_hoy date default current_date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  perfil profiles;
  viva int;
  nuevo_rango int;
  nueva_racha int;
begin
  -- el cliente no puede correr la fecha más que la ventana de huso horario
  if p_hoy > current_date + 1 or p_hoy < current_date - 1 then
    p_hoy := current_date;
  end if;
  select * into perfil from profiles where id = uid;
  if perfil.id is null or perfil.racha_actual = 0 then
    return jsonb_build_object('perdida', false);
  end if;
  -- ¿Hoy ya registró? Entonces está viva sí o sí.
  if exists (select 1 from logs where user_id = uid and fecha = p_hoy) then
    return jsonb_build_object('perdida', false);
  end if;
  -- La racha se evalúa hasta ayer: hoy todavía se puede registrar.
  viva := perfil.racha_base + calcular_racha(uid, p_hoy - 1);
  if viva >= perfil.racha_actual then
    return jsonb_build_object('perdida', false);
  end if;
  -- Se rompió: restar 10 días. Como un rango son exactamente 10 días,
  -- restar 10 baja un rango justo, con la misma fórmula para los ocho.
  -- Llega a 0 solo si todavía no completó ningún rango.
  nueva_racha := greatest(0, perfil.racha_actual - 10);
  nuevo_rango := rango_de_racha(nueva_racha);
  -- racha_base guarda los días que sobreviven y perdida_fecha sella los logs
  -- que los produjeron, para que calcular_racha no los vuelva a sumar encima.
  -- Segundo corte sin haber vuelto: viva == racha_base == racha_actual, así
  -- que no entra acá. Se resta una sola vez por corte, no por día ausente.
  update profiles set
    racha_actual = nueva_racha,
    racha_base = nueva_racha,
    rango_actual = nuevo_rango,
    perdida_fecha = p_hoy - 1
  where id = uid;
  return jsonb_build_object('perdida', true, 'rango_anterior', perfil.rango_actual,
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha);
end;
$$;

-- Corrección manual: recalcular todo desde los logs, sin piso de misericordia,
-- y aplicar la pérdida en la MISMA transacción. Devuelve el número final:
-- el usuario nunca puede ver una racha que después baja sola al recargar.
create or replace function public.recalcular_desde_cero(p_hoy date default current_date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hasta date;
  r int;
  perdida jsonb;
  perfil profiles;
begin
  select coalesce(max(fecha), current_date) into hasta from logs where user_id = uid;
  update profiles set racha_base = 0, perdida_fecha = null where id = uid;
  r := calcular_racha(uid, hasta);
  update profiles set
    racha_actual = r,
    -- el máximo sale del historial: si se borran días, baja
    mejor_racha = greatest(mejor_racha_real(uid), r),
    rango_actual = rango_de_racha(r)
  where id = uid;
  -- Si el historial recalculado ya está cortado, la regla de -10 se aplica
  -- acá y no en la próxima carga. Es idempotente: recalcular dos veces da lo
  -- mismo, porque el -10 se resta sobre la racha real del historial.
  perdida := verificar_perdida(p_hoy);
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
create or replace function public.registrar_dia(p_fecha date, p_es_descanso boolean default false, p_peso numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rango_antes int;
  perfil profiles;
  nuevo_log logs;
begin
  -- current_date + 1 por el huso horario (servidor UTC, usuario UTC-3)
  if p_fecha > current_date + 1 then
    raise exception 'No se puede registrar un día futuro';
  end if;
  select rango_actual into rango_antes from profiles where id = uid;
  insert into logs (user_id, fecha, es_descanso) values (uid, p_fecha, p_es_descanso)
    returning * into nuevo_log;
  if p_peso is not null then
    insert into weights (user_id, fecha, valor) values (uid, p_fecha, p_peso)
      on conflict (user_id, fecha) do update set valor = excluded.valor;
  end if;
  select * into perfil from profiles where id = uid;
  return jsonb_build_object(
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
create or replace function public.cerrar_retos_vencidos(p_hoy date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  reto record;
  dias_retador int;
  dias_rival int;
begin
  if p_hoy > current_date + 1 or p_hoy < current_date - 1 then
    p_hoy := current_date;
  end if;
  for reto in
    select * from challenges
    where estado = 'activo' and hasta < p_hoy
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
-- valga inflar la marca, y no hay forma de verificar un PR desde una app.
create or replace function public.percentil_fuerza()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  mio numeric;
  cuantos int;
  arriba int;
begin
  if auth.uid() is null then return null; end if;
  mio := dots_de(auth.uid());
  if mio is null then return jsonb_build_object('percentil', null, 'gente', 0); end if;
  select count(*), count(*) filter (where t.d > mio)
    into cuantos, arriba
    from (select dots_de(p.id) as d from profiles p) t
   where t.d is not null;
  -- Con poca gente el percentil ES un podio disfrazado: entre tres, "el 33%
  -- más fuerte" significa "sos el primero", que es exactamente lo que el
  -- percentil venía a evitar. Hasta que haya gente, no hay percentil.
  if cuantos < 10 then
    return jsonb_build_object('percentil', null, 'gente', cuantos);
  end if;
  return jsonb_build_object(
    'percentil', greatest(1, ceil(100.0 * arriba / cuantos))::int,
    'gente', cuantos
  );
end;
$$;

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
create or replace function public.anotar_peso(p_fecha date, p_valor numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  -- el cliente manda su fecha local; el servidor está en UTC y solo tolera la
  -- ventana de huso horario, ni un día más
  if p_fecha > current_date + 1 or p_fecha < current_date - 1 then
    p_fecha := current_date;
  end if;
  insert into weights (user_id, fecha, valor) values (uid, p_fecha, p_valor)
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
create or replace function public.iniciar_sesion(p_hoy date default current_date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l uuid;
  registro jsonb := null;
  s sesiones;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_hoy > current_date + 1 or p_hoy < current_date - 1 then p_hoy := current_date; end if;

  perform cerrar_sesiones_vencidas(uid);
  -- Si quedaba otra corriendo, se abandona: no sabemos cuándo terminó, así
  -- que no puede quedar con duración. Terminarla en `now()` sería inventar.
  update sesiones set estado = 'abandonada' where user_id = uid and estado = 'corriendo';

  select id into l from logs where user_id = uid and fecha = p_hoy;
  if l is null then
    -- se reusa registrar_dia y no un insert suelto para que la subida de
    -- rango y el recálculo de racha pasen por el mismo camino de siempre
    registro := registrar_dia(p_hoy, false, null);
    l := (registro ->> 'log_id')::uuid;
  end if;

  insert into sesiones (user_id, log_id) values (uid, l) returning * into s;
  return jsonb_build_object(
    'id', s.id,
    'inicio', s.inicio,
    -- el ahora del SERVIDOR, para que el cliente saque el desfasaje de su
    -- propio reloj una sola vez y el cronómetro no se vea corrido (§17.5)
    'ahora', now(),
    'registro', registro -- null si el día ya estaba registrado
  );
end;
$$;

-- -------------------------------------------------------------
-- Terminar
-- -------------------------------------------------------------
create or replace function public.terminar_sesion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  -- primero se cierran las vencidas: si pasaron 4 horas, esta llamada llega
  -- tarde y la sesión ya no tiene duración
  perform cerrar_sesiones_vencidas(uid);

  update sesiones set estado = 'terminada', fin = now()
   where user_id = uid and estado = 'corriendo'
   returning * into s;

  if s.id is null then
    return jsonb_build_object('termino', false);
  end if;
  return jsonb_build_object(
    'termino', true,
    'segundos', extract(epoch from (s.fin - s.inicio)),
    -- abajo del piso la sesión existe y el día cuenta, pero no suma duración
    'cuenta', (s.fin - s.inicio) >= piso_sesion()
  );
end;
$$;

-- -------------------------------------------------------------
-- La sesión que está corriendo, si hay
-- -------------------------------------------------------------
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
    'ahora', now(),
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
-- HERRAMIENTA DE REVISIÓN (solo la cuenta del dueño)
-- -------------------------------------------------------------

-- Herramienta de revisión: ponerse en cualquier racha para mirar los colores
-- y el objeto de fondo de cada rango sin tener que entrenar ochenta días.
--
-- El candado es SERVIDOR, no interfaz. Esconder el botón en el cliente no
-- protege nada: cualquiera puede llamar al RPC desde la consola. El nombre de
-- usuario se comprueba acá adentro, así que desde otra cuenta la llamada
-- falla aunque alguien la descubra.
--
-- No hay una tabla de administradores porque hay un solo administrador y
-- nunca hubo otro: una tabla para una fila es más superficie para el mismo
-- resultado. Si algún día hay dos, esto se cambia por esa tabla.
create or replace function public.simular_racha(p_racha int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  quien text;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  select username into quien from profiles where id = uid;
  if quien is distinct from 'condeeladmin' then
    raise exception 'esta cuenta no puede simular rachas';
  end if;
  if p_racha < 0 or p_racha > 999 then
    raise exception 'racha fuera de rango';
  end if;

  -- Va a racha_base y no solo a racha_actual: racha_base es lo que sobrevive
  -- al próximo recálculo. Si se escribiera solo racha_actual, el primer
  -- trigger de logs lo pisaría y la simulación duraría hasta el próximo día
  -- registrado.
  update profiles set
    racha_base = p_racha,
    racha_actual = p_racha,
    rango_actual = rango_de_racha(p_racha),
    -- Sella los días anteriores: ya están representados por racha_base y sin
    -- esto calcular_racha los sumaría encima (§12). Va en AYER y no en hoy a
    -- propósito: con hoy sellado, registrar el día de hoy después de simular
    -- no sumaba nada y la app quedaba congelada en el número simulado.
    perdida_fecha = current_date - 1
  where id = uid;

  return jsonb_build_object('racha', p_racha, 'rango', rango_de_racha(p_racha));
end;
$$;

revoke execute on function public.simular_racha(int) from public, anon;
grant execute on function public.simular_racha(int) to authenticated;

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
              duracion_descanso)
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
  public.registrar_dia(date, boolean, numeric),
  public.verificar_perdida(date),
  public.recalcular_desde_cero(date),
  public.cerrar_retos_vencidos(date),
  public.eliminar_amigo(uuid),
  public.eliminar_cuenta(),
  public.fijar_descansos(int[], date),
  public.mi_fuerza(),
  public.ranking_fuerza(),
  public.percentil_fuerza(),
  public.anotar_peso(date, numeric),
  public.iniciar_sesion(date),
  public.terminar_sesion(),
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
  public.registrar_dia(date, boolean, numeric),
  public.verificar_perdida(date),
  public.recalcular_desde_cero(date),
  public.cerrar_retos_vencidos(date),
  public.eliminar_amigo(uuid),
  public.eliminar_cuenta(),
  public.fijar_descansos(int[], date),
  public.mi_fuerza(),
  public.ranking_fuerza(),
  public.percentil_fuerza(),
  public.anotar_peso(date, numeric),
  public.iniciar_sesion(date),
  public.terminar_sesion(),
  public.mi_sesion(),
  public.resumen_sesiones()
  to authenticated;
