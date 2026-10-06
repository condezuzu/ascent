# Alcance congelado

*Congelado el 15 de septiembre de 2026, a pedido del humano: "llevamos más de dos
meses; cada vez que uso la app aparecen features nuevas". Hasta terminar estas
dos listas NO entra nada nuevo.*

**La regla:** lo que aparezca usando la app se clasifica en una de tres:

1. **Bug** — algo que ya existe y anda mal. Entra siempre.
2. **Texto o ajuste visual** de algo que ya existe. Entra si es chico.
3. **Feature nueva.** Va al final de este archivo, en "Después", y no se toca
   hasta que las dos listas estén en cero.

Si no está claro si algo es 2 o 3, es 3.

---

## Lista 1 · Para que la web esté terminada de verdad

### Código

| # | Qué | Notas |
|---|-----|-------|
| W1 | Probar en el iPhone el arreglo del lag del `+`/`−` del peso | Arreglado el 15/9 (la cola esperaba a la red). Falta la prueba en el gimnasio. |
| W2 | Estancamiento por ejercicio con pesos | Espera datos: no antes del **9/11/2026**. Ver `peso-y-estadistica.md`. |
| ~~W3~~ | ~~"Hiciste 102 en banca, ¿lo guardo como marca?"~~ | **Hecho el 15/9**, en la web y en la nativa. |
| ~~W4~~ | ~~Login con Google~~ | **No entra.** Código borrado el 15/9. |
| W5 | Sacar la sección Diagnóstico de Ajustes | Se queda hasta que el registro automático esté probado **en el gimnasio con la app nativa**. |
| W6 | Poner al día `spec/estado.md` | Tiene corte al 21 de agosto. |
| ~~W7~~ | ~~Revisar sesiones con el total de series de menos~~ | **Hecho por el humano el 15/9**: una sola (07/09, 19 → 20), corregida. |
| W8 | La pantalla de entrada (cuatro pantallas + la animación de los ocho objetos) | **Pedida por el humano el 15/9**, con el alcance ya congelado: entra por decisión suya, no por la regla. Banco de pruebas en `/galeria/bienvenida`; los tiempos y las curvas, en `src/lib/bienvenida.ts`. |

### Lo que hace el humano (no es código)

| # | Qué |
|---|-----|
| H1 | ~~Variables de Web Push en Vercel.~~ **Sin efecto desde el 22/9/2026:** el aviso de las 20:30 se sacó. Las variables que queden en Vercel (`VAPID_*`, `CRON_SECRET`) ya no las lee nadie. |
| H2 | Probar el recorrido nuevo (Ajustes → "Ver la guía de nuevo") y el volumen nuevo. |

---

## Lista 2 · Para llegar a la tanda 3 (usar la app nativa en el gimnasio)

La tanda 3 es la **build de desarrollo instalada en el teléfono**. Lo mínimo
para dejar la web en el gimnasio es el bucle de una sesión: iniciar, contar
series, descansar, terminar — con y sin señal.

| # | Qué | Tandas |
|---|-----|--------|
| ~~N1~~ | ~~Sesión nativa: iniciar, cronómetro, terminar, cierre por inactividad~~ | **Hecho el 15/9**, con la MISMA lógica que la web (`compartido/`) |
| ~~N2~~ | ~~El bloque: selector de 100 ejercicios, meta, `+`/`−`, lista para corregir, peso con su etiqueta y la pregunta~~ | **Hecho el 15/9** |
| ~~N3~~ | ~~Descanso con notificación local (suena con la pantalla bloqueada) y la cola sin señal~~ | **Hecho el 15/9**. El aviso con la pantalla bloqueada se prueba recién en el teléfono (N4). |
| N4 | Build de desarrollo con EAS e instalarla en el iPhone, y probar ahí lo que el navegador no puede (aviso con pantalla bloqueada, vibración, pantalla despierta, "deshacer") | 1 |
| ~~N4b~~ | ~~Interruptor del sonido del descanso en Ajustes nativo~~ | **Hecho el 15/9**, adelantado (junto con la duración del descanso). |
| H3 | **Humano:** cuenta de Expo (gratis) y Apple Developer Program (99 USD/año) | **Lo hace el humano esta semana y avisa.** No se recuerda desde acá. |
| H4 | **Humano:** `ascent://confirmar` en Supabase → Authentication → URL Configuration → Redirect URLs | Solo para crear cuenta o recuperar la contraseña desde la app. Entrar con contraseña no lo necesita. |

**Queda una tanda: N4**, que espera la cuenta de Apple. Orden confirmado por el humano el 15/9.

Lo que estaba en el orden anterior —calendario con el resumen del día, peso,
fuerza, foto al registrar— **no hace falta para entrenar**: se sigue mirando en
la web mientras tanto. Si va antes, suma unas tres tandas a la llegada.

### Primero después de la tanda 3 (ya decidido, no es alcance nuevo)

- Botón de volumen suma una serie (§13f).
- Live Activity del descanso en la pantalla bloqueada (§13d).
- Registro automático al llegar al gimnasio con geofencing (§13).
- Calendario, peso y fuerza en nativo.
- ~~Ventana de las vidas y registrar el día con foto en nativo~~: **hechas el 15/9**, adelantadas mientras llega la cuenta de Apple.

---

## Después (lo que aparezca, anotado y sin tocar)

- **Series por músculo → los ejercicios de esa semana** (15/9/2026). Tocar una
  fila de la pantalla de series y ver qué ejercicios de ese músculo se hicieron
  en la semana leída, con sus series. Es una pantalla nueva, no un ajuste.

- **El planeta del día se guarda como NOMBRE y se podría derivar del NÚMERO —
  PENDIENTE PARA DESPUÉS DEL LANZAMIENTO** (decisión del humano, 6/10/2026).
  `logs.planeta_del_dia` guarda el nombre que tocaba ese día según la escalera de
  ese momento. Pero el nombre es una función del día de racha
  (`logs.racha_del_dia`, que ya se guarda) y de la escalera de hoy
  (`planeta_de_dia`): se puede calcular en el momento de mostrarlo.
  - **Por qué importa:** guardar el nombre obligó a la migración 62 (la 54 cambió
    la escalera y lo guardado quedó con nombres que ya no existen y con días en
    blanco) y a un disparador que recalcula todos los días hacia adelante cada vez
    que se corrige uno viejo. Si se deriva, no hay nada que rellenar nunca, ese
    recálculo desaparece, y el día que se vuelva a tocar la escalera no hace falta
    ninguna migración 63.
  - **Por qué no ahora:** toca lo que dibuja el visor de fotos en la web y en la
    nativa (`VisorFoto.tsx`, `Album.tsx`, `compartido/album.ts`) a días del
    lanzamiento.
  - **Qué queda igual hasta entonces:** los días anteriores a la última pérdida
    no tienen número, así que su planeta no se podría derivar: hoy conservan el
    nombre guardado (traducido por la 62). Hay que decidir qué mostrar ahí.
- **El rango: la base manda el NÚMERO y la app calcula el NOMBRE con una regla
  propia — PENDIENTE PARA DESPUÉS DEL LANZAMIENTO** (decisión del humano,
  6/10/2026). Es el mismo error que el del planeta, al revés, y los dos se
  vieron el mismo día: el mismo dato vive en dos lugares con dos reglas.
  - **Qué pasó:** la migración 54 cambió la escalera en la base. La build 7 de
    la tienda, sin OTA, siguió calculando el nombre con la regla vieja (un rango
    cada 10 días) mientras pintaba el fondo con el número nuevo que le manda la
    base: con racha de 6 a 9, fondo del rango 2 y nombre del 1; el festejo de
    subida, en los días de la escalera nueva con los nombres de la vieja.
  - **Por qué importa:** mientras el nombre —o cualquier parte de la regla— se
    calcule en la app, cada cambio futuro de escalera rompe toda build que no
    tenga una OTA encima. Sacar el rango de la racha en el cliente (tanda 1 del
    4/10: ninguna pantalla lee `rango_actual`) dejó una sola regla ADENTRO de
    la app, pero sigue siendo una copia de la de la base.
  - **Qué habría que hacer:** que la base mande el nombre del rango y el planeta
    junto con el número (en `pantalla_inicio`, `registrar_dia`,
    `usuarios_publicos`), y que la app solo los muestre. La regla queda en un
    lugar y una build vieja muestra lo correcto sin enterarse del cambio.
  - **Por qué no ahora:** toca Inicio, Stats, Ranking, el álbum y el festejo de
    subida en las dos apps, a días del lanzamiento.
- **Un solo dueño del estado de la sesión de entrenamiento** (4/10/2026).
  PENDIENTE PARA DESPUÉS DEL LANZAMIENTO, por decisión del humano: "es el
  código más delicado y no quiero tocarlo tan cerca del lanzamiento".

  *El problema.* El conteo y los bloques viven en cuatro lugares que se copian
  entre sí: el estado de React de cada instancia de `useSesion` (la pantalla y
  el vigilante del gimnasio), sus refs, la caché del aparato y la cola. Cada bug
  de la familia "una copia pisó a la otra" se arregló agregando una regla: los
  refs antes del `await`, la escritura firmada, `reconciliarConteo`, el reloj de
  toques, `bloquesSonDe`. Andan, pero se sostienen entre sí y cada una nueva
  hay que pensarla contra todas las anteriores.

  *La propuesta.* Sacar ese estado de React a un módulo de `compartido/` con un
  solo dueño, al que las instancias se suscriben. Sin copias no hay nada que
  reconciliar. Es un rediseño de `useSesion` entero, no un arreglo.

  *Lo que queda abierto hasta entonces*, de esa misma familia (está en
  `spec/trampas.md`, "Un refresco decide con una foto, y el toque cae en el
  medio"): la respuesta vieja de "no hay sesión" que llega después de Iniciar,
  y la de "está corriendo" que llega después de Terminar. (La tercera —dos `+`
  con milisegundos de diferencia— se arregló en la tanda 2: el
  leer-mezclar-guardar de la caché va en fila.)

  *Antes de empezar:* la red son los escenarios de `supabase/dobles/sesion/`
  (sección 179 de `test:db`), que corren el hook de verdad. Primero se escriben
  ahí los dos casos de arriba, en rojo, y recién después se toca el hook.
