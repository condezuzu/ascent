-- =============================================================
-- MIGRACIÓN 32 — las vidas
--
-- Va DESPUÉS de la 31. Ejecutar entera en el SQL Editor de Supabase.
--
-- Es ADITIVA en tablas —una nueva— pero CAMBIA TRES FUNCIONES que ya
-- existen: `calcular_racha`, `mejor_racha_real` y `verificar_perdida`. Las
-- tres se reemplazan enteras acá abajo. No cambia la forma de lo que
-- devuelven, así que el cliente viejo sigue andando: se puede correr antes o
-- después del deploy.
-- =============================================================

-- -------------------------------------------------------------
-- QUÉ SON
-- -------------------------------------------------------------
-- Tres por mes. Si faltás un día, se usa una y la racha no se corta.
--
-- SE APLICAN SOLAS, y esa es la mitad de la idea: si hay que acordarse de
-- usarlas, te olvidás justo el día que la necesitabas. No hay botón.
--
-- NO SE ACUMULAN. Tres por mes y las que no usaste no viajan al mes que
-- viene. Acumular las convierte en una cuenta de ahorro, y una cuenta de
-- ahorro invita a planificar ausencias —"tengo nueve, me tomo la semana"—.
-- Al año alguien tendría treinta y seis y la racha dejaría de significar algo.
--
-- UNA VIDA CUBRE UN DÍA. Si faltás cuatro y tenés tres, se gastan las tres y
-- el cuarto corta la racha. Da igual si abrís la app cada día o volvés el
-- quinto: se evalúa hacia atrás y el resultado es el mismo.
--
-- LOS DÍAS DE DESCANSO NO GASTAN VIDA. Un día de descanso no es una falta;
-- las vidas son para lo que no estaba planeado.
--
-- LA VIDA GASTADA NO SE DEVUELVE NUNCA. Esto no es una regla aparte, sale
-- solo del modelo: lo que se guarda es QUÉ DÍA quedó cubierto, y ese día
-- queda cubierto para siempre. Si faltaste el 30 y el 31 de agosto y el 1 de
-- septiembre se recargan, esos dos días siguen cubiertos: lo que se recarga
-- es cuántas podés gastar de acá en adelante, no lo que ya pasó.
--
-- Y EL MES DE UNA VIDA ES EL DEL DÍA QUE CUBRE, no el día en que la app se
-- dio cuenta. Faltar el 30 y 31 de agosto gasta dos vidas DE AGOSTO aunque
-- abras la app en septiembre. Si no fuera así, una ausencia a fin de mes se
-- comería la cuota del mes siguiente sin que nadie lo pidiera.

create table if not exists public.vidas_usadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- El día que quedó cubierto. Único por usuario: cubrir dos veces el mismo
  -- día sería gastar dos vidas por una sola falta.
  fecha date not null,
  creado timestamptz not null default now(),
  unique (user_id, fecha)
);
create index if not exists vidas_por_usuario on public.vidas_usadas (user_id, fecha);

alter table public.vidas_usadas enable row level security;

-- Solo el dueño las ve. Y NADIE las escribe desde el cliente: las pone
-- `verificar_perdida`, que es SECURITY DEFINER. Una vida que el teléfono
-- pudiera insertar sería una racha que el teléfono puede inventar.
drop policy if exists "vidas: solo dueño" on public.vidas_usadas;
create policy "vidas: solo dueño" on public.vidas_usadas for select
  using (user_id = auth.uid());

grant select on public.vidas_usadas to authenticated;

-- -------------------------------------------------------------
-- CUÁNTAS QUEDAN
-- -------------------------------------------------------------
create or replace function public.vidas_por_mes()
returns int language sql immutable as $$ select 3; $$;

/**
 * Las que quedan en el mes de `p_dia`. Se cuenta contra las filas, así que
 * "recargar" no es un proceso que corra en ningún lado: es que cambió el mes.
 */
create or replace function public.vidas_disponibles(p_user uuid, p_dia date)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, vidas_por_mes() - (
    select count(*)::int from vidas_usadas
     where user_id = p_user
       and date_trunc('month', fecha) = date_trunc('month', p_dia)
  ));
$$;

/** Lo que necesita la interfaz: cuántas quedan y cuáles se usaron este mes. */
create or replace function public.mis_vidas()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', vidas_por_mes(),
    'quedan', vidas_disponibles(auth.uid(), mi_hoy()),
    -- Las de ESTE mes, para dibujar los puntos, y la última de todas para el
    -- aviso del día siguiente —que puede ser del mes pasado si faltaste un 31.
    'del_mes', coalesce((
      select jsonb_agg(fecha order by fecha)
        from vidas_usadas
       where user_id = auth.uid()
         and date_trunc('month', fecha) = date_trunc('month', mi_hoy())
    ), '[]'::jsonb),
    'ultima', (
      select max(fecha) from vidas_usadas where user_id = auth.uid()
    )
  );
$$;

revoke execute on function public.mis_vidas() from public, anon;
grant execute on function public.mis_vidas() to authenticated;
revoke execute on function public.vidas_disponibles(uuid, date) from public, anon;
revoke execute on function public.vidas_por_mes() from public, anon;

-- -------------------------------------------------------------
-- UN DÍA CUBIERTO NO CORTA LA RACHA
-- -------------------------------------------------------------
-- Se comporta igual que un día de descanso: no corta y TAMPOCO SUMA. No
-- entrenaste, así que la racha no crece — solo no se rompe.
create or replace function public.calcular_racha(p_user uuid, p_hasta date)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  d date := p_hasta;
  cnt int := 0;
  tope date;
  tiene_log boolean;
  log_descanso boolean;
begin
  select perdida_fecha into tope from profiles where id = p_user;
  loop
    -- los días hasta la última pérdida ya viven en racha_base: no se recuentan
    if tope is not null and d <= tope then exit; end if;
    select true, es_descanso into tiene_log, log_descanso
      from logs where user_id = p_user and fecha = d;
    if tiene_log then
      if not log_descanso then cnt := cnt + 1; end if;
    -- El descanso se evalúa con la configuración que regía ESE día, no con
    -- la de hoy: cambiar de rutina nunca puede alterar el pasado.
    elsif extract(dow from d)::int = any(descansos_vigentes(p_user, d)) then
      null; -- día de descanso sin log: no corta
    -- Un día cubierto por una vida: tampoco corta, y tampoco suma.
    elsif exists (select 1 from vidas_usadas where user_id = p_user and fecha = d) then
      null;
    else
      exit;
    end if;
    d := d - 1;
    if d < p_hasta - 3650 then exit; end if; -- tope de seguridad
  end loop;
  return cnt;
end;
$$;

-- Y lo mismo en el historial. Si la mejor racha no supiera de vidas, el
-- récord y la racha viva contarían distinto la misma semana: el número de
-- arriba diría 40 y el de al lado 12.
create or replace function public.mejor_racha_real(p_user uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  anterior date := null;
  corriente int := 0;
  maximo int := 0;
  d date;
begin
  for r in
    select fecha, es_descanso from logs where user_id = p_user order by fecha
  loop
    if anterior is not null then
      -- se revisan los días entre medio: cortan salvo que fueran de descanso
      -- o que una vida los haya cubierto
      d := anterior + 1;
      while d < r.fecha loop
        if not (extract(dow from d)::int = any(descansos_vigentes(p_user, d)))
           and not exists (select 1 from vidas_usadas where user_id = p_user and fecha = d)
        then
          corriente := 0;
          exit;
        end if;
        d := d + 1;
      end loop;
    end if;
    if not r.es_descanso then corriente := corriente + 1; end if;
    if corriente > maximo then maximo := corriente; end if;
    anterior := r.fecha;
  end loop;
  return maximo;
end;
$$;

-- -------------------------------------------------------------
-- GASTARLAS: solo cuando hay algo que salvar
-- -------------------------------------------------------------
-- El orden importa. Primero se ve si HAY pérdida; recién ahí se cubre. Así
-- una vida nunca se gasta un día de descanso, ni el día que ya registraste,
-- ni cuando la racha es cero y no hay nada que perder.
create or replace function public.verificar_perdida()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  perfil profiles;
  viva int;
  nuevo_rango int;
  nueva_racha int;
  hoy date := mi_hoy();
  resuelto date;
  d date;
  cubiertos date[] := '{}';
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

  -- HAY PÉRDIDA. Se intenta cubrir hacia atrás desde ayer, día por día, y se
  -- corta en el primero que no se pueda: sin vidas en ese mes, o porque ya
  -- llegamos a un día que no era una falta.
  d := hoy - 1;
  loop
    exit when perfil.perdida_fecha is not null and d <= perfil.perdida_fecha;
    -- ¿este día es una falta?
    exit when exists (select 1 from logs where user_id = uid and fecha = d);
    exit when extract(dow from d)::int = any(descansos_vigentes(uid, d));
    exit when exists (select 1 from vidas_usadas where user_id = uid and fecha = d);
    -- ¿queda una vida de ESE mes?
    exit when vidas_disponibles(uid, d) <= 0;
    insert into vidas_usadas (user_id, fecha) values (uid, d)
      on conflict (user_id, fecha) do nothing;
    cubiertos := cubiertos || d;
    d := d - 1;
    -- tope de seguridad: nunca se pueden gastar más que dos meses de cuota
    exit when array_length(cubiertos, 1) >= vidas_por_mes() * 2;
  end loop;

  if array_length(cubiertos, 1) > 0 then
    viva := perfil.racha_base + calcular_racha(uid, hoy - 1);
    if viva >= perfil.racha_actual then
      return jsonb_build_object(
        'perdida', false,
        'pendiente_resuelto', resuelto,
        'vidas_usadas', to_jsonb(cubiertos),
        'vidas_quedan', vidas_disponibles(uid, hoy)
      );
    end if;
  end if;

  -- No alcanzó: la racha se corta igual, y las vidas gastadas NO se devuelven
  -- —el día que cubrieron sigue cubierto—. Devolverlas sería premiar la
  -- falta larga: el que faltó seis días terminaría el mes con más vidas que
  -- el que faltó dos.
  nueva_racha := greatest(0, perfil.racha_actual - 10);
  nuevo_rango := rango_de_racha(nueva_racha);
  update profiles set
    racha_actual = nueva_racha,
    racha_base = nueva_racha,
    rango_actual = nuevo_rango,
    perdida_fecha = hoy - 1
  where id = uid;
  return jsonb_build_object('perdida', true, 'rango_anterior', perfil.rango_actual,
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha, 'pendiente_resuelto', resuelto,
    'vidas_usadas', to_jsonb(cubiertos),
    'vidas_quedan', vidas_disponibles(uid, hoy));
end;
$$;
