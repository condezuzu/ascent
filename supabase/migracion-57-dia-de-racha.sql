-- MIGRACIÓN 57 — "día 41" en cada foto (item 6.4)
--
-- Cada foto pasa de ser una foto suelta a ser un REGISTRO: dice el día de racha
-- en que se sacó. El rango NO se escribe (ya vive en el color del marco, 4.2).
-- Para eso el log guarda la racha de ese día. `registrar_dia` la anota de acá en
-- más, y los días viejos se rellenan una vez (aprox. con `calcular_racha`, exacto
-- para quien nunca perdió racha; una etiqueta, no una fuente de verdad).

alter table public.logs add column if not exists racha_del_dia int;

-- `registrar_dia` anota la racha del día en el log. Igual que en schema.sql.
create or replace function public.registrar_dia(p_origen text default 'manual')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rango_antes int;
  perfil profiles;
  nuevo_log logs;
  hoy date := mi_hoy();
  hasta timestamptz := bloqueo_hasta(uid);
begin
  if hasta is not null then
    -- el día queda anotado; se registra solo cuando pase la ventana
    update profiles set dia_pendiente = hoy, pendiente_desde = now() where id = uid;
    return jsonb_build_object('bloqueado', true, 'pendiente', hoy, 'hasta', hasta);
  end if;

  select rango_actual into rango_antes from profiles where id = uid;
  insert into logs (user_id, fecha, origen)
    values (uid, hoy, p_origen)
    returning * into nuevo_log;
  select * into perfil from profiles where id = uid;
  -- La racha de ESTE día queda anotada en el log (item 6.4): el trigger del
  -- insert ya subió profiles.racha_actual, así que es la de recién.
  update logs set racha_del_dia = perfil.racha_actual where id = nuevo_log.id;
  return jsonb_build_object(
    'bloqueado', false,
    'log_id', nuevo_log.id,
    'racha', perfil.racha_actual,
    'rango_antes', rango_antes,
    'rango_despues', perfil.rango_actual,
    'planeta', nuevo_log.planeta_del_dia,
    'subio_rango', perfil.rango_actual > rango_antes
  );
end;
$$;

-- RELLENO DE UNA VEZ (solo datos, no schema): la racha de cada día viejo, con
-- `calcular_racha` —el largo de la racha hasta ese día—. Exacto para quien nunca
-- perdió; para el resto es una aproximación de una etiqueta. Solo lo que está en
-- null, así correr la migración dos veces no lo recalcula.
update public.logs
   set racha_del_dia = greatest(0, calcular_racha(user_id, fecha))
 where racha_del_dia is null;

-- La versión sube a 57.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 57; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
