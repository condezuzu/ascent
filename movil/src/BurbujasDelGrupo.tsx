import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { T } from '@nucleo/textos';
import { disponible } from '@nucleo/esquema';
import { numeroDeRango } from '@nucleo/rangos';
import { paletaDe } from '@nucleo/paletas';
import { useVersionDelEsquema } from '@compartido/esquema';
import { grupoDelAmigo, pedirUnirse, type GrupoDelAmigo, type RespuestaDeInvitar } from '@compartido/enVivo';
import { supabase } from './supabase';
import Avatar from './Avatar';
import Aparece from './Aparece';
import Tocable from './Tocable';
import { irAPestana, useRecargarAlVolver } from './irAPestana';
import { C } from './colores';

type Amigo = { id: string; username: string; avatar_url: string | null };
// Dónde quedó la burbuja tocada, en la ventana: de ahí sale el globo.
type Tocada = { amigo: Amigo; x: number; y: number; ancho: number; alto: number };

/**
 * EL MULTIJUGADOR ARRIBA DE TODO EN INICIO (28/10, la variante B aprobada en la galería, más
 * compacta): «Iniciar grupo» y una burbuja por amigo que está entrenando ahora. Nunca dice dónde.
 *
 * TOCAR A UN AMIGO ABRE UNA BURBUJA ENCIMA (29/10, como quedó en la galería), no su perfil. Si
 * entrena sin grupo, «Invitar a un grupo»; si entrena con otros, cuántos son, sus caras y «Unirse
 * al entrenamiento». Con la base de antes de la 98, lleva a Social como antes.
 *
 * `visible` esconde la fila (entrenando, Inicio muestra la tira del grupo) sin desmontar el globo:
 * invitar empieza a entrenar, y el globo tiene que poder decir que la invitación salió.
 */
export default function BurbujasDelGrupo({
  visible,
  alIniciarGrupo,
  alInvitar,
}: {
  visible: boolean;
  alIniciarGrupo: () => void;
  alInvitar: (amigo: string) => Promise<RespuestaDeInvitar>;
}) {
  const version = useVersionDelEsquema();
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [tocada, setTocada] = useState<Tocada | null>(null);
  const caras = useRef(new Map<string, View | null>());
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('entrenando_ahora');
    if (!error) setAmigos(Array.isArray(data) ? (data as Amigo[]) : []);
  }, []);
  useEffect(() => {
    if (disponible('entrenarConOtro', version)) void cargar();
  }, [version, cargar]);
  useRecargarAlVolver('inicio', cargar);

  function tocar(a: Amigo) {
    if (!disponible('invitarAlGrupo', version)) return irAPestana('ranking');
    const cara = caras.current.get(a.id);
    if (!cara) return;
    cara.measureInWindow((x, y, ancho, alto) => setTocada({ amigo: a, x, y, ancho, alto }));
  }

  const conGrupos = disponible('grupos', version);
  const fila =
    visible && (conGrupos || amigos.length > 0) ? (
      <Aparece>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fila} testID="burbujas-del-grupo">
          {conGrupos && (
            <Tocable testID="iniciar-grupo" style={estilos.burbuja} onPress={alIniciarGrupo} accessibilityRole="button">
              <View style={[estilos.cara, estilos.mas]}>
                <Text style={estilos.masTexto}>+</Text>
              </View>
              <Text style={estilos.nombre} numberOfLines={1}>
                {T.inicio.iniciarGrupo}
              </Text>
            </Tocable>
          )}
          {amigos.map((a) => (
            <Tocable
              key={a.id}
              testID="burbuja-amigo"
              style={estilos.burbuja}
              onPress={() => tocar(a)}
              accessibilityRole="button"
              accessibilityLabel={T.social.estaEntrenando(a.username)}
            >
              <View style={estilos.aro} ref={(v) => void caras.current.set(a.id, v)} collapsable={false}>
                <Avatar url={a.avatar_url} nombre={a.username} tam={36} />
              </View>
              <Text style={estilos.nombre} numberOfLines={1}>
                {a.username}
              </Text>
            </Tocable>
          ))}
        </ScrollView>
      </Aparece>
    ) : null;

  return (
    <>
      {fila}
      {tocada && <GloboDelAmigo tocada={tocada} alInvitar={alInvitar} alCerrar={() => setTocada(null)} />}
    </>
  );
}

function GloboDelAmigo({ tocada, alInvitar, alCerrar }: { tocada: Tocada; alInvitar: (amigo: string) => Promise<RespuestaDeInvitar>; alCerrar: () => void }) {
  const { width } = useWindowDimensions();
  const { amigo } = tocada;
  // undefined = preguntando; null = ya no entrena (o no se pudo).
  const [grupo, setGrupo] = useState<GrupoDelAmigo | null | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [dijo, setDijo] = useState<{ texto: string; bien: boolean } | null>(null);
  useEffect(() => {
    let vivo = true;
    void grupoDelAmigo(supabase, amigo.id).then((g) => vivo && setGrupo(g));
    return () => {
      vivo = false;
    };
  }, [amigo.id]);
  // Salió bien: se lee y se va solo.
  useEffect(() => {
    if (!dijo?.bien) return;
    const t = setTimeout(alCerrar, 1400);
    return () => clearTimeout(t);
  }, [dijo, alCerrar]);

  const enGrupo = !!grupo && grupo.personas >= 2;
  async function actuar() {
    setEnviando(true);
    if (enGrupo) {
      const r = await pedirUnirse(supabase, amigo.id);
      setDijo(
        r === 'ok'
          ? { texto: T.social.pedidoEnviado, bien: true }
          : { texto: r === 'ocupado' ? T.social.unirseOcupado(amigo.username) : r === 'ya-unido' ? T.social.unirseYaUnido : r === 'no-entrena' ? T.social.unirseNoEntrena(amigo.username) : T.social.invitarFallo, bien: false },
      );
    } else {
      const r = await alInvitar(amigo.id);
      setDijo(
        r === 'ok' || r === 'ya-unido'
          ? { texto: r === 'ok' ? T.social.invitacionEnviada : T.social.grupoYaEstas, bien: true }
          : { texto: r === 'ocupado' ? T.social.invitarOcupado(amigo.username) : r === 'no-entrena' ? T.social.unirseNoEntrena(amigo.username) : T.social.invitarFallo, bien: false },
      );
    }
    setEnviando(false);
  }

  const centro = tocada.x + tocada.ancho / 2;
  const arriba = tocada.y + tocada.alto + 16;
  const escondidos = grupo ? Math.max(0, grupo.personas - grupo.miembros.length) : 0;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={alCerrar}>
      <Pressable style={estilos.velo} onPress={alCerrar} accessibilityRole="button" accessibilityLabel={T.general.cerrar} />
      {/* La burbuja tocada, un poco más grande, en el mismo lugar: de ella sale el globo. */}
      <View pointerEvents="none" style={[estilos.tocada, { left: centro - TOCADA / 2, top: tocada.y + tocada.alto / 2 - TOCADA / 2 }]}>
        <Avatar url={amigo.avatar_url} nombre={amigo.username} tam={TOCADA - 4} />
      </View>
      <View testID="globo-amigo" accessibilityViewIsModal style={[estilos.globo, { top: arriba }]}>
        <View style={[estilos.cola, { left: Math.min(Math.max(centro - MARGEN - 7, 18), width - 2 * MARGEN - 32) }]} />
        <Text style={estilos.quien} numberOfLines={1}>
          {amigo.username}
        </Text>
        {grupo === undefined ? (
          <ActivityIndicator color={C.sub} style={estilos.cargando} />
        ) : grupo === null ? (
          <Text style={estilos.dato}>{T.social.unirseNoEntrena(amigo.username)}</Text>
        ) : (
          <>
            <Text testID="globo-amigo-dato" style={estilos.dato}>
              {enGrupo ? T.social.estaEnGrupoDe(grupo.personas) : T.social.noEstaEnGrupo}
            </Text>
            {enGrupo && (
              <View style={estilos.grupo} testID="globo-amigo-grupo">
                {grupo.miembros.map((m) => (
                  <View key={m.id} style={estilos.miembro} testID="globo-amigo-miembro">
                    <View style={[estilos.aroMiembro, { borderColor: m.racha === null ? C.lineaFuerte : paletaDe(numeroDeRango(m.racha), null).principal }]}>
                      <Avatar url={m.avatar_url} nombre={m.username} tam={36} />
                    </View>
                    <Text style={estilos.nombre} numberOfLines={1}>
                      {m.username}
                    </Text>
                  </View>
                ))}
                {escondidos > 0 && (
                  <View style={estilos.miembro}>
                    <View style={[estilos.aroMiembro, estilos.mas]}>
                      <Text style={estilos.masTexto}>+{escondidos}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
            {dijo ? (
              <Text testID="globo-amigo-dijo" style={[estilos.dijo, dijo.bien && estilos.dijoBien]}>
                {dijo.texto}
              </Text>
            ) : (
              <Tocable testID="globo-amigo-boton" style={estilos.boton} onPress={() => void actuar()} disabled={enviando} accessibilityRole="button">
                <Text style={estilos.botonTexto}>{enviando ? '…' : enGrupo ? T.social.unirseAlEntrenamiento : T.social.invitarAGrupo}</Text>
              </Tocable>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const TOCADA = 58;
const MARGEN = 24;

const estilos = StyleSheet.create({
  // COMPACTA (28/10): la propuesta ocupaba casi cien puntos; Inicio entero tiene que entrar sin desplazar.
  fila: { gap: 10, paddingTop: 10, paddingBottom: 2 },
  burbuja: { width: 70, alignItems: 'center', gap: 3 },
  cara: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  mas: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.sub, alignItems: 'center', justifyContent: 'center' },
  masTexto: { color: C.tinta, fontSize: 18, lineHeight: 20 },
  aro: { borderWidth: 2, borderColor: C.vivo, borderRadius: 999, padding: 0 },
  nombre: { color: C.sub, fontSize: 10.5, maxWidth: 70 },
  velo: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,4,8,0.62)' },
  tocada: { position: 'absolute', width: TOCADA, height: TOCADA, borderRadius: 999, borderWidth: 2, borderColor: C.vivo, alignItems: 'center', justifyContent: 'center' },
  globo: {
    position: 'absolute',
    left: MARGEN,
    right: MARGEN,
    padding: 16,
    gap: 6,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    backgroundColor: C.hoja,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  cola: {
    position: 'absolute',
    top: -7,
    width: 14,
    height: 14,
    backgroundColor: C.hoja,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    transform: [{ rotate: '45deg' }],
  },
  quien: { color: C.tinta, fontSize: 16, fontWeight: '500' },
  dato: { color: C.sub, fontSize: 13 },
  cargando: { alignSelf: 'flex-start', marginVertical: 6 },
  grupo: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  miembro: { alignItems: 'center', gap: 3, width: 52 },
  aroMiembro: { width: 42, height: 42, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  boton: { marginTop: 8, backgroundColor: C.claro, borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  botonTexto: { color: C.fondo, fontWeight: '600', fontSize: 14.5 },
  dijo: { marginTop: 8, color: C.sub, fontSize: 13.5 },
  dijoBien: { color: C.tinta },
});
