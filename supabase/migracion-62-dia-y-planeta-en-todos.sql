-- MIGRACIÓN 62 — EL DÍA DE RACHA EN TODOS LOS CAMINOS, Y UNA SOLA ESCALERA DE PLANETAS
--
-- DOS COSAS, vistas el día de la aprobación (6/10/2026) con una cuenta real.
--
-- 1. EL DÍA DE RACHA LO ESCRIBÍA UN SOLO CAMINO. `racha_del_dia` (migración 57)
--    la ponía `registrar_dia` y nadie más. Un día que entraba por el pendiente
--    de cambio de zona (`resolver_pendiente`) o marcado a mano desde el
--    calendario nacía sin número, y su foto sin "día N". Ahora lo pone el
--    disparador de los logs (`logs_after_change`), por donde pasan todos: al
--    entrar un día le pone el suyo, y cuando se mete o se saca uno viejo corre
--    el número de los siguientes junto con el planeta, que sale de ese número.
--
-- 2. EL PLANETA GUARDADO ERA DE DOS ESCALERAS. La 54 cambió la escalera (de un
--    planeta por día del 30 al 39, a cinco planetas del 31 al 50) pero no
--    reescribió lo guardado: los días 31 a 39 seguían con nombres que ya no
--    existen (Plutón, Tierra, Neptuno, Urano, Júpiter) y del 40 en adelante no
--    había nada. Acá se recalcula todo con la escalera de hoy:
--      - los días que tienen número, desde su número;
--      - los que no lo tienen (los de antes de la última pérdida) se TRADUCEN
--        por nombre: en la escalera vieja cada nombre era un día exacto, así
--        que el nombre dice qué día era y de ahí sale el planeta nuevo. El
--        número NO se les escribe: un planeta mal traducido es una etiqueta;
--        un "día 37" inventado sería un dato.
--
-- LA TRADUCCIÓN CORRE UNA SOLA VEZ (solo si la base viene de la 61): correrla
-- dos veces traduciría lo ya traducido. Lo demás se puede repetir.
--
-- VA DESPUÉS DE LA 61, y se niega si no: vuelve a definir los dos disparadores
-- de los logs sobre lo que dejaron la 57 y la 61.
do $$
begin
  if public.version_del_esquema() < 61 then
    raise exception 'La migración 62 va después de la 61 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

create or replace function public.logs_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r int;
  perfil profiles;
begin
  -- el planeta lo decide siempre el trigger, nunca el cliente
  new.planeta_del_dia := null;
  -- EL DÍA DE RACHA TAMPOCO LO TRAE EL CLIENTE (migración 62). Lo escribe
  -- `logs_after_change`, por donde pasan todos los caminos: antes lo ponía solo
  -- `registrar_dia`, y un día que entraba por el pendiente de cambio de zona o
  -- marcado a mano desde el calendario nacía sin número.
  new.racha_del_dia := null;
  select * into perfil from profiles where id = new.user_id;
  -- Un día de ANTES de la última pérdida no tiene cuenta posible: la racha se
  -- mide desde ahí. Queda sin número y sin planeta, en vez de con uno inventado.
  --
  -- UNA ETIQUETA NO PUEDE FRENAR EL DÍA (migración 62). Un error en un
  -- disparador aborta la sentencia entera: si esta cuenta fallara, nadie podría
  -- registrar. El planeta es un dato derivado; si no se puede calcular, el día
  -- entra sin él y queda un aviso en el registro de la base.
  begin
    if not new.es_descanso and (perfil.perdida_fecha is null or new.fecha > perfil.perdida_fecha) then
      r := perfil.racha_base + calcular_racha(new.user_id, new.fecha - 1) + 1;
      -- SIN BORDE PROPIO. Qué días tienen planeta lo dice `planeta_de_dia`, que
      -- devuelve null fuera del rango. Acá había un "entre 30 y 39" copiado, y
      -- cuando la migración 54 corrió el rango a 31..50 los días 40 a 50
      -- quedaban sin planeta guardado.
      new.planeta_del_dia := planeta_de_dia(r);
    end if;
  exception when others then
    new.planeta_del_dia := null;
    raise warning 'logs_before_insert: el planeta del día no se pudo calcular (%)', sqlerrm;
  end;
  return new;
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

-- (los dos disparadores de arriba son copia exacta de schema.sql)

-- RELLENO 1: el día de racha de los días que nacieron sin número desde la 57
-- (el pendiente, el calendario). La misma cuenta y el mismo límite que la 57.
update public.logs l
   set racha_del_dia = p.racha_base + calcular_racha(l.user_id, l.fecha)
  from public.profiles p
 where p.id = l.user_id
   and not l.es_descanso
   and l.racha_del_dia is null
   and (p.perdida_fecha is null or l.fecha > p.perdida_fecha);

-- RELLENO 2: sin número no hay planeta que calcular; se traduce el que había.
-- Escalera vieja: Ceres 30, Plutón 31, Mercurio 32, Marte 33, Venus 34,
-- Tierra 35, Neptuno 36, Urano 37, Saturno 38, Júpiter 39.
do $$
begin
  if public.version_del_esquema() = 61 then
    update public.logs
       set planeta_del_dia = public.planeta_de_dia(
             29 + array_position(
               array['Ceres','Plutón','Mercurio','Marte','Venus','Tierra','Neptuno','Urano','Saturno','Júpiter'],
               planeta_del_dia))
     where racha_del_dia is null and planeta_del_dia is not null;
  end if;
end $$;

-- RELLENO 3: con número, el planeta es el de ese número en la escalera de hoy.
update public.logs
   set planeta_del_dia = public.planeta_de_dia(racha_del_dia)
 where racha_del_dia is not null
   and planeta_del_dia is distinct from public.planeta_de_dia(racha_del_dia);

-- La versión sube a 62.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 62; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
