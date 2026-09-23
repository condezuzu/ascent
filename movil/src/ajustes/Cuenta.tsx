import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { borrarPerfilCache } from '@compartido/cache';
import { reiniciarGuia } from '@compartido/guia';
import { eventos } from '@compartido/eventos';
import { plataforma } from '@plataforma';
import { GUIA_DE_NUEVO } from '../Recorrido';
import { eliminarCuenta } from '@compartido/cuenta';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { supabase } from '../supabase';
import { VUELTA } from '../enlace';
import { C } from '../colores';

/**
 * LO ÚLTIMO DE AJUSTES: cambiar la clave, salir, y darse de baja.
 *
 * ELIMINAR LA CUENTA NO ES OPCIONAL EN iOS. Apple exige que una app que deja
 * crear cuenta deje borrarla DESDE ADENTRO, y hasta hoy eso solo estaba en la
 * web: con esto puesto, la app puede pasar revisión.
 *
 * SE PIDE ESCRIBIR EL NOMBRE DE USUARIO A MANO. Un "¿seguro?" se aprieta sin
 * leer, y esto no tiene vuelta atrás: se borra el perfil, los días, las
 * sesiones, las marcas, el peso, las fotos y las amistades.
 *
 * CAMBIAR LA CLAVE SE HACE POR CORREO y no con un campo acá: cambiarla desde
 * adentro pide la clave vieja, y quien la olvidó —que es el caso normal— no la
 * tiene. El correo es el mismo camino que "olvidé mi contraseña" y vuelve a la
 * app por el enlace (`enlace.ts`).
 */
export default function Cuenta({ perfil, alSalir }: { perfil: Perfil; alSalir: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  // REINICIA EL RECORRIDO **Y** LOS GLOBOS. Si solo volviera el recorrido, el
  // que quiere repasar de qué va cada pantalla no lo conseguiría: las dos
  // cosas son la guía. Y avisa, porque el que la pide está mirando Ajustes y
  // el recorrido tiene que aparecer ahí mismo, no al reabrir la app.
  async function verLaGuiaDeNuevo() {
    await reiniciarGuia(perfil.id);
    eventos.emitir(GUIA_DE_NUEVO);
  }

  async function cambiarClave() {
    setError('');
    setAviso('');
    const { data } = await supabase.auth.getUser();
    const correo = data.user?.email;
    if (!correo) return setError(T.general.noSePudo);
    const { error: err } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: VUELTA,
    });
    if (err) return setError(T.general.noSePudo);
    setAviso(T.entrar.revisaCorreo);
  }

  async function salir() {
    await borrarPerfilCache(); // que la próxima cuenta no vea la racha de esta
    // Y SE SUELTA LA ZONA DEL GIMNASIO (24/9). Es lo único de esta app que
    // sigue andando con la app cerrada, así que es lo único que no se va solo
    // al salir: sin esto, el teléfono seguiría despertando a la app en el
    // gimnasio de una cuenta que ya no está, con el punto del dueño anterior.
    await plataforma.ubicacion.dejarDeVigilar();
    await supabase.auth.signOut();
    alSalir();
  }

  async function borrar() {
    setBorrando(true);
    setError('');
    const r = await eliminarCuenta(supabase, perfil.id);
    if ('error' in r) {
      setBorrando(false);
      return setError(r.error);
    }
    await borrarPerfilCache();
    await plataforma.ubicacion.dejarDeVigilar();
    await supabase.auth.signOut();
    alSalir();
  }

  return (
    <View style={estilos.seccion}>
      {/* VER LA GUÍA DE NUEVO (§10). Faltaba en el teléfono: no podía existir
          hasta que existiera el recorrido, y ahora existe. */}
      <Pressable style={estilos.texto} onPress={verLaGuiaDeNuevo}>
        <Text style={estilos.enlace}>{T.ajustes.verGuia}</Text>
      </Pressable>
      <Pressable style={estilos.texto} onPress={cambiarClave}>
        <Text style={estilos.enlace}>{T.ajustes.cambiarClave}</Text>
      </Pressable>
      <Pressable style={estilos.texto} onPress={salir}>
        <Text style={estilos.enlace}>{T.ajustes.cerrarSesion}</Text>
      </Pressable>

      {!abierta ? (
        <Pressable style={estilos.texto} onPress={() => setAbierta(true)}>
          <Text style={estilos.peligro}>{T.ajustes.eliminarCuenta}</Text>
        </Pressable>
      ) : (
        <View style={estilos.caja}>
          <Text style={estilos.titulo}>{T.ajustes.eliminarCuenta}</Text>
          <Text style={estilos.que}>{T.ajustes.bajaQueSeElimina(perfil.racha_actual)}</Text>
          <Text style={estilos.nota}>
            {T.ajustes.bajaEscribe} <Text style={estilos.fuerte}>{perfil.username}</Text> {T.ajustes.bajaEscribiFin}
          </Text>
          <TextInput
            style={estilos.campo}
            value={confirmacion}
            onChangeText={setConfirmacion}
            placeholder={perfil.username ?? ''}
            placeholderTextColor={C.apagado}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={estilos.botones}>
            <Pressable
              style={[estilos.botonPeligro, confirmacion.trim() !== perfil.username && estilos.apagado]}
              onPress={borrar}
              disabled={borrando || confirmacion.trim() !== perfil.username}
            >
              <Text style={estilos.botonPeligroTexto}>{borrando ? T.ajustes.bajaEliminando : T.ajustes.bajaConfirmar}</Text>
            </Pressable>
            <Pressable
              style={estilos.boton}
              onPress={() => {
                setAbierta(false);
                setConfirmacion('');
                setError('');
              }}
              disabled={borrando}
            >
              <Text style={estilos.botonTexto}>{T.ajustes.mejorNo}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {aviso !== '' && <Text style={estilos.ok}>{aviso}</Text>}
      {error !== '' && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 34 },
  texto: { paddingVertical: 12 },
  enlace: { color: C.sub, fontSize: 15 },
  peligro: { color: C.error, fontSize: 15 },
  caja: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.error,
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
  },
  titulo: { color: C.tinta, fontSize: 16, marginBottom: 8 },
  que: { color: C.sub, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  fuerte: { color: C.tinta },
  campo: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.tinta,
    fontSize: 15,
  },
  botones: { flexDirection: 'row', gap: 8, marginTop: 12 },
  botonPeligro: { flex: 1, backgroundColor: C.error, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  botonPeligroTexto: { color: C.fondo, fontSize: 14, fontWeight: '600' },
  apagado: { opacity: 0.45 },
  boton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  botonTexto: { color: C.tinta, fontSize: 14 },
  ok: { color: C.sub, fontSize: 13, marginTop: 10 },
  error: { color: C.error, fontSize: 13, marginTop: 10 },
});
