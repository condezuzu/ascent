'use client';

import { useState, type ReactNode } from 'react';
import { cuantosLevantan, type Medalla as Dato } from '@nucleo/medallas';
import { T } from '@nucleo/textos';
import Medalla from './Medalla';

/**
 * LAS MEDALLAS AL LADO DEL NOMBRE, y la ventanita al tocar una. La misma pieza
 * que `movil/src/Medallas.tsx`, con las clases de `globals.css`.
 *
 * AL LADO Y NO DEBAJO, y del alto del nombre. La primera versión las puso
 * debajo y chicas por miedo a que un nombre largo las empujara afuera; el
 * miedo estaba mal resuelto. Se arregla envolviendo la fila, que es lo que
 * hace cualquier línea de texto, no escondiéndolas de entrada.
 *
 * POR ESO RECIBE EL NOMBRE: la fila es nombre + medallas y la ventanita va
 * debajo de las dos.
 */
export default function Medallas({
  medallas,
  nombre,
  tam = 24,
  nombres,
}: {
  medallas: readonly Dato[];
  /** El nombre, que va en la misma fila. */
  nombre?: ReactNode;
  tam?: number;
  /** El nombre lindo de cada ejercicio, que sale del catálogo. */
  nombres?: Readonly<Record<string, string>>;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const elegida = medallas.find((m) => m.zona === abierta) ?? null;

  return (
    <div>
      <div className="medallas-fila">
        {nombre}
        {medallas.map((m) => (
          <button
            key={m.zona}
            type="button"
            className="medallas-una"
            onClick={() => setAbierta(abierta === m.zona ? null : m.zona)}
            aria-label={T.medallas.etiqueta(T.medallas.zonas[m.zona], T.medallas.materiales[m.material])}
            aria-expanded={abierta === m.zona}
          >
            <Medalla zona={m.zona} material={m.material} tam={tam} />
          </button>
        ))}
      </div>

      {elegida && (
        <div className="medallas-ventana">
          {/* EL MATERIAL, DICHO. A este tamaño la luna y el planeta se parecen
              —gris azulado contra azul— y no había forma de saber cuál te tocó
              sin comparar dos medallas lado a lado. */}
          <div className="medallas-rotulo">
            {elegida.material === 'galaxia'
              ? T.medallas.materiales.galaxia
              : `${nombres?.[elegida.ejercicio] ?? T.medallas.zonas[elegida.zona]} · ${T.medallas.materiales[elegida.material]}`}
          </div>
          <div className="medallas-frase">
            {elegida.material === 'galaxia'
              ? T.medallas.galaxia
              : T.medallas.frase(cuantosLevantan(elegida.percentil))}
          </div>
        </div>
      )}
    </div>
  );
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
