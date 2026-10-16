import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fechaLinda } from '@nucleo/fechas';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { C } from './colores';

/**
 * "FALTASTE Y SE USÓ UNA VIDA." La ventana del día siguiente, en nativo.
 *
 * DESDE EL 16/10 (a pedido): primero una animación corta —las vidas que se usaron se
 * apagan, una por una— y después la pregunta, con dos salidas: usarla ahora (la racha
 * sigue) o guardarla para otra vez (vuelve la vida y la racha queda diez días abajo).
 * El precio va a la vista, debajo de la pregunta: guardarla se elige sabiendo cuánto
 * cuesta, y sin paso extra.
 *
 * SALE UNA SOLA VEZ POR CADA VIDA: quien la monta la anota como vista al mostrarse
 * (`alMostrar`), no al tocar un botón. Antes, escondida por un entrenamiento en
 * marcha, volvía al terminar.
 */
const APAGA_MS = 380;
const ENTRE_VIDAS_MS = 220;
const ESPERA_MS = 350;

export default function RachaSalvada({
  dias,
  quedan,
  total,
  rachaSiGuarda,
  alMostrar,
  alGuardar,
  alCerrar,
}: {
  dias: string[];
  quedan: number;
  total: number;
  rachaSiGuarda: number;
  /** Se llama una vez, al aparecer: ahí queda vista. */
  alMostrar: () => void;
  alGuardar: () => Promise<boolean>;
  alCerrar: () => void;
}) {
  const [paso, setPaso] = useState<'pregunta' | 'guardando' | 'guardada'>('pregunta');
  const [fallo, setFallo] = useState(false);
  const usadas = Math.min(dias.length, Math.max(0, total - quedan));
  // Una por vida que se usó: arranca prendida y se apaga.
  const apagan = useRef(Array.from({ length: usadas }, () => new Animated.Value(1))).current;
  const pregunta = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    alMostrar();
    plataforma.haptica.pulso();
    Animated.sequence([
      Animated.delay(ESPERA_MS),
      Animated.stagger(
        ENTRE_VIDAS_MS,
        apagan.map((v) => Animated.timing(v, { toValue: 0, duration: APAGA_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }))
      ),
      Animated.timing(pregunta, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
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
        </View>

        <Animated.View style={[estilos.abajo, { opacity: paso === 'guardada' ? 1 : pregunta }]}>
          {paso === 'guardada' ? (
            <Pressable style={estilos.solido} onPress={alCerrar}>
              <Text style={estilos.solidoTexto}>{T.general.entendido}</Text>
            </Pressable>
          ) : (
            <>
              <Text style={estilos.pregunta}>{T.impulso.salvada.preguntaUsar(dias.length)}</Text>
              <Text style={estilos.precio}>{T.impulso.salvada.precioGuardar(dias.length, rachaSiGuarda)}</Text>
              {fallo && <Text style={[estilos.precio, estilos.peligro]}>{T.impulso.salvada.noSeGuardo}</Text>}
              <Pressable testID="vida-usar" style={estilos.solido} onPress={alCerrar} disabled={paso === 'guardando'}>
                <Text style={estilos.solidoTexto}>{T.impulso.salvada.usarAhora(dias.length)}</Text>
              </Pressable>
              <Pressable testID="vida-guardar" style={estilos.secundario} onPress={() => void guardar()} disabled={paso === 'guardando'}>
                <Text style={estilos.secundarioTexto}>{paso === 'guardando' ? T.sesion.guardando : T.impulso.salvada.guardarParaOtraVez(dias.length)}</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
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
  abajo: { gap: 4 },
  pregunta: { color: C.tinta, fontSize: 26, fontWeight: '300', marginBottom: 8 },
  precio: { color: C.sub, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  solido: { backgroundColor: C.claro, borderRadius: 2, paddingVertical: 16, alignItems: 'center' },
  solidoTexto: { color: C.fondo, fontSize: 16, fontWeight: '600' },
  secundario: { paddingVertical: 14, alignItems: 'center' },
  secundarioTexto: { color: C.sub, fontSize: 14 },
  peligro: { color: C.error },
});
