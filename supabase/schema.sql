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
create policy "avatares: todos leen" on storage.objects for select using (bucket_id = 'avatares');

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
  public.friendships, public.challenges, public.feedback, public.descansos
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

-- lo único editable de cada tabla, columna por columna.
-- dias_descanso NO está: es un espejo que mantiene fijar_descansos, y si el
-- cliente pudiera escribirlo se desincronizaría del historial fechado.
grant update (username, avatar_url) on public.profiles to authenticated;
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
  public.fijar_descansos(int[], date)
  from public, anon;

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
  public.fijar_descansos(int[], date)
  to authenticated;
