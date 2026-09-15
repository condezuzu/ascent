/**
 * LA PANTALLA DE ENTRADA, sin GPU: los tiempos, las curvas y qué se ve en
 * cada instante.
 *
 * POR QUÉ ES UN MÓDULO APARTE, igual que `lib/subida.ts`: las capturas no ven
 * animaciones —el navegador sin cabeza corre `requestAnimationFrame` a un
 * cuadro por segundo— así que lo único que se puede verificar de verdad es la
 * aritmética. Acá vive toda: el motor y la pantalla solo dibujan lo que esto
 * dice.
 *
 * POR QUÉ NO SE REUSA `subida.ts`. Una subida de rango dura 4 segundos y es
 * una ceremonia: el objeto se dispersa del todo y se vuelve a juntar. Siete
 * seguidas serían veintiocho segundos de nadie mirando. Acá las formas se
 * interpolan directo —sin dispersión— y cada tramo dura menos que el anterior,
 * que es lo que se lee como "va acelerando". Las FORMAS sí son las mismas
 * (`formaDeRango`), o serían dos objetos distintos con el mismo nombre.
 *
 * NO IMPORTA three.js ni React.
 */

/** Los ocho objetos, del primero al último. Los nombres NO se dicen acá. */
export const RANGOS_DE_LA_ENTRADA = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** Días de racha que representa cada tramo: el número sube de diez en diez. */
export const DIAS_POR_RANGO = 10;

/**
 * EL PRIMER TRAMO Y CUÁNTO SE ACORTA CADA UNO.
 *
 * 1,9 s es lo que tarda en leerse un cambio de forma sin que parezca un corte
 * (la subida de rango usa 4 s, pero ahí el objeto se desarma entero). 0,78
 * lleva el último a medio segundo, que es el límite: más corto que eso el ojo
 * ya no sigue la forma y lo ve como un parpadeo.
 */
export const TRAMO_INICIAL_S = 1.9;
export const FACTOR_DE_ACELERACION = 0.78;
/** Ningún tramo baja de acá, por más que se sigan multiplicando. */
export const TRAMO_MINIMO_S = 0.5;

/** Lo que se ve el polvo antes de que empiece a moverse. */
export const ANTES_S = 0.9;
/** El agujero negro, quieto, antes de tragarse la pantalla. */
export const DESPUES_S = 0.7;
/** Lo que tarda en tragarse todo y quedar en negro. */
export const TRAGO_S = 1.25;

/** Cuánto dura cada tramo, del primero al último. Siete: son ocho objetos. */
export function duracionesDeTramos(): number[] {
  const d: number[] = [];
  let actual = TRAMO_INICIAL_S;
  for (let i = 0; i < RANGOS_DE_LA_ENTRADA.length - 1; i++) {
    d.push(Math.max(TRAMO_MINIMO_S, Math.round(actual * 100) / 100));
    actual *= FACTOR_DE_ACELERACION;
  }
  return d;
}

/** Cuándo termina cada parte, en segundos desde el arranque. */
export function hitos(): { morfeo: number; quieto: number; total: number } {
  const morfeo = ANTES_S + duracionesDeTramos().reduce((t, d) => t + d, 0);
  const quieto = morfeo + DESPUES_S;
  return { morfeo, quieto, total: quieto + TRAGO_S };
}

export const DURACION_S = hitos().total;

/**
 * La curva de cada tramo: arranca y termina quieta, sin tirón en el medio.
 * Es la de siempre (`suave` en `subida.ts`) elevada un poco: con tramos
 * cortos, una curva demasiado lineal se ve mecánica.
 */
export function curva(x: number): number {
  const c = acotar(x);
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/** Entrada suave nada más: para lo que aparece y se queda. */
export function entrada(x: number): number {
  const c = acotar(x);
  return 1 - Math.pow(1 - c, 3);
}

/** Salida acelerando: para lo que se va tragado. */
export function salida(x: number): number {
  const c = acotar(x);
  return c * c * c;
}

function acotar(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

export type CuadroDeLaEntrada = {
  /** El objeto de donde viene y al que va, y cuánto lleva del camino (0..1). */
  desde: number;
  hasta: number;
  mezcla: number;
  /** El número de la racha, entero, como se muestra. */
  racha: number;
  /** Cuánto se lo tragó el agujero negro: 1 es la pantalla negra. */
  trago: number;
  /** Ya terminó: es el momento de mostrar los botones. */
  fin: boolean;
};

/**
 * QUÉ SE VE EN EL SEGUNDO `t`. Es toda la animación en una función pura: la
 * pantalla le pregunta esto en cada cuadro y dibuja, sin acumular nada.
 *
 * Nunca acumula el tiempo (§17.5, la misma regla que el cronómetro): si el
 * teléfono se traba dos segundos, el cuadro siguiente ya muestra dónde
 * corresponde en vez de arrastrar el retraso hasta el final.
 */
export function cuadroEn(t: number): CuadroDeLaEntrada {
  const seg = Number.isFinite(t) ? Math.max(0, t) : 0;
  const tramos = duracionesDeTramos();
  const { morfeo, quieto, total } = hitos();

  // El número sube parejo DENTRO de cada tramo, no a lo largo de todo: así
  // acelera junto con las formas, que es de donde sale la sensación.
  if (seg < ANTES_S) {
    return { desde: 1, hasta: 1, mezcla: 0, racha: 0, trago: 0, fin: false };
  }

  if (seg < morfeo) {
    let resto = seg - ANTES_S;
    for (let i = 0; i < tramos.length; i++) {
      if (resto < tramos[i]) {
        const p = resto / tramos[i];
        const base = i * DIAS_POR_RANGO;
        return {
          desde: RANGOS_DE_LA_ENTRADA[i],
          hasta: RANGOS_DE_LA_ENTRADA[i + 1],
          mezcla: curva(p),
          // El número NO usa la curva: los días pasan parejos, y que el
          // objeto se demore en arrancar es cosa del objeto.
          racha: Math.round(base + p * DIAS_POR_RANGO),
          trago: 0,
          fin: false,
        };
      }
      resto -= tramos[i];
    }
  }

  const ultimo = RANGOS_DE_LA_ENTRADA[RANGOS_DE_LA_ENTRADA.length - 1];
  const tope = (RANGOS_DE_LA_ENTRADA.length - 1) * DIAS_POR_RANGO;
  if (seg < quieto) {
    return { desde: ultimo, hasta: ultimo, mezcla: 1, racha: tope, trago: 0, fin: false };
  }
  return {
    desde: ultimo,
    hasta: ultimo,
    mezcla: 1,
    racha: tope,
    trago: salida((seg - quieto) / TRAGO_S),
    fin: seg >= total,
  };
}

/**
 * LO QUE VE QUIEN PIDIÓ MENOS MOVIMIENTO. No es "la misma más lenta": es otra
 * cosa, corta y sin recorrido, porque el recorrido es justamente lo que esa
 * preferencia pide que no pase. Se ve el último objeto, el número puesto, y
 * el fundido a negro.
 */
export const DURACION_QUIETA_S = 1.6;

export function cuadroQuietoEn(t: number): CuadroDeLaEntrada {
  const seg = Number.isFinite(t) ? Math.max(0, t) : 0;
  const ultimo = RANGOS_DE_LA_ENTRADA[RANGOS_DE_LA_ENTRADA.length - 1];
  const tope = (RANGOS_DE_LA_ENTRADA.length - 1) * DIAS_POR_RANGO;
  const arranque = DURACION_QUIETA_S * 0.5;
  return {
    desde: ultimo,
    hasta: ultimo,
    mezcla: 1,
    racha: tope,
    trago: seg <= arranque ? 0 : entrada((seg - arranque) / (DURACION_QUIETA_S - arranque)),
    fin: seg >= DURACION_QUIETA_S,
  };
}

/**
 * LAS TRES PRIMERAS PANTALLAS. Acá van los identificadores y el orden; las
 * palabras están en `textos.ts`, como todo el resto de la app.
 */
export const PASOS_DE_LA_ENTRADA = ['saludo', 'registro', 'gente', 'racha'] as const;
export type PasoDeLaEntrada = (typeof PASOS_DE_LA_ENTRADA)[number];

/** Un paso guardado que ya no existe vuelve al principio. */
export function pasoValido(n: unknown): number {
  const i = Number(n);
  return Number.isInteger(i) && i >= 0 && i < PASOS_DE_LA_ENTRADA.length ? i : 0;
}

/**
 * CUÁNDO EMPEZAR A CARGAR EL MOTOR. La cuarta pantalla es la única que lo
 * necesita y three.js cuesta ~3 s de arranque (ver `lib/fondo.ts`), así que se
 * pide apenas se ve la primera: mientras se leen las tres primeras, se baja.
 *
 * Y si no llegó a tiempo, la cuarta NO espera: hay una versión sin motor con
 * los mismos tiempos (`cuadroEn` es la misma para las dos).
 */
export const PASO_QUE_PIDE_EL_MOTOR = 0;
