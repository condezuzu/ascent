import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { anotar, comoTexto, estado, registrarError } from './cajaNegra';

/**
 * LA PANTALLA MÍNIMA, Y EL BANCO DE PRUEBAS DEL TELÉFONO (21/9).
 *
 * La app quedaba en negro en el iPhone y la caja negra no aparecía: ni el
 * error, ni el aviso de "no arrancó", ni el botón. O sea que o el JS no corre,
 * o algo tapa todo desde el primer cuadro. Otra build igual no dice nada.
 *
 * Esto es lo más chico que se puede mostrar: React Native y nada más. Ni
 * Supabase, ni el motor, ni SVG, ni la app. Si ESTO se ve, el JS corre y el
 * problema está en una pieza; si no se ve, el problema es de antes (el
 * arranque nativo o el splash, que con `expo-splash-screen` se queda puesto
 * para siempre si el JS nunca monta nada — y desde el 19/9 el splash es negro
 * puro, o sea idéntico a "pantalla negra").
 *
 * POR ESO TIENE BOTONES. Cada uno carga UNA pieza, con `require` adentro de un
 * try y con un límite de errores alrededor: la que rompa, se ve acá con su
 * mensaje en vez de dejar la pantalla muerta. Sirve en la build de desarrollo
 * y también en una build normal, sin Metro y sin computadora.
 *
 * Se elige con `EXPO_PUBLIC_MINIMO=1` (ver `index.ts`).
 */

type Pieza = { nombre: string; cargar: () => unknown };

// El `require` va ADENTRO de cada función: importar arriba cargaría todas las
// piezas al abrir, que es justo lo que esto viene a evitar.
const PIEZAS: Pieza[] = [
  { nombre: 'React Native puro', cargar: () => ({ ok: true }) },
  { nombre: 'Supabase (cliente)', cargar: () => require('./supabase').supabase },
  { nombre: 'react-native-svg', cargar: () => require('react-native-svg') },
  { nombre: 'expo-gl', cargar: () => require('expo-gl') },
  { nombre: 'three', cargar: () => require('three') },
  { nombre: 'el motor (escena)', cargar: () => require('@compartido/motor/escena') },
  { nombre: 'la app entera', cargar: () => require('../App').default },
];

export default function Minimo() {
  const [resultados, setResultados] = useState<{ nombre: string; ok: boolean; detalle: string }[]>([]);
  const [App, setApp] = useState<React.ComponentType | null>(null);

  function probar(p: Pieza) {
    anotar(`probando: ${p.nombre}`);
    try {
      const v = p.cargar();
      const detalle = v ? (typeof v === 'function' ? 'cargó (componente)' : 'cargó') : 'cargó pero vino vacío';
      setResultados((prev) => [...prev, { nombre: p.nombre, ok: true, detalle }]);
      if (p.nombre === 'la app entera' && typeof v === 'function') setApp(() => v as React.ComponentType);
    } catch (e) {
      registrarError(`al cargar ${p.nombre}`, e);
      setResultados((prev) => [
        ...prev,
        { nombre: p.nombre, ok: false, detalle: e instanceof Error ? `${e.name}: ${e.message}` : String(e) },
      ]);
    }
  }

  if (App) {
    // Se dibuja la app de verdad, con la caja negra cuidándola: si tira al
    // dibujar, `Raiz` ya mostró el error.
    const Raiz = require('./Raiz').default as React.ComponentType;
    return <Raiz />;
  }

  const { registro } = estado();
  return (
    <View style={estilos.todo}>
      <Text style={estilos.titulo}>Ascent · pantalla mínima</Text>
      <Text style={estilos.explica}>
        Si ves esto, el JS del teléfono corre. Toca las piezas de arriba hacia abajo: la primera que falle es la que
        rompe la app.
      </Text>

      <ScrollView style={estilos.lista} contentContainerStyle={{ paddingBottom: 20 }}>
        {PIEZAS.map((p) => (
          <Pressable key={p.nombre} style={estilos.boton} onPress={() => probar(p)}>
            <Text style={estilos.botonTexto}>{p.nombre}</Text>
          </Pressable>
        ))}

        {resultados.map((r, i) => (
          <Text key={i} style={[estilos.linea, !r.ok && estilos.error]}>
            {r.ok ? '✓' : '✗'} {r.nombre}: {r.detalle}
          </Text>
        ))}

        <Text style={estilos.subtitulo}>Lo que se anotó al arrancar</Text>
        {registro.map((r, i) => (
          <Text key={i} style={[estilos.linea, r.tipo === 'error' && estilos.error]} selectable>
            {(r.ms / 1000).toFixed(2)}s {r.texto}
          </Text>
        ))}
      </ScrollView>

      <Pressable style={estilos.solido} onPress={() => Share.share({ message: comoTexto() })}>
        <Text style={estilos.solidoTexto}>Compartir el detalle</Text>
      </Pressable>
    </View>
  );
}

// Colores escritos acá: esta pantalla no puede depender de nada de la app.
const estilos = StyleSheet.create({
  todo: { flex: 1, backgroundColor: '#05060a', paddingTop: 64, paddingHorizontal: 20, paddingBottom: 34 },
  titulo: { color: '#e8ecf6', fontSize: 22, marginBottom: 8 },
  subtitulo: { color: '#8a93a8', fontSize: 12, marginTop: 18, marginBottom: 6, letterSpacing: 1 },
  explica: { color: '#8a93a8', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  lista: { flex: 1 },
  boton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4a5163',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  botonTexto: { color: '#c4c2ba', fontSize: 15 },
  linea: { color: '#8a93a8', fontSize: 12, lineHeight: 17, marginBottom: 4, fontFamily: 'Menlo' },
  error: { color: '#e8705f' },
  solido: { backgroundColor: '#c4c2ba', paddingVertical: 14, alignItems: 'center' },
  solidoTexto: { color: '#05060a', fontSize: 16 },
});
