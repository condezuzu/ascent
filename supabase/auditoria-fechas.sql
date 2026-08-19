-- =============================================================
-- AUDITORÍA de fechas — SOLO LECTURA, no cambia nada
--
-- Pegar en el SQL Editor de Supabase. Ve todas las cuentas, cosa que desde
-- la app no se puede: la RLS solo deja ver la propia.
-- =============================================================

-- 1. La firma de la corrupción que estaríamos buscando: un día guardado con
--    la fecha de UTC cuando en Uruguay todavía era el día anterior.
--
--    Ojo: los días corregidos a mano desde el calendario TAMBIÉN tienen una
--    fecha distinta a la de su `creado`, y son legítimos. Por eso no alcanza
--    con "fecha <> creado": hay que pedir que la fecha coincida con la de
--    UTC y NO con la de Uruguay, que es exactamente lo que haría el bug.
select
  p.username,
  l.fecha            as guardado,
  l.creado,
  (l.creado at time zone 'America/Montevideo')::date as era_en_uruguay,
  (l.creado at time zone 'UTC')::date                as era_en_utc
from logs l
join profiles p on p.id = l.user_id
where l.fecha = (l.creado at time zone 'UTC')::date
  and l.fecha <> (l.creado at time zone 'America/Montevideo')::date
order by p.username, l.fecha;

-- 2. Huecos de un día en medio de una racha, que es como se vería un día
--    que se guardó corrido: falta el que corresponde y sobra el siguiente.
with dias as (
  select user_id, fecha,
         lag(fecha) over (partition by user_id order by fecha) as anterior
  from logs where not es_descanso
)
select p.username, d.anterior, d.fecha, (d.fecha - d.anterior) as saltó
from dias d join profiles p on p.id = d.user_id
where d.anterior is not null and d.fecha - d.anterior = 2
order by p.username, d.fecha;

-- 3. Que la racha guardada coincida con la que sale del historial. Si acá
--    aparece alguien, su número está mal por el motivo que sea.
select p.username, p.racha_actual as guardada, p.racha_base,
       p.racha_base + calcular_racha(p.id, coalesce(
         (select max(fecha) from logs where user_id = p.id), hoy_uy())) as del_historial,
       p.mejor_racha, mejor_racha_real(p.id) as mejor_del_historial
from profiles p
where p.username is not null
order by p.username;

-- 4. Dos días registrados con menos de 20 horas de reloj real entre medio.
--    Es la firma del doble registro por cambio de zona (§12b).
with pares as (
  select user_id, fecha, creado,
         lag(creado) over (partition by user_id order by creado) as anterior
  from logs
)
select p.username, pr.fecha, pr.creado, pr.anterior,
       round(extract(epoch from (pr.creado - pr.anterior)) / 3600, 1) as horas
from pares pr join profiles p on p.id = pr.user_id
where pr.anterior is not null
  and pr.creado - pr.anterior < interval '20 hours'
order by p.username, pr.creado;
