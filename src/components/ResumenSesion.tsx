'use client';

import { useEffect, useState } from 'react';
import { leerPerfilCache } from '@compartido/cache';
import { plataforma } from '@/plataforma';
import NumeroQueCuenta from './NumeroQueCuenta';
import { T } from '@nucleo/textos';
import { pesoCorto, type Unidad } from '@nucleo/peso';
import { REPETICIONES_PARA_MARCA } from '@nucleo/marcaSugerida';
import { usarSugerenciasDeMarca } from '@compartido/marcaSugerida';

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
  bloques,
  unidad: unidadPedida,
  alCerrar,
}: {
  minutos: number;
  series: number;
  porUbicacion: boolean;
  /** Los bloques de la sesión, para preguntar "¿lo guardo como marca?". */
  bloques: unknown;
  /** Si no se pasa, sale del perfil guardado en el teléfono. */
  unidad?: Unidad;
  alCerrar: () => void;
}) {
  const sugerencias = usarSugerenciasDeMarca(bloques);
  const [unidadGuardada, setUnidadGuardada] = useState<Unidad>('kg');
  useEffect(() => {
    if (unidadPedida) return;
    leerPerfilCache().then((p) => setUnidadGuardada(p?.unidad_peso === 'lb' ? 'lb' : 'kg'));
  }, [unidadPedida]);
  const unidad = unidadPedida ?? unidadGuardada;
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

        {/* ¿LO GUARDO COMO MARCA? Con el dato ya escrito: la única pregunta es
            a cuántas repeticiones. Tocar acá NO cierra el resumen, que se
            cierra tocando en cualquier otro lado. */}
        {sugerencias.lista.length > 0 && (
          <div className="marcas-sugeridas" onClick={(e) => e.stopPropagation()}>
            {sugerencias.lista.map((s) => (
              <div key={s.ejercicio} className="marca-sugerida">
                <p>
                  {(s.antes === null ? T.marcaSugerida.primera : T.marcaSugerida.masQueTuMarca)(
                    pesoCorto(s.peso, unidad),
                    unidad,
                    s.nombre
                  )}
                </p>
                {s.estado === 'guardada' ? (
                  <p className="hecho">{T.marcaSugerida.guardada}</p>
                ) : s.estado === 'fallo' ? (
                  <p className="hecho">{T.marcaSugerida.fallo}</p>
                ) : (
                  <>
                    <span className="cuantas">{T.marcaSugerida.cuantas}</span>
                    <div className="reps">
                      {REPETICIONES_PARA_MARCA.map((r) => (
                        <button key={r} disabled={s.estado === 'guardando'} onClick={() => sugerencias.guardar(s, r)}>
                          {r}
                        </button>
                      ))}
                      <button className="no" onClick={() => sugerencias.descartar(s)}>
                        {T.marcaSugerida.no}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
