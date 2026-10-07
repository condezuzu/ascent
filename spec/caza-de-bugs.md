# Caza de bugs — antes de la build de tienda (27/9)

Barrido de código (tres pasadas de revisión: errores tragados / doble-tap y
orden / estados raros y ciclo de vida) + los barridos automáticos + revisión a
mano. **Nada arreglado todavía** (pedido: anotar antes de tocar). Split por si va
antes de publicar o a 1.0.1, con el porqué.

Criterio del split: **"antes de publicar" = afecta la app NATIVA que va a Apple**
(o protege la build). **"1.0.1" = web-only, idempotente/ya mitigado, o borde
angosto** que no bloquea el envío.

Un dato estructural que atraviesa todo: **casi todas las guardas contra doble-tap
son de estado** (`disabled={ocupado}` + `setOcupado(true)` antes del `await`), y
eso NO frena un segundo toque que cae antes de que React re-renderice. Las únicas
dos verdaderamente a prueba de doble-fire usan una traba `useRef` síncrona
(`useSesion.serieHecha` y `VigilanteDeGimnasio.vigilar`) — y son, justamente, las
que ya se habían quemado antes. El patrón de arreglo para varias de abajo es el
mismo: traba `useRef` antes del `await`.

---

## ANTES DE PUBLICAR

> **ESTADO (28/9): los cuatro ARREGLADOS y verificados.** Typecheck en el cierre
> (commit `4c3e09c`, 0 errores escondidos en web y móvil). Doble-tap resuelto por
> patrón, no por casos: traba reutilizable `compartido/useEnVuelo.ts` aplicada a
> **todas** las acciones que escriben (marca, día+foto, quitar bloque, peso,
> denunciar/bloquear/desbloquear, amistad pedir/aceptar/rechazar/quitar, cuenta
> baja/salir/clave/guía) + traba síncrona propia en `useSesion.empezar/terminar`.
> Refresco al volver: `AppState 'active' → PESTANA_ACTIVA → cargar()` en
> `Pestanas.tsx`. Verificado de verdad (no solo compila): contra prod una firma
> vencida da 400 y re-firmar da 200; en la app real (react-native-web) volver a
> primer plano re-firma las fotos y recarga los datos de la pestaña activa.
> Cierre verde: tsc, lint, test:db (10/10), barrido ×2 "Ninguno". Commit `fab9c2b`.

### 1. No hay typecheck en el pipeline (meta, alto valor, barato)
`cierre` corre `eslint`, y eslint **no caza errores de tipo ni referencias
indefinidas**. Metro (la build nativa) transpila sin chequear tipos. Resultado:
un error de tipos o un import colgado en `movil/` o `compartido/` **llega a la
build nativa** y explota en runtime. Pasó en vivo en esta misma tanda: al limpiar
los retos quedó un `fechaLinda` sin importar en `src/app/social/page.tsx` y eslint
no lo vio — lo cazó `next build` (web); el mismo error en `movil/` no lo habría
cazado nadie antes de la tienda.
- **Por qué antes de publicar:** es la red que falta debajo de todos los demás
  arreglos; sin ella, cualquier fix puede meter un crash que el cierre no ve.
- **Arreglo:** agregar `tsc --noEmit` (o `tsc -p movil`) al `cierre`, antes de la
  build. Barato.

### 2. Quitar bloque puede borrar el bloque equivocado (A6)
`movil/src/ListaDeBloques.tsx:104` → `useSesion.tocarBloque`. En un entrenamiento
en vivo, doble-tap en "Sí, quitar" borra el bloque `i` y después un vecino,
porque la lista ya se corrió y el índice `i` apunta a otro. La traba síncrona de
`bloquesRef` (que hace seguro el +/−) es lo que hace que el segundo toque actúe
sobre índices corridos.
- **Por qué antes de publicar:** pierde datos reales del entrenamiento, en vivo,
  con una sola mano.
- **Arreglo:** capturar el bloque por `id` antes del `await`, no por índice; o
  traba de doble-tap en el confirm.

### 3. Registrar el día con foto puede subir DOS fotos (A3)
`movil/src/RegistrarDia.tsx:93`. El día se dedupe (unique por día), pero `subir()`
no está guardado: dos toques rápidos suben **dos fotos** al mismo día.
- **Por qué antes de publicar:** duplicado visible en el álbum, en la app nativa.
- **Arreglo:** traba `useRef` en `confirmar` antes del `await`.

### 4. Al volver a la app no se refresca: fotos rotas y racha vieja (H3 #7+#8)
`movil/app/_layout.tsx:198-231` — al volver a foreground solo se corre zona +
refresh de token, nunca un reload de datos. Las pantallas recargan **solo al
cambiar de pestaña** (`irAPestana.ts:45`). Las URL firmadas de fotos viven 1 h
(`createSignedUrl(...,3600)` en `album.ts`, `ranking.ts`, `perfil.ts`, `dia.ts`).
Efecto: dejás la app en Álbum/Inicio una hora, volvés a la MISMA pestaña, y (a)
todas las fotos dan 403 → rotas, (b) la racha/`perdida` quedan viejas hasta que
cambies de pestaña.
- **Por qué antes de publicar:** "dejé la app abierta y volví, las fotos están
  rotas" es un golpe feo y probable en la app nativa.
- **Arreglo:** un hook de `AppState → 'active'` (o `useFocusEffect`) que recorra
  el `cargar()` de la pantalla activa. Un solo lugar arregla las dos cosas.

---

## 1.0.1

### Doble-tap idempotente o ya mitigado
- **A1 · Anotar marca inserta fila duplicada** (`movil/src/CargarMarca.tsx:59`,
  y su gemelo web): `prs` no tiene unique, así que dos toques dejan dos filas
  iguales. **El número NO se corrompe** (`mejores_marcas` toma el máximo, y el max
  de dos iguales es el mismo), solo ensucia el historial y el "Anotaste 2". Barato
  de arreglar (traba ref o unique en `(user_id,ejercicio,fecha,peso)`), pero no
  bloquea.
- **A2 · Empezar sesión** (`useSesion.empezar`): `iniciar_sesion` no es
  idempotente, pero el server devuelve `yaEstaba` y la segunda llamada cae en la
  misma sesión. Mitigado.
- **A5 · Terminar sesión** (`Inicio.tsx`): doble-tap → segundo `terminar_sesion`
  sobre una sesión ya cerrada; el server lo rechaza. Molesto, no rompe.
- **A7 · Denunciar/Bloquear** (`AccionesDeUsuario`): `denunciar` es upsert y
  `bloquear` es on-conflict-do-nothing → idempotentes. Una denuncia doble = una
  fila.
- **A4 · Agregar amigo:** `friendships` tiene índice único (`friendships_par_unico`),
  así que la segunda inserción rebota en la base. Sin duplicado.

### Orden de estado
- **B1 · "Se cerró sola" se puede perder** (`useSesion.ts:352`): `releerCache()`
  (que setea `idVisto.current`) y `confirmar()` (que lo lee) corren sin await
  entre medio; con un storage lento, el aviso "tu sesión se cerró sola" se
  descarta. Arreglo: `await releerCache()` antes de `confirmar()`.
- **B2 · Serie contada localmente pero no sincronizada** (`useSesion.marcar/subir`):
  el conteo usa refs (bien), pero el envío a la base se gatea con `idSesion`
  (estado). Si tocás `+` justo antes del render que setea `idSesion`, cuenta local
  pero no encola el `fijar_series`. Borde muy angosto.

### Errores tragados — web-only (no bloquean la tienda, pero conviene)
- **H1 #1 · Borrar marca (fuerza web)** (`src/app/fuerza/page.tsx:67`): ignora el
  error; si falla, la marca reaparece sin aviso. Una línea (`if (error) ...`).
- **H1 #2 · Sugerencias web** (`src/components/ajustes/Sugerencias.tsx:26`): si el
  insert falla, no pasa nada (ni error ni "enviado"). El móvil SÍ lo maneja — es
  una inconsistencia web. Copiar el manejo del móvil.
- **H1 #3-8** (aceptar/rechazar/agregar amigo sin avisar el fallo, `eliminarAmigo`
  web silencioso, `Fondo`/`MetaDePasos` prefs locales tragadas, `signOut` sin
  chequear): todos self-reconcilian o son preferencias locales. Bajo.

### Estados raros / ciclo de vida
- **H3 #9 · El reloj del teléfono manda el "hoy" del cliente** mientras el server
  cuenta el día por la zona del perfil. Cerca de medianoche o con el reloj
  cambiado, Inicio puede mostrar "Registrar día" para un día ya entrenado y entrar
  en un loop confuso de re-registro. `pantalla_inicio` YA devuelve `hoy` del
  server (`DatosDeInicio.hoy`) pero el cliente no lo usa. Arreglo: usar el `hoy`
  del server para `registradoHoy`/semana/grilla. Borde angosto (reloj mal o
  ventana de medianoche), por eso a 1.0.1.
- **H3 #6 · Datos viejos si la relación cambia mientras mirás** un perfil
  (`PerfilDeAmigo` carga una vez, sin refresh): si te bloquean/eliminan con la
  pantalla abierta, seguís viendo su semana y fotos (~1 h) hasta salir. Cuando
  VOS bloqueás sí hace lo correcto (`router.back()`). Cosmético/menor privacidad.

### Pantallas chicas: entrenando, el `+` queda debajo de la barra (3/10)
**Sin arreglar todavía. Va para la 1.1.**

> **DECISIÓN (3/10): Inicio tiene que ENTRAR en las pantallas chicas, o como
> mínimo el botón `+` tiene que quedar siempre alcanzable sin desplazar.**
>
> **El iOS mínimo NO se sube.** Dejar afuera a usuarios reales para resolver a
> medias un problema de diseño es el intercambio equivocado: saca los teléfonos
> de 320 de ancho, pero no arregla los de 375×667, donde entrenando tampoco
> entra. El problema es del diseño de Inicio y se arregla ahí.

En un iPhone SE de 1ª generación (320×568), con una sesión corriendo, el botón
`+` grande queda entero debajo de la barra de pestañas: **no se puede contar una
serie sin desplazar la pantalla.** No se pierde nada —Inicio se desplaza— pero el
botón más tocado de la app no está a la vista.

> **LOS NÚMEROS DE ABAJO SON APROXIMADOS, NO EXACTOS.** Se midieron en la
> versión web de la app nativa, en un navegador (Chromium) con la ventana del
> tamaño de cada teléfono, y NO en un iPhone. En un teléfono de verdad el alto
> útil es otro: la barra de estado arriba y el indicador de inicio abajo ocupan
> lugar que el navegador no descuenta; la tipografía del sistema no mide lo
> mismo; el texto sigue el tamaño que la persona eligió en iOS; y aparece una
> fila de pasos (Apple Health) que en el navegador no se dibuja. Sirven para
> saber DÓNDE no entra y más o menos por cuánto, no para afinar píxeles.
>
> **No hay forma de verificarlos con lo que tenemos:** hace falta una Mac con el
> simulador de iOS, o el teléfono en la mano. Hasta entonces, orientativos.

Alto útil de la ventana contra alto del contenido de Inicio, en píxeles:

- **320×568 (iPhone SE 1ª gen):** en reposo 491 contra 612 (unos 121 afuera);
  entrenando 491 contra 715 (unos 224 afuera, y ahí queda el `+`).
- **375×667 (SE 2ª y 3ª gen, iPhone 8):** en reposo 590 contra 594 (unos 4
  afuera); entrenando 590 contra 715 (unos 125 afuera).
- **390×844 (iPhone 12 a 15):** en reposo sobran unos 173; entrenando, unos 52.
- **430×932 (Pro Max):** sobran unos 261 y unos 140.

"Entrenando" fue una sesión armada para medir: una serie hecha de tres, dos
bloques cerrados, sin la lista de bloques abierta y sin la pregunta de marca,
que suman alto. O sea que el caso real con más cosas en pantalla es peor.

Lo que SÍ se hizo ese día: Inicio dejó de rebotar cuando el contenido entra
(`alwaysBounceVertical={false}`). No se bloqueó el desplazamiento justamente por
esto: en estas pantallas hace falta.

El dato que se miró antes de decidir, para que no haya que buscarlo de nuevo:
el SE de 1ª gen quedó en iOS 15, que en agosto de 2026 era entre el 0,6 % y el
2 % del uso de iOS según la fuente, y el SE es solo una parte de eso. Aun siendo
poco, no se los deja afuera (ver la decisión de arriba).

### Álbum nativo: al deslizar entre fotos parpadea la anterior (6/10) — ANOTADO, sin tocar

Reporte del iPhone, el día de la aprobación (primera vez que el deslizar del
álbum se prueba en un teléfono de verdad): con una foto abierta, al deslizar a
la izquierda o a la derecha parpadea la foto anterior. Es la misma familia que
el titileo de las pestañas (`Pestanas.tsx`: el rumbo cambiaba al terminar el
viaje y no al soltar, y la vista vieja se dibujaba un cuadro de más). Sin
investigar todavía: mirar en `movil/src/Album.tsx` en qué momento cambia el
índice de la foto respecto de la animación, y si la vecina se monta con la
imagen ya cargada. No bloquea la OTA a `store` (decisión del humano).

**7/10 — PENDIENTE PARA DESPUÉS DEL LANZAMIENTO, a propósito.** Revisado de
nuevo en el iPhone con la última OTA de `telefono`: fue lo único de toda la
lista que no pasó. Son dos cosas en la misma pantalla:
- al deslizar entre fotos **sigue titilando**;
- y la foto **tarda mucho en cargar**.

Se deja así por decisión del humano: el álbum es la parte menos usada de la
app y las dos cosas son cosméticas (no se pierde ni se muestra mal ningún
dato). La web ya no se usa, así que esto es solo de la nativa.

### Confirmado SANO (revisado, sin bug)
Muchos días/cero amigos, amigos/racha 0, racha recién perdida (0 vidas, dias
vacío), foto borrada con el visor abierto (índice clampeado + guarda `!!foto`),
gimnasio en otro país / coords malas (haversine + techo de precisión), y el
PanResponder del álbum (refs refrescadas cada render). El buzón de errores, la
cola offline, y las escrituras encoladas de `useSesion` están bien diseñadas.

---

## Barridos automáticos
- `barrido` (barrido-nativa, recorre todas las pantallas): **sin hallazgos.**
- `test:errores`, `test:series` (carrera de escrituras), `test:zona`: todos en
  verde.
- Condición de parada (barrido 2× seguidas sin hallazgos nuevos): **CUMPLIDA** —
  dos pasadas seguidas, las dos "Ninguno". (El barrido recorre pantallas y caza
  crashes; NO ve los bugs de lógica/doble-tap/ciclo de vida de arriba, que salen
  de la revisión de código.)

---

## Filas en `errores_js` que NO son bugs (3/10)

**Cualquier fila con `plataforma = 'web'` sale de una prueba, nunca de un
usuario.** Al buzón solo escribe la app nativa (`movil/src/reporteDeErrores.ts`,
con `Platform.OS`), y `web` es la nativa corriendo en un navegador: el barrido,
las sondas, una filmación. Los usuarios de verdad llegan como `ios`.

Las del **3/10/2026, entre las 16:49 y las 16:56 de Uruguay** (19:49–19:56 UTC),
las dejó una filmación de prueba de la luz de la barra de pestañas:

- **Motivo:** el navegador de la filmación corría con WebGL apagado a propósito
  (`--disable-3d-apis`), el motor no tuvo dónde dibujar, la app mostró "Algo
  falló" y avisó como avisa siempre. En el teléfono el motor siempre tiene
  contexto: no es un bug de la app.
- **Cuenta:** `prueba_uno` (la de `test:conexion`), cuando la corrida llegó a
  entrar. La fila no la nombra: el buzón es anónimo y solo guarda un
  `id_anonimo` al azar por navegador.
- **Cuántas:** cuatro corridas sin tapar el aviso, así que cuatro filas o alguna
  más. Desde el cliente no se pueden leer (solo `insert`): el número lo dice la
  consulta.

Se miran y se borran en el SQL Editor (lo corre el humano):

```sql
select id, creado, pantalla, left(mensaje, 80) as mensaje
  from public.errores_js
 where plataforma = 'web'
   and creado >= '2026-10-03 19:45:00+00'
   and creado <  '2026-10-03 20:15:00+00'
 order by creado;

delete from public.errores_js
 where plataforma = 'web'
   and creado >= '2026-10-03 19:45:00+00'
   and creado <  '2026-10-03 20:15:00+00';
```

La ventana cubre toda la media hora de filmación, no solo las cuatro corridas,
por si alguna otra avisó algo. Con `plataforma = 'web'` no puede entrar la fila
de un usuario.
