-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 96 then
    raise exception 'Esta es la migración 96 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 96 — Dos press de pecho que faltaban: plano e inclinado en Smith (26/10)
--
-- Con el formato de «Sentadilla en Smith». Van al lado del press declinado (211) y antes de
-- los de mancuernas (220). La carga es `total`, como la barra: el número es lo que hay en la
-- barra guiada. `on conflict do nothing`: si ya estuvieran, no pisa nada.
--
-- No toca datos. La app no depende de esto: el catálogo se lee de la base.

do $$
begin
  if public.version_del_esquema() < 95 then
    raise exception 'La migración 96 va después de la 95 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

insert into public.ejercicios (id, nombre, grupo, cuenta_dots, orden) values
  ('press_plano_smith',     'Press plano en Smith',        'pecho',   false, 212),
  ('press_inclinado_smith', 'Press inclinado en Smith',    'pecho',   false, 213)
on conflict (id) do nothing;

-- La versión sube a 96.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 96; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
