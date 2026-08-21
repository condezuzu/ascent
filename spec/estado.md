# Estado actual

*Corte al 21 de agosto de 2026. Describe cómo está el proyecto hoy, no lo que
se decidió. Actualizar al terminar cada tanda.*

## Lo primero: producción tiene una cosa que el repo no

El trigger `sugerencia-nueva` sobre `feedback` vive **solo en producción**: lo
crea el panel y su definición no puede ir a un repo público. Está anotado en
`SOLO_EN_PRODUCCION`, en `supabase/verificar-conexion.mjs`. Si el correo de
sugerencias deja de llegar, empezá por mirarlo en el panel.

## Migraciones

**Las 20 primeras están aplicadas; la 21 falta correr.** En una base nueva no
hace falta ninguna: `supabase/schema.sql` ya las incluye a todas, y
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
- **Fuerza** (§16): marcas con Epley o 1RM real, catálogo de 31 ejercicios,
  DOTS con los coeficientes de OpenPowerlifting, bandas, ranking entre amigos
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
  y la **categoría** de la fuente —intermedio, avanzado— como número grande,
  además del porcentaje. Va el total y también **cada ejercicio por separado**.
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
  el peso corporal más reciente, un amigo ve las marcas pero **no** el peso ni
  el DOTS exacto —solo la banda—, y sin peso corporal cargado la persona queda
  fuera del ranking. Los helpers que tocan el peso ajeno siguen sin alcance
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

## A medias

- **Gente sugerida**: decidido que la lógica se escriba pero quede oculta
  hasta que haya 10 usuarios reales. Todavía NO está implementada.
- **Recordatorio diario**: pospuesto para nativo (ver `etapa-nativa.md`).
- **Retos**: tienen UI construida por pedido explícito. Si la beta arranca sin
  ellos, se **ocultan, no se borran**.
- **`/galeria` y `/tipografias`**: rutas de QA públicas en producción. No
  exponen datos. Decidir si se esconden antes de la beta.
- **Google como proveedor**: el botón está oculto tras la constante
  `GOOGLE_LISTO` en `src/app/login/page.tsx`. Poner en `true` el día que se
  configure el proveedor en Supabase.

## Falta

1. **Correr la migración 10** y probar en un teléfono de verdad lo que el
   panel no puede: que vibre al terminar el descanso (Android), que la pantalla
   no se apague sola mientras corre, y que el aviso llegue con la app adelante.
2. **Gente sugerida**, con el criterio y el umbral ya decididos.

## Antes de invitar gente

- [ ] **SMTP propio en Auth**: el de Supabase permite ~2 correos por hora. La
      cuenta de Resend ya existe; falta configurarla en Authentication →
      Emails (`smtp.resend.com:465`, usuario `resend`, la misma API key) con
      un dominio verificado.
- [ ] Volver a prender **"Confirm email"**, apagado para poder testear.
- [ ] Backups automáticos confirmados en Supabase.
- [ ] Borrar las cuentas de prueba.
- [ ] **Rotar el JWT secret de Supabase.** La service_role key estuvo expuesta
      (ver el webhook de sugerencias, más abajo). La migración 19 cerró la
      ventana, así que no corre, pero la llave sigue siendo la misma. Al
      rotarla cambia también la anon key: hay que actualizar `.env.local`, las
      variables de Vercel y volver a desplegar, y rehacer el webhook con la
      key nueva y un `x-ascent-secreto` nuevo.
- [x] Eliminar cuenta y exportar datos implementados y verificados.

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

- El panel de preview corre con `document.hidden = true`: las animaciones de
  three.js no se ven y las capturas no salen. **Los clicks por píxel se
  cuelgan**: para manejar la interfaz desde el panel hay que disparar los
  eventos por DOM (setter nativo del prototipo + `dispatchEvent('input')` para
  los inputs de React). El QA visual lo hace el humano.
- El `launch.json` del directorio de trabajo tiene rutas absolutas por
  proyecto: al mudar una carpeta hay que actualizarlo o el preview no arranca.
