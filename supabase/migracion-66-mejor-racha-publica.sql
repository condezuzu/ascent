-- MIGRACIÓN 66 — LA MEJOR RACHA, A LA VISTA COMO LA DE HOY
--
-- La vista pública de usuarios suma `mejor_racha`: con eso Ranking dibuja la
-- medalla del rango más alto que alcanzó cada persona. No reescribe ningún
-- dato y la app vieja no se entera (pide las columnas que conoce).

do $$
begin
  if public.version_del_esquema() < 65 then
    raise exception 'La migración 66 va después de la 65 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- (el cuerpo es copia exacta de schema.sql)
create or replace view public.usuarios_publicos
with (security_invoker = off) as
  -- `mejor_racha` (migración 66): para la medalla del rango más alto que
  -- alcanzó cada uno, en Ranking. Es tan pública como la racha de hoy.
  select id, username, avatar_url, racha_actual, rango_actual, mejor_racha
  from public.profiles p
  where username is not null
    and not exists (
      select 1 from public.bloqueos b
       where (b.bloqueador = auth.uid() and b.bloqueado = p.id)
          or (b.bloqueador = p.id and b.bloqueado = auth.uid())
    );

grant select on public.usuarios_publicos to authenticated;

-- La versión sube a 66.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 66; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
