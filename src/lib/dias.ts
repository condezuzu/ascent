// Los días de sesión que se leen en Stats.
//
// No importa nada, igual que `reglas.ts`, para que `test:db` pueda cargarlo:
// los dos errores posibles acá —inventar una duración y correr un día— no se
// ven mirando la pantalla.

export type FilaSesion = {
  inicio: string;
  fin: string | null;
  estado: string;
  series: number;
  logs: { fecha: string } | { fecha: string }[] | null;
};

// Se exporta para que la sección 33 lo compare contra lo que acepta la base:
// un literal suelto acá es la familia del bug de 'M' contra 'm'.
export const ESTADO_CON_DURACION = 'terminada';

export type DiaConSesiones = {
  fecha: string;
  segundos: number;
  cuantas: number;
};

/**
 * Las sesiones agrupadas por DÍA —pueden ser varias por jornada (§17.4)—, de
 * la más reciente a la más vieja. Las abandonadas suman 0: se cerraron solas y
 * su duración no se conoce (§17.5).
 */
export function agruparPorDia(filas: FilaSesion[]): DiaConSesiones[] {
  const porDia = new Map<string, DiaConSesiones>();
  for (const f of filas) {
    // PostgREST devuelve el embebido como objeto o como array de uno según cómo
    // resuelva la cardinalidad.
    const l = Array.isArray(f.logs) ? f.logs[0] : f.logs;
    if (!l?.fecha) continue;
    const d = porDia.get(l.fecha) ?? { fecha: l.fecha, segundos: 0, cuantas: 0 };
    if (f.estado === ESTADO_CON_DURACION && f.fin) {
      d.segundos += Math.max(0, Math.round((Date.parse(f.fin) - Date.parse(f.inicio)) / 1000));
    }
    d.cuantas += 1;
    porDia.set(l.fecha, d);
  }
  return [...porDia.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

/** "Hoy", "Ayer" o "mié 13". */
export function etiquetaDeDia(fecha: string, hoy = new Date()): string {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (fecha === iso(hoy)) return 'Hoy';
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (fecha === iso(ayer)) return 'Ayer';
  // Partido a mano: `new Date('2026-08-21')` es UTC y en UTC−3 cae el día
  // anterior.
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  return `${dias[f.getDay()]} ${d}`;
}
