import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bloquear, denunciar, MOTIVOS_DENUNCIA, type MotivoDenuncia } from '@compartido/ranking';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import Hoja from './Hoja';
import { nuevaEnCadaApertura } from './hojaNueva';
import { C } from './colores';

/**
 * DENUNCIAR O BLOQUEAR a alguien (migración 53). Una hoja que sube desde abajo,
 * reutilizada desde el perfil de un amigo y desde el ranking (long-press).
 *
 * El motivo de la denuncia sale de una lista cerrada, no de texto libre. Bloquear
 * pide confirmación porque corta la amistad y no se deshace solo.
 *
 * Se abre cuando `usuario` deja de ser null; se cierra volviendo a null.
 */
type Usuario = { id: string; username: string };

function AccionesDeUsuario({
  usuario,
  onCerrar,
  onBloqueado,
}: {
  usuario: Usuario | null;
  onCerrar: () => void;
  onBloqueado?: (id: string) => void;
}) {
  const [paso, setPaso] = useState<'menu' | 'motivos' | 'bloqueo'>('menu');
  const [ocupado, setOcupado] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState('');

  function cerrar() {
    onCerrar();
    // que la próxima vez abra en el menú, no donde quedó
    setTimeout(() => {
      setPaso('menu');
      setEnviada(false);
      setError('');
      setOcupado(false);
    }, 200);
  }

  // Traba contra el doble-tap: sin esto, dos toques dejaban DOS denuncias (la
  // tabla dedupe por (denunciante,denunciado), así que la segunda choca, pero
  // igual dispara la RPC de más). El bloqueo es idempotente, pero el segundo
  // toque caía sobre una hoja ya cerrándose.
  const elegirMotivo = useEnVuelo(async (m: MotivoDenuncia) => {
    if (!usuario) return;
    setOcupado(true);
    setError('');
    const ok = await denunciar(supabase, usuario.id, m);
    setOcupado(false);
    if (!ok) return setError(T.general.noSePudo);
    setEnviada(true);
  });

  const confirmarBloqueo = useEnVuelo(async () => {
    if (!usuario) return;
    setOcupado(true);
    setError('');
    const ok = await bloquear(supabase, usuario.id);
    setOcupado(false);
    if (!ok) return setError(T.general.noSePudo);
    onBloqueado?.(usuario.id);
    cerrar();
  });

  return (
    <Hoja visible={usuario !== null} alCerrar={cerrar}>
      {enviada ? (
        <View style={estilos.grupo}>
          <Text style={estilos.ok}>{T.social.denunciaEnviada}</Text>
          <Pressable style={estilos.cancelar} onPress={cerrar}>
            <Text style={estilos.cancelarTexto}>{T.general.entendido}</Text>
          </Pressable>
        </View>
      ) : paso === 'menu' ? (
        <View style={estilos.grupo}>
          <Text style={estilos.titulo}>@{usuario?.username}</Text>
          <Pressable style={estilos.item} onPress={() => setPaso('motivos')}>
            <Text style={estilos.itemTexto}>{T.social.denunciar}</Text>
          </Pressable>
          <Pressable style={estilos.item} onPress={() => setPaso('bloqueo')}>
            <Text style={estilos.itemPeligro}>{T.social.bloquear}</Text>
          </Pressable>
          <Pressable style={estilos.cancelar} onPress={cerrar}>
            <Text style={estilos.cancelarTexto}>{T.general.cancelar}</Text>
          </Pressable>
        </View>
      ) : paso === 'motivos' ? (
        <View style={estilos.grupo}>
          <Text style={estilos.titulo}>{T.social.denunciaTitulo}</Text>
          {MOTIVOS_DENUNCIA.map((m) => (
            <Pressable key={m} style={estilos.item} disabled={ocupado} onPress={() => elegirMotivo(m)}>
              <Text style={estilos.itemTexto}>{T.social.denunciaMotivos[m]}</Text>
            </Pressable>
          ))}
          {error !== '' && <Text style={estilos.error}>{error}</Text>}
          <Pressable style={estilos.cancelar} onPress={() => setPaso('menu')}>
            <Text style={estilos.cancelarTexto}>{T.general.volver}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={estilos.grupo}>
          <Text style={estilos.titulo}>{usuario ? T.social.bloquearTitulo(usuario.username) : ''}</Text>
          <Text style={estilos.que}>{T.social.bloquearQue}</Text>
          {error !== '' && <Text style={estilos.error}>{error}</Text>}
          <Pressable style={estilos.peligro} disabled={ocupado} onPress={() => confirmarBloqueo()}>
            <Text style={estilos.peligroTexto}>{T.social.bloquearConfirmar}</Text>
          </Pressable>
          <Pressable style={estilos.cancelar} onPress={() => setPaso('menu')}>
            <Text style={estilos.cancelarTexto}>{T.general.volver}</Text>
          </Pressable>
        </View>
      )}
    </Hoja>
  );
}

export default nuevaEnCadaApertura(AccionesDeUsuario, (p) => p.usuario !== null);

const estilos = StyleSheet.create({
  grupo: { gap: 4 },
  titulo: { color: C.tinta, fontSize: 16, marginBottom: 10 },
  que: { color: C.sub, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  item: { paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.linea },
  itemTexto: { color: C.tinta, fontSize: 16 },
  itemPeligro: { color: C.error, fontSize: 16 },
  peligro: { backgroundColor: C.error, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  peligroTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  cancelar: { paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  cancelarTexto: { color: C.sub, fontSize: 15 },
  ok: { color: C.tinta, fontSize: 16, lineHeight: 22, paddingVertical: 8 },
  error: { color: C.error, fontSize: 13, marginTop: 10 },
});
