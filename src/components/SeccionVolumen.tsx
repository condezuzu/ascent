'use client';

import { useEffect, useMemo, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { plataforma } from '@/plataforma';
import { fechaLinda, hoyISO } from '@nucleo/fechas';
import { deKilos, pesoCorto, type Unidad } from '@nucleo/peso';
import { claveDeEtiqueta } from '@nucleo/carga';
import { umbralValido } from '@nucleo/estancamiento';
import {
  gruposDejados,
  leerBloques,
  maximosPorEjercicio,
  volumenPorSemana,
  ORDEN_GRUPOS,
  type Catalogo,
  type SesionConBloques,
} from '@nucleo/volumen';
import HojaDelDia from '@/components/HojaDelDia';
import { T } from '@nucleo/textos';

const SEMANAS = 8;
const MAXIMOS_A_LA_VISTA = 6;
const AVISO_VISTO = 'ascent:aviso-revisar-cargas-visto';

/**
 * QUÉ VENÍS HACIENDO: el volumen por semana, el máximo de cada ejercicio y
 * dónde no estás entrenando. Todo sale de `nucleo/volumen.ts`; acá solo se
 * pide y se dibuja.
 *
 * SE ARMA EN EL TELÉFONO, no con una función de la base: las sesiones ya se
 * leen con su RLS de siempre, y la cuenta tiene que ser la misma que la del
 * resumen de un día. Dos implementaciones del volumen —una en SQL y otra en
 * TypeScript— serían dos números que tarde o temprano no coinciden.
 *
 * BARRAS Y NO UNA CURVA: una semana es una cantidad, no un punto de una
 * tendencia. Y las vacías se dibujan vacías, en su lugar.
 */
export default function SeccionVolumen({
  recarga,
  alSaberPorRevisar,
  alRevisar,
}: {
  /** Cambia cuando algo afuera tocó los datos (se corrigió un día). */
  recarga: number;
  /** Los días con bloques por revisar, para marcarlos en el calendario. */
  alSaberPorRevisar: (fechas: Set<string>) => void;
  /** Se revisó un bloque desde la hoja que abre esta sección. */
  alRevisar: () => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [sesiones, setSesiones] = useState<SesionConBloques[] | null>(null);
  const [catalogo, setCatalogo] = useState<Catalogo>(new Map());
  const [unidad, setUnidad] = useState<Unidad>('kg');
  const [umbral, setUmbral] = useState(6);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [enSeries, setEnSeries] = useState(false);
  const [elegida, setElegida] = useState<number | null>(null);
  const [todosLosMaximos, setTodosLosMaximos] = useState(false);
  const [avisoVisto, setAvisoVisto] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [propia, setPropia] = useState(0);

  useEffect(() => {
    plataforma.almacenamiento.leer(AVISO_VISTO).then((v) => setAvisoVisto(v === 'si'));
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const uid = (await miUsuario(supabase))?.id;
      if (!uid) return;
      const [{ data: ses }, { data: cat }, { data: perfil }] = await Promise.all([
        // El día sale del registro (`logs.fecha`), no de `inicio`: es el día
        // en hora del usuario, el mismo que usa el calendario.
        supabase.from('sesiones').select('id, bloques, logs(fecha)').eq('user_id', uid),
        supabase.from('ejercicios').select('id, nombre, grupo'),
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      ]);
      if (!vivo) return;
      const lista = (ses ?? []).flatMap((s) => {
        const log = s.logs as { fecha?: string } | { fecha?: string }[] | null;
        const fecha = Array.isArray(log) ? log[0]?.fecha : log?.fecha;
        return fecha ? [{ id: s.id as string, fecha, bloques: s.bloques }] : [];
      });
      setSesiones(lista);
      setCatalogo(new Map((cat ?? []).map((e) => [e.id as string, { nombre: e.nombre as string, grupo: e.grupo as string }])));
      if (perfil?.unidad_peso === 'lb') setUnidad('lb');
      setUmbral(umbralValido(perfil?.umbral_estancamiento));
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, recarga, propia]);

  const hoy = hoyISO();

  const porRevisar = useMemo(() => {
    const fechas = new Set<string>();
    for (const s of sesiones ?? []) if (leerBloques(s.bloques).some((b) => b.supuesta)) fechas.add(s.fecha);
    return fechas;
  }, [sesiones]);

  useEffect(() => {
    alSaberPorRevisar(porRevisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porRevisar]);

  if (!sesiones) return null;

  const semanas = volumenPorSemana(sesiones, catalogo, { hoy, semanas: SEMANAS, grupo });
  const hayKilos = semanas.some((s) => s.kilos > 0);
  // Sin kilos en la ventana, series: un gráfico de kilos en cero no dice nada.
  const series = enSeries || !hayKilos;
  const valor = (s: (typeof semanas)[number]) => (series ? s.series : s.kilos);
  const tope = Math.max(...semanas.map(valor), 0);
  // Los grupos que existen en lo anotado, en el orden de la interfaz.
  const gruposConAlgo = ORDEN_GRUPOS.filter((g) =>
    sesiones.some((s) => leerBloques(s.bloques).some((b) => catalogo.get(b.ejercicio)?.grupo === g))
  );
  const hayAlgo = gruposConAlgo.length > 0;
  // La semana que se lee abajo: la tocada, o la última con algo.
  const indice =
    elegida ?? semanas.reduce((ult, s, i) => (s.series > 0 ? i : ult), semanas.length - 1);
  const leida = semanas[indice];

  const maximos = maximosPorEjercicio(sesiones, catalogo);
  const dejados = gruposDejados(sesiones, catalogo, { hoy, semanas: umbral });
  const kilosLindos = (kg: number) => Math.round(deKilos(kg, unidad)).toLocaleString('es-UY');

  async function entendido() {
    setAvisoVisto(true);
    await plataforma.almacenamiento.guardar(AVISO_VISTO, 'si');
  }

  return (
    <>
      {/* LOS PESOS DE ANTES DE LOS MODOS: una vez, con la lista de los días.
          Después quedan marcados en el calendario hasta que se revisen. */}
      {!avisoVisto && porRevisar.size > 0 && (
        <div className="seccion aviso-revisar">
          <p>{T.volumen.revisarAviso(porRevisar.size)}</p>
          <div className="revisar-dias">
            {[...porRevisar].sort().map((f) => (
              <button key={f} className="pastilla" onClick={() => setAbierto(f)}>
                {fechaLinda(f)}
              </button>
            ))}
          </div>
          <button className="boton-texto" onClick={entendido}>
            {T.volumen.revisarEntendido}
          </button>
        </div>
      )}

      <div className="seccion volumen">
        <h3>{T.volumen.semanas}</h3>
        {!hayAlgo ? (
          <p className="nota-privada">{T.volumen.vacio}</p>
        ) : (
          <>
            <div className="volumen-filtros" role="group">
              <button className={`pastilla ${grupo === null ? 'prendida' : ''}`} onClick={() => setGrupo(null)}>
                {T.volumen.todo}
              </button>
              {gruposConAlgo.map((g) => (
                <button
                  key={g}
                  className={`pastilla capitalizado ${grupo === g ? 'prendida' : ''}`}
                  onClick={() => setGrupo(g)}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="volumen-barras" aria-hidden>
              {semanas.map((s, i) => (
                <button
                  key={s.desde}
                  className={`volumen-barra ${i === indice ? 'leida' : ''}`}
                  onClick={() => setElegida(i)}
                >
                  <span className="relleno" style={{ height: tope > 0 ? `${(valor(s) / tope) * 100}%` : 0 }} />
                </button>
              ))}
            </div>

            <p className="volumen-lectura">
              <span className="cuando">{T.volumen.semanaDel(fechaLinda(leida.desde))}</span>
              <span>
                {leida.series === 0
                  ? T.volumen.semanaVacia
                  : series
                    ? T.volumen.soloSeries(leida.series)
                    : T.volumen.kilosYSeries(kilosLindos(leida.kilos), unidad, leida.series)}
              </span>
            </p>

            {hayKilos && (
              <div className="selector-vista volumen-unidad">
                <button className={!series ? 'activo' : ''} onClick={() => setEnSeries(false)}>
                  {T.volumen.enKilos}
                </button>
                <button className={series ? 'activo' : ''} onClick={() => setEnSeries(true)}>
                  {T.volumen.enSeries}
                </button>
              </div>
            )}
            <p className="nota-privada">{T.volumen.nota}</p>
          </>
        )}
      </div>

      {/* DÓNDE NO ESTÁS ENTRENANDO, con la misma cantidad de semanas que el
          estancamiento: una sola preferencia para "cuánto es mucho tiempo". */}
      {dejados.length > 0 && (
        <div className="seccion">
          <h3>{T.volumen.dejados}</h3>
          {dejados.map((d) => (
            <p key={d.grupo} className="volumen-dejado">
              {T.volumen.dejado(d.grupo, d.semanas, fechaLinda(d.ultima))}
            </p>
          ))}
        </div>
      )}

      {maximos.length > 0 && (
        <div className="seccion">
          <h3>{T.volumen.maximos}</h3>
          <div className="dia-ejercicios volumen-maximos">
            {(todosLosMaximos ? maximos : maximos.slice(0, MAXIMOS_A_LA_VISTA)).map((m) => (
              <div className="fila" key={m.ejercicio}>
                <span className="nombre">
                  {m.nombre}
                  <span className="dia-pesos">{fechaLinda(m.fecha)}</span>
                </span>
                <span className="cuantas">
                  {T.resumen.pesosDeSeries(pesoCorto(m.peso, unidad), unidad, claveDeEtiqueta(m.carga, m.ejercicio))}
                </span>
              </div>
            ))}
          </div>
          {maximos.length > MAXIMOS_A_LA_VISTA && (
            <button className="boton-texto" onClick={() => setTodosLosMaximos((x) => !x)}>
              {todosLosMaximos ? T.volumen.verMenos : T.volumen.verTodos(maximos.length)}
            </button>
          )}
        </div>
      )}

      {abierto && (
        <HojaDelDia
          fecha={abierto}
          alCambiar={() => setPropia((n) => n + 1)}
          alRevisar={() => {
            setPropia((n) => n + 1);
            alRevisar();
          }}
          alCerrar={() => setAbierto(null)}
        />
      )}
    </>
  );
}
