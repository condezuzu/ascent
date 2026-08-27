-- =============================================================
-- ¿Hay días registrados que en realidad salieron de pesarse?
--
-- Correr en el SQL Editor de Supabase. NO CAMBIA NADA: solo mira.
-- =============================================================
--
-- Hasta el 27/8/2026 el peso corporal vivía adentro de la hoja de registrar el
-- día, así que para anotarlo había que registrar el día. Un domingo que te
-- pesás y no vas al gimnasio quedaba contado como día entrenado.
--
-- Esto NO puede distinguir con certeza un caso del otro —un día en que
-- entrenaste Y te pesaste se ve igual—, así que lo que devuelve son
-- CANDIDATOS, ordenados por cuán sospechosos son. La última palabra es tuya:
-- vos sabés si fuiste al gimnasio ese día.

-- -------------------------------------------------------------
-- 1. Los candidatos, uno por fila
-- -------------------------------------------------------------
select
  l.fecha,
  to_char(l.fecha, 'Dy')                       as dia_semana,
  l.origen,
  w.valor                                      as peso_anotado,
  (select count(*) from sesiones s where s.log_id = l.id) as sesiones,
  (select count(*) from photos  f where f.log_id = l.id) as fotos,
  case
    -- Lo más sospechoso: el día tiene peso y NADA MÁS. Ni cronómetro, ni foto.
    -- Si además cae en fin de semana, más todavía.
    when to_char(l.fecha, 'ID') in ('6', '7') then 'MUY sospechoso (fin de semana, solo peso)'
    else 'sospechoso (solo peso)'
  end                                          as veredicto
from logs l
join weights w
  on w.user_id = l.user_id and w.fecha = l.fecha
where l.user_id = auth.uid()
  and l.es_descanso = false
  and l.origen = 'manual'                       -- los de ubicación son reales
  and not exists (select 1 from sesiones s where s.log_id = l.id)
  and not exists (select 1 from photos  f where f.log_id = l.id)
order by l.fecha desc;

-- -------------------------------------------------------------
-- 2. El tamaño del problema, de un vistazo
-- -------------------------------------------------------------
select
  (select count(*) from logs where user_id = auth.uid() and es_descanso = false)
    as dias_entrenados,
  (select count(*) from weights where user_id = auth.uid())
    as veces_que_te_pesaste,
  (select count(*)
     from logs l
     join weights w on w.user_id = l.user_id and w.fecha = l.fecha
    where l.user_id = auth.uid()
      and l.es_descanso = false
      and l.origen = 'manual'
      and not exists (select 1 from sesiones s where s.log_id = l.id)
      and not exists (select 1 from photos f where f.log_id = l.id))
    as candidatos_a_borrar;

-- -------------------------------------------------------------
-- 3. SI DECIDÍS BORRAR ALGUNO — no corre solo, hay que descomentarlo
-- -------------------------------------------------------------
-- Uno por uno y a mano, con las fechas que VOS confirmes. Borrar el log NO
-- borra el peso: son tablas distintas, que es justamente el punto.
--
-- Después de borrar hay que recalcular la racha, porque sacar un día del medio
-- la parte. Eso se hace desde la app: Ajustes → Corregir días → "Recalcular
-- racha desde el historial", que lo hace en una transacción y no rebota.
--
-- delete from logs
--  where user_id = auth.uid()
--    and fecha in ('2026-08-16', '2026-08-23');   -- ← tus fechas acá
