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
    case 4: // Planeta: disco con banda
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" fill={pal.principal} />
          <path d="M4.5 10.5 Q12 13.5 19.5 10.5" stroke={oscuro} strokeWidth="1.6" fill="none" opacity=".55" />
          <path d="M5 14.5 Q12 17 19 14.5" stroke={oscuro} strokeWidth="1.2" fill="none" opacity=".4" />
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
    case 7: // Galaxia: espiral violeta
      return (
        <svg style={s} viewBox="0 0 24 24" fill="none" stroke={pal.principal} strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="2" fill={trazo} stroke="none" />
          <path d="M12 12 C 16 10, 20 12, 20 16" />
          <path d="M12 12 C 8 14, 4 12, 4 8" />
          <path d="M12 12 C 13 7, 10 4, 6 4.5" />
          <path d="M12 12 C 11 17, 14 20, 18 19.5" />
        </svg>
      );
    case 8: // Agujero negro: disco de acreción naranja fino + toque violeta
      return (
        <svg style={s} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="7.5" stroke={pal.claro} strokeWidth="1.4" fill="none" opacity=".8" />
          <ellipse cx="12" cy="12" rx="11" ry="3.2" stroke={pal.principal} strokeWidth="1.6" fill="none" />
          <circle cx="12" cy="12" r="5" fill="#020204" />
        </svg>
      );
    default:
      return null;
  }
}
