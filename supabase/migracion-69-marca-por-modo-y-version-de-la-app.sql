-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 69 then
    raise exception 'Esta es la migración 69 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 69 — LA MARCA DE "LA PRÓXIMA, MÁS" ES POR MODO, Y LA VERSIÓN DE LA APP NO LA PISA LA WEB
--
-- 1. La marca pasa a ser una por ejercicio Y por modo. Hacer remo en la máquina
--    gastaba (y pisaba) la marca del remo con mancuernas.
-- 2. `version_vista` y `ultima_apertura` solo las anota la app. Abrir la web
--    borraba la versión y la consulta de "qué versión corre la gente" contaba de menos.
--
-- No reescribe ningún dato: cambia la clave de una tabla y tres funciones.

do $$
begin
  if public.version_del_esquema() < 68 then
    raise exception 'La migración 69 va después de la 68 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

alter table public.subidas_marcadas drop constraint if exists subidas_marcadas_pkey;
alter table public.subidas_marcadas add primary key (user_id, ejercicio, carga);

-- (las tres funciones son copia exacta de schema.sql)
create or replace function public.marcar_subida(p_ejercicio text, p_carga text, p_peso numeric, p_series int, p_dia date)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_ejercicio is null then return; end if;
  if p_peso is null then
    -- Con el modo, saca la de ESE modo; sin modo (la app de antes), todas las del ejercicio.
    delete from subidas_marcadas
     where user_id = uid and ejercicio = p_ejercicio and (p_carga is null or carga = p_carga);
    return;
  end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre') then return; end if;
  if p_peso <= 0 or p_peso > 1000 or p_series is null or p_series < 1 or p_series > 99 then return; end if;
  -- Ni del futuro ni de hace un mes: es la marca de una sesión reciente.
  if p_dia is null or p_dia > mi_hoy() + 1 or p_dia < mi_hoy() - 14 then return; end if;
  if not exists (select 1 from ejercicios where id = p_ejercicio) then return; end if;
  insert into subidas_marcadas (user_id, ejercicio, carga, peso, series, dia)
       values (uid, p_ejercicio, p_carga, p_peso, p_series, p_dia)
  on conflict (user_id, ejercicio, carga) do update
     set peso = excluded.peso, series = excluded.series, dia = excluded.dia, marcada = now();
end;
$$;

create or replace function public.mis_subidas()
returns table (ejercicio text, carga text, peso numeric, series int, dia date)
language sql stable security definer set search_path = public as $$
  select m.ejercicio, m.carga, m.peso, m.series, m.dia
    from subidas_marcadas m
   where m.user_id = auth.uid()
     and not exists (
       select 1
         from sesiones s
         join logs l on l.id = s.log_id,
              jsonb_array_elements(s.bloques) as b(bloque)
        where s.user_id = m.user_id
          and l.fecha > m.dia
          and b.bloque ->> 'ejercicio' = m.ejercicio
          -- EN ESE MODO (migración 69). El bloque que no dice el suyo usa el del catálogo.
          and coalesce(b.bloque ->> 'carga', (select e.carga from ejercicios e where e.id = m.ejercicio), 'total') = m.carga
          and jsonb_typeof(b.bloque -> 'pesos') = 'array'
          and jsonb_array_length(b.bloque -> 'pesos') > 0
     );
$$;

create or replace function public.pantalla_inicio()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hoy date;
  r jsonb := '{}'::jsonb;
  pedazo jsonb;
  cliente text;
begin
  -- Sin sesión no se contesta nada. No es un error: la pantalla de entrada
  -- monta cosas que preguntan, y un 401 por carga ensucia el informe.
  if uid is null then
    return null;
  end if;

  begin
    hoy := mi_hoy();
  exception when others then
    hoy := current_date;
  end;
  r := r || jsonb_build_object('hoy', hoy);

  -- LA PÉRDIDA VA PRIMERO, y ese orden es la mitad del valor de esta función.
  -- Hoy la web pide `verificar_perdida` EN PARALELO con el perfil: si hubo
  -- pérdida, el perfil que llegó ya está viejo y hay que leerlo de nuevo — una
  -- ida y vuelta más, justo el día que perdiste la racha. Acá el perfil se lee
  -- después, así que siempre viene fresco y esa relectura desaparece por
  -- construcción, no por acordarse.
  begin
    pedazo := verificar_perdida();
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('perdida', pedazo);

  begin
    pedazo := (select to_jsonb(p) from profiles p where p.id = uid);
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('perfil', pedazo);

  -- QUÉ VERSIÓN ABRIÓ LA APP (migración 63). No había forma de saber qué versión
  -- corre la gente: solo se veía a quien tuvo un error o mandó una sugerencia.
  -- La app la manda en `X-Client-Info` ("ascent/1.0.0 <ota>"); lo que no empieza
  -- así —la build de la tienda sin OTA, que manda el de la librería— deja la
  -- versión en null, y eso es "sigue en la vieja". En su propio bloque: es un
  -- dato para mirar, y no puede frenar que alguien abra la app.
  begin
    cliente := nullif(current_setting('request.headers', true), '')::json ->> 'x-client-info';
    -- SOLO LA APP ANOTA (migración 69). Antes cualquier pedido pisaba la versión
    -- con null: una cuenta al día que abría la web —o un script de prueba—
    -- pasaba a contarse como "sigue en la vieja". La app de la tienda sin OTA
    -- manda el encabezado de la librería para React Native: esa SÍ anota, en null.
    if cliente like 'ascent/%' or cliente like '%react-native%' then
      update profiles
         set ultima_apertura = now(),
             version_vista = case when cliente like 'ascent/%' then left(cliente, 100) end
       where id = uid;
    end if;
  exception when others then
    null;
  end;

  -- Los últimos siete días, que es lo que dibuja la tira. El orden lo pone la
  -- base para que el cliente no tenga que ordenar nada.
  begin
    pedazo := coalesce((
      select jsonb_agg(to_jsonb(l) order by l.fecha)
        from logs l
       where l.user_id = uid and l.fecha >= hoy - 6
    ), '[]'::jsonb);
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('logs', pedazo);

  -- Las configuraciones de descanso, de la más nueva a la más vieja: el
  -- cliente elige la vigente para cada fecha con `descansosVigentes`.
  begin
    pedazo := coalesce((
      select jsonb_agg(jsonb_build_object('desde', d.desde, 'dias', d.dias) order by d.desde desc)
        from descansos d
       where d.user_id = uid
    ), '[]'::jsonb);
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('descansos', pedazo);

  begin
    pedazo := mis_impulsos();
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('impulsos', pedazo);

  begin
    pedazo := mi_fuerza();
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('fuerza', pedazo);

  -- LA LÍNEA SOCIAL: "alguien más entrenó hoy". Del lado del cliente son TRES
  -- pedidos encadenados —los amigos, después el último día de esos amigos,
  -- después quién es— porque el cliente no puede hacer un join. Acá es una
  -- consulta.
  --
  -- CUIDADO CON SECURITY DEFINER (migración 41): adentro de esta función RLS
  -- no filtra nada, así que la pertenencia se pide explícita. `usuarios_
  -- publicos` ya es pública —username, avatar, racha y rango— y es lo único
  -- que sale de acá: no se devuelve el perfil del amigo ni sus días.
  begin
    pedazo := (
      select jsonb_build_object('username', u.username, 'racha', u.racha_actual)
        from logs l
        join usuarios_publicos u on u.id = l.user_id
       where l.es_descanso = false
         and l.user_id in (
           select case when f.solicitante = uid then f.destinatario else f.solicitante end
             from friendships f
            where f.estado = 'aceptada'
              and (f.solicitante = uid or f.destinatario = uid)
         )
       order by l.fecha desc
       limit 1
    );
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('social', pedazo);

  return r;
end;
$$;

-- La versión sube a 69. Solo sube.
do $$
begin
  if public.version_del_esquema() < 69 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 69; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
