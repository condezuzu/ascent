'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cuantosLevantan, type Medalla as Dato } from '@nucleo/medallas';
import { T } from '@nucleo/textos';
import Medalla from './Medalla';

/**
 * LAS MEDALLAS AL LADO DEL NOMBRE, y el globo al tocar una. La misma pieza que
 * `movil/src/Medallas.tsx`, con las clases de `globals.css`.
 *
 * ES UN GLOBO QUE SALE DE LA MEDALLA, no un cartel debajo (24/9, a pedido). Un
 * cartel es una sección más de la pantalla: aparece, se queda, y hay que
 * cerrarlo. Un globo con una punta que apunta a la medalla que tocaste dice de
 * quién está hablando sin nombrarlo, y se va solo a los dos segundos.
 *
 * LA PUNTA SE CALCULA, PERO HAY QUE MEDIR DÓNDE EMPIEZAN LAS MEDALLAS: entre
 * ellas la cuenta alcanza, pero la fila arranca con el NOMBRE, que mide lo que
 * mida. Sin ese corrimiento el globo apunta al nombre.
 */

/** Cuánto queda a la vista antes de irse solo. */
const DURA_MS = 2000;
/** La separación de la fila, que la punta necesita para apuntar. */
const SEPARACION = 7;

export default function Medallas({
  medallas,
  nombre,
  tam = 24,
}: {
  medallas: readonly Dato[];
  /** El nombre, que va en la misma fila. */
  nombre?: ReactNode;
  tam?: number;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [desdeX, setDesdeX] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const elegida = medallas.find((m) => m.zona === abierta) ?? null;
  const cual = medallas.findIndex((m) => m.zona === abierta);

  // SE VA SOLA A LOS DOS SEGUNDOS, y el temporizador se rearma con cada medalla
  // que se abre: tocar otra no deja el globo nuevo con el tiempo de la anterior.
  useEffect(() => {
    if (!abierta) return;
    setDesdeX(caja.current?.offsetLeft ?? 0);
    const t = setTimeout(() => setAbierta(null), DURA_MS);
    return () => clearTimeout(t);
  }, [abierta]);

  return (
    <div className="medallas-envoltura">
      <div className="medallas-fila">
        {nombre}
        <div className="medallas-grupo" ref={caja}>
          {medallas.map((m) => (
            <button
              key={m.zona}
              type="button"
              className="medallas-una"
              onClick={() => setAbierta(abierta === m.zona ? null : m.zona)}
              aria-label={frase(m)}
            >
              <Medalla zona={m.zona} material={m.material} tam={tam} />
            </button>
          ))}
        </div>
      </div>

      {elegida && cual >= 0 && (
        <div className="medallas-globo" aria-hidden>
          <div
            className="medallas-punta"
            style={{ left: desdeX + cual * (tam + SEPARACION) + tam / 2 - 5 }}
          />
          <div className="medallas-cuerpo">{frase(elegida)}</div>
        </div>
      )}
    </div>
  );
}

/**
 * LO QUE DICE, en una línea: el músculo y la frase.
 *
 * "Cuádriceps · Solo el 12% levanta esa marca."
 *
 * EL MATERIAL YA NO SE NOMBRA (25/9, a pedido): *"sacá los nombres de
 * material. Nada de Luna, Planeta. Que el material solo cambie el color, sin
 * nombrarlo."* Estaba por un argumento que sonaba bien —a este tamaño la luna
 * y el planeta se parecen, y sin la palabra no se sabe cuál te tocó— y el
 * argumento tenía el problema adentro: si hay que escribir qué es, el dibujo
 * no está diciendo nada. El material vuelve a ser lo que tiene que ser, una
 * escala de color, y la línea se queda con lo único que es un dato: el número.
 *
 * (Lo sigue diciendo la etiqueta del lector de pantalla, y ahí sí corresponde:
 * quien no ve el color no tiene de dónde sacarlo.)
 *
 * EL MÚSCULO Y NO LA ZONA: decía "Brazos" y "Piernas", que son los cajones del
 * selector de ejercicios, no lo que la medalla mide. Ver `T.medallas.zonas`.
 *
 * LA GALAXIA NO DICE PORCENTAJE: diría el mismo número que estrella, y en el
 * escalón más alto queda plano. Dice qué la ganó.
 */
function frase(m: Dato): string {
  const cola =
    m.material === 'galaxia' ? T.medallas.galaxia : T.medallas.frase(cuantosLevantan(m.percentil));
  return `${T.medallas.zonas[m.zona]} · ${cola}`;
}

/**
 * LAS MEDALLAS Y NADA MÁS, sin tocar. Para Inicio, donde la fila del nombre YA
 * es un enlace al perfil: una medalla que se abriera ahí competiría con ese
 * toque. Se ven; para saber qué son, se entra al perfil.
 */
export function FilaDeMedallas({ medallas, tam = 16 }: { medallas: readonly Dato[]; tam?: number }) {
  if (medallas.length === 0) return null;
  return (
    <span className="medallas-sueltas" aria-hidden>
      {medallas.map((m) => (
        <Medalla key={m.zona} zona={m.zona} material={m.material} tam={tam} />
      ))}
    </span>
  );
}
