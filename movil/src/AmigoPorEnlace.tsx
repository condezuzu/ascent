import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { buscarPorNombre, pedirAmistad } from '@compartido/ranking';
import { miId } from '@compartido/quienSoy';
import { enlaceALaApp, usuarioDeEnlace } from '@nucleo/enlace';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { C } from './colores';

/**
 * A DÓNDE CAE UN LINK DE AMIGO (`ascent://amigo/<nombre>`, 8/10/2026).
 *
 * No es una pantalla: averigua de quién es el nombre, LE MANDA EL PEDIDO y
 * reemplaza por su perfil. Reemplaza y no apila, para que "Volver" desde el
 * perfil no caiga de nuevo acá.
 *
 * EL PEDIDO SALE SOLO: tocar el link de alguien ES querer agregarlo, y el
 * alcance lo pide así ("deja la solicitud ya hecha"). No los hace amigos: el
 * que invitó todavía tiene que aceptar, porque el link lleva solo un nombre y
 * cualquiera puede armar uno con el nombre de otro. Si el pedido no sale —ya
 * eran amigos, ya estaba pedido— no importa: el perfil muestra cómo están.
 *
 * Lo único que se llega a ver es cuando no hay a dónde ir: el nombre no existe
 * (o esa persona te bloqueó: se ve igual, a propósito) o no hay señal.
 */
export default function AmigoPorEnlace() {
  const router = useRouter();
  const { usuario } = useLocalSearchParams<{ usuario: string }>();
  const [estado, setEstado] = useState<'buscando' | 'no-existe' | 'no-se-pudo'>('buscando');

  const buscar = useCallback(async () => {
    setEstado('buscando');
    // Lo que vino en la URL lo escribió cualquiera: pasa por el mismo filtro que el link.
    const nombre = usuarioDeEnlace(enlaceALaApp(usuario ?? ''));
    if (!nombre) return setEstado('no-existe');
    const id = await buscarPorNombre(supabase, nombre);
    if (id === 'no-se-pudo') return setEstado('no-se-pudo');
    if (!id) return setEstado('no-existe');
    const yo = await miId(supabase);
    if (yo && yo !== id) await pedirAmistad(supabase, yo, id).catch(() => false);
    router.replace(`/perfil/${id}`);
  }, [usuario, router]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  return (
    <View style={estilos.raiz}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={8} style={estilos.volver}>
        <Text style={estilos.enlace}>{T.general.volver}</Text>
      </Pressable>
      <View style={estilos.centrado}>
        {estado === 'buscando' ? (
          <ActivityIndicator color={C.sub} />
        ) : (
          <>
            <Text style={estilos.texto}>{estado === 'no-existe' ? T.social.noExiste : T.inicio.noCargo}</Text>
            {estado === 'no-se-pudo' && (
              <Pressable onPress={() => void buscar()} hitSlop={8}>
                <Text style={estilos.enlace}>{T.inicio.reintentar}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  volver: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 10 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  texto: { color: C.sub, fontSize: 14, textAlign: 'center' },
  enlace: { color: C.sub, fontSize: 15 },
});
