import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { echarDelGrupo, linkDelGrupo, responderUnion, salirDelGrupo, salirDeUnion } from '@compartido/enVivo';
import { useVersionDelEsquema } from '@compartido/esquema';
import { disponible } from '@nucleo/esquema';
import { enlaceDeGrupo } from '@nucleo/enlace';
import { cuentaAtras } from '@compartido/descanso';
import { renglonDe, type Union } from '@nucleo/enVivo';
import { T } from '@nucleo/textos';
import { nombreVisible } from '@nucleo/propios';
import { supabase } from './supabase';
import { useNombresDeEjercicios } from './useNombresDeEjercicios';
import Avatar from './Avatar';
import { C } from './colores';
import Aparece from './Aparece';

/**
 * "ENTRENANDO CONTIGO", en Ranking (12/10/2026): con quién estoy unido y qué
 * está haciendo cada uno. Ejercicio, serie y descanso; nunca pesos ni cuánto
 * lleva. Ver `nucleo/enVivo.ts`.
 *
 * La lista llega de afuera (la pide Ranking cada diez segundos). Acá corre un
 * reloj propio, de un segundo, solo para que la cuenta del descanso baje entre
 * una pregunta y la otra.
 */
export default function Juntos({
  uniones,
  recibidoEn,
  recargar,
  entrenando = false,
}: {
  uniones: Union[];
  recibidoEn: number;
  recargar: () => Promise<void>;
  /** Para ofrecer el link aunque todavía no haya nadie (migración 88). */
  entrenando?: boolean;
}) {
  const [ahora, setAhora] = useState(Date.now());
  const conGrupos = disponible('grupos', useVersionDelEsquema());
  const enGrupo = uniones.some((u) => u.grupo);
  const yoArmo = uniones.some((u) => u.yoLider);
  // EL LINK DEL GRUPO: si no hay grupo, pedirlo arma uno con quien lo comparte.
  async function invitar() {
    const codigo = await linkDelGrupo(supabase);
    if (codigo) void Share.share({ message: T.social.mensajeDeInvitacion(enlaceDeGrupo(codigo)) }).catch(() => undefined);
  }
  const hayAceptada = uniones.some((u) => u.estado === 'aceptada');
  const nombres = useNombresDeEjercicios(hayAceptada, recibidoEn);

  useEffect(() => {
    if (!hayAceptada) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hayAceptada]);


  if (uniones.length === 0 && !(conGrupos && entrenando)) return null;

  return (
    <View testID="juntos" style={estilos.seccion}>
      <Text style={estilos.rotulo}>{T.social.juntos}</Text>
      {uniones.map((u) => (
        <Aparece key={u.id}>
        {(() => {
        if (u.estado === 'pendiente') {
          return (
            <View key={u.id} style={estilos.fila}>
              <Avatar url={u.otro.avatar_url} nombre={u.otro.username} tam={28} />
              <Text style={estilos.nombre} numberOfLines={2}>
                {u.laPediYo ? T.social.esperandoA(u.otro.username) : T.social.quiereUnirse(u.otro.username)}
              </Text>
              {u.laPediYo ? (
                <Pressable hitSlop={8} onPress={() => void salirDeUnion(supabase, u.otro.id).then(recargar)}>
                  <Text style={estilos.apagada}>{T.general.cancelar}</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable testID="juntos-aceptar" hitSlop={8} onPress={() => void responderUnion(supabase, u.id, true).then(recargar)}>
                    <Text style={estilos.accion}>{T.social.aceptar}</Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => void responderUnion(supabase, u.id, false).then(recargar)}>
                    <Text style={estilos.apagada}>{T.social.no}</Text>
                  </Pressable>
                </>
              )}
            </View>
          );
        }
        const r = renglonDe(u, ahora - recibidoEn);
        const ejercicio = r.ejercicio ? nombreVisible(r.ejercicio, nombres[r.ejercicio], '…') : T.sesion.sinEjercicio;
        return (
          <View key={u.id} testID="juntos-en-vivo" style={estilos.fila}>
            <Avatar url={u.otro.avatar_url} nombre={u.otro.username} tam={28} />
            {/* LA PÍLDORA VA EN EL RENGLÓN DEL NOMBRE, no al costado: al costado
                le sacaba ancho al detalle y "Press de banca · serie 1 de 3" se
                cortaba en "serie 1 d…", que es justo lo que se viene a leer. */}
            <View style={{ flex: 1 }}>
              <View style={estilos.cabecera}>
                <Text style={estilos.nombreVivo} numberOfLines={1}>
                  {u.otro.username}
                  {/* Quién puede sacar a otros: el que lo armó (el que lleva más tiempo). */}
                  {u.lider && <Text style={estilos.apagada}>{` · ${T.social.armoElGrupo}`}</Text>}
                </Text>
                {/* EL DESCANSO GANA A "SIN SEÑAL" (12/10). Con el teléfono del
                    otro bloqueado no llegan novedades, pero la cuenta no las
                    necesita: se publicó cuándo termina. Antes "sin señal" la
                    tapaba a los dos minutos, y con un descanso de tres no se
                    veía el último minuto ni el "listo". */}
                {r.descanso !== null ? (
                  <View style={[estilos.pildora, r.descanso === 0 && estilos.pildoraLista]}>
                    <Text style={[estilos.pildoraTexto, r.descanso === 0 && estilos.pildoraTextoLista]}>
                      {r.descanso === 0 ? `+${cuentaAtras(r.pasado ?? 0)}` : T.social.enVivoDescansa(cuentaAtras(r.descanso))}
                    </Text>
                  </View>
                ) : r.sinSenal ? (
                  <Text style={estilos.apagada}>{T.social.enVivoSinSenal}</Text>
                ) : null}
              </View>
              <Text style={[estilos.detalle, r.sinSenal && estilos.viejo]} numberOfLines={2}>
                {r.sinDatos ? T.social.enVivoSinDatos : T.social.enVivoSerie(ejercicio, r.serie, r.meta)}
              </Text>
            </View>
            {/* En grupo, salir es uno solo, abajo; sacar, solo quien lo armó. */}
            {!u.grupo ? (
              <Pressable testID="juntos-salir" hitSlop={8} onPress={() => void salirDeUnion(supabase, u.otro.id).then(recargar)}>
                <Text style={estilos.apagada}>{T.social.salirDeUnion}</Text>
              </Pressable>
            ) : yoArmo ? (
              <Pressable testID="juntos-sacar" hitSlop={8} onPress={() => void echarDelGrupo(supabase, u.otro.id).then(recargar)}>
                <Text style={estilos.apagada}>{T.social.sacarDelGrupo}</Text>
              </Pressable>
            ) : null}
          </View>
        );
        })()}
        </Aparece>
      ))}
      {conGrupos && (entrenando || enGrupo) && (
        <View style={estilos.pie}>
          <Pressable testID="juntos-invitar" hitSlop={8} onPress={() => void invitar()}>
            <Text style={estilos.accion}>{T.social.invitarAlGrupo}</Text>
          </Pressable>
          {enGrupo && (
            <Pressable testID="juntos-salir-grupo" hitSlop={8} onPress={() => void salirDelGrupo(supabase).then(recargar)}>
              <Text style={estilos.apagada}>{T.social.salirDelGrupo}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 28 },
  rotulo: { color: C.apagado, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  nombre: { flex: 1, color: C.tinta, fontSize: 14 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nombreVivo: { color: C.tinta, fontSize: 14, flexShrink: 1 },
  detalle: { color: C.sub, fontSize: 13, marginTop: 2 },
  viejo: { color: C.apagado },
  accion: { color: C.claro, fontSize: 14 },
  apagada: { color: C.apagado, fontSize: 13 },
  pildora: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  pildoraLista: { borderColor: C.sub },
  pildoraTexto: { color: C.sub, fontSize: 12, fontVariant: ['tabular-nums'] },
  pildoraTextoLista: { color: C.tinta },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
});
