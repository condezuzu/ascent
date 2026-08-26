'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PRESETS_DESCANSO } from '@/lib/reglas';
import { plataforma } from '@/plataforma';
import { T } from '@/textos';
import {
  borrarDescanso,
  cuentaAtras,
  duracionCorta,
  guardarDescanso,
  leerSonido,
  restante,
  vibrar,
  type DescansoVivo,
} from '@/lib/descanso';

/**
 * El descanso entre series (§18). Toma la pantalla entera: el teléfono está
 * apoyado en el piso o en el banco, a un par de metros, y se lo mira de reojo
 * entre repeticiones.
 *
 * Por eso el número es lo ÚNICO grande (§18.6): los presets y el botón de
 * saltar están en voz baja a propósito. Si algo más compite, deja de leerse
 * de lejos, que es toda la razón por la que esta pantalla existe.
 */
export default function Descanso({
  vivo,
  alReiniciar,
  alCerrar,
}: {
  vivo: DescansoVivo;
  alReiniciar: (d: DescansoVivo) => void;
  alCerrar: () => void;
}) {
  const [, repintar] = useState(0);
  const [terminado, setTerminado] = useState(() => restante(vivo.fin) === 0);
  // El aviso se dispara UNA vez. Sin esto, cada repintada volvería a vibrar.
  const yaAviso = useRef(terminado);
  const sonido = useRef(false);

  // El sonido se prepara con el toque que abrió el descanso: los navegadores
  // no dejan crear audio sin un gesto, y a los tres minutos ya no hay gesto.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!(await leerSonido()) || !vivo) return;
      await plataforma.audio.preparar();
      sonido.current = true;
    })();
    return () => {
      vivo = false;
      sonido.current = false;
      plataforma.audio.soltar();
    };
  }, []);

  const avisar = useCallback(() => {
    // La vibración va PRIMERO: un gimnasio es ruidoso y casi todos entrenan
    // con auriculares. En iPhone no vibra —WebKit no tiene Vibration API— y
    // por eso el aviso que siempre funciona es el cambio de pantalla (§18.7).
    vibrar();
    if (sonido.current) plataforma.audio.avisar();
  }, []);

  // Wake Lock: sin esto la pantalla se bloquea a los treinta segundos y el
  // aviso visual —el único que funciona en todos los teléfonos— no lo ve
  // nadie. Es una comodidad: si lo rechazan, la cuenta sigue siendo correcta.
  useEffect(() => {
    plataforma.pantalla.mantenerDespierta();
    // El sistema lo suelta solo al ocultarse la pestaña y NO vuelve por su
    // cuenta: hay que volver a pedirlo cada vez que la página se ve de nuevo.
    const alVolver = () => {
      if (document.visibilityState === 'visible') plataforma.pantalla.mantenerDespierta();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      plataforma.pantalla.soltar();
    };
  }, []);

  // El intervalo NO cuenta: solo obliga a repintar. El valor sale siempre de
  // `restante(fin)`, que resta contra el timestamp guardado (§18.4). Si el
  // teléfono suspende la app diez minutos, al volver muestra el tiempo real.
  useEffect(() => {
    const tic = () => {
      if (restante(vivo.fin) === 0 && !yaAviso.current) {
        yaAviso.current = true;
        setTerminado(true);
        avisar();
      }
      repintar((n) => n + 1);
    };
    // El intervalo corre SOLO con la pantalla a la vista: cuatro repintados
    // por segundo con la app atrás no los ve nadie. `tic` también corre al
    // volver, así que no se pierde nada — incluido el aviso, que en web solo
    // puede sonar con la app adelante de todos modos (§13b).
    let id: ReturnType<typeof setInterval> | undefined;
    const arrancar = () => {
      clearInterval(id);
      tic();
      if (document.visibilityState === 'visible') id = setInterval(tic, 250);
    };
    arrancar();
    document.addEventListener('visibilitychange', arrancar);
    window.addEventListener('focus', tic);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', arrancar);
      window.removeEventListener('focus', tic);
    };
  }, [vivo.fin, avisar]);

  function cerrar() {
    borrarDescanso();
    alCerrar();
  }

  // Cambiar de preset reinicia la cuenta con la duración nueva: el que pasa a
  // accesorios toca 90s y ya está descansando 90s, sin un paso extra.
  function usarPreset(segundos: number) {
    yaAviso.current = false;
    setTerminado(false);
    alReiniciar(guardarDescanso(segundos));
  }

  const falta = restante(vivo.fin);
  const proporcion = terminado ? 0 : Math.min(1, falta / vivo.duracion);
  const R = 46;
  const circunferencia = 2 * Math.PI * R;

  return (
    <div className={`descanso ${terminado ? 'listo' : ''}`} role="dialog" aria-modal>
      <div className="descanso-centro">
        {/* El anillo se VACÍA, no se llena: es una cuenta regresiva y tiene
            que verse que algo se está gastando. */}
        <svg className="descanso-anillo" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r={R} className="pista" />
          <circle
            cx="60"
            cy="60"
            r={R}
            className={`arco ${!terminado && falta <= 10 ? 'latiendo' : ''}`}
            strokeDasharray={circunferencia}
            strokeDashoffset={circunferencia * (1 - proporcion)}
          />
        </svg>
        <div className="descanso-numero" aria-live="polite">
          {cuentaAtras(falta)}
        </div>
      </div>

      {terminado ? (
        <>
          <p className="descanso-pie">{T.descanso.listoPie}</p>
          <button className="boton-solido" onClick={cerrar}>
            {T.descanso.seguir}
          </button>
        </>
      ) : (
        <>
          {/* En voz baja a propósito: el número es lo único grande */}
          <div className="descanso-presets">
            {PRESETS_DESCANSO.map((p) => (
              <button
                key={p}
                className={p === vivo.duracion ? 'activo' : ''}
                onClick={() => usarPreset(p)}
              >
                {duracionCorta(p)}
              </button>
            ))}
          </div>
          <button className="boton-texto" onClick={cerrar}>
            {T.descanso.saltar}
          </button>
        </>
      )}
    </div>
  );
}
