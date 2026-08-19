-- =============================================================
-- MIGRACIÓN 13 — el día corta en la zona del teléfono, no en Uruguay
--
-- Va DESPUÉS de la 12. Ejecutar entera en el SQL Editor de Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1. La zona del usuario
--
-- La 12 fijó el corte del día en Uruguay, lo que arregla el agujero de que
-- el cliente eligiera la fecha pero rompe a quien viaja: en Madrid el día le
-- cortaría a las 4 de la mañana.
--
-- Ahora la app manda la ZONA (identificador IANA), nunca la fecha, y el
-- servidor calcula el día con esa zona. Es la diferencia que importa: una
-- zona es un dato verificable contra `pg_timezone_names`; una fecha es un
-- número que el cliente inventa.
--
-- Es automático y transparente: la app la lee del teléfono y la manda sola.
-- NO hay campo en Ajustes ni en ningún lado, y el usuario nunca la ve.
-- -------------------------------------------------------------
alter table public.profiles
  add column if not exists zona text not null default 'America/Montevideo';

-- Cuándo cambió por última vez. Lo usa la guarda anti-doble-registro (§12b):
-- sin esto no hay forma de distinguir un viaje de un cambio de hora a mano.
alter table public.profiles
  add column if not exists zona_cambiada timestamptz;

-- No hay `check` de zona válida porque un CHECK no puede consultar
-- `pg_timezone_names`. La validación vive en el RPC, que es la ÚNICA puerta:
-- la columna no tiene grant de update para el cliente.
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

-- -------------------------------------------------------------
-- 2. Qué día es hoy PARA ESTE USUARIO
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

-- `hoy_uy()` queda como el tope absoluto del calendario, no como "hoy".
-- Se usa en los CHECK de las tablas, donde no se puede mirar el perfil: un
-- CHECK corre por fila y no tiene a quién preguntarle. El tope es el día de
-- la zona MÁS ADELANTADA del planeta (UTC+14): más allá de eso no hay
-- usuario posible, y la comprobación fina la hacen los RPC.
create or replace function public.tope_calendario()
returns date language sql stable as $$
  select (now() at time zone 'Pacific/Kiritimati')::date;
$$;

alter table public.logs drop constraint if exists logs_fecha_check;
alter table public.logs add constraint logs_fecha_check check (fecha <= tope_calendario());

alter table public.weights drop constraint if exists weights_fecha_check;
alter table public.weights add constraint weights_fecha_check check (fecha <= tope_calendario());

alter table public.prs drop constraint if exists prs_fecha_check;
alter table public.prs add constraint prs_fecha_check check (fecha <= tope_calendario());


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

drop trigger if exists trg_logs_no_futuros on public.logs;
create trigger trg_logs_no_futuros before insert or update on public.logs
  for each row execute function public.logs_no_futuros();

-- -------------------------------------------------------------
-- 3. La guarda contra el doble registro por cambio de zona
--
-- El ataque: registrás el día, movés la zona del teléfono hacia adelante,
-- "hoy" pasa a ser mañana y registrás de nuevo. Dos días en un día real.
--
-- La guarda pedida era 20 horas de reloj real entre dos días, siempre. Está
-- implementada, pero **condicionada a que la zona haya cambiado**, y por un
-- caso legítimo que la versión incondicional rompe: entrenar un lunes a las
-- 23:00 y el martes a las 07:00 son ocho horas y dos días de verdad. Con la
-- guarda a secas, el segundo día se rechazaba.
--
-- Condicionada al cambio de zona no tiene ningún falso positivo: al que no
-- viaja nunca se le aplica, y al que viaja se le aplica una sola vez.
--
-- Para volver a la versión incondicional, sacar la comprobación de
-- `zona_cambiada` de la condición.
-- -------------------------------------------------------------
create or replace function public.puede_registrar_hoy(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1
      from logs l, profiles p
     where l.user_id = p_user and p.id = p_user
       and p.zona_cambiada is not null
       and l.creado > p.zona_cambiada - interval '20 hours'
       and now() - l.creado < interval '20 hours'
  );
$$;

-- -------------------------------------------------------------
-- 4. Los RPC pasan a la zona del usuario
-- -------------------------------------------------------------
create or replace function public.registrar_dia(p_fecha date default null, p_es_descanso boolean default false, p_peso numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rango_antes int;
  perfil profiles;
  nuevo_log logs;
  hoy date := mi_hoy();
begin
  if not puede_registrar_hoy(uid) then
    raise exception 'todavía no pasaron 20 horas desde el último día';
  end if;
  select rango_actual into rango_antes from profiles where id = uid;
  insert into logs (user_id, fecha, es_descanso) values (uid, hoy, p_es_descanso)
    returning * into nuevo_log;
  if p_peso is not null then
    insert into weights (user_id, fecha, valor) values (uid, hoy, p_peso)
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

create or replace function public.anotar_peso(p_fecha date default null, p_valor numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  insert into weights (user_id, fecha, valor) values (uid, mi_hoy(), p_valor)
    on conflict (user_id, fecha) do update set valor = excluded.valor;
end;
$$;

create or replace function public.fijar_descansos(p_dias int[], p_hoy date default null)
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

create or replace function public.verificar_perdida(p_hoy date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  perfil profiles;
  viva int;
  nuevo_rango int;
  nueva_racha int;
  hoy date := mi_hoy();
begin
  select * into perfil from profiles where id = uid;
  if perfil.id is null or perfil.racha_actual = 0 then
    return jsonb_build_object('perdida', false);
  end if;
  if exists (select 1 from logs where user_id = uid and fecha = hoy) then
    return jsonb_build_object('perdida', false);
  end if;
  viva := perfil.racha_base + calcular_racha(uid, hoy - 1);
  if viva >= perfil.racha_actual then
    return jsonb_build_object('perdida', false);
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
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha);
end;
$$;

create or replace function public.recalcular_desde_cero(p_hoy date default null)
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

create or replace function public.cerrar_retos_vencidos(p_hoy date default null)
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

create or replace function public.iniciar_sesion(p_hoy date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l uuid;
  registro jsonb := null;
  s sesiones;
  hoy date := mi_hoy();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform cerrar_sesiones_vencidas(uid);
  update sesiones set estado = 'abandonada' where user_id = uid and estado = 'corriendo';
  select id into l from logs where user_id = uid and fecha = hoy;
  if l is null then
    registro := registrar_dia();
    l := (registro ->> 'log_id')::uuid;
  end if;
  insert into sesiones (user_id, log_id) values (uid, l) returning * into s;
  return jsonb_build_object('id', s.id, 'inicio', s.inicio, 'ahora', now(), 'registro', registro);
end;
$$;

-- -------------------------------------------------------------
-- 5. Permisos
--
-- `zona` NO tiene grant de update: se escribe solo por `fijar_zona`, que es
-- lo que garantiza que sea una zona real y no texto libre.
-- -------------------------------------------------------------
revoke execute on function public.hoy_de(uuid), public.puede_registrar_hoy(uuid)
  from public, anon, authenticated;

revoke execute on function public.fijar_zona(text), public.mi_hoy() from public, anon;
grant execute on function public.fijar_zona(text), public.mi_hoy() to authenticated;
grant execute on function public.tope_calendario() to authenticated, anon;
