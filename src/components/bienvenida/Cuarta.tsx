'use client';

import { useEffect, useRef, useState } from 'react';
import {
  cuadroEn,
  cuadroQuietoEn,
  DURACION_S,
  DURACION_QUIETA_S,
  MS_ENTRE_REDIBUJOS,
  pixelesPara,
  rachaMostrada,
  RANGOS_DE_LA_ENTRADA,
  type CuadroDeLaEntrada,
  type NivelDeEquipo,
} from '@/lib/bienvenida';
import { paletaDe } from '@/lib/paletas';
import { T } from '@nucleo/textos';
import Cielo from './Cielo';

/**
 * LA CUARTA PANTALLA: el objeto pasando por los ocho rangos mientras la racha
 * se dispara, el agujero negro tragándose el número y después la cámara, y el
 * cielo volviendo a aparecer para que sobre él vaya el formulario.
 *
 * DOS VERSIONES CON LOS MISMOS TIEMPOS. Con motor son las partículas de
 * siempre; sin motor —equipo flojo, WebGL apagado, o el archivo que todavía no
 * bajó— es un cuerpo de CSS que hace el mismo recorrido. La cuenta la hace en
 * los dos casos `lib/bienvenida.ts`, así que el número y el negro llegan
 * exactamente en el mismo instante.
 */
export default function Cuarta({
  velocidad = 1,
  sinMotor = false,
  quieta = false,
  congelada = null,
  particulas,
  nivel,
  terminada,
  alTerminar,
}: {
  velocidad?: number;
  sinMotor?: boolean;
  quieta?: boolean;
  /** Un segundo fijo de la línea de tiempo, o `null` para que corra. */
  congelada?: number | null;
  particulas: number;
  nivel: NivelDeEquipo;
  /** Ya terminó: el número no existe más, se lo tragaron. */
  terminada: boolean;
  alTerminar: () => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [cuadro, setCuadro] = useState<CuadroDeLaEntrada>(() => cuadroEn(0));
  const [conMotor, setConMotor] = useState(!sinMotor);

  // El segundo congelado, siempre fresco para el bucle del motor, que se monta
  // una sola vez.
  const congeladaRef = useRef(congelada);
  congeladaRef.current = congelada;

  useEffect(() => {
    const dame = quieta ? cuadroQuietoEn : cuadroEn;
    if (congelada !== null) return setCuadro(dame(congelada));
    let vivo = true;
    let pedido = 0;
    const t0 = performance.now();
    const dur = quieta ? DURACION_QUIETA_S : DURACION_S;
    // NO SE REDIBUJA EN CADA CUADRO. Disparado, el número cambia cientos de
    // veces por segundo y cada cambio es texto que el navegador mide y pinta.
    // Con el límite se ve exactamente igual de rápido —lo que da la sensación
    // es cuánto SALTA— y el trabajo baja a una quinta parte.
    let ultimo = -Infinity;
    const paso = (ahora: number) => {
      if (!vivo) return;
      const t = ((ahora - t0) / 1000) * velocidad;
      if (ahora - ultimo >= MS_ENTRE_REDIBUJOS || t >= dur) {
        ultimo = ahora;
        setCuadro(dame(t));
      }
      if (t >= dur) return alTerminar();
      pedido = requestAnimationFrame(paso);
    };
    pedido = requestAnimationFrame(paso);
    return () => {
      vivo = false;
      cancelAnimationFrame(pedido);
    };
  }, [velocidad, quieta, congelada, alTerminar]);

  useEffect(() => {
    if (sinMotor) return setConMotor(false);
    const canvas = lienzo.current;
    if (!canvas) return;
    let control: { destruir: () => void } | null = null;
    let cancelado = false;
    import('@/motor/bienvenida').then(({ animarEntrada }) => {
      if (cancelado) return;
      control = animarEntrada(canvas, {
        velocidad,
        quieta,
        particulas,
        pixeles: pixelesPara(nivel, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1),
        reloj: () => congeladaRef.current,
      });
      // Sin WebGL devuelve null: se pasa a la versión de CSS en el acto, sin
      // pantalla en blanco de por medio.
      if (!control) setConMotor(false);
    });
    return () => {
      cancelado = true;
      control?.destruir();
    };
  }, [sinMotor, velocidad, quieta, particulas, nivel]);

  const i = Math.max(0, RANGOS_DE_LA_ENTRADA.indexOf(cuadro.desde as 1));
  const j = Math.max(0, RANGOS_DE_LA_ENTRADA.indexOf(cuadro.hasta as 1));
  const pal = paletaDe(cuadro.mezcla < 0.5 ? cuadro.desde : cuadro.hasta);
  // Sin motor el objeto es un cuerpo de CSS: cambia de tamaño y de color con
  // los mismos tiempos, y el agujero negro lo cierra igual.
  const tam = [34, 26, 40, 54, 78, 86, 96, 88];
  const lado = (tam[i] + (tam[j] - tam[i]) * cuadro.mezcla) * Math.max(0, 1 - cuadro.trago);

  return (
    <div className="bienv-cuarta">
      {conMotor ? (
        <canvas ref={lienzo} className="bienv-lienzo" />
      ) : (
        <div
          className={`bienv-cuerpo ${cuadro.hasta === 8 && cuadro.mezcla > 0.5 ? 'bienv-cuerpo-negro' : ''}`}
          style={{
            width: `${lado}vmin`,
            height: `${lado}vmin`,
            background: `radial-gradient(circle at 38% 34%, ${pal.claro}, ${pal.principal} 45%, ${pal.apagado} 72%, transparent 73%)`,
            opacity: 1 - cuadro.trago,
          }}
        />
      )}

      {/* LA RACHA, TRAGADA: no se desvanece, se va PARA ADENTRO. Se encoge
          hacia el centro del agujero, se estira un poco en el camino y se
          apaga recién al final.

          Y CUANDO YA NO ESTÁ, NO ESTÁ: el elemento se saca del todo. Si algo
          se lo tragó, no puede seguir ahí. */}
      {cuadro.tragoRacha < 1 && !terminada && (
        <div
          className="bienv-racha"
          style={{
            opacity: Math.max(0, 1 - cuadro.tragoRacha * 1.15),
            transform: `translate3d(0, ${cuadro.tragoRacha * 26}vh, 0) scale(${1 - cuadro.tragoRacha * 0.88})`,
            filter: cuadro.tragoRacha > 0 ? `blur(${cuadro.tragoRacha * 3}px)` : undefined,
          }}
        >
          <span className="bienv-numero">{rachaMostrada(cuadro.racha).toLocaleString(T.general.locale)}</span>
          <span className="bienv-rotulo">{T.bienvenida.racha}</span>
        </div>
      )}

      {/* LA CÁMARA: el negro no aparece encima, CRECE desde el centro —que es
          donde está el agujero— hasta pasar por encima de quien mira. */}
      <div
        className="bienv-trago"
        style={{
          background: `radial-gradient(circle at 50% 50%, #000 ${cuadro.trago * 115}%, rgba(0,0,0,0) ${cuadro.trago * 115 + 14}%)`,
          opacity: cuadro.trago > 0 ? 1 : 0,
        }}
      />

      {/* Y CUANDO YA NO QUEDA NADA, VUELVE EL CIELO. Va DESPUÉS del velo —o
          sea, encima—: dibujado debajo, el negro del trago lo tapaba entero y
          el final quedaba vacío. Surge de a poco, estrella por estrella: el
          espacio vuelve a existir, no se enciende de golpe. */}
      {cuadro.estrellas > 0 && (
        <div className="bienv-vuelta" style={{ opacity: cuadro.estrellas }}>
          <Cielo paso={0} quieto={quieta} densidad={1.6} surge />
        </div>
      )}
    </div>
  );
}
