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

## Correo: el SMTP incorporado no sirve para la beta

Supabase trae un SMTP de cortesía limitado a un puñado de correos por hora, y
está pensado solo para probar. Con cinco o seis testers, entre confirmaciones
de alta y recuperaciones de contraseña se agota enseguida y la gente queda
sin poder entrar.

Antes de invitar a nadie hay que configurar el SMTP propio en
**Authentication → Emails → SMTP Settings**, con la misma cuenta de Resend del
paso anterior:

- Host `smtp.resend.com`, puerto `465`
- Usuario `resend`
- Contraseña: la **misma API key** de Resend
- Remitente: una dirección del **dominio verificado** (acá sí hace falta el
  dominio propio: `onboarding@resend.dev` solo entrega a tu casilla)

Mientras tanto, para desarrollo, conviene apagar
**Authentication → Providers → Email → "Confirm email"**: sin confirmación no
se manda ningún correo al crear cuentas y `npm run test:e2e` puede correr.
Volver a prenderlo antes de la beta, ya con SMTP propio.

## Antes de invitar gente (checklist de la spec)

- [ ] Crear dos cuentas SIN amistad y verificar que una no puede leer logs/fotos/peso de la otra (`npm run test:e2e` lo hace).
- [ ] Confirmar backups automáticos en Supabase (Settings → Database).
- [ ] Probar la corrección manual de días (Ajustes → Corregir días).
- [ ] SMTP propio configurado y "Confirm email" prendido de nuevo.

## Estructura

- `supabase/schema.sql` — todo el modelo de datos, triggers y políticas.
- `src/motor/` — motor procedural de cuerpos celestes (shaders) + animación de subida de rango.
- `src/app/` — pantallas: principal, social, álbum, datos, ajustes, login, onboarding.
- `public/sw.js` + `manifest.webmanifest` — PWA instalable.
