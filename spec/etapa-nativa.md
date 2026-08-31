# Etapa nativa (Expo)

Lo que una PWA no puede hacer y espera a la versión nativa. Documentado, NO implementado.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.
Lo que está acá ya está decidido y no se rediscute salvo que se indique.

---

## 13w. Verlo en el teléfono: Expo Go sí, hasta que no

Verificado el 21/8/2026.

**Casi toda la migración se puede mirar con el QR de Expo Go**, sin compilar
nada: alcanza con `npx expo start` y escanear. Todo lo que usa el spike está
incluido en Expo Go — `expo-gl` (el motor), `expo-location` en primer plano,
`async-storage`, `expo-keep-awake`, `expo-haptics`, `expo-av`.

**Dos cosas obligan a un development build** (`npx expo prebuild` +
`expo-dev-client`, que se instala una vez en el teléfono y después también se
actualiza por QR):

1. **El geofencing en segundo plano**, o sea el registro automático al llegar
   al gimnasio — el diferencial de la app. `TaskManager` no corre en Expo Go
   en ninguna de las dos plataformas, y sin él no hay geofencing. Hace falta
   además `UIBackgroundModes: location` en iOS y `ACCESS_BACKGROUND_LOCATION`
   en Android.
2. **Salud** (§13c): ni HealthKit ni Health Connect funcionan en Expo Go.

O sea: el orden natural es **hacer toda la migración visual con Expo Go**, que
es el ciclo rápido, y armar el development build recién cuando toque la
ubicación en segundo plano.

---

## 13x. El texto vertical de RACHA

`writing-mode: vertical-rl` **no existe en React Native**, y es la única
decisión de composición deliberada que tiene la app: la palabra RACHA apilada
contra el número gigante.

Hay tres caminos y ninguno es igual. Cuando toque, se prueban los tres en un
teléfono de verdad y se elige mirando, no leyendo:

1. **Rotar el contenedor** (`transform: [{ rotate: '-90deg' }]`). Es lo que
   hace el spike. Barato, pero NO es lo mismo: el texto rota entero en vez de
   apilarse, así que las letras quedan de costado y hay que acomodar el ancho a
   ojo para que no empuje al número.
2. **Una letra por línea**, cada `<Text>` en su fila. Se acerca más a lo que
   hace `vertical-rl` de verdad, y el `letter-spacing: 0.42em` pasa a ser
   separación entre filas. Más control, más código.
3. **Un SVG con el texto** (`react-native-svg`). Control total de la
   composición y escala sin pixelarse, a costa de que deja de ser texto para
   el sistema.

Mi apuesta es la 2, pero es una apuesta: la 1 ya está escrita y puede alcanzar.

---

## 13y. Qué de esto sigue siendo cierto

Todo lo que está en este archivo llegó acá porque "en web no se puede". Eso
**envejece igual que un dato**: la afirmación sobre el audio resultó falsa y
había estado escrita como un hecho. Así que cada una se verifica y se firma con
la fecha y la fuente.

Reverificación completa: **21 de agosto de 2026.**

| Afirmación | ¿Sigue? | Qué se comprobó |
|---|---|---|
| Geofencing en segundo plano | **Sí** | No hay Geofencing API en ningún navegador. La propuesta del W3C está abandonada desde hace años y una PWA no tiene acceso continuo a la ubicación: solo pedidos puntuales con la app abierta. |
| Apple Health / Health Connect | **Sí** | HealthKit solo existe en el dispositivo y solo para apps nativas; Health Connect es un servicio del sistema Android. Ninguno expone nada al navegador, y no hay nada anunciado. |
| Vibración en iPhone | **Sí** | WebKit nunca implementó la Vibration API y **se opone formalmente**. Sigue así en 2026. Solo Chromium la tiene. |
| Avisar con la pantalla bloqueada | **NO del todo** | Ver abajo. |
| Declarar la categoría de audio | **NO** | Corregido el 21/8/2026: Safari implementa la Audio Session API. Ya está usado (§13b). |

### El que estaba mal: avisar con la pantalla bloqueada

La spec decía que en web no llega nada con la app cerrada. Es más matizado:

- **Web Push SÍ funciona en iOS**, desde 16.4, para una PWA **instalada desde
  la pantalla de inicio**. O sea que una notificación con el teléfono bloqueado
  es posible en web. (En la UE esto se rompió: por el DMA las PWA abren en una
  pestaña de Safari y ahí no hay push.)
- **Lo que NO existe es la notificación LOCAL programada.** Notification
  Triggers nunca llegó al estándar. Para que el aviso del descanso llegue con
  la app cerrada haría falta un **servidor que empuje** a los tres minutos, con
  suscripción push y un scheduler.

O sea: técnicamente posible, desproporcionado para un temporizador de tres
minutos, y agrega un servidor a algo que hoy no lo necesita. **Se queda en la
etapa nativa por costo, no por imposibilidad** — que es una razón distinta y
hay que decirla así.

### Y una que sube de categoría

El rumor de los hápticos en iPhone (`trampas.md`) está **parcialmente
confirmado**: iOS 18 agregó hápticos no estándar al `<input type="checkbox"
switch>`. No es una API general y no sirve para un aviso de descanso, pero deja
de ser un rumor de una sola fuente.

---

## 13z. Los huecos: `src/plataforma/`

Todo lo que la web no puede hacer está detrás de una interfaz, con la
implementación web haciendo lo que puede. Al pasar a Expo se agrega `nativo/` y
se cambia **una línea** en `src/plataforma/index.ts`; ningún componente se
entera. Nada del resto de la app toca `navigator` ni `localStorage`, y la
sección 35 de `test:db` lo comprueba: si alguien vuelve a llamarlos directo,
falla y dice en qué archivo.

Los puertos, en orden de implementación:

0. **Avisos entre partes de la app** — HECHO, y sin implementación por
   plataforma: el `window.dispatchEvent` que hacía aparecer la franja de sesión
   se reemplazó por un emisor en memoria (`plataforma/eventos.ts`). No hacía
   falta un puerto, hacía falta que la dependencia de `window` desapareciera.
   El de `ascent:instalable` se queda en `window` a propósito: es
   `beforeinstallprompt`, del navegador, y la sección Instalar muere al migrar.
1. **Almacenamiento** — HECHO. Dos sabores con la misma interfaz:
   `almacenamiento` sobrevive a cerrar la app (`localStorage` / AsyncStorage) y
   `efimero` muere con ella (`sessionStorage` / un mapa en memoria). **La API
   es asíncrona aunque en web sea sincrónica por debajo**, porque AsyncStorage
   lo es: hacerlo después habría cambiado las firmas de cinco librerías y de
   todos sus llamadores, en el peor momento.
2. **Ubicación** — HECHO. `disponible()`, `puntoActual()`,
   `vigilarLlegada()`, `dejarDeVigilar()`. En web `vigilarLlegada` devuelve
   `false` —no hay forma de que el navegador despierte a una PWA cerrada— y el
   atajo posible es mirar al abrir la app. En nativo se registra la zona en el
   sistema y ahí sí llega el geofencing de §13; no cambia nada alrededor.

   La migración 23 trae las columnas del gimnasio **y** `logs.origen` juntas:
   partirlo habría sido dos despliegues coordinados para una sola feature.

   `registrarPorSenal(origen)` en `lib/gimnasio.ts` es el camino único por el
   que entran ubicación y salud. La cuenta de distancia vive en `lib/geo.ts`,
   que no importa nada para que `test:db` la pruebe: un error ahí da un número
   creíble y equivocado, y el día simplemente no se registraría nunca.

   Dos decisiones que se ven en la pantalla de Ajustes: el punto **solo se
   marca estando en el gimnasio** —uno puesto desde casa registra días que no
   ocurrieron— y la precisión del GPS se **suma** al radio, porque el costo no
   es simétrico: un día de más se corrige a mano, uno de menos corta la racha.
3. **Salud** — HECHO (hueco vacío). `disponible()` es `false` en web: no es
   que la API sea peor, es que no existe nada parecido. `entrenoEse()` devuelve
   `null` para "no sé", que NO es `false`: confundirlos haría que la app diera
   por no entrenado un día que sí lo fue.
4. **Avisos** — HECHO. `programar(id, enSegundos, alSonar)`, `cancelar(id)`,
   `permiso()`, `conPantallaBloqueada()`. En web es un `setTimeout` con la app
   adelante; en nativo, notificación local que llega con la pantalla bloqueada.
   **No se pide el permiso de notificaciones del navegador**: con la app
   adelante no hace falta, y pedirlo sin usarlo gasta la única vez que el
   usuario va a decir que sí.
5. **Háptica** — HECHO. `vibrar()` y `puedeVibrar()` de `descanso.ts` ahora
   pasan por el puerto.
6. **Audio** — HECHO, y resultó NO ser 100% nativo. `preparar()`, `avisar()`,
   `soltar()`, `respetaLaMusica()`. En web: `navigator.audioSession.type =
   'transient'` cuando existe (Safari), y el `AudioContext` suspendido salvo
   los 400 ms que suena, que llega a todos los teléfonos. En nativo se declara
   la categoría de verdad y además suena con la app cerrada (§13b).

7. **Pantalla despierta** — HECHO. Era uno de "los chicos" pero vivía en el
   mismo `Descanso.tsx` que audio y háptica, así que se hizo ahí para no tocar
   el archivo tres veces. En nativo, `expo-keep-awake`.

Quedan dos chicos: **recorte del avatar** (canvas → `expo-image-manipulator`) y
**exportar datos** (descarga del navegador → share sheet).

La sección 35 de `test:db` crece con cada puerto: hoy prohíbe `localStorage`,
`sessionStorage`, `AudioContext`, `audioSession`, `geolocation`, `wakeLock` y
`vibrate` fuera de `src/plataforma/`. NO prohíbe `userAgent`, `serviceWorker` ni
`hardwareConcurrency`: esos son del navegador y de la PWA, que desaparecen
enteros al migrar en vez de tener equivalente nativo.

### Una señal, un camino

Ubicación y salud hacen lo mismo: registrar el día por algo que no es un toque.
Si cada una escribe su propio camino a `registrar_dia`, van a ser dos lógicas
de "¿ya estaba registrado?, ¿pido la foto?, ¿aviso?". Las dos alimentan
**`registrarPorSeñal(origen)`**, con el origen guardado en el log para saber
después qué días entraron solos.

### Lo que además cambia y no estaba en la lista

- **three.js** corre con `expo-gl`; los shaders se llevan, cambia el armado del
  renderer. Ya está aislado en `src/motor/`.
- **Ruteo**: Next App Router → Expo Router, los dos por archivos.
- **Service worker y PWA**: desaparecen.
- **Supabase**: no cambia, salvo que el cliente necesita AsyncStorage para
  persistir la sesión.
- **Las paletas por rango ya son TypeScript** (`paletas.ts`), no CSS. Se
  inyectan a variables CSS pero la fuente de verdad es un objeto: eso migra tal
  cual. Era el riesgo grande de "el color vive en el CSS" y no está.

---

## 13. Registro automático por ubicación (etapa nativa)

El usuario guarda la ubicación de su gimnasio y el día se registra solo al llegar,
sin abrir la app. La opción de registrar a mano se mantiene siempre: el automático
es un atajo, nunca el único camino.

**Esto requiere geofencing del sistema operativo y por lo tanto solo existe en la
versión nativa.** Una PWA no puede consultar la ubicación con la app cerrada, ni
con la pestaña abierta en segundo plano. En nativo, la app registra una zona en el
sistema y es el teléfono el que la despierta al entrar.

Mientras el proyecto sea web, la versión posible es un atajo: si abrís la app
estando en el gimnasio, se registra sin apretar nada.

A tener en cuenta cuando se implemente:
- El GPS dentro de un edificio tiene 20 a 50 metros de error. En un centro
  comercial o zona densa puede disparar falsos positivos.
- El usuario marca el punto lo más cerca posible de la puerta, o de un lugar por
  el que pase siempre al entrar. El radio se configura lo más chico que el GPS
  permita.
- Radio chico significa menos falsos positivos pero más días que no se detectan.
  Por eso el registro a mano nunca desaparece: es la red de seguridad.
- Conviene exigir permanencia mínima en la zona, no solo el ingreso. **Hecho**:
  son 7 minutos, y también arranca la sesión. Ver más abajo.
- El permiso de ubicación en segundo plano es el más invasivo que existe: hay que
  pedirlo explicando para qué, y la app tiene que funcionar entera sin él.
- La ubicación del gimnasio es dato privado del usuario y no se comparte con
  amigos bajo ninguna circunstancia.

**La foto se resuelve con una notificación.** El registro automático no puede sacar
la foto, así que al detectar la llegada el día queda registrado y sale un aviso
pidiéndola ("demostrá que viniste"). La foto sigue siendo opcional: si el usuario
la ignora, el día ya está contado igual.

### Cómo se configura la ubicación

Se ofrece durante el alta, como opción activable. Si el usuario la activa, la app
le explica que tiene que marcar el punto **parado en la puerta de su gimnasio**,
o en un lugar por el que pase siempre al entrar.

Como es improbable que esté ahí en ese momento, la pantalla siempre ofrece
**"lo configuro después"**, y queda pendiente en Ajustes con un recordatorio
visible hasta que se complete. Nunca se pide marcar el punto desde otro lugar:
un punto mal puesto es peor que no tenerlo.

Esta es la primera razón concreta para pasar a nativo con Expo. El backend entero
(Supabase, esquema, RLS, triggers, lógica de rachas) se lleva sin tocar; se rehace
solo la capa visual.

### La sesión también arranca al llegar — y lo que de eso sí anda en web

Implementado el 27/8/2026 hasta donde la web llega. **La lógica entera está
hecha y probada** (`src/lib/llegada.ts`, secciones 40 y 41 de `test:db`); lo
único que falta en nativo es **quién mira**.

Lo que hace:

- Si te quedás **7 minutos** en la zona (`ESPERA_LLEGADA_MS`), la sesión
  arranca sola. La espera es lo que filtra al que pasa caminando por la puerta,
  y de paso te deja cambiarte antes de que empiece a contar algo.
- El inicio se cuenta **desde la llegada, no desde el disparo**. Llegaste 10:00,
  arranca 10:07, la sesión dice 10:00. Si dijera 10:07 la duración saldría
  corta siempre, y un número equivocado se cree.
- **Salir de la zona la cierra**, y la cierra con la última vez que se te vio
  adentro, no con la hora en que nos enteramos. Solo cierra las que arrancaron
  solas: la que empezaste vos con el botón se queda corriendo aunque salgas —
  quizá saliste a correr afuera.
- Parar a mano sigue andando siempre, y **no se vuelve a encender sola** en esa
  misma visita.

La base no le cree nada de esto al cliente: `iniciar_sesion` acota el inicio a
`atraso_maximo()` —45 minutos— y `terminar_sesion` acota el fin entre el inicio
y ahora. Sin eso, un cliente manipulado se fabrica duraciones.

**QUÉ FALTA, Y ES TODO LO MISMO: en web esto solo pasa con la app abierta.** El
navegador no despierta a nadie. En concreto, hoy:

| | web (hoy) | nativo |
|---|---|---|
| Llegás con la app cerrada | no pasa nada hasta que la abrís | el sistema despierta a la app |
| Llegás con la app abierta | se mira cada 2 min y anda | igual, y además en segundo plano |
| Te vas con la app cerrada | se cierra cuando volvés a abrirla, con la hora correcta | se cierra al salir |
| Te vas con la app abierta | se cierra en 2 min | se cierra al salir |

Al migrar, lo único que cambia es de dónde sale `adentro`: hoy lo pregunta un
`setInterval` en `src/app/page.tsx`, y en nativo lo va a avisar `TaskManager`
con `expo-location`. **`decidir()` no se toca** — no sabe de GPS ni de React, y
por eso su prueba tampoco se toca.

Ojo con una cosa al implementarlo: el geofencing de iOS y Android avisa
*entrada* y *salida*, no "sigue adentro". La hora de llegada sale del evento de
entrada, que es más exacta que la de web, pero hay que guardarla igual — es
justo lo que ya hace `Vigilancia`.

---

---

## 13b. Avisos de descanso con la pantalla bloqueada (etapa nativa)

El temporizador de descanso entre series (§18) funciona en la web **solo con
la app en primer plano y la pantalla despierta**. Es la tercera razón concreta
para pasar a Expo, junto con la geolocalización y las notificaciones.

Lo que la web no puede y el nativo sí:

- **Avisar con la pantalla bloqueada o la app cerrada.** En web el navegador
  suspende el audio en segundo plano y con el teléfono bloqueado no corre nada.
  En nativo se programa una notificación local al empezar el descanso, y llega
  igual aunque el usuario haya guardado el teléfono.
- **Vibrar en iPhone.** WebKit nunca implementó la Vibration API, así que en
  web el iPhone no vibra y punto. Nativo tiene acceso al motor háptico.
  Justamente donde más falta hace: en un gimnasio ruidoso, con auriculares
  puestos, un sonido se pierde y la vibración en el bolsillo no.
- **No cortarle la música al usuario.** En nativo se declara la categoría de
  audio del sistema: **ambient** en iOS, que se mezcla con lo que ya suena, y
  **foco transitorio con ducking** en Android, donde la música baja un momento
  y vuelve sola.

  **CORREGIDO (21/8/2026):** esta sección decía que en web no había forma de
  pedir ninguna de las dos, y era falso. Safari implementa la **Audio Session
  API**, y ahí se puede pedir `transient`, que la especificación del W3C define
  como "audio transitorio, como un ping de notificación; deberían sonar por
  encima del audio de reproducción y quizá atenuarlo" — exactamente este caso.
  Ya está implementado en `plataforma/web/audio.ts`, con detección de la API
  porque es experimental y solo Safari la tiene.

  Y hay una segunda mejora que **no depende de ninguna API** y llega a todos
  los teléfonos: el `AudioContext` ahora vive **suspendido** salvo los 400 ms
  que suena. Antes se creaba al abrir el descanso y quedaba despierto los tres
  minutos enteros; un contexto despierto mantiene viva la sesión de audio del
  sistema, así que el sospechoso más probable de "corta la música" no era el
  bip de medio segundo sino los tres minutos de contexto abierto.

  **Nada de esto está probado en un iPhone de verdad.** Va a la misma bolsa que
  el rumor de la vibración (`trampas.md`): la afirmación original tampoco
  estaba medida.

A tener en cuenta cuando se implemente:

- La notificación local se **programa al empezar el descanso y se cancela al
  saltarlo**. Si no se cancela, suena después de que el usuario ya volvió a
  entrenar.
- El aviso es de **una sola vez**, no se repite hasta que lo atiendan. Un
  temporizador de descanso que insiste es un despertador, y nadie quiere un
  despertador en el gimnasio.
- La regla de la cuenta no cambia: **el timestamp de fin manda** y el
  transcurrido se calcula contra el reloj (§18.4). La notificación es un aviso
  encima de eso, nunca la fuente de la verdad.
- Sigue valiendo lo de §13: la app tiene que funcionar entera sin el permiso.
  Quien no acepte notificaciones se queda con el aviso visual, igual que en la
  web de hoy.

## 13c. Fotos visibles para todos — POSPUESTO hasta después de migrar

Decidido el 2026-08-28. Hoy `photos.visibilidad` tiene dos estados
(`privada`, `amigos`) y se queda así. El tercero —**todos**— se pidió y se
pospuso a propósito.

**Por qué se pospone, si la UI es un control de tres botones.** Porque la UI
no es el trabajo. "Todos" implica decidir, antes de escribir una línea:

- **Quién ve un perfil ajeno y qué ve.** Hoy `/perfil/[id]` se mira siendo
  amigo. Con fotos públicas hay una pantalla que ve un desconocido, y esa
  pantalla necesita su propio criterio de qué muestra —¿la racha?, ¿el peso
  no, seguro?— y su propia política de RLS.
- **Si a alguien se lo puede encontrar sin ser amigo.** La búsqueda de hoy
  existe para agregar amigos. Buscar para mirar es otra cosa, y abre poder
  encontrar a una persona concreta a partir de su nombre de usuario.
- **Si hay reportar y bloquear.** Publicar fotos de cuerpos sin ninguna de las
  dos no es una función incompleta: es una función que no se debería lanzar.
  Son dos tablas, dos pantallas y un lugar donde caen los reportes.

Nada de eso es UI: es esquema, RLS y decisiones de producto. Y todo se
volvería a escribir en la app nativa. Se hace **una vez**, del otro lado.

**Lo que sí queda hecho ahora:** el `check` de la columna admite dos valores,
así que agregar el tercero es una migración de una línea cuando llegue el
momento. No hay nada que deshacer.

## 13d. PRIORIDAD — el descanso desde la pantalla bloqueada

Pedido el 2026-08-29 después de dos días de gimnasio: **"no se ve el descanso
fuera de la app" es lo que más molesta.** Va como prioridad de esta etapa, por
encima del geofencing: el descanso pasa doce veces por sesión y la llegada una.

**Lo que en web es imposible y no hay que seguir intentando.** Con la pantalla
bloqueada, los temporizadores de una pestaña escondida se estrangulan a uno por
minuto y después se congelan; las Notification Triggers (`showTrigger`) nunca se
implementaron en ningún navegador; y Web Push necesita un servidor empujando a
la hora exacta, que para un temporizador de tres minutos es una pieza de
infraestructura entera con latencia que nadie garantiza.

**Lo que sí se puede en nativo, y es lo que hay que construir:**

- **Notificación local programada** (`expo-notifications`) al empezar el
  descanso, cancelada al saltarlo. Suena con la pantalla bloqueada y sin
  servidor. Es el piso.
- **iOS: Live Activity.** La cuenta regresiva viva en la pantalla de bloqueo y
  en la Dynamic Island, actualizándose sola. Es exactamente lo que se pidió:
  *ver* el descanso sin desbloquear.
- **Android: notificación de servicio en primer plano**, con la cuenta y un
  botón "Saltar" que funciona desde la pantalla bloqueada. Ahí se puede además
  **controlar**, no solo mirar.

**La regla del §18.4 no cambia:** el timestamp de fin manda y el transcurrido se
calcula contra el reloj. La Live Activity y la notificación son una VISTA de
eso, nunca la fuente. Si se apoyaran en su propio contador, cerrar la app o
dormir el teléfono daría dos números distintos para la misma cosa.

Y sigue valiendo §13: la app tiene que funcionar entera sin el permiso de
notificaciones. Quien no lo dé se queda con el aviso visual de hoy.


## 13e. Los movimientos del contador — pendiente, después de migrar

Pedido el 2026-08-29, pospuesto a propósito: es una tabla nueva más una
pantalla, o sea justo lo que encarece la migración.

**El problema.** El selector del contador de series usa el catálogo de
`ejercicios`, que tiene nombres específicos de gimnasio —"Peso muerto rumano",
"Curl martillo"— y poca gente sabe qué músculo está entrenando. Y faltan las
variantes con mancuernas.

**La solución, y lo único que NO se puede romper: son DOS LISTAS SEPARADAS.**

- **`ejercicios` se queda intacta.** Es la que alimenta las marcas de fuerza y
  el percentil de Strength Level, que está calibrado sobre los tres exactos con
  barra. Agregarle variantes rompería la comparación.
- **`movimientos`, tabla nueva, SOLO para el contador de series:** por zona y
  patrón en vez de por nombre — "pecho plano", "pecho inclinado", "espalda
  vertical", "espalda horizontal", "pierna empuje", "pierna femoral", "hombro",
  "bíceps", "tríceps", "core" — cada uno con su variante barra / mancuernas /
  máquina donde tenga sentido.
- `sesiones.bloques` pasa a referenciar `movimientos` y no `ejercicios`.

Los bloques ya guardados quedan apuntando a ids de `ejercicios`: la migración
tiene que mapearlos o dejarlos como están y que el nombre se resuelva contra las
dos tablas. Decidir cuando se haga; son pocas semanas de datos.

## 13f. PRIORIDAD DE LA TANDA 3 — el botón de volumen suma una serie

Con el teléfono en el bolsillo y sin mirar la pantalla. En web es imposible
—el navegador no ve las teclas físicas— y es de lo mejor que se gana al pasar a
nativo.

Va junto con la notificación local del descanso porque son el mismo momento: el
bucle real de una sesión es *hacer la serie → sumarla → descansar*, y hoy las
tres partes obligan a sacar el teléfono, desbloquearlo y apuntarle a un botón.

Mientras tanto, en web se hizo lo que sí se podía: el `+` ocupa media pantalla y
también está adentro de la pantalla del descanso, así que el bucle no obliga a
salir y volver.
