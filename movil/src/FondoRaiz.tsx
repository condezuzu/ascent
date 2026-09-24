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
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { WebGLRenderer } from 'three';
import type { Montaje, OpcionesFondo } from '@compartido/motor/escena';
import { eventos } from '@compartido/eventos';
import { PULSO } from '@nucleo/pulso';
import { veloDeRango } from '@nucleo/atmosfera';
import { FONDO_BASE, FONDO_RANGO_8, paletaDe } from '@nucleo/paletas';
import { ELIPSES_BASE, ELIPSES_VELO } from '@compartido/fondoDegradados';
import ElipsesDeLuz from './ElipsesDeLuz';
import { cargarElMotor, esPreferenciaFondo } from '@nucleo/fondo';
import { plataforma } from '@plataforma';
import { conAlfa } from './colores';
import { escucharFondo, type Pedido } from './pedidoDeFondo';
import { escucharDesenfoque } from './desenfoqueDelFondo';
import { ponerEstadoDelMotor } from './estadoDelMotor';

/**
 * EL FONDO DE LA APP NATIVA: el motor de cuerpos celestes detrás de todo.
 *
 * Es el MISMO motor que el de la web; esto es el marco. Tres capas, igual que
 * allá: una base de color, el `GLView` que entra con un fundido cuando el
 * motor está listo, y un velo oscuro arriba que sostiene la legibilidad.
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
 * LOS BORDES, IGUALES A LA WEB: el degradado vertical que oscurece arriba y
 * abajo (`.velo-bordes`) es lineal, y `expo-linear-gradient` lo reproduce con
 * los mismos cuatro cortes y las mismas opacidades.
 *
 * LAS ELIPSES DE LUZ DE LA BASE Y EL VELO, también iguales (18/9): los números
 * viven en `compartido/fondoDegradados.ts`, de donde los toma la web para su
 * CSS, y acá los dibuja `ElipsesDeLuz` con `react-native-svg`.
 *
 * LA SUBIDA DE RANGO NO PASA POR ACÁ (23/9). Tiene su propio `GLView` dentro
 * del modal, porque un `Modal` de iOS es otra jerarquía de vistas y este queda
 * tapado. Ver `LienzoSubida.tsx`.
 *
 * LO QUE FALTA RESPECTO DE LA WEB, a la vista:
 *
 *   - La animación del velo entre visitas (la "atmósfera" que se abre al subir
 *     de rango). Se pinta el velo del rango, quieto.
 *
 * LO QUE RESPETA IGUAL: la preferencia "Fondo: automático / siempre / nunca"
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
const DENSIDAD_TOPE = 2;
function factorDeTope() {
  return Math.min(1, DENSIDAD_TOPE / PixelRatio.get());
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
 * A PARTIR DE ACÁ EL FONDO SE CONSIDERA TAPADO. Ver el efecto más abajo.
 *
 * 0,85 Y NO 0,4, que fue el primer número: abajo de eso el cuerpo TODAVÍA SE
 * LEE como un objeto, y bajarle los cuadros ahí se puede ver —justo a mitad
 * del deslizamiento, que es el peor momento para que algo cambie de ritmo—.
 * Con 0,85 solo entran las pantallas que van al tope (Ranking, Álbum,
 * Ajustes); Stats, cuyo techo es 0,45 a pedido, se queda con todos los
 * cuadros.
 */
const TAPADO_DESDE = 0.85;

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

  /**
   * EL DESENFOQUE FUERA DE INICIO (25/9).
   *
   * *"Quiero que el planeta esté SIEMPRE, y que en las otras pestañas se vea
   * borroso. Que el desenfoque baje gradualmente mientras deslizo hacia
   * Inicio, siguiendo el dedo."*
   *
   * LO QUE HACE QUE ESTO SEA POSIBLE es el otro medio pedido: que el cuerpo
   * exista siempre. Antes las otras cuatro pestañas pedían `soloEstrellas` —
   * cielo SIN cuerpo—, que es otra escena: al volver a Inicio había que
   * construirla, y construirla es lo que se veía como "el planeta aparece de
   * la nada". Ahora las cinco piden el mismo cuerpo, la escena no se rearma
   * nunca al cambiar de pestaña, y lo único que cambia es cuánto se lo ve.
   *
   * ─────────────────────────────────────────────────────────────────────
   * EL `filter` DE REACT NATIVE NO SIRVE ACÁ, Y DEJÓ EL FONDO EN BLANCO
   *
   * Primer intento, y el peor bug del día: *"el fondo se ve todo BLANCO en
   * Ranking, Álbum y Stats"*. Era `filter: [{ blur: N }]` sobre la vista que
   * contiene el `GLView`.
   *
   * POR QUÉ NO PODÍA ANDAR. Para desenfocar, iOS tiene que RASTERIZAR la vista
   * —dibujarla en un mapa de bits y pasarle el filtro—. Una vista de OpenGL no
   * tiene su contenido en la capa: lo tiene en un framebuffer de la GPU que el
   * rasterizador no lee. Lo que sale de ahí no es el planeta borroso, es la
   * capa vacía, y encima del fondo claro del sistema eso es blanco.
   *
   * O sea que el error no fue de ajuste: era una operación imposible sobre esa
   * vista en particular. Se probó en el navegador, donde `filter` es CSS y sí
   * funciona sobre un canvas, y ahí se veía bien. La diferencia entre las dos
   * plataformas era toda la historia.
   *
   * LO QUE SE HACE AHORA son dos capas distintas, y ninguna toca el `GLView`:
   *
   *   1. **Un velo extra**, acá mismo: una vista opaca del color del fondo que
   *      sube con la distancia a Inicio. No desenfoca —empuja el planeta hacia
   *      atrás— y es lo único que se puede hacer sin código nativo.
   *   2. **Un desenfoque de verdad** encima, con `expo-blur`. `BlurView` NO
   *      rasteriza a nadie: por debajo es un `UIVisualEffectView`, o sea una
   *      vista del SISTEMA que desenfoca lo que quedó DETRÁS suyo una vez ya
   *      compuesto en pantalla — GL incluido. Es justamente el caso que
   *      `filter` no puede, y por eso el arreglo pasaba por acá y no por
   *      ajustar un número.
   *
   * LAS DOS SE QUEDAN, y no es redundancia: el velo aporta la profundidad (el
   * planeta se va hacia atrás) y el desenfoque aporta el foco (deja de ser
   * legible como objeto). Juntas, el velo va a la mitad de lo que iba cuando
   * era lo único: sumar los dos al máximo tapaba el planeta en vez de
   * desenfocarlo.
   *
   * QUE EL VELO NO SOBRE EN UNA BUILD VIEJA no hace falta cuidarlo: agregar
   * `expo-blur` mueve la huella, y una actualización publicada con ella no le
   * llega nunca a una build que no la tiene. Las dos capas viajan siempre
   * juntas.
   *
   * SE DIBUJA EN PASOS ENTEROS: ver `desenfoqueDelFondo.ts`. Un gesto manda
   * sesenta eventos por segundo y el desenfoque tiene catorce valores
   * distintos; avisar en cada píxel sería un dibujado de la raíz por cuadro
   * para no cambiar nada.
   */
  const [desenfoque, setDesenfoque] = useState(0);
  useEffect(() => escucharDesenfoque(setDesenfoque), []);

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
  const tapadoAhora = useRef(false);
  tapadoAhora.current = desenfoque >= TAPADO_DESDE;
  useEffect(() => {
    escena.current?.montaje.tapar(desenfoque >= TAPADO_DESDE);
  }, [desenfoque, listo, pedido]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [pref, r] = await Promise.all([
        plataforma.almacenamiento.leer(CLAVE_FONDO),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      ]);
      if (!vivo) return;
      setReducir(r);
      // `null` en "equipo flojo": en el teléfono no hay de dónde leerlo. La
      // regla de `nucleo/fondo.ts` es que no saber NO es flojo.
      const hayQue = cargarElMotor(esPreferenciaFondo(pref) ? pref : 'auto', null);
      setCargar(hayQue);
      // Para Diagnóstico: ver `estadoDelMotor.ts`. Acá ya se sabe si se va a
      // intentar; si no, el motivo es la preferencia y no hay nada más que
      // esperar.
      ponerEstadoDelMotor(hayQue ? 'arrancando' : 'apagado');
    })();
    return () => {
      vivo = false;
    };
  }, []);

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
      actual.montaje.mover(pedido.esquina ?? 'abajo-derecha');
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
          { ...pedido, animar }
        );
        const vieja = escena.current;
        m?.tapar(tapadoAhora.current);
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
  }, [pedido, listo, reducir, opacidad]);

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
  const fondo = op.rango === 8 ? FONDO_RANGO_8 : FONDO_BASE;
  const paleta = paletaDe(op.rango, op.planeta);
  // Prioridad igual que en la web —lo que pidió la pantalla, después lo que
  // dice el rango, después el valor fijo—, menos el velo animado entre visitas.
  const velo = op.velo ?? (op.atmosfera ? veloDeRango(op.rango) : op.rango >= 5 ? 0.62 : 0.5);

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: fondo, opacity: pedido ? 1 : 0 }]}
      pointerEvents="none"
      onLayout={alMedir}
    >
      {medida && (
        <ElipsesDeLuz elipses={ELIPSES_BASE} paleta={paleta} ancho={medida.w} alto={medida.h} estrellas id="base" />
      )}
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
      {/* EL VELO EXTRA DE LAS OTRAS PESTAÑAS. Va ENTRE el motor y el velo del
          rango, así que empuja el planeta hacia atrás sin tocar nada de lo que
          se lee encima. `pointerEvents` no hace falta: el fondo entero ya es
          `none`. */}
      {desenfoque > 0 && (
        <>
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: fondo, opacity: desenfoque * 0.2 }]}
          />
          {/* EL DESENFOQUE DE VERDAD. Va acá arriba y no más abajo porque
              desenfoca lo que tiene DETRÁS: el motor, la base y las elipses.
              El velo del rango y los bordes quedan encima suyo, nítidos, que
              es lo que hay que hacer — son lo que sostiene la legibilidad del
              texto y desenfocarlos no ayudaría a nada.

              SOLO SE MONTA CUANDO HACE FALTA. Un `UIVisualEffectView` no es
              gratis ni con intensidad cero: el sistema le sigue componiendo
              el fondo cada cuadro. En Inicio, que es donde el planeta importa,
              no existe. */}
          <BlurView
            style={StyleSheet.absoluteFill}
            tint="dark"
            intensity={Math.round(desenfoque * 42)}
            pointerEvents="none"
          />
        </>
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fondo, opacity: velo }]}>
        {medida && <ElipsesDeLuz elipses={ELIPSES_VELO} paleta={paleta} ancho={medida.w} alto={medida.h} id="velo" />}
      </View>
      {/* LOS BORDES, lo que sostiene la legibilidad cuando el velo se abre: el
          mismo `.velo-bordes` de la web —fondo al 80 % arriba, nada del 26 % al
          86 %, fondo al 88 % abajo—. Los extremos transparentes son el fondo
          con alfa 0 y no `transparent`: CSS mezcla premultiplicado y acá no,
          y hacia negro transparente el degradado ensuciaría el color. */}
      <LinearGradient
        style={StyleSheet.absoluteFill}
        colors={[conAlfa(fondo, 0.8), conAlfa(fondo, 0), conAlfa(fondo, 0), conAlfa(fondo, 0.88)]}
        locations={[0, 0.26, 0.86, 1]}
      />
    </View>
  );
}
