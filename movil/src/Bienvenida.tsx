import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PASOS_DE_LA_ENTRADA } from '@nucleo/bienvenida';
import { T } from '@nucleo/textos';
import Cielo from './bienvenida/Cielo';
import Cuarta from './bienvenida/Cuarta';
import { C } from './colores';

/**
 * LA PANTALLA DE ENTRADA EN NATIVO — las mismas cuatro pantallas que la web
 * (`src/components/bienvenida/Bienvenida.tsx`): el polvo, lo que se anota, la
 * gente, y el objeto pasando por los ocho rangos hasta que el agujero negro se
 * traga todo y aparece la entrada.
 *
 * Se avanza con "Siguiente"; la cuarta se salta tocando (no hay más nada que
 * tocar). Se muestra CADA vez que se llega al login, no solo la primera: el
 * padre (`EntradaYLogin`) la monta de nuevo en cada logout, sin guardar nada.
 *
 * PENDIENTE respecto de la web (marcado, a decidir): el fondo de estrellas de
 * 1-3 es más simple (sin titileo por-estrella ni paralaje por capa; ver `Cielo`),
 * y las capas de encima de la 2 (la lista de ejercicios acelerando) y la 3 (los
 * planetas de otras rachas flotando) todavía no están: por ahora esas dos son
 * cielo + texto. La 1 y la 4 —las que más pesan— sí están completas.
 */
export default function Bienvenida({
  alSalir,
  quieta,
}: {
  alSalir: (destino: 'crear' | 'entrar') => void;
  quieta?: boolean;
}) {
  const [paso, setPaso] = useState(0);
  const [terminada, setTerminada] = useState(false);
  const ultima = paso === PASOS_DE_LA_ENTRADA.length - 1;
  const textos = [
    { titulo: T.bienvenida.saludoTitulo, bajada: T.bienvenida.saludoBajada },
    { titulo: T.bienvenida.registroTitulo, bajada: T.bienvenida.registroBajada },
    { titulo: T.bienvenida.genteTitulo, bajada: T.bienvenida.genteBajada },
    { titulo: '', bajada: '' },
  ][paso];

  return (
    <View style={estilos.raiz}>
      {/* El cielo: en las tres primeras, y de nuevo cuando el agujero se lo tragó
          y el espacio vuelve a existir (sobre él van los botones). */}
      {(!ultima || terminada) && <Cielo paso={ultima ? 3 : paso} />}

      {/* La cuarta ANIMA: el motor con el objeto y el agujero negro. */}
      {ultima && !terminada && <Cuarta quieta={quieta} alTerminar={() => setTerminada(true)} />}

      {/* En la cuarta se salta TOCANDO: un botón compitiendo con la animación es
          ruido. */}
      {ultima && !terminada && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setTerminada(true)} accessibilityLabel={T.bienvenida.saltar} />
      )}

      {!ultima && (
        <View style={estilos.texto}>
          <Text style={estilos.titulo}>{textos.titulo}</Text>
          <Text style={estilos.bajada}>{textos.bajada}</Text>
        </View>
      )}

      {/* EL FINAL: una decisión sobre el cielo que volvió. */}
      {terminada && (
        <View style={estilos.fin}>
          <Text style={estilos.cierre}>{T.bienvenida.cierre}</Text>
          <Pressable style={estilos.solido} onPress={() => alSalir('crear')}>
            <Text style={estilos.solidoTexto}>{T.bienvenida.crear}</Text>
          </Pressable>
          <Pressable style={estilos.textoBoton} onPress={() => alSalir('entrar')}>
            <Text style={estilos.enlace}>{T.bienvenida.entrar}</Text>
          </Pressable>
        </View>
      )}

      {/* El pie: los puntos, "Siguiente" y "Saltar". No se rearma entre pantallas. */}
      {!terminada && (
        <View style={estilos.pie}>
          <View style={estilos.puntos}>
            {PASOS_DE_LA_ENTRADA.map((p, i) => (
              <View key={p} style={[estilos.punto, i === paso && estilos.puntoVivo]} />
            ))}
          </View>
          {!ultima && (
            <Pressable style={estilos.solido} onPress={() => setPaso(paso + 1)}>
              <Text style={estilos.solidoTexto}>{T.bienvenida.siguiente}</Text>
            </Pressable>
          )}
          {/* Saltar: chico, gris, no en la primera; en la cuarta se salta tocando. */}
          {paso > 0 && !ultima && (
            <Pressable style={estilos.textoBoton} onPress={() => setPaso(PASOS_DE_LA_ENTRADA.length - 1)}>
              <Text style={estilos.saltar}>{T.bienvenida.saltar}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { ...StyleSheet.absoluteFillObject, backgroundColor: '#05060a' },
  texto: { position: 'absolute', top: '42%', left: 32, right: 32 },
  titulo: { color: C.tinta, fontSize: 26, fontWeight: '600', lineHeight: 32 },
  bajada: { color: C.sub, fontSize: 16, lineHeight: 23, marginTop: 10 },
  fin: { position: 'absolute', left: 24, right: 24, bottom: 90, alignItems: 'stretch' },
  cierre: { color: C.tinta, fontSize: 20, fontWeight: '500', textAlign: 'center', marginBottom: 20 },
  pie: { position: 'absolute', left: 24, right: 24, bottom: 70 },
  puntos: { flexDirection: 'row', gap: 7, justifyContent: 'center', marginBottom: 18 },
  punto: { width: 7, height: 7, borderRadius: 999, backgroundColor: C.lineaFuerte },
  puntoVivo: { width: 22, backgroundColor: C.claro },
  solido: { backgroundColor: C.claro, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  solidoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  textoBoton: { paddingVertical: 12, alignItems: 'center' },
  enlace: { color: C.sub, fontSize: 14 },
  saltar: { color: C.apagado, fontSize: 14 },
});
