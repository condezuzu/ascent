-- =============================================================
-- MIGRACIÓN 51 — actividad en vivo: "fulano está en el gimnasio ahora"
--
-- Va DESPUÉS de la 50. Ejecutar entera en el SQL Editor de Supabase.
--
-- Al llegar al gimnasio, el vigilante marca "hasta = now()+2h"; las lecturas
-- filtran `hasta > now()`, así CADUCA SOLA sin cron ni detectar la salida.
-- OPT-IN (`profiles.comparte_gimnasio`, apagado por defecto): el vigilante solo
-- publica si está prendido. NUNCA dice dónde: `entrenando_ahora` devuelve
-- nombre, avatar y desde cuándo, jamás el gimnasio ni la distancia. Gateada a
-- amigos aceptados. Espejo exacto de lo que quedó en schema.sql.
-- =============================================================

alter table public.profiles add column if not exists comparte_gimnasio boolean not null default false;

create table if not exists public.en_el_gimnasio (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  desde timestamptz not null default now(),
  hasta timestamptz not null
);
alter table public.en_el_gimnasio enable row level security;
revoke all on table public.en_el_gimnasio from anon, authenticated;

create or replace function public.fijar_comparte_gimnasio(p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  update profiles set comparte_gimnasio = coalesce(p_valor, false) where id = uid;
  if not coalesce(p_valor, false) then delete from en_el_gimnasio where user_id = uid; end if;
end;
$$;

create or replace function public.marcar_en_gimnasio()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if not exists (select 1 from profiles where id = uid and comparte_gimnasio) then return; end if;
  insert into en_el_gimnasio (user_id, desde, hasta)
    values (uid, now(), now() + interval '2 hours')
    on conflict (user_id) do update set hasta = now() + interval '2 hours';
end;
$$;

create or replace function public.entrenando_ahora()
returns table (id uuid, username text, avatar_url text, desde timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.username, u.avatar_url, g.desde
    from en_el_gimnasio g
    join usuarios_publicos u on u.id = g.user_id
   where g.hasta > now()
     and g.user_id <> auth.uid()
     and public.son_amigos(auth.uid(), g.user_id)
   order by g.desde desc;
$$;

revoke execute on function public.fijar_comparte_gimnasio(boolean), public.marcar_en_gimnasio(), public.entrenando_ahora() from public, anon;
grant execute on function public.fijar_comparte_gimnasio(boolean), public.marcar_en_gimnasio(), public.entrenando_ahora() to authenticated;

-- -------------------------------------------------------------
-- LA VERSIÓN DEL ESQUEMA
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 51; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
