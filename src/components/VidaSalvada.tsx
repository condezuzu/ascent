'use client';

import { useEffect, useRef, useState } from 'react';
import Vidas from '@/components/Vidas';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { plataforma } from '@/plataforma';

/**
 * "FALTASTE Y LA RACHA SIGUIÓ." La ventana del día siguiente.
 *
 * POR QUÉ ES UNA VENTANA Y NO EL GLOBITO QUE ERA. Antes esto era un aviso más
 * en la lista de Inicio, y competía con todo lo que tiene alrededor. Es el
 * único momento en que la app te salva de algo: si pasa sin que se note, la
 * mecánica entera no existe. Ocupa la pantalla, se contesta y se va.
 *
 * EL FONDO NO SE TAPA DEL TODO, y eso es todo el diseño. El velo es un
 * degradado que es casi negro arriba —donde está el texto— y se abre abajo,
 * así que el cuerpo celeste del rango queda a la vista y es lo único iluminado
 * de la pantalla. Arriba de él se dibuja el gesto: el objeto se deshace y se
 * vuelve a armar (ver `motor/salvada.ts`).
 *
 * EL GESTO NO BLOQUEA NADA. El texto y los botones están desde el primer
 * cuadro; el lienzo entra atrás cuando el motor terminó de cargar, y si no
 * carga nunca —equipo flojo, sin WebGL, "reducir movimiento"— la ventana dice
 * exactamente lo mismo. Una ventana que necesita tres segundos de three.js
 * para poder contestarse sería peor que el globito que reemplaza.
 *
 * LO QUE NO HACE: no felicita. El usuario no hizo nada para merecer esto
 * —faltó—, y festejarlo enseña que faltar está bien.
 */
export default function VidaSalvada({
  dias,
  quedan,
  total,
  rango,
  planeta,
  rachaSiGuarda,
  alGuardar,
  alCerrar,
}: {
  /** Los días cubiertos que todavía no se anunciaron, en ISO. */
  dias: string[];
  quedan: number;
  total: number;
  rango: number;
  planeta: string | null;
  /** En cuánto queda la racha si devuelve las vidas. Es `racha - 10`, la
   *  misma cuenta que hace la base: el precio se dice ANTES de cobrarlo. */
  rachaSiGuarda: number;
  alGuardar: () => Promise<void>;
  alCerrar: () => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [paso, setPaso] = useState<'aviso' | 'confirmar' | 'guardando' | 'guardada'>('aviso');
  // EL OBJETO QUEDA CONGELADO EN EL QUE TENÍAS CUANDO TE SALVÓ. Al devolver la
  // vida el rango puede bajar, y el `rango` que llega por props cambia con él:
  // sin esto, la ventana volvería a animar —ahora con el objeto chico— justo
  // después de que la persona eligió perder la racha. La historia se contaría
  // al revés.
  const [rangoFijo] = useState(rango);
  const [planetaFijo] = useState(planeta);

  useEffect(() => {
    // Un golpe corto al abrirse: es un hecho que pasó sin que nadie lo pidiera,
    // y el teléfono lo avisa como avisa los demás.
    plataforma.haptica.pulso();

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = lienzo.current;
    if (quieto || !canvas) return;

    let cancelado = false;
    let control: { destruir: () => void } | null = null;
    import('@/motor/salvada').then(({ animarSalvada }) => {
      if (cancelado || !lienzo.current) return;
      control = animarSalvada(lienzo.current, rangoFijo, planetaFijo, () => {});
    });
    return () => {
      cancelado = true;
      control?.destruir();
    };
  }, [rangoFijo, planetaFijo]);

  async function guardar() {
    setPaso('guardando');
    await alGuardar();
    setPaso('guardada');
  }

  const uno = dias.length === 1;

  return (
    <div className="salvada" role="dialog" aria-modal="true" aria-labelledby="salvada-titulo">
      {/* aria-hidden: el gesto ya está dicho en palabras arriba. */}
      <canvas ref={lienzo} className="salvada-lienzo" aria-hidden />

      <div className="salvada-texto">
        {paso === 'guardada' ? (
          <>
            {/* ARRIBA VA LO QUE ELIGIÓ, no la pérdida. La frase de la racha
                perdida es una oración entera y de título quedaba enorme y
                partida en dos renglones; y además la noticia acá no es que se
                perdió —eso lo acaba de decidir— sino que la vida quedó. */}
            <h2 id="salvada-titulo" className="salvada-titulo">
              {T.vidas.salvada.guardada(dias.length)}
            </h2>
            <p className="salvada-detalle">{T.inicio.perdida}</p>
          </>
        ) : (
          <>
            <h2 id="salvada-titulo" className="salvada-titulo">
              {T.vidas.salvada.titulo}
            </h2>
            <p className="salvada-detalle">
              {uno ? T.vidas.faltasteUno(fechaLinda(dias[0])) : T.vidas.faltasteVarios(dias.length)}
            </p>
            <p className="salvada-quedan">
              {T.vidas.quedan(quedan)} <Vidas quedan={quedan} total={total} />
            </p>
          </>
        )}
      </div>

      <div className="salvada-botones">
        {paso === 'aviso' && (
          <>
            <button className="boton-solido" onClick={alCerrar}>
              {T.general.entendido}
            </button>
            {/* SEGUNDO Y EN VOZ BAJA. Devolverla es la opción rara —cuesta diez
                días— y tiene que verse como lo que es: una salida que está, no
                una pregunta que hay que contestar. */}
            <button className="boton-texto" onClick={() => setPaso('confirmar')}>
              {T.vidas.salvada.guardar(dias.length)}
            </button>
          </>
        )}

        {(paso === 'confirmar' || paso === 'guardando') && (
          <>
            {/* El precio, con el número. Se dice acá y no antes: en el paso
                anterior habría sido una amenaza al costado de un botón que
                nadie iba a tocar. */}
            <p className="salvada-precio">{T.vidas.salvada.precio(dias.length, rachaSiGuarda)}</p>
            <button className="boton-solido" onClick={() => setPaso('aviso')} disabled={paso === 'guardando'}>
              {T.vidas.salvada.volver}
            </button>
            <button
              className="boton-texto peligro"
              onClick={guardar}
              disabled={paso === 'guardando'}
            >
              {paso === 'guardando' ? T.sesion.guardando : T.vidas.salvada.confirmar}
            </button>
          </>
        )}

        {paso === 'guardada' && (
          <button className="boton-solido" onClick={alCerrar}>
            {T.general.entendido}
          </button>
        )}
      </div>
    </div>
  );
}
