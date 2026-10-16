-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 89 then
    raise exception 'Esta es la migración 89 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 89 — EL STORAGE CON TOPE (15/10)
--
-- Los dos buckets aceptaban cualquier cosa: en `fotos` había un .bin de 8 MB y un
-- .sh. Cualquiera con cuenta podía llenar el almacenamiento. Ahora: 3 MB por
-- archivo y solo JPG y PNG. Lo que sube la app es JPG de 1600 px como mucho
-- (unos 400 KB; el más pesado posible ronda 1,5 MB) o la miniatura de 400 px.
-- No toca ningún archivo: es la regla para los que vengan.

do $$
begin
  if public.version_del_esquema() < 88 then
    raise exception 'La migración 89 va después de la 88 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- Con guarda: en Supabase `storage.buckets` existe siempre; la base de prueba
-- (PGlite, `test:deriva`) no tiene storage.
do $tope$
begin
  if to_regclass('storage.buckets') is not null then
    execute $sql$
      update storage.buckets
      set file_size_limit = 3145728,
          allowed_mime_types = array['image/jpeg', 'image/png']
      where id in ('fotos', 'avatares')
    $sql$;
  end if;
end $tope$;

do $$
begin
  if public.version_del_esquema() < 89 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 89; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
