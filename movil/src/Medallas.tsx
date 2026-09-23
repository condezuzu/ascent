import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { cuantosLevantan, type Medalla as Dato } from '@nucleo/medallas';
import { CURVA } from '@nucleo/deslizar';
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

/**
 * CUÁNTO DURA EL GLOBO, EN TRES TIEMPOS (25/9).
 *
 * *"Que dure tres o cuatro segundos en vez de dos, y que NO desaparezca de
 * golpe, que se desvanezca. Aparecer rápido está bien."*
 *
 * Los tres números dicen exactamente eso: entra en un suspiro —lo que se toca
 * tiene que contestar ya—, se queda el tiempo de leer una línea sin apuro, y se
 * va despacio. Un cartel que se apaga de golpe se lee como un error; uno que se
 * desvanece se lee como que terminó de decir lo suyo.
 */
const ENTRA_MS = 120;
const QUIETO_MS = 3000;
const SALE_MS = 520;

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

  /**
   * ENTRA RÁPIDO, SE QUEDA, Y SE VA DESVANECIÉNDOSE.
   *
   * LA ANIMACIÓN SE REARMA CON CADA MEDALLA que se abre: tocar otra mientras
   * una está abierta no deja el globo nuevo con el tiempo de la anterior.
   *
   * Y TOCAR LA MISMA OTRA VEZ LO CIERRA DE UNA, sin esperar el desvanecido
   * —también a pedido—. Eso sale gratis de cómo está armado: el toque pone
   * `abierta` en `null`, este efecto corre, corta la animación en el cuadro en
   * que esté y deja la opacidad en cero.
   *
   * `setAbierta(null)` VA AL FINAL Y SOLO SI TERMINÓ: una animación cortada
   * llama igual a su callback, y sin ese guardia cerrar una medalla para abrir
   * otra cerraría la nueva un instante después.
   */
  const opacidad = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!abierta) {
      opacidad.setValue(0);
      return;
    }
    opacidad.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(opacidad, {
        toValue: 1,
        duration: ENTRA_MS,
        easing: Easing.bezier(...CURVA),
        useNativeDriver: true,
      }),
      Animated.delay(QUIETO_MS),
      Animated.timing(opacidad, {
        toValue: 0,
        duration: SALE_MS,
        easing: Easing.bezier(...CURVA),
        useNativeDriver: true,
      }),
    ]);
    seq.start(({ finished }) => {
      if (finished) setAbierta(null);
    });
    return () => seq.stop();
  }, [abierta, opacidad]);

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
        <Animated.View style={[estilos.globo, { opacity: opacidad }]} pointerEvents="none">
          {/* LA PUNTA: un cuadrado girado 45°, con la mitad de arriba asomando
              del globo. Es la forma más barata de hacer un triángulo sin traer
              un SVG por seis píxeles — la misma idea que la cruz de
              `GloboPrimeraVez`. */}
          <View style={[estilos.punta, { left: desdeX + cual * (tam + SEPARACION) + tam / 2 - 5 }]} />
          <View style={estilos.cuerpo}>
            <Text style={estilos.texto}>{frase(elegida)}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * LO QUE DICE, en una línea: el músculo y la frase.
 *
 * "Cuádriceps · Solo el 12% levanta esa marca."
 *
 * EL MATERIAL YA NO SE NOMBRA (25/9, a pedido): *"sacá los nombres de
 * material. Nada de Luna, Planeta. Que el material solo cambie el color, sin
 * nombrarlo."* Estaba por un argumento que sonaba bien —a este tamaño la luna
 * y el planeta se parecen, y sin la palabra no se sabe cuál te tocó— y el
 * argumento tenía el problema adentro: si hay que escribir qué es, el dibujo
 * no está diciendo nada. El material vuelve a ser lo que tiene que ser, una
 * escala de color, y la línea se queda con lo único que es un dato: el número.
 *
 * (Lo sigue diciendo la etiqueta del lector de pantalla, y ahí sí corresponde:
 * quien no ve el color no tiene de dónde sacarlo.)
 *
 * EL MÚSCULO Y NO LA ZONA: decía "Brazos" y "Piernas", que son los cajones del
 * selector de ejercicios, no lo que la medalla mide. Ver `T.medallas.zonas`.
 *
 * LA GALAXIA NO DICE PORCENTAJE: diría el mismo número que estrella, y en el
 * escalón más alto queda plano. Dice qué la ganó.
 */
function frase(m: Dato): string {
  const cola =
    m.material === 'galaxia' ? T.medallas.galaxia : T.medallas.frase(cuantosLevantan(m.percentil));
  return `${T.medallas.zonas[m.zona]} · ${cola}`;
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
  // POR ENCIMA DE TODO Y SIN EMPUJAR NADA. Lo primero ya estaba; lo segundo
  // necesita zIndex, porque un absoluto sin el se pinta en el orden del árbol
  // y lo que viene después lo tapa. Con `elevation` para Android, que no cuesta
  // nada y evita que esto se descubra de nuevo el día que exista.
  globo: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    zIndex: 30,
    elevation: 30,
  },
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
