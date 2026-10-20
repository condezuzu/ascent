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

-- MIGRACIÓN 92 — EL CORAZÓN EN LAS RUTINAS (20/10, a pedido; reemplaza a la 92 de fotos,
-- que nunca se pegó)
--
-- Un corazón por persona y por rutina; tocarlo de nuevo lo quita. A la propia no se le da.
-- Cuántos tiene es público; QUIÉN lo dio no se lee nunca: la tabla no tiene permisos para
-- la app y todo pasa por dos funciones. Darlo pide poder ver la rutina: la activa de un
-- amigo que la comparte, la misma regla que `rutina_activa_de`.
--
-- Una tabla y tres funciones: no toca datos. La app pregunta por la función y, si
-- todavía no está (PGRST202), no muestra el corazón.

do $$
begin
  if public.version_del_esquema() < 91 then
    raise exception 'La migración 92 va después de la 91 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

create table if not exists public.me_gusta_rutinas (
  rutina_id uuid not null references public.rutinas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (rutina_id, user_id)
);
-- Para borrar la cuenta sin recorrer la tabla entera.
create index if not exists me_gusta_rutinas_usuario on public.me_gusta_rutinas (user_id);
alter table public.me_gusta_rutinas enable row level security;
revoke all on public.me_gusta_rutinas from anon, authenticated;

-- La regla de `rutina_activa_de`, para una rutina por su id.
create or replace function public.puedo_ver_rutina(p_rutina uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from rutinas r
      join profiles p on p.id = r.user_id
     where r.id = p_rutina
       and (r.user_id = auth.uid()
            or (r.activa and p.comparte_rutina and public.son_amigos(auth.uid(), r.user_id)))
  );
$$;
revoke execute on function public.puedo_ver_rutina(uuid) from public, anon;
grant execute on function public.puedo_ver_rutina(uuid) to authenticated;

-- Cuántos corazones tiene una rutina (público) y si uno es de quien pregunta.
create or replace function public.me_gusta_de_rutina(p_rutina uuid)
returns table (cantidad int, mio boolean)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from me_gusta_rutinas m where m.rutina_id = p_rutina),
         exists (select 1 from me_gusta_rutinas m where m.rutina_id = p_rutina and m.user_id = auth.uid())
   where auth.uid() is not null;
$$;
revoke execute on function public.me_gusta_de_rutina(uuid) from public, anon;
grant execute on function public.me_gusta_de_rutina(uuid) to authenticated;

-- Dar o sacar el corazón, diciendo cuál de las dos: la pantalla manda lo contrario de lo
-- que ve, y dos toques seguidos con el mismo pedido dejan lo mismo. Devuelve cómo quedó.
create or replace function public.marcar_me_gusta_rutina(p_rutina uuid, p_mio boolean)
returns table (cantidad int, mio boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.puedo_ver_rutina(p_rutina)
     or exists (select 1 from rutinas r where r.id = p_rutina and r.user_id = auth.uid()) then
    raise exception 'No se puede dar corazón a esta rutina.' using errcode = '42501';
  end if;
  if p_mio then
    insert into me_gusta_rutinas (rutina_id, user_id) values (p_rutina, auth.uid()) on conflict do nothing;
  else
    delete from me_gusta_rutinas m where m.rutina_id = p_rutina and m.user_id = auth.uid();
  end if;
  return query select * from public.me_gusta_de_rutina(p_rutina);
end;
$$;
revoke execute on function public.marcar_me_gusta_rutina(uuid, boolean) from public, anon;
grant execute on function public.marcar_me_gusta_rutina(uuid, boolean) to authenticated;

do $$
begin
  if public.version_del_esquema() < 92 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 92; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
