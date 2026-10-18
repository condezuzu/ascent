# La prueba en el gimnasio (16/10/2026)

Dos guiones. El primero es para la app de **telefono** (la build `ff2b55a6`, 1.1.0 (8),
con la OTA del 16/10 a la noche). El segundo es para probar **entrenar con un amigo en
vivo** con la app de la **App Store** en los dos teléfonos.

Cada paso dice qué hacer, qué tiene que pasar y qué hacer si no pasa. Cuando algo falla:
captura de pantalla (botón lateral + subir volumen) y la hora, y después **Diagnóstico**
(el botón de abajo a la derecha, solo en la de telefono) → foto de esa pantalla. Con eso
se encuentra casi todo sin volver a probar.

---

## Antes de salir de casa

1. **Que la OTA esté puesta.** Abrí la app, cerrala del todo (deslizar hacia arriba en el
   selector de apps) y abrila otra vez. La actualización se baja en la primera apertura y
   se aplica en la segunda.
   - **Qué esperar:** en Diagnóstico, «actualización 01a146ca».
   - **Si no:** repetí cerrar y abrir con señal. Si después de dos veces sigue otra,
     anotá lo que dice y mandámelo: el resto de la prueba no sirve con otra versión.
2. **Las Actividades en vivo prendidas.** Ajustes del iPhone → Ascent → Actividades en vivo.
   - **Qué esperar:** el interruptor prendido.
   - **Si no está la opción:** no es esta build; volvé al paso 1.
3. **Salud (pasos).** Ajustes del iPhone → Salud → Acceso a datos → Ascent → Pasos, prendido.
   Sin esto no hay pasos en la tarjeta ni el promedio en Stats.

---

## 1. La tarjeta de la pantalla bloqueada

Con un entrenamiento de verdad. Mirá la pantalla bloqueada (y la isla dinámica) en cada paso.

| # | Qué hacer | Qué se ve | Si no pasa |
|---|---|---|---|
| 1.1 | «Iniciar entrenamiento», sin elegir ejercicio todavía, y bloqueá | «ENTRENANDO» y el reloj de la sesión contando para arriba; sin ejercicio ni «Serie» todavía | Sin tarjeta: Actividades en vivo (paso 2 de arriba) |
| 1.2 | Elegí el ejercicio (ej. Press de banca, ×3) y bloqueá el teléfono | Se suma el nombre del ejercicio y «Serie 0 de 3», con el mismo reloj; abajo «N pasos» | Sin el ejercicio, captura. Con tarjeta pero sin pasos: permiso de Salud |
| 1.3 | Tocá + (serie hecha) y bloqueá | «DESCANSO», el ejercicio, «Serie 1 de 3», la **cuenta regresiva** grande y una barra que se vacía | Si sigue diciendo ENTRENANDO, captura con la hora |
| 1.4 | Esperá a que termine el descanso con el teléfono bloqueado | La cuenta llega a 0:00, la tarjeta dice «LISTO» y cambia de color; suena el aviso de siempre | Si la tarjeta se queda en blanco o desaparece en 0:00: captura (es el error viejo del 25/9) |
| 1.5 | Esperá un minuto y medio más sin tocar nada | Vuelve a «ENTRENANDO», «Serie 1 de 3», con el reloj de la sesión | Solo se actualiza cuando la app vuelve a correr: si sigue en LISTO, abrí la app y volvé a bloquear |
| 1.6 | Con un compañero en el grupo (ver la parte 2) que esté descansando | Abajo a la derecha, su nombre y **su** cuenta regresiva | Sin compañero no sale nada ahí, y está bien |
| 1.7 | Isla dinámica (con la app en segundo plano, no bloqueada) | Un punto y el reloj (descanso o sesión) | Captura de cómo se ve |
| 1.8 | «Terminar» | La tarjeta desaparece | Si queda, anotá cuánto tarda en irse |

**Qué NO se ve, y está bien:** botones en la tarjeta (no tiene), el peso, la lista de
ejercicios, y el compañero cuando no está descansando (solo su nombre si está en el grupo).
Con la app en inglés, la tarjeta sale en inglés (REST / DONE / TRAINING).

---

## 2. El aviso de la vida

Sale solo si **faltaste días y se usó una vida**. Si tu racha está entera, no va a salir:
para verlo sin perder días tuyos, pedime una cuenta de prueba con dos días perdidos.

| # | Qué hacer | Qué esperar | Si no pasa |
|---|---|---|---|
| 2.1 | Abrir la app el día después de faltar | Una ventana: «Faltaste el … Se usó una vida.», y las vidas usadas **se apagan una por una** | Si el cuadro aparece de entrada, sin la animación: captura |
| 2.2 | Esperar un segundo | Entra la semana de ese día (L a D) y debajo un cuadro con una colita que apunta al día que faltaste: «Faltaste aquí. ¿Usar la vida?», chico el precio («Con «No» queda para otra vez y la racha en X días») y **Sí** / **No** | Si la colita apunta a otro día, captura |
| 2.3 | «Sí» | Se cierra; la racha sigue igual | — |
| 2.4 | Cerrar y abrir la app, y también entrenar y terminar | **No vuelve a salir** | Si vuelve, la hora y en qué momento (al abrir o al terminar) |
| 2.5 | (Otra vez, otra vida) «No» | «La vida quedó para después», y la racha queda en el número que decía el precio | Sin señal: «Sin señal no se guardó…» y la racha sigue igual; probá con señal |
| 2.6 | Solo si ese día hay un entrenamiento de fuerza en Salud (Apple Watch u otra app) | Abajo en el cuadro, «Sí fui, corregir día»; al tocarlo, Stats con la hoja de ese día abierta en «Corregir» → «Fui» | Sin entreno de fuerza en Salud no aparece, a propósito |

---

## 3. La ventana al terminar el entrenamiento

Necesita una **rutina guardada** (Stats → Entrenamiento) que tenga algo cargado para hoy, y
**señal** al terminar.

| # | Qué hacer | Qué esperar | Si no pasa |
|---|---|---|---|
| 3.1 | Entrenar **lo mismo** que dice la rutina para hoy (el orden y las series no importan) y «Terminar» | No sale ninguna ventana | Si sale, captura de la rutina de hoy y de lo que entrenaste |
| 3.2 | Otro día: entrenar **otros** ejercicios y «Terminar» | «¿Reemplazar el día de la rutina «Nombre»?» con «Reemplazar» y «Crear una rutina nueva» | Sin señal no sale: es a propósito. Con señal y sin ventana, captura |
| 3.3 | «Reemplazar» | «¿Estás seguro?» con Sí / No | — |
| 3.4 | «No» | No cambia nada | — |
| 3.5 | Repetir y elegir «Sí» | Stats → Entrenamiento: el día de hoy de esa rutina ahora tiene lo que entrenaste | Si no cambió, captura de la rutina |
| 3.6 | Otra vez, elegir «Crear una rutina nueva» | Sin confirmación. Aparece «Entrenamiento N» en Stats → Entrenamiento; la activa sigue siendo la de antes | Si cambió la activa, captura |

---

## 4. Copiar y pegar un día

Stats → Entrenamiento → Tu rutina.

| # | Qué hacer | Qué esperar | Si no pasa |
|---|---|---|---|
| 4.1 | Tocar un día con ejercicios | Se abre y abajo dice «Copiar este día» | — |
| 4.2 | «Copiar este día» | «Copiado. Abre otro día —de esta rutina o de otra— y toca Pegar.» | — |
| 4.3 | Abrir otro día **vacío** | «Pegar el lunes de «Nombre»» | — |
| 4.4 | Tocar «Pegar…» | El día queda con los mismos ejercicios y series | — |
| 4.5 | Pegar en un día que **ya tiene** ejercicios | Pregunta Reemplazar / Agregar al final / Cancelar | — |
| 4.6 | Cambiar de rutina (chips de arriba) y pegar en un día de la otra | Igual que arriba, en la otra rutina | — |
| 4.7 | En el perfil de un amigo → su rutina → abrir un día | «Copiar este día»; después se pega en una tuya | Sus ejercicios propios no se copian, a propósito |

---

## 5. El promedio de pasos

Stats → General, en la parte de pasos. Necesita el permiso de Salud y al menos dos días con pasos.

- **Qué esperar:** «Promedio diario de pasos» y un número grande; abajo «N más que tu meta
  de X» (claro) o «N menos que tu meta de X»; y «Los últimos 7 días, sin contar hoy».
- **Para chequear el número:** en la app Salud, promedio de los 7 días anteriores a hoy (los
  días sin dato no cuentan).
- **Si no aparece:** con menos de dos días de pasos no sale nada, a propósito.

---

## 6. El destello de las medallas

Social, con alguien en el ranking que tenga medallas (o vos).

- **Qué esperar:** una franja de luz cruza **una** medalla por vez, cada 5 a 7 segundos.
  Solo destellan las de la pestaña que se ve.
- **Si tarda mucho más:** contá cuántos segundos pasan entre dos destellos y decímelo. Con
  la app en segundo plano no destella, a propósito.

---

# Con un amigo: entrenar juntos en vivo (los dos con la app de la App Store)

**Antes:** los dos con la app de la App Store actualizada (abrirla dos veces con señal),
amigos aceptados entre sí, y **Ajustes → «Avisar cuando entreno»** prendido en los dos.
Ojo: la de la App Store todavía es la 1.0.0 con la OTA del 16/10 a la mañana; trae
entrenar en grupo, pero **no** los diez cambios del 16/10 a la tarde ni la tarjeta nueva
de la pantalla bloqueada. Y en la 1.0.0 los links abren la página web, no la app.

| # | Quién | Qué hacer | Qué esperar | Si no pasa |
|---|---|---|---|---|
| A1 | B | «Iniciar entrenamiento» | — | — |
| A2 | A | Social | B en «Entrenando ahora», con «Unirse» | Si B no aparece: que B revise «Avisar cuando entreno», y que los dos sean amigos |
| A3 | A | «Unirse» | «Esperando a B» | Si dice «B ya no está entrenando», B tiene que tener el entrenamiento abierto |
| A4 | B | Mirar Inicio | «A quiere unirse a tu entrenamiento», con Aceptar | Hasta 10 s de demora es normal (consulta cada 10 s si el tiempo real no llega) |
| A5 | B | «Aceptar» | Los dos ven a los dos en «Entrenando contigo» (Social) y la tira del grupo arriba en Inicio | Si uno no ve al otro: capturas de los dos Social, con la hora |
| A6 | A | Elegir ejercicio y hacer una serie (+) | B ve el ejercicio de A, «serie 1/3» y la cuenta del descanso de A | Hasta 10 s de demora. Si no cambia nunca, captura |
| A7 | B | Lo mismo | A ve lo de B | Igual que arriba |
| A8 | A | «Invitar al grupo» y mandar el link a una tercera persona amiga | La tercera persona entra al grupo desde la app y aparece en los tres | En la 1.0.0 el link abre la web: seguí los pasos de la página |
| A9 | Quien armó el grupo | «Sacar» a alguien | Esa persona deja de ver el grupo | Solo puede sacar quien armó el grupo |
| A10 | Cualquiera | «Salir del grupo» | Deja de aparecer en los otros | — |
| A11 | Los dos | «Terminar» | Desaparecen de «Entrenando ahora» y del grupo | Si alguien sigue apareciendo más de un minuto, captura |

**Lo que no se ve, y está bien:** dónde está el otro (nunca se muestra la ubicación), su
peso, y las fotos. Alguien que te bloqueó, o a quien bloqueaste, no entra a tu grupo ni lo ves.
