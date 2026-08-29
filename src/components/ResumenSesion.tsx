'use client';

import { useEffect } from 'react';
import { plataforma } from '@/plataforma';
import NumeroQueCuenta from './NumeroQueCuenta';
import { T } from '@/textos';

/**
 * Lo que se ve al terminar de entrenar.
 *
 * POR QUÉ EXISTE. Terminar era el momento más vacío de la app: se tocaba
 * "Terminar", el bloque desaparecía y la pantalla volvía a lo mismo de antes.
 * Es el instante de más satisfacción ganada del día —acabás de entrenar, estás
 * transpirado, lo lograste— y no pasaba nada. Strava, que vive de esto, no
 * muestra un cartelito: muestra una pantalla propia.
 *
 * QUÉ NO ES. No es una felicitación y no es un consejo. Son dos números y una
 * línea. El mérito ya es de quien entrenó; una app que aplaude de más se
 * vuelve ruido a la tercera vez y a la décima se apaga.
 *
 * SE PUEDE SALTAR TOCANDO EN CUALQUIER LADO, igual que la subida de rango. La
 * quinta vez que ves algo, verlo entero es una molestia, no un premio.
 *
 * Los minutos cuentan hacia arriba en vez de aparecer: es el mismo criterio
 * que el número de racha (ver `NumeroQueCuenta`).
 */
export default function ResumenSesion({
  minutos,
  series,
  porUbicacion,
  alCerrar,
}: {
  minutos: number;
  series: number;
  porUbicacion: boolean;
  alCerrar: () => void;
}) {
  // Un golpe corto al aparecer. Llega ACÁ y no en el toque de "Terminar":
  // el toque confirma que pediste algo, esto confirma que ya está hecho.
  useEffect(() => {
    plataforma.haptica.pulso();
  }, []);

  return (
    <div className="resumen-sesion" onClick={alCerrar} role="dialog" aria-modal="true">
      <div className="cuerpo">
        <p className="titulo">{T.sesion.resumenTitulo}</p>

        <div className="cifras">
          <div className="cifra">
            <NumeroQueCuenta valor={minutos} ms={900} className="numero-cuenta" />
            <span className="unidad">{T.sesion.resumenMinutos}</span>
          </div>
          {/* Las series solo se muestran si hubo: un cero grande al lado de
              los minutos leería como un reproche, y no lo es — hay sesiones
              en las que nadie tocó el contador. */}
          {series > 0 && (
            <div className="cifra">
              <NumeroQueCuenta valor={series} ms={900} className="numero-cuenta" />
              <span className="unidad">{T.sesion.resumenSeries(series)}</span>
            </div>
          )}
        </div>

        {porUbicacion && <p className="pie">{T.sesion.resumenSolo}</p>}
      </div>
    </div>
  );
}
