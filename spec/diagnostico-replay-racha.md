# Por qué el replay se comió tres huecos (39 → 69)

Diagnóstico del 27/9. **No se aplicó nada.** El replay (migración 53 vieja, la de
la racha) sigue revertido; esto explica la causa para poder rehacerlo bien en
1.0.1. (La migración 53 que SÍ existe ahora es otra: denunciar/bloquear.)

---

## ✅ DECISIÓN TOMADA (27/9) — no volver a discutir

**El castigo queda.** Si faltaste y se te cobraron los −10, tapar ese día después
—con una vida, corrigiendo el calendario, lo que sea— **no te los devuelve**. La
racha del humano es 39, y 39 es la correcta. El replay que daba 69 estaba
aplicando otra regla (perdonar el castigo si el día deja de ser hueco), y esa
regla NO es la que queremos.

**Para 1.0.1, cómo se hace bien:** guardar las pérdidas como **eventos con
fecha** (una tabla de −10 ya cobrados) y que la racha reste esos eventos
registrados, en vez de re-detectar huecos desde los datos de hoy. Así se
conserva lo bueno del replay —racha en vivo, sin depender de cuándo abriste la
app— SIN descongelar un castigo que ya ocurrió. Con el dry-run del guard sobre el
historial real (no un caso inventado) antes de aplicar.

Lo que sigue es el diagnóstico que llevó a esta decisión.

## La respuesta en una frase

El modelo viejo **congela** cada castigo de −10 (lo guarda en `racha_base` +
`perdida_fecha` y no lo vuelve a mirar). El replay **recalcula desde cero** a
partir de los datos finales. Entonces, cualquier día que fue hueco **cuando se
cobró el −10** pero que **después dejó de ser hueco** (lo tapó una vida, se
rellenó el log, o se reclasificó), el replay lo ve entrenado/cubierto y **perdona
el −10**. Tres días así = 30 de más. No es un error de cuenta: es **otra regla**.

## El detalle, en el código

- **Modelo viejo** (`calcular_racha`, `schema.sql:798`): al contar hacia atrás
  **frena en `perdida_fecha`** (`if tope is not null and d <= tope then exit`).
  Los días hasta la última pérdida "ya viven en `racha_base`". O sea: una vez que
  `verificar_perdida` cobró un −10, ese castigo es **permanente**; corregir un día
  anterior a `perdida_fecha` no lo devuelve.
- **Replay** (`racha_replay`, migración 53): camina desde el primer log hasta hoy
  y decide hueco/no-hueco **solo con los datos finales** (logs, `vidas_usadas`,
  `descansos_vigentes`). No conoce `perdida_fecha` ni `racha_base` — de hecho la
  migración los declara "columnas muertas". Así que un día que hoy figura como
  vida o entrenado **nunca** es hueco para el replay, aunque en su momento se haya
  cobrado.

## La prueba (PGlite, funciones reales de `schema.sql`)

Reproducción con el modelo viejo cargado + `racha_replay` idéntica a la migración:

| Escenario | Modelo viejo | Replay | Dif |
|---|---|---|---|
| **Hueco tapado por vidas después del castigo** | 10 | 20 | **+10** |
| **Día del hueco rellenado a mano después del castigo** | 10 | 25 | +15 |
| **Hueco real, nunca tapado (control)** | 10 | 10 | 0 |

- El **+10 limpio** del primer caso es exactamente tu patrón: 3 días así → **+30**
  (39 → 69). Sin sumar días nuevos, solo perdonando tres −10.
- El **control** confirma que el replay NO está roto en general: coincide con el
  viejo siempre que ningún día castigado se reclasifique después.

## Qué te pasó a vos (lo más probable)

Tres días que en su momento fueron falta y se cobraron −10, y que hoy figuran
como **vida** o **descanso** (o quedaron rellenados). Para verlos uno por uno,
corré `supabase/diagnostico-racha.sql` logueado como vos: lista el timeline día
por día y marca cada `>>> HUECO <<<`. Los tres culpables van a aparecer como
`vida` o `descanso (config)` en un día que vos recordás como falta.

> Ojo con un matiz que también mostró la prueba: el replay es **ansioso**. Castiga
> un hueco de cola apenas existe, sin esperar a que abras la app (el modelo viejo
> espera a `verificar_perdida`). Eso NO es el bug de los −30 —después de abrir la
> app los dos números se reconcilian— y de hecho era el objetivo del replay: la
> racha en vivo. El bug es solo el perdón de castigos ya cobrados.

## La decisión de fondo (para 1.0.1)

No es "arreglar la cuenta", es **elegir la regla**:

> Si te castigaron por una falta y después ese día se tapó (vida) o se corrigió,
> ¿el castigo se perdona o queda para siempre?

- **Modelo viejo:** queda para siempre (los −10 son permanentes). Da 39.
- **Replay:** se perdona (la racha es función del estado final). Da 69.

Vos querés 39, así que la regla es "los castigos son permanentes". El replay, tal
como está, cambia esa regla en silencio. Cualquier reescritura tiene que
**respetarla**.

### Cómo tener la racha en vivo SIN cambiar la regla

El valor del replay era refrescar la racha al toque y en el ranking sin depender
de cuándo abrió la app cada uno. Se puede conservar eso sin perdonar castigos:

- **Guardar los castigos como hechos, no derivarlos del estado final.** Una tabla
  de eventos de pérdida (fecha del −10). El "replay" resta esos eventos
  registrados en vez de re-detectar huecos desde los datos de hoy. Así, tapar un
  día después no borra un castigo que ya ocurrió, y sigue siendo una función pura
  y en vivo.
- **O** dejar `racha_base`/`perdida_fecha` como **piso**: el replay puede subir la
  racha en vivo, pero nunca por encima de lo que el modelo viejo ya fijó tras una
  pérdida (no puede "descongelar" un castigo).

En cualquier caso: **dry-run adentro del SQL** (el guard que ya tiene la migración
53) comparando contra el modelo viejo para TODAS las cuentas, y no aplicar hasta
que dé cero diferencias sobre el historial real —no sobre un caso inventado—.
