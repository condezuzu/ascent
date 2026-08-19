# Trampas

Bugs que ya nos costaron una vez. Cada uno arrancó pareciendo otra cosa.

Leer antes de tocar el área correspondiente. Una línea por trampa: qué pasó y
qué regla queda.

---

## Motor (three.js)

**`sizeAttenuation: false` mide en píxeles físicos, no en unidades del mundo.**
Las partículas salían del tamaño correcto en una pantalla y diminutas en otra,
según el `devicePixelRatio` del teléfono.
→ **Regla:** con `sizeAttenuation: false`, escalar el `size` por el DPR
(`Math.min(devicePixelRatio, 2)`). Ver `src/motor/subida.ts`.

**El quad del shader tiene que ser `PlaneGeometry(2, 2)`, siempre.**
Se le cambió el tamaño a la geometría para achicar el cuerpo y el disco dejó
de entrar: se veía el cuadrado recortando al planeta. `vP` tiene que ir de −1
a 1 para que el shader dibuje el disco completo.
→ **Regla:** la geometría nunca cambia; el tamaño en pantalla lo da
`mesh.scale`. Ver `src/motor/shaders.ts`.

---

## Supabase Storage

**`remove()` devuelve éxito con cero archivos borrados si falta la política de
`delete`.** Con RLS activa, "no hay política" es "prohibido", pero la API no
da error. Una baja de cuenta borró todo menos el avatar, que quedó huérfano en
un bucket público y descargable por cualquiera con la URL.
→ **Regla:** nunca alcanza con mirar `error`; hay que **contar los archivos
que volvieron borrados** y abortar si no coinciden.

**La lectura de un bucket público NO pasa por la RLS.** Bajar por
`/storage/v1/object/public/...` no consulta las políticas, así que una política
de `select` amplia no es lo que hace que las imágenes se vean — solo habilita
*listar* el bucket, que es justo lo que no querés.
→ **Regla:** acotar el `select` a la carpeta propia. Las imágenes se siguen
viendo. Verificarlo con un cliente anónimo antes de asumirlo.

**Las políticas de `storage.objects` se evalúan TODAS en cada consulta**, sin
importar el bucket. Si una falla, tumba la consulta entera — un bucket puede
quedar "protegido" por un error ajeno en vez de por su propia política.
→ **Regla:** no apoyarse en eso. Cada bucket se protege solo.

---

## Racha y fechas

**Los descansos no pueden aplicarse para atrás.** Con una sola columna de días
de descanso que se pisa, cambiar de rutina en marzo recalculaba enero y hacía
perder rachas ya ganadas.
→ **Regla:** configuraciones **fechadas**. Cada cambio guarda desde cuándo
rige y el cálculo de cada día usa la que estaba vigente **ese** día. El pasado
no se reescribe nunca.

**`mejor_racha` como contador que solo sube es un dato falso para siempre.**
Si alguien registra días por error y los borra, el récord tiene que bajar.
→ **Regla:** el máximo **sale del historial** (`mejor_racha_real`), no se
acumula.

**El servidor está en UTC y el usuario en UTC−3**, así que a las 21:00 de
Uruguay el día del servidor ya cambiaba. El primer arreglo fue peor que el
problema: la fecha pasó a mandarla **el cliente**, acotada a ±1 día, y eso
dejó una ventana de tres días para elegir. Adelantar la hora del teléfono,
registrar "mañana", volverla atrás y registrar "hoy" daba **dos días de racha
en un día real**, repetible.
→ **Regla:** el día lo decide el **servidor**, con la **zona** del usuario
(`mi_hoy()`). El cliente manda la zona, nunca la fecha, y esa es toda la
diferencia: una zona se verifica contra `pg_timezone_names`, una fecha es un
número que el cliente inventa.

**Los `p_hoy` que quedan en las firmas se ignoran en silencio, y un parámetro
que se ignora miente.** Están solo para que un cliente viejo no rompa mientras
Vercel despliega, porque el deploy y la migración no ocurren en el mismo
instante.
→ **Se borran en el primer deploy posterior al 20/8/2026**, cuando ya no pueda
quedar ningún cliente de antes de la migración 12 dando vueltas. Son cuatro:
`verificar_perdida`, `recalcular_desde_cero`, `cerrar_retos_vencidos` y
`fijar_descansos`, más `p_fecha` en `registrar_dia` y `anotar_peso`. En el
código están marcados con `TODO(quitar p_hoy)`.

**Cambiar la zona tampoco regala días.** Registrás, movés la zona adelante,
"hoy" pasa a ser mañana, registrás de nuevo.
→ **Regla:** entre dos días tienen que pasar 20 horas de reloj real **si la
zona cambió** desde el último día registrado. Condicionado al cambio y no a
secas, porque entrenar un lunes a las 23:00 y el martes a las 07:00 son ocho
horas y dos días de verdad: la guarda incondicional rechazaba el segundo.

---

## Fuerza

**Epley con UNA repetición devuelve un 3% de más.** `peso × (1 + reps/30)` da
`peso × 31/30` cuando reps = 1, así que el mismo levantamiento daba distinto
según si se cargaba como "1RM real" o como "estimado de 1 repetición".
→ **Regla:** el caso de una repetición se saca a mano y devuelve el peso tal
cual. No hay nada que extrapolar. Ver `un_rm()` en `schema.sql`.

**Los coeficientes del DOTS no se tipean de memoria.** Un dígito cambiado
ordena mal el ranking y nadie lo nota, porque el número igual parece
razonable.
→ **Regla:** salen de la fuente (OpenPowerlifting) y se verifican contra un
caso publicado en `test:db` — hombre de 90 kg con 650 kg de total da 420,29.
Y el peso corporal se **acota** al rango calibrado, nunca se extrapola.

---

## Tiempo

**Una PWA suspende `setInterval` cuando la pantalla se apaga o la app pasa a
segundo plano.** Un cronómetro que acumula ticks se congela ahí: una sesión de
una hora marca veinte minutos, y el usuario no tiene forma de saber cuál de
los dos números es el bueno.
→ **Regla:** no se cuentan ticks. Se guarda el **timestamp de inicio** y en
cada pintada se calcula `transcurrido = ahora - inicio`. El `setInterval`
existe para repintar, no para contar. La duración que se GUARDA la calcula el
servidor, que es el único reloj confiable. Ver `cronometro.md` §17.5.

---

## Cosas que creemos y no probamos

**El truco de vibración en iPhone: INFORMACIÓN SIN VERIFICAR.** Circula que
`<input type="checkbox" switch>` (Safari 17.4) dispara el motor háptico si se
lo toca por JavaScript, y que **Apple lo tapó en iOS 26.5**. Las dos mitades
salen de **una sola fuente** y **nadie lo probó en un iPhone de verdad**.
→ **Regla:** tratarlo como rumor, no como dato. Sirve para no perder una tarde
redescubriéndolo; no sirve para decidir nada. Si alguna vez el aviso de
descanso depende de esto, se prueba en un teléfono **antes**. La vibración en
iPhone se da por imposible en web hasta que alguien la vea funcionar.

---

## Lo escrito dos veces

**Hay reglas que corren en SQL y en el cliente a la vez**, porque la pantalla
no puede pedir un viaje de red por tecla: el 1RM, el número de rango, los
nombres de los planetas y qué descansos rigen en una fecha. Nada avisa cuando
una de las dos copias se toca sola.
→ **Regla:** todas viven en `src/lib/reglas.ts`, que **no importa nada** para
que Node pueda cargarlo, y la sección 26 de `test:db` corre las dos contra los
mismos valores. Si le agregás un import a ese archivo, el test deja de poder
cargarlo y la red se cae sin hacer ruido.

---

## Build y entorno

**Las `NEXT_PUBLIC_*` se incrustan al COMPILAR.** Cambiarlas en Vercel no
cambia nada hasta que se vuelve a desplegar, y todo lo que llevan viaja al
navegador.
→ **Regla:** ahí nunca va un secreto, y después de tocarlas hay que
redesplegar. Ver `src/lib/supabase/client.ts`.

**OneDrive corrompe la caché de `.next`.** Sincroniza los miles de temporales
que Next escribe mientras los escribe: `Cannot find module './543.js'`,
`EINVAL readlink`. Se arreglaba borrando `.next` y volvía a pasar.
→ **Regla:** el proyecto vive fuera de OneDrive (`C:\Users\agusc\ascent`). Si
esos errores reaparecen ahí, es otra cosa.

**`npm run build` con el dev server prendido corrompe `.next`.** Comparten
carpeta.
→ **Regla:** apagar el dev server antes de buildear. Siempre.
