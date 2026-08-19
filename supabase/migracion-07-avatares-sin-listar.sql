-- =============================================================
-- MIGRACIÓN 07 — que no se pueda listar el bucket de avatares entero
--
-- Ejecutar entero en el SQL Editor de Supabase.
--
-- POR QUÉ: la política de lectura era `using (bucket_id = 'avatares')`, sin
-- ninguna condición más. Como las políticas de storage.objects se evalúan en
-- TODA consulta a esa tabla, eso le permitía a cualquier usuario con sesión
-- pedir el listado del bucket completo y sacar la lista de ids de todos los
-- usuarios de la app (las carpetas se llaman como el uuid del dueño). Es lo
-- que avisa el panel de Supabase con "Clients can list all files in this
-- bucket".
--
-- POR QUÉ SE PUEDE SACAR SIN ROMPER NADA: los avatares se muestran por la URL
-- pública (/storage/v1/object/public/...), y ese camino NO consulta la RLS
-- porque el bucket es público. Verificado: el mismo cliente anónimo al que la
-- RLS le bloquea el listado baja el archivo por la URL pública con HTTP 200.
-- `getPublicUrl()` tampoco toca la red: arma la cadena y ya.
--
-- Lo ÚNICO que la app necesita leer de storage.objects en este bucket es el
-- listado de la carpeta PROPIA, que usa eliminar_cuenta para borrar el avatar
-- antes de dar de baja. Eso queda cubierto.
--
-- Efecto de yapa: la política vieja tampoco distinguía roles, así que sin
-- sesión también habría listado. Hoy no lo hacía, pero por un accidente —la
-- evaluación de la política del bucket `fotos` falla para anon con "permission
-- denied for table photos"— y apoyar la seguridad en un error ajeno es
-- frágil. Con la política nueva, sin sesión `auth.uid()` es null, la condición
-- da null y no pasa: bloqueado como corresponde.
-- =============================================================

drop policy if exists "avatares: todos leen" on storage.objects;

create policy "avatares: dueño lista lo suyo" on storage.objects for select
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
