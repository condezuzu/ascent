import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { T } from '@nucleo/textos';
import {
  LLAVERO_COMPARTIDO,
  pasoDeLaHoja,
  resultadoDeVincular,
  sesionDeMoss,
  type SesionCompartida,
} from '@nucleo/vinculoConMoss';
import { supabase } from '../supabase';
import { llavero } from '../plataforma/llavero';
import { useRecargarAlVolver } from '../irAPestana';
import Hoja from '../Hoja';
import { nuevaEnCadaApertura } from '../hojaNueva';
import { C } from '../colores';

const MOSS = 'moss://';
// Moss todavía no tiene enlace de la App Store: va a su página.
const CONSEGUIR_MOSS = 'https://condezuzu.github.io/moss-app/';
// El servidor revisa las dos sesiones con Supabase antes de guardar.
const TOPE_MS = 15_000;

type Props = { visible: boolean; alCerrar: () => void; alVincular: () => void };

/**
 * LA HOJA DE «VINCULAR CON MOSS» (D27): el segundo toque.
 *
 * Si Moss dejó su sesión en el llavero compartido, «Vincular» se la manda a `moss-vincular` junto
 * con la de Ascent (que pone el cliente). Si Moss está instalada pero su sesión no está o venció,
 * se abre Moss —que la deja al abrirse— y al volver se mira de nuevo; si no está instalada, se
 * ofrece conseguirla. Antes del botón dice qué lee cada app: vincular es dar permiso.
 */
function HojaDeMoss({ visible, alCerrar, alVincular }: Props) {
  // Lo que se vio en el llavero y si Moss está instalada; `instalada` es `null` mientras se mira.
  const [deMoss, setDeMoss] = useState<SesionCompartida | null>(null);
  const [instalada, setInstalada] = useState<boolean | null>(null);
  // El token que el servidor dijo que venció: no se vuelve a ofrecer hasta que Moss deje otro.
  const [rechazado, setRechazado] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [aviso, setAviso] = useState('');

  const mirarMoss = useCallback(async () => {
    const [crudo, puede] = await Promise.all([
      llavero.leer(LLAVERO_COMPARTIDO.deMoss),
      Linking.canOpenURL(MOSS).catch(() => false),
    ]);
    setDeMoss(sesionDeMoss(crudo, Math.floor(Date.now() / 1000)));
    setInstalada(puede);
  }, []);

  useEffect(() => {
    if (visible) void mirarMoss();
  }, [visible, mirarMoss]);

  // Al volver de Moss, que dejó su sesión al abrirse. La hoja queda montada cerrada: ahí no mira.
  const alVolver = useCallback(() => {
    if (visible) void mirarMoss();
  }, [visible, mirarMoss]);
  useRecargarAlVolver('ajustes', alVolver);

  const vigente = deMoss && deMoss.token !== rechazado ? deMoss : null;
  const paso = instalada === null ? null : pasoDeLaHoja(vigente, instalada);

  const vincular = useEnVuelo(async () => {
    if (!vigente) return;
    setAviso('');
    setVinculando(true);
    const { data, error, response } = await supabase.functions.invoke('moss-vincular', {
      body: { otra: vigente.token, desde: 'ascent' },
      timeout: TOPE_MS,
    });
    const cuerpo = error ? await response?.json().catch(() => null) : data;
    const r = resultadoDeVincular(error ? (response?.status ?? null) : 200, cuerpo);
    setVinculando(false);
    if (r.ok) return alVincular();
    if (r.motivo === 'vencida') {
      setRechazado(vigente.token);
      return setAviso(T.moss.vencida);
    }
    setAviso(r.motivo === 'red' ? T.errores.sinConexion : T.moss.noSeVinculo);
  });

  return (
    <Hoja visible={visible} alCerrar={alCerrar}>
      <Text style={estilos.titulo}>{T.moss.vincularConMoss}</Text>

      {paso === 'vincular' && vigente && (
        <View style={estilos.cuenta}>
          <Text style={estilos.tuMoss}>{T.moss.tuMoss}</Text>
          {vigente.nombre !== '' && <Text style={estilos.nombre}>{vigente.nombre}</Text>}
        </View>
      )}

      <Text style={estilos.subtitulo}>{T.moss.queSeComparte}</Text>
      <Text style={estilos.comparte}>{T.moss.mossLee}</Text>
      <Text style={estilos.comparte}>{T.moss.ascentLee}</Text>
      <Text style={estilos.nota}>{T.moss.esPermiso}</Text>

      {paso === 'vincular' && (
        <Pressable
          style={[estilos.solido, vinculando && estilos.apagado]}
          onPress={() => vincular()}
          disabled={vinculando}
          accessibilityRole="button"
          testID="moss-vincular-hoja"
        >
          <Text style={estilos.solidoTexto}>{vinculando ? T.moss.vinculando : T.moss.vincular}</Text>
        </Pressable>
      )}
      {paso === 'abrir-moss' && (
        <Pressable style={estilos.boton} onPress={() => void Linking.openURL(MOSS).catch(() => undefined)} accessibilityRole="button" testID="moss-abrir">
          <Text style={estilos.botonTexto}>{T.moss.abreMoss}</Text>
        </Pressable>
      )}
      {paso === 'conseguir-moss' && (
        <Pressable
          style={estilos.boton}
          onPress={() => void Linking.openURL(CONSEGUIR_MOSS).catch(() => undefined)}
          accessibilityRole="button"
          testID="moss-conseguir"
        >
          <Text style={estilos.botonTexto}>{T.moss.conseguirMoss}</Text>
        </Pressable>
      )}

      {aviso !== '' && <Text style={estilos.error}>{aviso}</Text>}
    </Hoja>
  );
}

export default nuevaEnCadaApertura(HojaDeMoss, (p) => p.visible);

const estilos = StyleSheet.create({
  titulo: { color: C.tinta, fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 18 },
  cuenta: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  tuMoss: { color: C.tinta, fontSize: 15 },
  nombre: { color: C.sub, fontSize: 13, marginTop: 3 },
  subtitulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  comparte: { color: C.tinta, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 4 },
  solido: { backgroundColor: C.claro, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  solidoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  apagado: { opacity: 0.6 },
  boton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  botonTexto: { color: C.tinta, fontSize: 15 },
  error: { color: C.error, fontSize: 13, marginTop: 14, lineHeight: 19 },
});
