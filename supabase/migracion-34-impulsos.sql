-- =============================================================
-- MIGRACIÓN 34 — se llaman IMPULSOS, y se ganan en vez de recargarse
--
-- Va DESPUÉS de la 33. Ejecutar entera en el SQL Editor de Supabase.
--
-- SE PUEDE CORRER ANTES O DESPUÉS DEL DEPLOY. Las funciones viejas
-- —`mis_vidas`, `devolver_vidas`, `vidas_disponibles`, `vidas_por_mes`— siguen
-- existiendo como envoltorios que llaman a las nuevas, así que el cliente
-- desplegado hoy sigue andando y el nuevo usa los nombres buenos. Se borran en
-- una migración posterior, cuando ya no queden clientes viejos.
-- =============================================================

-- -------------------------------------------------------------
-- 1. EL NOMBRE
-- -------------------------------------------------------------
-- Se llamaban "vidas" y no cerraba: una vida es de un videojuego y suena a que
-- la app te perdona. Un IMPULSO es lo que te sostiene el día que no empujaste,
-- y es vocabulario de este universo.
--
-- LA TABLA SE SIGUE LLAMANDO `vidas_usadas` A PROPÓSITO. Renombrarla arrastra
-- políticas, permisos, índices y el nombre de la clave primaria, y el test de
-- deriva compara todo eso contra un `schema.sql` recién creado: el riesgo es
-- real y lo que se gana no lo ve nadie. El nombre que importa —el que se lee—
-- es el de la interfaz.

-- -------------------------------------------------------------
-- 2. CÓMO SE GANAN AHORA
-- -------------------------------------------------------------
-- ANTES: tres por mes, y el 1° se recargaban todas. Dos cosas malas. Una, que
-- son un regalo del calendario y no algo que tenga que ver con lo que hiciste.
-- Otra, la que encontró el humano solo: si faltás el 30 y el 31, el 1° tenés
-- los tres de nuevo — el mes es una frontera arbitraria y premia faltar justo
-- antes de cruzarla.
--
-- AHORA, tres reglas:
--   - Arrancás con DOS. Alcanza para el primer tropiezo y no alcanza para
--     administrarlos, que es lo que no tienen que ser.
--   - El TERCERO se gana a los 20 días de racha. Es lo único que cambia con el
--     mérito, y 20 son dos rangos: se nota.
--   - Cada uno gastado VUELVE 30 DÍAS DESPUÉS de gastarlo. Ventana que corre,
--     no calendario: no hay un día del mes en que convenga faltar.
--
-- Y el que pierde la racha baja a dos, porque el tercero era de la racha. Es
-- duro y es coherente: el impulso sale de haber ido.

create or replace function public.impulsos_tope()
returns int language sql immutable as $$ select 3; $$;

-- Cuántos tenés ganados hoy, independientemente de los que estén gastados.
create or replace function public.impulsos_ganados(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select least(
    impulsos_tope(),
    2 + case when coalesce((select racha_actual from profiles where id = p_user), 0) >= 20
             then 1 else 0 end
  );
$$;

-- Cuántos VUELVEN a estar disponibles: los ganados menos los que todavía están
-- en los treinta días de vuelta.
--
-- Se mide contra `fecha` —el día que cubrieron— y no contra `creado`: el día
-- cubierto es un hecho del calendario del usuario, y `creado` es cuándo la app
-- se enteró. Si alguien abre la app tres días después, no puede cambiar cuándo
-- le vuelve el impulso.
create or replace function public.impulsos_disponibles(p_user uuid, p_dia date)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, impulsos_ganados(p_user) - (
    select count(*)::int from vidas_usadas
     where user_id = p_user
       and not devuelta
       and fecha > p_dia - 30
  ));
$$;

-- El envoltorio viejo, para que el cliente desplegado siga andando. Usa la
-- regla NUEVA a propósito: no puede haber dos reglas conviviendo, o durante
-- unas horas la app contaría distinto según por dónde preguntara.
create or replace function public.vidas_disponibles(p_user uuid, p_dia date)
returns int language sql stable security definer set search_path = public as $$
  select impulsos_disponibles(p_user, p_dia);
$$;

create or replace function public.vidas_por_mes()
returns int language sql immutable as $$ select impulsos_tope(); $$;

-- -------------------------------------------------------------
-- 3. LO QUE LEE LA INTERFAZ
-- -------------------------------------------------------------
-- `vigentes` reemplaza a `del_mes`: con una ventana que corre, "los de este
-- mes" dejó de querer decir algo. Son los días cubiertos que todavía no
-- volvieron, que es lo que hay que dibujar en los puntos Y en la tira semanal.
--
-- `vuelve` es la fecha en que vuelve el más viejo de los gastados. Se dice
-- porque "te queda 1" sin decir cuándo vuelve el otro es la mitad del dato.
create or replace function public.mis_impulsos()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', impulsos_ganados(auth.uid()),
    'tope', impulsos_tope(),
    'quedan', impulsos_disponibles(auth.uid(), mi_hoy()),
    -- Cuánta racha falta para ganar el que viene. `null` si ya están todos.
    'falta_para_ganar', case
      when impulsos_ganados(auth.uid()) >= impulsos_tope() then null
      else greatest(0, 20 - coalesce((select racha_actual from profiles where id = auth.uid()), 0))
    end,
    'vigentes', coalesce((
      select jsonb_agg(fecha order by fecha)
        from vidas_usadas
       where user_id = auth.uid()
         and not devuelta
         and fecha > mi_hoy() - 30
    ), '[]'::jsonb),
    'vuelve', (
      select min(fecha) + 30 from vidas_usadas
       where user_id = auth.uid() and not devuelta and fecha > mi_hoy() - 30
    ),
    -- Las últimas cinco, para el aviso. Ver la migración 33: el aviso sale del
    -- ESTADO y no del reporte de una llamada.
    'ultimas', coalesce((
      select jsonb_agg(fecha order by fecha desc)
        from (
          select fecha from vidas_usadas
           where user_id = auth.uid() and not devuelta
           order by fecha desc limit 5
        ) x
    ), '[]'::jsonb),
    'ultima', (
      select max(fecha) from vidas_usadas where user_id = auth.uid() and not devuelta
    )
  );
$$;

-- El envoltorio viejo: lo mismo más `del_mes`, que es lo que el cliente
-- desplegado sabe leer.
create or replace function public.mis_vidas()
returns jsonb language sql stable security definer set search_path = public as $$
  select mis_impulsos() || jsonb_build_object('del_mes', mis_impulsos()->'vigentes');
$$;

revoke execute on function public.mis_impulsos() from public, anon;
grant execute on function public.mis_impulsos() to authenticated;

-- -------------------------------------------------------------
-- 4. GUARDARLO PARA DESPUÉS
-- -------------------------------------------------------------
create or replace function public.devolver_impulsos(p_fechas date[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cuantas int;
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

  return jsonb_build_object('devueltas', cuantas, 'perdida', verificar_perdida());
end;
$$;

create or replace function public.devolver_vidas(p_fechas date[])
returns jsonb language sql security definer set search_path = public as $$
  select devolver_impulsos(p_fechas);
$$;

revoke execute on function public.devolver_impulsos(date[]) from public, anon;
grant execute on function public.devolver_impulsos(date[]) to authenticated;

-- -------------------------------------------------------------
-- 5. Y LA PÉRDIDA, QUE ES QUIEN LOS GASTA
-- -------------------------------------------------------------
-- Cambia UNA línea de verdad —pregunta por `impulsos_disponibles`— y el tope
-- de seguridad, que ahora es el tope de impulsos y no una cuota mensual.
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

  d := hoy - 1;
  loop
    exit when perfil.perdida_fecha is not null and d <= perfil.perdida_fecha;
    exit when exists (select 1 from logs where user_id = uid and fecha = d);
    exit when extract(dow from d)::int = any(descansos_vigentes(uid, d));
    exit when exists (select 1 from vidas_usadas where user_id = uid and fecha = d);
    -- ¿queda un impulso disponible para ESE día?
    exit when impulsos_disponibles(uid, d) <= 0;
    insert into vidas_usadas (user_id, fecha) values (uid, d)
      on conflict (user_id, fecha) do nothing;
    cubiertos := cubiertos || d;
    d := d - 1;
    exit when array_length(cubiertos, 1) >= impulsos_tope();
  end loop;

  if array_length(cubiertos, 1) > 0 then
    viva := perfil.racha_base + calcular_racha(uid, hoy - 1);
    if viva >= perfil.racha_actual then
      return jsonb_build_object(
        'perdida', false,
        'pendiente_resuelto', resuelto,
        'vidas_usadas', to_jsonb(cubiertos),
        'vidas_quedan', impulsos_disponibles(uid, hoy)
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
    perdida_fecha = hoy - 1
  where id = uid;
  return jsonb_build_object('perdida', true, 'rango_anterior', perfil.rango_actual,
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha, 'pendiente_resuelto', resuelto,
    'vidas_usadas', to_jsonb(cubiertos),
    'vidas_quedan', impulsos_disponibles(uid, hoy));
end;
$$;
