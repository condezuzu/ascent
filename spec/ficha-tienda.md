# La ficha de la App Store

Los textos que se pegan en App Store Connect, con su límite de caracteres al
lado. Están acá y no en un documento suelto porque se van a reescribir: cada
vez que la app gane o pierda algo, esto miente un poco más.

**Idioma: español (Latinoamérica).** El mismo tú neutro que la app (§54): quien
baja la app desde la ficha no puede encontrarse con otra voz al abrirla.

---

## En App Store Connect (22/9/2026)

La app ya existe y está en TestFlight. Los números que hacen falta para
cualquier comando y para no crear una segunda por error:

| | |
|---|---|
| **Nombre en la tienda** | Ascent — Streak & Strength |
| **ASC App ID** | 6815006917 |
| **Bundle** | `uy.ascent.app` |
| **Free Apps Agreement** | activo |
| **Clave de API** | creada, rol APP_MANAGER: las subidas ya no necesitan el Apple ID a mano |

---

## Nombre (máx. 30) — YA CARGADO

```
Ascent — Streak & Strength
```

28 de 30. Quedó en inglés y el resto de la ficha en español, y eso NO es un
descuido que haya que arreglar: el nombre es lo único que se lee en una lista
de resultados de cualquier país, y "streak" y "strength" dicen la mecánica sin
traducción. El idioma principal sigue siendo español (Latinoamérica), que es
donde están los usuarios.

Consecuencia práctica: Apple **ya indexa** las palabras del nombre, así que
`streak` y `strength` NO van en las palabras clave. Sería gastar dos de las
cien.

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

## Notas para App Review (App Store Connect → "Notes")

**EN INGLÉS, y no es un descuido.** Es lo único de toda la ficha que no lee un
usuario: lo lee un revisor de Apple, que puede estar en cualquier lado. La app
sigue siendo en español y la ficha también.

**LA CUENTA DEMO NO ES OPCIONAL.** La app no muestra NADA sin sesión: la
primera pantalla es el login. Una app así se rechaza sin credenciales, y no por
criterio del revisor sino por la guía 2.1 —"we were unable to review your app
because we could not sign in"—, que es el rechazo más común que existe.

```
DEMO ACCOUNT (required — the app is sign-in only)
  Email:    [PENDIENTE: correo de la cuenta de prueba]
  Password: [PENDIENTE]
The account already has streak history, workouts, body-weight entries and
photos, so every screen has real content.

WHAT THE APP DOES
Ascent counts the days you train. One tap per day keeps a streak alive. It also
times your rest between sets, records sets and weights, and shows progress.

ABOUT THE PERMISSIONS — all three are optional and the app works without them.
- Location ("Always"): only used to auto-log the day when you arrive at the gym
  you marked yourself, in Settings. Nothing is sent anywhere; the gym point is
  stored in the user's own row. Tapping the button in Settings while standing
  at the gym is how it is set.
- Notifications: only the end-of-rest alert, scheduled locally. No marketing,
  no remote push.
- Health (steps and workouts, read-only): steps are displayed in Stats, and a
  workout recorded by the phone can log the day. The app never writes to Health.

HOW TO SEE THE MAIN LOOP IN TWO MINUTES
1. Sign in. The number on Home is the streak.
2. "Iniciar entrenamiento" (top right) starts a workout.
3. Pick an exercise, tap the big + to count a set. A rest timer starts and also
   appears on the Lock Screen as a Live Activity.
4. "Terminar" ends the workout and logs the day.

The interface is in Spanish (Latin America); that is the app's only language in
this version.
```

## Lo demás de la ficha

- **URL de privacidad:** `https://ascent-blush-seven.vercel.app/privacidad`
- **URL de soporte:** `https://ascent-blush-seven.vercel.app/soporte`
- **Categoría:** Health & Fitness, sin secundaria.
- **Clasificación por edad:** todo "None" → 4+.
- **Capturas:** `capturas-tienda/`, 1290 × 2796, salen de
  `herramientas/capturas-tienda.mjs`.
