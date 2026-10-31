import { createContext, forwardRef, useContext, type ComponentRef, type ReactNode } from 'react';
import { Animated, StyleSheet, Text as TextoDeRN, TextInput as CampoDeRN, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from 'react-native';
import { archivoDe, fuentesListas, L } from './fuentes';

/**
 * LAS LETRAS (30/10): Inter para todo lo que se lee, Outfit solo para el número de la racha y Geist
 * Mono para los datos (`spec/motor-visual.md`). Toda la app usa este `Text` y no el de React Native,
 * para no repetir el nombre del archivo de la fuente en cada estilo: los estilos siguen diciendo
 * `fontWeight` y `fontFamily: L.dato`, y acá se vuelven el archivo que corresponde.
 *
 * iOS no combina una fuente cargada a mano con `fontWeight`: cada peso es otro archivo, y si se le
 * dejan los dos cae a la del sistema. Por eso `fontWeight` se saca.
 *
 * Si las fuentes no llegaron, todo queda como estaba: se ve con la del sistema y no se traba nada.
 */
type Heredado = { familia?: string; peso?: TextStyle['fontWeight']; estilo?: TextStyle['fontStyle'] };

// Un texto adentro de otro hereda la familia de afuera, como en la web. Sin esto volvería a Inter.
const Afuera = createContext<Heredado | null>(null);

function resolver(style: StyleProp<TextStyle>, afuera: Heredado | null) {
  const plano = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const propio: Heredado = {
    familia: plano.fontFamily ?? afuera?.familia,
    peso: plano.fontWeight ?? afuera?.peso,
    estilo: plano.fontStyle ?? afuera?.estilo,
  };
  if (!fuentesListas()) {
    // Sin las fuentes, las familias nuestras no existen: se vuelve a la del sistema, sin que los números bailen.
    const { fontFamily, ...sinFamilia } = plano;
    if (fontFamily === L.dato) return { estilo: { ...sinFamilia, fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] }, propio };
    return { estilo: fontFamily === L.racha ? sinFamilia : style, propio };
  }
  // Sin nada propio adentro de otro texto no hay nada que resolver: hereda.
  if (afuera && !plano.fontFamily && !plano.fontWeight && !plano.fontStyle) return { estilo: style, propio };
  const archivo = archivoDe(propio.familia, propio.peso, propio.estilo);
  // Una familia que no es nuestra (la Menlo del diagnóstico): se deja como vino.
  if (!archivo) return { estilo: style, propio };
  const { fontWeight: _peso, fontStyle: _estilo, ...resto } = plano;
  return { estilo: { ...resto, fontFamily: archivo }, propio };
}

function conHerencia(children: ReactNode, propio: Heredado) {
  // Lo común es un texto solo, sin nada adentro: ahí el proveedor no hace falta.
  if (children == null || typeof children === 'string' || typeof children === 'number') return children;
  return <Afuera.Provider value={propio}>{children}</Afuera.Provider>;
}

export const Text = forwardRef<ComponentRef<typeof TextoDeRN>, TextProps>(function Text({ style, children, ...resto }, ref) {
  const { estilo, propio } = resolver(style, useContext(Afuera));
  return (
    <TextoDeRN ref={ref} {...resto} style={estilo}>
      {conHerencia(children, propio)}
    </TextoDeRN>
  );
});

export const TextInput = forwardRef<ComponentRef<typeof CampoDeRN>, TextInputProps>(function TextInput({ style, ...resto }, ref) {
  const { estilo } = resolver(style, null);
  return <CampoDeRN ref={ref} {...resto} style={estilo} />;
});

export const TextoAnimado = Animated.createAnimatedComponent(Text);

/**
 * Geist Mono le da a la puntuación el ancho de un número: a tamaño grande, los dos puntos de un reloj
 * y la coma de un peso quedan con un hueco a cada lado. Esto acerca lo que tienen al lado.
 */
export function CifraJunta({ texto, apretar }: { texto: string; apretar: number }) {
  const i = texto.search(/[:,]/);
  if (i < 1) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i - 1)}
      <Text style={{ letterSpacing: apretar }}>{texto.slice(i - 1, i + 1)}</Text>
      {texto.slice(i + 1)}
    </>
  );
}

// Los mismos nombres como tipo: `useRef<TextInput>` sigue valiendo.
export type Text = ComponentRef<typeof TextoDeRN>;
export type TextInput = ComponentRef<typeof CampoDeRN>;
