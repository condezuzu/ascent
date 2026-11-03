import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import Aparece from './Aparece';
import { ORDEN_SEMANA, tituloDelDia, type DiaDeSemana } from '@nucleo/rutinas';
import { T } from '@nucleo/textos';
import { nombreVisible } from '@nucleo/propios';
import type { CatalogoDeRutina } from '@compartido/rutinas';
import { C, conTema } from './colores';
import { useTema } from './useTema';
import { Text, TextoAnimado } from './Texto';
import { L } from './fuentes';
import { LLEGA, MS, sinMovimiento } from './movimiento';

/**
 * UNA RUTINA PLEGADA POR DÍA (14/10): "Lunes — Pecho, hombro y brazo", y al
 * tocar el día se abre con sus ejercicios. Antes era una lista larguísima de
 * todos los ejercicios de la semana, imposible de leer.
 *
 * La misma pieza en los tres lugares donde se ve una rutina: Stats, el perfil
 * propio y el de un amigo. Para editar, quien la usa le pasa `abajoDelDia`: lo
 * que va adentro del día abierto en lugar de la lista de solo lectura.
 *
 * TU RUTINA LLEGA (2/11, aprobada en la galería): con `llega` las rayas se dibujan, los días suben en
 * cascada y el de `abiertoAlEmpezar` se abre solo. Abrir y cerrar corre, en todos lados: saltaba.
 */
const SE_ABRE_EL_DIA_MS = 620;
/** Lo que va debajo espera hasta acá: la curva de `Aparece` llega despacio y ya casi no empuja. */
export const YA_SE_ABRIO_EL_DIA_MS = SE_ABRE_EL_DIA_MS + 300;

export default function RutinaPlegada({
  dias,
  catalogo,
  soloConAlgo = false,
  abajoDelDia,
  abiertoAlEmpezar,
  abiertos = false,
  llega = false,
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
  /** Es lo primero que se ve de la pantalla: entra en cascada. */
  llega?: boolean;
  testID?: string;
}) {
  useTema();
  const [abierto, setAbierto] = useState<number | null>(llega ? null : (abiertoAlEmpezar ?? null));
  const tocado = useRef(false);
  // El día de hoy se abre solo, después de que llegaron los días. Si ya tocó otro, no se le cambia.
  useEffect(() => {
    if (!llega || abiertoAlEmpezar === undefined) return;
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      espera = setTimeout(() => {
        if (!tocado.current) setAbierto(abiertoAlEmpezar);
      }, quieto ? 0 : SE_ABRE_EL_DIA_MS);
    });
    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
    };
    // Una vez, al llegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const grupoDe = (id: string) => catalogo.get(id)?.grupo ?? null;
  const visibles = ORDEN_SEMANA.filter((d) => !soloConAlgo || dias[d].descanso || dias[d].ejercicios.length > 0);

  return (
    <View testID={testID}>
      {visibles.map((d, indice) => {
        const dia = dias[d];
        const titulo = tituloDelDia(dia, grupoDe, T.rutina.descanso);
        const vacio = !dia.descanso && dia.ejercicios.length === 0;
        const esAbierto = abiertos || abierto === d;
        return (
          <View key={d} style={[estilos.dia, !llega && estilos.diaConRaya]}>
            {llega && <RayaQueSeDibuja indice={indice} />}
            <QueSube activo={llega} indice={indice}>
              {/* CON TODOS ABIERTOS NO SE PLIEGA (20/10): la flechita y el toque no hacían nada. */}
              <Pressable
                testID={`rutina-dia-${d}`}
                style={({ pressed }) => [estilos.cabecera, pressed && !abiertos && estilos.tocado]}
                onPress={() => {
                  tocado.current = true;
                  setAbierto(esAbierto ? null : d);
                }}
                disabled={abiertos}
                accessibilityRole={abiertos ? undefined : 'button'}
                accessibilityState={abiertos ? undefined : { expanded: esAbierto }}
              >
                <Text style={estilos.nombre} numberOfLines={1}>
                  {T.fechas.diasLargos[d]}
                  <Text style={vacio || dia.descanso ? estilos.apagado : estilos.que}>
                    {' — '}
                    {vacio ? T.rutina.sinCargar : titulo || T.rutina.sinCargar}
                  </Text>
                </Text>
                {!abiertos && <FlechaQueGira abierta={esAbierto} />}
              </Pressable>
            </QueSube>
            <Aparece visible={esAbierto}>
              {abajoDelDia ? (
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
              )}
            </Aparece>
          </View>
        );
      })}
    </View>
  );
}

// Cuándo le toca a cada día, en la cascada de `llega`.
const demoraDelDia = (indice: number) => 210 + indice * 62;

function RayaQueSeDibuja({ indice }: { indice: number }) {
  useTema();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      if (quieto) return t.setValue(1);
      Animated.timing(t, { toValue: 1, duration: 560, delay: demoraDelDia(indice), easing: LLEGA, useNativeDriver: true }).start();
    });
    return () => {
      vivo = false;
    };
  }, [indice, t]);
  return <Animated.View pointerEvents="none" testID="raya-de-rutina" style={[estilos.raya, { transformOrigin: 'left', transform: [{ scaleX: t }] }]} />;
}

function QueSube({ activo, indice, children }: { activo: boolean; indice: number; children: ReactNode }) {
  useTema();
  const t = useRef(new Animated.Value(activo ? 0 : 1)).current;
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    void sinMovimiento().then((quieto) => {
      if (!vivo) return;
      if (quieto) return t.setValue(1);
      Animated.timing(t, { toValue: 1, duration: 460, delay: demoraDelDia(indice) + 40, easing: LLEGA, useNativeDriver: true }).start();
    });
    return () => {
      vivo = false;
    };
  }, [activo, indice, t]);
  return <Animated.View style={{ opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }}>{children}</Animated.View>;
}

/** La misma flecha, girando: dos dibujos que se reemplazan se ven como un salto. */
function FlechaQueGira({ abierta }: { abierta: boolean }) {
  useTema();
  const t = useRef(new Animated.Value(abierta ? 1 : 0)).current;
  useEffect(() => {
    void sinMovimiento().then((quieto) => {
      Animated.timing(t, { toValue: abierta ? 1 : 0, duration: quieto ? 0 : MS.pulgar, easing: LLEGA, useNativeDriver: true }).start();
    });
  }, [abierta, t]);
  return <TextoAnimado style={[estilos.flecha, { transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }]}>⌄</TextoAnimado>;
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
  useTema();
  return (
    <View style={estilos.bloques} accessible accessibilityLabel={T.rutina.series(series)}>
      {Array.from({ length: series }, (_, i) => (
        <BloqueDeSerie key={i} indice={desde + i} />
      ))}
    </View>
  );
}

function BloqueDeSerie({ indice }: { indice: number }) {
  useTema();
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
          easing: LLEGA,
          useNativeDriver: true,
        }).start();
      });
    return () => {
      vivo = false;
    };
  }, [indice, t]);
  return <Animated.View style={[estilos.bloque, { opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]} />;
}

const estilos = conTema(() => StyleSheet.create({
  dia: {},
  diaConRaya: { borderTopWidth: 1, borderTopColor: C.linea },
  raya: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: C.linea },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  tocado: { opacity: 0.6 },
  nombre: { flex: 1, color: C.tinta, fontSize: 15 },
  que: { color: C.sub },
  apagado: { color: C.apagado },
  flecha: { color: C.sub, fontSize: 14, width: 16, textAlign: 'center' },
  lista: { paddingBottom: 12 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  ejercicio: { color: C.sub, fontSize: 14, flexShrink: 1 },
  cantidad: { color: C.apagado, fontSize: 13, fontFamily: L.dato },
  bloques: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, maxWidth: '55%' },
  bloque: { width: 16, height: 12, borderRadius: 1, backgroundColor: C.cuadro },
}));
