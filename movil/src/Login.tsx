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
  View,
} from 'react-native';
import { supabase } from './supabase';
import { mensajeDeAuth } from '@nucleo/errores';
import { T } from '@nucleo/textos';

/**
 * ENTRAR — TANDA 2, y la primera pantalla de verdad de la app nativa.
 *
 * ES LA MISMA LÓGICA QUE LA WEB, y eso se nota en lo que NO está acá: no hay
 * mensajes de error propios —`mensajeDeAuth` se mudó al núcleo y lo usan las
 * dos apps—, ni textos sueltos —salen de `T.entrar`—, ni reglas nuevas. Lo
 * único que cambia es que los `<div>` son `<View>`. Si esta pantalla hubiera
 * necesitado inventar algo, sería la señal de que el núcleo quedó corto.
 *
 * TRES MODOS Y NO TRES PANTALLAS: entrar, crear cuenta y recuperar son el
 * mismo formulario con otro botón. En un teléfono, tres pantallas para dos
 * campos es un menú.
 *
 * LO QUE FALTA Y ES DE OTRA TANDA: crear cuenta manda a confirmar el correo, y
 * el enlace de confirmación abre el navegador. Para que vuelva a la app hay
 * que enganchar el deep link con el `scheme: ascent` que ya está en
 * `app.json`. Mientras tanto se puede crear la cuenta en la web y entrar acá,
 * que es exactamente lo que hace falta para probar esto.
 *
 * NO HAY GOOGLE. En web está apagado hasta configurar el proveedor; acá
 * además necesita el flujo de OAuth nativo, que es otra cosa. Un botón que
 * falla es peor que no tenerlo.
 */

type Modo = 'entrar' | 'crear' | 'recuperar';

export default function Login({ alEntrar }: { alEntrar: () => void }) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);

  function cambiarModo(m: Modo) {
    setModo(m);
    setError('');
    setAviso('');
  }

  async function enviar() {
    setError('');
    setAviso('');
    setCargando(true);

    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      setCargando(false);
      if (error) return setError(mensajeDeAuth(error));
      return alEntrar();
    }

    if (modo === 'crear') {
      const { data, error } = await supabase.auth.signUp({ email, password: pass });
      setCargando(false);
      if (error) return setError(mensajeDeAuth(error));
      // Si Supabase no exige confirmar el correo, el alta ya devuelve sesión y
      // hay que entrar derecho: mandar a revisar un correo que nunca va a
      // llegar deja a alguien mirando el login estando ya adentro.
      if (data.session) return alEntrar();
      return setAviso(T.entrar.revisaCorreo);
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setCargando(false);
    // No se distingue si el mail existe: decirlo filtra quién tiene cuenta.
    // Un fallo de red o de configuración sí se dice, porque no es lo mismo.
    if (error) return setError(mensajeDeAuth(error));
    setAviso(T.entrar.siTieneCuenta);
  }

  const titulo =
    modo === 'entrar'
      ? T.entrar.entrar
      : modo === 'crear'
        ? T.entrar.crearCuenta
        : T.entrar.enviarCorreo;

  return (
    <KeyboardAvoidingView
      style={estilos.todo}
      // El teclado NO puede tapar el campo que se está escribiendo. En web es
      // el navegador el que se encarga; acá hay que decirlo, y con la palabra
      // distinta en cada sistema.
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={estilos.centro} keyboardShouldPersistTaps="handled">
        <Text style={estilos.marca}>{T.entrar.marca}</Text>

        <Text style={estilos.etiqueta}>{T.entrar.correo}</Text>
        <TextInput
          style={estilos.campo}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholderTextColor="#4a5163"
          placeholder="nombre@correo.com"
        />

        {modo !== 'recuperar' && (
          <>
            <Text style={estilos.etiqueta}>{T.entrar.contrasena}</Text>
            <TextInput
              style={estilos.campo}
              value={pass}
              onChangeText={setPass}
              secureTextEntry
              autoCapitalize="none"
              // `password` y no `newPassword` al entrar: le dice al llavero
              // del teléfono que ofrezca la guardada en vez de proponer una.
              textContentType={modo === 'crear' ? 'newPassword' : 'password'}
            />
          </>
        )}

        <Pressable
          style={[estilos.solido, cargando && estilos.apagado]}
          onPress={enviar}
          disabled={cargando}
        >
          {cargando ? (
            <ActivityIndicator color="#05060a" />
          ) : (
            <Text style={estilos.textoSolido}>{titulo}</Text>
          )}
        </Pressable>

        {error !== '' && <Text style={estilos.error}>{error}</Text>}
        {aviso !== '' && <Text style={estilos.aviso}>{aviso}</Text>}

        <View style={estilos.secundarios}>
          {modo !== 'entrar' && (
            <Pressable onPress={() => cambiarModo('entrar')}>
              <Text style={estilos.enlace}>{T.entrar.volverAEntrar}</Text>
            </Pressable>
          )}
          {modo === 'entrar' && (
            <>
              <Pressable onPress={() => cambiarModo('crear')}>
                <Text style={estilos.enlace}>{T.entrar.primeraVez}</Text>
              </Pressable>
              <Pressable onPress={() => cambiarModo('recuperar')}>
                <Text style={estilos.enlace}>{T.entrar.olvide}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Los colores son los mismos que los de la web: `--fondo`, `--tinta`, `--sub`.
// Salen a mano porque el sistema de paletas por rango es del motor visual y
// esa pantalla todavía no existe acá; cuando llegue, esto se va a leer de un
// solo lado.
const estilos = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#05060a' },
  centro: { flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 420, width: '100%', alignSelf: 'center' },
  marca: {
    color: '#8a93a8',
    fontSize: 13,
    letterSpacing: 6,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 44,
  },
  etiqueta: {
    color: '#8a93a8',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  campo: {
    borderBottomColor: '#2a3040',
    borderBottomWidth: 1,
    color: '#e8ecf6',
    fontSize: 16,
    paddingVertical: 10,
    marginBottom: 20,
  },
  solido: {
    backgroundColor: '#c4c2ba',
    borderRadius: 2,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  apagado: { opacity: 0.6 },
  textoSolido: { color: '#05060a', fontSize: 15, fontWeight: '600' },
  error: { color: '#e8705f', fontSize: 13, marginTop: 14, textAlign: 'center', lineHeight: 19 },
  aviso: { color: '#8a93a8', fontSize: 13, marginTop: 14, textAlign: 'center', lineHeight: 19 },
  secundarios: { marginTop: 26, gap: 14, alignItems: 'center' },
  enlace: { color: '#8a93a8', fontSize: 13 },
});
