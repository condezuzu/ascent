# Módulo de fuerza

Registro de PRs y ranking de fuerza entre amigos, con DOTS.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.
Lo que está acá ya está decidido y no se rediscute salvo que se indique.

**Estado: implementado** (16/8/2026). Falta que corra la **migración 08** en
Supabase; hasta entonces la interfaz de fuerza queda invisible sola.

Los tres puntos que estaban abiertos se decidieron el 11/8/2026 (§16.7, §16.7b
y §16.8), y el 16/8/2026 se sumó el aviso de consentimiento (§16.7c).

---

## 16. Módulo de fuerza

### 16.1 Qué es y qué no

Registro de récords personales y ranking de fuerza entre amigos.

**Convive con la racha, no la reemplaza.** Son dos ejes distintos y a
propósito: la racha es el **motor diario** —te empuja a ir hoy— y la fuerza es
el **estatus** —lo que mostrás—. Una se pierde faltando, la otra no se pierde
nunca. Si el módulo de fuerza empieza a competir por el lugar de la racha en
la pantalla principal, está mal.

### 16.2 El cálculo: DOTS

DOTS toma el total levantado y el peso corporal, y devuelve un número
comparable entre personas de distinto tamaño. Es lo que permite un ranking
entre amigos que no gane siempre el más pesado.

```
DOTS = 500 × total / (a·pc⁴ + b·pc³ + c·pc² + d·pc + e)
```

donde `total` es la suma de los tres levantamientos y `pc` el peso corporal en
kilos. Los coeficientes son distintos para hombres y mujeres (ver §16.7).

> **Al implementar: NO tipear los coeficientes de memoria.** Sacarlos de la
> fuente oficial y verificarlos contra casos conocidos antes de mostrar un
> número a nadie: un DOTS mal calculado ordena mal el ranking y nadie se da
> cuenta, porque el número igual "parece razonable". La prueba es tomar un
> levantador real con DOTS publicado y ver que dé lo mismo. También hay que
> respetar el recorte de peso corporal que define la fórmula, o los extremos
> devuelven valores absurdos.

### 16.3 Qué entra al total y qué no

Al total DOTS entran **solo tres**: sentadilla, press de banca y peso muerto.

**La fórmula está calibrada sobre esos tres.** Sumarle otros ejercicios no la
hace "más completa", la invalida: el número deja de ser comparable con el DOTS
de cualquier otra persona, que es lo único que lo hace valer.

El **catálogo de ejercicios registrables sí es grande**, al estilo Strong o
Hevy: el usuario anota lo que quiera y ve su progreso. Pero esos otros
ejercicios **no computan para el DOTS** ni para el ranking. La interfaz tiene
que dejar clarísima esa diferencia, o alguien va a cargar veinte PRs
esperando que le suba el número.

### 16.4 Cómo se carga un PR

El usuario carga **peso y repeticiones**, y elige cómo se interpreta:

- **1RM real**: lo levantó una vez, ese es el número.
- **Estimado**: se calcula con **Epley**, `1RM = peso × (1 + reps/30)`.

Las dos formas están disponibles siempre; no se fuerza ninguna. Un 1RM real
de 1 repetición y un estimado de 1 repetición dan lo mismo, que es lo
correcto.

El **peso corporal sale de la tabla `weights`**, el registro más reciente. No
se pide aparte: el usuario ya lo carga al registrar días.

Si no hay ningún peso corporal cargado no se puede calcular DOTS. Ahí no se
muestra un cero ni un error: se pide el dato explicando para qué es.

### 16.5 Reglas

- Los PRs **se cargan cuando el usuario quiere**. Sin frecuencia impuesta, sin
  recordatorios, sin caducidad.
- **No caducan nunca**, pero **siempre se muestra la fecha** en que se
  registraron. Un PR de hace dos años sigue siendo un PR, y quien lo mira
  tiene derecho a saber que es de hace dos años. La fecha no es letra chica:
  va al lado del número, no escondida en un detalle.

### 16.6 Dónde vive

**En Stats, como sección propia.** Es el lugar donde ya vive todo lo
analítico, y donde el usuario entra a buscar datos en vez de encontrárselos.

- **Ranking entre amigos**: ordenado por **DOTS total**. Al entrar, detalle
  por ejercicio.
- **Perfil público**: va la **banda** de DOTS, no el número (§16.7b).

#### Visibilidad

| Dato | Quién lo ve |
|---|---|
| Los pesos levantados | los amigos, igual que los logs |
| El DOTS **exacto** | **solo el dueño** |
| El DOTS de otro | como **banda**, nunca el número |
| **El peso corporal** | **solo el dueño, nunca se muestra** |

### 16.7b El DOTS exacto es privado

**El número exacto de DOTS solo lo ve el dueño.** En el perfil público y entre
amigos va una **banda**, nunca la cifra.

El motivo: **DOTS es una función del peso corporal y del total**. Los pesos
levantados los ven los amigos, así que el total es conocido; publicar el DOTS
exacto al lado permite despejar el peso corporal con una cuenta de dos
líneas. No sería una filtración por accidente sino por definición de la
fórmula, y rompería la regla más dura que tiene la app: el peso corporal no se
comparte nunca (§3, §4).

La banda no se puede despejar: agrupa un rango de pesos corporales posibles y
deja el dato en un intervalo demasiado ancho para que sirva.

Es la misma solución que el ranking global, y por la misma razón de fondo:
**un número exacto invita a hacer cuentas que no queremos que se puedan
hacer.** Global y amigos usan la misma pieza; no hay dos criterios.

> **Consecuencia aceptada**: el ranking entre amigos se ordena por DOTS exacto
> aunque muestre bandas, así que el orden filtra algo que las bandas ocultan.
> Se acepta porque entre amigos el peso corporal no es un secreto —se conocen,
> se ven en el gimnasio— y es el mismo razonamiento por el que el ranking de
> amigos sí lleva posiciones y el global no. Si alguna vez deja de valer, la
> salida es ordenar por banda y mostrar los empates como empates.

La banda no cierra el agujero del todo, y eso se avisa: ver §16.7c.

### 16.7c Se avisa antes, no se tapa

La banda achica la filtración pero no la elimina. El problema es más amplio
que el orden del ranking: **los amigos ya ven los levantamientos exactos**, y
DOTS es una función del total y del peso corporal. Con el total conocido,
cualquier señal de DOTS —la banda, el percentil, el puesto en la lista— acota
el peso corporal a un intervalo. Más ancho que un número, pero un intervalo.

Entonces no se presenta como si estuviera resuelto. **Cuando el usuario carga
el sexo y con eso activa el DOTS, la app se lo dice en una línea**, ahí mismo,
antes de guardar: sus amigos van a poder deducir aproximadamente cuánto pesa.

Es consentimiento informado, no una fuga silenciosa. Quien lo lee y activa
igual sabe qué está entregando; quien no quiere, no carga el sexo y sigue
usando todo lo demás (§16.7). La diferencia entre las dos cosas es una línea
de texto, y es la que decide si la app fue honesta.

Reglas de esa línea:

- **Va donde se activa**, junto al campo de sexo en Ajustes, no en una ayuda
  ni en un aparte que nadie abre.
- **Dice qué se deduce, no cómo**. "Aproximadamente cuánto pesás" alcanza; la
  aritmética de despejar la fórmula no es información útil para el usuario.
- **No es una advertencia con tono de alarma.** No hay nada roto: es una
  consecuencia de comparar fuerza entre personas de distinto tamaño. Se dice
  en el mismo tono que el resto de la app.
- **No se puede desactivar por separado.** No hay un "DOTS sin filtración":
  quien no quiere entregar eso, no carga el sexo. Un interruptor extra sería
  prometer algo que la fórmula no puede cumplir.

#### Global: contra el mundo, no contra Ascent

**No se compara contra los usuarios de la app.** Se compara contra tablas de
estándares publicados, por sexo, peso corporal y ejercicio, que viven en el
repo (`src/lib/estandares.ts`).

El motivo es que el otro camino no funciona: un percentil calculado contra los
usuarios de Ascent no existe hasta que haya gente, y mientras tanto cambia de
significado cada vez que entra alguien — el mismo levantamiento vale distinto
en marzo que en agosto. Con una tabla fija, el número sirve desde el primer
usuario y no depende de que la app crezca.

**Contra quién: gente que anota sus levantamientos en una app.** La fuente es
Strength Level (estándares 2026, levantamientos cargados entre marzo de 2015 y
marzo de 2026). **Esta elección cambia el resultado entero y por eso está
dicha en Ajustes.** La alternativa eran los competidores federados
(OpenPowerlifting): ahí la mediana de sentadilla está en 2,28 veces el peso
corporal, así que alguien de 80 kg que levanta 132 —que es exactamente la
mitad de la gente que usa apps— quedaría casi último y abandonaría. Ninguna de
las dos poblaciones es "el mundo", y la elegida tampoco: quien anota series en
una app ya entrena más que el promedio.

**La categoría es el dato; el porcentaje es nuestro.** Lo que publica la
fuente son cinco categorías —principiante, novato, intermedio, avanzado,
élite— y cada una es un punto de la distribución (5, 20, 50, 80, 95). El
porcentaje sale de interpolar entre esos cinco puntos. Por eso la interfaz
muestra la categoría primero y más grande.

**Por ejercicio y NUNCA para el total.** "Top 25% en peso muerto" es
accionable y compartible; un agregado tapa justo al que tiene un levantamiento
fuerte y otro flojo. Y para el total ya está el DOTS, que existe para eso.
Sumar el umbral del 50% de los tres **no da** el umbral del 50% del total: los
tres levantamientos están correlacionados pero no son el mismo, así que la
suma se distribuye más angosta que sus partes. En el medio el error es chico y
en las colas se rompe — ser élite en los tres a la vez es mucho más raro que
el 5%, así que un "élite total" calculado así regala una categoría que casi
nadie tiene.

**Debajo de la primera categoría se muestra la distancia**, no un hueco. Ahí
abajo cae casi todo el que recién empieza, y "Arrancando" a secas no da ninguna
razón para volver. "Te faltan 8 kg para principiante" motiva y no inventa una
categoría que la fuente no nombra.

**La muestra de mujeres es mucho más chica** en todas las fuentes —un millón de
resultados contra casi diez en press de banca—, así que la app lo dice en vez
de presentar los dos números con la misma firmeza.

**Fuera de la tabla no se extrapola**: se usa el borde y se avisa. Es la misma
decisión que ya toma el DOTS con su rango calibrado.

Se calcula **en el teléfono**: sin llamadas, sin depender de que un servicio
siga vivo, y anda sin internet. El peso corporal que necesita la cuenta es el
propio y no sale del dispositivo.

#### Nada de podio global

Ni puestos, ni nombres, ni top 10. **El motivo es antifraude, no estético.**
Entre amigos nadie miente porque se conocen y se van a ver en el gimnasio. En
un ranking global de desconocidos, en cambio, **ser el número uno es
exactamente el premio que hace que valga la pena inflar el número** — y no hay
forma de verificar un PR desde una app. Un porcentaje borra el incentivo:
nadie infla para pasar del 12% al 11%, porque no hay nada que ganar ahí.

Corolario: si alguna vez aparece la tentación de agregar un podio global,
esta es la razón por la que no.

**El ranking entre amigos no cambia**: ahí compararse con ellos es el punto.

### 16.7 Sexo: campo opcional, y sin él no hay DOTS

DOTS usa dos juegos de coeficientes según el sexo del levantador.

**Es un campo opcional en Ajustes, con la explicación de para qué sirve al
lado.** No se pide en el alta ni se interrumpe a nadie para conseguirlo. Junto
a esa explicación va el aviso de §16.7c: activar el DOTS deja que los amigos
deduzcan aproximadamente el peso corporal.

**Quien no lo carga no tiene DOTS.** No se asume ninguno, no se usa un juego
de coeficientes "por defecto", no se muestra un número aproximado. Un DOTS
calculado con la fórmula equivocada es un dato falso que además ordena mal el
ranking, y nadie lo notaría porque el número igual parece razonable. Es
preferible no tener número.

Sin el campo cargado, la sección de fuerza sigue funcionando para todo lo
demás: se registran PRs, se ve el progreso y se ve el historial. Lo único que
falta es el DOTS y el ranking, y ahí va una línea que explica qué falta y por
qué, no un cero ni un error.

### 16.8 Los 3 mejores pesos en la principal: una línea, y solo si hay PRs

Va **una sola línea, en Geist Mono, debajo de la tira semanal**:

```
SQ 140 · BP 100 · DL 180
```

**Aparece solo si hay PRs cargados.** Al que no usa el módulo no le agrega
nada: la pantalla le queda exactamente como estaba.

Por qué así y no de otra forma: esa pantalla **se vació a propósito** (§9 y
§7) —el número de racha es lo único grande, hay un solo botón sólido, y una
sola entrada social porque con tres se convierte en red social—. Una línea de
datos tabulares en la tipografía que existe justamente para eso pesa lo mismo
que la línea social y no compite con el número.

Se descartó esconderlos detrás de un gesto (tocar el número de racha para
darlo vuelta): **si hay que descubrirlos, nadie los ve, y el punto era
mostrarlos.** Una decisión que protege la composición a costa de que la
función no exista no es una solución.

Al implementar, cuidar dos cosas:

- **No romper la asimetría.** La línea no llega al borde: la barra de progreso
  ocupa el 62% y nada cierra en la misma vertical. La línea de fuerza se
  alinea con la tira semanal, no con el margen.
- **El DOTS no va en esta línea.** Acá van los tres pesos y nada más. El DOTS
  es un número que pide contexto —banda, ranking, comparación— y ese contexto
  vive en Stats.

### 16.9 Modelo de datos — implementado (migración 08)

- `profiles.sexo`, opcional y nullable (§16.7). Null significa "sin DOTS", no
  "por defecto".
- `ejercicios`: catálogo de solo lectura, con `cuenta_dots` marcando los tres.
- `prs`: usuario, ejercicio, peso **en kilos**, repeticiones, si es real o
  estimado, y fecha. Se guarda lo que se **levantó**, no el 1RM: el 1RM es un
  derivado, y guardarlo congelaría la fórmula del día que se cargó. Cada carga
  es una fila y la mejor gana; las viejas quedan como historial.
- El DOTS **no se guarda como columna**: se calcula. Depende del peso corporal
  actual, así que un valor guardado quedaría viejo solo. Distinto de
  `racha_actual`, que sí se guarda porque el leaderboard lo consulta en cada
  carga (§3) — acá el ranking es de amigos, no de todos.
- Los pesos de otro se leen igual que sus logs: amistad aceptada (§4).

**El DOTS se calcula en la base, no en el cliente**, y no por gusto: la
fórmula necesita el peso corporal, que el cliente de otra persona no puede
leer nunca. Los helpers que sí lo tocan (`peso_actual`, `mejores_marcas`,
`total_dots`, `dots_de`) **no se otorgan a nadie**; lo único que llama la app
son `mi_fuerza()` y `ranking_fuerza()`, que devuelven el resultado sin
devolver jamás el peso. `percentil_fuerza()` **ya no existe** (migración 21):
el porcentaje contra la tabla se calcula en el cliente, con el peso corporal
propio, que el dueño siempre pudo leer.

Único cálculo duplicado en el cliente: `unRM()` en `lib/fuerza.ts`, que
adelanta el 1RM estimado mientras el usuario escribe. Tiene que dar
exactamente lo mismo que `un_rm()` en SQL, o la hoja promete un número y la
base guarda otro.

> **Ojo con Epley**: `peso × (1 + reps/30)` devuelve un 3% de más cuando
> `reps = 1`. Ese caso se saca a mano en los dos lados. Ver `trampas.md`.
