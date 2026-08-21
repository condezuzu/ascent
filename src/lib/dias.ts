/**
 * Los días de sesión que se leen en Stats.
 *
 * Vive aparte de `sesiones.ts` y **no importa nada**, igual que `reglas.ts`:
 * así `test:db` puede cargarlo con Node y probar la agrupación y las fechas,
 * que es donde están los dos errores que esto puede tener —inventar una
 * duración y correr un día— y ninguno se ve mirando la pantalla.
 */

/**
 * Una fila de `sesiones` como viene de la base, con la fecha del día al que
 * pertenece embebida desde `logs`.
 */
export type FilaSesion = {
  inicio: string;
  fin: string | null;
  estado: string;
  series: number;
  logs: { fecha: string } | { fecha: string }[] | null;
};

export type DiaConSesiones = {
  fecha: string;
  segundos: number;
  cuantas: number;
};

/**
 * Las sesiones agrupadas por día, de la más reciente a la más vieja.
 *
 * Se agrupa por DÍA y no por sesión porque pueden ser varias (§17.4): dos
 * entradas al gimnasio en la misma jornada son un día de racha, no dos, y la
 * lista de Stats tiene que leerse como el calendario, no como un log.
 *
 * Las abandonadas suman 0: se cerraron solas a las 4 horas y su duración no
 * se conoce. Nunca se inventa un número (§17.5).
 */
export function agruparPorDia(filas: FilaSesion[]): DiaConSesiones[] {
  const porDia = new Map<string, DiaConSesiones>();
  for (const f of filas) {
    // PostgREST devuelve el embebido como objeto o como array de uno según
    // cómo resuelva la cardinalidad; las dos formas se aceptan.
    const l = Array.isArray(f.logs) ? f.logs[0] : f.logs;
    if (!l?.fecha) continue;
    const d = porDia.get(l.fecha) ?? { fecha: l.fecha, segundos: 0, cuantas: 0 };
    if (f.estado === 'terminada' && f.fin) {
      d.segundos += Math.max(0, Math.round((Date.parse(f.fin) - Date.parse(f.inicio)) / 1000));
    }
    d.cuantas += 1;
    porDia.set(l.fecha, d);
  }
  return [...porDia.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

/**
 * "Hoy", "Ayer" o "mié 13". Sin año y sin mes: son los últimos siete días,
 * y una fecha completa por fila es ruido.
 */
export function etiquetaDeDia(fecha: string, hoy = new Date()): string {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (fecha === iso(hoy)) return 'Hoy';
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  if (fecha === iso(ayer)) return 'Ayer';
  // Se parte el ISO a mano: `new Date('2026-08-21')` es UTC y en UTC−3 cae el
  // día anterior, que es exactamente el error que esta pantalla no puede tener.
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  return `${dias[f.getDay()]} ${d}`;
}
