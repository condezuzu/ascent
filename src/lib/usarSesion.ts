'use client';

import { useCallback, useEffect, useState } from 'react';
import { crearCliente } from '@/lib/supabase/client';
import { eventos } from '@/plataforma/eventos';
import { desfasajeDelReloj, type SesionViva } from '@/lib/sesiones';
import { leerPerfilCache } from '@/lib/cache';
import { estaBloqueado, textoDeBloqueo } from '@/lib/pendiente';
import {
  AVISO,
  borrarSesionCache,
  duracionPredeterminada,
  guardarDuracionDeSesion,
  guardarSesionCache,
  leerDuracionDeSesion,
  leerSesionCache,
} from '@/lib/sesionCache';
import {
  borrarDescanso,
  duracionValida,
  guardarDescanso,
  leerDescanso,
  type DescansoVivo,
} from '@/lib/descanso';
import type { ResultadoRegistro } from '@/lib/tipos';

export type EstadoSesion = {
  corriendo: boolean;
  inicio: string | null;
  desfasaje: number;
  series: number;
  descanso: DescansoVivo | null;
  ocupado: boolean;
  aviso: string;
};

/**
 * El estado de la sesión, compartido por el chip de la cabecera y el botón de
 * "Serie hecha" (§20). Vive en un hook y no en un componente porque las dos
 * piezas están en lugares distintos de la pantalla y tienen que ver lo mismo.
 *
 * Se pinta desde la caché del teléfono y no consultando la base en cada
 * navegación: la sesión aparece en todas las pantallas y un viaje de red por
 * pantalla se notaría. La base sigue siendo la autoridad y se consulta al
 * empezar, al terminar y al montar.
 */
export function usarSesion(alCambiarElDia?: (r: ResultadoRegistro | null) => void) {
  const [supabase] = useState(() => crearCliente());
  const [inicio, setInicio] = useState<string | null>(null);
  const [desfasaje, setDesfasaje] = useState(0);
  const [series, setSeries] = useState(0);
  const [descanso, setDescanso] = useState<DescansoVivo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [, repintar] = useState(0);

  const releerCache = useCallback(async () => {
    const c = await leerSesionCache();
    setInicio(c?.inicio ?? null);
    setDesfasaje(c?.desfasaje ?? 0);
    setDescanso(await leerDescanso());
  }, []);

  // La consulta de verdad. La caché pinta al instante, esto la corrige.
  const confirmar = useCallback(async () => {
    const { data } = await supabase.rpc('mi_sesion');
    const s = data as (SesionViva & { series?: number }) | null;
    if (s?.corriendo && s.inicio) {
      const g = { inicio: s.inicio, desfasaje: desfasajeDelReloj(s.ahora) };
      guardarSesionCache(g);
      setInicio(g.inicio);
      setDesfasaje(g.desfasaje);
      setSeries(s.series ?? 0);
    } else {
      borrarSesionCache();
      setInicio(null);
      setSeries(0);
    }
  }, [supabase]);

  useEffect(() => {
    releerCache();
    confirmar();
    const alVolver = () => releerCache();
    const dejarDeEscuchar = eventos.escuchar(AVISO, alVolver);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      dejarDeEscuchar();
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [releerCache, confirmar]);

  // Solo repinta: el tiempo sale siempre de restar contra el inicio (§17.5).
  useEffect(() => {
    if (!inicio) return;
    const id = setInterval(() => repintar((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [inicio]);

  async function empezar() {
    setOcupado(true);
    setAviso('');
    const { data, error } = await supabase.rpc('iniciar_sesion');
    setOcupado(false);
    if (error) return;
    if (estaBloqueado(data)) return setAviso(textoDeBloqueo(data.hasta));
    const r = data as { inicio: string; ahora: string; registro: ResultadoRegistro | null };
    guardarSesionCache({ inicio: r.inicio, desfasaje: desfasajeDelReloj(r.ahora) });
    setInicio(r.inicio);
    setDesfasaje(desfasajeDelReloj(r.ahora));
    setSeries(0);
    alCambiarElDia?.(r.registro);
  }

  async function terminar() {
    setOcupado(true);
    await supabase.rpc('terminar_sesion');
    setOcupado(false);
    borrarSesionCache();
    borrarDescanso();
    setInicio(null);
    setSeries(0);
    setDescanso(null);
    alCambiarElDia?.(null);
  }

  /** Un toque: suma la serie Y arranca el descanso (§20.3). */
  async function serieHecha() {
    const seg =
      (await leerDuracionDeSesion()) ??
      duracionValida(duracionPredeterminada(await leerPerfilCache()));
    setDescanso(guardarDescanso(seg));
    const { data } = await supabase.rpc('sumar_serie');
    if (typeof data === 'number') setSeries(data);
  }

  /**
   * Deshacer una serie NO toca el descanso: son dos cosas separadas. Si
   * deshacer lo cancelara, corregir un número te costaría el temporizador que
   * estabas usando.
   */
  async function deshacerSerie() {
    const { data } = await supabase.rpc('restar_serie');
    if (typeof data === 'number') setSeries(data);
  }

  async function descansarSuelto() {
    const seg =
      (await leerDuracionDeSesion()) ??
      duracionValida(duracionPredeterminada(await leerPerfilCache()));
    setDescanso(guardarDescanso(seg));
  }

  return {
    estado: { corriendo: !!inicio, inicio, desfasaje, series, descanso, ocupado, aviso },
    empezar,
    terminar,
    serieHecha,
    deshacerSerie,
    descansarSuelto,
    cerrarDescanso: () => {
      borrarDescanso();
      setDescanso(null);
    },
    reiniciarDescanso: (d: DescansoVivo) => {
      setDescanso(d);
      guardarDuracionDeSesion(d.duracion);
    },
  };
}
