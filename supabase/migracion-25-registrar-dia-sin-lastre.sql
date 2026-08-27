-- =============================================================
-- MIGRACIÓN 25 — `registrar_dia` pierde dos parámetros que eran constantes
--
-- Va DESPUÉS de la 24. Ejecutar entera en el SQL Editor de Supabase.
--
-- SIN APURO Y SIN ORDEN: el cliente ya está desplegado pasándole solo
-- `p_origen`, y eso funciona igual contra la firma vieja —los otros dos
-- parámetros tienen default— que contra la nueva. Comprobado contra la
-- producción de verdad antes de escribir esto.
-- =============================================================

-- `registrar_dia(p_es_descanso, p_peso, p_origen)` tenía dos parámetros que
-- ningún llamador usaba nunca:
--
--   p_peso         → siempre null. El peso corporal se anota a la mañana, sin
--                    entrenar, y atarlo al registro del día hacía que pesarse
--                    un domingo contara como día de gimnasio. Se separó el
--                    27/8/2026; el parámetro quedó ahí sin que nadie lo use.
--   p_es_descanso  → siempre false. Los días de descanso se eligen una vez
--                    como días fijos de la semana (`descansos`), no se
--                    registran de a uno. Nadie le pasó `true` nunca.
--
-- Un parámetro que siempre vale lo mismo no es un parámetro: es una constante
-- disfrazada, y el que lea la firma dentro de seis meses va a asumir que sirve
-- y escribir código alrededor de algo que no hace nada. Lo encontró la sección
-- 44 de `test:db`, que es nueva y salió justamente de preguntarse por qué la
-- 34 no había agarrado `p_peso`: la 34 mira si la FUNCIÓN lee lo que recibe
-- —y sí lo leía—, no si alguien se lo pasa alguna vez.
--
-- OJO CON LO QUE ESTO NO HACE: la columna `logs.es_descanso` se queda. Hoy es
-- siempre `false` y hay código que la lee, pero sacarla es otra conversación
-- y toca el cálculo de racha.

drop function if exists public.registrar_dia(boolean, numeric, text);

create or replace function public.registrar_dia(p_origen text default 'manual')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rango_antes int;
  perfil profiles;
  nuevo_log logs;
  hoy date := mi_hoy();
  hasta timestamptz := bloqueo_hasta(uid);
begin
  if hasta is not null then
    -- el día queda anotado; se registra solo cuando pase la ventana
    update profiles set dia_pendiente = hoy, pendiente_desde = now() where id = uid;
    return jsonb_build_object('bloqueado', true, 'pendiente', hoy, 'hasta', hasta);
  end if;

  select rango_actual into rango_antes from profiles where id = uid;
  insert into logs (user_id, fecha, origen)
    values (uid, hoy, p_origen)
    returning * into nuevo_log;
  select * into perfil from profiles where id = uid;
  return jsonb_build_object(
    'bloqueado', false,
    'log_id', nuevo_log.id,
    'racha', perfil.racha_actual,
    'rango_antes', rango_antes,
    'rango_despues', perfil.rango_actual,
    'planeta', nuevo_log.planeta_del_dia,
    'subio_rango', perfil.rango_actual > rango_antes
  );
end;
$$;

-- Dropear la devuelve con EXECUTE para PUBLIC, que la abriría a `anon`. Es la
-- lección de la migración 22, y la agarró test-deriva cuando faltaba.
revoke execute on function public.registrar_dia(text) from public, anon, authenticated;
grant execute on function public.registrar_dia(text) to authenticated;

-- `iniciar_sesion` la llamaba con los tres argumentos por posición.
create or replace function public.iniciar_sesion(
  p_desde timestamptz default null,
  p_origen text default 'manual'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l uuid;
  registro jsonb := null;
  s sesiones;
  hoy date := mi_hoy();
  arranque timestamptz;
begin
  if uid is null then raise exception 'sin sesión'; end if;

  -- Ni en el futuro ni más atrás de lo permitido. `least` de `now()` primero
  -- porque un reloj adelantado en el teléfono es mucho más común que uno
  -- atrasado, y un inicio en el futuro daría duraciones negativas.
  arranque := least(now(), greatest(coalesce(p_desde, now()), now() - atraso_maximo()));

  perform cerrar_sesiones_vencidas(uid);
  update sesiones set estado = 'abandonada' where user_id = uid and estado = 'corriendo';
  select id into l from logs where user_id = uid and fecha = hoy;
  if l is null then
    -- El día hereda el origen de la sesión: si el cronómetro arrancó porque
    -- llegaste, el día también entró por eso, y el log tiene que decirlo.
    registro := registrar_dia(p_origen);
    if (registro ->> 'bloqueado')::boolean then
      return registro;
    end if;
    l := (registro ->> 'log_id')::uuid;
  end if;
  insert into sesiones (user_id, log_id, inicio, origen)
    values (uid, l, arranque, p_origen)
    returning * into s;
  return jsonb_build_object('bloqueado', false, 'id', s.id, 'inicio', s.inicio,
    'origen', s.origen, 'ahora', now(), 'registro', registro);
end;
$$;
