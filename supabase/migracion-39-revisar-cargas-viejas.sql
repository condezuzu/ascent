-- =============================================================
-- MIGRACIÓN 39 — los pesos anotados antes de que existieran los modos
--
-- Va DESPUÉS de la 38. Ejecutar entera en el SQL Editor de Supabase.
--
-- ADITIVA: marca bloques ya guardados con una llave nueva y agrega una función.
-- No cambia ningún peso ni ningún modo. Se puede correr antes o después del
-- deploy: el cliente viejo no lee la marca, y el cliente nuevo sin la 39 no
-- encuentra nada marcado.
-- =============================================================

-- -------------------------------------------------------------
-- 1. EL PROBLEMA
-- -------------------------------------------------------------
-- La 38 les puso a los bloques viejos el modo del catálogo. Pero esos pesos se
-- escribieron sin etiqueta: quien anotó zancadas con mancuernas pudo escribir
-- "20" (una) o "40" (la suma). Con el modo `par`, el segundo quedó el doble.
-- Números mal que nadie va a mirar nunca, salvo que la app los señale.
--
-- SE MARCAN LOS QUE PUEDEN ESTAR MAL, no todos: los `par` (el riesgo del
-- doble) y los ejercicios cuyo nombre no dice con qué se hacen (un peso muerto
-- rumano con mancuernas anotado como una sola queda por la mitad). Una
-- sentadilla con barra no tenía otra forma de anotarse, y marcarla sería ruido
-- que enseña a ignorar la marca.
--
-- EL CORTE ES EL FIN DEL 15 DE SEPTIEMBRE, hora de Uruguay, que es el día en
-- que corrió la 38 — y nunca después de ahora. La hora exacta en que corrió no
-- quedó guardada en ningún lado. Se eligió pasarse y no quedarse corto: un
-- bloque de ese día anotado ya con la etiqueta pide un toque de "está bien";
-- uno sin marcar queda mal para siempre.
update public.sesiones s
   set bloques = (
     select jsonb_agg(
              case when jsonb_typeof(b.valor->'pesos') = 'array'
                     and not (b.valor ? 'carga_supuesta')
                     and (b.valor->>'carga' = 'par'
                          or exists (select 1 from ejercicios e
                                      where e.id = b.valor->>'ejercicio' and e.carga_ambigua))
                   then b.valor || '{"carga_supuesta": true}'::jsonb
                   else b.valor
              end order by b.orden)
       from jsonb_array_elements(s.bloques) with ordinality as b(valor, orden)
   )
 where jsonb_typeof(s.bloques) = 'array'
   and s.inicio < least(now(), timestamptz '2026-09-16 00:00:00-03')
   and exists (
     select 1 from jsonb_array_elements(s.bloques) as x(valor)
      where jsonb_typeof(x.valor->'pesos') = 'array'
        and not (x.valor ? 'carga_supuesta')
        and (x.valor->>'carga' = 'par'
             or exists (select 1 from ejercicios e
                         where e.id = x.valor->>'ejercicio' and e.carga_ambigua))
   );

-- -------------------------------------------------------------
-- 2. REVISARLOS
-- -------------------------------------------------------------
-- Desde el resumen del día: se elige qué significaba el número y la marca se
-- va. Elegir el mismo modo que tenía es "estaba bien", y también la saca.
--
-- Arreglar "anoté la suma" NO toca el número: se cambia el modo a `total`.
-- 40 en total son exactamente lo que se levantó, y el número queda como se
-- escribió ese día.
--
-- `p_orden` es la posición del bloque en la lista, desde 1. Solo toca bloques
-- marcados: no es una puerta para reescribir la historia de cualquier bloque.
create or replace function public.revisar_carga(p_sesion uuid, p_orden int, p_carga text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  guardado jsonb;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_carga is null or p_carga not in ('total', 'par', 'una', 'lastre') then return null; end if;

  update sesiones s
     set bloques = (
       select jsonb_agg(
                case when b.orden = p_orden and (b.valor ? 'carga_supuesta')
                     then (b.valor - 'carga_supuesta') || jsonb_build_object('carga', p_carga)
                     else b.valor
                end order by b.orden)
         from jsonb_array_elements(s.bloques) with ordinality as b(valor, orden)
     )
   where s.id = p_sesion and s.user_id = uid
     and jsonb_typeof(s.bloques) = 'array'
     and jsonb_array_length(s.bloques) >= p_orden
     and p_orden >= 1
   returning bloques into guardado;

  return guardado;
end;
$$;

revoke execute on function public.revisar_carga(uuid, int, text) from public, anon;
grant execute on function public.revisar_carga(uuid, int, text) to authenticated;

-- -------------------------------------------------------------
-- 3. LA VERSIÓN
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 39; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
