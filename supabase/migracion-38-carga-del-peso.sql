-- =============================================================
-- MIGRACIÓN 38 — qué significa el número del peso
--
-- Va DESPUÉS de la 37. Ejecutar entera en el SQL Editor de Supabase.
--
-- ADITIVA: dos columnas con valor por omisión en el catálogo, una tabla nueva,
-- dos funciones nuevas, y `fijar_bloques` reemplazada con la MISMA firma. Toca
-- datos una sola vez: les pone el modo a los bloques CON PESOS que ya existen
-- (punto 6). Se puede correr antes o después del deploy:
--   - Cliente viejo + base nueva: no manda el modo, y la base le pone el del
--     catálogo, que es la etiqueta que el cliente nuevo le hubiera mostrado.
--   - Cliente nuevo + base vieja: el cliente pregunta la versión y no muestra
--     nada de esto (`nucleo/esquema.ts`).
-- =============================================================

-- -------------------------------------------------------------
-- 1. LOS CUATRO MODOS
-- -------------------------------------------------------------
-- "60" no dice nada solo. Con barra son 60 en total; con mancuernas, la gente
-- dice "las de 30" y levanta 60. La regla: NUNCA se piden discos ni se hace
-- sumar a nadie. Se escribe el número que está impreso en lo que agarraste, y
-- la etiqueta dice cuál es.
--
--   total   la barra con los discos, o el número de la máquina. × 1
--   par     dos mancuernas, o dos poleas: el peso de UNA.           × 2
--   una     una sola mancuerna, con las dos manos o con un brazo.   × 1
--   lastre  lo que se cuelga encima del peso corporal.              × 1
--
-- EL LASTRE NO SUMA EL PESO CORPORAL, y es decisión del humano: el peso
-- corporal cambia con el tiempo y ensuciaría la comparación hacia atrás, y
-- "hice dominadas con 20 kg" es lo que uno dice y lo que quiere ver.
--
-- `carga_ambigua`: el nombre no dice con qué se hace ("Zancadas"). Esos tienen
-- un modo por omisión igual, pero la primera vez que se usan se pregunta una
-- vez y se recuerda. Una pregunta una vez es mejor que adivinar siempre.
alter table public.ejercicios
  add column if not exists carga text not null default 'total',
  add column if not exists carga_ambigua boolean not null default false;

alter table public.ejercicios drop constraint if exists ejercicios_carga_valida;
alter table public.ejercicios
  add constraint ejercicios_carga_valida check (carga in ('total', 'par', 'una', 'lastre'));

-- Los que no son `total`. La lista va entera acá y no repartida en el insert
-- del catálogo, para que se lea de un vistazo qué se decidió.
update public.ejercicios set carga = 'par' where id in (
  -- dos mancuernas
  'press_mancuernas', 'press_inclinado_mancuernas', 'aperturas',
  'press_militar_mancuernas', 'press_arnold', 'elevaciones_laterales',
  'elevaciones_frontales', 'pajaros', 'encogimientos',
  'curl_mancuernas', 'martillo', 'curl_inclinado', 'curl_muneca',
  'zancadas', 'zancadas_caminando', 'zancada_inversa', 'sentadilla_bulgara',
  'subida_cajon', 'peso_muerto_una_pierna',
  -- dos poleas: el número de cada lado
  'cruce_polea_alta', 'cruce_polea_baja'
);

update public.ejercicios set carga = 'una' where id in (
  -- una mancuerna con las dos manos
  'sentadilla_goblet', 'pullover', 'triceps_mancuerna',
  -- una mancuerna, un brazo por vez
  'remo_mancuerna', 'curl_concentrado', 'patada_triceps'
);

update public.ejercicios set carga = 'lastre' where id in (
  'dominadas', 'dominadas_supinas', 'dominadas_lastradas', 'remo_invertido',
  'fondos', 'fondos_banco', 'flexiones', 'hiperextensiones',
  'crunch', 'elevacion_piernas', 'elevacion_rodillas', 'bicicleta_abdominal',
  'rueda_abdominal'
);

-- Los que se preguntan. Además de los nueve que se propusieron —el nombre no
-- dice el equipo—, los que en el gimnasio se hacen seguido de las dos formas.
update public.ejercicios set carga_ambigua = true where id in (
  'zancadas', 'zancadas_caminando', 'zancada_inversa', 'sentadilla_bulgara',
  'martillo', 'curl_inclinado', 'press_arnold', 'remo_menton', 'curl_muneca',
  'peso_muerto_rumano', 'peso_muerto_rigidas', 'peso_muerto_una_pierna',
  'subida_cajon', 'puente_gluteo', 'gemelos',
  'aperturas', 'pajaros', 'elevaciones_frontales', 'encogimientos',
  'rotacion_externa', 'press_frances', 'curl_predicador', 'patada_triceps'
);

-- -------------------------------------------------------------
-- 2. CON QUÉ LO HACÉS, recordado
-- -------------------------------------------------------------
-- El último modo que ELEGISTE para cada ejercicio: al contestar la pregunta o
-- al cambiarlo en un bloque. Es de la cuenta y no del teléfono, porque la app
-- nativa viene y un teléfono nuevo no puede volver a preguntarte todo.
--
-- Es una preferencia y no historia: la historia es el modo que quedó en cada
-- bloque (punto 4). Cambiar esto no toca ningún bloque ya guardado.
create table if not exists public.cargas_elegidas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ejercicio text not null references public.ejercicios(id),
  carga text not null,
  elegida timestamptz not null default now(),
  primary key (user_id, ejercicio),
  constraint cargas_elegidas_valida check (carga in ('total', 'par', 'una', 'lastre'))
);

alter table public.cargas_elegidas enable row level security;

drop policy if exists "cargas: solo dueño" on public.cargas_elegidas;
create policy "cargas: solo dueño" on public.cargas_elegidas for select
  using (user_id = auth.uid());

grant select on public.cargas_elegidas to authenticated;

-- Idempotente: elegir lo mismo dos veces deja lo mismo. Por eso entra a la
-- cola del teléfono (`lib/cola.ts`).
create or replace function public.elegir_carga(p_ejercicio text, p_carga text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre') then return; end if;
  if not exists (select 1 from ejercicios where id = p_ejercicio) then return; end if;
  insert into cargas_elegidas (user_id, ejercicio, carga)
       values (uid, p_ejercicio, p_carga)
  on conflict (user_id, ejercicio) do update set carga = excluded.carga, elegida = now();
end;
$$;

revoke execute on function public.elegir_carga(text, text) from public, anon;
grant execute on function public.elegir_carga(text, text) to authenticated;

-- -------------------------------------------------------------
-- 3. CÓMO ARRANCA EL BLOQUE: el modo y el último peso EN ESE MODO
-- -------------------------------------------------------------
-- Reemplaza a `ultimo_peso` para el cliente nuevo (la vieja queda para el
-- cliente viejo). El peso propuesto tiene que ser del MISMO modo: si la última
-- vez hiciste zancadas con barra y 60, hoy con mancuernas proponer "60 por
-- mancuerna" es proponer el doble.
--
-- `elegida` dice si el modo lo dijo la persona o es el del catálogo: con eso el
-- teléfono sabe si tiene que preguntar.
create or replace function public.como_arranca(p_ejercicio text)
returns jsonb language sql stable security definer set search_path = public as $$
  with modo as (
    select e.carga_ambigua as ambigua,
           c.carga as elegida,
           coalesce(c.carga, e.carga) as carga
      from ejercicios e
      left join cargas_elegidas c on c.ejercicio = e.id and c.user_id = auth.uid()
     where e.id = p_ejercicio
  )
  select jsonb_build_object(
           'carga', m.carga,
           'elegida', m.elegida is not null,
           'ambigua', m.ambigua,
           'peso', (
             select x.v::numeric
               from sesiones s,
                    jsonb_array_elements(s.bloques) with ordinality as b(bloque, ob),
                    jsonb_array_elements_text(
                      case when jsonb_typeof(b.bloque->'pesos') = 'array' then b.bloque->'pesos' else '[]'::jsonb end
                    ) with ordinality as x(v, ox)
              where s.user_id = auth.uid()
                and b.bloque->>'ejercicio' = p_ejercicio
                and coalesce(b.bloque->>'carga', 'total') = m.carga
                and x.v is not null
                and s.inicio > now() - interval '90 days'
              order by s.inicio desc, b.ob desc, x.ox desc
              limit 1
           )
         )
    from modo m;
$$;

revoke execute on function public.como_arranca(text) from public, anon;
grant execute on function public.como_arranca(text) to authenticated;

-- -------------------------------------------------------------
-- 4. CADA BLOQUE GUARDA SU MODO
-- -------------------------------------------------------------
-- EL PUNTO MÁS IMPORTANTE DE TODA LA MIGRACIÓN. Es el mismo problema que los
-- descansos retroactivos y la misma solución: si mañana la sentadilla goblet
-- pasa de "una" a "par", los kilos de todas las goblet de antes se
-- duplicarían solos. Por eso el modo NO se lee del catálogo al mostrar: queda
-- escrito en el bloque el día que se hizo, y el catálogo solo decide los
-- bloques que vienen.
--
--   {"ejercicio": "zancadas", "series": 3, "pesos": [20, 20, 22], "carga": "par"}
--
-- `carga` va SOLO con `pesos`. Un bloque sin pesos no tiene números que
-- interpretar, y la regla de siempre sigue: quien no anota pesos guarda
-- exactamente lo mismo que antes, ni una llave nueva.
--
-- Si el teléfono no manda el modo —cliente viejo, o sin señal para saber cuál
-- elegiste— o manda basura, se usa el del catálogo.
create or replace function public.fijar_bloques(p_sesion uuid, p_bloques jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio jsonb;
  total int;
  guardado jsonb;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if jsonb_typeof(p_bloques) <> 'array' then raise exception 'bloques tiene que ser una lista'; end if;

  select series into total from sesiones where id = p_sesion and user_id = uid;
  if total is null then return null; end if;

  select coalesce(jsonb_agg(
           case when p is null
                then jsonb_build_object('ejercicio', e, 'series', s)
                else jsonb_build_object('ejercicio', e, 'series', s, 'pesos', p, 'carga', c)
           end order by i), '[]'::jsonb)
    into limpio
  from (
    select
      f.e, f.s, f.i,
      pesos_limpios(f.pesos, f.s) as p,
      case when f.carga in ('total', 'par', 'una', 'lastre') then f.carga
           else (select carga from ejercicios where id = f.e)
      end as c
    from (
      select
        b.valor->>'ejercicio' as e,
        greatest(0, least((b.valor->>'series')::int, 999)) as s,
        b.valor->'pesos' as pesos,
        b.valor->>'carga' as carga,
        b.orden as i
      from jsonb_array_elements(p_bloques) with ordinality as b(valor, orden)
      where b.valor->>'ejercicio' in (select id from ejercicios)
        and (b.valor->>'series') ~ '^[0-9]+$'
        and b.orden <= 40
    ) f
  ) filtrados;

  update sesiones set bloques = limpio
   where id = p_sesion and user_id = uid
   returning bloques into guardado;

  return jsonb_build_object('bloques', coalesce(guardado, '[]'::jsonb), 'total_series', total);
end;
$$;

-- -------------------------------------------------------------
-- 5. LOS BLOQUES QUE YA TIENEN PESOS
-- -------------------------------------------------------------
-- Se anotaron sin etiqueta, así que no se sabe qué número escribió cada uno.
-- Se les pone el modo del catálogo de HOY —la etiqueta que el cliente nuevo
-- les hubiera mostrado— y queda fijo: reclasificar el catálogo mañana ya no
-- los mueve. Solo los que tienen pesos y todavía no tienen modo, así que
-- correr esto dos veces no cambia nada.
update public.sesiones s
   set bloques = (
     select jsonb_agg(
              case when jsonb_typeof(b.valor->'pesos') = 'array' and not (b.valor ? 'carga')
                   then b.valor || jsonb_build_object(
                          'carga', coalesce((select carga from ejercicios where id = b.valor->>'ejercicio'), 'total'))
                   else b.valor
              end order by b.orden)
       from jsonb_array_elements(s.bloques) with ordinality as b(valor, orden)
   )
 where jsonb_typeof(s.bloques) = 'array'
   and exists (
     select 1 from jsonb_array_elements(s.bloques) as x(valor)
      where jsonb_typeof(x.valor->'pesos') = 'array' and not (x.valor ? 'carga')
   );

-- -------------------------------------------------------------
-- 6. EL RETRATO DEL SCHEMA ve las columnas nuevas del catálogo
-- -------------------------------------------------------------
-- Hashea el catálogo entero: sin las dos columnas, `test-deriva` no vería
-- nunca una diferencia en cómo quedó clasificado un ejercicio.
create or replace function public.retrato_del_schema()
returns table (que text, f text)
language sql stable security definer set search_path = public as $$
  -- El default va hasheado: es una expresión libre y puede llevar un literal
  -- adentro. El tipo y el not null son la forma, y esos sí se leen.
  select 'columnas'::text,
         c.table_name || '.' || c.column_name || ' ' || c.data_type ||
         coalesce('(' || c.character_maximum_length || ')', '') ||
         coalesce('(' || c.numeric_precision || ',' || c.numeric_scale || ')', '') ||
         case when c.is_nullable = 'NO' then ' not null' else '' end ||
         case when c.column_default is null then ''
              else ' default ' || huella(c.column_default) end
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and t.table_type = 'BASE TABLE'

  union all
  -- `contype <> 'n'` saca los NOT NULL: desde PG 17 tienen fila propia en
  -- pg_constraint y en la versión de Supabase todavía no, así que las 66
  -- filas de diferencia eran ruido de versión. El NOT NULL ya viaja arriba,
  -- en 'columnas', que es donde de verdad se compara.
  select 'restricciones',
         conrelid::regclass || ' ' || conname || ' ' || huella(pg_get_constraintdef(oid))
    from pg_constraint
   where connamespace = 'public'::regnamespace and contype <> 'n'

  union all
  select 'índices', tablename || ' ' || indexname || ' ' || huella(indexdef)
    from pg_indexes where schemaname = 'public'

  union all
  select 'funciones',
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') -> ' ||
         pg_get_function_result(p.oid) || ' ' || p.prosecdef || ' ' ||
         p.provolatile::text || ' ' || huella(p.prosrc)
    from pg_proc p where p.pronamespace = 'public'::regnamespace

  union all
  -- `qual` y `with_check` son expresiones libres. El comando queda en claro
  -- porque saber que una política es de INSERT y no de SELECT es la mitad de
  -- entender qué protege.
  select 'políticas',
         tablename || ' ' || policyname || ' ' || cmd || ' ' ||
         huella(qual) || ' ' || huella(with_check)
    from pg_policies where schemaname = 'public'

  union all
  select 'permisos',
         grantee || ' ' || table_name || ' ' || privilege_type || ' ' || column_name
    from information_schema.column_privileges
   where table_schema = 'public' and grantee in ('authenticated', 'anon')

  union all
  select 'permisos de tabla',
         grantee || ' ' || table_name || ' ' || privilege_type
    from information_schema.table_privileges
   where table_schema = 'public' and grantee in ('authenticated', 'anon')

  union all
  -- Quién puede EJECUTAR cada función. Sin esto el retrato no habría podido
  -- ver el agujero que lo estrenó: una función SECURITY DEFINER otorgada a
  -- `anon` se ve idéntica a una cerrada. `acldefault` cubre el caso peor, el
  -- de la función que nunca se tocó: `proacl` viene en NULL y el permiso por
  -- omisión de Postgres es EXECUTE para PUBLIC.
  select 'permisos de función',
         coalesce(g.rolname, 'PUBLIC') || ' ' || p.proname || '(' ||
         pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    left join pg_roles g on g.oid = a.grantee
   where p.pronamespace = 'public'::regnamespace
     and a.privilege_type = 'EXECUTE'
     and coalesce(g.rolname, 'PUBLIC') in ('anon', 'authenticated', 'PUBLIC')

  union all
  -- Los webhooks que crea el panel de Supabase llevan la service_role key
  -- adentro de su propia definición. Esta rama es la que la filtró.
  select 'triggers',
         event_object_table || ' ' || trigger_name || ' ' || action_timing || ' ' ||
         event_manipulation || ' ' || huella(action_statement)
    from information_schema.triggers where trigger_schema = 'public'

  union all
  -- La única rama que devuelve FILAS de una tabla, aunque sea un catálogo fijo
  -- y público. Va entera en un solo hash: no hay motivo para que el retrato
  -- sepa recitar datos.
  select 'catálogo de ejercicios',
         count(*) || ' ejercicios ' ||
         huella(string_agg(id || ' ' || nombre || ' ' || grupo || ' ' ||
                           cuenta_dots || ' ' || admite_peso || ' ' || orden || ' ' ||
                           carga || ' ' || carga_ambigua, '|' order by id))
    from ejercicios
$$;

revoke execute on function public.retrato_del_schema() from public;
grant execute on function public.retrato_del_schema() to authenticated;

-- -------------------------------------------------------------
-- 7. LA VERSIÓN
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 38; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
