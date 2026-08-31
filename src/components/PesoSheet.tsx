'use client';

import { useState } from 'react';
import AnotarPeso from '@/components/AnotarPeso';
import { T } from '@nucleo/textos';
import type { Unidad } from '@nucleo/peso';

/**
 * Anotar el peso, y NADA MÁS.
 *
 * Existe porque el peso vivía adentro de la hoja de registrar el día, y eso
 * lo ataba a haber entrenado: el que se pesaba un domingo y no iba al
 * gimnasio se registraba el día sin querer, y la racha contaba un día que no
 * existió. Un número inflado en la única cifra que la app dice que importa.
 *
 * El peso se anota a la mañana, antes de entrenar o sin entrenar. No tiene
 * nada que ver con el día de gimnasio y por eso ahora tiene su propia puerta.
 */
export default function PesoSheet({
  unidad,
  alCerrar,
  alGuardar,
}: {
  unidad: Unidad;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [cerrando, setCerrando] = useState(false);

  function cerrar() {
    setCerrando(true);
    setTimeout(alCerrar, 200);
  }

  return (
    <>
      <div className={`hoja-fondo ${cerrando ? 'cerrando' : ''}`} onClick={cerrar} />
      <div className={`hoja ${cerrando ? 'cerrando' : ''}`} role="dialog" aria-modal>
        <h2>{T.peso.titulo}</h2>
        <p className="sub">{T.peso.sub}</p>
        <AnotarPeso
          unidad={unidad}
          alGuardar={() => {
            alGuardar();
            cerrar();
          }}
        />
        <button className="boton-texto" style={{ marginTop: 14 }} onClick={cerrar}>
          {T.general.cancelar}
        </button>
      </div>
    </>
  );
}
