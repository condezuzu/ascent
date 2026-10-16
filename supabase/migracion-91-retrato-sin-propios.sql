-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 91 then
    raise exception 'Esta es la migración 91 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 91 — EL RETRATO MIRA SOLO EL CATÁLOGO (16/10)
--
-- `test:conexion` compara el retrato de producción con el del repo, y la rama del
-- catálogo contaba TODA la tabla `ejercicios`, propios incluidos. Apenas alguien
-- crea un ejercicio propio, producción "difiere" del repo y el test falla para
-- siempre: el 16/10 fueron siete. Ahora cuenta solo el catálogo fijo. No toca datos
-- ni nada que use la app.

do $$
begin
  if public.version_del_esquema() < 90 then
    raise exception 'La migración 91 va después de la 90 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

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
  -- SOLO EL CATÁLOGO (migración 91): los ejercicios propios son de cada usuario,
  -- y el 16/10 siete propios nuevos hacían fallar la comparación con el repo.
  select 'catálogo de ejercicios',
         count(*) || ' ejercicios ' ||
         huella(string_agg(id || ' ' || nombre || ' ' || grupo || ' ' ||
                           cuenta_dots || ' ' || admite_peso || ' ' || orden || ' ' ||
                           carga || ' ' || carga_ambigua, '|' order by id))
    from ejercicios
   where creado_por is null and not huerfano
$$;

revoke execute on function public.retrato_del_schema() from public;
grant execute on function public.retrato_del_schema() to authenticated;

do $$
begin
  if public.version_del_esquema() < 91 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 91; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
