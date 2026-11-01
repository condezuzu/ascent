import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fechaDeMarca, pesoLindo } from '@nucleo/fuerza';
import type { Unidad } from '@nucleo/peso';
import { T } from '@nucleo/textos';
import { C, conTema } from './colores';
import FondoOctogonal from './FondoOctogonal';
import { L } from './fuentes';
import { Text } from './Texto';
import Tocable from './Tocable';
import { useTema } from './useTema';

// Las tres que arman el número. Lo que cuenta lo dice la base (`ejercicios.cuenta_dots`), y estas tres
// son las que hay; el orden es el de siempre.
const LAS_TRES = [
  { id: 'sentadilla', nombre: () => T.fuerza.sentadillaCorto, linea: 'M50 26 C50 10 150 14 150 0' },
  { id: 'press_banca', nombre: () => T.fuerza.bancaCorto, linea: 'M150 26 L150 0' },
  { id: 'peso_muerto', nombre: () => T.fuerza.pesoMuertoCorto, linea: 'M250 26 C250 10 150 14 150 0' },
];

/**
 * EL NÚMERO SALE DE LAS TRES, Y SE VE (propuesta C, aprobada el 31/10). Decía «Faltan marcas: el
 * número sale de las tres, y con dos no se compara con nada.». Tres cajas con una línea cada una hasta
 * el número: la que tiene marca está prendida, y hasta que no estén las tres, el número es una raya.
 *
 * La fecha sigue pegada al peso (§16.5). Cada caja lleva a Mis marcas. VoiceOver lee el texto de siempre.
 */
export default function TresMarcas({
  marcas,
  dots,
  unidad,
  alTocar,
  explicacion,
}: {
  marcas: { ejercicio: string; kg: number; fecha: string }[];
  /** `null` mientras falte algo: las marcas, el sexo o el peso. */
  dots: string | null;
  unidad: Unidad;
  alTocar: () => void;
  explicacion: string;
}) {
  useTema();
  return (
    <View testID="tres-marcas">
      <Text
        style={[estilos.numero, dots !== null && estilos.numeroListo]}
        testID="fuerza-numero"
        accessibilityLabel={dots ?? explicacion}
      >
        {dots ?? '—'}
      </Text>
      <Svg width="100%" height={26} viewBox="0 0 300 26" preserveAspectRatio="none" pointerEvents="none">
        {LAS_TRES.map((t) => (
          <Path key={t.id} d={t.linea} fill="none" strokeWidth={1} stroke={marcas.some((m) => m.ejercicio === t.id) ? C.claro : C.lineaFuerte} />
        ))}
      </Svg>
      <View style={estilos.fila}>
        {LAS_TRES.map((t) => {
          const marca = marcas.find((m) => m.ejercicio === t.id);
          return (
            <Tocable key={t.id} style={estilos.caja} onPress={alTocar} testID={`marca-${t.id}`} accessibilityRole="button">
              <FondoOctogonal relleno={C.superficie} superficie borde={marca ? C.claro : C.bordeOcto} />
              <Text style={[estilos.kg, !marca && estilos.kgFalta]} numberOfLines={1}>{marca ? pesoLindo(marca.kg, unidad) : '—'}</Text>
              <Text style={estilos.nombre} numberOfLines={1}>{t.nombre()}</Text>
              {marca && <Text style={estilos.fecha} numberOfLines={1}>{fechaDeMarca(marca.fecha)}</Text>}
            </Tocable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  numero: { textAlign: 'center', color: C.apagado, fontSize: 46, fontWeight: '300', letterSpacing: -1.4, fontFamily: L.dato },
  numeroListo: { color: C.claro },
  fila: { flexDirection: 'row', gap: 8 },
  caja: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', gap: 3 },
  kg: { color: C.claro, fontSize: 14.5, letterSpacing: -0.4, fontFamily: L.dato },
  kgFalta: { color: C.apagado },
  nombre: { color: C.sub, fontSize: 10.5 },
  fecha: { color: C.apagado, fontSize: 9.5, fontFamily: L.dato },
}));
