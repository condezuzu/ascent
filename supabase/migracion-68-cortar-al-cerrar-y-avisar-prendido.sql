-- MIGRACIÓN 68 — EL VÍNCULO SE CORTA AL CERRARSE LA SESIÓN, Y "AVISAR CUANDO ENTRENO" NACE PRENDIDO
--
-- ESTA SÍ REESCRIBE DATOS: prende "Avisar cuando entreno" en las cuentas que
-- lo tenían apagado (era el valor por omisión). Por eso lleva una consulta de
-- comprobación al final de este archivo, comentada.
--
-- La app vieja no se entera de nada de esto.

do $$
begin
  if public.version_del_esquema() < 67 then
    raise exception 'La migración 68 va después de la 67 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- "AVISAR CUANDO ENTRENO", PRENDIDO PARA TODOS. Decidido el 12/10: apagado no
-- arranca nunca, y sin esto nadie aparece en "Entrenando ahora". La app lo
-- avisa una vez, con un botón a Ajustes para apagarlo.
alter table public.profiles alter column comparte_gimnasio set default true;
update public.profiles set comparte_gimnasio = true where not comparte_gimnasio;

-- (lo que sigue es copia exacta de schema.sql)
-- -------------------------------------------------------------
-- ENTRENAR CON OTRO, DOS ARREGLOS (migración 68)
-- -------------------------------------------------------------
-- 1. EL VÍNCULO SE CORTA CUANDO LA SESIÓN SE CIERRA, LA CIERRE QUIEN LA CIERRE.
--    Antes solo cortaba el botón "Terminar" del teléfono. Si la cerraba el
--    vigilante del gimnasio, la inactividad o deshacer el día, el otro seguía
--    viendo un entrenamiento viejo hasta tres horas. Va en un disparador y no
--    en cada función que cierra: la próxima que se agregue también corta.
--
--    NUNCA PUEDE IMPEDIR QUE LA SESIÓN SE CIERRE: si esto falla, se traga el
--    error. Cerrar la sesión es el dato; cortar el vínculo es limpieza.
create or replace function public.sesion_cerrada_corta_el_entreno()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    delete from en_vivo where user_id = old.user_id;
    delete from entrenos_compartidos where solicitante = old.user_id or destinatario = old.user_id;
    delete from en_el_gimnasio where user_id = old.user_id;
  exception when others then
    null;
  end;
  return null;
end;
$$;
revoke execute on function public.sesion_cerrada_corta_el_entreno() from public, anon, authenticated;

drop trigger if exists sesiones_al_cerrar_corta on public.sesiones;
create trigger sesiones_al_cerrar_corta
  after update of estado on public.sesiones
  for each row when (old.estado = 'corriendo' and new.estado <> 'corriendo')
  execute function public.sesion_cerrada_corta_el_entreno();

-- La sesión que se BORRA estando corriendo (deshacer el día se lleva el log, y
-- el log se lleva la sesión).
drop trigger if exists sesiones_al_borrar_corta on public.sesiones;
create trigger sesiones_al_borrar_corta
  after delete on public.sesiones
  for each row when (old.estado = 'corriendo')
  execute function public.sesion_cerrada_corta_el_entreno();

-- 2. LO QUE SE VE DEL OTRO ES DE ESTE VÍNCULO, no de un entrenamiento anterior.
--    Lo que publicó ANTES de que existiera el vínculo no se muestra: su
--    teléfono vuelve a publicar apenas ve el pedido, y hasta entonces dice
--    "todavía no empezó". (Es `mis_uniones` de la 67 con una línea más.)
create or replace function public.mis_uniones()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'estado', c.estado,
           'la_pedi_yo', c.solicitante = auth.uid(),
           'otro', jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url),
           'ahora', now(),
           'en_vivo', case when c.estado = 'aceptada' then (
             select jsonb_build_object(
                      'ejercicio', v.ejercicio, 'serie', v.serie, 'meta', v.meta,
                      'descanso_fin', v.descanso_fin, 'actualizado', v.actualizado)
               from en_vivo v where v.user_id = u.id and v.actualizado >= c.creado) end
         ) order by c.creado), '[]'::jsonb)
    from entrenos_compartidos c
    join usuarios_publicos u
      on u.id = case when c.solicitante = auth.uid() then c.destinatario else c.solicitante end
   where auth.uid() in (c.solicitante, c.destinatario)
     and c.hasta > now()
     and public.son_amigos(c.solicitante, c.destinatario);
$$;

-- La versión sube a 68. Solo sube: volver a pegar esta migración sobre una
-- base más nueva no la baja (pasaba con las anteriores).
do $$
begin
  if public.version_del_esquema() < 68 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 68; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;

-- COMPROBACIÓN (correla aparte, después): tiene que dar UNA fila con
-- `avisan` igual a `perfiles`.
--   select count(*) filter (where comparte_gimnasio) as avisan, count(*) as perfiles from public.profiles;
