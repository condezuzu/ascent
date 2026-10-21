import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DIAS_SEMANA, deISO, fechaLinda, fechasLindas } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { C } from './colores';
import DiaDeLaTira from './DiaDeLaTira';
import Estrella from './Estrella';
import PuntoDelDia, { type EstadoDelDia, type FrioDelDia } from './PuntoDelDia';

/**
 * EL AVISO DE LA VIDA, en nativo (rehecho el 19/10, con lo aprobado en la galería).
 *
 * Arriba las vidas, que titilan; debajo la semana; y un cuadro que apunta al día que no se
 * registró, con dos botones redondeados de colores fijos —no cambian con el rango—:
 * «Usar vida» (crema, con la estrella adentro) y «Guardar vida» (negro, «la racha baja 10
 * días»), y el link «Fui. Corregir día».
 *
 * USAR LA VIDA, EN UNA SOLA SECUENCIA: el texto del botón se comprime en su estrella, la
 * estrella brilla y salta al día, queda plantada, se congela (frío, un brillo, cristales
 * que titilan derechos) y sale el globito. Al día siguiente, en Inicio, se derrite.
 *
 * SALE UNA SOLA VEZ POR CADA VIDA: quien la monta la anota como vista al mostrarse
 * (`alMostrar`), no al tocar un botón.
 */
const PUNTO = 26;
const COMPRIME_MS = 220;
const VUELO_MS = 720;
const PLANTA_MS = 380;
const HIELA_MS = 700;
const CICLO_TITILEO_MS = 2400;

type DiaDeLaSemana = { fecha: string; estadoDia: EstadoDelDia; esHoy: boolean };
type Punto = { x: number; y: number };
type Fase = 'aviso' | 'usando' | 'helada' | 'guardando' | 'guardada' | 'corrigiendo' | 'corregida';

/** Una vida de la fila: titila con su desfase (aprobado en la galería: 2400 ms, 800 ms entre una y otra). */
function VidaQueTitila({ viva, indice }: { viva: boolean; indice: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!viva) return;
    const vuelta = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: CICLO_TITILEO_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: CICLO_TITILEO_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const espera = setTimeout(() => vuelta.start(), indice * (CICLO_TITILEO_MS / 3));
    return () => {
      clearTimeout(espera);
      vuelta.stop();
    };
  }, [viva, indice, t]);
  if (!viva) return <Estrella tam={22} modo="apagada" />;
  return (
    <Animated.View style={{ opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }), transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
      <Estrella tam={22} />
    </Animated.View>
  );
}

export default function RachaSalvada({
  dias,
  quedan,
  total,
  semana,
  rango,
  alMostrar,
  alGuardar,
  alCorregir,
  alUsada,
  alCerrar,
}: {
  dias: string[];
  quedan: number;
  total: number;
  /** La semana (de lunes a domingo) del último día que se cubrió. */
  semana: DiaDeLaSemana[];
  rango: number;
  /** Se llama una vez, al aparecer: ahí queda vista. */
  alMostrar: () => void;
  alGuardar: () => Promise<boolean>;
  /** Marca "Fui" en todos los días del aviso. `false` si no se pudo. */
  alCorregir: () => Promise<boolean>;
  /** La vida quedó plantada y congelada en el día: Inicio se acuerda para derretirla mañana. */
  alUsada: () => void;
  alCerrar: () => void;
}) {
  const [fase, setFase] = useState<Fase>('aviso');
  const [fallo, setFallo] = useState<'guardar' | 'corregir' | null>(null);
  const [tira, setTira] = useState<{ x: number; y: number; w: number } | null>(null);
  const [plantada, setPlantada] = useState(false);
  const [helada, setHelada] = useState(false);
  const [vuelo, setVuelo] = useState<{ desde: Punto; hasta: Punto } | null>(null);
  const raiz = useRef<View>(null);
  const estrellaDelBoton = useRef<View>(null);
  const comprime = useRef(new Animated.Value(0)).current;
  const caja = useRef(new Animated.Value(1)).current;
  const avance = useRef(new Animated.Value(0)).current;
  const anillo = useRef(new Animated.Value(0)).current;
  const globito = useRef(new Animated.Value(0)).current;

  const usadas = Math.min(dias.length, Math.max(0, total - quedan));
  // Antes de usarla, la vida todavía se ve en la fila; al saltar al día, queda en contorno.
  const antesDelSalto = fase === 'aviso' || fase === 'guardando' || fase === 'corrigiendo' || (fase === 'usando' && !vuelo && !plantada);
  const vivas = antesDelSalto ? Math.min(total, quedan + usadas) : quedan;

  useEffect(() => {
    alMostrar();
    plataforma.haptica.pulso();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indiceDe = (fecha: string) => semana.findIndex((d) => d.fecha === fecha);
  const ultimo = dias[dias.length - 1];
  const centroDelDia = (fecha: string): Punto | null => {
    const i = indiceDe(fecha);
    if (!tira || i < 0) return null;
    return { x: tira.x + PUNTO / 2 + (i * (tira.w - PUNTO)) / 6, y: tira.y + PUNTO / 2 };
  };

  function medirEnLaRaiz(n: View | null): Promise<Punto | null> {
    return new Promise((ok) => {
      if (!n || !raiz.current) return ok(null);
      raiz.current.measureInWindow((rx, ry) => n.measureInWindow((x, y, w, h) => ok({ x: x - rx + w / 2, y: y - ry + h / 2 })));
    });
  }

  async function usar() {
    if (fase !== 'aviso') return;
    setFase('usando');
    setFallo(null);
    plataforma.haptica.pulso();
    const desde = await medirEnLaRaiz(estrellaDelBoton.current);
    const hasta = centroDelDia(ultimo);
    // 1. El texto se comprime en la estrella, que brilla.
    await new Promise<void>((ok) => Animated.timing(comprime, { toValue: 1, duration: COMPRIME_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => ok()));
    // 2. Salta al día, en arco; el cuadro se va.
    if (desde && hasta) {
      setVuelo({ desde, hasta });
      Animated.timing(caja, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      avance.setValue(0);
      await new Promise<void>((ok) => Animated.timing(avance, { toValue: 1, duration: VUELO_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => ok()));
    } else {
      Animated.timing(caja, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
    setVuelo(null);
    // 3. Queda plantada, con un anillo de luz.
    setPlantada(true);
    anillo.setValue(0);
    await new Promise<void>((ok) => Animated.timing(anillo, { toValue: 1, duration: PLANTA_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => ok()));
    // 4. Se congela, y sale el globito.
    setHelada(true);
    plataforma.haptica.pulso();
    await new Promise((ok) => setTimeout(ok, HIELA_MS));
    alUsada();
    setFase('helada');
    Animated.timing(globito, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }

  async function guardar() {
    setFase('guardando');
    setFallo(null);
    const ok = await alGuardar();
    setFallo(ok ? null : 'guardar');
    setFase(ok ? 'guardada' : 'aviso');
  }

  async function corregir() {
    setFase('corrigiendo');
    setFallo(null);
    const ok = await alCorregir();
    setFallo(ok ? null : 'corregir');
    setFase(ok ? 'corregida' : 'aviso');
  }

  const ocupado = fase !== 'aviso';
  const cerrada = fase === 'guardada' || fase === 'corregida';
  const cola = centroDelDia(ultimo);
  const texto = dias.length === 1 ? T.impulso.salvada.textoUno(fechaLinda(dias[0])) : T.impulso.salvada.textoVarios(fechasLindas(dias));

  // El arco del salto, muestreado: Animated interpola en tramos rectos entre los puntos.
  const arco = (() => {
    if (!vuelo) return null;
    const { desde: a, hasta: b } = vuelo;
    const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 90 };
    const pasos = Array.from({ length: 13 }, (_, i) => i / 12);
    const punto = (t: number) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
    return { pasos, xs: pasos.map((t) => punto(t).x - 12), ys: pasos.map((t) => punto(t).y - 12) };
  })();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={alCerrar} statusBarTranslucent>
      <View style={estilos.fondo} testID="vida-usada">
        <View ref={raiz} style={estilos.raiz} collapsable={false}>
          {cerrada ? (
            <View testID={fase === 'corregida' ? 'vida-corregida' : 'vida-guardada'}>
              <Text style={estilos.titulo}>{fase === 'corregida' ? T.impulso.salvada.corregidaTitulo : T.impulso.salvada.guardada(dias.length)}</Text>
              <Text style={estilos.detalle}>{fase === 'corregida' ? T.impulso.salvada.corregidaDetalle(dias.length) : T.inicio.perdida}</Text>
            </View>
          ) : (
            <>
              <View style={estilos.vidas} testID="aviso-vidas">
                {Array.from({ length: total }, (_, i) => (
                  <VidaQueTitila key={i} viva={i < vivas} indice={i} />
                ))}
              </View>

              <View style={estilos.tira} onLayout={(e) => setTira({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y, w: e.nativeEvent.layout.width })}>
                {semana.map((d, i) => {
                  const delAviso = dias.includes(d.fecha);
                  const estado: EstadoDelDia = delAviso ? (plantada ? 'cubierto' : 'vacio') : d.estadoDia;
                  const frio: FrioDelDia = delAviso && helada ? 'helado' : null;
                  return (
                    <DiaDeLaTira key={d.fecha} indice={i} hoyRegistrado={false} rango={rango} letra={DIAS_SEMANA[deISO(d.fecha).getDay()]} estiloLetra={estilos.letra}>
                      <View>
                        <PuntoDelDia estado={estado} esHoy={d.esHoy} frio={frio} />
                        {delAviso && plantada && !helada && (
                          <Animated.View
                            pointerEvents="none"
                            style={[estilos.estallido, { opacity: anillo.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: anillo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }) }] }]}
                          />
                        )}
                      </View>
                    </DiaDeLaTira>
                  );
                })}
              </View>

              <Animated.View style={[estilos.caja, { opacity: caja }]} testID="vida-cuadro" pointerEvents={fase === 'aviso' ? 'auto' : 'none'}>
                {cola && tira && <View pointerEvents="none" style={[estilos.cola, { left: cola.x - tira.x - 7 }]} />}
                <View style={estilos.emblema} pointerEvents="none" testID="vida-emblema">
                  <Estrella tam={18} />
                </View>
                <Text style={estilos.texto}>{texto}</Text>
                {fallo && <Text style={estilos.fallo}>{fallo === 'guardar' ? T.impulso.salvada.noSeGuardo : T.impulso.salvada.noSeCorrigio}</Text>}
                <View style={estilos.botones}>
                  <View style={estilos.columna}>
                    <Pressable testID="vida-usar" style={[estilos.boton, estilos.usar]} onPress={() => void usar()} disabled={ocupado} accessibilityRole="button" accessibilityLabel={T.impulso.salvada.usarVida}>
                      <Animated.View ref={estrellaDelBoton} collapsable={false} style={{ transform: [{ scale: comprime.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }], opacity: vuelo || plantada ? 0 : 1 }}>
                        <Estrella tam={15} modo="oscura" />
                      </Animated.View>
                      <Animated.Text style={[estilos.usarTexto, { opacity: comprime.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateX: comprime.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }, { scaleX: comprime.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }] }]}>
                        {T.impulso.salvada.usarVida}
                      </Animated.Text>
                    </Pressable>
                  </View>
                  <View style={estilos.columna}>
                    <Pressable testID="vida-guardar" style={[estilos.boton, estilos.guardar]} onPress={() => void guardar()} disabled={ocupado} accessibilityRole="button">
                      <Text style={estilos.guardarTexto}>{fase === 'guardando' ? T.sesion.guardando : T.impulso.salvada.guardarVida}</Text>
                    </Pressable>
                    <Text style={estilos.chico}>{T.impulso.salvada.bajaDiez}</Text>
                  </View>
                </View>
                <Pressable testID="vida-corregir" style={({ pressed }) => [estilos.link, pressed && estilos.linkTocado]} onPress={() => void corregir()} disabled={ocupado} hitSlop={6} accessibilityRole="link">
                  <Text style={estilos.linkTexto}>{fase === 'corrigiendo' ? T.sesion.guardando : T.impulso.salvada.fuiCorregi(dias.length)}</Text>
                </Pressable>
              </Animated.View>

              {fase === 'helada' && cola && (
                <Animated.View testID="vida-globito" style={[estilos.globito, { top: (tira?.y ?? 0) + PUNTO + 30, opacity: globito }]}>
                  <View style={[estilos.globitoCola, { left: Math.max(14, cola.x - 6) }]} />
                  <Text style={estilos.globitoTexto}>{T.impulso.salvada.vidaGastada}</Text>
                </Animated.View>
              )}

              {vuelo && arco && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    estilos.volador,
                    {
                      transform: [
                        { translateX: avance.interpolate({ inputRange: arco.pasos, outputRange: arco.xs }) },
                        { translateY: avance.interpolate({ inputRange: arco.pasos, outputRange: arco.ys }) },
                        { scale: avance.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1.4, 1.5, 0.6] }) },
                      ],
                    },
                  ]}
                >
                  <Estrella tam={24} />
                </Animated.View>
              )}
            </>
          )}
        </View>

        {(cerrada || fase === 'helada') && (
          <Pressable testID="vida-listo" style={[estilos.boton, estilos.usar, estilos.listo]} onPress={alCerrar} accessibilityRole="button">
            <Text style={estilos.usarTexto}>{fase === 'guardada' ? T.general.entendido : T.impulso.salvada.listo}</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const sombra = { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 };

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(5,6,10,0.96)', paddingHorizontal: 24, paddingTop: 110, paddingBottom: 40, justifyContent: 'space-between' },
  raiz: { flex: 1 },
  titulo: { color: C.tinta, fontSize: 30, fontWeight: '300', marginBottom: 14 },
  detalle: { color: C.sub, fontSize: 16, lineHeight: 23 },
  vidas: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tira: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  letra: { color: C.apagado, fontSize: 11 },
  estallido: { position: 'absolute', left: 0, top: 0, width: PUNTO, height: PUNTO, borderRadius: PUNTO / 2, borderWidth: 2, borderColor: C.claro },
  caja: { marginTop: 30, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, backgroundColor: C.hoja, ...sombra },
  cola: { position: 'absolute', top: -7, width: 13, height: 13, backgroundColor: C.hoja, borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, transform: [{ rotate: '45deg' }] },
  emblema: { position: 'absolute', alignSelf: 'center', top: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: C.hoja, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, alignItems: 'center', justifyContent: 'center' },
  texto: { color: C.tinta, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  fallo: { color: C.error, fontSize: 13, lineHeight: 18, marginTop: 8, textAlign: 'center' },
  botones: { flexDirection: 'row', gap: 10, marginTop: 16 },
  columna: { flex: 1, minWidth: 0, alignItems: 'stretch' },
  boton: { borderRadius: 999, paddingVertical: 13, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, ...sombra },
  usar: { backgroundColor: C.claro },
  usarTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  guardar: { backgroundColor: C.fondo, borderWidth: 1, borderColor: C.bordeBoton },
  guardarTexto: { color: C.tinta, fontSize: 15, fontWeight: '500' },
  chico: { color: C.sub, fontSize: 11.5, textAlign: 'center', marginTop: 6 },
  link: { alignSelf: 'center', marginTop: 12, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(106,168,255,0.08)' },
  linkTocado: { backgroundColor: 'rgba(106,168,255,0.16)' },
  linkTexto: { color: C.link, fontSize: 13, textDecorationLine: 'underline' },
  globito: { position: 'absolute', left: 0, right: 0, backgroundColor: '#141824', borderWidth: StyleSheet.hairlineWidth, borderColor: '#3a4258', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, ...sombra },
  globitoCola: { position: 'absolute', top: -7, width: 12, height: 12, backgroundColor: '#141824', borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: '#3a4258', transform: [{ rotate: '45deg' }] },
  globitoTexto: { color: C.tinta, fontSize: 15, lineHeight: 21 },
  volador: { position: 'absolute', left: 0, top: 0, zIndex: 20, width: 24, height: 24 },
  listo: { alignSelf: 'stretch' },
});
