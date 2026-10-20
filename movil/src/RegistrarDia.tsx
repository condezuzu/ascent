import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { supabase } from './supabase';
import { fechaLinda, hoyISO } from '@nucleo/fechas';
import { estaBloqueado, textoDeBloqueo } from '@nucleo/pendiente';
import type { ResultadoRegistro, Visibilidad } from '@nucleo/tipos';
import { subidaDeRango } from '@nucleo/rangos';
import { fotoCompartida, selloAlAzar } from '@nucleo/foto';
import { miId } from '@compartido/quienSoy';
import { T } from '@nucleo/textos';
import { subirFotoDelDia } from '@compartido/foto';
import { anotarElDia } from '@compartido/anotarDia';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { eventos } from '@compartido/eventos';
import { DIA_CAMBIO } from '@compartido/gimnasio';
import { prepararFoto, prepararMiniatura } from './foto';
import Hoja from './Hoja';
import { nuevaEnCadaApertura } from './hojaNueva';
import { FIJO } from './coloresFijos';

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
function RegistrarDia({
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
  // Cuándo se eligió ESTA foto: le da nombre al archivo, y es el mismo en cada intento de subirla.
  const selloDeFoto = useRef(0);
  // Lo que se tocó en ESTA apertura. Mientras no se toque, sigue a Ajustes.
  const [tocado, setTocado] = useState<boolean | null>(null);
  const compartida = fotoCompartida(tocado, visibilidadDefault);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  // EL DÍA ENTRÓ PERO LA FOTO NO (bug del 15/9). Antes la hoja se cerraba igual:
  // el error quedaba escondido y la foto, descartada. Ahora queda abierta, con
  // la foto, en modo "sumar al día", y reintentar la cuelga del día que entró.
  const [registradoAca, setRegistradoAca] = useState<ResultadoRegistro | null>(null);
  // Si ese registro subió de rango, con la regla del cliente (`subidaDeRango`).
  const [subioAca, setSubioAca] = useState(false);
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
      if (a) {
        selloDeFoto.current = selloAlAzar();
        setFoto({ uri: a.uri, ancho: a.width, alto: a.height });
      }
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
    // La miniatura para la grilla del álbum, de la misma imagen. Si no sale, la
    // foto sube igual.
    const miniatura = await prepararMiniatura(foto.uri, foto.ancho, foto.alto);
    const r = await subirFotoDelDia(supabase, { datos: lista.datos, miniatura, dia, logId: idDelLog, visible: compartida, subioRango, sello: selloDeFoto.current || undefined });
    if (r !== 'ok') {
      setError(T.general.falloFoto);
      return false;
    }
    return true;
  }

  // Traba contra el doble-tap: sin esto, dos toques subían DOS fotos al mismo día
  // (el día se dedupe por el unique, pero `subir` no estaba guardado).
  const confirmar = useEnVuelo(async () => {
    setError('');
    setAviso('');
    setCargando(true);
    if (yaEsta) {
      const ok = await subir(idDelDia, !!registradoAca && subioAca);
      setCargando(false);
      if (ok) {
        setFoto(null);
        const r = registradoAca;
        setRegistradoAca(null);
        alConfirmar(r);
      }
      return;
    }
    const { data, error: e } = await anotarElDia(supabase, 'manual');
    if (e) {
      setCargando(false);
      // 23505: el día ya estaba (lo anotó la sesión o la ubicación y esta
      // pantalla no llegó a enterarse). No es un error que haya que mostrar.
      if (e.code === '23505') {
        if (!foto) return alConfirmar(null);
        // CON UNA FOTO ELEGIDA NO SE CIERRA TIRÁNDOLA: se busca el día y se
        // cuelga de él. Si no se puede, la hoja queda abierta con la foto.
        setCargando(true);
        const uid = await miId(supabase);
        const { data: log } = uid
          ? await supabase.from('logs').select('id').eq('user_id', uid).eq('fecha', dia).maybeSingle()
          : { data: null };
        const subio = log?.id ? await subir(log.id as string, false) : false;
        setCargando(false);
        if (!subio) return setError(T.general.falloFoto);
        setFoto(null);
        return alConfirmar(null);
      }
      return setError(T.general.noSePudo);
    }
    if (estaBloqueado(data)) {
      setCargando(false);
      return setAviso(textoDeBloqueo(data.hasta));
    }
    const resultado = data as ResultadoRegistro;
    // Sin foto no sale FOTOS_CAMBIO: el Álbum se entera por acá de que el día entró.
    eventos.emitir(DIA_CAMBIO);
    // `racha` es la que se veía al abrir la hoja: la de antes de registrar.
    const subio = subidaDeRango(racha, resultado.racha) !== null;
    setSubioAca(subio);
    // El día ya entró: si la foto falla se dice, pero el día no se pierde.
    const ok = await subir(resultado.log_id, subio);
    setCargando(false);
    if (!ok) return setRegistradoAca(resultado);
    // SUBISTE DE RANGO Y NO PUSISTE FOTO (4.4): el momento de más orgullo de la
    // app no puede pasar en silencio. Se OFRECE sacar una foto —no se obliga—: el
    // día ya está registrado, la hoja queda en modo "sumar foto" con el aviso, y
    // si cerrás seguís normal (el cierre confirma igual, ver `alCerrar`).
    if (subio && !foto) {
      setRegistradoAca(resultado);
      setAviso(T.registrar.subioRangoFoto);
      return;
    }
    setFoto(null);
    alConfirmar(resultado);
  });

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

      {/* LA FOTO EN UNA TARJETA GRANDE (20/10): el mismo estilo que anotar el peso. */}
      <View style={estilos.tarjeta} testID="registrar-foto">
        {foto ? (
          <Image source={{ uri: foto.uri }} style={estilos.vista} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={estilos.puertas}>
            <Puerta icono="camara" texto={T.registrar.sacarFoto} alTocar={() => elegir('camara')} />
            <Puerta icono="galeria" texto={T.registrar.elegirFoto} alTocar={() => elegir('galeria')} />
          </View>
        )}
      </View>
      {foto && (
        <View style={estilos.chips}>
          <Pressable style={estilos.chip} onPress={() => setTocado(!compartida)} testID="registrar-foto-quien">
            <Text style={estilos.chipTexto}>{compartida ? T.registrar.laVenAmigos : T.registrar.soloLaVesVos}</Text>
          </Pressable>
          <Pressable style={estilos.chip} onPress={() => setFoto(null)}>
            <Text style={estilos.chipApagado}>{T.registrar.quitarFoto}</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[estilos.solido, (cargando || (yaEsta && !foto)) && estilos.apagado]}
        onPress={() => confirmar()}
        disabled={cargando || (yaEsta && !foto)}
        testID="registrar-confirmar"
      >
        {cargando ? (
          <ActivityIndicator color={FIJO.negro} />
        ) : (
          <Text style={estilos.solidoTexto}>{yaEsta ? T.general.guardar : T.inicio.registrarDia}</Text>
        )}
      </Pressable>
      {aviso !== '' && <Text style={[estilos.aviso, !!registradoAca && subioAca && estilos.avisoSubida]}>{aviso}</Text>}
      {error !== '' && <Text style={estilos.error}>{error}</Text>}
    </Hoja>
  );
}

export default nuevaEnCadaApertura(RegistrarDia, (p) => p.visible);

/** Sacar o elegir: el botón redondo de la hoja del peso, con su ícono y el texto abajo. */
function Puerta({ icono, texto, alTocar }: { icono: 'camara' | 'galeria'; texto: string; alTocar: () => void }) {
  return (
    <Pressable style={estilos.puerta} onPress={alTocar} accessibilityRole="button" testID={'registrar-foto-' + icono}>
      {({ pressed }) => (
        <>
          <View style={[estilos.redondo, pressed && estilos.redondoApretado]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={FIJO.tinta} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              {icono === 'camara' ? (
                <>
                  <Path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z" />
                  <Circle cx={12} cy={13.2} r={3.4} />
                </>
              ) : (
                <>
                  <Rect x={4} y={5} width={16} height={14} rx={2.5} />
                  <Circle cx={9.2} cy={10} r={1.6} />
                  <Path d="M20 16l-4.6-4.6L7 19" />
                </>
              )}
            </Svg>
          </View>
          <Text style={estilos.puertaTexto}>{texto}</Text>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  titulo: { color: FIJO.tinta, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  sub: { color: FIJO.sub, fontSize: 13, marginTop: 4, marginBottom: 16, textAlign: 'center' },
  tarjeta: { width: '100%', aspectRatio: 4 / 5, maxHeight: 360, alignSelf: 'center', borderRadius: 22, overflow: 'hidden', backgroundColor: FIJO.regla, borderWidth: 1, borderColor: FIJO.linea, alignItems: 'center', justifyContent: 'center' },
  vista: { width: '100%', height: '100%' },
  puertas: { flexDirection: 'row', gap: 36 },
  puerta: { alignItems: 'center', gap: 10 },
  redondo: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: FIJO.borde, backgroundColor: FIJO.negro, alignItems: 'center', justifyContent: 'center' },
  redondoApretado: { backgroundColor: FIJO.apretado },
  puertaTexto: { color: FIJO.sub, fontSize: 13 },
  chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: FIJO.raya, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipTexto: { color: FIJO.tinta, fontSize: 13 },
  chipApagado: { color: FIJO.sub, fontSize: 13 },
  solido: { backgroundColor: FIJO.crema, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  apagado: { opacity: 0.5 },
  solidoTexto: { color: FIJO.negro, fontSize: 15, fontWeight: '600' },
  aviso: { color: FIJO.sub, fontSize: 13, marginTop: 14, textAlign: 'center', lineHeight: 19 },
  // El aviso de subida de rango va encendido: es un premio, no un aviso más.
  avisoSubida: { color: FIJO.crema, fontSize: 14, fontWeight: '500' },
  error: { color: FIJO.error, fontSize: 13, marginTop: 14, textAlign: 'center' },
});
