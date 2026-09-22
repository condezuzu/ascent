import { Pressable, StyleSheet, Text } from 'react-native';
import { T } from '@nucleo/textos';
import type { Unidad } from '@nucleo/peso';
import AnotarPeso from './AnotarPeso';
import Hoja from './Hoja';
import { C } from './colores';

/**
 * ANOTAR EL PESO, Y NADA MÁS. La misma hoja que la web (`PesoSheet.tsx`).
 *
 * TIENE SU PROPIA PUERTA porque el peso NO es haber entrenado. Vivió colgado
 * de la hoja de registrar el día hasta el 27/8/2026, y eso lo ataba a haber
 * ido al gimnasio: el que se pesaba un domingo se registraba el día sin
 * querer y la racha —la única cifra que la app dice que importa— contaba un
 * día que no existió.
 */
export default function PesoHoja({
  visible,
  unidad,
  alCerrar,
  alGuardar,
}: {
  visible: boolean;
  unidad: Unidad;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  return (
    <Hoja visible={visible} alCerrar={alCerrar}>
      <Text style={estilos.titulo}>{T.peso.titulo}</Text>
      <Text style={estilos.sub}>{T.peso.sub}</Text>
      <AnotarPeso
        unidad={unidad}
        alGuardar={() => {
          alGuardar();
          alCerrar();
        }}
      />
      <Pressable style={estilos.cancelar} onPress={alCerrar}>
        <Text style={estilos.cancelarTexto}>{T.general.cancelar}</Text>
      </Pressable>
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  titulo: { color: C.tinta, fontSize: 22, fontWeight: '500' },
  sub: { color: C.sub, fontSize: 14, marginTop: 2 },
  cancelar: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelarTexto: { color: C.sub, fontSize: 14 },
});
