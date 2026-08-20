-- =============================================================
-- MIGRACIÓN 18 — un retrato de la forma de la base, para comparar
--
-- Va DESPUÉS de la 17. Ejecutar entera en el SQL Editor de Supabase.
-- =============================================================

-- Las diecisiete migraciones se corrieron pegando SQL a mano en el SQL
-- Editor, así que producción es justo donde puede haber deriva que nadie ve:
-- un `create` que se pegó a medias, un bloque que se salteó, algo que se tocó
-- a mano y no quedó en ninguna migración.
--
-- `test-deriva` compara schema.sql contra las migraciones, pero las dos salen
-- del repo: si producción se separó de las dos, ninguna se entera. Esto es lo
-- que permite preguntarle a la base REAL qué forma tiene.
--
-- POR QUÉ SE OTORGA A ANON: PostgREST no expone `pg_catalog` ni
-- `information_schema`, así que sin esto no hay forma de leer la forma de la
-- base desde afuera. Devuelve solo NOMBRES y DEFINICIONES —ni una fila de
-- datos de nadie— y todo eso ya está publicado en `supabase/schema.sql`, en
-- un repo público. O sea que no revela nada que no se pueda leer en GitHub.
--
-- Si el repo alguna vez pasa a privado, esto hay que revisarlo: cambiar el
-- grant a `authenticated` y hacer que `test:conexion` inicie sesión.
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
  select 'restricciones',
         conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
    from pg_constraint where connamespace = 'public'::regnamespace

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
  select 'triggers',
         event_object_table || ' ' || trigger_name || ' ' || action_timing || ' ' ||
         event_manipulation || ' ' || action_statement
    from information_schema.triggers where trigger_schema = 'public'

  union all
  select 'catálogo de ejercicios',
         id || ' ' || nombre || ' ' || grupo || ' ' || cuenta_dots || ' ' || orden
    from ejercicios
$$;

revoke execute on function public.retrato_del_schema() from public;
grant execute on function public.retrato_del_schema() to anon, authenticated;
