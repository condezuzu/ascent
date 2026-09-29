-- AGENDADO DEL BARRIDO DE RACHAS (companion de la migración 55).
--
-- NO ES UNA MIGRACIÓN a propósito: usa pg_cron, que no existe en PGlite (donde
-- corre test:db), así que si fuera `migracion-NN` reventaría el replay. Se corre
-- A MANO una sola vez, DESPUÉS de aplicar la migración 55, en el SQL editor de
-- Supabase (o se activa pg_cron desde el dashboard: Database → Extensions).
--
-- Cada hora, en punto. Como todo el cálculo pasa por `hoy_de(p_user)` (la zona de
-- cada usuario), correr a cualquier instante fijo es correcto para todos los
-- husos: lo único que la hora define es cuánto puede tardar (≤1 h) en reflejarse
-- una pérdida después de la medianoche local de cada quien.
--
-- Si preferís no usar pg_cron, la alternativa es un Vercel Cron pegándole a una
-- ruta Next que llame `supabase.rpc('barrer_perdidas')` con el service_role y el
-- CRON_SECRET (la infra dormida sigue en el repo). pg_cron es más limpio: todo
-- queda en la base, sin HTTP.

create extension if not exists pg_cron;

select cron.schedule(
  'barrer-perdidas-horario',
  '0 * * * *',
  $$select public.barrer_perdidas();$$
);
