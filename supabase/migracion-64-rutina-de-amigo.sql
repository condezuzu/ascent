-- MIGRACIÓN 64 — LA RUTINA QUE VE UN AMIGO, Y EL INTERRUPTOR PARA ESCONDERLA
--
-- Un amigo, desde tu perfil, ve qué ejercicios hiciste cada día de las últimas
-- cuatro semanas, y cuántas series de cada uno. Ni pesos ni duración.
-- Por omisión se ve; se apaga en Ajustes (`comparte_rutina`).
--
-- Va ANTES de la OTA que la usa. La app vieja no se entera: no llama a nada de esto.

do $$
begin
  if public.version_del_esquema() < 63 then
    raise exception 'La migración 64 va después de la 63 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

alter table public.profiles add column if not exists comparte_rutina boolean not null default true;

-- (las dos funciones son copia exacta de schema.sql)
-- LA RUTINA QUE VE UN AMIGO (migración 64). Qué ejercicios hizo cada día de las
-- últimas cuatro semanas, en orden, y cuántas series de cada uno. NADA MÁS: ni
-- pesos, ni cuánto duró ni a qué hora. `sesiones` sigue siendo solo del dueño
-- (§17.8) —competir por tiempo de gimnasio empuja a entrenar de más—; esto es
-- una ventana chica sobre ella, y la persona la puede cerrar
-- (`profiles.comparte_rutina`).
create or replace function public.fijar_comparte_rutina(p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  update profiles set comparte_rutina = coalesce(p_valor, true) where id = uid;
end;
$$;

create or replace function public.rutina_de_amigo(p_quien uuid)
returns table (fecha date, bloques jsonb)
language sql stable security definer set search_path = public as $$
  select l.fecha,
         -- Se arma de nuevo con SOLO esas dos claves: el bloque guardado lleva
         -- además los pesos, y esos no salen de acá.
         (select jsonb_agg(jsonb_build_object('ejercicio', b.value ->> 'ejercicio', 'series', b.value -> 'series') order by b.ordinality)
            from jsonb_array_elements(s.bloques) with ordinality b
           where coalesce(b.value ->> 'ejercicio', '') <> '')
    from sesiones s
    join logs l on l.id = s.log_id
    join profiles p on p.id = s.user_id
   where s.user_id = p_quien
     and auth.uid() is not null
     and s.estado = 'terminada'
     and jsonb_array_length(s.bloques) > 0
     and l.fecha >= current_date - 28
     and (p_quien = auth.uid() or (p.comparte_rutina and public.son_amigos(auth.uid(), p_quien)))
   order by l.fecha desc, s.inicio desc;
$$;
revoke execute on function public.fijar_comparte_rutina(boolean), public.rutina_de_amigo(uuid) from public, anon;
grant execute on function public.fijar_comparte_rutina(boolean), public.rutina_de_amigo(uuid) to authenticated;

-- La versión sube a 64.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 64; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
