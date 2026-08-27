'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearCliente } from '@/lib/supabase/client';
import { plataforma } from '@/plataforma';
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
  leerVigilancia,
  guardarVigilancia,
} from '@/lib/sesionCache';
import {
  borrarDescanso,
  duracionValida,
  guardarDescanso,
  leerDescanso,
  type DescansoVivo,
} from '@/lib/descanso';
import { marcarComoUsada } from '@/lib/llegada';
import type { OrigenSesion, ResultadoRegistro } from '@/lib/tipos';

export type EstadoSesion = {
  corriendo: boolean;
  inicio: string | null;
  desfasaje: number;
  series: number;
  descanso: DescansoVivo | null;
  ocupado: boolean;
  aviso: string;
  /**
   * Si arrancó sola al llegar al gimnasio (§13). Solo esas se cierran solas al
   * salir: la que empezaste vos con el botón se queda corriendo aunque te
   * vayas — quizá saliste a correr afuera, y apagártela sería peor.
   */
  porUbicacion: boolean;
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
/**
 * Las dos llamadas que cambiaron de firma en la migración 24, con vuelta atrás
 * si todavía no corrió.
 *
 * El código llega a producción por el push y la migración la corre una persona
 * a mano: entre una cosa y la otra hay una ventana en la que el cliente nuevo
 * le pide a la base una función que todavía no existe. Sin esto, en esa
 * ventana no se puede ni empezar ni terminar una sesión —o sea, la app está
 * rota— y el error sería un `PGRST202` que no le dice nada a nadie.
 *
 * Se prueba primero la firma nueva y no al revés a propósito: apenas la
 * migración corre, la vuelta atrás deja de usarse sola y no hay que acordarse
 * de sacarla.
 */
const NO_EXISTE = (e: { code?: string } | null) => e?.code === 'PGRST202';

async function iniciar(
  supabase: SupabaseClient,
  opciones?: { desde?: number; origen?: OrigenSesion }
) {
  const r = await supabase.rpc('iniciar_sesion', {
    p_desde: opciones?.desde ? new Date(opciones.desde).toISOString() : null,
    p_origen: opciones?.origen ?? 'manual',
  });
  if (!NO_EXISTE(r.error)) return r;
  return supabase.rpc('iniciar_sesion');
}

async function cerrar(supabase: SupabaseClient, opciones?: { hasta?: number }) {
  const r = await supabase.rpc('terminar_sesion', {
    p_hasta: opciones?.hasta ? new Date(opciones.hasta).toISOString() : null,
  });
  if (!NO_EXISTE(r.error)) return r;
  return supabase.rpc('terminar_sesion');
}

export function usarSesion(alCambiarElDia?: (r: ResultadoRegistro | null) => void) {
  const [supabase] = useState(() => crearCliente());
  const [inicio, setInicio] = useState<string | null>(null);
  const [desfasaje, setDesfasaje] = useState(0);
  const [series, setSeries] = useState(0);
  const [porUbicacion, setPorUbicacion] = useState(false);
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
    const s = data as (SesionViva & { series?: number; origen?: OrigenSesion }) | null;
    if (s?.corriendo && s.inicio) {
      const g = { inicio: s.inicio, desfasaje: desfasajeDelReloj(s.ahora) };
      guardarSesionCache(g);
      setInicio(g.inicio);
      setDesfasaje(g.desfasaje);
      setSeries(s.series ?? 0);
      // Si la migración 24 todavía no corrió, `origen` no viene: se asume
      // manual, que es lo seguro — no cerrarla sola.
      setPorUbicacion(s.origen === 'ubicacion');
    } else {
      borrarSesionCache();
      setInicio(null);
      setSeries(0);
      setPorUbicacion(false);
    }
  }, [supabase]);

  useEffect(() => {
    releerCache();
    confirmar();
    const alVolver = () => releerCache();
    const dejarDeEscuchar = eventos.escuchar(AVISO, alVolver);
    const dejarDeMirar = plataforma.ciclo.alCambiar(alVolver);
    return () => {
      dejarDeEscuchar();
      dejarDeMirar();
    };
  }, [releerCache, confirmar]);

  // Solo repinta: el tiempo sale siempre de restar contra el inicio (§17.5).
  //
  // Se PARA con la app atrás. Un repintado por segundo durante una sesión de
  // dos horas, para un número que nadie está mirando, es la misma clase de
  // desperdicio que el AudioContext despierto los tres minutos del descanso.
  // Volver no pierde nada: el efecto de arriba ya reléé al hacerse visible, y
  // el tiempo se calcula contra el inicio guardado.
  useEffect(() => {
    if (!inicio) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const arrancar = () => {
      clearInterval(id);
      if (plataforma.ciclo.visible()) {
        id = setInterval(() => repintar((n) => n + 1), 1000);
      }
    };
    arrancar();
    const dejarDeMirar = plataforma.ciclo.alCambiar(arrancar);
    return () => {
      clearInterval(id);
      dejarDeMirar();
    };
  }, [inicio]);

  /**
   * `desde` es la hora de LLEGADA cuando arranca sola, que no es la hora de la
   * llamada: el cronómetro dispara a los siete minutos pero la sesión tiene
   * que decir cuándo llegaste, o la duración sale corta siempre (§13). El
   * servidor la acota; acá se manda lo que se vio.
   */
  async function empezar(opciones?: { desde?: number; origen?: OrigenSesion }) {
    setOcupado(true);
    setAviso('');
    const { data, error } = await iniciar(supabase, opciones);
    setOcupado(false);
    // Devuelve si SALIÓ, porque el que llama por ubicación necesita saberlo:
    // un gimnasio en un subsuelo se queda sin señal, y si el arranque se diera
    // por hecho la sesión de ese día no existiría nunca.
    if (error) return false;
    if (estaBloqueado(data)) {
      setAviso(textoDeBloqueo(data.hasta));
      return false;
    }
    const r = data as {
      inicio: string;
      ahora: string;
      origen?: OrigenSesion;
      registro: ResultadoRegistro | null;
    };
    guardarSesionCache({ inicio: r.inicio, desfasaje: desfasajeDelReloj(r.ahora) });
    setInicio(r.inicio);
    setDesfasaje(desfasajeDelReloj(r.ahora));
    setSeries(0);
    setPorUbicacion((r.origen ?? opciones?.origen) === 'ubicacion');
    alCambiarElDia?.(r.registro);
    return true;
  }

  /**
   * `hasta` es la última vez que se lo vio en el gimnasio, cuando la cierra la
   * salida. Sin eso, enterarse tarde —la app estuvo cerrada— daría una sesión
   * de cinco horas.
   */
  async function terminar(opciones?: { hasta?: number }) {
    setOcupado(true);
    const { error } = await cerrar(supabase, opciones);
    setOcupado(false);
    // Lo mismo al revés: si el cierre no llegó, quien llama tiene que poder
    // volver a intentarlo con la hora de salida correcta.
    if (error) return false;
    borrarSesionCache();
    borrarDescanso();
    setInicio(null);
    setSeries(0);
    setDescanso(null);
    setPorUbicacion(false);
    // Si la parás a mano estando todavía en el gimnasio, la visita queda
    // marcada como usada: sin esto se volvería a encender sola a los dos
    // minutos, que es la clase de cosa que hace que alguien apague la función.
    guardarVigilancia(marcarComoUsada(await leerVigilancia()));
    alCambiarElDia?.(null);
    return true;
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
    estado: {
      corriendo: !!inicio,
      inicio,
      desfasaje,
      series,
      descanso,
      ocupado,
      aviso,
      porUbicacion,
    },
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
