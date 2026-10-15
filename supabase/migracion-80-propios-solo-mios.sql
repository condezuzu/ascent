-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 80 then
    raise exception 'Esta es la migración 80 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 80 — LOS EJERCICIOS PROPIOS LOS VE SOLO QUIEN LOS CREÓ
--
-- Cambia la decisión de la 76 (los veían también los amigos), por pedido del
-- humano el 15/10/2026. Solo la política de lectura: no toca ninguna fila. Un
-- amigo que ve una sesión o una rutina con un propio tuyo ve "Ejercicio propio"
-- en lugar del nombre (lo resuelve la app). El que ya había elegido un propio
-- tuyo y lo tiene en su rutina o en una sesión lo sigue viendo, solo ese.

do $$
begin
  if public.version_del_esquema() < 79 then
    raise exception 'La migración 80 va después de la 79 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

drop policy if exists "ejercicios: catálogo con sesión" on public.ejercicios;
-- EL PROPIO AJENO QUE YA USO (cacería del 15/10). Antes de la 80 se podía elegir el
-- propio de un amigo y ponerlo en la rutina o en una sesión. Ese se sigue viendo:
-- si no, la rutina y el historial quedan con un id sin nombre. No reescribe filas.
create or replace function public.ejercicio_que_uso(p_id text)
returns boolean language sql stable security definer set search_path = public as $f$
  select exists (
           select 1 from rutinas r
            where r.user_id = auth.uid()
              and jsonb_path_exists(r.dias, '$[*].ejercicios[*] ? (@.ejercicio == $id)', jsonb_build_object('id', p_id))
         )
      or exists (
           select 1 from sesiones s
            where s.user_id = auth.uid()
              and s.bloques @> jsonb_build_array(jsonb_build_object('ejercicio', p_id))
         );
$f$;
revoke execute on function public.ejercicio_que_uso(text) from public, anon;
grant execute on function public.ejercicio_que_uso(text) to authenticated;

create policy "ejercicios: catálogo con sesión" on public.ejercicios for select
  using (auth.uid() is not null and (creado_por is null or creado_por = auth.uid() or public.ejercicio_que_uso(id)));

do $$
begin
  if public.version_del_esquema() < 80 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 80; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
