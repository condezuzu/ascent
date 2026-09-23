-- =============================================================
-- MIGRACIÓN 46 — Las medallas por marca, para que las vean tus amigos
--
-- Va DESPUÉS de la 45. Ejecutar entera en el SQL Editor de Supabase.
--
-- NO CAMBIA NINGÚN DATO y no toca ninguna función existente. Agrega UNA tabla
-- y UNA función de lectura. Si no se corre, la app queda exactamente como hoy:
-- tus medallas se ven en tu perfil y en tu Inicio, y en el de un amigo no
-- aparece nada.
-- =============================================================

-- -------------------------------------------------------------
-- 1. POR QUÉ HACE FALTA UNA TABLA
-- -------------------------------------------------------------
-- La medalla sale de un percentil, y el percentil se calcula con TRES cosas:
-- tu mejor marca, tu peso corporal y tu sexo. Las tres las tiene el dueño y
-- solo el dueño: **el peso corporal de otra persona no se ve nunca, ni entre
-- amigos** (§16.7). Así que un amigo no puede calcular tu medalla ni queriendo.
--
-- LAS DOS SALIDAS ERAN:
--
--   a) Calcularlo en SQL, metiendo las cinco tablas de Strength Level también
--      en la base. Serían DOS COPIAS de la fuente —una en `nucleo/estandares.ts`
--      y otra acá— y la que se corrija primero deja a la otra mintiendo. Es
--      exactamente lo que el repo viene evitando.
--   b) GUARDAR EL PERCENTIL, calculado por el dueño, que es quien tiene los
--      tres datos. Los amigos leen un número derivado y nunca el peso.
--
-- Va la (b). La tabla de estándares sigue viviendo en un solo lugar.
--
-- LO QUE SE GUARDA ES EL PERCENTIL Y NADA MÁS. El material —luna, planeta,
-- estrella— y la regla de la galaxia se derivan de él, y esa derivación vive en
-- `nucleo/medallas.ts`, que es de las dos apps. Guardar el material además del
-- percentil sería guardar la misma verdad dos veces y poder contradecirse.
--
-- NO FILTRA NADA NUEVO. El percentil es más pobre que lo que un amigo ya ve:
-- `ranking_fuerza` le da tu DOTS exacto y tus marcas, y con esos dos el peso
-- corporal ya se despeja (§16.7b, aceptado a propósito). Un "estás arriba del
-- 80%" no agrega nada a eso.

create table if not exists public.medallas (
  user_id   uuid not null references auth.users(id) on delete cascade,
  -- El id del ejercicio, tal cual el catálogo: 'press_banca', 'sentadilla'…
  ejercicio text not null,
  -- A cuánta gente le gana, de 1 a 99. Lo topa la fuente en 95: la tabla no
  -- tiene con qué separar al 96 del 99,9 (ver `ubicar` en estandares.ts).
  percentil smallint not null check (percentil between 1 and 99),
  actualizado timestamptz not null default now(),
  primary key (user_id, ejercicio)
);

alter table public.medallas enable row level security;

-- -------------------------------------------------------------
-- 2. QUIÉN VE QUÉ
-- -------------------------------------------------------------
-- Leer: vos y tus amigos aceptados, con el mismo `son_amigos` que ya deciden
-- los logs y las fotos. Escribir: solo vos, y solo tus propias filas.
--
-- SE ESCRIBE DESDE EL CLIENTE Y ESTÁ BIEN. Es un valor derivado de datos que
-- ya son tuyos: el peor caso de que alguien escriba acá un número inventado es
-- mentirles a sus propios amigos sobre su propia medalla, que es exactamente
-- lo mismo que podría hacer cargando una marca falsa. No hay nada que proteger
-- que no esté ya protegido un escalón más abajo.

drop policy if exists "medallas: leer" on public.medallas;
create policy "medallas: leer" on public.medallas for select
  using (auth.uid() = user_id or public.son_amigos(auth.uid(), user_id));

drop policy if exists "medallas: escribir" on public.medallas;
create policy "medallas: escribir" on public.medallas for insert
  with check (auth.uid() = user_id);

drop policy if exists "medallas: actualizar" on public.medallas;
create policy "medallas: actualizar" on public.medallas for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "medallas: borrar" on public.medallas;
create policy "medallas: borrar" on public.medallas for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.medallas to authenticated;

-- -------------------------------------------------------------
-- 3. LEER LAS DE UN AMIGO
-- -------------------------------------------------------------
-- Una función y no un `select` directo, por lo mismo que el resto: la política
-- ya alcanza, pero una función con `security invoker` deja el contrato escrito
-- en un solo lugar y le da a la app un nombre estable que no depende de cómo
-- se llamen las columnas.
--
-- DEVUELVE EL PERCENTIL CRUDO. El material y la galaxia los arma el cliente
-- con `nucleo/medallas.ts`, que es donde viven esas reglas para las dos apps.

create or replace function public.medallas_de(p_user uuid)
returns table (ejercicio text, percentil smallint)
language sql
stable
security invoker
set search_path = public
as $$
  select m.ejercicio, m.percentil
    from public.medallas m
   where m.user_id = p_user
$$;

grant execute on function public.medallas_de(uuid) to authenticated;

-- -------------------------------------------------------------
-- 4. QUÉ PASA CUANDO CAMBIÁS DE PESO O CORREGÍS TU SEXO
-- -------------------------------------------------------------
-- El percentil depende de los dos, así que un peso nuevo o un sexo corregido
-- cambian la respuesta. NO HAY TRIGGER: la fila se reescribe desde el cliente
-- cada vez que se calculan las medallas, que es al abrir tu perfil y al cargar
-- Inicio. Con eso alcanza y sobra —son las dos pantallas que más se abren— y
-- evita meter la tabla de estándares en la base para recalcular acá.
--
-- OJO CON ESTO, QUE ES UNA DECISIÓN DE PRODUCTO Y NO TÉCNICA: **esta fila solo
-- puede SUBIR**. El cálculo corre de cero con el peso y el sexo de hoy, pero
-- lo que se escribe es el mayor entre eso y lo que ya había (`topeHistorico`,
-- en `nucleo/medallas.ts`). O sea: el percentil se mantiene al día y la
-- medalla no se pierde. Engordar tres kilos ya no te baja de planeta a luna.
--
-- LA TABLA NO LO IMPONE, y es a propósito: quien decide es el cliente, que es
-- el único que tiene la tabla de estándares. Si algún día se quiere que la
-- base lo garantice, va un trigger con `greatest(new.percentil, old.percentil)`
-- y el cliente no se toca. Hasta entonces, esto es un comentario, no una
-- restricción.

-- -------------------------------------------------------------
-- 5. LA VERSIÓN DEL ESQUEMA
-- -------------------------------------------------------------
-- La app pregunta esto antes de usar lo que depende de una migración
-- (`nucleo/esquema.ts`). Sin este número, el perfil de un amigo llamaría a
-- `medallas_de` en una base donde la función todavía no existe.
create or replace function public.version_del_esquema()
returns int language sql immutable as $$ select 46; $$;

revoke execute on function public.version_del_esquema() from public;
grant execute on function public.version_del_esquema() to anon, authenticated;
