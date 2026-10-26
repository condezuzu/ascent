-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 97 then
    raise exception 'Esta es la migración 97 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 97 — QUÉ DÍAS ENTRENABA LA RUTINA, CON FECHA (26/10)
--
-- Para los «días faltados del año» de Stats: cuentan los días que la rutina decía de
-- entrenar y no se fue. La rutina se pisa al editarla, así que no dice qué valía en agosto:
-- esta tabla lo guarda fechado, como `descansos` («el pasado no se reescribe»). Cada vez que
-- cambia la rutina activa —o sus días de descanso—, un renglón desde hoy con los días de la
-- semana que entrena (0 = domingo, como `Date.getDay()`); `entrena` null es «sin rutina».
--
-- LO DE ANTES DE HOY SE DEDUCE, y es lo único deducido: a quien ya tiene una rutina activa se
-- le anota la de hoy desde que creó su primera rutina. Antes de eso, sin rutina guardada, los
-- días no cuentan como faltados.
--
-- No toca datos existentes. Hasta pegarla, Stats no muestra la cuenta (pide la versión 97).

do $$
begin
  if public.version_del_esquema() < 96 then
    raise exception 'La migración 97 va después de la 96 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

create table if not exists public.rutina_semanas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  desde date not null,
  entrena int[],
  primary key (user_id, desde)
);
alter table public.rutina_semanas enable row level security;
revoke all on public.rutina_semanas from anon, authenticated;
grant select on public.rutina_semanas to authenticated;
drop policy if exists "rutina_semanas: leer las propias" on public.rutina_semanas;
create policy "rutina_semanas: leer las propias" on public.rutina_semanas for select using (auth.uid() = user_id);

-- Los días de la semana que no son de descanso.
create or replace function public.dias_que_entrena(p_dias jsonb)
returns int[] language sql immutable set search_path = public as $$
  select coalesce(array_agg(g.n order by g.n), '{}'::int[])
    from generate_series(0, 6) as g(n)
   where not coalesce(jsonb_typeof(p_dias -> g.n -> 'descanso') = 'boolean' and (p_dias -> g.n ->> 'descanso')::boolean, false);
$$;
revoke execute on function public.dias_que_entrena(jsonb) from public, anon, authenticated;

-- Después de guardar, activar o borrar una rutina: si cambió lo que entrena la activa, un
-- renglón desde hoy (el mismo día se pisa). Dar de baja la cuenta borra las rutinas en
-- cascada: ahí el perfil ya no está y no se anota nada.
create or replace function public.anotar_semana_de_rutina()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  hoy date;
  v int[];
  ultima record;
begin
  uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  if not exists (select 1 from profiles where id = uid) then return null; end if;
  hoy := hoy_de(uid);
  select dias_que_entrena(r.dias) into v from rutinas r where r.user_id = uid and r.activa;
  select s.desde, s.entrena into ultima from rutina_semanas s where s.user_id = uid order by s.desde desc limit 1;
  if not found then
    if v is null then return null; end if;
  elsif ultima.desde < hoy and ultima.entrena is not distinct from v then
    return null;
  end if;
  insert into rutina_semanas (user_id, desde, entrena) values (uid, hoy, v)
    on conflict (user_id, desde) do update set entrena = excluded.entrena;
  return null;
end;
$$;
revoke execute on function public.anotar_semana_de_rutina() from public, anon, authenticated;

drop trigger if exists rutinas_anotar_semana on public.rutinas;
create trigger rutinas_anotar_semana
  after insert or update of dias, activa or delete on public.rutinas
  for each row execute function public.anotar_semana_de_rutina();

-- Lo que ya hay: la activa de hoy, desde la primera rutina que se creó (en su huso).
insert into public.rutina_semanas (user_id, desde, entrena)
select a.user_id,
       least((pr.primera at time zone coalesce(p.zona, 'America/Montevideo'))::date, public.hoy_de(a.user_id)),
       public.dias_que_entrena(a.dias)
  from public.rutinas a
  join public.profiles p on p.id = a.user_id
  join lateral (select min(r.creada) as primera from public.rutinas r where r.user_id = a.user_id) pr on true
 where a.activa
on conflict (user_id, desde) do nothing;

-- La versión sube a 97.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 97; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
