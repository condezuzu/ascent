-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 101 then
    raise exception 'Esta es la migración 101 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 101 — CORREGIR UN DÍA DEL PASADO NO TE DEJA LA RACHA EN CERO (5/11)
--
-- Lo contó un usuario: «cuando corregís el día no se sigue tu racha, empezás de cero». Los días hasta la
-- última pérdida vivían congelados en `racha_base`: marcar «Fui» el día que la había cobrado no cambiaba
-- nada, y con menos de 10 días la pérdida ya la había dejado en 0. Y «Recalcular racha desde el historial»
-- ponía la base en 0 y contaba solo desde el último hueco: el piso de cada pérdida vieja se iba.
--
-- Ahora las dos cosas vuelven a contar el historial entero con la regla de §12 (`estado_de_la_racha`):
-- cada hueco que no cubren un descanso ni una vida resta 10, una vez. Sacar un día del medio también: resta
-- 10 en vez de cortar en seco. Ningún número cambia hasta que alguien corrige un día o recalcula.

do $$
begin
  if public.version_del_esquema() < 100 then
    raise exception 'La migración 101 va después de la 100 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

create or replace function public.estado_de_la_racha(p_user uuid, p_con_la_cobrada boolean, out base int, out perdida date, out racha int)
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  anterior date := null;
  d date;
  cobrada date;
begin
  base := 0;
  racha := 0;
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
          racha := greatest(0, racha - 10);
          base := racha;
          perdida := r.fecha - 1;
          exit;
        end if;
        d := d + 1;
      end loop;
    end if;
    if not r.es_descanso then racha := racha + 1; end if;
    anterior := r.fecha;
  end loop;
  if p_con_la_cobrada then
    select perdida_fecha into cobrada from profiles where id = p_user;
    if cobrada is not null and (anterior is null or cobrada > anterior) then
      racha := greatest(0, racha - 10);
      base := racha;
      perdida := cobrada;
    end if;
  end if;
end;
$$;

revoke execute on function public.estado_de_la_racha(uuid, boolean) from public, anon, authenticated;

create or replace function public.logs_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  desde date := least(coalesce(new.fecha, old.fecha), coalesce(old.fecha, new.fecha));
  hasta date;
  base int;
  r int;
  cobrada date;
  nueva date;
  antes int;
  otra int;
  otra_base int;
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
  select racha_base, perdida_fecha, racha_actual into base, cobrada, antes from profiles where id = uid;
  -- UN DÍA DEL MEDIO CAMBIA LA CUENTA ENTERA (migración 101). La base más lo contado desde la última pérdida
  -- sirve para el día que llega al final. Uno del medio, o de antes de la pérdida, vuelve a contar el historial
  -- con la regla de §12: marcar «Fui» el día que la cobró la deshace (antes no cambiaba nada: la racha quedaba
  -- en lo que dejó la pérdida, o en 0), y sacar uno del medio resta 10 en vez de cortar en seco.
  --
  -- Y corregir no va en contra de lo que se hizo: poner un día nunca baja la racha (marcar uno en el medio de
  -- un hueco de tres lo parte en dos, y serían dos pérdidas donde se cobró una), y sacarlo nunca la sube. Si la
  -- cuenta entera va para el otro lado, queda la de siempre.
  if desde < hasta or (cobrada is not null and desde <= cobrada) then
    select e.base, e.perdida, e.racha into otra_base, nueva, otra from estado_de_la_racha(uid, true) e;
    if (tg_op = 'INSERT' and otra > antes) or (tg_op = 'DELETE' and otra < antes) or (tg_op = 'UPDATE' and otra <> antes) then
      base := otra_base;
      update profiles set racha_base = base, perdida_fecha = nueva where id = uid;
    end if;
  end if;
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
  --
  -- EL DÍA DE RACHA VA CON ÉL (migración 62): meter o sacar un día viejo corre
  -- el número de todos los de después, y el planeta sale de ese número. Solo
  -- los posteriores a la última pérdida: los de antes no tienen cuenta posible
  -- y se quedan como estén.
  --
  -- Y NINGUNO DE LOS DOS PUEDE FRENAR EL DÍA: son etiquetas. Van en su propio
  -- bloque: si fallan, se deshace SOLO esto —el día y la racha de arriba ya
  -- quedaron— y se deja un aviso en el registro de la base. Antes de la 62 el
  -- recálculo del planeta ya corría acá sin esta red.
  if pg_trigger_depth() = 1 then
    begin
      update logs l set racha_del_dia = c.dia, planeta_del_dia = planeta_de_dia(c.dia)
        from (
          select x.id, base + calcular_racha(uid, x.fecha) as dia
            from logs x
           where x.user_id = uid and not x.es_descanso and x.fecha >= desde
             and x.fecha > coalesce((select perdida_fecha from profiles where id = uid), '-infinity'::date)
        ) c
       where l.id = c.id
         and (l.racha_del_dia is distinct from c.dia or l.planeta_del_dia is distinct from planeta_de_dia(c.dia));
    exception when others then
      raise warning 'logs_after_change: el día de racha y el planeta no se pudieron escribir (%)', sqlerrm;
    end;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.recalcular_desde_cero()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b int;
  p date;
  r int;
  perdida jsonb;
  perfil profiles;
begin
  -- Sin la pérdida del hueco que llega hasta hoy: esa la vuelve a revisar `verificar_perdida`, abajo.
  select e.base, e.perdida, e.racha into b, p, r from estado_de_la_racha(uid, false) e;
  update profiles set racha_base = b, perdida_fecha = p, racha_actual = r, rango_actual = rango_de_racha(r)
   where id = uid and racha_actual <= r;
  update profiles set
    -- Recalcular es mirar el historial de nuevo: el techo vale (ver `logs_after_change`).
    mejor_racha = greatest(least(mejor_racha, techo_de_mejor_racha(uid)), mejor_racha_real(uid), racha_actual)
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

create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 101; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
