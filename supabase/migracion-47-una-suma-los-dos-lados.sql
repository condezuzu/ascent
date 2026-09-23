-- MIGRACIÓN 47 — "un lado por vez" pasa a sumar los dos lados
--
-- -------------------------------------------------------------
-- QUÉ PASÓ
-- -------------------------------------------------------------
-- Reporte del gimnasio (25/9): *"«Por lado» tiene que sumar el total, igual
-- que mancuernas. Estaba haciendo extensiones unilaterales y no sumaba."*
--
-- Y tiene razón. Una serie de extensiones unilaterales no es media serie: son
-- las dos piernas, una después de la otra. Contar 40 cuando movió 40 con cada
-- una contaba la mitad del trabajo, y encima hacía que el MISMO ejercicio
-- valiera el doble si se anotaba como `par`. La diferencia entre `par` y `una`
-- es cuándo se mueven los dos lados —a la vez o uno por vez—, y eso no cambia
-- cuánto se levantó.
--
-- El multiplicador se arregla en el teléfono (`nucleo/carga.ts`, × 2). Esta
-- migración arregla lo otro, que es lo que esta base tiene mal.
--
-- -------------------------------------------------------------
-- EL MODO `una` QUERÍA DECIR DOS COSAS
-- -------------------------------------------------------------
-- La etiqueta dice **"un lado por vez"** y eso es lo que significa. Pero el
-- catálogo lo estaba usando además para *"una mancuerna con las dos manos"*,
-- que es otra cosa completamente:
--
--   * sentadilla goblet, pullover, tríceps con mancuerna → una mancuerna, las
--     DOS manos, un solo movimiento. El número escrito ES lo que se movió.
--   * remo con mancuerna, curl concentrado, patada de tríceps → un brazo por
--     vez. El número escrito se mueve DOS veces.
--
-- Con `una` multiplicando por dos, los tres primeros pasarían a contar el
-- doble. Así que se reclasifican a `total`, que es exactamente lo que son: el
-- número escrito es el total movido.
--
-- NO HACE FALTA UN MODO NUEVO, y se pensó: `una` ya dice "un lado por vez" en
-- la interfaz desde que se escribió, incluido el comentario que aclara que
-- sirve para una máquina unilateral y no solo para mancuernas. Lo que estaba
-- mal era el catálogo, no el nombre.
--
-- -------------------------------------------------------------
-- LO QUE ARRASTRA, DICHO
-- -------------------------------------------------------------
-- El modo queda escrito en cada bloque el día que se hizo, así que esto NO
-- toca lo ya anotado: un goblet viejo sigue diciendo `carga: "una"` y, con el
-- multiplicador nuevo, sus kilos pasan a contar el doble en Stats.
--
-- Se deja así a propósito y es la decisión menos mala de las tres:
--   * reescribir los bloques viejos sería tocar el historial de la persona;
--   * dejar `una` en × 1 sería no arreglar lo que se pidió;
--   * y son tres ejercicios sobre un catálogo entero.
--
-- Si molesta, se corrige a mano desde la lista de cada día, que es para lo que
-- está.

update public.ejercicios
   set carga = 'total'
 where id in ('sentadilla_goblet', 'pullover', 'triceps_mancuerna');

-- -------------------------------------------------------------
-- LA VERSIÓN DEL ESQUEMA
-- -------------------------------------------------------------
-- Sube a 47. Nada del teléfono depende de esta migración para andar —el
-- multiplicador vive en el cliente y el catálogo tiene valores por omisión—
-- así que no hay ninguna función nueva que preguntar; el número sube igual
-- para que `test:db` sepa contra qué comparar.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 47; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
