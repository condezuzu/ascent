'use client';

// Propuesta: preguntar antes de quitar el punto del gimnasio.
//
// Hoy es un toque, pegado al botón de volver a marcarlo, y lo que borra solo se
// recupera estando parado en el gimnasio. Terminar la sesión y quitar un bloque
// ya preguntan; esto no.

import { useState } from 'react';
import FondoEspacial from '@/components/FondoEspacial';
import { T } from '@nucleo/textos';
import { Banco, Comparar, Lado } from '../Banco';

function MiGimnasio({ pregunta, abierta = false }: { pregunta: boolean; abierta?: boolean }) {
  const [puesto, setPuesto] = useState(true);
  const [preguntando, setPreguntando] = useState(abierta);

  return (
    <div className="seccion" style={{ marginBottom: 0 }}>
      <h3>{T.ajustes.gimnasio}</h3>

      <button className="boton-fantasma" onClick={() => setPuesto(true)}>
        {puesto ? T.ajustes.gimnasioRemarcar : T.ajustes.gimnasioMarcar}
      </button>

      <p className="nota-privada">
        <strong>{T.ajustes.gimnasioComo}</strong> {T.ajustes.gimnasioParaQue}
      </p>

      {puesto &&
        (preguntando ? (
          // El mismo gesto que "Terminar" en Inicio: el botón se vuelve la
          // pregunta en su lugar, sin ventana encima.
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--tinta)' }}>¿Borrar el punto?</p>
            <p className="nota-privada" style={{ margin: '0 0 8px' }}>
              Para volver a marcarlo hay que estar en el gimnasio.
            </p>
            <div style={{ display: 'flex', gap: 22 }}>
              <button
                className="boton-fantasma"
                style={{ color: 'var(--peligro)', borderColor: 'color-mix(in srgb, var(--peligro) 50%, transparent)' }}
                onClick={() => {
                  setPuesto(false);
                  setPreguntando(false);
                }}
              >
                Sí, borrarlo
              </button>
              <button className="boton-fantasma" onClick={() => setPreguntando(false)}>
                Mejor no
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="nota-privada">{T.ajustes.gimnasioPuesto}</p>
            <button className="boton-fantasma" onClick={() => (pregunta ? setPreguntando(true) : setPuesto(false))}>
              {T.ajustes.gimnasioBorrar}
            </button>
          </>
        ))}
    </div>
  );
}

export default function PropuestaQuitarElPunto() {
  return (
    <>
      <FondoEspacial rango={2} esquina="arriba-derecha" velo={0.74} />
      <Banco
        titulo="Quitar el punto del gimnasio: preguntar antes"
        queEs="La sección «Mi gimnasio» de Ajustes, con el punto ya marcado. Los dos lados se pueden tocar."
      >
        <Comparar>
          <Lado rotulo="Hoy" nota="Un toque y el punto se fue: el registro automático queda apagado hasta volver al gimnasio a marcarlo.">
            <MiGimnasio pregunta={false} />
          </Lado>
          <Lado
            rotulo="Propuesta · después del primer toque"
            nota="El botón se vuelve la pregunta en su lugar, como «Terminar» en Inicio. Dice lo que cuesta deshacerlo."
          >
            <MiGimnasio pregunta abierta />
          </Lado>
        </Comparar>
      </Banco>
    </>
  );
}
