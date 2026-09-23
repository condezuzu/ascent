import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { fechaCorta } from '@nucleo/fechas';
import type { FotoDePerfil } from '@compartido/perfil';
import Surgir from './Surgir';
import { C } from './colores';

/**
 * LAS FOTOS COMO LAS VE UN AMIGO, y nada más: sin tocar, sin administrar.
 *
 * ES EL MISMO COMPONENTE EN LOS DOS PERFILES a propósito, igual que en la web
 * (`ComoMeVen.tsx`). El perfil propio promete "así te ven", y la única forma de
 * que esa promesa no se rompa es que sea literalmente el mismo dibujo que ve el
 * otro. Con dos copias, la del dueño se mejora un día y la promesa pasa a ser
 * falsa sin que nadie lo note.
 *
 * ENTRAN ESCALONADAS (`Surgir`): nueve cuadrados apareciendo de golpe se leen
 * como un parpadeo.
 */
export default function FotosQueVen({ fotos }: { fotos: FotoDePerfil[] }) {
  const { width } = useWindowDimensions();
  // Tres por fila, con el margen de la pantalla y el mismo hueco que el Álbum.
  const lado = (width - 24 * 2 - 6 * 2) / 3;

  if (fotos.length === 0) return null;

  return (
    <View style={estilos.grilla}>
      {fotos.map((f, i) => (
        <Surgir key={f.id} indice={i}>
          <View style={{ width: lado }}>
            <Image
              source={{ uri: f.miniatura || f.url }}
              style={{ width: lado, height: lado, backgroundColor: C.linea }}
              accessibilityIgnoresInvertColors
            />
            {/* La fecha solo si la foto cuelga de un día: una suelta no tiene
                cuándo, y poner uno inventado sería peor que no poner nada. */}
            {!!f.fecha && <Text style={estilos.cuando}>{fechaCorta(f.fecha)}</Text>}
          </View>
        </Surgir>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cuando: { color: C.apagado, fontSize: 10, marginTop: 4 },
});
