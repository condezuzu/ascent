import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { plataforma } from '@plataforma';
import { miId } from '@compartido/quienSoy';
import { traerNovedades } from '@compartido/novedades';
import { responderUnion } from '@compartido/enVivo';
import { aceptarAmistad, rechazarAmistad, SOCIAL_CAMBIO } from '@compartido/ranking';
import { registrarAvisosRemotos } from '@compartido/avisosRemotos';
import { eventos } from '@compartido/eventos';
import { CLAVE_NOVEDADES, conVista, cualMostrar, type Novedad } from '@nucleo/novedades';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { alLlegarAvisoRemoto } from './plataforma/avisos';
import Avatar from './Avatar';
import { C } from './colores';

/** Cada cuánto se pregunta con la app adelante. El aviso push lo adelanta. */
const CADA_MS = 30_000;
/** Si no se contesta, se va solo: el pedido sigue en Ranking o en Inicio. */
const SE_VA_SOLO_MS = 20_000;

/**
 * EL CARTEL QUE BAJA DE ARRIBA (14/10/2026). Ver `nucleo/novedades.ts`.
 *
 * Va encima de todas las pestañas. Pregunta al abrir, al volver la app
 * adelante, cada treinta segundos y cuando llega un aviso push.
 */
export default function CartelDeArriba() {
  const [cartel, setCartel] = useState<{ uid: string; novedad: Novedad } | null>(null);
  const bajada = useRef(new Animated.Value(0)).current;
  const mostrando = useRef(false);

  const mirar = useCallback(async () => {
    if (mostrando.current) return;
    const yo = await miId(supabase);
    if (!yo) return;
    const novedades = await traerNovedades(supabase, yo).catch(() => null);
    if (!novedades?.length) return;
    const crudo = await plataforma.almacenamiento.leer(CLAVE_NOVEDADES).catch(() => null);
    const toca = cualMostrar(novedades, crudo, yo);
    if (!toca || mostrando.current) return;
    mostrando.current = true;
    setCartel({ uid: yo, novedad: toca });
  }, []);

  useEffect(() => {
    void mirar();
    // El token del aparato se guarda acá, sin preguntar: si ya dejó avisar (por el descanso), alcanza.
    void registrarAvisosRemotos(supabase, false).catch(() => undefined);
    const cada = setInterval(() => void mirar(), CADA_MS);
    const alVolver = plataforma.ciclo.alCambiar((visible) => {
      if (visible) void mirar();
    });
    const alAviso = alLlegarAvisoRemoto(() => void mirar());
    return () => {
      clearInterval(cada);
      alVolver();
      alAviso();
    };
  }, [mirar]);

  const irse = useCallback(async () => {
    if (!cartel) return;
    const { uid, novedad } = cartel;
    Animated.timing(bajada, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setCartel(null);
      mostrando.current = false;
    });
    const crudo = await plataforma.almacenamiento.leer(CLAVE_NOVEDADES).catch(() => null);
    await plataforma.almacenamiento.guardar(CLAVE_NOVEDADES, conVista(crudo, uid, novedad)).catch(() => undefined);
  }, [cartel, bajada]);

  useEffect(() => {
    if (!cartel) return;
    Animated.spring(bajada, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    const solo = setTimeout(() => void irse(), SE_VA_SOLO_MS);
    return () => clearTimeout(solo);
  }, [cartel, bajada, irse]);

  if (!cartel) return null;
  const { novedad } = cartel;

  async function contestar(acepta: boolean) {
    void irse();
    if (novedad.tipo === 'union') await responderUnion(supabase, novedad.id, acepta);
    else if (acepta) await aceptarAmistad(supabase, novedad.id);
    else if (await rechazarAmistad(supabase, novedad.id)) eventos.emitir(SOCIAL_CAMBIO);
  }

  return (
    <Animated.View
      testID="cartel-de-arriba"
      accessibilityRole="alert"
      style={[
        estilos.cartel,
        { opacity: bajada, transform: [{ translateY: bajada.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] }) }] },
      ]}
    >
      <View style={estilos.quien}>
        <Avatar url={novedad.otro.avatar_url} nombre={novedad.otro.username} tam={40} />
        <View style={estilos.textos}>
          <Text style={estilos.nombre} numberOfLines={1}>
            {novedad.otro.username}
          </Text>
          <Text style={estilos.que} numberOfLines={2}>
            {novedad.tipo === 'union' ? T.social.cartelUnion : T.social.cartelAmistad}
          </Text>
        </View>
      </View>
      <View style={estilos.botones}>
        <Pressable testID="cartel-no" style={estilos.borde} hitSlop={8} onPress={() => void contestar(false)}>
          <Text style={estilos.bordeTexto}>{T.social.no}</Text>
        </Pressable>
        <Pressable testID="cartel-aceptar" style={estilos.solido} onPress={() => void contestar(true)}>
          <Text style={estilos.solidoTexto}>{T.social.aceptar}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// La misma tarjeta que el pedido de Inicio y el aviso de la rutina: el mismo lugar visual.
const estilos = StyleSheet.create({
  cartel: {
    position: 'absolute',
    top: 54,
    left: 12,
    right: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    // Opaco: encima de Inicio se transparentaba el botón de atrás.
    backgroundColor: C.hoja,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  quien: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textos: { flex: 1 },
  nombre: { color: C.tinta, fontSize: 16, fontWeight: '600' },
  que: { color: C.sub, fontSize: 14, marginTop: 2 },
  botones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  borde: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  bordeTexto: { color: C.tinta, fontSize: 14 },
  solido: { backgroundColor: C.tinta, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  solidoTexto: { color: C.fondo, fontSize: 14, fontWeight: '600' },
});
