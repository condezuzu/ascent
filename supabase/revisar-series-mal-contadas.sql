-- =============================================================
-- ¿Hay sesiones con el total de series contado de menos?
--
-- Correr en el SQL Editor de Supabase. NO CAMBIA NADA: solo mira.
--
-- EL BUG (arreglado el 15/9/2026, commit 52c344d): dos toques seguidos del `+`
-- podían dejar el bloque bien contado y el TOTAL de la sesión con uno menos
-- ("2 de 3 · 1 en total"). La racha no se toca —no depende de las series—,
-- pero el resumen del día y las series por semana quedan cortos.
--
-- CÓMO SE RECONOCE: las series de los bloques suman MÁS que el total. Eso no
-- puede pasar por uso normal: las series sin ejercicio suman al total y no a
-- los bloques (el total queda más grande, no más chico), y corregir desde la
-- lista mueve las dos cuentas juntas.
--
-- LO QUE NO PUEDE VER: las series contadas SIN elegir ejercicio. Ahí no hay
-- bloques con qué comparar, y un total de menos no deja rastro.
-- =============================================================

-- ↓↓↓ PONER ACÁ TU CORREO ↓↓↓
create temporary view yo as
  select id from auth.users where email = 'agusconde20@gmail.com';

select count(*) as cuentas_encontradas from yo;

-- Una fila por sesión afectada, la más nueva primero.
select
  l.fecha,
  to_char(s.inicio at time zone 'America/Montevideo', 'HH24:MI') as empezo,
  s.series as total_guardado,
  sum((b.valor->>'series')::int) as series_en_bloques,
  sum((b.valor->>'series')::int) - s.series as faltan
from sesiones s
join logs l on l.id = s.log_id
cross join lateral jsonb_array_elements(s.bloques) as b(valor)
where s.user_id = (select id from yo)
group by s.id, l.fecha, s.inicio, s.series
having sum((b.valor->>'series')::int) > s.series
order by s.inicio desc;

-- -------------------------------------------------------------
-- CORREGIRLAS (opcional, y solo si la consulta de arriba devolvió algo)
-- -------------------------------------------------------------
-- Pone el total en lo que suman los bloques, que es el mínimo seguro: esas
-- series se contaron una por una. Si además hiciste series sin elegir
-- ejercicio esa sesión, esas no vuelven — no quedó registro de cuántas eran.
--
-- Está comentado a propósito. Para correrlo, sacar los `--` de las líneas.
--
-- update sesiones s
--    set series = t.en_bloques
--   from (
--     select s2.id, sum((b.valor->>'series')::int) as en_bloques
--       from sesiones s2
--       cross join lateral jsonb_array_elements(s2.bloques) as b(valor)
--      where s2.user_id = (select id from yo)
--      group by s2.id, s2.series
--     having sum((b.valor->>'series')::int) > s2.series
--   ) t
--  where s.id = t.id;
