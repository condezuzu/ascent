-- MIGRACIÓN 61 — LA MEJOR RACHA NO BAJA SOLA DESPUÉS DE UNA PÉRDIDA
--
-- EL BUG (4/10/2026). Perder la racha resta 10 y lo que sobrevive se arrastra
-- (§12): 40 días, se pierde, quedan 30; 25 días más y la racha dice 55. El récord
-- guardado era 55. Pero `mejor_racha_real`, que es de donde SALE el récord, no
-- conocía esa regla: en cada corte volvía a cero, y de ese historial sacaba 40.
-- El disparador guarda `greatest(mejor_racha_real, racha de hoy)`, así que el 55
-- estaba sostenido solo por la racha. Con la pérdida siguiente (45) y el primer
-- día registrado después (46), el récord pasaba a 46. Sin borrar nada.
--
-- EL ARREGLO. `mejor_racha_real` cuenta como cuenta la racha: un corte resta 10,
-- una sola vez por corte, y nunca baja de cero. El récord vuelve a salir entero
-- del historial, y la regla de siempre se mantiene: si se borran días, baja.
--
-- Y SE REPONE lo que el bug ya bajó: a quien le quedó un récord menor que el que
-- da su historial, se le sube. Esta sentencia solo sube, nunca baja.
--
-- SE PUEDE CORRER DOS VECES, Y SE PUEDE CORRER ANTES QUE LA 54. No usa nada de
-- las migraciones 54 a 60 (la función es la misma del esquema 53 con una línea
-- distinta), así que arregla producción hoy. Y por eso la versión del esquema
-- sube a 61 SOLO si ya está en 60: corrida antes, la deja como está; se vuelve a
-- correr en su lugar, después de la 60, y ahí sí sube.

create or replace function public.mejor_racha_real(p_user uuid)
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
      -- se revisan los días entre medio: cortan salvo que fueran de descanso
      -- o que una vida NO devuelta los haya cubierto
      d := anterior + 1;
      while d < r.fecha loop
        if not (extract(dow from d)::int = any(descansos_vigentes(p_user, d)))
           and not exists (
             select 1 from vidas_usadas
              where user_id = p_user and fecha = d and not devuelta
           )
        then
          -- UN CORTE RESTA 10, NO VUELVE A CERO: es la regla de la racha (§12)
          -- y acá estaba la de antes. La racha de después de una pérdida
          -- arrastra lo que sobrevivió, y el récord hecho con esos días no
          -- salía del historial: quedaba guardado solo mientras la racha lo
          -- sostenía, y bajaba solo con la pérdida siguiente (migración 61).
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

-- LO QUE EL BUG YA BAJÓ. Solo sube: el que tenga un récord mayor que su
-- historial lo conserva hasta que el disparador lo recalcule, como siempre.
update public.profiles p
   set mejor_racha = public.mejor_racha_real(p.id)
 where public.mejor_racha_real(p.id) > p.mejor_racha;

-- LA VERSIÓN SUBE A 61 SOLO SI YA ESTÁ LA 60 (ver arriba). Solo sube, nunca baja.
do $$
begin
  if public.version_del_esquema() >= 60 then
    execute 'create or replace function public.version_del_esquema() returns int language sql immutable as $v$ select 61; $v$';
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
