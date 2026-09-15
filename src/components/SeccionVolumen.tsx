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
  fechasPorRevisar,
  filasPorMusculo,
  maximosPorEjercicio,
  semanaParaLeer,
  sesionesConFecha,
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
  // Series por omisión: es la unidad que se entiende sin explicar.
  const [enSeries, setEnSeries] = useState(true);
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
      setSesiones(sesionesConFecha(ses));
      setCatalogo(new Map((cat ?? []).map((e) => [e.id as string, { nombre: e.nombre as string, grupo: e.grupo as string }])));
      if (perfil?.unidad_peso === 'lb') setUnidad('lb');
      setUmbral(umbralValido(perfil?.umbral_estancamiento));
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, recarga, propia]);

  const hoy = hoyISO();

  const porRevisar = useMemo(() => fechasPorRevisar(sesiones ?? []), [sesiones]);

  useEffect(() => {
    alSaberPorRevisar(porRevisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porRevisar]);

  if (!sesiones) return null;

  const { filas, topeSeries, topeKilos } = filasPorMusculo(sesiones, catalogo, { hoy, semanas: SEMANAS, umbral });
  const hayKilos = topeKilos > 0;
  // Sin kilos anotados, series: una fila de kilos en cero no dice nada.
  const series = enSeries || !hayKilos;
  const valor = (s: { series: number; kilos: number }) => (series ? s.series : s.kilos);
  const tope = series ? topeSeries : topeKilos;
  // La semana que se lee: la tocada, o la última con algo en cualquier fila.
  const indice = semanaParaLeer(
    filas[0]?.semanas.map((s, i) => ({ ...s, series: filas.reduce((t, f) => t + f.semanas[i].series, 0) })) ?? [],
    elegida
  );

  const maximos = maximosPorEjercicio(sesiones, catalogo);
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

      {/* CUÁNTO ENTRENASTE CADA MÚSCULO, SEMANA A SEMANA. Sin la palabra
          "volumen": una fila por músculo, una barra por semana, y la unidad es
          la serie, que es lo que cualquiera cuenta en el gimnasio. Todas las
          filas comparten escala. Tocar una barra lee esa semana en todas. */}
      <div className="seccion volumen">
        <h3>{T.volumen.titulo}</h3>
        {filas.length === 0 ? (
          <p className="nota-privada">{T.volumen.vacio}</p>
        ) : (
          <>
            {hayKilos && (
              <div className="selector-vista volumen-unidad">
                <button className={series ? 'activo' : ''} onClick={() => setEnSeries(true)}>
                  {T.volumen.enSeries}
                </button>
                <button className={!series ? 'activo' : ''} onClick={() => setEnSeries(false)}>
                  {T.volumen.enKilos}
                </button>
              </div>
            )}
            <p className="volumen-cuando">{T.volumen.semanaDel(fechaLinda(filas[0].semanas[indice].desde))}</p>
            <div className="volumen-filas">
              {filas.map((f) => {
                const leida = f.semanas[indice];
                return (
                  <div className="volumen-fila" key={f.grupo}>
                    <div className="volumen-rotulo">
                      <span className="capitalizado">{f.grupo}</span>
                      {f.dejado && <span className="volumen-dejado">{T.volumen.nadaDesde(fechaLinda(f.dejado.ultima))}</span>}
                    </div>
                    <div className="volumen-barras">
                      {f.semanas.map((s, i) => (
                        <button
                          key={s.desde}
                          className={`volumen-barra ${i === indice ? 'leida' : ''}`}
                          onClick={() => setElegida(i)}
                          aria-label={`${f.grupo}, ${T.volumen.semanaDel(fechaLinda(s.desde))}: ${
                            series ? T.volumen.soloSeries(s.series) : `${kilosLindos(s.kilos)} ${unidad}`
                          }`}
                        >
                          <span className="relleno" style={{ height: tope > 0 ? `${(valor(s) / tope) * 100}%` : 0 }} />
                        </button>
                      ))}
                    </div>
                    <span className="volumen-valor">
                      {leida.series === 0
                        ? T.volumen.nada
                        : series
                          ? leida.series
                          : `${kilosLindos(leida.kilos)} ${unidad}`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="nota-privada">{series ? T.volumen.notaSeries : T.volumen.notaKilos}</p>
          </>
        )}
      </div>

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
