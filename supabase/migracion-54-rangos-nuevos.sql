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

-- BACKFILL: re-etiquetar el rango guardado de todos con la regla nueva. La
-- racha no se toca; solo `rango_actual`, que es derivado.
update public.profiles set rango_actual = public.rango_de_racha(racha_actual);

-- La versión sube a 54 (solo sube, nunca baja).
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 54; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
