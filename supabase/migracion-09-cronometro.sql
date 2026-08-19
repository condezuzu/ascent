-- =============================================================
-- MIGRACIÓN 09 — cronómetro de sesión (§17) y peso corporal a mano
--
-- Para bases que YA tienen el schema aplicado. En una base nueva no hace
-- falta: schema.sql ya lo incluye todo.
-- Ejecutar entero en el SQL Editor de Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Anotar el peso corporal sin registrar un día
--
-- Hasta ahora el peso solo se podía cargar dentro de registrar_dia, así que
-- quien ya había registrado hoy y nunca había anotado su peso no tenía forma
-- de hacerlo: la pantalla de fuerza le decía "se anota al registrar un día" y
-- en ese momento eso ya no se podía. Sin peso no hay DOTS (§16.4), así que
-- quedaba en un callejón sin salida hasta el día siguiente.
--
-- Va por RPC y no por grant de insert sobre weights: la tabla sigue siendo de
-- solo lectura para el cliente, y así el peso no se puede escribir en la
-- fecha de otro ni saltear el rango permitido.
-- -------------------------------------------------------------
create or replace function public.anotar_peso(p_fecha date, p_valor numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  -- el cliente manda su fecha local; el servidor está en UTC y solo tolera la
  -- ventana de huso horario, ni un día más
  if p_fecha > current_date + 1 or p_fecha < current_date - 1 then
    p_fecha := current_date;
  end if;
  insert into weights (user_id, fecha, valor) values (uid, p_fecha, p_valor)
    on conflict (user_id, fecha) do update set valor = excluded.valor;
end;
$$;

-- -------------------------------------------------------------
-- 2. Los dos números del cronómetro, en un solo lugar
--
-- Están también en `src/lib/reglas.ts`, porque la pantalla necesita las
-- mismas cuentas. La sección 26 de test:db compara las dos copias.
-- -------------------------------------------------------------

-- A las 4 horas la sesión se cierra sola y queda SIN duración (§17.3).
create or replace function public.tope_sesion()
returns interval language sql immutable as $$ select interval '4 hours' $$;

-- Abajo de 5 minutos cuenta como día pero no como duración (§17.7): empezar
-- y parar sin querer es una duración real que ensucia el promedio.
create or replace function public.piso_sesion()
returns interval language sql immutable as $$ select interval '5 minutes' $$;

-- -------------------------------------------------------------
-- 3. Las sesiones
--
-- La duración NO es una columna: es `fin - inicio`. Guardar el derivado
-- dejaría que quedara en desacuerdo con sus propias puntas.
--
-- "Sin duración" es la AUSENCIA de `fin`, no un valor especial: el check hace
-- que una sesión abandonada no pueda tener fin, así la regla de "no inventes
-- un número" la sostiene la base y no la memoria de quien programe después.
--
-- log_id con cascade: si el día se borra desde el calendario, la sesión se va
-- con él. Una sesión de un día que no existe no mide nada.
-- -------------------------------------------------------------
create table if not exists public.sesiones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_id uuid not null references public.logs(id) on delete cascade,
  inicio timestamptz not null default now(),
  fin timestamptz,
  estado text not null default 'corriendo'
    check (estado in ('corriendo', 'terminada', 'abandonada')),
  constraint sesiones_fin_solo_si_termino check ((estado = 'terminada') = (fin is not null))
);

-- una sola corriendo por usuario, garantizado por la base y no por el cliente
create unique index if not exists sesiones_una_corriendo
  on public.sesiones (user_id) where estado = 'corriendo';
create index if not exists sesiones_por_usuario
  on public.sesiones (user_id, inicio desc);

-- -------------------------------------------------------------
-- 4. El cierre automático
--
-- No hay tarea programada: la sesión se evalúa cuando algo la lee, igual que
-- la pérdida de racha (§12). Así se cierra aunque el usuario no vuelva a
-- abrir la app, y el corte lo decide el servidor contra el `inicio` guardado
-- —nunca el reloj del teléfono, que se puede atrasar a propósito—.
--
-- Ojo con la medianoche: acá NO se toca el log. Una sesión que empezó a las
-- 23:00 y se cierra a las 03:00 pertenece al día en que EMPEZÓ, porque su
-- log_id se fijó al iniciar y nada lo mueve después.
-- -------------------------------------------------------------
create or replace function public.cerrar_sesiones_vencidas(p_user uuid)
returns void language sql security definer set search_path = public as $$
  update sesiones set estado = 'abandonada'
   where user_id = p_user and estado = 'corriendo' and now() - inicio >= tope_sesion();
$$;

-- -------------------------------------------------------------
-- 5. Empezar
--
-- El día se registra ACÁ, al iniciar, no al terminar (§17.2): el que se
-- olvida de parar el cronómetro perdería el día, y eso es peor que perder la
-- duración.
--
-- Si el día ya estaba registrado no se duplica nada: la sesión se cuelga del
-- log que ya existe y lo único que agrega es la duración.
-- -------------------------------------------------------------
create or replace function public.iniciar_sesion(p_hoy date default current_date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l uuid;
  registro jsonb := null;
  s sesiones;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_hoy > current_date + 1 or p_hoy < current_date - 1 then p_hoy := current_date; end if;

  perform cerrar_sesiones_vencidas(uid);
  -- Si quedaba otra corriendo, se abandona: no sabemos cuándo terminó, así
  -- que no puede quedar con duración. Terminarla en `now()` sería inventar.
  update sesiones set estado = 'abandonada' where user_id = uid and estado = 'corriendo';

  select id into l from logs where user_id = uid and fecha = p_hoy;
  if l is null then
    -- se reusa registrar_dia y no un insert suelto para que la subida de
    -- rango y el recálculo de racha pasen por el mismo camino de siempre
    registro := registrar_dia(p_hoy, false, null);
    l := (registro ->> 'log_id')::uuid;
  end if;

  insert into sesiones (user_id, log_id) values (uid, l) returning * into s;
  return jsonb_build_object(
    'id', s.id,
    'inicio', s.inicio,
    -- el ahora del SERVIDOR, para que el cliente saque el desfasaje de su
    -- propio reloj una sola vez y el cronómetro no se vea corrido (§17.5)
    'ahora', now(),
    'registro', registro -- null si el día ya estaba registrado
  );
end;
$$;

-- -------------------------------------------------------------
-- 6. Terminar
-- -------------------------------------------------------------
create or replace function public.terminar_sesion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  -- primero se cierran las vencidas: si pasaron 4 horas, esta llamada llega
  -- tarde y la sesión ya no tiene duración
  perform cerrar_sesiones_vencidas(uid);

  update sesiones set estado = 'terminada', fin = now()
   where user_id = uid and estado = 'corriendo'
   returning * into s;

  if s.id is null then
    return jsonb_build_object('termino', false);
  end if;
  return jsonb_build_object(
    'termino', true,
    'segundos', extract(epoch from (s.fin - s.inicio)),
    -- abajo del piso la sesión existe y el día cuenta, pero no suma duración
    'cuenta', (s.fin - s.inicio) >= piso_sesion()
  );
end;
$$;

-- -------------------------------------------------------------
-- 7. La sesión que está corriendo, si hay
-- -------------------------------------------------------------
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
    'ahora', now(),
    'tope_segundos', extract(epoch from tope_sesion())
  );
end;
$$;

-- -------------------------------------------------------------
-- 8. El resumen para Stats
--
-- Promedio y total salen SOLO de las sesiones con duración válida. Las
-- abandonadas y las muy cortas se cuentan aparte y se muestran: si no, el
-- promedio parecería calculado sobre más sesiones de las que entran.
-- -------------------------------------------------------------
create or replace function public.resumen_sesiones()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  validas int;
  total numeric;
  abandonadas int;
  cortas int;
begin
  if uid is null then return null; end if;
  perform cerrar_sesiones_vencidas(uid);

  select count(*), coalesce(sum(extract(epoch from (fin - inicio))), 0)
    into validas, total
    from sesiones
   where user_id = uid and estado = 'terminada' and (fin - inicio) >= piso_sesion();

  select count(*) into abandonadas
    from sesiones where user_id = uid and estado = 'abandonada';

  select count(*) into cortas
    from sesiones
   where user_id = uid and estado = 'terminada' and (fin - inicio) < piso_sesion();

  return jsonb_build_object(
    'validas', validas,
    'total_segundos', total,
    'promedio_segundos', case when validas > 0 then round(total / validas) end,
    'abandonadas', abandonadas,
    'cortas', cortas
  );
end;
$$;

-- -------------------------------------------------------------
-- 9. RLS
--
-- Las sesiones son SOLO del dueño, ni siquiera de los amigos (§17.8):
-- competir por quién pasa más tiempo en el gimnasio empuja a entrenar de más,
-- y tres horas no son mejores que una.
-- -------------------------------------------------------------
alter table public.sesiones enable row level security;

drop policy if exists "sesiones: solo dueño" on public.sesiones;
create policy "sesiones: solo dueño" on public.sesiones for select
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 10. Permisos
-- -------------------------------------------------------------
revoke all on table public.sesiones from anon, authenticated;
-- solo lectura: empezar y terminar son RPC, para que nadie se escriba el
-- `inicio` que quiera ni resucite una sesión abandonada
grant select on public.sesiones to authenticated;

revoke execute on function public.cerrar_sesiones_vencidas(uuid)
  from public, anon, authenticated;

revoke execute on function
  public.anotar_peso(date, numeric),
  public.iniciar_sesion(date),
  public.terminar_sesion(),
  public.mi_sesion(),
  public.resumen_sesiones()
  from public, anon;

grant execute on function
  public.anotar_peso(date, numeric),
  public.iniciar_sesion(date),
  public.terminar_sesion(),
  public.mi_sesion(),
  public.resumen_sesiones()
  to authenticated;

-- tope_sesion y piso_sesion quedan abiertas: son constantes, igual que
-- rango_de_racha. El test diferencial las compara contra las del cliente.
