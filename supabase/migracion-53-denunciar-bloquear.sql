-- =============================================================
-- MIGRACIÓN 53 — DENUNCIAR Y BLOQUEAR (contenido de usuarios)
--
-- POR QUÉ. La app muestra contenido de una persona a otra —nombre, avatar y,
-- entre amigos, días y fotos—. La guía 1.2 de Apple exige, para eso, poder
-- DENUNCIAR contenido y BLOQUEAR a alguien; hoy no existe ninguna de las dos.
-- Y más allá de Apple: hoy cualquiera puede mandarte solicitudes de amistad
-- para siempre y no hay forma de pararlo. Esto lo arregla en la BASE (RLS), no
-- escondiendo cosas en la pantalla.
--
-- QUÉ TRAE:
--   - `bloqueos`: quién bloqueó a quién. Bloquear corta la amistad, borra las
--     solicitudes en las dos direcciones, impide nuevas (por policy), y los saca
--     del ranking, del buscador y de la vista del otro (por RLS/vista/función).
--   - `reportes`: una denuncia = denunciante + denunciado + motivo (de una lista
--     corta, no texto libre). Tabla propia y NO el buzón de errores: una denuncia
--     hay que leerla y actuar; se lee desde el dashboard de Supabase, como el
--     feedback.
--   - RPCs: `bloquear`, `desbloquear`, `mis_bloqueados`, `denunciar`.
--
-- CÓMO SE APLICA (SQL Editor de Supabase, todo de una). Después, en la máquina:
-- `npm run test:conexion` tiene que quedar VERDE (prod pasa a la versión 53,
-- igual que el repo, que ya trae estos objetos en schema.sql).
--
-- PASA DE 52 A 53. La racha por replay, que había reservado el 53, se difirió a
-- 1.0.1 y se renumerará cuando se haga (ver spec/diagnostico-replay-racha.md).
-- =============================================================

-- -------------------------------------------------------------
-- BLOQUEOS
-- -------------------------------------------------------------
create table public.bloqueos (
  bloqueador uuid not null references public.profiles(id) on delete cascade,
  bloqueado  uuid not null references public.profiles(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (bloqueador, bloqueado),
  check (bloqueador <> bloqueado)
);
-- Para el chequeo "¿me bloquearon?" en el sentido inverso (buscar por bloqueado).
create index bloqueos_por_bloqueado on public.bloqueos (bloqueado);

alter table public.bloqueos enable row level security;
-- Sin acceso directo del cliente: todo pasa por los RPC (bloquear borra además
-- la amistad y los retos, y no queremos que el cliente escriba filas sueltas).

-- -------------------------------------------------------------
-- REPORTES (denuncias)
-- -------------------------------------------------------------
-- Una fila por par denunciante→denunciado (la última gana): así una persona no
-- puede inflar la lista denunciando mil veces al mismo, y siempre se ve el
-- motivo más reciente. El motivo sale de una lista cerrada, no de texto libre.
create table public.reportes (
  denunciante uuid not null references public.profiles(id) on delete cascade,
  denunciado  uuid not null references public.profiles(id) on delete cascade,
  motivo text not null check (motivo in ('spam','acoso','inapropiado','suplantacion','otro')),
  creado timestamptz not null default now(),
  primary key (denunciante, denunciado),
  check (denunciante <> denunciado)
);
create index reportes_por_denunciado on public.reportes (denunciado);

alter table public.reportes enable row level security;
-- Nadie lee reportes desde el cliente: los lee el dueño desde el dashboard,
-- igual que el feedback. Se escriben por el RPC `denunciar`.

-- -------------------------------------------------------------
-- ¿HAY UN BLOQUEO ENTRE DOS? (en cualquiera de los dos sentidos)
-- -------------------------------------------------------------
-- La llama la policy de "amistad: pedir" (evaluada como el usuario), así que
-- necesita execute; para que no sea una sonda —averiguar si dos ajenos se
-- bloquearon— solo contesta cuando el que pregunta es una de las dos puntas,
-- igual que son_amigos (migración 41).
create or replace function public.hay_bloqueo(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() in (a, b) and exists (
    select 1 from bloqueos
     where (bloqueador = a and bloqueado = b)
        or (bloqueador = b and bloqueado = a)
  );
$$;
revoke execute on function public.hay_bloqueo(uuid, uuid) from public, anon;
grant execute on function public.hay_bloqueo(uuid, uuid) to authenticated;

-- -------------------------------------------------------------
-- son_amigos AHORA RESPETA EL BLOQUEO. La amistad se borra al bloquear, así que
-- normalmente ya no habría fila; este `and not hay_bloqueo` es el cinturón y los
-- tirantes: aunque quedara una amistad suelta, un bloqueo corta el acceso a logs
-- y fotos (que se apoyan en esta función) a nivel RLS.
-- -------------------------------------------------------------
create or replace function public.son_amigos(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and auth.uid() in (a, b)
    and not public.hay_bloqueo(a, b)
    and exists (
      select 1 from friendships
      where estado = 'aceptada'
        and ((solicitante = a and destinatario = b) or (solicitante = b and destinatario = a))
    );
$$;

-- -------------------------------------------------------------
-- EL BUSCADOR NO MUESTRA A LOS BLOQUEADOS (en los dos sentidos). La vista lee
-- auth.uid() aunque corra como su dueño: el que busca no ve a quien bloqueó ni a
-- quien lo bloqueó, y viceversa.
-- -------------------------------------------------------------
create or replace view public.usuarios_publicos
with (security_invoker = off) as
  select id, username, avatar_url, racha_actual, rango_actual
  from public.profiles p
  where username is not null
    and not exists (
      select 1 from public.bloqueos b
       where (b.bloqueador = auth.uid() and b.bloqueado = p.id)
          or (b.bloqueador = p.id and b.bloqueado = auth.uid())
    );
grant select on public.usuarios_publicos to authenticated;

-- -------------------------------------------------------------
-- NO SE PUEDE PEDIR AMISTAD SI HAY BLOQUEO (en cualquier sentido). Es la mitad
-- del pedido del humano: bloquear tiene que IMPEDIR nuevas solicitudes, no solo
-- borrar la amistad vieja. A nivel RLS, no de pantalla.
-- -------------------------------------------------------------
drop policy "amistad: pedir" on public.friendships;
create policy "amistad: pedir" on public.friendships for insert
  with check (
    auth.uid() = solicitante
    and estado = 'pendiente'
    and not public.hay_bloqueo(solicitante, destinatario)
  );

-- -------------------------------------------------------------
-- BLOQUEAR. Crea el bloqueo, borra la amistad en las dos direcciones (cualquier
-- estado: también una solicitud pendiente) y cierra el reto vigente. Es lo mismo
-- que eliminar_amigo + registrar el bloqueo, en una sola operación.
-- -------------------------------------------------------------
create or replace function public.bloquear(p_otro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_otro is null or uid = p_otro then return; end if;
  insert into bloqueos (bloqueador, bloqueado) values (uid, p_otro)
    on conflict (bloqueador, bloqueado) do nothing;
  delete from friendships
   where (solicitante = uid and destinatario = p_otro)
      or (solicitante = p_otro and destinatario = uid);
  delete from challenges
   where estado in ('pendiente', 'activo')
     and ((retador = uid and rival = p_otro) or (retador = p_otro and rival = uid));
end;
$$;
revoke execute on function public.bloquear(uuid) from public, anon;
grant execute on function public.bloquear(uuid) to authenticated;

-- DESBLOQUEAR. Solo saca la fila de bloqueo; no recompone la amistad (si se
-- quieren volver a agregar, uno pide y el otro acepta, como cualquiera).
create or replace function public.desbloquear(p_otro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_otro is null then return; end if;
  delete from bloqueos where bloqueador = uid and bloqueado = p_otro;
end;
$$;
revoke execute on function public.desbloquear(uuid) from public, anon;
grant execute on function public.desbloquear(uuid) to authenticated;

-- MIS BLOQUEADOS, para la pantalla de Ajustes. Lee `profiles` directo (y no
-- `usuarios_publicos`) a propósito: la vista justamente esconde a los bloqueados,
-- así que para LISTARLOS hay que saltearla, cosa que este SECURITY DEFINER puede.
create or replace function public.mis_bloqueados()
returns table (id uuid, username text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_url
    from bloqueos b
    join profiles p on p.id = b.bloqueado
   where b.bloqueador = auth.uid()
   order by b.creado desc;
$$;
revoke execute on function public.mis_bloqueados() from public, anon;
grant execute on function public.mis_bloqueados() to authenticated;

-- DENUNCIAR. Registra denunciante→denunciado con un motivo de la lista. Una por
-- par (la última gana). El dueño la lee desde el dashboard.
create or replace function public.denunciar(p_denunciado uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_denunciado is null or uid = p_denunciado then return; end if;
  if p_motivo is null or p_motivo not in ('spam','acoso','inapropiado','suplantacion','otro') then
    raise exception 'motivo inválido';
  end if;
  insert into reportes (denunciante, denunciado, motivo)
    values (uid, p_denunciado, p_motivo)
    on conflict (denunciante, denunciado) do update
      set motivo = excluded.motivo, creado = now();
end;
$$;
revoke execute on function public.denunciar(uuid, text) from public, anon;
grant execute on function public.denunciar(uuid, text) to authenticated;

-- Las dos tablas: sin acceso directo del cliente (todo por los RPC de arriba).
revoke all on table public.bloqueos, public.reportes from anon, authenticated;

-- -------------------------------------------------------------
-- VERSIÓN DEL ESQUEMA → 53
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 53; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
