'use client';

import { useCallback, useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { DIAS_SEMANA, MESES, aISO, deISO, enDias, hoyISO } from '@nucleo/fechas';
import { esDiaDeDescanso, type ConfigDescanso } from '@nucleo/descansos';
import HojaDelDia from '@/components/HojaDelDia';
import { T } from '@nucleo/textos';

type Estado = 'hecho' | 'vacio' | 'descanso' | 'futuro';
type Celda = { fecha: string; dia: number; estado: Estado };

/**
 * EL CALENDARIO: uno solo, y se toca para MIRAR.
 *
 * Había dos: el mapa de calor de Stats, que solo se miraba, y "Corregir días"
 * en Ajustes, donde tocar un día lo cambiaba. Ahora es este, en Stats, y
 * tocar un día abre su resumen; corregirlo es un paso aparte adentro de ese
 * resumen (ver `HojaDelDia`). Mirar un día ya no puede romperlo.
 *
 * Los descansos se muestran con la configuración que regía CADA día, no con
 * la de hoy: si no, un mes viejo se vería con la rutina actual, que es mentira.
 */
export default function CalendarioDias({ alCambiar }: { alCambiar: () => void }) {
  const [supabase] = useState(() => crearCliente());
  const [configs, setConfigs] = useState<ConfigDescanso[]>([]);
  const hoy = hoyISO();
  const base = deISO(hoy);
  const [ancla, setAncla] = useState({ anio: base.getFullYear(), mes: base.getMonth() });
  const [conLog, setConLog] = useState<Set<string>>(new Set());
  // Los días marcados a mano como descanso: filas de `logs` con `es_descanso`.
  const [descansoAMano, setDescansoAMano] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [aviso, setAviso] = useState('');
  // Si se corrigió algo en esta visita. La nota de recalcular aparece recién
  // ahí: antes es una instrucción para algo que nadie hizo.
  const [corrigio, setCorrigio] = useState(false);

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
    else if (descansoAMano.has(fecha) || esDiaDeDescanso(configs, fecha)) estado = 'descanso';
    else estado = 'vacio';
    celdas.push({ fecha, dia: d, estado });
  }

  // El RPC recalcula y aplica la pérdida en la misma transacción: el número
  // que se muestra es el final, no rebota al recargar.
  async function recalcular() {
    setRecalculando(true);
    setAviso('');
    const { data, error } = await supabase.rpc('recalcular_desde_cero');
    setRecalculando(false);
    if (error) return setAviso(T.calendario.recalcularError);
    const r = data as { racha: number; perdida: boolean };
    setAviso(
      r.perdida ? T.calendario.recalculoCortado(enDias(r.racha)) : T.calendario.recalculoListo(enDias(r.racha))
    );
    setCorrigio(false);
    alCambiar();
  }

  function mover(delta: number) {
    const d = new Date(ancla.anio, ancla.mes + delta, 1);
    // no tiene sentido navegar a meses que todavía no pasaron
    if (aISO(d) > hoy) return;
    setAncla({ anio: d.getFullYear(), mes: d.getMonth() });
  }

  const esMesActual = ancla.anio === base.getFullYear() && ancla.mes === base.getMonth();

  return (
    <div className="seccion">
      <h3>{T.calendario.titulo}</h3>
      <div className="calendario">
        <div className="cal-cabecera">
          <button onClick={() => mover(-1)} aria-label={T.calendario.mesAnterior}>
            ‹
          </button>
          <span>{T.calendario.mesYAnio(MESES[ancla.mes], ancla.anio)}</span>
          <button onClick={() => mover(1)} disabled={esMesActual} aria-label={T.calendario.mesSiguiente}>
            ›
          </button>
        </div>

        <div className="cal-grilla cal-nombres">
          {DIAS_SEMANA.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="cal-grilla">
          {Array.from({ length: primerDia.getDay() }).map((_, i) => (
            <span key={`h${i}`} />
          ))}
          {celdas.map((c) => (
            <button
              key={c.fecha}
              className={`cal-dia ${c.estado} ${c.fecha === hoy ? 'hoy' : ''}`}
              onClick={() => setAbierto(c.fecha)}
              disabled={c.estado === 'futuro'}
              aria-label={T.calendario.verDia(c.dia)}
            >
              {c.dia}
            </button>
          ))}
        </div>

        {/* Las clases van prefijadas —`cal-hecho`, no `hecho`— porque una
            clase de una palabra es de todos (ver `.pantalla-descanso`). */}
        <div className="cal-leyenda">
          <span><i className="cal-hecho" />{T.calendario.leyendaHecho}</span>
          <span><i className="cal-vacio" />{T.calendario.leyendaVacio}</span>
          <span><i className="cal-descanso" />{T.calendario.leyendaDescanso}</span>
        </div>

        <p className="nota-privada">{T.calendario.nota}</p>

        {/* El botón está siempre —existía en Ajustes y sacarlo sería quitar
            algo que alguien puede estar usando—; la instrucción aparece recién
            después de corregir, que es cuando se entiende para qué es. */}
        {corrigio && <p className="nota-privada">{T.calendario.recalcularNota}</p>}
        <button className="boton-texto" onClick={recalcular} disabled={recalculando}>
          {recalculando ? T.calendario.recalculando : T.calendario.recalcular}
        </button>
        {aviso && <p className="ok-msg">{aviso}</p>}
      </div>

      {abierto && (
        <HojaDelDia
          fecha={abierto}
          alCambiar={() => {
            setCorrigio(true);
            cargar();
            alCambiar();
          }}
          alCerrar={() => setAbierto(null)}
        />
      )}
    </div>
  );
}
