import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  InteractionManager,
  PixelRatio,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { LinearGradient } from 'expo-linear-gradient';
import VeloDeLectura from './VeloDeLectura';
import type { WebGLRenderer } from 'three';
import type { Montaje, OpcionesFondo } from '@compartido/motor/escena';
import { eventos } from '@compartido/eventos';
import { PULSO } from '@nucleo/pulso';
import { FONDO_BASE, FONDO_RANGO_7 } from '@nucleo/paletas';
import { alturaDe, ESQUINA_DE_ALTURA, horizonteDe, velosDe } from '@nucleo/horizonte';
import { CAMBIO_FONDO, cargarElMotor, esPreferenciaFondo, type PreferenciaFondo } from '@nucleo/fondo';
import { plataforma } from '@plataforma';
import { conAlfa } from './colores';
import { LLEGA } from './movimiento';
import { escucharFondo, type Pedido } from './pedidoDeFondo';
import { escucharDesenfoque, escucharTapa, escucharTira } from './desenfoqueDelFondo';
import { ponerEstadoDelMotor } from './estadoDelMotor';
import { CALIDAD_CAMBIO, densidadTope } from '@nucleo/calidad';
import { calidadAhora, leerCalidad, vigilarCalidad } from './calidad';

/**
 * EL FONDO DE LA APP NATIVA: el motor de cuerpos celestes detrás de todo.
 *
 * Es el MISMO motor que el de la web; esto es el marco: una base de color, el
 * `GLView` que entra con un fundido cuando el motor está listo, y arriba lo que
 * sostiene la legibilidad.
 *
 * DESDE EL 2/11 LA NATIVA VA DISTINTO QUE LA WEB (sección 14 de la galería): pide
 * el cielo de `firmamento.ts` y el cuerpo como horizonte (`nucleo/horizonte.ts`).
 * Se fueron las elipses de color, el velo parejo y el desenfoque de las otras
 * pestañas: tapaban lo que se había hecho para verse.
 *
 * VIVE EN LA RAÍZ, NO EN INICIO. Inicio pide el fondo (`FondoEspacial` →
 * `pedidoDeFondo.ts`) y esto lo dibuja. Un solo `GLView`, un solo contexto y
 * un solo renderer para toda la sesión: si el motor viviera adentro de
 * Inicio, cada vuelta a la pestaña crearía un contexto nuevo y recompilaría
 * todos los shaders —medido: 6 shaders y 3 programas por vuelta—.
 *
 * CUANDO NADIE PIDE FONDO la escena no se suelta: se pausa y se esconde.
 * Soltarla borraría los programas de la GPU. Al volver con las mismas
 * opciones —lo normal: mismo día, mismo cuerpo— se reanuda sin armar nada.
 * Si las opciones cambiaron se monta la escena nueva ANTES de soltar la
 * vieja, para que three reuse los programas que ya tiene vivos.
 *
 * LOS BORDES: el degradado vertical que oscurece arriba y abajo. Abajo pega
 * menos que en la web: ahí abajo ya está la barra, con lo suyo borroso.
 *
 * LA SUBIDA DE RANGO NO PASA POR ACÁ (23/9). Tiene su propio `GLView` dentro
 * del modal, porque un `Modal` de iOS es otra jerarquía de vistas y este queda
 * tapado. Ver `LienzoSubida.tsx`.
 *
 * LO QUE RESPETA IGUAL QUE LA WEB: la preferencia "Fondo: automático / siempre / nunca"
 * (misma clave, misma decisión de `nucleo/fondo.ts`), el movimiento reducido
 * del sistema, y el pulso de registrar el día.
 */

// La misma clave que la web (`src/lib/fondo.ts`): es la misma preferencia.
const CLAVE_FONDO = 'ascent:fondo';

// EL TOPE DE 2X, igual que la web (`dpr()` en `src/motor/escena.ts`).
//
// Un cuerpo raytraceado a pantalla completa en 3x es lo que calienta un
// teléfono, y la web lo topa a propósito. Acá no se puede pedir menos
// resolución: el buffer de `expo-gl` mide lo que mide la vista, en píxeles
// físicos. Así que se achica la VISTA —a 2/3 en un iPhone de 3x— y se la
// estira con una transformación hasta llenar la pantalla. El motor ve el
// tamaño de verdad y una densidad de 2, y el buffer tiene justo eso.
//
// En pantallas de 2x o menos el factor es 1: no cambia nada.
//
// EL TOPE BAJA A 1X CON LA CALIDAD EN "BAJA" (8/10): un cuarto de los píxeles
// de 2x, que es lo que más pesa. Lo decide `calidad.ts` —la persona en Ajustes,
// o la app sola si mide que el teléfono no da—.
export function factorDeTope() {
  return Math.min(1, densidadTope(calidadAhora()) / PixelRatio.get());
}

// De qué depende que haya que armar la escena de nuevo.
//
// LA ESQUINA NO ESTÁ ACÁ (23/9), y antes sí: cambiar de pestaña armaba la
// escena entera de nuevo y el cuerpo aparecía en el otro lado de un cuadro para
// el otro. Ahora la escena es la misma y VIAJA (`montaje.mover`), que además
// ahorra recompilar los shaders en cada cambio de pestaña.
function claveDeEscena(op: OpcionesFondo, animar: boolean) {
  return [
    op.rango,
    op.planeta ?? '',
    op.apagado ? 1 : 0,
    op.vacio ? 1 : 0,
    // SIN ESTO, PASAR DE INICIO A RANKING REUSA LA ESCENA y el planeta se
    // queda: la clave seria la misma y el motor no armaria nada nuevo.
    op.soloEstrellas ? 1 : 0,
    op.reposo ? 1 : 0,
    op.presagio ? 1 : 0,
    op.fantasma?.rango ?? '',
    op.fantasma?.planeta ?? '',
    animar ? 1 : 0,
  ].join('|');
}

type Escena = { clave: string; montaje: Montaje };

/** Dónde queda el cuerpo para este pedido. */
const alturaDelPedido = (p: Pedido) => alturaDe(p.esquina, p.lecturaMedia);

/**
 * EL FUNDIDO, en milisegundos.
 *
 * LA SALIDA ES MÁS CORTA QUE LA ENTRADA a propósito: lo que se va no tiene que
 * hacerse rogar, y mientras se va la pantalla ya está deslizándose a otro lado.
 * Lo que llega sí se toma su tiempo, que es lo que lo hace aparecer en vez de
 * prenderse.
 */
const SALIDA_MS = 220;
const ENTRADA_MS = 520;

/**
 * CUÁNDO EL FONDO SE CONSIDERA TAPADO Y BAJA LOS CUADROS. Dos umbrales, y la
 * diferencia es de BATERÍA (item batería): antes había uno solo en 0,85, así
 * que Stats —cuyo techo es 0,45— dejaba el motor a 60 cuadros por segundo
 * detrás de la pantalla más pesada de la app. Eso es el mayor gasto del motor
 * y calienta el teléfono.
 *
 * - `TAPADO_INMEDIATO` (0,85): las pantallas que tapan del todo (Ranking,
 *   Álbum, Ajustes). El cuerpo no se ve, así que se baja a lento AL TOQUE.
 * - `TAPADO_ASENTADO` (0,4): Stats. El cuerpo se ve a medias, y bajarle los
 *   cuadros A MITAD DEL DESLIZAMIENTO se nota (por eso el umbral único era
 *   0,85). Así que acá se espera a que el deslizamiento ASIENTE (ver el efecto):
 *   el deslizamiento va fluido a 60, y recién cuando te quedaste en Stats el
 *   motor baja a lento. Ahí es donde se pasa el tiempo, y donde estaba el gasto.
 */
const TAPADO_INMEDIATO = 0.85;
const TAPADO_ASENTADO = 0.4;
/** Cuánto tiene que quedarse quieto el desenfoque de Stats antes de bajar. */
const ASENTARSE_MS = 400;

function VeloPlano({ color, cuanto }: { color: string; cuanto: number }) {
  const opacidad = useRef(new Animated.Value(cuanto)).current;
  useEffect(() => {
    Animated.timing(opacidad, { toValue: cuanto, duration: 420, easing: LLEGA, useNativeDriver: true }).start();
  }, [cuanto, opacidad]);
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: opacidad }]} />;
}

export default function FondoRaiz() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  // El pedido de AHORA, para el montaje asíncrono: si mientras se importaba
  // el motor la pantalla dejó de pedir, la escena nueva nace en pausa.
  const pedidoAhora = useRef<Pedido | null>(null);
  pedidoAhora.current = pedido;
  // El último pedido que hubo: los colores de la base se quedan con él
  // mientras la escena está guardada, para no parpadear al volver.
  const ultimoPedido = useRef<Pedido | null>(null);
  // `null` = todavía no se sabe si hay que cargar el motor.
  const [cargar, setCargar] = useState<boolean | null>(null);
  // La preferencia del fondo: además del motor, decide si se dibujan las capas
  // ESTÁTICAS del espacio (estrellas, elipses, velo). En "nunca" no se dibuja
  // nada: fondo liso. Antes "nunca" solo apagaba el motor y las estrellas
  // seguían — por eso parecía que el botón no hacía nada (bug del 28/9).
  const [pref, setPref] = useState<PreferenciaFondo>('auto');
  const mostrarEspacio = pref !== 'nunca';
  const [reducir, setReducir] = useState(false);
  const opacidad = useRef(new Animated.Value(0)).current;

  const caja = useRef(Dimensions.get('window'));
  // El `GLView` se crea recién con la medida de verdad: su buffer se fija al
  // crearse, y crearlo con el tamaño de la ventana para después achicarlo
  // dejaría un buffer que no coincide con la vista.
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  const oyentesDeTamano = useRef(new Set<() => void>());

  const gl = useRef<ExpoWebGLRenderingContext | null>(null);
  const renderer = useRef<WebGLRenderer | null>(null);
  const [listo, setListo] = useState(false);
  const escena = useRef<Escena | null>(null);
  const yaSeVio = useRef(false);

  /**
   * ─────────────────────────────────────────────────────────────────────
   * EL CONTEXTO DE GL SE PIERDE, Y HAY QUE RECONSTRUIRLO (26/9)
   *
   * QUÉ PASA CUANDO SE PIERDE. La GPU puede resetear el contexto —presión de
   * memoria, un pico térmico, el sistema reclamando la GPU— y todo lo que
   * three tenía compilado ahí (los shaders, los buffers) deja de existir. El
   * lienzo queda con el último cuadro congelado o en negro, y el próximo
   * dibujo tira. Forzado en el navegador con `WEBGL_lose_context`, hoy: el
   * fondo se congela, salta un `Cannot read properties of null` y no vuelve.
   *
   * QUÉ SE PUEDE ESCUCHAR, Y DÓNDE. En el navegador (y en la vista web de
   * :8090) el canvas emite `webglcontextlost`, y el `GLView` de expo lo pasa
   * por su prop `onContextLost`. En el TELÉFONO, expo-gl NO expone ningún
   * evento de contexto perdido: su `GLView` nativo solo tiene `onContextCreate`
   * (verificado en expo-gl 16.0.10). Así que en nativo hay dos redes:
   *   1. `onContextLost`, que en nativo simplemente no dispara (prop ignorada).
   *   2. UN VIGILANTE que le pregunta al contexto si se perdió, para los casos
   *      en que expo-gl sí implemente `isContextLost`. Si no lo implementa, no
   *      dispara nunca — y no pasa nada, porque una pérdida de contexto de
   *      verdad en iOS es rara y, cuando ocurre, no hay señal que capturar.
   *
   * OJO — LO MÁS COMÚN NO ES ESTO. Pasar a Spotify y volver es
   * background/foreground, NO pérdida de contexto: iOS conserva el contexto y
   * el motor solo se pausa y reanuda (`plataforma.ciclo`). Esto es la red para
   * cuando el contexto se pierde DE VERDAD.
   *
   * CÓMO SE RECONSTRUYE. No se puede "restaurar" el contexto viejo: se tira el
   * `GLView` entero y se monta uno nuevo (con una `key` que cambia), que trae
   * un `onContextCreate` fresco. Ahí se crea un renderer nuevo y el efecto de
   * "la escena sigue al pedido" la reconstruye desde cero, shaders incluidos.
   * El usuario ve un parpadeo del fondo, no una app rota.
   */
  const [generacion, setGeneracion] = useState(0);
  const recuperando = useRef(false);
  const recuperar = useCallback(() => {
    // Una sola vez por pérdida: `onContextLost` y el vigilante pueden llamar
    // los dos, y una segunda reconstrucción a mitad de la primera deja dos
    // renderers.
    if (recuperando.current) return;
    recuperando.current = true;
    ponerEstadoDelMotor('arrancando');
    // Soltar lo muerto. Sus llamadas a GL van contra un contexto perdido, así
    // que cada una puede tirar: envueltas, porque lo que importa es seguir.
    try {
      escena.current?.montaje.soltar();
    } catch {
      /* el contexto ya no está: no hay nada que soltar */
    }
    escena.current = null;
    try {
      renderer.current?.dispose();
    } catch {
      /* idem */
    }
    renderer.current = null;
    gl.current = null;
    yaSeVio.current = false;
    setListo(false);
    opacidad.setValue(0);
    // Remonta el `GLView`: nueva `key` → `onContextCreate` de nuevo.
    setGeneracion((g) => g + 1);
  }, [opacidad]);

  useEffect(() => escucharFondo(setPedido), []);

  // LA CALIDAD. El tamaño del buffer se fija al crear el `GLView`, así que
  // cambiarla es montarlo de nuevo: el mismo camino que recuperar un contexto
  // perdido. Y con el motor andando arranca el vigilante, que mide de a ratos y
  // la baja sola si el teléfono no da (`vigilarCalidad`).
  useEffect(() => {
    void leerCalidad();
    return eventos.escuchar(CALIDAD_CAMBIO, () => recuperar());
  }, [recuperar]);
  useEffect(() => {
    if (listo) void vigilarCalidad();
  }, [listo]);

  /**
   * CUÁNTO SE ALEJÓ DE INICIO, de 0 a 1 (25/9). Era el desenfoque del fondo fuera de Inicio, a pedido; el
   * 2/11 el desenfoque se fue, porque con el planeta como horizonte el fondo ya no compite con la
   * lectura. Queda el número porque dice cuánto está tapado, y de ahí salen los cuadros del motor.
   *
   * Si alguna vez vuelve: el `filter` de React Native sobre un `GLView` deja la vista en blanco (iOS no
   * puede rasterizar un framebuffer). Se desenfoca con `BlurView` encima, como la barra de abajo.
   */
  const [desenfoque, setDesenfoque] = useState(0);
  useEffect(() => escucharDesenfoque(setDesenfoque), []);
  // Las capas del cielo acompañan a la tira. Sin pasar por React: es un valor por cuadro del gesto.
  const tira = useRef(0);
  useEffect(
    () =>
      escucharTira((i) => {
        tira.current = i;
        escena.current?.montaje.paralaje(i - 2);
      }),
    [],
  );
  // Una pantalla opaca encima (el descanso, la subida de rango): el fondo no se ve, y se pausa.
  const [tapadoDelTodo, setTapadoDelTodo] = useState(false);
  useEffect(() => escucharTapa(setTapadoDelTodo), []);

  /**
   * Y LO QUE ESTÁ TAPADO SE DIBUJA MENOS (25/9).
   *
   * MEDIDO, y fue lo más claro que dio la medición: con el fondo prendido, la
   * app entera va al mismo ritmo haciendo cualquier cosa —deslizar entre
   * pestañas, abrir una foto, o NADA—. Ese "o nada" es la respuesta: el costo
   * no es de ninguna transición, es un piso que está abajo de todo, y es este
   * motor dibujando a sesenta cuadros por segundo. Con el fondo apagado las
   * mismas transiciones pasan de diez cuadros por segundo a sesenta.
   *
   * Y desde que el cuerpo está en las cinco pestañas, ese piso se paga en las
   * cinco — para animar con todo detalle algo que está detrás de un vidrio
   * esmerilado. Pasado el umbral, el motor baja al escalón lento de
   * `nucleo/quietud.ts` (ver `tapar` en `compartido/motor/escena.ts`).
   *
   * EL UMBRAL ES 0,4 Y NO 1 porque Stats nunca llega a 1 —su techo es 0,45, a
   * pedido— y es la pantalla con más cosas que dibujar de la app, o sea la que
   * más necesita el presupuesto de cuadro. A 0,4 el cuerpo ya no se lee como
   * un objeto en ninguna de las cuatro.
   */
  // El valor vive también en un ref: la escena se monta dentro de una promesa,
  // así que cuando este efecto corre puede no existir todavía, y la escena
  // recién nacida tiene que nacer sabiendo si está tapada o no.
  // Para el montaje de una escena nueva (abajo): una escena que nace ya estando
  // en una pantalla tapada nace tapada, sin deslizamiento de por medio, así que
  // usa el umbral instantáneo bajo —no hay ritmo que se pueda ver cambiar—.
  const tapadoAhora = useRef(false);
  tapadoAhora.current = desenfoque >= TAPADO_ASENTADO;
  useEffect(() => {
    let cancelado = false;
    let id: ReturnType<typeof setTimeout> | undefined;
    const aplicar = (v: boolean) => {
      if (!cancelado) escena.current?.montaje.tapar(v);
    };
    if (desenfoque >= TAPADO_INMEDIATO) {
      aplicar(true); // tapa del todo (Ranking/Álbum/Ajustes): al toque
    } else if (desenfoque >= TAPADO_ASENTADO) {
      // Stats: el cuerpo se ve a MEDIAS acá (desenfoque ~0,45), así que bajarle
      // los cuadros MIENTRAS te movés se ve como un titileo de la pantalla
      // anterior (regresión del 29/9: antes el único umbral era 0,85 y Stats
      // nunca bajaba, así que iba fluido). Ahora: al toque vuelve a 60 —cualquier
      // cambio del desenfoque es movimiento— y recién si te QUEDÁS quieto 400 ms
      // baja a lento. Así el deslizamiento va fluido y el ahorro de batería sigue
      // intacto (Stats asentado sí baja).
      aplicar(false);
      id = setTimeout(() => aplicar(true), ASENTARSE_MS);
    } else {
      aplicar(false); // destapado (Inicio, o volviendo): 60 al toque para el viaje
    }
    return () => {
      cancelado = true;
      if (id) clearTimeout(id);
    };
  }, [desenfoque, listo, pedido]);

  // LEER Y APLICAR LA PREFERENCIA. Se corre al montar y CADA VEZ que cambia en
  // Ajustes (por el bus, `CAMBIO_FONDO`): antes se leía una sola vez y el cambio
  // no se veía hasta reabrir. Si el aviso trae la preferencia nueva, se usa esa
  // y no se relee del disco (la escritura puede no haber terminado).
  const aplicarPreferencia = useCallback(async (prefNueva?: PreferenciaFondo) => {
    const [guardada, r] = await Promise.all([
      prefNueva ? Promise.resolve(prefNueva) : plataforma.almacenamiento.leer(CLAVE_FONDO),
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
    ]);
    const p = esPreferenciaFondo(guardada) ? guardada : 'auto';
    setReducir(r);
    setPref(p);
    // `null` en "equipo flojo": en el teléfono no hay de dónde leerlo. La
    // regla de `nucleo/fondo.ts` es que no saber NO es flojo.
    const hayQue = cargarElMotor(p, null);
    setCargar(hayQue);
    // Para Diagnóstico: ver `estadoDelMotor.ts`.
    ponerEstadoDelMotor(hayQue ? 'arrancando' : 'apagado');
  }, []);

  useEffect(() => {
    let vivo = true;
    void aplicarPreferencia().catch(() => {});
    const dejar = eventos.escuchar(CAMBIO_FONDO, (p) => {
      if (vivo) void aplicarPreferencia(esPreferenciaFondo(p) ? p : undefined).catch(() => {});
    });
    return () => {
      vivo = false;
      dejar();
    };
  }, [aplicarPreferencia]);

  // SOLTAR EL MOTOR CUANDO SE APAGA EN VIVO (pref "nunca" a mitad de sesión). El
  // `GLView` se desmonta al dejar de renderizarse, pero los recursos de three
  // (programas, texturas) hay que soltarlos a mano, igual que al desmontar la
  // raíz. Sin esto quedarían en la GPU hasta cerrar la app.
  useEffect(() => {
    if (cargar === false && escena.current) {
      escena.current.montaje.soltar();
      escena.current = null;
      renderer.current?.dispose();
      renderer.current = null;
    }
  }, [cargar]);

  // El impacto de registrar el día llega por el bus, igual que en la web.
  useEffect(() => eventos.escuchar(PULSO, () => escena.current?.montaje.pulso()), []);

  // Al cerrar la sesión la raíz se desmonta: ahí sí se suelta todo.
  useEffect(
    () => () => {
      escena.current?.montaje.soltar();
      escena.current = null;
      renderer.current?.dispose();
      renderer.current = null;
    },
    []
  );

  // LA ESCENA SIGUE AL PEDIDO.
  useEffect(() => {
    if (pedido) ultimoPedido.current = pedido;
    const actual = escena.current;

    if (tapadoDelTodo && escena.current) {
      // Tapado del todo: se pausa y nada más. La opacidad queda: al destaparse no hay fundido.
      escena.current.montaje.pausar(true);
      return;
    }
    if (!pedido || !listo || !renderer.current || !gl.current) {
      // Nadie pide fondo, o el motor todavía no está: se guarda lo que haya.
      actual?.montaje.pausar(true);
      opacidad.setValue(0);
      return;
    }

    const animar = pedido.animar !== false && !reducir;
    const clave = claveDeEscena(pedido, animar);

    if (actual && actual.clave === clave) {
      // Lo normal: la misma escena de la última vez. Se reanuda, y si la
      // pantalla nueva la quiere en otra esquina, viaja hasta allá.
      actual.montaje.pausar(false);
      actual.montaje.tapar(tapadoAhora.current);
      actual.montaje.mover(ESQUINA_DE_ALTURA[alturaDelPedido(pedido)]);
      // El fundido de entrada solo la primera vez: al volver a Inicio la
      // escena ya estaba, y hacerla aparecer de a poco otra vez se leería como
      // que se cargó de nuevo.
      if (yaSeVio.current) {
        opacidad.setValue(1);
      } else {
        yaSeVio.current = true;
        Animated.timing(opacidad, { toValue: 1, duration: ENTRADA_MS, useNativeDriver: true }).start();
      }
    } else {
      // ─────────────────────────────────────────────────────────────
      // OTRA ESCENA: SE DISUELVE, NO SE CORTA (24/9, a pedido)
      //
      // El caso que se ve es salir de Inicio: el planeta desaparecía de golpe,
      // en el cuadro en que la escena nueva reemplazaba a la vieja. El cambio
      // entre Ranking, Álbum y Stats no tiene este problema y no lo va a tener
      // —los tres piden lo mismo, la clave es la misma y no se remonta nada—,
      // así que esto solo corre cuando el fondo cambia DE VERDAD.
      //
      // EL FUNDIDO DE SALIDA VA EN PARALELO CON LA IMPORTACIÓN, no antes: el
      // motor tarda en evaluarse igual, y encadenarlos sumaría la espera de los
      // dos. Se apaga mientras el módulo llega, se monta la escena nueva con la
      // pantalla ya oscura, y recién ahí vuelve.
      const seVa = new Promise<void>((listo_) => {
        Animated.timing(opacidad, { toValue: 0, duration: SALIDA_MS, useNativeDriver: true }).start(
          () => listo_()
        );
      });

      // Primero la nueva, DESPUÉS se suelta la vieja: mientras las dos existen,
      // los programas que comparten siguen vivos y three los reusa en vez de
      // compilarlos otra vez.
      void Promise.all([import('./motorNativo'), seVa]).then(([{ montarEscenaEnGL }]) => {
        if (!renderer.current || !gl.current) return;
        const m = montarEscenaEnGL(
          renderer.current,
          gl.current,
          {
            tamano: () => ({ w: caja.current.width, h: caja.current.height }),
            alCambiar: (fn) => {
              oyentesDeTamano.current.add(fn);
              return () => oyentesDeTamano.current.delete(fn);
            },
          },
          { ...pedido, animar, cielo: true, horizonte: horizonteDe(pedido.rango, pedido.planeta), esquina: ESQUINA_DE_ALTURA[alturaDelPedido(pedido)] }
        );
        const vieja = escena.current;
        m?.tapar(tapadoAhora.current);
        m?.paralaje(tira.current - 2);
        escena.current = m ? { clave, montaje: m } : null;
        vieja?.montaje.soltar();
        if (!pedidoAhora.current) {
          m?.pausar(true);
          return;
        }
        yaSeVio.current = true;
        Animated.timing(opacidad, { toValue: 1, duration: ENTRADA_MS, useNativeDriver: true }).start();
      });
    }
  }, [pedido, listo, reducir, opacidad, tapadoDelTodo]);

  const alCrearContexto = async (contexto: ExpoWebGLRenderingContext) => {
    // EL MOTOR ESPERA A QUE LA PANTALLA ESTÉ QUIETA: es el equivalente del
    // `requestIdleCallback` de la web. Primero se ve la racha; el fondo
    // después.
    await new Promise<void>((r) => InteractionManager.runAfterInteractions(() => r()));
    const { crearRenderer } = await import('./motorNativo');
    const r = crearRenderer(contexto);
    if (!r) {
      // Se pidió, el lienzo llegó a existir, y aun así no hay renderer: es el
      // único caso de los cinco que es un error de verdad. Antes esto era un
      // `return` mudo y la pantalla quedaba sin cuerpo sin decir nada.
      ponerEstadoDelMotor('no-arranco');
      return;
    }
    gl.current = contexto;
    renderer.current = r;
    ponerEstadoDelMotor('andando');
    setListo(true);
    // La reconstrucción terminó: el vigilante puede volver a disparar si se
    // pierde otra vez.
    recuperando.current = false;
  };

  /**
   * EL VIGILANTE DEL CONTEXTO, para el teléfono (ver el bloque de arriba). En
   * el navegador `onContextLost` ya avisa; esto es la red para nativo, donde no
   * hay evento. Cada dos segundos le pregunta al contexto si se perdió — y solo
   * si el contexto contesta que sí. Si expo-gl no implementa `isContextLost`,
   * la pregunta no existe y esto no hace nada, que es lo correcto.
   */
  useEffect(() => {
    if (!listo) return;
    const id = setInterval(() => {
      const ctx = renderer.current?.getContext() as { isContextLost?: () => boolean } | undefined;
      if (ctx && typeof ctx.isContextLost === 'function' && ctx.isContextLost()) recuperar();
    }, 2000);
    return () => clearInterval(id);
  }, [listo, recuperar]);

  const alMedir = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    caja.current = { ...caja.current, width, height };
    setMedida({ w: width, h: height });
    for (const fn of oyentesDeTamano.current) fn();
  };

  // La vista del GL, achicada por el tope y estirada de vuelta desde el
  // centro: ocupa exactamente lo mismo que la pantalla.
  const f = factorDeTope();
  const vistaGL = medida && {
    position: 'absolute' as const,
    width: medida.w * f,
    height: medida.h * f,
    left: (medida.w - medida.w * f) / 2,
    top: (medida.h - medida.h * f) / 2,
    transform: [{ scale: 1 / f }],
  };

  const op = pedido ?? ultimoPedido.current;
  // Hasta el primer pedido no se crea nada: ni el contexto ni three.
  if (!op) return null;
  const fondo = op.rango === 7 ? FONDO_RANGO_7 : FONDO_BASE;
  const { velo, lectura } = velosDe(op.rango, alturaDelPedido(op), op.textoAbajo);

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: fondo, opacity: pedido ? 1 : 0 }]}
      pointerEvents="none"
      onLayout={alMedir}
    >
      {/* EN "NUNCA" NO SE DIBUJA NADA DEL ESPACIO: ni estrellas, ni motor, ni
          velo, ni bordes. Queda el color liso de arriba. Todo lo demás va gated
          en `mostrarEspacio`. */}
      {mostrarEspacio && (
      <>
      {cargar && vistaGL && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad }]}>
          {/* `key` con la generación: al perderse el contexto se sube y el
              GLView se monta de nuevo con uno fresco. `onContextLost` dispara
              en la vista web; en nativo lo cubre el vigilante de arriba. */}
          {/* `onContextLost` solo existe en el `GLView` web; el tipo nativo no
              lo declara. Va por un spread tipado: en la web llega y dispara, en
              nativo es una prop de más que se ignora. */}
          <GLView
            key={generacion}
            style={vistaGL}
            onContextCreate={alCrearContexto}
            {...({ onContextLost: recuperar } as { onContextLost: () => void })}
          />
        </Animated.View>
      )}
      {/* El velo también se mueve: entre pantallas cambia, y de golpe se ve como un parpadeo del fondo. */}
      <VeloPlano color={fondo} cuanto={velo} />
      {/* LOS BORDES, lo que sostiene la legibilidad cuando el velo se abre: fondo
          al 80 % arriba y nada del 26 % al 86 %. Los extremos transparentes son el
          fondo con alfa 0 y no `transparent`: CSS mezcla premultiplicado y acá no,
          y hacia negro transparente el degradado ensuciaría el color. */}
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={[conAlfa(fondo, 0.8), conAlfa(fondo, 0), conAlfa(fondo, 0), conAlfa(fondo, 0.5)]}
        locations={[0, 0.26, 0.86, 1]}
      />
      <VeloDeLectura cuanto={lectura} />
      </>
      )}
    </View>
  );
}
