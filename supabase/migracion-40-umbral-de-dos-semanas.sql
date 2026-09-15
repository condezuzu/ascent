-- =============================================================
-- MIGRACIÓN 40 — el aviso de estancamiento, también a las 2 semanas
--
-- Va DESPUÉS de la 39. Ejecutar entera en el SQL Editor de Supabase.
--
-- ADITIVA: la columna ya existe y solo acepta un valor más. Nadie queda con un
-- valor inválido. Se puede correr antes o después del deploy: la opción de
-- dos semanas no aparece hasta que la base diga 40.
-- =============================================================

-- -------------------------------------------------------------
-- 1. EL CHEQUEO DE LA COLUMNA
-- -------------------------------------------------------------
-- La 30 lo creó sin nombre (`check (umbral_estancamiento in (3, 6, 8))`), así
-- que el nombre lo puso Postgres. Se busca por lo que dice y no por cómo se
-- llama: si en esta base se llamara distinto, un `drop constraint` por nombre
-- no borraría nada y el `add` dejaría dos chequeos, el viejo ganando.
do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.profiles'::regclass
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%umbral_estancamiento%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.profiles
  add constraint profiles_umbral_estancamiento_check
  check (umbral_estancamiento in (2, 3, 6, 8));

-- -------------------------------------------------------------
-- 2. LA VERSIÓN
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 40; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
