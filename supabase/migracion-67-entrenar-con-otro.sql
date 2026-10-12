-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 67 then
    raise exception 'Esta es la migración 67 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 67 — ENTRENAR CON OTRO (de a dos), Y TRES COSAS CHICAS
--
-- 1. Unirse al entrenamiento de un amigo y verse en vivo: ejercicio, serie y
--    descanso. Dos tablas nuevas y seis funciones.
-- 2. `me_muestra_su_rutina`: para que el perfil de un amigo distinga "la
--    escondió" de "no hay datos".
-- 3. INCLUYE LA 66 (la mejor racha en la vista pública). Si la 66 ya se pegó,
--    repetirla no cambia nada; si no, no hace falta pegarla aparte.
--
-- No reescribe ningún dato. La app vieja no se entera: no llama a nada de esto.

do $$
begin
  if public.version_del_esquema() < 65 then
    raise exception 'La migración 67 va después de la 65 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

-- (la vista es copia exacta de schema.sql; es la migración 66)
create or replace view public.usuarios_publicos
with (security_invoker = off) as
  -- `mejor_racha` (migración 66): para la medalla del rango más alto que
  -- alcanzó cada uno, en Ranking. Es tan pública como la racha de hoy.
  select id, username, avatar_url, racha_actual, rango_actual, mejor_racha
  from public.profiles p
  where username is not null
    and not exists (
      select 1 from public.bloqueos b
       where (b.bloqueador = auth.uid() and b.bloqueado = p.id)
          or (b.bloqueador = p.id and b.bloqueado = auth.uid())
    );

grant select on public.usuarios_publicos to authenticated;

-- (lo que sigue es copia exacta de schema.sql)
-- -------------------------------------------------------------
-- ENTRENAR CON OTRO (migración 67) — la versión chica, de a dos
-- -------------------------------------------------------------
-- Uno pide unirse al entrenamiento de un amigo; si acepta, mientras dure cada
-- uno ve del otro EN QUÉ EJERCICIO ESTÁ, QUÉ SERIE y CUÁNDO TERMINA SU DESCANSO.
-- Nunca los pesos ni cuánto lleva: no hay columna donde ponerlos.
--
-- Son dos tablas sin acceso directo: se entra y se lee por las funciones.

-- LO QUE ESTOY HACIENDO AHORA. Una fila por persona, que su teléfono pisa.
create table if not exists public.en_vivo (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ejercicio text,
  serie int not null default 0,
  meta int not null default 0,
  -- Cuándo termina el descanso, EN EL RELOJ DE LA BASE: el teléfono manda
  -- cuánto falta y no una hora, porque dos teléfonos no tienen la misma.
  descanso_fin timestamptz,
  actualizado timestamptz not null default now()
);
alter table public.en_vivo enable row level security;

-- EL VÍNCULO ENTRE DOS. Uno por par, y vence solo: sin cron ni limpieza.
create table if not exists public.entrenos_compartidos (
  id uuid primary key default gen_random_uuid(),
  solicitante uuid not null references public.profiles(id) on delete cascade,
  destinatario uuid not null references public.profiles(id) on delete cascade,
  estado text not null default 'pendiente',
  creado timestamptz not null default now(),
  hasta timestamptz not null,
  constraint entrenos_estado_valido check (estado in ('pendiente', 'aceptada')),
  constraint entrenos_no_con_uno_mismo check (solicitante <> destinatario)
);
create unique index if not exists entrenos_par_unico on public.entrenos_compartidos
  (least(solicitante, destinatario), greatest(solicitante, destinatario));
alter table public.entrenos_compartidos enable row level security;

-- PEDIR UNIRSE. Solo a un amigo. Si el otro ya me lo había pedido a mí, pedir
-- es aceptar. Repetirlo no hace nada: se puede reintentar.
create or replace function public.pedir_unirse(p_a uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_a is null or p_a = uid or not public.son_amigos(uid, p_a) then return; end if;
  delete from entrenos_compartidos
   where least(solicitante, destinatario) = least(uid, p_a)
     and greatest(solicitante, destinatario) = greatest(uid, p_a)
     and hasta <= now();
  update entrenos_compartidos set estado = 'aceptada', hasta = now() + interval '3 hours'
   where solicitante = p_a and destinatario = uid;
  if found then return; end if;
  insert into entrenos_compartidos (solicitante, destinatario, hasta)
       values (uid, p_a, now() + interval '3 hours')
  on conflict do nothing;
end;
$$;

-- CONTESTAR. Solo quien la recibió. Decir que no la borra: el otro puede volver a pedir.
create or replace function public.responder_union(p_id uuid, p_acepta boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if coalesce(p_acepta, false) then
    update entrenos_compartidos set estado = 'aceptada', hasta = now() + interval '3 hours'
     where id = p_id and destinatario = uid and estado = 'pendiente' and hasta > now();
  else
    delete from entrenos_compartidos where id = p_id and destinatario = uid and estado = 'pendiente';
  end if;
end;
$$;

-- SALIR de lo que tengo con UNA persona (cualquiera de los dos, pedido o aceptado).
create or replace function public.salir_de_union(p_otro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_otro is null then return; end if;
  delete from entrenos_compartidos
   where (solicitante = uid and destinatario = p_otro) or (solicitante = p_otro and destinatario = uid);
end;
$$;

-- PUBLICAR LO QUE ESTOY HACIENDO. Idempotente: pisa la fila. Los números se
-- acotan acá: lo que llega del teléfono no se cree.
create or replace function public.publicar_en_vivo(p_ejercicio text, p_serie int, p_meta int, p_descanso_faltan int)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  insert into en_vivo (user_id, ejercicio, serie, meta, descanso_fin, actualizado)
       values (
         uid,
         case when p_ejercicio is not null and exists (select 1 from ejercicios where id = p_ejercicio) then p_ejercicio end,
         least(99, greatest(0, coalesce(p_serie, 0))),
         least(99, greatest(0, coalesce(p_meta, 0))),
         case when p_descanso_faltan is not null and p_descanso_faltan > 0
              then now() + make_interval(secs => least(p_descanso_faltan, 3600)) end,
         now())
  on conflict (user_id) do update
     set ejercicio = excluded.ejercicio, serie = excluded.serie, meta = excluded.meta,
         descanso_fin = excluded.descanso_fin, actualizado = now();
end;
$$;

-- TERMINÉ DE ENTRENAR: dejo de aparecer, se va lo que publiqué y se cortan mis
-- vínculos. El otro sigue con su entrenamiento; solo deja de verme.
create or replace function public.dejar_de_entrenar()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  delete from en_vivo where user_id = uid;
  delete from entrenos_compartidos where solicitante = uid or destinatario = uid;
  delete from en_el_gimnasio where user_id = uid;
end;
$$;

-- LO QUE VE MI PANTALLA: mis vínculos vigentes, con quién, quién pidió, y —solo
-- si está aceptado y seguimos siendo amigos— lo que el otro publicó. `ahora` es
-- el reloj de la base: con eso el teléfono hace la cuenta del descanso sin
-- depender del suyo.
create or replace function public.mis_uniones()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'estado', c.estado,
           'la_pedi_yo', c.solicitante = auth.uid(),
           'otro', jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url),
           'ahora', now(),
           'en_vivo', case when c.estado = 'aceptada' then (
             select jsonb_build_object(
                      'ejercicio', v.ejercicio, 'serie', v.serie, 'meta', v.meta,
                      'descanso_fin', v.descanso_fin, 'actualizado', v.actualizado)
               from en_vivo v where v.user_id = u.id) end
         ) order by c.creado), '[]'::jsonb)
    from entrenos_compartidos c
    join usuarios_publicos u
      on u.id = case when c.solicitante = auth.uid() then c.destinatario else c.solicitante end
   where auth.uid() in (c.solicitante, c.destinatario)
     and c.hasta > now()
     and public.son_amigos(c.solicitante, c.destinatario);
$$;

-- ¿ESTA PERSONA ME MUESTRA SU RUTINA? Para que el perfil de un amigo pueda
-- distinguir "la escondió" (no se dibuja nada) de "no hay datos" (se explica).
-- Solo contesta que sí a un amigo: a cualquier otro le dice que no.
create or replace function public.me_muestra_su_rutina(p_quien uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.comparte_rutina from profiles p
     where p.id = p_quien and (p_quien = auth.uid() or public.son_amigos(auth.uid(), p_quien))
  ), false);
$$;

revoke execute on function public.pedir_unirse(uuid), public.responder_union(uuid, boolean), public.salir_de_union(uuid),
  public.publicar_en_vivo(text, int, int, int), public.dejar_de_entrenar(), public.mis_uniones(),
  public.me_muestra_su_rutina(uuid) from public, anon;
grant execute on function public.pedir_unirse(uuid), public.responder_union(uuid, boolean), public.salir_de_union(uuid),
  public.publicar_en_vivo(text, int, int, int), public.dejar_de_entrenar(), public.mis_uniones(),
  public.me_muestra_su_rutina(uuid) to authenticated;

-- La versión sube a 67.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 67; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
