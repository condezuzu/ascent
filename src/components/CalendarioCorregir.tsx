'use client';

import { useCallback, useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
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
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState('');

  const primerDia = new Date(ancla.anio, ancla.mes, 1);
  const diasEnMes = new Date(ancla.anio, ancla.mes + 1, 0).getDate();

  const cargar = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const desde = aISO(new Date(ancla.anio, ancla.mes, 1));
    const hasta = aISO(new Date(ancla.anio, ancla.mes, diasEnMes));
    const [{ data }, { data: cfgs }] = await Promise.all([
      supabase
        .from('logs')
        .select('fecha')
        .eq('user_id', uid)
        .gte('fecha', desde)
        .lte('fecha', hasta),
      supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
    ]);
    setConLog(new Set((data ?? []).map((l) => l.fecha)));
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
    else if (esDiaDeDescanso(configs, fecha)) estado = 'descanso';
    else estado = 'vacio';
    celdas.push({ fecha, dia: d, estado });
  }

  async function alternar(c: Celda) {
    if (c.estado === 'futuro' || ocupado) return;
    setError('');
    setOcupado(c.fecha);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return setOcupado(null);

    if (c.estado === 'hecho') {
      const { error } = await supabase.from('logs').delete().eq('user_id', uid).eq('fecha', c.fecha);
      if (error) setError(T.ajustes.noSeSaco);
      else setConLog((prev) => new Set([...prev].filter((f) => f !== c.fecha)));
    } else {
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

      <p className="nota-privada">
        {T.ajustes.calendarioNota}
      </p>
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
