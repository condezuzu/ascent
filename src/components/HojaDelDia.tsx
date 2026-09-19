'use client';

import { useEffect, useState } from 'react';
import EnElBody from '@/components/EnElBody';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { DIAS_SEMANA_LARGO, deISO, fechaLinda, hoyISO } from '@nucleo/fechas';
import { duracionLinda } from '@nucleo/sesiones';
import { deKilos, pesoCorto, type Unidad } from '@nucleo/peso';
import type { ResumenDelDia } from '@nucleo/resumenDia';
import { cargarDia, corregirDia, destinoActual, queHacer, revisarCarga, type Destino } from '@compartido/dia';
import { claveDeEtiqueta, gruposDePesos, type Carga } from '@nucleo/carga';
import EtiquetaDeCarga from '@/components/EtiquetaDeCarga';
import { useVersion } from '@/lib/version';
import { disponible } from '@nucleo/esquema';
import { T } from '@nucleo/textos';

/**
 * UN DÍA, ABIERTO: qué hiciste, y corregirlo si está mal.
 *
 * MIRAR YA NO CAMBIA NADA. En el calendario viejo tocar un día lo pasaba de
 * estado, así que la única forma de averiguar qué había pasado era cambiarlo.
 * Ahora tocar abre esto, y corregir es un paso aparte con las tres opciones a
 * la vista en vez de un ciclo que había que memorizar.
 *
 * CORREGIR PUEDE BORRAR UNA SESIÓN, y lo dice. Las sesiones cuelgan del día:
 * sacar un día que tuvo sesión la borra entera —duración, series, en qué
 * estuviste—. El calendario viejo lo hacía igual y en silencio; con el resumen
 * a la vista ese borrado pasa a ser algo que se ve, así que se pregunta antes.
 *
 * Qué se pide y qué se hace al corregir viven en `compartido/dia.ts`, que usa
 * también la app nativa: acá solo se dibuja.
 */
export default function HojaDelDia({
  fecha,
  alCambiar,
  alRevisar,
  alCerrar,
}: {
  fecha: string;
  alCambiar: () => void;
  /** Se revisó el modo de un bloque viejo (migración 39). No es corregir el día. */
  alRevisar?: () => void;
  alCerrar: () => void;
}) {
  const [supabase] = useState(() => crearCliente());
  const [cerrando, setCerrando] = useState(false);
  const [resumen, setResumen] = useState<ResumenDelDia | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [cuantasSesiones, setCuantasSesiones] = useState(0);
  const [porConfirmar, setPorConfirmar] = useState<Destino | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [unidad, setUnidad] = useState<Unidad>('kg');
  const versionEsquema = useVersion();

  const esFuturo = fecha > hoyISO();

  useEffect(() => {
    let vivo = true;
    (async () => {
      const uid = (await miUsuario(supabase))?.id;
      if (!uid) return;
      const d = await cargarDia(supabase, uid, fecha, esFuturo);
      if (!vivo) return;
      setUnidad(d.unidad);
      setCuantasSesiones(d.cuantasSesiones);
      setResumen(d.resumen);
      setFoto(d.foto);
    })();
    return () => {
      vivo = false;
    };
  }, [supabase, fecha, esFuturo, version]);

  function cerrar() {
    setCerrando(true);
    setTimeout(alCerrar, 200);
  }

  /**
   * Qué significaba el número de un bloque anotado antes de los modos. Elegir
   * el que ya tenía es "estaba bien": también saca la marca.
   */
  async function revisar(sesion: string, orden: number, carga: Carga) {
    setError('');
    const e = await revisarCarga(supabase, versionEsquema, sesion, orden, carga);
    if (e) return setError(e);
    setVersion((v) => v + 1);
    alRevisar?.();
  }

  const actual = destinoActual(resumen);

  async function corregir(destino: Destino, confirmado = false) {
    if (!resumen || ocupado) return;
    // Lo que ya está no hace nada, y sacarle el "fui" a un día con sesión se
    // pregunta antes: ver `queHacer`.
    const paso = queHacer(destino, actual, cuantasSesiones, confirmado);
    if (paso === 'nada') return;
    if (paso === 'confirmar') {
      setPorConfirmar(destino);
      return;
    }
    setPorConfirmar(null);
    setError('');
    setOcupado(true);
    const uid = (await miUsuario(supabase))?.id;
    if (!uid) {
      setOcupado(false);
      return;
    }
    const r = await corregirDia(supabase, uid, fecha, destino);
    if (r.error) setError(r.error);
    if (!r.cambio) {
      setOcupado(false);
      return;
    }
    setOcupado(false);
    setVersion((v) => v + 1);
    alCambiar();
  }

  const titulo = `${DIAS_SEMANA_LARGO[deISO(fecha).getDay()]} ${fechaLinda(fecha)}`;

  return (
    <EnElBody>
      <div className={`hoja-fondo ${cerrando ? 'cerrando' : ''}`} onClick={cerrar} />
      <div className={`hoja hoja-dia ${cerrando ? 'cerrando' : ''}`} role="dialog" aria-modal aria-label={titulo}>
        <h2>{titulo}</h2>

        {/* Mientras carga, el lugar ya está: la hoja no crece de a saltos. */}
        {!resumen ? (
          <p className="sub">…</p>
        ) : (
          <>
            <p className={`dia-estado ${resumen.estado}`}>
              {resumen.estado === 'entrenado'
                ? T.resumen.fuiste
                : resumen.estado === 'descanso'
                  ? T.resumen.descanso
                  : resumen.estado === 'futuro'
                    ? T.resumen.futuro
                    : T.resumen.sinRegistrar}
              {/* Duración y series en la misma línea que el estado: es lo que
                  se busca primero, y en dos renglones se lee como dos datos. */}
              {resumen.duracionSegundos !== null && <span> · {duracionLinda(resumen.duracionSegundos)}</span>}
              {resumen.series > 0 && <span> · {T.resumen.series(resumen.series)}</span>}
            </p>

            {resumen.enCurso && <p className="nota-privada">{T.resumen.enCurso}</p>}

            {resumen.ejercicios.length > 0 && (
              <div className="dia-ejercicios">
                {resumen.ejercicios.map((e) => (
                  <div className="fila" key={e.id}>
                    <span className="nombre">
                      {e.nombre}
                      {/* LOS PESOS, uno por serie, en el orden en que se
                          hicieron: "60, 60, 62.5, 62.5 kg". Las series sin
                          peso van con una raya y no se esconden: se hicieron. */}
                      {/* Agrupados por modo: si el mismo ejercicio se hizo de
                          dos formas, "60" y "30 por mancuerna" no pueden ir en
                          la misma lista como si fueran lo mismo. */}
                      {e.pesos && (
                        <span className="dia-pesos">
                          {gruposDePesos(e.pesos, e.cargas)
                            .map((g) =>
                              T.resumen.pesosDeSeries(
                                g.pesos.map((p) => (p === null ? T.sesion.sinPeso : pesoCorto(p, unidad))).join(', '),
                                unidad,
                                claveDeEtiqueta(g.carga, e.id)
                              )
                            )
                            .join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="cuantas">{T.resumen.series(e.series)}</span>
                  </div>
                ))}
                {/* Solo si hay ejercicios anotados: si nunca se anotó en qué,
                    "12 series" arriba ya lo dice todo y una fila de "sin
                    ejercicio" sería un hueco señalado. */}
                {resumen.sinEjercicio > 0 && (
                  <div className="fila sin">
                    <span className="nombre">{T.resumen.sinEjercicio}</span>
                    <span className="cuantas">{T.resumen.series(resumen.sinEjercicio)}</span>
                  </div>
                )}
              </div>
            )}

            {/* POR MÚSCULO: una barra por músculo, del largo de sus series. Se
                ve de un vistazo en qué se fue el día, sin leer números. Solo si
                hay más de un músculo o hay kilos: con uno solo y sin pesos, las
                series ya están dichas arriba. Sin comparar con otros días: un
                día no tiene tendencia. */}
            {(resumen.volumen.length > 1 || resumen.volumen.some((v) => v.kilos > 0)) && (
              <div className="dia-ejercicios dia-volumen">
                <h3>{T.volumen.porMusculo}</h3>
                {resumen.volumen.map((v) => (
                  <div className="fila-musculo" key={v.grupo}>
                    <span className="nombre capitalizado">{v.grupo}</span>
                    <span className="dia-barra" aria-hidden>
                      <i style={{ width: `${(v.series / Math.max(...resumen.volumen.map((x) => x.series))) * 100}%` }} />
                    </span>
                    <span className="cuantas">
                      {v.kilos > 0
                        ? T.volumen.kilosYSeries(
                            Math.round(deKilos(v.kilos, unidad)).toLocaleString('es-UY'),
                            unidad,
                            v.series
                          )
                        : T.volumen.soloSeries(v.series)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* LOS PESOS DE ANTES DE LOS MODOS (migración 39). Uno por bloque:
                se elige qué significaba el número, o "está bien así". */}
            {resumen.porRevisar.length > 0 && disponible('revisarCargas', versionEsquema) && (
              <div className="dia-revisar">
                <h3>{T.volumen.revisarTitulo}</h3>
                <p className="nota-privada">{T.volumen.revisarNota}</p>
                {resumen.porRevisar.map((b) => (
                  <div className="fila-revisar" key={`${b.sesion}:${b.orden}`}>
                    <span className="nombre">
                      {b.nombre}
                      <span className="dia-pesos">
                        {b.pesos.map((p) => (p === null ? T.sesion.sinPeso : pesoCorto(p, unidad))).join(', ')} {unidad}
                      </span>
                    </span>
                    <span className="acciones">
                      <EtiquetaDeCarga
                        carga={b.carga}
                        ejercicio={b.ejercicio}
                        alElegir={(c) => revisar(b.sesion, b.orden, c)}
                      />
                      <button className="boton-texto" onClick={() => revisar(b.sesion, b.orden, b.carga)}>
                        {T.volumen.estaBien}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {resumen.estado === 'entrenado' && cuantasSesiones === 0 && (
              <p className="nota-privada">
                {resumen.origen === 'ubicacion'
                  ? T.resumen.porUbicacion
                  : resumen.origen === 'salud'
                    ? T.resumen.porSalud
                    : T.resumen.sinSesion}
              </p>
            )}

            {foto && (
              // <img> y no next/image: son URLs firmadas de Supabase que vencen en una hora, y el optimizador las cachearia vencidas.
              <img className="dia-foto" src={foto} alt="" />
            )}

            {resumen.estado !== 'futuro' && (
              <div className="dia-corregir">
                <h3>{T.resumen.corregir}</h3>
                <div className="selector-vista">
                  {(['fui', 'descanso', 'nada'] as Destino[]).map((d) => (
                    <button
                      key={d}
                      className={actual === d ? 'activo' : ''}
                      disabled={ocupado}
                      onClick={() => corregir(d)}
                    >
                      {d === 'fui' ? T.resumen.marcarFui : d === 'descanso' ? T.resumen.marcarDescanso : T.resumen.marcarNada}
                    </button>
                  ))}
                </div>
                {porConfirmar && (
                  <p className="dia-confirmar">
                    {T.resumen.borraSesion}{' '}
                    <button className="boton-texto peligro" onClick={() => corregir(porConfirmar, true)}>
                      {T.resumen.siCambiar}
                    </button>
                    <button className="boton-texto" onClick={() => setPorConfirmar(null)}>
                      {T.album.no}
                    </button>
                  </p>
                )}
                {error && <p className="error-msg">{error}</p>}
              </div>
            )}
          </>
        )}

        <button className="boton-texto" onClick={cerrar}>
          {T.general.cerrar}
        </button>
      </div>
    </EnElBody>
  );
}
