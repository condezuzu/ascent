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
- Español rioplatense, en el código y en la interfaz.
- Cuando toques un archivo, comentá **solo** las líneas que tienen una razón
  no obvia detrás. No comentar todo el código de una.

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
| `npm run test:db` | schema contra PGlite, sin red |
| `npm run test:conexion` | humo contra el Supabase real, solo lectura |
| `npm run test:e2e` | flujo completo con 2 cuentas (pide `E2E_EMAIL`) |
| `npm run build` | build de producción — **dev server apagado** |

Rutas de QA: `/galeria` (motor) y `/tipografias` (comparador de fuentes).

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
| [spec/etapa-nativa.md](spec/etapa-nativa.md) | §13 ubicación y push · §13b avisos de descanso | documentado, sin implementar |

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
