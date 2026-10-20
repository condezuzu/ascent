import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Estrella from './Estrella';
import { C } from './colores';

export type EstadoDelDia = 'lleno' | 'vacio' | 'descanso' | 'futuro' | 'cubierto' | 'sinDato';

/** El frío del día que salvó una vida: congelado el día que se usó, derritiéndose al siguiente. */
export type FrioDelDia = 'helado' | 'derrite' | null;

/**
 * EL CÍRCULO DE UN DÍA DE LA TIRA. Lo dibujan la semana de Inicio y el aviso de la vida.
 * `sinDato` es un día que la pantalla no trae (más viejo que la semana cargada): se ve
 * como uno que no pasó, para no inventarle un estado.
 *
 * EL DÍA QUE SALVÓ UNA VIDA (19/10, aprobado en la galería): la estrella de la vida queda
 * plantada adentro. El día que se usa está congelada —frío, un brillo y cristales que
 * titilan derechos, sin girar— y al día siguiente se derrite una vez y queda la estrella.
 */
const CRISTALES = [
  { left: -9, top: -7 },
  { left: 26, top: -6 },
  { left: -8, top: 23 },
  { left: 27, top: 22 },
];

export default function PuntoDelDia({ estado, esHoy, frio = null }: { estado: EstadoDelDia; esHoy: boolean; frio?: FrioDelDia }) {
  const titila = useRef(new Animated.Value(0)).current;
  const derrite = useRef(new Animated.Value(frio === 'derrite' ? 0 : 1)).current;

  useEffect(() => {
    if (frio !== 'helado') return;
    const vuelta = Animated.loop(
      Animated.sequence([
        Animated.timing(titila, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(titila, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    vuelta.start();
    return () => vuelta.stop();
  }, [frio, titila]);

  useEffect(() => {
    if (frio !== 'derrite') return;
    derrite.setValue(0);
    Animated.timing(derrite, { toValue: 1, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
  }, [frio, derrite]);

  const cubierto = estado === 'cubierto';
  return (
    <View
      style={[
        estilos.punto,
        estado === 'lleno' && estilos.lleno,
        estado === 'vacio' && estilos.vacio,
        (estado === 'futuro' || estado === 'sinDato') && estilos.futuro,
        estado === 'descanso' && estilos.vacio,
        cubierto && estilos.cubierto,
        cubierto && frio === 'helado' && estilos.helado,
        esHoy && estilos.puntoHoy,
      ]}
    >
      {estado === 'descanso' && <View style={estilos.guion} />}
      {cubierto && <Estrella tam={13} modo={frio === 'helado' ? 'hielo' : 'luz'} />}
      {cubierto && frio === 'helado' &&
        CRISTALES.map((c, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              estilos.cristal,
              c,
              { opacity: titila.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [1, 0.6] : [0.6, 1] }), transform: [{ scale: titila.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [1.15, 0.95] : [0.95, 1.15] }) }] },
            ]}
          >
            <Estrella tam={8} modo="hielo" />
          </Animated.View>
        ))}
      {cubierto && frio === 'derrite' && (
        <>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, estilos.hieloQueSeVa, { opacity: derrite.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} />
          {[6, 13, 20].map((x, i) => (
            <Animated.View
              key={x}
              pointerEvents="none"
              style={[
                estilos.gota,
                { left: x, opacity: derrite.interpolate({ inputRange: [0, 0.15 + i * 0.1, 1], outputRange: [0, 1, 0] }), transform: [{ translateY: derrite.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }) }] },
              ]}
            />
          ))}
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  punto: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lleno: { backgroundColor: '#7e8ca8' },
  vacio: { borderWidth: 1, borderColor: '#2a3040' },
  futuro: { borderWidth: 1, borderColor: '#171c26' },
  puntoHoy: { borderWidth: 1, borderColor: '#c4c2ba' },
  guion: { width: 10, height: 2, borderRadius: 1, backgroundColor: '#4a5163' },
  cubierto: { borderWidth: 1, borderColor: C.claro },
  helado: { borderColor: '#bfe0fb', shadowColor: C.hielo, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  cristal: { position: 'absolute' },
  hieloQueSeVa: { borderRadius: 13, borderWidth: 1, borderColor: '#bfe0fb', backgroundColor: 'rgba(143,196,240,0.18)' },
  gota: { position: 'absolute', top: 22, width: 4, height: 6, borderRadius: 3, backgroundColor: C.hielo },
});
