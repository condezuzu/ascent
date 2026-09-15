import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { aKilos, pasoDePeso, pesoCorto, type Unidad } from '@nucleo/peso';
import { pesoValido } from '@nucleo/bloques';
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
  const mostrar = (v: number | null | undefined) => (v ? pesoCorto(v, unidad) : '');
  const [texto, setTexto] = useState(mostrar(kg));

  useEffect(() => {
    setTexto(mostrar(kg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kg, unidad]);

  function confirmar() {
    const escrito = texto.trim();
    if (escrito === '') {
      if (kg) alCambiar(null);
      return;
    }
    const v = pesoValido(escrito);
    const enKilos = v === null ? null : pesoValido(aKilos(v, unidad));
    if (enKilos === (kg ?? null)) return setTexto(mostrar(kg));
    alCambiar(enKilos);
    setTexto(mostrar(enKilos));
  }

  function paso(signo: 1 | -1) {
    if (!kg) return;
    const actual = Number(pesoCorto(kg, unidad));
    const nuevo = Math.max(0, actual + signo * pasoDePeso(unidad));
    alCambiar(nuevo === 0 ? null : pesoValido(aKilos(nuevo, unidad)));
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
          onChangeText={(v) => setTexto(v.replace(/[^0-9.,]/g, '').slice(0, 6))}
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
