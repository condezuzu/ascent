import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import FotoGrande from './FotoGrande';
import { fechaCorta } from '@nucleo/fechas';
import type { FotoDePerfil } from '@compartido/perfil';
import Surgir from './Surgir';
import { C } from './colores';
import { useFotoLocal } from './fotoLocal';

/**
 * LAS FOTOS COMO LAS VE UN AMIGO, y nada más: sin administrar. Tocar una la
 * abre en grande (15/10), como la foto de perfil, con su corazón (19/10).
 *
 * ES EL MISMO COMPONENTE EN LOS DOS PERFILES a propósito, igual que en la web
 * (`ComoMeVen.tsx`). El perfil propio promete "así te ven", y la única forma de
 * que esa promesa no se rompa es que sea literalmente el mismo dibujo que ve el
 * otro. Con dos copias, la del dueño se mejora un día y la promesa pasa a ser
 * falsa sin que nadie lo note. Lo único distinto: en las propias el corazón no se toca.
 *
 * ENTRAN ESCALONADAS (`Surgir`): nueve cuadrados apareciendo de golpe se leen
 * como un parpadeo.
 */
const HUECO = 8;

export default function FotosQueVen({ fotos, propias = false }: { fotos: FotoDePerfil[]; propias?: boolean }) {
  const { width } = useWindowDimensions();
  // Tres por fila del ancho que de verdad tiene la grilla (19/10): calcularlo desde la
  // pantalla suponía el margen de quien la monta.
  const [ancho, setAncho] = useState(0);
  const lado = Math.floor(((ancho || width - 48) - HUECO * 2) / 3);
  const [grande, setGrande] = useState<FotoDePerfil | null>(null);

  if (fotos.length === 0) return null;

  return (
    <View style={estilos.grilla} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      {fotos.map((f, i) => (
        <Surgir key={f.id} indice={i}>
          <Pressable testID="foto-de-perfil" style={{ width: lado }} onPress={() => setGrande(f.url || f.miniatura ? f : null)} accessibilityRole="imagebutton">
            <Cuadrito foto={f} lado={lado} />
            {/* La fecha solo si la foto cuelga de un día: una suelta no tiene
                cuándo, y poner uno inventado sería peor que no poner nada. */}
            {!!f.fecha && <Text style={estilos.cuando}>{fechaCorta(f.fecha)}</Text>}
          </Pressable>
        </Surgir>
      ))}
      <FotoGrande url={grande ? grande.url || grande.miniatura || null : null} fotoId={grande?.id ?? null} propia={propias} onCerrar={() => setGrande(null)} />
    </View>
  );
}

/** Del disco del teléfono si ya se bajó (15/10): la clave es la foto, que no cambia aunque cambie el enlace. */
function Cuadrito({ foto, lado }: { foto: FotoDePerfil; lado: number }) {
  const uri = useFotoLocal((foto.miniatura ? 'mini-foto-' : 'entera-foto-') + foto.id, foto.miniatura || foto.url);
  // La sombra va afuera: con `overflow: hidden` en la misma vista, iOS la recorta.
  return (
    <View style={[estilos.sombra, { width: lado, height: lado }]}>
      <Image source={uri ? { uri } : undefined} style={[estilos.cuadrito, { width: lado, height: lado }]} accessibilityIgnoresInvertColors />
    </View>
  );
}

const estilos = StyleSheet.create({
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO, marginTop: 6 },
  sombra: { borderRadius: 14, backgroundColor: C.linea, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cuadrito: { borderRadius: 14, overflow: 'hidden' },
  cuando: { color: C.apagado, fontSize: 10, marginTop: 4 },
});
