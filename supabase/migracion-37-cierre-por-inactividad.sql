-- =============================================================
-- MIGRACIÓN 37 — la sesión se cierra sola cuando se deja de entrenar,
-- y la base dice qué versión es
--
-- Va DESPUÉS de la 36. Ejecutar entera en el SQL Editor de Supabase.
--
-- ADITIVA en tablas (dos columnas con valor por omisión) y reemplaza cuatro
-- funciones con la MISMA firma. Se puede correr antes o después del deploy:
-- con el cliente viejo, que no marca actividad, las sesiones caen en la regla
-- de "sin actividad" y se cierran a las dos horas sin duración, que es lo mismo
-- que pasaba a las cuatro.
-- =============================================================

-- -------------------------------------------------------------
-- 1. LA VERSIÓN DEL ESQUEMA
-- -------------------------------------------------------------
-- EL BUG QUE ESTO ARREGLA. El campo de peso se mostró antes de que corriera la
-- 36, y la función vieja de guardar bloques tiraba los pesos SIN DAR ERROR:
-- se veían, se escribían y no se guardaban. Una interfaz que depende de una
-- migración tiene que poder preguntar si la migración está.
--
-- CADA MIGRACIÓN DE ACÁ EN ADELANTE REESCRIBE ESTA FUNCIÓN CON SU NÚMERO. Hay
-- un test que falla si la última migración no lo hace.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 37; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;

-- -------------------------------------------------------------
-- 2. LA ÚLTIMA ACTIVIDAD
-- -------------------------------------------------------------
-- "Me olvidé de terminar y quedó en tres horas." El cierre de cuatro horas era
-- demasiado tarde para servir de algo, y además dejaba la sesión SIN duración.
--
-- La regla nueva: media hora sin actividad y la sesión se cierra sola, con la
-- hora de la ÚLTIMA actividad y no con "ahora". La duración no incluye el
-- tiempo muerto.
--
-- POR QUÉ MEDIA HORA Y NO VEINTICINCO MINUTOS: como el cierre se fecha en la
-- última actividad, la ventana NO cambia la duración que queda guardada; solo
-- cambia cuánto se tarda en enterarse. Una ventana más larga no cuesta
-- precisión y evita cortarle la sesión a alguien que espera que se libere un
-- banco.
--
-- QUÉ ES ACTIVIDAD, y lo marca el teléfono con `marcar_actividad`:
--   - cada serie, sumada o restada, y cada cambio de ejercicio o de peso;
--   - un descanso CORRIENDO: el teléfono marca hasta cuándo dura, así que
--     mientras el temporizador anda, la persona está entrenando.
--
-- `cerro_sola` separa estas sesiones de las que se terminaron a mano: el
-- teléfono avisa "se cerró sola" una vez, y los toques que lleguen tarde por la
-- cola sin señal saben que pueden corregir el cierre.
alter table public.sesiones add column if not exists ultima_actividad timestamptz;
alter table public.sesiones add column if not exists cerro_sola boolean not null default false;
update public.sesiones set ultima_actividad = inicio where ultima_actividad is null;
alter table public.sesiones alter column ultima_actividad set default now();
alter table public.sesiones alter column ultima_actividad set not null;

-- -------------------------------------------------------------
-- 3. LOS DOS NÚMEROS
-- -------------------------------------------------------------
-- Están también en `nucleo/reglas.ts`; la sección 26 de test:db compara las dos
-- copias.
create or replace function public.ventana_inactividad()
returns interval language sql immutable as $$ select interval '30 minutes' $$;

-- EL CASO QUE LA REGLA NO PUEDE CUBRIR: una sesión en la que nunca se tocó nada
-- —la persona usa el cronómetro y no el contador—. Ahí no hay ninguna señal de
-- si sigue entrenando, así que no hay "última actividad" que usar: cerrarla en
-- el inicio le daría duración cero, y a una sesión que empezó sola al llegar al
-- gimnasio le borraría el día. Esas se cierran a las dos horas y SIN duración,
-- que es lo que pasaba a las cuatro. El día nunca se toca.
create or replace function public.tope_sesion()
returns interval language sql immutable as $$ select interval '2 hours' $$;

-- -------------------------------------------------------------
-- 4. EL CIERRE
-- -------------------------------------------------------------
-- Sigue sin tarea programada: se evalúa cuando algo lee la sesión, igual que la
-- pérdida de racha. El corte lo decide el servidor contra lo guardado, nunca el
-- reloj del teléfono.
--
-- NUNCA BORRA EL DÍA. La regla del toque accidental vive en `terminar_sesion` y
-- no acá: una sesión que se cerró sola no puede llevarse puesto un día de
-- gimnasio.
create or replace function public.cerrar_sesiones_vencidas(p_user uuid)
returns void language sql security definer set search_path = public as $$
  update sesiones
     set estado = 'terminada', fin = greatest(inicio, ultima_actividad), cerro_sola = true
   where user_id = p_user and estado = 'corriendo'
     and ultima_actividad > inicio
     and now() >= ultima_actividad + ventana_inactividad();

  update sesiones
     set estado = 'abandonada', cerro_sola = true
   where user_id = p_user and estado = 'corriendo'
     and ultima_actividad <= inicio
     and now() - inicio >= tope_sesion();
$$;

-- -------------------------------------------------------------
-- 5. MARCAR ACTIVIDAD
-- -------------------------------------------------------------
-- `p_hasta` es CUÁNDO pasó, no cuándo llegó el pedido. La diferencia es el
-- subsuelo sin señal: los toques quedan en la cola y suben media hora después;
-- si la base usara `now()`, una sesión de gimnasio sin red terminaría con la
-- vuelta a casa adentro. Para un descanso, `p_hasta` es cuándo TERMINA.
--
-- Acotado: nunca antes del inicio, y como mucho quince minutos adelante —más
-- que cualquier descanso—, porque el dato llega del teléfono.
--
-- Y SI LLEGA TARDE A UNA SESIÓN QUE YA SE CERRÓ SOLA: si la actividad pasó
-- adentro de la media hora después del cierre, el cierre se decidió con datos
-- viejos —la cola todavía no había subido—, así que se corre el fin. Si pasó
-- después, es otra cosa (la persona volvió) y el cierre no se toca: meter ese
-- rato en la duración sería contar el tiempo muerto.
create or replace function public.marcar_actividad(p_sesion uuid, p_hasta timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
  t timestamptz;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  select * into s from sesiones where id = p_sesion and user_id = uid;
  if s.id is null then return; end if;

  t := least(greatest(coalesce(p_hasta, now()), s.inicio), now() + interval '15 minutes');

  if s.estado = 'corriendo' then
    update sesiones set ultima_actividad = greatest(ultima_actividad, t) where id = s.id;
  elsif s.estado = 'terminada' and s.cerro_sola and t > s.fin and t <= s.fin + ventana_inactividad() then
    update sesiones
       set ultima_actividad = greatest(ultima_actividad, t),
           fin = least(t, now())
     where id = s.id;
  end if;
end;
$$;

revoke execute on function public.marcar_actividad(uuid, timestamptz) from public, anon;
grant execute on function public.marcar_actividad(uuid, timestamptz) to authenticated;

-- -------------------------------------------------------------
-- 6. EMPEZAR: la actividad arranca en el inicio
-- -------------------------------------------------------------
create or replace function public.iniciar_sesion(
  p_desde timestamptz default null,
  p_origen text default 'manual'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  l uuid;
  registro jsonb := null;
  s sesiones;
  hoy date := mi_hoy();
  arranque timestamptz;
begin
  if uid is null then raise exception 'sin sesión'; end if;

  perform cerrar_sesiones_vencidas(uid);

  -- ¿Ya hay una viva? Se sigue esa. Nunca se pisa.
  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is not null then
    return jsonb_build_object('bloqueado', false, 'id', s.id, 'inicio', s.inicio,
      'origen', s.origen, 'series', s.series, 'ahora', now(),
      'yaEstaba', true, 'registro', null);
  end if;

  arranque := least(now(), greatest(coalesce(p_desde, now()), now() - atraso_maximo()));

  select id into l from logs where user_id = uid and fecha = hoy;
  if l is null then
    registro := registrar_dia(p_origen);
    if (registro ->> 'bloqueado')::boolean then
      return registro;
    end if;
    l := (registro ->> 'log_id')::uuid;
  end if;
  -- `ultima_actividad` en el inicio: todavía no pasó nada. Es lo que hace que
  -- una sesión en la que nunca se toca el contador caiga en la regla de las
  -- dos horas y no en la de la media hora.
  insert into sesiones (user_id, log_id, inicio, origen, creo_el_dia, ultima_actividad)
    values (uid, l, arranque, p_origen, registro is not null, arranque)
    returning * into s;
  return jsonb_build_object('bloqueado', false, 'id', s.id, 'inicio', s.inicio,
    'origen', s.origen, 'series', s.series, 'ahora', now(),
    'yaEstaba', false, 'registro', registro);
end;
$$;

-- -------------------------------------------------------------
-- 7. TERMINAR, con la misma regla
-- -------------------------------------------------------------
-- Tocar "Terminar" tarde no puede sumar el tiempo muerto: si pasó más de media
-- hora desde la última actividad, se cierra en la última actividad, igual que
-- lo habría cerrado el automático un minuto antes.
--
-- Y EL TOQUE ACCIDENTAL AHORA MIRA LAS SERIES. Borraba el día si la sesión no
-- llegaba a cinco minutos; con el cierre en la última actividad, una sesión de
-- tres series en cuatro minutos cumplía eso y se llevaba el día. Si hay una
-- sola serie contada, hubo entrenamiento.
create or replace function public.terminar_sesion(p_hasta timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
  cierre timestamptz;
  deshizo boolean := false;
begin
  if uid is null then raise exception 'sin sesión'; end if;

  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is null then
    return jsonb_build_object('termino', false);
  end if;

  -- Sin actividad y pasado el tope: la cierra el automático, sin duración.
  if s.ultima_actividad <= s.inicio and now() - s.inicio >= tope_sesion() then
    perform cerrar_sesiones_vencidas(uid);
    return jsonb_build_object('termino', false);
  end if;

  if s.ultima_actividad > s.inicio and now() >= s.ultima_actividad + ventana_inactividad() then
    cierre := s.ultima_actividad;
  else
    -- Nunca antes del inicio —eso daría duración negativa— ni después de ahora.
    cierre := least(now(), greatest(coalesce(p_hasta, now()), s.inicio));
  end if;

  update sesiones set estado = 'terminada', fin = cierre
   where id = s.id
   returning * into s;

  -- EL TOQUE ACCIDENTAL. Cuatro condiciones y las cuatro tienen que darse:
  --   1. no llegó al piso de 5 minutos → no hubo entrenamiento;
  --   2. no se contó ninguna serie       → tampoco lo dice el contador;
  --   3. el día lo creó ESTA sesión      → no lo registró nadie más;
  --   4. no hay otra sesión ese día      → no entrenaste en otro momento.
  if (s.fin - s.inicio) < piso_sesion()
     and s.series = 0
     and s.creo_el_dia
     and not exists (
       select 1 from sesiones o where o.log_id = s.log_id and o.id <> s.id
     )
  then
    delete from logs where id = s.log_id and user_id = uid;
    deshizo := true;
  end if;

  return jsonb_build_object(
    'termino', true,
    'segundos', extract(epoch from (s.fin - s.inicio)),
    'cuenta', (s.fin - s.inicio) >= piso_sesion(),
    'deshizo_el_dia', deshizo
  );
end;
$$;

-- -------------------------------------------------------------
-- 8. LO QUE LEE EL TELÉFONO
-- -------------------------------------------------------------
-- Suma dos cosas: la última actividad, para que el teléfono aplique la misma
-- regla sin esperar a la base; y, cuando no hay sesión corriendo, la última
-- que se cerró SOLA en las últimas doce horas, para avisar una vez qué pasó.
create or replace function public.mi_sesion()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s sesiones;
  sola sesiones;
begin
  if uid is null then return null; end if;
  perform cerrar_sesiones_vencidas(uid);
  select * into s from sesiones where user_id = uid and estado = 'corriendo';
  if s.id is null then
    select * into sola from sesiones
     where user_id = uid and cerro_sola and inicio > now() - interval '12 hours'
     order by inicio desc limit 1;
    return jsonb_build_object(
      'corriendo', false,
      'ahora', now(),
      'cerrada_sola', case when sola.id is null then null else jsonb_build_object(
        'id', sola.id,
        'inicio', sola.inicio,
        'fin', sola.fin,
        'estado', sola.estado,
        'series', sola.series
      ) end
    );
  end if;
  return jsonb_build_object(
    'corriendo', true,
    'id', s.id,
    'inicio', s.inicio,
    'origen', s.origen,
    'ahora', now(),
    'series', s.series,
    'ultima_actividad', s.ultima_actividad,
    'tope_segundos', extract(epoch from tope_sesion()),
    'ventana_segundos', extract(epoch from ventana_inactividad())
  );
end;
$$;
