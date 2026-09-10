import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { supabase } from './supabase';
import { nombreValido } from '@nucleo/usuario';
import { T } from '@nucleo/textos';

/**
 * ELEGIR EL NOMBRE — lo que falta para que una cuenta nueva sirva.
 *
 * Sin esto, alguien que crea la cuenta y entra en la app nativa se queda en
 * una pantalla que dice "te falta el nombre" y no puede hacer nada. Con esto,
 * la app nativa deja de depender de la web para el primer día.
 *
 * LA REGLA DEL NOMBRE NO ESTÁ ACÁ. Vive en `nucleo/usuario.ts` y la comparten
 * las tres pantallas que la usaban —onboarding y Ajustes en web, y esta— más
 * el `check` de la base. Estaba escrita tres veces; esta iba a ser la cuarta.
 *
 * SE VALIDA ANTES DE MANDAR pero la base igual valida: acá se hace para poder
 * decir qué está mal en lugar de mostrar el error técnico de un constraint.
 * El único que decide de verdad es el `check`, que es el que no puede confiar
 * en el teléfono.
 */
export default function Onboarding({ alElegir }: { alElegir: () => void }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function guardar() {
    setError('');
    // Se recorta antes de juzgar: al que le sobró un espacio no cometió un
    // error, se le fue el dedo.
    const limpio = nombre.trim();
    if (!nombreValido(limpio)) return setError(T.entrar.nombreFormato);

    setCargando(true);
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) {
      setCargando(false);
      return alElegir();
    }
    const { error } = await supabase.from('profiles').update({ username: limpio }).eq('id', uid);
    setCargando(false);
    if (error) {
      // 23505 es el índice único: ese nombre ya lo tiene alguien. 23514 es el
      // `check` del formato, que solo se puede llegar si la validación de
      // arriba y la de la base dejaron de decir lo mismo.
      if (error.code === '23505') return setError(T.ajustes.nombreTomado);
      if (error.code === '23514') return setError(T.entrar.nombreFormato);
      return setError(T.general.noSePudo);
    }
    alElegir();
  }

  return (
    <KeyboardAvoidingView
      style={estilos.todo}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={estilos.centro} keyboardShouldPersistTaps="handled">
        <Text style={estilos.marca}>{T.entrar.marca}</Text>
        <Text style={estilos.titulo}>{T.entrar.elegiNombre}</Text>
        <Text style={estilos.sub}>{T.entrar.elegiNombreSub}</Text>

        <TextInput
          style={estilos.campo}
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          placeholder={T.ajustes.nombrePlaceholder}
          placeholderTextColor="#4a5163"
        />

        <Pressable
          style={[estilos.solido, cargando && estilos.apagado]}
          onPress={guardar}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator color="#05060a" />
          ) : (
            <Text style={estilos.textoSolido}>{T.entrar.empezar}</Text>
          )}
        </Pressable>

        {error !== '' && <Text style={estilos.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#05060a' },
  centro: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  marca: {
    color: '#8a93a8',
    fontSize: 13,
    letterSpacing: 6,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 44,
  },
  titulo: { color: '#e8ecf6', fontSize: 22, marginBottom: 6 },
  sub: { color: '#8a93a8', fontSize: 14, marginBottom: 22 },
  campo: {
    borderBottomColor: '#2a3040',
    borderBottomWidth: 1,
    color: '#e8ecf6',
    fontSize: 16,
    paddingVertical: 10,
    marginBottom: 20,
  },
  solido: { backgroundColor: '#c4c2ba', borderRadius: 2, paddingVertical: 15, alignItems: 'center' },
  apagado: { opacity: 0.6 },
  textoSolido: { color: '#05060a', fontSize: 15, fontWeight: '600' },
  error: { color: '#e8705f', fontSize: 13, marginTop: 14, textAlign: 'center', lineHeight: 19 },
});
