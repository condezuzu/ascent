import { StyleSheet, View } from 'react-native';
import { T } from '@nucleo/textos';
import Aparece from './Aparece';
import { C, conTema } from './colores';
import { L } from './fuentes';
import { Caja } from './roles';
import { Text } from './Texto';
import { useTema } from './useTema';

/**
 * UN AJUSTE QUE SE MUESTRA (propuesta G, aprobada el 31/10). Debajo de cada interruptor había una
 * oración que decía dónde iba a aparecer. Ahora está el bloque de entrenar, en chico, y al prender
 * se ve aparecer lo que el ajuste suma. Las oraciones las sigue leyendo VoiceOver.
 */
export default function AjusteQueSeMuestra({ ultimaVez, reps }: { ultimaVez: boolean; reps: boolean }) {
  useTema();
  return (
    <Caja style={estilos.caja} testID="ajuste-muestra">
      <Text style={estilos.ejercicio} importantForAccessibility="no-hide-descendants">{T.ajustes.muestraEjercicio}</Text>
      <Aparece visible={ultimaVez} testID="muestra-ultima-vez">
        <Text style={estilos.ultima}>{`3 × 60 kg · 5 ${T.sesion.reps}`}</Text>
      </Aparece>
      <View style={estilos.fila}>
        <Text style={estilos.cifra}>62,5</Text>
        <Text style={estilos.unidad}>kg</Text>
        <Aparece visible={reps} testID="muestra-reps">
          <View style={estilos.fila}>
            <Text style={[estilos.cifra, estilos.separada]}>5</Text>
            <Text style={estilos.unidad}>{T.sesion.reps}</Text>
          </View>
        </Aparece>
      </View>
    </Caja>
  );
}

const estilos = conTema(() => StyleSheet.create({
  caja: { marginTop: 16, paddingHorizontal: 14, paddingVertical: 12 },
  ejercicio: { color: C.tinta, fontSize: 14.5, fontWeight: '500' },
  ultima: { color: C.sub, fontSize: 11.5, fontFamily: L.dato, paddingTop: 5 },
  fila: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 9 },
  cifra: { color: C.tinta, fontSize: 15, letterSpacing: -0.3, fontFamily: L.dato },
  separada: { marginLeft: 7 },
  unidad: { color: C.sub, fontSize: 12 },
}));
