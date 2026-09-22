# Armar la app y ponerla en el teléfono

Este archivo explica **por qué** `eas.json` dice lo que dice. Los comandos en
orden los pasa el agente; acá está lo que hay que saber para cambiarlo.

## Cuatro perfiles, y cada uno existe por una razón

Hasta el 21/9 había uno solo (`telefono`), porque un perfil vacío esperando a
que alguien lo use es una cosa más que se desactualiza. `minimo` y `dev`
nacieron el día que la app quedó en negro en el iPhone y no había forma de ver
por qué; `store` nació el día que abrió (22/9), que es cuando TestFlight pasó
de ser una idea a ser el paso siguiente.

- **`telefono`** — la app, firmada ad-hoc, que se instala en un iPhone
  registrado con un link. Es la de siempre.
- **`minimo`** — la misma app con `EXPO_PUBLIC_MINIMO=1`: arranca la pantalla
  mínima (`src/Minimo.tsx`), React Native y nada más, con botones para cargar
  las piezas de a una. Contesta "¿corre el JS?" sin computadora.
- **`dev`** — cliente de desarrollo (`expo-dev-client`): se conecta a Metro en
  la computadora, muestra los errores en pantalla y en la terminal, y deja
  cambiar el JS sin volver a compilar. Se levanta con `dev-telefono.cmd`.
- **`store`** — el IPA que acepta App Store Connect, para TestFlight. Es el
  único que NO es `internal`, y el único que saca las variables del entorno
  `production`. No lleva `EXPO_PUBLIC_DIAGNOSTICO`: la caja negra es para
  buscar una pantalla negra, no para quien baja la app. `autoIncrement` le sube
  solo el número de build, porque App Store Connect rechaza uno repetido
  después de hacerte esperar el procesado.

Los tres primeros son `distribution: internal`: link directo, sin TestFlight y
sin revisión de Apple. Es la diferencia entre "probar hoy" y "esperar a que App
Store Connect procese".

- **`simulator: false`**: el build es para el teléfono de verdad. Un build de
  simulador no se firma y no instala en un aparato.
- **`appVersionSource: "local"`**: la versión sale de `app.json` y no de un
  contador en los servidores de Expo. Un número que vive afuera del repo es un
  número que no se puede leer mirando el código.

## Las variables: el entorno de EAS, no valores pegados acá

**ESTO ESTABA MAL Y COSTÓ VARIAS BUILDS (22/9).** Acá decía que nombrar la
variable con `$` —`"EXPO_PUBLIC_SUPABASE_URL": "$EXPO_PUBLIC_SUPABASE_URL"`— le
pedía a EAS el secret con ese nombre. **No existe esa interpolación**: el `env`
de un perfil son valores LITERALES, así que la build recibía el texto
`$EXPO_PUBLIC_SUPABASE_URL` y encima PISABA la variable buena. Con eso, el
cliente de Supabase no se puede ni construir ("Invalid supabaseUrl").

Cómo es de verdad:

- Las variables viven en el **entorno de EAS** (el panel del proyecto:
  development / preview / production). Los valores no están en este archivo ni
  en ningún otro del repo.
- **Cuál entorno usa cada build lo dice `environment`.** Si no se pone, EAS lo
  elige solo: `production` si la distribución es `store`, `development` si es
  cliente de desarrollo, y `preview` en los demás casos. Los tres perfiles de
  acá dicen `preview` EXPLÍCITAMENTE, que es donde están cargadas las dos de
  Supabase: sin decirlo, el perfil `dev` iba a buscarlas a `development`, donde
  no están, y arrancaba sin base.
- En `env` quedan solo valores que SON literales: `EXPO_PUBLIC_DIAGNOSTICO` y
  `EXPO_PUBLIC_MINIMO`, que son interruptores de esta etapa.

Ver `movil/.env` para los mismos nombres en desarrollo (ahí los lee Metro).

## Lo que estos perfiles NO hacen

- **Armar el IPA de `store` no es publicar.** `eas submit` lo sube a App Store
  Connect y ahí hace falta la cuenta de Apple del dueño: eso no lo hace el
  agente. Y aunque llegue a TestFlight, la preparación de App Store (metadatos,
  política de privacidad, justificación de ubicación en segundo plano, cuenta
  demo para el revisor) sigue pendiente. Ver `spec/etapa-nativa.md`. En `submit`
  lo único que hay es el equipo de Apple: ninguna credencial vive en el repo.
- **No toca `UIBackgroundModes`.** Hoy tiene `audio` —lo necesita el cronómetro
  para seguir corriendo con la pantalla apagada— y NO tiene `location`. La
  consecuencia es concreta y hay que saberla: **el registro automático al llegar
  al gimnasio no va a dispararse con la app cerrada** en esta build. Todo lo
  demás anda. Agregarlo es lo que Apple revisa con lupa y es trabajo de App
  Store, no de poner la app en un teléfono.
