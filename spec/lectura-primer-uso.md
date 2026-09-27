# Lectura de primer uso y estados vacíos (27/9)

Recorrido con ojo de producto por el navegador (:3020, ancho de teléfono), con
una cuenta recién creada y borrada al final por el botón de la propia app (no
quedó huérfana). Lo bueno primero, después lo flojo.

## Lo que está bien (dejarlo)

- **Login / alta:** centrado, con la nebulosa detrás; buena primera impresión.
- **Elegir nombre:** limpio, con la microcopy justa ("Así te van a encontrar tus
  amigos").
- **Estados vacíos REALES (después del recorrido): todos buenos.**
  - *Inicio:* racha **0**, semana en blanco, "Marca tu gimnasio…", botón grande
    **"Registra tu primer día"** + "Anotar peso". Claro qué hacer.
  - *Stats:* esqueleto completo con ceros, explicación de las vidas, grilla "EL
    AÑO", PESO con su nota, FUERZA. No es un vacío, es una promesa de lo que se
    llena.
  - *Álbum:* "Ninguna foto todavía. Al registrar un día puedes sumar una…".
  - *Ranking:* "Tu cielo todavía está vacío. Busca a alguien más abajo…" + buscar.
- **Borrar la cuenta:** flujo excelente (escribir el usuario, "no se recupera",
  funciona de punta a punta). Y **Exportar mis datos** suma confianza.

## Lo flojo (por impacto)

### 1. El recorrido abre con una PANTALLA DE FRACASO (lo más flojo)
El paso 2/5, la primera vez que ves tu pantalla principal, muestra un demo con:
**"La racha sigue — Faltaste 2 días. Se usaron 2 vidas. No te queda ninguna."**
y el planeta desarmándose en partículas. Es contenido guionado (la cuenta real
tiene racha 0), pero el primer minuto de un usuario nuevo su racha se presenta
**perdiéndose**. Da para pensar "¿ya perdí?". Lo que engancha —la racha subiendo,
el planeta— queda tapado por el castigo.
> **Sugerencia:** que el demo del paso de Inicio muestre una racha SANA subiendo
> (un número alto, vidas intactas), o el día uno naciendo. Mostrar el perdón de
> las vidas está bien, pero no como primera imagen de tu propia racha.

### 2. Parpadeo negro entre pasos del recorrido
Cada paso navega a una pestaña y se ve un instante (~1 s en web) de pantalla
**sin pintar** antes de que aparezca el contenido. Por eso Stats parecía vacío
durante el tour cuando en realidad tiene un buen estado vacío. Se siente tosco
justo en el momento que tiene que sentirse pulido.
> **Sugerencia:** precargar/mantener el contenido de la pestaña destino, o una
> transición que no muestre el fondo pelado. Confirmar en el teléfono si el
> parpadeo es tan largo como en web.

### 3. El recorrido empieza en Ajustes
El paso 1/5 te deja en **Ajustes** hablando de marcar el gimnasio —una función
que en web ni siquiera corre ("por ahora hay que abrir la app")—. Abrir el
onboarding en la pantalla de configuración, y no en la racha/el planeta, es un
arranque frío.
> **Sugerencia:** abrir en Inicio (el corazón del producto) y dejar lo del
> gimnasio para más adelante en el tour.

### 4. Menor: el alta no dice qué es Ascent
La pantalla de "Crear cuenta" es idéntica al login (solo cambia el botón). Un
visitante frío no lee ni una línea de para qué sirve. Prioridad baja: casi todos
llegan ya convencidos por el demo/outreach.

## Resumen
Los estados vacíos están muy bien; el problema no es el "cuando no hay datos",
es el **recorrido**: arranca frío (Ajustes), parpadea entre pasos, y presenta la
racha por primera vez como una derrota. Cambiar el demo del paso de Inicio a algo
positivo es el arreglo de mayor impacto y menor costo.
