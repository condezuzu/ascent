-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 52 then
    raise exception 'Esta es la migración 52 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 52 — las medallas de varios amigos en UNA consulta
--
-- POR QUÉ. El ranking mostraba una medalla al lado de cada nombre y las traía
-- con una consulta POR amigo, en paralelo: con diez amigos, diez idas al
-- servidor para pintar una sola lista. Esta función las trae todas juntas.
--
-- MISMA SEGURIDAD QUE `medallas_de`. Es `security invoker`, así que corre con
-- los permisos de quien llama y la RLS de `public.medallas` decide qué filas
-- salen: la política "medallas: leer" ya deja ver solo las propias y las de los
-- amigos (`auth.uid() = user_id or son_amigos(...)`). Pasar el id de un ajeno en
-- la lista no devuelve nada: la RLS lo filtra fila por fila. Por eso no hace
-- falta repetir la comprobación de amistad acá.
--
-- Se aplica en el SQL Editor. Después: `npm run test:conexion` en verde.

create or replace function public.medallas_de_muchos(p_users uuid[])
returns table (user_id uuid, ejercicio text, percentil smallint)
language sql
stable
security invoker
set search_path = public
as $$
  select m.user_id, m.ejercicio, m.percentil
    from public.medallas m
   where m.user_id = any(p_users)
$$;

grant execute on function public.medallas_de_muchos(uuid[]) to authenticated;

create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 52; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
