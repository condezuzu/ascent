import { StyleSheet, Text, View } from 'react-native';
import { cuentaAtras } from '@compartido/descanso';
import { renglonDe } from '@nucleo/enVivo';
import { T } from '@nucleo/textos';
import { useUniones } from './useUniones';
import { useNombresDeEjercicios } from './useNombresDeEjercicios';
import Avatar from './Avatar';
import { C } from './colores';

/**
 * EL COMPAÑERO, ABAJO DE MI DESCANSO (12/10/2026): su ejercicio, su serie y su
 * cuenta, en chico. Son los mismos datos que muestra Ranking en "Entrenando
 * contigo", puestos donde se está mirando mientras se entrena con alguien.
 *
 * Pregunta solo mientras la pantalla del descanso está a la vista, y no dibuja
 * nada si no hay nadie aceptado. `ahora` lo pasa la pantalla, que ya se
 * repinta cuatro veces por segundo: acá no hay un segundo reloj.
 */
export default function CompaneroEnDescanso({ visible, ahora }: { visible: boolean; ahora: number }) {
  const { uniones, recibidoEn } = useUniones(visible, true);
  const aceptadas = uniones.filter((u) => u.estado === 'aceptada');
  const hay = aceptadas.length > 0;
  const nombres = useNombresDeEjercicios(hay, recibidoEn);


  if (!hay) return null;

  return (
    <View testID="companero-en-descanso" style={estilos.caja}>
      {aceptadas.map((u) => {
        const r = renglonDe(u, ahora - recibidoEn);
        const ejercicio = r.ejercicio ? (nombres[r.ejercicio] ?? '…') : T.sesion.sinEjercicio;
        return (
          <View key={u.id} style={estilos.fila}>
            <Avatar url={u.otro.avatar_url} nombre={u.otro.username} tam={34} />
            <View style={{ flex: 1 }}>
              {/* La cuenta va en el renglón del nombre: al costado le sacaba ancho al detalle y se cortaba. */}
              <View style={estilos.cabecera}>
                <Text style={estilos.nombre} numberOfLines={1}>
                  {u.otro.username}
                </Text>
                {r.descanso !== null ? (
                  <View style={[estilos.pildora, r.descanso === 0 && estilos.pildoraLista]}>
                    <Text style={[estilos.pildoraTexto, r.descanso === 0 && estilos.pildoraTextoLista]}>
                      {r.descanso === 0 ? T.social.enVivoListo : T.social.enVivoDescansa(cuentaAtras(r.descanso))}
                    </Text>
                  </View>
                ) : r.sinSenal ? (
                  <Text style={estilos.apagada}>{T.social.enVivoSinSenal}</Text>
                ) : null}
              </View>
              <Text style={[estilos.detalle, r.sinSenal && estilos.viejo]} numberOfLines={1}>
                {r.sinDatos ? T.social.enVivoSinDatos : T.social.enVivoSerie(ejercicio, r.serie, r.meta)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineaFuerte, marginTop: 8, paddingTop: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nombre: { color: C.tinta, fontSize: 15, flexShrink: 1 },
  detalle: { color: C.sub, fontSize: 14, marginTop: 3 },
  viejo: { color: C.apagado },
  apagada: { color: C.apagado, fontSize: 13 },
  pildora: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 11 },
  pildoraLista: { borderColor: C.sub },
  pildoraTexto: { color: C.sub, fontSize: 13, fontVariant: ['tabular-nums'] },
  pildoraTextoLista: { color: C.tinta },
});
