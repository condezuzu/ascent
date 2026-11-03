import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import { C, conTema, conAlfa } from './colores';
import { useTema } from './useTema';
import { Text } from './Texto';
import FondoOctogonal from './FondoOctogonal';

type Amigo = { id: string; username: string; avatar_url: string | null };
// Dónde quedó la burbuja tocada, en la ventana: de ahí sale el globo.
type Lugar = { x: number; y: number; ancho: number; alto: number };
type Tocada = Lugar & { amigo: Amigo };

/**
 * EL MULTIJUGADOR ARRIBA DE TODO EN INICIO (28/10, la variante B aprobada en la galería, más
 * compacta): «Iniciar grupo» y una burbuja por amigo que está entrenando ahora. Nunca dice dónde.
 *
 * «INICIAR GRUPO» ABRE LA LISTA DE LOS QUE ENTRENAN (2/11, a pedido), para invitarlos. Antes
 * empezaba a entrenar y compartía un link. Si no entrena nadie lo dice, y no deja hacer nada: un
 * grupo de uno no existe. El link sigue en Social.
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
  alInvitar,
}: {
  visible: boolean;
  alInvitar: (amigo: string) => Promise<RespuestaDeInvitar>;
}) {
  useTema();
  const version = useVersionDelEsquema();
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [tocada, setTocada] = useState<Tocada | null>(null);
  const [iniciando, setIniciando] = useState<Lugar | null>(null);
  const [preguntando, setPreguntando] = useState(false);
  const caras = useRef(new Map<string, View | null>());
  const mas = useRef<View | null>(null);
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

  function iniciarGrupo() {
    // Lo que ya estaba en la fila puede ser de hace rato: se pregunta de nuevo al abrir.
    setPreguntando(true);
    void cargar().finally(() => setPreguntando(false));
    mas.current?.measureInWindow((x, y, ancho, alto) => setIniciando({ x, y, ancho, alto }));
  }

  const conGrupos = disponible('grupos', version);
  const fila =
    visible && (conGrupos || amigos.length > 0) ? (
      <Aparece>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fila} testID="burbujas-del-grupo">
          {conGrupos && (
            <Tocable testID="iniciar-grupo" style={estilos.burbuja} onPress={iniciarGrupo} accessibilityRole="button">
              <View style={[estilos.cara, estilos.mas]} ref={mas} collapsable={false}>
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
      {iniciando && <GloboDeIniciarGrupo lugar={iniciando} amigos={amigos} preguntando={preguntando} alInvitar={alInvitar} alCerrar={() => setIniciando(null)} />}
    </>
  );
}

/** Lo que dice el globo después de invitar. */
function dichoDeInvitar(r: RespuestaDeInvitar, nombre: string) {
  if (r === 'ok') return { texto: T.social.invitacionEnviada, bien: true };
  if (r === 'ya-unido') return { texto: T.social.grupoYaEstas, bien: true };
  return { texto: r === 'ocupado' ? T.social.invitarOcupado(nombre) : r === 'no-entrena' ? T.social.unirseNoEntrena(nombre) : T.social.invitarFallo, bien: false };
}

function GloboDeIniciarGrupo({
  lugar,
  amigos,
  preguntando,
  alInvitar,
  alCerrar,
}: {
  lugar: Lugar;
  amigos: Amigo[];
  preguntando: boolean;
  alInvitar: (amigo: string) => Promise<RespuestaDeInvitar>;
  alCerrar: () => void;
}) {
  useTema();
  const { width } = useWindowDimensions();
  // Cada fila contesta por su cuenta: se puede invitar a varios sin cerrar.
  const [dichos, setDichos] = useState<Record<string, { texto: string; bien: boolean }>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const centro = lugar.x + lugar.ancho / 2;

  async function invitar(a: Amigo) {
    setEnviando(a.id);
    const r = await alInvitar(a.id);
    setDichos((d) => ({ ...d, [a.id]: dichoDeInvitar(r, a.username) }));
    setEnviando(null);
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={alCerrar}>
      <Pressable style={estilos.velo} onPress={alCerrar} accessibilityRole="button" accessibilityLabel={T.general.cerrar} />
      <View testID="globo-iniciar-grupo" accessibilityViewIsModal style={[estilos.globo, { top: lugar.y + lugar.alto + 32 }]}>
        <FondoOctogonal relleno={C.hoja} borde={C.lineaFuerte} corte={12} luz={C.claro} />
        <View style={[estilos.cola, { left: Math.min(Math.max(centro - MARGEN - 7, 18), width - 2 * MARGEN - 32) }]} />
        <Text style={estilos.quien}>{T.inicio.iniciarGrupo}</Text>
        {amigos.length === 0 ? (
          preguntando ? (
            <ActivityIndicator color={C.sub} style={estilos.cargando} />
          ) : (
            <Text testID="iniciar-grupo-nadie" style={estilos.dato}>
              {T.inicio.nadieEntrenando}
            </Text>
          )
        ) : (
          <ScrollView style={estilos.lista} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {amigos.map((a) => {
              const dicho = dichos[a.id];
              return (
                <View key={a.id} style={estilos.filaAmigo} testID="iniciar-grupo-amigo">
                  <View style={estilos.aro}>
                    <Avatar url={a.avatar_url} nombre={a.username} tam={32} />
                  </View>
                  <View style={estilos.filaTexto}>
                    <Text style={estilos.filaNombre} numberOfLines={1}>
                      {a.username}
                    </Text>
                    {dicho && (
                      <Text testID="iniciar-grupo-dijo" style={[estilos.filaDijo, dicho.bien && estilos.dijoBien]} numberOfLines={2}>
                        {dicho.texto}
                      </Text>
                    )}
                  </View>
                  {!dicho?.bien && (
                    <Tocable
                      testID="iniciar-grupo-invitar"
                      style={estilos.invitar}
                      onPress={() => void invitar(a)}
                      disabled={enviando !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`${T.inicio.invitarEnElGrupo} ${a.username}`}
                    >
                      <Text style={estilos.invitarTexto}>{enviando === a.id ? '…' : T.inicio.invitarEnElGrupo}</Text>
                    </Tocable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function GloboDelAmigo({ tocada, alInvitar, alCerrar }: { tocada: Tocada; alInvitar: (amigo: string) => Promise<RespuestaDeInvitar>; alCerrar: () => void }) {
  useTema();
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
      setDijo(dichoDeInvitar(await alInvitar(amigo.id), amigo.username));
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
        <FondoOctogonal relleno={C.hoja} borde={C.lineaFuerte} corte={12} luz={C.claro} />
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

const estilos = conTema(() => StyleSheet.create({
  // COMPACTA (28/10): la propuesta ocupaba casi cien puntos; Inicio entero tiene que entrar sin desplazar.
  fila: { gap: 10, paddingTop: 10, paddingBottom: 2 },
  burbuja: { width: 70, alignItems: 'center', gap: 3 },
  cara: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  mas: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.sub, alignItems: 'center', justifyContent: 'center' },
  masTexto: { color: C.tinta, fontSize: 18, lineHeight: 20 },
  aro: { borderWidth: 2, borderColor: C.vivo, borderRadius: 999, padding: 0 },
  nombre: { color: C.sub, fontSize: 10.5, maxWidth: 70 },
  velo: { ...StyleSheet.absoluteFillObject, backgroundColor: conAlfa(C.negro, 0.62) },
  tocada: { position: 'absolute', width: TOCADA, height: TOCADA, borderRadius: 999, borderWidth: 2, borderColor: C.vivo, alignItems: 'center', justifyContent: 'center' },
  globo: {
    position: 'absolute',
    left: MARGEN,
    right: MARGEN,
    padding: 16,
    gap: 6,
  },
  cola: {
    position: 'absolute',
    top: -7,
    width: 14,
    height: 14,
    backgroundColor: C.hoja,
    borderLeftWidth: 1,
    borderTopWidth: 1,
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
  lista: { maxHeight: 264, marginTop: 4 },
  filaAmigo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  filaTexto: { flex: 1, minWidth: 0 },
  filaNombre: { color: C.tinta, fontSize: 14 },
  filaDijo: { color: C.sub, fontSize: 12, marginTop: 1 },
  invitar: { backgroundColor: C.claro, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  invitarTexto: { color: C.fondo, fontWeight: '600', fontSize: 13 },
}));
