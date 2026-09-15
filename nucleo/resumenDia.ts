/**
 * EL RESUMEN DE UN DÍA: qué pasó, armado con lo que ya estaba guardado.
 *
 * NO HACE FALTA NADA NUEVO EN LA BASE. Las sesiones ya guardan inicio, fin,
 * series y en qué estuviste (`bloques`), y cada una apunta al día que la
 * contiene. O sea que el resumen se podía armar desde hace semanas; faltaba
 * alguien que lo mirara. El peso por serie entró después como un campo más
 * de cada ejercicio, y un día sin pesos se resume igual que antes.
 *
 * ES PURO para poder probar los casos que en la pantalla son raros y en la
 * vida no: dos sesiones el mismo día, una sesión que se cerró sola a las
 * cuatro horas, un ejercicio que ya no está en el catálogo, un día que entró
 * por ubicación sin ninguna sesión.
 */

import type { Carga } from './carga.ts';
import { leerBloques, volumenPorGrupo, type VolumenDeGrupo } from './volumen.ts';

export type EstadoDelDia = 'entrenado' | 'descanso' | 'sin-registrar' | 'futuro';

export type LogDelDia = {
  es_descanso: boolean;
  origen?: string | null;
};

export type SesionDelDia = {
  /** Para revisar un bloque (migración 39). Sin id no se ofrece revisar. */
  id?: string;
  inicio: string;
  fin: string | null;
  estado: string;
  series: number;
  bloques: unknown;
};

/**
 * `pesos` tiene una entrada por serie, en kilos, `null` las que se hicieron sin
 * anotar. La llave no existe si ninguna serie de ese ejercicio tiene peso: un día
 * sin pesos se resume exactamente igual que antes de que existieran.
 */
export type EjercicioDelDia = {
  id: string;
  nombre: string;
  series: number;
  pesos?: (number | null)[];
  /**
   * Qué significa cada peso, uno por serie, con la misma forma que `pesos`
   * (migración 38). Sale del BLOQUE y no del catálogo: es lo que quedó escrito
   * el día que se hizo. Solo existe si existe `pesos`.
   */
  cargas?: Carga[];
};

export type ResumenDelDia = {
  estado: EstadoDelDia;
  /** Cómo entró el día: 'manual', 'ubicacion' o 'salud'. `null` sin día. */
  origen: string | null;
  /**
   * Lo que duraron las sesiones TERMINADAS. `null` si no hay ninguna con fin:
   * una sesión que se cerró sola a las cuatro horas no tiene duración real, y
   * mostrar "4 h" sería inventar un entrenamiento de cuatro horas.
   */
  duracionSegundos: number | null;
  /** Hay una sesión corriendo ahora mismo: el resumen de hoy está incompleto. */
  enCurso: boolean;
  /** El total de la sesión, que es la verdad del conteo (no la suma de bloques). */
  series: number;
  /** En qué estuviste, en el orden en que empezaste cada cosa. */
  ejercicios: EjercicioDelDia[];
  /** Series contadas que no quedaron anotadas en ningún ejercicio. */
  sinEjercicio: number;
  /**
   * EL VOLUMEN POR MÚSCULO del día (`volumen.ts`). Vacío si no se pasó de qué
   * grupo es cada ejercicio. Se muestra solo si algún grupo tiene kilos: sin
   * pesos, las series ya están dichas arriba, ejercicio por ejercicio.
   */
  volumen: VolumenDeGrupo[];
  /**
   * LOS BLOQUES POR REVISAR (migración 39): pesos anotados antes de que
   * existieran los modos, que pueden haber quedado el doble. Uno por bloque y
   * no por ejercicio, porque se corrigen de a uno.
   */
  porRevisar: BloquePorRevisar[];
};

export type BloquePorRevisar = {
  sesion: string;
  orden: number;
  ejercicio: string;
  nombre: string;
  pesos: (number | null)[];
  carga: Carga;
};

export function resumenDelDia({
  log,
  sesiones,
  catalogo,
  esFuturo,
  esDescansoConfigurado,
  ejercicioSinNombre,
  grupos,
}: {
  log: LogDelDia | null;
  sesiones: SesionDelDia[];
  /** id → nombre. */
  catalogo: Map<string, string>;
  esFuturo: boolean;
  esDescansoConfigurado: boolean;
  /** El nombre de un ejercicio que ya no está en el catálogo. */
  ejercicioSinNombre: string;
  /** id → grupo muscular, para el volumen por músculo. */
  grupos?: Map<string, string>;
}): ResumenDelDia {
  let estado: EstadoDelDia;
  if (esFuturo) estado = 'futuro';
  else if (log && !log.es_descanso) estado = 'entrenado';
  // El descanso marcado a mano gana sobre la configuración, igual que en el
  // calendario: es lo último que dijo la persona sobre ese día.
  else if (log?.es_descanso || esDescansoConfigurado) estado = 'descanso';
  else estado = 'sin-registrar';

  // Las sesiones en orden de inicio: si hubo dos, los ejercicios salen en el
  // orden en que se hicieron, no en el que los devolvió la base.
  const ordenadas = [...sesiones].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

  let duracion = 0;
  let conFin = 0;
  let series = 0;
  let enCurso = false;
  const porEjercicio = new Map<string, { series: number; pesos: (number | null)[]; cargas: Carga[] }>();
  const todos: ReturnType<typeof leerBloques> = [];
  const porRevisar: BloquePorRevisar[] = [];

  for (const s of ordenadas) {
    series += Math.max(0, Math.floor(Number(s.series) || 0));
    if (s.estado === 'corriendo') enCurso = true;
    if (s.estado === 'terminada' && s.fin) {
      const d = (Date.parse(s.fin) - Date.parse(s.inicio)) / 1000;
      if (Number.isFinite(d) && d > 0) {
        duracion += d;
        conFin++;
      }
    }
    for (const b of leerBloques(s.bloques)) {
      todos.push(b);
      if (b.supuesta && s.id) {
        porRevisar.push({
          sesion: s.id,
          orden: b.orden,
          ejercicio: b.ejercicio,
          nombre: catalogo.get(b.ejercicio) ?? ejercicioSinNombre,
          pesos: b.pesos,
          carga: b.carga,
        });
      }
      // Un Map conserva el orden de la PRIMERA vez que aparece la clave, que
      // es justo lo que se quiere: press de banca, sentadilla, y si volviste
      // a banca al final, suma a la fila de banca y no crea otra.
      const previo = porEjercicio.get(b.ejercicio) ?? { series: 0, pesos: [], cargas: [] };
      porEjercicio.set(b.ejercicio, {
        series: previo.series + b.series,
        pesos: [...previo.pesos, ...b.pesos],
        cargas: [...previo.cargas, ...b.pesos.map(() => b.carga)],
      });
    }
  }

  const ejercicios = [...porEjercicio].map(([id, x]) => {
    const e: EjercicioDelDia = { id, nombre: catalogo.get(id) ?? ejercicioSinNombre, series: x.series };
    if (x.pesos.some((p) => p !== null)) {
      e.pesos = x.pesos;
      e.cargas = x.cargas;
    }
    return e;
  });
  const anotadas = ejercicios.reduce((t, e) => t + e.series, 0);

  return {
    estado,
    origen: log ? log.origen ?? 'manual' : null,
    duracionSegundos: conFin > 0 ? Math.round(duracion) : null,
    enCurso,
    series,
    ejercicios,
    // Nunca negativo: si los bloques suman más que el total —el total se
    // corrigió a mano después—, el total manda y no hay "series sin anotar".
    sinEjercicio: Math.max(0, series - anotadas),
    volumen: grupos
      ? volumenPorGrupo(
          todos,
          new Map([...grupos].map(([id, grupo]) => [id, { nombre: catalogo.get(id) ?? id, grupo }]))
        )
      : [],
    porRevisar,
  };
}
