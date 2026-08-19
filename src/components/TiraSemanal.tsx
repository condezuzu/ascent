import { DIAS_SEMANA, deISO, hoyISO, restarDias } from '@/lib/fechas';
import { esDiaDeDescanso, type ConfigDescanso } from '@/lib/descansos';
import type { Log } from '@/lib/tipos';

// La semana, alineada al calendario y arrancando en lunes.
//
// Antes eran "los últimos siete días", que es más exacto y se veía mal: las
// letras salían corridas —J V S D L M X un miércoles— y una tira de días con
// las letras desordenadas se lee como un error, no como una ventana móvil.
// Una semana tiene que parecer una semana.
//
// Cuatro estados: lleno (registrado), borde fino vacío (no registrado, sin
// cruz ni rojo ni mensaje de falla), guioncito apagado (descanso — no puede
// parecer un fallo) y apenas visible (todavía no llegó).
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
  // getDay() da 0 el domingo; acá la semana arranca el lunes, que es como se
  // lee una semana de entrenamiento
  const diaDeSemana = (deISO(hoy).getDay() + 6) % 7;
  const lunes = restarDias(hoy, diaDeSemana);

  const dias: {
    fecha: string;
    estado: 'lleno' | 'vacio' | 'descanso' | 'futuro';
    esHoy: boolean;
  }[] = [];

  for (let i = 0; i < 7; i++) {
    const fecha = restarDias(lunes, -i);
    const log = logs.find((l) => l.fecha === fecha);
    let estado: 'lleno' | 'vacio' | 'descanso' | 'futuro' = 'vacio';
    if (fecha > hoy) estado = 'futuro';
    else if (log && !log.es_descanso) estado = 'lleno';
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
