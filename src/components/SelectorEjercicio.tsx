'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Ejercicio } from '@nucleo/tipos';
import { ORDEN_ZONAS, gruposDeZona, zonaDeGrupo, type Zona } from '@nucleo/ejercicios';
import { T } from '@nucleo/textos';

/**
 * ELEGIR ENTRE CIEN EJERCICIOS, NAVEGANDO.
 *
 * Era un `<select>` nativo con las cien opciones adentro. Con 31 se defendía
 * —el selector del sistema es grande y conocido—, pero con cien la rueda se
 * vuelve un rollo de nombres que hay que leer entero, y el encabezado del
 * grupo se va de pantalla a los pocos renglones. Se elegía lo primero que se
 * pareciera, o no se elegía.
 *
 * Ahora son dos toques: zona y músculo, y ahí la lista. Ver
 * `nucleo/ejercicios.ts` para por qué ese árbol y no otro.
 *
 * ATAJOS ARRIBA. Los tres que cuentan para el DOTS van primero y sueltos: son
 * los que más se anotan y los únicos que mueven el número de fuerza. Que
 * estén a un toque no es un privilegio de diseño, es la frecuencia real.
 *
 * UNA ZONA CON UN SOLO MÚSCULO NO PREGUNTA DOS VECES: tren inferior y core
 * llevan directo a la lista. Un paso intermedio con una sola opción es un
 * toque que no decide nada.
 */
export default function SelectorEjercicio({
  ejercicios,
  valor,
  permiteNinguno = false,
  alElegir,
  alCerrar,
}: {
  ejercicios: Ejercicio[];
  valor: string | null;
  /** El contador de series admite "cualquier cosa"; las marcas no. */
  permiteNinguno?: boolean;
  alElegir: (id: string | null) => void;
  alCerrar: () => void;
}) {
  const [cerrando, setCerrando] = useState(false);
  // Dónde estamos: sin zona es la primera pantalla; con zona y grupo, la
  // lista. Arranca donde está lo que ya tenías elegido, para que "cambiar de
  // press inclinado a press declinado" no obligue a bajar todo el árbol.
  const actual = ejercicios.find((e) => e.id === valor) ?? null;
  const [zona, setZona] = useState<Zona | null>(
    actual && !actual.cuenta_dots ? zonaDeGrupo(actual.grupo) : null
  );
  const [grupo, setGrupo] = useState<string | null>(
    actual && !actual.cuenta_dots ? actual.grupo : null
  );

  const grupos = [...new Set(ejercicios.map((e) => e.grupo))];
  const delDots = ejercicios.filter((e) => e.cuenta_dots);

  function cerrar() {
    setCerrando(true);
    setTimeout(alCerrar, 200);
  }

  function elegir(id: string | null) {
    alElegir(id);
    cerrar();
  }

  function abrirZona(z: Zona) {
    const suyos = gruposDeZona(z, grupos);
    setZona(z);
    setGrupo(suyos.length === 1 ? suyos[0] : null);
  }

  function volver() {
    if (grupo && gruposDeZona(zona as Zona, grupos).length > 1) setGrupo(null);
    else {
      setZona(null);
      setGrupo(null);
    }
  }

  const lista = grupo ? ejercicios.filter((e) => e.grupo === grupo && !e.cuenta_dots) : [];

  // AL FINAL DEL BODY, y no donde está el botón. Una hoja abierta desde el
  // medio de una pantalla queda atrapada en el contexto de apilado de esa
  // pantalla —`.pantalla` tiene z-index— y termina POR DEBAJO de la barra de
  // navegación, que vive afuera. Las otras hojas de la app no tenían el
  // problema por casualidad: se montan sueltas al final de la página.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;

  return createPortal(
    <>
      <div className={`hoja-fondo ${cerrando ? 'cerrando' : ''}`} onClick={cerrar} />
      <div className={`hoja selector-ejercicio ${cerrando ? 'cerrando' : ''}`} role="dialog" aria-modal>
        <div className="selector-cabecera">
          {zona && (
            <button className="selector-volver" onClick={volver} aria-label={T.general.volver}>
              ←
            </button>
          )}
          {/* El nombre del músculo va con inicial mayúscula —viene en
              minúscula de la base— pero el título de la primera pantalla no:
              con `capitalize` a secas quedaba "En Qué Estás". */}
          <h2 className={grupo ? 'capitalizado' : ''}>
            {grupo ?? (zona ? T.ejercicios[zona] : T.sesion.queEstasHaciendo)}
          </h2>
        </div>

        {!zona && (
          <>
            {permiteNinguno && (
              <button className="selector-fila" onClick={() => elegir(null)}>
                {T.sesion.sinEjercicio}
              </button>
            )}
            {/* Los tres del DOTS, sueltos y arriba, con UN rótulo para los
                tres: repetir "cuentan para el DOTS" en cada fila era decir
                tres veces lo mismo en tres renglones seguidos. */}
            <div className="selector-rotulo">{T.marca.cuentanDots}</div>
            {delDots.map((e) => (
              <button
                key={e.id}
                className={`selector-fila ${e.id === valor ? 'elegido' : ''}`}
                onClick={() => elegir(e.id)}
              >
                {e.nombre}
              </button>
            ))}
            {ORDEN_ZONAS.filter((z) => gruposDeZona(z, grupos).length > 0).map((z) => (
              <button key={z} className="selector-fila zona" onClick={() => abrirZona(z)}>
                {T.ejercicios[z]}
                <span className="apagado">›</span>
              </button>
            ))}
          </>
        )}

        {zona && !grupo && (
          <>
            {gruposDeZona(zona, grupos).map((g) => (
              <button key={g} className="selector-fila zona" onClick={() => setGrupo(g)}>
                {g}
                <span className="apagado">
                  {ejercicios.filter((e) => e.grupo === g && !e.cuenta_dots).length}
                </span>
              </button>
            ))}
          </>
        )}

        {grupo && (
          <div className="selector-lista">
            {lista.map((e) => (
              <button
                key={e.id}
                className={`selector-fila ${e.id === valor ? 'elegido' : ''}`}
                onClick={() => elegir(e.id)}
              >
                {e.nombre}
              </button>
            ))}
          </div>
        )}

        <button className="boton-texto" style={{ marginTop: 14 }} onClick={cerrar}>
          {T.general.cancelar}
        </button>
      </div>
    </>,
    document.body
  );
}
