-- MIGRACIÓN 57 — "día 41" en cada foto (item 6.4)
--
-- Cada foto pasa de ser una foto suelta a ser un REGISTRO: dice el día de racha
-- en que se sacó. El rango NO se escribe (ya vive en el color del marco, 4.2).
-- Para eso el log guarda la racha de ese día. `registrar_dia` la anota de acá en
-- más, y los días viejos se rellenan una vez: los de después de la última
-- pérdida con su número exacto, y los de antes quedan sin número.
--
-- CORREGIDA EL 4/10/2026, ANTES DE APLICARLA. El relleno tenía tres problemas:
--  1. A los días de antes de la última pérdida les ponía "día 0": para ellos
--     `calcular_racha` devuelve cero (esos días ya viven en `racha_base`). Qué
--     día de racha era cada uno no se puede reconstruir, así que quedan en null
--     y la foto no muestra número. Un número inventado es peor que ninguno.
--  2. A los de después de la pérdida les faltaba sumar lo que quedó de antes
--     (`racha_base`): quien perdió con 12 y siguió, veía "día 1" en vez de "3".
--  3. Tocar los logs disparaba `logs_after_change`, que recalculaba los
--     planetas de cada día en adelante y dejaba sin planeta a las rachas viejas.
--     Ahora ese disparador no hace nada cuando lo que cambia es una etiqueta.

alter table public.logs add column if not exists racha_del_dia int;

-- `registrar_dia` anota la racha del día en el log. Igual que en schema.sql.
create or replace function public.registrar_dia(p_origen text default 'manual')
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
    return jsonb_build_object('bloqueado', true, 'pendiente', hoy, 'hasta', hasta);
  end if;

  select rango_actual into rango_antes from profiles where id = uid;
  insert into logs (user_id, fecha, origen)
    values (uid, hoy, p_origen)
    returning * into nuevo_log;
  select * into perfil from profiles where id = uid;
  -- La racha de ESTE día queda anotada en el log (item 6.4): el trigger del
  -- insert ya subió profiles.racha_actual, así que es la de recién.
  update logs set racha_del_dia = perfil.racha_actual where id = nuevo_log.id;
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

-- EL DISPARADOR DE LOS LOGS: un cambio que no mueve la racha no recalcula nada.
-- Va ANTES del relleno, que es justamente un cambio de esos. Igual que en
-- schema.sql.
create or replace function public.logs_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  desde date := coalesce(new.fecha, old.fecha);
  hasta date;
  base int;
  r int;
begin
  -- UN CAMBIO QUE NO MUEVE LA RACHA NO RECALCULA NADA (migración 57). Desde que
  -- el log guarda etiquetas —el día de racha, el planeta—, escribirlas es un
  -- UPDATE, y este disparador lo trataba como una corrección: volvía a contar
  -- la racha y a calcular los planetas de ese día en adelante. Para los días de
  -- antes de la última pérdida esa cuenta da "sin planeta", así que el relleno
  -- de la 57 —que toca todos los logs— borraba los planetas de las rachas
  -- viejas. Lo que mueve la racha es de quién es el día, qué día es y si es
  -- descanso; lo demás son etiquetas.
  if tg_op = 'UPDATE'
     and new.user_id = old.user_id and new.fecha = old.fecha and new.es_descanso = old.es_descanso then
    return new;
  end if;

  -- Perfil borrado (baja de cuenta): al borrar el perfil, la cascada arrastra
  -- todos sus logs y este trigger correría una vez por fila, recorriendo el
  -- historial completo cada vez, para terminar escribiendo sobre un perfil
  -- que ya no existe. Si no está, no hay nada que recalcular.
  if not exists (select 1 from profiles where id = uid) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Si el usuario borró a mano justo el día que estaba esperando, es una
  -- decisión suya y gana: sin esto, `resolver_pendiente` lo volvía a poner
  -- solo la próxima vez que se abría la app, deshaciendo un borrado adrede.
  if tg_op = 'DELETE' then
    update profiles set dia_pendiente = null, pendiente_desde = null
     where id = uid and dia_pendiente = old.fecha;
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
  -- pg_trigger_depth() corta la recursión de este mismo update, y el
  -- "is distinct from" evita escrituras que no cambian nada.
  if pg_trigger_depth() = 1 then
    update logs l set planeta_del_dia = c.nuevo
      from (
        select id, planeta_de_dia(r2) as nuevo
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

-- RELLENO DE UNA VEZ (solo datos, no schema): el día de racha de cada log
-- viejo. Solo los de DESPUÉS de la última pérdida, que es donde la cuenta es
-- exacta: lo que quedó de antes (`racha_base`) más los días seguidos hasta ese.
-- Solo lo que está en null, así correr la migración dos veces no lo recalcula.
update public.logs l
   set racha_del_dia = p.racha_base + calcular_racha(l.user_id, l.fecha)
  from public.profiles p
 where p.id = l.user_id
   and l.racha_del_dia is null
   and (p.perdida_fecha is null or l.fecha > p.perdida_fecha);

-- La versión sube a 57.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 57; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
