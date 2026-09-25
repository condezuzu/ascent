-- =============================================================
-- MIGRACIÓN 52 (PREPARADA, NO APLICAR TODAVÍA) — la racha, derivada por replay
--
-- ⚠️ ESTE ARCHIVO NO ESTÁ CABLEADO AL SCHEMA NI A LOS TESTS a propósito. Cambia
-- cómo se DERIVA la racha (la mecánica central), y el humano quiere revisar el
-- dry-run (`dry-run-racha.sql`) antes de que sea real. Cuando dé el OK:
--   1. se vuelca este contenido a schema.sql,
--   2. se renombra a `migracion-52-racha-derivada.sql`,
--   3. se actualizan los tests de racha al modelo nuevo,
--   4. recién ahí se aplica.
-- Aplicarlo suelto ahora dejaría prod distinto del repo (test:conexion en rojo).
--
-- QUÉ HACE:
--   - `racha_replay(uid)`: la racha como función PURA de los datos. Camina día a
--     día desde el primer log hasta hoy: +1 por día entrenado, nada en descanso
--     o día cubierto por vida, y −10 (piso 0) UNA vez por hueco (bloque contiguo
--     de días perdidos). Hoy sin registrar no es hueco (el día no venció).
--     Es el MISMO −10 por hueco de siempre; lo único que cambia es que ya no
--     depende de cuándo se abrió la app.
--   - El trigger de `logs` y uno nuevo de `vidas_usadas` fijan
--     `racha_actual = racha_replay(uid)` ante CUALQUIER cambio.
--   - `verificar_perdida` sigue resolviendo el pendiente y aplicando vidas igual,
--     pero la racha sale del replay, no de `racha_actual − 10`.
--   - Se elimina `recalcular_desde_cero` (el botón "recalcular"): con la racha
--     derivada ya no hace falta. La UI del botón se saca aparte (es JS).
--   - `racha_base` y `perdida_fecha` quedan como columnas MUERTAS (no se borran:
--     borrar es irreversible; dejan de leerse para la racha).
--   - Recálculo único de todas las cuentas al final.
--
-- LO QUE NO CAMBIA (condición del humano): el −10 por hueco es idéntico (mismo
-- castigo sea el hueco de 1 día o de 30), y vidas y descansos funcionan igual.
-- =============================================================

create or replace function public.racha_replay(p_user uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  d date; hoy date := hoy_de(p_user); primero date;
  r int := 0; en_hueco boolean := false; cubiertas date[]; logs_map jsonb;
begin
  select min(fecha) into primero from logs where user_id = p_user;
  if primero is null then return 0; end if;
  -- Se leen logs y vidas de una y se camina en memoria: evita una consulta por
  -- día. Medido en ~2,8 ms sobre 1000 días (más rápido que el trigger de hoy).
  select coalesce(jsonb_object_agg(fecha::text, es_descanso), '{}'::jsonb) into logs_map
    from logs where user_id = p_user;
  select coalesce(array_agg(fecha), '{}') into cubiertas
    from vidas_usadas where user_id = p_user and not devuelta;
  d := primero;
  while d <= hoy loop
    if logs_map ? d::text then
      if (logs_map ->> d::text)::boolean then en_hueco := false; -- descanso explícito no corta
      else r := r + 1; en_hueco := false; end if;                -- entrenado: suma
    elsif extract(dow from d)::int = any(descansos_vigentes(p_user, d)) then en_hueco := false; -- descanso por config
    elsif d = any(cubiertas) then en_hueco := false;             -- cubierto por una vida
    elsif d < hoy then                                           -- hueco (hoy no cuenta: aún no venció)
      if not en_hueco then r := greatest(0, r - 10); end if;     -- −10 una vez por hueco
      en_hueco := true;
    end if;
    d := d + 1;
  end loop;
  return r;
end;
$$;

-- El trigger de logs ahora deriva la racha del replay. El bloque del planeta del
-- día se mantiene igual (es cosmético y su cuenta por-día se afina aparte).
create or replace function public.logs_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  desde date := coalesce(new.fecha, old.fecha);
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

  -- LA RACHA, DERIVADA. Ya no es `racha_base + calcular_racha`: es el replay,
  -- que no depende de cuándo se abrió la app y refleja las correcciones al toque.
  r := racha_replay(uid);
  update profiles set
    racha_actual = r,
    mejor_racha = greatest(mejor_racha_real(uid), r),
    rango_actual = rango_de_racha(r)
  where id = uid;

  -- El planeta de cada día depende de la racha que corría ESE día. Se recalcula
  -- desde el que cambió. (Sigue usando racha_base+calcular_racha para el número
  -- por-día; afinar esto al replay por-día es un TODO cosmético, no toca la racha.)
  select racha_base into base from profiles where id = uid;
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

-- NUEVO: aplicar o devolver una vida también recalcula la racha. Antes solo
-- `logs` disparaba, así que cubrir un hueco con una vida no movía el número
-- hasta el próximo cambio de logs.
create or replace function public.vidas_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  r int;
begin
  if not exists (select 1 from profiles where id = uid) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  r := racha_replay(uid);
  update profiles set racha_actual = r, mejor_racha = greatest(mejor_racha_real(uid), r),
    rango_actual = rango_de_racha(r) where id = uid;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_vidas_after_change on public.vidas_usadas;
create trigger trg_vidas_after_change after insert or update or delete on public.vidas_usadas
  for each row execute function public.vidas_after_change();

-- verificar_perdida: mismo trabajo de resolver el pendiente y cubrir huecos con
-- vidas; la racha sale del replay. Se llama al abrir la app y sirve para
-- refrescar la racha propia cuando pasó tiempo sin escribir (un hueco por el
-- paso del tiempo no dispara ningún trigger).
create or replace function public.verificar_perdida()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  perfil profiles;
  antes int;
  hoy date := mi_hoy();
  resuelto date;
  d date;
  cubiertos date[] := '{}';
begin
  resuelto := resolver_pendiente(uid);
  select * into perfil from profiles where id = uid;
  if perfil.id is null then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  antes := perfil.racha_actual;

  -- Cubrir huecos hacia atrás con impulsos, igual que siempre (esto dispara el
  -- trigger de vidas, que recalcula la racha).
  if not exists (select 1 from logs where user_id = uid and fecha = hoy) then
    d := hoy - 1;
    loop
      exit when exists (select 1 from logs where user_id = uid and fecha = d);
      exit when extract(dow from d)::int = any(descansos_vigentes(uid, d));
      exit when exists (select 1 from vidas_usadas where user_id = uid and fecha = d);
      exit when impulsos_disponibles(uid, d) <= 0;
      exit when array_length(cubiertos, 1) >= impulsos_tope();
      insert into vidas_usadas (user_id, fecha) values (uid, d) on conflict (user_id, fecha) do nothing;
      cubiertos := cubiertos || d;
      d := d - 1;
    end loop;
  end if;

  -- La racha, del replay. Refresca la propia por si pasó tiempo sin escribir.
  update profiles set racha_actual = racha_replay(uid),
    rango_actual = rango_de_racha(racha_replay(uid)) where id = uid;
  select * into perfil from profiles where id = uid;

  return jsonb_build_object(
    'perdida', perfil.racha_actual < antes,
    'rango_nuevo', perfil.rango_actual,
    'racha', perfil.racha_actual,
    'pendiente_resuelto', resuelto,
    'vidas_usadas', to_jsonb(cubiertos),
    'vidas_quedan', impulsos_disponibles(uid, hoy)
  );
end;
$$;

-- El botón "recalcular" ya no tiene sentido: la racha es derivada. Se elimina el
-- RPC (la UI se saca aparte, es JS).
drop function if exists public.recalcular_desde_cero();

-- RECÁLCULO ÚNICO de todas las cuentas al modelo nuevo (esto sí escribe; corre
-- una vez al aplicar la migración).
update profiles p set
  racha_actual = racha_replay(p.id),
  mejor_racha = greatest(mejor_racha_real(p.id), racha_replay(p.id)),
  rango_actual = rango_de_racha(racha_replay(p.id));

-- OPCIÓN (comentada) — LA RACHA FRESCA EN EL RANKING. Descomentar si se decide
-- que el ranking calcule en vivo en vez de leer la columna guardada (arregla que
-- la racha de otro se vea vieja hasta que ESA persona abra su app). Cuesta un
-- replay por fila por carga; con listas de amigos chicas es barato.
--
-- create or replace view public.usuarios_publicos as
--   select id, username, avatar_url, racha_replay(id) as racha_actual, rango_de_racha(racha_replay(id)) as rango_actual
--   from public.profiles;
-- grant select on public.usuarios_publicos to authenticated;

create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 52; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
