'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
// El tipo del cliente lo pone cada app: la web y la nativa traen cada una su
// copia de supabase-js, y para TypeScript son dos clases distintas.
import type { Cliente } from '@cliente';
import { crearCliente } from '@cliente';
import { plataforma } from '@plataforma';
import { T } from '@nucleo/textos';
import { eventos } from '@compartido/eventos';
import { ejerciciosDeHoy } from '@nucleo/rutinas';
import { cargarMisRutinas, rutinaActivaDelTelefono } from '@compartido/rutinas';
import { DIA_CAMBIO } from '@compartido/gimnasio';
import {
  desfasajeDelReloj,
  cacheTrasConfirmar,
  conteoAlConfirmar,
  cierreSolo,
  duracionLinda,
  masReciente,
  type SesionViva,
} from '@nucleo/sesiones';
import { disponible } from '@nucleo/esquema';
import { versionDelEsquema } from '@compartido/esquema';
import { leerPerfilCache } from '@compartido/cache';
import { revisarPerdidaAntes, SIN_REVISAR } from '@compartido/anotarDia';
import { estaBloqueado, textoDeBloqueo } from '@nucleo/pendiente';
import {
  bloquesVacios,
  cambiarCarga,
  cambiarEjercicio,
  corregirCarga,
  corregirEjercicio,
  cambiarMinutos,
  cambiarPeso,
  corregirPeso,
  mudarEjercicio,
  cambiarMeta,
  paraGuardar,
  pesoAlCambiarDeModo,
  proponerPeso,
  sembrar,
  serieDelDescanso,
  loQueSeHaceAhora,
  sinNadaContado,
  unirConGuardados,
  terminarBloque,
  arrancarCardio,
  cerrarVueltaDeCardio,
  descartarCardio,
  VUELTA_MINIMA_MS,
  type EstadoBloques,
} from '@nucleo/bloques';
import { sumarSerie, restarSerie, corregirEnLista, seriesAlReleer } from '@nucleo/conteo';
import { hoyISO, restarDias } from '@nucleo/fechas';
import {
  rutinaParaHoy,
  siguienteEnRutina,
  reengancharDesde,
  ejerciciosEnOrden,
  type SesionRutina,
} from '@nucleo/rutina';
import { cambioDeSesion,
  AVISO,
  esMio,
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
  fotoDeLaCache,
  relojDeToques,
  type SesionCacheada,
} from '@compartido/sesionCache';
import {
  INICIAL,
  YO,
  bloquesDe,
  faltanBloques,
  idVisto,
  leerViva,
  refDe,
  rutinaRef,
  rutinaEsGuardada,
  sesionesRutinaRef,
  setterDe,
  suscribirViva,
} from '@compartido/sesionViva';
import {
  actualizarLoQueSeHace,
  borrarDescanso,
  duracionValida,
  guardarDescanso,
  leerDescanso,
  restante,
  type DescansoVivo,
} from '@compartido/descanso';
import { marcarComoUsada } from '@nucleo/llegada';
import { cuantasPendientes, encolar, estaPendiente, quedaDeLaSesion, vaciar } from '@compartido/cola';
import { leerCargasElegidas, recordarCarga } from '@compartido/cargas';
import {
  leerRecordados,
  quitarMarcasDeHoy,
  recordadosAlDia,
  sumarSesionARecordados,
  traerRecordados,
  type Recordados,
} from '@compartido/pesosRecordados';
import { modoDelBloqueEnCurso, ultimoPesoEnModo } from '@nucleo/pesoRecordado';
import { claveDeSubida, diaDeLaSesion, ejerciciosQueSeFueron, pesoConSubida, seHizoHoy } from '@nucleo/subir';
import { cargaValida, type Carga } from '@nucleo/carga';
import type { OrigenSesion, ResultadoRegistro } from '@nucleo/tipos';

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
  supabase: Cliente,
  opciones?: { desde?: number; origen?: OrigenSesion }
) {
  // EMPEZAR LA SESIÓN TAMBIÉN ANOTA EL DÍA si no estaba, así que lleva la misma
  // revisión adelante que `registrar_dia` (ver `anotarDia.ts`). El vigilante la
  // arranca solo al llegar al gimnasio, sin que nadie haya abierto Inicio.
  if (!(await revisarPerdidaAntes(supabase))) return { data: null, error: SIN_REVISAR };
  const r = await supabase.rpc('iniciar_sesion', {
    p_desde: opciones?.desde ? new Date(opciones.desde).toISOString() : null,
    p_origen: opciones?.origen ?? 'manual',
  });
  if (!NO_EXISTE(r.error)) return r;
  return supabase.rpc('iniciar_sesion');
}

async function cerrar(supabase: Cliente, opciones?: { hasta?: number }) {
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
  /**
   * Los bloques de la sesión que terminó, como se guardaron. El resumen los
   * usa para preguntar "¿lo guardo como marca?" (`nucleo/marcaSugerida.ts`):
   * al cerrar se ponen en cero, y si no salen de acá ya no están.
   */
  bloques: ReturnType<typeof paraGuardar>;
  /**
   * Los pasos caminados DURANTE la sesión (3.3), de Apple Health. `null` cuando
   * no se sabe (sin Health/permiso); el resumen solo lo muestra si hay dato > 0.
   * Se calcula una vez al cerrar; al reabrir el resumen a mano no está.
   */
  pasos?: number | null;
};

// EL DATO ES DEL DUEÑO (`sesionViva.ts`), no de cada instancia: estos setters y
// refs son ventanas al mismo lugar, y por eso viven afuera del hook. Lo que
// escribe la pantalla lo ve el vigilante en el acto, sin pasar por la caché.
const setInicio = setterDe('inicio');
const setDesfasaje = setterDe('desfasaje');
const setSeries = setterDe('series');
const setPorUbicacion = setterDe('porUbicacion');
const setCacheLeida = setterDe('cacheLeida');
const setBloques = setterDe('bloques');
const setSugerido = setterDe('sugerido');
const setIdSesion = setterDe('idSesion');
const setDescanso = setterDe('descanso');
const setUltimaActividad = setterDe('ultimaActividad');
// "Lo de ahora" para las funciones async que siguen después de que el render
// que las creó pasó. Antes eran copias que había que mantener al día a mano.
const bloquesRef = refDe('bloques');
const seriesRef = refDe('series');
const descansoRef = refDe('descanso');
const inicioRef = refDe('inicio');
const ultimaRef = refDe('ultimaActividad');
const desfasajeRef = refDe('desfasaje');
// LOS EJERCICIOS QUE SE VEN (vuelta 7 de la cacería): un propio de un amigo que ya no
// se ve (la 80) seguía saliendo del historial como rutina o semilla. Null es "no se
// supo" (sin señal): ahí no se filtra.
let visibles: Set<string> | null = null;
const seVe = (id: string) => !visibles || visibles.has(id);
const sinServidor = () => INICIAL;
// EL CARDIO CUENTA COMO ACTIVIDAD (cacería del 15/10). Con el cronómetro andando
// nadie toca nada, y a la media hora la sesión se cerraba sola en plena cinta.
// La marca se adelanta (la base la acota a lo que acepta) y se renueva cada
// tanto con la app adelante, como hace el descanso con su fin.
const MARCA_DEL_CARDIO_MS = 60 * 60000;
const RENOVAR_CARDIO_MS = 5 * 60000;

export function useSesion(
  alCambiarElDia?: (r: ResultadoRegistro | null) => void,
  // EL REDIBUJO DE CADA SEGUNDO es para quien muestra el reloj con el estado del
  // hook (la web). La nativa tiene relojes que se tickean solos (`CadaSegundo`) y
  // se ahorra redibujar la pantalla entera por segundo (15/10).
  { repintarCadaSegundo = true }: { repintarCadaSegundo?: boolean } = {}
) {
  const [supabase] = useState(() => crearCliente());
  // La firma de la caché es UNA por aparato (ver `YO`): lo que escribe otra
  // instancia ya está en el dueño y releerlo solo podía traer algo más viejo.
  const yo = YO;
  const { inicio, desfasaje, series, porUbicacion, cacheLeida, bloques, sugerido, idSesion, descanso, ultimaActividad } =
    useSyncExternalStore(suscribirViva, leerViva, sinServidor);
  // El ejercicio del que ya se sabe con qué se hace —la base contestó, o no
  // hay señal y se decidió con lo que había—. Hasta entonces la pregunta de la
  // primera vez no se muestra: a quien la contestó en otro teléfono se le
  // aparecería un segundo, hasta que llega la respuesta.
  const [cargaConsultada, setCargaConsultada] = useState<string | null>(null);
  // "LA PRÓXIMA, MÁS" (10/10): el peso propuesto salió de una marca. Es para que
  // la pantalla diga de dónde sale ese disco de más; no se guarda.
  const [subida, setSubida] = useState<{ ejercicio: string; series: number; antes: number; ahora: number } | null>(null);
  // LA RUTINA QUE SE PROPONE SOLA (ver `nucleo/rutina.ts`). `sugerido` dice si el
  // ejercicio y el peso del bloque actual son una SUGERENCIA que todavía no se
  // confirmó (contando una serie): la UI la muestra distinta —"fantasma"— para
  // que nadie cuente una serie que no hizo. `rutinaRef` y `sesionesRutinaRef`
  // viven en el dueño.
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [, repintar] = useState(0);
  const confirmando = useRef(false);
  // TRABA SÍNCRONA CONTRA EL DOBLE-TAP en empezar/terminar (la misma idea que
  // `compartido/useEnVuelo.ts`, pero acá adentro: estas dos ya devuelven un
  // valor que el llamador usa, así que no se envuelven desde afuera). El
  // `disabled={ocupado}` del botón es de ESTADO y recién frena en el próximo
  // render; un segundo toque que cae antes pasaba igual y mandaba dos
  // `iniciar_sesion`/`terminar_sesion`. Una sola para las dos: no tiene sentido
  // arrancar y cerrar a la vez, y así un toque en cada botón tampoco se pisa.
  const operandoSesion = useRef(false);
  // Para el reloj de cada segundo, que se armó con el `marcar` de otro render.
  const marcarRef = useRef(marcar);
  marcarRef.current = marcar;
  const cardioRenovadoEl = useRef(0);

  // LOS BLOQUES SON DE UNA SESIÓN (4/10). Vivían en memoria sin saber de cuál:
  // el único que los vaciaba era `terminar`, y solo en la instancia que
  // terminaba. Si la sesión se cerraba sola, o la terminaba otra pantalla u otro
  // aparato, la siguiente nacía con los bloques de la anterior y al volver al
  // frente se subían a la base: los kilos de ese día quedaban anotados dos veces.
  // Acá se anota de qué sesión son, y cuando la sesión es otra —o ninguna— se
  // tiran. Con una base sin ids (`null`) queda como antes.
  const bloquesSonDe = useCallback((id: string | null) => {
    const deOtra = bloquesDe.current !== null && bloquesDe.current !== id;
    bloquesDe.current = id;
    if (!deOtra) return;
    // El ref también, y ya: la semilla de `empezar` y `recuperarBloques` lo leen
    // antes del próximo render.
    const vacios = bloquesVacios();
    bloquesRef.current = vacios;
    setBloques(vacios);
    setSugerido(false);
  }, []);

  const releerCache = useCallback(async () => {
    // LA FOTO, ANTES DE LEER (4/10): si hay un toque que todavía no llegó a la
    // caché, o cae uno mientras se lee, lo leído es más viejo que la pantalla y
    // el conteo no se toca. Ver "el reloj de los toques" en `sesionCache`.
    const alDia = fotoDeLaCache();
    const c = await leerSesionCache();
    // TODO O NADA (15/10): antes la sesión misma —inicio, id— se aplicaba sin
    // mirar la foto, y una lectura vacía que llegaba después de Iniciar sacaba
    // la sesión de la pantalla. Lo que hay en el dueño ya es más nuevo.
    if (alDia()) {
      setInicio(c?.inicio ?? null);
      setDesfasaje(c?.desfasaje ?? 0);
      bloquesSonDe(c?.id ?? null);
      // También lo que hace falta para DECIDIR, no solo para pintar: si la
      // sesión arrancó sola hay que poder cerrarla al salir, y eso lo mira el
      // vigilante, que es otra instancia de este mismo hook.
      if (c) {
        setPorUbicacion(c.porUbicacion ?? false);
        setIdSesion(c.id ?? null);
        if (c.id) idVisto.current = c.id;
        // La marca de "faltan los de allá" vuelve con la caché (cacería del 15/10):
        // solo en memoria, iOS la mataba y el primer + subía la lista de acá sola.
        if (c.faltanBloques && c.id) faltanBloques.current = c.id;
        setUltimaActividad(c.ultimaActividad ?? null);
        if (c.bloques) setBloques(c.bloques);
        // El fantasma sobrevive a que iOS mate la app: si el bloque en curso era
        // una sugerencia sin confirmar, al reabrir sigue viéndose como sugerencia
        // y no como algo ya elegido (ver `SesionCacheada.sugerido`).
        setSugerido(!!c.sugerido);
        if (c.rutina) {
          rutinaRef.current = c.rutina;
          rutinaEsGuardada.current = !!c.rutinaGuardada;
          // La deducida re-engancha desde el historial, que también vivía en memoria.
          if (!c.rutinaGuardada && sesionesRutinaRef.current.length === 0) void cargarHistorialRutina();
        }
        // EL TOTAL AL REABRIR (bug "3 de 3 · 0 en total", 29/9). Antes: con cola
        // pendiente se descartaba la caché y quedaba el total EN PANTALLA —que tras
        // un cierre de iOS es el 0 inicial—, mientras los puntos se restauraban del
        // bloque. Ahora `seriesAlReleer` toma el máximo entre pantalla y caché
        // cuando hay pendientes (respeta toques nuevos sin perder lo guardado), y la
        // caché cuando no hay. Se lee del ref, no del closure viejo. Ver conteo.ts.
        const hayPendientes = (await cuantasPendientes()) > 0;
        if (alDia()) setSeries(seriesAlReleer(seriesRef.current, c.series, hayPendientes));
      }
    }
    setDescanso(await leerDescanso());
    setCacheLeida(true);
  }, [bloquesSonDe]);

  // La consulta de verdad. La caché pinta al instante, esto la corrige.
  //
  // CORREGIR NO ES PISAR. Acá vivían los dos bugs del contador (ver
  // `cacheTrasConfirmar`): un error de red se trataba como "no hay sesión" y
  // borraba todo, y la escritura reemplazaba la caché entera, así que se
  // llevaba puestos los bloques —que el servidor no manda en esta forma— cada
  // vez que la pantalla se montaba.
  const preguntar = useCallback(async (): Promise<'vieja' | void> => {
    if (confirmando.current) return;
    confirmando.current = true;
    // Lo que se toque desde acá no está en lo que la base va a contestar.
    const reloj = relojDeToques();
    try {
    // PRIMERO SE SUBE LO PENDIENTE, DESPUÉS SE PREGUNTA. La base decide si la
    // sesión se cerró sola mirando la última actividad que TIENE; si se le
    // pregunta antes de subir los toques que esperaban en la cola —el
    // subsuelo sin señal—, la cierra con datos viejos en medio de un
    // entrenamiento.
    await vaciar(supabase);
    // Y SI NO SUBIÓ TODO, NO SE PREGUNTA (13/10). `vaciar` puede volver sin
    // haber subido nada (señal a medias, o una pasada anterior todavía colgada)
    // y `mi_sesion` entrar igual: la base cerraba la sesión con la actividad
    // vieja. Ver `quedaDeLaSesion`.
    if (await quedaDeLaSesion(idVisto.current ?? (await leerSesionCache())?.id)) return;
    const { data, error } = await supabase.rpc('mi_sesion');
    // Lo mismo si el teléfono ya la había olvidado (su copia vence a la media hora)
    // y la base la devuelve viva: con series de ESA sesión todavía en la cola, lo
    // que contestó es viejo y no se adopta.
    if (!error && (await quedaDeLaSesion((data as { id?: string } | null)?.id))) return;
    const s = data as
      | (SesionViva & {
          series?: number;
          origen?: OrigenSesion;
          ultima_actividad?: string;
          cerrada_sola?: { id: string; inicio: string; fin: string | null; estado: string } | null;
        })
      | null;
    const alDia = fotoDeLaCache(reloj);
    // LA COPIA VENCIDA ACÁ Y LA SESIÓN VIVA ALLÁ (cacería del 15/10): quieto más de
    // media hora, la caché de este aparato vence aunque el otro siga anotando. Lo
    // que hay en memoria es de esa sesión y ya subió (la cola no tiene nada de
    // ella): vale como la caché. Sin esto, faltaban bloques y se unían los de la
    // base con los mismos de memoria, duplicados.
    const enMemoria = leerViva();
    const previo: SesionCacheada | null =
      (await leerSesionCache()) ??
      (s?.corriendo && s.id && s.inicio && enMemoria.inicio && bloquesDe.current === s.id && faltanBloques.current !== s.id
        ? {
            id: s.id,
            inicio: enMemoria.inicio,
            desfasaje: enMemoria.desfasaje,
            series: enMemoria.series,
            bloques: enMemoria.bloques,
            sugerido: enMemoria.sugerido,
            rutina: rutinaRef.current,
            rutinaGuardada: rutinaEsGuardada.current,
          }
        : null);
    const viva = s?.corriendo && s.inicio
      ? {
          inicio: s.inicio,
          desfasaje: desfasajeDelReloj(s.ahora),
          porUbicacion: s.origen === 'ubicacion',
          series: s.series ?? 0,
          id: s.id ?? null,
          // La más reciente entre la de la base y la del teléfono: la marca
          // puede estar todavía en camino.
          ultimaActividad: masReciente(
            previo?.id === s.id ? previo?.ultimaActividad : null,
            s.ultima_actividad ?? null
          ),
        }
      : null;
    // SE CERRÓ SOLA, Y ERA LA NUESTRA: se dice una vez. Sin esto la sesión
    // desaparece de la pantalla sin explicación y parece que la app se la comió.
    if (!error && !viva && s?.cerrada_sola && s.cerrada_sola.id === idVisto.current) {
      const clave = 'ascent:cerrada-sola-vista';
      if ((await plataforma.almacenamiento.leer(clave)) !== s.cerrada_sola.id) {
        await plataforma.almacenamiento.guardar(clave, s.cerrada_sola.id);
        const c = s.cerrada_sola;
        if (c.estado === 'terminada' && c.fin) {
          const hora = new Date(c.fin).toLocaleTimeString(T.general.locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
          const segundos = (Date.parse(c.fin) - Date.parse(c.inicio)) / 1000;
          setAviso(T.sesion.seCerroSola(hora, duracionLinda(Math.max(0, segundos))));
        } else {
          setAviso(T.sesion.seCerroSinDuracion);
        }
      }
    }
    const que = cacheTrasConfirmar(previo, viva, !!error);
    // No se supo: se deja en pantalla lo que ya había. Es el caso del gimnasio
    // sin señal, y es más frecuente que cualquiera de los otros dos.
    if (que.accion === 'mantener') return;
    if (que.accion === 'guardar' && viva) {
      const g = que.cache as typeof viva & { bloques?: EstadoBloques };
      // CONTÓ OTRO LADO: la misma sesión, con otro total en la base que acá, y
      // nada de acá esperando en la cola. Los bloques de la caché quedaron
      // viejos —la otra pantalla sumó series— y el próximo toque de acá los
      // subiría pisando los de allá. Se traen los de la base (19/9).
      let noSeTrajeron = false;
      if (
        g.bloques &&
        g.id &&
        typeof previo?.series === 'number' &&
        previo.series !== g.series &&
        // Si ya faltaban, la única unión la hace `recuperarBloques` (vuelta 8): traerlos
        // acá también los dejaba dos veces y tiraba lo contado acá sin subir.
        previo.faltanBloques !== true &&
        (await cuantasPendientes()) === 0
      ) {
        // Lo que solo vive en el teléfono (el peso escrito, la cinta andando) no está en
        // la base: se conserva en las dos ramas (vuelta 8).
        const deAca = g.bloques;
        const soloAca = {
          ...(deAca.peso !== undefined && { peso: deAca.peso }),
          ...(deAca.carga && { carga: deAca.carga }),
          ...(deAca.minutos !== undefined && { minutos: deAca.minutos }),
          ...(deAca.cardioDesde !== undefined && { cardioDesde: deAca.cardioDesde }),
        };
        const corre = deAca.cardioDesde !== undefined;
        const { data: fila, error: eFila } = await supabase.from('sesiones').select('bloques').eq('id', g.id).maybeSingle();
        if (!eFila && fila) {
          // Con la cinta andando, lo de la base entra como cerrado y la cinta sigue en curso.
          g.bloques = unirConGuardados(
            (fila as { bloques?: unknown }).bloques,
            corre ? { ...bloquesVacios(deAca.ejercicio, deAca.meta), ...soloAca } : bloquesVacios(null, deAca.meta)
          );
        } else {
          // SIN PODER TRAERLOS (vuelta 7): la lista de acá ya subió entera (la cola está
          // vacía) y le falta lo de allá. Queda vacía y marcada: el próximo + los trae y
          // les suma lo nuevo. Seguir con la vieja borraba lo de allá. El ejercicio en
          // curso queda como semilla (si la cinta anda, como elegido: si no, la unión la
          // reemplazaba por el último de la base).
          g.bloques = { ...bloquesVacios(deAca.ejercicio, deAca.meta), ...soloAca, ...(!corre && { sembrado: true }) };
          noSeTrajeron = true;
        }
      }
      // INVARIANTE: el refresco no puede escribir un conteo más viejo que la cola.
      // Si hay una escritura pendiente de ESTA sesión, el servidor está atrasado
      // —la serie que sumaste todavía no subió— y ni la caché ni la pantalla
      // pueden bajar de lo local. Vale para las DOS escrituras, la caché y el
      // estado: antes solo el estado estaba protegido y la caché se pisaba con el
      // número del servidor (la "carrera" que dejaba la caché en 2 con la pantalla
      // en 3). Ver `conteoAlConfirmar`.
      const hayPendiente = !!g.id && (await estaPendiente('fijar_series', g.id));
      const seriesGuardado = conteoAlConfirmar(previo?.series, g.series, hayPendiente);
      g.series = seriesGuardado;
      // Faltan si no vinieron, o si ya faltaban y no se pudieron traer (sin
      // señal): lo que la caché tenga en ese caso es solo lo de acá.
      const faltan = !!g.id && (!g.bloques || noSeTrajeron || (previo?.id === g.id && previo.faltanBloques === true));
      // EL REFRESCO NO PISA UN TOQUE (4/10). Si mientras se preguntaba se tocó
      // algo, todo lo de arriba se calculó sin ese toque: no se escribe ni en la
      // caché ni en la pantalla, y `confirmar` vuelve a preguntar. Se mira dos
      // veces porque guardar la caché también espera, y el toque puede caer ahí.
      if (!alDia()) return 'vieja';
      await guardarSesionCache(faltan ? { ...g, faltanBloques: true } : g, yo);
      if (!alDia()) return 'vieja';
      bloquesSonDe(g.id ?? null);
      if (g.bloques) setBloques(g.bloques);
      if (faltan && g.id) {
        faltanBloques.current = g.id;
        void recuperarBloques(g.id);
      }
      setInicio(g.inicio);
      setDesfasaje(g.desfasaje);
      setSeries(seriesGuardado);
      setIdSesion(g.id ?? null);
      // Si la migración 24 todavía no corrió, `origen` no viene: se asume
      // manual, que es lo seguro — no cerrarla sola.
      setPorUbicacion(!!g.porUbicacion);
      setUltimaActividad(g.ultimaActividad ?? null);
      if (g.id) idVisto.current = g.id;
    } else {
      // "No hay sesión" también se mira contra la foto: si hubo un Iniciar en el medio, es vieja.
      if (!alDia()) return 'vieja';
      borrarSesionCache(yo);
      // El descanso es de la sesión: si quedaba, la siguiente arrancaba con el
      // de ayer en "Listo" y horas "de más".
      borrarDescanso();
      setDescanso(null);
      bloquesSonDe(null);
      setInicio(null);
      setSeries(0);
      setIdSesion(null);
      setPorUbicacion(false);
      setUltimaActividad(null);
    }
    } finally {
      confirmando.current = false;
    }
    // `yo` no cambia nunca y `recuperarBloques` solo usa refs y setters: con
    // ellos en la lista, `confirmar` cambiaría en cada render y el efecto que
    // lo llama al montar se volvería a armar en cada uno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // UNA RESPUESTA VIEJA SE VUELVE A PEDIR, y una sola vez. Lo que quedó sin
  // aplicar no era solo el conteo: también si la sesión es otra, o los bloques
  // que faltaba traer. Una y no más, para que un toque tras otro no lo deje
  // preguntando en fila: lo de acá ya es lo más nuevo que hay.
  const confirmar = useCallback(async () => {
    if ((await preguntar()) === 'vieja') await preguntar();
  }, [preguntar]);

  useEffect(() => {
    releerCache();
    confirmar();
    const alVolver = () => releerCache();
    const dejarDeEscuchar = eventos.escuchar(AVISO, (dato) => {
      if (!esMio(dato, yo)) alVolver();
    });
    // Al volver al frente, además, se le pregunta a la base si había una sesión:
    // es el momento en que más probable es que se haya cerrado sola —el
    // teléfono estuvo en el bolsillo— y hay que avisar por qué desapareció.
    // Con el AVISO no: ese salta en cada serie, y serían viajes de red por toque.
    const dejarDeMirar = plataforma.ciclo.alCambiar((visible) => {
      releerCache();
      if (visible && idVisto.current) confirmar();
    });
    return () => {
      dejarDeEscuchar();
      dejarDeMirar();
    };
    // `yo` es un Symbol que nace una vez con el hook (`useState(() => Symbol(...))`)
    // y no cambia nunca, asi que esto no rearma nada. Va en la lista igual:
    // estaba en el cuerpo y no en las dependencias, y era la unica advertencia
    // del lint del repo.
  }, [releerCache, confirmar, yo]);

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
        id = setInterval(() => {
          if (repintarCadaSegundo) repintar((n) => n + 1);
          // La cinta andando, o un descanso largo (el + a mano llega a una hora): la marca se renueva.
          const fin = descansoRef.current?.fin ?? 0;
          const hasta = Math.max(bloquesRef.current.cardioDesde !== undefined ? Date.now() + MARCA_DEL_CARDIO_MS : 0, fin);
          if (hasta > Date.now() && Date.now() - cardioRenovadoEl.current > RENOVAR_CARDIO_MS) {
            cardioRenovadoEl.current = Date.now();
            void marcarRef.current(hasta, { renovacion: true });
          }
          // Con la app ADELANTE también se cierra sola: si la dejaste abierta
          // en el banco y te fuiste, a la media hora la pantalla no puede
          // seguir contando. `confirmar` no se pisa consigo mismo.
          if (inicioRef.current && cierreSolo({ inicio: inicioRef.current, ultimaActividad: ultimaRef.current }, Date.now() - desfasajeRef.current)) {
            confirmar();
          }
        }, 1000);
      }
    };
    arrancar();
    const dejarDeMirar = plataforma.ciclo.alCambiar(arrancar);
    return () => {
      clearInterval(id);
      dejarDeMirar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio]);

  /**
   * Trae los bloques que la base tiene guardados para la sesión y los junta
   * con lo que haya acá (`unirConGuardados`). Sin señal no pasa nada: queda
   * marcado y se vuelve a intentar en el próximo toque.
   */
  async function recuperarBloques(id: string) {
    if (faltanBloques.current !== id) return;
    const { data, error } = await supabase.from('sesiones').select('bloques').eq('id', id).maybeSingle();
    if (error || faltanBloques.current !== id) return;
    // Lo de AHORA y no `actual` (cacería del 15/10): un + que cayó mientras viajaba
    // el pedido quedaba afuera de la unión, y la pantalla volvía al ejercicio de antes.
    const antes = bloquesRef.current;
    const unidos = unirConGuardados((data as { bloques?: unknown } | null)?.bloques, antes);
    faltanBloques.current = null;
    bloquesRef.current = unidos;
    setBloques(unidos);
    await actualizarSesionCache({ bloques: unidos, faltanBloques: false }, yo);
    // Si se contó algo acá mientras tanto, la lista recién ahora está completa
    // y no se había subido: se sube. Si no, la base ya la tiene así.
    if (!sinNadaContado(antes)) {
      await encolar(supabase, { rpc: 'fijar_bloques', args: { p_sesion: id, p_bloques: paraGuardar(unidos) } });
    }
  }

  /**
   * `desde` es la hora de LLEGADA cuando arranca sola, que no es la hora de la
   * llamada: el cronómetro dispara a los siete minutos pero la sesión tiene
   * que decir cuándo llegaste, o la duración sale corta siempre (§13). El
   * servidor la acota; acá se manda lo que se vio.
   */
  async function empezar(opciones?: { desde?: number; origen?: OrigenSesion }) {
    // Un arranque ya en curso se ignora: el segundo toque no abre otra sesión.
    if (operandoSesion.current) return false;
    operandoSesion.current = true;
    setOcupado(true);
    setAviso('');
    let data: unknown, error: unknown;
    try {
      // Primero lo pendiente, igual que al preguntar y al terminar: `iniciar_sesion`
      // también hace que la base juzgue la sesión anterior.
      await vaciar(supabase);
      // Si de la sesión que este teléfono conoce quedan cosas sin subir, no se
      // inicia: la base cerraría esa sesión con datos viejos para abrir otra.
      if (await quedaDeLaSesion(idVisto.current ?? (await leerSesionCache())?.id)) {
        ({ data, error } = { data: null, error: { message: 'quedan escrituras de la sesión en la cola' } });
      } else {
        ({ data, error } = await iniciar(supabase, opciones));
        // Y si el teléfono ya la había olvidado (la copia vence a la media hora)
        // pero la base la devuelve viva, con series de ella todavía en la cola: su
        // conteo es viejo, y adoptarlo haría que el primer toque pise lo que esperaba.
        const yaEstaba = (data as { id?: string; yaEstaba?: boolean } | null)?.yaEstaba ? (data as { id?: string }).id : null;
        if (!error && (await quedaDeLaSesion(yaEstaba))) error = { message: 'quedan escrituras de la sesión en la cola' };
      }
    } finally {
      operandoSesion.current = false;
    }
    setOcupado(false);
    // Devuelve si SALIÓ, porque el que llama por ubicación necesita saberlo:
    // un gimnasio en un subsuelo se queda sin señal, y si el arranque se diera
    // por hecho la sesión de ese día no existiría nunca.
    //
    // Y SE DICE, si lo tocó una persona (15/9). Antes el botón volvía a su
    // lugar sin nada: parecía que la app no respondía. Al que arranca solo por
    // ubicación no se le dice: el vigilante reintenta sin que nadie mire.
    if (error) {
      if (opciones?.origen !== 'ubicacion') setAviso(T.sesion.noEmpezo);
      return false;
    }
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
    // Iniciar registra el día y con eso puede cambiar el rango: el Álbum, que no
    // recarga solo, se quedaba con el cuerpo y el color de ayer. El arranque por
    // ubicación ya lo avisa el vigilante.
    if (r.registro && !porUbi) eventos.emitir(DIA_CAMBIO);
    // UNA SESIÓN NUEVA NO HEREDA BLOQUES (ver `bloquesSonDe`). Va antes de la
    // semilla de abajo, que no siembra si encuentra algo contado.
    // LA ÉPOCA: una respuesta que salió antes de esto ya no vale (ver `cambioDeSesion`).
    cambioDeSesion();
    if (r.id) idVisto.current = r.id;
    bloquesSonDe(r.id ?? null);
    // LA SESIÓN DE OTRO APARATO: lo de allá falta acá, y se marca YA (cacería del
    // 15/10). Antes se marcaba después de esperar el historial por la red, y un
    // toque en ese hueco subía la lista de acá —vacía— y borraba lo de allá.
    const faltan = !!(r.yaEstaba && r.id && sinNadaContado(bloquesRef.current));
    if (faltan) faltanBloques.current = r.id;
    // La caché lleva TODO lo que hace falta para decidir, no solo para pintar:
    // la otra instancia del hook —la del vigilante— se entera por acá.
    guardarSesionCache({
      inicio: r.inicio,
      desfasaje: desfasajeDelReloj(r.ahora),
      porUbicacion: porUbi,
      series: r.series ?? 0,
      id: r.id ?? null,
      ...(faltan ? { faltanBloques: true } : {}),
    }, yo);
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
      // LA RUTINA DEL DÍA: se trae el historial reciente y se calcula qué
      // proponer (mismo día de la semana → rotación). Va antes de sembrar, y
      // también deja el historial listo para re-enganchar la cadena si se cambia
      // el primer ejercicio. Sin historial, `rutinaParaHoy` da vacío y todo
      // queda como estaba (cae al `ultimo_ejercicio` de siempre).
      await cargarHistorialRutina();
      // PRIMERO LA RUTINA ACTIVA GUARDADA (14/10), la del teléfono: anda sin señal.
      // Un día de descanso o sin nada cargado cae a la deducida, como antes.
      const deLaGuardada = ejerciciosDeHoy(await rutinaActivaDelTelefono(), new Date().getDay());
      rutinaRef.current = (deLaGuardada.length > 0 ? deLaGuardada : rutinaParaHoy(sesionesRutinaRef.current, hoyISO())).filter(seVe);
      rutinaEsGuardada.current = deLaGuardada.length > 0;
      await actualizarSesionCache({ rutina: rutinaRef.current, rutinaGuardada: rutinaEsGuardada.current }, yo);
      // Y se pone al día para la próxima, sin esperar.
      void cargarMisRutinas(supabase).catch(() => null);

      // YA ESTABA CORRIENDO (se empezó en otro lado): lo que se hizo está en la
      // base, y eso va antes que cualquier semilla.
      if (faltan && r.id) {
        await recuperarBloques(r.id);
        if (!sinNadaContado(bloquesRef.current)) return;
      }
      // La semilla sale de la rutina del día; si no hay rutina, del último
      // ejercicio de siempre (regla 2 de la migración 27).
      const deRutina = rutinaRef.current[0] ?? null;
      const [{ data: ultimo }, meta] = await Promise.all([
        deRutina ? Promise.resolve({ data: deRutina }) : supabase.rpc('ultimo_ejercicio'),
        leerMetaPreferida(),
      ]);
      // `sembrar` y NO `bloquesVacios`: en un gimnasio con mala señal esta
      // respuesta llega cuando ya tocaste el + dos veces, y pisar el bloque
      // con uno vacío ponía la cuenta del bloque en cero mientras el total
      // seguía subiendo. Los dos números de la pantalla se contradecían.
      const sembrado = sembrar(
        bloquesRef.current,
        typeof ultimo === 'string' && seVe(ultimo) ? ultimo : null,
        meta ?? undefined
      );
      // Si ya había algo contado, `sembrar` devuelve lo mismo que entró y acá
      // no hay nada que escribir.
      if (sembrado === bloquesRef.current) return;
      bloquesRef.current = sembrado;
      setBloques(sembrado);
      // Si la semilla vino de la rutina, es una SUGERENCIA (fantasma) hasta que
      // se cuente una serie. Si vino del último ejercicio, es como siempre.
      const esSugerencia = !!deRutina && sembrado.ejercicio === deRutina;
      setSugerido(esSugerencia);
      await actualizarSesionCache({ bloques: sembrado, sugerido: esSugerencia }, yo);
      if (sembrado.ejercicio) proponerArranque(sembrado.ejercicio);
    })();
    // EL HISTORIAL DE PESOS, también de fondo: es una sesión nueva y puede haber
    // series anotadas desde otro aparato. Quien lo necesite antes de que llegue
    // espera a esta misma respuesta (ver `compartido/pesosRecordados.ts`).
    void traerRecordados(supabase);

    alCambiarElDia?.(r.registro);
    return true;
  }

  /**
   * `hasta` es la última vez que se lo vio en el gimnasio, cuando la cierra la
   * salida. Sin eso, enterarse tarde —la app estuvo cerrada— daría una sesión
   * de cinco horas.
   */
  async function terminar(opciones?: { hasta?: number }): Promise<CierreDeSesion | null> {
    // Un cierre ya en curso se ignora: el segundo toque no vuelve a cerrar.
    if (operandoSesion.current) return null;
    operandoSesion.current = true;
    setOcupado(true);
    setAviso('');
    // LA HORA ES LA DEL PRIMER TOQUE (13/10). Si un "Terminar" anterior no salió
    // —sin señal—, este reintento cierra a esa hora y no a la de ahora. Se lee
    // antes de cerrar la vuelta de cardio, que marca actividad.
    const hasta = opciones?.hasta ?? (await leerSesionCache())?.quisoTerminar ?? undefined;
    // LA VUELTA DE CARDIO EN CURSO SE CIERRA ANTES (cacería del 15/10), y a la misma
    // hora que la sesión: con la salida del gimnasio, la cinta no sigue hasta casa.
    if (bloquesRef.current.cardioDesde !== undefined) await dejarElCardio(hasta ?? Date.now());
    // LO DE ALLÁ, ANTES DE CERRAR (cacería del 15/10): con los bloques del otro aparato
    // sin traer, lo anotado acá no subía nunca (subir espera a tenerlos).
    if (idSesion && faltanBloques.current === idSesion) await recuperarBloques(idSesion);
    // Se anota lo que había ANTES de cerrar: abajo se pone todo en cero y el
    // resumen se quedaría sin datos que mostrar. De los refs: la vuelta de arriba
    // cambió el conteo después de este render.
    const arranco = inicio;
    const seriesHechas = seriesRef.current;
    const eraPorUbicacion = porUbicacion;
    const desfase = desfasaje;
    const bloquesHechos = paraGuardar(bloquesRef.current);
    // PRIMERO LO PENDIENTE (bug del 15/9). La base decide el cierre con lo que
    // TIENE: si las series y la actividad de la sesión siguen en la cola —se
    // entrenó sin señal y la red volvió justo al tocar Terminar—, ve una sesión
    // sin series y sin actividad. Corta, la toma por un toque sin querer y
    // BORRA EL DÍA; de más de dos horas, la da por abandonada y pierde la
    // duración. `confirmar` ya subía la cola antes de preguntar; esto no.
    //
    // Si después de intentarlo algo de ESTA sesión sigue esperando, no se
    // cierra: es lo mismo que no tener señal, y cerrar ahí es el bug.
    let data: unknown, error: unknown;
    try {
      await vaciar(supabase);
      // Sin poder traer lo de allá tampoco se cierra: lo de acá nunca se subió.
      ({ data, error } = (!!idSesion && faltanBloques.current === idSesion) || (await quedaDeLaSesion(idSesion))
        ? { data: null, error: { message: 'quedan escrituras de la sesión en la cola' } }
        : await cerrar(supabase, { hasta }));
    } finally {
      operandoSesion.current = false;
    }
    setOcupado(false);
    // Lo mismo al revés: si el cierre no llegó, quien llama tiene que poder
    // volver a intentarlo con la hora de salida correcta.
    if (error) {
      // A mano se dice; el cierre por ubicación reintenta solo.
      if (opciones?.hasta === undefined) {
        setAviso(T.sesion.noTermino);
        if (hasta === undefined) await actualizarSesionCache({ quisoTerminar: Date.now() }, yo);
      }
      return null;
    }
    // LA ÉPOCA, ANTES DE CUALQUIER ESPERA: un "está corriendo" en viaje ya no vale.
    cambioDeSesion();
    // Si la parás a mano estando todavía en el gimnasio, la visita queda
    // marcada como usada: sin esto se volvería a encender sola a los dos
    // minutos. VA ANTES de borrar la sesión del teléfono y se espera (13/10):
    // después y sin esperar, el vigilante podía mirar justo en el instante
    // "sin sesión y sin marca" y arrancar otra.
    await guardarVigilancia(marcarComoUsada(await leerVigilancia()));
    borrarSesionCache(yo);
    borrarDescanso();
    // Lo de hoy pasa a ser historial: el último peso de cada modo queda en la
    // copia del teléfono para la próxima sesión, aunque no haya señal. Si la
    // base deshizo el día —un toque sin querer— no hay nada que sumar.
    void sumarSesionARecordados(
      (data as { deshizo_el_dia?: boolean } | null)?.deshizo_el_dia ? [] : bloquesHechos,
      diaDeLaSesion(inicioRef.current)
    );
    setInicio(null);
    setSeries(0);
    setIdSesion(null);
    setDescanso(null);
    setPorUbicacion(false);
    setBloques(bloquesVacios());
    // El fantasma no sobrevive a terminar: la próxima sesión decide de cero si
    // hay algo que sugerir. Sin esto la bandera quedaba en true entre sesiones.
    setSugerido(false);
    // Se dice, porque si no el día desaparece de la tira semanal sin
    // explicación y parece que la app se comió algo.
    if ((data as { deshizo_el_dia?: boolean } | null)?.deshizo_el_dia) {
      setAviso(T.inicio.diaDeshecho);
    }
    alCambiarElDia?.(null);

    const deshizoElDia = !!(data as { deshizo_el_dia?: boolean } | null)?.deshizo_el_dia;
    // `inicio` es del SERVIDOR y `hasta` es del teléfono: restarlos crudos
    // metería el desfasaje de reloj adentro de la duración. Por eso se lleva
    // el fin a hora de servidor antes de restar, igual que hace `transcurrido`
    // para el cronómetro que se ve en pantalla.
    const finServidor = (hasta ?? Date.now()) - desfase;
    // LOS PASOS DE LA SESIÓN (3.3): mucha gente mete cardio en el entrenamiento.
    // Se piden a Health entre el inicio y el fin, en hora del APARATO (el inicio
    // es de servidor: se le suma el desfasaje para volverlo a reloj local). `null`
    // si no hay Health/permiso; el resumen lo muestra solo si hay algo. No frena
    // el cierre si falla.
    let pasos: number | null = null;
    if (arranco && !deshizoElDia) {
      const inicioAparato = new Date(Date.parse(arranco) + desfase);
      const finAparato = new Date(hasta ?? Date.now());
      pasos = await plataforma.salud.pasosEntre(inicioAparato, finAparato).catch(() => null);
    }
    return {
      minutos: arranco
        ? Math.max(0, Math.round((finServidor - Date.parse(arranco)) / 60000))
        : 0,
      series: seriesHechas,
      porUbicacion: eraPorUbicacion,
      deshizoElDia,
      bloques: bloquesHechos,
      pasos,
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
  /**
   * UNA ACTIVIDAD: ahora, o hasta cuándo dura un descanso (migración 37).
   *
   * Se guarda en el teléfono al instante y viaja a la base por la cola, con la
   * hora en que PASÓ y no la hora en que suba: desde el subsuelo sin señal, la
   * marca llega media hora tarde y tiene que seguir diciendo la hora del toque.
   * La hora va en hora de servidor —se le resta el desfasaje— porque la base
   * la compara contra el inicio, que es suyo.
   *
   * Si la base todavía no tiene la migración, se guarda solo en el teléfono:
   * mandar una función que no existe trabaría la cola (ver `lib/cola.ts`).
   */
  // `renovacion`: la del reloj, que no es "siguió entrenando" y no borra la hora del Terminar que no salió.
  async function marcar(hastaTelefonoMs: number = Date.now(), opciones?: { renovacion?: boolean }) {
    if (!idSesion) return;
    const iso = new Date(hastaTelefonoMs - desfasaje).toISOString();
    const c = await leerSesionCache();
    const nueva = masReciente(c?.ultimaActividad, iso);
    setUltimaActividad(nueva);
    // PARCIAL, no reescribir el objeto entero (29/9). Guardar `{...c, ...}` con el
    // `c` leído arriba pisaba `series`/`bloques` con lo de hace unos ms: si un `+`
    // tocó la caché durante estos awaits, `marcar` lo revertía —el mismo pisón que
    // los refs matan en el estado, pero en la caché—. `actualizarSesionCache`
    // relee y mezcla solo esta clave.
    await actualizarSesionCache(opciones?.renovacion ? { ultimaActividad: nueva } : { ultimaActividad: nueva, quisoTerminar: null }, yo);
    if (!disponible('cierrePorInactividad', await versionDelEsquema(supabase))) return;
    // `nueva` y no `iso` (cacería del 15/10): la cola guarda UNA marca por sesión, y
    // una de "ahora" que llegaba después pisaba la de la cinta (una hora adelante).
    await encolar(supabase, { rpc: 'marcar_actividad', args: { p_sesion: idSesion, p_hasta: nueva ?? iso } });
  }

  /**
   * `sinDescanso`: el cardio (14/10). Se anota igual que una serie —cuenta, sube,
   * queda en el día— pero no arranca un descanso: después de veinte minutos de
   * cinta no se espera noventa segundos para la próxima vuelta.
   */
  async function serieHecha(opciones?: { sinDescanso?: boolean }) {
    // SIN SESIÓN EN EL TELÉFONO NO SE CUENTA (13/10). La pantalla del descanso
    // queda abierta con su "+ Serie hecha" aunque la sesión se haya cerrado sola:
    // ese toque encolaba series y bloques contra una sesión que ya no existe, y
    // pisaba los de la base o se perdía.
    if (!inicioRef.current) return;
    // CON LA CINTA ANDANDO, "+ SERIE HECHA" ES "LISTO" (cacería del 15/10): el botón
    // del descanso contaba una vuelta de cardio que no existía.
    if (bloquesRef.current.cardioDesde !== undefined && !opciones?.sinDescanso) return cerrarVueltaDelCardio();
    // Con la cinta ya parada tampoco: una vuelta de cero minutos y un descanso que el
    // cardio no lleva. Un bloque con minutos solo puede ser cardio: es "Seguir".
    if (bloquesRef.current.minutos !== undefined && !opciones?.sinDescanso) {
      borrarDescanso();
      setDescanso(null);
      return;
    }
    // EL CONTEO SE MUEVE PRIMERO, JUNTO Y DESDE LOS REFS. Las dos cuentas —el
    // total y la lista— salen de la misma función (`sumarSerie`) sobre el mismo
    // objeto, leído de refs siempre-al-día y NO del render: así dos toques
    // rápidos no se pisan y el total y la lista no pueden discrepar. Va ANTES de
    // cualquier `await`: el descanso y la marca tardan, y el conteo no puede
    // esperarlos. `series` sigue siendo la única verdad del conteo —no se deriva
    // de los bloques (regla 3 de `bloques.ts`)—, solo se mueve al mismo tiempo.
    const nc = sumarSerie({ series: seriesRef.current, bloques: bloquesRef.current });
    seriesRef.current = nc.series;
    bloquesRef.current = nc.bloques;
    setSeries(nc.series);
    setBloques(nc.bloques);
    // CONTAR UNA SERIE CONFIRMA la sugerencia: deja de ser fantasma. Es EL gesto
    // que la vuelve real, así que a partir de acá se ve como cualquier bloque.
    setSugerido(false);
    // GUARDAR ANTES QUE NADA, Y ANTES QUE LA CACHÉ (bug del gimnasio, 28/9).
    //
    // Apagar la pantalla justo después de sumar una serie la perdía. El motivo:
    // la escritura a la cola —`subir`— era lo ÚLTIMO, después de la caché y de
    // `marcar`, que TOCA LA RED (`versionDelEsquema`). En esa ventana el conteo
    // estaba en la caché pero NO en la cola; iOS suspende la app a los pocos
    // segundos de bloquear y, si la mataba ahí, la cola nunca lo recibía. Al
    // volver, `confirmar` leía el servidor —atrasado— y con la cola vacía pisaba
    // la caché con el número viejo. La serie desaparecía.
    //
    // `subir` encola `fijar_series`, que lleva el TOTAL absoluto y el id de la
    // sesión: apenas está en la cola, la serie está a salvo —sale sola cuando
    // vuelve la red— y `confirmar` ya no la pisa (respeta la cola no vacía). Va
    // PRIMERO, antes de la caché y de cualquier cosa que espere a la red.
    //
    // `subir` va ADENTRO de `actualizarSesionCache`, que lo corre antes de tocar
    // la caché: el orden es el mismo, y el toque queda anotado en el reloj desde
    // ahora y no desde que le llega el turno a la caché (4/10).
    // `bloques` se lee en el turno, DESPUÉS de `antes`: si ahí se unió con la base, va lo unido.
    await actualizarSesionCache({ series: nc.series, get bloques() { return bloquesRef.current; }, sugerido: false }, yo, () =>
      subir(nc.series, nc.bloques)
    );
    if (opciones?.sinDescanso === true) {
      await marcar();
      return;
    }
    // Recién ahora el descanso, que necesita leer la duración.
    const seg =
      (await leerDuracionDeSesion()) ??
      duracionValida(duracionPredeterminada(await leerPerfilCache()));
    // LA SERIE DE LA PANTALLA BLOQUEADA SALE DE `nc`, el estado YA SUMADO, y no
    // de `bloquesRef`: un "Terminar serie" tocado durante los `await` de arriba
    // deja el ref en cero. Y no de un efecto de la pantalla: eso fue el "serie 4
    // de 3". Ver `serieDelDescanso`.
    const d = guardarDescanso(seg, serieDelDescanso(nc.bloques));
    setDescanso(d);
    // El descanso que arranca ES actividad hasta que termina: la persona está
    // entrenando mientras el temporizador anda.
    await marcar(d.fin);
  }

  /**
   * Deshacer una serie NO toca el descanso: son dos cosas separadas. Si
   * deshacer lo cancelara, corregir un número te costaría el temporizador que
   * estabas usando.
   */
  async function deshacerSerie() {
    // Igual que `serieHecha`: las dos cuentas juntas y desde los refs, antes de
    // cualquier `await`, para que no se pisen con un toque simultáneo.
    const corria = bloquesRef.current.cardioDesde !== undefined;
    const nc = restarSerie({ series: seriesRef.current, bloques: bloquesRef.current });
    if (nc.bloques === bloquesRef.current && nc.series === seriesRef.current) return;
    seriesRef.current = nc.series;
    bloquesRef.current = nc.bloques;
    setSeries(nc.series);
    setBloques(nc.bloques);
    refrescarTarjeta();
    // Guardar primero (ver `serieHecha`): la cola antes que la caché y que `marcar`.
    // Los bloques se leen en el turno, después de `antes`: si ahí se unió con la base, va lo unido.
    await actualizarSesionCache({ series: nc.series, get bloques() { return bloquesRef.current; } }, yo, () => subir(nc.series, nc.bloques));
    // La cinta apagada con el − deja de prometer la hora de adelante (vuelta 7 de la
    // cacería): con `marcar` la marca de +60 seguía viva y la sesión cerraba inflada.
    if (corria) await bajarMarca();
    else await marcar();
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
    // Los bloques de antes todavía no llegaron: la lista de acá está
    // incompleta y subirla los borraría. Se intenta traerlos; si se pudo,
    // `recuperarBloques` ya subió la lista junta.
    if (faltanBloques.current === idSesion) {
      await recuperarBloques(idSesion);
      return;
    }
    await encolar(supabase, {
      rpc: 'fijar_bloques',
      args: { p_sesion: idSesion, p_bloques: paraGuardar(b) },
    });
  }

  /** Cerrar el bloque y arrancar otro con el mismo ejercicio y la misma meta. */
  async function bloqueSiguiente() {
    if (bloquesRef.current.cardioDesde !== undefined) await dejarElCardio();
    // Desde el ref y no del closure, y `subir` con el total del ref: si justo
    // se contó una serie, esta operación no puede pisarla con datos viejos.
    const previo = bloquesRef.current;
    // "Terminar serie" cierra el bloque Y vuelve a elegir ejercicio (28/9): deja
    // el siguiente en blanco en vez de repetir el ejercicio. Ver `terminarBloque`.
    const b = terminarBloque(previo);
    if (b === previo) return; // no había nada hecho: no se cierra un bloque vacío
    bloquesRef.current = b;
    setBloques(b);
    // Guardar primero (ver `serieHecha`): "terminar serie" cierra el bloque, y
    // ese cierre tiene que quedar en la cola antes que la caché y que `marcar`,
    // que toca la red. Apagar la pantalla justo después no puede perderlo.
    // sugerido:false por defecto; si hay un siguiente en la cadena,
    // `proponerEjercicioSugerido` lo vuelve a poner en true al toque.
    // Los bloques se leen en el turno, después de `antes` (ver el +).
    await actualizarSesionCache({ get bloques() { return bloquesRef.current; }, sugerido: false }, yo, () => subir(seriesRef.current, b));
    // LA CADENA: proponer el siguiente de la rutina como sugerencia (fantasma).
    // Los ya hechos salen de los bloques cerrados; si queda uno por proponer, va
    // con su peso. Si no hay rutina o ya se hicieron todos, el bloque queda en
    // blanco, como siempre.
    const hechos = ejerciciosEnOrden(b.cerrados.map((x) => x.ejercicio));
    const siguiente = siguienteEnRutina(rutinaRef.current, hechos);
    if (siguiente) await proponerEjercicioSugerido(siguiente);
    else setSugerido(false);
    // `marcar` al final (ver `elegirEjercicio`): con la red colgada, la
    // sugerencia llegaba varios segundos tarde, encima de un `+` ya contado.
    await marcar();
  }

  /**
   * Cambiar de ejercicio cierra el bloque anterior (ver `nucleo/bloques.ts`).
   *
   * EL CAMBIO, ANTES DE CUALQUIER ESPERA (4/10). Esta y las otras seis que
   * cambian el bloque —el peso, el modo y las correcciones— empezaban con
   * `await marcar()`, que puede salir a la red a preguntar la versión del
   * esquema. Con la app recién abierta en el subsuelo y la red colgada, el
   * cambio tardaba segundos en aplicarse, y el `+` de ese rato anotaba la serie
   * con el ejercicio o el peso de antes. Ahora primero se cambia el bloque y
   * `marcar` va al final, como en `serieHecha`.
   */
  /**
   * La tarjeta de la pantalla bloqueada dice lo que se está haciendo AHORA. Se
   * llama cada vez que eso cambia con un descanso corriendo; sin descanso no
   * hace nada. Ver `loQueSeHaceAhora`.
   */
  function refrescarTarjeta() {
    const vivo = descansoRef.current;
    if (!vivo || restante(vivo.fin) <= 0) return;
    const d = actualizarLoQueSeHace(vivo, loQueSeHaceAhora(bloquesRef.current));
    descansoRef.current = d;
    setDescanso(d);
  }

  async function elegirEjercicio(id: string | null) {
    // Otro ejercicio con la cinta andando: primero se anota esa vuelta.
    if (id !== bloquesRef.current.ejercicio && bloquesRef.current.cardioDesde !== undefined) await dejarElCardio();
    const previo = bloquesRef.current;
    const b = cambiarEjercicio(previo, id);
    if (b === previo) {
      // Elegir de la lista el mismo que estaba propuesto también lo confirma.
      if (id && leerViva().sugerido) {
        setSugerido(false);
        await actualizarSesionCache({ sugerido: false }, yo);
      }
      return marcar();
    }
    bloquesRef.current = b;
    setBloques(b);
    refrescarTarjeta();
    // Lo eligió la persona: ya no es una sugerencia. Y LA CADENA SE RE-ENGANCHA a
    // la rutina de ESE ejercicio —lo que suele venir después de él—.
    setSugerido(false);
    // La cadena de la rutina GUARDADA no se re-engancha: elegir otro ejercicio de ese día no la abandona.
    if (id && !rutinaEsGuardada.current) rutinaRef.current = reengancharDesde(sesionesRutinaRef.current, id);
    await actualizarSesionCache({ bloques: b, sugerido: false, rutina: rutinaRef.current }, yo);
    // Lo de AHORA y no `b`: si un `+` cayó mientras se guardaba la caché, `b` ya
    // es viejo, y subirlo detrás del `+` le sacaba esa serie a la lista de la base.
    await subir(seriesRef.current, bloquesRef.current);
    if (id) proponerArranque(id);
    await marcar();
  }

  // EL HISTORIAL RECIENTE PARA LA RUTINA: sesiones terminadas de las últimas 8
  // semanas, cada una reducida a sus ejercicios en orden. Del lado del cliente
  // (la RLS deja ver solo las propias). Sin bloquear ni romper: si falla, queda
  // vacío y la rutina no propone nada (todo como hoy).
  async function cargarHistorialRutina() {
    try {
      const desde = restarDias(hoyISO(), 56);
      const [{ data }, { data: ves, error: errVes }] = await Promise.all([
        supabase
          .from('sesiones')
          .select('bloques, logs!inner(fecha)')
          .eq('estado', 'terminada')
          .gte('logs.fecha', desde)
          .order('inicio'),
        supabase.from('ejercicios').select('id'),
      ]);
      visibles = errVes || !ves ? null : new Set((ves as { id: string }[]).map((e) => e.id));
      const filas = (data ?? []) as { bloques?: unknown; logs?: unknown }[];
      sesionesRutinaRef.current = filas
        .map((s) => {
          const bloques = Array.isArray(s.bloques) ? (s.bloques as { ejercicio?: string | null }[]) : [];
          const log = Array.isArray(s.logs) ? (s.logs[0] as { fecha?: string }) : (s.logs as { fecha?: string } | null);
          const ids = bloques.map((b) => b?.ejercicio ?? null).filter((id) => !id || seVe(id));
          return { fecha: log?.fecha ?? '', ejercicios: ejerciciosEnOrden(ids) };
        })
        .filter((s) => s.fecha);
    } catch {
      sesionesRutinaRef.current = [];
    }
  }

  // PONER UN EJERCICIO COMO SUGERENCIA (fantasma): lo deja en el bloque actual con
  // su peso, marcado como sugerido hasta que se cuente una serie.
  async function proponerEjercicioSugerido(id: string) {
    // SOLO SOBRE EL BLOQUE EN BLANCO, como `sembrar` y `proponerPeso`: si ya se
    // contó una serie o se eligió algo, la sugerencia llegó tarde. Ponerla igual
    // cerraba un bloque sin ejercicio con esa serie adentro, que no se guarda.
    const actual = bloquesRef.current;
    if (actual.ejercicio || actual.hechas > 0) return;
    const b = cambiarEjercicio(actual, id);
    bloquesRef.current = b;
    setBloques(b);
    setSugerido(true);
    await actualizarSesionCache({ bloques: b, sugerido: true }, yo);
    proponerArranque(id);
  }

  /**
   * EL PESO CON QUE ARRANCA EL BLOQUE: el último que anotaste para ese
   * ejercicio. Escribir 60 cada vez que hacés press de banca con 60 es el
   * impuesto que hace que se deje de anotar.
   *
   * Sin bloquear y SIN PISAR NADA, por la misma razón que `sembrar`: la
   * respuesta puede llegar tarde, cuando ya cambiaste de ejercicio o ya
   * escribiste un peso a mano. Si pasó cualquiera de las dos, se descarta.
   */
  async function proponerArranque(id: string) {
    const version = await versionDelEsquema(supabase);
    if (disponible('cargaDelPeso', version)) return proponerCargaYPeso(id);
    if (!disponible('pesoPorSerie', version)) return;
    supabase.rpc('ultimo_peso', { p_ejercicio: id }).then(({ data, error }) => {
      if (error || data === null || data === undefined) return;
      const actual = bloquesRef.current;
      if (actual.ejercicio !== id || actual.peso !== undefined) return;
      const conPeso = proponerPeso(actual, Number(data));
      if (conPeso === actual) return;
      bloquesRef.current = conPeso;
      setBloques(conPeso);
      actualizarSesionCache({ bloques: conPeso }, yo);
    });
  }

  /**
   * PONER EN EL BLOQUE EL ÚLTIMO PESO DE ESE MODO, como propuesta.
   *
   * Es el único lugar que propone, al elegir el ejercicio y al cambiar de modo:
   * la regla —nunca pisar lo que escribió la persona— está en `proponerPeso` y
   * no se repite acá.
   *
   * `respaldo` es el peso que mandó `como_arranca`: vale solo si el teléfono
   * todavía no tiene NADA del historial (ni el catálogo), que es el caso de una
   * instalación nueva a la que la consulta le falló.
   */
  async function proponerElPesoDe(id: string, modo: Carga, datos: Recordados, respaldo?: unknown) {
    // OTRA INSTANCIA DEL HOOK pudo haber recibido un peso escrito que esta
    // todavía no releyó (el vigilante arranca la sesión, la persona escribe en
    // Inicio). La caché es lo que comparten: si ahí hay un peso escrito para
    // este ejercicio, no se propone nada. No proponer nunca pierde un dato.
    const enCache = (await leerSesionCache())?.bloques;
    if (enCache && enCache.ejercicio === id && enCache.peso !== undefined && !enCache.pesoPropuesto) return;
    // El disco se suma en la unidad de la persona. Se lee ACÁ, antes de mirar el estado.
    const unidad = (await leerPerfilCache())?.unidad_peso ?? 'kg';
    // Recién ahora el estado, y de acá al final SIN `await`: la decisión y la
    // escritura salen del mismo valor.
    const actual = bloquesRef.current;
    // SOLO CON EL BLOQUE VACÍO. Con series hechas el peso es el que se está
    // usando: una respuesta que llega tarde no lo cambia a mitad del bloque.
    if (actual.ejercicio !== id || actual.hechas > 0) return;
    // El modo cambió mientras se esperaba: este peso es de otra cosa.
    if ((modoDelBloqueEnCurso(actual, datos.catalogo) ?? modo) !== modo) return;
    const sinHistorial = Object.keys(datos.catalogo).length === 0;
    const recordado =
      ultimoPesoEnModo(actual, datos.pesos, id, modo, datos.catalogo) ?? (sinHistorial ? respaldo ?? null : null);
    // CON UNA MARCA DE "LA PRÓXIMA, MÁS", un disco más que la última vez. La
    // regla de cuándo vale está en `pesoConSubida`.
    const marca = datos.subidas[claveDeSubida(id, modo)];
    const subido = pesoConSubida(marca, modo, typeof recordado === 'number' ? recordado : null, diaDeLaSesion(inicioRef.current), unidad, seHizoHoy(actual, id));
    setSubida(marca && subido !== null ? { ejercicio: id, series: marca.series, antes: marca.peso, ahora: subido } : null);
    const b = proponerPeso(actual, subido ?? recordado);
    if (b === actual) return;
    bloquesRef.current = b;
    setBloques(b);
    await actualizarSesionCache({ bloques: b }, yo);
  }

  /**
   * CON QUÉ LO HACÉS Y CON CUÁNTO (migración 38).
   *
   * Primero lo que sabe el teléfono —anda sin señal—, después la base, que es
   * de la cuenta. El peso que se propone es el último EN ESE MODO: si la última
   * vez fueron zancadas con barra y 60, hoy con mancuernas "60 por mancuerna"
   * sería proponer el doble.
   *
   * EL PESO YA NO SALE DE `como_arranca` (2/10) sino de `proponerElPesoDe`, el
   * mismo camino que usa el cambio de modo: lo de hoy, y después el historial
   * que guarda el teléfono. De la base se sigue leyendo el MODO.
   *
   * Nada de esto pisa lo que la persona ya hizo en el bloque: la respuesta
   * puede llegar tarde, con otro ejercicio elegido o el modo ya cambiado.
   */
  async function proponerCargaYPeso(id: string) {
    const local = (await leerCargasElegidas())[id];
    if (local) aplicarCargaSabida(id, local);
    // CON LO QUE EL TELÉFONO YA SABE, sin esperar a la base: en el subsuelo la
    // respuesta de abajo no llega nunca.
    const sabido = await leerRecordados();
    const modoSabido = bloquesRef.current.ejercicio === id ? modoDelBloqueEnCurso(bloquesRef.current, sabido.catalogo) : null;
    if (modoSabido) await proponerElPesoDe(id, modoSabido, sabido);

    // `disponible(...)` se preguntó en `proponerArranque`, que es el único que
    // llama acá; se repite para que la regla se vea al lado de la llamada.
    if (!disponible('cargaDelPeso', await versionDelEsquema(supabase))) return;
    const { data, error } = await supabase.rpc('como_arranca', { p_ejercicio: id });
    const r = (error ? null : data) as { carga?: unknown; elegida?: unknown; peso?: unknown } | null;
    if (r) {
      const delServidor = cargaValida(r.carga);
      // LA BASE GANA, salvo que la elección de este teléfono todavía no haya
      // subido: esa es más nueva. Si no, cambiarlo en otro teléfono no llegaría
      // nunca a este.
      if (r.elegida === true && delServidor && delServidor !== local && !(await estaPendiente('elegir_carga', id))) {
        const actual = bloquesRef.current;
        if (actual.ejercicio === id && (!actual.carga || actual.carga === local)) {
          const b = { ...actual, carga: delServidor };
          bloquesRef.current = b;
          setBloques(b);
          await actualizarSesionCache({ bloques: b }, yo);
        }
        await recordarCarga(id, delServidor);
      }
      // EL MODO YA QUEDÓ DECIDIDO: el del bloque, y si el bloque no dice nada,
      // el que contestó la base (el elegido o el del catálogo). El peso que se
      // propone es el de ESE modo. Si la base trajo otro modo que el que se
      // había supuesto arriba, la propuesta anterior se reemplaza o se va.
      const modo = cargaValida(bloquesRef.current.carga) ?? delServidor;
      if (modo && bloquesRef.current.ejercicio === id) {
        // El peso de `como_arranca` vino calculado para el modo de la base: si
        // el teléfono sabe otro, no sirve ni de respaldo.
        await proponerElPesoDe(id, modo, await recordadosAlDia(supabase), modo === delServidor ? r.peso : null);
      }
    }
    // Con respuesta o sin señal: ya se decidió con lo que había.
    if (bloquesRef.current.ejercicio === id) setCargaConsultada(id);
  }

  /** Un modo que ya se sabía (no elegido ahora): no se sube ni se recuerda de nuevo. */
  function aplicarCargaSabida(id: string, c: Carga) {
    const actual = bloquesRef.current;
    if (actual.ejercicio !== id || actual.carga) return;
    const b = cambiarCarga(actual, c);
    bloquesRef.current = b;
    setBloques(b);
    void actualizarSesionCache({ bloques: b }, yo);
  }

  /**
   * Elegir qué significa el número: contestando la pregunta o tocando la
   * etiqueta. Vale para el bloque ENTERO y queda recordado para ese ejercicio:
   * la próxima vez arranca así.
   */
  async function elegirCarga(c: Carga) {
    // La copia del teléfono, antes de mirar el estado: es una lectura local, y
    // de acá hasta escribir el bloque no hay otro `await`.
    const sabido = await leerRecordados();
    const previo = bloquesRef.current;
    const conModo = cambiarCarga(previo, c);
    if (conModo === previo || !conModo.ejercicio) return marcar();
    const id = conModo.ejercicio;
    // EL PESO SIGUE AL MODO (2/10): con el bloque vacío se propone el último que
    // se usó en el modo nuevo, y si no hay ninguno la propuesta anterior se va.
    // Con series hechas, o con un peso escrito a mano, no se toca: lo decide
    // `pesoAlCambiarDeModo`, que es lo que prueba `test:db`.
    const b = pesoAlCambiarDeModo(conModo, ultimoPesoEnModo(conModo, sabido.pesos, id, c, sabido.catalogo));
    bloquesRef.current = b;
    setBloques(b);
    await actualizarSesionCache({ bloques: b }, yo);
    await recordar(id, c);
    // Si ya hay series, lo guardado cambia de significado: se sube.
    if (bloquesRef.current.hechas > 0) await subir(seriesRef.current, bloquesRef.current);
    // Y con el historial de la base, si en esta sesión todavía no se había
    // traído: recién instalada, la copia del teléfono está vacía.
    else await proponerElPesoDe(id, c, await recordadosAlDia(supabase));
    await marcar();
  }

  /** Lo mismo en un bloque ya cerrado, desde la lista. */
  async function corregirCargaDeBloque(indice: number, c: Carga) {
    const previo = bloquesRef.current;
    const b = corregirCarga(previo, indice, c);
    if (b === previo) return marcar();
    bloquesRef.current = b;
    setBloques(b);
    await actualizarSesionCache({ bloques: b }, yo);
    const ejercicio = indice === -1 ? b.ejercicio : b.cerrados[indice]?.ejercicio;
    if (ejercicio) await recordar(ejercicio, c);
    await subir(seriesRef.current, bloquesRef.current);
    await marcar();
  }

  /**
   * "Me equivoqué de ejercicio" en un bloque ya cerrado, desde la lista: las
   * series y sus pesos se quedan, cambia de qué fueron (ver
   * `corregirEjercicio` en `nucleo/bloques.ts`). `indice` -1 es el en curso.
   */
  /** Las marcas de "la próxima, más" de hoy de los ejercicios que el cambio sacó de la sesión. */
  function soltarMarcas(antes: EstadoBloques, despues: EstadoBloques) {
    const dia = diaDeLaSesion(inicioRef.current);
    for (const ejercicio of ejerciciosQueSeFueron(antes, despues)) void quitarMarcasDeHoy(supabase, ejercicio, dia);
  }

  async function corregirEjercicioDeBloque(indice: number, id: string, cargaQueSeVeia?: Carga) {
    const previo = bloquesRef.current;
    const b = corregirEjercicio(previo, indice, id, cargaQueSeVeia);
    if (b === previo) return marcar();
    soltarMarcas(previo, b);
    bloquesRef.current = b;
    setBloques(b);
    await actualizarSesionCache({ bloques: b }, yo);
    await subir(seriesRef.current, bloquesRef.current);
    await marcar();
  }

  async function recordar(ejercicio: string, c: Carga) {
    await recordarCarga(ejercicio, c);
    if (!disponible('cargaDelPeso', await versionDelEsquema(supabase))) return;
    await encolar(supabase, { rpc: 'elegir_carga', args: { p_ejercicio: ejercicio, p_carga: c } });
  }

  /**
   * El peso vigente. No sube nada a la base: el peso viaja con cada serie, y
   * cambiarlo sin haber sumado ninguna no es un hecho todavía.
   */
  async function elegirPeso(kg: number | null) {
    const b = cambiarPeso(bloquesRef.current, kg);
    bloquesRef.current = b;
    setBloques(b);
    await actualizarSesionCache({ bloques: b }, yo);
    await marcar();
  }

  /**
   * LOS MINUTOS DEL CARDIO (14/10). Con la vuelta ya contada se suben en el acto:
   * corregir "eran 25, no 20" tiene que llegar a la base.
   */
  async function elegirMinutos(m: number | null) {
    const b = cambiarMinutos(bloquesRef.current, m);
    if (b === bloquesRef.current) return;
    bloquesRef.current = b;
    setBloques(b);
    await actualizarSesionCache({ bloques: b }, yo);
    if (bloquesRef.current.hechas > 0) await subir(seriesRef.current, bloquesRef.current);
    await marcar();
  }

  /** EL CRONÓMETRO DEL CARDIO (15/10): arranca al elegir un cardio, o con "Otra vuelta". */
  async function arrancarElCardio() {
    const b = arrancarCardio(bloquesRef.current, Date.now());
    if (b === bloquesRef.current) return;
    bloquesRef.current = b;
    setBloques(b);
    // Arrancar la cinta propuesta es confirmarla: deja de ser sugerencia.
    setSugerido(false);
    await actualizarSesionCache({ bloques: b, sugerido: false }, yo);
    cardioRenovadoEl.current = Date.now();
    await marcar(Date.now() + MARCA_DEL_CARDIO_MS);
  }

  /** "Listo": lo que corrió se anota en minutos y la vuelta cuenta, sin descanso automático. */
  async function cerrarVueltaDelCardio(fin: number = Date.now()) {
    const b = cerrarVueltaDeCardio(bloquesRef.current, fin);
    if (b === bloquesRef.current) return;
    bloquesRef.current = b;
    setBloques(b);
    await serieHecha({ sinDescanso: true });
    // La cinta ya no corre: la marca adelantada de una hora se achica a ahora.
    await bajarMarca();
  }

  /**
   * SE DEJA LA CINTA SIN TOCAR "LISTO" (otro ejercicio, Terminar): la vuelta se
   * anota, salvo que no llegue a un minuto —la cinta tocada por error, que dejaba
   * una vuelta de un minuto y una serie de más sin forma de sacarlas—.
   */
  async function dejarElCardio(fin: number = Date.now()) {
    const desde = bloquesRef.current.cardioDesde;
    if (desde === undefined) return;
    if (fin - desde >= VUELTA_MINIMA_MS) return cerrarVueltaDelCardio(fin);
    const b = descartarCardio(bloquesRef.current);
    bloquesRef.current = b;
    setBloques(b);
    await actualizarSesionCache({ bloques: b }, yo);
    await bajarMarca();
  }

  /**
   * LA MARCA ADELANTADA SE ACHICA (cacería del 15/10, migración 82). La cinta y el
   * descanso largo prometen actividad hasta una hora adelante; si después de
   * "Listo" la persona se va sin tocar Terminar, la sesión se cerraba sola con
   * esa hora de más. Sin la 82 la base no sabe achicarla: queda como antes.
   */
  async function bajarMarca(hastaTelefonoMs: number = Date.now()) {
    if (!idSesion) return;
    const iso = new Date(Math.max(hastaTelefonoMs, Date.now()) - desfasaje).toISOString();
    setUltimaActividad(iso);
    await actualizarSesionCache({ ultimaActividad: iso }, yo);
    if (!disponible('bajarMarca', await versionDelEsquema(supabase))) return;
    await encolar(supabase, { rpc: 'marcar_actividad', args: { p_sesion: idSesion, p_hasta: iso, p_bajar: true } });
  }

  /** El peso de una serie ya hecha, desde la lista. `indice` -1 es el bloque en curso. */
  async function corregirPesoDeSerie(indice: number, serie: number, kg: number | null) {
    const previo = bloquesRef.current;
    const b = corregirPeso(previo, indice, serie, kg);
    if (b === previo) return marcar();
    bloquesRef.current = b;
    setBloques(b);
    await actualizarSesionCache({ bloques: b }, yo);
    await subir(seriesRef.current, bloquesRef.current);
    await marcar();
  }

  /**
   * Lo mismo, pero las series que ya iban se van con el ejercicio nuevo: es
   * "me equivoqué de ejercicio", no "cambié de ejercicio". Quién de los dos
   * fue lo pregunta la interfaz; acá solo se aplica.
   */
  async function mudarSeries(id: string | null, cargaQueSeVeia?: Carga) {
    const previo = bloquesRef.current;
    const b = mudarEjercicio(previo, id, cargaQueSeVeia);
    if (b === previo) return marcar();
    soltarMarcas(previo, b);
    bloquesRef.current = b;
    setBloques(b);
    refrescarTarjeta();
    // Corregir el ejercicio también re-engancha la cadena, igual que
    // `elegirEjercicio`: si no, el próximo sugerido saldría de la rutina del
    // ejercicio equivocado. (29/9)
    // La cadena de la rutina GUARDADA no se re-engancha: elegir otro ejercicio de ese día no la abandona.
    if (id && !rutinaEsGuardada.current) rutinaRef.current = reengancharDesde(sesionesRutinaRef.current, id);
    await actualizarSesionCache({ bloques: b, rutina: rutinaRef.current }, yo);
    await subir(seriesRef.current, bloquesRef.current);
    await marcar();
  }

  /**
   * Corregir un bloque ya cerrado, desde la lista de lo hecho.
   *
   * Mueve las DOS cuentas: la del bloque y el total de la sesión. El total no
   * se recalcula desde los bloques —eso rompería a quien nunca elige
   * ejercicio— así que la corrección dice explícitamente cuánto cambió.
   */
  async function tocarBloque(indice: number, delta: number | 'quitar') {
    const antes = { series: seriesRef.current, bloques: bloquesRef.current };
    const nc = corregirEnLista(antes, indice, delta);
    if (nc.series === antes.series && nc.bloques === antes.bloques) return;
    soltarMarcas(antes.bloques, nc.bloques);
    seriesRef.current = nc.series;
    bloquesRef.current = nc.bloques;
    setSeries(nc.series);
    setBloques(nc.bloques);
    // Guardar primero (ver `serieHecha`): la cola antes que la caché y que `marcar`.
    // Los bloques se leen en el turno, después de `antes`: si ahí se unió con la base, va lo unido.
    await actualizarSesionCache({ series: nc.series, get bloques() { return bloquesRef.current; } }, yo, () => subir(nc.series, nc.bloques));
    await marcar();
  }

  /** La meta no se sube a ningún lado: es intención, no un hecho. */
  async function elegirMeta(meta: number) {
    const b = cambiarMeta(bloquesRef.current, meta);
    bloquesRef.current = b;
    setBloques(b);
    refrescarTarjeta();
    await actualizarSesionCache({ bloques: b }, yo);
    await guardarMetaPreferida(b.meta);
  }

  async function descansarSuelto() {
    const seg =
      (await leerDuracionDeSesion()) ??
      duracionValida(duracionPredeterminada(await leerPerfilCache()));
    // No suma nada: la tarjeta dice la serie que YA se hizo, no la que viene.
    const d = guardarDescanso(seg, serieDelDescanso(bloquesRef.current));
    setDescanso(d);
    await marcar(d.fin);
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
      ultimaActividad,
      cacheLeida,
      cargaConsultada,
      sugerido,
      subida,
    },
    empezar,
    terminar,
    serieHecha,
    deshacerSerie,
    bloqueSiguiente,
    tocarBloque,
    elegirEjercicio,
    mudarSeries,
    elegirMeta,
    elegirPeso,
    elegirMinutos,
    arrancarCardio: arrancarElCardio,
    cerrarVueltaDeCardio: cerrarVueltaDelCardio,
    corregirPesoDeSerie,
    elegirCarga,
    corregirCargaDeBloque,
    corregirEjercicioDeBloque,
    descansarSuelto,
    cerrarDescanso: () => {
      borrarDescanso();
      setDescanso(null);
      // Con la cinta andando la marca es la de la cinta, no la del descanso: no se toca.
      if (bloquesRef.current.cardioDesde === undefined) void bajarMarca();
    },
    reiniciarDescanso: (d: DescansoVivo) => {
      const antes = descansoRef.current?.fin ?? 0;
      setDescanso(d);
      guardarDuracionDeSesion(d.duracion);
      // ACORTARLO BAJA LA MARCA (cacería del 15/10): de una hora a 90 s, la promesa
      // de una hora quedaba y la sesión dejada sin Terminar se guardaba con ella.
      if (d.fin < antes && bloquesRef.current.cardioDesde === undefined) void bajarMarca(d.fin);
      else void marcar(d.fin);
    },
  };
}
