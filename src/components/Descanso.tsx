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
  alSaltar,
  alOcultar,
}: {
  vivo: DescansoVivo;
  alReiniciar: (d: DescansoVivo) => void;
  /** Saltar: se corta el descanso y se pierde la cuenta. */
  alSaltar: () => void;
  /**
   * Cerrar: se sale de esta pantalla y el descanso SIGUE corriendo, con la
   * cuenta a la vista en la píldora de la cabecera.
   *
   * Existe porque antes la única salida era "Saltar", y el que solo quería
   * mirar otra cosa un segundo tenía que tirar su descanso para hacerlo.
   */
  alOcultar: () => void;
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
    const dejarDeMirar = plataforma.ciclo.alCambiar((visible) => {
      if (visible) plataforma.pantalla.mantenerDespierta();
    });
    return () => {
      dejarDeMirar();
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
      if (plataforma.ciclo.visible()) id = setInterval(tic, 250);
    };
    arrancar();
    const dejarDeMirar = plataforma.ciclo.alCambiar(arrancar);
    return () => {
      clearInterval(id);
      dejarDeMirar();
    };
  }, [vivo.fin, avisar]);

  function saltar() {
    borrarDescanso();
    alSaltar();
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
    <div className={`pantalla-descanso ${terminado ? 'listo' : ''}`} role="dialog" aria-modal>
      {/* La salida que NO cuesta el descanso. Arriba a la derecha, donde se
          espera una cruz, y en voz baja: el número sigue siendo lo único
          grande de esta pantalla (§18.6). */}
      <button className="descanso-cerrar" onClick={alOcultar} aria-label={T.descanso.cerrar}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

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
          <button className="boton-solido" onClick={saltar}>
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
          <button className="boton-texto" onClick={saltar}>
            {T.descanso.saltar}
          </button>
        </>
      )}
    </div>
  );
}
