-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 83 then
    raise exception 'Esta es la migración 83 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 83 — DARSE DE BAJA SIN BORRAR EL HISTORIAL DE OTROS
--
-- Entre la 76 y la 80 los amigos veían tus ejercicios propios y podían anotar
-- marcas, cargas elegidas o "la próxima, más" sobre ellos. Esas filas apuntan al
-- ejercicio sin cascada: al darte de baja, el borrado chocaba con ellas y se
-- revertía entero (después de que la app ya había borrado tus fotos).
--
-- Ahora, al darte de baja, un propio tuyo que otra cuenta usó QUEDA HUÉRFANO: sin
-- dueño, con su nombre guardado, y las marcas del otro sobreviven. El pasado no se
-- reescribe por una decisión de otra persona. El otro lo sigue viendo como
-- "Ejercicio propio", igual que con la 80: un huérfano no entra al catálogo de
-- nadie. Los propios que nadie más usó se borran, como antes.
--
-- Y desde acá nadie anota sobre un propio que no ve: después de la 80 un amigo
-- lo seguía usando sin saberlo, y esas filas nuevas también trababan la baja.
-- No toca ninguna fila: cambia funciones, una política y suma una columna.

do $$
begin
  if public.version_del_esquema() < 82 then
    raise exception 'La migración 83 va después de la 82 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

alter table public.ejercicios add column if not exists huerfano boolean not null default false;

-- Sin dueño en vez de borrado: el que borra los propios que no son huérfanos es
-- `eliminar_cuenta`, antes de borrar la cuenta.
alter table public.ejercicios drop constraint if exists ejercicios_creado_por_fkey;
alter table public.ejercicios add constraint ejercicios_creado_por_fkey
  foreign key (creado_por) references public.profiles(id) on delete set null;

-- Sin dueño no es catálogo: un huérfano no lo ve nadie.
drop policy if exists "ejercicios: catálogo con sesión" on public.ejercicios;
create policy "ejercicios: catálogo con sesión" on public.ejercicios for select
  using (auth.uid() is not null and ((creado_por is null and not huerfano) or creado_por = auth.uid()));

create or replace function public.eliminar_cuenta()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sin sesión';
  end if;
  -- challenges.ganador apunta a profiles SIN cascade: si esta cuenta ganó un
  -- reto ya cerrado, esa fila bloquearía el borrado. Se van primero, a mano.
  delete from challenges where retador = uid or rival = uid or ganador = uid;
  -- Los propios que OTRA cuenta usó quedan huérfanos (migración 83): su historial
  -- no se borra. Al borrarse la cuenta pierden el dueño y nadie más los ve.
  update ejercicios e set huerfano = true
   where e.creado_por = uid
     and (exists (select 1 from prs p where p.ejercicio = e.id and p.user_id <> uid)
       or exists (select 1 from cargas_elegidas c where c.ejercicio = e.id and c.user_id <> uid)
       or exists (select 1 from subidas_marcadas s where s.ejercicio = e.id and s.user_id <> uid));
  -- Los demás se borran, y antes lo propio que apunta a ellos (no tiene cascada).
  delete from cargas_elegidas  where user_id = uid and ejercicio in (select id from ejercicios where creado_por = uid and not huerfano);
  delete from subidas_marcadas where user_id = uid and ejercicio in (select id from ejercicios where creado_por = uid and not huerfano);
  delete from prs              where user_id = uid and ejercicio in (select id from ejercicios where creado_por = uid and not huerfano);
  delete from ejercicios where creado_por = uid and not huerfano;
  delete from auth.users where id = uid;
end;
$$;

-- NADIE ANOTA SOBRE UN PROPIO QUE NO VE (vuelta 7 de la cacería). La 80 solo cerró la
-- lectura: un amigo que ya había usado un propio tuyo lo seguía anotando (su historial
-- se lo propone), porque estas dos funciones son security definer y no pasan por la
-- RLS, y la marca entraba por la FK. Esas filas son las que trababan la baja.
create or replace function public.elegir_carga(p_ejercicio text, p_carga text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre', 'corporal') then return; end if;
  -- Solo sobre un ejercicio que se ve (migración 83): un propio ajeno o huérfano no.
  if not exists (select 1 from ejercicios where id = p_ejercicio and ((creado_por is null and not huerfano) or creado_por = uid)) then return; end if;
  insert into cargas_elegidas (user_id, ejercicio, carga)
       values (uid, p_ejercicio, p_carga)
  on conflict (user_id, ejercicio) do update set carga = excluded.carga, elegida = now();
end;
$$;

create or replace function public.marcar_subida(p_ejercicio text, p_carga text, p_peso numeric, p_series int, p_dia date)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_ejercicio is null then return; end if;
  if p_peso is null then
    -- Con el modo, saca la de ESE modo; sin modo (la app de antes), todas las del ejercicio.
    delete from subidas_marcadas
     where user_id = uid and ejercicio = p_ejercicio and (p_carga is null or carga = p_carga);
    return;
  end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre') then return; end if;
  if p_peso <= 0 or p_peso > 1000 or p_series is null or p_series < 1 or p_series > 99 then return; end if;
  -- Ni del futuro ni de hace un mes: es la marca de una sesión reciente.
  if p_dia is null or p_dia > mi_hoy() + 1 or p_dia < mi_hoy() - 14 then return; end if;
  -- Solo sobre un ejercicio que se ve (migración 83): un propio ajeno o huérfano no.
  if not exists (select 1 from ejercicios where id = p_ejercicio and ((creado_por is null and not huerfano) or creado_por = uid)) then return; end if;
  insert into subidas_marcadas (user_id, ejercicio, carga, peso, series, dia)
       values (uid, p_ejercicio, p_carga, p_peso, p_series, p_dia)
  on conflict (user_id, ejercicio, carga) do update
     set peso = excluded.peso, series = excluded.series, dia = excluded.dia, marcada = now();
end;
$$;

drop policy if exists "marcas: dueño" on public.prs;
create policy "marcas: dueño" on public.prs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (select 1 from public.ejercicios e where e.id = ejercicio));

do $$
begin
  if public.version_del_esquema() < 83 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 83; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
