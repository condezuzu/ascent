import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { plataformaNativa } from './plataforma';

/**
 * TANDA 1 — que los nueve puertos existan y contesten EN EL TELÉFONO.
 *
 * No es una pantalla de la app: es el banco de trabajo de la migración, el
 * equivalente de la pantalla de la tanda 0. Lo que tiene que demostrar es que
 * cada puerto llama a su API de verdad y devuelve algo, porque eso no se puede
 * saber desde la computadora — `expo-haptics` compila perfecto y no vibra
 * hasta que alguien lo prueba con el teléfono en la mano.
 *
 * LOS DOS DE ABAJO SE TOCAN, y son justamente los dos que motivaron migrar: el
 * bip que tiene que cortar la música y el golpe que en iPhone no existía. El
 * resto se contesta solo al abrir.
 *
 * Esto se saca cuando la app nativa tenga sus pantallas de verdad.
 */

type Linea = { que: string; dice: string };

export default function PruebaDePuertos() {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [ultimo, setUltimo] = useState('');

  useEffect(() => {
    (async () => {
      const p = plataformaNativa;
      const filas: Linea[] = [];

      // Almacenamiento: se escribe y se lee de verdad, no se pregunta si
      // existe. Un puerto que dice "disponible" y no guarda nada es el peor
      // resultado posible.
      await p.almacenamiento.guardar('ascent:prueba', 'ida y vuelta');
      filas.push({
        que: 'almacenamiento',
        dice: (await p.almacenamiento.leer('ascent:prueba')) ?? 'no leyó',
      });
      await p.almacenamiento.borrar('ascent:prueba');

      await p.efimero.guardar('x', 'en memoria');
      filas.push({ que: 'efímero', dice: (await p.efimero.leer('x')) ?? 'no leyó' });

      filas.push({ que: 'ciclo', dice: p.ciclo.visible() ? 'la app está adelante' : 'atrás' });
      filas.push({ que: 'háptica', dice: p.haptica.disponible() ? 'hay motor' : 'no hay' });
      filas.push({ que: 'pantalla', dice: p.pantalla.disponible() ? 'se puede mantener' : 'no' });
      filas.push({
        que: 'audio',
        dice: p.audio.respetaLaMusica() ? 'maneja la sesión de audio' : 'no',
      });
      filas.push({
        que: 'avisos',
        dice: p.avisos.conPantallaBloqueada() ? 'con la pantalla bloqueada' : 'solo adelante',
      });
      filas.push({
        que: 'salud',
        dice: p.salud.disponible() ? 'hay' : 'vacío hasta la build de desarrollo',
      });

      // La ubicación va última: es la que abre un diálogo de permiso, y
      // pedirlo antes de que la pantalla haya dibujado algo se ve como si la
      // app arrancara pidiendo cosas.
      setLineas(filas);
      const punto = await p.ubicacion.puntoActual(60_000);
      setLineas([
        ...filas,
        {
          que: 'ubicación',
          // Precisión, nunca coordenadas: acá lo que importa es si el número
          // sirve para decidir, y de paso esto no es un rastro guardado.
          dice: punto ? `precisión ${Math.round(punto.precision)} m` : 'sin permiso o sin señal',
        },
      ]);
    })().catch(() => {});
  }, []);

  return (
    <View style={estilos.caja}>
      <Text style={estilos.titulo}>los nueve puertos</Text>
      {lineas.map((l) => (
        <View key={l.que} style={estilos.fila}>
          <Text style={estilos.que}>{l.que}</Text>
          <Text style={estilos.dice}>{l.dice}</Text>
        </View>
      ))}

      <View style={estilos.botones}>
        <Pressable
          style={estilos.boton}
          onPress={async () => {
            await plataformaNativa.audio.preparar();
            await plataformaNativa.audio.avisar();
            setUltimo('sonó el bip');
          }}
        >
          <Text style={estilos.textoBoton}>probar el bip</Text>
        </Pressable>
        <Pressable
          style={estilos.boton}
          onPress={() => {
            const salio = plataformaNativa.haptica.pulso();
            setUltimo(salio ? 'vibró' : 'no hay motor');
          }}
        >
          <Text style={estilos.textoBoton}>probar la vibración</Text>
        </Pressable>
      </View>
      {ultimo !== '' && <Text style={estilos.ultimo}>{ultimo}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { marginTop: 34, alignSelf: 'stretch' },
  titulo: {
    color: '#8a93a8',
    fontSize: 10,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  fila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  que: { color: '#c4c2ba', fontSize: 13 },
  dice: { color: '#8a93a8', fontSize: 13, flexShrink: 1, textAlign: 'right' },
  botones: { flexDirection: 'row', gap: 10, marginTop: 18 },
  boton: {
    flex: 1,
    borderColor: '#2a3040',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
  },
  textoBoton: { color: '#c4c2ba', fontSize: 13 },
  ultimo: { color: '#8a93a8', fontSize: 12, marginTop: 10, textAlign: 'center' },
});
