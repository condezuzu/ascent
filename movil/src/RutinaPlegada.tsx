import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ORDEN_SEMANA, tituloDelDia, type DiaDeSemana } from '@nucleo/rutinas';
import { T } from '@nucleo/textos';
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
  testID,
}: {
  dias: DiaDeSemana[];
  catalogo: CatalogoDeRutina;
  soloConAlgo?: boolean;
  abajoDelDia?: (dia: number) => ReactNode;
  testID?: string;
}) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const grupoDe = (id: string) => catalogo.get(id)?.grupo ?? null;
  const visibles = ORDEN_SEMANA.filter((d) => !soloConAlgo || dias[d].descanso || dias[d].ejercicios.length > 0);

  return (
    <View testID={testID}>
      {visibles.map((d) => {
        const dia = dias[d];
        const titulo = tituloDelDia(dia, grupoDe, T.rutina.descanso);
        const vacio = !dia.descanso && dia.ejercicios.length === 0;
        const esAbierto = abierto === d;
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
                        {catalogo.get(e.ejercicio)?.nombre ?? e.ejercicio}
                      </Text>
                      <Text style={estilos.cantidad}>
                        {e.minutos !== undefined ? T.rutina.minutos(e.minutos) : e.series > 0 ? T.rutina.series(e.series) : ''}
                      </Text>
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
});
