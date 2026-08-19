# Pantallas

Qué va en cada pantalla, el onboarding y los estados vacíos.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.
Lo que está acá ya está decidido y no se rediscute salvo que se indique.

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

**Nombres de las pestañas**: Inicio, Ranking, Álbum, Stats, Sesión, Ajustes.

Eran cinco y "Leaderboard". Cambió por dos razones que apuntan al mismo lado:
**"Ranking" es más corto y está en español**, como el resto de la app; y con
seis pestañas era la única etiqueta que no entraba a 375 px —61 px de texto
para los 60 que quedan por ítem—. Medido, no estimado.

**Sesión** es la sexta, entre Stats y Ajustes: el cronómetro tiene pantalla
propia porque un cronómetro que hay que buscar no lo usa nadie en el gimnasio
(§17.6).

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

## 10. Onboarding

Un usuario nuevo entra y no entiende nada: como **el nombre del rango no
aparece en la interfaz** (§7), no sabe qué es el objeto de fondo ni qué pasa
si registra días. La regla que evita ese vacío es explicar el mecanismo sin
adelantar el premio.

### La regla dura: la explicación es genérica

**No se nombra ningún rango, ni cuántos hay, ni ninguno en particular, ni
dónde termina la escalera.** Descubrir en qué te vas a convertir es la
recompensa; contarlo la arruina. Por eso la pantalla que habla del fondo
**muestra** que cambia en vez de decir en qué se convierte, y recorre solo el
principio de la escalera.

### El recorrido: tres pantallas

Van **después de elegir el nombre de usuario y antes de la primera pantalla**.
Son cortas, saltables, con el botón **"Saltar" siempre visible**.

1. **Registrás un día cada vez que vas al gimnasio.** Eso arma tu racha.
2. **Lo que ves de fondo cambia a medida que la racha crece.** Nada más: que
   va a evolucionar, sin decir en qué.
3. **Los descansos se configuran una vez, por día de la semana.** No cortan la
   racha. Y si te cortás, no volvés a cero.

Reglas de forma: **una idea por pantalla**, **dos líneas de texto como
máximo**, y **el objeto real en movimiento**, nunca un dibujito que lo
represente. La cuenta de pasos no son puntitos centrados: es una regla fina
contra el borde izquierdo, en la línea de las decisiones de composición de §7.

### Avisos contextuales de primera vez

En **Leaderboard**, **Stats** y **Álbum**, un globo de texto con **una sola
línea** explicando para qué sirve esa pantalla. Se cierra y **no vuelve más**.

### Volver a verlo

Desde Ajustes se puede repetir el recorrido. Reinicia **el recorrido y los
tres globos**: quien quiere repasar de qué va cada pestaña no lo conseguiría
si solo volviera el recorrido.

Qué se vio vive en el teléfono (`localStorage`), no en la base: es preferencia
de este aparato y no vale una consulta de red antes de poder pintar. Va atado
al id de usuario, por lo mismo que la caché del perfil: en un teléfono
prestado, el que entra después tiene que ver la guía igual.

---

## 11. Estados vacíos

El día uno un usuario no tiene amigos, ni racha, ni fotos. Ninguna pantalla puede
decir "no hay datos todavía". El estado vacío es una imagen: el espacio antes de
que se forme nada, con cuatro partículas perdidas. Se diseña con el mismo cuidado
que el estado lleno, porque es la primera impresión.
