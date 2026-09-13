import { T } from './textos.ts';

/**
 * LO QUE DICE EL AVISO DE LAS 20:30.
 *
 * Es la única vez que la app le habla a alguien que NO la abrió, y por eso es
 * la que más fácil sale mal. Tres reglas:
 *
 *  - DICE UN HECHO. "Hoy todavía no está registrado", no "¡no pierdas tu
 *    racha!". Un aviso que asusta funciona dos semanas y después se apaga
 *    desde los ajustes del teléfono, y ahí no vuelve nunca.
 *  - LA RACHA, SI HAY. Es el único dato que hace que el aviso importe, y es de
 *    la persona: no hay que explicarlo.
 *  - NO NOMBRA LOS IMPULSOS. "Tranquilo, tenés dos" convierte el aviso en un
 *    permiso para no ir.
 *
 * Vive en el núcleo para que el texto se pruebe —y pase el test de español
 * neutro— igual que el resto: la ruta del servidor solo lo arma y lo manda.
 */
export function avisoDiario(racha: number | null | undefined): {
  titulo: string;
  cuerpo: string;
  url: string;
} {
  const r = Number.isFinite(racha) && (racha as number) > 0 ? Math.floor(racha as number) : 0;
  return {
    titulo: T.avisoDiario.titulo,
    cuerpo: r > 0 ? T.avisoDiario.conRacha(r) : T.avisoDiario.sinRacha,
    // Tocarlo abre Inicio, que es donde se registra el día.
    url: '/',
  };
}
