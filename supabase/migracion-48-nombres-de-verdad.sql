-- MIGRACIÓN 48 — los ejercicios se llaman como los llama la gente
--
-- -------------------------------------------------------------
-- QUÉ PASÓ
-- -------------------------------------------------------------
-- Reporte del gimnasio (25/9): *"poné los nombres como se conocen de verdad,
-- no la traducción literal. «Aperturas» es Peck Deck. «Buenos días» nadie sabe
-- qué es. Muchos se conocen en inglés y así hay que ponerlos."*
--
-- El catálogo se escribió traduciendo, y eso tiene un costo concreto que no es
-- de estilo: un ejercicio que no se reconoce en la lista NO SE ELIGE. Se elige
-- el de al lado, o se deja el bloque sin ejercicio — y entonces la app pierde
-- el dato que vino a guardar.
--
-- CAMBIAN LOS NOMBRES, NO LOS `id`. Los bloques ya anotados guardan el id, así
-- que todo el historial sigue apuntando al mismo lugar: lo único que cambia es
-- cómo se lee en pantalla. Por eso esto es seguro de correr en cualquier
-- momento y no arrastra nada.
--
-- -------------------------------------------------------------
-- LOS DIEZ
-- -------------------------------------------------------------
-- 1. `buenos_dias`         "Buenos días"          → "Good morning"
--    Es el caso más claro del pedido: la traducción literal de *good morning*
--    quedó en el catálogo y en un gimnasio no la dice nadie.
--
-- 2. `peso_muerto_rigidas` "Peso muerto piernas rígidas" → "Peso muerto stiff"
-- 3. `subida_cajon`        "Subida al cajón"      → "Step up"
-- 4. `encogimientos`       "Encogimientos"        → "Shrugs"
-- 5. `giros_rusos`         "Giros rusos"          → "Russian twist"
--    Los cuatro son lo mismo: existe la palabra en español, existe el nombre
--    que se usa, y no son el mismo. "Encogimientos" es incluso correcto y
--    perfectamente inútil para encontrarlo en una lista.
--
-- 6. `sentadilla_smith`    "Sentadilla en multipower" → "Sentadilla en Smith"
--    "Multipower" es una MARCA de máquina; "Smith" es el nombre del aparato.
--
-- 7. `fondos`              "Fondos"               → "Fondos en paralelas"
--    Había dos "fondos" en el catálogo —este y `fondos_banco`— y el genérico
--    no decía cuál era. Ahora los dos dicen dónde se hacen.
--
-- 8. `flexiones`           "Flexiones de brazos"  → "Flexiones"
--    Nadie dice "de brazos". Y el nombre corto es el que se busca.
--
-- 9.  `aperturas`          "Aperturas"            → "Aperturas con mancuernas"
-- 10. `pec_deck`           "Contractora (pec deck)" → "Peck deck"
--    ESTE ES EL QUE ORIGINÓ EL PEDIDO, y de paso aclara una confusión que
--    estaba en el catálogo. Son DOS ejercicios distintos: `aperturas` se hace
--    con mancuernas en un banco y `pec_deck` es la máquina. Al ver "Aperturas"
--    a secas se esperaba la máquina. Ahora cada uno dice qué es, y la máquina
--    se llama como la llama todo el mundo.
--
-- -------------------------------------------------------------
-- LOS QUE NO CAMBIAN, Y POR QUÉ
-- -------------------------------------------------------------
-- Se miraron los dos que quedaban en duda y se dejan como están, con el mismo
-- criterio: **el nombre que la gente usa de verdad**.
--
--   * `patada_gluteo` "Patada de glúteo en polea". En español "patada de
--     glúteo" es lo que se dice; "kickback" se usa mucho más para tríceps, así
--     que cambiarlo cruzaría los dos ejercicios en vez de aclarar.
--   * `abdominales_polea` "Abdominales en polea". "Crunch en polea" sería más
--     preciso y no es lo que se escucha. Además el catálogo ya tiene `crunch`
--     aparte, y dos "crunch" se distinguirían solo por la cola del nombre.
--
-- Tampoco se tocan los que YA están como se dicen: hip thrust, face pull, rack
-- pull, remo Pendlay, press Arnold, dead bug, press Pallof, press francés,
-- curl predicador.

update public.ejercicios set nombre = 'Good morning'              where id = 'buenos_dias';
update public.ejercicios set nombre = 'Peso muerto stiff'         where id = 'peso_muerto_rigidas';
update public.ejercicios set nombre = 'Step up'                   where id = 'subida_cajon';
update public.ejercicios set nombre = 'Shrugs'                    where id = 'encogimientos';
update public.ejercicios set nombre = 'Russian twist'             where id = 'giros_rusos';
update public.ejercicios set nombre = 'Sentadilla en Smith'       where id = 'sentadilla_smith';
update public.ejercicios set nombre = 'Fondos en paralelas'       where id = 'fondos';
update public.ejercicios set nombre = 'Flexiones'                 where id = 'flexiones';
update public.ejercicios set nombre = 'Aperturas con mancuernas'  where id = 'aperturas';
update public.ejercicios set nombre = 'Peck deck'                 where id = 'pec_deck';

-- -------------------------------------------------------------
-- LA VERSIÓN DEL ESQUEMA
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 48; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
