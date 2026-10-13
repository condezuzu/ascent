import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { publicarEnVivo, responderUnion } from '@compartido/enVivo';
import { firmaDe, loQueSePublica } from '@nucleo/enVivo';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { useUniones } from './useUniones';
import { C, conAlfa } from './colores';

/**
 * LA MITAD DE "ENTRENAR CON OTRO" QUE VIVE EN INICIO (12/10/2026).
 *
 * Hace tres cosas, y las tres son DE UNA SOLA MANO: mira lo que Inicio ya
 * muestra y lo cuenta afuera. No le devuelve nada a la sesión.
 *
 * 1. Avisa que estoy entrenando, al iniciar en cualquier lado.
 * 2. Si tengo algún vínculo, publica la foto de lo que estoy haciendo.
 * 3. Muestra el pedido de quien quiere unirse, para aceptarlo sin salir de acá.
 *
 * NO CORTA NADA CUANDO `corriendo` PASA A FALSO. Ese valor puede parpadear (es
 * la familia de bugs que el refactor del dueño único viene a cerrar), y cortar
 * ahí dejaría a los dos sin verse por un parpadeo. Cortar lo hace el botón
 * "Terminar", en Inicio, que es un hecho y no una lectura.
 */
type Visto = { corriendo: boolean; ejercicio: string | null; hechas: number; meta: number; descansoFin: number | null };

/** Aunque no cambie nada, cada tanto se vuelve a publicar: es lo que dice "sigo acá". */
const LATIDO_MS = 45_000;

export default function EnVivoDeInicio(visto: Visto) {
  const { uniones, recargar } = useUniones(visto.corriendo, true);

  // Lo último que se vio, para que el latido publique lo de AHORA y no lo de cuando se armó.
  const ultimo = useRef(visto);
  ultimo.current = visto;

  const hayAlguien = uniones.length > 0;
  const firma = firmaDe(visto);
  useEffect(() => {
    if (!visto.corriendo || !hayAlguien) return;
    const publicar = () => {
      const p = loQueSePublica(ultimo.current, Date.now());
      if (p) void publicarEnVivo(supabase, p).catch(() => undefined);
    };
    // Un respiro antes de mandar: tres toques seguidos son una foto, no tres.
    const pronto = setTimeout(publicar, 700);
    const latido = setInterval(publicar, LATIDO_MS);
    return () => {
      clearTimeout(pronto);
      clearInterval(latido);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, hayAlguien]);

  // SOLO MIENTRAS ENTRENO (12/10): terminada la sesión el pedido ya no tiene a
  // qué unirse, y la tarjeta quedaba en Inicio hasta volver a entrenar.
  const pedidos = visto.corriendo ? uniones.filter((u) => u.estado === 'pendiente' && !u.laPediYo) : [];
  if (pedidos.length === 0) return null;

  return (
    <>
      {pedidos.map((u) => (
        <View key={u.id} testID="pedido-de-union" style={estilos.tarjeta} accessibilityRole="alert">
          <Text style={estilos.texto}>{T.social.quiereUnirse(u.otro.username)}</Text>
          <View style={estilos.botones}>
            <Pressable
              testID="pedido-de-union-no"
              style={estilos.borde}
              hitSlop={8}
              onPress={() => void responderUnion(supabase, u.id, false).then(recargar)}
            >
              <Text style={estilos.bordeTexto}>{T.social.no}</Text>
            </Pressable>
            <Pressable
              testID="pedido-de-union-aceptar"
              style={estilos.solido}
              onPress={() => void responderUnion(supabase, u.id, true).then(recargar)}
            >
              <Text style={estilos.solidoTexto}>{T.social.aceptar}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    backgroundColor: conAlfa(C.hoja, 0.96),
  },
  texto: { color: C.tinta, fontSize: 15, lineHeight: 21 },
  botones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  borde: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  bordeTexto: { color: C.tinta, fontSize: 14 },
  solido: { backgroundColor: C.tinta, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  solidoTexto: { color: C.fondo, fontSize: 14, fontWeight: '600' },
});
