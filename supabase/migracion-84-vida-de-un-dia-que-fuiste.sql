-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 84 then
    raise exception 'Esta es la migración 84 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 84 — LA VIDA DE UN DÍA QUE AL FINAL FUISTE VUELVE
--
-- Si un día entrenado no entró a tiempo (el registro al llegar falló), al otro
-- día una vida lo cubría. Marcarlo después como "Fui" arreglaba la racha, pero la
-- vida seguía gastada todo el ciclo: dos faltas reales más tarde cortaban la
-- racha (−10), cosa que no pasaba si el día entraba a tiempo.
-- Ahora una vida cuyo día tiene un log de entrenamiento no cuenta como usada. Se
-- decide al LEER, no se borra la fila: si el día vuelve a "Sin registrar", la vida
-- vuelve a contar y el día sigue cubierto. Un día pasado a descanso no la devuelve.
-- Solo cambian funciones: ninguna fila se toca.

do $$
begin
  if public.version_del_esquema() < 83 then
    raise exception 'La migración 84 va después de la 83 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

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

do $$
begin
  if public.version_del_esquema() < 84 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 84; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
