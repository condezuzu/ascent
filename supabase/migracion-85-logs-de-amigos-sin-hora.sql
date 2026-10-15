-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 85 then
    raise exception 'Esta es la migración 85 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 85 — UN AMIGO NO VE A QUÉ HORA ENTRENASTE
--
-- Con "Avisar cuando entreno" apagado, un amigo igual leía `logs.creado` (la hora
-- en que empezó la sesión que creó el día) y `logs.origen` ('ubicacion' = llegó al
-- gimnasio), porque la política de amigos abría todas las columnas. Ahora los días
-- de un amigo se leen por una vista que no las tiene, y la tabla queda solo para
-- el dueño.
--
-- VA DESPUÉS DE PUBLICAR LA APP: la app nueva lee la vista solo cuando la base ya
-- está en la 85; una app vieja, con esta migración puesta, ve vacía la semana y la
-- actividad de los amigos (sin errores). Solo cambia permisos: ninguna fila se toca.

do $$
begin
  if public.version_del_esquema() < 84 then
    raise exception 'La migración 85 va después de la 84 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- Corre como su dueño (como `usuarios_publicos`): el filtro de amigos es el where.
create or replace view public.logs_de_amigos
with (security_invoker = off) as
  select id, user_id, fecha, es_descanso, planeta_del_dia, racha_del_dia
    from public.logs
   where public.son_amigos(auth.uid(), user_id);

revoke all on public.logs_de_amigos from public, anon;
grant select on public.logs_de_amigos to authenticated;

drop policy if exists "logs: amigos leen" on public.logs;

do $$
begin
  if public.version_del_esquema() < 85 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 85; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
