import { StyleSheet, View } from 'react-native';
import { mesDeVidas, vidasDelMes, type DiaDelMes } from '@nucleo/mesDeVidas';
import { modosDeLasVidas } from '@nucleo/impulsos';
import { fechaLinda, fechasLindas, hoyISO } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { C, conTema } from './colores';
import Estrella from './Estrella';
import EstrellaQueTitila from './EstrellaQueTitila';
import { Text } from './Texto';
import { useTema } from './useTema';

const TAM = 18;
const CELDA = 30;

/**
 * LAS VIDAS EN STATS, CON EL MES ENTERO (12/11, sección 22 de la galería, variante B). Las vidas que quedan,
 * qué días cubrió una este mes, y el mes en un cuadrado: fuiste, descansaste, la vida, no fuiste. Sin la
 * racha repetida ni el número de días que faltan, que confundían (lo pidió el dueño).
 */
export default function VidasDelMes({
  vidas,
  fui,
  descansos,
  usadas,
  explicacion,
}: {
  vidas: { quedan: number; total: number; tope?: number };
  fui: Set<string>;
  descansos: Set<string>;
  /** Los días cubiertos por una vida que no se devolvió. */
  usadas: Set<string>;
  explicacion: string;
}) {
  useTema();
  const hoy = hoyISO();
  const celdas = mesDeVidas(hoy, fui, descansos, usadas);
  const delMes = vidasDelMes(hoy, usadas);
  // Lunes primero: `diasCortos` arranca en domingo.
  const letras = [...T.fechas.diasCortos.slice(1), T.fechas.diasCortos[0]];
  return (
    <View style={estilos.todo} testID="vidas-del-mes">
      <View style={estilos.estrellas} accessible accessibilityLabel={explicacion} testID="vidas-stats">
        {modosDeLasVidas(vidas).map((modo, i) => (
          <EstrellaQueTitila key={i} indice={i} modo={modo} tam={TAM} />
        ))}
      </View>
      {delMes.length > 0 && (
        <Text style={estilos.usadas} testID="vidas-usadas-del-mes">
          {delMes.length === 1 ? T.impulso.usasteUna(fechaLinda(delMes[0])) : T.impulso.usasteVarias(delMes.length, fechasLindas(delMes))}
        </Text>
      )}
      <View style={estilos.cuadro} testID="mes-de-vidas">
        {letras.map((l, i) => (
          <View key={`l${i}`} style={estilos.lugar}>
            <Text style={estilos.letra}>{l}</Text>
          </View>
        ))}
        {celdas.map((c, i) => (
          <View key={c?.fecha ?? `h${i}`} style={estilos.lugar}>
            {c && (
              <View style={[estilos.celda, estiloDe(c.que)]} testID={`mes-${c.que}`} accessibilityLabel={`${c.dia}`}>
                {c.que === 'vida' && <Estrella tam={11} modo="apagada" />}
              </View>
            )}
          </View>
        ))}
      </View>
      <View style={estilos.leyenda}>
        {(['fui', 'descanso', 'vida', 'no'] as const).map((q) => (
          <View key={q} style={estilos.item}>
            <View style={[estilos.chica, estiloDe(q)]} />
            <Text style={estilos.letra}>{{ fui: T.impulso.mesFuiste, descanso: T.impulso.mesDescanso, vida: T.impulso.mesVida, no: T.impulso.mesNo }[q]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function estiloDe(que: DiaDelMes) {
  switch (que) {
    case 'fui':
      return { backgroundColor: C.claro };
    case 'vida':
      return { borderWidth: 1, borderColor: C.claro };
    case 'descanso':
      return { borderWidth: 1, borderColor: C.lineaFuerte };
    case 'no':
      return { backgroundColor: C.superficie, borderWidth: 1, borderColor: C.linea };
    case 'hoy':
      return { borderWidth: 1, borderColor: C.claro, borderStyle: 'dashed' as const };
    default:
      return { borderWidth: 1, borderColor: C.linea, borderStyle: 'dashed' as const };
  }
}

const estilos = conTema(() => StyleSheet.create({
  todo: { gap: 12 },
  estrellas: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  usadas: { color: C.sub, fontSize: 13 },
  cuadro: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.linea, borderRadius: 2, paddingVertical: 12, paddingHorizontal: 8, rowGap: 8 },
  lugar: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center' },
  letra: { color: C.sub, fontSize: 10, letterSpacing: 1 },
  celda: { width: CELDA, height: CELDA, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chica: { width: 10, height: 10, borderRadius: 2 },
}));
