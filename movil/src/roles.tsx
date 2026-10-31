import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { C, conAlfa, HALO, conTema } from './colores';
import FondoOctogonal from './FondoOctogonal';
import { L } from './fuentes';
import { Text } from './Texto';
import Tocable from './Tocable';
import { useTema } from './useTema';

/**
 * LAS PIEZAS DE ROL (30/10). Había 53 etiquetas en 39 archivos, cada una con su tamaño y su
 * espaciado, y el 40 % de los estilos eran copias. El rol se dice una vez y se cuelga de acá: lo
 * que cambia de un lugar a otro son los márgenes, no el aspecto.
 *
 * Forma (`spec/estetica.md` §19.1): lo estructural es línea y aire, u octágono si algo tiene que
 * sentirse contenido (`Caja`). La píldora es para lo que se elige. Y lo secundario es texto
 * subrayado (`Fantasma`), no una caja vacía.
 *
 * Son getters porque `C.claro` cambia con la paleta: leídos adentro de `conTema`, se rearman.
 */
export const R = {
  get etiqueta() {
    return { color: C.sub, fontSize: 10.5, fontWeight: '500', letterSpacing: 2, textTransform: 'uppercase' } as const;
  },
  get cifra() {
    return { color: C.claro, fontSize: 34, fontWeight: '300', fontFamily: L.dato, letterSpacing: -1.6 } as const;
  },
  get nota() {
    return { color: C.apagado, fontSize: 12, lineHeight: 17 } as const;
  },
};

/** El título de una sección: se sale del margen y cuelga de una línea. */
export function Seccion({ children, arriba = 32, style }: { children: ReactNode; arriba?: number; style?: StyleProp<ViewStyle> }) {
  useTema();
  return (
    <View style={[estilos.seccion, { marginTop: arriba }, style]}>
      <Text style={estilos.seccionTexto}>{children}</Text>
    </View>
  );
}

/** Lo secundario: texto subrayado. Sobre el motor lleva halo; en una hoja, `enHoja`. */
export function Fantasma({
  texto,
  alTocar,
  enHoja,
  alinear = 'center',
  testID,
  colorTexto,
  estilo,
  accesibilidad,
}: {
  texto: string;
  alTocar: () => void;
  enHoja?: boolean;
  alinear?: 'center' | 'flex-start' | 'flex-end';
  testID?: string;
  colorTexto?: string;
  estilo?: StyleProp<ViewStyle>;
  accesibilidad?: { expanded?: boolean };
}) {
  useTema();
  const color = colorTexto ?? (enHoja ? C.tinta : C.sobreMotor);
  const estiloTexto: StyleProp<TextStyle> = [estilos.fantasmaTexto, { color }, !enHoja && HALO];
  return (
    <Tocable
      testID={testID}
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityState={accesibilidad}
      style={[estilos.fantasma, { alignSelf: alinear }, estilo]}
    >
      <View style={[estilos.fantasmaLinea, { borderBottomColor: conAlfa(color, 0.45) }, !enHoja && estilos.fantasmaPlaca]}>
        <Text style={estiloTexto}>{texto}</Text>
      </View>
    </Tocable>
  );
}

/** Lo que tiene que sentirse contenido: una caja con las esquinas cortadas. */
export function Caja({
  children,
  corte = 10,
  relleno,
  borde,
  style,
  testID,
}: {
  children: ReactNode;
  corte?: number;
  relleno?: string;
  borde?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  useTema();
  return (
    <View style={style} testID={testID}>
      <FondoOctogonal relleno={relleno ?? C.superficie} superficie={!relleno} borde={borde ?? C.bordeOcto} corte={corte} />
      {children}
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  seccion: { marginLeft: -12, paddingBottom: 9, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: C.linea },
  seccionTexto: { ...R.etiqueta },
  // El toque sigue siendo de 44 puntos aunque se vea chico.
  fantasma: { paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  fantasmaLinea: { paddingBottom: 3, borderBottomWidth: 1 },
  // En reposo el planeta le pasa por detrás, y el anillo del agujero negro no deja llegar al piso sin esto.
  fantasmaPlaca: { backgroundColor: C.placa, paddingHorizontal: 6 },
  fantasmaTexto: { fontSize: 13.5 },
}));
