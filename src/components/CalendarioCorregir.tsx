'use client';

import { useCallback, useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { DIAS_SEMANA, MESES, aISO, deISO, hoyISO } from '@/lib/fechas';
import { esDiaDeDescanso, type ConfigDescanso } from '@/lib/descansos';
import { T } from '@/textos';

type Estado = 'hecho' | 'vacio' | 'descanso' | 'futuro';
type Celda = { fecha: string; dia: number; estado: Estado };

// Calendario mensual para corregir días: se ve el mes entero con el estado
// de cada día y se toca para agregarlo o sacarlo. Nada de escribir fechas.
// (El mapa de calor de Datos es otra cosa: aquel solo se mira.)
//
// Los descansos se muestran con la configuración que regía CADA día, no con
// la de hoy: si no, un mes viejo se vería con la rutina actual, que es mentira.
export default function CalendarioCorregir({ alCambiar }: { alCambiar: () => void }) {
  const [supabase] = useState(() => crearCliente());
  const [configs, setConfigs] = useState<ConfigDescanso[]>([]);
  const hoy = hoyISO();
  const base = deISO(hoy);
  const [ancla, setAncla] = useState({ anio: base.getFullYear(), mes: base.getMonth() });
  const [conLog, setConLog] = useState<Set<string>>(new Set());
  // Los días marcados a mano como descanso. Son filas de `logs` con
  // `es_descanso`, que la base ya sabía leer desde siempre —`calcular_racha`
  // no las cuenta pero tampoco corta la racha— y que hasta ahora NADIE
  // escribía. La columna existía y el camino para llegar a ella no.
  const [descansoAMano, setDescansoAMano] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState('');

  const primerDia = new Date(ancla.anio, ancla.mes, 1);
  const diasEnMes = new Date(ancla.anio, ancla.mes + 1, 0).getDate();

  const cargar = useCallback(async () => {
    const uid = (await miUsuario(supabase))?.id;
    if (!uid) return;
    const desde = aISO(new Date(ancla.anio, ancla.mes, 1));
    const hasta = aISO(new Date(ancla.anio, ancla.mes, diasEnMes));
    const [{ data }, { data: cfgs }] = await Promise.all([
      supabase
        .from('logs')
        .select('fecha, es_descanso')
        .eq('user_id', uid)
        .gte('fecha', desde)
        .lte('fecha', hasta),
      supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
    ]);
    setConLog(new Set((data ?? []).filter((l) => !l.es_descanso).map((l) => l.fecha)));
    setDescansoAMano(new Set((data ?? []).filter((l) => l.es_descanso).map((l) => l.fecha)));
    setConfigs((cfgs ?? []) as ConfigDescanso[]);
  }, [supabase, ancla, diasEnMes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const celdas: Celda[] = [];
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = aISO(new Date(ancla.anio, ancla.mes, d));
    let estado: Estado;
    if (fecha > hoy) estado = 'futuro';
    else if (conLog.has(fecha)) estado = 'hecho';
    // El descanso marcado a mano gana sobre la configuración: es más
    // específico y es lo último que dijo la persona sobre ese día.
    else if (descansoAMano.has(fecha) || esDiaDeDescanso(configs, fecha)) estado = 'descanso';
    else estado = 'vacio';
    celdas.push({ fecha, dia: d, estado });
  }

  async function alternar(c: Celda) {
    if (c.estado === 'futuro' || ocupado) return;
    setError('');
    setOcupado(c.fecha);
    const uid = (await miUsuario(supabase))?.id;
    if (!uid) return setOcupado(null);

    // TRES ESTADOS, no dos: sin registrar → entrenado → descanso → sin
    // registrar. El tercero es el que faltaba, y es el que arregla haber
    // configurado mal los días de descanso desde el principio.
    //
    // Las configuraciones de `descansos` son FECHADAS a propósito: protegen
    // contra que cambiar de rutina reescriba el pasado. Pero justamente por
    // eso no sirven para arreglar el pasado cuando la configuración estuvo mal
    // desde el día uno, y ahí la racha se pierde sin salida (§11: perder
    // progreso por culpa de la app es lo único que no se perdona).
    //
    // Esto NO abre una puerta nueva. Este mismo calendario ya deja agregar
    // cualquier día pasado como ENTRENADO, que es estrictamente más poderoso:
    // un día entrenado suma a la racha, uno de descanso solo no la corta.
    const quitar = () =>
      supabase.from('logs').delete().eq('user_id', uid).eq('fecha', c.fecha);

    if (c.estado === 'hecho') {
      // De entrenado a descanso: se borra y se vuelve a poner marcado. No hay
      // update porque la fila puede tener origen y planeta del día que ya no
      // corresponden a un día en el que no entrenaste.
      const { error: eBorrar } = await quitar();
      if (eBorrar) {
        setOcupado(null);
        return setError(T.ajustes.noSeSaco);
      }
      const { error } = await supabase
        .from('logs')
        .insert({ user_id: uid, fecha: c.fecha, es_descanso: true });
      if (error) setError(T.ajustes.noSeAgrego);
      else {
        setConLog((prev) => new Set([...prev].filter((f) => f !== c.fecha)));
        setDescansoAMano((prev) => new Set([...prev, c.fecha]));
      }
    } else if (descansoAMano.has(c.fecha)) {
      // De descanso marcado a mano de vuelta a nada.
      const { error } = await quitar();
      if (error) setError(T.ajustes.noSeSaco);
      else setDescansoAMano((prev) => new Set([...prev].filter((f) => f !== c.fecha)));
    } else {
      // De nada —o de un descanso que viene de la configuración— a entrenado.
      const { error } = await supabase.from('logs').insert({ user_id: uid, fecha: c.fecha });
      if (error) setError(T.ajustes.noSeAgrego);
      else setConLog((prev) => new Set([...prev, c.fecha]));
    }
    setOcupado(null);
    alCambiar(); // la racha la recalcula la base: hay que releerla
  }

  function mover(delta: number) {
    const d = new Date(ancla.anio, ancla.mes + delta, 1);
    // no tiene sentido navegar a meses que todavía no pasaron
    if (aISO(d) > hoy) return;
    setAncla({ anio: d.getFullYear(), mes: d.getMonth() });
  }

  const esMesActual = ancla.anio === base.getFullYear() && ancla.mes === base.getMonth();

  return (
    <div className="calendario">
      <div className="cal-cabecera">
        <button onClick={() => mover(-1)} aria-label={T.ajustes.mesAnterior}>
          ‹
        </button>
        <span>{T.ajustes.mesYAnio(MESES[ancla.mes], ancla.anio)}</span>
        <button onClick={() => mover(1)} disabled={esMesActual} aria-label={T.ajustes.mesSiguiente}>
          ›
        </button>
      </div>

      <div className="cal-grilla cal-nombres">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="cal-grilla">
        {/* huecos hasta el primer día del mes */}
        {Array.from({ length: primerDia.getDay() }).map((_, i) => (
          <span key={`h${i}`} />
        ))}
        {celdas.map((c) => (
          <button
            key={c.fecha}
            className={`cal-dia ${c.estado} ${c.fecha === hoy ? 'hoy' : ''}`}
            onClick={() => alternar(c)}
            disabled={c.estado === 'futuro' || ocupado === c.fecha}
            aria-label={
              c.estado === 'hecho'
                ? T.ajustes.diaRegistrado(c.dia)
                : T.ajustes.diaSinRegistrar(c.dia)
            }
          >
            {c.dia}
          </button>
        ))}
      </div>

      {/* Las tres formas, dichas. Hasta ahora había que tocar un día para
          descubrir qué significaba cada una — y tocar es justo lo que cambia
          el dato, o sea que la única forma de averiguarlo era romper algo. */}
      {/* Las clases van prefijadas —`cal-hecho`, no `hecho`— porque una clase
          de una palabra es de todos: `descanso` a secas ERA la pantalla
          completa del temporizador, y este cuadradito de 12 px se llevaba
          puesto un overlay `fixed` con su degradado. Ver `.pantalla-descanso`
          en globals. */}
      <div className="cal-leyenda">
        <span><i className="cal-hecho" />{T.ajustes.leyendaHecho}</span>
        <span><i className="cal-vacio" />{T.ajustes.leyendaVacio}</span>
        <span><i className="cal-descanso" />{T.ajustes.leyendaDescanso}</span>
      </div>

      <p className="nota-privada">{T.ajustes.calendarioNota}</p>
      <p className="nota-privada">{T.ajustes.calendarioRecalcular}</p>
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
