'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEsperar } from '@/components/PantallaDeslizable';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { DIAS_SEMANA, MESES, deISO, hoyISO } from '@nucleo/fechas';
import { cargarMes, celdasDelMes, moverMes, recalcularRacha, type DatosDelMes } from '@compartido/calendario';
import HojaDelDia from '@/components/HojaDelDia';
import { T } from '@nucleo/textos';


/**
 * EL CALENDARIO: uno solo, y se toca para MIRAR.
 *
 * Había dos: el mapa de calor de Stats, que solo se miraba, y "Corregir días"
 * en Ajustes, donde tocar un día lo cambiaba. Ahora es este, en Stats, y
 * tocar un día abre su resumen; corregirlo es un paso aparte adentro de ese
 * resumen (ver `HojaDelDia`). Mirar un día ya no puede romperlo.
 *
 * Qué se pide, cómo se arma cada celda y el recálculo viven en
 * `compartido/calendario.ts`, que usa también la app nativa.
 */
export default function CalendarioDias({
  alCambiar,
  porRevisar = new Set(),
  alRevisar,
}: {
  alCambiar: () => void;
  /** Días con pesos anotados antes de los modos (migración 39): llevan una marca. */
  porRevisar?: Set<string>;
  alRevisar?: () => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const hoy = hoyISO();
  const base = deISO(hoy);
  const [ancla, setAncla] = useState({ anio: base.getFullYear(), mes: base.getMonth() });
  const [mesCargado, setMesCargado] = useState<DatosDelMes>({ conLog: new Set(), descansoAMano: new Set(), configs: [] });
  const [abierto, setAbierto] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  // La pantalla no aparece sin esto (19/9): si apareciera antes, esta sección
  // entraría después y empujaría lo de abajo. Ver `useEsperar`.
  useEsperar(cargado);
  const [recalculando, setRecalculando] = useState(false);
  const [aviso, setAviso] = useState('');
  // Si se corrigió algo en esta visita. La nota de recalcular aparece recién
  // ahí: antes es una instrucción para algo que nadie hizo.
  const [corrigio, setCorrigio] = useState(false);

  const primerDia = new Date(ancla.anio, ancla.mes, 1);

  const cargar = useCallback(async () => {
    const uid = (await miUsuario(supabase))?.id;
    if (uid) setMesCargado(await cargarMes(supabase, uid, ancla.anio, ancla.mes));
    setCargado(true);
  }, [supabase, ancla]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const celdas = celdasDelMes(ancla.anio, ancla.mes, hoy, mesCargado);

  async function recalcular() {
    setRecalculando(true);
    setAviso('');
    const r = await recalcularRacha(supabase);
    setRecalculando(false);
    setAviso(r.texto);
    if (!r.ok) return;
    setCorrigio(false);
    alCambiar();
  }

  function mover(delta: number) {
    const siguiente = moverMes(ancla.anio, ancla.mes, delta, hoy);
    if (siguiente) setAncla(siguiente);
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
              className={`cal-dia ${c.estado} ${c.fecha === hoy ? 'hoy' : ''} ${porRevisar.has(c.fecha) ? 'cal-revisar' : ''}`}
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
          {porRevisar.size > 0 && (
            <span><i className="cal-marca-revisar" />{T.volumen.leyendaRevisar}</span>
          )}
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
          alRevisar={alRevisar}
          alCerrar={() => setAbierto(null)}
        />
      )}
    </div>
  );
}
