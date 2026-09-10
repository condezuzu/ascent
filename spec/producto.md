# Producto

Qué es Ascent, con qué está hecho, en qué orden se construye y qué significa la beta.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.
Lo que está acá ya está decidido y no se rediscute salvo que se indique.

---

## 1. Qué es

App de seguimiento de racha de gimnasio con features sociales.
Reconstrucción desde cero de un proyecto anterior ("La Forja"), con una estética
completamente distinta. El proyecto anterior no se toca: repo nuevo, base nueva.

---

## 2. Stack

- Next.js (App Router) + TypeScript
- Vercel para deploy, conectado desde el día uno
- Supabase: base de datos, auth y storage de fotos
- PWA instalable (manifest + service worker). No va a las tiendas.
- three.js para el render de los objetos de rango

---

## 13. Las vidas — implementado (migración 32)

Aprobado el 2026-09-09 e implementado el mismo día.

**Tres por mes. Si faltás un día, se usa una y la racha no se corta.**

### Las tres reglas que la definen

1. **Se aplican solas.** No hay botón. Si hay que acordarse de usarlas, te
   olvidás justo el día que la necesitabas — y una red de seguridad que exige
   acordarse no es una red de seguridad.
2. **No se acumulan.** Tres por mes, y las que no usaste no viajan al mes que
   viene. Acumular las convierte en una cuenta de ahorro, y una cuenta de
   ahorro invita a planificar ausencias: "tengo nueve, me tomo la semana". Al
   año alguien tendría treinta y seis y la racha dejaría de significar algo.
3. **Una vida cubre un día.** Si faltás cuatro y tenés tres, se gastan las
   tres y el cuarto corta la racha.

### Las preguntas que se hicieron, y su respuesta

**¿Qué pasa si falto cuatro días?** Se gastan las tres y la racha se corta
igual. **Y las tres gastadas no se devuelven**: devolverlas premiaría la falta
larga — el que faltó seis días terminaría el mes con más vidas que el que
faltó dos.

**¿Da lo mismo abrir la app cada día que volver el quinto?** Sí, y es una
propiedad que se prueba: la cobertura se evalúa hacia atrás desde ayer, día
por día, así que el resultado no depende de cuándo miraste.

**El mes que se recargan, ¿los días viejos siguen cubiertos?** Sí, y no es una
regla aparte: sale del modelo. Lo que se guarda no es un contador sino **qué
día quedó cubierto**, y ese día queda cubierto para siempre. Si faltaste el 30
y el 31 de agosto y el 1 de septiembre se recargan, esos dos días siguen
cubiertos; lo que se recarga es cuántas podés gastar de acá en adelante.

**¿De qué mes sale una vida?** Del mes **del día que cubre**, no del día en que
la app se dio cuenta. Faltar el 30 y 31 de agosto gasta dos vidas de agosto
aunque abras la app en septiembre. Si no, una ausencia a fin de mes se comería
la cuota del mes siguiente sin que nadie lo pidiera.

**¿Un día de descanso gasta vida?** No. Un día de descanso no es una falta;
las vidas son para lo que no estaba planeado.

### Lo que el usuario ve

- **Un día cubierto NO se dibuja como entrenado.** En la tira semanal es un
  tercer estado —ni lleno ni vacío—: un día que no fue pero que no cortó nada.
  Si se dibujara como entrenado, la racha diría la verdad y el calendario
  mentiría, y el calendario es el historial.
- **La racha no sube ese día.** No entrenaste: no se rompe, pero tampoco crece.
- **Al abrir la app al día siguiente**, un aviso corto con la animación del
  punto que se apaga: "Faltaste el jueves. Se usó una vida. Te quedan 2 este
  mes." Dice el hecho y nada más — no felicita ("¡tu racha está a salvo!") ni
  reta. La app no opina sobre el día que alguien no fue al gimnasio.
- **Las que quedan se ven ANTES de gastarlas**, en Stats, en tres puntos
  discretos. Enterarse recién cuando ya se usó una no sirve para decidir. Pero
  **no un contador grande**: eso las convertiría en un recurso que se
  administra —"me quedan dos, puedo faltar dos"—, que es lo contrario de para
  qué están.

### Dónde vive

Todo en la base: `vidas_usadas` guarda el día cubierto, y `verificar_perdida`
—que ya corría al abrir la app— es la que las gasta, **solo cuando ya detectó
que hay pérdida**. Así una vida nunca se gasta un día de descanso, ni el día
que ya registraste, ni con la racha en cero, donde no hay nada que salvar.

`calcular_racha` y `mejor_racha_real` tratan un día cubierto igual que un día
de descanso: no corta y no suma. Las dos, y no solo la primera: si el récord
histórico no supiera de vidas, el número de arriba diría 40 y el de al lado 12.

---

## 14. Orden de construcción

1. Racha propia contra base de datos, con fondos estáticos. Sin nada social.
2. Amigos y tabla de posiciones. Es la más barata: `racha_actual` ya está en `profiles`.
3. Feed. Casi gratis, sale de los mismos datos.
4. Perfil y fotos con visibilidad. Acá aparece el storage.
5. Motor de planetas en three.js, reemplazando los fondos estáticos.
6. Retos. La más cara y la que menos sirve sin usuarios activos.

Los retos quedan fuera de la primera beta. Beta significa poco alcance bien hecho,
no todo a medias.

Nunca empezar por el motor de partículas: se van tres semanas peleando con el
rendimiento sin tener ni el login.

---

## 15. Beta

Al ser PWA no hay tiendas, ni revisión, ni límite de testers: un link y listo.

Arrancar con cinco o seis personas. Antes de invitar: RLS verificada, backups
automáticos confirmados, y la corrección manual de días funcionando.

Para medir, mirar los datos de uso, no preguntar "¿qué te parece?". El buzón de
sugerencias sirve para encontrar bugs, no para decidir qué construir.

---

*Nota de implementación (no es parte de la spec): los retos ya tienen UI
construida por pedido explícito del humano — si la beta arranca sin ellos, se
ocultan, no se borran. El §13 está documentado pero NO implementado.*
