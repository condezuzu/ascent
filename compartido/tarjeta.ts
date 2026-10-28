import { plataforma } from '@plataforma';
import { T } from '@nucleo/textos';
import type { TarjetaEnVivo } from '@nucleo/plataforma';
import { leerViva, suscribirViva, type EstadoVivo } from '@compartido/sesionViva';
import { nombreDe } from '@compartido/enCurso';
import { kmDePasos, METROS_POR_PASO } from '@nucleo/pasos';
import { distanciaCorta, type UnidadDistancia } from '@nucleo/distancia';

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

/**
 * `pasosCardio`: los de la vuelta de cardio que corre (-1 = no se sabe o no hay cardio).
 * `unidad`: la de la distancia del cardio, la de la persona.
 */
export type Extras = { pasos: number; companero: string; finCompanero: number; pasosCardio: number; unidad: UnidadDistancia };
const SIN_EXTRAS: Extras = { pasos: -1, companero: '', finCompanero: 0, pasosCardio: -1, unidad: 'km' };

/** La anotada; si no hay, la que sale de los pasos, marcada como aproximada. '' = ninguna. */
function distanciaDelCardio(km: number | undefined, x: Extras): string {
  if (km !== undefined) return T.tarjeta.distancia(distanciaCorta(km, x.unidad), x.unidad);
  if (x.pasosCardio < 0) return '';
  return T.tarjeta.distanciaAprox(distanciaCorta((x.pasosCardio * METROS_POR_PASO) / 1000, x.unidad), x.unidad);
}

/**
 * Qué tiene que decir la tarjeta ahora. Pura, para poder probarla. \`null\` = apagada;
 * \`'dejar'\` = no tocar (el descanso terminó y la tarjeta está diciendo "LISTO": se
 * deja un rato antes de pasar a la serie, y mandarle un descanso vencido la apagaría).
 */
export function tarjetaDeAhora(v: EstadoVivo, ahora: number, x: Extras = SIN_EXTRAS, conCardio = false): TarjetaEnVivo | 'dejar' | null {
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
  // EL CARDIO (20/10): con la cinta andando no se muestra la cuenta del descanso que haya
  // quedado de la serie anterior, sino los pasos y los km de esta vuelta.
  const cardioDesde = v.bloques.cardioDesde;
  // EL CARDIO EN LA PANTALLA BLOQUEADA (29/10): tiempo, distancia y pasos, cada uno en su
  // lugar, con el reloj desde que arrancó la cinta. Solo si el widget sabe dibujarlo.
  if (cardioDesde !== undefined && conCardio) {
    return {
      ...comun,
      modo: 'cardio',
      fin: cardioDesde,
      desde: cardioDesde,
      duracion: 0,
      ejercicio: nombreDe(v.bloques.ejercicio) ?? '',
      serie: 0,
      meta: 0,
      rotulo: T.tarjeta.cardio,
      detalle: distanciaDelCardio(v.bloques.distancia, x),
      textoPasos: x.pasosCardio >= 0 ? T.tarjeta.pasos(x.pasosCardio) : '',
    };
  }
  if (cardioDesde !== undefined) {
    return {
      ...comun,
      modo: 'serie',
      fin: desde,
      duracion: 0,
      ejercicio: nombreDe(v.bloques.ejercicio) ?? '',
      serie: 0,
      meta: 0,
      rotulo: T.tarjeta.cardio,
      detalle: x.pasosCardio >= 0 ? T.tarjeta.pasosYKm(x.pasosCardio, kmDePasos(x.pasosCardio)) : '',
      textoPasos: '',
    };
  }
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
      // SIN CARDIO, LOS PASOS NO VAN EN EL DESCANSO (20/10, a pedido).
      textoPasos: '',
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

let enCurso = false;
let otraVez = false;

/**
 * EN FILA (20/10): el módulo nativo espera entre "¿hay una?" y encender otra, y dos cambios
 * seguidos (empezar la serie y arrancar el descanso) entraban los dos por ese hueco: dos
 * tarjetas en la pantalla bloqueada. Lo que llega mientras tanto se manda después, con lo
 * último.
 */
async function mandar() {
  if (enCurso) {
    otraVez = true;
    return;
  }
  enCurso = true;
  try {
    do {
      otraVez = false;
      await mandarAhora();
    } while (otraVez);
  } finally {
    enCurso = false;
  }
}

async function mandarAhora() {
  if (!plataforma.enVivo.sabeLaTarjeta()) return;
  if (reloj) clearTimeout(reloj);
  reloj = null;
  const ahora = Date.now();
  const v = leerViva();
  const t = tarjetaDeAhora(v, ahora, extras, plataforma.enVivo.sabeElCardio());
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

/** Cada cuánto se le preguntan a Salud los pasos del cardio, con la app adelante. */
export const PASOS_DEL_CARDIO_MS = 30_000;
let pasosDelCardio: ReturnType<typeof setInterval> | null = null;
let cardioDe: number | null = null;

/**
 * LOS PASOS DE LA VUELTA DE CARDIO (20/10), desde que arrancó la cinta. Con la app atrás
 * el reloj no corre: la tarjeta queda con los últimos y se pone al día al volver.
 */
function seguirElCardio() {
  const desde = leerViva().bloques.cardioDesde;
  if ((desde ?? null) === cardioDe) return;
  cardioDe = desde ?? null;
  if (pasosDelCardio) clearInterval(pasosDelCardio);
  pasosDelCardio = null;
  if (desde === undefined) {
    if (extras.pasosCardio !== -1) fijarExtras({ pasosCardio: -1 });
    return;
  }
  const preguntar = async () => {
    const n = await plataforma.salud.pasosEntre(new Date(desde), new Date()).catch(() => null);
    if (cardioDe === desde) fijarExtras({ pasosCardio: n ?? -1 });
  };
  void preguntar();
  pasosDelCardio = setInterval(() => void preguntar(), PASOS_DEL_CARDIO_MS);
}

/** Se enciende una vez, con la sesión de la cuenta abierta (\`app/_layout.tsx\`). */
export function encenderTarjeta(): () => void {
  if (!apagarOyente)
    apagarOyente = suscribirViva(() => {
      seguirElCardio();
      void mandar();
    });
  seguirElCardio();
  void mandar();
  return () => {
    apagarOyente?.();
    apagarOyente = null;
    if (pasosDelCardio) clearInterval(pasosDelCardio);
    pasosDelCardio = null;
    cardioDe = null;
  };
}
