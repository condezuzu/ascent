import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import { C, conAlfa } from './colores';

/**
 * LOS PASOS DE HOY, CON BARRA (5.1).
 *
 * Antes era un renglón "10.110 de 10.000 pasos": el "de" y el número de la meta
 * pegados hacían que llegar y no llegar se leyeran casi igual. Ahora el número
 * grande es lo tuyo (sin "de"), la meta va chica al costado, y una barra muestra
 * el avance de un vistazo. Al LLEGAR la barra se llena del color del rango, la
 * meta pasa a un ✓ y hay un latido corto: el momento tiene que NOTARSE, que era
 * justo lo que faltaba.
 *
 * El color de acento sale del rango (lo pasa Inicio): el logro se siente parte
 * del mismo mundo que el planeta del fondo, no un verde de sistema.
 */
export default function PasosInicio({ pasos, meta, acento }: { pasos: number; meta: number; acento: string }) {
  const llego = meta > 0 && pasos >= meta;
  const pct = meta > 0 ? Math.min(1, pasos / meta) : 0;

  const avance = useRef(new Animated.Value(0)).current; // 0..1 del ancho de la barra
  const latido = useRef(new Animated.Value(0)).current; // 0..1 del brillo al llegar
  const llegoAntes = useRef(llego);

  // La barra crece hasta el avance de hoy, suave. Non-native (anima ancho).
  useEffect(() => {
    Animated.timing(avance, {
      toValue: pct,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, avance]);

  // AL LLEGAR: un latido corto del brillo, UNA vez (cuando cruza, no cada dibujo).
  useEffect(() => {
    if (llego && !llegoAntes.current) {
      Animated.sequence([
        Animated.timing(latido, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(latido, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    llegoAntes.current = llego;
  }, [llego, latido]);

  const ancho = avance.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const escalaLatido = latido.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={estilos.raiz}>
      <View style={estilos.fila}>
        <Text style={estilos.numero}>
          {pasos.toLocaleString('es-UY')} <Text style={estilos.unidad}>{T.inicio.pasosUnidad}</Text>
        </Text>
        {llego ? (
          <Animated.Text style={[estilos.meta, { color: acento, transform: [{ scale: escalaLatido }] }]}>
            {T.inicio.pasosMetaLlego}
          </Animated.Text>
        ) : (
          <Text style={estilos.meta}>{T.inicio.pasosMetaChica(meta.toLocaleString('es-UY'))}</Text>
        )}
      </View>
      <View style={estilos.pista}>
        <Animated.View style={[estilos.relleno, { width: ancho, backgroundColor: acento }]} />
        {/* El brillo del latido: un velo del color que aparece y se va al llegar. */}
        <Animated.View
          pointerEvents="none"
          style={[estilos.brillo, { backgroundColor: acento, opacity: latido.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) }]}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { marginTop: 14, gap: 7 },
  fila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  numero: { color: C.tinta, fontSize: 15, fontVariant: ['tabular-nums'] },
  unidad: { color: C.sub, fontSize: 13 },
  meta: { color: C.apagado, fontSize: 12, fontVariant: ['tabular-nums'] },
  pista: { height: 6, borderRadius: 999, backgroundColor: conAlfa(C.tinta, 0.08), overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: 999 },
  brillo: { ...StyleSheet.absoluteFillObject, borderRadius: 999 },
});
