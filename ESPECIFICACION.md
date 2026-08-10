# Ascent — Especificación del proyecto

Documento de decisiones. Guardar en la raíz del repo y leerlo al inicio de cada sesión.
Lo que está acá ya está decidido y no se rediscute salvo que se indique lo contrario.
Lo marcado como PENDIENTE todavía no se decidió: preguntar antes de asumir.

---

## 1. Qué es

App de seguimiento de racha de gimnasio con features sociales.
Reconstrucción desde cero de un proyecto anterior ("La Forja"), con una estética
completamente distinta. El proyecto anterior no se toca: repo nuevo, base nueva.

---

## 2. Stack

- Next.js (App Router) + TypeScript
- Vercel para deploy, conectado desde el día uno
- Supabase: base de datos, auth y storage de fotos
- PWA instalable (manifest + service worker). No va a las tiendas.
- three.js para el render de los objetos de rango

---

## 3. Modelo de datos

### profiles
`id` (uuid, referencia a auth.users), `username`, `avatar_url`,
`racha_actual`, `mejor_racha`, `rango_actual`

La racha va guardada como columna, no calculada al vuelo. Se actualiza con un
trigger al registrar un día. Es duplicación deliberada: sin eso, la tabla de
posiciones tendría que recorrer los logs de todos los amigos en cada carga.

`mejor_racha` **sale del historial, no es un contador que solo sube**. Si se
borran días registrados por error, tiene que bajar: un récord inflado que no hay
manera de corregir es un dato falso para siempre.

### logs
`id`, `user_id`, `fecha`, `es_descanso`, `planeta_del_dia`
Restricción de unicidad en (`user_id`, `fecha`).

### photos
`id`, `user_id`, `log_id`, `storage_path`, `visibilidad`, `es_subida_de_rango`

`visibilidad` va por foto, no por perfil. Permite álbum privado con algunas
fotos visibles para amigos. A nivel perfil sería todo o nada.

### descansos
`id`, `user_id`, `desde`, `dias`

Configuraciones de descanso fechadas. Cada fila rige desde su fecha hasta que
aparece la siguiente. El cálculo de un día busca la vigente **ese** día, así el
pasado nunca se reescribe. `profiles.dias_descanso` queda solo como espejo de la
configuración actual, para que la interfaz no tenga que buscarla; se escribe
únicamente desde el servidor.

### weights
`id`, `user_id`, `fecha`, `valor`

Tabla propia, NO una columna en `logs`. Los días de descanso no generan fila en
`logs`, y el peso se tiene que poder anotar igual esos días.
El peso no se comparte nunca: ni en perfil, ni en tabla de posiciones, ni con amigos.

### friendships
`id`, `solicitante`, `destinatario`, `estado` (pendiente / aceptada)
Relación bidireccional con una sola fila. Las consultas tienen que contemplar
ambos sentidos.

### challenges
`id`, `retador`, `rival`, `desde`, `hasta`, `estado`, `ganador`

### feedback
`id`, `user_id`, `texto`, `tipo` (bug / idea), `fecha`, `version_app`,
`plataforma`, `pantalla_origen`
Cualquiera logueado puede insertar. Solo el dueño de la app puede leer.

### Sin tabla de feed
El feed se deriva: logs de la gente con amistad aceptada, ordenados por fecha.

---

## 4. Seguridad

RLS activo en todas las tablas desde el principio, no después.

- Datos propios: solo el dueño.
- Logs y fotos: el dueño y los amigos con amistad aceptada, respetando `visibilidad`.
- Pesos: solo el dueño, sin excepción.
- Búsqueda de usuarios: vista pública que expone únicamente `username`, `avatar_url`,
  `racha_actual` y `rango_actual`. La tabla `profiles` completa nunca se abre.

Antes de invitar a nadie: crear dos cuentas sin amistad entre ellas e intentar
leer los datos de una desde la otra. Si funciona, no se invita a nadie.

---

## 5. Auth

Supabase Auth no maneja login por nombre de usuario. La identidad es email u
OAuth. El username vive en `profiles`.

- Login con Google + email/contraseña.
- El username se elige en el onboarding, después del primer login.
- Trigger sobre `auth.users` que crea la fila en `profiles` al registrarse.
- Username único e insensible a mayúsculas.

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

**Tipografía:** es lo que más pesa. Dos familias con carácter, elegidas a
propósito: una para los números grandes y otra para el texto. Nunca la fuente
del sistema. PENDIENTE: elegir cuáles.

**Composición:** cada pantalla lleva al menos una decisión que no es la obvia.
Algo asimétrico, un elemento desproporcionado, un margen que rompe la grilla.
Un detalle raro a propósito vale más que diez prolijos.

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

---

## 9. Pantallas

### Principal

De arriba abajo: nombre y avatar; la palabra RACHA en chico; el número de racha
gigante (es lo único grande de la pantalla); barra de progreso al siguiente rango
**sin etiqueta de texto**; aviso de tiempo restante; botón "Registrar día"; tira
de los últimos siete días; una sola línea de actividad de un amigo; navegación.

Detrás de todo, el objeto del rango recortado abajo a la derecha, con velo.

Tira semanal, tres estados:
- **Lleno**: día registrado.
- **Borde fino vacío**: día no registrado. Sin cruz, sin rojo, sin mensaje de falla.
- **Guioncito apagado**: día de descanso. No puede parecer un fallo.

El aviso de tiempo restante solo aparece cuando falta poco de verdad, no a la
mañana. Redacción hacia adelante, no hacia la pérdida: "Último tramo para el 48"
antes que "para no cortarla".

Una sola entrada social. Con tres se convierte en red social.

**Las frases son citas reales de deportistas**, sobre constancia, disciplina y no
rendirse — no solo de gimnasio. Solo citas verificables y bien atribuidas: no se
inventa ninguna ni se le adjudica a quien no la dijo. Ante la duda, no se usa.

**Nombres de las pestañas**: Inicio, Leaderboard, Álbum, Stats, Ajustes.

### Registrar día (hoja inferior)

Título con el número del día y la fecha. Foto opcional. Peso opcional, con la
aclaración explícita de que solo lo ve el usuario. Botón confirmar.

### Subida de rango

Se dispara al confirmar el día que cruza el umbral, y **solo después de que la
escritura en base de datos confirmó**. Si se anima antes y el guardado falla, se
festejó un rango que no existe.

Las partículas del objeto anterior se dispersan y se reorganizan en el objeto
nuevo. Son las mismas partículas: los días registrados son el material del rango
nuevo. El nombre del rango aparece **último**, cuando el objeto ya está formado.

Sin confeti, sin sonido, sin cartel de felicitaciones. El silencio es lo que lo
hace sentir importante. Se puede saltar tocando la pantalla.

### Tabla de posiciones

Vista por defecto: campo estelar. Cada amigo es su objeto de rango flotando en el
espacio; tamaño y brillo comunican la racha. Se entiende quién va ganando sin leer.
Botón para pasar a lista ordenada con números, para quien quiera saber la posición
exacta.

### Estadísticas

Acá va todo lo analítico que se sacó de la principal: constancia, desglose mensual,
mapa de calor del año, mejor racha, y el peso.

El peso se muestra como tendencia suavizada (media de siete días), no como dato
crudo diario. El peso oscila un kilo por razones ajenas al entrenamiento y la línea
cruda solo genera ruido.

Es el único lugar donde se muestran los ocho rangos con nombre: cuáles ya se
pasaron y cuál viene.

### Mi perfil

Pantalla propia donde se centraliza todo lo que es "mío". Hoy se puede entrar al
perfil de un amigo pero no al propio, y eso deja al usuario sin saber qué está
mostrando.

- Cambiar la foto de perfil.
- Elegir qué fotos del álbum ven los amigos, desde acá y no solo una por una.
- **Ver como lo ven los demás**: muestra exactamente lo que ve un amigo al
  entrar. Sin esto nadie sabe qué está compartiendo.
- Administrar amigos: lista completa con opción de eliminar, sin tener que
  entrar al perfil de cada uno.

**Foto de perfil:** al subirla se abre un recorte circular —se ve el círculo, se
arrastra y se hace zoom para encuadrar—. El recorte se hace en el teléfono antes
de subir, para no mandar archivos enormes al storage.

### Álbum

Las fotos quedan asociadas al planeta del día. El historial no son filas iguales,
son planetas distintos con su fecha y su foto.

### Leaderboard

Además del campo estelar y la lista: cuando el buscador está vacío se muestran
tres personas sugeridas, para que no quede una pantalla muerta. Primero amigos de
mis amigos, después usuarios activos. Nunca alguien que ya es amigo, ni con quien
haya una solicitud pendiente en cualquier dirección.

### Ajustes

Días de descanso: se eligen días fijos de la semana. Si en algún momento se permite
marcar descanso sobre la marcha, tiene que decidirse **antes** del día, nunca
después, o se puede salvar una racha ya perdida.

**Los descansos NUNCA se aplican para atrás.** Cambiar qué días son de descanso
vale solo desde el día del cambio hacia adelante. El pasado queda congelado con
la configuración que estaba vigente en ese momento: alguien que cambia de rutina
en marzo no puede perder lo que hizo en enero.

Se implementa con **configuraciones fechadas**: cada cambio guarda desde cuándo
rige, y el cálculo de cada día usa la que estaba vigente ese día. Nunca una sola
columna que se pisa. La interfaz también muestra los descansos de cada día con
la configuración de entonces, no con la actual.

Corregir días: **calendario mensual visual**. Se ve el mes con el estado de cada
día (hecho, vacío, descanso) y se toca un día para agregarlo o sacarlo. Nunca se
escriben fechas a mano. Es distinto del mapa de calor de Estadísticas, que solo
se mira.

Sugerencias: un campo de texto libre y nada más. Sin categorías obligatorias ni
prioridad. Confirmación visible de que llegó, escrita como la diría una persona:
"Gracias por tu opinión, la leo yo mismo". Cada mensaje nuevo llega por correo al
dueño de la app.

También en Ajustes:

- Cambiar el nombre de usuario, respetando la unicidad.
- Visibilidad por defecto de las fotos nuevas, para no elegir una por una.
- Unidades de peso: kilos o libras.
- Exportar mis datos en un archivo, con todo el historial.
- **Eliminar la cuenta**, con confirmación fuerte, borrando todo: logs, fotos del
  storage, pesos y amistades. En una app publicada con usuarios reales esto no
  puede faltar.
- Recordatorio diario a una hora elegida. PENDIENTE de decidir: una PWA no puede
  programar avisos por su cuenta, hace falta que el servidor los mande.

---

## 10. Estados vacíos

El día uno un usuario no tiene amigos, ni racha, ni fotos. Ninguna pantalla puede
decir "no hay datos todavía". El estado vacío es una imagen: el espacio antes de
que se forme nada, con cuatro partículas perdidas. Se diseña con el mismo cuidado
que el estado lleno, porque es la primera impresión.

---

## 11. Pérdida de racha

El sistema no explota: se dispersa. Se pierde masa, el fondo se apaga, se baja un
rango. Perder progreso por un error de la app es lo único que no se perdona.

**Perder la racha resta 10 días. No devuelve al inicio del rango anterior.**

```
racha 14 → 4    (baja a polvo, pero conserva 4 días)
racha 47 → 37   (baja de planeta a luna)
racha 6  → 0    (correcto: no completó ningún rango)
```

Como un rango son exactamente diez días, restar 10 es bajar un rango justo: la
misma fórmula sirve para los ocho, sin números mágicos ni casos especiales.
Llegar a cero solo pasa si todavía no se completó ningún rango, y ahí es lo
correcto: no hay progreso que conservar.

Los días que sobreviven quedan guardados y esperan. Volver después de una semana
o después de tres meses da lo mismo: se retoma desde los días conservados. Una
ausencia larga no castiga más que una corta — el resto es una sola vez por corte.

Corolario: tiene que existir una forma de corregir días a mano desde el principio.

---

## 12. Registro automático por ubicación (etapa nativa)

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

## 13. Orden de construcción

1. Racha propia contra base de datos, con fondos estáticos. Sin nada social.
2. Amigos y tabla de posiciones. Es la más barata: `racha_actual` ya está en `profiles`.
3. Feed. Casi gratis, sale de los mismos datos.
4. Perfil y fotos con visibilidad. Acá aparece el storage.
5. Motor de planetas en three.js, reemplazando los fondos estáticos.
6. Retos. La más cara y la que menos sirve sin usuarios activos.

Los retos quedan fuera de la primera beta. Beta significa poco alcance bien hecho,
no todo a medias.

Nunca empezar por el motor de partículas: se van tres semanas peleando con el
rendimiento sin tener ni el login.

---

## 14. Beta

Al ser PWA no hay tiendas, ni revisión, ni límite de testers: un link y listo.

Arrancar con cinco o seis personas. Antes de invitar: RLS verificada, backups
automáticos confirmados, y la corrección manual de días funcionando.

Para medir, mirar los datos de uso, no preguntar "¿qué te parece?". El buzón de
sugerencias sirve para encontrar bugs, no para decidir qué construir.

---

*Nota de implementación (no es parte de la spec): los retos ya tienen UI
construida por pedido explícito del humano — si la beta arranca sin ellos, se
ocultan, no se borran. El §12 está documentado pero NO implementado.*
