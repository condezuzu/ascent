/**
 * EL RESUMEN DE UN DÍA: qué pasó, armado con lo que ya estaba guardado.
 *
 * NO HACE FALTA NADA NUEVO EN LA BASE. Las sesiones ya guardan inicio, fin,
 * series y en qué estuviste (`bloques`), y cada una apunta al día que la
 * contiene. O sea que el resumen se podía armar desde hace semanas; faltaba
 * alguien que lo mirara. Cuando exista el peso por serie, entra acá como un
 * campo más y nada de lo de abajo cambia.
 *
 * ES PURO para poder probar los casos que en la pantalla son raros y en la
 * vida no: dos sesiones el mismo día, una sesión que se cerró sola a las
 * cuatro horas, un ejercicio que ya no está en el catálogo, un día que entró
 * por ubicación sin ninguna sesión.
 */

export type EstadoDelDia = 'entrenado' | 'descanso' | 'sin-registrar' | 'futuro';

export type LogDelDia = {
  es_descanso: boolean;
  origen?: string | null;
};

export type SesionDelDia = {
  inicio: string;
  fin: string | null;
  estado: string;
  series: number;
  bloques: unknown;
};

export type EjercicioDelDia = { id: string; nombre: string; series: number };

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
};

/** Los bloques vienen de la base como JSON: se leen sin confiar en la forma. */
function bloquesDe(crudo: unknown): { ejercicio: string; series: number }[] {
  if (!Array.isArray(crudo)) return [];
  return crudo.flatMap((b) => {
    if (!b || typeof b !== 'object') return [];
    const e = (b as { ejercicio?: unknown }).ejercicio;
    const s = Number((b as { series?: unknown }).series);
    if (typeof e !== 'string' || !Number.isFinite(s) || s <= 0) return [];
    return [{ ejercicio: e, series: Math.floor(s) }];
  });
}

export function resumenDelDia({
  log,
  sesiones,
  catalogo,
  esFuturo,
  esDescansoConfigurado,
  ejercicioSinNombre,
}: {
  log: LogDelDia | null;
  sesiones: SesionDelDia[];
  /** id → nombre. */
  catalogo: Map<string, string>;
  esFuturo: boolean;
  esDescansoConfigurado: boolean;
  /** El nombre de un ejercicio que ya no está en el catálogo. */
  ejercicioSinNombre: string;
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
  const porEjercicio = new Map<string, number>();

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
    for (const b of bloquesDe(s.bloques)) {
      // Un Map conserva el orden de la PRIMERA vez que aparece la clave, que
      // es justo lo que se quiere: press de banca, sentadilla, y si volviste
      // a banca al final, suma a la fila de banca y no crea otra.
      porEjercicio.set(b.ejercicio, (porEjercicio.get(b.ejercicio) ?? 0) + b.series);
    }
  }

  const ejercicios = [...porEjercicio].map(([id, n]) => ({
    id,
    nombre: catalogo.get(id) ?? ejercicioSinNombre,
    series: n,
  }));
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
  };
}
