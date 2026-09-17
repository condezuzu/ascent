-- =============================================================
-- MIGRACIÓN 44 — Los ejercicios que cada persona usa de verdad
--
-- Va DESPUÉS de la 43. Ejecutar entera en el SQL Editor de Supabase.
--
-- NO CAMBIA NINGÚN DATO, NO BORRA NADA y no toca ninguna función existente.
-- Agrega UNA función de solo lectura. Si no se corre, el selector de
-- ejercicios funciona exactamente como hoy: la sección "Tuyos" no aparece y
-- el árbol de zonas queda intacto.
-- =============================================================

-- -------------------------------------------------------------
-- 1. POR QUÉ
-- -------------------------------------------------------------
-- Elegir ejercicio son dos toques —zona y después músculo— y recién ahí la
-- lista. Está bien para explorar cien ejercicios y está mal para la realidad:
-- casi todo el mundo repite entre cinco y diez, todas las semanas. Bajar el
-- mismo árbol cada vez para llegar siempre al mismo renglón es pagar el precio
-- de los cien cada vez que se usan los ocho.
--
-- Esto devuelve cuáles son esos ocho. La app los pone arriba en un bloque
-- aparte y NO reordena el resto del árbol: un menú que se acomoda solo obliga
-- a leerlo entero cada vez, porque ya no se sabe dónde estaba lo de ayer.

-- -------------------------------------------------------------
-- 2. DE DÓNDE SALE EL DATO
-- -------------------------------------------------------------
-- De `sesiones.bloques`, que es la lista {ejercicio, series, pesos, carga} de
-- cada sesión. No hay tabla de series por ejercicio: el contador guarda un
-- total y los bloques son la anotación de encima. Alcanza, porque lo que se
-- busca es "cuáles repite", no cuántos kilos movió.
--
-- SE CUENTAN BLOQUES, NO SERIES. Dos sesiones distintas con el mismo ejercicio
-- pesan más que una sola sesión con veinte series de ese ejercicio: lo que
-- hace que algo sea "tuyo" es que vuelva, no que un día te hayas ensañado.
--
-- ENTRAN LAS SESIONES ABANDONADAS Y LAS CORTAS. Una sesión que no llegó al
-- piso de duración igual dice qué ejercicio elegiste, que es lo único que se
-- pregunta acá. Filtrarlas seria confundir "no contó como entrenamiento" con
-- "no lo hiciste".

create or replace function public.mis_ejercicios_usados()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  filas jsonb;
begin
  if uid is null then return null; end if;

  select coalesce(jsonb_agg(f order by f.veces desc, f.ultima desc), '[]'::jsonb)
    into filas
    from (
      select
        b->>'ejercicio'      as ejercicio,
        count(*)::int        as veces,
        max(s.inicio)        as ultima
      from sesiones s
      cross join lateral jsonb_array_elements(s.bloques) b
      where s.user_id = uid
        -- Un bloque sin ejercicio es el contador a secas: existe y es válido,
        -- pero no dice nada de qué se hizo.
        and b->>'ejercicio' is not null
        -- Y uno que nombra algo que ya no está en el catálogo tampoco sirve:
        -- la app no tendría con qué dibujarlo.
        and exists (select 1 from ejercicios e where e.id = b->>'ejercicio')
      group by 1
    ) f;

  return filas;
end;
$$;

revoke all on function public.mis_ejercicios_usados() from public;
grant execute on function public.mis_ejercicios_usados() to authenticated;

-- -------------------------------------------------------------
-- 3. POR QUÉ NO NECESITA POLÍTICA DE RLS
-- -------------------------------------------------------------
-- Es `security definer` con `where user_id = auth.uid()` adentro y sin ningún
-- parámetro: no hay forma de pedirle los de otra persona. Es el mismo patrón
-- que `mi_fuerza` y `resumen_sesiones`.

-- -------------------------------------------------------------
-- 4. LA VERSIÓN DEL ESQUEMA
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 44; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
