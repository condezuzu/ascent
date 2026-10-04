-- MIGRACIÓN 61 — LA MEJOR RACHA NO BAJA SOLA DESPUÉS DE UNA PÉRDIDA
--
-- EL BUG (4/10/2026). Perder la racha resta 10 y lo que sobrevive se arrastra
-- (§12): 40 días, se pierde, quedan 30; 25 días más y la racha dice 55. El récord
-- guardado era 55. Pero el disparador de los logs lo recalculaba en cada día como
-- `greatest(mejor_racha_real, racha de hoy)`, y `mejor_racha_real` cuenta tiradas
-- de días seguidos: de ese historial saca 40. El 55 estaba sostenido solo por la
-- racha. Con la pérdida siguiente (45) y el primer día registrado después (46),
-- el récord pasaba a 46. Sin borrar nada.
--
-- EL ARREGLO. El récord guardado deja de recalcularse entero en cada día:
--   - cuando ENTRA un día, se queda como está y solo puede subir (con la racha,
--     o con una tirada del historial, como siempre);
--   - cuando se BORRA o se cambia un día, el historial pasa a ser su techo: si
--     ya no lo sostiene, baja. Es la regla de siempre —un récord de días
--     anotados por error tiene que poder corregirse—.
-- El techo es `techo_de_mejor_racha`, que cuenta el historial como cuenta la
-- racha: un corte resta 10, no vuelve a cero. Solo se usa para BAJAR.
--
-- LO QUE NO HACE: no repone el récord a quien el bug ya se lo bajó. No hay cómo
-- saber, desde el historial, qué número llegó a ver cada persona: la primera
-- versión de esta migración lo intentaba y le subía el récord a cuentas que
-- nunca lo tuvieron (las que perdieron la racha por el bug de la 59, o las que
-- recalcularon desde cero). Para mirarlo a mano hay una consulta en
-- spec/dia-de-aprobacion.md §2.9.
--
-- VA EN SU LUGAR, DESPUÉS DE LA 60. Vuelve a definir `logs_after_change`, que
-- desde la 57 escribe una columna que el esquema 53 no tiene: correrla antes
-- rompería el registro de días. Por eso se niega sola si la base no está en 60.
do $$
begin
  if public.version_del_esquema() < 60 then
    raise exception 'La migración 61 va después de la 60 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- LAS TRES FUNCIONES, copiadas tal cual de schema.sql.

create or replace function public.techo_de_mejor_racha(p_user uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  anterior date := null;
  corriente int := 0;
  maximo int := 0;
  d date;
begin
  for r in
    select fecha, es_descanso from logs where user_id = p_user order by fecha
  loop
    if anterior is not null then
      d := anterior + 1;
      while d < r.fecha loop
        if not (extract(dow from d)::int = any(descansos_vigentes(p_user, d)))
           and not exists (
             select 1 from vidas_usadas
              where user_id = p_user and fecha = d and not devuelta
           )
        then
          corriente := greatest(0, corriente - 10);
          exit;
        end if;
        d := d + 1;
      end loop;
    end if;
    if not r.es_descanso then corriente := corriente + 1; end if;
    if corriente > maximo then maximo := corriente; end if;
    anterior := r.fecha;
  end loop;
  return maximo;
end;
$$;

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
    -- EL RÉCORD NO BAJA SOLO (migración 61). Antes era
    -- `greatest(mejor_racha_real, r)` a secas: un récord hecho con racha
    -- arrastrada (40 días, se pierde, 25 más: 55) no salía del historial, que
    -- da 40, así que lo sostenía solo la racha y con la pérdida siguiente
    -- bajaba a 46 sin que se borrara nada.
    --  - Al ENTRAR un día, el récord guardado se queda: solo puede subir.
    --  - Al BORRAR o cambiar un día, el historial es el techo: si ya no lo
    --    sostiene, baja. Es la regla de siempre —un récord de días anotados
    --    por error tiene que poder corregirse—.
    mejor_racha = greatest(
      case when tg_op = 'INSERT' then mejor_racha
           else least(mejor_racha, techo_de_mejor_racha(uid)) end,
      mejor_racha_real(uid),
      r),
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
    -- Recalcular es mirar el historial de nuevo: el techo vale (ver `logs_after_change`).
    mejor_racha = greatest(least(mejor_racha, techo_de_mejor_racha(uid)), mejor_racha_real(uid), r),
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

revoke execute on function public.techo_de_mejor_racha(uuid) from public, anon, authenticated;

-- La versión sube a 61.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 61; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
