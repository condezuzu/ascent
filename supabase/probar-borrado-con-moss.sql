-- BORRAR UNA CUENTA CON EL VÍNCULO DE MOSS ACTIVO, CONTRA LA BASE REAL (29/10).
--
-- Moss y Ascent son dos cuentas separadas que se vinculan (moss.vinculo). Lo que tiene que
-- pasar: borrar la de Ascent borra solo lo de Ascent; lo que ya había llegado a Moss se queda y
-- deja de llegar lo nuevo. Al revés, igual.
--
-- Corre las funciones y las claves de verdad de producción (eliminar_cuenta, moss.borrar_cuenta,
-- moss.ascent_sesiones, los ON DELETE de moss.*), con cuentas inventadas adentro de UN SOLO
-- bloque que termina SIEMPRE en un error con el resultado: así Postgres deshace todo y no queda
-- nada escrito. Necesita el rol de la CLI (las cuentas se crean en auth.users):
--
--   npx supabase db query --linked -f supabase/probar-borrado-con-moss.sql
--
-- El resultado sale en el mensaje de error: "RESULTADO ok=… falla=…".
do $prueba$
declare
  a uuid := gen_random_uuid();  -- la cuenta de Ascent
  m uuid := gen_random_uuid();  -- la cuenta de Moss, otra
  a2 uuid := gen_random_uuid();
  m2 uuid := gen_random_uuid();
  x uuid := gen_random_uuid();  -- una sola cuenta de Auth con las dos apps (el mismo correo)
  ok text := '';
  falla text := '';
  n int;
  j jsonb;
  como text;
begin
  if to_regclass('moss.vinculo') is null then
    raise exception 'RESULTADO: no hay esquema moss en esta base';
  end if;
  insert into auth.users (id, email) values
    (a, 'prueba-a-' || a || '@ejemplo.invalid'), (m, 'prueba-m-' || m || '@ejemplo.invalid'),
    (a2, 'prueba-a2-' || a2 || '@ejemplo.invalid'), (m2, 'prueba-m2-' || m2 || '@ejemplo.invalid'),
    (x, 'prueba-x-' || x || '@ejemplo.invalid');
  update public.profiles set username = 'prb_' || substr(replace(id::text, '-', ''), 1, 10) where id in (a, a2, x);
  insert into public.logs (user_id, fecha) values (a, current_date - 1), (a2, current_date - 1), (x, current_date - 1);
  insert into moss.perfiles (usuario) values (m), (m2), (x);
  -- Lo que ya llegó a Moss: una marca que vino de Ascent, guardada en la cuenta de Moss.
  insert into moss.marcas (usuario, habito, dia, hecho, momento, origen) values
    (m, 'gimnasio', current_date - 1, true, now(), 'ascent'), (m2, 'gimnasio', current_date - 1, true, now(), 'ascent'),
    (x, 'gimnasio', current_date - 1, true, now(), 'ascent');
  insert into moss.vinculo (moss, ascent, origen) values (m, a, 'moss'), (m2, a2, 'ascent');

  -- 1. BORRAR DESDE ASCENT, con el vínculo activo.
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  select jsonb_array_length(moss.ascent_sesiones(current_date - 7)) into n;
  if n = 1 then ok := ok || ' antes-moss-lee-1-dia'; else falla := falla || ' antes-moss-lee:' || n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.eliminar_cuenta();
  select count(*) into n from auth.users where id = a;
  if n = 0 then ok := ok || ' 1a-ascent-borrada'; else falla := falla || ' 1a-ascent-sigue'; end if;
  select count(*) into n from public.logs where user_id = a;
  if n = 0 then ok := ok || ' 1b-sus-dias-borrados'; else falla := falla || ' 1b-quedan-dias'; end if;
  select count(*) into n from moss.vinculo where moss = m or ascent = a;
  if n = 0 then ok := ok || ' 1c-vinculo-cortado'; else falla := falla || ' 1c-vinculo-sigue'; end if;
  select (select count(*) from auth.users where id = m) + (select count(*) from moss.perfiles where usuario = m)
       + (select count(*) from moss.marcas where usuario = m and origen = 'ascent') into n;
  if n = 3 then ok := ok || ' 1d-moss-intacta-con-lo-que-llego'; else falla := falla || ' 1d-moss-perdio:' || n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  select jsonb_array_length(moss.ascent_sesiones(current_date - 7)) into n;
  if n = 0 then ok := ok || ' 1e-no-llega-nada-nuevo'; else falla := falla || ' 1e-sigue-llegando:' || n; end if;

  -- 2. BORRAR DESDE MOSS, con el vínculo activo: lo que hace la baja de Moss (su función y el
  --    usuario de Auth, que borra su función del servidor).
  perform moss.borrar_cuenta(m2);
  delete from auth.users where id = m2;
  select count(*) into n from moss.vinculo where moss = m2 or ascent = a2;
  if n = 0 then ok := ok || ' 2a-vinculo-cortado'; else falla := falla || ' 2a-vinculo-sigue'; end if;
  select (select count(*) from auth.users where id = a2) + (select count(*) from public.profiles where id = a2 and username is not null)
       + (select count(*) from public.logs where user_id = a2) into n;
  if n = 3 then ok := ok || ' 2b-ascent-intacta'; else falla := falla || ' 2b-ascent-perdio:' || n; end if;
  select count(*) into n from moss.marcas where usuario = m2;
  if n = 0 then ok := ok || ' 2c-lo-de-moss-borrado'; else falla := falla || ' 2c-quedo-moss'; end if;

  -- 3. EL MISMO USUARIO DE AUTH PARA LAS DOS (mismo correo, enlazado automático): no es el caso de
  --    dos cuentas separadas, pero puede pasar. Se mide, no se arregla acá.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  perform public.eliminar_cuenta();
  select (select count(*) from moss.perfiles where usuario = x) + (select count(*) from moss.marcas where usuario = x) into n;
  if n = 0 then como := ' 3-misma-cuenta:borrar-ascent-se-lleva-moss'; else como := ' 3-misma-cuenta:moss-queda:' || n; end if;

  raise exception 'RESULTADO ok=[%] falla=[%] medido=[%]', trim(ok), trim(falla), trim(como);
end $prueba$;
