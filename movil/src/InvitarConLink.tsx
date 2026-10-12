import { Pressable, Share, StyleSheet, Text } from 'react-native';
import { enlaceDeAmigo } from '@nucleo/enlace';
import { T } from '@nucleo/textos';
import { C } from './colores';

/**
 * INVITAR CON TU LINK (8/10/2026). Abre la hoja de compartir del teléfono con
 * el link `https` de tu perfil: el que lo toca cae en una página de la web que
 * le abre la app en tu perfil, con el botón de agregar.
 *
 * Sin nombre todavía no hay link que dar, y no se dibuja.
 */
export default function InvitarConLink({ usuario }: { usuario: string | null | undefined }) {
  if (!usuario) return null;
  return (
    <Pressable
      testID="invitar-con-link"
      style={estilos.boton}
      accessibilityRole="button"
      // Cerrar la hoja sin compartir también rechaza en algunos sistemas: no es un error.
      onPress={() => void Share.share({ message: T.social.invitacion(enlaceDeAmigo(usuario)) }).catch(() => undefined)}
    >
      <Text style={estilos.texto}>{T.social.invitar}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  // CHICO Y A LA IZQUIERDA (12/10): a todo el ancho y en blanco competía con
  // el nombre de usuario, que es lo que importa en esa pantalla.
  boton: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  texto: { color: C.sub, fontSize: 13 },
});
