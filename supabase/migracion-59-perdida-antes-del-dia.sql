-- MIGRACIÓN 59 — LA PÉRDIDA SE REVISA ANTES DE QUE ENTRE UN DÍA
--
-- EL BUG (4/10/2026): LA RACHA SE CAÍA A 1.
--
-- Gastar una vida o restar 10 lo hacía solo `verificar_perdida`, que corre al
-- abrir Inicio. Si el día de hoy entraba ANTES de esa revisión, el disparador
-- `logs_after_change` contaba hacia atrás desde hoy, se topaba con el hueco de
-- ayer y dejaba la racha en 1. Y la revisión, cuando por fin llegaba, veía que
-- hoy ya tenía día y salía sin hacer nada. Ni vida ni -10.
--
-- Los caminos por los que el día entra sin pasar por Inicio:
--   - el registro por ubicación con la app cerrada (`registrar_dia('ubicacion')`);
--   - la sesión que arranca sola al llegar al gimnasio (`iniciar_sesion`);
--   - marcar hoy desde el calendario, que inserta en `logs` directo;
--   - cualquiera de los anteriores cuando `pantalla_inicio` falló por red.
--
-- EL ARREGLO, en dos piezas:
--  1. `aplicar_perdida_al(p_user, p_dia)`: la cuenta de la pérdida de siempre,
--     mirando la racha como estaba la mañana de `p_dia`. `verificar_perdida_de`
--     pasa a ser "resolver el día pendiente + esa cuenta a hoy": el mismo
--     resultado que antes, por el mismo código.
--  2. Un disparador ANTES de insertar en `logs`: si el día que entra es más
--     nuevo que todos los registrados, primero corre la cuenta a ese día. Ningún
--     cliente lo puede saltear, sea la build de tienda, la web o el teléfono.
--
-- LO QUE NO CAMBIA: corregir un día viejo no cobra nada. "Ayer sí fui" tapa el
-- hueco; un día de hace un mes no dice nada de la racha de hoy.
--
-- SE PUEDE CORRER DOS VECES, Y SE PUEDE CORRER ANTES QUE LA 54. No usa nada de
-- las migraciones 54 a 58, así que cierra el bug sobre el esquema 53 que tiene
-- producción hoy. En ese caso NO sube la versión: el cliente decide qué puede
-- usar mirando `version_del_esquema()`, y un 59 con la 57 y la 58 sin aplicar lo
-- haría pedir columnas que no existen. Corrida temprano hay que volver a
-- correrla en su lugar, después de la 58: la 55 vuelve a definir
-- `verificar_perdida_de` con su cuerpo de antes (que da el mismo resultado), y
-- recién esa segunda pasada sube la versión a 59.
--
-- Igual que en schema.sql.

create or replace function public.aplicar_perdida_al(p_user uuid, p_dia date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  perfil profiles;
  viva int;
  nuevo_rango int;
  nueva_racha int;
  d date;
  cubiertos date[] := '{}';
begin
  select * into perfil from profiles where id = p_user;
  if perfil.id is null or perfil.racha_actual = 0 then
    return jsonb_build_object('perdida', false);
  end if;
  if exists (select 1 from logs where user_id = p_user and fecha = p_dia) then
    return jsonb_build_object('perdida', false);
  end if;
  viva := perfil.racha_base + calcular_racha(p_user, p_dia - 1);
  if viva >= perfil.racha_actual then
    return jsonb_build_object('perdida', false);
  end if;

  d := p_dia - 1;
  loop
    exit when perfil.perdida_fecha is not null and d <= perfil.perdida_fecha;
    -- Tope de seguridad: un año atrás la racha ya sería 0 y no hay nada que
    -- cubrir. Sin esto, saltar descansos podría no terminar.
    exit when p_dia - d > 366;
    exit when exists (select 1 from logs where user_id = p_user and fecha = d);
    -- UN DÍA DE DESCANSO NO CORTA LA COBERTURA (arreglo del 30/9). Antes hacía
    -- `exit` y una falta real MÁS VIEJA que un descanso quedaba sin cubrir aunque
    -- hubiera vidas: quien descansa el finde perdía la racha injustamente. Ahora
    -- se SALTA —igual que un día ya cubierto— y se sigue mirando más atrás.
    if extract(dow from d)::int = any(descansos_vigentes(p_user, d))
       or exists (select 1 from vidas_usadas where user_id = p_user and fecha = d) then
      d := d - 1;
      continue;
    end if;
    -- ¿queda un impulso disponible para ESE día?
    exit when impulsos_disponibles(p_user, d) <= 0;
    insert into vidas_usadas (user_id, fecha) values (p_user, d)
      on conflict (user_id, fecha) do nothing;
    cubiertos := cubiertos || d;
    d := d - 1;
    exit when array_length(cubiertos, 1) >= impulsos_tope();
  end loop;

  if array_length(cubiertos, 1) > 0 then
    viva := perfil.racha_base + calcular_racha(p_user, p_dia - 1);
    if viva >= perfil.racha_actual then
      return jsonb_build_object(
        'perdida', false,
        'vidas_usadas', to_jsonb(cubiertos),
        'vidas_quedan', impulsos_disponibles(p_user, p_dia)
      );
    end if;
  end if;

  -- No alcanzó: la racha se corta igual, y los impulsos gastados NO se
  -- devuelven —el día que cubrieron sigue cubierto—. Devolverlos sería premiar
  -- la falta larga: el que faltó seis días terminaría con más que el que faltó
  -- dos.
  nueva_racha := greatest(0, perfil.racha_actual - 10);
  nuevo_rango := rango_de_racha(nueva_racha);
  update profiles set
    racha_actual = nueva_racha,
    racha_base = nueva_racha,
    rango_actual = nuevo_rango,
    perdida_fecha = p_dia - 1
  where id = p_user;
  return jsonb_build_object('perdida', true, 'rango_anterior', perfil.rango_actual,
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha,
    'vidas_usadas', to_jsonb(cubiertos),
    'vidas_quedan', impulsos_disponibles(p_user, p_dia));
end;
$$;

create or replace function public.verificar_perdida_de(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  resuelto date;
begin
  resuelto := resolver_pendiente(p_user);
  return aplicar_perdida_al(p_user, hoy_de(p_user))
    || jsonb_build_object('pendiente_resuelto', resuelto);
end;
$$;

create or replace function public.verificar_perdida()
returns jsonb language sql security definer set search_path = public as $$
  select public.verificar_perdida_de(auth.uid());
$$;

create or replace function public.logs_antes_revisar_perdida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from logs where user_id = new.user_id and fecha >= new.fecha) then
    perform aplicar_perdida_al(new.user_id, new.fecha);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_logs_antes_perdida on public.logs;
-- EL NOMBRE DECIDE EL ORDEN: los disparadores de un mismo momento corren por
-- orden alfabético, y este tiene que ir ANTES que `trg_logs_before_insert`, que
-- calcula el planeta del día con la racha que quede después de la pérdida.
create trigger trg_logs_antes_perdida before insert on public.logs
  for each row execute function public.logs_antes_revisar_perdida();

revoke execute on function public.verificar_perdida_de(uuid) from public, anon, authenticated;
-- Con la cuenta "a tal día" suelta, cualquiera podría cobrarle una pérdida a
-- otra cuenta: solo la llaman el disparador y `verificar_perdida_de`.
revoke execute on function public.aplicar_perdida_al(uuid, date) from public, anon, authenticated;
revoke execute on function public.logs_antes_revisar_perdida() from public, anon, authenticated;

-- LA VERSIÓN SUBE A 59 SOLO SI YA ESTÁ LA 58 (ver arriba). Solo sube, nunca baja.
do $$
begin
  if public.version_del_esquema() >= 58 then
    execute 'create or replace function public.version_del_esquema() returns int language sql immutable as $v$ select 59; $v$';
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
