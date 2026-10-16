-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 77 then
    raise exception 'Esta es la migración 77 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 77 — AVISOS PUSH: TE QUIEREN AGREGAR, QUIEREN UNIRSE
--
-- Una tabla de tokens (uno por aparato), dos funciones para guardarlo y
-- borrarlo, y dos disparadores que avisan al crearse un pedido de amistad o de
-- unirse. Prende `pg_net` si puede; si no, todo lo demás anda igual y el aviso
-- no sale. `select avisos_push_listos()` dice si salen.
--
-- No reescribe ningún dato.

do $$
begin
  if public.version_del_esquema() < 76 then
    raise exception 'La migración 77 va después de la 76 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- -------------------------------------------------------------
-- AVISOS PUSH DE LA APP (migración 77): enterarse afuera de la app
-- -------------------------------------------------------------
-- Cuando alguien te quiere agregar o quiere unirse a tu entrenamiento, el
-- teléfono avisa aunque la app esté cerrada. El aviso lo manda la BASE, al
-- crearse el pedido, a través de Expo: no hay servidor en el medio.
--
-- Un token por APARATO (el de Expo). Si el teléfono pasa a otra cuenta, el token
-- se muda: los avisos de la anterior dejan de llegar ahí.

-- `pg_net` es lo que deja a Postgres hacer un pedido HTTP. Si no se puede
-- prender, la migración sigue: los pedidos se crean igual y el aviso no sale.
do $pgnet$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'Sin pg_net: los avisos push no van a salir (%).', sqlerrm;
end $pgnet$;

create table if not exists public.tokens_push (
  token text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- En qué idioma se le escribe (el del teléfono, o el que eligió en Ajustes).
  idioma text not null default 'es',
  actualizado timestamptz not null default now(),
  constraint tokens_push_forma check (token like 'ExponentPushToken[%]' and length(token) < 200),
  constraint tokens_push_idioma check (idioma in ('es', 'en'))
);
create index if not exists tokens_push_de on public.tokens_push (user_id);
alter table public.tokens_push enable row level security;
revoke all on table public.tokens_push from anon, authenticated;

create or replace function public.guardar_token_push(p_token text, p_idioma text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  insert into tokens_push (token, user_id, idioma)
       values (p_token, uid, case when p_idioma = 'en' then 'en' else 'es' end)
  on conflict (token) do update
     set user_id = excluded.user_id, idioma = excluded.idioma, actualizado = now();
  -- Diez aparatos por cuenta alcanzan; los más viejos se olvidan.
  delete from tokens_push
   where user_id = uid
     and token not in (select token from tokens_push where user_id = uid order by actualizado desc limit 10);
end;
$$;

-- Al cerrar sesión. Solo borra lo propio.
create or replace function public.borrar_token_push(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from tokens_push where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.guardar_token_push(text, text), public.borrar_token_push(text) from public, anon;
grant execute on function public.guardar_token_push(text, text), public.borrar_token_push(text) to authenticated;

-- MANDAR. Nunca frena lo que lo disparó: un aviso que no sale no puede
-- impedir que se cree una solicitud.
create or replace function public.mandar_push(p_a uuid, p_es text, p_en text, p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  mensajes jsonb;
begin
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then return; end if;
  select jsonb_agg(jsonb_build_object(
           'to', t.token, 'title', 'Ascent', 'body', case when t.idioma = 'en' then p_en else p_es end,
           'data', p_datos, 'sound', 'default'))
    into mensajes
    from tokens_push t
   where t.user_id = p_a;
  if mensajes is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using 'https://exp.host/--/api/v2/push/send', mensajes,
          '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
exception when others then
  raise warning 'aviso push: %', sqlerrm;
end;
$$;
revoke execute on function public.mandar_push(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.avisar_pedido_de_amistad()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quien text;
begin
  if new.estado <> 'pendiente' then return new; end if;
  select username into quien from profiles where id = new.solicitante;
  perform mandar_push(new.destinatario,
    coalesce(quien, 'Alguien') || ' te quiere agregar.',
    coalesce(quien, 'Someone') || ' wants to add you.',
    jsonb_build_object('aviso', 'amistad'));
  return new;
end;
$$;
drop trigger if exists friendships_avisar on public.friendships;
create trigger friendships_avisar after insert on public.friendships
  for each row execute function public.avisar_pedido_de_amistad();

create or replace function public.avisar_pedido_de_union()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quien text;
begin
  if new.estado <> 'pendiente' then return new; end if;
  select username into quien from profiles where id = new.solicitante;
  perform mandar_push(new.destinatario,
    coalesce(quien, 'Alguien') || ' quiere unirse a tu entrenamiento.',
    coalesce(quien, 'Someone') || ' wants to join your workout.',
    jsonb_build_object('aviso', 'union'));
  return new;
end;
$$;
drop trigger if exists entrenos_avisar on public.entrenos_compartidos;
create trigger entrenos_avisar after insert on public.entrenos_compartidos
  for each row execute function public.avisar_pedido_de_union();

revoke execute on function public.avisar_pedido_de_amistad(), public.avisar_pedido_de_union() from public, anon, authenticated;

-- ¿Salen los avisos? Para comprobarlo después de pegar esta migración, sin mirar nada más.
create or replace function public.avisos_push_listos()
returns boolean language sql stable security definer set search_path = public as $$
  select to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null;
$$;
revoke execute on function public.avisos_push_listos() from public;
grant execute on function public.avisos_push_listos() to anon, authenticated;

-- La versión sube a 77. Solo sube.
do $$
begin
  if public.version_del_esquema() < 77 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 77; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
