import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { T } from '@nucleo/textos';
import { C, conTema } from './colores';
import Estrella from './Estrella';
import { compartirInvitacion } from './InvitarConLink';
import { LLEGA, sinMovimiento } from './movimiento';
import { Text } from './Texto';
import Tocable from './Tocable';
import { useTema } from './useTema';

const ESTRELLA = 64;
const EN_LA_FILA = 20;
const ALTO_CIELO = 240;

// El viaje, en milisegundos: sube al buscador, lo abre de punta a punta y baja hasta el renglón de invitar.
const SUBE_MS = 420;
const ABRE_MS = 460;
const BAJA_MS = 520;

/**
 * SOCIAL SIN AMIGOS: LA ESTRELLA GUÍA (2/11, a pedido; reemplaza a la constelación del 31/10). La
 * estrella es un botón, y que se note: late, tiene su aro y dice qué hace. Al tocarla sube, abre el
 * buscador pasando por encima y termina al lado de «Invítalos con un link»: si no lo encontrás,
 * invitalo. Hasta tocarla, el buscador y el renglón guardan su lugar sin verse, así nada salta.
 *
 * El buscador y lo que encuentra los pone Ranking, que es quien busca. No toca datos.
 */
export default function SocialVacio({
  usuario,
  buscador,
  resultados,
  alAbrir,
  yaAbierto = false,
}: {
  /** Sin nombre todavía no hay link que dar: no hay renglón. */
  usuario: string | null | undefined;
  buscador: ReactNode;
  resultados: ReactNode;
  /** Cuando el buscador ya se abrió: es el momento de pedirle el foco. */
  alAbrir: () => void;
  /** Ya hay algo escrito: no hace falta que lo abra la estrella. */
  yaAbierto?: boolean;
}) {
  useTema();
  const [estado, setEstado] = useState<'quieta' | 'viajando' | 'llego'>(yaAbierto ? 'llego' : 'quieta');
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const escala = useRef(new Animated.Value(1)).current;
  const abre = useRef(new Animated.Value(yaAbierto ? 1 : 0)).current;
  const fila = useRef(new Animated.Value(yaAbierto ? 1 : 0)).current;
  const cielo = useRef(new Animated.Value(yaAbierto ? 0 : 1)).current;
  const latido = useRef(new Animated.Value(0)).current;
  const lugares = useRef({ barra: { y: 0, alto: 0, ancho: 0 }, ranura: { x: 0, y: 0 }, fila: { y: 0 }, boton: { y: 0 } });
  const medir = (quien: 'barra' | 'fila' | 'boton') => (e: LayoutChangeEvent) => {
    const l = e.nativeEvent.layout;
    if (quien === 'barra') lugares.current.barra = { y: l.y, alto: l.height, ancho: l.width };
    else if (quien === 'fila') lugares.current.fila = { y: l.y + l.height / 2 };
    else lugares.current.boton = { y: l.y };
  };

  // El latido: es lo que dice que se toca. Se apaga al tocarla, y con «reducir movimiento» no está.
  useEffect(() => {
    if (estado !== 'quieta') return;
    let vuelta: Animated.CompositeAnimation | null = null;
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo || quieto) return;
      vuelta = Animated.loop(
        Animated.sequence([
          Animated.timing(latido, { toValue: 1, duration: 1500, easing: LLEGA, useNativeDriver: true }),
          Animated.delay(700),
          Animated.timing(latido, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
      vuelta.start();
    });
    return () => {
      vivo = false;
      vuelta?.stop();
    };
  }, [estado, latido]);

  const tocar = async () => {
    if (estado !== 'quieta') return;
    const quieto = await sinMovimiento();
    const hayFila = !!usuario;
    if (quieto) {
      abre.setValue(1);
      fila.setValue(1);
      cielo.setValue(0);
      setEstado('llego');
      alAbrir();
      return;
    }
    const { barra, fila: enFila, boton } = lugares.current;
    const yBarra = barra.y + barra.alto - 1;
    // De dónde sale: la mitad del botón, que es donde se la ve.
    const desde = { x: barra.ancho / 2, y: boton.y + ALTO_BOTON / 2 };
    x.setValue(desde.x);
    y.setValue(desde.y);
    setEstado('viajando');
    const ir = (a: { x: number; y: number; escala: number }, ms: number, curvaX = LLEGA, curvaY = LLEGA) =>
      Animated.parallel([
        Animated.timing(x, { toValue: a.x, duration: ms, easing: curvaX, useNativeDriver: true }),
        Animated.timing(y, { toValue: a.y, duration: ms, easing: curvaY, useNativeDriver: true }),
        Animated.timing(escala, { toValue: a.escala, duration: ms, easing: LLEGA, useNativeDriver: true }),
      ]);
    // El alto del cielo, por JS: un alto no va por el motor nativo.
    Animated.timing(cielo, { toValue: 0, duration: SUBE_MS + ABRE_MS, easing: LLEGA, useNativeDriver: false }).start();
    Animated.sequence([
      Animated.timing(escala, { toValue: 1.14, duration: 110, easing: LLEGA, useNativeDriver: true }),
      ir({ x: PUNTA, y: yBarra, escala: 0.42 }, SUBE_MS, Easing.bezier(0.5, 0, 0.2, 1), Easing.bezier(0.2, 0.7, 0.2, 1)),
      // La estrella corre por el renglón y lo va abriendo atrás suyo.
      Animated.parallel([
        ir({ x: barra.ancho - PUNTA, y: yBarra, escala: 0.42 }, ABRE_MS, Easing.bezier(0.4, 0, 0.3, 1)),
        Animated.timing(abre, { toValue: 1, duration: ABRE_MS, easing: Easing.bezier(0.4, 0, 0.3, 1), useNativeDriver: false }),
      ]),
    ]).start(() => {
      alAbrir();
      if (!hayFila) {
        Animated.timing(escala, { toValue: 0, duration: 220, easing: LLEGA, useNativeDriver: true }).start(() => setEstado('llego'));
        return;
      }
      // Vuelve por abajo, en curva, hasta su lugar al lado del renglón.
      Animated.parallel([
        ir({ x: PUNTA, y: enFila.y, escala: EN_LA_FILA / ESTRELLA }, BAJA_MS, Easing.bezier(0.45, 0, 0.2, 1), Easing.bezier(0.1, 0.8, 0.3, 1)),
        Animated.timing(fila, { toValue: 1, duration: 300, delay: BAJA_MS - 300, easing: LLEGA, useNativeDriver: true }),
      ]).start(() => setEstado('llego'));
    });
  };

  const llego = estado === 'llego';
  return (
    <View testID="social-vacio" style={estilos.todo}>
      <Animated.View onLayout={medir('barra')} style={[estilos.lugarBarra, { opacity: abre.interpolate({ inputRange: [0, 0.04], outputRange: [0, 1], extrapolate: 'clamp' }) }]} pointerEvents={estado === 'quieta' ? 'none' : 'auto'}>
        {/* Se abre recortando, sin estirar nada: el texto de adentro ya está en su lugar. */}
        <Animated.View style={[estilos.recorte, { width: abre.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
          <View style={{ width: lugares.current.barra.ancho || '100%' }}>{buscador}</View>
        </Animated.View>
      </Animated.View>

      {llego && resultados}

      {!!usuario && (
        <Animated.View
          onLayout={medir('fila')}
          style={[estilos.lugarFila, { opacity: fila, transform: [{ translateX: fila.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}
          pointerEvents={llego ? 'auto' : 'none'}
        >
          <Tocable testID="social-invitar" style={estilos.fila} onPress={() => compartirInvitacion(usuario)} accessibilityRole="button" accessibilityLabel={T.social.vacioInvitar}>
            <View style={estilos.ranura}>{llego && <Estrella tam={EN_LA_FILA} modo="luz" />}</View>
            <View style={estilos.subrayado}>
              <Text style={estilos.invitar}>{T.social.vacioInvitar}</Text>
            </View>
          </Tocable>
        </Animated.View>
      )}

      <Animated.View onLayout={medir('boton')} style={[estilos.cielo, { height: cielo.interpolate({ inputRange: [0, 1], outputRange: [0, ALTO_CIELO] }), opacity: cielo }]}>
        {estado === 'quieta' && (
          <Tocable testID="social-estrella" hundir={0.92} style={estilos.boton} onPress={() => void tocar()} accessibilityRole="button" accessibilityLabel={T.social.vacioBoton}>
            <View style={estilos.conAro}>
              <Animated.View
                pointerEvents="none"
                style={[estilos.onda, { opacity: latido.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }), transform: [{ scale: latido.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.42] }) }] }]}
              />
              <View style={estilos.aro} />
              <Estrella tam={ESTRELLA} modo="luz" />
            </View>
            <Text style={estilos.etiqueta}>{T.social.vacioBoton}</Text>
          </Tocable>
        )}
      </Animated.View>

      {estado === 'viajando' && (
        <Animated.View pointerEvents="none" style={[estilos.viajera, { transform: [{ translateX: Animated.subtract(x, ESTRELLA / 2) }, { translateY: Animated.subtract(y, ESTRELLA / 2) }, { scale: escala }] }]}>
          <Estrella tam={ESTRELLA} modo="luz" />
        </Animated.View>
      )}
    </View>
  );
}

// Lo que ocupa el botón, de arriba abajo: el aro y la etiqueta.
const ARO = 104;
const ALTO_BOTON = ARO;
// Por dónde pasa la estrella en los extremos del renglón.
const PUNTA = 10;

const estilos = conTema(() => StyleSheet.create({
  todo: {},
  lugarBarra: { minHeight: 46 },
  recorte: { overflow: 'hidden' },
  lugarFila: { marginTop: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', paddingVertical: 6 },
  ranura: { width: EN_LA_FILA, height: EN_LA_FILA },
  subrayado: { borderBottomWidth: 1, borderBottomColor: C.claro, paddingBottom: 2 },
  invitar: { color: C.claro, fontSize: 14 },
  cielo: { overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-start' },
  boton: { alignItems: 'center', gap: 14, paddingTop: 22 },
  conAro: { width: ARO, height: ARO, alignItems: 'center', justifyContent: 'center' },
  aro: { position: 'absolute', width: ARO, height: ARO, borderRadius: ARO / 2, borderWidth: 1, borderColor: C.lineaFuerte, backgroundColor: C.fondoMeta },
  onda: { position: 'absolute', width: ARO, height: ARO, borderRadius: ARO / 2, borderWidth: 1, borderColor: C.claro },
  etiqueta: { color: C.tinta, fontSize: 16, fontWeight: '500' },
  viajera: { position: 'absolute', left: 0, top: 0, width: ESTRELLA, height: ESTRELLA },
}));
