-- =============================================================
-- REVERTIR LA MIGRACIÓN 53 (racha por replay) — VOLVER AL MODELO VIEJO
--
-- POR QUÉ. La 53 se aplicó sin el dry-run y dio MAL: una racha real de 39 pasó
-- a 69. Son tres castigos de −10 que el modelo viejo cobraba y el replay no
-- detecta. Hasta entender por qué, se vuelve al modelo viejo, que es correcto.
--
-- SE PUEDE REVERTIR SIN PERDER DATOS porque la 53 dejó `racha_base` y
-- `perdida_fecha` intactas (columnas "muertas" que no borró). El modelo viejo
-- deriva la racha de esas dos + los logs, así que restaurar las funciones y
-- recomputar devuelve el número correcto.
--
-- CÓMO SE APLICA. En el SQL Editor de Supabase, todo de una (es una
-- transacción). Después, en la máquina: `npm run test:conexion` tiene que
-- quedar en VERDE —prod vuelve a la versión 52, igual que el repo—.
--
-- ESTE ARCHIVO NO ES `migracion-NN`: no sube la versión, la BAJA de 53 a 52
-- para volver a alinear prod con el repo. Por eso queda fuera del set numerado.
-- =============================================================

begin;

-- 1) FUNCIÓN DE LOGS, versión vieja (racha = racha_base + calcular_racha).
create or replace function public.logs_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  desde date := coalesce(new.fecha, old.fecha);
  hasta date;
  base int;
  r int;
begin
  if not exists (select 1 from profiles where id = uid) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update profiles set dia_pendiente = null, pendiente_desde = null
     where id = uid and dia_pendiente = old.fecha;
  end if;

  select coalesce(max(fecha), current_date) into hasta from logs where user_id = uid;
  select racha_base into base from profiles where id = uid;
  r := base + calcular_racha(uid, hasta);
  update profiles set
    racha_actual = r,
    mejor_racha = greatest(mejor_racha_real(uid), r),
    rango_actual = rango_de_racha(r)
  where id = uid;

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

-- 2) VERIFICAR_PERDIDA, versión vieja (el −10 por corte, path-dependiente pero
--    correcto: es el que cobraba los tres castigos que el replay perdía).
create or replace function public.verificar_perdida()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  perfil profiles;
  viva int;
  nuevo_rango int;
  nueva_racha int;
  hoy date := mi_hoy();
  resuelto date;
  d date;
  cubiertos date[] := '{}';
begin
  resuelto := resolver_pendiente(uid);

  select * into perfil from profiles where id = uid;
  if perfil.id is null or perfil.racha_actual = 0 then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  if exists (select 1 from logs where user_id = uid and fecha = hoy) then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  viva := perfil.racha_base + calcular_racha(uid, hoy - 1);
  if viva >= perfil.racha_actual then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;

  d := hoy - 1;
  loop
    exit when perfil.perdida_fecha is not null and d <= perfil.perdida_fecha;
    exit when exists (select 1 from logs where user_id = uid and fecha = d);
    exit when extract(dow from d)::int = any(descansos_vigentes(uid, d));
    exit when exists (select 1 from vidas_usadas where user_id = uid and fecha = d);
    exit when impulsos_disponibles(uid, d) <= 0;
    insert into vidas_usadas (user_id, fecha) values (uid, d)
      on conflict (user_id, fecha) do nothing;
    cubiertos := cubiertos || d;
    d := d - 1;
    exit when array_length(cubiertos, 1) >= impulsos_tope();
  end loop;

  if array_length(cubiertos, 1) > 0 then
    viva := perfil.racha_base + calcular_racha(uid, hoy - 1);
    if viva >= perfil.racha_actual then
      return jsonb_build_object(
        'perdida', false,
        'pendiente_resuelto', resuelto,
        'vidas_usadas', to_jsonb(cubiertos),
        'vidas_quedan', impulsos_disponibles(uid, hoy)
      );
    end if;
  end if;

  nueva_racha := greatest(0, perfil.racha_actual - 10);
  nuevo_rango := rango_de_racha(nueva_racha);
  update profiles set
    racha_actual = nueva_racha,
    racha_base = nueva_racha,
    rango_actual = nuevo_rango,
    perdida_fecha = hoy - 1
  where id = uid;
  return jsonb_build_object('perdida', true, 'rango_anterior', perfil.rango_actual,
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha, 'pendiente_resuelto', resuelto,
    'vidas_usadas', to_jsonb(cubiertos),
    'vidas_quedan', impulsos_disponibles(uid, hoy));
end;
$$;

-- 3) RECALCULAR_DESDE_CERO, que la 53 había borrado.
create or replace function public.recalcular_desde_cero()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hasta date;
  r int;
  perdida jsonb;
  perfil profiles;
begin
  select coalesce(max(fecha), mi_hoy()) into hasta from logs where user_id = uid;
  update profiles set racha_base = 0, perdida_fecha = null where id = uid;
  r := calcular_racha(uid, hasta);
  update profiles set
    racha_actual = r,
    mejor_racha = greatest(mejor_racha_real(uid), r),
    rango_actual = rango_de_racha(r)
  where id = uid;
  perdida := verificar_perdida();
  select * into perfil from profiles where id = uid;
  return jsonb_build_object(
    'racha', perfil.racha_actual,
    'rango', perfil.rango_actual,
    'racha_historial', r,
    'perdida', coalesce((perdida ->> 'perdida')::boolean, false)
  );
end;
$$;

-- SUS PERMISOS. La 53 la había DROPeado; recrearla con `create or replace` le
-- deja el grant por defecto de Postgres (EXECUTE a PUBLIC). El repo la quiere
-- solo para `authenticated`. Sin estas dos líneas, test:conexion queda en rojo
-- por "permisos más abiertos de lo que debería". (Se descubrió en el cierre.)
revoke execute on function public.recalcular_desde_cero() from public;
grant execute on function public.recalcular_desde_cero() to authenticated;

-- 4) SACAR LO QUE AGREGÓ LA 53. El trigger de vidas es nuevo (antes solo logs
--    disparaba); las funciones del replay ya no las referencia nadie después
--    de restaurar las de arriba.
drop trigger if exists trg_vidas_after_change on public.vidas_usadas;
drop function if exists public.vidas_after_change();
drop function if exists public.racha_replay_de_muchos(uuid[]);
drop function if exists public.racha_replay(uuid);

-- 5) RECOMPUTAR la racha de TODOS con el modelo viejo. Es exactamente lo que
--    escribía `logs_after_change`: racha_base + calcular_racha hasta el último
--    día registrado. racha_base y perdida_fecha están intactas, así que esto
--    devuelve el número de antes de la 53 (para la cuenta del humano, 39).
update profiles p set
  racha_actual = calc.r,
  mejor_racha = greatest(public.mejor_racha_real(p.id), calc.r),
  rango_actual = public.rango_de_racha(calc.r)
from (
  select pr.id,
         pr.racha_base + public.calcular_racha(
           pr.id,
           coalesce((select max(fecha) from logs where user_id = pr.id), public.hoy_de(pr.id))
         ) as r
    from profiles pr
) calc
where p.id = calc.id;

-- 6) VOLVER A LA VERSIÓN 52 (la del repo). Con esto test:conexion queda verde.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 52; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;

commit;

-- Comprobación (opcional, corré aparte para ver tu número):
--   select racha_actual, racha_base, perdida_fecha from profiles where id = auth.uid();
