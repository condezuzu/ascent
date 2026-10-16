-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 85 then
    raise exception 'Esta es la migración 85 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 85 — "GUARDARLA PARA DESPUÉS" CON EL DÍA DE HOY YA ANOTADO
--
-- La vida que cubrió ayer se gasta cuando entra el día de hoy (al llegar al gimnasio),
-- y la pregunta "¿la guardás para después?" sale al terminar la sesión, con hoy ya
-- anotado. Devolverla no cortaba la racha (la cuenta se iba sin cobrar si hoy tenía
-- log): la vida volvía, la racha seguía entera con ayer sin cubrir, y cualquier
-- corrección del calendario ese día la tiraba a 1. Ahora se cobra: la racha de antes
-- de hoy menos 10, y hoy encima, como promete la pregunta.
-- Solo cambia la función: no toca ninguna fila hasta que alguien devuelve una vida.

do $$
begin
  if public.version_del_esquema() < 84 then
    raise exception 'La migración 85 va después de la 84 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

create or replace function public.devolver_impulsos(p_fechas date[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cuantas int;
  d date;
  hoy_descanso boolean;
  perfil profiles;
  previa int;
  viva int;
  nueva int;
  racha int;
begin
  if uid is null then return null; end if;

  update vidas_usadas
     set devuelta = true
   where user_id = uid
     and fecha = any(p_fechas)
     and not devuelta
     and fecha >= mi_hoy() - 7;
  get diagnostics cuantas = row_count;

  if cuantas = 0 then
    return jsonb_build_object('devueltas', 0);
  end if;

  -- CON EL DÍA DE HOY YA ANOTADO (migración 85): es el caso normal —la vida se gasta
  -- cuando entra hoy al llegar al gimnasio, y la pregunta sale al terminar—, y
  -- `aplicar_perdida_al` se va sin cobrar nada si hoy tiene log. La racha seguía
  -- entera con un día sin cubrir debajo, y la primera corrección la tiraba a 1. Se
  -- cobra acá: la racha de antes de hoy menos 10, y hoy encima.
  d := mi_hoy();
  select es_descanso into hoy_descanso from logs where user_id = uid and fecha = d;
  if found then
    select * into perfil from profiles where id = uid;
    previa := perfil.racha_actual - case when hoy_descanso then 0 else 1 end;
    viva := perfil.racha_base + calcular_racha(uid, d - 1);
    if viva >= previa then
      return jsonb_build_object('devueltas', cuantas, 'perdida', jsonb_build_object('perdida', false));
    end if;
    nueva := greatest(0, previa - 10);
    update profiles set racha_base = nueva, perdida_fecha = d - 1 where id = uid;
    racha := nueva + calcular_racha(uid, d);
    update profiles set racha_actual = racha, rango_actual = rango_de_racha(racha) where id = uid;
    -- El día de hoy lleva el número nuevo (es una etiqueta: no vuelve a contar nada).
    update logs set racha_del_dia = racha, planeta_del_dia = planeta_de_dia(racha)
     where user_id = uid and fecha = d and not es_descanso;
    return jsonb_build_object('devueltas', cuantas, 'perdida', jsonb_build_object(
      'perdida', true, 'rango_anterior', perfil.rango_actual, 'rango_nuevo', rango_de_racha(racha),
      'racha', racha, 'vidas_quedan', impulsos_disponibles(uid, d)));
  end if;

  return jsonb_build_object('devueltas', cuantas, 'perdida', verificar_perdida());
end;
$$;
revoke execute on function public.devolver_impulsos(date[]) from public, anon;
grant execute on function public.devolver_impulsos(date[]) to authenticated;

do $$
begin
  if public.version_del_esquema() < 85 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 85; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
