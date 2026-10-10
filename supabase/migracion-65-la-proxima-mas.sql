-- MIGRACIÓN 65 — "LA PRÓXIMA, MÁS": MARCAR QUE UN PESO YA QUEDÓ CHICO
--
-- Una tabla nueva y dos funciones. Nada de lo que existe cambia: la app vieja
-- no se entera, y va ANTES de la OTA que la usa.

do $$
begin
  if public.version_del_esquema() < 64 then
    raise exception 'La migración 65 va después de la 64 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- (lo que sigue es copia exacta de schema.sql)
-- -------------------------------------------------------------
-- "LA PRÓXIMA, MÁS" (migración 65)
-- -------------------------------------------------------------
-- La app no anota repeticiones, así que no puede saber sola si un peso ya
-- quedó chico. Lo dice la persona, con un toque, cuando llegó a la meta con el
-- mismo peso en todas las series. Queda acá —y no en el teléfono— porque es una
-- decisión sobre el futuro: cambiar de teléfono no puede llevarse la progresión.
--
-- UNA POR EJERCICIO, y dice lo que se HIZO ese día (peso, modo, series), no lo
-- que hay que hacer: el disco de más lo suma el teléfono, en la unidad de la
-- persona. Marcar de nuevo pisa.
create table if not exists public.subidas_marcadas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ejercicio text not null references public.ejercicios(id),
  carga text not null,
  peso numeric not null,
  series int not null,
  -- El día en que se marcó, en el huso de la persona. Lo manda el teléfono: una
  -- marca que sube tarde desde el subsuelo es del día del toque.
  dia date not null,
  marcada timestamptz not null default now(),
  primary key (user_id, ejercicio),
  constraint subidas_carga_valida check (carga in ('total', 'par', 'una', 'lastre')),
  constraint subidas_peso_valido check (peso > 0 and peso <= 1000),
  constraint subidas_series_validas check (series between 1 and 99)
);

alter table public.subidas_marcadas enable row level security;

drop policy if exists "subidas: solo dueño" on public.subidas_marcadas;
create policy "subidas: solo dueño" on public.subidas_marcadas for select
  using (user_id = auth.uid());

grant select on public.subidas_marcadas to authenticated;

-- Idempotente: guarda LA marca, no "sumá una". Con `p_peso` nulo la saca. Por
-- eso entra a la cola del teléfono (`compartido/cola.ts`).
create or replace function public.marcar_subida(p_ejercicio text, p_carga text, p_peso numeric, p_series int, p_dia date)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_ejercicio is null then return; end if;
  if p_peso is null then
    delete from subidas_marcadas where user_id = uid and ejercicio = p_ejercicio;
    return;
  end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre') then return; end if;
  if p_peso <= 0 or p_peso > 1000 or p_series is null or p_series < 1 or p_series > 99 then return; end if;
  -- Ni del futuro ni de hace un mes: es la marca de una sesión reciente.
  if p_dia is null or p_dia > mi_hoy() + 1 or p_dia < mi_hoy() - 14 then return; end if;
  if not exists (select 1 from ejercicios where id = p_ejercicio) then return; end if;
  insert into subidas_marcadas (user_id, ejercicio, carga, peso, series, dia)
       values (uid, p_ejercicio, p_carga, p_peso, p_series, p_dia)
  on conflict (user_id, ejercicio) do update
     set carga = excluded.carga, peso = excluded.peso, series = excluded.series, dia = excluded.dia, marcada = now();
end;
$$;

-- LAS QUE SIGUEN VALIENDO. Una marca se gasta sola: vale hasta la próxima vez
-- que se hace ese ejercicio con peso, en un día POSTERIOR al de la marca. No
-- hace falta que el teléfono avise que la usó, y por eso no se desincroniza.
create or replace function public.mis_subidas()
returns table (ejercicio text, carga text, peso numeric, series int, dia date)
language sql stable security definer set search_path = public as $$
  select m.ejercicio, m.carga, m.peso, m.series, m.dia
    from subidas_marcadas m
   where m.user_id = auth.uid()
     and not exists (
       select 1
         from sesiones s
         join logs l on l.id = s.log_id,
              jsonb_array_elements(s.bloques) as b(bloque)
        where s.user_id = m.user_id
          and l.fecha > m.dia
          and b.bloque ->> 'ejercicio' = m.ejercicio
          and jsonb_typeof(b.bloque -> 'pesos') = 'array'
          and jsonb_array_length(b.bloque -> 'pesos') > 0
     );
$$;

revoke execute on function public.marcar_subida(text, text, numeric, int, date), public.mis_subidas() from public, anon;
grant execute on function public.marcar_subida(text, text, numeric, int, date), public.mis_subidas() to authenticated;

-- La versión sube a 65.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 65; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
