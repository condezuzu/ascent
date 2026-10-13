-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 56 then
    raise exception 'Esta es la migración 56 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 56 — Un ejercicio de core que faltaba: el crunch en banco declinado.
--
-- El humano quiso anotar "el declinado" y no estaba en core. (El "press
-- declinado" sí existe, pero es de PECHO — otro ejercicio.) Se agrega el crunch
-- en banco declinado, que es el declinado de abdominales, con su orden entre el
-- crunch (611) y la elevación de piernas (613). `on conflict do nothing`: si ya
-- estuviera, no pisa nada.

insert into public.ejercicios (id, nombre, grupo, carga_ambigua, orden) values
  ('crunch_declinado', 'Crunch en banco declinado', 'core', false, 612)
on conflict (id) do nothing;

-- La versión sube a 56.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 56; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
