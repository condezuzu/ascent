# Reinstalar Ascent en una máquina recién formateada

*Pensado para seguirlo solo, de arriba a abajo. Al terminar tenés el proyecto
corriendo, los tests en verde y las builds de EAS disponibles.*

## Antes de formatear — el respaldo

Está en el Escritorio, carpeta **`ascent-respaldo`**. Contiene lo único que NO
está en git y hace falta:

- `.env.local` → va a la RAÍZ del repo (`ascent/.env.local`)
- `movil/.env` → va a `ascent/movil/.env`

**Copiá esa carpeta a un pendrive o a la nube ANTES de formatear.** Es lo único
irrecuperable de esta máquina. Todo lo demás vive en la nube (ver abajo).

> Esos archivos tienen secretos (claves de Supabase, contraseñas de las cuentas
> de prueba y demo, VAPID, CRON_SECRET). Guardá el respaldo en un lugar seguro.

## Qué NO hace falta respaldar (está en la nube)

- **El código y toda la historia:** GitHub → `https://github.com/condezuzu/ascent`
- **Las credenciales de firma de Apple (certificado + perfiles):** en **EAS**,
  no en esta máquina. Se comprobó: la build de `telefono` del 27/9 salió sin
  ningún archivo local de firma (no hay `.p8`/`.p12`/`.mobileprovision` en el
  repo). Con `eas login` vuelven solas.
- **Las variables de producción:** en el panel de **Vercel** (deploy web) y en
  **Supabase** (la base). El `.env.local` es solo para correr local.
- `node_modules/`, `.next*/`, `.expo/`, `capturas/`: se regeneran, no se respaldan.

## Pasos en la máquina nueva

1. **Node 22 o más** (esta máquina tenía v24.16, npm 11). Instalar desde
   nodejs.org. Verificar: `node --version`.
2. **Git** y **VS Code** (o lo que uses).
3. Clonar:
   ```
   git clone https://github.com/condezuzu/ascent.git
   cd ascent
   ```
4. **Poner los secretos del respaldo:**
   - `ascent-respaldo/.env.local` → `ascent/.env.local`
   - `ascent-respaldo/movil/.env` → `ascent/movil/.env`
5. **Instalar dependencias** (dos proyectos):
   ```
   npm install
   cd movil && npm install && cd ..
   ```
6. **Probar que anda:**
   ```
   npm run test:db        # 2123 + 10 en verde, sin red
   npm run dev            # web en http://localhost:3020
   ```
   (`test:conexion` necesita que la migración de prod esté al día; si da rojo,
   mirá `spec/estado.md`.)
7. **EAS (para builds del teléfono):**
   ```
   cd movil
   npx eas login          # usuario dueño: condeags-team
   npx eas whoami         # confirma la sesión
   npx eas build:list --platform ios --limit 3   # confirma que ve las builds y credenciales
   ```
   Las credenciales de Apple ya están en EAS; no hay que recrear nada.
8. **Supabase / Vercel** (solo si vas a tocar deploy o el schema): entrá a cada
   panel con tu cuenta. El proyecto Supabase es `okeanaihymbvbdmrdqph`.

## Qué se pierde igual (y no se puede respaldar)

- **La sesión de las apps de escritorio** (Claude, navegador, etc.): se vuelven
  a loguear, no es del proyecto.
- **Artefactos viejos de builds de EAS**: los `.ipa` viejos expiran en EAS con
  el tiempo. No importa: se rebuildea.
- **Nada del proyecto en sí es irrecuperable** si guardaste `ascent-respaldo` y
  tenés acceso a GitHub, EAS, Vercel y Supabase. El único punto único de falla
  real es el respaldo del Escritorio: sin él habría que regenerar el `.env.local`
  a mano (las claves de Supabase se sacan del panel; las contraseñas de las
  cuentas de prueba/demo habría que rotarlas).
