-- =============================================================
-- MIGRACIÓN 10 — descanso entre series (§18)
--
-- Para bases que YA tienen el schema aplicado. En una base nueva no hace
-- falta: schema.sql ya lo incluye todo.
-- Ejecutar entero en el SQL Editor de Supabase.
-- =============================================================

-- Cuánto dura el descanso entre series, en SEGUNDOS. Es lo único del
-- temporizador de descanso que toca la base: el descanso en curso vive en
-- localStorage y no deja rastro (§18.3). No hay ningún dato que valga
-- guardar —a nadie le sirve saber que descansó 94 segundos hace tres
-- semanas— y son quince o veinte descansos por sesión, en un subsuelo con
-- dos rayas de señal.
--
-- 180 = 3 minutos. Los presets (60/90/120/180/300) son constantes del
-- cliente, no filas: son cinco números iguales para todos.
alter table public.profiles
  add column if not exists duracion_descanso int not null default 180;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_duracion_descanso_check'
  ) then
    alter table public.profiles
      add constraint profiles_duracion_descanso_check
      check (duracion_descanso between 15 and 600);
  end if;
end $$;

-- Es una preferencia del dueño y no afecta a nadie más: se escribe directo,
-- como unidad_peso o sexo. No hace falta un RPC.
grant update (duracion_descanso) on public.profiles to authenticated;
