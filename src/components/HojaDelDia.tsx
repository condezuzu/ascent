'use client';

import { useEffect, useState } from 'react';
import EnElBody from '@/components/EnElBody';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { DIAS_SEMANA_LARGO, deISO, fechaLinda, hoyISO } from '@nucleo/fechas';
import { esDiaDeDescanso, type ConfigDescanso } from '@nucleo/descansos';
import { duracionLinda } from '@nucleo/sesiones';
import { deKilos, pesoCorto, type Unidad } from '@nucleo/peso';
import { resumenDelDia, type ResumenDelDia, type SesionDelDia } from '@nucleo/resumenDia';
import { claveDeEtiqueta, gruposDePesos, type Carga } from '@nucleo/carga';
import EtiquetaDeCarga from '@/components/EtiquetaDeCarga';
import { usarVersionDelEsquema } from '@compartido/esquema';
import { disponible } from '@nucleo/esquema';
import { T } from '@nucleo/textos';

type Destino = 'fui' | 'descanso' | 'nada';

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
  const versionEsquema = usarVersionDelEsquema();

  const esFuturo = fecha > hoyISO();

  useEffect(() => {
    let vivo = true;
    (async () => {
      const uid = (await miUsuario(supabase))?.id;
      if (!uid) return;
      const [{ data: log }, { data: catalogo }, { data: cfgs }, { data: perfil }] = await Promise.all([
        supabase.from('logs').select('id, es_descanso, origen').eq('user_id', uid).eq('fecha', fecha).maybeSingle(),
        supabase.from('ejercicios').select('id, nombre, grupo'),
        supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
        supabase.from('profiles').select('unidad_peso').eq('id', uid).maybeSingle(),
      ]);
      const [{ data: sesiones }, { data: fotos }] = log
        ? await Promise.all([
            supabase.from('sesiones').select('id, inicio, fin, estado, series, bloques').eq('log_id', log.id),
            supabase.from('photos').select('storage_path').eq('log_id', log.id).limit(1),
          ])
        : [{ data: [] }, { data: [] }];

      if (!vivo) return;
      if (perfil?.unidad_peso === 'lb') setUnidad('lb');
      setCuantasSesiones((sesiones ?? []).length);
      setResumen(
        resumenDelDia({
          log,
          sesiones: (sesiones ?? []) as SesionDelDia[],
          catalogo: new Map((catalogo ?? []).map((e) => [e.id as string, e.nombre as string])),
          esFuturo,
          esDescansoConfigurado: esDiaDeDescanso((cfgs ?? []) as ConfigDescanso[], fecha),
          ejercicioSinNombre: T.resumen.ejercicioSinNombre,
          grupos: new Map((catalogo ?? []).map((e) => [e.id as string, e.grupo as string])),
        })
      );

      const ruta = fotos?.[0]?.storage_path;
      if (ruta) {
        const { data: firmada } = await supabase.storage.from('fotos').createSignedUrl(ruta, 3600);
        if (vivo) setFoto(firmada?.signedUrl ?? null);
      } else {
        setFoto(null);
      }
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
    if (!disponible('revisarCargas', versionEsquema)) return;
    setError('');
    const { error: e } = await supabase.rpc('revisar_carga', { p_sesion: sesion, p_orden: orden, p_carga: carga });
    if (e) return setError(T.calendario.noSeAgrego);
    setVersion((v) => v + 1);
    alRevisar?.();
  }

  const actual: Destino | null =
    resumen?.estado === 'entrenado'
      ? 'fui'
      : resumen?.estado === 'descanso'
        ? 'descanso'
        : resumen?.estado === 'sin-registrar'
          ? 'nada'
          : null;

  async function corregir(destino: Destino, confirmado = false) {
    if (!resumen || ocupado) return;
    // Tocar lo que ya está NO hace nada. Sin esto, tocar "Fui" en un día que ya
    // era "fui" lo borraba y lo volvía a poner — y borrar el día borra en
    // cascada su sesión. Un toque de confirmar lo que ya sabías se llevaba
    // puesto el entrenamiento.
    if (destino === actual) return;
    // Sacarle el "fui" a un día con sesión la borra: se pregunta una vez.
    if (destino !== 'fui' && cuantasSesiones > 0 && !confirmado) {
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

    // Siempre se borra y se vuelve a poner, nunca `update`: la fila puede
    // tener origen y planeta del día que ya no corresponden a lo nuevo.
    const { error: eBorrar } = await supabase.from('logs').delete().eq('user_id', uid).eq('fecha', fecha);
    if (eBorrar) {
      setOcupado(false);
      return setError(T.calendario.noSeSaco);
    }
    if (destino !== 'nada') {
      const { error: eAgregar } = await supabase
        .from('logs')
        .insert({ user_id: uid, fecha, es_descanso: destino === 'descanso' });
      if (eAgregar) setError(T.calendario.noSeAgrego);
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
