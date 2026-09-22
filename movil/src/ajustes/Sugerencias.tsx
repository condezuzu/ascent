import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { T } from '@nucleo/textos';
import { supabase } from '../supabase';
import { C } from '../colores';

/**
 * DECIR ALGO SIN SALIR DE LA APP.
 *
 * EN NATIVO IMPORTA MÁS QUE EN LA WEB, y por eso entró en esta tanda: en la
 * computadora, contar un problema es cambiar de ventana; en el gimnasio, con
 * una mano, es esto o es nada — y lo que se pierde ahí es justo lo que pasa
 * usándola de verdad.
 *
 * `plataforma` SALE DE `Platform.OS` y no de una cadena escrita a mano: es el
 * campo que después dice si un problema es de un lado o de los dos.
 */
export default function Sugerencias({ userId }: { userId: string }) {
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  async function mandar() {
    if (!texto.trim()) return;
    setError('');
    const { error: err } = await supabase.from('feedback').insert({
      user_id: userId,
      texto: texto.trim(),
      tipo: 'idea',
      version_app: '0.1.0',
      plataforma: Platform.OS,
      pantalla_origen: 'ajustes',
    });
    if (err) return setError(T.general.noSePudo);
    setTexto('');
    setEnviado(true);
    setTimeout(() => setEnviado(false), 3500);
  }

  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo}>{T.ajustes.sugerencias}</Text>
      <TextInput
        style={estilos.campo}
        placeholder={T.ajustes.sugerenciasPlaceholder}
        placeholderTextColor={C.apagado}
        value={texto}
        onChangeText={setTexto}
        multiline
        numberOfLines={3}
        maxLength={2000}
      />
      <Pressable style={[estilos.boton, !texto.trim() && estilos.apagado]} onPress={mandar} disabled={!texto.trim()}>
        <Text style={estilos.botonTexto}>{T.ajustes.mandar}</Text>
      </Pressable>
      {enviado && <Text style={estilos.ok}>{T.ajustes.sugerenciaEnviada}</Text>}
      {error !== '' && <Text style={estilos.error}>{error}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  // EL MISMO RÓTULO QUE EL RESTO DE AJUSTES: chico, en versalitas y apagado.
  // Estas secciones nacieron con título grande y quedaban como pegadas de otra
  // pantalla — dos estilos de título en una lista se leen como un error.
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  campo: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.tinta,
    fontSize: 15,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  boton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  apagado: { opacity: 0.45 },
  botonTexto: { color: C.tinta, fontSize: 14 },
  ok: { color: C.sub, fontSize: 13, marginTop: 8 },
  error: { color: C.error, fontSize: 13, marginTop: 8 },
});
