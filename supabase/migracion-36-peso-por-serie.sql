-- =============================================================
-- MIGRACIÓN 36 — el peso de cada serie
--
-- Va DESPUÉS de la 35. Ejecutar entera en el SQL Editor de Supabase.
--
-- ADITIVA: una función auxiliar nueva, una de lectura nueva, y `fijar_bloques`
-- reemplazada con la MISMA firma. Se puede correr antes o después del deploy:
--   - Cliente viejo + base nueva: no manda pesos, y los bloques quedan
--     idénticos a los de hoy.
--   - Cliente nuevo + base vieja: la base vieja filtra los pesos y guarda los
--     bloques sin ellos. Nada se rompe; solo no se guardan hasta que corra.
-- =============================================================

-- -------------------------------------------------------------
-- 1. LA FORMA
-- -------------------------------------------------------------
-- Cada bloque de `sesiones.bloques` puede llevar `pesos`: una lista con el
-- peso de cada serie, en KILOS, y `null` para las series sin peso.
--
--   {"ejercicio": "press_banca", "series": 4, "pesos": [60, 60, 62.5, 62.5]}
--
-- `series` SIGUE SIENDO LA VERDAD del conteo, y `sesiones.series` sigue siendo
-- el total. Los pesos son una anotación encima: un bloque sin `pesos` es
-- exactamente el bloque de antes. La racha, las duraciones y los impulsos no
-- leen un solo peso.
--
-- NO SE CREAN MARCAS SOLAS. Una serie de 102 no toca `prs`: el DOTS se compara
-- con gente de verdad, y una marca puesta por la app a partir de un número
-- tecleado entre series lo ensucia sin que nadie se entere.

-- Limpia la lista que manda el teléfono. La base no le cree al cliente:
--   - si no es una lista, no hay pesos;
--   - se toman como mucho `n` —las series del bloque—, nunca más;
--   - un peso tiene que ser un número entre 0 y 999; lo demás es `null`;
--   - centésimas, igual que el cliente (61,25 existe);
--   - una lista de puros `null` no dice nada y no se guarda.
create or replace function public.pesos_limpios(p jsonb, n int)
returns jsonb language sql immutable set search_path = public as $$
  select case
    when p is null or jsonb_typeof(p) <> 'array' or n <= 0 then null
    else (
      select case when bool_or(v is not null) then jsonb_agg(v order by o) else null end
        from (
          select o,
                 case
                   when jsonb_typeof(x) = 'number'
                    and (x #>> '{}')::numeric > 0
                    and (x #>> '{}')::numeric <= 999
                   then to_jsonb(round((x #>> '{}')::numeric, 2))
                   else null
                 end as v
            from jsonb_array_elements(p) with ordinality as t(x, o)
           where o <= n
        ) q
    )
  end;
$$;

revoke execute on function public.pesos_limpios(jsonb, int) from public, anon, authenticated;

-- -------------------------------------------------------------
-- 2. GUARDAR LOS BLOQUES, ahora con pesos
-- -------------------------------------------------------------
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

  -- Se filtra acá y no en el cliente: la lista llega del teléfono. La llave
  -- `pesos` solo aparece si quedó algún peso de verdad después de limpiar.
  select coalesce(jsonb_agg(
           case when p is null
                then jsonb_build_object('ejercicio', e, 'series', s)
                else jsonb_build_object('ejercicio', e, 'series', s, 'pesos', p)
           end order by i), '[]'::jsonb)
    into limpio
  from (
    select
      f.e, f.s, f.i,
      pesos_limpios(f.pesos, f.s) as p
    from (
      select
        b.valor->>'ejercicio' as e,
        greatest(0, least((b.valor->>'series')::int, 999)) as s,
        b.valor->'pesos' as pesos,
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

-- -------------------------------------------------------------
-- 3. CON QUÉ PESO ARRANCA EL BLOQUE
-- -------------------------------------------------------------
-- El último peso que anotaste para ESE ejercicio. Es la misma idea que
-- `ultimo_ejercicio`: si hacés press de banca con 60, escribir 60 cada vez es
-- el impuesto que hace que se deje de anotar.
--
-- La última serie CON peso, no la última serie: si la última de ayer fue sin
-- anotar, la respuesta útil es la anterior, no "nada".
--
-- Noventa días y no para siempre: un peso de hace un año no es con lo que vas
-- a arrancar hoy, y proponerlo es peor que dejar el campo vacío.
create or replace function public.ultimo_peso(p_ejercicio text)
returns numeric language sql stable security definer set search_path = public as $$
  select x.v::numeric
    from sesiones s,
         jsonb_array_elements(s.bloques) with ordinality as b(bloque, ob),
         jsonb_array_elements_text(
           case when jsonb_typeof(b.bloque->'pesos') = 'array' then b.bloque->'pesos' else '[]'::jsonb end
         ) with ordinality as x(v, ox)
   where s.user_id = auth.uid()
     and b.bloque->>'ejercicio' = p_ejercicio
     and x.v is not null
     and s.inicio > now() - interval '90 days'
   order by s.inicio desc, b.ob desc, x.ox desc
   limit 1;
$$;

revoke execute on function public.ultimo_peso(text) from public, anon;
grant execute on function public.ultimo_peso(text) to authenticated;
