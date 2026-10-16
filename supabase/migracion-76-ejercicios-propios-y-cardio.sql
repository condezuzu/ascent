-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 76 then
    raise exception 'Esta es la migración 76 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 76 — EJERCICIOS PROPIOS Y CARDIO
--
-- 1. Cada cuenta agrega sus ejercicios (`crear_ejercicio`). Los ve ella y sus amigos.
-- 2. El cardio: ejercicios que se miden en minutos (`mide = tiempo`). Nueve en el
--    catálogo; `fijar_bloques` guarda sus minutos y `rutina_de_amigo` los devuelve.
--
-- No reescribe ningún dato: dos columnas con valor por omisión, filas nuevas en
-- el catálogo y funciones.

do $$
begin
  if public.version_del_esquema() < 75 then
    raise exception 'La migración 76 va después de la 75 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

alter table public.ejercicios add column if not exists creado_por uuid references public.profiles(id) on delete cascade;
alter table public.ejercicios add column if not exists mide text not null default 'series';
alter table public.ejercicios drop constraint if exists ejercicios_mide_valido;
alter table public.ejercicios add constraint ejercicios_mide_valido check (mide in ('series', 'tiempo'));
-- EL CARDIO (migración 76): ejercicios que se miden en minutos. Sin peso, fuera
-- del DOTS, con su propio grupo.
insert into public.ejercicios (id, nombre, grupo, cuenta_dots, admite_peso, orden, carga, mide) values
  ('cinta',           'Cinta',             'cardio', false, false, 900, 'total', 'tiempo'),
  ('correr',          'Correr afuera',     'cardio', false, false, 901, 'total', 'tiempo'),
  ('caminar',         'Caminar',           'cardio', false, false, 902, 'total', 'tiempo'),
  ('bicicleta_fija',  'Bicicleta fija',    'cardio', false, false, 903, 'total', 'tiempo'),
  ('eliptica',        'Elíptica',          'cardio', false, false, 904, 'total', 'tiempo'),
  ('remo_ergometro',  'Remo ergómetro',    'cardio', false, false, 905, 'total', 'tiempo'),
  ('escaladora',      'Escaladora',        'cardio', false, false, 906, 'total', 'tiempo'),
  ('soga',            'Saltar la soga',    'cardio', false, false, 907, 'total', 'tiempo'),
  ('natacion',        'Natación',          'cardio', false, false, 908, 'total', 'tiempo')
on conflict (id) do nothing;

drop policy if exists "ejercicios: catálogo con sesión" on public.ejercicios;
create policy "ejercicios: catálogo con sesión" on public.ejercicios for select
  using (auth.uid() is not null and (creado_por is null or creado_por = auth.uid() or public.son_amigos(auth.uid(), creado_por)));

-- (las funciones son copia exacta de schema.sql)
create or replace function public.crear_ejercicio(p_nombre text, p_grupo text, p_mide text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio text := left(regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g'), 40);
  mide text := case when p_mide = 'tiempo' or p_grupo = 'cardio' then 'tiempo' else 'series' end;
  ya text;
  v_id text;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if char_length(limpio) < 2 then raise exception 'el nombre es muy corto'; end if;
  if p_grupo is null or p_grupo not in ('pecho', 'espalda', 'hombros', 'brazos', 'piernas', 'core', 'cardio') then
    raise exception 'grupo desconocido';
  end if;
  select id into ya from ejercicios where creado_por = uid and lower(nombre) = lower(limpio) limit 1;
  if ya is not null then return ya; end if;
  if (select count(*) from ejercicios where creado_por = uid) >= 100 then raise exception 'ya hay cien ejercicios propios'; end if;
  v_id := 'propio_' || substr(md5(uid::text || clock_timestamp()::text || random()::text), 1, 12);
  insert into ejercicios (id, nombre, grupo, cuenta_dots, admite_peso, orden, carga, mide, creado_por)
       values (v_id, limpio, p_grupo, false, mide = 'series', 9000, 'total', mide, uid);
  return v_id;
end;
$$;
revoke execute on function public.crear_ejercicio(text, text, text) from public, anon;
grant execute on function public.crear_ejercicio(text, text, text) to authenticated;

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
           end
           -- LOS MINUTOS (migración 76): solo de un ejercicio que se mide en tiempo.
           || case when m is null then '{}'::jsonb else jsonb_build_object('minutos', m) end
           order by i), '[]'::jsonb)
    into limpio
  from (
    select
      f.e, f.s, f.i,
      -- UN EJERCICIO QUE NO LLEVA PESO NO GUARDA PESOS (migración 74). La plancha
      -- no muestra el campo, pero el bloque podía llegar con los kilos del
      -- ejercicio anterior: quedaban guardados sin verse, la app los volvía a
      -- proponer y el "+" los anotaba en cada serie, sesión tras sesión.
      case when (select x.admite_peso from ejercicios x where x.id = f.e) is false then null
           else pesos_limpios(f.pesos, f.s)
      end as p,
      case when f.carga in ('total', 'par', 'una', 'lastre', 'corporal') then f.carga
           else (select carga from ejercicios where id = f.e)
      end as c,
      -- Igual que el teléfono (minutosValidos): menos de 1 no es un dato, más de 600 se topa.
      case when (select x.mide from ejercicios x where x.id = f.e) = 'tiempo' and jsonb_typeof(f.minutos) = 'number'
                and (f.minutos #>> '{}')::numeric >= 1
           then least(round((f.minutos #>> '{}')::numeric), 600)::int
      end as m
    from (
      select
        b.valor->>'ejercicio' as e,
        greatest(0, least((b.valor->>'series')::int, 999)) as s,
        b.valor->'pesos' as pesos,
        b.valor->>'carga' as carga,
        b.valor->'minutos' as minutos,
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

create or replace function public.rutina_de_amigo(p_quien uuid)
returns table (fecha date, bloques jsonb)
language sql stable security definer set search_path = public as $$
  select l.fecha,
         -- Se arma de nuevo con SOLO esas dos claves: el bloque guardado lleva
         -- además los pesos, y esos no salen de acá.
         (select jsonb_agg(jsonb_build_object('ejercicio', b.value ->> 'ejercicio', 'series', b.value -> 'series')
                           || case when jsonb_typeof(b.value -> 'minutos') = 'number' then jsonb_build_object('minutos', b.value -> 'minutos') else '{}'::jsonb end
                           order by b.ordinality)
            from jsonb_array_elements(s.bloques) with ordinality b
           where coalesce(b.value ->> 'ejercicio', '') <> '')
    from sesiones s
    join logs l on l.id = s.log_id
    join profiles p on p.id = s.user_id
   where s.user_id = p_quien
     and auth.uid() is not null
     and s.estado = 'terminada'
     and jsonb_array_length(s.bloques) > 0
     and l.fecha >= current_date - 28
     and (p_quien = auth.uid() or (p.comparte_rutina and public.son_amigos(auth.uid(), p_quien)))
   order by l.fecha desc, s.inicio desc;
$$;

-- La versión sube a 76. Solo sube.
do $$
begin
  if public.version_del_esquema() < 76 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 76; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
