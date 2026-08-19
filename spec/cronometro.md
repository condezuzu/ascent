# Cronómetro de sesión

Dos temporizadores que viven juntos: el de la **sesión** entera (§17), que
registra el día y guarda cuánto duró, y el del **descanso entre series**
(§18), que corre adentro de la sesión y no guarda nada.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.

**§17 — implementado** (18/8/2026). Falta que corra la **migración 09** en
Supabase; hasta entonces el cronómetro queda invisible solo. Los tres PENDIENTE
se decidieron antes de escribir el código: §17.6 queda como estaba, §17.7 con
piso de 5 minutos y §17.8 privada.

**§18 — implementado** (18/8/2026). Falta que corra la **migración 10**.
Los dos PENDIENTE se decidieron antes de escribir el código.

El **19/8/2026** el cronómetro pasó de un botón fantasma en la principal a
**pestaña propia + franja persistente** (§17.6 y §17.6b).

---

## 17. Cronómetro de sesión

### 17.1 Qué es

El **tercer camino de registro**, además del manual. A diferencia de la
ubicación y de Apple Health (§13), este funciona en la web **hoy**: no
necesita permisos del sistema operativo ni la etapa nativa.

Hace dos cosas a la vez, y esa es toda la idea: **registrar el día** y **medir
cuánto duró**. El que ya venía registrando a mano gana el dato de duración sin
trabajo extra; el que arranca con el cronómetro no necesita acordarse de
registrar.

No reemplaza al registro manual. El botón de "Registrar día" sigue estando y
sigue alcanzando por sí solo.

### 17.2 El día se registra al INICIAR

Al tocar "Empezar sesión" el día **queda registrado en ese momento**, antes de
que la sesión termine.

Registrarlo al terminar sería más prolijo y está mal: **el que se olvida de
parar el cronómetro perdería el día**, y perder un día que la persona
efectivamente entrenó es imperdonable. La racha es lo que la app protege; la
duración es un extra. Ante la duda se salva la racha y se pierde el extra.

Corolario: **una sesión iniciada por error deja el día registrado.** Se
deshace donde se deshace todo, en el calendario de Ajustes (§9), y al sacar el
día se va también la sesión.

### 17.3 A las 4 horas se cierra sola, y SIN duración

Si nunca se detiene, a las **4 horas** la sesión se cierra sola. El día queda
registrado —ya lo estaba desde el inicio— pero la sesión **no tiene
duración**.

**No se inventa un número.** No se guardan 4 horas, ni el promedio del
usuario, ni un cero. No sabemos cuándo terminó, así que no hay duración: es un
dato que no existe, no un dato en cero.

En la interfaz esa sesión se muestra siempre como **"sin duración"**, nunca
como un tiempo. Y en Stats **no entra al promedio ni al total** (§17.7):
contarla como cero hundiría el promedio y contarla como cuatro horas lo
inflaría. Cuenta como día, nunca como minutos.

**La sesión pertenece al día en que EMPEZÓ**, no al día en que se cerró. Una
que arranca a las 23:00 y se cierra a las 03:00 cuenta para el día anterior,
que es el día que ya registró al iniciar. No es una regla aparte: sale del
modelo, porque el `log_id` se fija al empezar y nada lo mueve después —ni el
cierre automático ni terminar a mano—. Está en los tests, porque las fechas ya
nos mordieron antes (ver `trampas.md`).

Quién la cierra: **nadie en particular, y por eso funciona.** No hay tarea
programada. La sesión se evalúa igual que la pérdida de racha (§12): cuando
algo la lee, si `ahora - inicio >= 4 h` pasa a `abandonada`. Así se cierra
aunque el usuario no vuelva a abrir la app, y el corte lo decide siempre el
servidor contra el `inicio` guardado, nunca el reloj del teléfono, que se
puede atrasar a propósito.

### 17.4 Si el día ya estaba registrado, no se duplica nada

Empezar una sesión en un día ya registrado **no crea un día nuevo**: la sesión
se cuelga del día que ya existe y lo único que agrega es la duración.

Esto sale gratis del modelo: la sesión referencia el `log` del día, y `logs`
ya tiene unicidad por (`user_id`, `fecha`) (§3). No hay que comprobar nada a
mano.

**Se permiten varias sesiones en un mismo día.** El que entrena dos veces no
tiene por qué elegir cuál anota. El día sigue contando una vez —la racha no
cambia— y las dos sesiones suman a las métricas.

**En un día de descanso, el cronómetro registra un día ENTRENADO** y la racha
sube, igual que si se tocara "Registrar día". El descanso es permiso para no
ir, no prohibición de ir: si fuiste, cuenta. No hay caso especial que
programar, pero sí un test que lo fija.

**Corriendo, una sola a la vez.** Empezar una sesión estando otra corriendo
cierra la anterior como **abandonada**, nunca como terminada: no sabemos
cuándo terminó. Lo garantiza un índice único parcial, no una comprobación en
el cliente.

### 17.5 La trampa: no se cuentan ticks

**El tiempo transcurrido nunca se acumula sumando ticks de `setInterval`.**
Una PWA suspende el temporizador cuando se apaga la pantalla o la app pasa a
segundo plano: el conteo se frena y una sesión de una hora marca veinte
minutos.

La regla: **se guarda el timestamp de inicio en la base**, y en cada pintada
se calcula `transcurrido = ahora - inicio`. El `setInterval` de un segundo
existe solo para *repintar*, no para contar; si se pierde diez minutos de
ticks, la próxima pintada muestra el número correcto igual.

Además:

- Al volver del segundo plano (`visibilitychange`, `focus`) se repinta al
  toque, sin esperar el próximo tick.
- **La duración guardada la calcula el servidor** (`fin = now()` adentro del
  RPC). El reloj del teléfono puede estar mal; el dato guardado, no.
- Para que la pantalla tampoco se vea mal con un reloj corrido, el RPC de
  inicio devuelve el `ahora` del servidor junto con el `inicio`: el cliente
  saca la diferencia una vez y la aplica al mostrar.

Esto queda anotado en `trampas.md`.

### 17.6 Dónde vive: pestaña propia

**"Sesión" es una pestaña**, la sexta, entre Stats y Ajustes. Adentro: sin
sesión, un botón para empezar; con sesión, el cronómetro y el botón de
terminar.

Estuvo primero como botón fantasma en la principal y **estaba mal**: un
cronómetro que hay que buscar no lo usa nadie en el gimnasio. La principal
vuelve así a su composición de siempre —el número de racha, un solo botón
sólido, la tira semanal— sin un bloque de sesión encima.

Para que entraran seis pestañas hubo que acortar "Leaderboard" a **"Ranking"**
(§9). Es el único cambio que la barra necesitaba: medido a 375 px, era la
única etiqueta que no entraba.

**El cronómetro no compite con el número de racha.** El tiempo va en mono,
tamaño medio. La racha sigue siendo lo único grande de la app.

### 17.6b La franja: lo que de verdad resuelve el problema

**Con una sesión corriendo, una franja fina se apoya arriba de la barra y se
ve en las seis pestañas**: el tiempo a la izquierda y **Descansar** a la
derecha.

Esta es la pieza importante, y la razón es una distinción que la pestaña sola
no cubre: **empezar la sesión pasa una vez por entrenamiento; descansar pasa
quince o veinte.** Si para descansar hay que cambiar de pestaña cada vez,
descansar por la app cuesta más que mirar el reloj del gimnasio, y nadie lo
hace dos veces.

Cómo se sostiene sin costo:

- **Se pinta desde una caché en el teléfono**, no consultando la base en cada
  navegación. La franja aparece en las seis pestañas y un viaje de red por
  pantalla se notaría.
- La caché guarda el `inicio` del servidor y el desfasaje del reloj, que es
  todo lo que hace falta para contar (§17.5), y **se vence sola a las 4 horas**
  igual que la sesión en la base.
- **La autoridad sigue siendo la base.** `/sesion` es la única pantalla que
  consulta `mi_sesion` de verdad y pisa la caché con lo que diga. Si la sesión
  se cerró en otro teléfono, la franja puede quedar un rato de más; se corrige
  al entrar a la pestaña. Es un desfasaje aceptado a cambio de que descansar
  sea instantáneo.

### 17.7 La duración en Stats

Sección propia, debajo del mapa de calor:

- **Promedio por sesión** — de las sesiones **con** duración.
- **Total** — la suma, en horas y minutos ("18 h 40 min", no "1120 min").

Y, si las hay, una línea honesta: **"2 sesiones sin duración"**, para que el
promedio no parezca calculado sobre más sesiones de las que en realidad entran.

Formato: siempre horas y minutos, nunca segundos. Los segundos solo se ven en
el cronómetro corriendo, donde son la prueba de que está andando.

**Decidido: abajo de 5 minutos cuenta como día pero no como duración**, igual
que las abandonadas. Empezar y parar sin querer es una duración real, y una de
cuarenta segundos tira el promedio abajo sin decir nada de cómo entrenás.

El número es arbitrario y se asume: **errarle sale barato**, porque el día se
registra igual y lo único que pasa es que se ensucia —o no— un promedio. El
umbral vive en un solo lugar (`piso_sesion()` en SQL, `PISO_SESION_SEGUNDOS` en
`reglas.ts`, comparados en el test), así que cambiarlo es cambiar dos números
que no se pueden separar.

### 17.8 Quién ve la duración

**Solo el dueño.** No va al perfil, ni al leaderboard, ni al ranking de
amigos.

El motivo: es un eje de comparación nuevo que nadie pidió, y **más tiempo no
es mejor entrenamiento** —premiaría quedarse dando vueltas—. Abrirlo después
es fácil; cerrarlo una vez que la gente lo vio, no.

**Decidido: privada.** Ni siquiera los amigos. Competir por quién pasa más
tiempo en el gimnasio **empuja a entrenar de más**, y tres horas no son mejores
que una: no es una métrica que convenga comparar. La RLS de `sesiones` tiene
una sola política, `select` del dueño.

### 17.9 Modelo de datos — implementado (migración 09)

```
sesiones
  id        uuid
  user_id   uuid  → profiles(id) on delete cascade
  log_id    uuid  → logs(id)     on delete cascade   -- el día que registró
  inicio    timestamptz not null
  fin       timestamptz                              -- null = no hay duración
  estado    text  'corriendo' | 'terminada' | 'abandonada'
  check ((estado = 'terminada') = (fin is not null))
  índice único parcial: una sola 'corriendo' por usuario
```

Tres decisiones que vale la pena que sean así:

- **La duración no es una columna**: es `fin - inicio`. Guardar el derivado
  permitiría que quedara en desacuerdo con sus propias puntas.
- **"Sin duración" es la AUSENCIA de `fin`**, no un valor especial. Y el
  `check` hace que una sesión abandonada no pueda tener `fin`: la regla de "no
  inventes un número" la sostiene la base, no la buena memoria de quien
  programe dentro de seis meses.
- **`log_id` con `on delete cascade`**: si el día se borra desde el
  calendario, la sesión se va con él. Una sesión de un día que no existe no
  mide nada.

Escritura: solo por RPC (`iniciar_sesion`, `terminar_sesion`), como
`registrar_dia`. Sin `insert` ni `update` directos desde el cliente — si no,
cualquiera se escribe el `inicio` que quiera.

La constante de **4 horas** va en `reglas.ts` y se compara contra la de SQL en
el test diferencial (sección 26 de `test:db`), como el resto de lo que está
escrito dos veces.

Va a la exportación de datos con sus dos puntas y sin la duración, que es un
derivado. La baja de cuenta la arrastra por cascada.

Y como el peso corporal no se puede escribir directo, la migración suma
`anotar_peso(fecha, valor)`: sin eso, quien ya había registrado el día no tenía
forma de cargarlo y se quedaba sin DOTS hasta el día siguiente (§16.4).

---

## 18. Descanso entre series

**Estado: propuesta, sin implementar.** Lo marcado PENDIENTE se decide antes
de escribir código.

### 18.1 Qué es

Un botón **"Descansar"** durante la sesión. Cuenta hacia atrás la duración
configurada, la pantalla cambia mientras corre, y al llegar a cero avisa.

Es la otra mitad del cronómetro: el de sesión mide el entrenamiento entero, y
este mide el hueco entre dos series. El de sesión guarda un dato; **este no
guarda nada** (§18.3).

### 18.2 Vive adentro de la sesión

**El botón solo aparece con una sesión corriendo.** No hay descanso suelto.

Y sobre todo: **descansar NO empieza una sesión.** Sería un atajo tentador
—tocás "Descansar" y arranca todo— y está mal: empezar una sesión registra el
día (§17.2), o sea que tocar un temporizador de dos minutos tendría como
efecto secundario marcar el día en el calendario. Un botón chico no puede
tener una consecuencia grande que el usuario no pidió.

Si no hay sesión corriendo, el botón no está. Para descansar, primero se
empieza la sesión, que es un botón que dice exactamente lo que hace.

### 18.3 No se guarda nada en la base

El descanso **no crea filas**. Vive en `localStorage`: un solo timestamp, el
de **cuándo termina**.

Tres razones, en orden de peso:

1. **No hay ningún dato que valga guardar.** A nadie le sirve saber que
   descansó 94 segundos entre dos series de hace tres semanas. Si algún día lo
   fuera, se agrega; guardarlo ahora es juntar basura por las dudas.
2. **Son quince o veinte descansos por sesión.** Cada uno sería una escritura
   ida y vuelta, en el subsuelo de un gimnasio con dos rayas de señal. El
   temporizador tiene que arrancar **al instante y sin red**.
3. **`localStorage` alcanza para la trampa.** Sobrevive a que se apague la
   pantalla, a que la app pase a segundo plano y a que se cierre entera. Que
   es todo lo que hace falta (§18.4).

> **El reloj acá sí puede ser el del teléfono**, a diferencia de la sesión
> (§17.5). Las dos puntas de la cuenta salen del mismo reloj, así que el
> desfasaje se cancela solo; y no hay nada que ganar haciendo trampa, porque
> descansar de más no es un premio. El único caso que rompe es cambiar la hora
> del teléfono en mitad de un descanso, y eso es hacerse trampa al solitario.

### 18.4 La trampa: la misma de siempre

**No se cuentan ticks.** Se guarda el timestamp de **fin** y en cada pintada se
calcula `restante = fin - ahora`.

Es la misma regla que la sesión (§17.5) y por el mismo motivo, pero acá se nota
más rápido: un descanso dura noventa segundos, y el teléfono se apaga solo a
los treinta. Si el conteo se congela con la pantalla, **el temporizador falla
justo en el caso normal**, no en el raro.

Al volver del segundo plano se repinta al toque, sin esperar el próximo tick, y
si el tiempo ya pasó mientras la app estaba dormida, al volver aparece
terminado. Nunca "faltan 40 segundos" cuando en realidad terminó hace dos
minutos.

### 18.5 La duración: en Ajustes y al alcance de la mano

**Predeterminada: 3 minutos.** Se configura en Ajustes, con presets rápidos:

`60s · 90s · 2min · 3min · 5min`

Los presets no son un adorno: **el descanso cambia mucho según el ejercicio**
—90 segundos para accesorios, 3 a 5 minutos para levantamientos pesados—, así
que elegir con un toque es la interacción principal, no un atajo.

Y de ahí sale una consecuencia: si cambia por ejercicio, **la fila de presets
tiene que estar también donde se descansa**. Ir a Ajustes entre serie y serie
no lo va a hacer nadie; el que necesite 90 segundos para accesorios va a usar
los 3 minutos que tenía puestos y va a descansar mal.

Entonces:

- **En Ajustes** se elige el valor **predeterminado**, el que arranca cada
  sesión.
- **En la pantalla de descanso** los mismos presets cambian el valor **para lo
  que queda de esa sesión**, sin tocar el predeterminado. El que pasa a
  accesorios toca 90s una vez y sigue.

**Decidido: para lo que queda de la sesión.** Las otras dos opciones eran que
valiera solo para ese descanso —y hubiera que tocarlo en cada serie— o que
pisara el predeterminado —y mañana arrancaras con los 90 segundos de los
accesorios de ayer—. Ninguna de las dos aguanta el uso real.

Rango admitido: de 15 segundos a 10 minutos. Los presets cubren lo normal; el
rango existe para que el campo no acepte cualquier cosa.

### 18.6 La pantalla mientras corre

**El contexto manda acá.** El teléfono está apoyado en el piso o en el banco, a
un par de metros, y se lo mira de reojo entre repeticiones. Todo lo demás sale
de ahí:

- **El número es lo único grande**, igual que en la principal (§7). Legible a
  dos metros significa un número enorme y **nada más compitiendo**: ni el
  botón, ni los presets, ni una etiqueta. Todo lo demás baja a voz baja o no
  está.
- Es el único momento en que algo compite en tamaño con el número de racha, y
  se justifica porque la racha no está en pantalla mientras descansás: el
  descanso **toma la pantalla entera**, no un bloque.
- **Se lee de un vistazo, sin interpretar.** Un número que baja y un anillo que
  se vacía. Nada que haya que comparar contra otra cosa para entender.
- **Sin rojo y sin alarma.** Terminar un descanso no es una falla ni una
  urgencia (§9: nada de cruces, nada de rojo). Es un aviso de que ya podés
  seguir.

Cómo se ve, con la paleta del rango (§7) y sin ningún color suelto:

- El fondo **se aclara** hacia `--pal-principal` mientras corre: es el único
  momento en que la app se pone más clara, y por eso se reconoce de lejos aun
  sin leer el número.
- El número, en mono, en `--pal-claro`.
- Un **anillo que se vacía**, no una barra que se llena: es una cuenta
  regresiva y tiene que verse que algo se está gastando.
- En los últimos **10 segundos** el anillo late, con la curva propia y no una
  lineal. Nada de parpadeo de emergencia.
- Al llegar a cero, el fondo vuelve de golpe al del rango. **Ese corte es el
  aviso visual**, y es el único que funciona igual en todos los teléfonos
  (§18.7).

Un botón para **saltar** el descanso y volver a la sesión, siempre visible: el
que terminó antes no tiene que esperar a que el número llegue a cero.

**Decidido: sin maqueta.** Las reglas de arriba alcanzan; el aspecto fino lo
mira el humano sobre el resultado.

### 18.7 El aviso, y hasta dónde llega

Acá está el límite real de la web, y **se dice, no se disimula**.

**La vibración va primero, el sonido después.** Un gimnasio es ruidoso y casi
todos entrenan con auriculares: un sonido se pierde, la vibración en el
bolsillo no.

| | Vibra | Suena | Ve el cambio de pantalla |
|---|---|---|---|
| Android, app adelante | sí | sí | sí |
| iPhone, app adelante | **no** | sí | sí |
| Cualquiera, app atrás o pantalla bloqueada | no | no | no |

Por qué:

- **`navigator.vibrate()` no existe en iOS.** WebKit nunca implementó la
  Vibration API y sigue sin implementarla. No es un permiso que se pueda pedir
  ni un flag: no está.
- **En segundo plano el navegador suspende el audio.** No hay vuelta en web.
- **Con la pantalla bloqueada no corre nada.** Tampoco hay vuelta.

> **No perder tiempo con el truco de iOS.** Existió: `<input type="checkbox"
> switch>` (Safari 17.4) disparaba el motor háptico si se lo tocaba por
> JavaScript, y hay librerías que lo empaquetan. **Apple lo tapó en iOS 26.5**,
> así que a esta altura no sirve —y de paso, apoyarse en un efecto secundario
> que el fabricante no prometió era pedir que se rompiera—. Lo anoto para que
> nadie lo redescubra dentro de seis meses.
>
> **Esto es información SIN VERIFICAR**: sale de una sola fuente y nunca lo
> probé en un iPhone. Está anotado como tal en `trampas.md`. Si algún día la
> decisión depende de esto, se prueba primero.

**Qué hace la app con eso:**

1. Vibra si puede (`navigator.vibrate` presente), con un patrón corto y doble
   —un solo pulso se confunde con una notificación cualquiera—.
2. Suena si el usuario prendió el sonido. **Apagado por defecto**: sonar sin
   avisar en un gimnasio es peor que no sonar.
3. **Siempre** cambia la pantalla, que es lo único que funciona en todos lados.

Y lo dice en Ajustes, en una línea, según el teléfono que tenga enfrente: en
Android, que va a vibrar; en iPhone, que **no va a vibrar** y que el aviso es
visual. Prometer una vibración que no va a llegar hace que alguien deje el
teléfono en el bolsillo y se coma tres minutos de descanso.

El aviso con la pantalla bloqueada y sin cortar la música **solo se resuelve en
nativo** (`etapa-nativa.md` §13b).

### 18.8 Wake Lock: sí, conviene

**Que la pantalla no se apague mientras corre el descanso.** Sin esto el
teléfono se bloquea a los treinta segundos y el aviso visual —el único que
funciona en todos lados— no lo ve nadie.

Lo investigué. El soporte hoy alcanza de sobra:

- **Baseline "newly available" desde mayo de 2024**, con más del 94% de soporte
  global a mayo de 2026.
- Chrome 84+ (incluido Android), **Safari 16.4+ incluido iOS**, Firefox 126+.
- Necesita **HTTPS**, que ya tenemos en Vercel. En `localhost` también anda.

Las tres reglas al implementarlo:

1. **Se pide solo mientras corre el descanso, y se suelta al terminar.**
   Tenerlo tomado toda la sesión gasta batería para nada.
2. **El sistema lo suelta solo cuando la pestaña se oculta**, y no vuelve por
   su cuenta: hay que volver a pedirlo en `visibilitychange` cuando la página
   vuelve a estar visible.
3. **Puede ser rechazado** por batería baja o modo de ahorro, y no es un error
   que haya que mostrar. **La cuenta regresiva tiene que ser correcta igual**:
   el Wake Lock es una comodidad, nunca la razón por la que el número anda.

### 18.9 Modelo de datos — propuesta

Una sola columna:

```
profiles.duracion_descanso  int not null default 180
  check (duracion_descanso between 15 and 600)
```

Implementado en la **migración 10**.

En segundos, y con `grant update` como las otras preferencias del dueño
(§4): no afecta a nadie más, así que se escribe directo y no por RPC.

**Nada más.** El descanso en curso no toca la base (§18.3). Los presets son
constantes del cliente, no filas: son cinco números que no cambian por usuario
y una tabla para eso sería una tabla vacía de significado.

El valor **elegido para la sesión en curso** (§18.5) vive en memoria y se
pierde al cerrar la app, que es exactamente lo que se quiere: mañana se arranca
con el predeterminado.
