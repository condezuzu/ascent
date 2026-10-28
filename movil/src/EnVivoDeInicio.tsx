import { useEffect, useRef, memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { publicarEnVivo, responderUnion } from '@compartido/enVivo';
import { firmaDe, loQueSePublica } from '@nucleo/enVivo';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { useUniones } from './useUniones';
import TiraDelGrupo from './TiraDelGrupo';
import Aparece from './Aparece';
import { useCartelVisible } from './cartelVisible';
import { tarjetasDeInicio } from '@nucleo/novedades';
import { C, conAlfa } from './colores';
import { fijarExtras } from '@compartido/tarjeta';

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

function EnVivoDeInicio(visto: Visto) {
  const { uniones, recibidoEn, recargar } = useUniones(visto.corriendo, true);
  const enCartel = useCartelVisible();

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

  // EL COMPAÑERO EN LA TARJETA DE LA PANTALLA BLOQUEADA (build 8): con quién entreno y,
  // si está descansando, cuándo termina —en el reloj del teléfono: la base lo da en el
  // suyo, y `ahora` es la hora de la base cuando llegó la lista—.
  const companero = visto.corriendo ? uniones.find((u) => u.estado === 'aceptada') ?? null : null;
  const finDelCompanero = companero?.enVivo?.descansoFin ? companero.enVivo.descansoFin - companero.ahora + recibidoEn : 0;
  useEffect(() => {
    fijarExtras({ companero: companero?.otro.username ?? '', finCompanero: finDelCompanero });
  }, [companero?.otro.username, finDelCompanero]);

  // SOLO MIENTRAS ENTRENO (12/10): terminada la sesión el pedido ya no tiene a
  // qué unirse, y la tarjeta quedaba en Inicio hasta volver a entrenar.
  // La invitación no: llega flotando arriba y no mueve Inicio (29/10).
  const pedidos = tarjetasDeInicio(visto.corriendo ? uniones.filter((u) => u.estado === 'pendiente' && !u.laPediYo && !u.invitacion) : [], enCartel);
  const conGrupo = visto.corriendo && uniones.some((u) => u.estado === 'aceptada');
  if (pedidos.length === 0 && !conGrupo) return null;

  return (
    <>
      {conGrupo && <TiraDelGrupo uniones={uniones} recibidoEn={recibidoEn} />}
      {pedidos.map((u) => (
        <Aparece key={u.id}>
        <View testID="pedido-de-union" style={estilos.tarjeta} accessibilityRole="alert">
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
        </Aparece>
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

// Con los mismos props no se redibuja: el + de la sesión redibuja Inicio y esto no cambió (15/10).
export default memo(EnVivoDeInicio);
