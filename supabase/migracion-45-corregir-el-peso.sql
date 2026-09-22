-- =============================================================
-- MIGRACIÓN 45 — Corregir y borrar el peso de un día
--
-- Va DESPUÉS de la 44. Ejecutar entera en el SQL Editor de Supabase.
--
-- NO CAMBIA NINGÚN DATO y no toca ninguna función existente. Agrega DOS
-- funciones. Si no se corre, la app queda exactamente como hoy: el peso se
-- anota y no se puede tocar más.
-- =============================================================

-- -------------------------------------------------------------
-- 1. POR QUÉ, Y CÓMO APARECIÓ
-- -------------------------------------------------------------
-- `weights` tiene `select` para el dueño y nada más: se escribe por
-- `anotar_peso` y NO HABÍA forma de borrar ni de corregir. Eso está bien
-- pensado para que nadie escriba la tabla por la ventana, y mal pensado para
-- la persona: anotar 82,4 donde iba 84,2 es un número que se queda para
-- siempre torciendo el gráfico de la tendencia, que es lo único que ese dato
-- hace.
--
-- APARECIÓ DESDE AFUERA. Una sonda de capturas fabricó un peso en la cuenta de
-- prueba para sacar una foto y después no pudo sacarlo: quedó una fila que
-- hubo que borrar a mano en el editor de SQL. Lo que era una molestia para una
-- herramienta es un agujero para quien usa la app — con la diferencia de que
-- el dueño de la cuenta no tiene editor de SQL.
--
-- -------------------------------------------------------------
-- 2. POR QUÉ SON DOS FUNCIONES Y NO UN `grant update, delete`
-- -------------------------------------------------------------
-- Con los permisos directos, la app podría escribir CUALQUIER fecha, y ahí
-- entra un peso de hace tres meses que nunca se pesó. La tendencia dejaría de
-- ser un registro para pasar a ser un dibujo.
--
-- `corregir_peso` SOLO ACTUALIZA UNA FILA QUE YA EXISTE. No inserta. Si ese
-- día no hay peso anotado, no pasa nada y se devuelve `false`: corregir es
-- arreglar lo que anotaste, no inventar historia. Anotar sigue siendo
-- `anotar_peso`, que solo escribe HOY.
--
-- `borrar_peso` saca la fila de ese día. Borrar el dato equivocado tiene que
-- ser tan fácil como haberlo escrito, sobre todo cuando el que lo escribió fue
-- un dedo gordo en un teclado numérico.
--
-- Las dos devuelven `boolean` —si tocaron algo— en vez de `void`: la pantalla
-- necesita saber si el día existía para no decir "listo" cuando no hizo nada.

create or replace function public.corregir_peso(p_fecha date, p_valor numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tocadas int;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  -- El rango lo sigue mirando el check de la tabla (entre 20 y 400): no se
  -- repite acá para no tener dos verdades sobre el mismo número.
  update weights set valor = p_valor where user_id = uid and fecha = p_fecha;
  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$$;

create or replace function public.borrar_peso(p_fecha date)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tocadas int;
begin
  if uid is null then raise exception 'sin sesión'; end if;
  delete from weights where user_id = uid and fecha = p_fecha;
  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$$;

-- -------------------------------------------------------------
-- 3. QUIÉN LAS PUEDE LLAMAR
-- -------------------------------------------------------------
-- Las dos son `security definer` y filtran por `auth.uid()` adentro: el que
-- llama no elige de quién es el peso. Sin sesión no corren.
revoke execute on function
  public.corregir_peso(date, numeric),
  public.borrar_peso(date)
  from public, anon;

grant execute on function
  public.corregir_peso(date, numeric),
  public.borrar_peso(date)
  to authenticated;

-- -------------------------------------------------------------
-- 4. LA VERSIÓN DEL ESQUEMA
-- -------------------------------------------------------------
-- La app pregunta esto antes de mostrar lo que depende de una migración
-- (`nucleo/esquema.ts`). Sin este número, los botones de corregir y borrar
-- aparecerían en una base donde las funciones todavía no existen: un botón que
-- promete algo que la base no puede hacer.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 45; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
