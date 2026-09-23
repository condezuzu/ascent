import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cuantosLevantan, type Medalla as Dato } from '@nucleo/medallas';
import { T } from '@nucleo/textos';
import Medalla from './Medalla';
import { C } from './colores';

/**
 * LAS MEDALLAS AL LADO DEL NOMBRE, y el globo al tocar una.
 *
 * AL LADO Y NO DEBAJO, y del alto del nombre (24 px contra 22 del nombre en el
 * perfil). Con `flexWrap`, un nombre largo las baja a la línea siguiente en vez
 * de esconderlas.
 *
 * ES UN GLOBO QUE SALE DE LA MEDALLA, no un cartel debajo (24/9, a pedido).
 * Un cartel es una sección más de la pantalla: aparece, se queda, y hay que
 * cerrarlo. Un globo con una punta que apunta a la medalla que tocaste dice de
 * quién está hablando sin nombrarlo, y se va solo.
 *
 * LA PUNTA SE CALCULA, PERO HAY QUE MEDIR DÓNDE EMPIEZAN LAS MEDALLAS. Entre
 * ellas la cuenta alcanza —todas del mismo ancho, misma separación: la punta va
 * en `índice × (tamaño + separación) + tamaño / 2`— pero la fila arranca con EL
 * NOMBRE, que mide lo que mida. Sin medir ese corrimiento, el globo apunta al
 * nombre en vez de a la medalla. Un solo `onLayout`, y solo sobre las medallas.
 *
 * VA FLOTANDO Y NO EN EL FLUJO. Si empujara lo de abajo, abrir un globo movería
 * media pantalla. Tapa un poco, que es lo que se pidió: "mejor si no tapa, pero
 * no importa si tapa".
 */

/** Cuánto queda a la vista antes de irse solo. */
const DURA_MS = 2000;

/** Los números del dibujo de la fila, que la punta necesita para apuntar. */
const SEPARACION = 7;

export default function Medallas({
  medallas,
  nombre,
  tam = 24,
}: {
  medallas: readonly Dato[];
  /** El nombre, que va en la misma fila. */
  nombre?: ReactNode;
  tam?: number;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  /** Dónde arrancan las medallas dentro de la fila: depende del ancho del nombre. */
  const [desdeX, setDesdeX] = useState(0);
  const elegida = medallas.find((m) => m.zona === abierta) ?? null;
  const cual = medallas.findIndex((m) => m.zona === abierta);

  // SE VA SOLA A LOS DOS SEGUNDOS. El temporizador se rearma con cada medalla
  // que se abre: tocar otra mientras una está abierta no deja el globo nuevo
  // con el tiempo de la anterior.
  useEffect(() => {
    if (!abierta) return;
    const t = setTimeout(() => setAbierta(null), DURA_MS);
    return () => clearTimeout(t);
  }, [abierta]);

  return (
    <View style={estilos.envoltura}>
      <View style={estilos.fila}>
        {nombre}
        <View style={estilos.medallas} onLayout={(e) => setDesdeX(e.nativeEvent.layout.x)}>
          {medallas.map((m) => (
            <Pressable
              key={m.zona}
              onPress={() => setAbierta(abierta === m.zona ? null : m.zona)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={frase(m)}
            >
              <Medalla zona={m.zona} material={m.material} tam={tam} />
            </Pressable>
          ))}
        </View>
      </View>

      {elegida && cual >= 0 && (
        <View style={estilos.globo} pointerEvents="none">
          {/* LA PUNTA: un cuadrado girado 45°, con la mitad de arriba asomando
              del globo. Es la forma más barata de hacer un triángulo sin traer
              un SVG por seis píxeles — la misma idea que la cruz de
              `GloboPrimeraVez`. */}
          <View style={[estilos.punta, { left: desdeX + cual * (tam + SEPARACION) + tam / 2 - 5 }]} />
          <View style={estilos.cuerpo}>
            <Text style={estilos.texto}>{frase(elegida)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * LO QUE DICE, en una línea: zona, material y la frase.
 *
 * "Pecho · Luna · Solo el 40% levanta este peso."
 *
 * EL MATERIAL VA EN EL MEDIO y no es decoración: a 24 px la luna y el planeta
 * se parecen —gris azulado contra azul— y sin nombrarlo no hay forma de saber
 * cuál te tocó.
 *
 * LA GALAXIA NO DICE PORCENTAJE: diría "solo el 5%", el mismo número que
 * estrella, y en el escalón más alto eso queda plano. Dice qué la ganó.
 */
function frase(m: Dato): string {
  const cola =
    m.material === 'galaxia' ? T.medallas.galaxia : T.medallas.frase(cuantosLevantan(m.percentil));
  return `${T.medallas.zonas[m.zona]} · ${T.medallas.materiales[m.material]} · ${cola}`;
}

/**
 * LAS MEDALLAS Y NADA MÁS, sin tocar. Para Inicio, donde la fila del nombre YA
 * es un botón que lleva al perfil: una medalla que se abriera ahí competiría
 * con ese toque y dejaría al que apunta mal en la pantalla equivocada. Se ven;
 * para saber qué son, se entra al perfil.
 */
export function FilaDeMedallas({ medallas, tam = 16 }: { medallas: readonly Dato[]; tam?: number }) {
  if (medallas.length === 0) return null;
  return (
    <View style={estilos.sueltas} pointerEvents="none">
      {medallas.map((m) => (
        <Medalla key={m.zona} zona={m.zona} material={m.material} tam={tam} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  // Sin `overflow: hidden` en ningún ancestro de esto, o el globo se corta.
  envoltura: { position: 'relative' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: SEPARACION, flexWrap: 'wrap' },
  medallas: { flexDirection: 'row', alignItems: 'center', gap: SEPARACION },
  sueltas: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // FLOTANDO: abrir un globo no mueve nada de lo que hay abajo.
  globo: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6 },
  punta: {
    position: 'absolute',
    top: 0,
    width: 10,
    height: 10,
    backgroundColor: C.hoja,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    transform: [{ rotate: '45deg' }],
  },
  cuerpo: {
    marginTop: 5,
    backgroundColor: C.hoja,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  texto: { color: C.tinta, fontSize: 13, lineHeight: 18 },
});
