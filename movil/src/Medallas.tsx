import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cuantosLevantan, type Medalla as Dato } from '@nucleo/medallas';
import { T } from '@nucleo/textos';
import Medalla from './Medalla';
import { C } from './colores';

/**
 * LAS MEDALLAS AL LADO DEL NOMBRE, y la ventanita al tocar una.
 *
 * AL LADO Y NO DEBAJO, y del alto del nombre (24 px contra 22 del nombre en el
 * perfil). La primera versión las puso debajo y chicas por miedo a que un
 * nombre largo las empujara afuera; el miedo estaba mal resuelto. Se arregla
 * con `flexWrap`: con un nombre largo bajan a la línea siguiente, que es lo
 * que hace cualquier fila de texto, en vez de esconderse desde el principio.
 *
 * POR ESO RECIBE EL NOMBRE: la fila es nombre + medallas, y la ventanita va
 * DEBAJO DE LAS DOS. Si el componente dibujara solo las medallas, quien lo usa
 * tendría que armar la fila por fuera y la ventanita quedaría adentro.
 *
 * LA VENTANITA SE ABRE EN SU LUGAR Y NO ES UNA HOJA. Una hoja modal para dos
 * renglones taparía el perfil entero para decir una frase.
 */
export default function Medallas({
  medallas,
  nombre,
  tam = 24,
  nombres,
}: {
  medallas: readonly Dato[];
  /** El nombre, que va en la misma fila. */
  nombre?: ReactNode;
  tam?: number;
  /** El nombre lindo de cada ejercicio, que sale del catálogo. */
  nombres?: Readonly<Record<string, string>>;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const elegida = medallas.find((m) => m.zona === abierta) ?? null;

  return (
    <View>
      <View style={estilos.fila}>
        {nombre}
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
            <Medalla zona={m.zona} material={m.material} tam={tam} />
          </Pressable>
        ))}
      </View>

      {elegida && (
        <View style={estilos.ventana}>
          {/* EL MATERIAL, DICHO. A 24 px la luna y el planeta se parecen
              —gris azulado contra azul— y no había forma de saber cuál te
              tocó sin comparar dos medallas lado a lado. Ahora lo dice. */}
          <Text style={estilos.rotulo}>
            {elegida.material === 'galaxia'
              ? T.medallas.materiales.galaxia
              : `${nombres?.[elegida.ejercicio] ?? T.medallas.zonas[elegida.zona]} · ${T.medallas.materiales[elegida.material]}`}
          </Text>
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

/**
 * LAS MEDALLAS Y NADA MÁS, sin tocar. Para Inicio, donde la fila del nombre YA
 * es un botón que lleva al perfil: una medalla que se abriera ahí competiría
 * con ese toque y dejaría al que apunta mal en la pantalla equivocada. Se ven;
 * para saber qué son, se entra al perfil.
 */
export function FilaDeMedallas({ medallas, tam = 16 }: { medallas: readonly Dato[]; tam?: number }) {
  if (medallas.length === 0) return null;
  return (
    <View style={estilos.sueltas} pointerEvents="none">
      {medallas.map((m) => (
        <Medalla key={m.zona} zona={m.zona} material={m.material} tam={tam} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  sueltas: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ventana: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 },
  frase: { color: C.tinta, fontSize: 14, lineHeight: 19 },
});
