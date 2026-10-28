-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 98 then
    raise exception 'Esta es la migración 98 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 98 — BORRAR LA CUENTA DE ASCENT BORRA SOLO LO DE ASCENT (28/10)
--
-- Decisión del 28/10: Moss y Ascent son dos cuentas, cada una con lo suyo, y se vinculan aunque
-- usen correos o Apple ID distintos. Vincular las conecta, no las fusiona. Borrar la de Ascent
-- borra todo lo de Ascent y corta el vínculo; Moss sigue intacta y deja de recibir datos.
--
-- EL CASO: las dos apps comparten `auth.users`. Si el Apple ID con que alguien entra a Moss tiene
-- el correo de su cuenta de Ascent, Supabase une las dos identidades en un solo usuario de Auth,
-- que tiene lo de Ascent (`public`) y lo de Moss (`moss`). Hasta hoy `eliminar_cuenta()` borraba
-- ese usuario y, en cascada, todo lo de Moss.
--
-- AHORA: corta el vínculo (`moss.desvincular()`, si Moss está en la base) y borra lo de Ascent
-- como siempre. Sin nada de Moss (ninguna fila en `moss.perfiles`), se va el usuario de Auth
-- como hasta hoy. Con Moss, el usuario queda: se borra el perfil de Ascent con todo lo que
-- cuelga de él (y las medallas, que cuelgan de auth.users), queda el perfil vacío que el alta
-- le da a cualquier cuenta, y se le quita la forma de entrar a Ascent: la identidad de correo y
-- la contraseña. Moss sigue entrando con Apple.
--
-- La app no depende de esto (no pide versión). Va antes de la OTA que cambia el aviso de borrar.

do $$
begin
  if public.version_del_esquema() < 97 then
    raise exception 'La migración 98 va después de la 97 (la base está en %).', public.version_del_esquema();
  end if;
  -- Con Moss, la función borra la identidad de correo y la contraseña: el dueño de la función
  -- (el que corre esto) tiene que poder. Mejor saberlo ahora que en la baja de alguien.
  if not has_table_privilege('auth.identities', 'delete')
     or not has_column_privilege('auth.users', 'encrypted_password', 'update') then
    raise exception 'La migración 98 necesita borrar en auth.identities y cambiar auth.users.encrypted_password.';
  end if;
end $$;

create or replace function public.eliminar_cuenta()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tiene_moss boolean := false;
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;
  -- Moss vive en otro esquema del mismo proyecto y puede no estar: se pregunta por nombre, y por
  -- `execute` para que esta función compile sin él.
  if to_regprocedure('moss.desvincular()') is not null then
    execute 'select moss.desvincular()';
  end if;
  if to_regclass('moss.perfiles') is not null then
    execute 'select exists (select 1 from moss.perfiles where usuario = $1)' into tiene_moss using uid;
  end if;
  -- challenges.ganador apunta a profiles SIN cascade: si esta cuenta ganó un
  -- reto ya cerrado, esa fila bloquearía el borrado. Se van primero, a mano.
  delete from challenges where retador = uid or rival = uid or ganador = uid;
  -- Los propios que OTRA cuenta usó quedan huérfanos (migración 83): su historial
  -- no se borra. Al borrarse la cuenta pierden el dueño y nadie más los ve.
  update ejercicios e set huerfano = true
   where e.creado_por = uid
     and (exists (select 1 from prs p where p.ejercicio = e.id and p.user_id <> uid)
       or exists (select 1 from cargas_elegidas c where c.ejercicio = e.id and c.user_id <> uid)
       or exists (select 1 from subidas_marcadas s where s.ejercicio = e.id and s.user_id <> uid));
  -- Los demás se borran, y antes lo propio que apunta a ellos (no tiene cascada).
  delete from cargas_elegidas  where user_id = uid and ejercicio in (select id from ejercicios where creado_por = uid and not huerfano);
  delete from subidas_marcadas where user_id = uid and ejercicio in (select id from ejercicios where creado_por = uid and not huerfano);
  delete from prs              where user_id = uid and ejercicio in (select id from ejercicios where creado_por = uid and not huerfano);
  delete from ejercicios where creado_por = uid and not huerfano;
  if not tiene_moss then
    delete from auth.users where id = uid;
    return;
  end if;
  -- CON MOSS EL USUARIO DE AUTH QUEDA (migración 98): es el mismo con el que Moss entra con Apple.
  -- Lo de Ascent cuelga de profiles, salvo las medallas, que cuelgan de auth.users.
  delete from medallas where user_id = uid;
  delete from profiles where id = uid;
  -- Queda como cualquier cuenta que nunca usó Ascent: el perfil vacío que deja el alta, sin nombre
  -- (no aparece en ningún lado). Si un día vuelve a entrar a Ascent, empieza de cero.
  insert into profiles (id) values (uid);
  -- Y sin forma de entrar a Ascent: la cuenta de Ascent deja de existir (Apple, 5.1.1(v)).
  delete from auth.identities where user_id = uid and provider = 'email';
  update auth.users set encrypted_password = null where id = uid;
end;
$$;

revoke execute on function public.eliminar_cuenta() from public, anon;
grant execute on function public.eliminar_cuenta() to authenticated;

-- La versión sube a 98.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 98; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
