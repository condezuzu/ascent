'use client';

import { useCallback, useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { hoyISO } from '@/lib/fechas';
import { mirarElGimnasio } from '@/lib/gimnasio';
import { leerVigilancia } from '@/lib/sesionCache';
import { anotar, borrarBitacora, comoTexto, leerBitacora } from '@/lib/bitacora';
import { cuantasPendientes, vaciar } from '@/lib/cola';
import { T } from '@/textos';
import type { OrigenSesion, Perfil } from '@/lib/tipos';

/**
 * Qué está viendo la app, y qué fue haciendo.
 *
 * Existe por una razón sola: **el registro por ubicación solo se puede probar
 * caminando hasta un gimnasio**, y ahí no hay consola, ni terminal, ni forma
 * de mirar nada. Todo lo que pasa allá queda anotado, y esto es donde se lee
 * después, en casa, con calma.
 *
 * Va plegado y abajo de todo: no es una pantalla de la app, es un banco de
 * trabajo. Se saca cuando el automático esté probado.
 */
export default function Diagnostico({ perfil }: { perfil: Perfil }) {
  const [supabase] = useState(() => crearCliente());
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState<{ origen: string } | null>(null);
  const [sinDia, setSinDia] = useState(false);
  const [sesion, setSesion] = useState<{
    corriendo: boolean;
    inicio?: string;
    origen?: OrigenSesion;
  } | null>(null);
  const [visita, setVisita] = useState<Awaited<ReturnType<typeof leerVigilancia>>>(null);
  const [lineas, setLineas] = useState('');
  const [mirando, setMirando] = useState(false);
  const [pendientes, setPendientes] = useState(0);

  const cargar = useCallback(async () => {
    const { data: log } = await supabase
      .from('logs')
      .select('origen')
      .eq('user_id', perfil.id)
      .eq('fecha', hoyISO())
      .maybeSingle();
    setDia(log);
    setSinDia(!log);
    const { data: s } = await supabase.rpc('mi_sesion');
    setSesion(s);
    setVisita(await leerVigilancia());
    setLineas(comoTexto(await leerBitacora()));
    setPendientes(await cuantasPendientes());
  }, [supabase, perfil.id]);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  /**
   * Mirar AHORA, a mano. Es lo que se aprieta parado en la puerta del gimnasio
   * para ver a cuántos metros dice que estás: es la única forma de saber si el
   * radio quedó bien sin esperar los siete minutos.
   */
  async function mirarAhora() {
    setMirando(true);
    const m = await mirarElGimnasio(perfil);
    await anotar('miré a mano', {
      adentro: m.adentro === null ? 'no sé' : m.adentro,
      metros: m.metros,
      precision: m.precision,
      radio: perfil.gimnasio_radio,
    });
    setMirando(false);
    cargar();
  }

  const hora = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(T.general.locale, { hour: '2-digit', minute: '2-digit' }) : '—';
  const horaMs = (ms?: number | null) => (ms ? hora(new Date(ms).toISOString()) : '—');

  return (
    <div className="seccion">
      <button className="fila-plegable" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <h3>{T.ajustes.diagnostico}</h3>
        <span>{abierto ? '−' : '+'}</span>
      </button>

      {abierto && (
        <>
          <dl className="diag">
            <dt>{T.ajustes.diagPunto}</dt>
            <dd>
              {perfil.gimnasio_lat
                ? T.ajustes.diagRadio(perfil.gimnasio_radio)
                : T.ajustes.diagSinPunto}
            </dd>

            <dt>{T.ajustes.diagDia}</dt>
            <dd>{sinDia ? T.ajustes.diagSinDia : (dia?.origen ?? '—')}</dd>

            <dt>{T.ajustes.diagSesion}</dt>
            <dd>
              {sesion?.corriendo
                ? `${sesion.origen ?? '—'} · ${T.ajustes.diagDesde(hora(sesion.inicio))}`
                : T.ajustes.diagSinSesion}
            </dd>

            <dt>{T.ajustes.diagCola}</dt>
            <dd>
              {pendientes === 0 ? T.ajustes.diagColaVacia : T.ajustes.diagColaCon(pendientes)}
            </dd>

            <dt>{T.ajustes.diagVisita}</dt>
            <dd>
              {visita
                ? `${T.ajustes.diagLlegada(horaMs(visita.desde))} · ${T.ajustes.diagVisto(
                    horaMs(visita.ultimoAdentro)
                  )}${visita.arranco ? ' · ' + T.ajustes.diagYaArranco : ''}`
                : T.ajustes.diagSinVisita}
            </dd>
          </dl>

          {pendientes > 0 && (
            <button
              className="boton-fantasma"
              onClick={async () => {
                await vaciar(supabase);
                cargar();
              }}
            >
              {T.ajustes.diagVaciarCola}
            </button>
          )}

          <button className="boton-fantasma" onClick={mirarAhora} disabled={mirando}>
            {mirando ? T.ajustes.gimnasioBuscando : T.ajustes.diagMirarAhora}
          </button>
          <p className="nota-privada">{T.ajustes.diagMirarNota}</p>

          {/* En un textarea y no en un <pre>: así se puede seleccionar todo y
              copiar de un toque desde el teléfono, que es lo que hace falta
              para mandarlo a algún lado. */}
          <textarea
            className="diag-bitacora"
            readOnly
            rows={12}
            value={lineas || T.ajustes.diagVacia}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="boton-texto" onClick={cargar}>
              {T.ajustes.diagRefrescar}
            </button>
            <button
              className="boton-texto"
              onClick={async () => {
                await borrarBitacora();
                cargar();
              }}
            >
              {T.ajustes.diagBorrar}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
