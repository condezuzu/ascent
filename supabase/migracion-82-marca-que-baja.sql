-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 82 then
    raise exception 'Esta es la migración 82 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 82 — LA MARCA DE ACTIVIDAD SE PUEDE ACHICAR
--
-- La cinta y el descanso largo prometen actividad hasta una hora adelante (la
-- 81). Si después de "Listo" la persona se iba sin tocar Terminar, la sesión se
-- cerraba sola con esa hora de más, y quedaba así en Stats. Con `p_bajar` la app
-- avisa que la promesa terminó: la marca baja a ahora, nunca a antes de ahora.
-- Las apps viejas siguen llamando con dos parámetros y andan igual. No toca filas.

do $$
begin
  if public.version_del_esquema() < 81 then
    raise exception 'La migración 82 va después de la 81 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

drop function if exists public.marcar_actividad(uuid, timestamptz);

create or replace function public.marcar_actividad(p_sesion uuid, p_hasta timestamptz, p_bajar boolean default false)
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

  if s.estado = 'corriendo' and p_bajar then
    -- Una promesa a futuro baja a ahora; una marca vieja sube a ahora, como siempre.
    update sesiones set ultima_actividad = greatest(least(ultima_actividad, greatest(t, now())), t) where id = s.id;
  elsif s.estado = 'corriendo' then
    update sesiones set ultima_actividad = greatest(ultima_actividad, t) where id = s.id;
  elsif s.estado = 'terminada' and s.cerro_sola and t > s.fin and t <= s.fin + ventana_inactividad() then
    update sesiones
       set ultima_actividad = greatest(ultima_actividad, t),
           fin = least(t, now())
     where id = s.id;
  end if;
end;
$$;

revoke execute on function public.marcar_actividad(uuid, timestamptz, boolean) from public, anon;
grant execute on function public.marcar_actividad(uuid, timestamptz, boolean) to authenticated;

do $$
begin
  if public.version_del_esquema() < 82 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 82; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
