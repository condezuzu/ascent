import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cuantosLevantan, type Medalla as Dato } from '@nucleo/medallas';
import { T } from '@nucleo/textos';
import Medalla from './Medalla';
import { C } from './colores';

/**
 * LAS MEDALLAS AL LADO DEL NOMBRE, y la ventanita al tocar una.
 *
 * CHICAS Y EN FILA, que fue el pedido: 18 px, pegadas al nombre. No llevan
 * rótulo ni número a la vista — el que las tiene sabe lo que son, y el que
 * entra a un perfil ajeno ve que esa persona tiene algo y puede tocarlo.
 *
 * LA VENTANITA SE ABRE DEBAJO Y NO ES UNA HOJA. Una hoja modal para dos
 * renglones taparía el perfil entero para decir una frase; esto se abre en su
 * lugar, se cierra tocando de nuevo, y no se lleva la pantalla.
 *
 * LA GALAXIA NO LLEVA EL RÓTULO DEL EJERCICIO ARRIBA: su línea ya nombra los
 * tres levantamientos y el rótulo repetiría uno.
 */
export default function Medallas({
  medallas,
  nombres,
}: {
  medallas: readonly Dato[];
  /** El nombre lindo de cada ejercicio, que sale del catálogo. */
  nombres?: Readonly<Record<string, string>>;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  if (medallas.length === 0) return null;
  const elegida = medallas.find((m) => m.zona === abierta) ?? null;

  return (
    <View>
      <View style={estilos.fila}>
        {medallas.map((m) => (
          <Pressable
            key={m.zona}
            onPress={() => setAbierta(abierta === m.zona ? null : m.zona)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={T.medallas.etiqueta(
              T.medallas.zonas[m.zona],
              T.medallas.materiales[m.material]
            )}
          >
            <Medalla zona={m.zona} material={m.material} tam={18} />
          </Pressable>
        ))}
      </View>

      {elegida && (
        <View style={estilos.ventana}>
          {elegida.material !== 'galaxia' && (
            <Text style={estilos.rotulo}>{nombres?.[elegida.ejercicio] ?? T.medallas.zonas[elegida.zona]}</Text>
          )}
          <Text style={estilos.frase}>
            {elegida.material === 'galaxia'
              ? T.medallas.galaxia
              : T.medallas.frase(cuantosLevantan(elegida.percentil))}
          </Text>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ventana: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 },
  frase: { color: C.tinta, fontSize: 14, lineHeight: 19 },
});
