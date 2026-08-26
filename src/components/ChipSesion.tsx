'use client';

import { cronoLindo, transcurrido } from '@/lib/sesiones';
import { cuentaAtras, restante } from '@/lib/descanso';
import type { EstadoSesion } from '@/lib/usarSesion';
import { T } from '@/textos';

/**
 * El cronómetro en la cabecera de Inicio, al lado de la racha (§20.2).
 *
 * Los dos relojes se separan por TRES ejes a la vez, no por color, que era el
 * problema: sesión y descanso se veían iguales y no se sabía cuál era cuál.
 *
 *              sesión                    descanso
 *   forma      chip de contorno          píldora rellena
 *   dirección  cuenta hacia ARRIBA       cuenta hacia ABAJO
 *   peso       apagado                   acento del rango
 *
 * Con eso un vistazo alcanza: si hay algo relleno y bajando, estás
 * descansando. Ninguno de los dos compite con el número de racha: viven en la
 * fila del encabezado, que es la más chica de la pantalla.
 */
export default function ChipSesion({
  estado,
  alEmpezar,
  alDescansar,
  alAbrirDescanso,
}: {
  estado: EstadoSesion;
  alEmpezar: () => void;
  alDescansar: () => void;
  alAbrirDescanso: () => void;
}) {
  if (!estado.corriendo) {
    return (
      <button className="chip-sesion" onClick={alEmpezar} disabled={estado.ocupado}>
        <Reloj />
        <span>{estado.ocupado ? '…' : T.inicio.iniciarEntrenamiento}</span>
      </button>
    );
  }

  // Con descanso corriendo se ven los DOS a la vez, no uno en lugar del otro:
  // si se turnaran no estarían separados, estarían alternándose. El contraste
  // —contorno contra relleno, subiendo contra bajando— solo se lee si los dos
  // están en pantalla al mismo tiempo.
  const falta = estado.descanso ? restante(estado.descanso.fin) : null;

  return (
    <div className="sesion-viva">
      <span className="chip-sesion corriendo">
        <i className="latido" aria-hidden="true" />
        {cronoLindo(transcurrido(estado.inicio!, estado.desfasaje))}
      </span>
      {falta === null ? (
        <button className="pastilla-descanso hueca" onClick={alDescansar}>
          {T.sesion.descansar}
        </button>
      ) : (
        <button
          className={`pastilla-descanso ${falta === 0 ? 'listo' : ''}`}
          onClick={alAbrirDescanso}
        >
          {falta === 0 ? T.sesion.listo : cuentaAtras(falta)}
        </button>
      )}
    </div>
  );
}

function Reloj() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9" />
      <path d="M9.5 2.5h5" />
    </svg>
  );
}
