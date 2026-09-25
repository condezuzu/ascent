-- =============================================================
-- MIGRACIÓN 49 — el buzón de errores de JS sin atrapar
--
-- Va DESPUÉS de la 48. Ejecutar entera en el SQL Editor de Supabase.
--
-- POR QUÉ. Una actualización por el aire le llega a todos en segundos, y un
-- error de JS —no un crash nativo— NO aparece en el reporte de fallos de App
-- Store Connect: pasa en silencio. Este es el único lugar donde queda rastro de
-- que a alguien, en algún teléfono, la app le tiró.
--
-- QUÉ GUARDA Y QUÉ NO. Mensaje, pila, pantalla/contexto, versión de la app y de
-- OTA, plataforma y un id anónimo por instalación. NADA de datos personales ni
-- contenido del usuario: el id no se puede volver a una persona, es un número al
-- azar que solo sirve para saber si diez errores son de diez teléfonos o del
-- mismo.
--
-- QUIÉN ESCRIBE Y QUIÉN LEE. Inserta CUALQUIERA, con sesión o sin ella (un error
-- puede pasar en el login, antes de entrar). NADIE lee desde el cliente: no hay
-- policy de select, así que solo el dueño lo ve por el panel o con la service
-- key. Los `check` de largo acotan lo que un insert abierto puede meter.
--
-- Esta migración es el espejo EXACTO de lo que ya quedó en schema.sql, para que
-- las dos bases (schema desde cero / schema original + migraciones) no diverjan.
-- =============================================================

create table public.errores_js (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  mensaje text check (mensaje is null or char_length(mensaje) <= 2000),
  stack text check (stack is null or char_length(stack) <= 8000),
  pantalla text check (pantalla is null or char_length(pantalla) <= 300),
  version_app text check (version_app is null or char_length(version_app) <= 100),
  version_ota text check (version_ota is null or char_length(version_ota) <= 100),
  plataforma text check (plataforma is null or char_length(plataforma) <= 40),
  id_anonimo text check (id_anonimo is null or char_length(id_anonimo) <= 100)
);

alter table public.errores_js enable row level security;

-- Inserta CUALQUIERA, con sesión o sin ella. Nadie lee desde el cliente: sin
-- policy de select, solo el dueño lo ve por el panel / service key.
create policy "errores: insertar" on public.errores_js for insert with check (true);

-- SOLO insert, y para los DOS roles (un error puede pasar sin sesión). Sin
-- select para nadie. Se parte de cero, igual que el resto del schema.
revoke all on table public.errores_js from anon, authenticated;
grant insert on public.errores_js to authenticated, anon;

-- -------------------------------------------------------------
-- LA VERSIÓN DEL ESQUEMA
-- La última migración la reescribe con su número (lo exige test:db).
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 49; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
