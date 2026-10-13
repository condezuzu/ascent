# Qué probar en el iPhone antes de publicar a `store`

Escrita el 13/10/2026, para la OTA que llevó a `store` el descanso nuevo,
entrenar con otro, el peso propuesto y los arreglos de la cacería del 12/10
(grupo `24aa0f9e-4a97-461b-a234-4b13d2711ed8`, commit `e5928a8`). Sirve de
molde para la próxima: se cambian los puntos, no la forma.

Se prueba en la build de `telefono`, con la OTA ya bajada (cerrar y abrir la
app dos veces). **Bloquea** = roto, deja un dato falso o una pantalla principal
mal para todas las cuentas: no se publica hasta arreglarlo.

## Solo

1. **Bloquea.** Descanso: arriba dice el ejercicio y "serie X de Y" correctos.
2. Descanso: el arco se vacía con el color del rango.
3. **Bloquea.** Descanso: al llegar a cero cuenta hacia arriba con "+".
4. **Bloquea.** Descanso: "Serie hecha" y los tiempos rápidos responden, y nada se corta.
5. **Bloquea.** Descanso: llega una sola notificación y se va del centro al volver a la app.
6. Descanso: con "Sonido al terminar" apagado, la notificación llega callada.
7. Descanso: volver varios minutos tarde no vibra.
8. **Bloquea.** Peso: un ejercicio que la vez pasada se hizo bajando propone el más pesado de esa vez.
9. Peso: ese número es el mismo que muestra la lista al lado del ejercicio.
10. **Bloquea.** Peso: con "la próxima, más" marcada, propone lo marcado más un disco.
11. **Bloquea.** Peso: reabrir hoy un ejercicio ya hecho propone la última serie de hoy.
12. **Bloquea.** "La próxima, más": la marca es por modo y se usa una sola vez por sesión.
13. "La próxima, más": corregir el ejercicio o quitar el bloque suelta la marca.
14. Terminar dentro del gimnasio no vuelve a marcar entrenando.
15. Ranking: foto de cada uno y medalla del rango más alto.
16. Perfil propio: medalla del rango más alto.
17. Perfil de un amigo: "Su rutina" explica cuando está vacía.
18. Botón de invitar con el link, más chico.

## Con dos teléfonos (o con uno, ver abajo)

19. **Bloquea.** Al iniciar a mano se aparece en "Entrenando ahora" del otro.
20. **Bloquea.** "Unirse" → pedido en Inicio → aceptar → los dos en "Entrenando contigo".
21. En el descanso aparece abajo el compañero con ejercicio, serie y cuenta.
22. Si el otro bloquea el teléfono, su cuenta se sigue viendo.
23. **Bloquea.** Al terminar uno, se corta para los dos y se va "quiere unirse".

## Cómo probar del 19 al 23 con un solo iPhone

La web de producción NO sirve: entrenar con otro vive solo en la app nativa
(`movil/src`). Lo que sirve es la app nativa corriendo en el navegador de la
PC, contra la base real, con la cuenta de demo. Es lo mismo que hace
`test:real` con dos navegadores.

**Es un proxy en un solo sentido:** el lado del navegador no es un iPhone. Por
eso el 19, el 20 y el 23 se hacen una vez en cada dirección: así todo lo que
hace el iPhone queda probado en el iPhone. La pestaña tiene que quedar a la
vista: escondida, deja de preguntar.

1. En la PC: `npm --prefix movil run web -- --port 8090`
2. Abrir `http://localhost:8090`, entrar con la cuenta de demo (`DEMO_EMAIL` y
   `DEMO_PASSWORD` de `.env.local`) y saltar la guía.
3. iPhone: Ranking → buscar `demo` → agregar. Navegador: aceptar la amistad.
4. **19.** iPhone: "Iniciar entrenamiento". Navegador, Ranking: dice que estás
   entrenando.
5. **20.** Navegador: "Unirse". iPhone: aparece el pedido en Inicio; aceptar.
   Los dos pasan a "Entrenando contigo".
6. **21.** Navegador: "Iniciar entrenamiento", elegir un ejercicio y sumar una
   serie. iPhone: sumar una serie y mirar el descanso: abajo está demo.
7. **22.** iPhone: un descanso largo y bloquear. Navegador: la cuenta se sigue
   viendo pasados los dos minutos.
8. **23.** iPhone: "Terminar". Navegador: desaparece de "Entrenando contigo" y
   de "Entrenando ahora".
9. **Al revés (19, 20 y 23):** demo sigue entrenando en el navegador. iPhone:
   Ranking → "Unirse" a demo; aceptar en el navegador; terminar en el
   navegador y ver que en el iPhone se corta.
10. Borrar la amistad con demo (es la cuenta que ve el revisor de Apple) y
    cerrar la terminal del paso 1.

Lo que esto no cubre: dos personas en un gimnasio con mala señal de los dos
lados.

## Antes y después de publicar

- Antes: `tsc`, `test:db`, `test:conexion`, `capturas`, `test:real`; el commit
  subido a GitHub (`verificar:deploy` da DESPLEGADO); y que no haya una versión
  en revisión de Apple.
- Después: **se comprueba el artefacto, no el comando.** Se le pide el
  manifiesto al servidor de actualizaciones como lo pide la app (canal `store`,
  la huella de la build) y se compara el `hash` del paquete que entrega con el
  del paquete que revisó el guardián. El paquete en sí no se puede bajar desde
  la PC: el servidor de archivos de EAS contesta 403 a lo que no es la app.
