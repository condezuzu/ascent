import { useContext, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { T } from '@nucleo/textos';
import { deISO } from '@nucleo/fechas';
import { C, conAlfa, conTema, luz } from './colores';
import { ContextoLlegada } from './Entra';
import { L } from './fuentes';
import { LLEGA, sinMovimiento } from './movimiento';
import NumeroQueCuenta from './NumeroQueCuenta';
import { Text } from './Texto';
import Tocable from './Tocable';
import { useTema } from './useTema';

const ALTO_MESES = 56;

/**
 * UN NÚMERO POR PANTALLA (2/11, «Cifras» en la galería). Stats contesta una pregunta, en grande: cuántos
 * días este año. Debajo, una raya por mes, y tres números chicos sin caja: la caja hacía que todos
 * pesaran lo mismo. Tocar los meses abre el año entero (\`alTocarMeses\`).
 */
export default function CifrasDelAno({
  fechas,
  hoy,
  esteMes,
  esteAno,
  mejor,
  faltados,
  anoAbierto,
  alTocarMeses,
}: {
  /** Los días entrenados, de cualquier año. */
  fechas: string[];
  hoy: string;
  esteMes: number;
  esteAno: number;
  mejor: number;
  faltados: number | null;
  anoAbierto: boolean;
  alTocarMeses: () => void;
}) {
  useTema();
  const ahora = deISO(hoy);
  const porMes = useMemo(() => {
    const cuenta = Array.from({ length: 12 }, () => 0);
    for (const f of fechas) {
      const d = deISO(f);
      if (d.getFullYear() === ahora.getFullYear()) cuenta[d.getMonth()]++;
    }
    return cuenta;
  }, [fechas, ahora.getFullYear()]); // eslint-disable-line react-hooks/exhaustive-deps
  const techo = Math.max(1, ...porMes);
  const chicos = [
    { v: esteMes, e: T.stats.esteMes },
    { v: mejor, e: T.stats.mejorRacha },
    ...(faltados === null ? [] : [{ v: faltados, e: T.stats.diasFaltados }]),
  ];
  return (
    <View style={estilos.todo} testID="cifras-del-ano">
      <NumeroQueCuenta testID="stats-cifra" valor={esteAno} desdeCero style={estilos.grande} />
      <Text style={estilos.queEs}>{T.stats.diasEsteAno}</Text>
      <Tocable
        testID="meses-del-ano"
        hundir={1}
        onPress={alTocarMeses}
        accessibilityRole="button"
        accessibilityLabel={T.stats.elAno}
        accessibilityState={{ expanded: anoAbierto }}
      >
        <View style={estilos.meses}>
          {porMes.map((n, i) => (
            <RayaDeMes key={i} indice={i} alto={Math.max(2, (n / techo) * ALTO_MESES)} deHoy={i === ahora.getMonth()} />
          ))}
        </View>
        <View style={estilos.letras}>
          {T.fechas.meses.map((m, i) => (
            <Text key={m} style={[estilos.letra, i === ahora.getMonth() && estilos.letraDeHoy]}>
              {m.charAt(0).toUpperCase()}
            </Text>
          ))}
        </View>
      </Tocable>
      <View style={estilos.chicos}>
        {chicos.map((c, i) => (
          <View key={c.e} style={[estilos.chico, i > 0 && estilos.chicoConLinea]}>
            <NumeroQueCuenta testID="stats-cifra" valor={c.v} desdeCero style={estilos.valor} />
            <Text style={estilos.etiqueta}>{c.e}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RayaDeMes({ indice, alto, deHoy }: { indice: number; alto: number; deHoy: boolean }) {
  useTema();
  const llegada = useContext(ContextoLlegada);
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      if (quieto) return t.setValue(1);
      t.setValue(0);
      Animated.timing(t, { toValue: 1, duration: 560, delay: 120 + indice * 34, easing: LLEGA, useNativeDriver: true }).start();
    });
    return () => {
      vivo = false;
    };
  }, [llegada, indice, t]);
  return (
    <View style={estilos.lugarDeRaya}>
      <Animated.View style={[estilos.raya, { height: alto, transformOrigin: 'bottom', transform: [{ scaleY: t }] }, deHoy && estilos.rayaDeHoy]} />
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  todo: { marginBottom: 26 },
  grande: { color: C.claro, fontFamily: L.racha, fontWeight: '200', fontSize: 112, lineHeight: 112, letterSpacing: -4, marginLeft: -5 },
  queEs: { color: C.sub, fontSize: 14, marginTop: 4 },
  meses: { flexDirection: 'row', alignItems: 'flex-end', height: ALTO_MESES, marginTop: 18 },
  lugarDeRaya: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: ALTO_MESES },
  raya: { width: 3, borderRadius: 2, backgroundColor: conAlfa(C.claro, 0.52) },
  rayaDeHoy: { backgroundColor: C.claro, ...luz(C.claro, 0.8, 5) },
  letras: { flexDirection: 'row', marginTop: 6 },
  letra: { flex: 1, textAlign: 'center', color: C.sub, fontSize: 10, fontFamily: L.dato },
  letraDeHoy: { color: C.claro },
  chicos: { flexDirection: 'row', marginTop: 24, borderTopWidth: 1, borderTopColor: C.lineaFuerte },
  chico: { flex: 1, paddingTop: 12 },
  chicoConLinea: { paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: C.linea },
  valor: { color: C.tinta, fontFamily: L.dato, fontWeight: '300', fontSize: 26, lineHeight: 30, letterSpacing: -1 },
  etiqueta: { color: C.sub, fontSize: 12, marginTop: 2 },
}));
