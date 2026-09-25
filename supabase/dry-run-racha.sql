-- DRY-RUN de la racha por replay — SOLO LECTURA, no cambia ningún dato.
--
-- Para ver el ANTES y DESPUÉS de la migración 51 sobre las cuentas reales, sin
-- aplicar nada. Pegar entero en el SQL Editor de Supabase y correr. Devuelve una
-- fila por cuenta con la racha guardada de hoy, la que daría el replay, y la
-- diferencia. NO escribe en ninguna tabla: solo crea una función de lectura y
-- hace un SELECT. Si querés, al final la borra sola (ver la última línea).
--
-- Es EXACTAMENTE la función que instala la migración 51; correrla acá primero
-- es el "en seco" que pediste. Si alguna diferencia es grande, paramos.

create or replace function public.racha_replay(p_user uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  d date; hoy date := hoy_de(p_user); primero date;
  r int := 0; en_hueco boolean := false; cubiertas date[]; logs_map jsonb;
begin
  select min(fecha) into primero from logs where user_id = p_user;
  if primero is null then return 0; end if;
  select coalesce(jsonb_object_agg(fecha::text, es_descanso), '{}'::jsonb) into logs_map
    from logs where user_id = p_user;
  select coalesce(array_agg(fecha), '{}') into cubiertas
    from vidas_usadas where user_id = p_user and not devuelta;
  d := primero;
  while d <= hoy loop
    if logs_map ? d::text then
      if (logs_map ->> d::text)::boolean then en_hueco := false; -- descanso explícito no corta
      else r := r + 1; en_hueco := false; end if;                -- entrenado
    elsif extract(dow from d)::int = any(descansos_vigentes(p_user, d)) then en_hueco := false; -- descanso por config
    elsif d = any(cubiertas) then en_hueco := false;             -- cubierto por una vida
    elsif d < hoy then                                           -- hueco (no hoy: hoy aún no venció)
      if not en_hueco then r := greatest(0, r - 10); end if;     -- -10 UNA vez por hueco
      en_hueco := true;
    end if;
    d := d + 1;
  end loop;
  return r;
end;
$$;

select
  p.username,
  p.racha_actual                       as racha_vieja,
  public.racha_replay(p.id)            as racha_nueva,
  public.racha_replay(p.id) - p.racha_actual as diferencia
from public.profiles p
order by abs(public.racha_replay(p.id) - p.racha_actual) desc, p.username;

-- Para dejar todo como estaba (opcional): descomentar y correr.
-- drop function public.racha_replay(uuid);
