# Armar la app y ponerla en el teléfono

Este archivo explica **por qué** `eas.json` dice lo que dice. Los comandos en
orden los pasa el agente; acá está lo que hay que saber para cambiarlo.

## Un solo perfil: `telefono`

No hay `development`, `preview` ni `production`. Hay uno, y arma exactamente lo
que se necesita hoy: un IPA firmado ad-hoc que se instala en un iPhone
registrado. Tres perfiles vacíos esperando a que alguien los use son tres cosas
que se desactualizan.

- **`distribution: "internal"`** es lo que hace que salga un link de instalación
  directo, sin TestFlight y sin revisión de Apple. Es la diferencia entre
  "probar hoy" y "esperar a que App Store Connect procese".
- **`simulator: false`**: el build es para el teléfono de verdad. Un build de
  simulador no se firma y no instala en un aparato.
- **`appVersionSource: "local"`**: la versión sale de `app.json` y no de un
  contador en los servidores de Expo. Un número que vive afuera del repo es un
  número que no se puede leer mirando el código.

## Las variables: secrets de EAS, no valores pegados acá

`env` nombra las variables **con `$`**: eso le dice a EAS que busque un secret
con ese nombre, no que use el texto literal. Los valores no están en este
archivo ni en ningún otro del repo.

La anon key de Supabase es pública por diseño —viaja en cada pedido del
navegador— así que pegarla acá no filtraría nada. Se hace con secrets igual, a
propósito: el día que aparezca una variable que **no** sea pública, el camino ya
está hecho y nadie tiene que acordarse de cambiar de método justo cuando
importa. Ver `movil/.env` para los mismos nombres en desarrollo.

## Lo que este perfil NO hace

- **No sube nada a App Store ni a TestFlight.** `submit` está vacío a propósito:
  la preparación de App Store (metadatos, política de privacidad, justificación
  de ubicación en segundo plano, cuenta demo para el revisor) va DESPUÉS de las
  tandas 4, 5 y 6. Ver `spec/etapa-nativa.md`.
- **No toca `UIBackgroundModes`.** Hoy tiene `audio` —lo necesita el cronómetro
  para seguir corriendo con la pantalla apagada— y NO tiene `location`. La
  consecuencia es concreta y hay que saberla: **el registro automático al llegar
  al gimnasio no va a dispararse con la app cerrada** en esta build. Todo lo
  demás anda. Agregarlo es lo que Apple revisa con lupa y es trabajo de App
  Store, no de poner la app en un teléfono.
