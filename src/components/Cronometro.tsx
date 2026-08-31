'use client';

import { useEffect, useState } from 'react';
import { cronoLindo, faltaParaElTope, transcurrido } from '@nucleo/sesiones';
import { plataforma } from '@/plataforma';
import { T } from '@nucleo/textos';

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
    const dejarDeMirar = plataforma.ciclo.alCambiar(tic);
    return () => {
      clearInterval(id);
      dejarDeMirar();
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
        <span className="crono-label">{T.sesion.label}</span>
        <span className="crono-tiempo">{cronoLindo(segundos)}</span>
      </div>
      {avisa && (
        <p className="aviso-tiempo" style={{ marginBottom: 14 }}>
          {falta > 0
            ? T.sesion.seCierraEn(Math.max(1, Math.round(falta / 60)))
            : T.sesion.yaSeCerro}
        </p>
      )}
      {/* Descansar NO está acá: vive en la franja, que se ve desde cualquier
          pantalla. Terminar pasa una vez por entrenamiento y esta es su casa. */}
      <button className="boton-solido" onClick={alTerminar} disabled={terminando}>
        {terminando ? T.sesion.guardando : T.sesion.terminarSesion}
      </button>
      <p className="nota-privada">{T.sesion.yaRegistrado}</p>
    </div>
  );
}
