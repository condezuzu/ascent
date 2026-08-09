import { DIAS_SEMANA, deISO, hoyISO, restarDias } from '@/lib/fechas';
import { esDiaDeDescanso, type ConfigDescanso } from '@/lib/descansos';
import type { Log } from '@/lib/tipos';

// Tres estados: lleno (registrado), borde fino vacío (no registrado, sin
// cruz ni rojo ni mensaje de falla), guioncito apagado (descanso — no puede
// parecer un fallo).
//
// Los descansos se leen con la configuración vigente de CADA día: la semana
// puede cruzar un cambio de rutina y el pasado no se reescribe.
export default function TiraSemanal({
  logs,
  descansos,
}: {
  logs: Log[];
  descansos: ConfigDescanso[];
}) {
  const hoy = hoyISO();
  const dias: { fecha: string; estado: 'lleno' | 'vacio' | 'descanso'; esHoy: boolean }[] = [];

  for (let i = 6; i >= 0; i--) {
    const fecha = restarDias(hoy, i);
    const log = logs.find((l) => l.fecha === fecha);
    let estado: 'lleno' | 'vacio' | 'descanso' = 'vacio';
    if (log && !log.es_descanso) estado = 'lleno';
    else if ((log && log.es_descanso) || esDiaDeDescanso(descansos, fecha)) estado = 'descanso';
    dias.push({ fecha, estado, esHoy: fecha === hoy });
  }

  return (
    <div className="tira-semanal">
      {dias.map((d) => (
        <div className="tira-dia" key={d.fecha}>
          <div className={`tira-punto ${d.estado} ${d.esHoy ? 'hoy' : ''}`} />
          <span>{DIAS_SEMANA[deISO(d.fecha).getDay()]}</span>
        </div>
      ))}
    </div>
  );
}
