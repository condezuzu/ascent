import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { pesoCorto, type Unidad } from '@nucleo/peso';
import { REPETICIONES_PARA_MARCA } from '@nucleo/marcaSugerida';
import type { EstadoBloques } from '@nucleo/bloques';
import { T } from '@nucleo/textos';
import type { useMarcaEnElMomento } from '@compartido/marcaSugerida';
import { C, conTema } from './colores';
import { useTema } from './useTema';
import { Text } from './Texto';
import { L } from './fuentes';
import Tocable from './Tocable';

/**
 * "¿LO GUARDO COMO MARCA?", debajo del bloque y al confirmar la serie que puede
 * serlo (18/9). La misma que la web (`src/components/MarcaEnElMomento.tsx`): qué
 * se propone lo decide el núcleo y lo mira `useMarcaEnElMomento`. No tapa nada;
 * el `+` sigue andando mientras está a la vista.
 */
export default function MarcaEnElMomento({
  marca,
  bloques,
  unidad,
  principal,
  alAparecer,
  alIrse,
}: {
  /** El hook vive en Inicio: lo comparte con el cajón de la marca nueva (`CajonDeMarca`). */
  marca: ReturnType<typeof useMarcaEnElMomento>;
  bloques: EstadoBloques;
  unidad: Unidad;
  /** El `--pal-principal` de la web: la raya de la izquierda. */
  principal: string;
  /**
   * Cuando aparece una pregunta nueva, con su vista: la pantalla la trae a la
   * vista. Está pegada al `+` pero debajo del borde, y sin esto no se veía
   * (foto del 18/9). Acá no hay `scrollIntoView`: el scroll es de quien la usa.
   */
  alAparecer?: (vista: View) => void;
  /** Contestada o ida: la pantalla vuelve a donde estaba, con el + debajo del dedo. */
  alIrse?: () => void;
}) {
  useTema();
  const { actual, guardar, descartar } = marca;
  // La marca nueva ya guardada la cuenta el cajón de arriba, no este recuadro.
  const actualVisible = actual && !(actual.estado === 'guardada' && actual.esNueva) ? actual : null;
  const vista = useRef<View>(null);
  // SU LUGAR QUEDA AL IRSE (18/10). Guardada, se va a los 4,5 s —y desde el cajón (16/11), la
  // marca nueva apenas se contesta—, y lo de abajo —«La próxima, más»— subía bajo el dedo. Lo
  // último que se vio queda invisible en su lugar hasta la próxima serie, ejercicio o bloque, que
  // es cuando la pantalla cambia igual porque la persona tocó algo. Medir el alto no servía: en la
  // web onLayout no avisa al aparecer.
  const huella = `${bloques.ejercicio}:${bloques.hechas}:${bloques.cerrados.length}`;
  const ultimo = useRef<{ s: NonNullable<typeof actual>; huella: string } | null>(null);
  if (actualVisible) ultimo.current = { s: actualVisible, huella };
  const fantasma = !actualVisible && ultimo.current?.huella === huella;
  const s = actualVisible ?? (fantasma ? ultimo.current!.s : null);
  // Solo se trae a la vista mientras pregunta (23/11): con las repes ya sabidas solo avisa, y correr la pantalla
  // por un aviso movía el + debajo del dedo.
  const pregunta = actualVisible?.estado === 'preguntando' ? `${actualVisible.ejercicio}:${actualVisible.peso}` : null;
  useEffect(() => {
    // Un cuadro después: recién ahí la vista tiene su lugar medido.
    if (!pregunta) return;
    const t = setTimeout(() => vista.current && alAparecer?.(vista.current), 60);
    return () => {
      clearTimeout(t);
      alIrse?.();
    };
  }, [pregunta, alAparecer, alIrse]);
  if (!s) return null;
  return (
    <View
      ref={vista}
      testID={fantasma ? 'marca-reserva' : undefined}
      style={[estilos.todo, { borderColor: principal }, fantasma && estilos.fantasma]}
      pointerEvents={fantasma ? 'none' : 'auto'}
      accessibilityElementsHidden={fantasma}
      importantForAccessibility={fantasma ? 'no-hide-descendants' : 'auto'}
      accessibilityLiveRegion={fantasma ? 'none' : 'polite'}
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
      ) : s.reps === undefined ? (
        <>
          <Text style={estilos.cuantas}>{T.marcaSugerida.cuantas}</Text>
          <View style={estilos.reps}>
            {REPETICIONES_PARA_MARCA.map((r) => (
              <Tocable key={r} style={estilos.rep} disabled={s.estado === 'guardando'} onPress={() => guardar(r)}>
                <Text style={estilos.repTexto}>{r}</Text>
              </Tocable>
            ))}
            <Tocable style={[estilos.rep, estilos.no]} onPress={() => ((ultimo.current = null), descartar())}>
              <Text style={estilos.noTexto}>{T.marcaSugerida.no}</Text>
            </Tocable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  todo: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 2 },
  fantasma: { opacity: 0 },
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
  repTexto: { color: C.tinta, fontSize: 14, fontFamily: L.dato },
  no: { paddingHorizontal: 14 },
  noTexto: { color: C.sub, fontSize: 14 },
}));
