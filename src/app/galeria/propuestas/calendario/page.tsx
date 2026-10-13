'use client';

// Propuesta: el calendario de Stats distingue el día que cubrió una vida.
//
// Hoy tiene tres formas —fuiste, no fuiste, descanso— y la tira de Inicio
// cuatro: la cuarta es "lo cubrió una vida" (el aro con un punto adentro). En el
// calendario ese día sale como "no fuiste", o sea un hueco en una racha que
// sigue entera, justo el día por el que alguien va a mirar el calendario.

import FondoEspacial from '@/components/FondoEspacial';
import { celdasDelMes, type CeldaDeDia, type DatosDelMes } from '@compartido/calendario';
import { DIAS_SEMANA, MESES } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { Banco, Comparar, Lado } from '../Banco';

// Setiembre de 2026 visto el viernes 18: una racha entera, con los domingos de
// descanso y dos días seguidos (martes 8 y miércoles 9) cubiertos por vidas.
const ANIO = 2026;
const MES = 8;
const HOY = '2026-09-18';
const dia = (d: number) => `2026-09-${String(d).padStart(2, '0')}`;
const DATOS: DatosDelMes = {
  conLog: new Set([1, 2, 3, 4, 5, 7, 10, 11, 12, 14, 15, 16, 17].map(dia)),
  descansoAMano: new Set([6, 13].map(dia)),
  configs: [],
};
const CUBIERTOS = new Set([8, 9].map(dia));

type Celda = Omit<CeldaDeDia, 'estado'> & { estado: CeldaDeDia['estado'] | 'cubierto' };

/** LA PROPUESTA: un día vacío que cubrió una vida es su propio estado. */
function celdasConVidas(cubiertos: Set<string>): Celda[] {
  return celdasDelMes(ANIO, MES, HOY, DATOS).map((c): Celda =>
    c.estado === 'vacio' && cubiertos.has(c.fecha) ? { ...c, estado: 'cubierto' } : c
  );
}

function Calendario({ celdas, conVidas }: { celdas: Celda[]; conVidas: boolean }) {
  return (
    <div className="seccion" style={{ marginBottom: 0 }}>
      <h3>{T.calendario.titulo}</h3>
      <div className="calendario">
        <div className="cal-cabecera">
          <button aria-label={T.calendario.mesAnterior}>‹</button>
          <span>{T.calendario.mesYAnio(MESES[MES], ANIO)}</span>
          <button disabled aria-label={T.calendario.mesSiguiente}>
            ›
          </button>
        </div>
        <div className="cal-grilla cal-nombres">
          {DIAS_SEMANA.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="cal-grilla">
          {Array.from({ length: new Date(ANIO, MES, 1).getDay() }).map((_, i) => (
            <span key={`h${i}`} />
          ))}
          {celdas.map((c) => (
            <button key={c.fecha} className={`cal-dia ${c.estado} ${c.fecha === HOY ? 'hoy' : ''}`} disabled={c.estado === 'futuro'}>
              {c.dia}
            </button>
          ))}
        </div>
        <div className="cal-leyenda">
          <span>
            <i className="cal-hecho" />
            {T.calendario.leyendaHecho}
          </span>
          <span>
            <i className="cal-vacio" />
            {T.calendario.leyendaVacio}
          </span>
          {conVidas && (
            <span>
              <i className="cal-cubierto" />
              Una vida
            </span>
          )}
          <span>
            <i className="cal-descanso" />
            {T.calendario.leyendaDescanso}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PropuestaCalendario() {
  return (
    <>
      {/* El mismo dibujo que `.tira-punto.cubierto` de Inicio, a la medida del
          calendario. En la app iría en globals.css, al lado de los otros tres. */}
      <style>{`
        .cal-dia.cubierto {
          color: transparent;
          position: relative;
          border-color: color-mix(in srgb, var(--pal-principal) 35%, transparent);
        }
        .cal-dia.cubierto::after {
          content: '';
          position: absolute;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--pal-claro) 45%, transparent);
        }
        .cal-leyenda i.cal-cubierto {
          position: relative;
          border: 1px solid color-mix(in srgb, var(--pal-principal) 35%, transparent);
        }
        .cal-leyenda i.cal-cubierto::after {
          content: '';
          position: absolute;
          inset: 0;
          margin: auto;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--pal-claro) 45%, transparent);
        }
      `}</style>
      <FondoEspacial rango={3} esquina="arriba-derecha" velo={0.74} />
      <Banco
        titulo="El calendario: el día que cubrió una vida"
        queEs="Una racha entera en la que el martes 8 y el miércoles 9 no se fue al gimnasio y se usaron dos vidas. La racha no se cortó; el calendario de hoy los dibuja igual que un día perdido."
      >
        <Comparar>
          <Lado rotulo="Hoy" nota="El 8 y el 9 se leen como «no fuiste»: un hueco en una racha que sigue entera.">
            <Calendario celdas={celdasDelMes(ANIO, MES, HOY, DATOS)} conVidas={false} />
          </Lado>
          <Lado
            rotulo="Propuesta"
            nota="El mismo aro con un punto que ya usa la tira de la semana en Inicio, y su línea en la referencia. No se dibuja como entrenado: no fue, pero no cortó nada."
          >
            <Calendario celdas={celdasConVidas(CUBIERTOS)} conVidas />
          </Lado>
        </Comparar>
      </Banco>
    </>
  );
}
