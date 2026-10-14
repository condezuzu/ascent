-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 75 then
    raise exception 'Esta es la migración 75 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 75 — LAS RUTINAS GUARDADAS
--
-- Varias por cuenta, cada una con su semana entera (descansos incluidos), y una
-- activa. Una tabla nueva y cinco funciones. No toca ningún dato existente.

do $$
begin
  if public.version_del_esquema() < 74 then
    raise exception 'La migración 75 va después de la 74 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- (copia exacta de schema.sql)
create table if not exists public.rutinas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null,
  activa boolean not null default false,
  dias jsonb not null,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  constraint rutinas_nombre_valido check (char_length(nombre) between 1 and 40)
);
create unique index if not exists rutinas_una_activa on public.rutinas (user_id) where activa;
create index if not exists rutinas_de on public.rutinas (user_id);
alter table public.rutinas enable row level security;

create or replace function public.rutina_dias_limpios(p_dias jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_agg(
           jsonb_build_object(
             'descanso', coalesce(jsonb_typeof(d.valor -> 'descanso') = 'boolean' and (d.valor ->> 'descanso')::boolean, false),
             'ejercicios', case
               when coalesce(jsonb_typeof(d.valor -> 'descanso') = 'boolean' and (d.valor ->> 'descanso')::boolean, false) then '[]'::jsonb
               else coalesce((
                 select jsonb_agg(
                          jsonb_build_object(
                            'ejercicio', left(e.valor ->> 'ejercicio', 80),
                            'series', case when jsonb_typeof(e.valor -> 'series') = 'number'
                                           then greatest(0, least(round((e.valor ->> 'series')::numeric), 99)) else 0 end
                          ) || case when jsonb_typeof(e.valor -> 'minutos') = 'number'
                                    then jsonb_build_object('minutos', greatest(0, least(round((e.valor ->> 'minutos')::numeric), 600)))
                                    else '{}'::jsonb end
                          order by e.i)
                   from jsonb_array_elements(case when jsonb_typeof(d.valor -> 'ejercicios') = 'array' then d.valor -> 'ejercicios' else '[]'::jsonb end)
                        with ordinality as e(valor, i)
                  where jsonb_typeof(e.valor) = 'object'
                    and coalesce(e.valor ->> 'ejercicio', '') <> ''
                    and e.i <= 30
               ), '[]'::jsonb)
             end
           ) order by g.n)
    from generate_series(0, 6) as g(n)
    cross join lateral (select case when jsonb_typeof(p_dias) = 'array' then p_dias -> g.n end as valor) as d;
$$;
revoke execute on function public.rutina_dias_limpios(jsonb) from public, anon, authenticated;

-- MIS RUTINAS, de la más vieja a la más nueva.
create or replace function public.mis_rutinas()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre, 'activa', r.activa, 'dias', r.dias) order by r.creada, r.id), '[]'::jsonb)
    from rutinas r
   where r.user_id = auth.uid();
$$;

-- GUARDAR: sin id crea una (activa si es la primera); con id cambia la mía.
-- Devuelve el id, o null si el id no era mío. Hasta diez por cuenta.
create or replace function public.guardar_rutina(p_id uuid, p_nombre text, p_dias jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio text := left(btrim(coalesce(p_nombre, '')), 40);
  v_id uuid;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if limpio = '' then limpio := 'Entrenamiento'; end if;
  if p_id is null then
    if (select count(*) from rutinas where user_id = uid) >= 10 then raise exception 'ya hay diez rutinas'; end if;
    insert into rutinas (user_id, nombre, dias, activa)
         values (uid, limpio, rutina_dias_limpios(p_dias), not exists (select 1 from rutinas where user_id = uid and activa))
      returning id into v_id;
  else
    update rutinas set nombre = limpio, dias = rutina_dias_limpios(p_dias), actualizada = now()
     where id = p_id and user_id = uid
     returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ACTIVAR una mía: queda esa sola. En dos pasos, para que el índice de "una
-- activa" no vea dos por un instante.
create or replace function public.activar_rutina(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if not exists (select 1 from rutinas where id = p_id and user_id = uid) then return; end if;
  update rutinas set activa = false where user_id = uid and activa and id <> p_id;
  update rutinas set activa = true where id = p_id;
end;
$$;

create or replace function public.borrar_rutina(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  delete from rutinas where id = p_id and user_id = auth.uid();
end;
$$;

-- LA RUTINA ACTIVA DE ALGUIEN: la mía, o la de un amigo que la muestra (la
-- misma regla que `rutina_de_amigo`). Null si no tiene ninguna guardada.
create or replace function public.rutina_activa_de(p_quien uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'nombre', r.nombre, 'dias', r.dias)
    from rutinas r
    join profiles p on p.id = r.user_id
   where r.user_id = p_quien
     and r.activa
     and auth.uid() is not null
     and (p_quien = auth.uid() or (p.comparte_rutina and public.son_amigos(auth.uid(), p_quien)));
$$;

revoke execute on function public.mis_rutinas(), public.guardar_rutina(uuid, text, jsonb), public.activar_rutina(uuid),
  public.borrar_rutina(uuid), public.rutina_activa_de(uuid) from public, anon;
grant execute on function public.mis_rutinas(), public.guardar_rutina(uuid, text, jsonb), public.activar_rutina(uuid),
  public.borrar_rutina(uuid), public.rutina_activa_de(uuid) to authenticated;

revoke all on table public.rutinas from anon, authenticated;

-- La versión sube a 75. Solo sube.
do $$
begin
  if public.version_del_esquema() < 75 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 75; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
