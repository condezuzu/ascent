-- =============================================================
-- MIGRACIÓN 50 — el anti-trampa de zona horaria no castiga al que viaja
--
-- Va DESPUÉS de la 49. Ejecutar entera en el SQL Editor de Supabase.
--
-- POR QUÉ. Desde que la app manda `fijar_zona` sola (al entrar y al volver al
-- frente), el anti-trampa de §12b —20 h sin poder registrar tras un cambio de
-- zona— se disparaba con cambios LEGÍTIMOS: un viaje real, o el primer login de
-- un usuario que no está en Uruguay. El anti-trampa fue pensado para quien
-- cambia el huso A MANO para estirar el día (registrar, cambiar, registrar de
-- nuevo), no para un cambio automático del sistema.
--
-- QUÉ CAMBIA (B+C):
--   - Solo un cambio SOSPECHOSO arma el bloqueo: dos cambios en menos de 24 h
--     (el flip-flop), o volver a la zona inmediatamente anterior. Un cambio
--     único (un viaje) y el primer cambio de un usuario nuevo NO bloquean.
--   - El bloqueo, además, dura a lo sumo 20 h desde el cambio sospechoso. Antes
--     `bloqueo_hasta` miraba `zona_cambiada` sin acotar su antigüedad, así que
--     un cambio viejo bloqueaba el registro diario para siempre. Eso estaba
--     latente porque hasta ahora la app nunca llamaba a `fijar_zona`.
--
-- El nombre IANA NO cambia con el horario de verano, así que el DST no dispara
-- nada de esto (cambia el offset, no el nombre).
-- =============================================================

-- La zona anterior (para detectar el flip-flop A->B->A) y el momento en que se
-- armó el bloqueo por un cambio sospechoso (lo que mira `bloqueo_hasta`, en vez
-- de `zona_cambiada`).
alter table public.profiles add column if not exists zona_previa text;
alter table public.profiles add column if not exists zona_bloqueo_desde timestamptz;

create or replace function public.fijar_zona(p_zona text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  actual text;
  previa text;
  cambiada timestamptz;
  sospechoso boolean;
begin
  if uid is null or p_zona is null then return; end if;
  if not exists (select 1 from pg_timezone_names where name = p_zona) then
    raise exception 'zona horaria desconocida: %', p_zona;
  end if;
  select zona, zona_previa, zona_cambiada into actual, previa, cambiada
    from profiles where id = uid;
  if actual is distinct from p_zona then
    -- Sospechoso = flip-flop (dos cambios en <24 h) o volver a la zona previa.
    -- Un cambio único (viaje) y el primer cambio (usuario nuevo: cambiada y
    -- previa son null) NO son sospechosos y no arman el bloqueo.
    sospechoso := (cambiada is not null and now() - cambiada < interval '24 hours')
                  or (p_zona is not distinct from previa);
    update profiles set
      zona_previa = actual,
      zona = p_zona,
      zona_cambiada = now(),
      zona_bloqueo_desde = case when sospechoso then now() else zona_bloqueo_desde end
    where id = uid;
  end if;
end;
$$;

create or replace function public.bloqueo_hasta(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(l.creado) + interval '20 hours'
    from logs l, profiles p
   where l.user_id = p_user and p.id = p_user
     and p.zona_bloqueo_desde is not null
     and p.zona_bloqueo_desde > now() - interval '20 hours'
     and l.creado > p.zona_bloqueo_desde - interval '20 hours'
     and now() - l.creado < interval '20 hours';
$$;

-- -------------------------------------------------------------
-- LA VERSIÓN DEL ESQUEMA
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 50; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
