# Etapa nativa (Expo)

Lo que una PWA no puede hacer y espera a la versión nativa. Documentado, NO implementado.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.
Lo que está acá ya está decidido y no se rediscute salvo que se indique.

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
3. **Salud** — `disponible()`, `pedirPermiso()`, `entrenamientosDelDia(fecha)`.
   En web `disponible()` es `false` y el resto no hace nada.
4. **Avisos** — `programar(id, cuando, texto)`, `cancelar(id)`, `permiso()`. En
   web solo con la app adelante; en nativo, notificación local que llega con la
   pantalla bloqueada (§13b). El descanso ya tiene esta forma —programar al
   empezar, cancelar al saltar—, así que `Descanso.tsx` pasa a llamar al puerto.
5. **Háptica** — `disponible()`, `pulso(patron)`. `descanso.ts` ya tiene
   `vibrar()` y `puedeVibrar()`; se mudan.
6. **Audio** — HECHO, y resultó NO ser 100% nativo. `preparar()`, `avisar()`,
   `soltar()`, `respetaLaMusica()`. En web: `navigator.audioSession.type =
   'transient'` cuando existe (Safari), y el `AudioContext` suspendido salvo
   los 400 ms que suena, que llega a todos los teléfonos. En nativo se declara
   la categoría de verdad y además suena con la app cerrada (§13b).

Y los chicos: **Wake Lock** (`expo-keep-awake`), **recorte del avatar**
(canvas → `expo-image-manipulator`) y **exportar datos** (descarga del
navegador → share sheet).

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
- Conviene exigir permanencia mínima en la zona, no solo el ingreso.
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
