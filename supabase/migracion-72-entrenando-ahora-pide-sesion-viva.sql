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

-- MIGRACIÓN 72 — "ENTRENANDO AHORA" PIDE UNA SESIÓN VIVA
--
-- El bug (13/10, del gimnasio): un amigo seguía "entrenando" dos horas después
-- de terminar, y otro aparecía a las diez de la noche. La marca la ponía el
-- vigilante con solo estar adentro del radio del gimnasio, y duraba dos horas.
--
-- 1. `entrenando_ahora` pide además una sesión corriendo con señal de vida en
--    la última media hora. Se arregla en la base: vale para TODOS los
--    teléfonos en el acto, tengan la app que tengan.
-- 2. La marca guarda cuándo fue el último "sigo acá" (`visto`).
-- 3. SE CIERRAN LAS SESIONES QUE QUEDARON COLGADAS, con la regla de siempre
--    (`cerrar_sesiones_vencidas`): es lo mismo que les pasaría sola a cada una
--    la próxima vez que su dueño abra la app. ESTO REESCRIBE DATOS.

do $$
begin
  if public.version_del_esquema() < 71 then
    raise exception 'La migración 72 va después de la 71 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

alter table public.en_el_gimnasio add column if not exists visto timestamptz not null default now();
-- Las marcas que ya había: su último "sigo acá" fue dos horas antes de vencer.
update public.en_el_gimnasio set visto = hasta - interval '2 hours' where visto > hasta - interval '2 hours';

-- (las dos funciones son copia exacta de schema.sql)
create or replace function public.marcar_en_gimnasio()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if not exists (select 1 from profiles where id = uid and comparte_gimnasio) then return; end if;
  insert into en_el_gimnasio (user_id, desde, hasta, visto)
    values (uid, now(), now() + interval '2 hours', now())
    on conflict (user_id) do update
       set hasta = now() + interval '2 hours',
           visto = now(),
           -- Una marca vencida que se vuelve a poner es una vez NUEVA: sin esto
           -- `desde` quedaba en la primera vez que se marcó, hace días.
           desde = case when en_el_gimnasio.hasta > now() then en_el_gimnasio.desde else now() end;
end;
$$;

-- QUIÉN ESTÁ ENTRENANDO AHORA (migración 72). La marca sola NO alcanza: la pone
-- también el vigilante cada vez que el teléfono está adentro del radio del
-- gimnasio, haya o no entrenamiento, y dura dos horas. Así aparecía entrenando
-- quien había terminado hacía dos horas y quien vivía al lado.
-- Ahora hacen falta las dos cosas:
--   1. una SESIÓN CORRIENDO (terminar, o que se cierre sola, saca en el acto);
--   2. una SEÑAL DE VIDA en la última media hora: una serie, el inicio de la
--      sesión, o un "sigo acá" del teléfono (`visto`).
-- La media hora es `ventana_inactividad()`: la misma con la que la base da por
-- terminada una sesión. Sin batería, sin señal o con la app cerrada, nadie
-- queda entrenando más que eso.
create or replace function public.entrenando_ahora()
returns table (id uuid, username text, avatar_url text, desde timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.username, u.avatar_url, g.desde
    from en_el_gimnasio g
    join usuarios_publicos u on u.id = g.user_id
   where g.hasta > now()
     and g.user_id <> auth.uid()
     and public.son_amigos(auth.uid(), g.user_id)
     and exists (
           select 1
             from sesiones s
            where s.user_id = g.user_id
              and s.estado = 'corriendo'
              and greatest(s.inicio, s.ultima_actividad, g.visto) > now() - public.ventana_inactividad()
         )
   order by g.desde desc;
$$;

revoke execute on function public.marcar_en_gimnasio(), public.entrenando_ahora() from public, anon;
grant execute on function public.marcar_en_gimnasio(), public.entrenando_ahora() to authenticated;

-- Las colgadas. El disparador de la 68 se lleva de paso sus marcas y sus vínculos.
do $$
declare r record;
begin
  for r in select distinct user_id from public.sesiones where estado = 'corriendo' loop
    perform public.cerrar_sesiones_vencidas(r.user_id);
  end loop;
end $$;
delete from public.en_el_gimnasio where hasta <= now();

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
