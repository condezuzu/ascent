import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/supabase';
import { rangoDeRacha } from '@nucleo/rangos';
import { T } from '@nucleo/textos';

/**
 * TANDA 0 — que la app abra en el teléfono y diga algo verdadero.
 *
 * No hay diseño acá a propósito. Lo que esta pantalla tiene que demostrar son
 * cuatro cosas, y ninguna es visual:
 *
 *  1. Expo corre en el teléfono de verdad.
 *  2. Habla con la MISMA Supabase que la web, con la misma cuenta y los mismos
 *     datos — no una base de prueba, no datos inventados.
 *  3. El núcleo compartido se importa y FUNCIONA sin tocar una coma: la racha
 *     que se ve abajo la nombra `rangoDeRacha` y el rótulo sale de `T`, los dos
 *     de `nucleo/`, los mismos archivos que usa la web.
 *  4. La sesión sobrevive a cerrar y volver a abrir, porque vive en
 *     AsyncStorage.
 *
 * Si las cuatro se ven, el andamiaje de la migración está bien puesto y las
 * tandas que siguen son pantallas. Si alguna falla, es mejor descubrirlo con
 * cincuenta líneas encima que con la app entera portada.
 */

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'listo'; usuario: string; racha: number; rango: string }
  | { tipo: 'error'; que: string };

export default function App() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return setEstado({ tipo: 'sin-sesion' });

      const { data: perfil, error } = await supabase
        .from('profiles')
        .select('username, racha_actual')
        .eq('id', uid)
        .maybeSingle();
      if (error) return setEstado({ tipo: 'error', que: error.message });
      if (!perfil) return setEstado({ tipo: 'error', que: 'sin perfil' });

      setEstado({
        tipo: 'listo',
        usuario: perfil.username,
        racha: perfil.racha_actual,
        // La prueba de que el núcleo anda: esto es el MISMO archivo que la web.
        rango: rangoDeRacha(perfil.racha_actual).nombre,
      });
    })().catch((e) => setEstado({ tipo: 'error', que: String(e?.message ?? e) }));
  }, []);

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="light" />
      {estado.tipo === 'cargando' && <ActivityIndicator color="#8a93a8" />}

      {estado.tipo === 'sin-sesion' && (
        <Text style={estilos.nota}>
          No hay sesión en este teléfono todavía. El login llega en la tanda 2.
        </Text>
      )}

      {estado.tipo === 'error' && <Text style={estilos.error}>{estado.que}</Text>}

      {estado.tipo === 'listo' && (
        <>
          <Text style={estilos.usuario}>{estado.usuario}</Text>
          <Text style={estilos.etiqueta}>{T.inicio.racha}</Text>
          <Text style={estilos.racha}>{estado.racha}</Text>
          <Text style={estilos.rango}>{estado.rango}</Text>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: '#05060a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  usuario: { color: '#e8ecf6', fontSize: 17, fontWeight: '600', marginBottom: 28 },
  etiqueta: { color: '#8a93a8', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase' },
  racha: { color: '#9c9a92', fontSize: 96, fontWeight: '300', lineHeight: 104 },
  rango: { color: '#8a93a8', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' },
  nota: { color: '#8a93a8', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  error: { color: '#ff6a6a', fontSize: 13, textAlign: 'center' },
});
