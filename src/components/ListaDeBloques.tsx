'use client';

import { useState } from 'react';
import EnElBody from '@/components/EnElBody';
import type { EstadoBloques } from '@nucleo/bloques';
import type { Ejercicio } from '@nucleo/tipos';
import type { Unidad } from '@nucleo/peso';
import CampoPeso from '@/components/CampoPeso';
import { T } from '@nucleo/textos';

/**
 * LO QUE LLEVÁS HECHO EN ESTA SESIÓN, Y CÓMO CORREGIRLO.
 *
 * POR QUÉ EXISTE. El `−` solo arregla el bloque en curso. Si contaste una
 * serie de más en sentadilla y ya pasaste a otra cosa, no había ninguna forma
 * de volver — el número quedaba mal para siempre, y un contador que no se
 * puede corregir deja de creerse a los tres días.
 *
 * SE ABRE A PEDIDO y no está siempre a la vista: corregir pasa una vez cada
 * tantas sesiones, y sumar pasa doce veces por sesión. Lo que se usa siempre
 * manda en la pantalla; lo que se usa a veces vive detrás de un botón.
 *
 * EL BLOQUE EN CURSO SE VE PERO NO SE TOCA DESDE ACÁ: ese ya tiene su `+` y su
 * `−` afuera, más grandes y sin abrir nada. Dos formas de hacer lo mismo en
 * dos lugares distintos es cómo se aprende a desconfiar de las dos.
 */
export default function ListaDeBloques({
  estado,
  ejercicios,
  unidad,
  anotarPeso,
  alCorregirPeso,
  alTocar,
  alCerrar,
}: {
  estado: EstadoBloques;
  ejercicios: Ejercicio[];
  unidad: Unidad;
  anotarPeso: boolean;
  alCorregirPeso: (indice: number, serie: number, kg: number | null) => void;
  alTocar: (indice: number, delta: number | 'quitar') => void;
  alCerrar: () => void;
}) {
  const [cerrando, setCerrando] = useState(false);
  const [porQuitar, setPorQuitar] = useState<number | null>(null);

  function cerrar() {
    setCerrando(true);
    setTimeout(alCerrar, 200);
  }

  const nombre = (id: string | null) =>
    id ? (ejercicios.find((e) => e.id === id)?.nombre ?? id) : T.sesion.sinEjercicio;

  const nada = estado.cerrados.length === 0 && estado.hechas === 0;
  // Sin ejercicio no hay peso que corregir; y un ejercicio que no admite peso
  // (una plancha) tampoco muestra casilleros vacíos.
  const admitePeso = (id: string | null) =>
    id !== null && ejercicios.find((e) => e.id === id)?.admite_peso !== false;

  return (
    <EnElBody>
      <div className={`hoja-fondo ${cerrando ? 'cerrando' : ''}`} onClick={cerrar} />
      <div className={`hoja ${cerrando ? 'cerrando' : ''}`} role="dialog" aria-modal>
        <h2>{T.sesion.listaTitulo}</h2>

        {nada ? (
          <p className="sub">{T.sesion.listaVacia}</p>
        ) : (
          <div className="lista-bloques">
            {estado.cerrados.map((b, i) => (
              <div className="fila-bloque" key={i}>
                <span className="que">{nombre(b.ejercicio)}</span>

                {porQuitar === i ? (
                  <span className="confirmar">
                    <span>{T.sesion.listaQuitarPregunta}</span>
                    <button
                      className="boton-texto"
                      onClick={() => {
                        alTocar(i, 'quitar');
                        setPorQuitar(null);
                      }}
                    >
                      {T.album.si}
                    </button>
                    <button className="boton-texto" onClick={() => setPorQuitar(null)}>
                      {T.album.no}
                    </button>
                  </span>
                ) : (
                  <span className="controles">
                    <button
                      className="paso"
                      onClick={() => alTocar(i, -1)}
                      disabled={b.series === 0}
                      aria-label={T.inicio.sacarSerie}
                    >
                      −
                    </button>
                    <span className="cuantas">{b.series}</span>
                    <button
                      className="paso"
                      onClick={() => alTocar(i, 1)}
                      aria-label={T.inicio.sumarSerie}
                    >
                      +
                    </button>
                    <button
                      className="quitar"
                      onClick={() => setPorQuitar(i)}
                      aria-label={T.sesion.listaQuitar}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" />
                      </svg>
                    </button>
                  </span>
                )}
                {/* LOS PESOS DE CADA SERIE, corregibles de a uno: la serie que
                    salió con otro peso se arregla sin tocar cuántas fueron. Solo
                    si se anota peso y el ejercicio lo admite. */}
                {anotarPeso && b.series > 0 && admitePeso(b.ejercicio) && (
                  <span className="pesos-serie">
                    {Array.from({ length: b.series }, (_, s) => (
                      <CampoPeso
                        key={s}
                        compacto
                        kg={b.pesos?.[s]}
                        unidad={unidad}
                        etiqueta={T.sesion.pesoDeSerie(s + 1)}
                        alCambiar={(kg) => alCorregirPeso(i, s, kg)}
                      />
                    ))}
                  </span>
                )}
              </div>
            ))}

            {/* El de ahora, a la vista pero sin controles: se toca afuera. */}
            {estado.hechas > 0 && (
              <div className="fila-bloque ahora">
                <span className="que">{nombre(estado.ejercicio)}</span>
                <span className="controles">
                  <span className="cuantas">{estado.hechas}</span>
                  <span className="rotulo">{T.sesion.listaAhora}</span>
                </span>
                {/* Los pesos del bloque en curso SÍ se corrigen desde acá: el
                    + y el − de afuera cuentan series, no arreglan pesos. */}
                {anotarPeso && admitePeso(estado.ejercicio) && (
                  <span className="pesos-serie">
                    {Array.from({ length: estado.hechas }, (_, s) => (
                      <CampoPeso
                        key={s}
                        compacto
                        kg={estado.pesos?.[s]}
                        unidad={unidad}
                        etiqueta={T.sesion.pesoDeSerie(s + 1)}
                        alCambiar={(kg) => alCorregirPeso(-1, s, kg)}
                      />
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <button className="boton-solido" onClick={cerrar} style={{ marginTop: 18 }}>
          {T.sesion.listo}
        </button>
      </div>
    </EnElBody>
  );
}
