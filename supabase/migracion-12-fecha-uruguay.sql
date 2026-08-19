-- =============================================================
-- MIGRACIÓN 12 — el día lo corta Uruguay, no UTC ni el teléfono
--
-- Para bases que YA tienen el schema aplicado. En una base nueva no hace
-- falta: schema.sql ya lo incluye todo.
-- Ejecutar entero en el SQL Editor de Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Qué día es "hoy"
--
-- Hasta acá había DOS problemas a la vez, y los dos silenciosos:
--
-- a) `current_date` en Supabase es UTC. El día del servidor cambiaba a las
--    21:00 de Uruguay: entre las 21:00 y la medianoche, el servidor ya
--    contaba mañana.
--
-- b) Para tapar (a), la fecha la mandaba el CLIENTE (`p_hoy`) y el servidor
--    solo la acotaba a ±1 día. Eso dejaba una ventana de tres días para
--    elegir: bastaba adelantar la hora del teléfono, registrar "mañana",
--    volverla atrás y registrar "hoy". Dos días de racha en un día real,
--    repetible.
--
-- La fecha ahora la decide el servidor con la zona de Uruguay. El cliente no
-- participa: no hay nada que corromper cambiando la hora del teléfono.
--
-- Consecuencia aceptada: quien viaje a otro huso ve el día de Uruguay. Para
-- una app de un gimnasio uruguayo eso es lo correcto, y es infinitamente más
-- simple que una zona por usuario —que además habría que dejar cambiar, y
-- volveríamos a tener el mismo agujero—.
-- -------------------------------------------------------------
create or replace function public.hoy_uy()
returns date language sql stable as $$
  select (now() at time zone 'America/Montevideo')::date;
$$;

-- matemática de calendario, abierta como rango_de_racha
revoke execute on function public.hoy_uy() from public, anon;
grant execute on function public.hoy_uy() to authenticated, anon;

-- -------------------------------------------------------------
-- 2. Las restricciones de fecha
--
-- Ya no hace falta el "+ 1" que compensaba el huso: `hoy_uy()` ES el día del
-- usuario, así que el futuro empieza mañana y punto.
-- -------------------------------------------------------------
alter table public.logs drop constraint if exists logs_fecha_check;
alter table public.logs add constraint logs_fecha_check check (fecha <= hoy_uy());

alter table public.weights drop constraint if exists weights_fecha_check;
alter table public.weights add constraint weights_fecha_check check (fecha <= hoy_uy());

alter table public.prs drop constraint if exists prs_fecha_check;
alter table public.prs add constraint prs_fecha_check check (fecha <= hoy_uy());

-- -------------------------------------------------------------
-- 3. Los RPC dejan de creerle al cliente
--
-- `p_hoy` y `p_fecha` siguen existiendo en la firma A PROPÓSITO: el despliegue
-- de Vercel y esta migración no ocurren en el mismo instante, así que durante
-- un rato puede haber clientes viejos mandando la fecha. Se ignora el valor,
-- no se rompe la llamada. Cuando no queden clientes viejos se puede sacar.
-- -------------------------------------------------------------

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
  insert into descansos (user_id, desde, dias) values (uid, hoy_uy(), limpio)
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
  hoy date := hoy_uy();
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
  select coalesce(max(fecha), hoy_uy()) into hasta from logs where user_id = uid;
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
    where estado = 'activo' and hasta < hoy_uy()
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

-- registrar_dia: la fecha del día que se registra SIEMPRE es hoy. Corregir
-- días pasados se hace por el calendario, que escribe en logs directo.
create or replace function public.registrar_dia(p_fecha date default null, p_es_descanso boolean default false, p_peso numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rango_antes int;
  perfil profiles;
  nuevo_log logs;
  hoy date := hoy_uy();
begin
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
  insert into weights (user_id, fecha, valor) values (uid, hoy_uy(), p_valor)
    on conflict (user_id, fecha) do update set valor = excluded.valor;
end;
$$;

create or replace function public.iniciar_sesion(p_hoy date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l uuid;
  registro jsonb := null;
  s sesiones;
  hoy date := hoy_uy();
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
-- 4. Se va el simulador de rachas (migración 11, nunca aplicada)
--
-- Se reemplazó por una galería de pantallas con datos de mentira: no toca la
-- cuenta de nadie, no escribe en la base y no necesita permisos especiales.
-- El `drop if exists` está por si alguna base llegó a correr la 11.
-- -------------------------------------------------------------
drop function if exists public.simular_racha(int);
