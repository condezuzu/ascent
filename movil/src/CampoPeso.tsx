import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Unidad } from '@nucleo/peso';
import { confirmarCampo, limpiarTecleo, pasoDelCampo, textoDelCampo } from '@nucleo/campoPeso';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * EL PESO, escrito una vez. La misma pieza que `src/components/CampoPeso.tsx`:
 * un número al lado del ejercicio que se deja quieto mientras no cambie, con
 * el disco chico a cada lado.
 *
 * Se confirma al salir del campo o con "listo" en el teclado, no a cada tecla:
 * con "6" a medio escribir "60", tocar el + grande anotaría una serie de 6.
 */
export default function CampoPeso({
  kg,
  unidad,
  alCambiar,
  compacto = false,
  etiqueta,
}: {
  kg: number | null | undefined;
  unidad: Unidad;
  alCambiar: (kg: number | null) => void;
  /** En la lista: sin los botones de más y menos. */
  compacto?: boolean;
  etiqueta?: string;
}) {
  const mostrar = (v: number | null | undefined) => textoDelCampo(v, unidad);
  const [texto, setTexto] = useState(mostrar(kg));

  useEffect(() => {
    setTexto(mostrar(kg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kg, unidad]);

  // Las cuentas están en `nucleo/campoPeso.ts`, probadas: el texto tiene coma
  // y no se vuelve a leer con `Number`.
  function confirmar() {
    const r = confirmarCampo(texto, kg, unidad);
    if (!r.cambia) return setTexto(mostrar(kg));
    alCambiar(r.kg);
    setTexto(mostrar(r.kg));
  }

  function paso(signo: 1 | -1) {
    const nuevo = pasoDelCampo(kg, unidad, signo);
    if (nuevo !== undefined) alCambiar(nuevo);
  }

  return (
    <View style={estilos.fila}>
      {!compacto && (
        <Pressable style={estilos.paso} onPress={() => paso(-1)} disabled={!kg} accessibilityLabel={T.sesion.pesoBajar}>
          <Text style={[estilos.pasoTexto, !kg && estilos.apagado]}>−</Text>
        </Pressable>
      )}
      <View style={estilos.caja}>
        <TextInput
          style={[estilos.input, compacto && estilos.inputCompacto]}
          value={texto}
          onChangeText={(v) => setTexto(limpiarTecleo(v))}
          onBlur={confirmar}
          onSubmitEditing={confirmar}
          keyboardType="decimal-pad"
          returnKeyType="done"
          placeholder={compacto ? T.sesion.sinPeso : ''}
          placeholderTextColor={C.apagado}
          accessibilityLabel={etiqueta ?? T.sesion.pesoDelBloque}
          selectTextOnFocus
        />
        <Text style={[estilos.unidad, compacto && estilos.unidadCompacta]}>{unidad}</Text>
      </View>
      {!compacto && (
        <Pressable style={estilos.paso} onPress={() => paso(1)} disabled={!kg} accessibilityLabel={T.sesion.pesoSubir}>
          <Text style={[estilos.pasoTexto, !kg && estilos.apagado]}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Grandes de tocar aunque se vean chicos: se tocan con la mano transpirada.
  paso: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { color: C.sub, fontSize: 22, fontWeight: '300' },
  apagado: { opacity: 0.25 },
  caja: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.lineaFuerte,
    paddingVertical: 2,
  },
  input: {
    color: C.tinta,
    fontSize: 22,
    // Ancho FIJO: en web un campo sin ancho ocupa la fila entera y empuja la
    // etiqueta del modo al renglón de abajo.
    width: 66,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  inputCompacto: { fontSize: 14, width: 44 },
  unidad: { color: C.apagado, fontSize: 12 },
  unidadCompacta: { fontSize: 10 },
});
