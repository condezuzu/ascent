import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CARGAS, claveDeEtiqueta, type Carga } from '@nucleo/carga';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * QUÉ SIGNIFICA EL NÚMERO, pegado al número. La misma pieza que la web: una
 * etiqueta en voz baja que, al tocarla, ofrece los cuatro modos dichos como
 * QUÉ número escribir.
 *
 * Devuelve la etiqueta y, abierta, las opciones como hermanas: en una fila con
 * `flexWrap` las opciones (a lo ancho) bajan al renglón de abajo y empujan, en
 * vez de flotar encima del `+`.
 */
export default function EtiquetaDeCarga({
  carga,
  ejercicio,
  alElegir,
  chica = false,
}: {
  carga: Carga;
  ejercicio: string | null;
  alElegir: (c: Carga) => void;
  chica?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const clave = claveDeEtiqueta(carga, ejercicio);

  return (
    <>
      <Pressable
        style={[estilos.etiqueta, chica && estilos.etiquetaChica]}
        onPress={() => setAbierta((x) => !x)}
        accessibilityRole="button"
        accessibilityLabel={`${T.sesion.cargaCambiar}: ${T.sesion.carga[clave]}`}
      >
        <Text style={[estilos.texto, chica && estilos.textoChico]}>{T.sesion.carga[clave]}</Text>
        <Text style={estilos.flecha}>▾</Text>
      </Pressable>
      {abierta && (
        <View style={estilos.opciones}>
          {CARGAS.map((c) => (
            <Pressable
              key={c}
              style={[estilos.opcion, c === carga && estilos.prendida]}
              onPress={() => {
                setAbierta(false);
                alElegir(c);
              }}
              accessibilityState={{ selected: c === carga }}
            >
              <Text style={[estilos.opcionTexto, c === carga && estilos.opcionPrendida]}>
                {T.sesion.cargaOpcion[claveDeEtiqueta(c, ejercicio)]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 4 },
  etiquetaChica: { minHeight: 30 },
  texto: { color: C.sub, fontSize: 13 },
  textoChico: { fontSize: 12 },
  flecha: { color: C.apagado, fontSize: 10 },
  opciones: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  opcion: {
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  prendida: { borderColor: C.principal },
  opcionTexto: { color: C.sub, fontSize: 13 },
  opcionPrendida: { color: C.tinta },
});
