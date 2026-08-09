-- =============================================================
-- MIGRACIÓN 01 — permisos explícitos
-- Para bases donde ya se corrió schema.sql ANTES de esta sección.
-- Pegar entero en el SQL Editor de Supabase y ejecutar. Es idempotente:
-- se puede correr las veces que haga falta.
--
-- Por qué: el schema daba por sentado que la plataforma ya otorgaba
-- privilegios sobre las tablas nuevas, y no lo hace. Sin esto, la app
-- entera devuelve "permission denied for table ...". Ahora el schema
-- otorga lo que necesita y nada más.
--
-- En un proyecto nuevo NO hace falta: ya está incluido en schema.sql.
-- =============================================================

grant usage on schema public to authenticated, anon;

revoke all on table
  public.profiles, public.logs, public.photos, public.weights,
  public.friendships, public.challenges, public.feedback
  from anon, authenticated;

grant select                 on public.profiles     to authenticated;
grant select, insert, delete on public.logs         to authenticated;
grant select, insert, delete on public.photos       to authenticated;
grant select                 on public.weights      to authenticated;
grant select, insert, delete on public.friendships  to authenticated;
grant select, insert, delete on public.challenges   to authenticated;
grant insert                 on public.feedback     to authenticated;
grant select                 on public.usuarios_publicos to authenticated;

grant update (username, avatar_url, dias_descanso) on public.profiles to authenticated;
grant update (estado)      on public.friendships to authenticated;
grant update (estado)      on public.challenges  to authenticated;
grant update (visibilidad) on public.photos      to authenticated;

revoke execute on function
  public.calcular_racha(uuid, date),
  public.son_amigos(uuid, uuid),
  public.registrar_dia(date, boolean, numeric),
  public.verificar_perdida(date),
  public.recalcular_desde_cero(date),
  public.cerrar_retos_vencidos(date),
  public.eliminar_amigo(uuid)
  from public, anon;

grant execute on function
  public.calcular_racha(uuid, date),
  public.son_amigos(uuid, uuid),
  public.registrar_dia(date, boolean, numeric),
  public.verificar_perdida(date),
  public.recalcular_desde_cero(date),
  public.cerrar_retos_vencidos(date),
  public.eliminar_amigo(uuid)
  to authenticated;
