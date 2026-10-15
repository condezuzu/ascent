import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cuentaAtras } from '@compartido/descanso';
import { renglonDe, type Union } from '@nucleo/enVivo';
import { T } from '@nucleo/textos';
import Avatar from './Avatar';
import CadaSegundo from './CadaSegundo';
import { irAPestana } from './irAPestana';
import { C } from './colores';

/**
 * LA TIRA DEL GRUPO EN INICIO (15/10, multijugador completo). Mientras entrenás
 * con otros, una fila chica con cada uno: la cara y, en una palabra, qué está
 * haciendo (la serie, o cuánto le falta de descanso). Sin pesos, como siempre. El
 * detalle está en Ranking: tocarla lleva ahí. Llega en tiempo real (`useUniones`).
 */
export default function TiraDelGrupo({ uniones, recibidoEn }: { uniones: Union[]; recibidoEn: number }) {
  const companeros = uniones.filter((u) => u.estado === 'aceptada');
  if (companeros.length === 0) return null;
  return (
    <Pressable testID="tira-del-grupo" onPress={() => irAPestana('ranking')} accessibilityRole="button" accessibilityLabel={T.social.juntos}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fila}>
        <CadaSegundo>
          {() =>
            companeros.map((u) => {
              const r = renglonDe(u, Date.now() - recibidoEn);
              const que =
                r.descanso !== null
                  ? r.descanso === 0
                    ? T.social.enVivoListo
                    : T.social.enVivoDescansa(cuentaAtras(r.descanso))
                  : r.sinDatos || r.sinSenal
                    ? '…'
                    : T.social.tiraSerie(r.serie, r.meta || 0);
              return (
                <View key={u.otro.id} style={estilos.persona}>
                  <Avatar url={u.otro.avatar_url} nombre={u.otro.username} tam={26} />
                  <View>
                    <Text style={estilos.nombre} numberOfLines={1}>
                      {u.otro.username}
                    </Text>
                    <Text style={[estilos.que, r.descanso !== null && estilos.descansa]}>{que}</Text>
                  </View>
                </View>
              );
            })
          }
        </CadaSegundo>
      </ScrollView>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: { gap: 10, paddingVertical: 2, marginTop: 14 },
  persona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 14,
  },
  nombre: { color: C.tinta, fontSize: 13, maxWidth: 110 },
  que: { color: C.sub, fontSize: 12, fontVariant: ['tabular-nums'] },
  descansa: { color: C.claro },
});
