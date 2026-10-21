import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { distanciaCorta, kmEscritos, type UnidadDistancia } from '@nucleo/distancia';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * LA DISTANCIA DE LA VUELTA DE CARDIO (21/10): la caja de `CampoReps`, con decimales.
 *
 * Avisa a cada tecla —nadie tiene que salir del campo para que cuente (ver la trampa del
 * campo que confirma al salir)— pero el texto es suyo mientras se escribe: "3," a medio
 * escribir no se reemplaza por "3".
 */
export default function CampoDistancia({
  km,
  unidad,
  alCambiar,
}: {
  km: number | undefined;
  unidad: UnidadDistancia;
  alCambiar: (km: number | null) => void;
}) {
  const mostrar = (v: number | undefined) => (v !== undefined ? distanciaCorta(v, unidad) : '');
  const [texto, setTexto] = useState(mostrar(km));
  const tecleando = useRef(false);
  useEffect(() => {
    if (tecleando.current) return;
    setTexto(mostrar(km));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [km, unidad]);
  return (
    <View style={estilos.caja}>
      <TextInput
        testID="campo-distancia"
        style={estilos.input}
        value={texto}
        onChangeText={(v) => {
          tecleando.current = true;
          const limpio = v.replace(/[^0-9.,]/g, '').slice(0, 6);
          setTexto(limpio);
          alCambiar(kmEscritos(limpio, unidad));
        }}
        onBlur={() => {
          tecleando.current = false;
          setTexto(mostrar(km));
        }}
        keyboardType="decimal-pad"
        returnKeyType="done"
        placeholder="0"
        placeholderTextColor={C.apagado}
        accessibilityLabel={T.sesion.distancia}
        selectTextOnFocus
      />
      <Text style={estilos.unidad}>{unidad}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.lineaFuerte,
    paddingVertical: 2,
  },
  input: { color: C.tinta, fontSize: 22, width: 66, textAlign: 'right', fontVariant: ['tabular-nums'], padding: 0 },
  unidad: { color: C.apagado, fontSize: 12 },
});
