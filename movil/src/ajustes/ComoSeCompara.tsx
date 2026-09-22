import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COMO_SE_COMPARA, type Parte } from '@nucleo/comoSeCompara';
import { T } from '@nucleo/textos';
import { C } from '../colores';

/**
 * CÓMO SE CALCULA EL RANKING DE FUERZA, abajo de todo en Ajustes.
 *
 * ES LA ÚNICA PANTALLA DE LA APP DONDE UN TEXTO LARGO ESTÁ BIEN: el que lo
 * abre vino a leer. En el resto, si algo necesita un párrafo está mal
 * diseñado.
 *
 * VA PLEGADO, porque el que no lo busca no tiene por qué pasarle el dedo por
 * encima: son dos pantallas de texto en un teléfono.
 *
 * EL TEXTO NO ESTÁ ACÁ: vive en `nucleo/comoSeCompara.ts` y lo comparten las
 * dos apps. Copiarlo habría sido tener dos ensayos que dicen lo mismo hasta el
 * día en que uno se corrige — y el viejo sigue explicando con toda confianza
 * una app que ya no existe.
 */
export default function ComoSeCompara() {
  const [abierto, setAbierto] = useState(false);

  return (
    <View style={estilos.seccion}>
      <Pressable
        style={estilos.cabecera}
        onPress={() => setAbierto(!abierto)}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
      >
        <Text style={estilos.titulo}>{T.ajustes.comoSeCompara}</Text>
        <Text style={estilos.signo}>{abierto ? '−' : '+'}</Text>
      </Pressable>

      {abierto &&
        COMO_SE_COMPARA.map((b, i) =>
          b.tipo === 'titulo' ? (
            <Text key={i} style={estilos.subtitulo}>
              {b.texto}
            </Text>
          ) : (
            <Text key={i} style={estilos.parrafo}>
              {b.partes.map(pintar)}
            </Text>
          )
        )}
    </View>
  );
}

/**
 * El énfasis viaja como dato y se pinta acá. En web son `<strong>` y `<em>`;
 * en el teléfono son dos estilos de `Text` anidado, que es lo mismo dicho en
 * el idioma de esta plataforma.
 */
function pintar(parte: Parte, i: number) {
  if (typeof parte === 'string') return parte;
  if ('fuerte' in parte)
    return (
      <Text key={i} style={estilos.fuerte}>
        {parte.fuerte}
      </Text>
    );
  return (
    <Text key={i} style={estilos.enfasis}>
      {parte.enfasis}
    </Text>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 30 },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  titulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  signo: { color: C.sub, fontSize: 18 },
  subtitulo: { color: C.tinta, fontSize: 15, marginTop: 20, marginBottom: 6 },
  parrafo: { color: C.apagado, fontSize: 14, lineHeight: 21, marginTop: 10 },
  fuerte: { color: C.sub },
  enfasis: { fontStyle: 'italic' },
});
