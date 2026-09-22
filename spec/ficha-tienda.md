# La ficha de la App Store

Los textos que se pegan en App Store Connect, con su límite de caracteres al
lado. Están acá y no en un documento suelto porque se van a reescribir: cada
vez que la app gane o pierda algo, esto miente un poco más.

**Idioma: español (Latinoamérica).** El mismo tú neutro que la app (§54): quien
baja la app desde la ficha no puede encontrarse con otra voz al abrirla.

---

## Nombre (máx. 30)

```
Ascent
```

Si está tomado en la App Store, la salida es un nombre con cola. En orden de
preferencia: `Ascent · Racha de gimnasio` (26), `Ascent Racha` (12).

## Subtítulo (máx. 30)

```
Tu racha en el gimnasio
```

Dice la mecánica, no la promesa. "Transforma tu cuerpo" lo dice cualquiera y no
dice nada.

## Palabras clave (máx. 100, separadas por coma y SIN espacios)

```
racha,gimnasio,pesas,rutina,entrenamiento,fuerza,series,progreso,habito,constancia,dots
```

Tres reglas que se ven acá: los espacios después de la coma **gastan
caracteres** y no ayudan; no se repite el nombre ni el subtítulo, porque Apple
ya los indexa; y no va el nombre de ninguna otra app, que es motivo de rechazo.
`habito` va sin tilde a propósito: la búsqueda de Apple no las distingue y la
versión sin tilde es la que la gente escribe.

## Texto promocional (máx. 170, se puede cambiar sin subir versión)

```
Registra el día con un toque. Si marcas tu gimnasio, entra solo al llegar. Y si
faltas, la racha no vuelve a cero: se descuenta.
```

## Descripción (máx. 4000)

```
Ascent lleva la cuenta de los días que entrenas. Un toque por día, y la racha
sigue.

LA RACHA NO VUELVE A CERO
Faltar un día no borra tres meses. La racha baja un tramo y sigue, porque un
número que se destruye entero te invita a abandonar el jueves y no volver el
viernes.

LOS DÍAS DE DESCANSO SON TUYOS
Eliges qué días de la semana descansas y esos días no cortan nada. Cambiar de
rutina no toca el pasado: los días que ya ganaste quedan ganados.

EL DÍA ENTRA SOLO
Marca tu gimnasio una vez, parado en la puerta. Después, abrir la app estando
ahí registra el día sin que aprietes nada.

CONTAR LAS SERIES MIENTRAS ENTRENAS
Arranca el entrenamiento y anota cada serie con un botón grande, del tamaño que
se toca con una mano y el teléfono apoyado. El peso, si quieres. El descanso
entre series avisa aunque guardes el teléfono en el bolsillo.

TU FUERZA, EN UN NÚMERO
Anota tus marcas de sentadilla, press de banca y peso muerto y la app calcula
tu DOTS, que compara fuerza entre personas de distinto peso corporal. Es
opcional: sin cargarlo, todo lo demás funciona igual.

AMIGOS, SIN RUIDO
Un ranking con la gente que agregas, y nada más. No hay comentarios, no hay
likes, no hay desconocidos.

UNA FOTO POR DÍA, SI QUIERES
Las fotos nacen privadas. Eliges una por una cuáles ven tus amigos.

LO QUE NO HAY
No hay publicidad. No hay rastreo. No se vende ni se comparte nada. Tu peso
corporal no lo ve nadie más que tú, y la ubicación de tu gimnasio tampoco: es
un punto que elegiste, no un historial de dónde anduviste.
```

## Qué probar (TestFlight, máx. 4000)

```
Esta es la primera build que abre en un iPhone, así que lo que más sirve es que
la uses un día entero de gimnasio y cuentes qué se sintió raro.

LO PRINCIPAL
1. Registrar el día, con la app recién abierta.
2. Empezar un entrenamiento, contar series con el +, elegir ejercicio y peso, y
   terminarlo. Guarda el teléfono entre series: el aviso del descanso tiene que
   llegar con la pantalla bloqueada.
3. Marcar el punto del gimnasio (Ajustes, arriba de todo), parado ahí. Después
   cerrar la app, volver a abrirla en el gimnasio y ver si el día entra solo.
4. Deslizar entre pestañas con el dedo.
5. Sumar una foto al día y mirarla en el Álbum.
6. Anotar el peso corporal desde Inicio.

LO QUE YA SABEMOS QUE FALTA, no hace falta reportarlo
- Con la app CERRADA el día todavía no entra solo: falta un permiso del sistema
  que llega en la próxima.
- No se puede entrar al perfil propio ni al de un amigo desde Ranking.
- Ajustes todavía no tiene exportar datos ni la guía.

SI ALGO SE VE MAL
Ajustes → Sugerencias, que llega directo. Y si una pantalla queda en blanco o
un número dice una cosa distinta de otra, abre el botón Diagnóstico (abajo a la
derecha) y manda esa foto: ahí está qué dice la pantalla, qué guardó el
teléfono y qué tiene el servidor.
```

## Lo demás de la ficha

- **URL de privacidad:** `https://ascent-blush-seven.vercel.app/privacidad`
- **URL de soporte:** falta. Apple la pide y no puede ser la misma que la de
  privacidad; alcanza con una página con el correo de contacto.
- **Categoría:** Health & Fitness, sin secundaria.
- **Clasificación por edad:** todo "None" → 4+.
- **Capturas:** `capturas/tienda/`, 1290 × 2796, salen de
  `herramientas/capturas-tienda.mjs`.
