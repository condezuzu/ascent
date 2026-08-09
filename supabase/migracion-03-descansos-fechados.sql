-- =============================================================
-- MIGRACIÓN 03 — descansos con historial fechado
-- Para bases donde ya se corrió schema.sql. Pegar en el SQL Editor.
-- Idempotente: se puede correr las veces que haga falta.
--
-- Por qué: `profiles.dias_descanso` era una sola columna que se pisaba, y
-- el cálculo de la racha la usaba para TODOS los días. Cambiar de rutina en
-- marzo recalculaba enero y hacía perder rachas ya ganadas. Ahora cada
-- cambio queda fechado y cada día se evalúa con la configuración que regía
-- ese día: el pasado no se toca nunca.
-- =============================================================

create table if not exists public.descansos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  desde date not null,
  dias int[] not null default '{}',
  creado timestamptz not null default now(),
  unique (user_id, desde)
);
create index if not exists descansos_vigente on public.descansos (user_id, desde desc);

alter table public.descansos enable row level security;

drop policy if exists "descansos: leer los propios" on public.descansos;
create policy "descansos: leer los propios" on public.descansos for select using (auth.uid() = user_id);

-- Se congela lo que hay hoy como configuración inicial, con fecha muy vieja:
-- así el pasado sigue leyéndose igual que hasta ahora y nadie pierde nada.
-- De acá en adelante, cada cambio queda fechado.
insert into public.descansos (user_id, desde, dias)
select id, date '2000-01-01', dias_descanso
  from public.profiles
 where coalesce(array_length(dias_descanso, 1), 0) > 0
on conflict (user_id, desde) do nothing;

create or replace function public.descansos_vigentes(p_user uuid, p_fecha date)
returns int[] language sql stable security definer set search_path = public as $$
  select coalesce(
    (select dias from descansos
      where user_id = p_user and desde <= p_fecha
      order by desde desc limit 1),
    '{}'::int[]);
$$;

create or replace function public.calcular_racha(p_user uuid, p_hasta date)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  d date := p_hasta;
  cnt int := 0;
  tope date;
  tiene_log boolean;
  log_descanso boolean;
begin
  select perdida_fecha into tope from profiles where id = p_user;
  loop
    if tope is not null and d <= tope then exit; end if;
    select true, es_descanso into tiene_log, log_descanso
      from logs where user_id = p_user and fecha = d;
    if tiene_log then
      if not log_descanso then cnt := cnt + 1; end if;
    elsif extract(dow from d)::int = any(descansos_vigentes(p_user, d)) then
      null;
    else
      exit;
    end if;
    d := d - 1;
    if d < p_hasta - 3650 then exit; end if;
  end loop;
  return cnt;
end;
$$;

create or replace function public.fijar_descansos(p_dias int[], p_hoy date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  limpio int[] := coalesce(p_dias, '{}'::int[]);
begin
  if uid is null then return; end if;
  if p_hoy > current_date + 1 or p_hoy < current_date - 1 then p_hoy := current_date; end if;
  if exists (select 1 from unnest(limpio) x where x < 0 or x > 6) then
    raise exception 'día de semana inválido';
  end if;
  insert into descansos (user_id, desde, dias) values (uid, p_hoy, limpio)
    on conflict (user_id, desde) do update set dias = excluded.dias;
  update profiles set dias_descanso = limpio where id = uid;
end;
$$;

-- Permisos: los descansos se leen, pero se escriben SOLO por el RPC, que es
-- el que impide fecharlos hacia atrás.
revoke all on table public.descansos from anon, authenticated;
grant select on public.descansos to authenticated;

-- dias_descanso deja de ser editable directamente: ahora es un espejo
revoke update on public.profiles from authenticated, anon;
grant update (username, avatar_url) on public.profiles to authenticated;

revoke execute on function
  public.descansos_vigentes(uuid, date),
  public.fijar_descansos(int[], date)
  from public, anon;
grant execute on function
  public.descansos_vigentes(uuid, date),
  public.fijar_descansos(int[], date)
  to authenticated;
