-- =============================================================
-- MIGRACIÓN 35 — el aviso de las 20:30 cuando no fuiste
--
-- Va DESPUÉS de la 34. Ejecutar entera en el SQL Editor de Supabase.
--
-- ADITIVA: una tabla nueva y tres funciones nuevas. No toca nada de lo que
-- existe, así que se puede correr antes o después del deploy.
-- =============================================================

-- -------------------------------------------------------------
-- 1. LAS SUSCRIPCIONES
-- -------------------------------------------------------------
-- Una por APARATO, no por cuenta: el mismo usuario puede tener el aviso
-- prendido en el teléfono y apagado en la computadora, y los dos tienen
-- direcciones distintas. Por eso la clave es el `endpoint`, que es la dirección
-- que el servicio de push del navegador le dio a ese aparato.
--
-- `ultimo_aviso` es lo que garantiza "uno por día, nunca dos". El cron de
-- Vercel puede reintentar, y un reintento no puede mandarte el mismo aviso
-- dos veces: la base anota el día ANTES de que se mande.
create table if not exists public.suscripciones_push (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creado timestamptz not null default now(),
  ultimo_aviso date,
  constraint suscripciones_endpoint_https check (endpoint like 'https://%'),
  constraint suscripciones_claves_cortas check (length(p256dh) < 200 and length(auth) < 100)
);

create index if not exists suscripciones_push_por_usuario on public.suscripciones_push (user_id);

alter table public.suscripciones_push enable row level security;

-- El dueño ve las suyas, y nada más. Escribir va por las funciones de abajo:
-- así el `user_id` lo pone la base y no el cliente.
drop policy if exists "suscripciones: solo dueño" on public.suscripciones_push;
create policy "suscripciones: solo dueño" on public.suscripciones_push for select
  using (user_id = auth.uid());

grant select on public.suscripciones_push to authenticated;

-- -------------------------------------------------------------
-- 2. PRENDER Y APAGAR, desde el teléfono
-- -------------------------------------------------------------
-- Guardar es idempotente: prender el aviso dos veces en el mismo aparato
-- actualiza la fila en vez de duplicarla. Y si el aparato estaba a nombre de
-- OTRA cuenta —un teléfono prestado— pasa a ser de la que lo prendió ahora: el
-- aviso le llega a quien tiene el teléfono en la mano.
create or replace function public.guardar_suscripcion_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  insert into suscripciones_push (endpoint, user_id, p256dh, auth)
  values (p_endpoint, uid, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth;
end;
$$;

-- Apagar solo borra lo propio: con el endpoint de otro no hace nada.
create or replace function public.borrar_suscripcion_push(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from suscripciones_push where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke execute on function public.guardar_suscripcion_push(text, text, text) from public, anon;
grant execute on function public.guardar_suscripcion_push(text, text, text) to authenticated;
revoke execute on function public.borrar_suscripcion_push(text) from public, anon;
grant execute on function public.borrar_suscripcion_push(text) to authenticated;

-- -------------------------------------------------------------
-- 3. A QUIÉN AVISARLE HOY — solo para el servidor
-- -------------------------------------------------------------
-- La llama la ruta del cron con la clave de servicio. NO la puede llamar
-- ningún usuario: devuelve direcciones de push de otra gente.
--
-- A QUIÉN SÍ: a quien prendió el aviso, en un día que no registró, que no es
-- de descanso, y que no tiene un día esperando confirmación de la guarda del
-- gimnasio —ese fue, solo que todavía no se sabe—.
--
-- Y la marca: devuelve las filas Y anota `ultimo_aviso = hoy` en la misma
-- sentencia. Si el cron corre dos veces, la segunda no encuentra a nadie.
create or replace function public.tomar_avisos_del_dia()
returns table (endpoint text, p256dh text, auth text, racha int)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidatos as (
    select s.endpoint
      from suscripciones_push s
      join profiles p on p.id = s.user_id
     where (s.ultimo_aviso is null or s.ultimo_aviso < hoy_de(s.user_id))
       and not exists (
         select 1 from logs l where l.user_id = s.user_id and l.fecha = hoy_de(s.user_id)
       )
       and not (extract(dow from hoy_de(s.user_id))::int = any(descansos_vigentes(s.user_id, hoy_de(s.user_id))))
       and (p.dia_pendiente is null or p.dia_pendiente <> hoy_de(s.user_id))
  )
  update suscripciones_push s
     set ultimo_aviso = hoy_de(s.user_id)
    from candidatos c, profiles p
   where s.endpoint = c.endpoint and p.id = s.user_id
  returning s.endpoint, s.p256dh, s.auth, p.racha_actual;
end;
$$;

-- El servicio de push dice que esa dirección ya no existe —desinstalaron la
-- app, borraron los datos, revocaron el permiso—: se borra, para no
-- intentarlo todos los días para siempre.
create or replace function public.olvidar_suscripcion_push(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from suscripciones_push where endpoint = p_endpoint;
$$;

revoke execute on function public.tomar_avisos_del_dia() from public, anon, authenticated;
grant execute on function public.tomar_avisos_del_dia() to service_role;
revoke execute on function public.olvidar_suscripcion_push(text) from public, anon, authenticated;
grant execute on function public.olvidar_suscripcion_push(text) to service_role;
