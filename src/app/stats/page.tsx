'use client';

import { useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { aISO, deISO, hoyISO, restarDias } from '@/lib/fechas';
import { RANGOS, rangoDeRacha } from '@/lib/rangos';
import type { Log, Peso } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Nav from '@/components/Nav';

export default function Estadisticas() {
  const [supabase] = useState(() => crearCliente());
  const [logs, setLogs] = useState<Log[]>([]);
  const [pesos, setPesos] = useState<Peso[]>([]);
  const [racha, setRacha] = useState(0);
  const [mejor, setMejor] = useState(0);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: p }, { data: ls }, { data: ws }] = await Promise.all([
        supabase.from('profiles').select('racha_actual, mejor_racha').eq('id', user.id).single(),
        supabase.from('logs').select('*').eq('user_id', user.id).order('fecha'),
        supabase.from('weights').select('id, fecha, valor').eq('user_id', user.id).order('fecha'),
      ]);
      if (p) {
        setRacha(p.racha_actual);
        setMejor(p.mejor_racha);
      }
      setLogs(ls ?? []);
      setPesos((ws ?? []).map((w) => ({ ...w, valor: Number(w.valor) })));
    })();
  }, [supabase]);

  const hoy = hoyISO();
  const entrenados = logs.filter((l) => !l.es_descanso);

  // constancia últimos 30 días
  const hace30 = restarDias(hoy, 29);
  const en30 = entrenados.filter((l) => l.fecha >= hace30).length;

  // este mes
  const d = deISO(hoy);
  const inicioMes = aISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const esteMes = entrenados.filter((l) => l.fecha >= inicioMes).length;

  // Mapa de calor: 26 semanas completas alineadas al calendario.
  // La grilla corre por columnas con 7 filas (domingo arriba): la primera
  // celda TIENE que ser un domingo o todo queda corrido un día.
  const setEntrenados = new Set(entrenados.map((l) => l.fecha));
  const setDescansos = new Set(logs.filter((l) => l.es_descanso).map((l) => l.fecha));
  const celdas: { fecha: string; clase: string }[] = [];
  const finSemana = restarDias(hoy, deISO(hoy).getDay() - 6); // sábado de esta semana
  for (let i = 26 * 7 - 1; i >= 0; i--) {
    const f = restarDias(finSemana, i);
    let clase = '';
    if (f > hoy) clase = 'futuro';
    else if (setEntrenados.has(f)) clase = 'si';
    else if (setDescansos.has(f)) clase = 'descanso';
    celdas.push({ fecha: f, clase });
  }

  // Peso: tendencia suavizada (media móvil de 7 días), nunca el dato crudo.
  // El peso oscila un kilo por razones ajenas al entrenamiento.
  const suavizado = pesos.map((_, i) => {
    const ventana = pesos.slice(Math.max(0, i - 6), i + 1);
    return ventana.reduce((s, w) => s + w.valor, 0) / ventana.length;
  });

  let pathPeso = '';
  let minP = 0;
  let maxP = 0;
  if (suavizado.length >= 2) {
    minP = Math.min(...suavizado) - 0.5;
    maxP = Math.max(...suavizado) + 0.5;
    const W = 300;
    const H = 80;
    pathPeso = suavizado
      .map((v, i) => {
        const x = (i / (suavizado.length - 1)) * W;
        const y = H - ((v - minP) / (maxP - minP)) * H;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  const rangoActual = rangoDeRacha(racha);

  return (
    <>
      <FondoEspacial rango={rangoActual.n} esquina="arriba-derecha" velo={0.72} />
      <div className="pantalla">
        <div className="titulo-pantalla">Datos</div>

        <div className="stat-grilla">
          <div className="stat-celda">
            <div className="valor">{racha}</div>
            <div className="etiqueta">Racha actual</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{mejor}</div>
            <div className="etiqueta">Mejor racha</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{en30}<span style={{ fontSize: 15, color: 'var(--sub)' }}>/30</span></div>
            <div className="etiqueta">Últimos 30 días</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{esteMes}</div>
            <div className="etiqueta">Este mes</div>
          </div>
        </div>

        <div className="seccion">
          <h3>El año</h3>
          <div className="tarjeta" style={{ overflowX: 'auto' }}>
            <div className="mapa-calor" style={{ minWidth: 420 }}>
              {celdas.map((c) => (
                <i key={c.fecha} className={c.clase} title={c.fecha} />
              ))}
            </div>
          </div>
        </div>

        {pathPeso ? (
          <div className="seccion">
            <h3>Peso — tendencia 7 días</h3>
            <div className="tarjeta">
              <svg viewBox="0 0 300 80" style={{ width: '100%', display: 'block' }}>
                <path d={pathPeso} fill="none" stroke="var(--pal-claro)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--apagado)' }}>
                <span>{minP.toFixed(1)} kg</span>
                <span>{suavizado[suavizado.length - 1].toFixed(1)} kg hoy</span>
                <span>{maxP.toFixed(1)} kg</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="seccion">
            <h3>Peso</h3>
            <p style={{ fontSize: 13, color: 'var(--apagado)' }}>
              Anotá tu peso al registrar días y acá aparece la tendencia. Solo la ves vos.
            </p>
          </div>
        )}

        {/* Único lugar de la app donde los ocho rangos se muestran con nombre */}
        <div className="seccion">
          <h3>La escalera</h3>
          <div className="tarjeta escalera-rangos">
            {RANGOS.map((r) => {
              const pasado = rangoActual.n > r.n;
              const esActual = rangoActual.n === r.n;
              return (
                <div
                  key={r.n}
                  className={`fila-rango ${pasado ? 'pasado' : esActual ? '' : 'futuro'}`}
                >
                  <Insignia rango={r.n} />
                  <span>{r.nombre}</span>
                  {esActual ? (
                    <span className="actual-tag">acá estás</span>
                  ) : (
                    <span className="dias">día {r.desde === 0 ? 1 : r.desde}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Nav />
    </>
  );
}
