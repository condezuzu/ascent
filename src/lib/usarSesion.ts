'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearCliente } from '@/lib/supabase/client';
import { plataforma } from '@/plataforma';
import { T } from '@/textos';
import { eventos } from '@/plataforma/eventos';
import { desfasajeDelReloj, type SesionViva } from '@/lib/sesiones';
import { leerPerfilCache } from '@/lib/cache';
import { estaBloqueado, textoDeBloqueo } from '@/lib/pendiente';
import {
  bloquesVacios,
  cambiarEjercicio,
  cambiarMeta,
  paraGuardar,
  restar,
  siguiente,
  sumar,
  type EstadoBloques,
} from '@/lib/bloques';
import {
  AVISO,
  borrarSesionCache,
  duracionPredeterminada,
  guardarDuracionDeSesion,
  guardarSesionCache,
  actualizarSesionCache,
  leerDuracionDeSesion,
  leerMetaPreferida,
  guardarMetaPreferida,
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
import { cuantasPendientes, encolar, vaciar } from '@/lib/cola';
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

/**
 * Lo que dejó una sesión al cerrarse.
 *
 * `terminar` devolvía `true`/`false` y con eso alcanzaba para saber si hubo
 * que reintentar. No alcanza para el resumen del final: cuando la sesión se
 * cierra, todo su estado se pone en cero en el mismo tick, así que si el dato
 * no sale de acá ya no está en ningún lado.
 *
 * `deshizoElDia` en true significa que no hubo entrenamiento —un toque sin
 * querer, deshecho por la base—: ahí NO va ningún resumen, porque no hay nada
 * que resumir y festejar un error es peor que no decir nada.
 */
export type CierreDeSesion = {
  minutos: number;
  series: number;
  porUbicacion: boolean;
  deshizoElDia: boolean;
};

export function usarSesion(alCambiarElDia?: (r: ResultadoRegistro | null) => void) {
  const [supabase] = useState(() => crearCliente());
  const [inicio, setInicio] = useState<string | null>(null);
  const [desfasaje, setDesfasaje] = useState(0);
  const [series, setSeries] = useState(0);
  const [porUbicacion, setPorUbicacion] = useState(false);
  // El bloque en curso: en qué estás, cuántas te propusiste, cuántas van.
  // Ver `lib/bloques.ts` — el total de la sesión sigue siendo `series` y esto
  // es una anotación encima, no un reemplazo.
  const [bloques, setBloques] = useState<EstadoBloques>(() => bloquesVacios());
  const [idSesion, setIdSesion] = useState<string | null>(null);
  const [descanso, setDescanso] = useState<DescansoVivo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [, repintar] = useState(0);

  const releerCache = useCallback(async () => {
    const c = await leerSesionCache();
    setInicio(c?.inicio ?? null);
    setDesfasaje(c?.desfasaje ?? 0);
    // También lo que hace falta para DECIDIR, no solo para pintar: si la
    // sesión arrancó sola hay que poder cerrarla al salir, y eso lo mira el
    // vigilante, que es otra instancia de este mismo hook.
    if (c) {
      setPorUbicacion(c.porUbicacion ?? false);
      setIdSesion(c.id ?? null);
      if (c.bloques) setBloques(c.bloques);
      // Las series NO se pisan si hay toques esperando en la cola: ahí el
      // número bueno es el que está en pantalla, no el que se guardó.
      if (c.series !== undefined && (await cuantasPendientes()) === 0) setSeries(c.series);
    }
    setDescanso(await leerDescanso());
  }, []);

  // La consulta de verdad. La caché pinta al instante, esto la corrige.
  const confirmar = useCallback(async () => {
    const { data } = await supabase.rpc('mi_sesion');
    const s = data as (SesionViva & { series?: number; origen?: OrigenSesion }) | null;
    if (s?.corriendo && s.inicio) {
      const g = {
        inicio: s.inicio,
        desfasaje: desfasajeDelReloj(s.ahora),
        porUbicacion: s.origen === 'ubicacion',
        series: s.series ?? 0,
        id: s.id ?? null,
      };
      guardarSesionCache(g);
      setInicio(g.inicio);
      setDesfasaje(g.desfasaje);
      // El servidor manda, SALVO que haya toques esperando en la cola: ahí el
      // número bueno es el del teléfono, porque el servidor todavía no se
      // enteró. Sin esto, volver a abrir la app en el gimnasio sin señal
      // borraba las series que acababas de contar.
      if ((await cuantasPendientes()) === 0) setSeries(s.series ?? 0);
      setIdSesion(s.id ?? null);
      // Si la migración 24 todavía no corrió, `origen` no viene: se asume
      // manual, que es lo seguro — no cerrarla sola.
      setPorUbicacion(s.origen === 'ubicacion');
      // Al reconectar puede haber toques del `+` esperando desde el gimnasio.
      vaciar(supabase);
    } else {
      borrarSesionCache();
      setInicio(null);
      setSeries(0);
      setIdSesion(null);
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
      id: string;
      inicio: string;
      ahora: string;
      origen?: OrigenSesion;
      series?: number;
      yaEstaba?: boolean;
      registro: ResultadoRegistro | null;
    };
    const porUbi = (r.origen ?? opciones?.origen) === 'ubicacion';
    // La caché lleva TODO lo que hace falta para decidir, no solo para pintar:
    // la otra instancia del hook —la del vigilante— se entera por acá.
    guardarSesionCache({
      inicio: r.inicio,
      desfasaje: desfasajeDelReloj(r.ahora),
      porUbicacion: porUbi,
      series: r.series ?? 0,
      id: r.id ?? null,
    });
    setInicio(r.inicio);
    setDesfasaje(desfasajeDelReloj(r.ahora));
    setSeries(r.series ?? 0);
    setIdSesion(r.id ?? null);
    setPorUbicacion(porUbi);
    // La base ya no abandona la que estaba corriendo, la devuelve. Se dice,
    // porque si no parecería que arrancó una nueva y el número del cronómetro
    // saldría de la nada.
    // ARRANCA SOLO: el último ejercicio que anotaste y la última meta que
    // usaste (regla 2 de la migración 27). Si entrenás siempre parecido,
    // cambiarlo es la excepción y no la regla.
    //
    // Va DESPUÉS de guardar la sesión y sin bloquear: que el chip arranque
    // vacío es un detalle; que el cronómetro tarde en aparecer, no.
    (async () => {
      const [{ data: ultimo }, meta] = await Promise.all([
        supabase.rpc('ultimo_ejercicio'),
        leerMetaPreferida(),
      ]);
      const b = bloquesVacios(typeof ultimo === 'string' ? ultimo : null, meta ?? undefined);
      setBloques(b);
      await actualizarSesionCache({ bloques: b });
    })();

    if (r.yaEstaba) setAviso(T.inicio.yaHabiaSesion);
    alCambiarElDia?.(r.registro);
    return true;
  }

  /**
   * `hasta` es la última vez que se lo vio en el gimnasio, cuando la cierra la
   * salida. Sin eso, enterarse tarde —la app estuvo cerrada— daría una sesión
   * de cinco horas.
   */
  async function terminar(opciones?: { hasta?: number }): Promise<CierreDeSesion | null> {
    setOcupado(true);
    // Se anota lo que había ANTES de cerrar: abajo se pone todo en cero y el
    // resumen se quedaría sin datos que mostrar.
    const arranco = inicio;
    const seriesHechas = series;
    const eraPorUbicacion = porUbicacion;
    const desfase = desfasaje;
    const { data, error } = await cerrar(supabase, opciones);
    setOcupado(false);
    // Lo mismo al revés: si el cierre no llegó, quien llama tiene que poder
    // volver a intentarlo con la hora de salida correcta.
    if (error) return null;
    borrarSesionCache();
    borrarDescanso();
    setInicio(null);
    setSeries(0);
    setIdSesion(null);
    setDescanso(null);
    setPorUbicacion(false);
    setBloques(bloquesVacios());
    // Se dice, porque si no el día desaparece de la tira semanal sin
    // explicación y parece que la app se comió algo.
    if ((data as { deshizo_el_dia?: boolean } | null)?.deshizo_el_dia) {
      setAviso(T.inicio.diaDeshecho);
    }
    // Si la parás a mano estando todavía en el gimnasio, la visita queda
    // marcada como usada: sin esto se volvería a encender sola a los dos
    // minutos, que es la clase de cosa que hace que alguien apague la función.
    guardarVigilancia(marcarComoUsada(await leerVigilancia()));
    alCambiarElDia?.(null);

    const deshizoElDia = !!(data as { deshizo_el_dia?: boolean } | null)?.deshizo_el_dia;
    // `inicio` es del SERVIDOR y `hasta` es del teléfono: restarlos crudos
    // metería el desfasaje de reloj adentro de la duración. Por eso se lleva
    // el fin a hora de servidor antes de restar, igual que hace `transcurrido`
    // para el cronómetro que se ve en pantalla.
    const finServidor = (opciones?.hasta ?? Date.now()) - desfase;
    return {
      minutos: arranco
        ? Math.max(0, Math.round((finServidor - Date.parse(arranco)) / 60000))
        : 0,
      series: seriesHechas,
      porUbicacion: eraPorUbicacion,
      deshizoElDia,
    };
  }

  /**
   * Un toque: suma la serie Y arranca el descanso (§20.3).
   *
   * El número sube EN EL TELÉFONO y la escritura va a la cola. Antes se
   * mandaba y, si fallaba, no pasaba nada: ni subía ni avisaba. En un gimnasio
   * —un subsuelo donde la red se corta— ese es el caso normal, y es el botón
   * que más se toca. Ahora funciona sin red y se sincroniza al salir.
   */
  async function serieHecha() {
    const seg =
      (await leerDuracionDeSesion()) ??
      duracionValida(duracionPredeterminada(await leerPerfilCache()));
    setDescanso(guardarDescanso(seg));
    // DOS CUENTAS QUE NO SE DERIVAN UNA DE LA OTRA. `series` es el total de la
    // sesión y la única verdad del conteo; `hechas` es cuántas van en ESTE
    // bloque. Derivar el total de los bloques haría que ignorar el chip
    // rompiera la racha, que es justo lo que no puede pasar.
    const nuevas = series + 1;
    const b = sumar(bloques);
    setSeries(nuevas);
    setBloques(b);
    await actualizarSesionCache({ series: nuevas, bloques: b });
    await subir(nuevas, b);
  }

  /**
   * Deshacer una serie NO toca el descanso: son dos cosas separadas. Si
   * deshacer lo cancelara, corregir un número te costaría el temporizador que
   * estabas usando.
   */
  async function deshacerSerie() {
    const nuevas = Math.max(0, series - 1);
    const b = restar(bloques);
    setSeries(nuevas);
    setBloques(b);
    await actualizarSesionCache({ series: nuevas, bloques: b });
    await subir(nuevas, b);
  }

  /**
   * Las dos escrituras del contador, siempre juntas.
   *
   * Van a la COLA y no directo: el `+` es el botón que más se toca y se toca
   * justo donde no hay señal. Las dos son idempotentes y las dos llevan el id
   * de la sesión, que es lo que las hace encolables (ver `lib/cola.ts`).
   */
  async function subir(totalSeries: number, b: EstadoBloques) {
    if (!idSesion) return;
    await encolar(supabase, {
      rpc: 'fijar_series',
      args: { p_sesion: idSesion, p_series: totalSeries },
    });
    await encolar(supabase, {
      rpc: 'fijar_bloques',
      args: { p_sesion: idSesion, p_bloques: paraGuardar(b) },
    });
  }

  /** Cerrar el bloque y arrancar otro con el mismo ejercicio y la misma meta. */
  async function bloqueSiguiente() {
    const b = siguiente(bloques);
    if (b === bloques) return; // no había nada hecho: no se cierra un bloque vacío
    setBloques(b);
    await actualizarSesionCache({ bloques: b });
    await subir(series, b);
  }

  /** Cambiar de ejercicio cierra el bloque anterior (ver `lib/bloques.ts`). */
  async function elegirEjercicio(id: string | null) {
    const b = cambiarEjercicio(bloques, id);
    if (b === bloques) return;
    setBloques(b);
    await actualizarSesionCache({ bloques: b });
    await subir(series, b);
  }

  /** La meta no se sube a ningún lado: es intención, no un hecho. */
  async function elegirMeta(meta: number) {
    const b = cambiarMeta(bloques, meta);
    setBloques(b);
    await actualizarSesionCache({ bloques: b });
    await guardarMetaPreferida(b.meta);
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
      bloques,
    },
    empezar,
    terminar,
    serieHecha,
    deshacerSerie,
    bloqueSiguiente,
    elegirEjercicio,
    elegirMeta,
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
