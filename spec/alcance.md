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
| W3 | Decidir: ¿entra "Hiciste 102 en banca, ¿lo guardo como marca?"? | Está en la spec (§1.4) y nunca se hizo. Si no se decide ahora, se cae. |
| W4 | Decidir: ¿entra el login con Google? | Hoy está apagado a mano (`GOOGLE_LISTO`). Si no entra, se borra el código. |
| W5 | Sacar la sección Diagnóstico de Ajustes | Es un banco de trabajo, no una pantalla. Se va cuando el automático por ubicación esté probado. |
| W6 | Poner al día `spec/estado.md` | Tiene corte al 21 de agosto. |

### Lo que hace el humano (no es código)

| # | Qué |
|---|-----|
| H1 | Variables de Web Push en Vercel (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) y redeploy. Sin esto el aviso de las 20:30 no sale. |
| H2 | Probar el recorrido nuevo (Ajustes → "Ver la guía de nuevo") y el volumen nuevo. |

---

## Lista 2 · Para llegar a la tanda 3 (usar la app nativa en el gimnasio)

La tanda 3 es la **build de desarrollo instalada en el teléfono**. Lo mínimo
para dejar la web en el gimnasio es el bucle de una sesión: iniciar, contar
series, descansar, terminar — con y sin señal.

| # | Qué | Tandas |
|---|-----|--------|
| N1 | Sesión nativa: iniciar, cronómetro, terminar, cierre por inactividad | 1 |
| N2 | El bloque: selector de 100 ejercicios, meta, `+`/`−`, lista para corregir, peso con su etiqueta y la pregunta | 1 |
| N3 | Descanso con notificación local (suena con la pantalla bloqueada) y la cola sin señal | 1 |
| N4 | Build de desarrollo con EAS e instalarla en el iPhone | 1 |
| H3 | **Humano:** cuenta de Expo (gratis) y Apple Developer Program (99 USD/año) | — |
| H4 | **Humano:** `ascent://confirmar` en Supabase → Authentication → Redirect URLs | — |

**Cuatro tandas** con este orden.

Lo que estaba en el orden anterior —calendario con el resumen del día, peso,
fuerza, foto al registrar— **no hace falta para entrenar**: se sigue mirando en
la web mientras tanto. Si va antes, suma unas tres tandas a la llegada.

### Primero después de la tanda 3 (ya decidido, no es alcance nuevo)

- Botón de volumen suma una serie (§13f).
- Live Activity del descanso en la pantalla bloqueada (§13d).
- Registro automático al llegar al gimnasio con geofencing (§13).
- Calendario, peso, fuerza y foto en nativo.

---

## Después (lo que aparezca, anotado y sin tocar)

*(vacío)*
