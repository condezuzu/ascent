-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 72 then
    raise exception 'Esta es la migración 72 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 72 — "ENTRENANDO AHORA" SALE DE LA SESIÓN, Y DE NINGÚN OTRO LADO
--
-- El bug (12/10, del gimnasio): un amigo seguía "entrenando" dos horas después
-- de terminar, y otro aparecía a las diez de la noche. Salía de una tabla
-- aparte (`en_el_gimnasio`) con una marca de dos horas, que ponía también el
-- vigilante con solo estar adentro del radio del gimnasio.
--
-- 1. `entrenando_ahora` lee `sesiones`: una sesión corriendo que la base
--    todavía da por viva (media hora sin series, o dos horas si nunca hubo
--    una: la regla con la que ya se cierran solas). Se arregla en la base:
--    vale para TODOS los teléfonos en el acto, tengan la app que tengan.
-- 2. La tabla `en_el_gimnasio` se va, y `marcar_en_gimnasio` queda vacía para
--    los teléfonos que todavía la llaman. Una sola fuente.
-- 3. SE CIERRAN LAS SESIONES QUE QUEDARON COLGADAS, con la regla de siempre
--    (`cerrar_sesiones_vencidas`): es lo mismo que les pasaría sola a cada una
--    la próxima vez que su dueño abra la app. ESTO REESCRIBE DATOS.

do $$
begin
  if public.version_del_esquema() < 71 then
    raise exception 'La migración 72 va después de la 71 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- (todas las funciones son copia exacta de schema.sql)
create or replace function public.sesion_sigue_viva(p_inicio timestamptz, p_ultima_actividad timestamptz)
returns boolean language sql stable set search_path = public as $$
  select case
           when p_ultima_actividad > p_inicio then now() < p_ultima_actividad + public.ventana_inactividad()
           else now() - p_inicio < public.tope_sesion()
         end;
$$;
revoke execute on function public.sesion_sigue_viva(timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.fijar_comparte_gimnasio(p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  -- Al apagarlo deja de aparecer YA: `entrenando_ahora` lo lee de acá.
  update profiles set comparte_gimnasio = coalesce(p_valor, false) where id = uid;
end;
$$;

create or replace function public.marcar_en_gimnasio()
returns void language plpgsql security definer set search_path = public as $$
begin
  return;
end;
$$;

create or replace function public.entrenando_ahora()
returns table (id uuid, username text, avatar_url text, desde timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.username, u.avatar_url, s.inicio
    from sesiones s
    join profiles p on p.id = s.user_id and p.comparte_gimnasio
    join usuarios_publicos u on u.id = s.user_id
   where s.estado = 'corriendo'
     and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
     and s.user_id <> auth.uid()
     and public.son_amigos(auth.uid(), s.user_id)
   order by s.inicio desc;
$$;

revoke execute on function public.fijar_comparte_gimnasio(boolean), public.marcar_en_gimnasio(), public.entrenando_ahora() from public, anon;
grant execute on function public.fijar_comparte_gimnasio(boolean), public.marcar_en_gimnasio(), public.entrenando_ahora() to authenticated;

create or replace function public.dejar_de_entrenar()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  delete from en_vivo where user_id = uid;
  delete from entrenos_compartidos where solicitante = uid or destinatario = uid;
end;
$$;

create or replace function public.sesion_cerrada_corta_el_entreno()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    delete from en_vivo where user_id = old.user_id;
    delete from entrenos_compartidos where solicitante = old.user_id or destinatario = old.user_id;
  exception when others then
    null;
  end;
  return null;
end;
$$;
revoke execute on function public.sesion_cerrada_corta_el_entreno() from public, anon, authenticated;

-- La tabla, después de que ya nadie la nombra.
drop table if exists public.en_el_gimnasio;

-- Las colgadas. El disparador de la 68 se lleva de paso sus vínculos.
do $$
declare r record;
begin
  for r in select distinct user_id from public.sesiones where estado = 'corriendo' loop
    perform public.cerrar_sesiones_vencidas(r.user_id);
  end loop;
end $$;

-- La versión sube a 72. Solo sube.
do $$
begin
  if public.version_del_esquema() < 72 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 72; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
