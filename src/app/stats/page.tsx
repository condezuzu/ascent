'use client';

import { useCallback, useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { aISO, deISO, hoyISO, restarDias } from '@nucleo/fechas';
import { RANGOS, rangoDeRacha } from '@nucleo/rangos';
import { deKilos, esUnidad, type Unidad } from '@nucleo/peso';
import type { Log, Peso } from '@nucleo/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import GloboPrimeraVez from '@/components/GloboPrimeraVez';
import SeccionFuerza from '@/components/SeccionFuerza';
import SeccionSesiones from '@/components/SeccionSesiones';
import GraficoPeso from '@/components/GraficoPeso';
import AnotarPeso from '@/components/AnotarPeso';
import { T } from '@nucleo/textos';

export default function Estadisticas() {
  const [supabase] = useState(() => crearCliente());
  const [logs, setLogs] = useState<Log[]>([]);
  const [pesos, setPesos] = useState<Peso[]>([]);
  const [racha, setRacha] = useState(0);
  const [mejor, setMejor] = useState(0);
  const [unidad, setUnidad] = useState<Unidad>('kg');
  const [sexo, setSexo] = useState<string | null>(null);

  // Con nombre y no en un efecto anónimo: anotar el peso tiene que poder
  // volver a pedir los datos para que la tendencia se dibuje al toque.
  const cargar = useCallback(async () => {
    {
      const user = await miUsuario(supabase);
      if (!user) return;
      const [{ data: p }, { data: ls }, { data: ws }] = await Promise.all([
        // select('*') y no la lista de columnas: si el código llega antes que
        // la migración, pedir una columna que todavía no existe rompe la
        // pantalla entera en vez de solo mostrar el peso en kilos.
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('logs').select('*').eq('user_id', user.id).order('fecha'),
        supabase.from('weights').select('id, fecha, valor').eq('user_id', user.id).order('fecha'),
      ]);
      if (p) {
        setRacha(p.racha_actual);
        setMejor(p.mejor_racha);
        setSexo(p.sexo ?? null);
        if (esUnidad(p.unidad_peso)) setUnidad(p.unidad_peso);
      }
      setLogs(ls ?? []);
      // en la base el peso siempre está en kilos; acá se pasa a la unidad
      // que el usuario eligió, y recién entonces se suaviza y se dibuja
      setPesos((ws ?? []).map((w) => ({ ...w, valor: Number(w.valor) })));
    }
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

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

  // El suavizado y el dibujo se mudaron a `GraficoPeso`: eran veinte líneas
  // de cuentas de SVG en el medio de una pantalla que ya arma un mapa de
  // calor, una escalera y tres secciones más.

  const rangoActual = rangoDeRacha(racha);

  return (
    <>
      <FondoEspacial rango={rangoActual.n} esquina="arriba-derecha" velo={0.72} />
      <PantallaDeslizable>
        <div className="titulo-pantalla">{T.stats.titulo}</div>

        <GloboPrimeraVez cual="stats">
          {T.stats.globo}
        </GloboPrimeraVez>

        <div className="stat-grilla">
          <div className="stat-celda">
            <div className="valor">{racha}</div>
            <div className="etiqueta">{T.stats.rachaActual}</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{mejor}</div>
            <div className="etiqueta">{T.stats.mejorRacha}</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{en30}<span style={{ fontSize: 15, color: 'var(--sub)' }}>/30</span></div>
            <div className="etiqueta">{T.stats.ultimos30}</div>
          </div>
          <div className="stat-celda">
            <div className="valor">{esteMes}</div>
            <div className="etiqueta">{T.stats.esteMes}</div>
          </div>
        </div>

        <div className="seccion">
          <h3>{T.stats.elAno}</h3>
          <div className="tarjeta" style={{ overflowX: 'auto' }}>
            <div className="mapa-calor" style={{ minWidth: 420 }}>
              {celdas.map((c) => (
                <i key={c.fecha} className={c.clase} title={c.fecha} />
              ))}
            </div>
          </div>
        </div>

        {/* Las duraciones van acá, después del año y antes del peso (§17.7) */}
        <SeccionSesiones />

        {pesos.length >= 2 ? (
          <div className="seccion">
            <h3>{T.stats.pesoTendencia}</h3>
            <GraficoPeso pesos={pesos} unidad={unidad} />
            {/* El peso se anota ACÁ, que es donde vive. Antes solo se podía
                desde la hoja de registrar el día, y eso lo ataba a haber
                entrenado: pesarse un domingo contaba como día de gimnasio. */}
            <AnotarPeso unidad={unidad} alGuardar={cargar} />
          </div>
        ) : pesos.length === 1 ? (
          // Con un solo dato no hay tendencia que dibujar, pero decirle
          // "anotá tu peso" a alguien que acaba de anotarlo parece un error.
          <div className="seccion">
            <h3>{T.stats.peso}</h3>
            {/* Un solo dato no es una tendencia, pero decirle "anotá tu peso"
                a alguien que acaba de anotarlo parece un error de la app. Se
                muestra el número con la misma tipografía que el gráfico. */}
            <div className="peso-solo">
              <span className="hoy">
                {deKilos(pesos[0].valor, unidad).toFixed(1)}
                <em>{unidad}</em>
              </span>
            </div>
            <p className="nota-privada">{T.stats.pesoUnoMas}</p>
            <AnotarPeso unidad={unidad} alGuardar={cargar} />
          </div>
        ) : (
          <div className="seccion">
            <h3>{T.stats.peso}</h3>
            <p className="nota-privada">{T.stats.pesoVacio}</p>
            <AnotarPeso unidad={unidad} alGuardar={cargar} />
          </div>
        )}

        {/* La fuerza convive con la racha, no la reemplaza (§16.1): va después
            del peso y antes de la escalera, que es el cierre de la pantalla. */}
        {/* El peso corporal va en KILOS, que es como está la tabla de
            estándares; `unidad` es solo presentación. `pesos` ya viene
            ordenado por fecha, así que el último es el más reciente. */}
        <SeccionFuerza
          unidad={unidad}
          sexo={sexo}
          pesoCorporal={pesos.length > 0 ? pesos[pesos.length - 1].valor : null}
        />

        {/* Único lugar de la app donde los ocho rangos se muestran con nombre */}
        <div className="seccion">
          <h3>{T.stats.laEscalera}</h3>
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
                    <span className="actual-tag">{T.stats.acaEstas}</span>
                  ) : (
                    <span className="dias">{T.stats.diaN(r.desde === 0 ? 1 : r.desde)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </PantallaDeslizable>
      <Nav />
    </>
  );
}
