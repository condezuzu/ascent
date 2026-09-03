# El idioma de Ascent

Decidido el 2026-08-31, a pedido del humano: **español neutro**, que lo entienda
alguien de cualquier país.

Esto no es una guía de estilo con consejos. Son **cuatro reglas** y las hace
cumplir un test (`test:db`, sección 54) que lee `nucleo/textos.ts` y falla si
encuentra una violación. La razón de que sean reglas y no criterio es concreta:
sin ellas, dentro de seis meses hay tres estilos mezclados, porque cada texto
nuevo se escribe con el gusto de ese día.

Todo esto vale para `nucleo/textos.ts`, que es donde vive **todo** el texto que
ve el usuario. Los comentarios del código siguen en rioplatense: los lee quien
programa, no quien entrena.

---

## Regla 1 — Nada de voseo

Ni el pronombre ni la conjugación.

| No | Sí |
|---|---|
| vos | tú |
| tenés, podés, querés | tienes, puedes, quieres |
| tocá, mirá, elegí, anotá | toca, mira, elige, anota |
| marcalo, apretalo, fijate | márcalo, apriétalo, fíjate |
| decime, pasame, avisame | dime, pásame, avísame |

## Regla 2 — Segunda persona: `tú`, y solo cuando hace falta

**Primero se intenta sin pronombre.** La mayoría de las instrucciones no
necesitan dirigirse a nadie: *"Marcar el punto"*, *"El día entra solo"*, *"Se
registra sin apretar nada"*.

**Cuando hace falta hablarle a la persona, es `tú` conjugado**, porque es la
forma que se entiende en toda Latinoamérica y en España — incluso donde no se
usa al hablar.

**Nunca `usted`.** Es una app para entrenar, no un trámite. `usted` pone una
distancia que no corresponde a algo que se abre todos los días.

Los posesivos van igual: *tu racha*, *tus amigos*, *tu gimnasio*.

## Regla 3 — Nada de modismos rioplatenses

Se entienden en tres países y suenan extranjeros en los otros veinte.

| No | Sí |
|---|---|
| acá | aquí |
| recién (= apenas) | apenas, solo entonces |
| al toque, de una | al instante, enseguida |
| Ojo: | Ten en cuenta:, Atención: |
| andá a Ajustes | ve a Ajustes, entra en Ajustes |
| prendido / apagado | activado / desactivado |
| sacar (= quitar) | quitar |
| che, laburo, pileta | — |

## Regla 4 — Un verbo por acción, siempre el mismo

Esta no es de neutralidad sino de claridad, y salió del mismo repaso: había
cuatro verbos para cosas parecidas y ninguno significaba algo estable.

| Acción | Verbo |
|---|---|
| El día de gimnasio | **registrar** |
| Una marca de fuerza, el peso | **anotar** |
| El punto del gimnasio | **marcar** |
| Un ajuste, una preferencia | **guardar** |
| Una foto, un día del calendario | **quitar** (nunca "sacar" ni "borrar") |

---

## Lo que NO se toca

- **Los nombres de los rangos y los planetas.** Polvo, Asteroide, Luna, Marte…
  Son vocabulario propio, no texto de interfaz, y viven en `rangos.ts` y
  `reglas.ts`.
- **Las citas.** Son de sus autores; traducirlas o neutralizarlas sería
  reescribir a otro. Viven en `frases.ts`.
- **DOTS, PR, 1RM.** Términos del ambiente, iguales en todos lados.

## Cómo se hace cumplir

`test:db` sección 54 mira **dos lugares**:

- `nucleo/textos.ts`, que es donde debería vivir todo el texto de la app.
- El **texto JSX de los componentes** (`src/**/*.tsx`), o sea la prosa escrita
  a mano. Se agregó después de que la primera versión —que solo miraba el
  diccionario— dejara pasar la explicación entera de "Cómo se compara la
  fuerza" en Ajustes, que son treinta líneas de prosa en voseo. Un test que
  cubre el archivo prolijo y no el que se escribe a mano protege del caso
  fácil.

En los dos busca:

1. El pronombre `vos` como palabra suelta.
2. Una lista de conjugaciones e imperativos de voseo.
3. La lista de modismos de la regla 3.

Los **comentarios del código** se sacan antes de mirar: siguen en rioplatense
a propósito, los lee quien programa, no quien entrena.

Falla nombrando la clave exacta y lo que encontró. Si aparece un caso nuevo que
la lista no cubre, se agrega a la lista **en el mismo commit** que lo corrige:
una regla que se sabe incompleta y no se completa deja de ser una regla.
