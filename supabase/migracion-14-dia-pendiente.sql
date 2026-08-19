-- =============================================================
-- MIGRACIÓN 14 — cuando la guarda bloquea, el día NO se pierde
--
-- Va DESPUÉS de la 13. Ejecutar entera en el SQL Editor de Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1. El día que quedó esperando
--
-- La guarda de las 20 horas (§12b) puede bloquear a un viajero legítimo:
-- registra en Montevideo a las 20:00, vuela, aterriza en Madrid y entrena al
-- otro día antes de que pasen las 20 horas de reloj. Son dos días de verdad y
-- la guarda no los puede distinguir de la trampa.
--
-- Un rechazo mudo ahí se lee como "la app está rota", y encima justo cuando
-- lo que está en juego es la racha, que es lo único que no se perdona (§11).
--
-- Entonces el día no se rechaza: queda PENDIENTE y se registra solo apenas
-- pasa la ventana. El usuario no tiene que acordarse de nada.
-- -------------------------------------------------------------
alter table public.profiles
  add column if not exists dia_pendiente date;
alter table public.profiles
  add column if not exists pendiente_desde timestamptz;

-- -------------------------------------------------------------
-- 2. Hasta cuándo dura el bloqueo
--
-- Devuelve el instante exacto en que se destraba, o null si no hay bloqueo.
-- Que sea un instante y no un booleano es lo que permite decirle al usuario
-- CUÁNDO va a poder, en vez de solo que no puede.
-- -------------------------------------------------------------
create or replace function public.bloqueo_hasta(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(l.creado) + interval '20 hours'
    from logs l, profiles p
   where l.user_id = p_user and p.id = p_user
     and p.zona_cambiada is not null
     and l.creado > p.zona_cambiada - interval '20 hours'
     and now() - l.creado < interval '20 hours';
$$;

create or replace function public.puede_registrar_hoy(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select bloqueo_hasta(p_user) is null;
$$;

-- -------------------------------------------------------------
-- 3. Resolver el pendiente
--
-- Se llama sola desde `verificar_perdida`, que corre cada vez que se abre la
-- app. Es el mismo patrón que el cierre de sesiones vencidas: nadie programa
-- nada, se resuelve cuando alguien mira.
--
-- Va ANTES de evaluar la pérdida, a propósito: si el pendiente se registrara
-- después, el día contaría recién mañana y la racha podría cortarse en el
-- medio por un día que la persona sí entrenó.
-- -------------------------------------------------------------
create or replace function public.resolver_pendiente(p_user uuid)
returns date language plpgsql security definer set search_path = public as $$
declare
  pend date;
  puesto date := null;
begin
  select dia_pendiente into pend from profiles where id = p_user;
  if pend is null then return null; end if;
  if bloqueo_hasta(p_user) is not null then return null; end if;

  -- Si mientras tanto el día ya se registró por otro camino —el calendario,
  -- por ejemplo— no se duplica: se limpia el pendiente y listo.
  if not exists (select 1 from logs where user_id = p_user and fecha = pend)
     and pend <= hoy_de(p_user) then
    insert into logs (user_id, fecha) values (p_user, pend);
    puesto := pend;
  end if;

  update profiles set dia_pendiente = null, pendiente_desde = null where id = p_user;
  return puesto;
end;
$$;

-- -------------------------------------------------------------
-- 4. registrar_dia deja de tirar excepción
--
-- Antes levantaba una excepción, y eso tenía un problema de fondo: la
-- excepción DESHACE la transacción, así que no había forma de guardar el
-- pendiente y avisar en la misma llamada. Ahora devuelve un resultado
-- estructurado, que además le sirve mejor a la interfaz que un texto de error.
-- -------------------------------------------------------------
create or replace function public.registrar_dia(p_fecha date default null, p_es_descanso boolean default false, p_peso numeric default null)
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
    if p_peso is not null then
      -- el peso sí se puede guardar ya: no depende del día
      insert into weights (user_id, fecha, valor) values (uid, hoy, p_peso)
        on conflict (user_id, fecha) do update set valor = excluded.valor;
    end if;
    return jsonb_build_object('bloqueado', true, 'pendiente', hoy, 'hasta', hasta);
  end if;

  select rango_actual into rango_antes from profiles where id = uid;
  insert into logs (user_id, fecha, es_descanso) values (uid, hoy, p_es_descanso)
    returning * into nuevo_log;
  if p_peso is not null then
    insert into weights (user_id, fecha, valor) values (uid, hoy, p_peso)
      on conflict (user_id, fecha) do update set valor = excluded.valor;
  end if;
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

-- iniciar_sesion no puede arrancar sin día: la sesión se cuelga de un log.
-- Si está bloqueado devuelve lo mismo y no crea nada.
create or replace function public.iniciar_sesion(p_hoy date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l uuid;
  registro jsonb := null;
  s sesiones;
  hoy date := mi_hoy();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform cerrar_sesiones_vencidas(uid);
  update sesiones set estado = 'abandonada' where user_id = uid and estado = 'corriendo';
  select id into l from logs where user_id = uid and fecha = hoy;
  if l is null then
    registro := registrar_dia();
    if (registro ->> 'bloqueado')::boolean then
      return registro;
    end if;
    l := (registro ->> 'log_id')::uuid;
  end if;
  insert into sesiones (user_id, log_id) values (uid, l) returning * into s;
  return jsonb_build_object('bloqueado', false, 'id', s.id, 'inicio', s.inicio,
    'ahora', now(), 'registro', registro);
end;
$$;

-- -------------------------------------------------------------
-- 5. verificar_perdida resuelve el pendiente antes de mirar nada
-- -------------------------------------------------------------
create or replace function public.verificar_perdida(p_hoy date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  perfil profiles;
  viva int;
  nuevo_rango int;
  nueva_racha int;
  hoy date := mi_hoy();
  resuelto date;
begin
  -- primero el pendiente: si se registrara después, el día contaría recién
  -- mañana y la racha se podría cortar por un día que la persona sí entrenó
  resuelto := resolver_pendiente(uid);

  select * into perfil from profiles where id = uid;
  if perfil.id is null or perfil.racha_actual = 0 then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  if exists (select 1 from logs where user_id = uid and fecha = hoy) then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  viva := perfil.racha_base + calcular_racha(uid, hoy - 1);
  if viva >= perfil.racha_actual then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  nueva_racha := greatest(0, perfil.racha_actual - 10);
  nuevo_rango := rango_de_racha(nueva_racha);
  update profiles set
    racha_actual = nueva_racha,
    racha_base = nueva_racha,
    rango_actual = nuevo_rango,
    perdida_fecha = hoy - 1
  where id = uid;
  return jsonb_build_object('perdida', true, 'rango_anterior', perfil.rango_actual,
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha, 'pendiente_resuelto', resuelto);
end;
$$;

-- -------------------------------------------------------------
-- 6. Permisos
-- -------------------------------------------------------------
revoke execute on function public.bloqueo_hasta(uuid), public.resolver_pendiente(uuid)
  from public, anon, authenticated;
