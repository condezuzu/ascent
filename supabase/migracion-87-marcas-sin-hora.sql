-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 87 then
    raise exception 'Esta es la migración 87 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 87 — LAS MARCAS DE UN AMIGO, SIN LA HORA
--
-- La 86 tapó la hora de los días de un amigo, pero `prs.creado` (cuándo se guardó la
-- marca, que se ofrece en plena sesión) la seguía dando: la política de amigos abre
-- todas las columnas. Ahora esa columna no se lee desde la app, ni la propia ni la
-- ajena: ningún cliente la usa, así que no hay orden que cuidar. Las funciones de la
-- base (security definer) la siguen viendo. Solo cambia permisos: ninguna fila se toca.
--
-- `medallas.actualizado` queda como está: la app guarda las medallas con un upsert,
-- y un upsert necesita poder leer todas las columnas.

do $$
begin
  if public.version_del_esquema() < 86 then
    raise exception 'La migración 87 va después de la 86 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

revoke select on public.prs from authenticated;
grant select (id, user_id, ejercicio, peso, reps, es_real, fecha) on public.prs to authenticated;

do $$
begin
  if public.version_del_esquema() < 87 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 87; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
