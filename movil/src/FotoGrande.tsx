import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import { marcarMeGusta, meGustaDeFoto, type MeGusta } from '@compartido/meGusta';
import { plataforma } from '@plataforma';
import { C } from './colores';
import Corazon from './Corazon';
import { nuevaEnCadaApertura } from './hojaNueva';
import { supabase } from './supabase';

/**
 * LA FOTO DE PERFIL, GRANDE (8/10/2026).
 *
 * Un toque en cualquier lado la cierra: es mirar y salir, no un visor. La foto
 * de perfil es pública desde siempre (bucket `avatares`), así que acá no hay
 * permiso que pedir ni firma que venza.
 *
 * LAS FOTOS DEL PERFIL LLEVAN CORAZÓN (19/10): con `fotoId`, abajo a la derecha de la
 * foto (no del recuadro: la foto entra entera y puede sobrar a los costados o arriba).
 * La propia muestra la cuenta sin dejar tocarlo.
 */
function FotoGrande({
  url,
  onCerrar,
  alCambiar,
  fotoId,
  propia = false,
}: {
  url: string | null;
  onCerrar: () => void;
  alCambiar?: () => void;
  fotoId?: string | null;
  propia?: boolean;
}) {
  const [marco, setMarco] = useState<{ w: number; h: number } | null>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [gusta, setGusta] = useState<MeGusta | null>(null);
  const enVuelo = useRef(false);

  useEffect(() => {
    if (!url || !fotoId) return;
    let vivo = true;
    Image.getSize(url, (w, h) => vivo && setTam({ w, h }), () => {});
    return () => {
      vivo = false;
    };
  }, [url, fotoId]);

  useEffect(() => {
    if (!url || !fotoId) return;
    let vivo = true;
    void meGustaDeFoto(supabase, fotoId).then((g) => vivo && setGusta(g));
    return () => {
      vivo = false;
    };
  }, [url, fotoId]);

  async function tocarCorazon() {
    if (!gusta || !fotoId || enVuelo.current) return;
    enVuelo.current = true;
    const antes = gusta;
    const quiero = !gusta.mio;
    setGusta({ mio: quiero, cantidad: Math.max(0, gusta.cantidad + (quiero ? 1 : -1)) });
    plataforma.haptica.pulso();
    const r = await marcarMeGusta(supabase, fotoId, quiero);
    setGusta(r ?? antes);
    enVuelo.current = false;
  }

  // Dónde queda la foto dentro del recuadro con `contain`.
  const escala = marco && tam ? Math.min(marco.w / tam.w, marco.h / tam.h) : 0;
  const sobraX = marco && tam ? (marco.w - tam.w * escala) / 2 : 0;
  const sobraY = marco && tam ? (marco.h - tam.h * escala) / 2 : 0;

  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <View style={estilos.fondo}>
        {/* Lo que cierra va DETRÁS, como hermano: envolviendo, el corazón y los botones
            quedaban como un botón adentro de otro (en la web, un error de HTML). */}
        <Pressable testID="foto-grande" style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityRole="button" accessibilityLabel={T.social.cerrarFoto} />
        <View style={estilos.foto} pointerEvents="box-none" onLayout={(e) => setMarco({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {url ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            </View>
          ) : null}
          {gusta && marco && (
            <View style={[estilos.corazon, { right: sobraX + 12, bottom: sobraY + 12 }]}>
              <Corazon cantidad={gusta.cantidad} mio={gusta.mio} alTocar={propia ? undefined : () => void tocarCorazon()} />
            </View>
          )}
        </View>
        {alCambiar ? (
          <View style={estilos.botones}>
            <Pressable
              testID="foto-grande-cambiar"
              style={estilos.solido}
              onPress={() => {
                onCerrar();
                // El selector del sistema no abre mientras la hoja todavía se está yendo.
                setTimeout(alCambiar, 350);
              }}
            >
              <Text style={estilos.solidoTexto}>{T.yo.cambiarFotoCorto}</Text>
            </Pressable>
            <Pressable style={estilos.borde} onPress={onCerrar}>
              <Text style={estilos.bordeTexto}>{T.social.cerrarFoto}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onCerrar} hitSlop={12} accessibilityRole="button">
            <Text style={estilos.cerrar}>{T.social.cerrarFoto}</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  foto: { width: '100%', height: '78%' },
  corazon: { position: 'absolute' },
  cerrar: { color: C.sub, fontSize: 15, marginTop: 18 },
  botones: { flexDirection: 'row', gap: 12, marginTop: 18 },
  solido: { backgroundColor: C.tinta, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 22 },
  solidoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  borde: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 22 },
  bordeTexto: { color: C.tinta, fontSize: 15 },
});

// Nace de nuevo en cada apertura: el corazón y el tamaño son de la foto que se abre.
export default nuevaEnCadaApertura(FotoGrande, (p) => !!p.url);
