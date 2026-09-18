'use client';

import { pesoCorto, type Unidad } from '@nucleo/peso';
import { REPETICIONES_PARA_MARCA } from '@nucleo/marcaSugerida';
import { T } from '@nucleo/textos';
import { useMarcaEnElMomento } from '@compartido/marcaSugerida';
import type { EstadoBloques } from '@nucleo/bloques';

/**
 * "¿LO GUARDO COMO MARCA?", DEBAJO DEL BLOQUE, al confirmar la serie que puede
 * serlo (18/9). Antes llegaba recién en el resumen del final, lejos de la serie.
 * Qué se propone lo decide `nucleo/marcaSugerida.ts` y lo mira
 * `useMarcaEnElMomento`; acá solo se dibuja, con el mismo texto y los mismos
 * botones que el resumen.
 *
 * NO TAPA NADA: va debajo del bloque, y el `+` sigue andando mientras está a la
 * vista. Contestar es un toque; no contestar también es una respuesta.
 */
export default function MarcaEnElMomento({
  bloques,
  inicio,
  unidad,
}: {
  bloques: EstadoBloques;
  inicio: string | null;
  unidad: Unidad;
}) {
  const { actual: s, guardar, descartar } = useMarcaEnElMomento(bloques, inicio);
  if (!s) return null;
  return (
    <div className="marcas-sugeridas en-el-momento" role="status">
      <div className="marca-sugerida">
        <p>
          {(s.antes === null ? T.marcaSugerida.primera : T.marcaSugerida.puedeSerMarca)(pesoCorto(s.peso, unidad), unidad, s.nombre)}
        </p>
        {s.estado === 'guardada' ? (
          <p className="hecho">{s.esNueva ? T.marcaSugerida.guardadaEsNueva : T.marcaSugerida.guardada}</p>
        ) : s.estado === 'fallo' ? (
          <p className="hecho">{T.marcaSugerida.fallo}</p>
        ) : (
          <>
            <span className="cuantas">{T.marcaSugerida.cuantas}</span>
            <div className="reps">
              {REPETICIONES_PARA_MARCA.map((r) => (
                <button key={r} disabled={s.estado === 'guardando'} onClick={() => guardar(r)}>
                  {r}
                </button>
              ))}
              <button className="no" onClick={descartar}>
                {T.marcaSugerida.no}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
