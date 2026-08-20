-- =============================================================
-- MIGRACIÓN 16 — contador de series de la sesión
--
-- Va DESPUÉS de la 15. Ejecutar entera en el SQL Editor de Supabase.
-- =============================================================

-- "Serie hecha": un toque, sin ejercicio ni peso ni repeticiones. Suma una
-- serie y arranca el descanso (§20.3).
--
-- Es el disparador de Strong sin construir un registro de series: allá el
-- descanso arranca solo al terminar una serie, y esa es la mitad buena de su
-- diseño. Lo que no se puede copiar es el resto —Ascent no registra series—,
-- pero el disparador sí, y sale casi gratis.
--
-- Y aparece un dato que antes no existía: cuántas series tuvo la sesión.
-- Cuarenta minutos con doce series y cuarenta con tres no son el mismo
-- entrenamiento, así que dice más que los minutos solos.
alter table public.sesiones
  add column if not exists series int not null default 0
  check (series >= 0);

-- Suma una. Devuelve el total para que la pantalla no tenga que releer.
create or replace function public.sumar_serie()
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  total int;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  update sesiones set series = series + 1
   where user_id = uid and estado = 'corriendo'
   returning series into total;
  return coalesce(total, 0);
end;
$$;

-- Deshace una. Un toque de más es fácil y tiene que poder deshacerse durante
-- toda la sesión, no solo al instante.
--
-- Deshacer una serie NO toca el descanso: son dos cosas separadas y el
-- descanso se cancela por su lado. Si deshacer cancelara el descanso, corregir
-- un número te costaría el temporizador que estabas usando.
create or replace function public.restar_serie()
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  total int;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  update sesiones set series = greatest(0, series - 1)
   where user_id = uid and estado = 'corriendo'
   returning series into total;
  return coalesce(total, 0);
end;
$$;

-- mi_sesion devuelve las series, para que el chip de la cabecera las pinte
-- sin una consulta aparte.
create or replace function public.mi_sesion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
begin
  if uid is null then return null; end if;
  perform cerrar_sesiones_vencidas(uid);
  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is null then
    return jsonb_build_object('corriendo', false, 'ahora', now());
  end if;
  return jsonb_build_object(
    'corriendo', true,
    'id', s.id,
    'inicio', s.inicio,
    'ahora', now(),
    'series', s.series,
    'tope_segundos', extract(epoch from tope_sesion())
  );
end;
$$;

revoke execute on function public.sumar_serie(), public.restar_serie() from public, anon;
grant execute on function public.sumar_serie(), public.restar_serie() to authenticated;
