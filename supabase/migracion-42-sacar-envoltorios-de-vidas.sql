-- =============================================================
-- MIGRACIÓN 42 — se van los cuatro envoltorios de "vidas"
--
-- Va DESPUÉS de la 41. Ejecutar entera en el SQL Editor de Supabase.
--
-- NO CAMBIA NINGÚN DATO y no rompe ninguna pantalla: ninguna de las dos apps
-- llama a estas funciones. Borra código muerto.
-- =============================================================

-- -------------------------------------------------------------
-- 1. POR QUÉ EXISTÍAN
-- -------------------------------------------------------------
-- Las vidas se llamaban "vidas" hasta la migración 34, que las renombró a
-- "impulsos". Para no romper a los clientes que ya estaban instalados, la 34
-- dejó cuatro funciones con el nombre viejo que solo llaman a la nueva:
--
--   vidas_por_mes()              -> impulsos_tope()
--   vidas_disponibles(uuid,date) -> impulsos_disponibles(uuid,date)
--   mis_vidas()                  -> mis_impulsos() + del_mes
--   devolver_vidas(date[])       -> devolver_impulsos(date[])
--
-- Un año después, la web y la app nativa llaman SOLO a las nuevas (revisado el
-- 16/9/2026 en `src/`, `movil/src/` y `compartido/`). Lo único que seguía
-- usando los nombres viejos eran los tests, que ya se pasaron a los nuevos.
--
-- DOS FUNCIONES QUE HACEN LO MISMO son dos verdades que se van a separar: la
-- próxima regla nueva se escribe en una sola y nadie se acuerda de la otra.
drop function if exists public.devolver_vidas(date[]);
drop function if exists public.mis_vidas();
drop function if exists public.vidas_disponibles(uuid, date);
drop function if exists public.vidas_por_mes();

-- La TABLA sigue llamándose `vidas_usadas` y no se toca: renombrarla es
-- reescribir el historial de todos por un nombre, y el nombre no se ve.

-- -------------------------------------------------------------
-- 2. LA VERSIÓN
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 42; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
