-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 100 then
    raise exception 'Esta es la migración 100 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 100 — LA INVITACIÓN A UN GRUPO DURA 15 MINUTOS (2/11)
--
-- Hasta acá, dejar quemar la mecha de 10 segundos la borraba. Desde ahora la mecha es solo lo que
-- está en pantalla: la invitación sigue en Social hasta 15 minutos después de mandada, y ahí se
-- contesta. El pedido de unirse (`tipo = 'union'`) sigue con sus 3 horas: no se toca.
--
-- Una invitación vencida no se puede aceptar y no traba la siguiente: `limpiar_grupos`, que corre
-- primero en `responder_union`, `pedir_unirse` e `invitar_al_grupo`, borra lo que pasó su `hasta`.

do $$
begin
  if public.version_del_esquema() < 99 then
    raise exception 'La migración 100 va después de la 99 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

create or replace function public.invitar_al_grupo(p_a uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  suyo entrenos_compartidos;
  g uuid;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_a is null or p_a = uid or not public.son_amigos(uid, p_a) then return 'no-entrena'; end if;
  perform public.limpiar_grupos();
  if not public.entrena_ahora(uid) then return 'no-entreno'; end if;
  select * into suyo from entrenos_compartidos where estado = 'pendiente' and solicitante = p_a and destinatario = uid;
  if suyo.id is not null then
    delete from entrenos_compartidos where id = suyo.id;
    if suyo.tipo = 'invitacion' then return public.entrar_al_grupo(uid, p_a); end if;
    return public.entrar_al_grupo(p_a, uid);
  end if;
  if public.en_grupo(p_a) then return 'ocupado'; end if;
  g := public.grupo_de(uid);
  if (g is null and public.bloqueo_entre(uid, p_a))
     or (g is not null and ((select count(*) from grupo_miembros where grupo_id = g) >= public.tope_grupo()
                            or public.bloqueo_con_el_grupo(p_a, g))) then
    return 'ocupado';
  end if;
  if not exists (
       select 1 from sesiones s join profiles p on p.id = s.user_id and p.comparte_gimnasio
        where s.user_id = p_a and s.estado = 'corriendo'
          and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)) then
    return 'no-entrena';
  end if;
  delete from entrenos_compartidos where estado = 'pendiente' and solicitante = uid and destinatario = p_a and tipo = 'union';
  insert into entrenos_compartidos (solicitante, destinatario, hasta, tipo)
       values (uid, p_a, now() + interval '15 minutes', 'invitacion')
  on conflict do nothing;
  return 'ok';
end;
$$;

-- Las que ya estaban esperando pasan a la regla nueva.
update public.entrenos_compartidos
   set hasta = least(hasta, creado + interval '15 minutes')
 where estado = 'pendiente' and tipo = 'invitacion';

create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 100; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
