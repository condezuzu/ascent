-- =============================================================
-- MIGRACIÓN 43 — Inicio en una sola consulta
--
-- Va DESPUÉS de la 42. Ejecutar entera en el SQL Editor de Supabase.
--
-- NO CAMBIA NINGÚN DATO, NO BORRA NADA y no toca ninguna función existente.
-- Agrega UNA función que junta lo que hoy son cuatro tandas de pedidos.
-- El camino viejo sigue entero: si esta función no existe, las dos apps
-- vuelven solas a pedir de a uno.
-- =============================================================

-- -------------------------------------------------------------
-- 1. EL PROBLEMA, MEDIDO
-- -------------------------------------------------------------
-- Abrir Inicio con la caché fría eran 17 pedidos a Supabase en 5 tandas
-- encadenadas. La limpieza de duplicados los dejó en 12 y 4 tandas. Lo que
-- queda encadenado es esto, y no se puede arreglar del lado del cliente:
--
--   tanda 1  perfil, logs, verificar_perdida, descansos, mi_sesion, avisos
--   tanda 2  mis_impulsos, mi_fuerza, friendships (los amigos)
--   tanda 3  logs de los amigos      <- necesita la respuesta de la tanda 2
--   tanda 4  usuarios_publicos       <- necesita la respuesta de la tanda 3
--
-- Cada tanda es una ida y vuelta entera. En wifi son 40 ms y no se notan; con
-- datos móviles son entre 250 y 400 ms CADA UNA. Medido contra esta base:
-- la secuencia completa tarda 1204 ms desde acá, contra 234 ms si fuera un
-- solo pedido. En una red de 400 ms de latencia, 1924 ms contra 414 ms.
--
-- Y lo que más se siente no es el número: es que la pantalla TERMINA de
-- acomodarse a los 1,9 s. El aviso de impulso aparece como un cartel un
-- segundo tarde, la línea social empuja el layout. Con esto llega entera.
--
-- QUÉ NO ENTRA ACÁ, a propósito:
--
--   `mi_sesion`   ya viaja en la tanda 1, así que juntarla no ahorra ninguna
--                 ida y vuelta — y tiene que correr DESPUÉS de vaciar la cola
--                 de escrituras pendientes, o la base cierra la sesión mirando
--                 actividad vieja. Meterla acá sería aceptar ese riesgo a
--                 cambio de nada.
--   los avisos    (friendships y challenges pendientes) también están en la
--                 tanda 1 y tienen su propia memoria de un minuto.
--   `auth/v1/user` es otro servicio, no es Postgres. No se puede juntar.

-- -------------------------------------------------------------
-- 2. POR QUÉ CADA PEDAZO VA EN SU PROPIO BLOQUE DE EXCEPCIÓN
-- -------------------------------------------------------------
-- Hoy, si se cae `mis_impulsos`, la pantalla igual sale: pierde el aviso de la
-- vida y nada más. Juntando todo en una función, un error en cualquier pedazo
-- se llevaría la pantalla entera. Eso sería cambiar una molestia por un
-- bloqueo, y en un subsuelo de gimnasio es exactamente al revés de lo que
-- queremos.
--
-- Con un `exception` por sección, el pedazo que falla vuelve en `null` y el
-- resto llega igual. La degradación parcial que hoy pasa por accidente —porque
-- son pedidos separados— acá pasa a propósito.
--
-- Y ARREGLA UN AGUJERO QUE YA EXISTÍA. `verificar_perdida` ESCRIBE: marca los
-- impulsos gastados y corta la racha. Sin los bloques, un error en la última
-- sección haría rollback de la transacción entera, incluida esa escritura, y
-- la pérdida quedaría sin registrar sin que nadie se entere. Cada `begin ...
-- exception` abre una subtransacción: lo que ya se guardó, queda guardado.

create or replace function public.pantalla_inicio()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  hoy date;
  r jsonb := '{}'::jsonb;
  pedazo jsonb;
begin
  -- Sin sesión no se contesta nada. No es un error: la pantalla de entrada
  -- monta cosas que preguntan, y un 401 por carga ensucia el informe.
  if uid is null then
    return null;
  end if;

  begin
    hoy := mi_hoy();
  exception when others then
    hoy := current_date;
  end;
  r := r || jsonb_build_object('hoy', hoy);

  -- LA PÉRDIDA VA PRIMERO, y ese orden es la mitad del valor de esta función.
  -- Hoy la web pide `verificar_perdida` EN PARALELO con el perfil: si hubo
  -- pérdida, el perfil que llegó ya está viejo y hay que leerlo de nuevo — una
  -- ida y vuelta más, justo el día que perdiste la racha. Acá el perfil se lee
  -- después, así que siempre viene fresco y esa relectura desaparece por
  -- construcción, no por acordarse.
  begin
    pedazo := verificar_perdida();
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('perdida', pedazo);

  begin
    pedazo := (select to_jsonb(p) from profiles p where p.id = uid);
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('perfil', pedazo);

  -- Los últimos siete días, que es lo que dibuja la tira. El orden lo pone la
  -- base para que el cliente no tenga que ordenar nada.
  begin
    pedazo := coalesce((
      select jsonb_agg(to_jsonb(l) order by l.fecha)
        from logs l
       where l.user_id = uid and l.fecha >= hoy - 6
    ), '[]'::jsonb);
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('logs', pedazo);

  -- Las configuraciones de descanso, de la más nueva a la más vieja: el
  -- cliente elige la vigente para cada fecha con `descansosVigentes`.
  begin
    pedazo := coalesce((
      select jsonb_agg(jsonb_build_object('desde', d.desde, 'dias', d.dias) order by d.desde desc)
        from descansos d
       where d.user_id = uid
    ), '[]'::jsonb);
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('descansos', pedazo);

  begin
    pedazo := mis_impulsos();
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('impulsos', pedazo);

  begin
    pedazo := mi_fuerza();
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('fuerza', pedazo);

  -- LA LÍNEA SOCIAL: "alguien más entrenó hoy". Del lado del cliente son TRES
  -- pedidos encadenados —los amigos, después el último día de esos amigos,
  -- después quién es— porque el cliente no puede hacer un join. Acá es una
  -- consulta.
  --
  -- CUIDADO CON SECURITY DEFINER (migración 41): adentro de esta función RLS
  -- no filtra nada, así que la pertenencia se pide explícita. `usuarios_
  -- publicos` ya es pública —username, avatar, racha y rango— y es lo único
  -- que sale de acá: no se devuelve el perfil del amigo ni sus días.
  begin
    pedazo := (
      select jsonb_build_object('username', u.username, 'racha', u.racha_actual)
        from logs l
        join usuarios_publicos u on u.id = l.user_id
       where l.es_descanso = false
         and l.user_id in (
           select case when f.solicitante = uid then f.destinatario else f.solicitante end
             from friendships f
            where f.estado = 'aceptada'
              and (f.solicitante = uid or f.destinatario = uid)
         )
       order by l.fecha desc
       limit 1
    );
  exception when others then
    pedazo := null;
  end;
  r := r || jsonb_build_object('social', pedazo);

  return r;
end;
$$;

revoke execute on function public.pantalla_inicio() from public, anon;
grant execute on function public.pantalla_inicio() to authenticated;

-- -------------------------------------------------------------
-- 3. LA VERSIÓN
-- -------------------------------------------------------------
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 43; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
