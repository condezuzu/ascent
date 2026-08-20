'use client';

import { useState } from 'react';

/**
 * Cómo se calcula el ranking de fuerza, abajo de todo en Ajustes.
 *
 * Acá sí puede ser largo, y es la única parte de la app donde eso vale: el
 * que abre esto lo está buscando. En el resto, si algo necesita un párrafo
 * está mal diseñado; acá el párrafo ES el diseño.
 *
 * Va plegado igual, porque el que no lo busca no tiene por qué scrollearlo.
 */
export default function ComoSeCompara() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="seccion">
      <button className="fila-plegable" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <h3>Cómo se compara la fuerza</h3>
        <span>{abierto ? '−' : '+'}</span>
      </button>

      {abierto && (
        <div className="texto-largo">
          <p>
            El problema de comparar fuerza es que 100 kg no significan lo mismo en alguien de 60
            que en alguien de 100. Si comparáramos el peso levantado a secas, el ranking lo ganaría
            siempre el más pesado y no diría nada.
          </p>
          <p>
            Se usa <strong>DOTS</strong>, que es el estándar del powerlifting fuera de la IPF.
            Toma lo que levantás y tu peso corporal, y devuelve un número comparable entre
            personas de distinto tamaño. Los coeficientes son los de OpenPowerlifting, no
            inventados acá.
          </p>

          <h4>Qué entra</h4>
          <p>
            Solo tres: <strong>sentadilla, press de banca y peso muerto</strong>. La fórmula está
            calibrada sobre esos tres, así que sumarle otros ejercicios no la haría más completa
            —la invalidaría—: el número dejaría de ser comparable con el de cualquier otra
            persona, que es lo único que lo hace valer.
          </p>
          <p>
            Podés anotar todos los ejercicios que quieras y ver tu progreso, pero solo esos tres
            mueven el número.
          </p>
          <p>
            Si anotaste un peso levantado varias veces, se calcula cuánto levantarías de una. Con
            una sola vez no hay nada que calcular: es el peso.
          </p>

          <h4>Por qué te pide el sexo</h4>
          <p>
            La fórmula tiene dos juegos de coeficientes. Sin ese dato no hay número: no se asume
            ninguno ni se usa uno &ldquo;por defecto&rdquo;, porque un DOTS calculado con la
            fórmula equivocada es un dato falso que además ordena mal el ranking, y nadie lo
            notaría — el número igual parece razonable.
          </p>

          <h4>Por qué tus amigos ven una banda y no el número</h4>
          <p>
            Tus amigos ven lo que levantás, igual que ven tus días. Y el DOTS es una función de lo
            que levantás y de tu peso corporal. O sea que si publicáramos el número exacto al lado
            del total, cualquiera podría <em>despejar</em> tu peso corporal con una cuenta de dos
            líneas.
          </p>
          <p>
            Por eso hacia afuera va una banda —400 a 450, por ejemplo—, que deja el dato en un
            intervalo demasiado ancho para que sirva. El número exacto lo ves solo vos.
          </p>
          <p>
            La banda no lo esconde del todo, y eso también te lo decimos cuando cargás el sexo. Es
            la razón de que la app te avise en vez de dejarlo pasar.
          </p>

          <h4>Por qué el ranking global es un porcentaje</h4>
          <p>
            Entre amigos hay posiciones, porque se conocen: nadie infla un número que van a
            comprobar el jueves en el gimnasio.
          </p>
          <p>
            En un ranking global de desconocidos es al revés — ser el número uno es exactamente el
            premio que hace que valga la pena mentir, y no hay forma de verificar una marca desde
            una app. Por eso el global no tiene puestos ni nombres, solo un percentil: nadie infla
            una marca para pasar del 12% al 11%, porque ahí no hay nada que ganar.
          </p>

          <h4>Tu peso corporal</h4>
          <p>
            No se muestra nunca. Ni en tu perfil, ni entre amigos, ni en ningún ranking. Se usa
            para la cuenta y no sale de la base: los cálculos los hace el servidor y devuelve el
            resultado, nunca el peso.
          </p>
        </div>
      )}
    </div>
  );
}
