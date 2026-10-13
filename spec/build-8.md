# La build 8 — qué trae, qué falta, y qué pasos son del humano

Rama `build-8-nativo`. **No está en `main` a propósito**: lo que hay acá cambia
la huella de la app, y con eso el guardián deja de publicar OTAs a las builds
que ya están en la calle. Se junta con `main` recién cuando la build exista.

**No se lanzó ninguna build.** Se lanza cuando el humano lo autorice.

## Lo que ya está hecho en esta rama

- **El sonido del fin de descanso**: `movil/assets/aviso-descanso.wav`. Un
  toque solo, suave, de 0,8 segundos: el "corte 1" que el humano eligió el
  13/10/2026, subido 2,1 dB para igualar la energía de la campana de hoy. La
  primera versión (cuatro golpes sintetizados) se descartó por fuerte. De dónde
  salió y el estado de su licencia: `spec/sonido-del-aviso.md`.
- **`movil/assets/silencio.wav`**: medio segundo de nada. Con "Sonido al
  terminar" apagado, el aviso usa este archivo: vibra sin sonar. Por OTA lo
  único posible era mandarlo sin sonido, y una notificación sin sonido tampoco
  vibra.
- Los dos declarados en `movil/app.json`, y el código ya los usa.
- **La versión pasa a 1.1.0.** Apple no deja subir otra build de la 1.0.0 una
  vez publicada.
- `test:db` comprueba que los archivos existen, están declarados, tienen el
  formato que iOS acepta, y que el aviso no recorta y tiene la energía de la
  campana.

## Lo que NO está hecho, y por qué

- **Cambios al widget de la pantalla bloqueada** (que muestre el ejercicio
  recién elegido con su meta, los pasos). Es Swift, y en esta PC no se compila
  Swift: un error ahí se ve recién en la build, que tarda y cuesta. Si se
  quiere, se escribe y se prueba primero con una build `telefono`.
- **Que el `https` abra la app directo y el enlace sobreviva a la
  instalación.** Necesita el dominio definitivo, que el humano todavía no
  eligió: los dominios asociados se compilan con un dominio fijo.
- **Diagnóstico sin depender de una variable de compilación.**
- **Que la tarjeta suene sola al terminar, sin notificación.** Pide un servidor
  que la empuje (APNs). No entra en esta build.

## Los pasos que son del humano, sí o sí

1. **El sonido ya está elegido** (corte 1). Lo único que queda es oírlo con
   el volumen final, si se quiere: después de compilar, cambiarlo es otra build.
2. **Elegir el dominio**, si se quiere que esta build traiga los enlaces que
   abren la app directo. Si no se elige, la build sale sin eso y queda para la
   siguiente (otra revisión de Apple).
3. **Autorizar la build de prueba** (`telefono`). Se instala con el link de
   Expo, como la de hoy. Probar en el gimnasio: el sonido con música puesta, y
   con el teléfono en silencio que vibre.
4. **Autorizar la build de tienda** (`store`).
5. **En App Store Connect** (no se puede hacer desde acá):
   - crear la versión **1.1.0**;
   - escribir "Novedades de esta versión";
   - elegir la build cuando termine de procesarse;
   - mandarla a revisión.
6. **Cuando Apple la apruebe, publicarla.** Desde ahí las OTAs de `main` van a
   la build 8; quien siga en la 7 se queda con la última OTA que recibió hasta
   que actualice desde la tienda.

Si la base tiene migraciones pendientes para ese día, van antes, como siempre.
