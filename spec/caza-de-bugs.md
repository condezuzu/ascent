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
