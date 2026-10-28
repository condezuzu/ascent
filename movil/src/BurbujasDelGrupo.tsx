import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import { disponible } from '@nucleo/esquema';
import { useVersionDelEsquema } from '@compartido/esquema';
import { supabase } from './supabase';
import Avatar from './Avatar';
import Aparece from './Aparece';
import Tocable from './Tocable';
import { irAPestana, useRecargarAlVolver } from './irAPestana';
import { C } from './colores';

type Amigo = { id: string; username: string; avatar_url: string | null };

/**
 * EL MULTIJUGADOR ARRIBA DE TODO EN INICIO (28/10, la variante B aprobada en la galería, más
 * compacta): «Iniciar grupo» y una burbuja por amigo que está entrenando ahora. Nunca dice dónde.
 * Tocar a un amigo lleva a Social, donde están Unirse y su detalle.
 */
export default function BurbujasDelGrupo({ alIniciarGrupo }: { alIniciarGrupo: () => void }) {
  const version = useVersionDelEsquema();
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('entrenando_ahora');
    if (!error) setAmigos(Array.isArray(data) ? (data as Amigo[]) : []);
  }, []);
  useEffect(() => {
    if (disponible('entrenarConOtro', version)) void cargar();
  }, [version, cargar]);
  useRecargarAlVolver('inicio', cargar);

  const conGrupos = disponible('grupos', version);
  if (!conGrupos && amigos.length === 0) return null;
  return (
    <Aparece>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fila} testID="burbujas-del-grupo">
        {conGrupos && (
          <Tocable testID="iniciar-grupo" style={estilos.burbuja} onPress={alIniciarGrupo} accessibilityRole="button">
            <View style={[estilos.cara, estilos.mas]}>
              <Text style={estilos.masTexto}>+</Text>
            </View>
            <Text style={estilos.nombre} numberOfLines={1}>
              {T.inicio.iniciarGrupo}
            </Text>
          </Tocable>
        )}
        {amigos.map((a) => (
          <Tocable
            key={a.id}
            testID="burbuja-amigo"
            style={estilos.burbuja}
            onPress={() => irAPestana('ranking')}
            accessibilityRole="button"
            accessibilityLabel={T.social.estaEntrenando(a.username)}
          >
            <View style={estilos.aro}>
              <Avatar url={a.avatar_url} nombre={a.username} tam={36} />
            </View>
            <Text style={estilos.nombre} numberOfLines={1}>
              {a.username}
            </Text>
          </Tocable>
        ))}
      </ScrollView>
    </Aparece>
  );
}

const estilos = StyleSheet.create({
  // COMPACTA (28/10): la propuesta ocupaba casi cien puntos; Inicio entero tiene que entrar sin desplazar.
  fila: { gap: 10, paddingTop: 10, paddingBottom: 2 },
  burbuja: { width: 70, alignItems: 'center', gap: 3 },
  cara: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  mas: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.sub },
  masTexto: { color: C.tinta, fontSize: 18, lineHeight: 20 },
  aro: { borderWidth: 2, borderColor: C.vivo, borderRadius: 999, padding: 0 },
  nombre: { color: C.sub, fontSize: 10.5, maxWidth: 70 },
});
