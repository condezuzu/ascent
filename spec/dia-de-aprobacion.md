# El día que Apple aprueba

*Para seguir de arriba a abajo, sin saltear. Cada paso dice qué correr y qué
tiene que contestar. Si un paso no contesta lo que dice acá: **parar** e ir a §6.*

Orden, y no se cambia: **verificar → migraciones → confirmar 58 → OTA → teléfono.**

Dónde se corre cada cosa:

- **[PC]** — PowerShell, en `C:\Users\agusc\ascent`.
- **[SQL]** — Supabase → proyecto `okeanaihymbvbdmrdqph` → SQL Editor.
- **[TEL]** — el iPhone.

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
  Tiene que dar **53**. Si da más, empezar §2 en la migración siguiente a ese
  número.

---

## 2. Las migraciones — una por una

Para cada una: abrir el archivo en `supabase/`, copiarlo **entero**, pegarlo en
una pestaña nueva del SQL Editor, **Run**. Después, la verificación. No pasar a
la siguiente si la verificación no da.

**Hasta acá todo se puede dejar para otro día. A partir de la 54, no** (§6).

### 2.1 — `supabase/migracion-54-rangos-nuevos.sql`

Siete rangos, duraciones crecientes. Re-etiqueta el rango de todos; la racha no
se toca.

```sql
select public.version_del_esquema(), public.rango_de_racha(150), public.planeta_de_dia(31);
```
→ `54`, `7`, `Ceres`

### 2.2 — `supabase/migracion-55-racha-nocturna.sql`

Opcional, antes de aplicarla: pegar `supabase/dry-run-descanso.sql` (solo
lectura) para ver cuántas cuentas puede tocar el arreglo del descanso.

```sql
select public.version_del_esquema(),
       to_regprocedure('public.barrer_perdidas()') is not null,
       to_regprocedure('public.verificar_perdida_de(uuid)') is not null;
```
→ `55`, `true`, `true`

### 2.3 — `supabase/cron-racha.sql` — UNA sola vez, recién ahora

No es una migración: no cambia la versión. Agenda el barrido de rachas cada hora.

```sql
select jobname, schedule, active from cron.job;
```
→ **una** fila: `barrer-perdidas-horario`, `0 * * * *`, `true`. Si hay dos
filas con ese nombre, se corrió dos veces: §6.

**Este es el punto de no retorno de los datos:** en la próxima hora en punto el
barrido le cobra la racha a toda cuenta que la tenía congelada por no abrir la
app.

### 2.4 — `supabase/migracion-56-crunch-declinado.sql`

```sql
select public.version_del_esquema(),
       (select nombre from public.ejercicios where id = 'crunch_declinado');
```
→ `56`, `Crunch en banco declinado`

### 2.5 — `supabase/migracion-57-dia-de-racha.sql`

Agrega `logs.racha_del_dia` y la rellena para los días viejos. Es la que
necesita el "día 41" de las fotos.

```sql
select public.version_del_esquema(),
       (select count(*) from public.logs where racha_del_dia is null);
```
→ `57`, `0`

### 2.6 — `supabase/migracion-58-peso-corporal.sql`

```sql
select public.version_del_esquema(),
       pg_get_constraintdef(oid) like '%corporal%'
  from pg_constraint where conname = 'ejercicios_carga_valida';
```
→ `58`, `true`

---

## 3. Confirmar que producción quedó en 58

**[PC]**
```
npm run test:conexion
```

Tiene que decir, arriba:
```
  ok   producción al día (esquema 58, repo va por 58)
```
y al final `N pasaron, 0 fallaron`, sin el cartel de "PRODUCCIÓN ESTÁ N
MIGRACIÓN(ES) ATRÁS" ni ninguna línea `FALTA en producción` / `SOBRA en
producción`.

Con un solo `FALLA`: **no publicar la OTA**. Ir a §6.

---

## 4. La OTA — recién ahora

Siempre con el guardián, nunca con `eas-cli update` a mano. Primero el teléfono
propio, se mira, y después la tienda.

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
| Entre la 54 y `cron-racha.sql` | El esquema no vuelve atrás (no hay scripts de reversa para 54–58 y la versión solo sube). No se perdió ningún dato: se sigue para adelante. |
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

**Frenar el barrido de rachas** (deja de correr; no devuelve nada):
```sql
select cron.unschedule('barrer-perdidas-horario');
```

**`cron-racha.sql` se corrió dos veces.** Mirar `select jobid, jobname from
cron.job;`. Si hay dos, frenar con la línea de arriba y volver a correr
`cron-racha.sql` una vez.

**Quedaste a mitad de las migraciones** (por ejemplo en 56). La app aguanta: el
"día N" y el peso corporal se prenden solos cuando el esquema llega a 57 y 58.
Lo que no hay que hacer es publicar la OTA con `test:conexion` en rojo.

**El guardián se niega.** Es el guardián funcionando. `npm run huella` dice con
qué builds coincide la huella; si no coincide con ninguna hace falta una build
nueva, y eso ya no es de hoy.

**La OTA rompió algo en el teléfono.** No publicar a `store`. Arreglar, commit,
y publicar de nuevo a `telefono` por §4.1.

**La OTA a `store` rompió algo.** El camino probado es el mismo: arreglar y
publicar otra con el guardián. EAS también tiene `npx eas-cli update:republish`
para volver a poner un grupo anterior, pero pasa por fuera del guardián y nunca
se usó en este proyecto.
