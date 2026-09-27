# Plan — push cuando llega una solicitud de amistad

*Esto es un PLAN, no código (pedido del 27/9). Deja escrito qué haría falta, en
qué orden, qué cuesta y qué decisiones hay que tomar antes de escribir una línea.*

## Objetivo

Que a la persona le llegue una notificación al teléfono cuando alguien le manda
una solicitud de amistad, aunque tenga la app cerrada. Hoy la solicitud solo se
ve entrando a Ranking (con el punto en la pestaña, ya hecho).

## Qué hay hoy (y qué de eso NO sirve)

- **`expo-notifications` ya está** (dependencia y plugin en `movil/app.json`),
  pero se usa SOLO para la notificación LOCAL del fin de descanso: la programa
  el teléfono, no la manda un servidor. Para la solicitud hace falta push
  REMOTO, que es otra cosa.
- **La tabla `suscripciones_push` + sus funciones (migración 35) NO sirven tal
  cual**: son de **Web Push (VAPID)** —guardan `endpoint`, `p256dh`, `auth`—,
  que es el formato del navegador. iOS nativo usa **APNs**, y con Expo se maneja
  con un **Expo push token** (`ExponentPushToken[...]`), que es un string, otra
  forma. Reusar esa tabla sería meter dos cosas distintas en las mismas columnas.
- **El push remoto de las 20:30 se sacó entero el 22/9** (cron, suscripción,
  puerto de avisos). O sea que no hay hoy ningún camino servidor→teléfono vivo.
- **La ficha de la tienda DICE HOY "no remote push"** (`spec/ficha-tienda.md`,
  notas para App Review: *"Notifications: only the end-of-rest alert, scheduled
  locally. No marketing, no remote push"*). Esto hay que cambiarlo antes de
  enviar: es un push **transaccional** (una acción de otra persona), no
  marketing, y Apple lo permite, pero la nota no puede mentir.

## Las tres partes que hay que construir

### 1. Cliente nativo — registrar el token y guardarlo

- Al iniciar sesión (no al abrir la app la primera vez: el permiso se pide en un
  momento con contexto, p. ej. la primera vez que entra a Ranking, o cuando
  acepta su primer amigo), pedir permiso con `Notifications.requestPermissionsAsync()`.
- Con permiso, `Notifications.getExpoPushTokenAsync()` da el token. Guardarlo en
  la base.
- **Tabla nueva** `tokens_push` (no reusar la de web): `user_id`, `token`
  (único), `plataforma` ('ios'/'android'), `actualizado`. RLS: cada quien
  escribe y borra SOLO el suyo; **nadie puede leer los de otro** (igual que hoy
  con `suscripciones_push`), porque son direcciones de entrega.
- El token **cambia**: registrar de nuevo cuando `expo-notifications` avisa el
  cambio, y borrar el viejo. Varios aparatos = varias filas por usuario.
- Manejar el token muerto: cuando el servidor recibe `DeviceNotRegistered` de
  Expo, borra esa fila (función `olvidar_*`, como ya existe para web).

### 2. Servidor — mandar el push cuando entra la solicitud

El cliente NO puede leer los tokens del destinatario (RLS), y está bien: el
envío va del lado del servidor, con permisos de servicio.

Dos caminos, de menor a mayor infraestructura:

- **A (recomendado) — Edge Function de Supabase (Deno) + webhook de base.** Un
  Database Webhook sobre `insert` en `friendships` con `estado = 'pendiente'`
  dispara la función. La función corre con `service_role`, lee los tokens del
  destinatario y hace **un POST a la Expo Push API**
  (`https://exp.host/--/api/v2/push/send`) con `{ to, title, body, data }`. Expo
  se encarga de APNs. Es el camino con menos piezas nuevas y no necesita un
  servidor propio prendido.
- **B — desde la base con `pg_net`.** Un trigger `after insert` en `friendships`
  llama a `net.http_post(...)` a la Expo Push API. Menos archivos, pero mete la
  llamada de red adentro de una transacción de escritura y esconde el envío en
  un trigger: más difícil de ver y de apagar. Se descarta salvo que A no se pueda.

El cuerpo del push: título con el nombre del solicitante (que el servidor SÍ
puede leer), texto corto, y `data.tipo = 'solicitud'` para el deep-link.

### 3. Al tocar la notificación — abrir donde corresponde

- `data.tipo = 'solicitud'` → abrir la app en **Ranking**, con las solicitudes a
  la vista (ya están al final de la lista). Se engancha con el listener de
  respuesta de `expo-notifications` + Expo Router.
- Badge opcional: el número de solicitudes sin responder en el ícono de la app.

## Costo

- **Plata: cero** en el uso previsto. Expo Push API es gratis; APNs es gratis;
  las Edge Functions y `pg_net` entran en el plan Free de Supabase de sobra para
  el volumen de una beta (una solicitud es un evento raro).
- **Build nativa: SÍ, una.** Activar push remoto necesita el entitlement
  `aps-environment` y registrar el APNs key en Expo/Apple. Eso **cambia la huella
  nativa**, así que **no llega por OTA**: hace falta una build nueva (como pasó
  con HealthKit y la Live Activity). Va junto a la próxima build, no suelto.
- **Trabajo:** ~1 tabla + RLS (migración), ~1 Edge Function, ~registro de token y
  listener en el cliente, ~actualizar la nota de la ficha. Medio día, sin contar
  la vuelta de App Review por el permiso nuevo.

## Decisiones a tomar ANTES de escribir código

1. **¿Entra en la primera build de la tienda o después?** Suma una vuelta de
   revisión (permiso nuevo) y una build. Si la beta arranca con un solo usuario,
   no hay quién mande solicitudes: podría esperar a que entre gente (mismo
   criterio que "gente sugerida" y "retos"). **Recomendación: después de la
   primera build**, salvo que se quiera tener el camino de push listo desde ya.
2. **¿Cuándo se pide el permiso?** No al arrancar. Propuesta: la primera vez que
   la persona ENTRA a Ranking teniendo al menos un amigo, o justo después de
   aceptar su primer amigo — cuando la función ya significa algo.
3. **La tabla vieja de web push (`suscripciones_push`)**: dejarla o borrarla en
   la misma migración. No molesta, pero tenerla al lado de `tokens_push` invita a
   confundirlas. **Recomendación: borrarla** en la migración que agrega la nueva.
4. **Actualizar `spec/ficha-tienda.md`**: la nota de App Review tiene que pasar a
   decir que hay un push transaccional de solicitudes de amistad, sin marketing.

## Lo que NO hace este plan

No toca el aviso de fin de descanso (local, sigue igual) ni revive el aviso de
las 20:30 (sacado a propósito). Es solo la solicitud de amistad.
