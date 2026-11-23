# La sección de la otra app, igual en las dos (borrador, 19/11/2026)

Lo pediste el 19/11/2026, por voz en el chat de Ascent. En Moss es la sección de Ascent, arriba de
Progreso; en Ascent, la sección de Moss. **Este documento es el mismo en los dos repos**: lo escribe Moss,
lo revisa Ascent y cada uno guarda una copia idéntica (en Moss, `spec/musculos-compartido.md`).

**Estado:** la estructura, revisada por Ascent el 19/11. Las cuentas (sección 4) salen de dos investigaciones:
- la de Ascent: volumen, intensidad, RIR, la franja del puntaje, las partes de cada músculo y la variación,
  en el documento del dueño «Ascent y Moss: la evidencia de los músculos»
  (https://claude.ai/artifact/1LfLsL68v839A6FfZY7kL2);
- la de Moss: recuperación, sueño y comida, en `spec/estudio/musculos-recuperacion.md` (pendiente).

**Quién hace qué:** Moss escribe la sección 4, `puntajeMuscular.ts` y los casos en JSON; Ascent arma el
catálogo compartido (`nucleo/catalogoMuscular.json` en Ascent, `src/dominio/catalogoMuscular.json` en Moss: cada
ejercicio con su músculo principal, los que ayudan y su parte, `pechoAlto` o `tricepsLarga`). Los ejercicios
propios toman el grupo que eligió la persona como principal, sin ayuda.

## Rehecha el 19/11/2026 (después de verla en el iPhone)

Lo pediste mirándola como alguien que entra por primera vez; un agente que hizo de persona nueva, sin saber nada de
fitness ni de la app, la leyó dos veces y marcó lo que no se entendía. Lo que cambió:
- **Para hoy**, donde estaba «Tu rutina» (lo primero que se ve al llegar): una sugerencia de entrenamiento, una de comida
  y una de sueño, todos los días, con las reglas de `spec/estudio/sugerencias-de-hoy.md` en `sugerenciasDeHoy.ts`
  (tercer archivo compartido, con sus casos). No compensa la comida de ayer; el descanso activo «está bien», no «te
  recupera»; con un músculo que se recupera, «una serie menos y sin llegar al fallo».
- **Esta semana**: el cuerpo de frente o de espalda con la lista de ese lado. Se muestran las series duras (redondeadas),
  no el puntaje de 0 a 200: sin unidad no se entendía. La barra va de 0 a 30 con la franja de 10 a 20.
- **Qué hacer en cada franja**: «Le faltan: súmale series esta semana», «Va bien: sigue con tu rutina, no hace falta
  agregar más», «De más: esta semana no le sumes», «Recuperándose: mejor no entrenarlo fuerte hoy».
- **Al tocar un músculo**: lo demás se pone gris; el pecho y el tríceps se ven de cerca, partidos en sus dos partes; los
  ejercicios en una línea con los kilos de la próxima vez (`pesoSiguiente`). Un ejercicio de hoy con un músculo que
  se recupera no dice «sube» (`proximaSesion`, razón `fatiga`).
- **La misma regla, también al entrenar en Ascent (21/11/2026, lo eligió el dueño):** la pantalla de entrenamiento de
  Ascent usa `proximaSesion` y `pesoSiguiente` para avisar «↑ Puedes subir a 62,5 kg» (`nucleo/semanaMuscular.ts`,
  `subirHoy`, en su `main` f951a8a), con las repeticiones de la rutina como tope y la noche corta de `moss.moss_hoy`,
  que ahora lee al empezar cada entrenamiento (sin vínculo, devuelve null). Sus reglas de antes se borraron. **Cambiar
  esas dos funciones cambia también ese aviso**, en la próxima copia de Ascent.
- **El reloj**: un círculo que se llena hasta que el músculo está listo, «estimado».
- **Tu rutina** subió a su propio bloque; **Por qué** aparece solo con algo estancado; el tutorial explica serie y
  repetición; «Cómo se lee» al lado del «!».
- **Para más adelante**: preguntar si buscas músculo o fuerza (cambia las repeticiones de 8 a 12 a 3 a 6).

## Cambiada el 23/11/2026 (lo pediste mirándola en el iPhone)

- **«Sugerencias para hoy»** (antes «Para hoy») va justo arriba de «Esta semana», dentro de «Tus músculos».
  - **Entrenamiento:** si ya entrenaste hoy, no va (`entreno` es `null`); quedan la comida y el sueño.
  - **Comida:** en qué macros enfocarte. Si ayer quedaste por debajo del 80 % de la meta en alguno, los dos que más
    faltaron («Ayer quedaste bajo en carbohidratos y grasas: hoy, enfócate en eso»); si no, para recuperarte: proteína
    y carbohidratos el día que entrenas, proteína el de descanso. La entrada suma los carbohidratos y las grasas de ayer
    con sus metas.
  - **Sueño:** cuántas horas y a qué hora acostarte: tu necesidad, más 30 min después de una noche corta y 30 o 60 min
    con deuda media o alta (lo mayor, no la suma); la entrada suma `necesidad`. La hora es en minutos desde la
    medianoche: el periodo de melatonina cuenta desde las 18 y hay que convertirlo.
  - Las repeticiones y la reserva van como números (`[8, 12]`, `[1, 2]`): el «a» y el «o» los pone cada idioma.
- **Esta semana:** «Va bien» pasa a «Al día» (en inglés sigue «On track»).
- **Músculos fatigados:** el subtítulo es «Estado de los músculos trabajados.» y cada uno dice cuánto le falta: «falta 1
  día» o «faltan 3 días» (antes «listo pasado mañana» o «listo el sábado»).
- **Tus últimas marcas:** la última de cada ejercicio, de todos los que entrenas. Primero las de piernas, pecho y
  espalda (las del DOTS), en negrita; después las demás, de la más nueva a la más vieja. El cuadrado lleva el color de
  «Tu año» (los hombros, con el pecho) y el nombre, el grupo del ejercicio («Hombros: press militar»).

## 0. La regla de fondo

- **La misma información, el mismo orden y la misma interacción en las dos apps.** Solo cambia la
  estética: en Moss, la de Ascent; en Ascent, la de Moss.
- **Al entrar, todo visual.** Lo que se lee es corto y se entiende de un vistazo. Quien quiere más, toca
  y profundiza.
- **Cada regla, respaldada por estudios a favor y en contra.** Si alguien pregunta, se le muestran todos:
  - debajo de cada bloque, «En qué se basa», solo con lo de ese bloque;
  - las fuentes enteras, en la investigación de cada app.
- **Se deduce de lo que anotas.** Lo dice la sección una vez, abajo de «Tus músculos»: «Se calcula con lo
  que anotas en Ascent y en Moss: cuanto mejor anotas, más acierta.»

## 1. Lo que se saca

- «A antebrazos le faltan series: lo retomas el viernes» (la línea de la semana).
- «Tu noche»: se ve en Sueño.
- «Ver todos»: no se entendía. Los músculos se ven todos en el cuerpo, y la lista se abre tocando uno.
- «Ver en qué se basa» con la lista entera: cada bloque lleva solo lo suyo.

## 2. El orden

El 1 es lo primero que ves al llegar. En Moss llegas desde abajo (arrastrando desde arriba de Progreso),
así que el 1 está abajo de todo y se sube hacia el 6.

### 2.1 Tus músculos (el centro)

**El cuerpo**, de frente y de espalda, más grande que hoy (casi el ancho de la pantalla). Cada músculo
lleva el color de cuánto lo entrenaste esta semana:

| Estado | Qué quiere decir |
|---|---|
| Sin entrenar | ninguna serie dura esta semana |
| Poco | entrenado, pero todavía le falta para crecer |
| En su punto | dentro de la franja |
| Mucho | por encima de la franja |

Y aparte, **fatigado**: el músculo todavía se recupera de la última sesión. Va como un borde punteado en
terracota encima del color, quieto, así se distingue «entrenado y le falta» de «entrenado y todavía cansado».
En Moss: poco es el acento tenue; en su punto, el acento lleno; mucho, ámbar.

**El puntaje de cada músculo** es una barra con su franja: 100 es lo justo para crecer y la franja es el
rango que se defiende con la evidencia. Debajo del cuerpo van los músculos de la semana, cada uno con su
barra, de los que más necesitan a los que menos. *El número, la franja y si la fatiga entra o no en el
puntaje esperan la investigación (4.1). Hasta ahora lo sostenido es: el estímulo de la semana en un
número; la fatiga, aparte.*

**Tocar un músculo** cambia lo de abajo, sin abrir otra pantalla: el músculo se marca en el cuerpo y
aparece su detalle. Tocar otro lo cambia; tocar el mismo, o fuera del cuerpo, vuelve a la lista.
- **Sus partes**, solo donde hay ensayos de crecimiento (la activación, el EMG, no predice el crecimiento):
  - tríceps: la cabeza larga (con la extensión por encima de la cabeza; Maeo 2023) y las otras dos;
  - pecho: alto (press inclinado; Chaves 2020, Albarello 2022) y medio y bajo.
  - Los isquios no llevan partes: el curl sentado hace crecer más que el acostado (Maeo 2021), y eso se
    dice en el ejercicio («este ejercicio rinde más»).
  - Dorsales y trapecio no son partes de la espalda: son músculos propios, cada uno con su barra.
  - El resto, el músculo entero.
- **Sus ejercicios de la semana**: cada uno con sus series, cuáles al fallo y cuántas repeticiones te
  quedaban (RIR). Al lado, **la próxima**: «sube el peso» o «mantén el peso», con la razón en una línea
  (4.3).
- Lo que pesa en la próxima: tu sueño y tu comida de los días después de la sesión, solo si cambian la
  recomendación (4.3).

**Tu rutina**: una nota en palabras (por ejemplo «muy buena», «buena» o «mejorable») y las una o dos cosas
que la mejorarían (4.4).

**En qué se basa**, solo de este bloque.

### 2.2 Músculos fatigados

- **Título:** «Músculos fatigados». **Subtítulo:** «Estado de los músculos trabajados.» (23/11)
- Una fila por músculo fatigado: el nombre, el reloj y cuánto le falta («falta 1 día», «faltan 3 días»;
  23/11). Se dice en días, nunca en horas ni en %.
- Sin ninguno: «Ningún músculo fatigado.»
- **En qué se basa**, solo de este bloque (4.2).

### 2.3 Tu año

- El calendario con lo que entrenaste, como hoy.
- **La leyenda** suma los brazos: pecho, espalda, piernas, brazos, descanso y marca. Un día es de brazos
  cuando es lo que más trabajó; los hombros siguen con el pecho (es empuje). Los colores: pecho #419ec6,
  piernas #a77e33, espalda #765190 y brazos #b5677d (un rosa apagado, sin verde).

### 2.4 Estancados

- La lista de ejercicios estancados: el nombre, desde cuándo y la línea chica de la tendencia.
- La regla es la de hoy (`estaEstancado`): 8 semanas de tendencia sin subida clara y el umbral de Ascent.
  Si no hay ninguno: «Ningún ejercicio estancado.»
- **En qué se basa**, solo de este bloque (4.5).

### 2.5 Por qué puedes estar estancado

- Hasta tres razones, de la más sólida a la menos, cada una con sus números (lo de hoy,
  `razonesDeEstancamiento`): las series duras por semana, la frecuencia y la carga pesada; bajar rápido;
  la proteína; el sueño.
- Cada una dice qué hacer en una línea.
- **En qué se basa**, solo de este bloque.

### 2.6 Metas (arriba de todo: lo que menos importa)

- Por ejemplo, «Llegar a 100 kg en press de banca».
- Dice:
  - cómo vas;
  - si es realista y para cuándo, con un rango, nunca una fecha sola;
  - qué hacer: las series, cuándo subir el peso y qué comer;
  - si se aleja porque comes o duermes mal.
- Totalmente realista: la proyección sale de tu tendencia y de lo que suben los que entrenan como tú (4.6).
- **Dónde se guarda:** en el esquema `moss`, con funciones que pueden llamar las dos cuentas del vínculo
  (`moss.metas_de_fuerza()`, `moss.guardar_meta_de_fuerza(…)`, `moss.borrar_meta_de_fuerza(id)`, en
  `supabase/moss/0016_metas_de_fuerza.sql`): la sección existe solo vinculada. Se aplica en la base real con tu sí.
- **La proyección** es un rango de fechas, y solo con 6 sesiones del ejercicio o más (Rhea 2003, Swinton
  2024, Latella 2020).

## 3. El tutorial

- Un círculo con «!» arriba a la derecha de la sección.
- **5 diapositivas como mucho:** con más, la gente saltea desde la tercera.
- **No se puede saltear:** cada diapositiva espera unos 2 segundos antes de dejar pasar a la siguiente,
  como en la entrada de Ascent.
- Son pasos animados, dibujados en cada app (no GIF ni video), con los mismos pasos y los mismos textos.
- **Aparece solo** la primera vez que subes a la sección después de vincular. Después, cuando quieras,
  desde el «!».

Las diapositivas (borrador):
1. **Tus músculos.** El color dice cuánto entrenaste cada uno esta semana.
2. **La barra.** 100 es el medio de lo que recomiendan los estudios; la franja, de 70 a 130, es «en su punto».
3. **Toca un músculo.** Ves sus partes, tus ejercicios y cuándo subir el peso.
4. **Fatigados.** Los que todavía se recuperan, y cuándo vuelven.
5. **Con lo que anotas.** Se calcula con tus series en Ascent y tu sueño y tu comida en Moss: cuanto
   mejor anotas, más acierta.

## 4. Las cuentas (esperan la investigación)

Todas viven en un solo archivo de TypeScript puro, idéntico en las dos apps (sección 6).

### 4.1 El puntaje de cada músculo (de la investigación de Ascent)

- **La semana son los últimos 7 días, contando hoy**, no de lunes a domingo: la evidencia habla de series
  por semana, y con el lunes cada semana arrancaría con el cuerpo gris, un «sin entrenar» que no es.
- **Cuentan las series de trabajo** (en Moss, con el 60 % del 1RM estimado o más: la entrada en calor no).

- **Serie dura:** con RIR de 0 a 3 («al fallo» es RIR 0). Sin RIR anotado, cuenta si llegó a las
  repeticiones del objetivo.
- **El principal cuenta 1 y el que ayuda 0,5:** el conteo fraccionado que mejor explicó los datos (Pelland
  2026).
- **El rango de referencia es de 10 a 20 series duras por semana:** una convención donde se junta la mayor
  parte de la evidencia, no la cifra de un estudio. En contra: con 9, 18 o 27 series, el mismo crecimiento
  en entrenados (Heaselgrave 2019).
- **El puntaje, por tramos (tope 200):**
  - de 0 a 10 series, 7 por serie: 10 series = 70;
  - de 10 en adelante, 6 por serie: 15 = 100 y 20 = 130.
- **Los estados:** sin entrenar (0), poco (menos de 70), en su punto (de 70 a 130) y mucho (más de 130).
- **La fatiga no entra en el número:** va aparte, como marca en el cuerpo (4.2). La franja de 90 a 110 que
  se pidió primero era más precisa que lo que permite la evidencia: el modelo de fatiga erra hasta 7 puntos
  y la fuerza varía ~3 % de un día a otro (`spec/estudio/ascent.md`).
- **Para una segunda vuelta:** a los principiantes les alcanza con 6 a 10 series; si Ascent llega a saber
  la experiencia, la franja se podría correr.

### 4.2 La fatiga y la recuperación (de la investigación de Moss)

El modelo de porcentajes (`residual()`) no le gana a una constante: contra 16 mediciones de 7 ensayos erra 4,8
puntos, y una cifra fija, 3,6 (`spec/estudio/musculos-recuperacion.md`, 2). Por eso la sección dice la fatiga en días,
con una regla por casos para cada músculo y cada sesión en que fue principal (`diasParaEstarListo`):

| Lo que hiciste con ese músculo | Listo |
|---|---|
| Todas las series a 2 de reserva o más, hasta 9 series | al día siguiente |
| A 2 de reserva o más, con 10 series o más | en 2 días (derivado) |
| A 1 de reserva, o sin la reserva anotada | en 2 días |
| Al fallo | en 2 días; en 3 con un multiarticular de piernas o espalda baja |
| La primera vez con ese ejercicio en 26 semanas | un día más |
| Lo volviste a entrenar antes de estar listo | desde la última, un día más (convención) |

- Erra un día para los dos lados. Lo que más alarga la recuperación es llegar cerca del fallo, más que la cantidad
  de series. Sexo y edad no cambian la regla.
- Cargado si faltan 2 días o más; recuperándose si falta 1. Se dice «vuelve mañana», «vuelve pasado mañana» o
  «vuelve el sábado»; el dolor no cuenta.
- La fatiga no entra en el puntaje: es el borde punteado del cuerpo y la lista de fatigados.

### 4.3 La próxima sesión: subir o mantener el peso

- **Sin las repeticiones del objetivo** en la rutina (son opcionales en Ascent): mantén, «sin objetivo de
  repeticiones».
- **Sube** cuando todas las series llegan al tope del rango con RIR 2 o más, dos sesiones seguidas: la
  doble progresión. El respaldo es la autorregulación (Hickmott 2022); no hay un ensayo que la compare con
  otras reglas, y se dice.
- **Nunca por una sola serie:** el RIR se estima con un error de más o menos 1 (Halperin 2021, Russo
  2025).
- **La comida no frena** (refutado en la investigación de Moss, 6): comer en déficit no le quita fuerza a lo
  ganado (Murphy y Koehler 2022), y con la comida de siempre lo de antes de entrenar casi no cambia la sesión.
- **El sueño, solo ese día:** si hoy toca el ejercicio después de una noche de 6 h o menos (o de despertarte 1 h
  antes), «Hoy, mantén el peso: dormiste poco. Si sale con la reserva de siempre, sube la próxima.» Las
  repeticiones cuestan ~10 % más (Craven 2022); la fuerza máxima casi no cambia.

### 4.4 La nota de tu rutina

Solo los criterios con respaldo:
- cada músculo grande, dos veces por semana o más (Schoenfeld 2016);
- las series de la semana dentro de 10 a 20.

El equilibrio entre empuje y tracción es una convención: no entra.

### 4.5 Estancado

La regla de hoy (`src/dominio/estancados.ts`): 8 semanas de tendencia, con el umbral de Ascent.

### 4.6 Metas realistas

- `proyeccionDeMeta` (en `progresoCompartido.ts`): con la tendencia de 12 semanas del ejercicio y su rango, cuándo
  llegas al 1RM estimado de la meta, del ritmo rápido al lento. Con menos de 6 sesiones, «se puede calcular con 6»;
  si ni el ritmo rápido sube, «así no llega»; realista si al ritmo lento llegas en 52 semanas o menos.
- Cada meta dice: tu nivel de hoy contra la meta, cuándo llegas, qué hacer (la próxima sesión de ese ejercicio),
  qué comer (1,6 g de proteína por kilo) y lo que la puede alejar (dormir menos de 6 h de promedio en la última
  semana, o menos de 1,6 g por kilo con 4 días anotados).

## 5. Lo que hace falta de cada app

- **Ascent:**
  - el RIR por serie ya lo anota (desde su migración 102, opcional: «Registrar RIR» en Ajustes), como un
    array `rir` paralelo a `reps`, con null si no se anotó. Moss tiene que leerlo en
    `moss.ascent_sesiones` (hoy no lo devuelve): va en la misma migración que las metas;
  - el catálogo compartido con las partes.
- **Moss:** el sueño, la deuda, la energía, las metas de comida y lo comido de cada día. Ya sube con la
  0015 mientras está vinculada.

- **Diferencia conocida (19/11):** en «Por qué», Ascent aproxima `bajaSemanal` con los pesos de cada semana de
  `moss_semanas` y los años con su primer día anotado; Moss usa la tendencia de tu peso y tu respuesta del
  cuestionario. Para que den igual, la 0017 propuesta sube `baja_semanal` y `experiencia` en el resumen de hoy y
  `moss_objetivo()` los devuelve (con tu sí).

## 6. Cómo se mantiene igual

- **Las cuentas, en dos archivos puros, sin importar nada, copiados tal cual en las dos apps:**
  - `src/dominio/puntajeMuscular.ts`: la serie de trabajo y el 1RM (Epley), la semana de 7 días, el puntaje, las
    partes, la nota de la rutina, la próxima sesión y la fatiga en días;
  - `src/dominio/progresoCompartido.ts`: la tendencia de fuerza, estancado, por qué y el grupo de cada día del año.
  - Más `src/dominio/catalogoMuscular.json`, el catálogo de Ascent copiado tal cual, y `src/secciones/ascent/cuerpo.ts`,
    el dibujo del cuerpo.
- **Los casos de prueba:** un JSON idéntico por archivo, que corren las pruebas de las dos.
- **En Moss,** un control compara su copia con la de Ascent (solo la lee).
- **Nadie publica hasta que el dueño lo vea en las dos apps.** En Moss, lo visual pasa primero por la
  galería, con datos de mentira y las cuentas de verdad.
