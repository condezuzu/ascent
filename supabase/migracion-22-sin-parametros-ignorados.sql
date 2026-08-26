-- =============================================================
-- MIGRACION 22 - se van los parametros que el servidor ignora
--
-- Va DESPUES de la 21. **Desplegar la app PRIMERO**, despues esta migracion:
-- mientras tanto un cliente viejo sigue andando porque los parametros tienen
-- default; al reves, un cliente que todavia los manda no encuentra la firma.
-- =============================================================

-- Siete funciones tenian un parametro que NUNCA se usa en el cuerpo. Quedaron
-- de cuando el cliente mandaba la fecha; desde la migracion 12 el dia lo
-- decide el servidor con la zona del usuario y el parametro se ignora en
-- silencio.
--
-- Un parametro que se ignora MIENTE, y no es teorico: la seccion 6 del e2e
-- pasaba `p_fecha: ayer` creyendo que registraba ayer, registraba hoy, chocaba
-- con el dia que ya estaba y devolvia nulls. La prueba de subida de rango no
-- probaba nada desde hacia nueve migraciones. Ver spec/trampas.md.
--
-- `descansos_vigentes(p_user, p_fecha)` NO entra aca: esa si usa la fecha, es
-- la que resuelve que descansos regian en un dia dado.
--
-- Hay que DROPear antes de crear: cambiar la lista de parametros no se puede
-- con `create or replace`, y una firma vieja que sobrevive es la que alguien
-- vuelve a llamar sin saber (ya nos paso con `hoy_uy()`).

drop function if exists public.registrar_dia(date, boolean, numeric);
create or replace function public.registrar_dia(p_es_descanso boolean default false, p_peso numeric default null)
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
    if p_peso is not null then
      -- el peso sí se puede guardar ya: no depende del día
      insert into weights (user_id, fecha, valor) values (uid, hoy, p_peso)
        on conflict (user_id, fecha) do update set valor = excluded.valor;
    end if;
    return jsonb_build_object('bloqueado', true, 'pendiente', hoy, 'hasta', hasta);
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

drop function if exists public.anotar_peso(date, numeric);
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

drop function if exists public.verificar_perdida(date);
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

drop function if exists public.recalcular_desde_cero(date);
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

drop function if exists public.cerrar_retos_vencidos(date);
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

drop function if exists public.fijar_descansos(int[], date);
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

drop function if exists public.iniciar_sesion(date);
create or replace function public.iniciar_sesion()
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
    if (registro ->> 'bloqueado')::boolean then
      return registro;
    end if;
    l := (registro ->> 'log_id')::uuid;
  end if;
  insert into sesiones (user_id, log_id) values (uid, l) returning * into s;
  return jsonb_build_object('bloqueado', false, 'id', s.id, 'inicio', s.inicio,
    'ahora', now(), 'registro', registro);
end;
$$;

-- Dropear una funcion se lleva sus permisos Y la devuelve con el permiso por
-- omision de Postgres, que es EXECUTE para PUBLIC. O sea que sin este `revoke`
-- las siete quedan abiertas a `anon`: siete funciones SECURITY DEFINER que
-- cualquiera con la anon key podria llamar. Lo agarro `test-deriva` comparando
-- esta migracion contra schema.sql, que si las revoca.
revoke execute on function
  public.registrar_dia(boolean, numeric),
  public.verificar_perdida(),
  public.recalcular_desde_cero(),
  public.cerrar_retos_vencidos(),
  public.fijar_descansos(int[]),
  public.anotar_peso(numeric),
  public.iniciar_sesion()
  from public, anon, authenticated;

-- Y ahora si, el permiso que de verdad corresponde.
grant execute on function
  public.registrar_dia(boolean, numeric),
  public.verificar_perdida(),
  public.recalcular_desde_cero(),
  public.cerrar_retos_vencidos(),
  public.fijar_descansos(int[]),
  public.anotar_peso(numeric),
  public.iniciar_sesion()
  to authenticated;
