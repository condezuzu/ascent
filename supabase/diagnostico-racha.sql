-- DIAGNÓSTICO DE LA RACHA (SOLO LECTURA). Corré esto en el SQL Editor de
-- Supabase LOGUEADO COMO VOS (usa auth.uid()). No escribe nada.
--
-- Para qué: ver día por día tu historial clasificado como lo ve el motor, para
-- encontrar los tres huecos que el modelo viejo castigó y el replay no. Lo que
-- hay que mirar es cada '>>> HUECO <<<': un día que NO entrenaste, que NO era
-- descanso (ni por log ni por config) y que NO estaba cubierto por una vida.
-- Si un día que vos recordás como falta aparece como 'descanso (config)' o
-- 'vida', ahí está el hueco que el replay se come.

-- ---- (A) El resumen: las piezas de las que sale la racha ----
-- (No llama a racha_replay a propósito: así corre igual antes o después del
--  revert. El replay ya sabemos que da 69.)
select
  (select racha_actual  from profiles where id = auth.uid())              as racha_guardada_ahora,
  (select racha_base     from profiles where id = auth.uid())             as racha_base,
  (select perdida_fecha  from profiles where id = auth.uid())             as perdida_fecha,
  (select p.racha_base + public.calcular_racha(auth.uid(),
      coalesce((select max(fecha) from logs where user_id = auth.uid()), public.hoy_de(auth.uid())))
     from profiles p where p.id = auth.uid())                             as modelo_viejo_da,
  (select count(*) from vidas_usadas where user_id = auth.uid() and not devuelta) as vidas_activas;

-- ---- (B) El timeline día por día ----
with r as (
  select min(fecha) as primero, public.hoy_de(auth.uid()) as hoy
    from logs where user_id = auth.uid()
),
dias as (
  select generate_series((select primero from r), (select hoy from r), interval '1 day')::date as d
)
select
  d.d as dia,
  to_char(d.d, 'Dy') as dow,
  case
    when l.fecha is not null and l.es_descanso then 'descanso (log)'
    when l.fecha is not null                    then 'entrenado'
    when extract(dow from d.d)::int = any(public.descansos_vigentes(auth.uid(), d.d)) then 'descanso (config)'
    when v.fecha is not null                     then 'vida'
    when d.d < (select hoy from r)               then '>>> HUECO <<<'
    else 'hoy (no vencido)'
  end as clase
from dias d
left join logs l         on l.user_id = auth.uid() and l.fecha = d.d
left join vidas_usadas v on v.user_id = auth.uid() and v.fecha = d.d and not v.devuelta
order by d.d;
