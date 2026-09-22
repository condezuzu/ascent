# Estado actual

*Corte al 21 de agosto de 2026. Describe cómo está el proyecto hoy, no lo que
se decidió. Actualizar al terminar cada tanda.*

## Lo primero: producción tiene una cosa que el repo no

El trigger `sugerencia-nueva` sobre `feedback` vive **solo en producción**: lo
crea el panel y su definición no puede ir a un repo público. Está anotado en
`SOLO_EN_PRODUCCION`, en `supabase/verificar-conexion.mjs`. Si el correo de
sugerencias deja de llegar, empezá por mirarlo en el panel.

## Migraciones

**Aplicadas hasta la 44.** Lo dice la base misma: `version_del_esquema()`
contestó 44 el 18/9 (esta línea decía "falta correr la 44").

> Este párrafo decía "las 22 primeras están aplicadas; la 23 falta correr"
> hasta el 17/9/2026, con veinte migraciones ya corridas encima. Se actualiza
> ahora y queda la advertencia: **este número hay que moverlo en el mismo
> commit que agrega la migración**, porque es el único lugar donde está escrito
> qué tiene la base de verdad, y una nota vieja acá es peor que no tener nota.

**La 44** agrega `mis_ejercicios_usados()`, una función de lectura nueva. Era
de donde salía la sección "Tuyos" del selector de ejercicios, **que se retiró
de las dos apps el 18/9** a pedido (usándola en el gimnasio, la lista "no se
entendía"; el selector volvió a como estaba antes del 17/9). Ninguna app la
llama. Correrla o no da lo mismo hoy: no cambia ningún dato ni toca nada
existente, y §121 la sigue probando por si se vuelve a usar.

En una base nueva no hace falta ninguna: `supabase/schema.sql` ya las incluye a todas, y
`npm run test:db` lo comprueba comparando las dos bases entera. Que PRODUCCIÓN
coincida con el repo lo comprueba `npm run test:conexion`, que le pide a la
base real su propio retrato — y mientras la 20 no esté aplicada, avisa que no
comparó en vez de pasar en verde.

Las migraciones las aplica **el humano** en el SQL Editor: en `.env.local`
solo hay la anon key, así que desde una sesión de Claude no se puede tocar el
schema de la base real. El flujo es: escribir la migración → probarla con
`npm run test:db` contra PGlite → avisar.

## Dónde vive

- Código: `C:\Users\agusc\ascent` (fuera de OneDrive desde el 11/8).
- Repo: https://github.com/condezuzu/ascent, rama `main`.
- Producción: https://ascent-blush-seven.vercel.app
- Supabase: proyecto `okeanaihymbvbdmrdqph`. Dev en el puerto 3020.

## Hecho y funcionando

- **Racha, rangos y pérdida**: ocho rangos de diez días, planeta del día en el
  rango 4, pérdida de −10 una vez por corte, piso de misericordia, corrección
  manual por calendario, recálculo sin rebote.
- **Descansos fechados**: cambiar la rutina no toca el pasado.
- **Seguridad**: RLS + grants por columna + políticas de storage acotadas.
  Verificado con dos cuentas: el peso no se ve nunca, ni entre amigos.
- **Auth**: alta, login, recuperación por correo, onboarding.
- **Social**: amigos, solicitudes, campo estelar, lista, feed, perfil de
  amigo, retos, eliminar amigo.
- **Fotos**: subida, visibilidad por foto, borrado, avatar con recorte
  circular (sube 512×512 jpeg, ~9 KB, nunca el original de la cámara).
- **Perfil propio** (`/yo`): cambiar foto, elegir qué fotos ven los amigos
  desde un solo lugar, modo "ver como lo ven los demás", administrar amigos.
  La vista previa y el perfil ajeno comparten el componente `ComoMeVen`, así
  que no pueden mostrar cosas distintas.
- **Ajustes**: nombre de usuario con unicidad insensible a mayúsculas,
  visibilidad por defecto de fotos nuevas, unidad de peso kg/lb, sexo para el
  DOTS, exportar mis datos, eliminar la cuenta. El peso **siempre se guarda en
  kilos**; la unidad es solo de presentación. Cada sección vive en su propio
  archivo (`components/ajustes/`): la pantalla crece cada vez que aparece una
  preferencia nueva, y así tocar una no obliga a leer todas.
- **Fuerza** (§16): marcas con Epley o 1RM real, catálogo de 100 ejercicios,
  DOTS con los coeficientes de OpenPowerlifting, ranking entre amigos
  y percentil global. `/fuerza` se escribe, Stats se lee, y en la principal va
  una línea mono con los tres pesos. El DOTS se calcula **en la base**: la
  fórmula necesita el peso corporal, que ningún cliente ajeno puede leer.
- **Cronómetro de sesión** (§17): el día se registra al INICIAR, no al
  terminar; a las 4 horas se cierra sola y queda **sin duración**, nunca con un
  número inventado; abajo de 5 minutos cuenta como día pero no como duración;
  la duración es **privada**, ni los amigos la ven. El tiempo se calcula
  siempre contra el `inicio` guardado, nunca sumando ticks. Y el peso corporal
  se puede anotar desde `/fuerza` (`anotar_peso`), que antes era un callejón
  sin salida si ya habías registrado el día.
- **Descanso entre series** (§18): botón
  "Descansar" adentro de la sesión, cuenta atrás a pantalla completa con el
  número como única cosa grande, presets de 60 s a 5 min que valen para lo que
  queda de la sesión, y Wake Lock para que no se apague la pantalla. **No toca
  la base**: el timestamp de fin vive en localStorage, así que sobrevive a
  cerrar la app y arranca sin red. El aviso es vibración primero y sonido
  después —apagado por defecto—, y Ajustes dice qué va a pasar de verdad en ese
  teléfono, porque en iPhone la web no vibra.
- **Stats**: además de la constancia, el mapa del año y el peso, en Sesiones
  van los **últimos 7 días con su duración** —agrupados por día, porque puede
  haber más de una sesión por jornada, y las abandonadas suman cero en vez de
  inventar un número— y en Fuerza un bloque **"Dónde estoy"** con el percentil
  y la **categoría** de la fuente —intermedio, avanzado— además del porcentaje,
  **por ejercicio y nunca para el total**: sumar los umbrales de los tres no da
  el umbral del total y en las colas se rompe. El total lo resume el DOTS, que
  existe para eso. Debajo de la primera categoría se muestra **cuánto falta**
  para principiante, en vez de un hueco.
  Se compara contra **tablas publicadas que viven en el repo**
  (`src/lib/estandares.ts`, Strength Level 2026), no contra los usuarios de
  Ascent: sirve desde el primer usuario y se calcula en el teléfono, sin
  llamadas. Con sexo femenino la app avisa que la muestra es más chica.
- **Onboarding**: recorrido de tres pantallas (`/bienvenida`) entre el nombre
  y la principal, saltable; globos de primera vez en Leaderboard, Stats y
  Álbum; se repite desde Ajustes.
- **Motor**: los ocho rangos con shaders propios, subidas de rango, paleta por
  rango que tiñe toda la app, fantasma de la mejor racha, estado de descanso.
- **Rendimiento**: un solo renderer para toda la app, three.js en chunk
  aparte, caché del perfil, fondo CSS inmediato. Cambiar de pantalla: ~8 ms.
- **Correo**: Resend configurado; cada sugerencia llega por mail.
- **Reglas escritas dos veces**: las cuentas que corren en SQL y en el cliente
  a la vez (1RM, número de rango, planetas, descansos vigentes) viven en
  `src/lib/reglas.ts` y la sección 26 de `test:db` corre las dos contra los
  mismos valores. Ese archivo **no importa nada** a propósito: si le agregan un
  import, Node no puede cargarlo y el test se cae. Ver `trampas.md`.

### Verificado de punta a punta el 18/8

- **Cronómetro y descanso en el navegador, con sesión real**: empezar registró
  el día (racha 0 → 1), el descanso arrancó en 3:00, y **recargar la página en
  medio del descanso lo retomó en 2:26** —lo que decía el reloj—, no en 3:00.
  Esa es la prueba de que no se cuentan ticks. Los presets cambian la cuenta al
  toque, y al llegar a cero el fondo vuelve de golpe al del rango.
- **Cronómetro contra la base real** con sesión de verdad: iniciar/terminar,
  el piso de 5 minutos, que nadie pueda insertar una sesión a mano, y
  `anotar_peso` guardando sin registrar un día.
- **Fuerza contra la base real**, con las dos cuentas y sesión de verdad: se
  carga una marca, el 1RM real de 5 repes lo frena la restricción, el DOTS usa
  el peso corporal más reciente, un amigo ve las marcas y **el DOTS exacto**
  (migración 28) pero **nunca el peso**, y sin peso corporal cargado la persona
  queda fuera del ranking. Los helpers que tocan el peso ajeno siguen sin alcance
  desde el cliente.
- Confirmado de paso que **el peso corporal no se puede escribir directo**:
  `weights` solo tiene `select`. Se carga por `registrar_dia` o, desde la
  migración 09, por `anotar_peso`.

### Verificado de punta a punta el 11/8

- **Baja de cuenta**: cuenta descartable con datos en todas las tablas y
  archivos en los dos buckets, borrada desde la interfaz real. Se fue todo:
  `auth.users` (el correo quedó libre), perfil, días, pesos, descansos,
  amistades, retos, y los archivos de los dos buckets. Destapó el bug del
  avatar huérfano, ya arreglado (ver `seguridad.md` §5b).
- **Storage**: los avatares se siguen viendo sin credenciales, y el listado
  del bucket ya no devuelve nada ajeno.

- **Todo el texto en un solo archivo** (`src/textos.ts`): las ~31 pantallas y
  componentes leen de ahí. Cambiar una frase es una línea. Quedan afuera a
  propósito los nombres de rangos y planetas (vocabulario, no interfaz), las
  citas con autor, y el artículo largo de "Cómo se compara la fuerza".
- **El punto del gimnasio, a la vista**: se presenta en la bienvenida sin pedir
  nada, se recuerda en Inicio mientras no esté marcado, y se insiste una vez,
  justo después de registrar el día — el único momento en que es probable que
  la persona esté parada ahí. **Nunca al empezar la sesión.**

## A medias

- **La app nativa, contra la web**: el inventario pantalla por pantalla está
  en la bitácora del 22/9. Lo que falta del lado nativo, en el orden que fijó
  el humano: Ajustes entero (ahí vive el punto del gimnasio, que es la función
  central, y el sexo y el nombre, sin los cuales el DOTS no calcula), el
  perfil propio y el de un amigo (piden Expo Router), la pantalla de marcas y
  Apple Health. El aviso de las 20:30 NO está en esa lista: se sacó.
- **TestFlight: ya está.** La app existe en App Store Connect como "Ascent —
  Streak & Strength" (ASC App ID 6815006917, bundle `uy.ascent.app`, contrato
  de apps gratuitas activo) y la primera build subida es `fea8f17a`. El
  certificado de distribución lo creó el humano el 22/9 y quedó una clave de
  API con rol APP_MANAGER, así que las builds y las subidas siguientes no lo
  necesitan a él. Los textos de la ficha están en `spec/ficha-tienda.md`.
- **Gente sugerida**: decidido que la lógica se escriba pero quede oculta
  hasta que haya 10 usuarios reales. Todavía NO está implementada.
- **Retos**: tienen UI construida por pedido explícito. Si la beta arranca sin
  ellos, se **ocultan, no se borran**.
- **`/galeria`**: ruta de QA pública en producción. No expone datos.
  Decidir si se esconde antes de la beta.
- **Google como proveedor**: el botón está oculto tras la constante
  `GOOGLE_LISTO` en `src/app/login/page.tsx`. Poner en `true` el día que se
  configure el proveedor en Supabase.

## Falta

1. **Probar en un teléfono de verdad** lo que el panel no puede: que vibre al
   terminar el descanso (Android), que la pantalla no se apague mientras corre,
   y que el aviso llegue con la app adelante.
2. **Gente sugerida**: sin usuarios no tiene a quién sugerir. Espera.
3. **Traducir al inglés.** El texto ya está todo en `src/textos.ts`; el trabajo
   es agregar `en` con la misma forma, y el tipo de uno obliga al otro a estar
   completo. Va **después** de migrar a nativo, no antes.

Las migraciones 20 a 24 están corridas y verificadas contra producción
(`test:conexion` compara producción con el repo; `test:vuelta-atras` comprobó
la 24 de punta a punta: la sesión arrancó 60 s atrás con `origen = ubicacion`).

## Usarla dos semanas seguidas: qué mirar

**Nada bloquea empezar.** El e2e pasa entero contra Supabase real (57/57) con
la migración 24 aplicada, y lo que se rompe en un uso largo —vuelta de día,
subida de rango, pérdida de racha, cierre de sesión a las 4 h, cambio de zona
horaria— está cubierto por tests. Lo que sigue es qué vigilar, no qué falta.

1. **El automático en un gimnasio de verdad.** Es lo único que no se puede
   probar desde acá: GPS real, radio real, tu gimnasio. Todo lo que pase queda
   anotado en **Ajustes → Diagnóstico**, que existe justo para eso.
2. **Si te desloguea.** Se encontró y se arregló la causa (dos bugs
   encadenados en el middleware, ver `trampas.md`), pero es lo peor que puede
   pasar y no está probado en la calle. La bitácora anota ahora cada refresco
   de token, cada pérdida de sesión y cada rebote a /login: si pasa, buscá
   `SESIÓN PERDIDA` o `REBOTE` en Ajustes → Diagnóstico.
3. **El radio del gimnasio.** El GPS bajo techo tiene 20 a 50 m de error. Si el
   automático no dispara, "Mirar ahora" en el Diagnóstico dice a cuántos metros
   te ve; con eso se ajusta el radio en vez de adivinar.
4. **Señal en el gimnasio.** Muchos son subsuelos. Si falla la red, el día y la
   sesión **se reintentan solos cada dos minutos** mientras estés adentro, y el
   día siempre se puede corregir a mano desde Ajustes.

Lo que NO va a andar y no es un bug: **con la app cerrada no pasa nada**. El
navegador no despierta a nadie. Ver `etapa-nativa.md` §13.

## Nada de esto está en el camino crítico

**No hay beta con gente.** El plan es: terminar la web, usarla el dueño solo
una o dos semanas cazando bugs, pasarla a nativo con Expo, y recién ahí
marketing. Sin usuarios ajenos, todo lo que sigue **espera a la etapa nativa**
y no bloquea nada:

- SMTP propio en Auth y dominio verificado. Con un solo usuario, los 2 correos
  por hora del SMTP de cortesía alcanzan de sobra.
- **"Confirm email" queda APAGADO.** Es lo que deja correr `npm run test:e2e`.
- Backups automáticos: el plan Free no tiene. Se queda en Free — no hay datos
  de nadie más que del dueño, y el schema entero está en el repo.
- Renombrar o borrar las cuentas de prueba. Nadie las va a encontrar.
- Rotar las llaves. La ventana de exposición la cerró la migración 19 y no hay
  terceros en la base. Se hace junto con el pasaje a nativo, que ya obliga a
  tocar la configuración.

El runbook completo, para cuando toque, está en el README (`Preparar la beta`).

## Cuentas de prueba vivas

Dos: `prueba_uno` y `prueba_dos`, con racha de 3 cada una y amistad aceptada
entre ellas; `prueba_uno` tiene fotos, pesos y avatar. Supabase acepta dominios
inventados como `.test` para el alta.

**Las claves NO están en el repo.** Viven en `.env.local`, en `PRUEBA_UNO` y
`PRUEBA_DOS`. `prueba_uno` es además la cuenta con la que `test:conexion` pide
el retrato de la base (`CONEXION_EMAIL` / `CONEXION_PASSWORD`, el mismo par).

Estuvieron publicadas acá hasta el 21/8/2026, en un repo público. Se rotaron
ese día. Si alguna vez hay que volver a escribirlas en algún lado, que sea
`.env.local` y nada más: en el repo va el nombre de la variable.

## Problemas conocidos

### RESUELTO (18/9): la página se congelaba al montar el motor — eran dos causas

Lo que se veía: con el motor montado, un toque tardaba 7-20 s (medido con
`herramientas/sonda-como-se-compara.mjs`), y las marcas del motor no veían ese
tiempo. **Esto explica las capturas intermitentes que veníamos arrastrando**:
no eran de la captura, eran la página trabada. Medido en "Cómo se compara"
(4 de 4 visitas con el motor montado). `stats-calendario` falló con el mismo
síntoma pero NO se midió aparte: lo confirma o lo desmiente la primera corrida
de `npm run capturas` con el arreglo.

**Causa 1 — WebGL por software.** El navegador de las sondas no tiene GPU:
dibuja con SwiftShader, en la CPU. Perfil de CPU
(`herramientas/perfilar-bloqueo.mjs`): 4,5 s de tarea larga al montar y
después ~1 s POR CUADRO, todo en código nativo del navegador (el JS suma
milisegundos). Con la GPU de la misma máquina: ninguna tarea larga. Le pasa
también a gente real: máquinas virtuales, escritorio remoto, placas en la lista
negra de Chrome. **Arreglo:** sin GPU de verdad el motor no se prende y queda
el fondo de CSS (`src/motor/escena.ts`: el caveat del navegador, el nombre del
renderizador siempre, y la medición de los primeros cuadros, que es la que
decide). Los cuatro casos —GPU real, software, Chrome que informa mal, GPU
lenta— se prueban con `herramientas/probar-filtro-gpu.mjs`.

**Causa 2 — el shader de cuerpos en Direct3D, y esta era la grave.** Con GPU
el login tardaba 149 s en entrar. Medido paso por paso: compilar el programa
del shader de cuerpos (33 KB, los seis modos en uno, elegidos con un uniform)
tomaba el hilo **134-140 s** en Chrome de Windows, también en el Chrome
instalado. Es la PRIMERA visita de cada persona en cada versión: la caché de
shaders del navegador se invalida con cada deploy. En el iPhone no pasa (Metal).
**Arreglo:** un programa por modo (`#define MODO`), bucles con límite que el
compilador no conoce (`+ uCero`), y el primer cuadro espera a `compileAsync`.
Primera visita en Chrome, antes → después (`herramientas/medir-bienvenida.mjs`):
el login acepta texto a los 127 503 ms → **38 ms**; hilo bloqueado en todo el
recorrido 133 480 ms → **0**. El planeta, el modo más caro, compila en 4,4 s
sin una sola tarea larga. La bienvenida en sí nunca trabó: su motor usa los
materiales de three.js, no este shader. §124 impide volver atrás.

Lo que queda para el teléfono: el costo por cuadro con los bucles sin
desenrollar se midió igual en esta GPU (`herramientas/medir-costo-cuadro.mjs`,
todo dentro del ruido de ±23 %), pero en una GPU chica podría no ser igual. Ver
el checklist de `spec/etapa-nativa.md`.

- El panel de preview del entorno **se cuelga**: los clicks por píxel se traban
  y `read_page` da timeout. Ya no se depende de él: el QA visual sale de
  `npm run capturas`, que levanta la app en su propio puerto y su propia
  carpeta de build, entra con la cuenta de prueba, recorre las pantallas en
  móvil y escritorio y deja los PNG en `capturas/` (ignorada por git). Avisa
  además de errores de consola y de contenido cortado por cualquiera de los dos
  lados.
- El `launch.json` del directorio de trabajo tiene rutas absolutas por
  proyecto: al mudar una carpeta hay que actualizarlo o el preview no arranca.

### De la caza del 15/9/2026: anotados, sin tocar (decisión del humano)

Salieron de `npm run test:real` y de leer el código. Ninguno pierde datos ni
deja afuera; los que sí, se arreglaron ese día.

**Medios**
- **Corregir un día desde el calendario son dos escrituras** (borrar y volver a
  poner, `HojaDelDia.tsx`). Si la red se corta entre las dos, el día queda
  vacío; se avisa en pantalla y se puede reintentar. Arreglo de fondo: una sola
  función en la base.
- **La nativa nunca llama a `fijar_zona`.** La web la actualiza al abrir. Con
  el teléfono en otro huso que el perfil, la nativa y la base discrepan sobre
  qué día es hoy. Solo importa viajando.

**Bajos**
- **Una foto que se vuelve privada** se sigue viendo hasta una hora en una
  pantalla que ya estaba abierta (los enlaces firmados duran 3600 s). El
  servidor la niega al instante para cualquier pedido nuevo.
- **Si la foto sube pero su fila no**, el archivo queda en el bucket sin usar.
  Al borrar la cuenta se borra igual (se lista la carpeta, no las filas).
- **Si se pierde la respuesta de `iniciar_sesion`**, el reintento trae
  `registro: null`: se pierde el festejo de subida de rango de ese día.
- **Sin mirar el error:** borrar una marca (`fuerza/page.tsx`), aceptar o
  rechazar un amigo y responder un reto (`social/page.tsx`,
  `perfil/[id]/page.tsx`). La pantalla recarga y muestra lo que quedó, pero
  no dice que falló.
- **Una marca cargada a mano en la web** (`CargarMarca`) se puede duplicar si
  la respuesta se pierde y se vuelve a tocar. La marca sugerida ya no.
- Queda un archivo de 1×1 en el bucket `fotos`, de una corrida vieja de
  `simular-semana`; borrarlo necesita service_role.


## El aviso de las 20:30, sacado (22/9/2026)

Se fue entero, por decisión del humano: el aviso, su cron, la suscripción push
del navegador y el puerto de avisos remotos. La nota que estaba acá explicaba
por qué el cron a las 23:30 UTC NO se corría con el horario de verano (Uruguay
no tiene desde 2015) y qué iba a pasar con la primera cuenta fuera de UTC−3.
Ese problema ya no existe, porque no existe el cron.

**Lo que quedó en la base y no se tocó:** la tabla de suscripciones y sus tres
funciones (`guardar_suscripcion_push`, `borrar_suscripcion_push`,
`olvidar_suscripcion_push`, migración 35). Sacarlas pide una migración que
aplica el humano y no molestan: no las llama nadie. Los tests que las cubren se
quedan, porque lo que prueban sigue estando ahí.

**Lo que quedó en Vercel:** `VAPID_*` y `CRON_SECRET`. Ya no los lee nadie.

**El aviso de fin de descanso NO es esto y sigue vivo:** es local, lo programa
la app, y en nativo llega con la pantalla bloqueada.
