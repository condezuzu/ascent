-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 79 then
    raise exception 'Esta es la migración 79 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 79 — LAS VIDAS VUELVEN TODAS JUNTAS
--
-- Cambia cuándo vuelven las vidas: la primera que se usa abre un ciclo de 30
-- días y al cerrarse vuelven todas juntas. Solo funciones: no toca ninguna fila.
-- Puede cambiar cuántas vidas tiene hoy alguien que usó varias en días distintos
-- (le vuelven antes o después que con la regla de a una).

do $$
begin
  if public.version_del_esquema() < 78 then
    raise exception 'La migración 79 va después de la 78 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

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
    select fecha from vidas_usadas
     where user_id = p_user and not devuelta and fecha <= p_dia
     order by fecha
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
  select greatest(0, impulsos_ganados(p_user) - coalesce((
    select count(*)::int from vidas_usadas
     where user_id = p_user
       and not devuelta
       and fecha >= inicio_ciclo_vidas(p_user, p_dia)
       and fecha <= p_dia
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
      select jsonb_agg(fecha order by fecha)
        from vidas_usadas
       where user_id = auth.uid()
         and not devuelta
         and fecha >= inicio_ciclo_vidas(auth.uid(), mi_hoy())
         and fecha <= mi_hoy()
    ), '[]'::jsonb),
    'vuelve', inicio_ciclo_vidas(auth.uid(), mi_hoy()) + 30,
    'ultimas', coalesce((
      select jsonb_agg(fecha order by fecha desc)
        from (
          select fecha from vidas_usadas
           where user_id = auth.uid() and not devuelta
           order by fecha desc limit 5
        ) x
    ), '[]'::jsonb),
    'ultima', (
      select max(fecha) from vidas_usadas where user_id = auth.uid() and not devuelta
    )
  );
$$;
revoke execute on function public.mis_impulsos() from public, anon;
grant execute on function public.mis_impulsos() to authenticated;

-- La versión sube a 79. Solo sube.
do $$
begin
  if public.version_del_esquema() < 79 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 79; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
