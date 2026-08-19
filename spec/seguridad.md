# Seguridad y auth

RLS, permisos, storage e identidad. Nada de esto hace falta para tocar el motor visual.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.
Lo que está acá ya está decidido y no se rediscute salvo que se indique.

---

## 4. Seguridad

RLS activo en todas las tablas desde el principio, no después.

- Datos propios: solo el dueño.
- Logs y fotos: el dueño y los amigos con amistad aceptada, respetando `visibilidad`.
- Pesos: solo el dueño, sin excepción.
- Búsqueda de usuarios: vista pública que expone únicamente `username`, `avatar_url`,
  `racha_actual` y `rango_actual`. La tabla `profiles` completa nunca se abre.

Antes de invitar a nadie: crear dos cuentas sin amistad entre ellas e intentar
leer los datos de una desde la otra. Si funciona, no se invita a nadie.

---

## 5. Auth

Supabase Auth no maneja login por nombre de usuario. La identidad es email u
OAuth. El username vive en `profiles`.

- Login con Google + email/contraseña.
- El username se elige en el onboarding, después del primer login.
- Trigger sobre `auth.users` que crea la fila en `profiles` al registrarse.
- Username único e insensible a mayúsculas.

---

## 5b. Storage: qué puede leer cada uno

| Bucket | Quién lee las filas de `storage.objects` | Quién baja el archivo |
|---|---|---|
| `avatares` (público) | solo el dueño, y solo su carpeta | cualquiera con la URL |
| `fotos` (privado) | el dueño; los amigos, las marcadas "amigos" | ídem, por URL firmada |

Dos cosas de Supabase Storage que ya costaron un bug cada una, verificadas
contra el proyecto real:

**La lectura pública NO pasa por la RLS.** En un bucket público, bajar por
`/storage/v1/object/public/...` no consulta las políticas. Verificado: el mismo
cliente anónimo al que la RLS le bloquea el listado baja el archivo con HTTP
200. Por eso la política de select puede acotarse a la carpeta propia sin que
se deje de ver ningún avatar. `getPublicUrl()` tampoco toca la red.

**`remove()` puede fallar en silencio.** Si al bucket le falta la política de
`delete`, la RLS lo frena y la API devuelve **éxito con cero archivos
borrados**. Así fue como una baja de cuenta dejó el avatar huérfano en un
bucket público. Regla: **nunca alcanza con mirar `error`, hay que contar los
archivos que volvieron borrados.** `eliminarCuenta()` lo hace y aborta si no
coinciden.

Corolario de las dos: las políticas de `storage.objects` se evalúan TODAS en
cada consulta a esa tabla, sin importar el bucket. Si una falla, tumba la
consulta entera — así que un bucket puede quedar "protegido" por un error
ajeno en vez de por su propia política. No apoyarse en eso.
