import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { T } from '@nucleo/textos';
import { C } from './colores';
import { catalogoDeRutina, type CatalogoDeRutina } from '@compartido/rutinas';
import RutinaPlegada from './RutinaPlegada';
import { supabase } from './supabase';
import { guardarDiaDeRutina, rutinaReemplazada, type PreguntaDeRutina } from './preguntarPorLaRutina';

/**
 * LA VENTANA AL TERMINAR (19/10, aprobada en la galería): con el estilo de la app, en
 * lugar de la alerta del sistema. «Reemplazar» pasa por un «¿Estás seguro?» en la misma
 * ventana, porque pisa lo que había (lo pedido el 16/10), y desde el 26/10 lista la rutina
 * entera como va a quedar: «Sí» guarda esa misma, «No» vuelve sin tocar nada. «Crear rutina
 * nueva» va directo.
 * «Olvidar este día» (20/10), aparte y más apagado, no toca la rutina y ese día no vuelve a
 * preguntar. Tocar afuera la cierra sin guardar nada. Se monta solo mientras está abierta.
 */
export default function VentanaRutina({ pregunta, alCerrar }: { pregunta: PreguntaDeRutina; alCerrar: () => void }) {
  const [paso, setPaso] = useState<'pregunta' | 'seguro'>('pregunta');
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const propuesta = useMemo(() => rutinaReemplazada(pregunta), [pregunta]);
  const [catalogo, setCatalogo] = useState<CatalogoDeRutina>(new Map());
  useEffect(() => {
    let vivo = true;
    void catalogoDeRutina(supabase).then((c) => vivo && setCatalogo(c)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar(como: 'esta' | 'nueva' | 'olvidar') {
    if (guardando) return;
    setGuardando(true);
    setFallo(false);
    const ok = await guardarDiaDeRutina(pregunta, como, propuesta ?? undefined);
    setGuardando(false);
    if (ok) return alCerrar();
    setFallo(true);
    setPaso('pregunta');
  }

  const seguro = paso === 'seguro';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={alCerrar} statusBarTranslucent>
      <View style={estilos.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={alCerrar} disabled={guardando} accessibilityRole="button" accessibilityLabel={T.general.cerrar} />
        <View testID="ventana-rutina" style={estilos.caja}>
          <View style={estilos.marca}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.claro} strokeWidth={1.8} strokeLinecap="round">
              <Path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6" />
              <Path d="M18 3v4h-4M6 21v-4h4" />
            </Svg>
          </View>
          <Text style={estilos.titulo}>{seguro ? T.rutina.estasSeguro : T.rutina.reemplazarDiaTitulo(pregunta.actual.nombre)}</Text>
          {!seguro && (
            <Text style={estilos.texto}>
              {T.rutina.cambiarDiaTexto}
              {'\n'}
              {T.rutina.cambiarDiaPregunta}
            </Text>
          )}
          {seguro && propuesta && (
            <>
              <Text style={estilos.texto}>{T.rutina.asiQueda(pregunta.actual.nombre)}</Text>
              <ScrollView style={estilos.lista} contentContainerStyle={{ paddingBottom: 4 }}>
                <RutinaPlegada testID="ventana-rutina-lista" dias={propuesta} catalogo={catalogo} abiertos />
              </ScrollView>
            </>
          )}
          {fallo && <Text style={estilos.fallo}>{T.general.noSePudo}</Text>}
          <View style={estilos.acciones}>
            <Pressable
              testID={seguro ? 'ventana-rutina-si' : 'ventana-rutina-reemplazar'}
              style={[estilos.pildora, estilos.crema]}
              disabled={guardando}
              onPress={() => (seguro ? void guardar('esta') : setPaso('seguro'))}
              accessibilityRole="button"
            >
              <Text style={estilos.cremaTexto}>{guardando && seguro ? T.sesion.guardando : seguro ? T.rutina.si : T.rutina.reemplazar}</Text>
            </Pressable>
            <Pressable
              testID={seguro ? 'ventana-rutina-no' : 'ventana-rutina-nueva'}
              style={[estilos.pildora, estilos.borde]}
              disabled={guardando}
              onPress={() => (seguro ? setPaso('pregunta') : void guardar('nueva'))}
              accessibilityRole="button"
            >
              <Text style={estilos.bordeTexto}>{guardando && !seguro ? T.sesion.guardando : seguro ? T.rutina.no : T.rutina.crearRutinaNueva}</Text>
            </Pressable>
            {!seguro && (
              <Pressable
                testID="ventana-rutina-olvidar"
                style={[estilos.pildora, estilos.tenue]}
                disabled={guardando}
                onPress={() => void guardar('olvidar')}
                accessibilityRole="button"
              >
                <Text style={estilos.tenueTexto}>{T.rutina.olvidarDia}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(5,6,10,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  caja: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#10131c',
    borderWidth: 1,
    borderColor: '#2e3548',
    borderRadius: 22,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  marca: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(126,140,168,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  titulo: { color: C.tinta, fontSize: 17, fontWeight: '600', lineHeight: 22 },
  texto: { color: C.sub, fontSize: 14, lineHeight: 20, marginTop: 8 },
  fallo: { color: C.error, fontSize: 13, marginTop: 8 },
  // La lista entera puede ser larga: corre adentro y los botones quedan a la vista.
  lista: { maxHeight: 360, marginTop: 10 },
  acciones: { gap: 8, marginTop: 18 },
  pildora: { borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  crema: { backgroundColor: C.claro },
  cremaTexto: { color: C.fondo, fontSize: 14, fontWeight: '600' },
  borde: { borderWidth: 1, borderColor: C.bordeBoton },
  bordeTexto: { color: C.tinta, fontSize: 14 },
  tenue: { borderWidth: 1, borderColor: C.lineaFuerte },
  tenueTexto: { color: C.sub, fontSize: 14 },
});
