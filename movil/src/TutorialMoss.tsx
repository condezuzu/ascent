import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { T } from '@nucleo/textos';
import { MOSS } from './coloresDeMoss';
import { Reloj } from './CuerpoDeMoss';
import { LETRAS_DE_MOSS } from './fuentes';
import { nuevaEnCadaApertura } from './hojaNueva';
import { Text } from './Texto';
import Tocable from './Tocable';

/** Lo que tarda cada paso en dejar seguir: no se saltea (como la entrada de Ascent). */
export const ESPERA_DEL_PASO_MS = 2000;

/**
 * EL TUTORIAL DE LA SECCIÓN (19/11, spec/musculos-compartido.md §3): los mismos 5 pasos que en Moss. Cada
 * paso espera 2 s antes de dejar pasar al siguiente; se vuelve a ver desde el «!».
 */
function TutorialMoss({ visible, alTerminar }: { visible: boolean; alTerminar: () => void }) {
  const { titulos, textos } = T.moss.sec.tutorial;
  const [n, setN] = useState(0);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setListo(false);
    const t = setTimeout(() => setListo(true), ESPERA_DEL_PASO_MS);
    return () => clearTimeout(t);
  }, [visible, n]);
  if (!visible) return null;
  const ultimo = n === titulos.length - 1;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => undefined}>
      <View style={e.fondo} testID="moss-tutorial">
        <View style={e.tarjeta}>
          <Text style={e.paso}>{T.moss.sec.tutorial.paso(n + 1, titulos.length)}</Text>
          <Text style={e.titulo}>{titulos[n]}</Text>
          <Text style={e.texto}>{textos[n]}</Text>
          {n === 1 && <Text style={e.texto}>{T.moss.sec.tutorial.serieDura}</Text>}
          {/* El paso de los fatigados muestra el círculo que se llena hasta que el músculo está listo. */}
          {n === 3 && (
            <View style={e.reloj}>
              <Reloj tam={34} hecho={0.6} />
              <Text style={e.texto}>{T.moss.sec.fatigados.vuelve(T.moss.sec.fatigados.manana)}</Text>
            </View>
          )}
          <View style={e.puntos}>
            {titulos.map((_, i) => (
              <View key={i} style={[e.punto, i === n && e.puntoActual]} />
            ))}
          </View>
          <Tocable
            testID="moss-tutorial-siguiente"
            disabled={!listo}
            onPress={() => (ultimo ? alTerminar() : setN((x) => x + 1))}
            style={[e.boton, !listo && e.botonEsperando]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !listo }}
          >
            <Text style={[e.botonTexto, !listo && e.botonTextoEsperando]}>{ultimo ? T.moss.sec.tutorial.listo : T.moss.sec.tutorial.siguiente}</Text>
          </Tocable>
        </View>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: MOSS.velo, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tarjeta: { width: '100%', maxWidth: 420, gap: 14, padding: 24, borderWidth: 1, borderColor: MOSS.oroBorde, backgroundColor: MOSS.noche1 },
  paso: { color: MOSS.oro, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 12, letterSpacing: 2.4, textTransform: 'uppercase' },
  titulo: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.titulo, fontSize: 30 },
  texto: { color: MOSS.pergamino, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 16, lineHeight: 23 },
  reloj: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  puntos: { flexDirection: 'row', gap: 6 },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: MOSS.linea },
  puntoActual: { backgroundColor: MOSS.oro },
  boton: { minHeight: 48, borderRadius: 999, backgroundColor: MOSS.oro, alignItems: 'center', justifyContent: 'center' },
  // Mientras corren los 2 s el botón queda en línea, sin relleno: se ve que todavía no.
  botonEsperando: { backgroundColor: 'transparent', borderWidth: 1, borderColor: MOSS.oroBorde },
  botonTexto: { color: MOSS.noche0, fontFamily: LETRAS_DE_MOSS.texto, fontSize: 16 },
  botonTextoEsperando: { color: MOSS.pergaminoTenue },
});

export default nuevaEnCadaApertura(TutorialMoss, (p) => p.visible);
