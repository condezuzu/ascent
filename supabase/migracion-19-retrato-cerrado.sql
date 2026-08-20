-- =============================================================
-- MIGRACIÓN 19 — cerrar el retrato: solo autenticados, y sin secretos
--
-- Va DESPUÉS de la 18. Ejecutar entera en el SQL Editor de Supabase.
-- =============================================================

-- URGENTE, LEER ANTES DE CORRERLA.
--
-- La primera comparación real (la 18 recién aplicada) encontró una deriva de
-- verdad: en producción hay un trigger `sugerencia-nueva` sobre `feedback`
-- que NO está en el repo. Lo creó Supabase cuando se armó el webhook de
-- sugerencias desde el panel, y **su definición lleva la service_role key
-- incrustada en texto plano**, más el header `x-ascent-secreto`.
--
-- Como el retrato de la 18 devolvía `action_statement` tal cual Y estaba
-- otorgado a `anon`, cualquiera con la anon key —que viaja en el bundle del
-- navegador, es pública por diseño— podía pedir el retrato y llevarse la
-- service_role key, que saltea toda la RLS. Estuvo así desde que se aplicó la
-- 18 hasta que se aplique esta.
--
-- Esta migración tapa las dos mitades:
--   1. el cuerpo del trigger va HASHEADO, así que el retrato no puede
--      repartir un secreto ni aunque mañana alguien lo vuelva a abrir;
--   2. el grant sale de `anon` y queda solo en `authenticated`.
--
-- Lo que esta migración NO puede hacer: la key ya expuesta hay que ROTARLA a
-- mano desde el panel, y cambiar el valor de `x-ascent-secreto`. Ver
-- spec/trampas.md.

create or replace function public.retrato_del_schema()
returns table (que text, f text)
language sql stable security definer set search_path = public as $$
  select 'columnas'::text,
         c.table_name || '.' || c.column_name || ' ' || c.data_type ||
         coalesce('(' || c.character_maximum_length || ')', '') ||
         coalesce('(' || c.numeric_precision || ',' || c.numeric_scale || ')', '') ||
         case when c.is_nullable = 'NO' then ' not null' else '' end ||
         coalesce(' default ' || c.column_default, '')
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
         conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
    from pg_constraint
   where connamespace = 'public'::regnamespace and contype <> 'n'

  union all
  select 'índices', indexdef from pg_indexes where schemaname = 'public'

  union all
  -- El cuerpo va SIN comentarios y con los espacios colapsados: importa que
  -- las bases se comporten igual, no que la prosa coincida.
  select 'funciones',
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') -> ' ||
         pg_get_function_result(p.oid) || ' ' || p.prosecdef || ' ' || p.provolatile::text ||
         ' ' || md5(btrim(regexp_replace(regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g'), '\s+', ' ', 'g')))
    from pg_proc p where p.pronamespace = 'public'::regnamespace

  union all
  select 'políticas',
         tablename || ' ' || policyname || ' ' || cmd || ' ' ||
         coalesce(qual, '-') || ' ' || coalesce(with_check, '-')
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
  -- Quien puede EJECUTAR cada función. Sin esto el retrato no habría podido
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
  -- HASHEADO a propósito: los webhooks que crea el panel llevan la
  -- service_role key adentro de su propia definición. Un md5 distinto delata
  -- el cambio igual, que es todo lo que este retrato necesita saber.
  select 'triggers',
         event_object_table || ' ' || trigger_name || ' ' || action_timing || ' ' ||
         event_manipulation || ' ' ||
         md5(btrim(regexp_replace(action_statement, '\s+', ' ', 'g')))
    from information_schema.triggers where trigger_schema = 'public'

  union all
  select 'catálogo de ejercicios',
         id || ' ' || nombre || ' ' || grupo || ' ' || cuenta_dots || ' ' || orden
    from ejercicios
$$;

-- El retrato refleja la base VIVA, que es justo lo que no está en GitHub, y
-- entregar las políticas de RLS y la forma de cada función legibles por
-- máquina y siempre al día es un mapa de cómo funciona la seguridad. Cerrarlo
-- no cuesta nada: `test:conexion` ya inicia sesión con la cuenta de prueba.
revoke execute on function public.retrato_del_schema() from public;
revoke execute on function public.retrato_del_schema() from anon;
grant execute on function public.retrato_del_schema() to authenticated;
