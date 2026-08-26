-- =============================================================
-- MIGRACIÓN 23 — el punto del gimnasio y de dónde salió cada día
--
-- Va DESPUÉS de la 22. Ejecutar entera en el SQL Editor de Supabase.
-- =============================================================

-- Prepara el terreno para el registro automático por ubicación (§13), que en
-- nativo es geofencing del sistema operativo y en web es el atajo posible: si
-- abrís la app estando en el gimnasio, el día se registra sin apretar nada.
--
-- Va TODO junto —columnas, origen y la firma nueva— a propósito: partirlo en
-- dos migraciones significaría dos despliegues coordinados para una sola
-- feature.

-- -------------------------------------------------------------
-- EL PUNTO DEL GIMNASIO
-- -------------------------------------------------------------
-- Dato PRIVADO del usuario: no se comparte con amigos bajo ninguna
-- circunstancia (§13). No hace falta nada especial para eso —`profiles` es
-- solo del dueño por RLS y lo público sale por la vista `usuarios_publicos`,
-- que no los incluye—, pero queda dicho para que nadie los agregue ahí.
alter table public.profiles
  add column if not exists gimnasio_lat numeric(9, 6),
  add column if not exists gimnasio_lon numeric(9, 6),
  add column if not exists gimnasio_radio int not null default 100;

-- Un punto a medias no sirve: o están las dos coordenadas o no está ninguna.
alter table public.profiles drop constraint if exists profiles_gimnasio_completo;
alter table public.profiles add constraint profiles_gimnasio_completo
  check ((gimnasio_lat is null) = (gimnasio_lon is null));

alter table public.profiles drop constraint if exists profiles_gimnasio_rango;
alter table public.profiles add constraint profiles_gimnasio_rango
  check (
    (gimnasio_lat is null or gimnasio_lat between -90 and 90) and
    (gimnasio_lon is null or gimnasio_lon between -180 and 180)
  );

-- El GPS adentro de un edificio tiene 20 a 50 metros de error (§13), así que
-- menos de 50 es prometer una precisión que no existe. Y más de 300 empieza a
-- agarrar la cuadra entera, que es como no tener gimnasio.
alter table public.profiles drop constraint if exists profiles_gimnasio_radio_rango;
alter table public.profiles add constraint profiles_gimnasio_radio_rango
  check (gimnasio_radio between 50 and 300);

-- Se escriben directo, como las otras preferencias del dueño: no hay ningún
-- invariante que proteger más allá de los checks de arriba.
grant update (gimnasio_lat, gimnasio_lon, gimnasio_radio)
  on public.profiles to authenticated;

-- -------------------------------------------------------------
-- DE DÓNDE SALIÓ EL DÍA
-- -------------------------------------------------------------
-- Ubicación y salud hacen lo mismo: registrar el día por una señal que no es
-- un toque. Si cada una escribiera su propio camino habría dos lógicas de
-- "¿ya estaba registrado?, ¿pido la foto?, ¿aviso?". Las dos entran por
-- `registrar_dia` con su origen, y el origen queda guardado para poder saber
-- después qué días entraron solos.
alter table public.logs
  add column if not exists origen text not null default 'manual';

alter table public.logs drop constraint if exists logs_origen_valido;
alter table public.logs add constraint logs_origen_valido
  check (origen in ('manual', 'ubicacion', 'salud'));

-- -------------------------------------------------------------
-- `registrar_dia` con origen
-- -------------------------------------------------------------
-- DROP y create: agregar un parámetro no se puede con `create or replace` —
-- crearía una sobrecarga y dejaría viva la firma de dos argumentos, que es el
-- caso `hoy_uy()` de nuevo (spec/trampas.md).
drop function if exists public.registrar_dia(boolean, numeric);
create or replace function public.registrar_dia(
  p_es_descanso boolean default false,
  p_peso numeric default null,
  p_origen text default 'manual'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rango_antes int;
  perfil profiles;
  nuevo_log logs;
  hoy date := mi_hoy();
  hasta timestamptz := bloqueo_hasta(uid);
begin
  if hasta is not null then
    -- el día queda anotado; se registra solo cuando pase la ventana
    update profiles set dia_pendiente = hoy, pendiente_desde = now() where id = uid;
    if p_peso is not null then
      -- el peso sí se puede guardar ya: no depende del día
      insert into weights (user_id, fecha, valor) values (uid, hoy, p_peso)
        on conflict (user_id, fecha) do update set valor = excluded.valor;
    end if;
    return jsonb_build_object('bloqueado', true, 'pendiente', hoy, 'hasta', hasta);
  end if;

  select rango_actual into rango_antes from profiles where id = uid;
  insert into logs (user_id, fecha, es_descanso, origen)
    values (uid, hoy, p_es_descanso, p_origen)
    returning * into nuevo_log;
  if p_peso is not null then
    insert into weights (user_id, fecha, valor) values (uid, hoy, p_peso)
      on conflict (user_id, fecha) do update set valor = excluded.valor;
  end if;
  select * into perfil from profiles where id = uid;
  return jsonb_build_object(
    'bloqueado', false,
    'log_id', nuevo_log.id,
    'racha', perfil.racha_actual,
    'rango_antes', rango_antes,
    'rango_despues', perfil.rango_actual,
    'planeta', nuevo_log.planeta_del_dia,
    'subio_rango', perfil.rango_actual > rango_antes
  );
end;
$$;

-- Dropear la devuelve con EXECUTE para PUBLIC, que la abriría a `anon`. Es la
-- lección de la migración 22, y la agarró test-deriva cuando faltaba.
revoke execute on function public.registrar_dia(boolean, numeric, text)
  from public, anon, authenticated;
grant execute on function public.registrar_dia(boolean, numeric, text) to authenticated;
