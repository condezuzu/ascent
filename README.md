# Ascent

Racha de gimnasio a escala del universo. PWA en Next.js + Supabase + three.js.
La especificación completa vive en `ESPECIFICACION.md` (leerla al inicio de cada sesión).

## Puesta en marcha (una sola vez)

1. **Supabase**: crear un proyecto en [supabase.com](https://supabase.com) (región `sa-east-1`, São Paulo, es la más cercana).
2. En el **SQL Editor** del proyecto, pegar y ejecutar entero `supabase/schema.sql`. Eso crea tablas, triggers de racha, RLS y los buckets de storage.
3. En **Authentication → Providers**, activar Email y Google (para Google hay que cargar Client ID/Secret de Google Cloud Console).
4. En **Authentication → URL Configuration**, agregar a los redirect URLs (local y de Vercel):
   - `http://localhost:3020/auth/callback`
   - `http://localhost:3020/auth/callback?next=/nueva-clave` (recuperar contraseña)
   - los dos equivalentes con `https://TU-APP.vercel.app`

   Si el segundo falta, el correo de recuperación llega pero el enlace rebota al login.
5. Copiar `.env.example` a `.env.local` y completar con la URL y la anon key del proyecto (Settings → API).
6. `npm install` y `npm run dev` → http://localhost:3020

## Deploy en Vercel

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel --prod
```

## Verificar la lógica sin Supabase

```bash
npm run test:db
```

Corre `supabase/schema.sql` contra un Postgres real (PGlite, en WASM) con stubs
de lo que aporta Supabase, y verifica la matemática de racha, rangos, planeta del
día, pérdida (−10), días de descanso y las políticas de RLS. No necesita cuenta
ni red. Correrlo después de tocar el schema.

## Antes de invitar gente (checklist de la spec)

- [ ] Crear dos cuentas SIN amistad y verificar que una no puede leer logs/fotos/peso de la otra.
- [ ] Confirmar backups automáticos en Supabase (Settings → Database).
- [ ] Probar la corrección manual de días (Ajustes → Corregir días).

## Estructura

- `supabase/schema.sql` — todo el modelo de datos, triggers y políticas.
- `src/motor/` — motor procedural de cuerpos celestes (shaders) + animación de subida de rango.
- `src/app/` — pantallas: principal, social, álbum, datos, ajustes, login, onboarding.
- `public/sw.js` + `manifest.webmanifest` — PWA instalable.
