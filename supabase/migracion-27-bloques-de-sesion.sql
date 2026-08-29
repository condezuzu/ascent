-- =============================================================
-- MIGRACIÓN 27 — en qué estabas cuando hiciste esas series
--
-- Va DESPUÉS de la 26. Ejecutar entera en el SQL Editor de Supabase.
--
-- SE PUEDE CORRER ANTES O DESPUÉS DEL DEPLOY. Es toda aditiva: una columna con
-- default y dos funciones nuevas. El código viejo no sabe que existen y sigue
-- andando igual; el nuevo las usa cuando aparecen. Es el patrón sin baile de
-- orden de la 24.
-- =============================================================

-- -------------------------------------------------------------
-- 1. LOS BLOQUES
-- -------------------------------------------------------------
-- El contador de series dice CUÁNTAS, no DE QUÉ. Cuarenta series en la semana
-- no se pueden leer sin saber si fueron de piernas o de bíceps, y el detector
-- de estancamiento no tiene con qué trabajar.
--
-- LO QUE ESTO NO ES: no es Hevy. No hay pesos, ni repeticiones, ni plantillas,
-- ni orden de ejercicios. Es una anotación: "de acá en adelante estoy en
-- sentadilla". Un toque cuando CAMBIÁS de ejercicio, no uno por serie.
--
-- LAS DOS REGLAS QUE LO MANTIENEN VIVO (y son la parte importante de esto,
-- porque una función que hay que acordarse de usar no la usa nadie y a los dos
-- meses el dato no está):
--
--   1. SIRVE AUNQUE NUNCA LO TOQUES. `sesiones.series` sigue siendo el total y
--      la única fuente de la verdad del conteo. `bloques` es un anexo encima.
--      Con `bloques` en `[]` la app funciona exactamente como hoy: la racha,
--      la duración y el resumen no lo miran. No se pierde nada por ignorarlo.
--
--   2. ARRANCA SOLO. `ultimo_ejercicio()` devuelve en qué terminaste la última
--      vez, para que la app abra ahí. Si entrenás siempre parecido, cambiarlo
--      es la excepción; tener que elegirlo cada día sería el impuesto que hace
--      que se deje de usar.
--
-- Por qué jsonb y no una tabla: un bloque no tiene identidad propia ni se
-- consulta suelto —siempre se lee la sesión entera— y una tabla obligaría a un
-- borrado en cascada y a un orden explícito para algo que ES una lista. La
-- forma del dato es una lista; se guarda como una lista.
alter table public.sesiones
  add column if not exists bloques jsonb not null default '[]'::jsonb;

-- Que sea una lista, y nada más. El contenido lo valida `fijar_bloques`, que
-- es por donde entra: un check que recorriera el jsonb entero se pagaría en
-- cada escritura para comprobar algo que ya se comprobó al escribirlo.
alter table public.sesiones
  drop constraint if exists sesiones_bloques_es_lista;
alter table public.sesiones
  add constraint sesiones_bloques_es_lista
  check (jsonb_typeof(bloques) = 'array');

-- -------------------------------------------------------------
-- 2. GUARDARLOS
-- -------------------------------------------------------------
-- Misma forma que `fijar_series` y por la misma razón: manda la LISTA ENTERA,
-- no "agregá un bloque". Así repetirla es inofensiva —la última gana— y puede
-- ir a la cola de escrituras sin riesgo de contar de más cuando la red del
-- subsuelo se corta y el reintento llega dos veces (ver `lib/cola.ts`).
--
-- Lleva el id de la sesión por lo mismo que lo lleva `fijar_series`: la cola
-- puede vaciarse mucho después, cuando esa sesión ya terminó.
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

  -- El total de series de la sesión es el techo. Los bloques ANOTAN parte de
  -- lo que ya pasó; no pueden inventar series que no se contaron.
  select series into total from sesiones where id = p_sesion and user_id = uid;
  if total is null then return null; end if; -- no es tuya, o no existe

  -- Se filtra acá y no en el cliente: la lista llega del teléfono. Se quedan
  -- solo los bloques con un ejercicio del catálogo y una cuenta sana, y se
  -- corta en 40 —una sesión con más de cuarenta cambios de ejercicio no es una
  -- sesión, es un error de la app o alguien probando.
  select coalesce(jsonb_agg(jsonb_build_object('ejercicio', e, 'series', s) order by i), '[]'::jsonb)
    into limpio
  from (
    select
      b.valor->>'ejercicio' as e,
      greatest(0, least((b.valor->>'series')::int, 999)) as s,
      b.orden as i
    from jsonb_array_elements(p_bloques) with ordinality as b(valor, orden)
    where b.valor->>'ejercicio' in (select id from ejercicios)
      and (b.valor->>'series') ~ '^[0-9]+$'
      and b.orden <= 40
  ) filtrados;

  update sesiones set bloques = limpio
   where id = p_sesion and user_id = uid
   returning bloques into guardado;

  return jsonb_build_object('bloques', coalesce(guardado, '[]'::jsonb), 'total_series', total);
end;
$$;

-- REVOCAR PRIMERO, SIEMPRE. `create function` le da EXECUTE a `public` por
-- omisión, y estas dos son SECURITY DEFINER: sin esta línea quedarían
-- llamables por `anon`. Las dos chequean `auth.uid()` y no devolverían nada,
-- pero el que se apoya en eso es el próximo que agregue una función y se
-- olvide del chequeo. Lo encontró el test de deriva, que compara esta
-- migración contra `schema.sql`.
revoke execute on function public.fijar_bloques(uuid, jsonb) from public, anon;
grant execute on function public.fijar_bloques(uuid, jsonb) to authenticated;

-- -------------------------------------------------------------
-- 3. EN QUÉ TERMINASTE LA ÚLTIMA VEZ
-- -------------------------------------------------------------
-- La regla 2 de arriba. Devuelve el ejercicio del último bloque de la última
-- sesión que tuvo alguno — no de la última sesión a secas: si ayer no anotaste
-- nada, la respuesta útil es la de anteayer, no `null`.
--
-- Se mira solo el último mes: volver con lo que hacías hace medio año es peor
-- que no proponer nada.
create or replace function public.ultimo_ejercicio()
returns text language sql stable security definer set search_path = public as $$
  select s.bloques -> -1 ->> 'ejercicio'
    from sesiones s
   where s.user_id = auth.uid()
     and jsonb_array_length(s.bloques) > 0
     and s.inicio > now() - interval '35 days'
   order by s.inicio desc
   limit 1;
$$;

revoke execute on function public.ultimo_ejercicio() from public, anon;
grant execute on function public.ultimo_ejercicio() to authenticated;

-- No hace falta ningún grant de columna: `sesiones` ya tiene `grant select`
-- a nivel tabla y una política de RLS que la limita al dueño, así que la
-- columna nueva entra bajo las mismas reglas que el resto.
