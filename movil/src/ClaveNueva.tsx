import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { T } from '@nucleo/textos';
import { claveNuevaInvalida, porQueNoCambio } from '@nucleo/clave';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { supabase } from './supabase';
import CampoTexto from './CampoTexto';
import { C } from './colores';

/**
 * ELEGIR LA CONTRASEÑA NUEVA, después de tocar el enlace del correo (4/10).
 *
 * NO EXISTÍA. "Olvidé mi contraseña" y "Cambiar contraseña" mandaban el correo,
 * el enlace abría la app ya adentro, y ahí terminaba: nunca se elegía nada. La
 * web tiene su página (`/nueva-clave`); esto es lo mismo, con los mismos textos.
 *
 * VA ENCIMA DE TODO y no es una pantalla del router: el enlace puede llegar con
 * la app abierta en cualquier lado —desde Ajustes, justamente— y lo de abajo
 * tiene que seguir donde estaba.
 *
 * "AHORA NO" EXISTE porque la sesión ya está abierta: sin señal, o si el
 * enlace se tocó por error, la persona no puede quedar encerrada acá.
 */
export default function ClaveNueva({ alTerminar }: { alTerminar: () => void }) {
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [cambiada, setCambiada] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = useEnVuelo(async () => {
    const mal = claveNuevaInvalida(clave, repetida);
    if (mal) return setError(mal);
    setError('');
    setGuardando(true);
    const { error: e } = await supabase.auth.updateUser({ password: clave });
    setGuardando(false);
    if (e) return setError(porQueNoCambio(e));
    setCambiada(true);
    setTimeout(alTerminar, 1400);
  });

  return (
    <KeyboardAvoidingView style={estilos.todo} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={estilos.centro} keyboardShouldPersistTaps="handled">
        {cambiada ? (
          <Text style={estilos.aviso}>{T.clave.cambiada}</Text>
        ) : (
          <>
            <Text style={estilos.titulo}>{T.clave.titulo}</Text>
            <Text style={estilos.sub}>{T.clave.sub}</Text>
            <CampoTexto
              style={estilos.campo}
              value={clave}
              onChangeText={setClave}
              placeholder={T.clave.nueva}
              placeholderTextColor={C.apagado}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              accessibilityLabel={T.clave.nueva}
            />
            <CampoTexto
              style={estilos.campo}
              value={repetida}
              onChangeText={setRepetida}
              placeholder={T.clave.repetir}
              placeholderTextColor={C.apagado}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              accessibilityLabel={T.clave.repetir}
            />
            <Pressable style={[estilos.solido, guardando && estilos.apagado]} onPress={() => guardar()} disabled={guardando}>
              <Text style={estilos.solidoTexto}>{guardando ? T.sesion.guardando : T.general.guardar}</Text>
            </Pressable>
            {error !== '' && <Text style={estilos.error}>{error}</Text>}
            <Pressable onPress={alTerminar} hitSlop={10} style={estilos.despues}>
              <Text style={estilos.despuesTexto}>{T.clave.ahoraNo}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  // Opaco y por encima: debajo sigue la app, y no se tiene que ver ni tocar.
  todo: { ...StyleSheet.absoluteFillObject, backgroundColor: C.fondo, zIndex: 50 },
  centro: { flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 420, width: '100%', alignSelf: 'center' },
  titulo: { color: C.tinta, fontSize: 22, marginBottom: 6 },
  sub: { color: C.sub, fontSize: 14, marginBottom: 22 },
  campo: {
    borderBottomColor: C.lineaFuerte,
    borderBottomWidth: 1,
    color: C.tinta,
    fontSize: 16,
    paddingVertical: 10,
    marginBottom: 20,
  },
  solido: { backgroundColor: C.claro, borderRadius: 2, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  solidoTexto: { color: C.fondo, fontSize: 15, letterSpacing: 1 },
  apagado: { opacity: 0.5 },
  error: { color: C.error, fontSize: 14, marginTop: 14, textAlign: 'center' },
  aviso: { color: C.tinta, fontSize: 15, textAlign: 'center' },
  despues: { marginTop: 26, alignSelf: 'center' },
  despuesTexto: { color: C.sub, fontSize: 14 },
});
