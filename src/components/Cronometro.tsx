'use client';

import { useEffect, useState } from 'react';
import { cronoLindo, faltaParaElTope, transcurrido } from '@/lib/sesiones';

/**
 * La sesión en curso. Reemplaza al bloque de botones de la principal: así
 * nunca hay dos botones sólidos en pantalla y el estado "estoy entrenando" se
 * lee de un vistazo (§17.6).
 *
 * El número va en mono y tamaño medio. NO compite con el número de racha, que
 * sigue siendo lo único grande de esa pantalla (§7).
 */
export default function Cronometro({
  inicio,
  desfasaje,
  terminando,
  alTerminar,
}: {
  inicio: string;
  desfasaje: number;
  terminando: boolean;
  alTerminar: () => void;
}) {
  // Este estado NO cuenta el tiempo: solo obliga a repintar. El valor sale
  // siempre de `transcurrido()`, que resta contra el inicio guardado (§17.5).
  const [, repintar] = useState(0);

  useEffect(() => {
    const tic = () => repintar((n) => n + 1);
    const id = setInterval(tic, 1000);
    // Al volver del segundo plano el intervalo estuvo suspendido y puede
    // tardar hasta un segundo en despertar: se repinta al toque para que no
    // se vea un número viejo.
    document.addEventListener('visibilitychange', tic);
    window.addEventListener('focus', tic);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tic);
      window.removeEventListener('focus', tic);
    };
  }, []);

  const segundos = transcurrido(inicio, desfasaje);
  const falta = faltaParaElTope(segundos);
  // Se avisa ANTES, no después: si se cierra sola la sesión queda sin
  // duración, y enterarse recién en Stats es tarde para hacer algo (§17.3).
  const avisa = falta <= 30 * 60;

  return (
    <div className="crono">
      <div className="crono-fila">
        <span className="crono-label">Sesión</span>
        <span className="crono-tiempo">{cronoLindo(segundos)}</span>
      </div>
      {avisa && (
        <p className="aviso-tiempo" style={{ marginBottom: 14 }}>
          {falta > 0
            ? `Se cierra sola en ${Math.max(1, Math.round(falta / 60))} min y queda sin duración.`
            : 'Ya se cerró sola: esta sesión queda sin duración.'}
        </p>
      )}
      {/* Descansar NO está acá: vive en la franja, que se ve desde cualquier
          pantalla. Terminar pasa una vez por entrenamiento y esta es su casa. */}
      <button className="boton-solido" onClick={alTerminar} disabled={terminando}>
        {terminando ? 'Guardando…' : 'Terminar sesión'}
      </button>
      <p className="nota-privada">El día ya quedó registrado. Solo falta cuánto duró.</p>
    </div>
  );
}
