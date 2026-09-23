'use client';

import { useCallback, useState } from 'react';
import { particulasPara, PASOS_DE_LA_ENTRADA, type NivelDeEquipo } from '@/lib/bienvenida';
import { N } from '@nucleo/subida';
import { nivelEquipo } from '@/lib/equipo';
import { T } from '@nucleo/textos';
import Cielo from './Cielo';
import Registro from './Registro';
import Objetos from './Objetos';
import Cuarta from './Cuarta';

/**
 * LA PANTALLA DE ENTRADA. Cuatro pantallas, una sola vez en la vida de quien
 * instala la app, y termina exactamente donde empieza el formulario: el negro
 * del agujero negro ES el fondo de la pantalla de sesión.
 *
 * 1 · el polvo — de dónde se empieza.
 * 2 · lo que la app anota, con la lista de ejercicios acelerando detrás.
 * 3 · la gente, con los objetos de otras rachas flotando.
 * 4 · los ocho objetos, la racha disparada y el agujero negro. Sin texto: la
 *     animación dice lo que hay que decir.
 *
 * EL MOTOR SE PIDE EN LA PRIMERA y no en la cuarta: three.js tarda ~3 s en
 * arrancar (`lib/fondo.ts`), así que mientras se leen las tres primeras se
 * descarga por detrás. Si aun así no llegó, la cuarta NO espera: tiene una
 * versión sin motor con los mismos tiempos.
 *
 * LOS TIEMPOS Y LAS CURVAS viven en `lib/bienvenida.ts`, probados con números.
 * Acá está la pantalla y nada más. El banco de pruebas —`/galeria/bienvenida`—
 * monta ESTE componente con los controles al costado, así que lo que se mira
 * ahí es lo que se ve de verdad.
 */
export default function Bienvenida({
  alSalir,
  velocidad = 1,
  sinMotor = false,
  quieta = false,
  congelada = null,
  nivel,
  paso: pasoDeAfuera,
  alPaso: alPasoDeAfuera,
}: {
  /** Qué eligió: crear una cuenta o entrar con la que ya tiene. */
  alSalir: (destino: 'crear' | 'entrar') => void;
  // Lo que sigue es solo para el banco de pruebas.
  velocidad?: number;
  sinMotor?: boolean;
  quieta?: boolean;
  congelada?: number | null;
  nivel?: NivelDeEquipo;
  paso?: number;
  alPaso?: (n: number) => void;
}) {
  const [pasoPropio, setPasoPropio] = useState(0);
  const [terminada, setTerminada] = useState(false);
  const paso = pasoDeAfuera ?? pasoPropio;
  const alPaso = alPasoDeAfuera ?? setPasoPropio;
  const [equipo] = useState<NivelDeEquipo>(() => nivel ?? nivelEquipo());

  // ESTABLE, y no una función nueva en cada render: el reloj de la cuarta la
  // tiene como dependencia, y recreada el efecto se rearma al terminar — la
  // animación vuelve a empezar por detrás y la racha reaparece como si nada se
  // la hubiera tragado.
  const alTerminar = useCallback(() => setTerminada(true), []);

  const ultima = paso === PASOS_DE_LA_ENTRADA.length - 1;
  const textos = [
    { titulo: T.bienvenida.saludoTitulo, bajada: T.bienvenida.saludoBajada },
    { titulo: T.bienvenida.registroTitulo, bajada: T.bienvenida.registroBajada },
    { titulo: T.bienvenida.genteTitulo, bajada: T.bienvenida.genteBajada },
    { titulo: '', bajada: '' },
  ][paso];

  return (
    <div className={`bienv ${terminada ? 'bienv-negro' : ''}`}>
      {/* EL FONDO. Las tres primeras no pueden ser texto sobre negro: el cielo
          está desde el primer cuadro y no espera al motor. La segunda suma la
          lista de ejercicios que termina en estrellas, y la tercera, los
          objetos de otras rachas. */}
      {!ultima && <Cielo paso={paso} quieto={quieta} />}
      {paso === 1 && <Registro quieto={quieta} />}
      {paso === 2 && <Objetos quieto={quieta} />}

      {/* En la cuarta se salta TOCANDO: no hay nada más que tocar, y un botón
          compitiendo con la animación es ruido. */}
      {ultima && !terminada && (
        <button className="bienv-tocar" onClick={alTerminar} aria-label={T.bienvenida.saltar} />
      )}
      {ultima && (
        <Cuarta
          velocidad={velocidad}
          sinMotor={sinMotor}
          quieta={quieta}
          congelada={congelada}
          particulas={particulasPara(equipo, N)}
          nivel={equipo}
          terminada={terminada}
          alTerminar={alTerminar}
        />
      )}

      {!ultima && (
        <div className="bienv-texto" key={paso}>
          <h1>{textos.titulo}</h1>
          <p>{textos.bajada}</p>
        </div>
      )}

      {/* EL FINAL. No es el pie de siempre movido: es otra cosa, centrada sobre
          el cielo que acaba de aparecer. Ahí no hay pasos ni salida: hay una
          decisión. */}
      {terminada && (
        <div className="bienv-fin">
          <p className="bienv-cierre">{T.bienvenida.cierre}</p>
          <button className="bienv-solido" onClick={() => alSalir('crear')}>
            {T.bienvenida.crear}
          </button>
          <button className="bienv-texto-boton" onClick={() => alSalir('entrar')}>
            {T.bienvenida.entrar}
          </button>
        </div>
      )}

      {/* El pie NO se rearma entre pantallas: el botón se queda quieto y solo
          cambia lo de arriba. Un botón que entra y sale en cada paso es el
          detalle que hace que una entrada se sienta barata. */}
      {!terminada && (
        <div className="bienv-pie">
          <div className="bienv-puntos">
            {PASOS_DE_LA_ENTRADA.map((p, i) => (
              <span key={p} className={i === paso ? 'vivo' : ''} />
            ))}
          </div>
          {!ultima && (
            <button className="bienv-solido" onClick={() => alPaso(paso + 1)}>
              {T.bienvenida.siguiente}
            </button>
          )}
          {/* SALTAR: chico, gris, y NO en la primera —los primeros cinco
              segundos nadie lo necesita y ensucia la primera imagen—. En la
              cuarta tampoco: ahí se salta tocando la pantalla. */}
          {paso > 0 && !ultima && (
            <button
              className="bienv-texto-boton bienv-saltar"
              onClick={() => alPaso(PASOS_DE_LA_ENTRADA.length - 1)}
            >
              {T.bienvenida.saltar}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
