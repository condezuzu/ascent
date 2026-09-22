import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { T } from '@nucleo/textos';
import { comoTexto, escuchar, estado, registrarError } from './cajaNegra';

/**
 * LA RAÍZ: lo que se muestra cuando la app no puede mostrarse.
 *
 * La primera build (18/9) quedó en negro al abrir y no había forma de saber
 * por qué. Esto hace que un fallo se VEA:
 *
 *   - Un límite de errores alrededor de lo que envuelve atrapa lo que tire al
 *     dibujar.
 *   - Si hubo un error, o si a los 10 s la app no llegó a ninguna pantalla, se
 *     muestra el registro de `cajaNegra.ts` con un botón para compartirlo.
 *   - EN LA BUILD INTERNA hay además un botón chico, siempre a mano, que abre
 *     el mismo registro: si la app arranca pero algo tapa la pantalla, el
 *     problema no es un error y nada lo abriría solo. Se prende con
 *     `EXPO_PUBLIC_DIAGNOSTICO=1` en el perfil de la build.
 *
 * ANTES CARGABA LA APP con un `require` adentro de un try, y eso se fue con el
 * router (22/9): ahora quien monta las pantallas es Expo Router, desde
 * `app/_layout.tsx`, y esto la envuelve. El try no se perdió, se mudó: el
 * layout es un archivo del router, así que un error al cargarlo lo atrapa el
 * propio router y termina acá igual, en el límite de abajo.
 */

const CON_BOTON = process.env.EXPO_PUBLIC_DIAGNOSTICO === '1';
const ESPERA_MS = 10000;

/**
 * LAS TRES FUENTES DE LA SESIÓN, con `require` y adentro de un try, por la
 * misma razón que `App`: esa pantalla importa Supabase y la caché, o sea justo
 * lo que la caja negra no puede importar. Si no carga, el registro se muestra
 * igual — que es para lo que nació todo esto.
 */
let Sesion: ComponentType | null = null;
try {
  Sesion = (require('./DiagnosticoSesion') as { default: ComponentType }).default;
} catch (e) {
  registrarError('al cargar el diagnostico de la sesion', e);
}

class Limite extends Component<{ children: ReactNode }, { roto: boolean }> {
  state = { roto: false };
  static getDerivedStateFromError() {
    return { roto: true };
  }
  componentDidCatch(e: unknown, info: { componentStack?: string | null }) {
    registrarError(`al dibujar${info.componentStack ? ` (en ${info.componentStack.trim().split('\n')[0]})` : ''}`, e);
  }
  render() {
    return this.state.roto ? null : this.props.children;
  }
}

export default function Raiz({ children }: { children: ReactNode }) {
  const [, setVersion] = useState(0);
  const [tarde, setTarde] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [descartado, setDescartado] = useState(false);

  useEffect(() => escuchar(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    const t = setTimeout(() => setTarde(true), ESPERA_MS);
    return () => clearTimeout(t);
  }, []);

  const { huboError, listo } = estado();
  const noArranco = tarde && !listo;
  const mostrar = abierto || (!descartado && (huboError || noArranco));

  return (
    <View style={estilos.todo}>
      <Limite>{children}</Limite>
      {mostrar && (
        <Registro
          titulo={huboError ? T.diagnostico.fallo : noArranco ? T.diagnostico.noArranco : T.diagnostico.boton}
          alSeguir={() => {
            setAbierto(false);
            setDescartado(true);
          }}
        />
      )}
      {CON_BOTON && !mostrar && (
        <Pressable style={estilos.boton} onPress={() => setAbierto(true)} accessibilityRole="button">
          <Text style={estilos.botonTexto}>{T.diagnostico.boton}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Registro({ titulo, alSeguir }: { titulo: string; alSeguir: () => void }) {
  const { registro } = estado();
  return (
    <View style={estilos.registro}>
      <Text style={estilos.titulo}>{titulo}</Text>
      {/* ARRIBA DEL REGISTRO Y NO ABAJO: cuando esto se abre en el gimnasio es
          por la sesión, no por el arranque. Lo que se vino a ver tiene que
          estar sin desplazar nada. El texto que explica el registro baja con
          él, porque habla de él. */}
      {Sesion && (
        <Limite>
          <Sesion />
        </Limite>
      )}
      <Text style={estilos.explica}>{T.diagnostico.explica}</Text>
      <ScrollView style={estilos.lista} contentContainerStyle={{ paddingBottom: 16 }}>
        {registro.map((r, i) => (
          <Text key={i} style={[estilos.linea, r.tipo === 'error' && estilos.error, r.tipo === 'aviso' && estilos.aviso]} selectable>
            {(r.ms / 1000).toFixed(2)}s {r.texto}
          </Text>
        ))}
      </ScrollView>
      <View style={estilos.botones}>
        <Pressable style={estilos.solido} onPress={() => Share.share({ message: comoTexto() })}>
          <Text style={estilos.solidoTexto}>{T.diagnostico.compartir}</Text>
        </Pressable>
        <Pressable style={estilos.secundario} onPress={alSeguir}>
          <Text style={estilos.secundarioTexto}>{T.diagnostico.seguir}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Colores escritos acá y no de `colores.ts`: la caja negra no puede depender
// de nada de la app que pueda estar roto.
const estilos = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#05060a' },
  registro: { ...StyleSheet.absoluteFillObject, backgroundColor: '#05060a', paddingTop: 64, paddingHorizontal: 20, paddingBottom: 34 },
  titulo: { color: '#e8ecf6', fontSize: 22, marginBottom: 8 },
  explica: { color: '#8a93a8', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  lista: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#2a3040', paddingTop: 10 },
  linea: { color: '#8a93a8', fontSize: 12, lineHeight: 17, marginBottom: 6, fontFamily: 'Menlo' },
  error: { color: '#e8705f' },
  aviso: { color: '#c4c2ba' },
  botones: { gap: 10, marginTop: 14 },
  solido: { backgroundColor: '#c4c2ba', paddingVertical: 14, alignItems: 'center' },
  solidoTexto: { color: '#05060a', fontSize: 16 },
  secundario: { paddingVertical: 10, alignItems: 'center' },
  secundarioTexto: { color: '#8a93a8', fontSize: 14 },
  boton: {
    position: 'absolute',
    right: 12,
    bottom: 96,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4a5163',
    backgroundColor: 'rgba(5,6,10,0.8)',
  },
  botonTexto: { color: '#8a93a8', fontSize: 12 },
});
