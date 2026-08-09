-- =============================================================
-- MIGRACIÓN 02 — recalcular el planeta del día al corregir días
-- Para bases donde ya se corrió schema.sql. Pegar en el SQL Editor.
-- Idempotente: se puede correr las veces que haga falta.
--
-- Por qué: el planeta se fijaba al insertar el log y no se volvía a tocar.
-- Al agregar a mano un día viejo, todos los días posteriores cambian de
-- racha, y el álbum quedaba mostrando la secuencia de planetas corrida.
--
-- En un proyecto nuevo NO hace falta: ya está incluido en schema.sql.
-- =============================================================

create or replace function public.logs_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
  desde date := coalesce(new.fecha, old.fecha);
  hasta date;
  base int;
  r int;
begin
  select coalesce(max(fecha), current_date) into hasta from logs where user_id = uid;
  select racha_base into base from profiles where id = uid;
  r := base + calcular_racha(uid, hasta);
  update profiles set
    racha_actual = r,
    mejor_racha = greatest(mejor_racha, r),
    rango_actual = rango_de_racha(r)
  where id = uid;

  if pg_trigger_depth() = 1 then
    update logs l set planeta_del_dia = c.nuevo
      from (
        select id, case when r2 between 30 and 39 then planeta_de_dia(r2) else null end as nuevo
          from (
            select x.id, base + calcular_racha(uid, x.fecha) as r2
              from logs x
             where x.user_id = uid and not x.es_descanso and x.fecha >= desde
          ) t
      ) c
     where l.id = c.id and l.planeta_del_dia is distinct from c.nuevo;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Reparar lo ya guardado: recalcula el planeta de todos los días existentes.
-- Un update por usuario dispara el trigger de arriba, que arregla el resto.
do $$
declare
  u record;
begin
  for u in select distinct user_id from public.logs loop
    update public.logs l set planeta_del_dia = c.nuevo
      from (
        select id, case when r2 between 30 and 39 then public.planeta_de_dia(r2) else null end as nuevo
          from (
            select x.id,
                   (select racha_base from public.profiles where id = u.user_id)
                     + public.calcular_racha(u.user_id, x.fecha) as r2
              from public.logs x
             where x.user_id = u.user_id and not x.es_descanso
          ) t
      ) c
     where l.id = c.id and l.planeta_del_dia is distinct from c.nuevo;
  end loop;
end $$;
