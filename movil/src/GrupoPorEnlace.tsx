import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { unirsePorLink, type RespuestaDelLink } from '@compartido/enVivo';
import { codigoDeGrupo } from '@nucleo/enlace';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { C } from './colores';
import { volverOInicio } from './volver';
import { irAPestana } from './irAPestana';
import { useArriba } from './zonaSegura';

/**
 * A DÓNDE CAE UN LINK DE GRUPO (`/grupo/<código>`, migración 88). Entra solo, sin
 * preguntar: el link lo mandó quien armó el grupo, y quedarse amigos es parte de
 * entrar (decidido por el humano el 15/10).
 */
export default function GrupoPorEnlace() {
  const router = useRouter();
  const arriba = useArriba(60);
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const [estado, setEstado] = useState<RespuestaDelLink | 'entrando'>('entrando');

  const sigueAca = useRef(true);
  useEffect(() => {
    sigueAca.current = true;
    return () => {
      sigueAca.current = false;
    };
  }, []);

  const entrar = useCallback(async () => {
    setEstado('entrando');
    const c = codigoDeGrupo(`ascent://grupo/${codigo ?? ''}`);
    const r = c ? await unirsePorLink(supabase, c) : 'no-existe';
    if (sigueAca.current) setEstado(r);
  }, [codigo]);

  useEffect(() => {
    void entrar();
  }, [entrar]);

  const texto =
    estado === 'ok' ? T.social.grupoEntraste
    : estado === 'ya-unido' ? T.social.grupoYaEstas
    : estado === 'ocupado' ? T.social.grupoLleno
    : estado === 'no-existe' ? T.social.grupoNoExiste
    : T.inicio.noCargo;

  return (
    <View style={estilos.raiz}>
      <Pressable onPress={() => volverOInicio(router)} hitSlop={8} style={[estilos.volver, { paddingTop: arriba }]}>
        <Text style={estilos.enlace}>{T.general.volver}</Text>
      </Pressable>
      <View style={estilos.centrado}>
        {estado === 'entrando' ? (
          <>
            <ActivityIndicator color={C.sub} />
            <Text style={estilos.sub}>{T.social.grupoUniendo}</Text>
          </>
        ) : (
          <>
            <Text testID="grupo-por-enlace" style={estilos.texto}>
              {texto}
            </Text>
            {(estado === 'ok' || estado === 'ya-unido') && (
              <Pressable
                style={estilos.boton}
                onPress={() => {
                  volverOInicio(router);
                  irAPestana('ranking');
                }}
              >
                <Text style={estilos.botonTexto}>{T.social.grupoVer}</Text>
              </Pressable>
            )}
            {estado === 'fallo' && (
              <Pressable onPress={() => void entrar()} hitSlop={8}>
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
  volver: { paddingHorizontal: 24, paddingBottom: 10 },
  enlace: { color: C.sub, fontSize: 15 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 32 },
  texto: { color: C.tinta, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  sub: { color: C.sub, fontSize: 14 },
  boton: { borderWidth: 1, borderColor: C.claro, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 22 },
  botonTexto: { color: C.tinta, fontSize: 15 },
});
