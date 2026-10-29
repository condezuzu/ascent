# Alcance congelado

*Congelado el 15 de septiembre de 2026, a pedido del humano: "llevamos más de dos
meses; cada vez que uso la app aparecen features nuevas". Hasta terminar estas
dos listas NO entra nada nuevo.*

**La regla:** lo que aparezca usando la app se clasifica en una de tres:

1. **Bug** — algo que ya existe y anda mal. Entra siempre.
2. **Texto o ajuste visual** de algo que ya existe. Entra si es chico.
3. **Feature nueva.** Va al final de este archivo, en "Después", y no se toca
   hasta que las dos listas estén en cero.

Si no está claro si algo es 2 o 3, es 3.

---

## Lista 1 · Para que la web esté terminada de verdad

### Código

| # | Qué | Notas |
|---|-----|-------|
| W1 | Probar en el iPhone el arreglo del lag del `+`/`−` del peso | Arreglado el 15/9 (la cola esperaba a la red). Falta la prueba en el gimnasio. |
| W2 | Estancamiento por ejercicio con pesos | Espera datos: no antes del **9/11/2026**. Ver `peso-y-estadistica.md`. |
| ~~W3~~ | ~~"Hiciste 102 en banca, ¿lo guardo como marca?"~~ | **Hecho el 15/9**, en la web y en la nativa. |
| ~~W4~~ | ~~Login con Google~~ | **No entra.** Código borrado el 15/9. |
| W5 | Sacar la sección Diagnóstico de Ajustes | Se queda hasta que el registro automático esté probado **en el gimnasio con la app nativa**. |
| W6 | Poner al día `spec/estado.md` | Tiene corte al 21 de agosto. |
| ~~W7~~ | ~~Revisar sesiones con el total de series de menos~~ | **Hecho por el humano el 15/9**: una sola (07/09, 19 → 20), corregida. |
| W8 | La pantalla de entrada (cuatro pantallas + la animación de los ocho objetos) | **Pedida por el humano el 15/9**, con el alcance ya congelado: entra por decisión suya, no por la regla. Banco de pruebas en `/galeria/bienvenida`; los tiempos y las curvas, en `src/lib/bienvenida.ts`. |

### Lo que hace el humano (no es código)

| # | Qué |
|---|-----|
| H1 | ~~Variables de Web Push en Vercel.~~ **Sin efecto desde el 22/9/2026:** el aviso de las 20:30 se sacó. Las variables que queden en Vercel (`VAPID_*`, `CRON_SECRET`) ya no las lee nadie. |
| H2 | Probar el recorrido nuevo (Ajustes → "Ver la guía de nuevo") y el volumen nuevo. |

---

## Lista 2 · Para llegar a la tanda 3 (usar la app nativa en el gimnasio)

La tanda 3 es la **build de desarrollo instalada en el teléfono**. Lo mínimo
para dejar la web en el gimnasio es el bucle de una sesión: iniciar, contar
series, descansar, terminar — con y sin señal.

| # | Qué | Tandas |
|---|-----|--------|
| ~~N1~~ | ~~Sesión nativa: iniciar, cronómetro, terminar, cierre por inactividad~~ | **Hecho el 15/9**, con la MISMA lógica que la web (`compartido/`) |
| ~~N2~~ | ~~El bloque: selector de 100 ejercicios, meta, `+`/`−`, lista para corregir, peso con su etiqueta y la pregunta~~ | **Hecho el 15/9** |
| ~~N3~~ | ~~Descanso con notificación local (suena con la pantalla bloqueada) y la cola sin señal~~ | **Hecho el 15/9**. El aviso con la pantalla bloqueada se prueba recién en el teléfono (N4). |
| N4 | Build de desarrollo con EAS e instalarla en el iPhone, y probar ahí lo que el navegador no puede (aviso con pantalla bloqueada, vibración, pantalla despierta, "deshacer") | 1 |
| ~~N4b~~ | ~~Interruptor del sonido del descanso en Ajustes nativo~~ | **Hecho el 15/9**, adelantado (junto con la duración del descanso). |
| H3 | **Humano:** cuenta de Expo (gratis) y Apple Developer Program (99 USD/año) | **Lo hace el humano esta semana y avisa.** No se recuerda desde acá. |
| H4 | **Humano:** `ascent://confirmar` en Supabase → Authentication → URL Configuration → Redirect URLs | Solo para crear cuenta o recuperar la contraseña desde la app. Entrar con contraseña no lo necesita. |

**Queda una tanda: N4**, que espera la cuenta de Apple. Orden confirmado por el humano el 15/9.

Lo que estaba en el orden anterior —calendario con el resumen del día, peso,
fuerza, foto al registrar— **no hace falta para entrenar**: se sigue mirando en
la web mientras tanto. Si va antes, suma unas tres tandas a la llegada.

### Primero después de la tanda 3 (ya decidido, no es alcance nuevo)

- Botón de volumen suma una serie (§13f).
- Live Activity del descanso en la pantalla bloqueada (§13d).
- Registro automático al llegar al gimnasio con geofencing (§13).
- Calendario, peso y fuerza en nativo.
- ~~Ventana de las vidas y registrar el día con foto en nativo~~: **hechas el 15/9**, adelantadas mientras llega la cuenta de Apple.

---

## El plan después del lanzamiento (decidido por el humano el 8/10/2026)

La 1.0 está en la tienda. Esto es lo que sigue, EN ESTE ORDEN. La regla del
alcance congelado sigue valiendo adentro de cada tanda: lo que aparezca en el
camino se anota abajo, en "Después", y no se mete.

### EL ORDEN, desde el 13/10/2026 (reemplaza al orden de las tandas de abajo)

Decidido por el humano el 13/10, después de la cacería de ese día. **La regla
que lo ordena: antes de agregar nada nuevo, la app no puede perder lo que la
gente ya hizo.** En una app de racha, perder un día es lo peor que puede pasar.

1. **Cerrar la cacería del 13/10.** Regla: no se arregla nada que no esté
   reproducido. Hecho: los que seguían vivos de la anterior, la migración 73
   (el vínculo sigue a la sesión y es de a dos) y **los 13 que rompían datos**
   (casi todos de señal mala; migración 74). Detalle local:
   `spec/caza-2026-10-13-detalle.md`. Quedan sin tocar los "se ve feo" y los
   teóricos no verificados.
2. **La rutina como algo propio** (decidido el 13/10, hacerla tal cual):
   - una tabla propia: por cuenta y por día de la semana, los ejercicios con
     sus series. Nunca pesos;
   - paso 1, SIN migración: mirarla, plegada por día ("Lunes — Pecho, hombro y
     brazo"; los grupos salen del catálogo), en Stats → Entrenamiento, en el
     perfil propio y en el de un amigo. Mientras no se edite, se llena con lo
     deducido del historial. Arregla que hoy nadie ve su propia rutina (la
     función la devuelve; `PerfilPropio` nunca la pide);
   - paso 2: editarla desde Stats (con migración);
   - paso 3: copiar y pegar un día propio a otro, y la rutina de un amigo. Si
     el destino ya tiene ejercicios, PREGUNTA "reemplazar" o "agregar al
     final". La copiada de otro es una copia libre, sin atadura;
   - paso 4: que la sesión arranque desde la rutina del día.
3. **El aviso fuera de la app** cuando alguien quiere unirse. Va por OTA
   (comprobado en `telefono` y en la build 7 de tienda): falta pedir el token,
   la tabla de tokens, y algo que mande.
4. **El refactor del estado del entrenamiento** —un solo dueño del dato—.
   **Al arrancar este punto, recordarle al humano el dominio** (ver punto 7).
5. **El multijugador completo**: grupos de verdad, tiempo real, sin el parpadeo.
6. **El selector de ejercicio y la guía corta** (ver "tres personas se trabaron").
7. **La build 8, al final de todo.** Primero se publica todo por OTA y recién
   ahí se compila, con todo lo nativo junto: una sola revisión de Apple y una
   actualización completa. La rama `build-8-nativo` queda como está y no se
   compila. **El widget de la pantalla bloqueada SÍ entra** (decidido el
   13/10): se prepara en la rama cuando llegue el momento, no antes.
   **El dominio es lo único que no puede esperar al final:** queda compilado
   adentro de la build, así que se decide antes.

**Las medallas por pasos NO se hacen** (decidido el 13/10): ver abajo.

Las letras del plan viejo (de la A a la I) ya no se usan: cada cosa va con su
nombre. La que era "H" es el refactor del estado del entrenamiento.

**Cómo se publica cada tanda:** migración primero (si hay), después UNA OTA a
`telefono`, la prueba el humano en el iPhone, y recién después `store`.

### Límite aceptado: la hora de entrenar por las fotos y las medallas (15/10/2026)

Con "Avisar cuando entreno" apagado, un amigo ya no ve a qué hora entrenaste por
los días (migración 86), por las marcas (87) ni por el nombre de una foto nueva.
**Queda a la vista, y se decidió dejarlo así:**
- la hora de subida de una foto compartida con amigos (`photos.creado` y el
  `created_at` del archivo): el amigo necesita poder bajar el archivo, y la regla
  del storage que se lo permite lee la tabla `photos`;
- el nombre de las fotos subidas antes del 15/10, que lleva la hora en milisegundos;
- `medallas.actualizado`, que dice cuándo abriste tu perfil (no cuándo entrenaste).

**El motivo:** taparlo pide firmar los enlaces de las fotos desde el servidor y
cambiar cómo la app guarda las medallas (un upsert necesita leer todas las
columnas). Es mucho trabajo para tapar la hora de subida de una foto que la persona
eligió compartir. Si algún día molesta, se revisa.

### Hecho el 8/10 (sale en la próxima OTA)

- El álbum: miniaturas hechas por el teléfono (no la transformación de
  Supabase, que es de plan pago y con cupo de 100 por mes), la tira del visor
  que no titila, y no recargar al volver a la pestaña.
- Saber qué versión corre la gente (migración 63).
- La tarjeta de la pantalla bloqueada sigue al ejercicio y no dice "4 de 3".
- Bienvenida: sin el desenfoque que en el iPhone se veía como una placa blanca,
  y la lista de ejercicios más larga.

### Tanda 1 — entender la app y que ande en cualquier teléfono (hecha el 8/10)

- **La guía de primera vez.** Ya existía (cinco pantallas, una línea cada
  una, con "Saltar"). Le faltaba decir cómo se entrena: se sumó ese paso.
  **Desde el 7/10 arranca sola** en un aparato que no la vio (antes solo al
  elegir el nombre), y "Saltar" es un botón con borde. Consecuencia sabida: con
  esa OTA la ve una vez todo el que no la había terminado en ese teléfono.
- **Calidad del fondo.** La app mide los cuadros por segundo y baja sola la
  calidad si el teléfono no da; en Ajustes se puede fijar a mano.

### Tanda 2 — barato y se nota (hecha el 8/10, sin probar en el teléfono)

- **Ver los pasos durante el entrenamiento.** Hecho dentro de la app: el
  renglón de pasos se queda durante la sesión, sin la barra, y se vuelve a
  pedir cada minuto. Los pasos ya se leían de Salud (HealthKit está en la
  build 7). Verlos en la tarjeta de la pantalla bloqueada queda para la build.
- **Abrir la foto de perfil de un amigo** para verla grande. Hecho, sin
  migración: el bucket `avatares` es público desde siempre.
- **La vibración del descanso, más larga y marcada.** Hecho. iOS no deja
  elegir cuánto dura una vibración, así que son varias: con la app abierta,
  tres encadenadas; bloqueado, tres avisos separados por un segundo (los dos
  de más no suenan con la app abierta). **Solo verificable en el teléfono.**
  Consecuencia sabida: en el centro de notificaciones quedan tres avisos.

### Tanda 3 — crecimiento (hecha el 8/10, sin probar en el teléfono)

- **Amigos por enlace.** Hecho: `https://…/amigo/<nombre>` es una página
  pública de la web con un botón que abre `ascent://amigo/<nombre>`; la app
  manda el pedido sola y muestra el perfil. **No sobrevive a la instalación**:
  quien no tiene la app la baja, crea la cuenta y vuelve a tocar el enlace
  (la página lo dice). Eso pide capa nativa y va a la build única. El pedido
  no los hace amigos: quien invitó acepta, porque el enlace lleva solo un
  nombre y cualquiera puede armar uno.
- **Ver la rutina de un amigo desde su perfil.** Hecho (migración 64):
  debajo de las fotos, por día de la semana, los ejercicios y cuántas series,
  de las últimas cuatro semanas. Nunca pesos ni duración (§17.8 sigue: la
  tabla de sesiones no se abre). Prendido por omisión; se esconde en Ajustes.
  Hubo un aviso de una vez ("Novedad: tus amigos ahora ven tu rutina…", y el
  de "ven cuando estás entrenando"). **Sacado el 29/10, a pedido**: empujaba
  el contenido, tapó «Anotar peso» y de noche no entraba nunca. La app ya no
  avisa novedades; las dos opciones siguen en Ajustes.

### UNA sola build para todo lo nativo (decidido el 7/10/2026)

Cuando toque compilar, va **todo junto en la misma build**, para gastar una
revisión de Apple y no tres. Hasta entonces se junta acá y no se compila por
una sola cosa:

- la tarjeta de la pantalla bloqueada: que muestre "Serie 0" / el ejercicio
  recién elegido con su meta (hoy el widget esconde la serie 0), y los pasos
  si se decide mostrarlos ahí;
- **la tarjeta de la pantalla bloqueada muestra al compañero** (pedido del
  humano, 14/10): entrenando con otro, su ejercicio y su serie, o al menos
  cuánto le falta de descanso. Es Swift (el widget): va en esta build;
- **el inglés de lo que vive en la build** (14/10): la app ya cambia de idioma
  por OTA, pero los carteles de permisos de iOS (ubicación, cámara, Salud,
  avisos: `infoPlist` de `app.json`) y la tarjeta Swift ("DESCANSO"/"LISTO")
  siguen en español. Van con `InfoPlist.strings` en inglés y el texto del widget
  según el idioma;
- **que el aviso del descanso suene con el teléfono en silencio y la app cerrada**
  pide el permiso de alertas críticas de Apple, que ya se decidió no pedir (ver
  arriba). Con la app abierta ya suena en silencio (categoría de audio Playback);
- **el enlace de amigo tiene que sobrevivir a la instalación.** Hoy el
  invitado sin la app la baja, crea la cuenta y tiene que VOLVER a tocar el
  enlace (la página lo dice en tres pasos numerados): se pierde la mitad de la
  gracia de la invitación. Y que el `https` abra la app directo, sin pasar
  por la página (dominios asociados);
- **con el dominio definitivo ya elegido** (ver "dominio propio" más abajo):
  es condición para compilar, no un detalle;
- **el aviso de fin de descanso** (decidido el 12/10): desde ese día es UNA
  notificación —las tres del 8/10 llenaban el centro de notificaciones—, y la
  tarjeta con la cuenta corriendo ya existe desde la build 7. Lo que la build
  agrega, y está preparado en la rama `build-8-nativo` (NO en `main`): un
  sonido propio (el "corte 1", elegido el 13/10: ver
  `spec/sonido-del-aviso.md`), y un archivo de silencio para que, con
  "Sonido al terminar" apagado, el aviso vibre sin sonar. Sonar con el teléfono
  en silencio pide un permiso de Apple que no se va a pedir. Que la tarjeta
  SUENE sola al terminar, sin notificación, pide un servidor que la empuje
  (APNs): no entra en esta build;
- **por qué lo nativo va en una rama y no en `main`:** tocar `app.json` o los
  archivos nativos cambia la huella de la app, y el guardián deja de publicar
  OTAs a las builds que ya están en la calle. La rama se junta con `main`
  recién cuando la build nueva existe;
- los cambios al widget (Swift): entran en la build 8, y se preparan en la
  rama cuando llegue el momento. Acá no se compila Swift, y un error ahí se ve
  recién en la build: se prueba primero con una build `telefono`;
- ~~Diagnóstico sin depender de una variable de compilación~~: **NO es de la
  build** (revisado el 13/10). La variable se mete en el JavaScript al
  exportar, y decidirlo por `Updates.channel` es código que viaja por OTA;
- **el aviso fuera de la app** (alguien quiere unirse) **NO pide build: va
  por OTA. Comprobado el 13/10/2026**, de dos formas:
  - en la build de `telefono`, Diagnóstico → "Probar avisos remotos": Apple
    dio un token (264 caracteres) y Expo otro (`ExponentPushToken…`);
  - en la build 7 DE TIENDA, bajada de EAS (`bd30a91b`): el perfil de
    aprovisionamiento y la firma del ejecutable traen
    `aps-environment = production`.
  Falta hacerlo: pedir y guardar el token (OTA y una migración), y algo que
  mande cuando se crea un pedido de unión. **Sin armar todavía**;
- **si alguna vez se quiere que la tarjeta suene sola** (APNs sobre la Live
  Activity), el módulo Swift tiene que pedirla con `pushType: .token` (hoy
  `nil`): eso SÍ es build. No está en el alcance; si no entra en la 8, es
  otra build;
- lo que quede pendiente de capa nativa al llegar ese día.

### Tanda 4 — lo grande (la versión chica del entrenamiento compartido, hecha el 12/10 SIN el dueño único)

- **Hecho el 12/10: "entrenar con otro", de a dos** (migración 67), para
  probarlo en el gimnasio. En "Entrenando ahora" hay un "Unirse"; al otro le
  aparece el pedido en Inicio; si acepta, los dos se ven en Ranking, en
  "Entrenando contigo": ejercicio, serie y descanso. Nunca pesos ni duración.
  - *Cómo se hizo sin el dueño único:* el teléfono PUBLICA una foto de lo que
    muestra Inicio, por un canal aparte, y nunca lee de vuelta. No toca el
    contador, la caché ni la cola (`nucleo/enVivo.ts`, y un test lo exige).
    Cortar lo hace el botón "Terminar", no una lectura de "corriendo", que
    puede parpadear.
  - *Límites aceptados por el humano:* se pregunta cada 10 segundos (no es
    tiempo real) y solo con la app adelante; de a dos; sin aviso fuera de la
    app; con el teléfono bloqueado el renglón queda congelado (el descanso se
    sigue viendo bien: se publica cuándo termina); y el parpadeo cosmético de
    lo que ve el otro cuando las copias del estado no coinciden.
  - *Probado:* por la API y con dos navegadores a la vez contra la base real
    (`supabase/probar-juntos.mjs`, que corre en `test:real`). **No probado en
    dos teléfonos.**
  - *"Entrenando ahora" se prende también al iniciar una sesión a mano*, no
    solo al llegar al gimnasio marcado. Sigue pidiendo "Avisar cuando
    entreno", que ahora está en Ajustes para todos (antes solo con gimnasio
    marcado).
  - *Arreglos del 12/10, después de la cacería* (migración 68): el vínculo se
    corta cuando la sesión se cierra por CUALQUIER camino (un disparador en la
    base, no solo el botón "Terminar"); lo que el otro publicó en un
    entrenamiento anterior ya no se muestra como de ahora; la cuenta del
    descanso del otro se ve aunque tenga el teléfono bloqueado ("sin señal" la
    tapaba a los dos minutos); y prender "Avisar cuando entreno" a mitad de
    sesión surte efecto en el acto.
  - *"Avisar cuando entreno" nace PRENDIDO* (decidido el 12/10, migración 68):
    apagado no arrancaba nunca. Se avisa una vez, igual que la rutina.
  - *De a dos por ahora* (decidido el 12/10). Grupos, después del dueño único.
- **Lo que falta del entrenamiento compartido**, y sigue esperando al refactor
  del estado del entrenamiento: grupos de más de
  dos, tiempo real, la tira en Inicio, echar, invitar por link, y el aviso
  fuera de la app (este último va a la build única).
- **Hecho el 13/10, en `telefono`:** la pantalla del descanso nueva, que
  cuando se entrena con otro muestra abajo, en chico, el ejercicio, la serie y
  la cuenta del otro. El arco va con el color del rango; el celeste queda
  pendiente de decisión (es una línea).

- **Entrenamiento compartido:** ver a alguien "entrenando ahora" y unirse, y
  en Ranking ver en vivo su descanso, su serie y qué está haciendo. Entre 5 y
  10 personas. No es solo diversión: sirve para organizarse mientras se
  descansa, y si entrenás con alguien que no tiene la app, verla funcionar es
  el mejor anuncio que hay.
  - **Primer paso: el refactor del estado del entrenamiento** (un solo dueño
    del dato). Es el que ya estaba anotado más abajo ("Un solo dueño del
    estado de la sesión de entrenamiento"). No es una tarea aparte: el
    multijugador completo no se empieza hasta que esté.

### Del gimnasio, 10/10/2026 (después de dos días de uso)

- **Hecho: el peso de la última vez al lado de cada ejercicio**, en la lista.
  Es lo más pesado de la última sesión en que se hizo, con su modo ("30 kg
  c/u"). Mira 90 días, como el resto de los pesos recordados. Solo en la app.
- **Las vidas no están rotas.** La regla (`impulsos_ganados`, migración 34):
  dos para todos, y la tercera se tiene mientras la racha esté en 20 o más. Si
  la racha baja de 20, la tercera se va.
- **Hecho: "la próxima, más"** (migración 65, decidido el 10/10). Al llegar a
  la meta con el mismo peso en todas las series el bloque ofrece el toque; la
  vez siguiente la app propone ese peso con un disco más y dice de dónde sale
  ("La última: 4 × 60 kg. Hoy prueba 62,5 kg."). La marca vive EN LA BASE —es
  una decisión sobre el futuro y no se puede ir con el teléfono— y se gasta
  sola la próxima vez que se hace ese ejercicio con peso. Se descartó que la
  app lo proponga sin preguntar: subir depende de las repeticiones, que no
  conoce.
- **DECISIÓN A REVISAR (no es un pendiente): no se guardan repeticiones.**
  Escrito con las dos caras, porque la premisa de la app pasó a ser anotar lo
  que se levanta:
  - *Lo que cuesta:* el registro queda a mitad de camino. "4 series con 60"
    no es "4 × 8 con 60": no se puede calcular volumen de verdad, ni saber
    sola si un peso quedó chico, ni comparar una sesión con otra más que por
    peso y cantidad de series. "La próxima, más" existe para tapar justo ese
    hueco, y lo tapa preguntando.
  - *Lo que da:* una serie es UN toque, sin teclado, con una mano y
    transpirado. Es la ventaja real en el gimnasio y la razón por la que se
    sigue contando. Pedir un número por serie convierte contar en un trámite.
  - *Decidido hoy:* la serie de un toque no se rompe. Si algún día se
    revisa, la pregunta no es "¿anotamos repeticiones?" sino "¿hay forma de
    anotarlas sin agregar un toque obligatorio?" (por ejemplo, una sola vez
    por bloque y optativa).
- **LOS PASOS NO SALEN DEL TELÉFONO (decidido por el humano el 13/10/2026).**
  No se hacen medallas por pasos que vean los amigos: subir pasos a la base es
  subir un dato de salud de 46 personas, con lo que eso implica con Apple y con
  la privacidad de la gente. **Si alguna vez se hace algo con pasos, se
  calcula en el teléfono y no sale de ahí.**
  - Lo único que sigue siendo posible, sin prioridad: *solo para uno* (una
    racha de pasos en Inicio o en Stats, calculada en el teléfono con el
    historial de Salud): chico a medio, solo OTA.
  - A decidir antes: si cambiar la meta reescribe los días ya cumplidos
    (regla 3 del proyecto: el pasado no se reescribe).
- **Anotado: dominio propio para el link de invitación** (hoy
  `ascent-blush-seven.vercel.app`, que en un chat parece spam).
  - Hace falta: comprar el dominio (lo hace el humano, es un pago anual),
    agregarlo al proyecto en Vercel y cargar los registros DNS que Vercel
    indica. El dominio viejo sigue andando: los links ya mandados no se rompen.
  - En el código es UNA línea (`SITIO` en `nucleo/enlace.ts`), pero esa línea
    viaja en la app: los links que arma "Invitar con tu link" cambian recién
    con una OTA. No pide build.
  - Revisar al hacerlo: la URL del sitio y las de vuelta permitidas en
    Supabase Auth, y las de privacidad y soporte en App Store Connect.
  - **El dominio lo elige el humano y avisa (10/10).**
  - **HAY QUE DECIDIRLO ANTES DE LA BUILD ÚNICA:** los dominios asociados
    (que el `https` abra la app directo) se compilan con un dominio fijo. Si
    la build sale con `ascent-blush-seven.vercel.app`, cambiarlo después es
    otra build y otra revisión de Apple.

### PARA DESPUÉS: tres personas se trabaron en el mismo lugar (anotado el 12/10)

Tres personas no entendieron la app, y las tres se trabaron en lo mismo:
**elegir un ejercicio**. Cuando se retome, el orden es este y no otro:

1. **Primero, ver si esa pantalla se puede hacer obvia sola.** Si hace falta
   explicarla, el problema es la pantalla.
2. **Recién después, explicaciones**, y solo si hacen falta. Van EN EL
   MOMENTO —la primera vez que alguien toca "Iniciar entrenamiento"— y con el
   mínimo texto posible: cuanto más texto, más gente saltea todo.
3. **Nada de guía obligatoria con esperas forzadas.**

Y antes de tocar nada, **una consulta que diga dónde se cae la gente**: de
las cuentas que hay (42 al 12/10), cuántas iniciaron un entrenamiento, cuántas
anotaron una serie, cuántas eligieron un ejercicio y cuántas terminaron la
guía. Hoy la base sabe las tres primeras; que alguien terminó la guía se
guarda solo en el teléfono, así que para contarlo hay que empezar a mandarlo.

### Al terminar todas las tandas: otra cacería de bugs

Con muchos agentes ("ultracode"), como la del 4/10 que encontró 65. Con la regla
que funcionó: **la cacería es para ENCONTRAR, no para diseñar ni implementar.**
Los agentes buscan y reportan; qué se arregla y cómo se decide después, con el
humano.

## Después (lo que aparezca, anotado y sin tocar)

- **Reportar o esconder un ejercicio propio de un amigo** (decisión del humano,
  15/10/2026). Hoy los ejercicios propios los ven tus amigos (migración 76) y
  quedan así; cuando haya más gente va a hacer falta poder reportar uno con un
  nombre fuera de lugar, o esconderlo de tu lista.
- **El cardio con mapa, estilo Strava** (idea del humano, 14/10/2026). Hoy el
  cardio es un ejercicio que se anota en minutos (migración 76). Un recorrido
  con mapa pide la ubicación en segundo plano durante la sesión, guardar la
  traza y dibujarla: es otra cosa, y no se hace ahora.

- **Series por músculo → los ejercicios de esa semana** (15/9/2026). Tocar una
  fila de la pantalla de series y ver qué ejercicios de ese músculo se hicieron
  en la semana leída, con sus series. Es una pantalla nueva, no un ajuste.

- **El planeta del día se guarda como NOMBRE y se podría derivar del NÚMERO —
  PENDIENTE PARA DESPUÉS DEL LANZAMIENTO** (decisión del humano, 6/10/2026).
  `logs.planeta_del_dia` guarda el nombre que tocaba ese día según la escalera de
  ese momento. Pero el nombre es una función del día de racha
  (`logs.racha_del_dia`, que ya se guarda) y de la escalera de hoy
  (`planeta_de_dia`): se puede calcular en el momento de mostrarlo.
  - **Por qué importa:** guardar el nombre obligó a la migración 62 (la 54 cambió
    la escalera y lo guardado quedó con nombres que ya no existen y con días en
    blanco) y a un disparador que recalcula todos los días hacia adelante cada vez
    que se corrige uno viejo. Si se deriva, no hay nada que rellenar nunca, ese
    recálculo desaparece, y el día que se vuelva a tocar la escalera no hace falta
    ninguna migración 63.
  - **Por qué no ahora:** toca lo que dibuja el visor de fotos en la web y en la
    nativa (`VisorFoto.tsx`, `Album.tsx`, `compartido/album.ts`) a días del
    lanzamiento.
  - **Qué queda igual hasta entonces:** los días anteriores a la última pérdida
    no tienen número, así que su planeta no se podría derivar: hoy conservan el
    nombre guardado (traducido por la 62). Hay que decidir qué mostrar ahí.
- **El rango: la base manda el NÚMERO y la app calcula el NOMBRE con una regla
  propia — PENDIENTE PARA DESPUÉS DEL LANZAMIENTO** (decisión del humano,
  6/10/2026). Es el mismo error que el del planeta, al revés, y los dos se
  vieron el mismo día: el mismo dato vive en dos lugares con dos reglas.
  - **Qué pasó:** la migración 54 cambió la escalera en la base. La build 7 de
    la tienda, sin OTA, siguió calculando el nombre con la regla vieja (un rango
    cada 10 días) mientras pintaba el fondo con el número nuevo que le manda la
    base: con racha de 6 a 9, fondo del rango 2 y nombre del 1; el festejo de
    subida, en los días de la escalera nueva con los nombres de la vieja.
  - **Por qué importa:** mientras el nombre —o cualquier parte de la regla— se
    calcule en la app, cada cambio futuro de escalera rompe toda build que no
    tenga una OTA encima. Sacar el rango de la racha en el cliente (tanda 1 del
    4/10: ninguna pantalla lee `rango_actual`) dejó una sola regla ADENTRO de
    la app, pero sigue siendo una copia de la de la base.
  - **Qué habría que hacer:** que la base mande el nombre del rango y el planeta
    junto con el número (en `pantalla_inicio`, `registrar_dia`,
    `usuarios_publicos`), y que la app solo los muestre. La regla queda en un
    lugar y una build vieja muestra lo correcto sin enterarse del cambio.
  - **Por qué no ahora:** toca Inicio, Stats, Ranking, el álbum y el festejo de
    subida en las dos apps, a días del lanzamiento.
- **Diagnóstico depende de una variable de COMPILACIÓN — PENDIENTE PARA
  DESPUÉS DEL LANZAMIENTO** (decisión del humano, 7/10/2026). La pantalla de
  Diagnóstico, el botón de la caja negra y el HUD se dibujan si el JavaScript se
  armó con `EXPO_PUBLIC_DIAGNOSTICO=1`.
  - **Por qué importa:** mientras dependa de eso, un error de empaquetado la
    puede mandar a la tienda. El 7/10 la caché del empaquetador dejó afuera la
    variable en una OTA a `telefono`, y con la caché al revés la habría dejado
    adentro en una a `store`. Hoy lo frena el guardián mirando el paquete
    (`revisarPaquete`), pero es una red debajo de un diseño que permite la caída.
  - **Qué habría que hacer:** decidirlo en tiempo de ejecución —por el canal de
    actualizaciones en el que corre la app (`Updates.channel`), o por cuenta—.
    Así el mismo paquete sirve para los dos canales y ningún error de
    empaquetado la puede filtrar.
  - **Por qué no ahora:** toca el arranque (`Raiz`, el layout) y Ajustes, a días
    del lanzamiento, y una decisión por cuenta pide una columna o una lista.
- **Un solo dueño del estado de la sesión de entrenamiento** (4/10/2026).
  PENDIENTE PARA DESPUÉS DEL LANZAMIENTO, por decisión del humano: "es el
  código más delicado y no quiero tocarlo tan cerca del lanzamiento".

  *El problema.* El conteo y los bloques viven en cuatro lugares que se copian
  entre sí: el estado de React de cada instancia de `useSesion` (la pantalla y
  el vigilante del gimnasio), sus refs, la caché del aparato y la cola. Cada bug
  de la familia "una copia pisó a la otra" se arregló agregando una regla: los
  refs antes del `await`, la escritura firmada, `reconciliarConteo`, el reloj de
  toques, `bloquesSonDe`. Andan, pero se sostienen entre sí y cada una nueva
  hay que pensarla contra todas las anteriores.

  *La propuesta.* Sacar ese estado de React a un módulo de `compartido/` con un
  solo dueño, al que las instancias se suscriben. Sin copias no hay nada que
  reconciliar. Es un rediseño de `useSesion` entero, no un arreglo.

  *Lo que queda abierto hasta entonces*, de esa misma familia (está en
  `spec/trampas.md`, "Un refresco decide con una foto, y el toque cae en el
  medio"): la respuesta vieja de "no hay sesión" que llega después de Iniciar,
  y la de "está corriendo" que llega después de Terminar. (La tercera —dos `+`
  con milisegundos de diferencia— se arregló en la tanda 2: el
  leer-mezclar-guardar de la caché va en fila.)

  *Antes de empezar:* la red son los escenarios de `supabase/dobles/sesion/`
  (sección 179 de `test:db`), que corren el hook de verdad. Primero se escriben
  ahí los dos casos de arriba, en rojo, y recién después se toca el hook.
  **Hecho el 15/10:** los dos casos están escritos (escenario `viejas`, sección
  226) y salen en rojo, como se esperaba: después de Iniciar, la respuesta vieja
  del arranque deja la pantalla sin sesión; después de Terminar, la vuelve a
  mostrar corriendo. Van con `rojoConocido`: no rompen la corrida, y el día que
  salgan bien `test:db` falla hasta pasarlos a `chequear`.
  **HECHO el 15/10, de noche** (pasos 1 a 5 del plan): los dos casos en verde y
  pasados a `chequear` (226), y el estado de la sesión vive una vez por aparato
  en `compartido/sesionViva.ts` (228). Ver `spec/trampas.md`, "Un refresco
  decide con una foto". Quedó así por decisión propia: la traba de
  empezar/terminar, `ocupado`, `aviso` y `confirmando` siguen siendo de cada
  pantalla (llevarlos al dueño cambia qué pantalla muestra "se cerró sola"), y
  las reglas viejas del hook siguen puestas aunque ahora en parte sobran.
