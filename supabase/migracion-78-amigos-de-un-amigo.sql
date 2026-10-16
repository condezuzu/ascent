-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 78 then
    raise exception 'Esta es la migración 78 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 78 — LOS AMIGOS DE UN AMIGO
--
-- Una función: los amigos de un amigo, para verlos en su perfil y entrar al
-- de cada uno. De un extraño no devuelve nada.
--
-- No reescribe ningún dato.

do $$
begin
  if public.version_del_esquema() < 77 then
    raise exception 'La migración 78 va después de la 77 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- -------------------------------------------------------------
-- LOS AMIGOS DE UN AMIGO (migración 78)
-- -------------------------------------------------------------
-- En el perfil de un amigo se ven sus amigos, y se toca para entrar al perfil
-- de cada uno (pedido del 14/10). Devuelve solo los ids: quién es cada uno lo
-- dice `usuarios_publicos`, que ya saca a los bloqueados en los dos sentidos.
-- De un extraño no se ve nada: la amistad de dos personas que no conocés no es
-- asunto tuyo (por eso `son_amigos` solo contesta sobre una amistad propia).
create or replace function public.amigos_de(p_quien uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select case when f.solicitante = p_quien then f.destinatario else f.solicitante end
    from friendships f
   where auth.uid() is not null
     and (p_quien = auth.uid() or public.son_amigos(auth.uid(), p_quien))
     and f.estado = 'aceptada'
     and p_quien in (f.solicitante, f.destinatario);
$$;
revoke execute on function public.amigos_de(uuid) from public, anon;
grant execute on function public.amigos_de(uuid) to authenticated;

-- La versión sube a 78. Solo sube.
do $$
begin
  if public.version_del_esquema() < 78 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 78; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
