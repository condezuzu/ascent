-- =============================================================
-- MIGRACIÓN 06 — el dueño puede borrar su propio avatar
--
-- Ejecutar entero en el SQL Editor de Supabase.
--
-- POR QUÉ: al bucket `avatares` se le habían escrito políticas de insert,
-- update y select, pero NINGUNA de delete. Con RLS activa, "no hay política"
-- significa "prohibido", así que borrar un avatar fallaba **en silencio**:
-- la API de storage devolvía éxito con cero archivos borrados.
--
-- Se descubrió dando de baja una cuenta de prueba de punta a punta: se
-- borraba todo (perfil, días, pesos, fotos del bucket privado, amistades,
-- retos, descansos) menos el avatar, que quedaba huérfano en el bucket
-- público y seguía siendo descargable por cualquiera que tuviera la URL.
--
-- El bucket `fotos` no tenía el problema: su política es `for all`, que ya
-- incluye delete.
-- =============================================================

create policy "avatares: dueño borra" on storage.objects for delete
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
