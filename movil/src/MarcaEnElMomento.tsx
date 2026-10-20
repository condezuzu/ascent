import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pesoCorto, type Unidad } from '@nucleo/peso';
import { REPETICIONES_PARA_MARCA } from '@nucleo/marcaSugerida';
import type { EstadoBloques } from '@nucleo/bloques';
import { T } from '@nucleo/textos';
import { useMarcaEnElMomento } from '@compartido/marcaSugerida';
import { C } from './colores';

/**
 * "¿LO GUARDO COMO MARCA?", debajo del bloque y al confirmar la serie que puede
 * serlo (18/9). La misma que la web (`src/components/MarcaEnElMomento.tsx`): qué
 * se propone lo decide el núcleo y lo mira `useMarcaEnElMomento`. No tapa nada;
 * el `+` sigue andando mientras está a la vista.
 */
export default function MarcaEnElMomento({
  bloques,
  inicio,
  unidad,
  principal,
  alAparecer,
}: {
  bloques: EstadoBloques;
  inicio: string | null;
  unidad: Unidad;
  /** El `--pal-principal` de la web: la raya de la izquierda. */
  principal: string;
  /**
   * Cuando aparece una pregunta nueva, con su vista: la pantalla la trae a la
   * vista. Está pegada al `+` pero debajo del borde, y sin esto no se veía
   * (foto del 18/9). Acá no hay `scrollIntoView`: el scroll es de quien la usa.
   */
  alAparecer?: (vista: View) => void;
}) {
  const { actual: s, guardar, descartar } = useMarcaEnElMomento(bloques, inicio);
  const vista = useRef<View>(null);
  // SU LUGAR QUEDA AL IRSE SOLA (18/10). Guardada, se va a los 4,5 s, y lo de abajo —«La
  // próxima, más»— subía 96 px bajo el dedo. Se reserva su alto hasta la próxima serie,
  // ejercicio o bloque, que es cuando la pantalla cambia igual porque la persona tocó algo.
  const huella = `${bloques.ejercicio}:${bloques.hechas}:${bloques.cerrados.length}`;
  const [reserva, setReserva] = useState<{ huella: string; alto: number } | null>(null);
  const clave = s ? `${s.ejercicio}:${s.peso}` : null;
  useEffect(() => {
    // Un cuadro después: recién ahí la vista tiene su lugar medido.
    if (!clave) return;
    const t = setTimeout(() => vista.current && alAparecer?.(vista.current), 60);
    return () => clearTimeout(t);
  }, [clave, alAparecer]);
  if (!s) return reserva?.huella === huella ? <View testID="marca-reserva" style={[estilos.reserva, { height: reserva.alto }]} /> : null;
  const seVaSola = s.estado === 'guardada' || s.estado === 'fallo';
  return (
    <View
      ref={vista}
      style={[estilos.todo, { borderColor: principal }]}
      accessibilityLiveRegion="polite"
      onLayout={(e) => seVaSola && setReserva({ huella, alto: e.nativeEvent.layout.height })}
    >
      <Text style={estilos.texto}>
        {(s.antes === null ? T.marcaSugerida.primera : T.marcaSugerida.puedeSerMarca)(pesoCorto(s.peso, unidad), unidad, s.nombre)}
      </Text>
      {s.estado === 'guardada' || s.estado === 'fallo' ? (
        <Text style={estilos.hecho}>
          {s.estado === 'fallo'
            ? T.marcaSugerida.fallo
            : s.esNueva
              ? T.marcaSugerida.guardadaEsNueva
              : T.marcaSugerida.guardada}
        </Text>
      ) : (
        <>
          <Text style={estilos.cuantas}>{T.marcaSugerida.cuantas}</Text>
          <View style={estilos.reps}>
            {REPETICIONES_PARA_MARCA.map((r) => (
              <Pressable key={r} style={estilos.rep} disabled={s.estado === 'guardando'} onPress={() => guardar(r)}>
                <Text style={estilos.repTexto}>{r}</Text>
              </Pressable>
            ))}
            <Pressable style={[estilos.rep, estilos.no]} onPress={descartar}>
              <Text style={estilos.noTexto}>{T.marcaSugerida.no}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  todo: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 2 },
  reserva: { marginTop: 14 },
  texto: { color: C.tinta, fontSize: 15, lineHeight: 21, marginBottom: 8 },
  hecho: { color: C.sub, fontSize: 13 },
  cuantas: { color: C.apagado, fontSize: 12, marginBottom: 6 },
  reps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rep: {
    minWidth: 40,
    minHeight: 40,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  repTexto: { color: C.tinta, fontSize: 14, fontVariant: ['tabular-nums'] },
  no: { paddingHorizontal: 14 },
  noTexto: { color: C.sub, fontSize: 14 },
});
