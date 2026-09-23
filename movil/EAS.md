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
  único que NO es `internal`, pero saca las variables del MISMO entorno que los
  otros tres (`preview`): ver abajo. No lleva `EXPO_PUBLIC_DIAGNOSTICO`: la
  caja negra es para buscar una pantalla negra, no para quien baja la app.
  `autoIncrement` le sube solo el número de build, porque App Store Connect
  rechaza uno repetido después de hacerte esperar el procesado.

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
  cliente de desarrollo, y `preview` en los demás casos. Los CUATRO perfiles de
  acá dicen `preview` EXPLÍCITAMENTE, que es donde están cargadas las dos de
  Supabase: sin decirlo, el perfil `dev` iba a buscarlas a `development`, donde
  no están, y `store` a `production`.
- **`store` también dice `preview`, y no es un descuido.** Las dos variables
  están cargadas en los dos entornos, pero son **secretas**: sus valores no se
  pueden leer ni comparar desde acá, así que "en production también están" es
  una lista de nombres y no una prueba de que digan lo mismo. De los dos
  entornos, uno solo tiene una build instalada y andando en un teléfono. El día
  que haya una de `store` abierta y funcionando se puede mover, con una build
  de por medio, no con un razonamiento.
- En `env` quedan solo valores que SON literales: `EXPO_PUBLIC_DIAGNOSTICO` y
  `EXPO_PUBLIC_MINIMO`, que son interruptores de esta etapa.

Ver `movil/.env` para los mismos nombres en desarrollo (ahí los lee Metro).

## El mensaje que asusta y no dice lo que parece

Al largar una build, EAS imprime:

> No environment variables with visibility "Plain text" and "Sensitive" found
> for the "production" environment on EAS.

**Eso NO quiere decir que el entorno esté vacío.** EAS tiene tres visibilidades
—texto plano, sensible y **secreta**— y ese mensaje solo cuenta las dos
primeras, que son las que el CLI puede mostrarte en la terminal. Las secretas
no las nombra nunca: para eso son secretas. Llegan igual a la máquina que
compila, y la prueba está instalada en un teléfono: la build `telefono` del
22/9 —la primera que abrió— saca sus dos variables de `preview`, y ahí las dos
son **secretas** igual que en `production`. Si el mensaje significara "no hay
variables", esa build habría quedado en negro como las anteriores.

Para ver qué hay de verdad en un entorno, sin valores:

```
npx eas env:list --environment production
```

Si las dos aparecen con "This is a secret env variable", están. El mensaje de
la build no es una alarma; la pantalla negra del 19/9 fue otra cosa (variables
literales pisando a las buenas, arriba).

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

---

# Actualizar sin reconstruir (EAS Update, 23/9)

**El problema que resuelve.** Con la app en un teléfono, cada arreglo costaba
una build de cinco minutos y una instalación a mano. Ese precio no lo paga
quien arregla: lo paga quien quiere probar. Empuja a juntar diez cambios en una
tanda y a probar poco — exactamente al revés de cómo se encontraron los bugs de
esta semana.

**Se dijo que no dos veces antes**, y el argumento era bueno mientras la app
vivía en una computadora: un canal de actualización es una pieza más que se
desactualiza. Lo que cambió es quién espera.

## Qué viaja por el aire y qué no

| Viaja | No viaja: pide build nueva |
|---|---|
| Pantallas, componentes, estilos | Un módulo nativo nuevo (`expo-location`, `expo-file-system`…) |
| Los textos y las reglas de `nucleo/` | Permisos y sus textos en `Info.plist` |
| Lo de `compartido/` | `UIBackgroundModes` (el gimnasio en segundo plano) |
| Imágenes y fuentes de `assets/` | Ícono, splash, nombre, bundle |
| Arreglos de lógica, consultas, navegación | Subir de SDK de Expo, cambiar `app.json` |

La regla corta: **si lo escribí en TypeScript, viaja. Si toca el `app.json` o
agrega un paquete con lado nativo, no.**

## Por qué la huella y no la versión

`runtimeVersion` está en `{"policy": "fingerprint"}`, que calcula la versión de
ejecución a partir del lado NATIVO del proyecto. Una actualización solo le llega
a las builds cuya huella es idéntica.

Con la política `appVersion` —la que pone `eas update:configure` por omisión—
un JS que usa un módulo nuevo se le entregaría igual a una build vieja que no lo
tiene, y esa app muere al abrir. Con la huella, esa build simplemente **no
recibe nada**: se queda con el JS que le sirve.

## Cómo se publica

```
cd movil && npx eas update --channel telefono --message "qué se arregló"
```

El canal es el del perfil de build (`telefono`, `store`…), y está en `eas.json`
desde antes de que esto existiera.

## Cómo llega al teléfono

- **Al abrir la app**, tres segundos después de entrar: busca, baja y
  **reinicia sola** para aplicarla. Esos tres segundos no son un número mágico:
  la decisión de reiniciar necesita saber si hay un entrenamiento andando, y eso
  lo sabe Inicio recién cuando se dibujó. **Con el cronómetro corriendo no
  reinicia** — se aplica la próxima vez que se abra. Un reinicio en medio de una
  serie se ve como que la app se cerró sola.
- **A mano**, desde el botón Diagnóstico: "Buscar actualización". Ahí también
  dice qué JS está corriendo —el de la build o una actualización, con su id—,
  que es el dato que hace falta cuando un bug arreglado sigue apareciendo.

## Lo que hay que saber igual

- **La primera build con `expo-updates` adentro hay que instalarla a mano.** Lo
  que ya está instalado no tiene el canal y no puede recibir nada.
- Una actualización **no arregla una app que no abre**: si el JS nuevo tira al
  arrancar, `expo-updates` vuelve al anterior, pero conviene no averiguarlo en
  el gimnasio.
