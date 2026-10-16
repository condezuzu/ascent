import { plataforma } from '@plataforma';
import { T } from '@nucleo/textos';
import type { TarjetaEnVivo } from '@nucleo/plataforma';
import { leerViva, suscribirViva, type EstadoVivo } from '@compartido/sesionViva';
import { nombreDe } from '@compartido/enCurso';

/**
 * LA TARJETA DE LA PANTALLA BLOQUEADA, ENTERA (build 8, 15/10).
 *
 * Hasta la build 7 la tarjeta existía solo mientras corría el descanso. Ahora sigue
 * a la sesión: apenas se elige el ejercicio aparece "Serie 0 de 3" con el reloj de
 * la sesión; entre serie y serie, la cuenta del descanso; abajo, los pasos de hoy y
 * el compañero con su descanso. Sin sesión, se apaga.
 *
 * LA DECIDE UNO SOLO, mirando \`sesionViva\` (el estado de la sesión que comparten
 * todas las pantallas): las instancias de \`useSesion\` son varias y, si cada una
 * mandara lo suyo, la tarjeta saltaría entre versiones. Los pasos y el compañero los
 * avisa quien los sabe (\`fijarExtras\`).
 *
 * SOLO SI EL BINARIO LA SABE DIBUJAR (\`sabeLaTarjeta\`). En una build anterior todo
 * esto no hace nada y la tarjeta sigue siendo la del descanso (\`compartido/descanso.ts\`).
 */

/** Cuánto se deja el "LISTO" de un descanso terminado antes de volver a la serie. */
export const LISTO_MS = 90_000;

export type Extras = { pasos: number; companero: string; finCompanero: number };
const SIN_EXTRAS: Extras = { pasos: -1, companero: '', finCompanero: 0 };

/**
 * Qué tiene que decir la tarjeta ahora. Pura, para poder probarla. \`null\` = apagada;
 * \`'dejar'\` = no tocar (el descanso terminó y la tarjeta está diciendo "LISTO": se
 * deja un rato antes de pasar a la serie, y mandarle un descanso vencido la apagaría).
 */
export function tarjetaDeAhora(v: EstadoVivo, ahora: number, x: Extras = SIN_EXTRAS): TarjetaEnVivo | 'dejar' | null {
  if (!v.inicio) return null;
  const desde = Date.parse(v.inicio) + v.desfasaje;
  const comun = {
    desde,
    pasos: x.pasos,
    companero: x.companero,
    finCompanero: x.finCompanero > ahora ? x.finCompanero : 0,
    rotuloListo: T.tarjeta.listo,
    textoPasos: x.pasos >= 0 ? T.tarjeta.pasos(x.pasos) : '',
  };
  const d = v.descanso;
  if (d && d.fin > ahora) {
    const serie = d.serie ?? 0;
    const meta = d.meta ?? 0;
    return {
      ...comun,
      modo: 'descanso',
      fin: d.fin,
      duracion: d.duracion,
      ejercicio: d.ejercicio ?? '',
      serie,
      meta,
      rotulo: T.tarjeta.descanso,
      detalle: serie > 0 ? T.tarjeta.serie(serie, meta) : '',
    };
  }
  if (d && ahora < d.fin + LISTO_MS) return 'dejar';
  // LA SERIE: las hechas de este bloque, desde cero ("Serie 0 de 3" recién elegido).
  const b = v.bloques;
  const ejercicio = nombreDe(b.ejercicio) ?? '';
  return {
    ...comun,
    modo: 'serie',
    fin: desde,
    duracion: 0,
    ejercicio,
    serie: b.hechas,
    meta: b.meta,
    rotulo: T.tarjeta.entrenando,
    detalle: b.ejercicio !== null ? T.tarjeta.serie(b.hechas, b.meta) : '',
  };
}

let extras: Extras = SIN_EXTRAS;
let ultima = '';
let prendida = false;
let reloj: ReturnType<typeof setTimeout> | null = null;

/**
 * Lo nuevo sobre lo que había. EL FIN DEL DESCANSO DEL COMPAÑERO se recalcula en cada
 * consulta (cada 10 s) y la latencia lo corre unos milisegundos: sin esto, iOS recibía
 * una tarjeta "nueva" cada 10 s sin que cambiara nada (ronda 10, 16/10).
 */
export function extrasNuevos(antes: Extras, p: Partial<Extras>): Extras {
  const x = { ...antes, ...p };
  const fin = p.finCompanero;
  if (fin && antes.finCompanero && x.companero === antes.companero && Math.abs(fin - antes.finCompanero) < 2000) {
    x.finCompanero = antes.finCompanero;
  }
  return x;
}

/** Los pasos de hoy y el compañero: los avisa quien los sabe. Solo se reenvía si cambió. */
export function fijarExtras(p: Partial<Extras>) {
  extras = extrasNuevos(extras, p);
  void mandar();
}

async function mandar() {
  if (!plataforma.enVivo.sabeLaTarjeta()) return;
  if (reloj) clearTimeout(reloj);
  reloj = null;
  const ahora = Date.now();
  const v = leerViva();
  const t = tarjetaDeAhora(v, ahora, extras);
  if (t === 'dejar') {
    // Se vuelve a mirar cuando termina el "LISTO".
    if (v.descanso) reloj = setTimeout(() => void mandar(), v.descanso.fin + LISTO_MS - ahora + 500);
    return;
  }
  if (t === null) {
    ultima = '';
    if (prendida) {
      prendida = false;
      await plataforma.enVivo.esconder();
    }
    return;
  }
  // Con el descanso andando, se vuelve a mirar al terminar el "LISTO": ahí pasa a la serie.
  if (t.modo === 'descanso') reloj = setTimeout(() => void mandar(), t.fin + LISTO_MS - ahora + 500);
  // IGUAL QUE LA ÚLTIMA, NO SE MANDA: iOS limita cuántas veces por hora se puede
  // tocar una Live Activity, y el compañero se pregunta cada diez segundos.
  const clave = JSON.stringify(t);
  if (clave === ultima) return;
  ultima = clave;
  prendida = await plataforma.enVivo.mostrarTarjeta(t);
}

let apagarOyente: (() => void) | null = null;

/** Se enciende una vez, con la sesión de la cuenta abierta (\`app/_layout.tsx\`). */
export function encenderTarjeta(): () => void {
  if (!apagarOyente) apagarOyente = suscribirViva(() => void mandar());
  void mandar();
  return () => {
    apagarOyente?.();
    apagarOyente = null;
  };
}
