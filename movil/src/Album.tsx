import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { supabase } from './supabase';
import { T } from '@nucleo/textos';
import { fechaLinda } from '@nucleo/fechas';
import { cambiarVisibilidad, cargarAlbum, porMes, quitarFoto, type DatosDeAlbum } from '@compartido/album';
import FondoEspacial from './FondoEspacial';
import { C } from './colores';

/**
 * ÁLBUM — tanda 4.
 *
 * Las consultas son las MISMAS que las de la web (`compartido/album.ts`).
 *
 * NO HAY CÁMARA NI FOTOTECA ACÁ, tampoco en la web: el álbum muestra las
 * fotos del día, que entran al registrar el día (`RegistrarDia` + `foto.ts`).
 * Esa parte —elegir de la fototeca, sacar con la cámara, los permisos de iOS,
 * una foto HEIC y su orientación— NO está probada: en :8090 el selector de
 * `expo-image-picker` es un `<input type=file>`. Queda para el iPhone.
 *
 * LO QUE FALTA RESPECTO DE LA WEB: deslizar la foto con el dedo para pasar a
 * la siguiente. Acá se pasa con las flechas.
 */
export default function Album({ alSalir }: { alSalir: () => void }) {
  const [datos, setDatos] = useState<DatosDeAlbum | null>(null);
  const [cargado, setCargado] = useState(false);
  const [noCargo, setNoCargo] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return alSalir();
    const d = await cargarAlbum(supabase, uid).catch(() => null);
    setNoCargo(!d);
    if (d) setDatos(d);
    setCargado(true);
  }, [alSalir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => setConfirmando(false), [abierta]);

  const celdas = datos?.celdas ?? [];
  const meses = porMes(celdas);
  // Tres por fila, todas del mismo tamaño: el criterio de la web (una grilla
  // pareja, no un mosaico que con una sola foto la vuelve gigante).
  const HUECO = 4;
  const lado = Math.floor((width - 48 - HUECO * 2) / 3);
  const foto = abierta !== null ? celdas[abierta] : null;

  async function alternar() {
    if (!foto) return;
    const nueva = foto.visibilidad === 'privada' ? 'amigos' : 'privada';
    if (!(await cambiarVisibilidad(supabase, foto.id, nueva))) return setError(T.general.falloVisibilidad);
    setDatos((d) =>
      d ? { ...d, celdas: d.celdas.map((x) => (x.id === foto.id ? { ...x, visibilidad: nueva } : x)) } : d
    );
  }

  async function quitar() {
    if (!foto) return;
    setError('');
    if (!(await quitarFoto(supabase, foto.id, foto.ruta))) return setError(T.album.noSeBorro);
    setDatos((d) => {
      if (!d) return d;
      const quedan = d.celdas.filter((x) => x.id !== foto.id);
      setAbierta((i) => (quedan.length === 0 || i === null ? null : Math.min(i, quedan.length - 1)));
      return { ...d, celdas: quedan };
    });
  }

  return (
    <View style={estilos.raiz}>
      {datos && <FondoEspacial rango={datos.miRango} planeta={datos.miPlaneta} esquina="arriba-derecha" velo={0.72} />}
      <ScrollView contentContainerStyle={estilos.pantalla}>
        <Text style={estilos.titulo}>{T.album.titulo}</Text>
        {!!error && <Text style={estilos.error}>{error}</Text>}
        {!cargado && <ActivityIndicator color={C.sub} style={{ marginTop: 24 }} />}

        {noCargo ? (
          <View style={estilos.tarjeta}>
            <Text style={estilos.texto}>{T.inicio.noCargo}</Text>
            <Pressable style={estilos.botonFantasma} onPress={cargar}>
              <Text style={estilos.textoBoton}>{T.inicio.reintentar}</Text>
            </Pressable>
          </View>
        ) : celdas.length > 0 ? (
          meses.map((m) => (
            <View key={m.clave} style={{ marginBottom: 20 }}>
              <Text style={estilos.rotulo}>{m.titulo}</Text>
              <View style={[estilos.grilla, { gap: HUECO }]}>
                {m.fotos.map((c, j) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setAbierta(m.desde + j)}
                    accessibilityLabel={fechaLinda(c.fecha)}
                    style={[estilos.celda, { width: lado, height: lado }]}
                  >
                    {!!c.url && <Image source={{ uri: c.url }} style={{ width: lado, height: lado }} />}
                    {/* Un punto y nada más: quién ve la foto, de un vistazo. */}
                    {c.visibilidad === 'amigos' && <View style={estilos.punto} />}
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        ) : (
          cargado && (
            <View style={estilos.vacio}>
              <Text style={estilos.vacioTexto}>{T.album.vacioTitulo}</Text>
              <Text style={estilos.vacioTexto}>{T.album.vacioPie}</Text>
            </View>
          )
        )}
      </ScrollView>

      <Modal visible={!!foto} transparent animationType="fade" onRequestClose={() => setAbierta(null)}>
        {foto && (
          <View style={estilos.visor}>
            {/* El fondo cierra; la foto y la barra de abajo no. */}
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setAbierta(null)} />
            <Pressable style={estilos.cerrar} onPress={() => setAbierta(null)} accessibilityLabel={T.general.cerrar} hitSlop={12}>
              <Text style={estilos.cerrarTexto}>×</Text>
            </Pressable>

            <Image source={{ uri: foto.url }} style={{ width, height: width }} resizeMode="contain" />

            <View style={estilos.pasos}>
              {abierta! > 0 ? (
                <Pressable onPress={() => setAbierta((i) => (i ?? 0) - 1)} accessibilityLabel={T.album.anterior} hitSlop={12}>
                  <Text style={estilos.paso}>‹</Text>
                </Pressable>
              ) : (
                <View />
              )}
              {abierta! < celdas.length - 1 ? (
                <Pressable onPress={() => setAbierta((i) => (i ?? 0) + 1)} accessibilityLabel={T.album.siguiente} hitSlop={12}>
                  <Text style={estilos.paso}>›</Text>
                </Pressable>
              ) : (
                <View />
              )}
            </View>

            <View style={estilos.pie}>
              {/* La fecha manda y el planeta la acompaña. */}
              <View style={estilos.cuando}>
                <Text style={estilos.fecha}>{fechaLinda(foto.fecha)}</Text>
                {!!foto.planeta && <Text style={estilos.planeta}>{foto.planeta}</Text>}
                {foto.esSubida && <Text style={estilos.planeta}>{T.album.deSubida}</Text>}
              </View>
              <View style={estilos.acciones}>
                <Pressable
                  onPress={alternar}
                  style={[estilos.pastilla, foto.visibilidad === 'amigos' && estilos.pastillaPrendida]}
                >
                  <Text style={[estilos.pastillaTexto, foto.visibilidad === 'amigos' && { color: C.fondo }]}>
                    {foto.visibilidad === 'privada' ? T.album.soloVos : T.album.amigos}
                  </Text>
                </Pressable>
                {confirmando ? (
                  <View style={estilos.confirmar}>
                    <Text style={estilos.texto}>{T.album.borrarPregunta}</Text>
                    <Pressable onPress={quitar} hitSlop={8}>
                      <Text style={estilos.accion}>{T.album.si}</Text>
                    </Pressable>
                    <Pressable onPress={() => setConfirmando(false)} hitSlop={8}>
                      <Text style={estilos.accion}>{T.album.no}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setConfirmando(true)} hitSlop={8}>
                    <Text style={estilos.accion}>{T.album.borrarFoto}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  // Transparente: el fondo lo dibuja `FondoRaiz`.
  raiz: { flex: 1 },
  pantalla: { flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 40 },
  titulo: { color: C.tinta, fontSize: 22, marginBottom: 20 },
  error: { color: C.error, fontSize: 14, marginBottom: 12 },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: { backgroundColor: C.hoja, borderRadius: 6, overflow: 'hidden' },
  punto: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.claro,
  },
  tarjeta: {
    backgroundColor: 'rgba(11,13,19,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 14,
    padding: 14,
  },
  texto: { color: C.sub, fontSize: 14 },
  botonFantasma: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  textoBoton: { color: C.tinta, fontSize: 14 },
  vacio: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  vacioTexto: { color: C.sub, fontSize: 14, textAlign: 'center' },
  visor: { flex: 1, backgroundColor: 'rgba(5,6,10,0.96)', justifyContent: 'center' },
  cerrar: { position: 'absolute', top: 56, right: 20, zIndex: 2 },
  cerrarTexto: { color: C.tinta, fontSize: 32, lineHeight: 34 },
  pasos: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paso: { color: C.tinta, fontSize: 40, paddingHorizontal: 8 },
  pie: { position: 'absolute', left: 24, right: 24, bottom: 48, gap: 14 },
  cuando: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  fecha: { color: C.tinta, fontSize: 16 },
  planeta: { color: C.sub, fontSize: 13 },
  acciones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pastilla: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pastillaPrendida: { backgroundColor: C.claro, borderColor: C.claro },
  pastillaTexto: { color: C.tinta, fontSize: 14 },
  confirmar: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accion: { color: C.claro, fontSize: 14 },
});
