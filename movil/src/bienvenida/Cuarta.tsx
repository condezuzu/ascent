import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cuadroEn, type CuadroDeLaEntrada } from '@nucleo/bienvenida';
import { T } from '@nucleo/textos';
import LienzoBienvenida from '../LienzoBienvenida';
import { C } from '../colores';

/**
 * LA CUARTA PANTALLA en nativo: el motor dibuja los ocho objetos pasando cada vez
 * más rápido y el agujero negro tragándose todo; encima, el número de la racha
 * disparándose. Cuando el motor termina, avisa al padre para mostrar la entrada.
 *
 * El número sale del MISMO cuadro que dibuja el motor (`alCuadro`), así el número
 * y la forma van sincronizados. Se desvanece con el trago, igual que la web.
 */
export default function Cuarta({ quieta, alTerminar }: { quieta?: boolean; alTerminar: () => void }) {
  const [c, setC] = useState<CuadroDeLaEntrada>(() => cuadroEn(0));
  const opacidadNumero = Math.max(0, 1 - c.trago * 2);

  return (
    <View style={estilos.raiz}>
      <LienzoBienvenida quieta={quieta} alCuadro={setC} alTerminar={alTerminar} />
      {c.racha > 0 && opacidadNumero > 0 && (
        <View style={estilos.centro} pointerEvents="none">
          <Text style={[estilos.numero, { opacity: opacidadNumero }]}>{c.racha}</Text>
          <Text style={[estilos.rotulo, { opacity: opacidadNumero }]}>{T.bienvenida.racha}</Text>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Fondo negro: mientras el motor traga y se desvanece, atrás ya es el espacio
  // negro sobre el que va a caer la entrada.
  raiz: { ...StyleSheet.absoluteFillObject, backgroundColor: '#05060a', alignItems: 'center', justifyContent: 'center' },
  centro: { position: 'absolute', top: '30%', alignItems: 'center' },
  numero: { color: C.tinta, fontSize: 72, fontWeight: '200', fontVariant: ['tabular-nums'] },
  rotulo: { color: C.sub, fontSize: 13, letterSpacing: 6, marginTop: 2, textTransform: 'uppercase' },
});
