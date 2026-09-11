# Peso por serie, resumen por entrenamiento y estadística general

Propuesta para los puntos 6, 7 y 8 de la bitácora. **Nada de esto está
implementado**: es lo que hay que aprobar primero.

Los tres son una sola cosa. El peso por serie es el dato; el resumen y la
estadística son las dos formas de mirarlo. Por eso van juntos, y por eso el
orden importa: si el dato sale mal, las dos pantallas salen mal.

---

## 0 · La condición que manda sobre todo lo demás

> "El peso es OPCIONAL. La app tiene que funcionar entera sin él, igual que hoy.
> Quiero que todo sea personalizable: el que no quiere anotar nada, no anota
> nada y la app le sirve igual."

Esto no es una preferencia de diseño, es la **invariante**. Se escribe como
test antes de escribir la primera línea de lo demás:

- La racha, el rango, el día registrado y los impulsos **nunca** leen un peso.
- Una sesión con cero pesos anotados se ve completa, no incompleta. Sin
  huecos, sin "faltan datos", sin campos vacíos pidiendo que los llenes.
- Ninguna pantalla nueva puede quedar vacía por no haber anotado: si no hay
  pesos, esas secciones **no existen**, no aparecen en gris.

Es la misma regla que ya cumple `sesiones.bloques`: con `[]` la app funciona
idéntica a como funcionaba antes de que existiera.

---

## 1 · Qué rompe el peso por serie (la pregunta que hiciste)

Encontré cinco cosas. Cuatro tienen solución y una es una decisión tuya.

### 1.1 El `+` no puede pedir un número — y esto es lo importante

El `+` es el botón más tocado de la app, ocupa 11vh a propósito, y se toca
transpirado, con una mano, sin aire. Si abre un teclado numérico, el gesto de
contar una serie pasa a ser un trámite. Eso no es "una molestia": es
exactamente lo que hace que la gente deje de contar, y contar es de lo que
vive la racha.

**La salida: el peso es del BLOQUE, no de la serie.** Al lado del ejercicio,
en la misma fila donde ya elegís qué estás haciendo y cuántas vas a hacer, hay
un campo de kilos. Cada `+` registra la serie **con el peso que esté puesto**.
Si subís de peso, tocás el número, lo cambiás, y las siguientes series van con
el nuevo.

Esto tiene tres virtudes:

- **Cero toques extra en el caso normal.** Cuatro series con el mismo peso son
  un número escrito una vez y cuatro `+`.
- **Es cómo se entrena de verdad.** Nadie hace 60, 82, 71, 65. Se hace un peso
  varias series, se sube, se sigue.
- **El peso por serie igual queda guardado**, porque cada serie se anota con el
  peso vigente en ese momento. O sea que la mecánica es "por bloque" y el dato
  es "por serie": lo mejor de los dos.

Y para corregir —la serie que salió mal, la que hiciste con otro peso— está la
lista, que ya existe y que te gustó. Ahí cada serie es una fila y se edita.

### 1.2 La serie hoy no existe como cosa

Hoy el bloque es `{ejercicio, series: 4}`: un contador. Para guardar un peso
por serie, la serie tiene que ser una fila. Eso cambia:

- `EstadoBloques` en el teléfono (`nucleo/bloques.ts`).
- La caché de sesión (`ascent:sesion`), que ya sabe sobrevivir a versiones
  viejas porque todos sus campos son opcionales.
- `sesiones.bloques` y `fijar_bloques` en la base.

**Forma nueva**, compatible hacia atrás:

```jsonc
{ "ejercicio": "press_banca", "series": 4,
  "pesos": [60, 60, 62.5, 62.5] }   // opcional, y puede tener huecos: [60, null, 62.5]
```

`series` sigue siendo el número y sigue siendo la verdad del conteo. `pesos` es
una anotación encima. Un cliente viejo que no la conoce la ignora; un bloque
sin `pesos` es exactamente el bloque de hoy. **No se toca `sesiones.series`,
que es de donde salen la racha y las estadísticas de hoy.**

### 1.3 La cola sin señal

`fijar_bloques` sube el bloque entero y es idempotente, así que agregar pesos
no cambia nada del mecanismo: sigue siendo una escritura que se puede repetir.
Lo único que crece es el tamaño del cuerpo, y con el tope de 40 bloques que ya
tiene es despreciable.

Sí hay que subir el tope de validación: hoy `fijar_bloques` filtra cualquier
cosa que no sea `{ejercicio, series}`. Hay que dejar pasar `pesos` con su
propia validación (número, entre 0 y 999, media unidad de precisión).

### 1.4 Las marcas y el DOTS — acá hay una trampa

Hoy las marcas (`prs`) las cargás a mano y son lo que alimenta el DOTS. Si se
anota peso por serie, la tentación obvia es que una serie de 100×1 cree una
marca sola.

**No hay que hacerlo automático.** El DOTS es un número que se compara con
gente de verdad, y una marca puesta por la app a partir de un número tecleado
apurado entre series lo ensucia sin que nadie se entere. Lo que sí:

> Cuando una serie supera tu marca vigente de ese ejercicio, al terminar el
> entrenamiento el resumen pregunta una vez: "Hiciste 102 en press de banca.
> ¿Lo guardo como marca?".

Una pregunta, al final, con el dato ya escrito. No un formulario.

### 1.5 La decisión que es tuya: repeticiones

Con peso por serie, el volumen es `peso × series`. Con repeticiones sería
`peso × reps × series`, que es el volumen de verdad.

Mi recomendación: **no pedir repeticiones.** Un campo más por bloque duplica el
costo de anotar y el 90% del valor está en el peso. Si alguna vez hace falta,
entra como `reps` al lado de `pesos` con la misma forma —opcional, por
bloque— y no rompe nada de lo que se construya ahora.

Si lo querés desde el principio, decilo ahora: el modelo es el mismo, pero la
fila del bloque tiene dos campos en vez de uno y eso cambia el diseño de esa
fila.

---

## 2 · Punto 7 — Resumen por entrenamiento

### Lo que ya existe

Más de lo que parece. `sesiones` guarda `inicio`, `fin`, `series`, `bloques`,
`origen` y el `log_id` del día. O sea que el resumen de un día **ya se podría
armar hoy**, sin pesos, y ganaría los pesos cuando existan.

### La pantalla

Un calendario en Stats. Tocás un día:

- **Si no entrenaste**: el día se ve, sin nada que tocar. Un día vacío es un
  hecho, no un error.
- **Si entrenaste**: se abre una hoja (la misma que ya usa el resto de la app)
  con, en este orden:
  1. **Fecha y duración.** Lo que ya sabés.
  2. **Los ejercicios**, en el orden en que los hiciste, con sus series. Con
     pesos si hay: `Press de banca — 60, 60, 62.5, 62.5`. Sin pesos:
     `Press de banca — 4 series`. **La misma fila, sin hueco.**
  3. **Volumen por músculo**, y solo si hay pesos. Sale del árbol de ejercicios
     que ya tiene zona y grupo (`nucleo/ejercicios.ts`): cada ejercicio sabe a
     qué músculo pertenece.
  4. **La foto del día**, si hay.

### Lo que NO va

- Gráficos adentro del resumen de un día. Un día no tiene tendencia.
- Comparaciones con otros días ("15% menos que el martes"). Eso es la pantalla
  del punto 8, y meterlo acá convierte mirar un entrenamiento en rendir cuentas.

---

## 3 · Punto 8 — Estadística general

### El principio

Stats hoy dice **quién sos** (racha, rango, DOTS, impulsos). Esto agrega **qué
venís haciendo**. Son dos cosas distintas y no pueden mezclarse en la misma
lista, o la racha —que es el corazón— queda enterrada entre números.

Propuesta: Stats se parte en dos pestañas dentro de la misma pantalla.
**"Vos"** (lo de hoy, intacto) y **"Entrenamiento"** (esto). El calendario del
punto 7 vive en la segunda.

### Qué muestra, en orden de utilidad

1. **Peso máximo por ejercicio.** Una lista corta: ejercicio, el máximo, y
   cuándo fue. Es el dato que la gente busca primero y el que hoy no está.
2. **Volumen en el tiempo.** Barras por semana, con el mismo lenguaje visual
   que el gráfico de peso corporal que ya existe. Filtrable por músculo.
3. **En qué estás estancado.** Ver abajo.
4. **Dónde no estás entrenando.** El reverso del volumen por músculo: si hace
   seis semanas que no hay nada de pierna, eso se dice. Es el dato más útil de
   todos y el que nadie mira solo.

### El estancamiento, con datos reales

Hoy el detector mira marcas y duración de sesiones. Con volumen tiene el dato
que le falta, pero hay que decidir qué pasa cuando se contradicen. La regla que
propongo:

> El estancamiento se declara por **ejercicio**, no en general. Un ejercicio
> está estancado si hace ≥ 6 semanas que su peso máximo no sube **y** hubo al
> menos 4 sesiones con ese ejercicio en el período.

La segunda mitad es la que evita el aviso injusto: no estás estancado en peso
muerto si hace seis semanas que no hacés peso muerto — estás haciendo otra
cosa, que es distinto y no es un problema. Ese caso lo cubre el punto 4 de
arriba ("dónde no estás entrenando"), que dice otra cosa y con otro tono.

Y sigue valiendo lo de hoy: describe, no juzga y no receta. Un hecho con fecha.

---

## 4 · Orden de trabajo propuesto

Cada paso deja la app entera y desplegable. Ninguno depende de que el siguiente
salga bien.

| # | Qué | Por qué en ese lugar |
|---|-----|----------------------|
| 1 | El test de la invariante: sin pesos, todo igual | Antes de escribir nada que pueda romperla |
| 2 | `pesos` en el modelo: núcleo, caché, `fijar_bloques` | El dato, sin interfaz |
| 3 | El campo de kilos en la fila del bloque + la lista editable | Lo que se toca en el gimnasio |
| 4 | El resumen por día (punto 7), **sin** volumen | Funciona ya, con lo que hay guardado |
| 5 | Volumen por músculo en el resumen | Cuando ya hay pesos de verdad anotados |
| 6 | La pestaña "Entrenamiento" (punto 8) | Necesita semanas de datos para no verse vacía |
| 7 | El estancamiento por ejercicio | Lo último: es el que más datos necesita |

Entre el 3 y el 6 conviene que pasen **dos o tres semanas de uso real**. Una
pantalla de tendencias con cuatro días de datos se ve rota aunque esté bien, y
la conclusión es "esto no sirve".

---

## 5 · Lo que hay que decidir antes de arrancar

1. **¿Repeticiones, sí o no?** (§1.5). Mi recomendación es que no, por ahora.
2. **¿Stats se parte en dos pestañas** o la estadística de entrenamiento es una
   pantalla aparte? Mi recomendación son las pestañas: una pantalla nueva en la
   barra de abajo cuesta un lugar que no sobra.
3. **¿El calendario del punto 7 reemplaza a "Corregir días"**, que ya es un
   calendario, o son dos? Mi recomendación: uno solo, y corregir pasa a ser una
   acción adentro del día que abrís.
