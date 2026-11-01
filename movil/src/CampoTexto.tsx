import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { TextInput } from './Texto';

/**
 * UN TEXTINPUT QUE DISTINGUE UN TOQUE DE UN ARRASTRE (27/9).
 *
 * En el teléfono, deslizar el dedo por encima de un campo —para cambiar de
 * pestaña o para scrollear— abría el teclado: el campo tomaba el arrastre como
 * si fuera un tap. Acá, mientras el campo NO está enfocado, una capa
 * transparente encima se lleva el toque. Un TAP dispara su `onPress` y enfoca;
 * un ARRASTRE no dispara `onPress` —RN lo cancela apenas el dedo se mueve— y el
 * gesto sigue de largo al deslizador de pestañas o al scroll. Ya enfocado, la
 * capa desaparece y el campo se comporta igual que siempre (cursor, selección,
 * teclado). Es la misma idea que un botón adentro de un ScrollView: tocarlo lo
 * activa, arrastrar desde él scrollea.
 *
 * Es un reemplazo directo de `<TextInput>`: acepta las mismas props. Sirve para
 * los campos que viven dentro del área que desliza pestañas (`Pestanas`). No
 * hace falta en Login/Onboarding, que van fuera de ese área.
 *
 * NOTA: sin confirmar en un teléfono (el que lo escribió no tiene device). El
 * gesto está diagnosticado; si algún campo quedara raro, volver a `<TextInput>`
 * en ese campo es un cambio de una línea.
 */
export default function CampoTexto({
  contenedorStyle,
  pedirFoco,
  ...props
}: TextInputProps & { contenedorStyle?: StyleProp<ViewStyle>; pedirFoco?: number }) {
  const ref = useRef<TextInput>(null);
  const [enfocado, setEnfocado] = useState(false);
  // Cada vez que sube, se enfoca: otro lugar de la pantalla puede traer al dedo hasta acá.
  useEffect(() => {
    if (pedirFoco) ref.current?.focus();
  }, [pedirFoco]);
  return (
    <View style={contenedorStyle}>
      <TextInput
        ref={ref}
        {...props}
        onFocus={(e) => {
          setEnfocado(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setEnfocado(false);
          props.onBlur?.(e);
        }}
      />
      {!enfocado && (
        // Un toque enfoca; un arrastre no dispara esto y pasa al deslizador.
        <Pressable style={StyleSheet.absoluteFill} onPress={() => ref.current?.focus()} accessibilityElementsHidden />
      )}
    </View>
  );
}
