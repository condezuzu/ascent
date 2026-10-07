-- MIGRACIÓN 63 — QUÉ VERSIÓN CORRE LA GENTE, Y QUIÉN PUEDE LEER UNA MINIATURA
--
-- 1. QUÉ VERSIÓN ABRIÓ LA APP (8/10/2026). Después de publicar la 1.0 no había
--    forma de saber cuánta gente había pasado a la versión nueva: `errores_js`
--    y `feedback` solo muestran a quien tuvo un error o escribió. Ahora la app
--    manda su versión en el encabezado `X-Client-Info` de cada pedido, y
--    `pantalla_inicio` —que ya se llama en cada apertura— la anota en el
--    perfil. Sin tabla nueva y sin pedido extra. Va en su propio bloque: es un
--    dato para mirar y no puede frenar que alguien abra la app.
--
--    `version_vista` queda en null cuando abrió algo que no la manda: la build
--    de la tienda sin OTA encima. Eso es "sigue en la vieja".
--
--    La consulta:
--      select coalesce(version_vista, 'sin dato (build sin OTA)') as version,
--             count(*) as personas, max(ultima_apertura) as ultima_vez
--        from public.profiles
--       where ultima_apertura > now() - interval '7 days'
--       group by 1 order by personas desc;
--
-- 2. LA MINIATURA DE UNA FOTO. Desde el 8/10 cada foto tiene al lado una copia
--    de 400 px para la grilla del álbum (`<ruta>.mini.jpg`, la hace el
--    teléfono). El dueño ya puede leerla y escribirla: es su carpeta. La regla
--    de los amigos nombraba solo la ruta exacta de la foto; ahora también su
--    miniatura. La ve quien puede ver la foto, y nadie más.
--
-- Va después de la 62. Se puede correr dos veces.
do $$
begin
  if public.version_del_esquema() < 62 then
    raise exception 'La migración 63 va después de la 62 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

alter table public.profiles add column if not exists ultima_apertura timestamptz;
alter table public.profiles add column if not exists version_vista text;

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
    update profiles
       set ultima_apertura = now(),
           version_vista = case when cliente like 'ascent/%' then left(cliente, 100) end
     where id = uid;
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

-- (`pantalla_inicio`, arriba, es copia exacta de schema.sql)

-- La regla del storage, igual que en la 60: solo donde el storage existe (la
-- base de pruebas no lo tiene).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'drop policy if exists "fotos storage: amigos leen visibles" on storage.objects';
    execute $regla$
      create policy "fotos storage: amigos leen visibles" on storage.objects for select
        using (
          bucket_id = 'fotos'
          and exists (
            select 1 from public.photos p
            where (p.storage_path = name or regexp_replace(p.storage_path, '\.jpe?g$', '', 'i') || '.mini.jpg' = name)
              and p.visibilidad = 'amigos'
              and (storage.foldername(name))[1] = p.user_id::text
              and public.son_amigos(auth.uid(), p.user_id)
          )
        )
    $regla$;
  end if;
end $$;

-- La versión sube a 63.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 63; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
