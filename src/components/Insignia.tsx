import { PALETAS_RANGO } from '@/lib/paletas';

// Insignia chica de alto contraste para listas (24px, silueta clara).
// Los rangos 1, 2 y 3 se parecen demasiado en chico: la silueta va
// exagerada más de lo realista, a propósito.
// El color sale de la paleta del rango que representa (no de la del usuario):
// en una lista de amigos, cada insignia lleva el color de SU rango.
export default function Insignia({ rango, tam = 24 }: { rango: number; tam?: number }) {
  const pal = PALETAS_RANGO[rango] ?? PALETAS_RANGO[1];
  const trazo = pal.claro;
  const oscuro = '#05060a';
  const s = { width: tam, height: tam, flex: 'none' } as const;

  switch (rango) {
    case 1: // Polvo: puntos sueltos
      return (
        <svg style={s} viewBox="0 0 24 24" fill={trazo} aria-hidden>
          <circle cx="8" cy="10" r="1.6" />
          <circle cx="14" cy="7" r="1.1" />
          <circle cx="17" cy="14" r="1.4" />
          <circle cx="10" cy="17" r="1" />
          <circle cx="6" cy="15" r="0.8" opacity=".7" />
        </svg>
      );
    case 2: // Asteroide: roca angulosa naranja óxido, muy irregular
      return (
        <svg style={s} viewBox="0 0 24 24" fill={pal.principal} aria-hidden>
          <path d="M7 5 L15 4 L20 9 L19 15 L13 20 L6 18 L4 11 Z" />
          <circle cx="10" cy="10" r="1.5" fill={oscuro} opacity=".55" />
          <circle cx="15" cy="14" r="1" fill={oscuro} opacity=".45" />
        </svg>
      );
    case 3: // Luna: creciente marcado, gris mineral
      return (
        <svg style={s} viewBox="0 0 24 24" fill={trazo} aria-hidden>
          <path d="M12 3 a9 9 0 1 0 9 9 a11 11 0 0 1 -9 -9 Z" />
        </svg>
      );
    case 4: // Planeta: una ESFERA iluminada de un lado, no un disco plano
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" fill={pal.principal} />
          {/* El terminador. Es lo único que separa un planeta de un círculo de
              color, y era justo lo que le faltaba. */}
          <path d="M12 4 a8 8 0 0 1 0 16 a10.5 10.5 0 0 0 0 -16 Z" fill={oscuro} opacity=".42" />
          <path d="M4.6 9.8 Q12 12.6 19.4 9.8" stroke={trazo} strokeWidth="1.3" fill="none" opacity=".45" />
          <path d="M5.4 14.8 Q12 17.2 18.6 14.8" stroke={oscuro} strokeWidth="1.3" fill="none" opacity=".5" />
        </svg>
      );
    case 5: // Sol: disco radiante incandescente
      return (
        <svg style={s} viewBox="0 0 24 24" fill={trazo} aria-hidden>
          <circle cx="12" cy="12" r="6" />
          <g stroke={trazo} strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 1.5 v3 M12 19.5 v3 M1.5 12 h3 M19.5 12 h3 M4.6 4.6 l2.1 2.1 M17.3 17.3 l2.1 2.1 M19.4 4.6 l-2.1 2.1 M6.7 17.3 l-2.1 2.1" />
          </g>
        </svg>
      );
    case 6: // Sistema: sol + órbita + planeta
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="3.5" fill={trazo} />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" stroke={pal.principal} strokeWidth="1.3" fill="none" />
          <circle cx="21" cy="13.5" r="1.8" fill={pal.principal} />
        </svg>
      );
    case 7: // Galaxia: DOS brazos gruesos y un núcleo que brilla
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* Tenía cuatro brazos de un pelo de grosor: en 16 píxeles se comían
              entre sí y quedaba una mancha. Dos brazos gruesos y un núcleo con
              halo se leen a cualquier tamaño. */}
          <ellipse
            cx="12" cy="12" rx="10.5" ry="7"
            fill={pal.principal} opacity=".16"
            transform="rotate(-22 12 12)"
          />
          <g fill="none" stroke={pal.principal} strokeWidth="2.4" strokeLinecap="round">
            <path d="M12.6 12 C 17.2 10.6, 20.6 13.4, 18.8 17.6" />
            <path d="M11.4 12 C 6.8 13.4, 3.4 10.6, 5.2 6.4" />
          </g>
          <circle cx="12" cy="12" r="4.4" fill={trazo} opacity=".22" />
          <circle cx="12" cy="12" r="2.5" fill={trazo} />
        </svg>
      );
    case 8: // Agujero negro: disco de acreción + la luz doblada por arriba
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          {/* El orden importa y es todo el dibujo: el disco pasa POR DETRÁS,
              la esfera lo tapa, la luz del lado de atrás aparece curvada por
              ARRIBA — que es la firma de un agujero negro y es lo que este
              icono no tenía — y el frente del disco vuelve por delante. */}
          <ellipse cx="12" cy="13" rx="11" ry="3.4" fill="none" stroke={pal.principal} strokeWidth="2" />
          <circle cx="12" cy="12" r="6" fill="#020204" />
          <path
            d="M4.4 11.6 A 8.2 8.2 0 0 1 19.6 11.6"
            fill="none" stroke={pal.claro} strokeWidth="2" strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="6" fill="none" stroke={pal.claro} strokeWidth="0.9" opacity=".75" />
          <path
            d="M1.2 13 A 11 3.4 0 0 0 22.8 13"
            fill="none" stroke={pal.principal} strokeWidth="2" strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}
