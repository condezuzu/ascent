import { restarDias } from './fechas.ts';

/**
 * EL DETECTOR DE ESTANCAMIENTO.
 *
 * Aprobado entero el 2026-08-30, implementado el 2026-09-09 con dos cambios
 * pedidos entonces: el umbral se elige en Ajustes (3, 6 u 8 semanas) y los
 * avisos se pueden apagar del todo.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LO QUE SE PUEDE DETECTAR, HONESTAMENTE
 * ─────────────────────────────────────────────────────────────────────
 * Con lo que la app guarda —`prs` (ejercicio, peso, reps, real/estimado,
 * fecha) y `sesiones` (inicio, fin, series)— alcanza para tres cosas:
 *
 * 1. UNA MARCA QUE NO SE MUEVE. El mejor 1RM de un ejercicio no mejora en N
 *    semanas Y en esa ventana cargaste alguna marca. La segunda condición es
 *    la que separa estancarse de haberlo dejado, y sin ella el aviso miente.
 * 2. UN EJERCICIO DEJADO. Tenía al menos tres marcas y hace N semanas que no
 *    aparece. No es estancamiento, es olvido, y el mensaje es otro.
 * 3. LA SESIÓN QUE SE ACHICA. Mediana de duración de las últimas 4 semanas
 *    contra las 4 anteriores. Es el dato más confiable de todos: las series y
 *    los minutos se registran DURANTE la sesión, no se recuerdan después.
 *
 * LO QUE NO SE PUEDE, Y NO SE FINGE:
 * - **Volumen.** No hay series×reps×peso por sesión, solo un contador de
 *   series y los PRs. "Tu volumen de pecho bajó 20%" sería inventado.
 * - **Desbalance por grupo muscular.** `ejercicios.grupo` existe, pero la app
 *   sabe qué ANOTASTE, no qué entrenaste. Avisarle "no entrenas espalda" a
 *   alguien que entrena espalda y no la anota es exactamente el aviso que
 *   hace que se apaguen los avisos para siempre.
 *
 * LA CUARTA SEÑAL DE LA PROPUESTA —racha alta con sesiones cortas— NO tiene
 * código propio, y no por olvido: la regla dice que la racha nunca se nombra
 * en un aviso de estancamiento. Sin nombrarla, esa señal es exactamente la
 * número 3, con la misma comparación de dos filas. Un tipo aparte sería el
 * mismo aviso con otro nombre interno.
 *
 * ─────────────────────────────────────────────────────────────────────
 * CÓMO SE DICE
 * ─────────────────────────────────────────────────────────────────────
 * **Describe, no juzga y no receta.** No es un entrenador, y decir "prueba
 * subir 2,5 kg" lo convierte en uno malo. Por eso esta capa devuelve HECHOS
 * —qué ejercicio, cuántas semanas, qué medianas— y las palabras viven en
 * `textos.ts`. Un módulo que devuelve frases armadas termina, tarde o
 * temprano, devolviendo consejos.
 *
 * Para la señal 3 no hay frase: son dos filas de números, una al lado de la
 * otra, sin verbo. Nadie se siente reprochado por sus propios números; la
 * conclusión la saca quien mira, y por eso se la cree.
 *
 * NO IMPORTA NADA salvo fechas: se prueba con node pelado.
 */

export type Umbral = 3 | 6 | 8;
export const UMBRALES: Umbral[] = [3, 6, 8];
export const UMBRAL_POR_OMISION: Umbral = 6;

export function umbralValido(v: unknown): Umbral {
  const n = Number(v);
  return (UMBRALES as number[]).includes(n) ? (n as Umbral) : UMBRAL_POR_OMISION;
}

/** Una marca, tal como la guarda la base. */
export type MarcaCruda = {
  ejercicio: string;
  peso: number;
  reps: number;
  es_real: boolean;
  fecha: string;
};

/** Una sesión terminada. `minutos` ya calculado por quien la trae. */
export type SesionCruda = { fecha: string; minutos: number };

export type Senal =
  | { tipo: 'marca_quieta'; ejercicio: string; semanas: number }
  | { tipo: 'ejercicio_dejado'; ejercicio: string; semanas: number }
  | {
      tipo: 'sesion_mas_corta';
      ahora: { dias: number; minutos: number };
      antes: { dias: number; minutos: number };
    };

/** El identificador con el que se silencia una señal al descartarla. */
export function idDeSenal(s: Senal): string {
  return s.tipo === 'sesion_mas_corta' ? s.tipo : `${s.tipo}:${s.ejercicio}`;
}

/**
 * Cuánto dura un descarte: seis semanas.
 *
 * Es el mismo número que el techo de repetición de la propuesta ("una vez
 * cada ~6 semanas por ejercicio, como máximo"). Una señal que vuelve antes de
 * que la situación haya podido cambiar es ruido, y el ruido se apaga entero.
 */
export const DIAS_DE_SILENCIO = 42;

/** El 1RM estimado con Epley. Con una repetición es el peso, sin cuenta. */
export function unRm(m: { peso: number; reps: number; es_real: boolean }): number {
  if (m.es_real || m.reps <= 1) return m.peso;
  return m.peso * (1 + m.reps / 30);
}

function mediana(xs: number[]): number {
  if (xs.length === 0) return 0;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Cuántas semanas enteras pasaron entre dos fechas ISO. */
export function semanasEntre(desde: string, hasta: string): number {
  const ms = new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime();
  return Math.floor(ms / (7 * 24 * 3600 * 1000));
}

/**
 * MÍNIMO DE HISTORIA. Sin esto todo parece estancado: quien cargó dos marcas
 * en su vida no tiene una tendencia, tiene dos puntos.
 */
export const MARCAS_MINIMAS = 3;

/** Cuánto tiene que achicarse la sesión para que valga decirlo. */
const CAIDA_MINIMA = 0.25;
/** Sesiones mínimas en cada ventana para que la mediana signifique algo. */
const SESIONES_MINIMAS = 4;

/**
 * La señal a mostrar, o `null`.
 *
 * UNA SOLA, nunca una lista: un aviso que enumera tus fracasos no se lee, se
 * apaga. El orden de prioridad es deliberado:
 *
 * 1. La sesión que se achica, porque es de AHORA y es la que cambia todo lo
 *    demás — con sesiones de veinte minutos, ningún ejercicio va a subir.
 * 2. La marca quieta, que es puntual y accionable.
 * 3. El ejercicio dejado, que es el más viejo y el menos urgente.
 */
export function detectar(entrada: {
  marcas: MarcaCruda[];
  sesiones: SesionCruda[];
  hoy: string;
  umbral: Umbral;
  /** id de señal → fecha ISO en que se descartó. */
  silenciadas?: Record<string, string>;
}): Senal | null {
  const { marcas, sesiones, hoy, umbral } = entrada;
  const silenciadas = entrada.silenciadas ?? {};

  const vale = (s: Senal): Senal | null => {
    const cuando = silenciadas[idDeSenal(s)];
    if (!cuando) return s;
    return cuando < restarDias(hoy, DIAS_DE_SILENCIO) ? s : null;
  };

  // ---- 1. la sesión que se achica ----
  const hace4 = restarDias(hoy, 27);
  const hace8 = restarDias(hoy, 55);
  const ahora = sesiones.filter((s) => s.fecha >= hace4);
  const antes = sesiones.filter((s) => s.fecha >= hace8 && s.fecha < hace4);
  if (ahora.length >= SESIONES_MINIMAS && antes.length >= SESIONES_MINIMAS) {
    const mAhora = mediana(ahora.map((s) => s.minutos));
    const mAntes = mediana(antes.map((s) => s.minutos));
    if (mAntes > 0 && mAhora < mAntes * (1 - CAIDA_MINIMA)) {
      const s = vale({
        tipo: 'sesion_mas_corta',
        ahora: { dias: ahora.length, minutos: Math.round(mAhora) },
        antes: { dias: antes.length, minutos: Math.round(mAntes) },
      });
      if (s) return s;
    }
  }

  // ---- 2 y 3. las marcas ----
  const porEjercicio = new Map<string, MarcaCruda[]>();
  for (const m of marcas) {
    const l = porEjercicio.get(m.ejercicio) ?? [];
    l.push(m);
    porEjercicio.set(m.ejercicio, l);
  }

  const quietas: Senal[] = [];
  const dejados: Senal[] = [];

  for (const [ejercicio, suyas] of porEjercicio) {
    if (suyas.length < MARCAS_MINIMAS) continue;
    const ordenadas = [...suyas].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const ultima = ordenadas[ordenadas.length - 1].fecha;
    const semanasSinAnotar = semanasEntre(ultima, hoy);

    // Dejado: hace N semanas que no aparece.
    if (semanasSinAnotar >= umbral) {
      dejados.push({ tipo: 'ejercicio_dejado', ejercicio, semanas: semanasSinAnotar });
      continue;
    }

    // Quieta: el mejor 1RM es viejo, PERO seguiste anotando. Sin lo segundo
    // no es estancamiento: es que dejaste de medirlo.
    let mejor = ordenadas[0];
    for (const m of ordenadas) if (unRm(m) > unRm(mejor)) mejor = m;
    const semanasDelMejor = semanasEntre(mejor.fecha, hoy);
    const anotoDespues = ordenadas.some((m) => m.fecha > mejor.fecha);
    if (semanasDelMejor >= umbral && anotoDespues) {
      quietas.push({ tipo: 'marca_quieta', ejercicio, semanas: semanasDelMejor });
    }
  }

  // La más vieja primero dentro de cada tipo: si hay dos, la que lleva más
  // tiempo así es la que tiene algo que decir.
  const porSemanas = (a: Senal, b: Senal) =>
    ('semanas' in b ? b.semanas : 0) - ('semanas' in a ? a.semanas : 0);

  for (const lista of [quietas.sort(porSemanas), dejados.sort(porSemanas)]) {
    for (const s of lista) {
      const ok = vale(s);
      if (ok) return ok;
    }
  }

  return null;
}
