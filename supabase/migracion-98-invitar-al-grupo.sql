-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 98 then
    raise exception 'Esta es la migración 98 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 98 — INVITAR A UN AMIGO A TU GRUPO, Y VER EL GRUPO DE UN AMIGO (29/10)
--
-- Al tocar la burbuja de un amigo que entrena, en Inicio, ya no se abre su perfil: se abre una
-- burbuja encima. Si entrena sin grupo, «Invitar a un grupo»; si entrena con otros, cuántos son,
-- las caras y «Unirse al entrenamiento» (que es el `pedir_unirse` de siempre).
--
-- 1. LA INVITACIÓN es un pedido al revés: el mismo renglón de `entrenos_compartidos`, con
--    `tipo = 'invitacion'`. Aceptarla mete a quien la recibe en el grupo de quien la mandó. Una
--    app sin actualizar la ve como un pedido de unirse («X quiere unirse…»), pero contestarla
--    hace lo correcto: la diferencia la decide la base, no el teléfono.
-- 2. EL GRUPO DE UN AMIGO (`grupo_del_amigo`): cuántas personas son y quiénes. Solo de un amigo
--    que esté entrenando y lo muestre (la regla de `entrenando_ahora`). De los demás del grupo se
--    ve la cara solo si también muestran que entrenan; si no, cuentan pero no se ven.
--
-- No toca datos existentes: la columna nueva nace con 'union', que es lo que es todo lo que hay.

do $$
begin
  if public.version_del_esquema() < 97 then
    raise exception 'La migración 98 va después de la 97 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

alter table public.entrenos_compartidos add column if not exists tipo text not null default 'union';
alter table public.entrenos_compartidos drop constraint if exists entrenos_tipo_valido;
alter table public.entrenos_compartidos add constraint entrenos_tipo_valido check (tipo in ('union', 'invitacion'));

-- PEDIR UNIRSE, ahora sabiendo de invitaciones: si el otro me había invitado, pedir es aceptar
-- (entro a su grupo); y una invitación mía al mismo amigo se reemplaza por el pedido.
create or replace function public.pedir_unirse(p_a uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  suyo entrenos_compartidos;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_a is null or p_a = uid or not public.son_amigos(uid, p_a) then return 'no-entrena'; end if;
  perform public.limpiar_grupos();
  if public.en_grupo(uid) then return 'ya-unido'; end if;
  if public.grupo_de(p_a) is not null
     and ((select count(*) from grupo_miembros where grupo_id = public.grupo_de(p_a)) >= public.tope_grupo()
          or public.bloqueo_con_el_grupo(uid, public.grupo_de(p_a))) then
    return 'ocupado';
  end if;
  -- Él me lo había pedido a mí, o me había invitado: con pedirlo de vuelta alcanza.
  select * into suyo from entrenos_compartidos where estado = 'pendiente' and solicitante = p_a and destinatario = uid;
  if suyo.id is not null then
    delete from entrenos_compartidos where id = suyo.id;
    if suyo.tipo = 'invitacion' then return public.entrar_al_grupo(uid, p_a); end if;
    return public.entrar_al_grupo(p_a, uid);
  end if;
  if not exists (
       select 1 from sesiones s join profiles p on p.id = s.user_id and p.comparte_gimnasio
        where s.user_id = p_a and s.estado = 'corriendo'
          and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)) then
    return 'no-entrena';
  end if;
  delete from entrenos_compartidos where estado = 'pendiente' and solicitante = uid and destinatario = p_a and tipo = 'invitacion';
  insert into entrenos_compartidos (solicitante, destinatario, hasta)
       values (uid, p_a, now() + interval '3 hours')
  on conflict do nothing;
  return 'ok';
end;
$$;

-- INVITAR A UN GRUPO. Solo entrenando (el grupo es de quien entrena), solo a un amigo que entrena
-- y lo muestra, y que no esté ya en un grupo de verdad. Contesta como `pedir_unirse`: 'ok',
-- 'no-entreno' (yo no estoy entrenando), 'no-entrena', 'ocupado' (ya está en un grupo, mi grupo
-- está lleno o hay un bloqueo, sin decir cuál) o lo que diga `entrar_al_grupo` si él ya me lo
-- había pedido.
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
       values (uid, p_a, now() + interval '3 hours', 'invitacion')
  on conflict do nothing;
  return 'ok';
end;
$$;

-- CONTESTAR, con las invitaciones: aceptar una mete a quien la recibe en el grupo de quien la mandó.
create or replace function public.responder_union(p_id uuid, p_acepta boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c entrenos_compartidos;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform public.limpiar_grupos();
  select * into c from entrenos_compartidos
   where id = p_id and estado = 'pendiente'
     and (destinatario = uid or (public.grupo_de(uid) is not null and public.grupo_de(destinatario) = public.grupo_de(uid)));
  if c.id is null then return; end if;
  delete from entrenos_compartidos where id = c.id;
  if not coalesce(p_acepta, false) then return; end if;
  if not public.miembro_vivo(c.solicitante, now()) or not public.miembro_vivo(c.destinatario, now())
     or not public.miembro_vivo(uid, now()) then
    return;
  end if;
  if c.tipo = 'invitacion' then
    perform public.entrar_al_grupo(c.destinatario, c.solicitante);
  else
    perform public.entrar_al_grupo(c.solicitante, c.destinatario);
  end if;
end;
$$;

-- LO QUE VE MI PANTALLA, con el tipo de cada pedido.
create or replace function public.mis_uniones()
returns jsonb language sql stable security definer set search_path = public as $$
  with g as (
    select m.grupo_id as id from grupo_miembros m
     where m.user_id = auth.uid() and public.miembro_vivo(m.user_id, m.entro)
  ),
  lider as (select public.lider_de((select id from g)) as id),
  companeros as (
    select jsonb_build_object(
             'id', m.grupo_id,
             'estado', 'aceptada',
             -- Para la app de la tienda: "la pedí yo" = entré después que él.
             'la_pedi_yo', (select x.n from grupo_miembros x where x.user_id = auth.uid()) > m.n,
             'grupo', m.grupo_id,
             'lider', m.user_id = (select id from lider),
             'yo_lider', auth.uid() = (select id from lider),
             'otro', jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url),
             'ahora', now(),
             'en_vivo', (
               select jsonb_build_object(
                        'ejercicio', v.ejercicio, 'serie', v.serie, 'meta', v.meta,
                        'descanso_fin', v.descanso_fin, 'actualizado', v.actualizado)
                 from en_vivo v where v.user_id = m.user_id and v.actualizado >= m.entro - interval '1 minute')
           ) as j, 0 as tipo, m.entro as orden
      from grupo_miembros m
      join usuarios_publicos u on u.id = m.user_id
     where m.grupo_id = (select id from g) and m.user_id <> auth.uid()
       and public.miembro_vivo(m.user_id, m.entro)
  ),
  pedidos as (
    select jsonb_build_object(
             'id', c.id,
             'estado', 'pendiente',
             'tipo', c.tipo,
             'la_pedi_yo', c.solicitante = auth.uid(),
             'grupo', null,
             'lider', false,
             'yo_lider', auth.uid() = (select id from lider),
             'otro', jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url),
             'ahora', now(),
             'en_vivo', null
           ) as j, 1 as tipo, c.creado as orden
      from entrenos_compartidos c
      join usuarios_publicos u on u.id = case when c.solicitante = auth.uid() then c.destinatario else c.solicitante end
     where c.estado = 'pendiente' and c.hasta > now()
       and public.amigos_entre(c.solicitante, c.destinatario)
       and (c.solicitante = auth.uid() or c.destinatario = auth.uid()
            or ((select id from g) is not null and public.grupo_de(c.destinatario) = (select id from g)))
  )
  -- Primero los compañeros, después los pedidos.
  select coalesce((select jsonb_agg(j order by tipo, orden) from (select * from companeros union all select * from pedidos) t), '[]'::jsonb);
$$;

-- EL GRUPO DE UN AMIGO QUE ENTRENA: cuántos son y las caras que se pueden mostrar. `null` si no
-- es un amigo que entrena y lo muestra. 'personas' cuenta a todos; 'miembros' trae al amigo
-- primero y, de los demás, a quien también muestra que entrena (o a mí).
create or replace function public.grupo_del_amigo(p_amigo uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with visible as (
    select 1 from sesiones s join profiles p on p.id = s.user_id and p.comparte_gimnasio
     where s.user_id = p_amigo and s.estado = 'corriendo'
       and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
       and p_amigo <> auth.uid() and public.son_amigos(auth.uid(), p_amigo)
  ),
  miembros as (
    select m.user_id, m.entro, m.n from grupo_miembros m
     where m.grupo_id = public.grupo_de(p_amigo) and public.miembro_vivo(m.user_id, m.entro)
  )
  select case when exists (select 1 from visible) then jsonb_build_object(
    'personas', (select count(*) from miembros),
    'miembros', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url, 'racha', u.racha_actual)
                       order by m.user_id = p_amigo desc, m.entro, m.n)
        from miembros m
        join usuarios_publicos u on u.id = m.user_id
        join profiles p on p.id = m.user_id
       where m.user_id = p_amigo or m.user_id = auth.uid() or p.comparte_gimnasio), '[]'::jsonb))
  end;
$$;

revoke execute on function public.invitar_al_grupo(uuid), public.grupo_del_amigo(uuid) from public, anon;
grant execute on function public.invitar_al_grupo(uuid), public.grupo_del_amigo(uuid) to authenticated;

-- EL AVISO AL TELÉFONO, con su texto para cada tipo.
create or replace function public.avisar_pedido_de_union()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quien text;
begin
  if new.estado <> 'pendiente' then return new; end if;
  select username into quien from profiles where id = new.solicitante;
  if new.tipo = 'invitacion' then
    perform mandar_push(new.destinatario,
      coalesce(quien, 'Alguien') || ' te invita a su grupo.',
      coalesce(quien, 'Someone') || ' invited you to their group.',
      jsonb_build_object('aviso', 'union'));
    return new;
  end if;
  perform mandar_push(new.destinatario,
    coalesce(quien, 'Alguien') || ' quiere unirse a tu entrenamiento.',
    coalesce(quien, 'Someone') || ' wants to join your workout.',
    jsonb_build_object('aviso', 'union'));
  return new;
end;
$$;

-- La versión sube a 98.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 98; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
