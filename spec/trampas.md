# Trampas

Bugs que ya nos costaron una vez. Cada uno arrancó pareciendo otra cosa.

Leer antes de tocar el área correspondiente. Una línea por trampa: qué pasó y
qué regla queda.

---

## Motor (three.js)

**`sizeAttenuation: false` mide en píxeles físicos, no en unidades del mundo.**
Las partículas salían del tamaño correcto en una pantalla y diminutas en otra,
según el `devicePixelRatio` del teléfono.
→ **Regla:** con `sizeAttenuation: false`, escalar el `size` por el DPR
(`Math.min(devicePixelRatio, 2)`). Ver `src/motor/subida.ts`.

**El quad del shader tiene que ser `PlaneGeometry(2, 2)`, siempre.**
Se le cambió el tamaño a la geometría para achicar el cuerpo y el disco dejó
de entrar: se veía el cuadrado recortando al planeta. `vP` tiene que ir de −1
a 1 para que el shader dibuje el disco completo.
→ **Regla:** la geometría nunca cambia; el tamaño en pantalla lo da
`mesh.scale`. Ver `src/motor/shaders.ts`.

---

## Supabase Storage

**`remove()` devuelve éxito con cero archivos borrados si falta la política de
`delete`.** Con RLS activa, "no hay política" es "prohibido", pero la API no
da error. Una baja de cuenta borró todo menos el avatar, que quedó huérfano en
un bucket público y descargable por cualquiera con la URL.
→ **Regla:** nunca alcanza con mirar `error`; hay que **contar los archivos
que volvieron borrados** y abortar si no coinciden.

**La lectura de un bucket público NO pasa por la RLS.** Bajar por
`/storage/v1/object/public/...` no consulta las políticas, así que una política
de `select` amplia no es lo que hace que las imágenes se vean — solo habilita
*listar* el bucket, que es justo lo que no querés.
→ **Regla:** acotar el `select` a la carpeta propia. Las imágenes se siguen
viendo. Verificarlo con un cliente anónimo antes de asumirlo.

**Las políticas de `storage.objects` se evalúan TODAS en cada consulta**, sin
importar el bucket. Si una falla, tumba la consulta entera — un bucket puede
quedar "protegido" por un error ajeno en vez de por su propia política.
→ **Regla:** no apoyarse en eso. Cada bucket se protege solo.

---

## Racha y fechas

**Los descansos no pueden aplicarse para atrás.** Con una sola columna de días
de descanso que se pisa, cambiar de rutina en marzo recalculaba enero y hacía
perder rachas ya ganadas.
→ **Regla:** configuraciones **fechadas**. Cada cambio guarda desde cuándo
rige y el cálculo de cada día usa la que estaba vigente **ese** día. El pasado
no se reescribe nunca.

**`mejor_racha` como contador que solo sube es un dato falso para siempre.**
Si alguien registra días por error y los borra, el récord tiene que bajar.
→ **Regla:** el máximo **sale del historial** (`mejor_racha_real`), no se
acumula.

**El servidor está en UTC y el usuario en UTC−3**, así que a las 21:00 de
Uruguay el día del servidor ya cambiaba. El primer arreglo fue peor que el
problema: la fecha pasó a mandarla **el cliente**, acotada a ±1 día, y eso
dejó una ventana de tres días para elegir. Adelantar la hora del teléfono,
registrar "mañana", volverla atrás y registrar "hoy" daba **dos días de racha
en un día real**, repetible.
→ **Regla:** el día lo decide el **servidor**, con la **zona** del usuario
(`mi_hoy()`). El cliente manda la zona, nunca la fecha, y esa es toda la
diferencia: una zona se verifica contra `pg_timezone_names`, una fecha es un
número que el cliente inventa.

**Un parámetro que se ignora MIENTE, y no era uno: eran siete.** Quedaron de
cuando el cliente mandaba la fecha; desde la migración 12 el día lo decide el
servidor y el parámetro no se mira. Se dejaron "por un deploy" y sobrevivieron
nueve migraciones. El costo real: la sección 6 del e2e pasaba `p_fecha` con
otra fecha creyendo que elegía el día, registraba hoy, chocaba con el día que
ya estaba, y **la prueba de la subida de rango no probaba nada**. Nadie lo vio
porque el test leía `data` sin mirar `error`.
→ **Regla:** un parámetro que no se usa se **borra** (migración 22), no se
ignora. Y no queda como revisión que alguien tiene que acordarse de hacer: la
sección 34 de `test:db` le pregunta a `pg_proc` los argumentos de entrada de
cada función y falla si alguno no aparece en el cuerpo.

Tres cosas que hicieron ruido al armar ese chequeo:

- **`proargnames` trae también los nombres de las columnas de salida** de las
  funciones `returns table(...)`, y esos por definición no aparecen en el
  cuerpo. Sin filtrar por `proargmodes`, el chequeo denunciaba media base y no
  servía para nada. Se filtra a los modos `i` y `b`.
- **`\b` dentro de un template literal es el carácter de retroceso**, otra vez
  — y esta vez adentro del chequeo que existe para cazar esta familia. Van dos
  barras, siempre.
- **Dropear una función la devuelve con EXECUTE para PUBLIC.** `create or
  replace` no puede cambiar la lista de parámetros, así que hay que dropear; y
  al recrearla vuelve con el permiso por omisión de Postgres. La migración 22
  dejaba siete funciones SECURITY DEFINER abiertas a `anon` hasta que se le
  agregó el `revoke`. Lo agarró `test-deriva` comparando la migración contra
  `schema.sql`.

**Y leer `data` sin mirar `error` convierte cualquier fallo en un misterio.**
El e2e decía "esperaba 40, obtuve null", que manda a buscar el problema en la
racha en vez de en la llamada.
→ **Regla:** el error se chequea SIEMPRE, con su propio `chequear`, antes de
mirar el resultado.

**Cambiar la zona tampoco regala días.** Registrás, movés la zona adelante,
"hoy" pasa a ser mañana, registrás de nuevo.
→ **Regla:** entre dos días tienen que pasar 20 horas de reloj real **si la
zona cambió** desde el último día registrado. Condicionado al cambio y no a
secas, porque entrenar un lunes a las 23:00 y el martes a las 07:00 son ocho
horas y dos días de verdad: la guarda incondicional rechazaba el segundo.

**Una guarda que bloquea sin explicar se lee como una app rota**, y más cuando
lo que está en juego es la racha. La guarda igual puede agarrar a un viajero
legítimo —vuela de noche, entrena al otro día, no pasaron 20 horas— y ahí no
hay forma de distinguirlo de la trampa.
→ **Regla:** el día **no se rechaza, queda pendiente** (`dia_pendiente`) y se
registra solo apenas pasa la ventana, resuelto perezosamente desde
`verificar_perdida`. Y `registrar_dia` **devuelve un resultado estructurado en
vez de tirar excepción**: una excepción deshace la transacción, así que no
había forma de guardar el pendiente y avisar en la misma llamada.

---

## Fuerza

**Epley con UNA repetición devuelve un 3% de más.** `peso × (1 + reps/30)` da
`peso × 31/30` cuando reps = 1, así que el mismo levantamiento daba distinto
según si se cargaba como "1RM real" o como "estimado de 1 repetición".
→ **Regla:** el caso de una repetición se saca a mano y devuelve el peso tal
cual. No hay nada que extrapolar. Ver `un_rm()` en `schema.sql`.

**Contra quién se compara cambia el resultado entero.** El percentil global
salía de los usuarios de Ascent, y eso no funcionaba hasta que hubiera diez
—y aun después, el mismo levantamiento valía distinto cada vez que entraba
gente—. Al pasarlo a tablas publicadas apareció la trampa de verdad: con datos
de **competidores federados** la mediana de sentadilla está en 2,28 veces el
peso corporal, así que alguien de 80 kg que levanta 132 kg queda casi último; y
132 kg es exactamente la MEDIANA de la gente que anota en apps. La misma marca,
percentil 50 o percentil 3 según contra quién.
→ **Regla:** se compara contra gente que anota en apps (Strength Level 2026),
que es el usuario de Ascent, y **la app dice contra quién** en Ajustes. Nunca
mostrar un percentil sin decir de qué población salió.

**Sumar percentiles no da un percentil.** El primer intento sacó la categoría
del total sumando los umbrales de los tres ejercicios. Está mal: los tres
levantamientos están correlacionados pero no son el mismo, así que la suma se
distribuye **más angosta** que sus partes. En el medio el error es chico —por
eso pasa desapercibido— y en las colas se rompe: ser élite en los tres a la vez
es mucho más raro que el 5%, así que "élite total" regalaba una categoría que
casi nadie tiene.
→ **Regla:** la categoría es **por ejercicio y nada más**. Para el total está
el DOTS, que existe justamente para resumir los tres en un número comparable.

**La categoría es el dato; el porcentaje es una derivación nuestra.** La fuente
publica cinco categorías, no una curva. Todo lo que hay entre ellas lo
interpolamos.
→ **Regla:** la categoría va primero y más grande. Y donde no hay datos no se
inventa: debajo del primer umbral no hay categoría, arriba del último el
porcentaje se corta en 95, y un peso corporal fuera de tabla usa el borde y lo
avisa. Extrapolar daría un número con la misma pinta que los demás y ningún
respaldo.

**La muestra de mujeres es mucho más chica en todas las fuentes** —un millón de
resultados contra casi diez millones en press de banca—, y presentarlos con la
misma firmeza le da a uno una precisión que no tiene.
→ **Regla:** con sexo femenino, la app lo dice al lado del número.

**Los coeficientes del DOTS no se tipean de memoria.** Un dígito cambiado
ordena mal el ranking y nadie lo nota, porque el número igual parece
razonable.
→ **Regla:** salen de la fuente (OpenPowerlifting) y se verifican contra un
caso publicado en `test:db` — hombre de 90 kg con 650 kg de total da 420,29.
Y el peso corporal se **acota** al rango calibrado, nunca se extrapola.

---

## Tiempo

**Una PWA suspende `setInterval` cuando la pantalla se apaga o la app pasa a
segundo plano.** Un cronómetro que acumula ticks se congela ahí: una sesión de
una hora marca veinte minutos, y el usuario no tiene forma de saber cuál de
los dos números es el bueno.
→ **Regla:** no se cuentan ticks. Se guarda el **timestamp de inicio** y en
cada pintada se calcula `transcurrido = ahora - inicio`. El `setInterval`
existe para repintar, no para contar. La duración que se GUARDA la calcula el
servidor, que es el único reloj confiable. Ver `cronometro.md` §17.5.

---

## Cosas que creemos y no probamos

**"En web no se puede" también hay que verificarlo.** La spec §13b afirmaba
que declarar la categoría de audio era imposible en web y que por eso el aviso
del descanso cortaba la música. Las dos mitades estaban sin medir: Safari
implementa la Audio Session API —`transient` es literalmente "un ping de
notificación que suena por encima de la reproducción"— y el sospechoso más
probable del corte no era el bip sino el `AudioContext` que quedaba despierto
los tres minutos del descanso.
→ **Regla:** un "no se puede" en la spec envejece igual que un dato. Antes de
mandar algo a la etapa nativa porque la web no llega, comprobar que siga siendo
cierto. Y lo nuevo tampoco está medido: sigue sin probarse en un iPhone.

**Se reverificaron las cinco** el 21/8/2026, con fecha y fuente en
`etapa-nativa.md` §13y. Tres seguían bien (geofencing, salud, vibración), una
estaba mal (audio) y otra estaba **mal por el motivo equivocado**: avisar con
la pantalla bloqueada SÍ se puede en web —Web Push anda en iOS desde 16.4 para
una PWA instalada— y lo que no existe es la notificación *local* programada.
Queda en nativo por costo, no por imposibilidad, y decirlo así importa: una
razón equivocada no se puede volver a evaluar cuando cambian las condiciones.

**La sonda de deploy también necesita su autotest.** Antes de dar un veredicto
busca un texto que TIENE que estar con el cliente viejo y con el nuevo. Sin eso
no distingue "no está" de "no supe mirar", y dio dos veces TODAVÍA VIEJO de un
deploy que ya había salido: leía la pantalla apenas la red se aquietaba, antes
de que Ajustes recibiera el perfil y pintara sus secciones.

**El truco de vibración en iPhone: INFORMACIÓN SIN VERIFICAR.** Circula que
`<input type="checkbox" switch>` (Safari 17.4) dispara el motor háptico si se
lo toca por JavaScript, y que **Apple lo tapó en iOS 26.5**. Las dos mitades
salen de **una sola fuente** y **nadie lo probó en un iPhone de verdad**.
→ **Regla:** tratarlo como rumor, no como dato. Sirve para no perder una tarde
redescubriéndolo; no sirve para decidir nada.

**Actualización del 21/8/2026:** la primera mitad quedó confirmada —iOS 18 sumó
hápticos NO estándar al `<input type="checkbox" switch>`— y la segunda sigue sin
verificarse. Igual no cambia nada: no es una API general y no sirve para el
aviso de descanso. Y la Vibration API de verdad **sigue sin existir en WebKit**,
que además se opone formalmente a implementarla.

---

## El schema y las migraciones se separan solos

**Nadie había comprobado nunca que `schema.sql` desde cero produzca la misma
base que el schema original más las migraciones**, y son diecisiete. La
promesa del repo —"en una base nueva no hace falta ninguna"— era una promesa
sin prueba. Cuando se probó, había una diferencia: `hoy_uy()` seguía viva en
producción porque la migración 13 la reemplazó y **nunca la dropeó**.
→ **Regla:** una migración que reemplaza una función tiene que **dropear la
vieja**. Y `npm run test:db` corre `test-deriva.mjs`, que levanta las dos
bases en PGlite y las compara entera: columnas, tipos, restricciones, índices,
funciones, políticas, permisos, triggers y las filas del catálogo.

**Y las dos salen del repo**, así que si PRODUCCIÓN se separó de las dos,
ninguna se entera. Las migraciones se corren pegando SQL a mano en el SQL
Editor, que es justo donde se pierde un bloque sin que nadie lo note.
→ **Regla:** `npm run test:conexion` le pide a la base real su propio retrato
(`retrato_del_schema()`) y lo compara contra el de una base levantada solo con
`schema.sql`. La consulta vive **en la base** y no en los tests: si estuviera
duplicada en los dos lados tendríamos exactamente el problema que estos tests
persiguen, una capa más arriba.

**La primera vez que miró producción encontró un secreto.** En producción hay
un trigger `sugerencia-nueva` sobre `feedback` que no está en el repo: lo creó
Supabase al armar el webhook de sugerencias desde el panel, y **su definición
lleva la service_role key en texto plano**, más el header `x-ascent-secreto`.
El retrato devolvía `action_statement` tal cual y estaba otorgado a `anon`, así
que cualquiera con la anon key —que viaja en el bundle del navegador, es
pública por diseño— podía pedirlo y llevarse la llave que saltea toda la RLS.
→ **Regla:** el retrato devuelve **nombres en claro y todo el contenido
hasheado** — cuerpos de funciones y de triggers, defaults de columnas,
expresiones de restricciones, definiciones de índices, el `using` y el `with
check` de cada política, y las filas del catálogo de ejercicios en un solo
hash. Anotar el objeto que filtró en una lista de excepciones tapa ESE caso; el
próximo objeto que alguien cree desde el panel con un secreto adentro vuelve a
filtrar por el campo que quedó en claro. Un md5 distinto delata el cambio
igual, y el nombre alcanza para saber dónde ir a mirar. Queda en claro solo lo
que no es texto libre y sí importa leer: tipos, `not null`, `prosecdef`, la
volatilidad, el comando de cada política y quién tiene cada permiso.

Y de paso: **lo que crea el panel de Supabase no pasa por ninguna migración**,
así que es exactamente lo que este test existe para encontrar. Lo que vive solo
en producción a propósito se anota en `SOLO_EN_PRODUCCION`, con el motivo.

**Un retrato de la base viva no se le da a un anónimo**, aunque hoy todo lo que
devuelva esté publicado en GitHub. Refleja producción, no el repo —esa es la
diferencia entera—, y las políticas de RLS legibles por máquina y siempre al
día son un mapa de cómo funciona la seguridad.
→ **Regla:** `retrato_del_schema()` es `security definer`, con `search_path`
fijo, sin EXECUTE para `public` ni para `anon`, y `test:conexion` inicia sesión
con la cuenta de prueba (`CONEXION_EMAIL` / `CONEXION_PASSWORD` en
`.env.local`).

**Un grant a `anon` se ve igual que una función cerrada** si nadie mira los
permisos. El retrato original comparaba tablas, columnas, funciones y
políticas, pero no **quién puede ejecutar qué** — justo el agujero que lo
estrenó. Apenas se agregó el tema encontró una segunda diferencia real:
`tope_calendario()` estaba otorgada a mano en la migración 13 y no en
`schema.sql`.
→ **Regla:** el tema `permisos de función` sale de `aclexplode`, con
`coalesce(proacl, acldefault(...))` porque el caso peor es la función que nadie
tocó: `proacl` viene en NULL y el permiso por omisión de Postgres es EXECUTE
para PUBLIC.

**Y la lista de temas no se escribe a mano.** `test-deriva` los tenía
hardcodeados y el tema nuevo no se comparó: pasó en verde sin mirarlo.
→ **Regla:** los temas salen de la unión de lo que devuelven las dos bases.
Una lista fija deja pasar en silencio lo que nadie agregó a la lista.

Dos cosas que hicieron ruido al armarlo y conviene no volver a pisar:

- **Las migraciones NO son idempotentes contra un schema más nuevo.** El
  primer intento fue aplicarlas sobre el schema de hoy y la 09 revienta con
  "cannot remove parameter defaults", porque la 13 ya le cambió el default a
  esa función. Hay que reproducir la historia desde el schema original, que
  sale de git.
- **El fin de línea y los comentarios generan falsos positivos.** El archivo
  en disco viene con CRLF y `git show` con LF, así que el md5 del cuerpo de
  cada función daba distinto y el test denunciaba deriva en las treinta. Se
  normaliza el salto de línea, se sacan los comentarios y se colapsan los
  espacios: lo que importa es que las dos bases se COMPORTEN igual, no que la
  prosa coincida.
- **El NOT NULL cambió de lugar entre versiones de Postgres.** Desde PG 17
  tiene fila propia en `pg_constraint` y en la versión de Supabase todavía no,
  así que la primera corrida denunció 66 restricciones "faltantes" que estaban
  las dos veces. Se filtra `contype <> 'n'`: el NOT NULL ya se compara arriba,
  en `columnas`.

---

## Tests que mienten según la hora

**Dos secciones probaban la guarda del cambio de zona con Montevideo → Tokio**,
que son doce horas. Buena parte de la jornada las dos zonas caen en el MISMO
día del calendario, y ahí mover la zona no da ningún día que ganar: no hay nada
que bloquear, no queda pendiente, y lo que sigue no prueba nada. El test pasaba
en verde media vuelta al reloj y se caía la otra media, con un error de clave
duplicada que no tenía nada que ver.
→ **Regla:** cuando un test depende de que dos zonas caigan en días distintos,
el par tiene que hacerlo **a cualquier hora**. Midway (UTC−11) y Kiritimati
(UTC+14) están a veinticinco horas: no pueden coincidir nunca. Y el helper que
prepara el estado **comprueba que quedó preparado** (`bloqueó y dejó un
pendiente`) en vez de dejar que la falla aparezca diez líneas más abajo,
disfrazada de otra cosa.

---

## Credenciales

**Las claves de las cuentas de prueba estuvieron en `spec/estado.md`**, en un
repo público, mientras el trabajo de la semana era justamente cerrarle el
retrato de la base a los anónimos. "Solo para autenticados" no vale contra
alguien que lee el repo.
→ **Regla:** en el repo va el **nombre de la variable**, nunca el valor. Las
claves viven en `.env.local`. Y la clave que el e2e le pone a sus cuentas
descartables sale de `randomBytes`, no del sello de fecha y hora, que se
adivina leyendo el archivo. Las que estuvieron publicadas quedan en el
historial de git para siempre: **rotarlas es la única salida**, borrar la línea
no alcanza.

---

## Verificar el deploy, no deducirlo

**Antes de una migración con orden invertido hay que saber si producción ya
sirve el cliente nuevo, y deducirlo falla callado.** Las dos formas obvias
dieron respuestas que parecían buenas: el hash de los chunks cambia por el
ENTORNO y no solo por el código, así que "distinto a mi build local" no
significa "viejo"; y buscar `localStorage` en el bundle da lo mismo antes y
después del puerto de almacenamiento, porque el módulo de plataforma queda
empaquetado ahí igual.
→ **Regla:** `npm run verificar:deploy` entra con un navegador real y mira una
MARCA. Hay dos clases y no siempre sirve la misma: algo que el cliente viejo
mandaba en un RPC —solo si ese RPC sale al abrir la app— o un texto que solo
existe en el cliente nuevo. La 23 necesitó la segunda: agrega un parámetro a
`registrar_dia`, que se llama recién cuando alguien registra un día. La sonda
también falla si no llegó a mirar nada: silencio no es éxito.

---

## Documentar no alcanza

**`\b` adentro de un template literal mordió TRES veces**, la última dentro
del chequeo que existe para cazar esta familia. Estaba anotado acá desde la
primera, con la regla escrita y todo, y se volvió a escribir mal igual.
→ **Regla:** el error tiene que ser **imposible**, no estar avisado.
`bordeDePalabra()` en `supabase/utiles.mjs` arma el patrón concatenando —donde
`'\\b'` es inequívoco— y la sección 36 de `test:db` recorre `src/` y
`supabase/` y falla si aparece un `\b` suelto adentro de un backtick. Se
recorre carácter por carácter y no con un regex, porque hay que saber si se
está adentro de un backtick y eso un regex no lo sabe.

Es la lección general: cuando algo se repite habiendo estado documentado, lo
que falta no es más documentación.

**Y el `window.dispatchEvent` no necesitaba un puerto: necesitaba desaparecer.**
El aviso de sesión viajaba por `window`, que en Expo no existe. Un emisor en
memoria (`src/plataforma/eventos.ts`) hace exactamente lo mismo —los oyentes
están en el mismo proceso— así que en vez de un puerto con dos
implementaciones, el problema se fue.
→ **Regla:** antes de armar un puerto, mirar si la dependencia de plataforma
era necesaria. El de `ascent:instalable` SÍ se queda en `window`, y por el
motivo contrario: `beforeinstallprompt` es del navegador y la sección Instalar
entera desaparece al migrar.

---

## Lo escrito dos veces

**Hay reglas que corren en SQL y en el cliente a la vez**, porque la pantalla
no puede pedir un viaje de red por tecla: el 1RM, el número de rango, los
nombres de los planetas y qué descansos rigen en una fecha. Nada avisa cuando
una de las dos copias se toca sola.
→ **Regla:** todas viven en `src/lib/reglas.ts`, que **no importa nada** para
que Node pueda cargarlo, y la sección 26 de `test:db` corre las dos contra los
mismos valores. Si le agregás un import a ese archivo, el test deja de poder
cargarlo y la red se cae sin hacer ruido.

---

## Lo que solo se ve mirando

Estas dos vivieron varias tandas en la app, con los tests en verde, porque
**nadie miraba la pantalla**: el panel de preview del entorno se colgaba y el
QA visual quedaba pendiente. Las encontró la primera corrida de
`npm run capturas`.

**Una letra de más y la sección entera no existe.** `estandares.ts` filtraba
por sexo con `'M'`/`'F'` y la base guarda `'m'`/`'f'` (el check de
`profiles.sexo`). El bloque "Dónde estoy" no se dibujaba nunca: sin error, sin
warning, sin hueco — la condición daba falso y no había nada. Los tests
pasaban porque llamaban a la función con `'M'` directamente.
→ **Regla:** cuando el cliente compara contra un valor que decide la base, el
test tiene que traer el valor **de la base**, no repetirlo.

**Y no era un caso, era una familia.** Hay ocho `check (... in (...))` en el
schema —visibilidad de fotos, unidad de peso, estados de amistad, de reto y de
sesión, tipo de feedback, sexo— más los ids del catálogo de ejercicios. Todos
tenían su copia en el cliente y ninguno estaba comprobado contra nada.
→ **Regla:** las listas viven en `src/lib/tipos.ts`, como **valores** y no solo
como tipos —un tipo se borra al compilar y no se puede comparar contra la
base—, y los tipos se derivan de ellas. La sección 33 de `test:db` le pregunta
a Postgres qué acepta cada check y lo compara. Los módulos que no pueden
importar nada (`dias.ts`, `estandares.ts`) **exportan su literal** para que la
sección 33 lo pinee igual.

Dos detalles del que lo escriba:

- Postgres **no** guarda el `in (...)` que uno tipeó: lo normaliza a
  `= ANY (ARRAY['a'::text, 'b'::text])`. Buscar `IN (` en `pg_get_constraintdef`
  no encuentra nada y el test pasa en verde sin comparar nada.
- Adentro de un template literal, `` `` `` es el carácter de **retroceso**,
  no el borde de palabra del regex. `` new RegExp(`${col}`) `` busca un
  byte 0x08. Van dos barras.

**Un saliente más grande que el margen no es un saliente, es un recorte.** Los
títulos salen del margen izquierdo a propósito (§19.1), con
`margin-left: calc(var(--sangria) * -1)`. Pero `--sangria` era 32px y el margen
lateral de `.pantalla` 20px, así que cada título quedaba 12px afuera de la
pantalla: "STATS" se leía "TATS", en todas las pantallas de la app.
→ **Regla (corregida):** el saliente tiene su propia variable, `--saliente`,
y tiene que ser **menor** que `--sangria`. Y `capturas` ahora mide lo que queda
en x negativo, porque **`scrollWidth` no lo ve**: lo que se va por la izquierda
se recorta y el documento ni se entera. La comprobación de overflow que había
solo miraba la derecha y esto le pasó por al lado.

**La primera regla estaba mal, y estuvo mal seis tandas.** Decir "el saliente y
el margen salen de la MISMA variable" arregla el recorte y crea otro problema:
con saliente igual a margen, los títulos quedan en **x = 0 exacto**, pegados al
borde de la pantalla, sin un píxel de aire. Eso es lo que se veía en Stats, El
año, Sesiones, Álbum y Ranking. Y la foto de perfil de `/yo` nunca se enteró
de la regla: se quedó con `-32px` a mano y siguió cortada todo ese tiempo.
→ **Regla:** una variable propia, `--saliente: 10px`, menor que la sangría, y
**todos** los que se salen la usan — títulos, número de racha y foto de `/yo`.
→ **Y lo que esto enseña de los tests:** la guarda de `capturas` mide `x < 0`,
así que un título en `x = 0` le pasa por al lado y da verde. Un test que busca
"se sale" no encuentra "no respira": son dos cosas distintas, y la segunda solo
la ve un ojo.

---

## Build y entorno

**Las `NEXT_PUBLIC_*` se incrustan al COMPILAR.** Cambiarlas en Vercel no
cambia nada hasta que se vuelve a desplegar, y todo lo que llevan viaja al
navegador.
→ **Regla:** ahí nunca va un secreto, y después de tocarlas hay que
redesplegar. Ver `src/lib/supabase/client.ts`.

**OneDrive corrompe la caché de `.next`.** Sincroniza los miles de temporales
que Next escribe mientras los escribe: `Cannot find module './543.js'`,
`EINVAL readlink`. Se arreglaba borrando `.next` y volvía a pasar.
→ **Regla:** el proyecto vive fuera de OneDrive (`C:\Users\agusc\ascent`). Si
esos errores reaparecen ahí, es otra cosa.

**`npm run build` con el dev server prendido corrompe `.next`.** Comparten
carpeta. `npm run capturas` levanta su propio `next dev` y caía en lo mismo, así
que corre con `NEXT_DIST_DIR=.next-capturas` y su propio puerto: se puede correr
con el dev server prendido sin tocarle nada.
→ **Regla:** apagar el dev server antes de buildear. Siempre.

**Un `spawn` de taskkill antes de `process.exit()` no llega a correr.** El
script de capturas mataba el dev server con la versión asíncrona y salía en la
línea siguiente: el proceso padre se moría antes, el server quedaba vivo
ocupando el puerto, y la corrida siguiente le habló a ESE servidor —viejo, con
otra carpeta— y se colgó.
→ **Regla:** matar con `spawnSync`, y comprobar que el puerto esté libre antes
de arrancar en vez de dejar que Next se corra solo a otro.

**Una captura de página completa dibuja los elementos `fixed` en el medio.** La
nav y el logo flotante quedaban estampados sobre el contenido —la primera
corrida se comió el número de DOTS— porque `fullPage` estira el alto y lo
`fixed` se queda pegado a la ventana.
→ **Regla:** para la foto larga se los **esconde** (`visibility: hidden`), que
es la única maniobra que no puede mover nada: `fixed` está fuera del flujo, así
que sacarlo no relayoutea la página. Y aparte va una foto del tamaño de la
ventana con todo puesto.

Las otras dos formas se probaron y salieron peor, así que no volver a
intentarlas: con `position: static` cada uno cae donde lo puso el DOM y el logo
terminaba encima del DOTS igual; con `absolute` + `bottom: 0` cae en el medio,
porque se resuelve contra un ancestro del alto de la ventana; y moverlos al
final del `body` **rompió el layout entero** —media pantalla en blanco—, porque
reparentar saca al elemento de donde React lo espera.
