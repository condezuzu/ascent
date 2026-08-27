-- =============================================================
-- MIGRACIÓN 24 — la sesión arranca al llegar, y termina al irse
--
-- Va DESPUÉS de la 23. Ejecutar entera en el SQL Editor de Supabase.
-- =============================================================

-- Si el día se registra por cercanía, el cronómetro arranca también. Pero no
-- al instante: hay que quedarse un rato en la zona (§13). Eso resuelve solo el
-- falso positivo del que pasa caminando por la puerta, y además le da tiempo a
-- la persona a cambiarse antes de que empiece a contar algo.
--
-- Lo que esto agrega a la base es lo que el cliente NO puede resolver solo:
--   1. `sesiones.origen`, para saber cuáles se pueden cerrar solas.
--   2. Un inicio ANTERIOR a la llamada, porque el cronómetro arranca a los
--      siete minutos pero la sesión tiene que decir la hora en que llegaste.
--   3. Un fin anterior a la llamada, por lo mismo al revés: si la app estaba
--      cerrada, nos enteramos de que se fue mucho después de que se fue.
--
-- Y lo que agrega es también un AGUJERO si se hace mal: un cliente que puede
-- elegir cuándo empezó y cuándo terminó una sesión puede fabricarse duraciones.
-- Por eso las dos fechas se acotan acá y no se confía en ninguna.

-- -------------------------------------------------------------
-- DE DÓNDE SALIÓ LA SESIÓN
-- -------------------------------------------------------------
-- Solo se cierran solas las que arrancaron solas. La que empezaste vos con el
-- botón se queda corriendo aunque salgas del gimnasio: quizá te fuiste a
-- correr afuera, y apagarte el cronómetro sería peor que dejarlo.
--
-- No lleva 'salud' como `logs.origen`: una pulsera puede decir que entrenaste,
-- no cuándo arrancaste ni cuándo paraste.
alter table public.sesiones
  add column if not exists origen text not null default 'manual';

alter table public.sesiones drop constraint if exists sesiones_origen_valido;
alter table public.sesiones add constraint sesiones_origen_valido
  check (origen in ('manual', 'ubicacion'));

-- -------------------------------------------------------------
-- Cuánto se puede correr el inicio hacia atrás
-- -------------------------------------------------------------
-- El cliente manda la hora en que te vio llegar. Es un dato suyo, o sea que no
-- es un dato: acotarlo es lo único que impide que alguien se invente una
-- sesión de seis horas y se ensucie sus propias estadísticas —y, el día que
-- haya ranking de duración, las de todos.
--
-- Cuarenta y cinco minutos porque el atraso legítimo son los siete de la
-- espera más lo que la app haya estado mirando antes de disparar. Nunca es
-- más que eso, y de todas formas la sesión entera se cierra sola a las 4 h.
create or replace function public.atraso_maximo()
returns interval language sql immutable as $$ select interval '45 minutes' $$;

-- -------------------------------------------------------------
-- `iniciar_sesion` con hora de llegada y origen
-- -------------------------------------------------------------
-- DROP y create: agregar parámetros con `create or replace` deja viva la firma
-- vieja como sobrecarga, y entonces `iniciar_sesion()` queda ambigua y falla.
-- Es el caso `hoy_uy()` otra vez (spec/trampas.md).
drop function if exists public.iniciar_sesion();
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
    registro := registrar_dia(false, null, p_origen);
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

revoke execute on function public.iniciar_sesion(timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.iniciar_sesion(timestamptz, text) to authenticated;

-- -------------------------------------------------------------
-- `terminar_sesion` con hora de salida
-- -------------------------------------------------------------
-- El que usa el automático es JUSTO el que no se va a acordar de parar el
-- cronómetro: sin cierre por salida se come el vencimiento de 4 horas y la
-- sesión queda sin duración. Pero si la app estaba cerrada, nos enteramos de
-- que se fue recién cuando la vuelve a abrir —capaz en la cena—, y cerrar con
-- `now()` le daría una sesión de cinco horas. Se cierra con la última vez que
-- lo vimos adentro.
drop function if exists public.terminar_sesion();
create or replace function public.terminar_sesion(p_hasta timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
  cierre timestamptz;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  -- primero se cierran las vencidas: si pasaron 4 horas, esta llamada llega
  -- tarde y la sesión ya no tiene duración
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

  return jsonb_build_object(
    'termino', true,
    'segundos', extract(epoch from (s.fin - s.inicio)),
    -- abajo del piso la sesión existe y el día cuenta, pero no suma duración
    'cuenta', (s.fin - s.inicio) >= piso_sesion()
  );
end;
$$;

revoke execute on function public.terminar_sesion(timestamptz)
  from public, anon, authenticated;
grant execute on function public.terminar_sesion(timestamptz) to authenticated;

-- -------------------------------------------------------------
-- `mi_sesion` dice de dónde salió
-- -------------------------------------------------------------
-- El cliente necesita saberlo para decidir si al salir de la zona la cierra o
-- la deja. Sin esto tendría que acordarse él, y "acordarse él" significa que
-- se olvida en cuanto cambiás de teléfono o limpiás el navegador.
--
-- Misma firma, así que `create or replace` sin drop: los permisos se quedan
-- donde están.
create or replace function public.mi_sesion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
begin
  if uid is null then return null; end if;
  perform cerrar_sesiones_vencidas(uid);
  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is null then
    return jsonb_build_object('corriendo', false, 'ahora', now());
  end if;
  return jsonb_build_object(
    'corriendo', true,
    'id', s.id,
    'inicio', s.inicio,
    'origen', s.origen,
    'ahora', now(),
    'series', s.series,
    'tope_segundos', extract(epoch from tope_sesion())
  );
end;
$$;
