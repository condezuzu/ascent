'use client';

import { useEffect, useMemo, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { plataforma } from '@/plataforma';
import { fechaCorta, fechaLinda, hoyISO } from '@nucleo/fechas';
import { deKilos, pesoCorto, type Unidad } from '@nucleo/peso';
import { claveDeEtiqueta } from '@nucleo/carga';
import { umbralValido } from '@nucleo/estancamiento';
import {
  fechasPorRevisar,
  filasPorMusculo,
  maximosDelCatalogo,
  semanaParaLeer,
  sesionesConFecha,
  type Catalogo,
  type EjercicioDelCatalogo,
  type MarcaParaMaximo,
  type SesionConBloques,
} from '@nucleo/volumen';
import HojaDelDia from '@/components/HojaDelDia';
import { T } from '@nucleo/textos';

const SEMANAS = 8;
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
  const [ejercicios, setEjercicios] = useState<EjercicioDelCatalogo[]>([]);
  const [marcas, setMarcas] = useState<MarcaParaMaximo[]>([]);
  const [unidad, setUnidad] = useState<Unidad>('kg');
  const [umbral, setUmbral] = useState(6);
  // Series por omisión: es la unidad que se entiende sin explicar.
  const [enSeries, setEnSeries] = useState(true);
  const [elegida, setElegida] = useState<number | null>(null);
  // Los grupos de máximos que se abrieron o cerraron a mano; el resto sigue
  // su omisión (abierto si tiene algo).
  const [plegados, setPlegados] = useState<Record<string, boolean>>({});
  const [avisoVisto, setAvisoVisto] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Qué grupos están mostrando también los ejercicios que nunca se hicieron.
  const [conVacios, setConVacios] = useState<Record<string, boolean>>({});
  const [propia, setPropia] = useState(0);

  useEffect(() => {
    plataforma.almacenamiento.leer(AVISO_VISTO).then((v) => setAvisoVisto(v === 'si'));
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const uid = (await miUsuario(supabase))?.id;
      if (!uid) return;
      const [{ data: ses }, { data: cat }, { data: perfil }, { data: prs }] = await Promise.all([
        // El día sale del registro (`logs.fecha`), no de `inicio`: es el día
        // en hora del usuario, el mismo que usa el calendario.
        supabase.from('sesiones').select('id, bloques, logs(fecha)').eq('user_id', uid),
        supabase.from('ejercicios').select('*'),
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        // Solo las mías: la RLS también deja leer las de los amigos.
        supabase.from('prs').select('ejercicio, peso, fecha').eq('user_id', uid),
      ]);
      if (!vivo) return;
      setSesiones(sesionesConFecha(ses));
      setEjercicios((cat ?? []) as EjercicioDelCatalogo[]);
      setMarcas((prs ?? []) as MarcaParaMaximo[]);
      if (perfil?.unidad_peso === 'lb') setUnidad('lb');
      setUmbral(umbralValido(perfil?.umbral_estancamiento));
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, recarga, propia]);

  const hoy = hoyISO();
  const catalogo: Catalogo = useMemo(
    () => new Map(ejercicios.map((e) => [e.id, { nombre: e.nombre, grupo: e.grupo }])),
    [ejercicios]
  );

  const porRevisar = useMemo(() => fechasPorRevisar(sesiones ?? []), [sesiones]);

  useEffect(() => {
    alSaberPorRevisar(porRevisar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porRevisar]);

  // EN UN `useMemo` Y NO EN EL CUERPO (16/9): esto recorre todas las sesiones, y
  // tocar una barra o cambiar de series a kilos vuelve a renderizar. Con dos
  // años de entrenamientos eran decenas de milisegundos por toque en un
  // teléfono, para volver a calcular exactamente lo mismo.
  //
  // Y VA ARRIBA DEL `return null`, no abajo. Abajo, la primera vez —con las
  // sesiones todavía sin llegar— el componente salía antes y estos dos hooks no
  // se llamaban; cuando las sesiones llegaban, sí. Dos cantidades distintas de
  // hooks en dos renders es el error de React #310, y la pestaña Entrenamiento
  // se caía entera. Lo rompió la tanda que los metió en `useMemo`: como
  // llamadas comunes estaban bien ahí, como hooks no.
  //
  // Lo encontró `capturas`, que mira las excepciones de la página; ningún test
  // de los nuestros monta una pantalla, que es el agujero que ya estaba anotado.
  const { filas, totales, hayAnotado, topeSeries, topeKilos } = useMemo(
    () => filasPorMusculo(sesiones ?? [], catalogo, { hoy, semanas: SEMANAS, umbral }),
    [sesiones, catalogo, hoy, umbral]
  );
  const maximos = useMemo(
    () => maximosDelCatalogo(sesiones ?? [], marcas, ejercicios),
    [sesiones, marcas, ejercicios]
  );

  if (!sesiones) return null;
  const hayKilos = topeKilos > 0;
  // Sin kilos anotados, series: una fila de kilos en cero no dice nada.
  const series = enSeries || !hayKilos;
  const valor = (s: { series: number; kilos: number }) => (series ? s.series : s.kilos);
  const tope = series ? topeSeries : topeKilos;
  // La semana que se lee: la tocada, o la última con algo en cualquier fila.
  const indice = semanaParaLeer(totales, elegida);
  // La última barra es la semana de hoy, que todavía no terminó.
  const enCurso = totales.length - 1;
  const leidaTotal = totales[indice];

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
        {!hayAnotado ? (
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
            <p className="volumen-cuando">
              {T.volumen.conTotal(
                indice === enCurso ? T.volumen.estaSemana : T.volumen.semanaDel(fechaLinda(leidaTotal.desde)),
                series ? T.volumen.soloSeries(leidaTotal.series) : `${kilosLindos(leidaTotal.kilos)} ${unidad}`
              )}
            </p>
            <div className="volumen-filas">
              {filas.map((f) => {
                const leida = f.semanas[indice];
                return (
                  <div className={`volumen-fila ${f.vacia ? 'vacia' : ''}`} key={f.grupo}>
                    <div className="volumen-rotulo">
                      <span className="capitalizado">{f.grupo}</span>
                      {f.dejado && <span className="volumen-dejado">{T.volumen.nadaDesde(fechaLinda(f.dejado.ultima))}</span>}
                    </div>
                    <div className="volumen-barras">
                      {f.semanas.map((s, i) => (
                        <button
                          key={s.desde}
                          className={`volumen-barra ${i === indice ? 'leida' : ''} ${i === enCurso && valor(s) > 0 ? 'en-curso' : ''}`}
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
              {/* EL EJE: la primera semana y la de hoy. Las del medio se leen
                  tocando; ocho fechas en ese ancho no se leerían. */}
              <div className="volumen-fila volumen-eje" aria-hidden>
                <span />
                <div className="volumen-eje-fechas">
                  <span>{fechaCorta(totales[0].desde)}</span>
                  <span>{T.volumen.esta}</span>
                </div>
                <span />
              </div>
            </div>
            <p className="nota-privada">{series ? T.volumen.notaSeries : T.volumen.notaKilos}</p>
          </>
        )}
      </div>

      {/* EL MÁXIMO DE TODO EL CATÁLOGO, en el orden del selector. Lo que nunca
          se hizo lleva un guion: ver el hueco es lo que le da sentido al aviso
          de estancamiento. Cada grupo se pliega; abierto si tiene algo. */}
      {maximos.length > 0 && (
        <div className="seccion">
          <h3>{T.volumen.maximos}</h3>
          <p className="nota-privada">{T.volumen.maximosNota}</p>
          {maximos.map((g) => {
            const clave = g.grupo ?? 'dots';
            const abiertoGrupo = plegados[clave] ?? g.conPeso > 0;
            // SOLO LOS QUE TIENEN ALGO; el resto, detrás de un toque.
            //
            // Un grupo abierto mostraba TODAS sus filas: con un ejercicio de
            // pecho anotado de doce, once guiones. Por seis grupos era toda la
            // pantalla, y para pasar de largo había que bajar muchísimo.
            //
            // El hueco sigue a un toque de distancia, que es lo que le da
            // sentido al aviso de estancamiento. Solo deja de ser lo primero.
            //
            // Si NO hay ninguno registrado se muestran igual: un grupo abierto
            // y vacío del todo no dice nada, y "ver los otros 12" sobre la nada
            // es una puerta a un cuarto vacío.
            const conPeso = g.filas.filter((f) => f.maximo);
            const faltan = g.filas.length - conPeso.length;
            const muestraVacios = conVacios[clave] ?? conPeso.length === 0;
            return (
              <div className="maximos-grupo" key={clave}>
                <button
                  className="maximos-cabeza"
                  aria-expanded={abiertoGrupo}
                  onClick={() => setPlegados((p) => ({ ...p, [clave]: !abiertoGrupo }))}
                >
                  <span>{g.grupo ? g.grupo.charAt(0).toUpperCase() + g.grupo.slice(1) : T.marca.cuentanDots}</span>
                  <span className="apagado">
                    {T.volumen.conPesoDe(g.conPeso, g.filas.length)} {abiertoGrupo ? '▾' : '›'}
                  </span>
                </button>
                {abiertoGrupo && (
                  <div className="dia-ejercicios volumen-maximos">
                    {(muestraVacios ? g.filas : conPeso).map((f) => (
                      <div className={`fila ${f.maximo ? '' : 'sin-maximo'}`} key={f.ejercicio}>
                        <span className="nombre">
                          {f.nombre}
                          {f.maximo && <span className="dia-pesos">{fechaLinda(f.maximo.fecha)}</span>}
                        </span>
                        <span className="cuantas">
                          {f.maximo
                            ? T.resumen.pesosDeSeries(
                                pesoCorto(f.maximo.peso, unidad),
                                unidad,
                                claveDeEtiqueta(f.maximo.carga, f.ejercicio)
                              )
                            : T.volumen.nada}
                        </span>
                      </div>
                    ))}
                    {faltan > 0 && conPeso.length > 0 && (
                      <button
                        className="boton-texto maximos-otros"
                        onClick={() => setConVacios((p) => ({ ...p, [clave]: !muestraVacios }))}
                      >
                        {muestraVacios ? T.volumen.ocultarLosOtros : T.volumen.verLosOtros(faltan)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
