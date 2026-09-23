import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  CLAVE_META_PASOS,
  META_PASOS_POR_OMISION,
  leerMeta,
  metaValida,
} from '@nucleo/pasos';
import { T } from '@nucleo/textos';
import { plataforma } from '@plataforma';
import { C } from '../colores';

/**
 * LA META DE PASOS DEL DÍA.
 *
 * VIVE EN EL APARATO Y NO EN LA BASE, igual que "Fondo: automático / siempre /
 * nunca". No es un dato de la persona: es cómo quiere ver un gráfico. Meterla
 * en `profiles` habría costado una migración para una preferencia que nadie más
 * va a leer nunca.
 *
 * NO ENTRA EN LA RACHA Y SE DICE EN PANTALLA. Si los pasos contaran para la
 * racha, esta app dejaría de contar días de gimnasio y pasaría a contar otra
 * cosa. La meta es para mirar el gráfico y saber cuánto falta, y nada más.
 *
 * SE GUARDA AL SALIR DEL CAMPO y no con cada tecla: guardando por tecla, un
 * "1" a medio escribir sería una meta de mil pasos por un instante, y además
 * escribiría cinco veces para un número de cinco cifras.
 */
export default function MetaDePasos({ alCambiar }: { alCambiar?: (meta: number) => void } = {}) {
  const [valor, setValor] = useState(String(META_PASOS_POR_OMISION));
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    plataforma.almacenamiento
      .leer(CLAVE_META_PASOS)
      .then((m) => {
        if (vivo) setValor(String(leerMeta(m)));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar() {
    const n = Number(valor);
    if (!metaValida(n)) {
      // NO SE PISA LO ESCRITO: se avisa y se deja el número a la vista para
      // corregirlo. Devolverlo al valor viejo obliga a escribirlo de nuevo.
      setError(T.ajustes.metaPasosFuera);
      return;
    }
    setError('');
    const limpio = String(Math.round(n));
    setValor(limpio);
    // QUIEN LA MUESTRA SE ENTERA EN EL ACTO. Sin esto, cambiar la meta desde el
    // grafico dejaba la linea punteada donde estaba hasta volver a entrar, que
    // es justo lo que hace dudar de si el cambio se guardo.
    alCambiar?.(Math.round(n));
    await plataforma.almacenamiento.guardar(CLAVE_META_PASOS, limpio).catch(() => {});
  }

  return (
    <View style={estilos.seccion}>
      <Text style={estilos.titulo}>{T.ajustes.metaPasosTitulo}</Text>
      <TextInput
        style={estilos.campo}
        value={valor}
        onChangeText={setValor}
        onBlur={guardar}
        keyboardType="number-pad"
        returnKeyType="done"
        onSubmitEditing={guardar}
        accessibilityLabel={T.ajustes.metaPasosTitulo}
      />
      {/* Un botón además del `onBlur`: en un teclado numérico de iOS no hay
          "listo", y tocar afuera para guardar no se le ocurre a nadie. */}
      <Pressable style={estilos.boton} onPress={guardar}>
        <Text style={estilos.botonTexto}>{T.general.guardar}</Text>
      </Pressable>
      {error !== '' && <Text style={estilos.error}>{error}</Text>}
      <Text style={estilos.nota}>{T.ajustes.metaPasosNota}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 },
  campo: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: C.tinta,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  boton: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
  },
  botonTexto: { color: C.tinta, fontSize: 14 },
  error: { color: C.error, fontSize: 12, marginTop: 8 },
  nota: { color: C.apagado, fontSize: 12, marginTop: 10, lineHeight: 17 },
});
