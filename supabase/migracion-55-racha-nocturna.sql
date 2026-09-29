-- MIGRACIÓN 55 — LA RACHA SE PIERDE SIN ABRIR LA APP (item 2)
--
-- EL PROBLEMA. `verificar_perdida()` descuenta vidas y corta rachas bien, contra
-- el reloj del servidor, PERO solo corre cuando alguien abre Inicio
-- (`pantalla_inicio`). Quien deja de entrenar y no abre la app se queda con la
-- racha CONGELADA en la base, y sus amigos la ven en el ranking
-- (`usuarios_publicos` lee `profiles.racha_actual`). O sea: la mejor forma de
-- defender tu puesto pasa a ser NO abrir la app. Eso rompe el ranking.
--
-- LA SOLUCIÓN, en tres piezas:
--  1. `verificar_perdida_de(p_user)`: la misma lógica exacta que
--     `verificar_perdida()`, pero por id en vez de `auth.uid()` — así la puede
--     correr un trabajo de fondo, que no tiene sesión. Como `hoy_de(p_user)` ya
--     usa la zona horaria de CADA usuario, una sola corrida sirve para todos los
--     husos: cada uno evalúa su propio "ayer".
--  2. `verificar_perdida()` pasa a ser un envoltorio de una línea sobre
--     `verificar_perdida_de(auth.uid())`. CRÍTICO: así el camino de abrir la app
--     y el del trabajo nocturno son EL MISMO código y no pueden decidir distinto.
--  3. `barrer_perdidas()`: recorre las cuentas con racha viva y corre la #1 para
--     cada una. Solo `service_role` (el cron), nunca el cliente.
--
-- EL RANKING. Con esto corriendo cada hora, `profiles.racha_actual` queda al día
-- (a lo sumo 1 h de atraso tras la medianoche local de cada uno), y tanto el
-- ranking como la línea social ya leen esa columna: no hace falta tocar la vista.
-- (Un recálculo al LEER mostraría un número que DIFIERE del que el batch commitea
-- —gastar vidas y el piso de -10 son efectos que un read no puede hacer—, así que
-- se evita a propósito.)
--
-- EL AGENDADO NO VA ACÁ. pg_cron no existe en PGlite (donde corre test:db), así
-- que el `cron.schedule(...)` vive en `supabase/cron-racha.sql`, que se corre a
-- mano UNA vez después de aplicar esta migración. Ver ese archivo.
--
-- OJO (heredado, NO introducido acá): el `exit when ... descansos_vigentes` corta
-- la cobertura al toparse con un día de descanso caminando hacia atrás, así que
-- una falta real más vieja que un descanso puede quedar sin cubrir aunque haya
-- vidas. Ya pasa al abrir la app; el barrido lo hace determinístico. Se deja
-- IGUAL que hoy (paridad app-open ↔ batch); si se decide arreglar, se cambia el
-- núcleo compartido y, como `verificar_perdida()` es un envoltorio, los dos
-- caminos quedan iguales de una.

create or replace function public.verificar_perdida_de(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  perfil profiles;
  viva int;
  nuevo_rango int;
  nueva_racha int;
  hoy date := hoy_de(p_user);
  resuelto date;
  d date;
  cubiertos date[] := '{}';
begin
  resuelto := resolver_pendiente(p_user);

  select * into perfil from profiles where id = p_user;
  if perfil.id is null or perfil.racha_actual = 0 then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  if exists (select 1 from logs where user_id = p_user and fecha = hoy) then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;
  viva := perfil.racha_base + calcular_racha(p_user, hoy - 1);
  if viva >= perfil.racha_actual then
    return jsonb_build_object('perdida', false, 'pendiente_resuelto', resuelto);
  end if;

  d := hoy - 1;
  loop
    exit when perfil.perdida_fecha is not null and d <= perfil.perdida_fecha;
    exit when exists (select 1 from logs where user_id = p_user and fecha = d);
    exit when extract(dow from d)::int = any(descansos_vigentes(p_user, d));
    exit when exists (select 1 from vidas_usadas where user_id = p_user and fecha = d);
    -- ¿queda un impulso disponible para ESE día?
    exit when impulsos_disponibles(p_user, d) <= 0;
    insert into vidas_usadas (user_id, fecha) values (p_user, d)
      on conflict (user_id, fecha) do nothing;
    cubiertos := cubiertos || d;
    d := d - 1;
    exit when array_length(cubiertos, 1) >= impulsos_tope();
  end loop;

  if array_length(cubiertos, 1) > 0 then
    viva := perfil.racha_base + calcular_racha(p_user, hoy - 1);
    if viva >= perfil.racha_actual then
      return jsonb_build_object(
        'perdida', false,
        'pendiente_resuelto', resuelto,
        'vidas_usadas', to_jsonb(cubiertos),
        'vidas_quedan', impulsos_disponibles(p_user, hoy)
      );
    end if;
  end if;

  -- No alcanzó: la racha se corta igual, y los impulsos gastados NO se
  -- devuelven —el día que cubrieron sigue cubierto—. Devolverlos sería premiar
  -- la falta larga: el que faltó seis días terminaría con más que el que faltó
  -- dos.
  nueva_racha := greatest(0, perfil.racha_actual - 10);
  nuevo_rango := rango_de_racha(nueva_racha);
  update profiles set
    racha_actual = nueva_racha,
    racha_base = nueva_racha,
    rango_actual = nuevo_rango,
    perdida_fecha = hoy - 1
  where id = p_user;
  return jsonb_build_object('perdida', true, 'rango_anterior', perfil.rango_actual,
    'rango_nuevo', nuevo_rango, 'racha', nueva_racha, 'pendiente_resuelto', resuelto,
    'vidas_usadas', to_jsonb(cubiertos),
    'vidas_quedan', impulsos_disponibles(p_user, hoy));
end;
$$;

-- El envoltorio: el camino de abrir la app. UNA línea, para que no pueda diverger
-- del batch. Mantiene la firma y los permisos de siempre.
create or replace function public.verificar_perdida()
returns jsonb language sql security definer set search_path = public as $$
  select public.verificar_perdida_de(auth.uid());
$$;

-- El barrido: corre la pérdida por cada cuenta con racha viva. Cada una en su
-- propio bloque, para que una fila mala no aborte el barrido entero.
create or replace function public.barrer_perdidas()
returns int language plpgsql security definer set search_path = public as $$
declare
  u uuid;
  n int := 0;
begin
  for u in select id from profiles where racha_actual > 0 loop
    begin
      perform verificar_perdida_de(u);
      n := n + 1;
    exception when others then
      null;
    end;
  end loop;
  return n;
end;
$$;

-- `verificar_perdida_de` la llama el envoltorio (definer) y el barrido: nadie
-- desde el cliente. `barrer_perdidas` solo el cron (service_role).
revoke execute on function public.verificar_perdida_de(uuid) from public, anon, authenticated;
revoke execute on function public.barrer_perdidas() from public, anon, authenticated;
grant execute on function public.barrer_perdidas() to service_role;

-- La versión sube a 55 (solo sube, nunca baja).
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 55; $$;
revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
