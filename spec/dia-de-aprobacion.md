# El día que Apple aprueba

*Para seguir de arriba a abajo, sin saltear. Cada paso dice qué correr y qué
tiene que contestar. Si un paso no contesta lo que dice acá: **parar** e ir a §6.*

*Las consultas SQL de §1 y §2 están PROBADAS (1/10) contra PGlite replayando la
historia: original + migraciones hasta la 53, y después 54 a 58 de a una. Cada
consulta se corrió antes de su migración (da otra cosa, o error) y después (da
lo que dice acá). Las que tocan `cron` NO se pudieron probar y están marcadas.*

*El 4/10 cambiaron la 54 y la 57 (corregidas antes de aplicarlas) y se sumaron
la 59 y la 60. Sus consultas —§0, §2.1, §2.5, §2.7 y §2.8— se probaron igual:
sobre el esquema 53 sacado de git, antes y después de cada una. Lo que mira el
storage no se pudo probar (PGlite no lo tiene) y está marcado.*

Orden, y no se cambia: **verificar → migraciones → confirmar 60 → OTA → teléfono.**

Dónde se corre cada cosa:

- **[PC]** — PowerShell, en `C:\Users\agusc\ascent` (la raíz del repo).
  El guardián (`publicar-ota.mjs`, `npm run huella`) anda igual desde cualquier
  carpeta: él solo corre EAS adentro de `movil/`. Los `npx eas-cli …` **a mano**
  van SIEMPRE adentro de `movil/`: desde la raíz contestan "EAS project not
  configured" —que no es el error real— y dejan un `app.json` suelto.
- **[SQL]** — Supabase → proyecto `okeanaihymbvbdmrdqph` → SQL Editor.
- **[TEL]** — el iPhone.

---

## 0. Lo que se puede aplicar ANTES de que Apple apruebe (opcional)

Dos migraciones no dependen de la 54 a la 58 y cierran cosas graves en la base
que producción tiene HOY. Se pueden correr ya, en este orden, y **no suben la
versión** (queda en 53), así que ningún cliente se entera:

- `supabase/migracion-59-perdida-antes-del-dia.sql` — la racha que se caía a 1
  cuando el día entraba sin pasar por Inicio (por ubicación con la app cerrada,
  o marcando hoy desde el calendario). Cuida a la build de tienda, a la web y
  al teléfono a la vez.
- `supabase/migracion-60-fotos-privadas.sql` — la foto privada que otra cuenta
  podía leer anotando su ruta como propia.

**[SQL]** Después de correr las dos:
```sql
select public.version_del_esquema() as version,
       to_regprocedure('public.aplicar_perdida_al(uuid, date)') is not null as racha_cuidada,
       (select with_check like '%storage_path%' from pg_policies
         where schemaname = 'public' and tablename = 'photos' and policyname = 'fotos: dueño') as foto_cuidada;
```
→ `53`, `true`, `true`  (antes de correrlas: `53`, `false`, `false`)

**Si se corrieron acá, igual se vuelven a correr en §2.7 y §2.8.** No rompe
nada: son las mismas sentencias, y esa segunda pasada es la que sube la versión.
Está probado en ese orden (`test:db`, sección 173): 59 y 60 sobre el 53, después
la 54 a la 58, y otra vez la 59 y la 60.

Qué cambia para alguien que ya usa la app: solo el caso que estaba roto. Antes,
el día que entraba detrás de una falta sin revisar dejaba la racha en 1; ahora
gasta una vida o resta 10, igual que si hubiera abierto Inicio primero.

---

## 1. Antes de tocar nada

- [ ] **La app figura aprobada.** App Store Connect → Ascent → versión 1.0 →
      build **7**. Con "In Review" o "Waiting for Review" no se sigue.
- [ ] **[PC] El árbol está limpio y al día:**
  ```
  git pull
  git status -sb
  ```
  Tiene que decir **solo** `## main...origin/main`. La OTA publica lo que hay en
  el disco: un archivo a medio tocar viaja al teléfono.
- [ ] **[PC] Los servidores, apagados** (el guardián se niega si no):
  ```
  Get-NetTCPConnection -LocalPort 3020,8090 -State Listen -ErrorAction SilentlyContinue
  ```
  No tiene que devolver nada.
- [ ] **[PC] La sesión de EAS es la buena:**
  ```
  cd movil
  npx eas-cli whoami
  cd ..
  ```
  Primera línea: `condeag`.
- [ ] **[PC] La huella:**
  ```
  npm run huella
  ```
  Tiene que terminar en:
  ```
  COINCIDE con 2 build(s). Una OTA a `telefono` / `store` le llega.
  ```
  con la flecha `➜` en `270054e2` (telefono) y `bd30a91b` (store, la build 7 que
  aprobó Apple). El 1/10 la huella era
  `1d9312630a1e987c1066e2b6c876e92534ab778e`. Si dice **NO COINCIDE**: no hay
  OTA posible hoy; las migraciones tampoco se aplican (§6).
- [ ] **[PC] El portón:**
  ```
  npm run typecheck
  npm run lint
  npm run test:db
  ```
  Los dos primeros sin salida. `test:db`: `2190 pasaron, 0 fallaron` y
  `10 pasaron, 0 fallaron` (el primer número puede haber subido; importa el 0).
- [ ] **[SQL] De dónde se parte:**
  ```sql
  select public.version_del_esquema();
  ```
  Tiene que dar **53** (probado: la base replayada hasta la 53 contesta `53`).
  Si da más, empezar §2 en la migración siguiente a ese
  número.

---

## 2. Las migraciones — una por una

Para cada una: abrir el archivo en `supabase/`, copiarlo **entero**, pegarlo en
una pestaña nueva del SQL Editor, **Run**. Después, la verificación. No pasar a
la siguiente si la verificación no da.

**Hasta acá todo se puede dejar para otro día. A partir de la 54, no** (§6).

### 2.1 — `supabase/migracion-54-rangos-nuevos.sql`

Siete rangos, duraciones crecientes. Re-etiqueta el rango de todos; la racha no
se toca. Trae también los dos disparadores que guardan el planeta del día, sin
el borde viejo de 30 a 39 (corregida el 4/10: del 40 al 50 no se guardaba nada).

```sql
select public.version_del_esquema() as version,
       public.rango_de_racha(150)   as rango_150,
       public.planeta_de_dia(31)    as planeta_31,
       pg_get_functiondef('public.logs_before_insert()'::regprocedure) not like '%between 30 and 39%' as sin_borde_viejo;
```
→ `54`, `7`, `Ceres`, `true`  (antes de aplicarla: `53`, `8`, `Plutón`, `false`)

### 2.2 — `supabase/migracion-55-racha-nocturna.sql`

Opcional, antes de aplicarla: pegar `supabase/dry-run-descanso.sql` (solo
lectura) para ver cuántas cuentas puede tocar el arreglo del descanso. Devuelve
dos tablas: `cota_superior_cuentas_afectadas` (un número) y la lista de esas
cuentas. Probado que corre con la base en 54; el número real depende de
producción.

```sql
select public.version_del_esquema() as version,
       to_regprocedure('public.barrer_perdidas()') is not null as hay_barrido,
       to_regprocedure('public.verificar_perdida_de(uuid)') is not null as hay_verificar_de;
```
→ `55`, `true`, `true`  (antes de aplicarla: `54`, `false`, `false`)

### 2.3 — `supabase/cron-racha.sql` — UNA sola vez, recién ahora

No es una migración: no cambia la versión. Agenda el barrido de rachas cada hora.

```sql
select jobname, schedule, active from cron.job;
```
> **NO VERIFICADA.** La base de pruebas (PGlite) no tiene `pg_cron`: ni
> `cron-racha.sql` ni esta consulta se pudieron correr ahí (`relation "cron.job"
> does not exist`). Está escrita según cómo funciona pg_cron, no probada.

→ **una** fila: `barrer-perdidas-horario`, `0 * * * *`, `true`. Si hay dos
filas con ese nombre, se corrió dos veces: §6.

**Este es el punto de no retorno de los datos:** en la próxima hora en punto el
barrido le cobra la racha a toda cuenta que la tenía congelada por no abrir la
app.

### 2.4 — `supabase/migracion-56-crunch-declinado.sql`

```sql
select public.version_del_esquema() as version,
       (select nombre from public.ejercicios where id = 'crunch_declinado') as ejercicio;
```
→ `56`, `Crunch en banco declinado`  (antes de aplicarla: `55`, vacío)

### 2.5 — `supabase/migracion-57-dia-de-racha.sql`

Agrega `logs.racha_del_dia` y la rellena para los días viejos. Es la que
necesita el "día 41" de las fotos.

Corregida el 4/10: **los días anteriores a la última pérdida de cada cuenta
quedan SIN número, a propósito** (antes les ponía "día 0"). Qué día de racha era
cada uno ya no se puede saber, y la foto sin número es mejor que la foto con un
número inventado. Los de después de la pérdida llevan el suyo, exacto.

```sql
select public.version_del_esquema() as version,
       (select count(*) from public.logs l join public.profiles p on p.id = l.user_id
         where l.racha_del_dia is null
           and (p.perdida_fecha is null or l.fecha > p.perdida_fecha)) as les_falta_el_dia,
       (select count(*) from public.logs where racha_del_dia = 0 and not es_descanso) as con_dia_cero;
```
→ `57`, `0`, `0`

Antes de aplicarla esta consulta da ERROR (`column l.racha_del_dia does not
exist`): es lo esperado, la columna la crea la 57.

> **Los dos ceros están verificados solo a medias.** Se probó con una cuenta
> sembrada en la base de pruebas: doce días, una pérdida y ocho más (los doce
> quedaron sin número y los ocho con día 3 a 10). Con los logs reales de
> producción no se pudo probar. Si ahí alguno da más de `0`: parar, §6.

### 2.6 — `supabase/migracion-58-peso-corporal.sql`

```sql
select public.version_del_esquema() as version,
       pg_get_constraintdef(oid) like '%corporal%' as acepta_corporal
  from pg_constraint where conname = 'ejercicios_carga_valida';
```
→ `58`, `true`  (antes de aplicarla: `57`, `false`)

### 2.7 — `supabase/migracion-59-perdida-antes-del-dia.sql`

La pérdida de racha se revisa en la base antes de que entre cualquier día nuevo:
ya no depende de haber abierto Inicio. Si se corrió en §0, se corre de nuevo acá.

```sql
select public.version_del_esquema() as version,
       to_regprocedure('public.aplicar_perdida_al(uuid, date)') is not null as hay_cuenta,
       exists (select 1 from pg_trigger
                where tgname = 'trg_logs_antes_perdida' and not tgisinternal) as hay_disparador;
```
→ `59`, `true`, `true`  (antes de aplicarla: `58`, `false`, `false`; o `58`,
`true`, `true` si ya se había corrido en §0)

### 2.8 — `supabase/migracion-60-fotos-privadas.sql`

La ruta de una foto tiene que ser de quien la anota. Si se corrió en §0, se
corre de nuevo acá.

```sql
select public.version_del_esquema() as version,
       (select with_check like '%storage_path%' from pg_policies
         where schemaname = 'public' and tablename = 'photos' and policyname = 'fotos: dueño') as fotos_mira_la_ruta,
       (select qual like '%foldername%' and qual like '%user_id%' from pg_policies
         where schemaname = 'storage' and tablename = 'objects'
           and policyname = 'fotos storage: amigos leen visibles') as storage_mira_la_carpeta;
```
→ `60`, `true`, `true`  (antes de aplicarla: `59`, `false`, `false`; o `59`,
`true`, `true` si ya se había corrido en §0)

> **La tercera columna NO ESTÁ VERIFICADA.** La base de pruebas no tiene el
> storage de Supabase, así que la regla de storage se probó contra una tabla de
> reemplazo (`test:db`, sección 172) y esta columna no se pudo correr. Las otras
> dos sí.

---

## 3. Confirmar que producción quedó en 60

**[PC]**
```
npm run test:conexion
```

Tiene que decir, arriba:
```
  ok   producción al día (esquema 60, repo va por 60)
```
y al final `N pasaron, 0 fallaron`, sin el cartel de "PRODUCCIÓN ESTÁ N
MIGRACIÓN(ES) ATRÁS" ni ninguna línea `FALTA en producción` / `SOBRA en
producción`.

Con un solo `FALLA`: **no publicar la OTA**. Ir a §6.

---

## 4. La OTA — recién ahora

Siempre con el guardián, nunca con `eas-cli update` a mano. Primero el teléfono
propio, se mira, y después la tienda.

Los comandos de abajo se corren tal cual, parados en la raíz del repo
(`C:\Users\agusc\ascent`). Probado el 3/10 en seco desde la raíz, desde
`movil/` y desde otra carpeta: da lo mismo.

### 4.1 — Canal `telefono`

**[PC]** En seco:
```
node supabase/publicar-ota.mjs telefono "tanda 9: album, bienvenida, dia en foto, peso corporal" --simular
```
→ `DRY-RUN: coincide, PUBLICARÍA. No se publicó nada (--simular).`

De verdad (la misma línea, sin `--simular`):
```
node supabase/publicar-ota.mjs telefono "tanda 9: album, bienvenida, dia en foto, peso corporal"
```
→ termina con el "Published!" de EAS.

**Ahora §5 entero, en el teléfono, antes de seguir.**

### 4.2 — Canal `store` — solo si §5 dio bien

**[PC]** En seco:
```
node supabase/publicar-ota.mjs store "tanda 9: album, bienvenida, dia en foto, peso corporal" --simular
```
→ `DRY-RUN: coincide, PUBLICARÍA. No se publicó nada (--simular).`

De verdad:
```
node supabase/publicar-ota.mjs store "tanda 9: album, bienvenida, dia en foto, peso corporal"
```

**Publicar a `store` es el punto de no retorno de la app:** le llega a toda
persona que la haya bajado de la tienda.

Si el guardián dice `NO es el runtime de ninguna build` o `No pude consultar
EAS`: no publicó nada. No insistir ni saltearlo: §6.

---

## 5. Qué mirar en el teléfono

La OTA baja al **abrir** la app y la reinicia sola a los tres segundos (con el
cronómetro corriendo no reinicia: se aplica en la apertura siguiente). Abrir,
esperar el reinicio, y recién ahí probar. Si no reinició: cerrar la app del todo
y abrirla de nuevo.

- [ ] **El deslizar del álbum.** Abrir una foto y pasar a la siguiente y a la
      anterior con el dedo. Un toque corto la cierra. (Nunca se probó en un
      iPhone de verdad: esta es la primera vez.)
- [ ] **"día N" en la foto.** Con una foto abierta, al lado de la fecha dice
      `día 41` (el número de racha de ese día). Si no aparece: cerrar la app del
      todo y reabrir —la versión del esquema se pregunta una vez por arranque—.
      Si sigue sin aparecer, la 57 no está: volver a §3.
- [ ] **Las diapositivas de bienvenida.** Cerrar sesión: tienen que aparecer las
      cuatro antes del login (la 2ª con la lista de ejercicios, la 3ª con los
      objetos flotando, la 4ª con el agujero negro). Repetir **tres veces**:
  - cerrar sesión → bienvenida → entrar;
  - cerrar la app del todo en medio de la bienvenida → reabrir;
  - cerrar sesión y entrar varias veces seguidas.

  Tienen que salir cada vez, sin pantalla negra y sin que la app se cierre.
- [ ] **Peso corporal.** En un ejercicio de core, el modo de carga ofrece el de
      peso corporal: esconde el campo de peso y cuenta solo las series.
- [ ] **Inicio abre normal**, con la racha y el rango de siempre.

---

## 6. Si algo sale mal

| Dónde estás | Qué se puede deshacer |
|---|---|
| Antes de la 54 | Todo. No se tocó nada: se deja para otro día. |
| Entre la 54 y `cron-racha.sql` | El esquema no vuelve atrás (no hay scripts de reversa para 54–60 y la versión solo sube). No se perdió ningún dato: se sigue para adelante. |
| Después de `cron-racha.sql` | El barrido se puede **frenar**, pero las rachas que ya cobró no vuelven solas. |
| Después de la OTA a `telefono` | Solo la ve tu teléfono. Se corrige y se publica otra. |
| Después de la OTA a `store` | Ya está en la calle. Se arregla publicando otra OTA encima. |

**Una migración tira error.** Parar. No pegar la siguiente. No volver a correr
la misma a ciegas. Correr:
```sql
select public.version_del_esquema();
```
y `npm run test:conexion` en la PC: entre los dos dicen qué quedó aplicado y
qué no. Guardar el texto del error.

**Frenar el barrido de rachas** (deja de correr; no devuelve nada). **NO
VERIFICADA**: usa `pg_cron`, que la base de pruebas no tiene.
```sql
select cron.unschedule('barrer-perdidas-horario');
```

**`cron-racha.sql` se corrió dos veces.** Mirar `select jobid, jobname from
cron.job;` (tampoco verificada: `pg_cron`). Si hay dos, frenar con la línea de arriba y volver a correr
`cron-racha.sql` una vez.

**Quedaste a mitad de las migraciones** (por ejemplo en 56). La app aguanta: el
"día N" y el peso corporal se prenden solos cuando el esquema llega a 57 y 58.
Lo que no hay que hacer es publicar la OTA con `test:conexion` en rojo.

**El guardián se niega.** Es el guardián funcionando. `npm run huella` dice con
qué builds coincide la huella; si no coincide con ninguna hace falta una build
nueva, y eso ya no es de hoy.

**El guardián dice "No pude consultar EAS".** Debajo imprime lo que contestó el
comando. Si son líneas `npm error`, falló npm antes de llegar a EAS —pasó el
3/10, por un archivo que faltaba en su caché—: no publicó nada, se vuelve a
correr el mismo comando. NO repetir `npx eas-cli …` a mano desde la raíz para
"ver el error": ahí falla por otra cosa. Y nunca `eas init`.

**La OTA rompió algo en el teléfono.** No publicar a `store`. Arreglar, commit,
y publicar de nuevo a `telefono` por §4.1.

**La OTA a `store` rompió algo.** El camino probado es el mismo: arreglar y
publicar otra con el guardián. EAS también tiene `npx eas-cli update:republish`
para volver a poner un grupo anterior, pero pasa por fuera del guardián y nunca
se usó en este proyecto.
