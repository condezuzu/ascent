-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 71 then
    raise exception 'Esta es la migración 71 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 71 — `como_arranca`: LO DE HOY VA PRIMERO
--
-- La 70 dejó afuera la sesión que está corriendo. Casi nunca importa —lo de hoy
-- lo sabe el teléfono— salvo en un caso: un teléfono recién instalado que
-- retoma una sesión abierta, antes de recibir sus bloques y sin historial.
-- Ahí la base contestaba el tope de otro día por un ejercicio hecho hace veinte
-- minutos. Ahora contesta como el teléfono: primero la última serie de hoy.
--
-- No reescribe ningún dato: cambia una función. Aditiva.

do $$
begin
  if public.version_del_esquema() < 70 then
    raise exception 'La migración 71 va después de la 70 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- (copia exacta de schema.sql)
-- EL PESO QUE SE PROPONE. ES LA MISMA REGLA que `nucleo/pesoRecordado.ts`, que
-- es quien propone en el teléfono; esto es su respaldo, y dos reglas para el
-- mismo número ya costaron tres veces. En este orden:
--   1. LO DE HOY (migración 71): la última serie de la sesión que está
--      corriendo. Quien reabre un ejercicio a los veinte minutos sigue desde
--      donde quedó. La 70 la había dejado afuera, y un teléfono recién
--      instalado que retoma una sesión abierta —sin sus bloques todavía y sin
--      historial— recibía de acá el tope de otro día.
--   2. Si hoy no se hizo: LO MÁS PESADO DE LA ÚLTIMA SESIÓN CERRADA
--      (migración 70), no su última serie: casi todos arrancan con el peso
--      más alto y bajan al cansarse. De los últimos 90 días.
-- El bloque que no dice su modo usa el del catálogo.
create or replace function public.como_arranca(p_ejercicio text)
returns jsonb language sql stable security definer set search_path = public as $$
  with modo as (
    select e.carga_ambigua as ambigua,
           c.carga as elegida,
           coalesce(c.carga, e.carga) as carga,
           e.carga as catalogo
      from ejercicios e
      left join cargas_elegidas c on c.ejercicio = e.id and c.user_id = auth.uid()
     where e.id = p_ejercicio
  )
  select jsonb_build_object(
           'carga', m.carga,
           'elegida', m.elegida is not null,
           'ambigua', m.ambigua,
           'peso', coalesce(
             (
               select x.v::numeric
                 from sesiones s,
                      jsonb_array_elements(s.bloques) with ordinality as b(bloque, ob),
                      jsonb_array_elements_text(
                        case when jsonb_typeof(b.bloque->'pesos') = 'array' then b.bloque->'pesos' else '[]'::jsonb end
                      ) with ordinality as x(v, ox)
                where s.user_id = auth.uid()
                  and s.estado = 'corriendo'
                  and b.bloque->>'ejercicio' = p_ejercicio
                  and coalesce(b.bloque->>'carga', m.catalogo) = m.carga
                  and x.v is not null
                order by s.inicio desc, b.ob desc, x.ox desc
                limit 1
             ),
             (
               select max(x.v::numeric)
                 from sesiones s,
                      jsonb_array_elements(s.bloques) as b(bloque),
                      jsonb_array_elements_text(
                        case when jsonb_typeof(b.bloque->'pesos') = 'array' then b.bloque->'pesos' else '[]'::jsonb end
                      ) as x(v)
                where s.id = (
                        select s2.id
                          from sesiones s2,
                               jsonb_array_elements(s2.bloques) as b2(bloque),
                               jsonb_array_elements_text(
                                 case when jsonb_typeof(b2.bloque->'pesos') = 'array' then b2.bloque->'pesos' else '[]'::jsonb end
                               ) as y(v)
                         where s2.user_id = auth.uid()
                           and s2.estado <> 'corriendo'
                           and s2.inicio > now() - interval '90 days'
                           and b2.bloque->>'ejercicio' = p_ejercicio
                           and coalesce(b2.bloque->>'carga', m.catalogo) = m.carga
                           and y.v is not null
                         order by s2.inicio desc
                         limit 1
                      )
                  and b.bloque->>'ejercicio' = p_ejercicio
                  and coalesce(b.bloque->>'carga', m.catalogo) = m.carga
                  and x.v is not null
             )
           )
         )
    from modo m;
$$;

revoke execute on function public.como_arranca(text) from public, anon;
grant execute on function public.como_arranca(text) to authenticated;

-- La versión sube a 71. Solo sube.
do $$
begin
  if public.version_del_esquema() < 71 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 71; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
