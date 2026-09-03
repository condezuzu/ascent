'use client';

import { useState } from 'react';
import { FUENTE } from '@nucleo/estandares';
import { T } from '@nucleo/textos';

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
        <h3>{T.ajustes.comoSeCompara}</h3>
        <span>{abierto ? '−' : '+'}</span>
      </button>

      {abierto && (
        <div className="texto-largo">
          <p>
            El problema de comparar fuerza es que 100 kg no significan lo mismo en alguien de 60
            que en alguien de 100. Si se comparara el peso levantado a secas, el ranking lo ganaría
            siempre el más pesado y no diría nada.
          </p>
          <p>
            Se usa <strong>DOTS</strong>, que es el estándar del powerlifting fuera de la IPF.
            Toma lo que levantas y tu peso corporal, y devuelve un número comparable entre
            personas de distinto tamaño. Los coeficientes son los de OpenPowerlifting, no
            inventados aquí.
          </p>

          <h4>Qué entra</h4>
          <p>
            Solo tres: <strong>sentadilla, press de banca y peso muerto</strong>. La fórmula está
            calibrada sobre esos tres, así que sumarle otros ejercicios no la haría más completa
            —la invalidaría—: el número dejaría de ser comparable con el de cualquier otra
            persona, que es lo único que lo hace valer.
          </p>
          <p>
            Puedes anotar todos los ejercicios que quieras y ver tu progreso, pero solo esos tres
            mueven el número.
          </p>
          <p>
            Si anotaste un peso levantado varias veces, se calcula cuánto levantarías de una vez.
            Con una sola repetición no hay nada que calcular: es el peso.
          </p>

          <h4>Por qué se pide el sexo</h4>
          <p>
            La fórmula tiene dos juegos de coeficientes. Sin ese dato no hay número: no se asume
            ninguno ni se usa uno &ldquo;por defecto&rdquo;, porque un DOTS calculado con la
            fórmula equivocada es un dato falso que además ordena mal el ranking, y nadie lo
            notaría — el número igual parece razonable.
          </p>

          <h4>Qué ven tus amigos, y qué se puede deducir</h4>
          <p>
            Tus amigos ven tu DOTS <strong>exacto</strong>, el mismo número que ves tú. Antes se
            mostraba un intervalo, y el motivo era este: tus amigos también ven lo que levantas, y
            el DOTS es una función de lo que levantas y de tu peso corporal. Con las dos cosas a la
            vista, cualquiera puede <em>despejar</em> tu peso corporal con una cuenta de dos
            líneas.
          </p>
          <p>
            Eso sigue siendo cierto. Lo que cambió es la decisión: entre amigos que se ven en el
            gimnasio, un intervalo ancho escondía poco y arruinaba la comparación, que es para lo
            que sirve el ranking. Así que el número va exacto y la consecuencia se acepta.
          </p>
          <p>
            Por eso la app avisa al activar el DOTS, que es el momento en que todavía se puede
            decidir no hacerlo: sin sexo cargado no hay número, y sin número no hay nada que
            deducir.
          </p>

          <h4>Contra quién te compara</h4>
          <p>
            Contra <strong>gente que anota sus levantamientos en una app</strong>, de tu sexo y de
            tu peso corporal. Los datos son los estándares {FUENTE.edicion} de{' '}
            <strong>{FUENTE.nombre}</strong>, armados con levantamientos que la comunidad cargó
            entre {FUENTE.desde} y {FUENTE.hasta}. Son datos declarados por los usuarios, sin
            verificar.
          </p>
          <p>
            Esa población está elegida a propósito. La otra opción eran los competidores de
            powerlifting federado, y ahí la mediana está en 2,28 veces el peso corporal en
            sentadilla: alguien de 80 kg que levanta 130 kg —que es la mitad justa de la gente que
            usa apps— quedaría casi último. Comparar el gimnasio del barrio contra una competencia
            no lo hace más exigente, lo hace falso.
          </p>
          <p>
            Ninguna de las dos poblaciones es &ldquo;el mundo&rdquo;, y esta tampoco: quien anota
            sus series en una app ya entrena más que el promedio.
          </p>
          <p>
            La cuenta se hace <strong>en tu teléfono</strong>, con una tabla que viene dentro de la
            app. No se consulta ningún servicio y funciona sin internet.
          </p>

          <h4>La categoría y el porcentaje</h4>
          <p>
            Lo que publica la fuente son las cinco categorías —principiante, novato, intermedio,
            avanzado y élite—, y cada una es un punto de la distribución: intermedio es la mitad de
            la gente, élite es el 5% de arriba. El <strong>porcentaje sale de ahí</strong>,
            interpolando entre esos cinco puntos. Por eso la categoría es el dato firme y el número
            es una estimación.
          </p>
          <p>
            <strong>En mujeres, el número pide más cautela.</strong> En todas las fuentes la
            muestra de mujeres es mucho más chica: en press de banca hay un millón de resultados
            contra casi diez millones de hombres. La app lo avisa ahí mismo.
          </p>

          <h4>Por qué el global no tiene puestos</h4>
          <p>
            Entre amigos hay posiciones, porque se conocen: nadie infla un número que van a
            comprobar el jueves en el gimnasio.
          </p>
          <p>
            En un ranking global de desconocidos es al revés — ser el número uno es exactamente el
            premio que hace que valga la pena mentir, y no hay forma de verificar una marca desde
            una app. Por eso el global no tiene puestos ni nombres, solo un porcentaje: nadie infla
            una marca para pasar del 12% al 11%, porque ahí no hay nada que ganar.
          </p>

          <h4>Tu peso corporal</h4>
          <p>
            No se muestra nunca. Ni en tu perfil, ni entre amigos, ni en ningún ranking. El DOTS lo
            calcula el servidor y devuelve el resultado, nunca el peso; el porcentaje contra la
            tabla se calcula en tu teléfono y no sale de ahí.
          </p>
          <p>
            Lo que sí puede pasar, como dice más arriba, es que alguien lo <em>deduzca</em> a
            partir de tu DOTS y de tus marcas. Una cosa es no publicar un dato y otra es que sea
            imposible de inferir: aquí se cumple la primera, no la segunda.
          </p>
        </div>
      )}
    </div>
  );
}
