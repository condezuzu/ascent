-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 73 then
    raise exception 'Esta es la migración 73 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 73 — ENTRENAR CON OTRO: EL VÍNCULO SIGUE A LA SESIÓN, Y ES DE A DOS
--
-- De la cacería del 13/10, todo reproducido corriéndolo:
-- 1. COMPAÑERO FANTASMA: quien se iba sin tocar "Terminar" seguía en "Entrenando
--    contigo" hasta tres horas. `mis_uniones` ahora usa `vinculo_vivo`.
-- 2. Se podía pedir unirse a quien ya no entrenaba (la lista del teléfono puede
--    ser vieja) y aceptar sin estar entrenando: el pedido quedaba tres horas.
-- 3. DE A DOS: quien ya estaba unido podía aceptar a un segundo. Ya no; el que
--    pide recibe 'ocupado' y el teléfono se lo dice. `pedir_unirse` pasa a
--    contestar texto: los teléfonos sin actualizar no miran la respuesta.
-- 4. `entrenando_ahora` deja de entregar la hora de inicio de la sesión, que
--    ninguna pantalla usaba (la había metido la 72).
--
-- No reescribe ningún dato. Cambiar lo que devuelve una función pide borrarla
-- antes: por eso los dos `drop`.

do $$
begin
  if public.version_del_esquema() < 72 then
    raise exception 'La migración 73 va después de la 72 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

drop function if exists public.pedir_unirse(uuid);
drop function if exists public.entrenando_ahora();

-- (todas las funciones son copia exacta de schema.sql)
create or replace function public.vinculo_vivo(p_solicitante uuid, p_destinatario uuid, p_hasta timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select p_hasta > now()
     and not exists (
           select 1
             from sesiones s
            where s.user_id in (p_solicitante, p_destinatario)
              and s.estado = 'corriendo'
              and not public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
         );
$$;
revoke execute on function public.vinculo_vivo(uuid, uuid, timestamptz) from public, anon, authenticated;

create or replace function public.entrena_con_otro(p_quien uuid, p_salvo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from entrenos_compartidos c
     where c.estado = 'aceptada'
       and p_quien in (c.solicitante, c.destinatario)
       and p_salvo not in (c.solicitante, c.destinatario)
       and public.vinculo_vivo(c.solicitante, c.destinatario, c.hasta)
  );
$$;
revoke execute on function public.entrena_con_otro(uuid, uuid) from public, anon, authenticated;

create or replace function public.pedir_unirse(p_a uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_a is null or p_a = uid or not public.son_amigos(uid, p_a) then return 'no-entrena'; end if;
  delete from entrenos_compartidos
   where least(solicitante, destinatario) = least(uid, p_a)
     and greatest(solicitante, destinatario) = greatest(uid, p_a)
     and not public.vinculo_vivo(solicitante, destinatario, hasta);
  if public.entrena_con_otro(uid, p_a) then return 'ya-unido'; end if;
  if public.entrena_con_otro(p_a, uid) then return 'ocupado'; end if;
  -- Él me lo había pedido a mí (y sigue vivo: lo de arriba borró lo que no).
  if exists (select 1 from entrenos_compartidos where solicitante = p_a and destinatario = uid) then
    update entrenos_compartidos set estado = 'aceptada', hasta = now() + interval '3 hours'
     where solicitante = p_a and destinatario = uid;
    delete from entrenos_compartidos
     where estado = 'pendiente' and (uid in (solicitante, destinatario) or p_a in (solicitante, destinatario));
    return 'ok';
  end if;
  if not exists (
       select 1
         from sesiones s
         join profiles p on p.id = s.user_id and p.comparte_gimnasio
        where s.user_id = p_a and s.estado = 'corriendo'
          and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)) then
    return 'no-entrena';
  end if;
  insert into entrenos_compartidos (solicitante, destinatario, hasta)
       values (uid, p_a, now() + interval '3 hours')
  on conflict do nothing;
  return 'ok';
end;
$$;

create or replace function public.responder_union(p_id uuid, p_acepta boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c entrenos_compartidos;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if not coalesce(p_acepta, false) then
    delete from entrenos_compartidos where id = p_id and destinatario = uid and estado = 'pendiente';
    return;
  end if;
  select * into c from entrenos_compartidos where id = p_id and destinatario = uid and estado = 'pendiente';
  if c.id is null then return; end if;
  if not public.vinculo_vivo(c.solicitante, c.destinatario, c.hasta)
     or public.entrena_con_otro(uid, c.solicitante)
     or public.entrena_con_otro(c.solicitante, uid) then
    delete from entrenos_compartidos where id = c.id;
    return;
  end if;
  update entrenos_compartidos set estado = 'aceptada', hasta = now() + interval '3 hours' where id = c.id;
  delete from entrenos_compartidos
   where estado = 'pendiente' and (uid in (solicitante, destinatario) or c.solicitante in (solicitante, destinatario));
end;
$$;

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
     and public.vinculo_vivo(c.solicitante, c.destinatario, c.hasta)
     and public.son_amigos(c.solicitante, c.destinatario);
$$;

create or replace function public.entrenando_ahora()
returns table (id uuid, username text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select u.id, u.username, u.avatar_url
    from sesiones s
    join profiles p on p.id = s.user_id and p.comparte_gimnasio
    join usuarios_publicos u on u.id = s.user_id
   where s.estado = 'corriendo'
     and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
     and s.user_id <> auth.uid()
     and public.son_amigos(auth.uid(), s.user_id)
   order by s.inicio desc;
$$;

revoke execute on function public.pedir_unirse(uuid), public.responder_union(uuid, boolean), public.mis_uniones(), public.entrenando_ahora() from public, anon;
grant execute on function public.pedir_unirse(uuid), public.responder_union(uuid, boolean), public.mis_uniones(), public.entrenando_ahora() to authenticated;

-- La versión sube a 73. Solo sube.
do $$
begin
  if public.version_del_esquema() < 73 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 73; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
