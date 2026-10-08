-- COMPROBAR LA MIGRACIÓN 64. Se corre en el SQL Editor después de aplicarla.
-- Tiene que dar UNA fila: version 64, comparten = perfiles (nadie nace con la
-- rutina escondida), amigos_pueden true, anon_puede false.
-- Esta consulta la corre también `test:db` (sección 197): no se entrega escrita de memoria.
select public.version_del_esquema() as version,
       (select count(*) from public.profiles where comparte_rutina) as comparten,
       (select count(*) from public.profiles) as perfiles,
       has_function_privilege('authenticated', 'public.rutina_de_amigo(uuid)', 'execute') as amigos_pueden,
       has_function_privilege('anon', 'public.rutina_de_amigo(uuid)', 'execute') as anon_puede;
