# Ascent

Racha de gimnasio a escala del universo. PWA en Next.js + Supabase + three.js.
La especificación vive en `CLAUDE.md` (índice) y `spec/` (por tema). `CLAUDE.md` es lo único que se lee siempre.

## Puesta en marcha (una sola vez)

1. **Supabase**: crear un proyecto en [supabase.com](https://supabase.com) (región `sa-east-1`, São Paulo, es la más cercana).
2. En el **SQL Editor** del proyecto, pegar y ejecutar entero `supabase/schema.sql`. Eso crea tablas, triggers de racha, RLS y los buckets de storage.
3. En **Authentication → Providers**, activar Email y Google (para Google hay que cargar Client ID/Secret de Google Cloud Console).
4. En **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3020` (cambiar a la URL de Vercel al deployar)
   - **Redirect URLs**, una por línea:
     - `http://localhost:3020/auth/callback` — alta por correo y login con Google
     - `http://localhost:3020/auth/recuperar` — recuperar contraseña
     - los dos equivalentes con `https://TU-APP.vercel.app` cuando haya deploy

   Si falta el de recuperar, el correo llega pero el enlace rebota al login.
5. Copiar `.env.example` a `.env.local` y completar con la URL y la anon key del proyecto (Settings → API).
6. `npm install` y `npm run dev` → http://localhost:3020

## Deploy en Vercel

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel --prod
```

## Verificar

```bash
npm run test:db
```

Corre `supabase/schema.sql` contra un Postgres real (PGlite, en WASM) con stubs
de lo que aporta Supabase, y verifica la matemática de racha, rangos, planeta del
día, pérdida (−10), días de descanso, permisos y políticas de RLS. No necesita
cuenta ni red. Correrlo después de tocar el schema.

```bash
npm run test:conexion
```

Chequeo de humo contra el Supabase real: confirma que `.env.local` está bien,
que el schema está aplicado y que nada queda abierto a usuarios sin sesión.
Solo lee; no crea ni modifica nada.

```bash
npm run test:e2e
```

Flujo completo contra el Supabase real con dos cuentas: alta, onboarding,
registrar días, escalera de rangos, fotos con visibilidad, amistad, reto,
pérdida de racha y el aislamiento del §4. Crea datos y los limpia al final.
Necesita `E2E_EMAIL` en `.env.local` y **"Confirm email" apagado** (ver abajo).

## Aviso por correo de cada sugerencia

Cuando alguien manda una sugerencia, llega un mail. Usa **Resend**, el mismo
servicio que después sirve de SMTP para Auth: se configura una sola vez.

Lo que hay que crear (todo en el navegador, no hace falta CLI):

1. **Cuenta en [resend.com](https://resend.com)** (plan gratis: 3.000 correos/mes).
2. En Resend → **API Keys**, crear una y copiarla.
3. En Resend → **Domains**, verificar un dominio propio. Mientras tanto se puede
   usar el remitente de prueba `onboarding@resend.dev`, que **solo entrega a tu
   propia dirección** — alcanza para las sugerencias, no para la beta.
4. En Supabase → **Edge Functions** → *Deploy a new function*, nombre
   `sugerencia-mail`, y pegar el contenido de
   `supabase/functions/sugerencia-mail/index.ts`.
5. En Supabase → **Edge Functions → Secrets**, agregar:
   - `RESEND_API_KEY` — la clave del paso 2
   - `MAIL_DESTINO` — la casilla donde querés recibir las sugerencias
   - `MAIL_REMITENTE` — `Ascent <onboarding@resend.dev>` (o el del dominio propio)
   - `WEBHOOK_SECRET` — una cadena larga inventada, la que quieras
6. En Supabase → **Database → Webhooks** → *Create a new hook*:
   - Tabla `feedback`, evento **Insert**
   - Tipo **HTTP Request**, método `POST`
   - URL: la de la función (`https://<proyecto>.functions.supabase.co/sugerencia-mail`)
   - HTTP Header: `x-ascent-secreto` con el mismo valor del `WEBHOOK_SECRET`

Ese header es lo único que impide que cualquiera que descubra la URL nos haga
mandar correos, así que no puede faltar.

## Preparar la beta (congelado: va con la etapa nativa)

**Nada de esto está en el camino crítico hoy.** El plan es terminar la web,
usarla el dueño solo una o dos semanas cazando bugs, pasarla a nativo con Expo,
y recién ahí marketing. Sin usuarios ajenos no hace falta ninguna de las cinco
cosas de abajo: el proyecto se queda en el plan Free, con **"Confirm email"
apagado** —que es lo que deja correr `npm run test:e2e`— y con las cuentas de
prueba como están.

Queda escrito acá porque el día que haya gente hay que hacerlo entero, y
averiguarlo dos veces sale caro. Las primeras dos bloquean a las demás.

### 1. SMTP propio en Auth (bloqueante)

El SMTP de cortesía de Supabase da **2 correos por hora por destinatario** y
está pensado solo para probar. Con cinco testers se agota entre confirmaciones
de alta y recuperaciones de contraseña, y la gente queda sin poder entrar.

**Hace falta un dominio propio.** Resend exige un dominio verificado para
mandar por SMTP; `onboarding@resend.dev` solo entrega a la casilla del dueño de
la cuenta, así que sirve para las sugerencias y no para la beta. No se puede
verificar `ascent-blush-seven.vercel.app`: hay que tener un dominio y poder
tocarle el DNS. Sale ~10 USD/año y es lo único de toda la lista que cuesta
plata y depende de terceros (la propagación de DNS puede tardar horas).

1. Comprar el dominio y agregarlo en **Resend → Domains → Add Domain**.
2. Cargar en el DNS los registros que Resend muestra (DKIM y SPF, `TXT` y
   `MX`), y esperar a que la fila quede en **Verified**.
3. En Supabase: **Authentication → Emails → SMTP Settings → Enable Custom
   SMTP**, y completar:

   | Campo | Valor |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | la **misma API key** de Resend que usa la Edge Function |
   | Sender email | una dirección del dominio verificado, p. ej. `hola@tudominio.com` |
   | Sender name | `Ascent` |

   El puerto 465 es TLS directo. Si el proveedor lo bloqueara, `587` también
   sirve (ahí el cifrado se negocia con STARTTLS).
4. Guardar y probar con un "olvidé mi contraseña" a una casilla propia.

### 2. Volver a prender "Confirm email"

Está en **Authentication → Sign In / Providers → Email → Confirm email**. Se
apagó para poder correr los tests.

Al prenderlo se rompe **`npm run test:e2e`**: crea cuentas con `signUp` y sigue
usándolas al toque, y con la confirmación activa esas cuentas no pueden entrar
hasta que alguien abra el correo. `npm run capturas` y `npm run test:conexion`
**no se rompen**: usan cuentas que ya existen y ya están confirmadas.

Orden correcto: primero el SMTP (paso 1), después esto. Al revés, las
confirmaciones salen por el SMTP de cortesía y se cortan a los dos correos.

### 3. Backups

**En el plan Free de Supabase NO hay backups automáticos.** No es que estén
apagados: no existen. Los backups diarios arrancan en el plan Pro (25 USD/mes),
con 7 días de retención; el PITR es un add-on aparte y mucho más caro.

Dónde mirar el plan y los backups: **Database → Backups** en el panel. Si dice
que no hay backups disponibles, el proyecto está en Free.

Desde el código no se puede comprobar: en `.env.local` solo hay la anon key, y
el estado del plan no se expone por PostgREST.

Las dos salidas, y hay que elegir una **antes** de que haya datos de otra
gente: pasar a Pro, o armar un dump periódico con `supabase db dump` (necesita
la contraseña de la base, que no está acá).

### 4. Rotar las llaves

**El JWT secret ya no se puede rotar.** Supabase deshabilitó la rotación de las
llaves legacy (`anon`, `service_role`, JWT secret); el camino es migrar a las
llaves nuevas y **desactivar** las viejas, que deja la key expuesta sin efecto
igual. Conviene: es incremental en vez de un corte, y las legacy se deprecan a
fin de 2026 de todos modos.

Orden, en **Settings → API Keys**:

1. Pestaña **Publishable and secret API keys** → crear las llaves si no están.
2. `.env.local`: `NEXT_PUBLIC_SUPABASE_ANON_KEY` pasa a la `sb_publishable_…`.
   Correr `npm run test:conexion` — el chequeo del rol de la clave hay que
   ajustarlo, porque la nueva no es un JWT y no tiene `role: anon` adentro.
3. Vercel → variables de entorno → la misma `sb_publishable_…`, y
   **redesplegar**. Las `NEXT_PUBLIC_*` se incrustan al compilar: sin deploy
   nuevo, producción sigue con la vieja.
4. Edge Function `sugerencia-mail`: si lee `SUPABASE_SERVICE_ROLE_KEY`, pasarla
   a la `sb_secret_…`.
5. **Rehacer el webhook** de `feedback` (Database → Webhooks): su definición
   lleva la service_role key incrustada. Es el que filtró la llave; ver
   `spec/trampas.md`.
6. Recién ahí, **desactivar las llaves legacy**. Es reversible.
7. Correr `npm run test:conexion`, `npm run test:e2e` y `npm run capturas`, que
   son los tres que hablan con la base real.

Ojo con un cambio de forma: las llaves nuevas van en el header `apikey` y no en
`Authorization: Bearer`. `supabase-js` lo maneja solo; cualquier `curl` a mano
que haya por ahí, no.

### 5. Cuentas de prueba

`prueba_uno` y `prueba_dos`. **Conviene dejarlas, no borrarlas**, porque las
usan tres cosas:

- `npm run capturas` entra con `prueba_uno` (`CONEXION_EMAIL` en `.env.local`).
  Sin ella no hay QA visual.
- `npm run test:conexion` le pide con esa cuenta el retrato de la base a
  producción.
- El ranking entre amigos y el perfil ajeno solo se pueden mirar con **dos**
  cuentas amigas, que es justo lo que son.

`npm run test:e2e` **no** las usa: se crea las suyas y las borra.

Las claves ya se rotaron y viven solo en `.env.local`. Lo que falta es que se
noten como internas: ponerles un `username` que lo diga (`ascent_qa_1`) para
que ningún tester las encuentre en la búsqueda y les mande una solicitud.

Borrarlas recién cuando la beta termine.

### Checklist

- [ ] Dominio propio comprado y verificado en Resend.
- [ ] SMTP propio configurado en Auth y probado con un correo real.
- [ ] "Confirm email" prendido de nuevo (rompe `test:e2e`, es esperado).
- [ ] Decidido qué se hace con los backups: Pro, o dump periódico.
- [ ] Migradas las llaves nuevas y desactivadas las legacy.
- [ ] Webhook de sugerencias rehecho con la llave nueva.
- [ ] Cuentas de prueba renombradas como internas.
- [ ] Dos cuentas SIN amistad: ninguna lee logs, fotos ni peso de la otra
      (`npm run test:e2e` lo comprueba).
- [ ] Probada la corrección manual de días (Ajustes → Corregir días).

## Estructura

- `supabase/schema.sql` — todo el modelo de datos, triggers y políticas.
- `src/motor/` — motor procedural de cuerpos celestes (shaders) + animación de subida de rango.
- `src/app/` — pantallas: principal, social, álbum, datos, ajustes, login, onboarding.
- `public/sw.js` + `manifest.webmanifest` — PWA instalable.
