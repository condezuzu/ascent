-- =============================================================
-- MIGRACIÓN 20 — el retrato no devuelve ningún cuerpo en claro
--
-- Va DESPUÉS de la 19. Ejecutar entera en el SQL Editor de Supabase.
-- =============================================================

-- La 19 hasheó los triggers porque uno de ellos filtraba la service_role key.
-- Eso tapaba ESE caso. El próximo objeto que alguien cree desde el panel con
-- un secreto adentro vuelve a filtrar por el campo que quedó en claro.
--
-- Así que la regla pasa a ser al revés: el retrato devuelve NOMBRES en claro y
-- todo lo demás hasheado. Un md5 distinto delata el cambio igual —que es lo
-- único que este retrato necesita— y el nombre alcanza para saber dónde ir a
-- mirar. Lo que ya no puede hacer es repartir el contenido de nada.
--
-- Queda en claro, a propósito, lo que no es texto libre y sí importa leer:
-- tipos, not null, `prosecdef` (o sea SECURITY DEFINER), volatilidad, el
-- comando de cada política y quién tiene cada permiso.

-- Una sola normalización para todo el retrato. Antes vivía copiada en la rama
-- de funciones y en la de triggers; ahora los dos lados de cada comparación
-- pasan por acá, que es la única forma de que un md5 signifique algo.
create or replace function public.huella(t text)
returns text language sql immutable as $$
  select case
    when t is null then '-'
    -- Sin comentarios y con los espacios colapsados: importa que las dos
    -- bases se COMPORTEN igual, no que la prosa coincida.
    else md5(btrim(regexp_replace(
      regexp_replace(t, '--[^' || chr(10) || ']*', '', 'g'), '\s+', ' ', 'g')))
  end;
$$;

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
                           cuenta_dots || ' ' || orden, '|' order by id))
    from ejercicios
$$;

revoke execute on function public.retrato_del_schema() from public;
grant execute on function public.retrato_del_schema() to authenticated;
