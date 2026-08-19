# Modelo de datos

Las tablas, por qué cada una es como es, y la matemática de la racha.

Parte de la especificación de Ascent. El índice está en `CLAUDE.md`.
Lo que está acá ya está decidido y no se rediscute salvo que se indique.

---

## 3. Modelo de datos

### profiles
`id` (uuid, referencia a auth.users), `username`, `avatar_url`,
`racha_actual`, `mejor_racha`, `rango_actual`

La racha va guardada como columna, no calculada al vuelo. Se actualiza con un
trigger al registrar un día. Es duplicación deliberada: sin eso, la tabla de
posiciones tendría que recorrer los logs de todos los amigos en cada carga.

`mejor_racha` **sale del historial, no es un contador que solo sube**. Si se
borran días registrados por error, tiene que bajar: un récord inflado que no hay
manera de corregir es un dato falso para siempre.

### logs
`id`, `user_id`, `fecha`, `es_descanso`, `planeta_del_dia`
Restricción de unicidad en (`user_id`, `fecha`).

### photos
`id`, `user_id`, `log_id`, `storage_path`, `visibilidad`, `es_subida_de_rango`

`visibilidad` va por foto, no por perfil. Permite álbum privado con algunas
fotos visibles para amigos. A nivel perfil sería todo o nada.

### descansos
`id`, `user_id`, `desde`, `dias`

Configuraciones de descanso fechadas. Cada fila rige desde su fecha hasta que
aparece la siguiente. El cálculo de un día busca la vigente **ese** día, así el
pasado nunca se reescribe. `profiles.dias_descanso` queda solo como espejo de la
configuración actual, para que la interfaz no tenga que buscarla; se escribe
únicamente desde el servidor.

### weights
`id`, `user_id`, `fecha`, `valor`

Tabla propia, NO una columna en `logs`. Los días de descanso no generan fila en
`logs`, y el peso se tiene que poder anotar igual esos días.
El peso no se comparte nunca: ni en perfil, ni en tabla de posiciones, ni con amigos.

### friendships
`id`, `solicitante`, `destinatario`, `estado` (pendiente / aceptada)
Relación bidireccional con una sola fila. Las consultas tienen que contemplar
ambos sentidos.

### challenges
`id`, `retador`, `rival`, `desde`, `hasta`, `estado`, `ganador`

### feedback
`id`, `user_id`, `texto`, `tipo` (bug / idea), `fecha`, `version_app`,
`plataforma`, `pantalla_origen`
Cualquiera logueado puede insertar. Solo el dueño de la app puede leer.

### Sin tabla de feed
El feed se deriva: logs de la gente con amistad aceptada, ordenados por fecha.

---

## 12. Pérdida de racha

El sistema no explota: se dispersa. Se pierde masa, el fondo se apaga, se baja un
rango. Perder progreso por un error de la app es lo único que no se perdona.

**Perder la racha resta 10 días. No devuelve al inicio del rango anterior.**

```
racha 14 → 4    (baja a polvo, pero conserva 4 días)
racha 47 → 37   (baja de planeta a luna)
racha 6  → 0    (correcto: no completó ningún rango)
```

Como un rango son exactamente diez días, restar 10 es bajar un rango justo: la
misma fórmula sirve para los ocho, sin números mágicos ni casos especiales.
Llegar a cero solo pasa si todavía no se completó ningún rango, y ahí es lo
correcto: no hay progreso que conservar.

Los días que sobreviven quedan guardados y esperan. Volver después de una semana
o después de tres meses da lo mismo: se retoma desde los días conservados. Una
ausencia larga no castiga más que una corta — el resto es una sola vez por corte.

Corolario: tiene que existir una forma de corregir días a mano desde el principio.
