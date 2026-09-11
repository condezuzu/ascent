-- =============================================================
-- MIGRACIÓN 33 — la vida se puede devolver, y el aviso deja de perderse
--
-- Va DESPUÉS de la 32. Ejecutar entera en el SQL Editor de Supabase.
--
-- ADITIVA en tablas (una columna con valor por omisión) pero REEMPLAZA cinco
-- funciones. No cambia la forma de lo que devuelven salvo `mis_vidas`, que
-- SUMA una clave: el cliente viejo la ignora. Se puede correr antes o después
-- del deploy.
-- =============================================================

-- -------------------------------------------------------------
-- 1. POR QUÉ EL AVISO NO SALÍA — el bug
-- -------------------------------------------------------------
-- `verificar_perdida` devuelve `vidas_usadas` SOLO en la llamada que cubrió el
-- día. La pantalla lo leía de ahí y mostraba el aviso, y el comentario del
-- componente decía que eso era una ventaja: "no hace falta guardar si ya se
-- mostró, porque el hecho no se repite".
--
-- **Estaba mal.** El hecho no se repite, pero el REPORTE es de una sola
-- llamada, y hay por lo menos tres formas de perdérselo:
--
--   - La llamada que cubre pasa con una sesión de entrenamiento corriendo, y
--     el aviso no se dibuja en ese estado.
--   - La pantalla se vuelve a montar —navegar, volver de segundo plano, el
--     resumen de la sesión— y el estado de React se va con ella.
--   - Cualquier otra llamada a `verificar_perdida` llega primero y se lo come.
--
-- El día queda cubierto igual: la racha está bien y la vida gastada. Lo único
-- que se pierde es que te enteres, que es justo lo que hace que la mecánica
-- exista.
--
-- LA SALIDA: que el aviso salga del ESTADO y no del evento. `mis_vidas` ahora
-- devuelve los últimos días cubiertos; el cliente se acuerda de cuál fue el
-- último que anunció y compara. Se puede volver a preguntar mil veces, desde
-- cualquier aparato, y la respuesta es la misma.

-- -------------------------------------------------------------
-- 2. DEVOLVER UNA VIDA
-- -------------------------------------------------------------
-- Pedido: poder elegir entre usarla o guardarla. El problema es que cuando
-- abrís la app el día YA PASÓ, así que preguntar antes deja la racha en limbo
-- hasta que contestes — y si no abrís en tres días, no se sabe qué hacer.
--
-- La solución es la que propuso el humano y es la correcta: **se aplica sola,
-- el aviso te lo cuenta, y ahí mismo se puede devolver**. Elegís igual y no
-- hay limbo, porque el estado por omisión es uno concreto y no una pregunta.
--
-- Devolver NO borra la fila: la marca. Y la diferencia importa en un caso
-- puntual: el día devuelto NO se puede volver a cubrir. Sin eso, la próxima
-- vez que corriera `verificar_perdida` gastaría otra vida en el mismo día y la
-- devolución sería un botón que no hace nada.
alter table public.vidas_usadas
  add column if not exists devuelta boolean not null default false;

-- Las que quedan: las filas NO devueltas. Devolver una la vuelve al pozo, que
-- es exactamente lo que significa "guardarla para después".
create or replace function public.vidas_disponibles(p_user uuid, p_dia date)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, vidas_por_mes() - (
    select count(*)::int from vidas_usadas
     where user_id = p_user
       and not devuelta
       and date_trunc('month', fecha) = date_trunc('month', p_dia)
  ));
$$;

-- Un día cubierto no corta la racha... salvo que la vida se haya devuelto.
create or replace function public.calcular_racha(p_user uuid, p_hasta date)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  d date := p_hasta;
  cnt int := 0;
  tope date;
  tiene_log boolean;
  log_descanso boolean;
begin
  select perdida_fecha into tope from profiles where id = p_user;
  loop
    -- los días hasta la última pérdida ya viven en racha_base: no se recuentan
    if tope is not null and d <= tope then exit; end if;
    select true, es_descanso into tiene_log, log_descanso
      from logs where user_id = p_user and fecha = d;
    if tiene_log then
      if not log_descanso then cnt := cnt + 1; end if;
    -- El descanso se evalúa con la configuración que regía ESE día, no con
    -- la de hoy: cambiar de rutina nunca puede alterar el pasado.
    elsif extract(dow from d)::int = any(descansos_vigentes(p_user, d)) then
      null; -- día de descanso sin log: no corta
    -- Un día cubierto por una vida: tampoco corta, y tampoco suma. `not
    -- devuelta` porque devolver la vida es justamente decir "que este día
    -- corte".
    elsif exists (
      select 1 from vidas_usadas
       where user_id = p_user and fecha = d and not devuelta
    ) then
      null;
    else
      exit;
    end if;
    d := d - 1;
    if d < p_hasta - 3650 then exit; end if; -- tope de seguridad
  end loop;
  return cnt;
end;
$$;

-- Y el récord histórico, con la misma regla.
create or replace function public.mejor_racha_real(p_user uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  anterior date := null;
  corriente int := 0;
  maximo int := 0;
  d date;
begin
  for r in
    select fecha, es_descanso from logs where user_id = p_user order by fecha
  loop
    if anterior is not null then
      -- se revisan los días entre medio: cortan salvo que fueran de descanso
      -- o que una vida NO devuelta los haya cubierto
      d := anterior + 1;
      while d < r.fecha loop
        if not (extract(dow from d)::int = any(descansos_vigentes(p_user, d)))
           and not exists (
             select 1 from vidas_usadas
              where user_id = p_user and fecha = d and not devuelta
           )
        then
          corriente := 0;
          exit;
        end if;
        d := d + 1;
      end loop;
    end if;
    if not r.es_descanso then corriente := corriente + 1; end if;
    if corriente > maximo then maximo := corriente; end if;
    anterior := r.fecha;
  end loop;
  return maximo;
end;
$$;

-- Lo que necesita la interfaz. Suma `ultimas`: los últimos días cubiertos y
-- todavía vigentes, para que el aviso salga del ESTADO y no de haber estado
-- mirando en el momento justo.
create or replace function public.mis_vidas()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', vidas_por_mes(),
    'quedan', vidas_disponibles(auth.uid(), mi_hoy()),
    -- Las de ESTE mes, para dibujar los puntos.
    'del_mes', coalesce((
      select jsonb_agg(fecha order by fecha)
        from vidas_usadas
       where user_id = auth.uid()
         and not devuelta
         and date_trunc('month', fecha) = date_trunc('month', mi_hoy())
    ), '[]'::jsonb),
    -- Y las últimas cinco de todas, para el aviso. Cinco y no una: una
    -- ausencia de tres días son tres vidas y el aviso tiene que decir tres,
    -- no la última. Cinco es más que el máximo que se puede gastar de una.
    'ultimas', coalesce((
      select jsonb_agg(fecha order by fecha desc)
        from (
          select fecha from vidas_usadas
           where user_id = auth.uid() and not devuelta
           order by fecha desc limit 5
        ) x
    ), '[]'::jsonb),
    'ultima', (
      select max(fecha) from vidas_usadas where user_id = auth.uid() and not devuelta
    )
  );
$$;

/**
 * Devolver las vidas de una ausencia: se guardan para después y la racha se
 * corta como si nunca se hubieran usado.
 *
 * ES IRREVERSIBLE Y TIENE QUE SERLO: deshacerlo sería devolver una racha que
 * ya se dio por perdida, y ahí la racha deja de significar algo.
 *
 * SOLO DÍAS RECIENTES. Sin el límite, esto sería una máquina de reescribir
 * historia: alguien podría devolver una vida de hace tres meses y recalcular
 * una racha de entonces. Siete días es más que suficiente para el caso real,
 * que es "me enteré hoy y prefiero guardarla".
 */
create or replace function public.devolver_vidas(p_fechas date[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cuantas int;
begin
  if uid is null then return null; end if;

  update vidas_usadas
     set devuelta = true
   where user_id = uid
     and fecha = any(p_fechas)
     and not devuelta
     and fecha >= mi_hoy() - 7;
  get diagnostics cuantas = row_count;

  if cuantas = 0 then
    return jsonb_build_object('devueltas', 0);
  end if;

  -- Y ahora se aplica la pérdida. `verificar_perdida` ve el día descubierto y
  -- hace lo suyo; NO puede volver a cubrirlo porque su bucle sale en cuanto
  -- encuentra una fila para ese día, devuelta o no.
  return jsonb_build_object('devueltas', cuantas, 'perdida', verificar_perdida());
end;
$$;

revoke execute on function public.devolver_vidas(date[]) from public, anon;
grant execute on function public.devolver_vidas(date[]) to authenticated;
