-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 103 then
    raise exception 'Esta es la migración 103 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 103 — EL DÍA REGISTRADO A MANO LLEVA LO DEL ÚLTIMO ENTRENAMIENTO DE ESA RUTINA (26/11)
--
-- Pedido del dueño: «si solo registras el día, tendría que tomar la info del último entrenamiento que hubo en esa
-- rutina», sin preguntar. Hasta ahora «Registrar el día» guardaba el día y nada más, y no contaba para los músculos,
-- la fatiga ni el progreso. El teléfono elige el entrenamiento (la rutina vive ahí) y lo manda; esto lo guarda como
-- una sesión ya terminada del día de hoy, marcada `copiada`: cuenta para los músculos y la fatiga, no para la
-- tendencia de fuerza (repetir los mismos kilos más tarde la aplanaría).
--
-- No toca datos. Hasta pegarla, la app registra el día como siempre (pide la versión 103).

do $$
begin
  if public.version_del_esquema() < 102 then
    raise exception 'La migración 103 va después de la 102 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

alter table public.sesiones add column if not exists copiada boolean not null default false;

-- Solo sobre el día de hoy ya registrado y sin ningún entrenamiento: uno hecho con la app (o ya copiado) no se pisa.
-- Los bloques pasan por `fijar_bloques`, con sus mismas limpiezas; sin ninguna serie válida no queda nada.
create or replace function public.anotar_entrenamiento_copiado(p_bloques jsonb, p_minutos int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_log uuid;
  v_id uuid;
  total int;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if jsonb_typeof(p_bloques) <> 'array' then raise exception 'bloques tiene que ser una lista'; end if;
  select id into v_log from logs where user_id = uid and fecha = mi_hoy();
  if v_log is null or exists (select 1 from sesiones where log_id = v_log) then return null; end if;

  insert into sesiones (user_id, log_id, inicio, fin, estado, series, copiada)
    values (uid, v_log, now() - make_interval(mins => least(greatest(coalesce(p_minutos, 1), 1), 300)), now(), 'terminada', 0, true)
    returning id into v_id;
  perform fijar_bloques(v_id, p_bloques);
  select coalesce(sum((b->>'series')::int), 0) into total from sesiones s, jsonb_array_elements(s.bloques) b where s.id = v_id;
  if total = 0 then
    delete from sesiones where id = v_id;
    return null;
  end if;
  update sesiones set series = total where id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.anotar_entrenamiento_copiado(jsonb, int) from public, anon;
grant execute on function public.anotar_entrenamiento_copiado(jsonb, int) to authenticated;

create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 103; $$;
