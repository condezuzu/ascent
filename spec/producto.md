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
