# Reinstalar Ascent en una máquina recién formateada

*Para seguirlo solo, de arriba a abajo, sin dar nada por sabido. Al terminar
tenés el proyecto corriendo, los tests en verde, EAS conectado y sabés cómo
publicar un OTA y aplicar las migraciones que falten.*

*Punto de partida: una computadora vacía, el repositorio en GitHub, y **dos
archivos de claves** guardados en la nube. Nada más de esta máquina hace falta
para que TODO vuelva a andar.*

---

## 0. Antes de formatear — el respaldo (leer esto primero)

Lo único de esta máquina que NO está en GitHub y hace falta son **dos archivos**:

| Archivo en el proyecto | Qué tiene |
|---|---|
| `ascent/.env.local` | Claves de Supabase (anon), cuentas de prueba (`PRUEBA_UNO/DOS`, `CONEXION_*`), la de revisión de Apple (`DEMO_EMAIL/DEMO_PASSWORD`), y `REPORTE_DEMO_A/B` |
| `ascent/movil/.env` | `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

Están respaldados en el Escritorio, carpeta **`ascent-respaldo`** (que como el
Escritorio está adentro de OneDrive, ya sube sola a la nube). Estructura:
`ascent-respaldo/.env.local` y `ascent-respaldo/movil/.env`.

> **OJO — el respaldo puede estar desactualizado.** Comprobá que
> `ascent-respaldo/.env.local` sea igual al `ascent/.env.local` de ahora ANTES
> de formatear. Si difieren, copiá el del proyecto sobre el del respaldo:
> ```
> copy C:\Users\agusc\ascent\.env.local C:\Users\agusc\OneDrive\Escritorio\ascent-respaldo\.env.local
> ```
> (`movil/.env` casi no cambia; `.env.local` sí, cada vez que se agrega una
> cuenta de prueba.) Estos archivos tienen secretos: guardá el respaldo en un
> lugar seguro.

**Todo lo demás vive en la nube o se regenera** (ver §7). Lo irrecuperable son
esos dos archivos.

---

## 1. Instalar, en este orden

1. **Node 22 o más** (esta máquina tenía v24.16 con npm 11). De nodejs.org.
   Comprobar: `node --version` y `npm --version`.
2. **Git**. Comprobar: `git --version`.
3. **VS Code** (o el editor que uses).
4. **GitHub**: iniciar sesión (GitHub Desktop, o `gh auth login`, o dejar que
   `git` pida las credenciales al primer `push`).

La CLI de Expo viaja como dependencia del proyecto. La de EAS **no**:
`npx eas-cli ...` la baja sola la primera vez (pide confirmar). **El paquete se
llama `eas-cli`, no `eas`:** `npx eas ...` falla con "could not determine
executable to run" salvo que esté instalada global (`npm i -g eas-cli`, que
deja el comando `eas` a secas).

## 2. Clonar y poner las claves

```
git clone https://github.com/condezuzu/ascent.git
cd ascent
```

Copiar los dos archivos del respaldo **a estas rutas exactas**:

- `ascent-respaldo/.env.local`  →  `ascent/.env.local`  (la RAÍZ del repo)
- `ascent-respaldo/movil/.env`  →  `ascent/movil/.env`

Son archivos ocultos (empiezan con `.`); en el explorador hay que activar "ver
archivos ocultos", o copiarlos por consola. Sin ellos, `npm run dev` arranca
pero no conecta con Supabase, y los tests contra la nube fallan.

## 3. Instalar dependencias (son DOS proyectos)

```
npm install
cd movil && npm install && cd ..
```

(En PowerShell 5.1, el de Windows por defecto, `&&` no existe: correr las tres
órdenes por separado.)

Para `npm run capturas`, `test:real` y el resto de lo que abre un navegador,
una vez por máquina: `npx playwright install chromium` (el binario no viene con
`npm install`). El portón de §4 no lo necesita.

## 4. Comprobar que quedó bien

```
npm run test:db
```
Tiene que decir, sin red y en segundos:
```
2190 pasaron, 0 fallaron
10 pasaron, 0 fallaron
```
(Compara el `schema.sql` del repo con el original + todas las migraciones
replayadas. Si el primer número cambió es porque se agregaron tests/ejercicios;
lo que importa es **0 fallaron**.)

```
npm run typecheck    # sin salida = bien (web + movil)
npm run lint         # sin salida = bien
npm run dev          # web en http://localhost:3020
```

Contra PRODUCCIÓN (necesita `.env.local` y que el schema de prod esté al día):
```
npm run test:conexion
```
Le pide a la base real su propio retrato y lo compara con el repo. Si da rojo
diciendo que el esquema no coincide, faltan aplicar migraciones (§6).

## 5. EAS / Expo (para las builds y los OTA del teléfono)

```
cd movil
npx eas-cli login
npx eas-cli whoami
npx eas-cli build:list --platform ios --limit 3
cd ..
```

- **La cuenta dueña del proyecto es `condeag`.** El proyecto está atado a ella
  en `movil/app.json` (`owner: "condeag"`, `extra.eas.projectId:
  0946b9e1-20a2-4471-8c77-fdf937d7cfa8`).
- **Si EAS "no reconoce la cuenta"** (dice que no tenés acceso al proyecto, o
  `whoami` muestra otro usuario): entraste con una cuenta distinta de `condeag`.
  `npx eas-cli logout` y volvé a entrar como `condeag`. NO cambies el `owner` ni el
  `projectId` del `app.json` para "arreglarlo": eso rompe el vínculo con las
  builds y los OTA de verdad.
- **Las credenciales de firma de Apple (certificado + perfiles) viven en EAS**,
  no en esta máquina (se comprobó: no hay `.p8`/`.p12`/`.mobileprovision` en el
  repo). Con el login vuelven solas; no hay que recrear nada.
- Una capacidad nueva (HealthKit) o un target nuevo (widget) sí necesitan que el
  humano corra `npx eas-cli build --platform ios --profile telefono` UNA vez de forma
  interactiva, para crear el App ID / perfil contra Apple. `--non-interactive`
  reusa el perfil viejo y falla. Detalle en `movil/EAS.md`.

## 6. Aplicar las migraciones que falten (en producción)

**Una base NUEVA no necesita ninguna:** `supabase/schema.sql` ya las incluye a
todas y `npm run test:db` lo verifica. Esto es solo para **producción**, que el
formateo NO toca (vive en Supabase, en la nube).

Las migraciones **las aplica el humano** en el SQL Editor de Supabase: en
`.env.local` solo está la anon key, así que desde una sesión de Claude no se
puede tocar el schema real. El flujo de siempre: escribir la migración → probar
con `npm run test:db` (PGlite) → aplicarla a mano.

**Orden para ponerse al día:**

1. En el SQL Editor, correr `select public.version_del_esquema();`. Devuelve el
   número de lo último aplicado.
2. El repo apunta a la versión **58** (lo dice `version_del_esquema()` en
   `schema.sql`). Aplicá, **en orden numérico**, cada
   `supabase/migracion-NN-*.sql` cuyo número sea mayor al que devolvió la base.
   No saltear ninguno: cada uno sube `version_del_esquema()` a su número.
3. **Pendientes conocidas al escribir esto: 54, 55, 56, 57 y 58**, en ese orden
   (rangos nuevos, racha nocturna, crunch declinado, día de racha, peso
   corporal): producción está en 53. Si la base ya está en 58, no hay nada que
   aplicar.
4. **Después de la 55**, correr UNA vez `supabase/cron-racha.sql` (agenda el
   barrido horario de rachas). **No es una migración** —usa `pg_cron`, que
   PGlite no tiene— por eso va aparte y no lo aplica `test:db`. Alternativa sin
   pg_cron: un Vercel Cron que llame `barrer_perdidas` con el service_role; ver
   el encabezado de ese archivo.
5. Comprobar con `npm run test:conexion` que prod y repo coinciden.

> Hay UN objeto que vive **solo en producción** y no está en el repo: el trigger
> `sugerencia-nueva` sobre `feedback` (su definición no puede ir a un repo
> público). Está anotado en `SOLO_EN_PRODUCCION` dentro de
> `supabase/verificar-conexion.mjs`. Si el correo de sugerencias deja de llegar,
> mirá ese trigger en el panel. No hace falta recrearlo para reinstalar.

## 7. Publicar un OTA desde cero, con el guardián

Un OTA manda el JavaScript nuevo por el aire a una build ya instalada. **Solo le
llega a las builds cuya huella nativa es idéntica** a la del proyecto al
publicar (`runtimeVersion` es `{policy: "fingerprint"}`). Si no coincide, `eas
update` igual dice "Published!" y no le llega a nadie —un éxito silencioso—. Por
eso NO se publica con `eas update` a mano: se usa el guardián.

1. **Apagá los servidores de desarrollo** (:3020 y :8090). El guardián se niega
   a publicar si están prendidos: la huella tiene que ser una foto quieta.
2. Comprobar qué hay instalado y si la huella coincide:
   ```
   npm run huella
   ```
   Compara la huella de ahora con la de la build instalada, anotada a mano en
   `INSTALADA` dentro de `supabase/huella.mjs`. Si no coinciden, dice qué archivo
   la movió (basta un fin de línea distinto en `app.json`/`eas.json`/config
   plugins para romperla).
3. Publicar:
   ```
   node supabase/publicar-ota.mjs store "mensaje del cambio"
   ```
   (o `npm run ota store "mensaje"`.) El canal `store` es el de la build de la
   tienda. El guardián **lee el registro de EAS** (`eas build:list`) y solo
   publica si una build `store` REAL lleva esta huella; si no, corta —nunca
   publica al vacío—.
   - Dry-run (no publica): agregar `--simular`.
4. **Cuando instales una build nueva en el teléfono, actualizá `INSTALADA` en
   `supabase/huella.mjs`.** Es a mano y a propósito: es el único lugar donde
   está escrito qué hay en el teléfono de verdad.

> **Trabajo nativo = rama aparte.** Tocar `app.json`, Info.plist, entitlements o
> un módulo nativo en `main` cambia la huella y **corta los OTA a la build
> instalada en el acto**. Ese trabajo va en una rama hasta que haya una build
> nueva. TypeScript puro sí viaja por OTA sin problema.

## 8. La cuenta que abre Apple (App Review)

App Review entra con el usuario/contraseña de la ficha y ve la app con esa
cuenta. Vacía no se entiende. Para dejarla con contenido:
```
node --env-file=.env.local supabase/cuenta-de-revision.mjs          # crea/completa
node --env-file=.env.local supabase/cuenta-de-revision.mjs --de-cero # la borra y rehace
```
Las credenciales salen de `.env.local` (`DEMO_EMAIL`/`DEMO_PASSWORD`) y están
también en App Store Connect. Entra por la anon key con RLS puesta, igual que un
usuario: si el script corre, la app también puede.

## 9. Qué NO está en el repositorio (y por lo tanto no se recupera solo)

- **Los dos archivos de claves** (`.env.local`, `movil/.env`): del respaldo de
  OneDrive. Sin ellos, las claves de Supabase se sacan del panel, pero las
  contraseñas de las cuentas de prueba/demo habría que rotarlas.
- **Las capturas de la ficha de la tienda**: la selección final (5 PNG +
  `veredicto.md`) está en el Escritorio, carpeta **`ascent-tienda`** (en
  OneDrive). Las crudas (`capturas-tienda/` en el repo) están ignoradas por git
  pero se regeneran con `node --env-file=.env.local supabase/capturas.mjs` y
  afines.
- **Credenciales de firma de Apple**: en EAS (§5). Vuelven con `eas login`.
- **Variables de producción**: en los paneles de **Vercel** (deploy web:
  `ascent-blush-seven.vercel.app`) y **Supabase** (proyecto
  `okeanaihymbvbdmrdqph`). El `.env.local` es solo para correr local.
- **Sesiones de las apps de escritorio** (Claude, navegador): se vuelven a
  loguear, no son del proyecto.
- `node_modules/`, `.next*/`, `.expo/`, `capturas/`: se regeneran, no se
  respaldan.

## 10. Dónde está cada cosa

- **Código:** `C:\Users\agusc\ascent` (fuera de OneDrive a propósito).
- **Repo:** https://github.com/condezuzu/ascent, rama `main`.
- **Web en producción:** https://ascent-blush-seven.vercel.app (deploy desde Vercel).
- **Supabase:** proyecto `okeanaihymbvbdmrdqph`.
- **App Store Connect:** app "Ascent — Streak & Strength", ASC App ID
  `6815006917`, bundle `uy.ascent.app`, Apple Team `XF9N8X9KJG`.
- **Docs de referencia:** `spec/estado.md` (qué está hecho y qué falta),
  `movil/EAS.md` (builds y OTA en detalle), `spec/etapa-nativa.md` (lo que solo
  se prueba en un iPhone), `spec/trampas.md` (los tests que cuidan las reglas).
