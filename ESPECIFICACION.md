# Se partió en varios archivos

La especificación entera vivía acá y hacía que cada sesión arrancara gastando
la mitad del contexto en leerla completa, incluso para tocar una sola cosa.

Ahora el índice está en [`CLAUDE.md`](CLAUDE.md) —eso es lo único que se lee
siempre— y el contenido está partido por tema en [`spec/`](spec/):

| Archivo | Qué hay |
|---|---|
| [spec/estado.md](spec/estado.md) | qué está hecho, qué falta, problemas conocidos |
| [spec/producto.md](spec/producto.md) | §1 qué es · §2 stack · §14 orden · §15 beta |
| [spec/modelo-de-datos.md](spec/modelo-de-datos.md) | §3 tablas · §12 pérdida de racha |
| [spec/seguridad.md](spec/seguridad.md) | §4 RLS · §5 auth · §5b storage |
| [spec/motor-visual.md](spec/motor-visual.md) | §6 rangos · §7 reglas visuales · §8 motor |
| [spec/pantallas.md](spec/pantallas.md) | §9 pantallas · §10 onboarding · §11 vacíos |
| [spec/etapa-nativa.md](spec/etapa-nativa.md) | §13 ubicación y push |

Los números de sección no cambiaron: los comentarios del código que citan §3,
§7, §9 y compañía siguen apuntando a lo mismo.
