-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 81 then
    raise exception 'Esta es la migración 81 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 81 — LA MARCA DE ACTIVIDAD ACEPTA HASTA UNA HORA ADELANTE
--
-- Hasta ahora `marcar_actividad` acotaba la marca a 15 minutos adelante. El
-- descanso a mano llega a una hora y el cardio con cronómetro puede durar más
-- que eso: con el teléfono bloqueado, la base cerraba la sesión a los 45
-- minutos (15 + la media hora de inactividad), en pleno descanso o en plena
-- cinta. Con la app adelante el teléfono renueva la marca solo; esto es para
-- el bolsillo. Solo cambia el tope: no toca ninguna fila.

do $$
begin
  if public.version_del_esquema() < 80 then
    raise exception 'La migración 81 va después de la 80 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

create or replace function public.marcar_actividad(p_sesion uuid, p_hasta timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
  t timestamptz;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  select * into s from sesiones where id = p_sesion and user_id = uid;
  if s.id is null then return; end if;

  t := least(greatest(coalesce(p_hasta, now()), s.inicio), now() + interval '60 minutes');

  if s.estado = 'corriendo' then
    update sesiones set ultima_actividad = greatest(ultima_actividad, t) where id = s.id;
  elsif s.estado = 'terminada' and s.cerro_sola and t > s.fin and t <= s.fin + ventana_inactividad() then
    update sesiones
       set ultima_actividad = greatest(ultima_actividad, t),
           fin = least(t, now())
     where id = s.id;
  end if;
end;
$$;

revoke execute on function public.marcar_actividad(uuid, timestamptz) from public, anon;
grant execute on function public.marcar_actividad(uuid, timestamptz) to authenticated;

do $$
begin
  if public.version_del_esquema() < 81 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 81; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
