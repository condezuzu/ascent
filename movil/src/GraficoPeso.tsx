import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { conComa, deKilos, trazarPesoEnElTiempo, type Unidad } from '@nucleo/peso';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { C, conAlfa, conTema } from './colores';
import { useTema } from './useTema';
import { CifraJunta, Text } from './Texto';
import { L } from './fuentes';
import Tocable from './Tocable';
import { EjeDeTiempo, LineaDeTendencia, PuntoElegido, leerConVoiceOver, useLectura } from './PiezasDeGrafico';

/**
 * LA TENDENCIA DEL PESO, en la app nativa. La media móvil es la de la web (`nucleo/tendencia.ts`,
 * donde están los porqués); el dibujo no (1/11): era una línea de 84 px sin fechas ni escala, con
 * los puntos repartidos parejo, y tres semanas sin pesarse ocupaban lo mismo que un día. Ahora el
 * tiempo va a escala, abajo dice cuándo, a la derecha dice cuánto, y cada anotación es un punto
 * sobre la línea.
 *
 *   - AL TOCAR SE MUESTRA EL PESO CRUDO, no el suavizado, igual que en la web: el suavizado es una
 *     afirmación sobre la tendencia, y esto es la pregunta "cuánto pesaba ese día".
 *   - EL NÚMERO VA ARRIBA Y NO SE MUEVE: lo que se lee queda en el mismo lugar, y el dedo no lo tapa.
 */

const ALTO = 150;
const VENTANA = 7;

// Las ventanas de tiempo. `null` es todo el historial.
const RANGOS: { dias: number | null; etiqueta: () => string }[] = [
  { dias: 30, etiqueta: () => T.stats.pesoMes },
  { dias: 90, etiqueta: () => T.stats.pesoTresMeses },
  { dias: null, etiqueta: () => T.stats.pesoTodo },
];

export default function GraficoPeso({
  pesos,
  unidad,
  claro,
  objetivo = null,
}: {
  pesos: { fecha: string; valor: number }[];
  unidad: Unidad;
  /** El `--pal-claro` de la web: la paleta del rango. */
  claro: string;
  /** En kilos: la línea a la que se quiere llegar. */
  objetivo?: number | null;
}) {
  useTema();
  const [rango, setRango] = useState<number | null>(null);
  const [tocado, setTocado] = useState<number | null>(null);
  const [ancho, setAncho] = useState(0);

  const trazo = useMemo(() => (ancho > 0 ? trazarPesoEnElTiempo(pesos, unidad, rango, ancho, ALTO, VENTANA) : null), [pesos, unidad, rango, ancho]);
  const xs = useMemo(() => trazo?.puntos.map((p) => p.x) ?? [], [trazo]);
  const lectura = useLectura(xs, tocado, setTocado);
  const elegido = tocado === null || !trazo ? null : trazo.serie[tocado];
  const posElegido = tocado === null || !trazo ? null : trazo.puntos[tocado];
  const referencia = useMemo(() => {
    if (!trazo || objetivo === null) return null;
    const enUnidad = deKilos(objetivo, unidad);
    const y = trazo.yDe(enUnidad);
    // Solo si cae adentro: pegada al borde no diría nada, y agrandar la escala achicaría lo demás.
    return y >= 2 && y <= ALTO - 2 ? { y, texto: conComa(Math.round(enUnidad)) } : null;
  }, [trazo, objetivo, unidad]);

  return (
    <View style={estilos.grafico}>
      {trazo && (
        <View style={estilos.pie} onStartShouldSetResponder={() => tocado !== null} onResponderRelease={() => setTocado(null)}>
          <Text testID="peso-cifra" style={estilos.hoy}>
            <CifraJunta texto={conComa((elegido ? elegido.valor : trazo.hoy).toFixed(1))} apretar={-7} />
            <Text style={estilos.unidad}> {unidad}</Text>
          </Text>
          {/* Con signo, siempre: sin él, "0.4" no dice si subiste o bajaste. */}
          <Text testID="peso-detalle" style={estilos.cambio}>
            {elegido
              ? fechaLinda(elegido.fecha)
              : T.stats.pesoCambio(trazo.dias, `${trazo.cambio >= 0 ? '+' : '−'}${conComa(Math.abs(trazo.cambio).toFixed(1))}`, unidad)}
          </Text>
        </View>
      )}

      <View
        testID="peso-lienzo"
        style={estilos.lienzo}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        {...lectura}
        accessible
        accessibilityLabel={T.stats.pesoTendencia}
        accessibilityHint={T.progreso.leer}
        accessibilityValue={trazo ? { text: elegido ? `${fechaLinda(elegido.fecha)}: ${conComa(elegido.valor.toFixed(1))} ${unidad}` : `${conComa(trazo.hoy.toFixed(1))} ${unidad}` } : undefined}
        {...leerConVoiceOver(xs.length, tocado, setTocado)}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {trazo && (
            <LineaDeTendencia
              trazo={trazo}
              ancho={ancho}
              alto={ALTO}
              color={claro}
              clave={rango}
              idRelleno="peso-relleno"
              conPuntos
              rotular={conComa}
              referencia={referencia}
            />
          )}
          {posElegido && <PuntoElegido x={posElegido.x} y={posElegido.y} alto={ALTO} ancho={ancho} color={claro} />}
          {/* La ventana elegida no tiene dos anotaciones: con los botones para volver, no se va entero. */}
          {ancho > 0 && !trazo && <Text style={estilos.sinVentana}>{T.stats.pesoSinVentana}</Text>}
        </View>
      </View>
      <EjeDeTiempo marcas={trazo?.tiempo ?? []} />

      {/* La ventana. Con todo el historial, tres meses de una bajada de dos
          kilos se ven planos: la escala la manda el punto más lejano. */}
      <View style={estilos.rangos}>
        {RANGOS.map((r) => {
          const activo = r.dias === rango;
          return (
            <Tocable
              key={String(r.dias)}
              hitSlop={8}
              onPress={() => {
                setRango(r.dias);
                setTocado(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
            >
              <Text
                style={[
                  estilos.rango,
                  activo && { color: claro, borderBottomWidth: 1, borderColor: conAlfa(claro, 0.45) },
                ]}
              >
                {r.etiqueta()}
              </Text>
            </Tocable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = conTema(() => StyleSheet.create({
  grafico: { paddingTop: 6, paddingBottom: 6 },
  lienzo: { height: ALTO },
  pie: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, marginBottom: 14 },
  hoy: { color: C.tinta, fontSize: 30, fontWeight: '300', fontFamily: L.dato },
  unidad: { color: C.sub, fontSize: 13 },
  cambio: { flexShrink: 1, color: C.apagado, fontSize: 11, letterSpacing: 0.7, fontFamily: L.dato, textAlign: 'right' },
  sinVentana: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 20, maxWidth: '82%' },
  rangos: { flexDirection: 'row', gap: 14, marginTop: 8 },
  rango: { color: C.apagado, fontSize: 12, paddingVertical: 4 },
}));
