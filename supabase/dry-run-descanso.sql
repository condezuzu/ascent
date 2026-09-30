-- DRY-RUN del arreglo del descanso (migración 55) — SOLO LECTURA, no cambia nada.
--
-- La pregunta: "¿cuánta gente de la base cambiaría de racha al aplicar el arreglo?"
-- No la puedo correr yo desde acá (no tengo la llave de servicio y el RLS no deja
-- leer cuentas ajenas). Esto es para pegarlo en el SQL Editor de Supabase.
--
-- QUÉ MIDE. El arreglo del descanso es MONÓTONO: solo puede PRESERVAR una racha que
-- antes se cortaba, nunca bajar una. El único código que cambia es el loop de
-- cobertura de `verificar_perdida_de`, y ese loop SOLO corre para una cuenta que
-- está por perder (racha viva, sin log de hoy, y la racha viva quedó por debajo de
-- la guardada). Dentro de esas, el arreglo solo cambia algo si además la cuenta
-- USA días de descanso: si no usás descansos, el loop nunca salteaba nada y el
-- viejo y el nuevo hacen lo mismo.
--
-- Por eso esta consulta da la COTA SUPERIOR exacta y barata: cuentas con racha viva
-- que hoy tienen al menos un día de descanso configurado. De estas, cambian DE
-- VERDAD solo las que, el día que se las evalúe, tengan una falta real más vieja
-- que un descanso con una vida libre para cubrirla. El número real ≤ esta cota.

select count(*) as cota_superior_cuentas_afectadas
from public.profiles p
where p.racha_actual > 0
  and coalesce(array_length(descansos_vigentes(p.id, hoy_de(p.id)), 1), 0) > 0;

-- El detalle, por si querés mirarlas una por una (sin escribir nada):
select
  p.username,
  p.racha_actual,
  descansos_vigentes(p.id, hoy_de(p.id)) as descansos_hoy
from public.profiles p
where p.racha_actual > 0
  and coalesce(array_length(descansos_vigentes(p.id, hoy_de(p.id)), 1), 0) > 0
order by p.racha_actual desc;

-- El número EXACTO (no la cota) solo sale corriendo las dos versiones del loop
-- sobre las cuentas y comparando; eso pide aplicar la migración a una copia/rama,
-- que es tu decisión. Como es monótono, ninguna cuenta PIERDE racha por esto:
-- la diferencia entre la cota y el número real son cuentas que no cambian, no
-- cuentas que empeoran.
