import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DIAS_SEMANA, deISO, fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { C } from './colores';
import DiaDeLaTira from './DiaDeLaTira';
import PuntoDelDia, { type EstadoDelDia } from './PuntoDelDia';

/**
 * "FALTASTE Y SE USÓ UNA VIDA." La ventana del día siguiente, en nativo.
 *
 * Primero una animación corta —las vidas que se usaron se apagan, una por una— y después
 * (18/10, a pedido) la semana de ese día con un cuadro que apunta al día que faltaste:
 * «Faltaste aquí. ¿Usar la vida?», Sí o No. "No" la guarda para otra vez (vuelve la vida y
 * la racha queda diez días abajo); el precio va chico en el mismo cuadro.
 *
 * "SÍ FUI, CORREGIR DÍA" sale solo si Salud tiene un entrenamiento de fuerza ese día: es
 * lo único que la app sabe de que entrenaste. Lleva al calendario de Stats con el día
 * abierto, que es el flujo de corregir de siempre.
 *
 * SALE UNA SOLA VEZ POR CADA VIDA: quien la monta la anota como vista al mostrarse
 * (`alMostrar`), no al tocar un botón. Antes, escondida por un entrenamiento en
 * marcha, volvía al terminar.
 */
const APAGA_MS = 380;
const ENTRE_VIDAS_MS = 220;
const ESPERA_MS = 350;
// El cuadro entra cuando la semana ya entró (la entrada de `DiaDeLaTira` dura ~0,7 s).
const CUADRO_DESPUES_MS = 520;
const PUNTO = 26;

type DiaDeLaSemana = { fecha: string; estadoDia: EstadoDelDia; esHoy: boolean };

export default function RachaSalvada({
  dias,
  quedan,
  total,
  rachaSiGuarda,
  semana,
  rango,
  alMostrar,
  alGuardar,
  alCorregir,
  alCerrar,
}: {
  dias: string[];
  quedan: number;
  total: number;
  rachaSiGuarda: number;
  /** La semana (de lunes a domingo) del último día que se cubrió. */
  semana: DiaDeLaSemana[];
  rango: number;
  /** Se llama una vez, al aparecer: ahí queda vista. */
  alMostrar: () => void;
  alGuardar: () => Promise<boolean>;
  alCorregir: (fecha: string) => void;
  alCerrar: () => void;
}) {
  const [paso, setPaso] = useState<'animando' | 'pregunta' | 'guardando' | 'guardada'>('animando');
  const [fallo, setFallo] = useState(false);
  const [ancho, setAncho] = useState(0);
  const [diaEntrenado, setDiaEntrenado] = useState<string | null>(null);
  const usadas = Math.min(dias.length, Math.max(0, total - quedan));
  // Una por vida que se usó: arranca prendida y se apaga.
  const apagan = useRef(Array.from({ length: usadas }, () => new Animated.Value(1))).current;
  const cuadro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    alMostrar();
    plataforma.haptica.pulso();
    Animated.sequence([
      Animated.delay(ESPERA_MS),
      Animated.stagger(
        ENTRE_VIDAS_MS,
        apagan.map((v) => Animated.timing(v, { toValue: 0, duration: APAGA_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }))
      ),
    ]).start(() => {
      setPaso((p) => (p === 'animando' ? 'pregunta' : p));
      Animated.timing(cuadro, { toValue: 1, duration: 320, delay: CUADRO_DESPUES_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
    // `null` es "no sé" (sin permiso, sin Health): solo un `true` muestra el link.
    let vivo = true;
    void Promise.all(dias.map((d) => plataforma.salud.entrenoEse(d).catch(() => null))).then((r) => {
      const i = r.lastIndexOf(true);
      if (vivo && i >= 0) setDiaEntrenado(dias[i]);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    setPaso('guardando');
    setFallo(false);
    const ok = await alGuardar();
    setFallo(!ok);
    setPaso(ok ? 'guardada' : 'pregunta');
  }

  const uno = dias.length === 1;
  // Las que quedan, prendidas; las que se usaron, apagándose; el resto, vacías.
  const puntos = Array.from({ length: total }, (_, i) => (i < quedan ? 'viva' : i < quedan + usadas ? 'apaga' : 'vacia'));
  // La cola sale del centro del día: la tira es de punta a punta y los días van repartidos.
  const indice = Math.max(0, semana.findIndex((d) => d.fecha === dias[dias.length - 1]));
  const colaX = PUNTO / 2 + (indice * (ancho - PUNTO)) / 6;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={alCerrar} statusBarTranslucent>
      <View style={estilos.fondo} testID="vida-usada">
        <View>
          {paso === 'guardada' ? (
            <>
              <Text style={estilos.titulo}>{T.impulso.salvada.guardada(dias.length)}</Text>
              <Text style={estilos.detalle}>{T.inicio.perdida}</Text>
            </>
          ) : (
            <>
              <Text style={estilos.detalle}>
                {uno ? T.impulso.faltasteUno(fechaLinda(dias[0])) : T.impulso.faltasteVarios(dias.length)}
              </Text>
              <View style={estilos.vidas}>
                {puntos.map((p, i) => {
                  if (p !== 'apaga') return <View key={i} style={[estilos.vida, p === 'viva' && estilos.vidaViva]} />;
                  const v = apagan[i - quedan];
                  return (
                    <View key={i} style={estilos.vida}>
                      <Animated.View
                        style={[
                          estilos.vidaViva,
                          estilos.relleno,
                          {
                            opacity: v,
                            transform: [{ scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 1.5, 1] }) }],
                          },
                        ]}
                      />
                    </View>
                  );
                })}
                <Text style={estilos.quedanTexto}>{T.impulso.quedan(quedan)}</Text>
              </View>
            </>
          )}

          {paso !== 'animando' && paso !== 'guardada' && (
            <View style={estilos.semana}>
              <View style={estilos.tira} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
                {semana.map((d, i) => (
                  <DiaDeLaTira key={d.fecha} indice={i} hoyRegistrado={false} rango={rango} letra={DIAS_SEMANA[deISO(d.fecha).getDay()]} estiloLetra={estilos.letra}>
                    <PuntoDelDia estado={d.estadoDia} esHoy={d.esHoy} />
                  </DiaDeLaTira>
                ))}
              </View>

              <Animated.View style={[estilos.cuadro, { opacity: cuadro }]} testID="vida-cuadro">
                {ancho > 0 && <View pointerEvents="none" style={[estilos.cola, { left: colaX - 6 - StyleSheet.hairlineWidth }]} />}
                <Text style={estilos.pregunta}>{T.impulso.salvada.cuadro(dias.length)}</Text>
                <Text style={estilos.precio}>{T.impulso.salvada.precioNo(rachaSiGuarda)}</Text>
                {fallo && <Text style={[estilos.precio, estilos.peligro]}>{T.impulso.salvada.noSeGuardo}</Text>}
                <View style={estilos.botones}>
                  <Pressable testID="vida-si" style={[estilos.boton, estilos.enFila, estilos.solido]} onPress={alCerrar} disabled={paso === 'guardando'} accessibilityRole="button">
                    <Text style={estilos.solidoTexto}>{T.impulso.salvada.si}</Text>
                  </Pressable>
                  <Pressable testID="vida-no" style={[estilos.boton, estilos.enFila, estilos.borde]} onPress={() => void guardar()} disabled={paso === 'guardando'} accessibilityRole="button">
                    <Text style={estilos.bordeTexto}>{paso === 'guardando' ? T.sesion.guardando : T.impulso.salvada.no}</Text>
                  </Pressable>
                </View>
                {diaEntrenado && (
                  <Pressable testID="vida-corregir" style={estilos.link} onPress={() => alCorregir(diaEntrenado)} disabled={paso === 'guardando'} hitSlop={8} accessibilityRole="link">
                    <Text style={estilos.linkTexto}>{T.impulso.salvada.siFui}</Text>
                  </Pressable>
                )}
              </Animated.View>
            </View>
          )}
        </View>

        {paso === 'guardada' && (
          <Pressable style={[estilos.boton, estilos.solido]} onPress={alCerrar}>
            <Text style={estilos.solidoTexto}>{T.general.entendido}</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(5,6,10,0.96)', paddingHorizontal: 28, paddingTop: 110, paddingBottom: 40, justifyContent: 'space-between' },
  titulo: { color: C.tinta, fontSize: 30, fontWeight: '300', marginBottom: 14 },
  detalle: { color: C.sub, fontSize: 16, lineHeight: 23 },
  vidas: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  vida: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: C.apagado, alignItems: 'center', justifyContent: 'center' },
  vidaViva: { backgroundColor: C.claro, borderColor: C.claro },
  relleno: { position: 'absolute', left: -1, top: -1, width: 14, height: 14, borderRadius: 7 },
  quedanTexto: { color: C.sub, fontSize: 14, marginLeft: 6 },
  semana: { marginTop: 48 },
  tira: { flexDirection: 'row', justifyContent: 'space-between' },
  letra: { color: C.apagado, fontSize: 11 },
  // El cuadro: los bordes rectos de la app, con la cola del globo de cómic (`GloboComic`).
  cuadro: {
    marginTop: 16,
    padding: 18,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    backgroundColor: C.hoja,
  },
  cola: {
    position: 'absolute',
    top: -6.5,
    width: 12,
    height: 12,
    backgroundColor: C.hoja,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    transform: [{ rotate: '45deg' }],
  },
  pregunta: { color: C.tinta, fontSize: 22, fontWeight: '300', lineHeight: 29 },
  precio: { color: C.sub, fontSize: 13, lineHeight: 18, marginTop: 8 },
  botones: { flexDirection: 'row', gap: 10, marginTop: 18 },
  boton: { borderRadius: 2, paddingVertical: 15, alignItems: 'center' },
  enFila: { flex: 1 },
  solido: { backgroundColor: C.claro },
  solidoTexto: { color: C.fondo, fontSize: 16, fontWeight: '600' },
  borde: { borderWidth: 1, borderColor: C.lineaFuerte },
  bordeTexto: { color: C.tinta, fontSize: 16 },
  link: { alignSelf: 'flex-start', marginTop: 16 },
  linkTexto: { color: C.sub, fontSize: 13, textDecorationLine: 'underline' },
  peligro: { color: C.error },
});
