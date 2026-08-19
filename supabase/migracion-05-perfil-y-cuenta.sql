-- =============================================================
-- MIGRACIÓN 05 — preferencias de perfil y baja de cuenta
--
-- Para bases que YA tienen el schema aplicado. En una base nueva no hace
-- falta: schema.sql ya lo incluye todo.
-- Ejecutar entero en el SQL Editor de Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Preferencias que hasta ahora no existían
-- -------------------------------------------------------------

-- Visibilidad por defecto de las FOTOS NUEVAS. La visibilidad sigue siendo
-- por foto (§3): esto solo decide con qué valor nace cada una, para no tener
-- que elegir una por una.
alter table public.profiles
  add column if not exists visibilidad_default text not null default 'privada';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_visibilidad_default_check'
  ) then
    alter table public.profiles
      add constraint profiles_visibilidad_default_check
      check (visibilidad_default in ('privada','amigos'));
  end if;
end $$;

-- Unidad en la que el usuario escribe y lee su peso. El valor SIEMPRE se
-- guarda en kilos: la unidad es de presentación, no de almacenamiento. Si se
-- guardaran libras, cambiar la preferencia reinterpretaría el historial
-- entero y la tendencia daría un salto que no ocurrió.
alter table public.profiles
  add column if not exists unidad_peso text not null default 'kg';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_unidad_peso_check'
  ) then
    alter table public.profiles
      add constraint profiles_unidad_peso_check
      check (unidad_peso in ('kg','lb'));
  end if;
end $$;

-- Son preferencias del dueño y no afectan a nadie más: se escriben directo.
-- (racha_actual y compañía siguen fuera del alcance del cliente.)
grant update (visibilidad_default, unidad_peso) on public.profiles to authenticated;

-- -------------------------------------------------------------
-- 2. El trigger de logs se saltea el trabajo si el perfil ya no está
--
-- Al dar de baja una cuenta, borrar el perfil arrastra en cascada todos sus
-- logs, y este trigger corre UNA VEZ POR FILA. Cada corrida recalcula la
-- racha y recorre el historial completo, así que una cuenta con cientos de
-- días tardaba una eternidad en borrarse, para después escribir sobre un
-- perfil que ya no existe. Si el perfil no está, no hay nada que recalcular.
-- -------------------------------------------------------------
create or replace function public.logs_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  desde date := coalesce(new.fecha, old.fecha);
  hasta date;
  base int;
  r int;
begin
  -- perfil borrado (baja de cuenta): no hay nada que recalcular
  if not exists (select 1 from profiles where id = uid) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- La racha se mide hasta el último día registrado, NO hasta ayer.
  -- Con "hasta ayer", corregir a mano un día viejo estando cortado dejaba la
  -- racha en 0 al instante, salteándose la regla de -10: bajar la racha es
  -- tarea exclusiva de verificar_perdida.
  select coalesce(max(fecha), current_date) into hasta from logs where user_id = uid;
  select racha_base into base from profiles where id = uid;
  r := base + calcular_racha(uid, hasta);
  update profiles set
    racha_actual = r,
    -- el máximo sale del historial: si se borran días, baja
    mejor_racha = greatest(mejor_racha_real(uid), r),
    rango_actual = rango_de_racha(r)
  where id = uid;

  -- El planeta de un día depende de la racha que corría ESE día. Al corregir
  -- un día viejo a mano, los posteriores cambian de racha y su planeta queda
  -- viejo: el álbum mostraría la secuencia corrida. Se recalculan los días
  -- desde el que cambió en adelante.
  if pg_trigger_depth() = 1 then
    update logs l set planeta_del_dia = c.nuevo
      from (
        select id, case when r2 between 30 and 39 then planeta_de_dia(r2) else null end as nuevo
          from (
            select x.id, base + calcular_racha(uid, x.fecha) as r2
              from logs x
             where x.user_id = uid and not x.es_descanso and x.fecha >= desde
          ) t
      ) c
     where l.id = c.id and l.planeta_del_dia is distinct from c.nuevo;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- 3. Eliminar la cuenta
--
-- Borra la fila de auth.users; el resto se va en cascada desde profiles
-- (logs, fotos, pesos, descansos, amistades, retos, sugerencias).
--
-- Los ARCHIVOS del storage NO se borran acá: SQL puede sacar las filas de
-- storage.objects pero deja los archivos colgados en el bucket. El cliente
-- los borra por la API de storage ANTES de llamar a esto, y si eso falla no
-- llama: es preferible una cuenta viva a archivos huérfanos que nadie puede
-- alcanzar después, porque sin cuenta ya no hay quien tenga permiso.
--
-- No recibe parámetros a propósito: siempre borra al que la llama. Con un
-- p_usuario habría que confiar en que la RLS lo frene, y esto es SECURITY
-- DEFINER, así que la RLS no lo frenaría.
-- -------------------------------------------------------------
create or replace function public.eliminar_cuenta()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;

  -- challenges.ganador apunta a profiles SIN cascade: si esta cuenta ganó un
  -- reto ya cerrado, esa fila bloquearía el borrado. Se van primero, a mano.
  delete from challenges where retador = uid or rival = uid or ganador = uid;

  -- el resto cae solo: profiles referencia auth.users on delete cascade,
  -- y todas las tablas referencian profiles on delete cascade.
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.eliminar_cuenta() from public, anon;
grant execute on function public.eliminar_cuenta() to authenticated;
