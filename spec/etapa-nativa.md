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

## 13z. Los huecos: los nueve puertos

Todo lo que la web no puede hacer está detrás de una interfaz, con la
implementación web haciendo lo que puede.

**LOS NUEVE TIENEN SU LADO NATIVO desde el 2026-09-10 (tanda 1).**

### Dónde vive cada cosa, y por qué cambió el plan

El plan decía: "se agrega `nativo/` adentro de `src/plataforma/` y se cambia
una línea en su `index.ts`". Eso era correcto **cuando había una sola app**.
Con `movil/` como proyecto aparte, dejar la implementación nativa del lado de
Next obligaría al proyecto de Expo a importar del árbol de la web — justo la
dependencia que la migración vino a cortar. Así que:

- **El contrato** se mudó a `nucleo/plataforma.ts`. Son tipos puros, sin una
  sola API nombrada, así que pasa la sección 51 sin excepciones. Es lo mismo
  que ya eran las reglas y los textos: un archivo que las dos apps leen y
  ninguna posee.
- **La web** sigue en `src/plataforma/web/` + su `index.ts`.
- **La nativa** vive en `movil/src/plataforma/`, con su propio `index.ts`.

La sección 60 de `test:db` compara los tres: saca las llaves del contrato y
exige que los dos `index.ts` las implementen todas. **Hace falta porque son dos
proyectos con dos `tsc` distintos**: agregar un puerto y olvidarse del lado
nativo compila perfecto del lado de la web y explota en el teléfono. Y de paso
comprueba que `movil/` no importe nada de `src/`.

### Qué cambia de verdad, puerto por puerto

| Puerto | En web | En nativo |
|---|---|---|
| `avisos` | `setTimeout` con la app adelante | notificación local **con la pantalla bloqueada** |
| `haptica` | en iPhone no existe (WebKit nunca implementó la API) | golpe corto, impacto medio |
| `ubicacion` | "abrí la app en el gimnasio" | el **sistema despierta a la app** al llegar (geofencing) |
| `audio` | rogarle a la Audio Session API de Safari | categoría declarada, suena con el switch de silencio |
| `almacenamiento` | `localStorage` | AsyncStorage — el único que ya era asíncrono en web, para que hoy no cambiara ninguna firma |
| `ciclo` | `visibilitychange` + `focus` | `AppState` |
| `pantalla` | Wake Lock API | `expo-keep-awake` |
| `efimero` | `sessionStorage` | un `Map` en memoria |
| `salud` | no existe nada parecido | existe, pero **necesita build de desarrollo**: sigue vacío |

**El bip es el mismo sonido, y eso costó un archivo.** En web se sintetiza con
el AudioContext —880 Hz y 1175 Hz con rampa—; en nativo `expo-audio` reproduce
archivos, así que ese mismo sonido se generó una vez y quedó en
`movil/assets/bip.wav`. Que sean el mismo sonido no es purismo: es la
diferencia entre migrar la app y hacer una parecida.

### Lo que Expo Go todavía no puede

- **Geofencing**: las tareas en segundo plano necesitan una build de
  desarrollo. `vigilarLlegada` devuelve `false` ahí, que es exactamente el
  camino que la app ya recorre en web — no hay nada roto mientras tanto.
- **Salud**: HealthKit necesita un entitlement que Expo Go no tiene.

Las dos son la misma tarea pendiente: la primera build de desarrollo.

### Cómo se probó

`movil/src/PruebaDePuertos.tsx` lista los nueve en pantalla con lo que cada uno
contesta, y tiene dos botones —el bip y la vibración— porque **que compilen no
prueba nada**: `expo-haptics` compila perfecto en la computadora y no vibra
hasta que alguien lo toca con el teléfono en la mano. Del lado de acá se
verificó que Metro empaqueta los 6,5 MB sin un solo error de resolución.

Al pasar a Expo se agrega `nativo/` y se cambia **una línea**; ningún
componente se entera. Nada del resto de la app toca `navigator` ni `localStorage`, y la
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

## 13z-bis. Tanda 2 — entrar, y cómo se mira todo esto sin teléfono

**El login nativo (2026-09-10).** Misma base, misma cuenta, mismos datos. Lo
que importa de esa pantalla es lo que NO tiene: ni un mensaje de error propio,
ni un texto suelto, ni una regla nueva. Los mensajes de auth se mudaron a
`nucleo/errores.ts` —los usan las dos apps— y los textos salen de `T.entrar`,
como en la web. Si esa pantalla hubiera necesitado inventar algo, sería la
señal de que el núcleo quedó corto.

`mensajeDeAuth` dejó de importar el tipo `AuthError` de supabase-js: la firma
estructural —lo que lee son `message` y `status`— alcanza, y así el archivo no
importa nada de afuera y puede vivir en el núcleo.

**Lo que falta y es de otra tanda:** crear cuenta manda a confirmar el correo,
y ese enlace abre el navegador. Para que vuelva a la app hay que enganchar el
deep link con el `scheme: ascent` que ya está en `app.json`. Mientras tanto se
crea la cuenta en la web y se entra en la app, que alcanza para probar todo lo
demás.

### Inicio nativo: la racha, la semana y el botón

La segunda mitad de la tanda 2. Es el bucle entero de la app —abrir, ver el
número, tocar una vez— y de nuevo lo que importa es lo que NO tiene: ni una
regla de racha, ni el cálculo de qué día es descanso, ni el mensaje del bloqueo
de las 20 horas. Todo sale de `nucleo/`.

Probado contra la base de verdad: **la racha pasó de 1 a 2 y el botón cambió a
"Día registrado"**. Escribe con el mismo RPC y la misma guarda que la web.

**Lo que todavía no está, y cuándo entra:**

- **El objeto de rango.** Es `src/motor/` con three.js y hay que portarlo a
  `expo-gl`: es una tanda entera. Mientras tanto Inicio NOMBRA el rango en
  texto, que es justo lo que la app nunca hace en web (§7) — acá es andamio de
  migración, no diseño, y se va cuando entre el motor.
- **La foto y el peso** al registrar, que son otra pantalla.
- **El cronómetro de sesión**, que es lo que más depende de los puertos: tanda 3.
- **Onboarding: HECHO.** Una cuenta sin nombre de usuario no dibuja Inicio a
  medias: manda a elegirlo, igual que la web rebotando a `/onboarding`. Y la
  regla del nombre —tres a veinte, letras, números y guion bajo— dejó de estar
  escrita tres veces: vive en `nucleo/usuario.ts` y la comparten las dos
  pantallas de la web y la nativa. Quedan dos copias, esa y el `check` de la
  base, que es el mínimo posible: la base no puede confiar en el cliente. Hay
  un test que compara las dos.

  El aviso de "falta el nombre" sale de la CARGA y no del dibujo. Estaba en el
  render y React lo cantó —"Cannot update a component while rendering a
  different component"—: cambiarle el estado al padre mientras el hijo se
  dibuja es pedirle que rehaga un árbol que no terminó. Que hoy funcione no lo
  hace correcto.

**No hay router todavía, y es a propósito:** con dos pantallas, un router es
una dependencia y una capa de indirección para contestar lo que contesta un
`if`. Entra cuando entre la barra de navegación.

### Cómo se verifica la app nativa sin el teléfono

`movil/` ahora corre también en el navegador (`npx expo start --web`), y **eso
es una herramienta de verificación, no un producto**: la versión web de Ascent
es la app de Next y va a seguir siéndolo. React Native Web sirve para una cosa
concreta y valiosa: hasta ahora, todo lo que se escribía del lado nativo era
código que nadie podía mirar hasta tener el teléfono en la mano. Con esto se
puede sacar una foto de la pantalla al tamaño de un teléfono, leer el texto que
salió y ver si hubo errores en consola.

**Lo que NO prueba, y hay que decirlo cada vez:** los módulos nativos. Que el
login se vea bien en el navegador no dice nada sobre si vibra, si suena con el
switch de silencio o si el sistema despierta a la app al llegar al gimnasio.
Para eso está `PruebaDePuertos.tsx` y hace falta el teléfono.

Lo que sí se probó de punta a punta, y no es poco: el login nativo le pegó a la
Supabase de verdad con datos equivocados y mostró **"Ese correo y esa
contraseña no coinciden."**, que es el texto de `nucleo/errores.ts`. O sea que
el camino entero —cliente nativo, red, error de auth, traducción compartida,
pantalla— funciona.

### Lo que hace falta para la build de desarrollo (tanda 3)

- **Cuenta de Expo** (gratis), para que EAS construya en la nube.
- **Apple Developer Program (99 USD/año)** para instalar en el iPhone. No hay
  vuelta: una build para un dispositivo físico necesita un perfil de
  aprovisionamiento, y eso pide cuenta paga. La alternativa —Xcode con una
  Apple ID gratis y certificados de 7 días— necesita una Mac, y acá hay
  Windows.
- **Android no necesita nada** más que la cuenta de Expo.

Con la build de desarrollo se destraban las dos cosas que Expo Go no puede: el
geofencing de verdad y HealthKit. Y de paso deja de importar qué versión de
Expo Go esté instalada, porque la build lleva el SDK adentro.

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


## 13e. Los movimientos del contador — RESUELTO el 2026-09-03, de otra manera

Pedido el 2026-08-29, pospuesto, y finalmente **resuelto sin la tabla nueva**:
el catálogo de `ejercicios` pasó de 31 a **100** (migración 29) y el selector
muestra el grupo muscular al lado del nombre — "Press Arnold · hombros".

**El problema, que era real.** El selector del contador tenía 31 opciones con
nombres específicos de gimnasio, faltaban las variantes con mancuernas y con
máquina, y quien no sabe qué músculo trabaja cada una no encontraba lo suyo.
Un selector que no tiene lo que hacés te enseña a no usarlo.

### Lo que se iba a hacer, y por qué no se hizo

El plan era una tabla nueva, `movimientos`, ordenada por zona y patrón —"pecho
plano", "espalda vertical", "pierna empuje"—, separada de `ejercicios` para
no tocar las marcas de fuerza ni el percentil de Strength Level, que está
calibrado sobre los tres levantamientos con barra.

**Lo que no cerraba: la separación no la daba la tabla.** La da `cuenta_dots`,
que ya existía y ya marcaba tres filas. Con dos tablas, `sesiones.bloques`
tenía que pasar a referenciar la nueva, los bloques ya guardados quedaban
apuntando a ids de la vieja, y hacía falta una pantalla más para mantenerla.
Todo eso para conseguir una separación que el catálogo único ya tenía.

Y la clasificación por patrón —"pierna empuje"— es más precisa pero menos
buscable: quien entra al selector busca el nombre del ejercicio que está
haciendo, no su categoría biomecánica.

### Lo que se hizo

- **`ejercicios` crece a 100**, con `orden` agrupando por músculo: una centena
  por grupo (piernas 100, pecho 200, espalda 300, hombros 400, brazos 500,
  core 600). El selector ordena por `orden` y los grupos salen juntos solos.
- **`cuenta_dots` sigue en tres.** No cambió nada de la fórmula, del percentil
  ni del ranking. Hay un test que lo fija junto al tamaño del catálogo: las
  dos mitades de la decisión tiran para lados opuestos y las dos tienen que
  seguir siendo ciertas.
- **El grupo se muestra al lado del nombre** en el contador y en la carga de
  marcas. No es redundante con el título del grupo: un `<select>` cerrado
  muestra solo el texto de la opción elegida, y con cien opciones la rueda del
  teléfono se come el encabezado a los pocos renglones.
- **Sin cardio.** El contador cuenta series; veinte minutos de caminadora no
  son cuatro series de nada.

**Y lo que quedaba pendiente, resuelto el 2026-09-09 (migración 31):** las
marcas ofrecían los 100, así que se podía cargar un PR de "Plancha", que es un
ejercicio de tiempo y no de peso. Se agregó `ejercicios.admite_peso`, y la
pantalla de marcas filtra por ahí. **No se partió la tabla**, que era la otra
salida: el catálogo sigue siendo uno y cada pantalla filtra lo suyo.

La lista de excepciones es corta a propósito —`plancha`, `plancha_lateral`,
`dead_bug`— y por omisión todo admite peso: flexiones con chaleco, crunch con
un disco, elevación de piernas con una mancuerna. Marcar todo eso como "sin
peso" sería decidir por el usuario cómo entrena. Quedan afuera solo los
isométricos, donde lo que se mide es tiempo.

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

## 13g. La tarea de 2,5 segundos — anotada, no perseguida

Al medir el arranque apareció una tarea larga de ~2,5 s que **sobrevive a
cortar three.js**: no es el motor. Intenté atribuirla con el perfilador de V8 y
**falló**: devolvió `(program)` en el 98% del tiempo, que es el balde de "no
estoy adentro de ninguna función JS" — parseo, compilación, recolección de
basura y trabajo interno del navegador.

El error fue de método: perfilé una ventana fija de nueve segundos de la cual
casi toda es inactividad, y eso cae en el mismo balde. La medición no distingue
esperar de trabajar, que era justo lo que hacía falta.

**Lo único que sí quedó firme:** ningún archivo de la app aparece con un costo
relevante — el más caro son 43 ms del runtime de webpack. No hay una función
nuestra comiéndose ese tiempo.

**Decisión (2026-08-29): no se persigue.** La hipótesis que queda es parseo y
compilación del bundle, y si es eso, en nativo desaparece sola: Hermes carga
bytecode precompilado, así que no hay parseo en el arranque. Perseguirla en web
sería arreglar algo que la migración borra.

Con el motor diferido, además, ya no bloquea nada: ocurre después de que la app
se puede usar.

Si al llegar a la tanda 2 el arranque nativo sigue teniendo un pozo parecido,
ahí sí hay que buscarla — y ahí el sospechoso ya no sería el parseo.
