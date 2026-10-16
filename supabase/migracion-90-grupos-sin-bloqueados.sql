-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 90 then
    raise exception 'Esta es la migración 90 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 90 — EL GRUPO NO JUNTA A DOS QUE SE BLOQUEARON (cacería ronda 9, 16/10)
--
-- La 88 miraba el bloqueo solo contra quien armó el grupo (el link) o contra a quién
-- se le pedía. Con un amigo en común, dos que se bloquearon quedaban en el mismo
-- grupo: la lista los escondía (`usuarios_publicos`), pero `en_vivo` y
-- `grupo_miembros` se leían igual, con el ejercicio y el descanso del otro.
--
-- Ahora no se entra a un grupo donde hay alguien bloqueado, de cualquiera de los
-- dos lados: se contesta "ocupado", que no delata el bloqueo. Y si el bloqueo llega
-- con los dos adentro, dejan de leerse sin echar a nadie.
--
-- Solo funciones y una política: la app no cambia y se puede pegar cuando sea.

do $$
begin
  if public.version_del_esquema() < 89 then
    raise exception 'La migración 90 va después de la 89 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- ¿Hay un bloqueo entre estos dos? Sin mirar quién pregunta (`hay_bloqueo` solo
-- contesta si uno de los dos es quien llama, y a un pedido lo acepta cualquiera del
-- grupo). Interna: abierta, cualquiera podría preguntar quién bloqueó a quién.
create or replace function public.bloqueo_entre(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bloqueos
     where (bloqueador = a and bloqueado = b) or (bloqueador = b and bloqueado = a)
  );
$$;

create or replace function public.bloqueo_con_el_grupo(p_quien uuid, p_grupo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from grupo_miembros m
     where m.grupo_id = p_grupo and public.bloqueo_entre(p_quien, m.user_id)
  );
$$;

-- Mete a alguien en el grupo de `p_con` (o arma uno con los dos). Devuelve el resultado.
-- Lleno o con alguien bloqueado: "ocupado", ANTES de sacarlo de su grupo de uno.
create or replace function public.entrar_al_grupo(p_quien uuid, p_con uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  g uuid := public.grupo_de(p_con);
begin
  if public.en_grupo(p_quien) then return 'ya-unido'; end if;
  if g is null then
    if public.bloqueo_entre(p_quien, p_con) then return 'ocupado'; end if;
  elsif (select count(*) from grupo_miembros where grupo_id = g) >= public.tope_grupo()
        or public.bloqueo_con_el_grupo(p_quien, g) then
    return 'ocupado';
  end if;
  -- El que estaba solo deja su grupo de uno.
  delete from grupo_miembros where user_id = p_quien;
  delete from grupos_entreno x where not exists (select 1 from grupo_miembros m where m.grupo_id = x.id);
  if g is null then
    insert into grupos_entreno default values returning id into g;
    insert into grupo_miembros (user_id, grupo_id) values (p_con, g);
  end if;
  insert into grupo_miembros (user_id, grupo_id) values (p_quien, g);
  delete from entrenos_compartidos where estado = 'pendiente' and solicitante = p_quien;
  return 'ok';
end;
$$;

-- PEDIR UNIRSE: igual que en la 88, y "ocupado" también si en el grupo del otro hay
-- alguien bloqueado. Antes quedaba un pedido que nadie podía aceptar.
create or replace function public.pedir_unirse(p_a uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
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
  -- Él me lo había pedido a mí: con pedirlo de vuelta alcanza para estar juntos.
  if exists (select 1 from entrenos_compartidos where estado = 'pendiente' and solicitante = p_a and destinatario = uid) then
    delete from entrenos_compartidos where estado = 'pendiente' and solicitante = p_a and destinatario = uid;
    return public.entrar_al_grupo(p_a, uid);
  end if;
  if not exists (
       select 1 from sesiones s join profiles p on p.id = s.user_id and p.comparte_gimnasio
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

-- Los del grupo se leen entre sí, salvo dos que se bloquearon (el bloqueo pudo
-- llegar con los dos adentro). La fila propia también pasa por acá.
create or replace function public.en_mi_grupo(p_otro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.grupo_de(auth.uid()) is not null and public.grupo_de(p_otro) = public.grupo_de(auth.uid())
     and not public.bloqueo_entre(auth.uid(), p_otro);
$$;

drop policy if exists "grupo: los del grupo" on public.grupo_miembros;
create policy "grupo: los del grupo" on public.grupo_miembros for select
  using (public.en_mi_grupo(user_id));

revoke execute on function public.bloqueo_entre(uuid, uuid), public.bloqueo_con_el_grupo(uuid, uuid),
  public.entrar_al_grupo(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mi_grupo(), public.en_mi_grupo(uuid) from public, anon;
grant execute on function public.mi_grupo(), public.en_mi_grupo(uuid) to authenticated;

do $$
begin
  if public.version_del_esquema() < 90 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 90; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
