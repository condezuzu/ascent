-- MIGRACIÓN 60 — LA RUTA DE UNA FOTO TIENE QUE SER DE QUIEN LA ANOTA
--
-- EL AGUJERO (4/10/2026): una foto privada la podía leer otra cuenta.
--
-- Eran dos reglas que cada una por su lado parecía razonable:
--   - `photos`, "fotos: dueño": pedía solo `auth.uid() = user_id`. Se podía
--     anotar una fila PROPIA con la ruta del archivo de OTRO.
--   - storage, "amigos leen visibles": daba permiso si existía cualquier fila de
--     `photos` con esa ruta, visible y de un amigo. No miraba que la carpeta de
--     la ruta fuera la del dueño de la fila.
-- Juntas: con dos cuentas amigas entre sí, una anota como suya y "para amigos"
-- la ruta de la foto privada de un tercero, y la otra pide la URL firmada. No se
-- hace desde la app: hay que hablarle a la base con la anon key. La ruta de una
-- foto que alguna vez se compartió la conoce cualquiera que la haya visto.
--
-- EL ARREGLO, por los dos lados. Cada uno alcanza solo; van los dos:
--  1. En `photos`: la ruta tiene que empezar con la carpeta de quien la anota,
--     y el log, si viene, tiene que ser propio (también se podía colgar una foto
--     del día de otro).
--  2. En storage: la fila que da permiso tiene que ser del dueño de la carpeta.
--     Esto deja sin efecto cualquier fila ajena que ya estuviera anotada.
--
-- NO CAMBIA NADA PARA NINGUNA BUILD. La app siempre subió a su carpeta y anotó
-- esa misma ruta (`nucleo/foto.ts`), en la web, en la build de tienda y en la
-- del teléfono.
--
-- SE PUEDE CORRER DOS VECES, Y SE PUEDE CORRER ANTES QUE LA 54. No usa nada de
-- las migraciones 54 a 59, así que cierra el agujero sobre el esquema 53 que
-- tiene producción hoy. En ese caso NO sube la versión: el cliente decide qué
-- puede usar mirando `version_del_esquema()`, y un 60 con la 57 y la 58 sin
-- aplicar lo haría pedir columnas que no existen. Corrida temprano hay que
-- volver a correrla en su lugar, después de la 59: no rompe nada, y esa segunda
-- pasada es la que sube la versión a 60.
--
-- Igual que en schema.sql.

drop policy if exists "fotos: dueño" on public.photos;
create policy "fotos: dueño" on public.photos for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and storage_path like auth.uid()::text || '/%'
    and (
      photos.log_id is null
      or exists (select 1 from public.logs l where l.id = photos.log_id and l.user_id = auth.uid())
    )
  );

-- La parte del storage va adentro de un bloque que mira si el schema existe:
-- en la base de las pruebas (PGlite) no hay storage, y así el archivo corre
-- igual en los dos lados. En Supabase existe siempre.
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
            where p.storage_path = name
              and p.visibilidad = 'amigos'
              and (storage.foldername(name))[1] = p.user_id::text
              and public.son_amigos(auth.uid(), p.user_id)
          )
        )
    $regla$;
  end if;
end $$;

-- LA VERSIÓN SUBE A 60 SOLO SI YA ESTÁ LA 59 (ver arriba). Solo sube, nunca baja.
do $$
begin
  if public.version_del_esquema() >= 59 then
    execute 'create or replace function public.version_del_esquema() returns int language sql immutable as $v$ select 60; $v$';
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
