-- MIGRACIÓN 58 — PESO CORPORAL como modo de carga (item 6.2)
--
-- No poder registrar abdominales bien era un agujero: el peso era el cuerpo y no
-- había forma de decirlo. Se agrega 'corporal' como quinto modo de carga: sin
-- número, solo las series, y no suma volumen (el peso corporal cambia con el
-- tiempo, igual que el lastre no lo cuenta).
--
-- El modo se guarda en el bloque (jsonb), pero la base lo valida en CINCO lugares
-- —dos CHECK y tres funciones—, así que si el cliente manda 'corporal' sin esto,
-- la base lo descarta en silencio (lo lee como el modo por omisión del catálogo).
-- Por eso el front recién ofrece 'corporal' cuando el esquema llegó a 58.

-- Los dos CHECK: se amplían para aceptar 'corporal'.
alter table public.ejercicios drop constraint if exists ejercicios_carga_valida;
alter table public.ejercicios add constraint ejercicios_carga_valida
  check (carga in ('total', 'par', 'una', 'lastre', 'corporal'));

alter table public.cargas_elegidas drop constraint if exists cargas_elegidas_valida;
alter table public.cargas_elegidas add constraint cargas_elegidas_valida
  check (carga in ('total', 'par', 'una', 'lastre', 'corporal'));

-- fijar_bloques: la lista blanca que LEE el modo del bloque; sin 'corporal' acá,
-- un bloque corporal se guardaba como el modo por omisión del catálogo.
create or replace function public.fijar_bloques(p_sesion uuid, p_bloques jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio jsonb;
  total int;
  guardado jsonb;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if jsonb_typeof(p_bloques) <> 'array' then raise exception 'bloques tiene que ser una lista'; end if;

  select series into total from sesiones where id = p_sesion and user_id = uid;
  if total is null then return null; end if;

  select coalesce(jsonb_agg(
           case when p is null
                then jsonb_build_object('ejercicio', e, 'series', s)
                else jsonb_build_object('ejercicio', e, 'series', s, 'pesos', p, 'carga', c)
           end order by i), '[]'::jsonb)
    into limpio
  from (
    select
      f.e, f.s, f.i,
      pesos_limpios(f.pesos, f.s) as p,
      case when f.carga in ('total', 'par', 'una', 'lastre', 'corporal') then f.carga
           else (select carga from ejercicios where id = f.e)
      end as c
    from (
      select
        b.valor->>'ejercicio' as e,
        greatest(0, least((b.valor->>'series')::int, 999)) as s,
        b.valor->'pesos' as pesos,
        b.valor->>'carga' as carga,
        b.orden as i
      from jsonb_array_elements(p_bloques) with ordinality as b(valor, orden)
      where b.valor->>'ejercicio' in (select id from ejercicios)
        and (b.valor->>'series') ~ '^[0-9]+$'
        and b.orden <= 40
    ) f
  ) filtrados;

  update sesiones set bloques = limpio
   where id = p_sesion and user_id = uid
   returning bloques into guardado;

  return jsonb_build_object('bloques', coalesce(guardado, '[]'::jsonb), 'total_series', total);
end;
$$;

-- elegir_carga: recordar el modo por ejercicio. Acepta 'corporal'.
create or replace function public.elegir_carga(p_ejercicio text, p_carga text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre', 'corporal') then return; end if;
  if not exists (select 1 from ejercicios where id = p_ejercicio) then return; end if;
  insert into cargas_elegidas (user_id, ejercicio, carga)
       values (uid, p_ejercicio, p_carga)
  on conflict (user_id, ejercicio) do update set carga = excluded.carga, elegida = now();
end;
$$;

revoke execute on function public.elegir_carga(text, text) from public, anon;
grant execute on function public.elegir_carga(text, text) to authenticated;

-- revisar_carga: corregir el modo de un bloque marcado. Acepta 'corporal'.
create or replace function public.revisar_carga(p_sesion uuid, p_orden int, p_carga text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  guardado jsonb;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre', 'corporal') then return null; end if;

  update sesiones s
     set bloques = (
       select jsonb_agg(
                case when b.orden = p_orden and (b.valor ? 'carga_supuesta')
                     then (b.valor - 'carga_supuesta') || jsonb_build_object('carga', p_carga)
                     else b.valor
                end order by b.orden)
         from jsonb_array_elements(s.bloques) with ordinality as b(valor, orden)
     )
   where s.id = p_sesion and s.user_id = uid
     and jsonb_typeof(s.bloques) = 'array'
     and jsonb_array_length(s.bloques) >= p_orden
     and p_orden >= 1
   returning bloques into guardado;

  return guardado;
end;
$$;

revoke execute on function public.revisar_carga(uuid, int, text) from public, anon;
grant execute on function public.revisar_carga(uuid, int, text) to authenticated;

-- La versión sube a 58.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 58; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
