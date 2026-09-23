import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { supabase } from './supabase';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { cambiaDePestana, CURVA, VIAJE_MS, vecina } from '@nucleo/deslizar';
import Inicio from './Inicio';
import Stats from './Stats';
import Ranking from './Ranking';
import Album from './Album';
import Ajustes from './Ajustes';
import { despertarMotor } from './despertarMotor';
import { eventos } from '@compartido/eventos';
import { IR_A_PESTANA, PESTANA_ACTIVA, type Pestana } from './irAPestana';
import Recorrido from './Recorrido';

/**
 * LA BARRA DE ABAJO, con las pantallas que ya existen en nativo.
 *
 * LAS QUE YA EXISTEN, NI UNA MÁS. Una pestaña que abre "próximamente" es un
 * botón que miente en el lugar más tocado de la app. Cada pantalla entra
 * cuando entra, en el mismo orden que la web (Ranking y Álbum desde el 18/9).
 *
 * LAS PESTAÑAS SIGUEN SIENDO UN `useState` Y EL ROUTER VIVE AFUERA (22/9).
 * Expo Router entró para lo que las pestañas no podían: apilar el perfil
 * encima y volver. Una ruta por pestaña obligaría a montar y tumbar el motor
 * en cada cambio y a reescribir el asomo del gesto con otra biblioteca, para
 * conseguir lo mismo que ya funciona.
 *
 * SE DESLIZA ENTRE PESTAÑAS (22/9), como en la web. Las reglas del gesto
 * —cuánto hay que arrastrar, qué velocidad alcanza, cuánto dura el viaje— son
 * las MISMAS y salen de `nucleo/deslizar.ts`: un gesto que pide un quinto de
 * la pantalla en la web y la mitad en el teléfono no es la misma app.
 *
 * LA DE AL LADO SE MONTA DE VERDAD MIENTRAS SE ARRASTRA, y ahí esto se separa
 * de la web: allá entra una copia congelada del DOM porque la pantalla ya
 * estuvo dibujada alguna vez y clonarla es gratis. Acá no hay copia que
 * clonar, así que asoma la pantalla real. Cuesta lo que cuesta abrirla —la
 * misma consulta que si se tocara la pestaña— y por eso no se monta con el
 * primer píxel: recién cuando el gesto se decidió que es horizontal.
 *
 * CADA PESTAÑA SE MONTA UNA VEZ Y SE QUEDA (23/9). Antes solo quedaba la
 * activa, y volver a una la cargaba de cero — que además de costar una
 * consulta era el TITILEO: la pantalla de destino ya estaba montada y
 * cargada en el carril que asomaba, y al soltar el gesto se tiraba para
 * montarla de nuevo, vacía. Ver `montadas`.
 *
 * Lo que se perdió al arreglarlo —que cada vuelta recargara los datos— se
 * paga a mano con `PESTANA_ACTIVA`: sin eso, sumás una foto en Inicio, vas
 * al Álbum, y no está.
 */

const ORDEN: Pestana[] = ['inicio', 'ranking', 'album', 'stats', 'ajustes'];

// Cuánto tiene que moverse el dedo para que esto sea un arrastre horizontal y
// no el scroll de la pantalla. La comparación contra el movimiento vertical es
// lo que decide: adentro de cada pantalla hay un ScrollView, y robarle el
// gesto por un temblor de la mano hace que la app se sienta trabada.
const DECIDE_PX = 14;

export default function Pestanas({
  alSalir,
  alFaltarNombre,
}: {
  alSalir: () => void;
  alFaltarNombre: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  /** La de al lado, mientras el dedo está abajo. `null` = no se está arrastrando. */
  const [asomando, setAsomando] = useState<Pestana | null>(null);
  /**
   * LAS QUE YA SE ABRIERON ALGUNA VEZ, y la razón de que exista este estado
   * es EL TITILEO (23/9, segundo intento).
   *
   * QUÉ PASABA. Cada carril dibujaba `dibujar(cual)`, o sea un elemento
   * NUEVO. Al soltar el gesto, la pantalla de destino estaba montada y
   * cargada en el carril que asomaba... y `setPestana` la volvía a crear
   * desde cero en el carril principal, mientras la instancia buena se
   * desmontaba. O sea: llegabas a Álbum cargado y la app lo tiraba y lo
   * montaba de nuevo, vacío, pidiendo sus datos otra vez. Eso es el
   * parpadeo, y por eso el arreglo anterior —mover el centrado a
   * `useLayoutEffect`— no alcanzó: arreglaba CUÁNDO se centra el carril, y
   * el problema no era el carril, era que la pantalla se remontaba.
   *
   * AHORA CADA PESTAÑA SE MONTA UNA VEZ Y SE QUEDA. Se colocan por su
   * distancia a la activa, así que al cambiar de pestaña los desplazamientos
   * se recalculan y el carril vuelve a cero en el mismo dibujo: la de
   * destino ya estaba en su lugar y no se mueve ni un píxel.
   *
   * SOLO LAS VISITADAS, no las cinco: montar las cinco al abrir la app
   * costaría cinco pantallas pidiendo sus datos en el arranque, que es el
   * momento en que más se nota.
   */
  const [montadas, setMontadas] = useState<Pestana[]>(['inicio']);
  const { width: ancho } = useWindowDimensions();
  const correr = useRef(new Animated.Value(0)).current;
  /** Hay un carril corrido esperando a que la pestaña nueva se dibuje. */
  const centrarDespues = useRef(false);
  // El gesto se lee con refs y no con estado: el estado llega un cuadro tarde,
  // y un cuadro tarde en un dedo que se mueve se ve como un tirón.
  const gesto = useRef<{ decidido: boolean; vecina: Pestana | null; desde: number; x0: number }>({
    decidido: false,
    vecina: null,
    desde: 0,
    x0: 0,
  });

  // Ajustes necesita el perfil entero; se pide al entrar, no antes: Inicio ya
  // lo pide para lo suyo, y pedirlo dos veces al abrir la app es un viaje más
  // en el momento en que más se nota. También se pide cuando Ajustes es la que
  // asoma: si no, la primera mitad del gesto muestra una ruedita.
  const cargarPerfil = useCallback(async () => {
    const { data: sesion } = await supabase.auth.getSession();
    const uid = sesion.session?.user?.id;
    if (!uid) return alSalir();
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (data) setPerfil(data as Perfil);
  }, [alSalir]);

  useEffect(() => {
    if (pestana === 'ajustes' || asomando === 'ajustes') cargarPerfil();
  }, [pestana, asomando, cargarPerfil]);

  // AL VOLVER A UNA PESTAÑA, QUE PIDA SUS DATOS DE NUEVO. Antes lo hacía
  // sola porque se remontaba entera —que era el titileo—; ahora que se
  // queda montada, hay que avisarle. Ver `useRecargarAlVolver`.
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    eventos.emitir(PESTANA_ACTIVA, pestana);
  }, [pestana]);

  // La que se abre —o la que asoma— pasa a estar montada para siempre.
  useEffect(() => {
    setMontadas((m) => {
      const faltan = [pestana, asomando].filter((x): x is Pestana => !!x && !m.includes(x));
      return faltan.length ? [...m, ...faltan] : m;
    });
  }, [pestana, asomando]);

  // CENTRAR DESPUÉS DE DIBUJAR, no antes: ver el comentario del final del
  // viaje. `useLayoutEffect` corre con la pantalla nueva ya montada y antes de
  // que se pinte, así que el carril nunca se ve centrado con la vieja adentro.
  useLayoutEffect(() => {
    if (!centrarDespues.current) return;
    centrarDespues.current = false;
    correr.setValue(0);
    setAsomando(null);
  }, [pestana, correr]);

  // "Ir a Ajustes" desde el texto de otra pantalla: ver `irAPestana.ts`.
  useEffect(() => eventos.escuchar(IR_A_PESTANA, (p) => setPestana(p as Pestana)), []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // No se pide el gesto al tocar: un toque tiene que llegar al botón que
        // se tocó. Se pide recién al MOVERSE, y solo si el movimiento es
        // claramente horizontal.
        onMoveShouldSetPanResponder: (_e, g) => {
          if (Math.abs(g.dx) < DECIDE_PX || Math.abs(g.dx) < Math.abs(g.dy) * 1.5) return false;
          return vecina(ORDEN.indexOf(pestana), g.dx, ORDEN.length) !== null;
        },
        onPanResponderGrant: (_e, g) => {
          const destino = vecina(ORDEN.indexOf(pestana), g.dx, ORDEN.length);
          gesto.current = { decidido: true, vecina: destino === null ? null : ORDEN[destino], desde: Date.now(), x0: g.dx };
          setAsomando(destino === null ? null : ORDEN[destino]);
        },
        onPanResponderMove: (_e, g) => {
          if (!gesto.current.decidido) return;
          // Si el dedo cambia de lado a mitad del gesto, cambia la que asoma.
          const destino = vecina(ORDEN.indexOf(pestana), g.dx, ORDEN.length);
          const cual = destino === null ? null : ORDEN[destino];
          if (cual !== gesto.current.vecina) {
            gesto.current.vecina = cual;
            setAsomando(cual);
          }
          correr.setValue(cual === null ? g.dx * 0.25 : g.dx);
        },
        onPanResponderRelease: (_e, g) => {
          const destino = gesto.current.vecina;
          const ms = Math.max(1, Date.now() - gesto.current.desde);
          const viaja = destino !== null && cambiaDePestana(g.dx, ancho, g.dx / ms);
          Animated.timing(correr, {
            toValue: viaja ? Math.sign(g.dx) * ancho : 0,
            duration: VIAJE_MS,
            easing: Easing.bezier(...CURVA),
            useNativeDriver: true,
          }).start(() => {
            // EL TITILEO QUE ESTO ARREGLA (23/9). Acá se hacían las tres cosas
            // juntas: poner la pestaña nueva, volver el carril a cero y sacar
            // la que asomaba. Parecen simultáneas y no lo son — `setValue`
            // mueve la vista EN EL ACTO, y `setPestana` recién en el próximo
            // dibujo de React. En ese hueco de un cuadro, el carril ya estaba
            // centrado pero todavía mostraba la pestaña VIEJA: al pasar de
            // Inicio a Ranking, Inicio volvía a aparecer un instante.
            //
            // Ahora el viaje solo cambia la pestaña. Centrar el carril y sacar
            // la que asoma pasó a `useLayoutEffect`, que corre DESPUÉS de que
            // la pantalla nueva está dibujada y antes de que se pinte.
            if (viaja && destino) {
              centrarDespues.current = true;
              setPestana(destino);
            } else {
              correr.setValue(0);
              setAsomando(null);
            }
          });
          gesto.current = { decidido: false, vecina: null, desde: 0, x0: 0 };
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [pestana, ancho, correr]
  );

  const dibujar = (cual: Pestana) => {
    if (cual === 'inicio') return <Inicio alSalir={alSalir} alFaltarNombre={alFaltarNombre} />;
    if (cual === 'ranking') return <Ranking alSalir={alSalir} />;
    if (cual === 'album') return <Album alSalir={alSalir} />;
    if (cual === 'stats') return <Stats alSalir={alSalir} />;
    return perfil ? (
      <Ajustes perfil={perfil} alCambiar={(parcial) => setPerfil((p) => (p ? { ...p, ...parcial } : p))} alSalir={alSalir} />
    ) : (
      <View style={estilos.centrado}>
        <ActivityIndicator color="#8a93a8" />
      </View>
    );
  };

  return (
    // CADA TOQUE DESPIERTA AL MOTOR. En la web lo escucha el `window`; acá no
    // hay `window`, y los toques los ve la vista que los recibe. `onTouchStart`
    // en la raíz los ve todos —sube desde cualquier hijo— sin quitárselos a
    // nadie. Ver `despertarMotor.ts`.
    <View style={estilos.todo} onTouchStart={despertarMotor}>
      <View style={estilos.pantalla} {...pan.panHandlers}>
        {/* EL MOTOR YA NO VIVE ACÁ (22/9): subió a `app/_layout.tsx`, detrás
            del stack entero. Estaba adentro de las pestañas desde que era lo
            único que había, y con el perfil apilado encima quedaba tapado: se
            entraba a `/yo` y el planeta desaparecía, cuando en la web está.
            Sigue siendo UN solo contexto de GL para toda la sesión; lo que
            cambió es de qué está detrás. */}
        {/* UN CARRIL POR PESTAÑA VISITADA, colocado por su distancia a la
            activa. Ninguna se desmonta al cambiar de pestaña: ese remonte era
            el titileo. Ver `montadas`. */}
        {montadas.map((cual) => {
          const lejos = ORDEN.indexOf(cual) - ORDEN.indexOf(pestana);
          const aLaVista = cual === pestana || cual === asomando;
          return (
            <Animated.View
              key={cual}
              // Para la sonda del titileo: lo que hay que poder comprobar es que
              // este nodo sea EL MISMO despues de cambiar de pestaña, porque
              // eso es lo que significa que no se remonto.
              testID={'carril-' + cual}
              style={[
                estilos.carril,
                { left: lejos * ancho, width: ancho },
                { transform: [{ translateX: correr }] },
                // LAS QUE NO SE VEN SE ESCONDEN, NO SE DESMONTAN: `display`
                // conserva el componente y su estado, y le ahorra al motor
                // dibujar cuatro pantallas que están fuera de la ventana.
                !aLaVista && estilos.escondida,
              ]}
              // La que asoma es para mirar, no para tocar: un toque ahí sería
              // en una pantalla que todavía no es la que está.
              pointerEvents={cual === pestana ? 'auto' : 'none'}
            >
              {dibujar(cual)}
            </Animated.View>
          );
        })}
      </View>

      {/* EL RECORRIDO DE LA PRIMERA VEZ (§10), encima de la barra. Va acá y no
          adentro de cada pantalla porque la barra está en las cinco del
          recorrido: puesto una vez, aparece donde tiene que aparecer. No
          dibuja nada si no hay recorrido andando. */}
      <Recorrido pestana={pestana} />

      <View style={estilos.barra} accessibilityRole="tablist">
        {/* El orden de la web: Inicio, Ranking, Álbum, Stats, Ajustes. */}
        {ORDEN.map((p) => (
          <Pressable
            key={p}
            style={estilos.boton}
            onPress={() => setPestana(p)}
            accessibilityRole="tab"
            accessibilityState={{ selected: pestana === p }}
          >
            <Text style={[estilos.texto, pestana === p && estilos.activo]}>{T.nav[p]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // SIN FONDO PROPIO: el motor vive en la raíz del router, detrás de todo, y
  // pintar acá lo taparía. Ver .
  todo: { flex: 1 },
  pantalla: { flex: 1, overflow: 'hidden' },
  // ABSOLUTO CON ANCHO PROPIO y no `absoluteFill`: ese pone `right: 0`, y con
  // un `left` de una pantalla entera la de al lado quedaba de ancho cero. Se
  // veía el fondo del motor en vez de la pantalla que asoma (visto a :8092).
  carril: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  escondida: { display: 'none' },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barra: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1d2230',
    paddingBottom: 22,
    paddingTop: 10,
    backgroundColor: '#05060a',
  },
  boton: { flex: 1, alignItems: 'center', paddingVertical: 6, minHeight: 44, justifyContent: 'center' },
  texto: { color: '#4a5163', fontSize: 12, letterSpacing: 0.5 },
  activo: { color: '#e8ecf6' },
});
