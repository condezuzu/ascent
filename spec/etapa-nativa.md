# Etapa nativa (Expo)

Lo que una PWA no puede hacer y espera a la versión nativa. Documentado, NO implementado.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.
Lo que está acá ya está decidido y no se rediscute salvo que se indique.

---

## 13. Registro automático por ubicación (etapa nativa)

El usuario guarda la ubicación de su gimnasio y el día se registra solo al llegar,
sin abrir la app. La opción de registrar a mano se mantiene siempre: el automático
es un atajo, nunca el único camino.

**Esto requiere geofencing del sistema operativo y por lo tanto solo existe en la
versión nativa.** Una PWA no puede consultar la ubicación con la app cerrada, ni
con la pestaña abierta en segundo plano. En nativo, la app registra una zona en el
sistema y es el teléfono el que la despierta al entrar.

Mientras el proyecto sea web, la versión posible es un atajo: si abrís la app
estando en el gimnasio, se registra sin apretar nada.

A tener en cuenta cuando se implemente:
- El GPS dentro de un edificio tiene 20 a 50 metros de error. En un centro
  comercial o zona densa puede disparar falsos positivos.
- El usuario marca el punto lo más cerca posible de la puerta, o de un lugar por
  el que pase siempre al entrar. El radio se configura lo más chico que el GPS
  permita.
- Radio chico significa menos falsos positivos pero más días que no se detectan.
  Por eso el registro a mano nunca desaparece: es la red de seguridad.
- Conviene exigir permanencia mínima en la zona, no solo el ingreso.
- El permiso de ubicación en segundo plano es el más invasivo que existe: hay que
  pedirlo explicando para qué, y la app tiene que funcionar entera sin él.
- La ubicación del gimnasio es dato privado del usuario y no se comparte con
  amigos bajo ninguna circunstancia.

**La foto se resuelve con una notificación.** El registro automático no puede sacar
la foto, así que al detectar la llegada el día queda registrado y sale un aviso
pidiéndola ("demostrá que viniste"). La foto sigue siendo opcional: si el usuario
la ignora, el día ya está contado igual.

### Cómo se configura la ubicación

Se ofrece durante el alta, como opción activable. Si el usuario la activa, la app
le explica que tiene que marcar el punto **parado en la puerta de su gimnasio**,
o en un lugar por el que pase siempre al entrar.

Como es improbable que esté ahí en ese momento, la pantalla siempre ofrece
**"lo configuro después"**, y queda pendiente en Ajustes con un recordatorio
visible hasta que se complete. Nunca se pide marcar el punto desde otro lugar:
un punto mal puesto es peor que no tenerlo.

Esta es la primera razón concreta para pasar a nativo con Expo. El backend entero
(Supabase, esquema, RLS, triggers, lógica de rachas) se lleva sin tocar; se rehace
solo la capa visual.

---

## 13b. Avisos de descanso con la pantalla bloqueada (etapa nativa)

El temporizador de descanso entre series (§18) funciona en la web **solo con
la app en primer plano y la pantalla despierta**. Es la tercera razón concreta
para pasar a Expo, junto con la geolocalización y las notificaciones.

Lo que la web no puede y el nativo sí:

- **Avisar con la pantalla bloqueada o la app cerrada.** En web el navegador
  suspende el audio en segundo plano y con el teléfono bloqueado no corre nada.
  En nativo se programa una notificación local al empezar el descanso, y llega
  igual aunque el usuario haya guardado el teléfono.
- **Vibrar en iPhone.** WebKit nunca implementó la Vibration API, así que en
  web el iPhone no vibra y punto. Nativo tiene acceso al motor háptico.
  Justamente donde más falta hace: en un gimnasio ruidoso, con auriculares
  puestos, un sonido se pierde y la vibración en el bolsillo no.
- **No cortarle la música al usuario.** Esto no se arregla con más código web:
  depende de la **categoría de audio del sistema operativo**, que solo se puede
  declarar desde una app nativa. En iOS el aviso tiene que sonar en categoría
  **ambient**, que se mezcla con lo que ya está sonando en vez de interrumpirlo.
  En Android va con **audio focus transitorio con ducking**: la música baja un
  momento y vuelve sola. En web no hay forma de pedir ninguna de las dos, así
  que un aviso sonoro puede cortarle el tema a la mitad de la serie.

A tener en cuenta cuando se implemente:

- La notificación local se **programa al empezar el descanso y se cancela al
  saltarlo**. Si no se cancela, suena después de que el usuario ya volvió a
  entrenar.
- El aviso es de **una sola vez**, no se repite hasta que lo atiendan. Un
  temporizador de descanso que insiste es un despertador, y nadie quiere un
  despertador en el gimnasio.
- La regla de la cuenta no cambia: **el timestamp de fin manda** y el
  transcurrido se calcula contra el reloj (§18.4). La notificación es un aviso
  encima de eso, nunca la fuente de la verdad.
- Sigue valiendo lo de §13: la app tiene que funcionar entera sin el permiso.
  Quien no acepte notificaciones se queda con el aviso visual, igual que en la
  web de hoy.
