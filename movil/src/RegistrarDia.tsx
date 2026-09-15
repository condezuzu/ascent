import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { fechaLinda, hoyISO } from '@nucleo/fechas';
import { estaBloqueado, textoDeBloqueo } from '@nucleo/pendiente';
import type { ResultadoRegistro, Visibilidad } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { subirFotoDelDia } from '@compartido/foto';
import { prepararFoto } from './foto';
import Hoja from './Hoja';
import { C } from './colores';

type Elegida = { uri: string; ancho: number; alto: number };

/**
 * REGISTRAR EL DÍA, CON FOTO SI QUERÉS. La misma hoja que la web
 * (`src/components/RegistrarSheet.tsx`), con sus dos modos:
 *
 * - **Sin `logId`**: el día no existe. Se registra con `registrar_dia` y, si
 *   hay foto, se cuelga de ese día.
 * - **Con `logId`**: el día ya está (lo registró la sesión). Solo se suma la
 *   foto: volver a registrarlo lo rechazaría la base.
 *
 * DOS PUERTAS PARA LA FOTO y no una: en la web el `<input>` del sistema ofrece
 * cámara o galería en el mismo menú; acá cada una es su propia llamada. La
 * galería no pide permiso en iPhone (el sistema muestra solo lo elegido); la
 * cámara sí, y se pide al tocar, no al abrir la hoja.
 *
 * LA FOTO SE PREPARA ANTES DE SUBIR (`foto.ts`): sin EXIF y achicada. Si no se
 * puede, no se sube el original.
 */
export default function RegistrarDia({
  visible,
  racha,
  logId,
  visibilidadDefault,
  alCerrar,
  alConfirmar,
}: {
  visible: boolean;
  racha: number;
  logId: string | null;
  visibilidadDefault: Visibilidad;
  alCerrar: () => void;
  alConfirmar: (r: ResultadoRegistro | null) => void;
}) {
  const [foto, setFoto] = useState<Elegida | null>(null);
  const [compartida, setCompartida] = useState(visibilidadDefault === 'amigos');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  // EL DÍA ENTRÓ PERO LA FOTO NO (bug del 15/9). Antes la hoja se cerraba igual:
  // el error quedaba escondido y la foto, descartada. Ahora queda abierta, con
  // la foto, en modo "sumar al día", y reintentar la cuelga del día que entró.
  const [registradoAca, setRegistradoAca] = useState<ResultadoRegistro | null>(null);
  const dia = hoyISO();
  const idDelDia = logId ?? registradoAca?.log_id ?? null;
  const yaEsta = !!idDelDia;

  async function elegir(desde: 'camara' | 'galeria') {
    setError('');
    const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
    try {
      if (desde === 'camara') {
        const permiso = await ImagePicker.requestCameraPermissionsAsync();
        if (!permiso.granted) return;
      }
      const r = desde === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
      const a = r.canceled ? null : r.assets?.[0];
      if (a) setFoto({ uri: a.uri, ancho: a.width, alto: a.height });
    } catch {
      setError(T.general.falloFotoPreparar);
    }
  }

  /** Sube la foto y la cuelga del día. `false` si no se pudo. */
  async function subir(idDelLog: string | null, subioRango: boolean): Promise<boolean> {
    if (!foto) return true;
    const lista = await prepararFoto(foto.uri, foto.ancho, foto.alto);
    if (!lista.ok) {
      setError(T.general.falloFotoPreparar);
      return false;
    }
    const r = await subirFotoDelDia(supabase, { datos: lista.datos, dia, logId: idDelLog, visible: compartida, subioRango });
    if (r !== 'ok') {
      setError(T.general.falloFoto);
      return false;
    }
    return true;
  }

  async function confirmar() {
    setError('');
    setAviso('');
    setCargando(true);
    if (yaEsta) {
      const ok = await subir(idDelDia, !!registradoAca?.subio_rango);
      setCargando(false);
      if (ok) {
        setFoto(null);
        const r = registradoAca;
        setRegistradoAca(null);
        alConfirmar(r);
      }
      return;
    }
    const { data, error: e } = await supabase.rpc('registrar_dia', { p_origen: 'manual' });
    if (e) {
      setCargando(false);
      // 23505: el día ya estaba. No es un error que haya que mostrar.
      if (e.code === '23505') return alConfirmar(null);
      return setError(T.general.noSePudo);
    }
    if (estaBloqueado(data)) {
      setCargando(false);
      return setAviso(textoDeBloqueo(data.hasta));
    }
    const resultado = data as ResultadoRegistro;
    // El día ya entró: si la foto falla se dice, pero el día no se pierde.
    const ok = await subir(resultado.log_id, resultado.subio_rango);
    setCargando(false);
    if (!ok) return setRegistradoAca(resultado);
    setFoto(null);
    alConfirmar(resultado);
  }

  return (
    <Hoja
      visible={visible}
      alCerrar={() => {
        if (cargando) return;
        // Si el día entró acá, cerrar sin la foto igual lo confirma: la racha subió.
        if (registradoAca) {
          const r = registradoAca;
          setRegistradoAca(null);
          setFoto(null);
          return alConfirmar(r);
        }
        alCerrar();
      }}
    >
      <Text style={estilos.titulo}>{yaEsta ? T.registrar.sumarAlDia : T.registrar.diaN(racha + 1)}</Text>
      <Text style={estilos.sub}>{fechaLinda(dia)}</Text>

      <Text style={estilos.etiqueta}>{T.registrar.foto}</Text>
      {foto ? (
        <>
          <Image source={{ uri: foto.uri }} style={estilos.vista} resizeMode="cover" accessibilityIgnoresInvertColors />
          <Pressable style={estilos.texto} onPress={() => setCompartida((x) => !x)}>
            <Text style={estilos.textoBoton}>{compartida ? T.registrar.laVenAmigos : T.registrar.soloLaVesVos}</Text>
          </Pressable>
          <Pressable style={estilos.texto} onPress={() => setFoto(null)}>
            <Text style={estilos.textoApagado}>{T.registrar.quitarFoto}</Text>
          </Pressable>
        </>
      ) : (
        <View style={estilos.puertas}>
          <Pressable style={estilos.fantasma} onPress={() => elegir('camara')}>
            <Text style={estilos.fantasmaTexto}>{T.registrar.sacarFoto}</Text>
          </Pressable>
          <Pressable style={estilos.fantasma} onPress={() => elegir('galeria')}>
            <Text style={estilos.fantasmaTexto}>{T.registrar.elegirFoto}</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[estilos.solido, (cargando || (yaEsta && !foto)) && estilos.apagado]}
        onPress={confirmar}
        disabled={cargando || (yaEsta && !foto)}
      >
        {cargando ? (
          <ActivityIndicator color={C.fondo} />
        ) : (
          <Text style={estilos.solidoTexto}>{yaEsta ? T.general.guardar : T.inicio.registrarDia}</Text>
        )}
      </Pressable>
      {aviso !== '' && <Text style={estilos.aviso}>{aviso}</Text>}
      {error !== '' && <Text style={estilos.error}>{error}</Text>}
    </Hoja>
  );
}

const estilos = StyleSheet.create({
  titulo: { color: C.tinta, fontSize: 22, fontWeight: '500' },
  sub: { color: C.sub, fontSize: 14, marginTop: 2, marginBottom: 18 },
  etiqueta: { color: C.apagado, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  puertas: { gap: 8 },
  fantasma: { borderWidth: 1, borderColor: C.lineaFuerte, borderRadius: 2, paddingVertical: 14, alignItems: 'center' },
  fantasmaTexto: { color: C.claro, fontSize: 15 },
  vista: { width: '100%', aspectRatio: 4 / 5, borderRadius: 2, backgroundColor: C.linea },
  texto: { paddingVertical: 10, alignItems: 'center' },
  textoBoton: { color: C.sub, fontSize: 14 },
  textoApagado: { color: C.apagado, fontSize: 13 },
  solido: { backgroundColor: C.claro, borderRadius: 2, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  apagado: { opacity: 0.5 },
  solidoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  aviso: { color: C.sub, fontSize: 13, marginTop: 14, textAlign: 'center', lineHeight: 19 },
  error: { color: C.error, fontSize: 13, marginTop: 14, textAlign: 'center' },
});
