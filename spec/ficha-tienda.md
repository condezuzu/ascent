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
likes, no hay desconocidos. Cuando un amigo está entrenando, lo ves en vivo
—solo eso, nunca dónde—. Y por cada marca de fuerza ganas una medalla que
aparece al lado de tu nombre.

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
   cerrar la app y volver a abrirla EN el gimnasio: el día tiene que entrar solo,
   con la app cerrada, sin tocar nada.
4. Deslizar entre pestañas con el dedo.
5. Sumar una foto al día y mirarla en el Álbum.
6. Entrar al perfil de un amigo desde el Ranking y ver sus medallas.
7. Anotar el peso corporal desde Inicio.
8. En el perfil de alguien (o manteniendo apretada su fila en el Ranking),
   probar "Denunciar o bloquear". Al bloquear, esa persona desaparece del
   ranking y del buscador y no te puede volver a agregar; se gestiona en
   Ajustes → "Cuentas bloqueadas".

SI ALGO SE VE MAL
Ajustes → Sugerencias, que llega directo. Y si una pantalla queda en blanco o
un número dice una cosa distinta de otra, abre el botón Diagnóstico (abajo a la
derecha) y manda esa foto: ahí está qué dice la pantalla, qué guardó el
teléfono y qué tiene el servidor.
```

## Notas para App Review (App Store Connect → "Notes") — 1.1.0

**EN INGLÉS, y no es un descuido.** Es lo único de toda la ficha que no lee un
usuario: lo lee un revisor de Apple, que puede estar en cualquier lado. La app
sigue siendo en español y la ficha también.

**LA CUENTA DEMO NO ES OPCIONAL.** La app no muestra NADA sin sesión: la
primera pantalla es el login. Una app así se rechaza sin credenciales, y no por
criterio del revisor sino por la guía 2.1 —"we were unable to review your app
because we could not sign in"—, que es el rechazo más común que existe.

**Y NO ALCANZA CON QUE EXISTA: TIENE QUE TENER ADENTRO.** Una cuenta recién
creada muestra la app vacía —racha en cero, calendario en blanco, Stats sin una
barra, álbum sin una foto— y una app de rachas vista vacía no se entiende. La
carga la hace `supabase/cuenta-de-revision.mjs`, por la anon key y con RLS
puesta, o sea por el mismo camino que cualquier usuario. Para rehacerla:

```
node --env-file=.env.local supabase/cuenta-de-revision.mjs --de-cero
```

> **CUÁNDO SE RE-SIEMBRA — PASO OBLIGATORIO, JUSTO ANTES DE MANDAR A REVISIÓN,
> NO ANTES (26/9).** La cuenta demo se re-siembra en el último momento, no días
> antes: la racha se calcula por días transcurridos, así que una cuenta sembrada
> el lunes y enviada el viernes le muestra al revisor una racha con cuatro
> huecos y menos días de los que dice esta ficha. El orden correcto es: build →
> subir → **re-sembrar demo** → recién ahí "Submit for Review". Si el envío se
> demora un día, se vuelve a correr `--de-cero` antes de reintentar.

El correo lleva etiqueta (`+ascent-review`) para poder darla de baja el día que
la app esté publicada sin tocar la casilla de nadie.

> **Las credenciales NO van acá.** Este archivo está en un repo público, así
> que el usuario y la contraseña de la cuenta demo van SOLO en el campo "Demo
> Account" de App Store Connect. Viven en `.env.local` (`DEMO_EMAIL` /
> `DEMO_PASSWORD`), que no se commitea. La contraseña que estuvo acá antes se
> rotó el 26/9 y ya no sirve.

**LA 1.1.0 (16/10).** Esta es la que se pega. 3510 caracteres de 4000. Cambió
el idioma (español e inglés), y suma lo nuevo que el revisor puede tocar: entrenar con
amigos en vivo, la Live Activity entera, los links que abren la app y la cámara y el
micrófono en los permisos. Las credenciales van en "Sign-In Information", no acá.

```
DEMO ACCOUNT (required: the app is sign-in only)
Use the account in the Sign-In Information fields. It already has content on every screen: an active streak with about six weeks of history, a ranking with friends, workouts with sets and weights, personal records feeding a DOTS score, a body-weight entry and photos in the album.

WHAT THE APP DOES
Ascent counts the days you train. One tap per day keeps a streak alive. During a workout it counts sets and weights, times the rest between sets, and shows progress over time.

NEW IN 1.1.0
- Training with friends, live: during a workout you see what your accepted friends are doing (exercise, set, rest time left), in groups of up to 10. This needs a second account training at the same time.
- Live Activity: after starting a workout and picking an exercise, the Lock Screen shows the current set and the session clock, then the rest countdown, today's steps and a training partner's rest.
- Invite links (https://ascent-blush-seven.vercel.app/amigo/... and /grupo/...) open the app through Associated Domains.
- The app is now available in English.

HOW TO SEE THE MAIN LOOP IN TWO MINUTES
1. Sign in. The number on Home is the streak.
2. Tap "Iniciar entrenamiento" (top right) to start a workout.
3. Pick an exercise and tap the big + to count a set. A rest timer starts and the Live Activity appears on the Lock Screen.
4. "Terminar" ends the workout and logs the day.

ABOUT THE PERMISSIONS (all optional; the app works without them)
- Location ("Always"): only used to log the day when you arrive at the gym you marked yourself, in Settings. The gym point is stored in the user's own row; no location history is kept or sent anywhere.
- Notifications: only the end-of-rest alert, scheduled locally. No marketing, no remote push.
- Health (steps and workouts, READ-ONLY): steps are shown on Home and in Stats, and a workout recorded by the phone can log the day. The app never writes to Health and only requests read access; the NSHealthUpdateUsageDescription string is present because the HealthKit library links its write APIs.
- Camera and Photos: only to add a progress photo to a day. Photos are private by default; the user chooses which ones friends can see.
- Microphone: the app has no recording feature and never requests microphone access. The string is present because the audio library that plays the end-of-rest sound links recording APIs.

USER-GENERATED CONTENT: REPORT AND BLOCK (Guideline 1.2)
Usernames, avatars and (only between accepted friends) photos and live workout status are visible to other users, so the app has both required controls:
- Report: on any user's profile, and by long-pressing a row in the Ranking, "Denunciar", picking a reason from a fixed list. Reports are stored server-side and reviewed.
- Block: on any user's profile, "Bloquear". Blocking removes the friendship, hides the two users from each other in search, in the ranking and in live training groups, and prevents any new friend request in either direction. This is enforced by row-level security in the database, not just hidden in the UI. Blocked accounts are listed and can be unblocked in Ajustes (Settings), "Cuentas bloqueadas".
There is no public content, no comments and no likes: anything from another person is only visible inside a mutually accepted friend relationship.

LANGUAGE
The interface is available in Spanish (Latin America) and English. It follows the device language and can be changed in Ajustes (Settings), "Idioma" (Language).
```

---

## La 1.1.0 (16/10/2026)

**Capturas:** `capturas-tienda/1.1.0/`, 1320 × 2868 (6,9"), de
`supabase/capturas-tienda-11.mjs`. CUATRO, en este orden: racha → entrenando con el
grupo (Inicio) → tarjeta de la pantalla bloqueada → Social. La tarjeta del script es
una RECREACIÓN (la dibuja iOS): va la captura del iPhone. **El álbum no va** (decisión
del 16/10): fotos de progreso de verdad quedan públicas para siempre, y de banco de
imágenes no van en una pantalla que dice "tu progreso".

### Qué hay de nuevo (español)

```
Entrena con tus amigos en vivo: ves su ejercicio, su serie y cuánto le queda de descanso. En grupos de hasta 10, y se suman con un link.

La tarjeta de la pantalla bloqueada te acompaña todo el entrenamiento: la serie, el descanso, tus pasos y el descanso de tu compañero.

Las fotos cargan más rápido, y el álbum te muestra la primera y la última de cada mes.
```

### Palabras clave (español): 96 de 100

```
gym,rutina,entrenamiento,ejercicios,pesas,musculacion,fuerza,series,pesos,progreso,amigos,cardio
```

Fuera: `racha` y `gimnasio` (están en el subtítulo), `rango` (decidido; además el
rango no se nombra), `constancia` y `habitos` (las que menos traen gente que busca
gimnasio; no entraban con las nuevas). `fuerzas` pasó a `fuerza`. `acento` salió (era
un error de dictado) y entró `cardio`: la app cuenta la cinta y el tiempo. `streak` y
`strength` no van en ninguna lista: están en el nombre, que es el mismo en los dos
idiomas.

### La ficha en inglés (English U.S.)

Nombre `Ascent — Streak & Strength` (26) · subtítulo `Gym habit tracker with friends`
(30) · palabras clave (97):

```
workout,weightlifting,sets,reps,routine,training,progress,fitness,bodybuilding,powerlifting,timer
```

What's New:

```
Train with your friends, live: see their exercise, their set and how much rest they have left. Groups of up to 10 — send a link and they're in.

The Lock Screen card now stays with you for the whole workout: your set, your rest, your steps and your partner's rest.

Photos load faster, and your album shows the first and last photo of every month.

Ascent now speaks English.
```

Description:

```
Ascent counts the days you train. One tap a day keeps your streak alive — and now your friends can train right alongside you.

TRAIN TOGETHER, LIVE
Start a workout and see what your friends are doing in real time: their exercise, their set, and how much rest they have left. Train in groups of up to 10. Send a link and they join your group.

YOUR WORKOUT ON THE LOCK SCREEN
Pick an exercise and your Lock Screen shows the set you're on and the session clock. Between sets it counts down your rest, with your steps and your partner's rest underneath. No unlocking, no opening the app.

A STREAK THAT DOESN'T RESET TO ZERO
Missing a day doesn't erase three months. Your streak drops back a little and keeps going, because a number that can be wiped out completely is the kind that makes you quit on Thursday and not come back on Friday.

REST DAYS ARE YOURS
Choose the days of the week you rest, and those days never break anything. Changing your routine never rewrites the past: the days you've earned stay earned.

THE DAY LOGS ITSELF
Mark your gym once, standing at the door. After that, getting there logs the day for you.

COUNT YOUR SETS AS YOU GO
Tap one big button after each set, easy to hit one-handed with your phone on the bench. Add the weight if you want, and next time it's already filled in. The rest timer alerts you even with your phone in your pocket.

YOUR STRENGTH, IN ONE NUMBER
Log your squat, bench press and deadlift, and Ascent works out your DOTS score, which compares strength across different body weights. It's optional: everything else works without it.

FRIENDS, WITHOUT THE NOISE
A ranking with the people you add, and nothing else. No comments, no likes, no strangers. Every strength record earns a medal that shows up next to your name.

YOUR PROGRESS IN PHOTOS
Add a photo to the day and watch your album fill up, month by month. Photos are private by default: you choose, one by one, which ones your friends can see.

WHAT YOU WON'T FIND
No ads. No tracking. Nothing is sold or shared. Your body weight is visible only to you, and so is your gym's location: it's a point you picked, not a history of where you've been.
```

## Lo demás de la ficha

- **URL de privacidad:** `https://ascent-blush-seven.vercel.app/privacidad`
- **URL de soporte:** `https://ascent-blush-seven.vercel.app/soporte`
- **Categoría:** Health & Fitness, sin secundaria.
- **Clasificación por edad:** todo "None" → 4+.
- **Capturas:** `capturas-tienda/`, 1290 × 2796, salen de
  `herramientas/capturas-tienda.mjs` corrido sobre la cuenta demo ya sembrada
  (sin `--con-datos`).

  > **SET LISTO — CINCO capturas (27/9).** Motor de ocho rangos aprobado y cuenta
  > demo sembrada rica (racha 45, rango 5, 6 amigos, DOTS). Curadas y con
  > veredicto en `Escritorio\ascent-tienda\` (orden de subida: racha → ranking →
  > contar series → fuerza/DOTS → el año). **La del álbum se sacó**: las fotos del
  > demo son degradados abstractos y no hay forma limpia de que se vean como fotos
  > de gimnasio sin inventar imágenes; cinco buenas antes que seis con una floja.
  > Las cuatro viejas que están en App Store Connect son del fondo viejo: se
  > reemplazan por este set junto con el envío a revisión.
