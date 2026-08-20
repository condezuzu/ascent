# Vuelta de tuerca estética + el cronómetro en Inicio

**Estado: implementado** (20/8/2026). Falta correr la **migración 16** para el
contador de series.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.

---

## 19. Por qué se ve genérico

El diagnóstico es correcto y se puede señalar con precisión, que es lo que lo
hace arreglable:

- **Un solo radio para todo.** `--radio: 14px` en las tarjetas, `12px` en los
  botones, `10px` en los inputs, `9px` en los chips. Cuatro valores del mismo
  rango: la app entera es un rectángulo redondeado repetido en cuatro tamaños.
  **El radio intermedio es la huella dactilar de la plantilla.**
- **La caja es la unidad de todo.** Cada bloque es `.tarjeta`: mismo padding
  (16 px), mismo borde (0.5 px), mismo fondo. Cuando todo está en una caja, las
  cajas dejan de significar algo.
- **Una sola columna al 100%.** Todos los bloques ocupan el ancho entero y
  arrancan en el mismo margen izquierdo. La composición de la principal —el
  número que se sale del margen, la barra al 62%, RACHA en vertical— **no se
  repite en ninguna otra pantalla**, y por eso la principal se ve distinta y el
  resto se ve de fábrica.
- **Tres botones que son el mismo botón.** Sólido, fantasma y texto: mismo
  ancho, mismo alto, mismo radio, distinta pintura.

Nada de esto es un problema de gusto. Son cuatro decisiones por defecto
tomadas cuatro veces.

### 19.1 Las cuatro reglas que propongo

**1 · El radio es 0 o es 999. Nada en el medio.**

Los bloques estructurales pasan a **esquina viva**: tarjetas, hojas, campos.
El radio de píldora (`999px`) se reserva para lo que **se elige**: presets,
selectores, el botón de descansar. Así la forma dice qué hace la cosa —lo
cuadrado se lee, lo redondo se toca— y desaparece el 14px de fábrica.

**2 · La caja se cambia por una línea y aire.**

La mayoría de las `.tarjeta` no necesitan caja: necesitan separación. Se
reemplazan por una **línea de pelo arriba** y el contenido colgando de ella,
con el doble de aire abajo. Es la gramática de una revista, no la de un panel
de control.

La caja queda **solo** donde algo tiene que sentirse contenido: el número de
DOTS, la zona de eliminar cuenta, el descanso corriendo. Tres lugares, y por
eso significan algo.

**3 · Una sola medida fuera de grilla, repetida.**

La principal ya tiene la suya: el número se sale 32 px del margen izquierdo y
la barra ocupa el 62%. Esa medida —**32 px de sangría y 62% de ancho**— pasa a
ser la regla de la app:

- Los títulos de sección se salen 32 px a la izquierda, como el número.
- Los datos tabulares se alinean a la columna del 62%, no al borde.
- El texto corrido se queda en el margen normal.

Repetir **una** irregularidad la vuelve intención; tener una distinta por
pantalla la vuelve descuido.

**4 · Tres botones con tres formas, no tres pinturas.**

| | Forma | Para qué |
|---|---|---|
| Sólido | rectángulo de esquina viva, ancho completo | la acción de la pantalla, una sola |
| Fantasma | **texto con una línea debajo**, sin caja | lo secundario |
| Píldora | redonda, chica, en fila | elegir entre opciones |

El fantasma deja de ser una caja vacía —que es lo que lo hace parecer
deshabilitado— y pasa a ser texto subrayado, que se lee como enlace y no como
botón apagado.

### 19.2 Lo que NO se toca

- **La tipografía.** Inter / Outfit / Geist Mono ya está decidida y funciona.
- **Las paletas por rango.** Siguen siendo la mecánica central (§7).
- **El motor y el velo.** El fondo no cambia.
- **El número de racha como única cosa grande.**

Esto es una vuelta de tuerca sobre lo que ya hay, no un rediseño.

---

## 20. El cronómetro en Inicio

La barra vuelve a **cinco**: Inicio, Ranking, Álbum, Stats, Ajustes. La
pestaña "Sesión" y la franja de arriba de la barra se van.

### 20.1 Los dos relojes son dos cosas distintas

Es el error que había que arreglar: sesión y descanso usaban el mismo
cronómetro y el mismo estilo. Se separan por **tres ejes a la vez**, no por
color:

| | Sesión | Descanso |
|---|---|---|
| Dónde | arriba a la derecha, al lado de la racha | debajo, o a pantalla completa |
| Forma | chip de contorno, esquina viva | píldora rellena |
| Dirección | cuenta **hacia arriba** | cuenta **hacia abajo** |
| Peso | apagado, del tamaño del nombre | acento del rango, más grande |

Con eso, un vistazo alcanza: si hay algo relleno y bajando, estás descansando.

### 20.2 Los tres estados

**En reposo** — un chip discreto arriba a la derecha, contorno fino, con un
ícono de cronómetro y nada más. Se toca y aparece **"Iniciar entrenamiento"**.

**Andando** — el mismo chip muestra el tiempo en mono, contando hacia arriba,
con un punto que late. Al lado, una **píldora rellena "Descansar"**.

**Descansando** — la píldora se convierte en la cuenta regresiva y sigue
estando ahí. Tocarla abre la pantalla completa (§18.6), que no cambia.

Nada de esto compite con el número de racha: los dos viven en la fila del
encabezado, que es la fila más chica de la pantalla.

### 20.3 "Serie hecha": el disparador que sí podemos copiar

En Strong y Hevy el descanso arranca solo al terminar una serie. Dije que no
se podía copiar porque Ascent no registra series — y **la salida es más barata
de lo que pensé**, como marcaste:

**Un botón de un toque: "Serie hecha".** Sin ejercicio, sin peso, sin
repeticiones. Hace dos cosas:

1. Suma uno al contador de series de la sesión.
2. **Arranca el descanso.**

Con eso tenemos el disparador de Strong sin construir un registro de series, y
aparece un dato que antes no existía: **cuántas series hizo la sesión**. Va a
Stats al lado de la duración, y es más honesto que los minutos —cuarenta
minutos con doce series y cuarenta con tres no son el mismo entrenamiento—.

Cómo entra:

- Con la sesión andando, **"Serie hecha" es el botón sólido de Inicio**. Es lo
  que más se toca durante un entrenamiento, así que se lleva el lugar bueno.
- El contador se muestra chico al lado del cronómetro: `12 series · 48:20`.
- "Descansar" suelto sigue existiendo para el que quiera descansar sin contar
  una serie.
- En la base: una columna `sesiones.series int not null default 0` y un RPC que
  incrementa. Nada más.

**Decidido: sí, con un "−" al lado del contador**, disponible toda la sesión y
no solo al instante. Y **deshacer una serie NO cancela el descanso**: son dos
cosas separadas y el descanso se cancela por su lado. Si deshacer lo cancelara,
corregir un número te costaría el temporizador que estabas usando.

### 20.4 Qué se va

- La pestaña "Sesión" y la ruta `/sesion`.
- La franja de arriba de la barra (`FranjaSesion`).
- `"Leaderboard" → "Ranking"` **se queda**: era mejor nombre igual, más corto y
  en español, y ya no depende de que entren seis pestañas.
