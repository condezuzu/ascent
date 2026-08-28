-- =============================================================
-- MIGRACIÓN 26 — el toque accidental, y series que se pueden reintentar
--
-- Va DESPUÉS de la 25. Ejecutar entera en el SQL Editor de Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1. QUÉ SESIÓN CREÓ EL DÍA
-- -------------------------------------------------------------
-- Tocar "Iniciar entrenamiento" sin querer registraba el día, y ese día ya no
-- se iba nunca: inflaba la racha igual que pesarse un domingo.
--
-- El arreglo NO es dejar de registrar el día —una sesión con duración SÍ es
-- prueba de que fuiste—, sino deshacerlo cuando queda claro que no hubo
-- entrenamiento: si la sesión se para antes del piso de 5 minutos Y ese día lo
-- creó esa misma sesión Y no hay otra sesión ese día. Si el día ya existía por
-- otro camino —lo registraste a mano, o llegaste al gimnasio— no se toca.
--
-- Hace falta guardarlo: desde afuera no se puede distinguir un día que creó la
-- sesión de uno que ya estaba.
alter table public.sesiones
  add column if not exists creo_el_dia boolean not null default false;

-- -------------------------------------------------------------
-- 2. LAS SERIES, DE FORMA QUE SE PUEDAN REINTENTAR
-- -------------------------------------------------------------
-- `sumar_serie` era `series = series + 1`. Con la red cortada —un gimnasio en
-- un subsuelo es el caso normal, no el raro— el toque se perdía en silencio.
-- Y no se puede reintentar: si la escritura llegó pero la respuesta se perdió,
-- el reintento cuenta dos.
--
-- `fijar_series` manda el TOTAL en vez del incremento, así que repetirla es
-- inofensiva: la última gana. Eso es lo que deja al botón + funcionar sin red
-- y sincronizar después.
--
-- Y lleva el id de la sesión porque la cola puede vaciarse mucho más tarde,
-- cuando esa sesión ya terminó: sin el id iría a parar a la sesión equivocada,
-- o a ninguna.
drop function if exists public.sumar_serie();
drop function if exists public.restar_serie();

create or replace function public.fijar_series(p_sesion uuid, p_series int)
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  total int;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  -- Acotado acá y no en el cliente: el conteo llega del teléfono.
  update sesiones set series = greatest(0, least(p_series, 999))
   where id = p_sesion and user_id = uid
   returning series into total;
  return coalesce(total, 0);
end;
$$;

revoke execute on function public.fijar_series(uuid, int) from public, anon, authenticated;
grant execute on function public.fijar_series(uuid, int) to authenticated;

-- -------------------------------------------------------------
-- 3. `iniciar_sesion` ADOPTA en vez de abandonar
-- -------------------------------------------------------------
-- Antes, empezar con una sesión ya corriendo la marcaba 'abandonada' y creaba
-- otra: la duración de la primera se perdía sin que nadie dijera nada. Y podía
-- pasar solo, porque el estado del cliente y el de la base se pueden separar
-- —caché borrada, otra pestaña, dos miradas del vigilante a la vez—.
--
-- Ahora se devuelve la que ya está corriendo. Las vencidas ya las cerró
-- `cerrar_sesiones_vencidas` unas líneas antes, así que cualquier sesión viva
-- a esta altura tiene menos de 4 horas y es legítimamente tuya.
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

  perform cerrar_sesiones_vencidas(uid);

  -- ¿Ya hay una viva? Se sigue esa. Nunca se pisa.
  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is not null then
    return jsonb_build_object('bloqueado', false, 'id', s.id, 'inicio', s.inicio,
      'origen', s.origen, 'series', s.series, 'ahora', now(),
      'yaEstaba', true, 'registro', null);
  end if;

  -- Ni en el futuro ni más atrás de lo permitido. `least` de `now()` primero
  -- porque un reloj adelantado en el teléfono es mucho más común que uno
  -- atrasado, y un inicio en el futuro daría duraciones negativas.
  arranque := least(now(), greatest(coalesce(p_desde, now()), now() - atraso_maximo()));

  select id into l from logs where user_id = uid and fecha = hoy;
  if l is null then
    registro := registrar_dia(p_origen);
    if (registro ->> 'bloqueado')::boolean then
      return registro;
    end if;
    l := (registro ->> 'log_id')::uuid;
  end if;
  insert into sesiones (user_id, log_id, inicio, origen, creo_el_dia)
    values (uid, l, arranque, p_origen, registro is not null)
    returning * into s;
  return jsonb_build_object('bloqueado', false, 'id', s.id, 'inicio', s.inicio,
    'origen', s.origen, 'series', s.series, 'ahora', now(),
    'yaEstaba', false, 'registro', registro);
end;
$$;

-- -------------------------------------------------------------
-- 4. `terminar_sesion` deshace el día si no hubo entrenamiento
-- -------------------------------------------------------------
create or replace function public.terminar_sesion(p_hasta timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
  cierre timestamptz;
  deshizo boolean := false;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform cerrar_sesiones_vencidas(uid);

  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is null then
    return jsonb_build_object('termino', false);
  end if;

  -- Nunca antes del inicio —eso daría duración negativa— ni después de ahora.
  cierre := least(now(), greatest(coalesce(p_hasta, now()), s.inicio));

  update sesiones set estado = 'terminada', fin = cierre
   where id = s.id
   returning * into s;

  -- EL TOQUE ACCIDENTAL. Tres condiciones y las tres tienen que darse:
  --   1. no llegó al piso de 5 minutos → no hubo entrenamiento;
  --   2. el día lo creó ESTA sesión    → no lo registró nadie más;
  --   3. no hay otra sesión ese día    → no entrenaste en otro momento.
  --
  -- Se borra el log y no la sesión: la cascada de `sesiones.log_id` se lleva
  -- la sesión sola, y el trigger de `logs` recalcula la racha. Las fotos NO se
  -- pierden: su `log_id` es `on delete set null`.
  if (s.fin - s.inicio) < piso_sesion()
     and s.creo_el_dia
     and not exists (
       select 1 from sesiones o where o.log_id = s.log_id and o.id <> s.id
     )
  then
    delete from logs where id = s.log_id and user_id = uid;
    deshizo := true;
  end if;

  return jsonb_build_object(
    'termino', true,
    'segundos', extract(epoch from (s.fin - s.inicio)),
    -- abajo del piso la sesión existe y el día cuenta, pero no suma duración
    'cuenta', (s.fin - s.inicio) >= piso_sesion(),
    'deshizo_el_dia', deshizo
  );
end;
$$;
