-- NO SE VUELVE A CORRER SOBRE UNA BASE MÁS NUEVA (regla del 12/10/2026). Pegar esta
-- migración encima de una posterior bajaba `version_del_esquema()` y apagaba
-- funciones en todos los teléfonos, sin un solo error a la vista.
do $guarda$
declare v int;
begin
  if to_regprocedure('public.version_del_esquema()') is null then return; end if;
  execute 'select public.version_del_esquema()' into v;
  if v > 88 then
    raise exception 'Esta es la migración 88 y la base ya está en la %: no se vuelve a correr.', v;
  end if;
end $guarda$;

-- MIGRACIÓN 88 — ENTRENAR EN GRUPO (el multijugador completo)
--
-- Hasta acá se entrenaba de a dos: un vínculo por par. Ahora es un GRUPO de hasta
-- 10, y cada persona está en uno solo a la vez. Decidido por el humano (15/10):
--   - entra alguien nuevo si lo acepta CUALQUIERA de los que ya están adentro;
--   - echa solo quien armó el grupo, que es el que lleva más tiempo adentro: si se
--     va, el poder pasa solo al siguiente (no hay columna "dueño": es el más viejo);
--   - el link del grupo agrega como amigo al que entra y lo une, en un paso.
-- Un miembro cuenta tres horas, o más si sigue entrenando; el que se fue sin
-- "Terminar" se cae solo (ver miembro_vivo).
--
-- LA APP DE LA TIENDA SIGUE ANDANDO: las funciones de siempre (pedir_unirse,
-- responder_union, salir_de_union, mis_uniones) conservan nombre y forma. Para
-- ella, un grupo es una lista de "uniones" aceptadas, una por compañero.
--
-- TIEMPO REAL: los del grupo pueden leer `en_vivo` y `grupo_miembros` de su grupo
-- (y nada más), y las dos tablas entran a la publicación de Realtime: la app se
-- suscribe a los cambios en vez de preguntar cada 10 segundos.
--
-- REESCRIBE DATOS: los pares aceptados que siguen vivos pasan a ser grupos de dos,
-- y las filas "aceptada" de `entrenos_compartidos` se borran. Son vínculos de horas.

do $$
begin
  if public.version_del_esquema() < 87 then
    raise exception 'La migración 88 va después de la 87 (la base está en %).', public.version_del_esquema();
  end if;
end $$;

create table if not exists public.grupos_entreno (
  id uuid primary key default gen_random_uuid(),
  -- Para el link de invitación: corto, sin significado y sin la hora.
  codigo text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  creado timestamptz not null default now()
);
alter table public.grupos_entreno enable row level security;

create table if not exists public.grupo_miembros (
  -- Una fila por persona: nadie está en dos grupos.
  user_id uuid primary key references public.profiles(id) on delete cascade,
  grupo_id uuid not null references public.grupos_entreno(id) on delete cascade,
  entro timestamptz not null default clock_timestamp(),
  -- Desempata a los que entraron en el mismo instante: el orden de llegada.
  n bigint generated always as identity
);
create index if not exists grupo_miembros_grupo on public.grupo_miembros (grupo_id);
alter table public.grupo_miembros enable row level security;

create or replace function public.tope_grupo()
returns int language sql immutable as $$ select 10; $$;

-- ¿Sigue entrenando? Lo mismo que mira "Entrenando ahora": una sesión viva.
create or replace function public.entrena_ahora(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sesiones s
     where s.user_id = p_user and s.estado = 'corriendo'
       and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
  );
$$;

-- ¿Sigue en el grupo? Como el par de antes (vinculo_vivo): tres horas desde que entró, o
-- más si sigue entrenando; y nunca si dejó una sesión que la base ya no da por viva.
-- Quien todavía no empezó y solo mira, cuenta.
create or replace function public.miembro_vivo(p_user uuid, p_entro timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select (p_entro > now() - interval '3 hours' or public.entrena_ahora(p_user))
     and not exists (
       select 1 from sesiones s
        where s.user_id = p_user and s.estado = 'corriendo'
          and not public.sesion_sigue_viva(s.inicio, s.ultima_actividad)
     );
$$;

-- Saca a los que ya no entrenan y borra los grupos vacíos. Se llama al entrar a
-- cualquier función de grupo: no hace falta un trabajo nocturno.
create or replace function public.limpiar_grupos()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from grupo_miembros m where not public.miembro_vivo(m.user_id, m.entro);
  delete from grupos_entreno g where not exists (select 1 from grupo_miembros m where m.grupo_id = g.id);
  -- Los pedidos de quien ya no entrena tampoco sirven.
  delete from entrenos_compartidos e where e.estado = 'pendiente' and e.hasta < now();
end;
$$;

create or replace function public.grupo_de(p_user uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select grupo_id from grupo_miembros where user_id = p_user;
$$;

-- ¿Está en un grupo DE VERDAD? Uno de uno (el que armó el link y nadie entró, o el
-- que quedó solo) no cuenta: no le impide unirse a otro.
create or replace function public.en_grupo(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from grupo_miembros where grupo_id = public.grupo_de(p_user)) >= 2;
$$;

-- ¿Son amigos? Sin mirar quién pregunta: un pedido lo ve todo el grupo.
create or replace function public.amigos_entre(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.hay_bloqueo(a, b)
     and exists (select 1 from friendships where estado = 'aceptada'
                  and least(solicitante, destinatario) = least(a, b) and greatest(solicitante, destinatario) = greatest(a, b));
$$;

-- Quien armó el grupo: el que lleva más tiempo adentro.
create or replace function public.lider_de(p_grupo uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from grupo_miembros where grupo_id = p_grupo order by entro, n limit 1;
$$;

-- Mete a alguien en el grupo de `p_con` (o arma uno con los dos). Devuelve el resultado.
create or replace function public.entrar_al_grupo(p_quien uuid, p_con uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  g uuid := public.grupo_de(p_con);
begin
  if public.en_grupo(p_quien) then return 'ya-unido'; end if;
  -- El que estaba solo deja su grupo de uno.
  delete from grupo_miembros where user_id = p_quien;
  delete from grupos_entreno x where not exists (select 1 from grupo_miembros m where m.grupo_id = x.id);
  if g is null then
    insert into grupos_entreno default values returning id into g;
    insert into grupo_miembros (user_id, grupo_id) values (p_con, g);
  elsif (select count(*) from grupo_miembros where grupo_id = g) >= public.tope_grupo() then
    return 'ocupado';
  end if;
  insert into grupo_miembros (user_id, grupo_id) values (p_quien, g);
  delete from entrenos_compartidos where estado = 'pendiente' and solicitante = p_quien;
  return 'ok';
end;
$$;

-- ¿Ya entrena con alguien? (se mantiene para lo que lo llamaba: ahora mira el grupo)
create or replace function public.entrena_con_otro(p_quien uuid, p_salvo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from grupo_miembros a join grupo_miembros b on b.grupo_id = a.grupo_id
     where a.user_id = p_quien and b.user_id <> p_quien and b.user_id <> p_salvo
  );
$$;

-- PEDIR UNIRSE al entrenamiento de un amigo (y a su grupo, si tiene).
create or replace function public.pedir_unirse(p_a uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sin sesión'; end if;
  if p_a is null or p_a = uid or not public.son_amigos(uid, p_a) then return 'no-entrena'; end if;
  perform public.limpiar_grupos();
  if public.en_grupo(uid) then return 'ya-unido'; end if;
  if public.grupo_de(p_a) is not null
     and (select count(*) from grupo_miembros where grupo_id = public.grupo_de(p_a)) >= public.tope_grupo() then
    return 'ocupado';
  end if;
  -- Él me lo había pedido a mí: con pedirlo de vuelta alcanza para estar juntos.
  if exists (select 1 from entrenos_compartidos where estado = 'pendiente' and solicitante = p_a and destinatario = uid) then
    delete from entrenos_compartidos where estado = 'pendiente' and solicitante = p_a and destinatario = uid;
    return public.entrar_al_grupo(p_a, uid);
  end if;
  if not exists (
       select 1 from sesiones s join profiles p on p.id = s.user_id and p.comparte_gimnasio
        where s.user_id = p_a and s.estado = 'corriendo'
          and public.sesion_sigue_viva(s.inicio, s.ultima_actividad)) then
    return 'no-entrena';
  end if;
  insert into entrenos_compartidos (solicitante, destinatario, hasta)
       values (uid, p_a, now() + interval '3 hours')
  on conflict do nothing;
  return 'ok';
end;
$$;

-- CONTESTAR un pedido: quien lo recibió o cualquiera de su grupo.
create or replace function public.responder_union(p_id uuid, p_acepta boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c entrenos_compartidos;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform public.limpiar_grupos();
  select * into c from entrenos_compartidos
   where id = p_id and estado = 'pendiente'
     and (destinatario = uid or (public.grupo_de(uid) is not null and public.grupo_de(destinatario) = public.grupo_de(uid)));
  if c.id is null then return; end if;
  delete from entrenos_compartidos where id = c.id;
  if not coalesce(p_acepta, false) then return; end if;
  if not public.miembro_vivo(c.solicitante, now()) or not public.miembro_vivo(c.destinatario, now())
     or not public.miembro_vivo(uid, now()) then
    return;
  end if;
  perform public.entrar_al_grupo(c.solicitante, c.destinatario);
end;
$$;

-- SALIR DEL GRUPO. Si me voy yo, el que lleva más tiempo pasa a armar.
create or replace function public.salir_del_grupo()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  delete from grupo_miembros where user_id = uid;
  delete from grupos_entreno g where not exists (select 1 from grupo_miembros m where m.grupo_id = g.id);
end;
$$;

-- La de siempre (la usa la app de la tienda): con un compañero del grupo, salir del
-- grupo; con un pedido, borrarlo.
create or replace function public.salir_de_union(p_otro uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_otro is null then return; end if;
  delete from entrenos_compartidos
   where (solicitante = uid and destinatario = p_otro) or (solicitante = p_otro and destinatario = uid);
  if public.grupo_de(uid) is not null and public.grupo_de(uid) = public.grupo_de(p_otro) then
    perform public.salir_del_grupo();
  end if;
end;
$$;

-- ECHAR: solo quien armó el grupo, y a alguien de su grupo.
create or replace function public.echar_del_grupo(p_quien uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g uuid := public.grupo_de(auth.uid());
begin
  if uid is null or g is null or p_quien is null or p_quien = uid then return false; end if;
  if public.lider_de(g) <> uid or public.grupo_de(p_quien) is distinct from g then return false; end if;
  delete from grupo_miembros where user_id = p_quien;
  return true;
end;
$$;

-- EL LINK DEL GRUPO. Quien entrena y no tiene grupo arma uno (de uno, hasta que alguien entre).
create or replace function public.link_del_grupo()
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g uuid;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform public.limpiar_grupos();
  if not public.entrena_ahora(uid) then return null; end if;
  g := public.grupo_de(uid);
  if g is null then
    insert into grupos_entreno default values returning id into g;
    insert into grupo_miembros (user_id, grupo_id) values (uid, g);
  end if;
  return (select codigo from grupos_entreno where id = g);
end;
$$;

-- ENTRAR POR EL LINK: se hacen amigos con quien armó el grupo y entrás.
create or replace function public.unirse_por_link(p_codigo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  g uuid;
  lider uuid;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  perform public.limpiar_grupos();
  select id into g from grupos_entreno where codigo = p_codigo;
  if g is null then return 'no-existe'; end if;
  lider := public.lider_de(g);
  if lider is null or lider = uid then return case when lider = uid then 'ya-unido' else 'no-existe' end; end if;
  if public.hay_bloqueo(uid, lider) then return 'no-existe'; end if;
  -- Amigos en el acto: el link lo compartió quien armó el grupo.
  update friendships set estado = 'aceptada'
   where least(solicitante, destinatario) = least(uid, lider) and greatest(solicitante, destinatario) = greatest(uid, lider);
  if not found then
    insert into friendships (solicitante, destinatario, estado) values (lider, uid, 'aceptada');
  end if;
  if public.grupo_de(uid) = g then return 'ya-unido'; end if;
  return public.entrar_al_grupo(uid, lider);
end;
$$;

-- TERMINÉ DE ENTRENAR: me voy de lo publicado, del grupo y de mis pedidos.
create or replace function public.dejar_de_entrenar()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  delete from en_vivo where user_id = uid;
  delete from entrenos_compartidos where solicitante = uid or destinatario = uid;
  delete from grupo_miembros where user_id = uid;
  delete from grupos_entreno g where not exists (select 1 from grupo_miembros m where m.grupo_id = g.id);
end;
$$;

-- LO QUE VE MI PANTALLA. Para la app de la tienda: una "unión aceptada" por cada
-- compañero del grupo y los pedidos. Para la nueva, además: el grupo, quién lo
-- armó y si lo armé yo.
create or replace function public.mis_uniones()
returns jsonb language sql stable security definer set search_path = public as $$
  with g as (
    select m.grupo_id as id from grupo_miembros m
     where m.user_id = auth.uid() and public.miembro_vivo(m.user_id, m.entro)
  ),
  lider as (select public.lider_de((select id from g)) as id),
  companeros as (
    select jsonb_build_object(
             'id', m.grupo_id,
             'estado', 'aceptada',
             -- Para la app de la tienda: "la pedí yo" = entré después que él.
             'la_pedi_yo', (select x.n from grupo_miembros x where x.user_id = auth.uid()) > m.n,
             'grupo', m.grupo_id,
             'lider', m.user_id = (select id from lider),
             'yo_lider', auth.uid() = (select id from lider),
             'otro', jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url),
             'ahora', now(),
             'en_vivo', (
               select jsonb_build_object(
                        'ejercicio', v.ejercicio, 'serie', v.serie, 'meta', v.meta,
                        'descanso_fin', v.descanso_fin, 'actualizado', v.actualizado)
                 from en_vivo v where v.user_id = m.user_id and v.actualizado >= m.entro - interval '1 minute')
           ) as j, 0 as tipo, m.entro as orden
      from grupo_miembros m
      join usuarios_publicos u on u.id = m.user_id
     where m.grupo_id = (select id from g) and m.user_id <> auth.uid()
       and public.miembro_vivo(m.user_id, m.entro)
  ),
  pedidos as (
    select jsonb_build_object(
             'id', c.id,
             'estado', 'pendiente',
             'la_pedi_yo', c.solicitante = auth.uid(),
             'grupo', null,
             'lider', false,
             'yo_lider', auth.uid() = (select id from lider),
             'otro', jsonb_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url),
             'ahora', now(),
             'en_vivo', null
           ) as j, 1 as tipo, c.creado as orden
      from entrenos_compartidos c
      join usuarios_publicos u on u.id = case when c.solicitante = auth.uid() then c.destinatario else c.solicitante end
     where c.estado = 'pendiente' and c.hasta > now()
       and public.amigos_entre(c.solicitante, c.destinatario)
       and (c.solicitante = auth.uid() or c.destinatario = auth.uid()
            or ((select id from g) is not null and public.grupo_de(c.destinatario) = (select id from g)))
  )
  -- Primero los compañeros, después los pedidos.
  select coalesce((select jsonb_agg(j order by tipo, orden) from (select * from companeros union all select * from pedidos) t), '[]'::jsonb);
$$;

-- La sesión que se cierra (por cualquier camino) saca de lo publicado, del grupo y de los pedidos.
create or replace function public.sesion_cerrada_corta_el_entreno()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    delete from en_vivo where user_id = old.user_id;
    delete from entrenos_compartidos where solicitante = old.user_id or destinatario = old.user_id;
    delete from grupo_miembros where user_id = old.user_id;
    delete from grupos_entreno g where not exists (select 1 from grupo_miembros m where m.grupo_id = g.id);
  exception when others then
    null;
  end;
  return null;
end;
$$;

-- TIEMPO REAL: los del grupo leen lo del grupo, y nada más. Las políticas corren con
-- los permisos de quien lee: por eso dos funciones que solo hablan de MI grupo (con
-- grupo_de abierto, cualquiera podría preguntar en qué grupo está otro).
create or replace function public.mi_grupo()
returns uuid language sql stable security definer set search_path = public as $$
  select public.grupo_de(auth.uid());
$$;
create or replace function public.en_mi_grupo(p_otro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.grupo_de(auth.uid()) is not null and public.grupo_de(p_otro) = public.grupo_de(auth.uid());
$$;
revoke execute on function public.mi_grupo(), public.en_mi_grupo(uuid) from public, anon;
grant execute on function public.mi_grupo(), public.en_mi_grupo(uuid) to authenticated;

drop policy if exists "en vivo: mi grupo" on public.en_vivo;
create policy "en vivo: mi grupo" on public.en_vivo for select
  using (user_id = auth.uid() or public.en_mi_grupo(user_id));
drop policy if exists "grupo: los del grupo" on public.grupo_miembros;
create policy "grupo: los del grupo" on public.grupo_miembros for select
  using (grupo_id = public.mi_grupo());
grant select on public.en_vivo to authenticated;
grant select on public.grupo_miembros to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.en_vivo;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.grupo_miembros;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

revoke execute on function public.tope_grupo(), public.entrena_ahora(uuid), public.miembro_vivo(uuid, timestamptz), public.limpiar_grupos(), public.grupo_de(uuid), public.en_grupo(uuid), public.amigos_entre(uuid, uuid),
  public.lider_de(uuid), public.entrar_al_grupo(uuid, uuid), public.entrena_con_otro(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.salir_del_grupo(), public.echar_del_grupo(uuid), public.link_del_grupo(), public.unirse_por_link(text) from public, anon;
grant execute on function public.salir_del_grupo(), public.echar_del_grupo(uuid), public.link_del_grupo(), public.unirse_por_link(text) to authenticated;
-- Las de siempre ya tenían sus permisos; `create or replace` no los cambia.

-- LOS PARES QUE SIGUEN VIVOS pasan a ser grupos de dos (con quien recibió el pedido como el que armó).
do $$
declare
  c record;
  g uuid;
begin
  for c in select * from entrenos_compartidos where estado = 'aceptada' and public.vinculo_vivo(solicitante, destinatario, hasta) loop
    if not exists (select 1 from grupo_miembros where user_id in (c.solicitante, c.destinatario)) then
      insert into grupos_entreno default values returning id into g;
      insert into grupo_miembros (user_id, grupo_id, entro) values (c.destinatario, g, c.creado), (c.solicitante, g, c.creado + interval '1 second');
    end if;
  end loop;
  delete from entrenos_compartidos where estado = 'aceptada';
end $$;

do $$
begin
  if public.version_del_esquema() < 88 then
    create or replace function public.version_del_esquema()
    returns int language sql immutable as $fn$ select 88; $fn$;
  end if;
end $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
