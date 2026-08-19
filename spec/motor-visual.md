# Motor visual

Los rangos, las reglas de diseño y el motor de planetas. Nada de esto hace falta para tocar la base de datos.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.
Lo que está acá ya está decidido y no se rediscute salvo que se indique.

---

## 6. Rangos

Ocho rangos, escalados por magnitud física:

1. Polvo
2. Asteroide
3. Luna
4. Planeta
5. Sol
6. Sistema
7. Galaxia
8. Agujero negro

Cada rango dura diez días. Ocho rangos por diez días son ochenta días hasta el
agujero negro.

Al llegar al rango 8 se queda ahí. No hay rango 9 ni prestigio ni reinicio: ochenta
días de racha limpia ya es difícil de alcanzar, y el agujero negro es un buen lugar
donde quedarse.

La racha sigue subiendo aunque el rango no cambie, así que la tabla de posiciones
sigue teniendo sentido entre dos personas en rango 8.

No hay rango entre planeta y sol. Se descartaron "anillos" (Saturno ya es un día
del rango 4), "gigante gaseosa" (Júpiter cierra el rango 4), "enana marrón" (mide
casi lo mismo que Júpiter, así que no se lee como salto de escala) y
"protoestrella". El último día del rango 4 es Júpiter y el rango siguiente es el
Sol: el planeta crece hasta encenderse.

Ese salto de rango 4 a 5 es el más grande de toda la escalera, y por eso su
animación de subida es la más espectacular de las siete. Se trata como el momento
de ignición.

### Rango 4: diez planetas, uno por día

El rango 4 dura exactamente diez días. Cada día muestra un planeta distinto,
en orden de menor a mayor:

Ceres, Plutón, Mercurio, Marte, Venus, Tierra, Neptuno, Urano, Saturno, Júpiter

El planeta del día ES la barra de progreso: si ves Saturno, sabés que estás por
subir. No hace falta ningún texto.
El planeta se guarda en `logs.planeta_del_dia` y queda asociado a la foto de ese día.

Marte va naranja de verdad, sin desaturar. Es el planeta rojo y se ve como tal.

---

## 7. Reglas visuales

Estas reglas son el proyecto. Si algo las contradice, está mal.

### Que no parezca hecho por IA

El motor de planetas no tiene nada de genérico; lo que delata es la interfaz
que lo rodea. Una interfaz que toma solo decisiones por defecto —fuente del
sistema, todo centrado, espaciado uniforme, esquinas redondeadas estándar—
se reconoce a la legua.

**Tipografía:** es lo que más pesa. Nunca la fuente del sistema. Tres familias,
cada una con un trabajo y ninguna invadiendo el del resto:

- **Inter** — todo lo que se lee: textos, botones, títulos de pantalla,
  etiquetas. Es la más común de la web justamente porque no hace ruido, y se
  la elige por eso, no por defecto.
- **Outfit** — SOLO el número grande de la racha. Geométrica, ancha y
  monolineal. Es el único lugar donde la tipografía tiene que tener carácter.
- **Geist Mono** — SOLO datos tabulares: cifras de Stats, días del calendario,
  fechas del álbum, letras de la tira semanal, números de la lista. Donde
  alinear en columna sirve de verdad. Nunca en párrafos ni en títulos.

Se descartó Instrument Serif (probada y rechazada: el contraste de una serif no
funcionó) y Poppins (encaja en la descripción pero está tan usada que se lee
como decisión por defecto).

**Composición:** cada pantalla lleva al menos una decisión que no es la obvia.
Algo asimétrico, un elemento desproporcionado, un margen que rompe la grilla.
Un detalle raro a propósito vale más que diez prolijos.

En la principal esa decisión es: **el número de racha se sale del margen
izquierdo**, la palabra RACHA se para en vertical contra su costado leyéndose
de abajo hacia arriba, y la barra de progreso ocupa el 62% del ancho en vez de
llegar al borde. Nada cierra en la misma línea, y es a propósito.

**Textos:** ningún mensaje puede sonar a manual de producto. Se escriben como
los diría una persona.

### Movimiento

Nada aparece ni desaparece de golpe. Las transiciones usan curvas de
aceleración propias, nunca las lineales por defecto. Especial cuidado al abrir
y cerrar la hoja de registro, al cambiar de pestaña y al entrar a un perfil.

**Navegación por gesto:** se desliza de izquierda a derecha para cambiar de
pestaña, en el orden de la barra. El contenido sigue el dedo mientras se
arrastra —no salta al soltar—. La barra de abajo sigue funcionando igual.

**El nombre del rango no aparece en la interfaz.** Nunca. Solo en el momento de
subir de rango y en la pantalla de estadísticas si el usuario entra a buscarlo.
El rango se ve, no se lee.

**La galaxia es el ambiente permanente**, no el rango 8. La app entera vive dentro
del espacio desde el día uno. Lo que cambia con el progreso es el objeto en primer
plano y la densidad del fondo.

**El objeto de fondo se recorta, no se centra.** Entra por una esquina y se sale de
la pantalla. Centrado compite con el contenido y parece un fondo de pantalla.

**Velo plano oscuro entre el fondo y la interfaz, siempre.** Cuanto más detallado
el fondo, más velo. Es lo que permite subir la calidad del render sin arruinar
la lectura.

**El contenido va donde el fondo está vacío.** Cada composición reserva una zona
limpia arriba a la izquierda.

**Dos versiones de cada rango:** insignia chica de alto contraste para listas
(24px, silueta clara) y fondo grande recortado y apagado. Misma forma, tratamiento
opuesto. Los rangos 1, 2 y 3 se parecen demasiado en chico: exagerar la silueta
más de lo realista.

**Cada rango tiene su propia paleta, y cambia toda la app.** No es solo el fondo:
cambian los acentos, los bordes, el color del botón, la barra de progreso, los
íconos activos. Estar en luna y estar en galaxia tienen que sentirse como dos apps
distintas. Esta es la mecánica central del proyecto.

Se implementa con un único set de variables CSS que se reasigna según
`rango_actual`. Ningún color se escribe suelto en un componente: si hay que ajustar
un rango, se toca en un solo lugar y cambia toda la app.

Las paletas son espaciales, no de fuego. Cada una sale del objeto de su rango:
polvo y asteroide en grises minerales, luna en blancos fríos, planeta siguiendo el
color del planeta del día, sol en blancos incandescentes, sistema y galaxia en
azules y violetas, agujero negro en violeta profundo sobre negro.

Los ocho fondos también cambian de densidad: en rango 1 el espacio está casi vacío,
en rango 8 está cargado.

### Paletas por rango

Cada rango define tres colores: fondo/apagado, principal, y claro/acento.

| Rango | Apagado | Principal | Claro |
|---|---|---|---|
| 1 · Polvo | `#4A4945` | `#6E6C66` | `#9C9A92` |
| 2 · Asteroide | `#7A3A15` | `#B4581F` | `#E08A3C` |
| 3 · Luna | `#5B7BA8` | `#7E8CA8` | `#C4C2BA` |
| 4 · Planeta | según el planeta del día | | |
| 5 · Sol | `#EF9F27` | `#F2C230` | `#FFF1C2` |
| 6 · Sistema | `#0E6B6B` | `#1FA5A0` | `#6FD6D0` |
| 7 · Galaxia | `#4A2A8C` | `#7F4FD0` | `#C3A6F5` |
| 8 · Agujero negro | `#05050A` | `#FF6A00` | `#A78BFA` |

Notas que importan:

**Asteroide y agujero negro son los dos naranjas y NO se pueden confundir.** El
asteroide es naranja óxido, mate, desaturado, cubriendo toda la superficie. El
agujero negro es naranja puro y saturado al máximo, ocupando solo una línea fina
del disco de acreción sobre negro absoluto. La diferencia es de área y saturación,
no de tono.

**Luna:** la luna en sí es gris mineral; el celeste va alrededor, en el ambiente y
los acentos de la interfaz.

**Rango 4:** la paleta la define el planeta del día, así que cambia diez veces
dentro del mismo rango. Es el único rango sin paleta fija.

**Agujero negro:** es el rango final y tiene que ser el más impresionante.
Lleva tres cosas que ningún otro tiene: anillo de lente gravitacional arriba (la
luz de atrás doblándose), un toque violeta que lo encadena con la galaxia del
rango anterior, y un negro más profundo que el fondo de todos los demás rangos.

**Las tarjetas son casi invisibles.** Fondo apenas más claro que el negro, borde
de medio píxel frío, sin resplandores ni sombras suaves.

**Un solo botón sólido por pantalla.**

---

## 8. Motor de planetas

Nada de imágenes. Todos los objetos se generan por código: un solo motor con
distintos parámetros por planeta. Implementar en three.js con shaders, no en
canvas 2D.

Textura equirectangular generada con:
1. Ruido de valor, 5 octavas, con hash entero (no `Math.sin`, es lento).
2. Deformación de dominio: calcular dos campos de ruido y usarlos para desplazar
   las coordenadas de un tercero. Esto es lo que hace que el gas se enrosque en
   remolinos en vez de quedar en rayas.
3. Bandas: seno de la latitud modulado por el ruido deformado. La cantidad de
   bandas y su contraste son parámetros por planeta.
4. Tormenta: mancha elíptica en coordenadas de textura, para que rote con el
   planeta y desaparezca por el borde.
5. Continuidad en longitud: muestrear el ruido sobre coordenadas cilíndricas
   (`cos`/`sin` del ángulo) para que no haya costura.

Render:
- Muestreo bilineal de la textura.
- Iluminación difusa con una fuente fija arriba a la izquierda. El terminador sale
  del ángulo entre la normal y la luz, no es un degradado pegado.
- Luz de atmósfera en el canto, **solo del lado iluminado**. Rodear el planeta
  entero es físicamente imposible y se nota.
- Borde con cobertura parcial contra el fondo. Sin esto se ve pixelado.
- Segunda capa de neblina rotando a distinta velocidad que la superficie. La
  rotación diferencial entre capas es lo que evita que parezca una calcomanía
  girando.
- Grano animado sutil para romper el bandeado en los degradados oscuros.

Parámetros por planeta: paleta (4 paradas), cantidad de bandas, intensidad de
turbulencia, presencia y posición de tormenta, anillo (Saturno), lunas.

Rendimiento: límite de partículas, pausar cuando la app pierde el foco, respetar
`prefers-reduced-motion`, y versión estática de respaldo para equipos lentos.

### Polvo estelar (rango 1)

No son píxeles cuadrados flotando: es una nube de gas.

- Partículas redondas, de bordes suaves. Nunca cuadrados duros.
- Tamaños variados y brillo propio en cada una, con algunas destacando.
- Nada de gris plano: nebulosa de verdad, con azules, violetas y algún tono
  cálido mezclándose entre sí.
- Densidad desigual, con zonas cargadas y zonas casi vacías, para que el conjunto
  se lea como una nube y no como partículas sueltas.
