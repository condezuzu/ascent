-- =============================================================
-- MIGRACIÓN 08 — módulo de fuerza (marcas, DOTS, ranking)
--
-- Para bases que YA tienen el schema aplicado. En una base nueva no hace
-- falta: schema.sql ya lo incluye todo.
-- Ejecutar entero en el SQL Editor de Supabase.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Sexo: campo opcional, y sin él no hay DOTS
--
-- DOTS usa dos juegos de coeficientes. Quien no lo carga NO tiene DOTS: no
-- se asume ninguno ni se usan coeficientes "por defecto". Un DOTS calculado
-- con la fórmula equivocada es un dato falso que además ordena mal el
-- ranking, y nadie lo notaría porque el número igual parece razonable.
-- null significa "sin DOTS", no "por defecto" (§16.7).
-- -------------------------------------------------------------
alter table public.profiles
  add column if not exists sexo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_sexo_check') then
    alter table public.profiles
      add constraint profiles_sexo_check check (sexo is null or sexo in ('m','f'));
  end if;
end $$;

-- -------------------------------------------------------------
-- 2. Catálogo de ejercicios
--
-- El catálogo es grande a propósito (§16.3): el usuario anota lo que quiera.
-- Pero al total DOTS entran SOLO los tres marcados con cuenta_dots. La
-- fórmula está calibrada sobre esos tres; sumarle otros no la hace más
-- completa, la invalida, porque el número deja de ser comparable con el de
-- cualquier otra persona, que es lo único que lo hace valer.
-- -------------------------------------------------------------
create table if not exists public.ejercicios (
  id text primary key,
  nombre text not null,
  grupo text not null,
  cuenta_dots boolean not null default false,
  orden int not null default 0
);

insert into public.ejercicios (id, nombre, grupo, cuenta_dots, orden) values
  ('sentadilla',        'Sentadilla',              'piernas', true,  10),
  ('press_banca',       'Press de banca',          'pecho',   true,  20),
  ('peso_muerto',       'Peso muerto',             'espalda', true,  30),
  ('sentadilla_frontal','Sentadilla frontal',      'piernas', false, 110),
  ('peso_muerto_rumano','Peso muerto rumano',      'piernas', false, 120),
  ('prensa',            'Prensa',                  'piernas', false, 130),
  ('hip_thrust',        'Hip thrust',              'piernas', false, 140),
  ('zancadas',          'Zancadas',                'piernas', false, 150),
  ('extension_cuadriceps','Extensión de cuádriceps','piernas',false, 160),
  ('curl_femoral',      'Curl femoral',            'piernas', false, 170),
  ('gemelos',           'Gemelos de pie',          'piernas', false, 180),
  ('press_inclinado',   'Press inclinado',         'pecho',   false, 210),
  ('press_mancuernas',  'Press con mancuernas',    'pecho',   false, 220),
  ('aperturas',         'Aperturas',               'pecho',   false, 230),
  ('fondos',            'Fondos',                  'pecho',   false, 240),
  ('dominadas',         'Dominadas',               'espalda', false, 310),
  ('remo_barra',        'Remo con barra',          'espalda', false, 320),
  ('remo_mancuerna',    'Remo con mancuerna',      'espalda', false, 330),
  ('jalon',             'Jalón al pecho',          'espalda', false, 340),
  ('remo_polea',        'Remo en polea',           'espalda', false, 350),
  ('press_militar',     'Press militar',           'hombros', false, 410),
  ('press_arnold',      'Press Arnold',            'hombros', false, 420),
  ('elevaciones_laterales','Elevaciones laterales','hombros', false, 430),
  ('pajaros',           'Pájaros',                 'hombros', false, 440),
  ('curl_barra',        'Curl con barra',          'brazos',  false, 510),
  ('curl_mancuernas',   'Curl con mancuernas',     'brazos',  false, 520),
  ('martillo',          'Curl martillo',           'brazos',  false, 530),
  ('press_frances',     'Press francés',           'brazos',  false, 540),
  ('triceps_polea',     'Tríceps en polea',        'brazos',  false, 550),
  ('abdominales_polea', 'Abdominales en polea',    'core',    false, 610),
  ('rueda_abdominal',   'Rueda abdominal',         'core',    false, 620)
on conflict (id) do update
  set nombre = excluded.nombre,
      grupo = excluded.grupo,
      cuenta_dots = excluded.cuenta_dots,
      orden = excluded.orden;

-- -------------------------------------------------------------
-- 3. Las marcas
--
-- Se guarda lo que el usuario LEVANTÓ (peso y repeticiones), no el 1RM: el
-- 1RM se deriva. Guardar el derivado dejaría el dato original perdido y
-- cualquier cambio de fórmula reescribiría el historial.
--
-- El peso va SIEMPRE en kilos, igual que weights: la unidad del usuario es de
-- presentación. Si se guardaran libras, cambiar la preferencia reinterpretaría
-- todas las marcas viejas.
--
-- Los PRs no caducan y no se pisan entre sí: cada carga es una fila y la
-- mejor gana. Por eso siempre se muestra la fecha al lado del número (§16.5).
-- -------------------------------------------------------------
create table if not exists public.prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ejercicio text not null references public.ejercicios(id),
  peso numeric(6,2) not null check (peso between 1 and 600),
  reps int not null check (reps between 1 and 20),
  -- true = 1RM real; false = estimado con Epley a partir de las repeticiones
  es_real boolean not null default false,
  fecha date not null check (fecha <= current_date + 1),
  creado timestamptz not null default now(),
  -- Un 1RM "real" con más de una repetición es una contradicción: es el peso
  -- que se levantó UNA vez. Si tiene más reps, es un estimado.
  constraint prs_real_es_una_rep check (not es_real or reps = 1)
);
create index if not exists prs_por_usuario on public.prs (user_id, ejercicio);

-- -------------------------------------------------------------
-- 4. La matemática
-- -------------------------------------------------------------

-- 1RM de una marca. Real: el peso tal cual. Estimado: Epley (§16.4).
--
-- El caso de UNA repetición se saca a mano: Epley crudo devuelve
-- peso × 31/30, un 3% de más, porque la fórmula está pensada para extrapolar
-- desde varias repeticiones. Una repetición ya ES el 1RM, no hay nada que
-- extrapolar, y sin este corte el mismo levantamiento daba distinto según
-- cómo lo hubieran cargado.
create or replace function public.un_rm(p_peso numeric, p_reps int, p_es_real boolean)
returns numeric language sql immutable as $$
  select case
    when p_es_real or p_reps = 1 then p_peso
    else p_peso * (1 + p_reps / 30.0)
  end;
$$;

-- DOTS. Coeficientes tomados de la implementación de OpenPowerlifting
-- (crates/coefficients/src/dots.rs), NO de memoria: un DOTS mal calculado
-- ordena mal el ranking y nadie se da cuenta, porque el número igual parece
-- razonable. Verificado contra un caso publicado: hombre de 90 kg con 650 kg
-- de total da 420,3 (ver test-schema.mjs).
create or replace function public.dots(p_total numeric, p_peso numeric, p_sexo text)
returns numeric language plpgsql immutable as $$
declare
  pc numeric;
  den numeric;
begin
  if p_total is null or p_peso is null or p_sexo is null then return null; end if;
  if p_total <= 0 then return null; end if;
  -- La fórmula está calibrada entre 40 y 210 kg (hombres) y entre 40 y 150
  -- (mujeres). Fuera de ese rango el polinomio de grado 4 se dispara y
  -- devuelve valores absurdos, así que el peso se ACOTA, no se extrapola.
  if p_sexo = 'm' then
    pc := least(greatest(p_peso, 40), 210);
    den := -0.000001093 * pc^4
         +  0.0007391293 * pc^3
         -  0.1918759221 * pc^2
         + 24.0900756 * pc
         - 307.75076;
  elsif p_sexo = 'f' then
    pc := least(greatest(p_peso, 40), 150);
    den := -0.0000010706 * pc^4
         +  0.0005158568 * pc^3
         -  0.1126655495 * pc^2
         + 13.6175032 * pc
         -  57.96288;
  else
    return null;
  end if;
  if den <= 0 then return null; end if;
  return round(500 * p_total / den, 2);
end;
$$;

-- La banda es lo ÚNICO que ve alguien que no sea el dueño (§16.7b). El DOTS
-- exacto al lado de un total conocido permite despejar el peso corporal con
-- una cuenta de dos líneas; la banda deja el dato en un intervalo demasiado
-- ancho para que sirva.
create or replace function public.banda_dots(p_dots numeric)
returns text language sql immutable as $$
  select case
    when p_dots is null then null
    when p_dots < 200 then 'menos de 200'
    when p_dots >= 600 then '600 o más'
    else (floor(p_dots / 50) * 50)::int || '–' || (floor(p_dots / 50) * 50 + 50)::int
  end;
$$;

-- -------------------------------------------------------------
-- 5. Los internos: calculan con datos privados y NO se otorgan a nadie
--
-- peso_actual devuelve el peso corporal de cualquiera, que es el dato más
-- privado de la app (§4). Vive acá porque el DOTS lo necesita, y las
-- funciones que lo usan devuelven el resultado sin devolver nunca el peso.
-- Si alguna vez alguien las otorga a `authenticated`, la regla se rompe.
-- -------------------------------------------------------------
create or replace function public.peso_actual(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select valor from weights where user_id = p_user order by fecha desc limit 1;
$$;

-- El mejor 1RM por ejercicio: el máximo entre TODAS las marcas cargadas, con
-- la fecha de la que lo produjo. Empate: la más reciente.
create or replace function public.mejores_marcas(p_user uuid)
returns table (ejercicio text, kg numeric, peso numeric, reps int, es_real boolean, fecha date)
language sql stable security definer set search_path = public as $$
  select distinct on (p.ejercicio)
    p.ejercicio,
    round(un_rm(p.peso, p.reps, p.es_real), 1),
    p.peso, p.reps, p.es_real, p.fecha
  from prs p
  where p.user_id = p_user
  order by p.ejercicio, un_rm(p.peso, p.reps, p.es_real) desc, p.fecha desc;
$$;

-- El total del DOTS: los tres, o nada. Con dos de tres no hay un total
-- "parcial" que valga: sería comparable con nadie.
create or replace function public.total_dots(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select case when count(*) = 3 then sum(m.kg) end
    from mejores_marcas(p_user) m
    join ejercicios e on e.id = m.ejercicio and e.cuenta_dots;
$$;

create or replace function public.dots_de(p_user uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select dots(
    total_dots(p_user),
    peso_actual(p_user),
    (select sexo from profiles where id = p_user)
  );
$$;

-- -------------------------------------------------------------
-- 6. Lo que sí llama el cliente
-- -------------------------------------------------------------

-- Mis marcas y mi DOTS. El único lugar donde sale el número exacto, y sale
-- solo para el dueño.
create or replace function public.mi_fuerza()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  marcas jsonb;
  total numeric;
  d numeric;
  s text;
  pc numeric;
begin
  if uid is null then return null; end if;
  select sexo into s from profiles where id = uid;
  pc := peso_actual(uid);
  total := total_dots(uid);
  d := dots(total, pc, s);
  select coalesce(jsonb_agg(jsonb_build_object(
      'ejercicio', m.ejercicio,
      'nombre', e.nombre,
      'grupo', e.grupo,
      'cuenta_dots', e.cuenta_dots,
      'kg', m.kg,
      'peso', m.peso,
      'reps', m.reps,
      'es_real', m.es_real,
      'fecha', m.fecha
    ) order by e.orden), '[]'::jsonb)
    into marcas
    from mejores_marcas(uid) m
    join ejercicios e on e.id = m.ejercicio;
  return jsonb_build_object(
    'marcas', marcas,
    'total', total,
    'dots', d,
    'banda', banda_dots(d),
    -- POR QUÉ no hay DOTS, para que la interfaz diga qué falta en vez de
    -- mostrar un cero o un error (§16.7)
    'falta', case
      when total is null then 'marcas'
      when s is null then 'sexo'
      when pc is null then 'peso'
      else null
    end
  );
end;
$$;

-- Ranking entre amigos. Sale el total (los levantamientos ya los ven los
-- amigos) y la BANDA; el número exacto solo en la fila propia.
--
-- Ordena por DOTS exacto aunque muestre bandas: el orden filtra algo que la
-- banda oculta, y está aceptado a propósito (§16.7b) porque entre amigos el
-- peso corporal no es un secreto. Si alguna vez deja de valer, la salida es
-- ordenar por banda y mostrar los empates como empates.
create or replace function public.ranking_fuerza()
returns table (
  id uuid,
  username text,
  avatar_url text,
  total numeric,
  banda text,
  dots_propio numeric,
  marcas jsonb
) language sql stable security definer set search_path = public as $$
  with gente as (
    select auth.uid() as quien
    union
    select case when f.solicitante = auth.uid() then f.destinatario else f.solicitante end
      from friendships f
     where f.estado = 'aceptada'
       and (f.solicitante = auth.uid() or f.destinatario = auth.uid())
  ),
  calc as (
    select p.id, p.username, p.avatar_url, total_dots(p.id) as total, dots_de(p.id) as d
      from profiles p
      join gente g on g.quien = p.id
  )
  select c.id, c.username, c.avatar_url, c.total, banda_dots(c.d),
         case when c.id = auth.uid() then c.d end,
         -- el detalle por ejercicio viaja con la fila: son levantamientos, que
         -- los amigos ya ven, y así el 1RM lo calcula un solo lugar
         (select coalesce(jsonb_agg(jsonb_build_object(
                   'ejercicio', m.ejercicio, 'nombre', e.nombre,
                   'kg', m.kg, 'fecha', m.fecha) order by e.orden), '[]'::jsonb)
            from mejores_marcas(c.id) m
            join ejercicios e on e.id = m.ejercicio and e.cuenta_dots)
    from calc c
   where c.d is not null
   order by c.d desc;
$$;

-- Percentil global: "estás en el 15% más fuerte". Nunca posiciones ni
-- nombres (§16.6). Entre amigos nadie miente porque se conocen; en un ranking
-- global de desconocidos, ser el número uno es justo el premio que hace que
-- valga inflar la marca, y no hay forma de verificar un PR desde una app.
create or replace function public.percentil_fuerza()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  mio numeric;
  cuantos int;
  arriba int;
begin
  if auth.uid() is null then return null; end if;
  mio := dots_de(auth.uid());
  if mio is null then return jsonb_build_object('percentil', null, 'gente', 0); end if;
  select count(*), count(*) filter (where t.d > mio)
    into cuantos, arriba
    from (select dots_de(p.id) as d from profiles p) t
   where t.d is not null;
  -- Con poca gente el percentil ES un podio disfrazado: entre tres, "el 33%
  -- más fuerte" significa "sos el primero", que es exactamente lo que el
  -- percentil venía a evitar. Hasta que haya gente, no hay percentil.
  if cuantos < 10 then
    return jsonb_build_object('percentil', null, 'gente', cuantos);
  end if;
  return jsonb_build_object(
    'percentil', greatest(1, ceil(100.0 * arriba / cuantos))::int,
    'gente', cuantos
  );
end;
$$;

-- -------------------------------------------------------------
-- 7. RLS
-- -------------------------------------------------------------
alter table public.ejercicios enable row level security;
alter table public.prs enable row level security;

drop policy if exists "ejercicios: catálogo con sesión" on public.ejercicios;
create policy "ejercicios: catálogo con sesión" on public.ejercicios for select
  using (auth.uid() is not null);

-- Las marcas se ven igual que los logs: el dueño todo, los amigos aceptados
-- leen. El peso CORPORAL sigue afuera, siempre (§16.6).
drop policy if exists "marcas: dueño" on public.prs;
create policy "marcas: dueño" on public.prs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "marcas: amigos leen" on public.prs;
create policy "marcas: amigos leen" on public.prs for select
  using (public.son_amigos(auth.uid(), user_id));

-- -------------------------------------------------------------
-- 8. Permisos
-- -------------------------------------------------------------
revoke all on table public.ejercicios, public.prs from anon, authenticated;

-- el catálogo es de solo lectura para todos: lo edita el schema, no la app
grant select on public.ejercicios to authenticated;
-- sin update: una marca mal cargada se borra y se vuelve a cargar, igual que
-- un día de racha. Editarla en el lugar dejaría el historial sin rastro.
grant select, insert, delete on public.prs to authenticated;

-- el sexo es una preferencia del dueño y no afecta a nadie más
grant update (sexo) on public.profiles to authenticated;

-- Los internos NO se otorgan: calculan con el peso corporal ajeno.
revoke execute on function
  public.peso_actual(uuid),
  public.mejores_marcas(uuid),
  public.total_dots(uuid),
  public.dots_de(uuid)
  from public, anon, authenticated;

revoke execute on function
  public.mi_fuerza(),
  public.ranking_fuerza(),
  public.percentil_fuerza()
  from public, anon;

grant execute on function
  public.mi_fuerza(),
  public.ranking_fuerza(),
  public.percentil_fuerza()
  to authenticated;

-- un_rm, dots y banda_dots quedan abiertas: son matemática pura, igual que
-- rango_de_racha. No tocan datos de nadie.
