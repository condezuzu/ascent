-- COMPROBAR LA MIGRACIÓN 65. Se corre en el SQL Editor después de aplicarla.
-- Tiene que dar UNA fila: version 65, marcas 0 (nadie marcó nada todavía),
-- con_regla true, dueno_puede true, anon_puede false.
-- Esta consulta la corre también `test:db`: no se entrega escrita de memoria.
select public.version_del_esquema() as version,
       (select count(*) from public.subidas_marcadas) as marcas,
       (select relrowsecurity from pg_class where oid = 'public.subidas_marcadas'::regclass) as con_regla,
       has_function_privilege('authenticated', 'public.marcar_subida(text, text, numeric, int, date)', 'execute') as dueno_puede,
       has_function_privilege('anon', 'public.marcar_subida(text, text, numeric, int, date)', 'execute') as anon_puede;
