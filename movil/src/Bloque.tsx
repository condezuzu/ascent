import { useEffect, useRef, useState, type ReactNode } from 'react';
import { nombreDeGrupo } from '@nucleo/ejercicios';
import { eventos, EJERCICIOS_CAMBIO } from '@compartido/eventos';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from './supabase';
import { metaCumplida, pildorasDeMeta, type EstadoBloques } from '@nucleo/bloques';
import type { Ejercicio } from '@nucleo/tipos';
import { pesoCorto, type Unidad } from '@nucleo/peso';
import { OPCIONES_DE_LA_PREGUNTA, cargaVigente, hayQuePreguntar, kilosMovidos, llevaNumero, muestraTotal, type Carga } from '@nucleo/carga';
import { disponible } from '@nucleo/esquema';
import { T } from '@nucleo/textos';
import { leerAnotarPeso } from '@compartido/anotarPeso';
import { leerMostrarUltimaVez, MOSTRAR_ULTIMA_VEZ_CAMBIO } from '@compartido/mostrarUltimaVez';
import { leerRegistrarReps, REGISTRAR_REPS_CAMBIO } from '@compartido/registrarReps';
import type { MarcaConReps } from '@nucleo/rutina';
import { ponerNombres } from '@compartido/enCurso';
import { useVersionDelEsquema } from '@compartido/esquema';
import SelectorEjercicio from './SelectorEjercicio';
import ListaDeBloques from './ListaDeBloques';
import CampoPeso from './CampoPeso';
import CampoReps from './CampoReps';
import CampoDistancia from './CampoDistancia';
import FondoOctogonal from './FondoOctogonal';

// Los botones grandes del bloque: el mismo fondo tenue de siempre, y el corte de las esquinas.
const FONDO_BOTON = 'rgba(255,255,255,0.03)';
const CORTE = 12;
import { unidadDeDistancia } from '@nucleo/distancia';

// Los globitos de "ya puedes subir" que ya se cerraron, por ejercicio y día: no vuelven en la misma corrida.
const SUBIR_VISTOS = new Set<string>();

// Con lo que arranca una vuelta de cardio si no se tocaron los minutos.
const MINUTOS_DE_ARRANQUE = 20;
import EtiquetaDeCarga from './EtiquetaDeCarga';
import Globito from './Globito';
import { esPropio, nombreVisible } from '@nucleo/propios';
import { C, conAlfa } from './colores';
import { leerRecordados, marcarSubida } from '@compartido/pesosRecordados';
import { claveDeSubida, loQueSePuedeSubir, type Subida } from '@nucleo/subir';
import { pasoDelCampo } from '@nucleo/campoPeso';
import { fechaLinda, hoyISO } from '@nucleo/fechas';
import { cronoLindo } from '@nucleo/sesiones';
import { cierraElBloque, cuentaLaSerie, TOQUE_REPETIDO_MS } from './toques';

/**
 * QUÉ ESTÁS HACIENDO, CUÁNTAS TE PROPUSISTE, CUÁNTAS VAN — en nativo.
 *
 * LAS REGLAS NO ESTÁN ACÁ. Qué pasa al sumar, al cerrar el bloque, al cambiar
 * de ejercicio con series contadas, el peso vigente, el modo del peso y la
 * pregunta de la primera vez: todo eso es `nucleo/bloques.ts`, `nucleo/carga.ts`
 * y `useSesion` (compartido), lo mismo que usa `src/components/Bloque.tsx`.
 * Esto es el dibujo, con las mismas decisiones de la web:
 *
 * - El `+` es enorme: es el botón más tocado, con una mano y transpirado.
 * - Llegar a la meta NO cierra nada: el botón grande pasa a "Terminar serie" y
 *   sumar otra queda abajo, porque pasarse de la meta es normal.
 * - Cambiar de ejercicio con series sin cerrar pregunta de cuál eran.
 * - Sin la migración de cada cosa (peso 36, modo 38), el campo no aparece.
 */
/** «3 series · 12, 12, 14 kg, un lado por vez», con las palabras del resumen del día. */
/**
 * LA ÚLTIMA VEZ, EN UNA LÍNEA (20/10): cuántas series hubo en esa sesión, el peso de la primera
 * (si se anotó) y, si esa sesión tuvo marca, sus repeticiones con su peso.
 */
function detalleDeLaUltimaVez(u: { series: number; pesos: (number | null)[]; carga?: string }, unidad: Unidad, reps?: MarcaConReps | null) {
  const carga = (u.carga ?? 'total') as Parameters<typeof T.resumen.pesosDeSeries>[2];
  const primera = u.pesos[0];
  let t = T.resumen.series(u.series);
  if (typeof primera === 'number' && primera > 0) t += T.sesion.laPrimeraCon(T.resumen.pesosDeSeries(pesoCorto(primera, unidad), unidad, carga));
  if (reps) t += T.sesion.conRepeticiones(reps.reps, `${pesoCorto(reps.peso, unidad)} ${unidad}`);
  return t;
}

export default function Bloque({
  estado,
  total,
  unidad,
  sugerido,
  cargaConsultada,
  subida,
  diaDeSesion,
  ultimaVez,
  repsUltimaVez,
  pistaDeReps,
  alElegirReps,
  alElegirDistancia,
  alSumar,
  debajoDelMas,
  globoDelMas,
  alRestar,
  alSiguiente,
  alElegirEjercicio,
  alMudarSeries,
  alElegirMeta,
  alTocarBloque,
  alElegirPeso,
  alElegirMinutos,
  alArrancarCardio,
  alCerrarVueltaDeCardio,
  alCorregirPeso,
  alElegirCarga,
  alCorregirCarga,
  alCorregirEjercicio,
}: {
  estado: EstadoBloques;
  total: number;
  unidad: Unidad;
  /** El ejercicio/peso del bloque son una SUGERENCIA de la rutina, sin confirmar. */
  sugerido?: boolean;
  cargaConsultada: string | null;
  /** El peso propuesto salió de una marca de "la próxima, más" (ver `nucleo/subir.ts`). */
  subida?: { ejercicio: string; series: number; antes: number; ahora: number } | null;
  /** El día de la sesión (no el del reloj): es el día de las marcas. Ver `diaDeLaSesion`. */
  diaDeSesion?: string;
  /** La última vez que se hizo este ejercicio (19/10): se muestra debajo del nombre. */
  ultimaVez?: { fecha: string; series: number; pesos: (number | null)[]; carga?: string } | null;
  /** La marca guardada en la última sesión de este ejercicio, con sus repeticiones (20/10). */
  repsUltimaVez?: MarcaConReps | null;
  /** Las repeticiones de la última vez para la serie que viene: la pista del cuadradito (21/10). */
  pistaDeReps?: number | null;
  /** Las repeticiones de la próxima serie, a cada tecla. Sin esto no hay cuadradito. */
  alElegirReps?: (n: number | null) => void;
  /** Los kilómetros de la vuelta de cardio, a cada tecla (21/10). */
  alElegirDistancia?: (km: number | null) => void;
  alSumar: (opciones?: { sinDescanso?: boolean }) => void;
  /** La pregunta de marca de la serie recién confirmada: pegada al `+` (ver la web). */
  debajoDelMas?: ReactNode;
  /** El globito de la primera vez, saliendo del + (15/10): recibe dónde está el centro del +. */
  globoDelMas?: (colaX: number) => ReactNode;
  alRestar: () => void;
  alSiguiente: () => void;
  alElegirEjercicio: (id: string | null) => void | Promise<void>;
  alMudarSeries: (id: string | null, cargaQueSeVeia?: Carga) => void;
  alElegirMeta: (meta: number) => void;
  alTocarBloque: (indice: number, delta: number | 'quitar') => void;
  alElegirPeso: (kg: number | null) => void;
  /** Los minutos del cardio (14/10). */
  alElegirMinutos?: (m: number | null) => void;
  /** El cronómetro del cardio (15/10): arrancarlo, y cerrar la vuelta con lo que corrió. */
  alArrancarCardio?: () => void;
  alCerrarVueltaDeCardio?: () => void;
  alCorregirPeso: (indice: number, serie: number, kg: number | null) => void;
  alElegirCarga: (c: Carga) => void;
  alCorregirCarga: (indice: number, c: Carga) => void;
  alCorregirEjercicio: (indice: number, id: string, cargaQueSeVeia?: Carga) => void;
}) {
  const [anchoBotones, setAnchoBotones] = useState(0);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [eligiendo, setEligiendo] = useState(false);
  const [lista, setLista] = useState(false);
  const [pausa, setPausa] = useState(false);
  const [aDonde, setADonde] = useState<string | null | undefined>(undefined);
  const [prefierePeso, setPrefierePeso] = useState(true);
  const [verUltimaVez, setVerUltimaVez] = useState(false);
  useEffect(() => {
    void leerMostrarUltimaVez().then(setVerUltimaVez);
    return eventos.escuchar(MOSTRAR_ULTIMA_VEZ_CAMBIO, (si) => setVerUltimaVez(si === true));
  }, []);
  const [registrarReps, setRegistrarReps] = useState(false);
  useEffect(() => {
    void leerRegistrarReps().then(setRegistrarReps);
    return eventos.escuchar(REGISTRAR_REPS_CAMBIO, (si) => setRegistrarReps(si === true));
  }, []);
  const version = useVersionDelEsquema();
  const anotarPeso = prefierePeso && disponible('pesoPorSerie', version);
  // Sin la migración 94 la base las tiraría: el cuadradito no aparece.
  const conReps = registrarReps && !!alElegirReps && disponible('repsPorSerie', version);
  // Sin la migración 95 la base la tiraría: el campo no aparece.
  const conDistancia = disponible('distanciaYObjetivo', version);
  const conCarga = anotarPeso && disponible('cargaDelPeso', version);

  useEffect(() => {
    leerAnotarPeso().then(setPrefierePeso);
  }, []);

  // El catálogo se pide una vez y no bloquea nada: sin él el contador anda
  // igual, con "sin ejercicio".
  // Y SE VUELVE A PEDIR al agregar un ejercicio propio: si no, el recién creado
  // se vería con su id en lugar del nombre.
  const [versionCatalogo, setVersionCatalogo] = useState(0);
  useEffect(() => eventos.escuchar(EJERCICIOS_CAMBIO, () => setVersionCatalogo((v) => v + 1)), []);
  useEffect(() => {
    let vivo = true;
    supabase
      .from('ejercicios')
      .select('*')
      .order('orden')
      .then(({ data }) => {
        if (vivo && data) setEjercicios(data as Ejercicio[]);
      });
    return () => {
      vivo = false;
    };
  }, [versionCatalogo]);

  // FANTASMA: el ejercicio/peso vienen sugeridos por la rutina y todavía no se
  // confirmaron (nadie contó una serie). Se muestra distinto —tenue, punteado y
  // con una etiqueta— para que la diferencia con lo confirmado sea obvia de un
  // vistazo: si se viera igual, un toque de más registraría una serie no hecha.
  const esFantasma = !!sugerido && estado.hechas === 0 && !!estado.ejercicio;
  const actual = ejercicios.find((e) => e.id === estado.ejercicio) ?? null;
  const nombreDe = (id: string | null) => (id ? nombreVisible(id, ejercicios.find((e) => e.id === id)?.nombre) : T.sesion.sinEjercicio);
  // EL CARDIO (14/10): se anota en minutos. Una vuelta ya es "cumplida": no hay
  // meta de series, y no arranca un descanso.
  const esTiempo = actual?.mide === 'tiempo';
  const minutos = estado.minutos ?? MINUTOS_DE_ARRANQUE;
  const cumplida = esTiempo ? estado.hechas >= 1 : metaCumplida(estado);
  const sumar = () => {
    if (!cuentaLaSerie()) return;
    if (!esTiempo) return alSumar();
    if (estado.minutos === undefined) alElegirMinutos?.(minutos);
    alSumar({ sinDescanso: true });
  };
  // EL CRONÓMETRO DEL CARDIO (15/10): mientras corre, el tiempo sale de restar
  // contra cuándo arrancó (como el de la sesión), y esto solo repinta.
  const corriendoCardio = esTiempo && estado.cardioDesde !== undefined;
  // El − con la cinta andando la apaga sin anotar (la cinta elegida arranca sola y
  // no había otra forma); parada no hace nada (ver `restarSerie`).
  const menosApagado = corriendoCardio ? false : estado.hechas === 0 || (esTiempo && estado.minutos !== undefined);
  const [, repintarCardio] = useState(0);
  useEffect(() => {
    if (!corriendoCardio) return;
    const t = setInterval(() => repintarCardio((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [corriendoCardio]);
  const segundosDeCardio = corriendoCardio ? Math.max(0, Math.floor((Date.now() - (estado.cardioDesde ?? 0)) / 1000)) : 0;
  // Elegir un cardio de la lista YA arranca el cronómetro: es lo que se va a hacer.
  // Después de que el cambio de ejercicio terminó: si no, su marca de "ahora" pisaba en la cola la de la cinta.
  // `mide` viene solo con uno recién creado, que el catálogo de acá todavía no tiene.
  const elegir = async (id: string | null, mide?: 'series' | 'tiempo') => {
    await alElegirEjercicio(id);
    if (id && (ejercicios.find((e) => e.id === id)?.mide ?? mide) === 'tiempo') alArrancarCardio?.();
  };
  const principalDeCardio = corriendoCardio
    ? { texto: T.sesion.cardioListo, accion: () => alCerrarVueltaDeCardio?.() }
    : estado.hechas > 0
      ? { texto: T.sesion.cardioOtraVuelta, accion: () => alArrancarCardio?.() }
      : { texto: T.sesion.cardioArrancar, accion: () => alArrancarCardio?.() };
  const puntos = Math.max(estado.meta, estado.hechas);
  const cargaVista = cargaVigente(estado.carga, actual?.carga);
  const esCorporal = !llevaNumero(cargaVista);
  const admitePeso = !!estado.ejercicio && actual?.admite_peso !== false;
  const preguntar =
    conCarga &&
    admitePeso &&
    hayQuePreguntar({ ambigua: actual?.carga_ambigua, cargaDelBloque: estado.carga, yaSeConsulto: cargaConsultada === estado.ejercicio });

  // "LA PRÓXIMA, MÁS" (10/10). Se ofrece al llegar a la meta con el mismo peso
  // en todas las series; `nucleo/subir.ts` dice cuándo. La marca que se
  // muestra prendida es la de HOY para ese peso: la de otro día ya se usó para
  // proponer el de hoy.
  const conSubir = conCarga && disponible('subirPeso', version);
  const oferta = conSubir && admitePeso ? loQueSePuedeSubir(estado, cargaVista) : null;
  const [marca, setMarca] = useState<Subida | null>(null);
  // YA PUEDES SUBIR (15/10): el peso con el que se hizo entero dos veces seguidas.
  const [listoParaSubir, setListoParaSubir] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    setMarca(null);
    setListoParaSubir(null);
    if (estado.ejercicio) {
      const id = estado.ejercicio;
      void leerRecordados().then((r) => {
        if (!vivo) return;
        setMarca(r.subidas[claveDeSubida(id, cargaVista)] ?? null);
        const l = r.paraSubir[id];
        setListoParaSubir(l && l.carga === cargaVista ? l.peso : null);
      });
    }
    return () => {
      vivo = false;
    };
  }, [estado.ejercicio, cargaVista]);
  const dia = diaDeSesion ?? hoyISO();
  // Al volver a ese ejercicio, antes de la primera serie, y si el peso de hoy no subió ya.
  const [, repintarGlobito] = useState(0);
  const globitoSubir =
    listoParaSubir !== null && estado.hechas === 0 && !!estado.ejercicio && (estado.peso ?? 0) <= listoParaSubir && !SUBIR_VISTOS.has(`${estado.ejercicio}:${dia}`);
  const marcada = !!oferta && !!marca && marca.dia === dia && marca.peso === oferta.peso && marca.carga === cargaVista;
  function ponerMarca(s: Subida | null) {
    if (!estado.ejercicio) return;
    setMarca(s);
    void marcarSubida(supabase, estado.ejercicio, cargaVista, s);
  }
  // Una serie más con el mismo peso después de marcar: la marca dice cuántas fueron.
  const seriesDeLaOferta = oferta?.series;
  useEffect(() => {
    if (marcada && oferta && marca && marca.series !== oferta.series) ponerMarca({ ...marca, series: oferta.series });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesDeLaOferta, marcada]);
  const enUnidad = (kg: number) => `${pesoCorto(kg, unidad)} ${unidad}`;
  const deUnaMarca = !!subida && subida.ejercicio === estado.ejercicio && estado.peso === subida.ahora;

  // CÓMO SE LLAMA CADA EJERCICIO, PARA LA PANTALLA BLOQUEADA (25/9).
  //
  // Esta pantalla es la única que tiene el catálogo cargado, así que es la
  // única que puede decir "Press de banca" en vez de `press_banca`. Deja los
  // nombres anotados y quien enciende la cuenta del descanso los lee.
  //
  // SOLO LOS NOMBRES. La serie y la meta NO se anotan desde acá: salían de este
  // efecto con un "más uno" y la tarjeta dijo "serie 4 de 3" una semana. Ver
  // `compartido/enCurso.ts`.
  useEffect(() => {
    ponerNombres(ejercicios);
  }, [ejercicios]);


  return (
    <View style={estilos.bloque}>
      <View style={estilos.fila}>
        <Pressable style={estilos.ejercicio} onPress={() => setEligiendo(true)} accessibilityRole="button">
          <Text
            style={[estilos.ejercicioTexto, !estado.ejercicio && estilos.apagadoTexto, esFantasma && estilos.fantasmaTexto]}
            numberOfLines={1}
          >
            {actual
              ? `${actual.nombre} · ${nombreDeGrupo(actual.grupo).toLowerCase()}`
              : estado.ejercicio && esPropio(estado.ejercicio)
                ? T.ejercicios.propioAjeno
                : T.sesion.sinEjercicio}
          </Text>
        </Pressable>
        {esFantasma && <Text style={estilos.badgeSugerido}>{T.sesion.sugerido}</Text>}
      </View>
      {esFantasma && <Text style={estilos.sugeridoNota}>{T.sesion.sugeridoNota}</Text>}
      {/* LA ÚLTIMA VEZ (19/10, bug del gimnasio): series, pesos y el modo (un lado por vez,
          por mancuerna…); la máquina ya la dice el nombre. Desde el 20/10, solo con «Mostrar
          la última vez» prendido en Ajustes: sale al entrar a entrenar y al elegir otro. */}
      {verUltimaVez && !!estado.ejercicio && !!ultimaVez && ultimaVez.series > 0 && (
        <Text style={estilos.sugeridoNota} testID="ultima-vez">
          {T.sesion.ultimaVez(fechaLinda(ultimaVez.fecha), detalleDeLaUltimaVez(ultimaVez, unidad, repsUltimaVez))}
        </Text>
      )}
      {globitoSubir && (
        <Globito
          testID="globito-subir"
          texto={T.sesion.yaPuedesSubir}
          alCerrar={() => {
            SUBIR_VISTOS.add(`${estado.ejercicio}:${dia}`);
            repintarGlobito((n) => n + 1);
          }}
        />
      )}

      {corriendoCardio && (
        <View testID="cronometro-cardio" style={estilos.cardio}>
          <Text style={estilos.cardioReloj}>{cronoLindo(segundosDeCardio)}</Text>
          <Text style={estilos.cardioNota}>{T.sesion.cardioCorriendo}</Text>
        </View>
      )}

      {/* UN CRONÓMETRO, NO UN TIMER (21/10, a pedido): antes de arrancar se veía «20 min» con
          − y +, que se leía como una cuenta para atrás. Ahora el reloj está en 0:00 y los minutos
          de la rutina, si los hay, son la meta. Se corrigen recién después de la vuelta. */}
      {esTiempo && !corriendoCardio && estado.hechas === 0 && (
        <View testID="cronometro-cardio-quieto" style={estilos.cardio}>
          <Text style={[estilos.cardioReloj, estilos.cardioQuieto]}>{cronoLindo(0)}</Text>
          <Text style={estilos.cardioNota}>{estado.minutos ? T.sesion.cardioMeta(estado.minutos) : T.sesion.cardioCuentaArriba}</Text>
        </View>
      )}

      {esTiempo && !corriendoCardio && estado.hechas > 0 && (
        <View testID="minutos-de-cardio" style={estilos.minutos} accessibilityLabel={T.sesion.minutosDeCardio}>
          <Pressable hitSlop={10} style={estilos.minutosPaso} onPress={() => alElegirMinutos?.(Math.max(1, Math.ceil(minutos / 5) * 5 - 5))} accessibilityLabel="−5">
            <Text style={estilos.minutosPasoTexto}>−</Text>
          </Pressable>
          <Text style={estilos.minutosTexto}>{T.rutina.minutos(minutos)}</Text>
          <Pressable hitSlop={10} style={estilos.minutosPaso} onPress={() => alElegirMinutos?.(Math.floor(minutos / 5) * 5 + 5)} accessibilityLabel="+5">
            <Text style={estilos.minutosPasoTexto}>+</Text>
          </Pressable>
        </View>
      )}
      {/* LA DISTANCIA DE LA VUELTA (21/10), con la migración 95. */}
      {esTiempo && !corriendoCardio && estado.hechas > 0 && conDistancia && alElegirDistancia && (
        <View style={estilos.distancia}>
          <Text style={estilos.distanciaEtiqueta}>{T.sesion.distancia}</Text>
          <CampoDistancia km={estado.distancia} unidad={unidadDeDistancia(unidad)} alCambiar={alElegirDistancia} />
        </View>
      )}

      {!esTiempo && (
      <View style={estilos.metas} accessibilityLabel={T.sesion.cuantasVasAHacer}>
        {pildorasDeMeta(estado.meta).map((m) => (
          <Pressable
            key={m}
            style={[estilos.meta, estado.meta === m && estilos.metaPrendida]}
            onPress={() => alElegirMeta(m)}
            accessibilityState={{ selected: estado.meta === m }}
          >
            <Text style={[estilos.metaTexto, estado.meta === m && estilos.metaTextoPrendido]}>×{m}</Text>
          </Pressable>
        ))}
      </View>
      )}

      {(anotarPeso || conReps) && admitePeso && (
        <View style={[estilos.peso, esFantasma && estilos.fantasmaPeso]}>
          {/* PESO CORPORAL (6.2): el peso es tu cuerpo, no hay número que anotar.
              Se esconde el campo pero se DEJA la etiqueta, para poder volver a un
              peso si algún día lo hacés con lastre. */}
          {anotarPeso && !esCorporal && <CampoPeso kg={estado.peso} unidad={unidad} alCambiar={alElegirPeso} />}
          {conReps && alElegirReps && <CampoReps reps={estado.repsAhora} pista={pistaDeReps} alCambiar={alElegirReps} />}
          {conCarga && !preguntar && (
            <EtiquetaDeCarga carga={cargaVista} ejercicio={estado.ejercicio} alElegir={alElegirCarga} />
          )}
          {conCarga && !preguntar && !esCorporal && !!estado.peso && muestraTotal(cargaVista) && (
            <Text style={estilos.total}>
              {T.sesion.enTotal(pesoCorto(kilosMovidos(estado.peso, cargaVista), unidad), unidad)}
            </Text>
          )}
        </View>
      )}

      {deUnaMarca && subida && (
        <Text testID="subida-nota" style={estilos.subidaNota}>
          {T.sesion.subidaNota(subida.series, enUnidad(subida.antes), enUnidad(subida.ahora))}
        </Text>
      )}

      {/* CON QUÉ LO HACÉS, la primera vez. No bloquea: el + anda igual. */}
      {preguntar && actual && (
        <View style={estilos.pregunta}>
          <Text style={estilos.preguntaTexto}>{T.sesion.conQueLoHaces(actual.nombre)}</Text>
          <View style={estilos.opciones}>
            {OPCIONES_DE_LA_PREGUNTA.map((c) => (
              <Pressable key={c} style={estilos.opcion} onPress={() => alElegirCarga(c)}>
                <Text style={estilos.opcionTexto}>{T.sesion.respuestaCarga[c as 'par' | 'total' | 'una']}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={estilos.nota}>{T.sesion.conQueNota}</Text>
        </View>
      )}

      {/* ¿DE CUÁL ERAN? Se cambió de ejercicio con series sin cerrar. */}
      {aDonde !== undefined && (
        <View style={estilos.pregunta}>
          <Text style={estilos.preguntaTexto}>{T.sesion.deCual(estado.hechas)}</Text>
          <View style={estilos.opciones}>
            <Pressable
              style={estilos.opcion}
              onPress={() => {
                elegir(aDonde);
                setADonde(undefined);
              }}
            >
              <Text style={estilos.opcionTexto} numberOfLines={1}>{T.sesion.eranDe(nombreDe(estado.ejercicio))}</Text>
            </Pressable>
            <Pressable
              style={estilos.opcion}
              onPress={() => {
                alMudarSeries(aDonde, conCarga ? cargaVista : undefined);
                setADonde(undefined);
              }}
            >
              <Text style={estilos.opcionTexto} numberOfLines={1}>{T.sesion.eranDe(nombreDe(aDonde))}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* UNA SOLA CUENTA DEL BLOQUE: los circulitos (19/9, lo mismo que la
          web). El "1 de 3" grande decía lo mismo con otra forma, y dos
          lecturas de lo mismo son las que hicieron creer que se habían
          perdido series. El total va chico al lado; el "1 de 3" queda para
          el lector de pantalla. */}
      <View style={estilos.cuenta} accessibilityLiveRegion="polite">
        {/* El cardio no tiene meta de series: sin circulitos. */}
        {!esTiempo && (
        <View
          style={estilos.puntos}
          accessible
          accessibilityRole="image"
          accessibilityLabel={T.sesion.deMeta(estado.hechas, estado.meta)}
        >
          {Array.from({ length: puntos }).map((_, i) => (
            <PuntoDeSerie key={i} lleno={i < estado.hechas} extra={i >= estado.meta} />
          ))}
        </View>
        )}
        <Text style={estilos.cuentaTotal}>{T.sesion.totalHoy(total)}</Text>
      </View>

      {/* EL − AL LADO DEL +, DEL MISMO ALTO (25/9).
          *"En vez de un + grande, un + y un −. Bajar series hoy es muy
          tosco."* Y lo era: sacar una serie estaba en un renglón de texto de
          catorce puntos, abajo de todo, mientras sumarla era un botón de media
          pantalla. Contar mal para abajo pasa igual de seguido que contar mal
          para arriba —tocaste dos veces, sumaste la del calentamiento— y la
          app lo trataba como un caso raro.

          EL + SIGUE MANDANDO: se lleva tres cuartos del ancho. Son dos gestos
          muy distintos en frecuencia —doce sumas contra una resta— y hacerlos
          del mismo tamaño sería pedirle a la mano que apunte doce veces.

          Y EL − SE APAGA EN CERO en vez de desaparecer: un botón que aparece y
          se va mueve el + de lugar justo cuando se está tocando. */}
      {/* El cardio no tiene meta: su botón es el del cronómetro (Arrancar, Listo, Otra vuelta). */}
      {cumplida && !esTiempo ? (
        <View style={estilos.filaBotones}>
          <Pressable
            style={[estilos.mas, estilos.menos, menosApagado && estilos.menosApagado]}
            onPress={alRestar}
            disabled={menosApagado}
            accessibilityLabel={T.inicio.sacarSerie}
            accessibilityRole="button"
          >
            <FondoOctogonal relleno={FONDO_BOTON} borde={C.lineaFuerte} corte={CORTE} />
            <Text style={[estilos.masTexto, menosApagado && estilos.apagadoTexto]}>−</Text>
          </Pressable>
          <Pressable
            style={[estilos.mas, estilos.masCerrar]}
            onPress={() => {
              if (!cierraElBloque()) return;
              alSiguiente();
              setLista(true);
              // El + del bloque que sigue queda apagado ese segundo: es el que cae debajo del dedo.
              setPausa(true);
              setTimeout(() => setPausa(false), TOQUE_REPETIDO_MS);
            }}
          >
            <FondoOctogonal relleno={C.claro} corte={CORTE} />
            <Text style={estilos.cerrarTexto}>{T.sesion.terminarSerie}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={estilos.filaBotones} onLayout={(e) => setAnchoBotones(e.nativeEvent.layout.width)}>
          <Pressable
            style={[estilos.mas, estilos.menos, menosApagado && estilos.menosApagado]}
            onPress={alRestar}
            disabled={menosApagado}
            accessibilityLabel={T.inicio.sacarSerie}
            accessibilityRole="button"
          >
            <FondoOctogonal relleno={FONDO_BOTON} borde={C.lineaFuerte} corte={CORTE} />
            <Text style={[estilos.masTexto, menosApagado && estilos.apagadoTexto]}>−</Text>
          </Pressable>
          <MasQuePulsa
            testID={esTiempo ? 'cardio-principal' : undefined}
            style={[estilos.mas, estilos.masAncho, esTiempo && estilos.masCerrar, pausa && estilos.masEnPausa]}
            pulsa={!esTiempo}
            onPress={esTiempo ? principalDeCardio.accion : sumar}
            accessibilityLabel={esTiempo ? principalDeCardio.texto : T.inicio.sumarSerie}
          >
            <FondoOctogonal relleno={esTiempo ? C.claro : FONDO_BOTON} borde={esTiempo ? undefined : C.lineaFuerte} corte={CORTE} />
            <Text style={esTiempo ? estilos.cerrarTexto : estilos.masTexto}>{esTiempo ? principalDeCardio.texto : '+'}</Text>
          </MasQuePulsa>
        </View>
      )}

      {/* El − se lleva un cuarto y el + tres, con 8 de hueco: el centro del + sale de ahí. */}
      {!cumplida && !esTiempo && globoDelMas && anchoBotones > 0 && globoDelMas((anchoBotones - 8) / 4 + 8 + ((anchoBotones - 8) * 3) / 8)}

      {debajoDelMas}

      {oferta && (
        <Pressable
          testID="la-proxima-mas"
          style={[estilos.subir, marcada && estilos.subirPrendido]}
          onPress={() =>
            ponerMarca(marcada ? null : { carga: cargaVista, peso: oferta.peso, series: oferta.series, dia })
          }
          accessibilityRole="button"
          accessibilityState={{ selected: marcada }}
        >
          <Text style={[estilos.subirTexto, marcada && estilos.subirTextoPrendido]}>
            {marcada ? T.sesion.proximaMasMarcada(enUnidad(pasoDelCampo(oferta.peso, unidad, 1) ?? oferta.peso)) : T.sesion.proximaMas}
          </Text>
        </Pressable>
      )}

      {esTiempo && !corriendoCardio && estado.hechas > 0 && (
        <Pressable
          testID="cardio-terminar"
          style={estilos.texto}
          onPress={() => {
            alSiguiente();
            setLista(true);
          }}
        >
          <Text style={estilos.textoBoton}>{T.sesion.cardioTerminar}</Text>
        </Pressable>
      )}
      {/* Quien se olvidó del cronómetro anota los minutos a mano. */}
      {esTiempo && !corriendoCardio && estado.hechas === 0 && (
        <Pressable testID="cardio-sin-cronometro" style={estilos.texto} onPress={sumar}>
          <Text style={estilos.textoBoton}>{T.sesion.cardioSinCronometro}</Text>
        </Pressable>
      )}
      {/* Una segunda vuelta de cardio en el mismo bloque no suma minutos: se corrigen arriba. */}
      {cumplida && !esTiempo && (
        <Pressable style={estilos.texto} onPress={sumar}>
          <Text style={estilos.textoBoton}>{T.sesion.sumarOtra}</Text>
        </Pressable>
      )}
      {(estado.cerrados.length > 0 || estado.hechas > 0) && (
        <Pressable style={estilos.texto} onPress={() => setLista(true)}>
          <Text style={estilos.textoBoton}>{T.sesion.verLista}</Text>
        </Pressable>
      )}

      <SelectorEjercicio
        visible={eligiendo}
        ejercicios={ejercicios}
        valor={estado.ejercicio}
        alElegir={(id, mide) => {
          // Entre un cardio y uno de fuerza no se pregunta "¿de cuál eran?": la cinta no
          // son series de press (cacería del 15/10). Se cierra el bloque y se sigue.
          const esCardio = (x: string | null) => ejercicios.find((e) => e.id === x)?.mide === 'tiempo';
          if (estado.hechas > 0 && id !== estado.ejercicio && (esCardio(id) || mide === 'tiempo') === esCardio(estado.ejercicio)) setADonde(id);
          else void elegir(id, mide);
        }}
        alCerrar={() => setEligiendo(false)}
      />
      <ListaDeBloques
        visible={lista}
        estado={estado}
        ejercicios={ejercicios}
        unidad={unidad}
        anotarPeso={anotarPeso}
        conCarga={conCarga}
        alCorregirPeso={alCorregirPeso}
        alCorregirCarga={alCorregirCarga}
        alCorregirEjercicio={alCorregirEjercicio}
        alTocar={alTocarBloque}
        alCerrar={() => setLista(false)}
      />
    </View>
  );
}

const CURVA_SALE = Easing.bezier(0.2, 0.8, 0.3, 1);

/**
 * EL PUNTO DE UNA SERIE (15/10, aprobada en la galería): el que se acaba de llenar
 * se llena desde el centro en 0,26 s. Los que ya estaban llenos al montar, no: es
 * la serie que se suma, no la pantalla que aparece.
 */
function PuntoDeSerie({ lleno, extra }: { lleno: boolean; extra: boolean }) {
  const relleno = useRef(new Animated.Value(lleno ? 1 : 0)).current;
  const antes = useRef(lleno);
  useEffect(() => {
    if (lleno === antes.current) return;
    antes.current = lleno;
    if (!lleno) return relleno.setValue(0);
    Animated.timing(relleno, { toValue: 1, duration: 260, easing: CURVA_SALE, useNativeDriver: true }).start();
  }, [lleno, relleno]);
  return (
    <View style={[estilos.punto, lleno && estilos.puntoBorde, extra && estilos.puntoExtra]}>
      <Animated.View style={[estilos.puntoRelleno, { transform: [{ scale: relleno }] }]} />
    </View>
  );
}

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

/** EL + QUE SE HUNDE Y SE ILUMINA al tocarlo (15/10): 0,3 s, nada más. */
function MasQuePulsa({
  pulsa,
  onPress,
  style,
  children,
  testID,
  accessibilityLabel,
}: {
  pulsa: boolean;
  onPress: () => void;
  style: React.ComponentProps<typeof Pressable>['style'];
  children: ReactNode;
  testID?: string;
  accessibilityLabel: string;
}) {
  const pulso = useRef(new Animated.Value(0)).current;
  const escala = pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 0.965] });
  return (
    <PressableAnimado
      testID={testID}
      style={[style as object, { transform: [{ scale: escala }] }]}
      onPress={() => {
        if (pulsa) {
          pulso.setValue(0);
          Animated.sequence([
            Animated.timing(pulso, { toValue: 1, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulso, { toValue: 0, duration: 220, easing: CURVA_SALE, useNativeDriver: true }),
          ]).start();
        }
        onPress();
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {pulsa && <Animated.View pointerEvents="none" style={[estilos.luzDelMas, { opacity: pulso }]} />}
      {children}
    </PressableAnimado>
  );
}

const estilos = StyleSheet.create({
  // Una capa más arriba que lo que viene después ("Terminar"): el globito del + flota
  // debajo del + y tiene que quedar encima, no tapado.
  bloque: { marginTop: 22, zIndex: 2, elevation: 2 },
  fila: { flexDirection: 'row', alignItems: 'center' },
  ejercicio: { flex: 1, borderBottomWidth: 1, borderBottomColor: C.lineaFuerte, paddingVertical: 10 },
  ejercicioTexto: { color: C.tinta, fontSize: 17 },
  apagadoTexto: { color: C.apagado },
  // FANTASMA (sugerido sin confirmar): tenue y en cursiva, distinto del confirmado.
  fantasmaTexto: { color: C.sub, fontStyle: 'italic' },
  fantasmaPeso: { opacity: 0.5 },
  // La etiqueta "sugerido": una píldora chica al lado del ejercicio, imposible
  // de confundir con un bloque ya cargado.
  badgeSugerido: {
    color: C.fondo,
    backgroundColor: C.sub,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: 8,
    overflow: 'hidden',
  },
  sugeridoNota: { color: C.apagado, fontSize: 12, lineHeight: 16, marginTop: 6 },
  metas: { flexDirection: 'row', gap: 8, marginTop: 12 },
  meta: { flex: 1, borderWidth: 1, borderColor: C.linea, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  metaPrendida: { borderColor: C.sub },
  metaTexto: { color: C.apagado, fontSize: 14 },
  metaTextoPrendido: { color: C.tinta },
  peso: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, marginTop: 12 },
  minutos: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12 },
  cardio: { alignItems: 'center', marginTop: 14, gap: 4 },
  cardioReloj: { color: C.tinta, fontSize: 56, fontWeight: '200', fontVariant: ['tabular-nums'] },
  cardioNota: { color: C.sub, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  // Quieto en 0:00 hasta que se arranca: el mismo reloj, más tenue.
  cardioQuieto: { color: C.sub },
  distancia: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10 },
  distanciaEtiqueta: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  minutosPaso: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, alignItems: 'center', justifyContent: 'center' },
  minutosPasoTexto: { color: C.tinta, fontSize: 22, fontWeight: '300' },
  minutosTexto: { color: C.tinta, fontSize: 22, fontVariant: ['tabular-nums'], minWidth: 90, textAlign: 'center' },
  total: { width: '100%', color: C.apagado, fontSize: 12, marginTop: -2, paddingLeft: 44 },
  pregunta: { borderWidth: 1, borderColor: C.lineaFuerte, borderRadius: 2, padding: 12, marginTop: 12 },
  preguntaTexto: { color: C.sub, fontSize: 13, marginBottom: 10 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  opcionTexto: { color: C.claro, fontSize: 13 },
  nota: { color: C.apagado, fontSize: 12, marginTop: 8 },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 1 },
  punto: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: C.sub },
  puntoBorde: { borderColor: C.claro },
  puntoRelleno: { ...StyleSheet.absoluteFillObject, borderRadius: 8, backgroundColor: C.claro },
  luzDelMas: { ...StyleSheet.absoluteFillObject, backgroundColor: conAlfa(C.claro, 0.14) },
  puntoExtra: { width: 11, height: 11, borderRadius: 6, marginTop: 2.5 },
  cuenta: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 22 },
  cuentaTotal: { color: C.apagado, fontSize: 12, letterSpacing: 1 },
  // La fila de los dos botones: el − angosto y el + con todo lo que sobra.
  filaBotones: { flexDirection: 'row', gap: 8, marginTop: 18 },
  // A LA MITAD (26/9), de 150 a 75 y el signo de 56 a 28.
  //
  // La regla original era "el + ocupa media pantalla: se toca con una mano,
  // transpirado, sin apuntar", y para UN botón solo estaba bien. Dejó de
  // estarlo cuando entró el − al lado: ahora son dos bloques de 150 que entre
  // los dos se comían la pantalla del ejercicio, y el resto —el peso, las
  // series hechas, la lista— quedaba arriba de todo peleando por lugar.
  //
  // 75 NO ES CHICO: el mínimo que pide Apple para un blanco de toque son 44
  // puntos, así que sigue siendo casi el doble. Lo que se pierde es el "sin
  // apuntar", y eso lo compensa el ancho: el + se lleva tres cuartos de la
  // fila, o sea que el blanco real sigue teniendo el tamaño de una mano.
  // El fondo y el borde los dibuja `FondoOctogonal`: esquinas cortadas en diagonal (21/10).
  mas: {
    marginTop: 18,
    minHeight: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masTexto: { color: C.claro, fontSize: 28, fontWeight: '200' },
  masCerrar: { flex: 3, marginTop: 0 },
  masEnPausa: { opacity: 0.35 },
  // Un cuarto del ancho contra tres: doce sumas contra una resta.
  menos: { flex: 1, marginTop: 0 },
  menosApagado: { opacity: 0.35 },
  masAncho: { flex: 3, marginTop: 0 },
  cerrarTexto: { color: C.fondo, fontSize: 18, fontWeight: '600' },
  texto: { paddingVertical: 12, alignItems: 'center' },
  textoBoton: { color: C.sub, fontSize: 14 },
  // "La próxima, más": un contorno, no un sólido. No compite con el `+`, que
  // es lo que se toca doce veces; este se toca una.
  subir: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
  },
  subirPrendido: { borderColor: C.sub },
  subirTexto: { color: C.sub, fontSize: 14 },
  subirTextoPrendido: { color: C.tinta },
  subidaNota: { color: C.sub, fontSize: 13, marginTop: 8 },
});
