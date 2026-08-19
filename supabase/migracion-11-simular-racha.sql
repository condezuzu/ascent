-- =============================================================
-- MIGRACIÓN 11 — selector de racha para revisar los ocho rangos
--
-- Para bases que YA tienen el schema aplicado. En una base nueva no hace
-- falta: schema.sql ya lo incluye todo.
-- Ejecutar entero en el SQL Editor de Supabase.
-- =============================================================

-- Herramienta de revisión: ponerse en cualquier racha para mirar los colores
-- y el objeto de fondo de cada rango sin tener que entrenar ochenta días.
--
-- El candado es SERVIDOR, no interfaz. Esconder el botón en el cliente no
-- protege nada: cualquiera puede llamar al RPC desde la consola. El nombre de
-- usuario se comprueba acá adentro, así que desde otra cuenta la llamada
-- falla aunque alguien la descubra.
--
-- No hay una tabla de administradores porque hay un solo administrador y
-- nunca hubo otro: una tabla para una fila es más superficie para el mismo
-- resultado. Si algún día hay dos, esto se cambia por esa tabla.
create or replace function public.simular_racha(p_racha int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  quien text;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  select username into quien from profiles where id = uid;
  if quien is distinct from 'condeeladmin' then
    raise exception 'esta cuenta no puede simular rachas';
  end if;
  if p_racha < 0 or p_racha > 999 then
    raise exception 'racha fuera de rango';
  end if;

  -- Va a racha_base y no solo a racha_actual: racha_base es lo que sobrevive
  -- al próximo recálculo. Si se escribiera solo racha_actual, el primer
  -- trigger de logs lo pisaría y la simulación duraría hasta el próximo día
  -- registrado.
  update profiles set
    racha_base = p_racha,
    racha_actual = p_racha,
    rango_actual = rango_de_racha(p_racha),
    -- Sella los días anteriores: ya están representados por racha_base y sin
    -- esto calcular_racha los sumaría encima (§12). Va en AYER y no en hoy a
    -- propósito: con hoy sellado, registrar el día de hoy después de simular
    -- no sumaba nada y la app quedaba congelada en el número simulado.
    perdida_fecha = current_date - 1
  where id = uid;

  return jsonb_build_object('racha', p_racha, 'rango', rango_de_racha(p_racha));
end;
$$;

revoke execute on function public.simular_racha(int) from public, anon;
grant execute on function public.simular_racha(int) to authenticated;
