import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ORDEN_SEMANA, tituloDelDia, type DiaDeSemana } from '@nucleo/rutinas';
import { T } from '@nucleo/textos';
import { nombreVisible } from '@nucleo/propios';
import type { CatalogoDeRutina } from '@compartido/rutinas';
import { C } from './colores';

/**
 * UNA RUTINA PLEGADA POR DÍA (14/10): "Lunes — Pecho, hombro y brazo", y al
 * tocar el día se abre con sus ejercicios. Antes era una lista larguísima de
 * todos los ejercicios de la semana, imposible de leer.
 *
 * La misma pieza en los tres lugares donde se ve una rutina: Stats, el perfil
 * propio y el de un amigo. Para editar, quien la usa le pasa `abajoDelDia`: lo
 * que va adentro del día abierto en lugar de la lista de solo lectura.
 */
export default function RutinaPlegada({
  dias,
  catalogo,
  soloConAlgo = false,
  abajoDelDia,
  abiertoAlEmpezar,
  abiertos = false,
  testID,
}: {
  dias: DiaDeSemana[];
  catalogo: CatalogoDeRutina;
  soloConAlgo?: boolean;
  abajoDelDia?: (dia: number) => ReactNode;
  /** El día que arranca abierto (en la pantalla de la rutina, el de hoy). */
  abiertoAlEmpezar?: number;
  /** Todos los días abiertos, con su lista (la rutina de otra persona, 19/10). */
  abiertos?: boolean;
  testID?: string;
}) {
  const [abierto, setAbierto] = useState<number | null>(abiertoAlEmpezar ?? null);
  const grupoDe = (id: string) => catalogo.get(id)?.grupo ?? null;
  const visibles = ORDEN_SEMANA.filter((d) => !soloConAlgo || dias[d].descanso || dias[d].ejercicios.length > 0);

  return (
    <View testID={testID}>
      {visibles.map((d) => {
        const dia = dias[d];
        const titulo = tituloDelDia(dia, grupoDe, T.rutina.descanso);
        const vacio = !dia.descanso && dia.ejercicios.length === 0;
        const esAbierto = abiertos || abierto === d;
        return (
          <View key={d} style={estilos.dia}>
            <Pressable
              testID={`rutina-dia-${d}`}
              style={({ pressed }) => [estilos.cabecera, pressed && estilos.tocado]}
              onPress={() => setAbierto(esAbierto ? null : d)}
              accessibilityRole="button"
              accessibilityState={{ expanded: esAbierto }}
            >
              <Text style={estilos.nombre} numberOfLines={1}>
                {T.fechas.diasLargos[d]}
                <Text style={vacio || dia.descanso ? estilos.apagado : estilos.que}>
                  {' — '}
                  {vacio ? T.rutina.sinCargar : titulo || T.rutina.sinCargar}
                </Text>
              </Text>
              <Text style={estilos.flecha}>{esAbierto ? '⌃' : '⌄'}</Text>
            </Pressable>
            {esAbierto &&
              (abajoDelDia ? (
                abajoDelDia(d)
              ) : (
                <View style={estilos.lista}>
                  {dia.ejercicios.map((e, i) => (
                    <View key={`${e.ejercicio}-${i}`} style={estilos.fila}>
                      <Text style={estilos.ejercicio} numberOfLines={1}>
                        {nombreVisible(e.ejercicio, catalogo.get(e.ejercicio)?.nombre)}
                      </Text>
                      {e.minutos === undefined && e.series > 0 ? (
                        <BloquesDeSeries series={e.series} desde={seriesAntes(dia, i)} />
                      ) : (
                        <Text style={estilos.cantidad}>{e.minutos !== undefined ? T.rutina.minutos(e.minutos) : ''}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}
          </View>
        );
      })}
    </View>
  );
}

/**
 * LAS SERIES COMO BLOQUES, QUE ENTRAN DE A UNO (19/10, aprobado en la galería): cada uno
 * en 220 ms, uno cada 70, y una fila sigue donde terminó la anterior: se arma en
 * escalones. Con "reducir movimiento" aparecen puestos.
 */
const ESCALON_MS = 220;
const ENTRE_ESCALONES_MS = 70;
// Una semana de amigo abierta entera no tarda más de dos segundos en armarse.
const TOPE_DE_ESCALONES = 28;

const seriesAntes = (dia: DiaDeSemana, i: number) => dia.ejercicios.slice(0, i).reduce((n, e) => n + (e.minutos === undefined ? e.series : 0), 0);

function BloquesDeSeries({ series, desde }: { series: number; desde: number }) {
  return (
    <View style={estilos.bloques} accessible accessibilityLabel={T.rutina.series(series)}>
      {Array.from({ length: series }, (_, i) => (
        <BloqueDeSerie key={i} indice={desde + i} />
      ))}
    </View>
  );
}

function BloqueDeSerie({ indice }: { indice: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((quieto) => {
        if (!vivo) return;
        if (quieto) return t.setValue(1);
        Animated.timing(t, {
          toValue: 1,
          duration: ESCALON_MS,
          delay: 150 + Math.min(indice, TOPE_DE_ESCALONES) * ENTRE_ESCALONES_MS,
          easing: Easing.bezier(0.2, 0.8, 0.3, 1),
          useNativeDriver: true,
        }).start();
      });
    return () => {
      vivo = false;
    };
  }, [indice, t]);
  return <Animated.View style={[estilos.bloque, { opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]} />;
}

const estilos = StyleSheet.create({
  dia: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.linea },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  tocado: { opacity: 0.6 },
  nombre: { flex: 1, color: C.tinta, fontSize: 15 },
  que: { color: C.sub },
  apagado: { color: C.apagado },
  flecha: { color: C.sub, fontSize: 14, width: 16, textAlign: 'center' },
  lista: { paddingBottom: 12 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  ejercicio: { color: C.sub, fontSize: 14, flexShrink: 1 },
  cantidad: { color: C.apagado, fontSize: 13, fontVariant: ['tabular-nums'] },
  bloques: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, maxWidth: '55%' },
  bloque: { width: 16, height: 12, borderRadius: 3, backgroundColor: C.principal },
});
