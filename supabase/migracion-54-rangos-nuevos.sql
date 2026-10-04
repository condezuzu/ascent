-- MIGRACIÓN 54 — Rangos nuevos: duraciones crecientes y sin "Sistema".
--
-- Las duraciones pasan de diez días parejos a crecientes:
--   Polvo 1-5 · Asteroide 6-15 · Luna 16-30 · Planeta 31-50 · Sol 51-75 ·
--   Galaxia 76-105 · Agujero negro 106+.
-- Son SIETE rangos: el viejo "Sistema" (rango 6) se sacó; Galaxia pasa a 6 y
-- Agujero negro a 7.
--
-- Dentro de Planeta, cuatro días por planeta: Ceres 31-34, Mercurio 35-38,
-- Marte 39-42, Venus 43-46, Saturno 47-50.
--
-- EL DÍA (racha_actual) NO SE TOCA. El rango es una función pura de la racha:
-- esto solo cambia el mapeo día→rango. Nadie pierde días; cambia la etiqueta.
-- Como `profiles.rango_actual` es una columna GUARDADA (la escribe el trigger),
-- al final se re-etiqueta a todos de una con el backfill, para que el rango no
-- quede viejo hasta el próximo movimiento de cada perfil.
--
-- El cliente tiene la misma tabla en `nucleo/reglas.ts` (`DESDE_RANGO`); no se
-- pueden compartir —una es SQL y la otra corre offline— así que `test:db`
-- compara las dos día por día del 1 al 200 y falla si difieren.

-- Mismos umbrales que DESDE_RANGO = [0, 6, 16, 31, 51, 76, 106].
create or replace function public.rango_de_racha(r int)
returns int language sql immutable as $$
  select case
    when r >= 106 then 7
    when r >= 76  then 6
    when r >= 51  then 5
    when r >= 31  then 4
    when r >= 16  then 3
    when r >= 6   then 2
    else 1
  end;
$$;

-- Planeta (rango 4): días 31..50, cuatro días por planeta, cinco planetas.
create or replace function public.planeta_de_dia(r int)
returns text language sql immutable as $$
  select case when r between 31 and 50
    then (array['Ceres','Mercurio','Marte','Venus','Saturno'])[(r - 31) / 4 + 1]
  end;
$$;

-- LOS DOS DISPARADORES QUE GUARDAN EL PLANETA DEL DÍA (agregados el 4/10/2026,
-- antes de aplicar esta migración). Tenían su propio "entre 30 y 39" copiado al
-- lado de la llamada a `planeta_de_dia`: con la función nueva, del 31 al 39
-- salía bien y del 40 al 50 no se guardaba nada. Ahora no tienen borde: el
-- único lugar que sabe qué días tienen planeta es la función. Los días que ya
-- están guardados NO se tocan (el pasado no se reescribe). Igual que en
-- schema.sql.
create or replace function public.logs_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r int;
  perfil profiles;
begin
  -- el planeta lo decide siempre el trigger, nunca el cliente
  new.planeta_del_dia := null;
  select * into perfil from profiles where id = new.user_id;
  if not new.es_descanso then
    r := perfil.racha_base + calcular_racha(new.user_id, new.fecha - 1) + 1;
    -- SIN BORDE PROPIO. Qué días tienen planeta lo dice `planeta_de_dia`, que
    -- devuelve null fuera del rango. Acá había un "entre 30 y 39" copiado, y
    -- cuando la migración 54 corrió el rango a 31..50 los días 40 a 50
    -- quedaban sin planeta guardado.
    new.planeta_del_dia := planeta_de_dia(r);
  end if;
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

-- BACKFILL: re-etiquetar el rango guardado de todos con la regla nueva. La
-- racha no se toca; solo `rango_actual`, que es derivado.
update public.profiles set rango_actual = public.rango_de_racha(racha_actual);

-- La versión sube a 54 (solo sube, nunca baja).
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 54; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
