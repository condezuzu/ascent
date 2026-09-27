# Auditoría con ojos de revisor de Apple (27/9/2026)

Mirada de rechazo, no de autor: para cada motivo común de rechazo, qué tenemos y
cuánta confianza le tengo. **Verde** = tranquilo. **Amarillo** = defendible pero
puede saltar. **Rojo** = riesgo real, hay que hacer algo.

Resumen de una línea: **lo único rojo es contenido de usuarios (denunciar/
bloquear).** El resto va de verde a amarillo.

---

## 🟢 Contenido de usuarios (Guideline 1.2 — Safety, UGC) — RESUELTO (27/9)

> **HECHO (migración 53).** Se implementó denunciar (perfil + long-press en el
> ranking, motivo de una lista) y bloquear (corta la amistad, impide nuevas
> solicitudes en las dos direcciones, esconde el uno del otro en buscador y
> ranking, todo por RLS) + gestión en Ajustes → "Cuentas bloqueadas". Notas de
> App Review actualizadas. Lo de abajo queda como el análisis original.

**Esto es lo que me preocupa y lo confirmo: estamos expuestos.**

### Qué contenido de un usuario ve otro
- **Nombre de usuario + avatar + racha + rango:** los ve **cualquier usuario
  autenticado**, no solo los amigos. Salen de la vista `usuarios_publicos`
  (`schema.sql`), que tiene `grant select ... to authenticated`. Así funciona la
  búsqueda para agregar amigos: escribís un nombre y ves su avatar. O sea, el
  avatar (imagen que sube el usuario) y el nombre (texto que elige) son visibles
  de forma amplia.
- **Fotos del álbum, días y stats:** solo si **aceptaste** la amistad y solo las
  fotos marcadas 'amigos' (nacen privadas, se comparten de a una). Exposición
  baja, con consentimiento mutuo.
- **No hay** feed público, comentarios, likes ni desconocidos en el ranking.

### Lo que falta (y Apple lo pide para apps con UGC)
1. **Denunciar contenido/usuario — NO EXISTE.** No hay forma de reportar un
   avatar, un nombre o una foto ofensiva. Es el hueco principal.
2. **Bloquear a alguien — NO EXISTE de verdad.** `eliminar_amigo` borra una
   amistad aceptada, pero (a) no impide que esa persona te vuelva a mandar
   solicitud, y (b) no te saca de su búsqueda. No es un bloqueo.
3. **Términos con tolerancia cero** a contenido/usuarios abusivos: no hay EULA
   con esa cláusula ni un "acepto" en el alta.
4. **Contacto publicado:** ✅ esto sí está (soporte + mail, ver abajo).

### Confianza
**Riesgo real, medio.** Muchas apps "solo amigos" pasan sin denunciar/bloquear,
pero Apple es inconsistente y acá hay imágenes y nombres de usuario visibles
entre cuentas. Siendo la primera aprobación, conviene cerrarlo.

### El arreglo (propuesta, en dos niveles)

**Nivel 1 — Denunciar (se puede sin migración, sale por OTA).**
Reusar el buzón que ya existe (`migracion-49-buzon-de-errores` / Sugerencias).
Agregar una acción **"Denunciar"** donde aparece contenido de otro:
- en el perfil de un amigo (desde el ranking),
- en el visor de una foto compartida,
- en el resultado de búsqueda de un usuario.
Manda `{reportado, foto?, motivo}` por el mismo camino del buzón, con una
confirmación. Apple quiere que **el mecanismo exista** y que respondamos rápido.

**Nivel 2 — Bloquear (necesita migración → la aplica el humano).**
Tabla `bloqueos (bloqueador, bloqueado, creado_en)` con RLS, y:
- la policy de insert de `friendships` chequea que no exista un bloqueo entre las
  dos puntas (el bloqueado no puede volver a pedir amistad),
- `usuarios_publicos` / la búsqueda esconde a los bloqueados en ambos sentidos,
- botón **"Bloquear"** en el perfil del otro, que borra la amistad y crea el
  bloqueo en una sola acción.

**Nivel 3 — Términos.** Una línea de tolerancia cero en la página de términos +
referencia en las notas de App Review. Barato y suma.

**Mi recomendación:** hacer Nivel 1 (denunciar) sí o sí antes de mandar —es OTA,
sin migración— y Nivel 2 (bloquear) idealmente también, aceptando que lleva
migración. Con denunciar + contacto publicado ya tenemos un argumento; con
bloquear, es sólido. Decisión tuya por el alcance.

---

## 🟡 Permisos

Cada permiso, si se usa y si la frase dice la verdad:

| Permiso | ¿Se usa? | Frase | Confianza |
|---|---|---|---|
| Ubicación (uso / siempre / fondo) | **Sí** — registra el día al llegar al gimnasio | Explica el porqué | 🟡 ver abajo |
| Salud (lectura) | **Sí, solo lee** (`salud.ts`: `toRead`, nunca `toShare`) | `NSHealthUpdate...` está solo porque la librería linkea las APIs de escritura | 🟢 |
| Micrófono (expo-audio) | **NO graba** — la app reproduce un sonido | "Ascent no graba audio…" | 🟡 ver abajo |
| Cámara | **Sí** (`RegistrarDia.tsx`: `launchCameraAsync`) | "para sacar la foto del día" | 🟢 |
| Fotos | **Sí** (elegir de la galería) | "para sumar la del día" | 🟢 |
| Notificaciones | **Sí** — aviso local de fin de descanso | local, sin marketing | 🟢 |

**Ubicación "Siempre" (🟡):** es lo más mirado. Está justificada —el día entra
solo con la app cerrada— y explicada en las notas de revisión. El riesgo es que
un revisor no vea el auto-registro y pregunte. Mitigación: las notas ya explican
el flujo (marcar el punto en Ajustes, cerrar, volver al gimnasio). Confianza
media-alta.

**Micrófono (🟡):** la app no graba; la frase existe porque `expo-audio` linkea
las APIs de grabación (igual que Salud con escritura). Como nunca grabamos, iOS
no debería mostrar el pedido de micrófono en ningún momento. **A confirmar en el
teléfono:** que abriendo y usando la app NO aparezca el diálogo de micrófono. Si
apareciera sin motivo, un revisor lo marca. Si no aparece, es inofensivo.

**Android (nota, no bloquea a Apple):** el array de permisos lista
`RECORD_AUDIO` y `MODIFY_AUDIO_SETTINGS`. La app no graba; para Google Play, un
permiso declarado y no usado puede pedir una declaración. No afecta la revisión
de Apple; anotado para cuando toque Android.

---

## 🟢 Funcionalidad mínima (¿"solo una lista"?)

No corre riesgo. La app hace: racha con perdón, registro de día automático,
contador de series en vivo con Live Activity, DOTS/fuerza, ranking de amigos,
álbum, integración con Salud. La cuenta demo está poblada (racha 45, rango 5, 6
amigos, DOTS) para que el revisor lo VEA, no lo tenga que imaginar. Confianza
alta.

## 🟢 Cuentas

- **Alta:** la app es login-first (no muestra nada sin sesión). Está bien porque
  la función es intrínsecamente personal; se explica en las notas.
- **Borrar la cuenta DESDE ADENTRO:** ✅ existe (`ajustes/Cuenta.tsx`), pide
  escribir el nombre de usuario, borra todo y cierra sesión. Cumple 5.1.1(v).
- **Demo de punta a punta:** ✅ verificada; credenciales en App Store Connect.
- **Sign in with Apple (4.8):** **no aplica.** Solo usamos correo+contraseña
  (Supabase), no un login social de terceros; 4.8 no lo exige. Confianza alta.

## 🟢 Enlaces (privacidad y soporte)

Los dos abren con contenido real (HTTP 200):
- `…/privacidad` — política completa, "sin publicidad, sin rastreo, no se vende
  nada", actualizada 22/9.
- `…/soporte` — camino en la app (Ajustes → Sugerencias) + mail
  `agustinconde@icloud.com` + tiempos de respuesta. **Contacto publicado** ✅.

## 🟡 Modos en segundo plano

`UIBackgroundModes: ["audio","location"]`.
- **location** — para el auto-registro. Justificado.
- **audio** — para que el aviso de fin de descanso suene con la pantalla
  bloqueada. Es el modo pensado para reproducir audio; un "beep" de temporizador
  es borderline y un revisor podría preguntar. Mitigación: el aviso también sale
  como notificación local. **A vigilar:** si saltara, defender que reproduce un
  sonido real con la app en segundo plano (que es lo que hace). Confianza media.

---

## Qué llevar a las notas de App Review (además de lo que ya está)
- Ubicación "Siempre": describir el auto-registro (ya está en la ficha).
- Salud: solo lectura; la cadena de escritura está por la librería (ya está).
- Micrófono: la app no graba; el string es por `expo-audio` (agregar una línea).
- UGC: si hacemos denunciar/bloquear, describirlos y comprometer respuesta < 24 h.

## Orden sugerido antes de mandar
1. **Denunciar** (Nivel 1, OTA) — cierra el rojo de UGC en su mayor parte.
2. **Bloquear** (Nivel 2, con migración) — lo deja sólido.
3. Confirmar en el teléfono: sin diálogo de micrófono; el aviso de descanso
   suena bloqueado.
4. Línea de tolerancia cero en términos + notas de revisión.
