-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 94 then
    raise exception 'Esta es la migración 94 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 94 — LAS REPETICIONES DE CADA SERIE (21/10)
--
-- Con «Registrar repeticiones» prendido en Ajustes, cada serie lleva cuántas se hicieron.
-- No hace falta una columna: van dentro de cada bloque de `sesiones.bloques`, en la lista
-- `reps`, una por serie, igual que `pesos`. Lo que faltaba es que `fijar_bloques` las
-- deje pasar: rearma cada bloque con sus llaves conocidas y hasta ahora las tiraba.
--
-- No toca datos. Hasta pegarla, la app no muestra el cuadradito (pide la versión 94).

do $$
begin
  if public.version_del_esquema() < 93 then
    raise exception 'La migración 94 va después de la 93 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- Como `pesos_limpios`: enteros de 1 a 999, como mucho `n`; lo demás es `null`, y una
-- lista de puros `null` no se guarda.
create or replace function public.reps_limpias(p jsonb, n int)
returns jsonb language sql immutable set search_path = public as $$
  select case
    when p is null or jsonb_typeof(p) <> 'array' or n <= 0 then null
    else (
      select case when bool_or(v is not null) then jsonb_agg(v order by o) else null end
        from (
          select o,
                 case
                   when jsonb_typeof(x) = 'number'
                    and (x #>> '{}')::numeric = trunc((x #>> '{}')::numeric)
                    and (x #>> '{}')::numeric between 1 and 999
                   then to_jsonb((x #>> '{}')::int)
                   else null
                 end as v
            from jsonb_array_elements(p) with ordinality as t(x, o)
           where o <= n
        ) q
    )
  end;
$$;

revoke execute on function public.reps_limpias(jsonb, int) from public, anon, authenticated;

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
      end as r
    from (
      select
        b.valor->>'ejercicio' as e,
        greatest(0, least((b.valor->>'series')::int, 999)) as s,
        b.valor->'pesos' as pesos,
        b.valor->>'carga' as carga,
        b.valor->'minutos' as minutos,
        b.valor->'reps' as reps,
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
  if public.version_del_esquema() < 94 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 94; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
