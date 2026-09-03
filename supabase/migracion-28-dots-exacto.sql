-- =============================================================
-- MIGRACIÓN 28 — el DOTS exacto entre amigos
--
-- Va DESPUÉS de la 27. Ejecutar entera en el SQL Editor de Supabase.
--
-- OJO CON EL ORDEN: esta NO es aditiva. `ranking_fuerza` cambia la forma de lo
-- que devuelve —se va la columna `banda`, entra `dots`— y el código viejo lee
-- `f.banda`, que va a venir en `undefined`. Correrla ANTES del deploy deja el
-- ranking mostrando celdas vacías hasta que el deploy llegue.
--
-- Correr DESPUÉS del deploy, o aceptar unos minutos de ranking incompleto.
-- =============================================================

-- -------------------------------------------------------------
-- 1. POR QUÉ SE DA VUELTA UNA DECISIÓN
-- -------------------------------------------------------------
-- La §16.7b decía que el DOTS exacto era privado, y el motivo era correcto:
-- DOTS es una función del peso corporal y del total, los amigos ven los pesos
-- levantados, así que publicar el DOTS exacto permite despejar el peso con una
-- cuenta de dos líneas.
--
-- Lo que cambió no es el razonamiento sino la premisa. El humano decidió el
-- 2026-08-31 que su peso corporal no le parece un dato tan personal, y que
-- prefiere ver el número exacto de sus amigos antes que una banda.
--
-- Se acepta explícitamente lo que eso implica: **con el DOTS exacto y el total
-- a la vista, un amigo puede despejar el peso corporal.** No es un efecto
-- lateral, es la consecuencia directa y está aceptada. Y se avisa al activar
-- el DOTS, que es cuando la persona todavía puede decidir no hacerlo.
--
-- Lo que NO cambia: `weights` sigue sin compartirse nunca, y `peso_actual`
-- sigue sin otorgarse a nadie. Lo que se acepta es que el peso se pueda
-- DEDUCIR, no que se publique.

-- `ranking_fuerza` devuelve una tabla, así que cambiar sus columnas obliga a
-- borrarla y volver a crearla: `create or replace` no puede cambiar la forma.
drop function if exists public.ranking_fuerza();

create or replace function public.ranking_fuerza()
returns table (
  id uuid,
  username text,
  avatar_url text,
  total numeric,
  -- Antes era `banda text` y `dots_propio numeric`. Ahora hay un solo número y
  -- es el de todos: dos columnas para el mismo dato existían solo para poder
  -- mostrarle a cada uno una versión distinta.
  dots numeric,
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
  select c.id, c.username, c.avatar_url, c.total, c.d,
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

revoke execute on function public.ranking_fuerza() from public, anon;
grant execute on function public.ranking_fuerza() to authenticated;

-- -------------------------------------------------------------
-- 2. `mi_fuerza` deja de devolver la banda
-- -------------------------------------------------------------
-- Devuelve jsonb, así que basta con sacarle la clave. La usaba la línea "tus
-- amigos ven: 250–300", que ahora no tiene sentido: ven lo mismo que vos.
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

-- -------------------------------------------------------------
-- 3. `banda_dots` se va
-- -------------------------------------------------------------
-- Ya no la llama nadie. Dejarla sería dejar una función que implementa una
-- regla que la app dejó de tener: el próximo que la encuentre va a creer que
-- las bandas siguen vigentes y la va a usar.
drop function if exists public.banda_dots(numeric);
