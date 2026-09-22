import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * EL DÍA YA ESTÁ: lo que queda es sumarle la foto o el peso.
 *
 * ERA UN RENGLÓN DE TEXTO y no parecía un botón (visto en el iPhone el 22/9).
 * Ahora es lo mismo que la web (`.dia-listo` en `globals.css`): el cartel a la
 * izquierda, y a la derecha dos píldoras con ícono y rótulo.
 *
 * DOS BOTONES Y NO UNO, por la misma razón que en la web: sumar una foto y
 * anotar el peso son dos cosas distintas, y "Agregar" solo obliga a tocar para
 * averiguar cuál era.
 *
 * CON RÓTULO Y NO SOLO EL ÍCONO: una cámara se entiende sola, una balanza no.
 *
 * EL CARTEL SE DICE UNA VEZ Y CON AIRE, afuera de los botones: apretado
 * adentro de uno ancho parecía que el día se registraba otra vez.
 */
export default function DiaListo({ alaFoto, alPeso }: { alaFoto: () => void; alPeso: () => void }) {
  return (
    <View style={estilos.fila}>
      <Text style={estilos.cartel}>{T.inicio.diaRegistrado}</Text>
      <View style={estilos.acciones}>
        <Accion rotulo={T.registrar.foto} alTocar={alaFoto}>
          <IconoFoto />
        </Accion>
        <Accion rotulo={T.registrar.peso} alTocar={alPeso}>
          <IconoPeso />
        </Accion>
      </View>
    </View>
  );
}

function Accion({ rotulo, alTocar, children }: { rotulo: string; alTocar: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      // El hundido al tocar es el de la web (`transform: scale(0.96)`): dice
      // que el toque entró sin esperar a que abra nada.
      style={({ pressed }) => [estilos.pildora, pressed && estilos.hundida]}
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
    >
      <View style={estilos.redondo}>{children}</View>
      <Text style={estilos.rotulo}>{rotulo}</Text>
    </Pressable>
  );
}

// Los mismos trazos que la web (`IconoFoto` / `IconoPeso` en `app/page.tsx`).
function IconoFoto() {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={C.sub} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 8.5h3l1.4-2h7.2L17 8.5h3v10H4z" />
      <Circle cx={12} cy={13} r={3.4} />
    </Svg>
  );
}

function IconoPeso() {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={C.sub} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 6h10l2.5 13H4.5z" />
      <Path d="M9.6 6a2.4 2.4 0 0 1 4.8 0" />
    </Svg>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 10, paddingBottom: 4 },
  cartel: { color: C.sub, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase' },
  acciones: { flexDirection: 'row', gap: 8 },
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingLeft: 6,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 999,
  },
  hundida: { transform: [{ scale: 0.96 }], borderColor: C.lineaFuerte },
  redondo: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  rotulo: { color: C.apagado, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
});
