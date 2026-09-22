import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import FondoRaiz from './FondoRaiz';
import { eventos } from '@compartido/eventos';
import { IR_A_PESTANA, type Pestana } from './irAPestana';

/**
 * LA BARRA DE ABAJO, con las pantallas que ya existen en nativo.
 *
 * LAS QUE YA EXISTEN, NI UNA MÁS. Una pestaña que abre "próximamente" es un
 * botón que miente en el lugar más tocado de la app. Cada pantalla entra
 * cuando entra, en el mismo orden que la web (Ranking y Álbum desde el 18/9).
 *
 * TODAVÍA SIN ROUTER, y ahora es una decisión más fina que antes: con
 * pestañas planas, sin pantallas apiladas ni enlaces que abran una pantalla
 * del medio, un router contesta lo mismo que este `useState`. La pregunta se
 * vuelve de verdad con la primera pantalla que se apila (el perfil de un
 * amigo, el día abierto) — ahí entra Expo Router, y esto se reemplaza entero.
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
 * SOLO QUEDA MONTADA LA ACTIVA cuando el gesto termina: volver a Inicio lo
 * vuelve a cargar. Es lo que hacía "volver de Ajustes" antes, y por la misma
 * razón: cambiar los días de descanso cambia qué días cortan la racha.
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
  const { width: ancho } = useWindowDimensions();
  const correr = useRef(new Animated.Value(0)).current;
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
            // La pestaña nueva se pone recién cuando el viaje terminó, y en el
            // mismo cuadro se vuelve el carril a cero: así no se ve saltar.
            if (viaja && destino) setPestana(destino);
            correr.setValue(0);
            setAsomando(null);
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

  // De qué lado asoma: si el dedo va a la izquierda, la de al lado entra por
  // la derecha.
  const ladoDelAsomo = asomando ? (ORDEN.indexOf(asomando) > ORDEN.indexOf(pestana) ? 1 : -1) : 0;

  return (
    // CADA TOQUE DESPIERTA AL MOTOR. En la web lo escucha el `window`; acá no
    // hay `window`, y los toques los ve la vista que los recibe. `onTouchStart`
    // en la raíz los ve todos —sube desde cualquier hijo— sin quitárselos a
    // nadie. Ver `despertarMotor.ts`.
    <View style={estilos.todo} onTouchStart={despertarMotor}>
      <View style={estilos.pantalla} {...pan.panHandlers}>
        {/* EL MOTOR VIVE ACÁ y no adentro de Inicio: un solo contexto de GL
            para toda la sesión. Inicio lo pide; las otras pestañas no, y
            mientras tanto la escena queda guardada en pausa. Ocupa el área de
            las pantallas, no la de la barra. Y NO SE MUEVE con el gesto: el
            fondo es de todas las pantallas, no de una. Ver `FondoRaiz.tsx`. */}
        <FondoRaiz />
        <Animated.View style={[estilos.carril, { width: ancho }, { transform: [{ translateX: correr }] }]}>
          {dibujar(pestana)}
        </Animated.View>
        {asomando && (
          <Animated.View
            // Pegada al borde que le toca y viajando con el mismo dedo.
            style={[
              estilos.carril,
              { left: ladoDelAsomo * ancho, width: ancho },
              { transform: [{ translateX: correr }] },
            ]}
            // Mientras asoma es para mirar, no para tocar: un toque que entre
            // ahí sería en una pantalla que todavía no es la que está.
            pointerEvents="none"
          >
            {dibujar(asomando)}
          </Animated.View>
        )}
      </View>

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
  todo: { flex: 1, backgroundColor: '#05060a' },
  pantalla: { flex: 1, overflow: 'hidden' },
  // ABSOLUTO CON ANCHO PROPIO y no `absoluteFill`: ese pone `right: 0`, y con
  // un `left` de una pantalla entera la de al lado quedaba de ancho cero. Se
  // veía el fondo del motor en vez de la pantalla que asoma (visto a :8092).
  carril: { position: 'absolute', top: 0, bottom: 0, left: 0 },
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
