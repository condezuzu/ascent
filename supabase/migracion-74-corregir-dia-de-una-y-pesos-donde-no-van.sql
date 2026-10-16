-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 74 then
    raise exception 'Esta es la migración 74 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 74 — CORREGIR UN DÍA DE UNA, Y LOS EJERCICIOS SIN PESO NO GUARDAN PESOS
--
-- De la cacería del 13/10, los dos que rompían datos y pedían tocar la base:
-- 1. `corregir_dia`: borrar el día y volver a ponerlo, en una transacción. En
--    dos pedidos sueltos, si entraba el primero y no el segundo el día quedaba
--    borrado con su sesión.
-- 2. `fijar_bloques` no guarda pesos en un ejercicio que no los lleva (plancha,
--    plancha lateral, dead bug).
--
-- No reescribe ningún dato: los kilos que ya hayan quedado guardados en un
-- ejercicio sin peso NO se tocan acá (el pasado no se reescribe sin mirarlo:
-- la consulta para verlos está en el informe).

do $$
begin
  if public.version_del_esquema() < 73 then
    raise exception 'La migración 74 va después de la 73 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- (las dos funciones son copia exacta de schema.sql)
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
           end order by i), '[]'::jsonb)
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
      end as c
    from (
      select
        b.valor->>'ejercicio' as e,
        greatest(0, least((b.valor->>'series')::int, 999)) as s,
        b.valor->'pesos' as pesos,
        b.valor->>'carga' as carga,
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

-- La versión sube a 74. Solo sube.
do $$
begin
  if public.version_del_esquema() < 74 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 74; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
