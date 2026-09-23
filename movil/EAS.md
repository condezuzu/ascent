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
cd movil && npx eas update --platform ios --channel telefono --message "qué se arregló"
```

El canal es el del perfil de build (`telefono`, `store`…), y está en `eas.json`
desde antes de que esto existiera.

**`--platform ios` y no las dos**: sin eso publica también el paquete de
Android, que nadie baja —no hay ninguna build de Android— y que encima sale con
otra huella. Es medio minuto y un grupo de actualización de más en la lista,
cada vez.

**Cómo se comprueba que una actualización le va a llegar a una build**: las dos
huellas tienen que ser la misma.

```
npx eas build:view <id>   # Runtime Version
npx eas update:list --branch telefono   # Runtime Version, por plataforma
```

Si no coinciden, la app no la va a ver nunca y no va a decir por qué: para eso
está la huella, y es lo que hay que mirar primero cuando "subí la update y no
llegó".

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

# La tanda nativa del 24/9: una sola build, y qué se metió adentro

**La regla que la ordenó, puesta por el humano:** *"No quiero descubrir en una
semana que falta otra"*. O sea: el trabajo no era hacer dos funciones, era
**barrer la lista entera buscando todo lo que no puede viajar por el aire** y
subirlo al mismo avión. Lo que quede afuera cuesta otra instalación.

## Lo que entró

| Qué | Por qué necesitaba build |
|---|---|
| **El gimnasio por ubicación** (§13) | `UIBackgroundModes: location` va en el `Info.plist`, y sin él el sistema no despierta a la app |
| **Apple Health** (§13c) | El `entitlement` de HealthKit y su texto de permiso; además es un módulo nativo (`@kingstinct/react-native-healthkit` + `react-native-nitro-modules`) |
| **El botón de volumen** (§13f) | *La función no está escrita.* Lo que viaja es solo el módulo nativo (`react-native-volume-manager`) |

**Por qué el módulo del volumen viaja sin su función.** Porque es la única
parte de §13f que no se puede mandar por el aire. Con el módulo adentro, el día
que se escriba —que es puro JavaScript: escuchar el botón y sumar una serie—
sale como actualización y no como instalación. Sin él, una función de veinte
líneas obligaría a reinstalar la app entera.

**Y una advertencia para cuando se escriba:** en iOS el botón de volumen solo
se puede escuchar **con la app adelante**. §13f lo imagina "con el teléfono en
el bolsillo" y eso **no se va a poder**: lo que sí se puede es no tener que
apuntarle al `+` con la app abierta en el banco, que es el caso real.

## Lo que quedó afuera, y por qué

**La Live Activity del descanso** (§13d, "picture in picture del cronómetro").
Es el tercer pendiente nativo de la lista y **no entró a propósito**: no es un
paquete que se instala, es un **target de widget** con código Swift propio. Eso
no se puede compilar ni mirar desde acá, así que iría a ciegas — y si sale mal,
la que se rompe es la build que trae las otras dos.

Va a necesitar su propia build **igual**, se escriba hoy o en un mes. Lo que se
puede hacer sin costo para quien instala es iterarla contra EAS hasta que salga
verde, y recién ahí pasarla.

## Lo que frenó la primera build: HealthKit pide permiso en Apple

La build `e95dcbdf` **falló**, y vale la pena que quede escrito porque va a
volver a pasar con cualquier capability nueva:

```
Provisioning profile "*[expo] uy.ascent.app AdHoc …" doesn't support
the HealthKit capability.
```

**Qué pasó.** Un `entitlement` no es solo una línea en el `Info.plist`: el
**App ID en el portal de Apple** tiene que tener esa capability marcada, y el
**perfil de aprovisionamiento** tiene que estar regenerado después de
marcarla. El que había se generó hace cuatro días, cuando HealthKit no existía
en este proyecto.

**Por qué no se arregló solo.** EAS sabe sincronizar las capabilities y
regenerar el perfil, pero para eso necesita estar autenticado contra Apple. En
`--non-interactive` no lo está, y lo dice:

```
Skipping Provisioning Profile validation on Apple Servers
because we aren't authenticated.
```

Así que reintentar sin más reusa el MISMO perfil viejo y falla igual.

**Cómo se destraba** (es del humano, porque es la cuenta de Apple): correr la
build **sin** `--non-interactive` y entrar con el Apple ID cuando lo pida.

```
cd movil && npx eas build --platform ios --profile telefono
```

EAS marca HealthKit en el App ID, regenera el perfil y sigue. Es una sola vez:
las builds siguientes vuelven a ser automáticas hasta la próxima capability.

**Lo que NO necesitaba nada de esto:** el gimnasio en segundo plano.
`UIBackgroundModes` va en el `Info.plist` y no es una capability del App ID, así
que no toca el perfil.

## Probar que compila sin gastar credenciales: el perfil `simulador`

De esta misma tanda salió el perfil `simulador` (`eas.json`), y existe por lo
que costó: **una build para el simulador no necesita perfil de
aprovisionamiento**, así que compila los mismos pods y el mismo Swift sin
pedirle nada a la cuenta de Apple.

Es la forma de contestar "¿este módulo nativo nuevo compila?" antes de meterlo
en la build que alguien va a instalar:

```
cd movil && npx eas build --platform ios --profile simulador
```

Un fallo ahí lo pago yo en intentos; un fallo en la otra lo paga quien espera
para instalar.

## Todo lo demás de la lista es JavaScript

El recorrido de primera vez, DOTS y la pantalla de marcas, la racha al costado,
la barra de rango, la animación del Álbum, "ver la guía" y los estados de borde
de Inicio: **los siete salen por el aire**, sin instalar nada.
