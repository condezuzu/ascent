-- =============================================================
-- MIGRACIÓN 31 — qué ejercicios admiten peso
--
-- Va DESPUÉS de la 30. Ejecutar entera en el SQL Editor de Supabase.
--
-- ADITIVA: una columna con valor por omisión y un `update` de tres filas. Se
-- puede correr antes o después del deploy.
-- =============================================================

-- -------------------------------------------------------------
-- EL PROBLEMA
-- -------------------------------------------------------------
-- Con el catálogo de 100, la pantalla de anotar una marca ofrece los 100. Y
-- una marca es PESO POR REPETICIONES: "Plancha, 40 kg × 1" no significa nada.
-- No rompe —`cuenta_dots` sigue mandando sobre el DOTS— pero deja cargar un
-- dato que después no se puede leer.
--
-- LA SALIDA NO ES PARTIR LA TABLA en dos catálogos: ya se descartó eso en la
-- §13e de `spec/etapa-nativa.md`, y por el mismo motivo de entonces. Es una
-- columna: el catálogo sigue siendo uno y cada pantalla filtra lo suyo.
alter table public.ejercicios
  add column if not exists admite_peso boolean not null default true;

-- POR OMISIÓN TRUE, y la lista de excepciones es corta a propósito: casi todo
-- admite peso aunque no se use así. Flexiones con chaleco, dominadas con
-- lastre —que ya son una fila aparte—, crunch con un disco, elevación de
-- piernas con una mancuerna entre los pies. Marcar todo eso como "sin peso"
-- sería decidir por el usuario cómo entrena.
--
-- Quedan afuera solo los ISOMÉTRICOS, donde lo que se mide es tiempo y un
-- número en kilos no tiene con qué compararse.
update public.ejercicios
   set admite_peso = false
 where id in ('plancha', 'plancha_lateral', 'dead_bug');

-- El retrato del schema hashea el catálogo entero: si no incluye la columna
-- nueva, `test-deriva` no vería nunca una diferencia en ella.
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
                           cuenta_dots || ' ' || admite_peso || ' ' || orden, '|' order by id))
    from ejercicios
$$;

revoke execute on function public.retrato_del_schema() from public;
grant execute on function public.retrato_del_schema() to authenticated;
