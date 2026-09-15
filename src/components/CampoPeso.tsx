'use client';

import { useEffect, useState } from 'react';
import type { Unidad } from '@nucleo/peso';
import { confirmarCampo, limpiarTecleo, pasoDelCampo, textoDelCampo } from '@nucleo/campoPeso';
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
  const mostrar = (v: number | null | undefined) => textoDelCampo(v, unidad);
  const [texto, setTexto] = useState(mostrar(kg));

  // Si el peso cambia desde afuera —llegó el último que usaste, o se tocó un
  // paso— el campo lo refleja. Mientras se escribe no, porque `kg` no cambia
  // hasta confirmar.
  useEffect(() => {
    setTexto(mostrar(kg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kg, unidad]);

  // Las cuentas están en `nucleo/campoPeso.ts`, probadas: el texto tiene coma
  // y no se vuelve a leer con `Number`.
  function confirmar() {
    const r = confirmarCampo(texto, kg, unidad);
    if (!r.cambia) return setTexto(mostrar(kg));
    alCambiar(r.kg);
    setTexto(mostrar(r.kg));
  }

  function paso(signo: 1 | -1) {
    const nuevo = pasoDelCampo(kg, unidad, signo);
    if (nuevo !== undefined) alCambiar(nuevo);
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
          onChange={(e) => setTexto(limpiarTecleo(e.target.value))}
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
