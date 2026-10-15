-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 83 then
    raise exception 'Esta es la migración 83 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 83 — DAR DE BAJA LA CUENTA AUNQUE UN AMIGO HAYA USADO TUS EJERCICIOS PROPIOS
--
-- Entre la 76 y la 80 los amigos veían tus ejercicios propios y podían anotar
-- marcas, cargas elegidas o "la próxima, más" sobre ellos. Esas filas apuntan al
-- ejercicio sin cascada: al darte de baja, el borrado chocaba con ellas y se
-- revertía entero (después de que la app ya había borrado tus fotos). Ahora se
-- borran primero. Sin el ejercicio, esas filas no sirven: es lo que se decidió.
-- Solo cambia la función: no toca ninguna fila hasta que alguien se da de baja.

do $$
begin
  if public.version_del_esquema() < 82 then
    raise exception 'La migración 83 va después de la 82 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

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
  -- Lo que OTRAS cuentas anotaron sobre los ejercicios propios de esta (migración 83).
  delete from cargas_elegidas  where ejercicio in (select id from ejercicios where creado_por = uid);
  delete from subidas_marcadas where ejercicio in (select id from ejercicios where creado_por = uid);
  delete from prs              where ejercicio in (select id from ejercicios where creado_por = uid);
  delete from auth.users where id = uid;
end;
$$;

do $$
begin
  if public.version_del_esquema() < 83 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 83; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
