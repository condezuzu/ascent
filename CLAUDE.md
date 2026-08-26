# Ascent

PWA de racha de gimnasio con features sociales. Next.js + Supabase + three.js.

**Este archivo es lo único que se lee siempre.** Leé de `spec/` solo el
archivo del tema que vas a tocar. Lo que está en la spec ya está decidido y no
se rediscute; lo marcado PENDIENTE se pregunta antes de asumir.

## Reglas de trabajo

- Verificá con `npx tsc --noEmit`, `npm run test:db` y `npm run test:conexion`
  antes de dar algo por terminado.
- **Nunca `npm run build` con el dev server prendido**: comparten `.next` y se
  corrompe.
- Las migraciones SQL **las aplica el humano** en el SQL Editor de Supabase.
  Desde acá solo hay anon key. Flujo: escribir la migración → probarla con
  `test:db` contra PGlite → avisar.
- **Migración con orden invertido** (primero desplegar, después migrar): el
  deploy se comprueba con `npm run verificar:deploy`, que mira el cuerpo del
  pedido real. **Deducirlo no sirve** — el hash de los chunks cambia por el
  entorno y los marcadores obvios dan igual antes y después.
- Español rioplatense, en el código y en la interfaz.
- **Nada del navegador fuera de `src/plataforma/`.** Ni `localStorage`, ni
  `navigator`, ni nada que Expo no tenga: va detrás de un puerto, con la
  implementación web haciendo lo que puede. La sección 35 de `test:db` falla si
  alguien lo llama directo. Ver `spec/etapa-nativa.md` §13z.
- Cuando toques un archivo, comentá **solo** las líneas que tienen una razón
  no obvia detrás. No comentar todo el código de una.
- **Al terminar cada tanda, corré `npm run capturas`** y decí si cambió algo
  respecto de la corrida anterior. Es lo que hubiera cazado "TATS" el primer
  día.

### Tests: verificar la cosa, no un proxy de la cosa

- **Un test tiene que verificar por el mismo camino que recorre el usuario, no
  por un atajo.** Las cuatro falsas señales que llevamos tienen todas la misma
  forma —verificaban algo *parecido* a lo que importaba—:
  - `inputValue()` lee el **DOM**, no el estado de React. El login pasaba en
    verde con el estado vacío y el submit salía sin correo.
  - Montevideo → Tokio son doce horas y media jornada caen en el **mismo día**:
    la guarda que se probaba no tenía nada que bloquear.
  - El test del día pendiente envejecía los **logs** pero no el **pendiente**,
    así que no tocaba nunca el caso.
  - Los estándares se probaban llamando a la función con `'M'`, que es lo que
    el archivo tenía escrito, en vez de con lo que la **base** guarda.
- **Un test para algo que ya funciona hay que romperlo una vez.** Escribís el
  test, rompés el código a propósito, confirmás que falla, y recién ahí lo
  arreglás. Si pasa en verde con el código roto, no está probando nada.
- **Un literal del cliente que tiene que coincidir con un valor de la base sale
  de `src/lib/tipos.ts`** y lo pinea la sección 33 de `test:db`, que le
  *pregunta* a Postgres qué acepta cada `check`. Nunca repetir el valor a mano
  en un test: eso comprueba que el archivo coincide consigo mismo.

### Ahorrar tokens donde NO cuesta información

Esa es la regla entera. Un informe corto que obliga a preguntar de nuevo sale
más caro que el informe largo.

**Sí recortar:** comentarios sobreescritos —solo el porqué no obvio, nunca un
párrafo donde alcanza una línea—; repetir en el informe lo que ya está en
`spec/` o `trampas.md`; volcar archivos al chat cuando alcanza la ruta; tablas
de tests cuando pasan todos (el total alcanza); insistir con una herramienta
que falla — **dos veces y preguntar**.

**No recortar:** qué hiciste y por qué; los hallazgos, los bugs y las
decisiones tomadas por cuenta propia; avisar cuando algo hace ruido o no estás
seguro.

## Dónde

| | |
|---|---|
| Código | `C:\Users\agusc\ascent` (fuera de OneDrive) |
| Repo | https://github.com/condezuzu/ascent (`main`) |
| Producción | https://ascent-blush-seven.vercel.app |
| Supabase | proyecto `okeanaihymbvbdmrdqph` |
| Dev server | puerto 3020 |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | dev server, puerto 3020 |
| `npx tsc --noEmit` | tipos |
| `npm run test:db` | schema contra PGlite + deriva entre schema.sql y las migraciones |
| `npm run test:conexion` | humo contra el Supabase real, solo lectura |
| `npm run test:e2e` | flujo completo con 2 cuentas (pide `E2E_EMAIL`) |
| `npm run capturas` | levanta la app, recorre las pantallas y deja PNG en `capturas/` |
| `npm run verificar:deploy` | ¿producción ya sirve este commit? Mira el pedido real, no deduce |
| `npm run build` | build de producción — **dev server apagado** |

Rutas de QA: `/galeria` (motor) y `/tipografias` (comparador de fuentes).

La primera vez, en cada máquina: `npx playwright install chromium` (el binario
del navegador no vive en el repo, solo la dependencia).

**El QA visual se hace con `npm run capturas`**, no con el panel de preview del
entorno, que se cuelga. Saca las pantallas en móvil y escritorio, avisa de
errores de consola y de contenido cortado por cualquiera de los dos lados, y
usa su propio puerto y su propia carpeta de build, así que se puede correr con
el dev server prendido. **Mirá las capturas antes de dar por terminado un
cambio visual**: las dos primeras corridas encontraron dos bugs que llevaban
tandas sin que nadie los viera.

## La spec, por tema

| Archivo | Qué hay | Cuándo leerlo |
|---|---|---|
| [spec/estado.md](spec/estado.md) | qué está hecho, qué falta, problemas conocidos, cuentas de prueba | **al empezar cualquier sesión** |
| [spec/trampas.md](spec/trampas.md) | bugs que ya nos costaron una vez, y la regla que quedó | **antes de tocar motor, storage, racha o build** |
| [spec/producto.md](spec/producto.md) | §1 qué es · §2 stack · §14 orden de construcción · §15 beta | contexto general |
| [spec/modelo-de-datos.md](spec/modelo-de-datos.md) | §3 tablas · §12 pérdida de racha · §12c la válvula de escape | tocás la base o la lógica de racha |
| [spec/seguridad.md](spec/seguridad.md) | §4 RLS · §5 auth · §5b storage | tocás permisos, login o archivos |
| [spec/motor-visual.md](spec/motor-visual.md) | §6 rangos · §7 reglas visuales · §8 motor de planetas | tocás el render o el diseño |
| [spec/pantallas.md](spec/pantallas.md) | §9 pantallas · §10 onboarding · §11 estados vacíos | tocás una pantalla |
| [spec/fuerza.md](spec/fuerza.md) | §16 módulo de fuerza (PRs, DOTS, ranking) | implementado y verificado |
| [spec/cronometro.md](spec/cronometro.md) | §17 cronómetro de sesión · §18 descanso entre series | implementado |
| [spec/estetica.md](spec/estetica.md) | §19 vuelta estética · §20 el cronómetro en Inicio | **propuesta, sin implementar** |
| [spec/etapa-nativa.md](spec/etapa-nativa.md) | §13z los huecos de `src/plataforma/` · §13 ubicación · §13b avisos | **antes de tocar algo del navegador** |

Los números de sección (§3, §7…) siguen siendo los de siempre: los comentarios
del código que los citan siguen valiendo.

## Las tres reglas que más se olvidan

1. **El nombre del rango no aparece en la interfaz.** Nunca, salvo al subir de
   rango y en Stats. El rango se ve, no se lee. El onboarding tampoco lo
   nombra: descubrir en qué te convertís es la recompensa.
2. **Cada rango tiñe TODA la app**, no solo el fondo. Un solo set de variables
   CSS que se reasigna; ningún color suelto en un componente.
3. **El pasado no se reescribe.** Los descansos son configuraciones fechadas y
   perder la racha resta 10, nunca vuelve a cero.
