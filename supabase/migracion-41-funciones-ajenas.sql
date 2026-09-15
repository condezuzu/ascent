-- =============================================================
-- MIGRACIÓN 41 — nadie pregunta por los datos de otro
--
-- Va DESPUÉS de la 40. Ejecutar entera en el SQL Editor de Supabase.
--
-- NO CAMBIA NINGÚN DATO. Saca permisos y acota una función. Se puede correr
-- antes o después del deploy: ninguna de las dos apps llama a estas funciones.
-- =============================================================

-- -------------------------------------------------------------
-- 1. LA FUGA (encontrada el 15/9 con `supabase/probar-privacidad.mjs`)
-- -------------------------------------------------------------
-- Estas funciones reciben el id de un usuario y son SECURITY DEFINER: leen por
-- encima de la RLS. Quedaron ejecutables para cualquiera con sesión, y los ids
-- son públicos (`usuarios_publicos`, el ranking). Con eso, alguien que NO es tu
-- amigo podía:
--   - `calcular_racha(tu_id, fecha)` día por día → tu calendario entero, que
--     la tabla solo les muestra a tus amigos;
--   - `descansos_vigentes` → tus días de descanso, que no ve nadie;
--   - `impulsos_*` y `mejor_racha_real` → tus vidas y tu historial;
--   - `son_amigos(x, y)` → si otras dos personas son amigas.
-- Probado contra la base real con dos cuentas: las tablas estaban cerradas, las
-- funciones no.
--
-- Ninguna app las llama: las usan por dentro otras funciones SECURITY DEFINER
-- (los triggers de la racha, `verificar_perdida`, `mis_impulsos`), que corren
-- con los permisos del dueño y no necesitan que el usuario pueda llamarlas.
revoke execute on function
  public.calcular_racha(uuid, date),
  public.mejor_racha_real(uuid),
  public.descansos_vigentes(uuid, date),
  public.impulsos_ganados(uuid),
  public.impulsos_disponibles(uuid, date),
  public.vidas_disponibles(uuid, date)
  from public, anon, authenticated;

-- -------------------------------------------------------------
-- 2. `son_amigos` NO SE PUEDE CERRAR: la usan las reglas de acceso
-- -------------------------------------------------------------
-- Las políticas de logs, fotos, marcas, retos y storage la llaman con los
-- permisos de quien consulta. Sacarle el permiso rompería todas esas lecturas.
-- Se acota en cambio lo que contesta: solo sobre una amistad de QUIEN PREGUNTA.
-- Todas las políticas la llaman con `auth.uid()` en una de las dos puntas.
create or replace function public.son_amigos(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and auth.uid() in (a, b)
    and exists (
      select 1 from friendships
      where estado = 'aceptada'
        and ((solicitante = a and destinatario = b) or (solicitante = b and destinatario = a))
    );
$$;

-- -------------------------------------------------------------
-- 3. LA VERSIÓN
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 41; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
