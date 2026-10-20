-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 92 then
    raise exception 'Esta es la migración 92 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 92 — EL CORAZÓN EN LAS FOTOS DEL PERFIL (19/10, a pedido)
--
-- Un corazón por persona y por foto. Se ve cuántos tiene y si le diste el tuyo;
-- QUIÉN lo dio no se lee nunca: la tabla no tiene permisos para la app, todo pasa
-- por dos funciones que solo contestan sobre fotos que quien pregunta puede ver
-- (la suya, o una visible de un amigo, con el bloqueo mirado por `son_amigos`).
-- A la foto propia no se le da corazón: el dueño solo ve la cuenta.
--
-- Una tabla y tres funciones: no toca datos. La app pregunta por la función y, si
-- todavía no está (PGRST202), no muestra el corazón.

do $$
begin
  if public.version_del_esquema() < 91 then
    raise exception 'La migración 92 va después de la 91 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

create table if not exists public.me_gusta_fotos (
  foto_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (foto_id, user_id)
);
-- Para borrar la cuenta sin recorrer la tabla entera.
create index if not exists me_gusta_fotos_usuario on public.me_gusta_fotos (user_id);
alter table public.me_gusta_fotos enable row level security;
revoke all on public.me_gusta_fotos from anon, authenticated;

-- La misma regla que las dos políticas de `photos`, para una foto suelta.
create or replace function public.puedo_ver_foto(p_foto uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from photos p
     where p.id = p_foto
       and (p.user_id = auth.uid()
            or (p.visibilidad = 'amigos' and public.son_amigos(auth.uid(), p.user_id)))
  );
$$;
revoke execute on function public.puedo_ver_foto(uuid) from public, anon;
grant execute on function public.puedo_ver_foto(uuid) to authenticated;

-- Cuántos corazones tiene cada foto y si uno es de quien pregunta. Las que no puede ver no vuelven.
create or replace function public.me_gusta_de_fotos(p_fotos uuid[])
returns table (foto_id uuid, cantidad int, mio boolean)
language sql stable security definer set search_path = public as $$
  select f.id,
         (select count(*)::int from me_gusta_fotos m where m.foto_id = f.id),
         exists (select 1 from me_gusta_fotos m where m.foto_id = f.id and m.user_id = auth.uid())
    from unnest(p_fotos) as f(id)
   where public.puedo_ver_foto(f.id);
$$;
revoke execute on function public.me_gusta_de_fotos(uuid[]) from public, anon;
grant execute on function public.me_gusta_de_fotos(uuid[]) to authenticated;

-- Dar o sacar el corazón, diciendo cuál de las dos: dos toques seguidos con el mismo
-- pedido dejan lo mismo (un "alternar" los cancelaba entre sí). Devuelve cómo quedó.
create or replace function public.marcar_me_gusta(p_foto uuid, p_mio boolean)
returns table (cantidad int, mio boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.puedo_ver_foto(p_foto)
     or exists (select 1 from photos p where p.id = p_foto and p.user_id = auth.uid()) then
    raise exception 'No se puede dar corazón a esta foto.' using errcode = '42501';
  end if;
  if p_mio then
    insert into me_gusta_fotos (foto_id, user_id) values (p_foto, auth.uid()) on conflict do nothing;
  else
    delete from me_gusta_fotos m where m.foto_id = p_foto and m.user_id = auth.uid();
  end if;
  return query
    select (select count(*)::int from me_gusta_fotos m where m.foto_id = p_foto),
           exists (select 1 from me_gusta_fotos m where m.foto_id = p_foto and m.user_id = auth.uid());
end;
$$;
revoke execute on function public.marcar_me_gusta(uuid, boolean) from public, anon;
grant execute on function public.marcar_me_gusta(uuid, boolean) to authenticated;

do $$
begin
  if public.version_del_esquema() < 92 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 92; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
