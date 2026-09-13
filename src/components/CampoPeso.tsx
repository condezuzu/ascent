'use client';

import { useEffect, useState } from 'react';
import { aKilos, pasoDePeso, pesoCorto, type Unidad } from '@nucleo/peso';
import { pesoValido } from '@nucleo/bloques';
import { T } from '@nucleo/textos';

/**
 * EL PESO, escrito una vez.
 *
 * NO ES UN FORMULARIO. Es un número al lado del ejercicio que se deja quieto
 * mientras no cambie. Cuatro series con 60 son un "60" escrito una vez y cuatro
 * `+`. Si subís, un toque en el `+` chico —el disco más chico: 2,5 kg o 5 lb—
 * o se escribe otro número.
 *
 * VACÍO ESTÁ BIEN. Sin peso las series se anotan sin peso y no pasa nada: no
 * hay rojo, no hay "falta completar". Es la regla 4 de `nucleo/bloques.ts`.
 *
 * El número se confirma al salir del campo o con Enter, no a cada tecla: con
 * "6" a medio escribir "60" se anotaría una serie de 6 kilos si justo tocás el
 * `+` grande.
 */
export default function CampoPeso({
  kg,
  unidad,
  alCambiar,
  compacto = false,
  etiqueta,
}: {
  /** El peso actual, en kilos. `undefined` o `null` = sin peso. */
  kg: number | null | undefined;
  unidad: Unidad;
  alCambiar: (kg: number | null) => void;
  /** En la lista: sin los botones de más y menos. */
  compacto?: boolean;
  etiqueta?: string;
}) {
  const mostrar = (v: number | null | undefined) => (v ? pesoCorto(v, unidad) : '');
  const [texto, setTexto] = useState(mostrar(kg));

  // Si el peso cambia desde afuera —llegó el último que usaste, o se tocó un
  // paso— el campo lo refleja. Mientras se escribe no, porque `kg` no cambia
  // hasta confirmar.
  useEffect(() => {
    setTexto(mostrar(kg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kg, unidad]);

  function confirmar() {
    const escrito = texto.trim();
    if (escrito === '') {
      if (kg) alCambiar(null);
      return;
    }
    const v = pesoValido(escrito);
    const enKilos = v === null ? null : pesoValido(aKilos(v, unidad));
    if (enKilos === (kg ?? null)) return setTexto(mostrar(kg));
    alCambiar(enKilos);
    setTexto(mostrar(enKilos));
  }

  function paso(signo: 1 | -1) {
    if (!kg) return;
    const actual = Number(pesoCorto(kg, unidad));
    const nuevo = Math.max(0, actual + signo * pasoDePeso(unidad));
    alCambiar(nuevo === 0 ? null : pesoValido(aKilos(nuevo, unidad)));
  }

  return (
    <span className={`campo-peso ${compacto ? 'compacto' : ''}`}>
      {!compacto && (
        <button className="peso-paso" onClick={() => paso(-1)} disabled={!kg} aria-label={T.sesion.pesoBajar}>
          −
        </button>
      )}
      <label className="peso-caja">
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          value={texto}
          placeholder={compacto ? T.sesion.sinPeso : ''}
          aria-label={etiqueta ?? T.sesion.pesoDelBloque}
          onChange={(e) => setTexto(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 6))}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <span className="peso-unidad">{unidad}</span>
      </label>
      {!compacto && (
        <button className="peso-paso" onClick={() => paso(1)} disabled={!kg} aria-label={T.sesion.pesoSubir}>
          +
        </button>
      )}
    </span>
  );
}
