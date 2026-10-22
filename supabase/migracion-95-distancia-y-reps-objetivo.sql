-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 95 then
    raise exception 'Esta es la migración 95 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 95 — LA DISTANCIA DEL CARDIO Y LAS REPETICIONES OBJETIVO DE LA RUTINA (21/10)
--
-- 1. El cardio anota la distancia: `distancia` (km) dentro del bloque, como `minutos`.
--    `fijar_bloques` rearma cada bloque con sus llaves conocidas y la tiraba.
-- 2. Cada ejercicio de la rutina puede llevar sus repeticiones objetivo (`reps`): es contra lo
--    que compara el aviso de subir el peso (la regla 2 por 2). `rutina_dias_limpios` la tiraba.
--
-- No toca datos. Hasta pegarla, la app no muestra ninguna de las dos (pide la versión 95).

do $$
begin
  if public.version_del_esquema() < 94 then
    raise exception 'La migración 95 va después de la 94 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

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
                            -- LAS REPETICIONES OBJETIVO (migración 95): de 1 a 100, para el aviso de subir el peso.
                            || case when jsonb_typeof(e.valor -> 'reps') = 'number'
                                         and round((e.valor ->> 'reps')::numeric) between 1 and 100
                                    then jsonb_build_object('reps', round((e.valor ->> 'reps')::numeric)::int)
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
           -- LAS REPETICIONES (migración 94): de un ejercicio que se cuenta en series.
           || case when r is null then '{}'::jsonb else jsonb_build_object('reps', r) end
           -- LA DISTANCIA (migración 95): en kilómetros, solo de un ejercicio que se mide en tiempo.
           || case when km is null then '{}'::jsonb else jsonb_build_object('distancia', km) end
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
      end as m,
      case when (select x.mide from ejercicios x where x.id = f.e) = 'tiempo' then null
           else reps_limpias(f.reps, f.s)
      end as r,
      -- Igual que el teléfono (distanciaValida): más de 0 y hasta 500 km, en centésimas.
      case when (select x.mide from ejercicios x where x.id = f.e) = 'tiempo' and jsonb_typeof(f.distancia) = 'number'
                and (f.distancia #>> '{}')::numeric > 0
           then least(round((f.distancia #>> '{}')::numeric, 2), 500)
      end as km
    from (
      select
        b.valor->>'ejercicio' as e,
        greatest(0, least((b.valor->>'series')::int, 999)) as s,
        b.valor->'pesos' as pesos,
        b.valor->>'carga' as carga,
        b.valor->'minutos' as minutos,
        b.valor->'reps' as reps,
        b.valor->'distancia' as distancia,
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

do $$
begin
  if public.version_del_esquema() < 95 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 95; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
