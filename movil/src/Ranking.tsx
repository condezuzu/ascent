import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { leerViva, suscribirViva } from '@compartido/sesionViva';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { supabase } from './supabase';
import { quienSoy } from '@compartido/quienSoy';
import { registrarAvisosRemotos } from '@compartido/avisosRemotos';
import { T } from '@nucleo/textos';
import { fechaLinda } from '@nucleo/fechas';
import type { UsuarioPublico } from '@nucleo/tipos';
import {
  accionDeBusqueda,
  aceptarAmistad,
  buscarGente,
  cargarRanking,
  pedirAmistad,
  rechazarAmistad,
  type DatosDeRanking,
  SOCIAL_CAMBIO,
} from '@compartido/ranking';
import { eventos } from '@compartido/eventos';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { useRefrescoDeFirmadas } from '@compartido/useRefrescoDeFirmadas';
import { plataforma } from '@plataforma';
import Avatar from './Avatar';
import AccionesDeUsuario from './AccionesDeUsuario';
import CampoTexto from './CampoTexto';
import Surgir from './Surgir';
import Insignia from './Insignia';
import { numeroDeRango } from '@nucleo/rangos';
import Medallas from './Medallas';
import FondoEspacial from './FondoEspacial';
import GloboPrimeraVez from './GloboPrimeraVez';
import { cargarMedallasDeMuchos } from '@compartido/perfil';
import { leerPerfilCache } from '@compartido/cache';
import type { Medalla } from '@nucleo/medallas';
import { C } from './colores';
import { useRecargarAlVolver } from './irAPestana';
import InvitarConLink from './InvitarConLink';
import Juntos from './Juntos';
import { useUniones } from './useUniones';
import { PESTANA_ACTIVA } from './irAPestana';
import { pedirUnirse } from '@compartido/enVivo';
import { CADA_CUANTO_MS, unionCon } from '@nucleo/enVivo';
import { disponible } from '@nucleo/esquema';
import { useVersionDelEsquema } from '@compartido/esquema';
import { useArriba } from './zonaSegura';
import Tocable from './Tocable';

/**
 * RANKING — tanda 4.
 *
 * Las consultas son las MISMAS que las de la web: viven en
 * `compartido/ranking.ts` y las dos apps las llaman. Acá solo se dibuja.
 *
 * LAS INSIGNIAS Y EL CAMPO ESTELAR, iguales a la web desde el 18/9: los dibujos
 * viven en `compartido/insignias.ts` y el lugar de cada astro en
 * `astroDeAmigo`, y las dos apps los toman de ahí.
 *
 * TOCAR A ALGUIEN LLEVA A SU PERFIL (22/9): la fila del ranking, la línea de
 * actividad y el resultado de la búsqueda. Antes eran texto, no por decisión
 * sino porque no había adónde ir.
 */
export default function Ranking({ alSalir }: { alSalir: () => void }) {
  const router = useRouter();
  const arriba = useArriba(64);
  // LA PRIMERA VEZ QUE SE ENTRA A RANKING se pide dejar avisar (si nunca se pidió):
  // es donde se entiende para qué —que te avisen cuando te quieren agregar.
  useEffect(() => {
    void registrarAvisosRemotos(supabase, true).catch(() => undefined);
  }, []);
  // Cuántas actividades se ven antes de "ver más".
  const ACTIVIDAD_TOPE = 8;
  // Cuántos del ranking se ven antes de la flechita (20/10: cinco; eran diez).
  const RANKING_TOPE = 5;
  const [verTodos, setVerTodos] = useState(false);
  const [miId, setMiId] = useState('');
  const [datos, setDatos] = useState<DatosDeRanking | null>(null);
  const [noCargo, setNoCargo] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<UsuarioPublico[]>([]);
  const [mandados, setMandados] = useState<Set<string>>(new Set());
  // Las medallas de cada amigo, para mostrarlas en la fila. Se traen APARTE y
  // en segundo plano (UNA sola consulta para todos, `medallas_de_muchos`) para
  // no demorar la primera pintada: la lista aparece y las medallas caen encima.
  const [medallas, setMedallas] = useState<Record<string, Medalla[]>>({});
  // AMIGOS ENTRENANDO AHORA (actividad en vivo). Se refresca con el ranking.
  // Si la migración de actividad no corrió, vuelve vacío y no se muestra nada.
  const [entrenando, setEntrenando] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  // Si no contesta, queda la lista que había: un hipo de red no puede sacar a
  // alguien de "entrenando ahora" justo cuando se lo está mirando.
  const pedirEntrenando = useCallback(async () => {
    try {
      const { data: viv, error } = await supabase.rpc('entrenando_ahora');
      if (!error) setEntrenando(Array.isArray(viv) ? viv : []);
    } catch {
      /* queda lo que había */
    }
  }, []);

  // ENTRENAR CON OTRO (12/10). Mientras se mira esta pestaña se pregunta cada
  // diez segundos quién entrena y qué hacen los que están conmigo. No es tiempo
  // real: es una pregunta repetida, y se apaga al salir de la pestaña.
  const [activa, setActiva] = useState(false);
  useEffect(() => eventos.escuchar(PESTANA_ACTIVA, (cual) => setActiva(cual === 'ranking')), []);
  const juntos = useUniones(activa);
  // Si estoy entrenando: el link del grupo se ofrece aunque todavía no haya nadie.
  const yoEntreno = useSyncExternalStore(suscribirViva, () => leerViva().inicio !== null, () => false);
  // Por qué no se pudo pedir unirse, al lado de quién. Se va al salir de la pestaña.
  const [noSePudo, setNoSePudo] = useState<{ id: string; texto: string } | null>(null);
  useEffect(() => {
    if (!activa) setNoSePudo(null);
  }, [activa]);
  async function unirseA(e: { id: string; username: string }) {
    const r = await pedirUnirse(supabase, e.id);
    const texto =
      r === 'ocupado' ? T.social.unirseOcupado(e.username) : r === 'ya-unido' ? T.social.unirseYaUnido : r === 'no-entrena' ? T.social.unirseNoEntrena(e.username) : null;
    setNoSePudo(texto ? { id: e.id, texto } : null);
    juntos.recargar();
  }
  const conJuntos = disponible('entrenarConOtro', useVersionDelEsquema());
  useEffect(() => {
    if (!activa) return;
    const t = setInterval(() => {
      if (plataforma.ciclo.visible()) void pedirEntrenando();
    }, CADA_CUANTO_MS);
    return () => clearInterval(t);
  }, [activa, pedirEntrenando]);
  // A quién denunciar o bloquear (long-press en una fila). null = hoja cerrada.
  const [accion, setAccion] = useState<{ id: string; username: string } | null>(null);
  // ¿Ya marcó su gimnasio? Del caché del perfil (que guarda si está marcado,
  // nunca dónde). Es la condición para el aviso de actividad en vivo: antes de
  // marcarlo, explicaría algo que la persona todavía no puede usar.
  const [gimnasioMarcado, setGimnasioMarcado] = useState(false);
  // La actividad se muestra recortada: un amigo que registró muchos días —o
  // varios amigos— la vuelven kilométrica (5.4). Se ven las últimas ACTIVIDAD_TOPE
  // y el resto se despliega a un toque. Feed cronológico, no por-amigo: lo que
  // uno quiere de acá es "qué pasó último", y agrupar por amigo con varios amigos
  // no achica nada (2-3 × N amigos). Cortar + desplegar sí escala a cualquier N.
  const [verTodaLaActividad, setVerTodaLaActividad] = useState(false);
  const busquedaAhora = useRef('');

  const cargar = useCallback(async () => {
    const yo = await quienSoy(supabase);
    if (yo.estado === 'sin') return alSalir();
    if (yo.estado === 'con') setMiId(yo.uid);
    // No poder preguntar quién soy es no haber podido cargar: cartel y Reintentar.
    const d = yo.estado === 'con' ? await cargarRanking(supabase, yo.uid).catch(() => null) : null;
    // No poder preguntar no es no tener amigos: ver `compartido/ranking.ts`.
    setNoCargo(!d);
    if (d) {
      setDatos(d);
      setMandados(d.pedidosMandados);
    }
    setCargado(true);
    // Quién está entrenando ahora, aparte y sin frenar el ranking.
    void pedirEntrenando();
  }, [alSalir, pedirEntrenando]);

  // Las fotos de la actividad vencen a la hora: se vuelven a pedir antes de que se
  // rompan (ver `useRefrescoDeFirmadas`).
  const recargar = useRefrescoDeFirmadas(cargar, plataforma.ciclo.alCambiar);
  useEffect(() => {
    recargar();
  }, [recargar]);

  // Y de nuevo al volver a esta pestaña: ahora se queda montada.
  useRecargarAlVolver('ranking', recargar);

  // Y CUANDO SE BLOQUEA O DESBLOQUEA A ALGUIEN DESDE OTRA PANTALLA (4/10): el
  // perfil se apila encima de esta, que al volver seguía mostrando al bloqueado.
  useEffect(() => eventos.escuchar(SOCIAL_CAMBIO, () => recargar()), [recargar]);

  // ¿El gimnasio ya está marcado? Del caché del perfil, para gatear el aviso.
  useEffect(() => {
    let vivo = true;
    leerPerfilCache()
      .then((p) => {
        if (vivo && p?.tieneGimnasio) setGimnasioMarcado(true);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // LAS MEDALLAS DE LOS AMIGOS, en segundo plano y en UNA sola consulta
  // (`medallas_de_muchos`), disparada solo cuando cambia la lista de amigos —no
  // en cada carga—: la lista del ranking se pinta ya y las medallas caen encima.
  const idsAmigos = (datos?.amigos ?? []).map((a) => a.id).join(',');
  useEffect(() => {
    const ids = idsAmigos ? idsAmigos.split(',') : [];
    if (ids.length === 0) return;
    let vivo = true;
    cargarMedallasDeMuchos(supabase, ids)
      .then((mapa) => {
        if (vivo) setMedallas(mapa);
      })
      .catch(() => {
        // Sin medallas la lista se dibuja igual: son un adorno, no un dato.
      });
    return () => {
      vivo = false;
    };
  }, [idsAmigos]);

  async function buscar(texto: string) {
    setBusqueda(texto);
    busquedaAhora.current = texto;
    if (texto.trim().length < 2) return setResultados([]);
    const encontrados = await buscarGente(supabase, texto, miId, new Set((datos?.amigos ?? []).map((a) => a.id)));
    if (busquedaAhora.current !== texto) return;
    setResultados(encontrados);
  }

  // Trabas contra el doble-tap en las acciones que escriben una amistad. Cada
  // una es una sola traba a nivel del componente (los botones viven en un
  // `.map`, donde no van hooks) y el `id` de la fila decide sobre quién actúa:
  //  - agregar: sin traba, dos toques mandaban DOS pedidos al mismo destino.
  //  - aceptar/rechazar: dos toques resolvían la misma solicitud dos veces.
  const agregar = useEnVuelo(async (destino: string) => {
    if (!(await pedirAmistad(supabase, miId, destino))) return cargar();
    setMandados(new Set([...mandados, destino]));
  });

  const aceptar = useEnVuelo(async (id: string) => {
    await aceptarAmistad(supabase, id);
    cargar();
  });

  const rechazar = useEnVuelo(async (id: string) => {
    await rechazarAmistad(supabase, id);
    cargar();
  });

  const amigos = datos?.amigos ?? [];

  return (
    <View style={estilos.raiz}>
      {/* El fondo de la web en Ranking: tu propio cuerpo, arriba a la derecha,
          con más velo que en Inicio porque acá manda la lista. */}
      {datos && (
        <FondoEspacial rango={datos.miRango} planeta={datos.miPlaneta} velo={0.68} />
      )}
      <ScrollView contentContainerStyle={[estilos.pantalla, { paddingTop: arriba }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={estilos.titulo}>{T.social.titulo}</Text>

        {/* BUSCAR GENTE, ARRIBA Y EN UN RENGLÓN FINITO (15/10): no tapa nada y
            está donde se lo busca. Los resultados caen justo debajo. */}
        <View style={estilos.buscador}>
          <Text style={estilos.lupa}>⌕</Text>
          <CampoTexto
            testID="buscar-gente"
            style={estilos.campo}
            placeholder={T.social.buscarGente}
            placeholderTextColor={C.apagado}
            value={busqueda}
            onChangeText={buscar}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {/* EL GLOBITO DE AGREGAR AMIGOS (15/10), saliendo del buscador: es donde se agregan. */}
        <GloboPrimeraVez cual="amigos" colaX={66} subir={12} vistoAlMostrar cerrarCuando={busqueda.length > 0}>
          {T.globos.amigos}
        </GloboPrimeraVez>
        {resultados.map((u) => {
          const accion = accionDeBusqueda(u.id, datos?.amigos ?? [], datos?.solicitudes ?? [], mandados);
          return (
          <View style={estilos.fila} key={u.id}>
            <Avatar url={u.avatar_url} nombre={u.username} />
            {/* Su rango al lado, como en el ranking: de un desconocido, lo
                primero que dice algo es en qué anda. El nombre lleva al perfil
                y "Agregar" queda aparte: mirar antes que agregar. */}
            <Insignia rango={numeroDeRango(u.racha_actual)} tam={26} />
            <Pressable style={{ flex: 1 }} onPress={() => router.push(`/perfil/${u.id}`)} accessibilityRole="button">
              <Text style={estilos.nombre}>{u.username}</Text>
            </Pressable>
            {/* Si esa persona YA te mandó un pedido, "Agregar" rebotaba en
                silencio contra el suyo: acá se acepta. Y si ya es tu amiga
                —la acabás de aceptar— no se ofrece nada: ver `accionDeBusqueda`. */}
            {accion.que === 'aceptar' ? (
              <Pressable onPress={() => aceptar(accion.pedido)} hitSlop={8}>
                <Text style={estilos.accion}>{T.social.aceptar}</Text>
              </Pressable>
            ) : accion.que === 'enviado' ? (
              <Text style={estilos.dato}>{T.social.pedidoEnviado}</Text>
            ) : accion.que === 'agregar' ? (
              <Pressable onPress={() => agregar(u.id)} hitSlop={8}>
                <Text style={estilos.accion}>{T.social.agregar}</Text>
              </Pressable>
            ) : null}
          </View>
          );
        })}
        {/* "No encontramos a nadie": solo cuando se buscó algo de verdad y no
            hubo con qué. Antes un nombre inexistente no decía nada y parecía
            que la búsqueda no andaba. */}
        {busqueda.trim().length >= 2 && resultados.length === 0 && (
          <Text style={estilos.sinResultado}>{T.social.sinResultado}</Text>
        )}


        {/* ENTRENANDO CONTIGO, ARRIBA DE TODO (28/10, aprobado en la galería): es lo que está
            pasando. Cada cara con el color de su rango. Nunca dice dónde. */}
        <Juntos
          uniones={juntos.uniones}
          recibidoEn={juntos.recibidoEn}
          recargar={juntos.recargar}
          entrenando={yoEntreno}
          rachas={new Map(amigos.map((a) => [a.id, a.racha_actual]))}
        />

        {!cargado && <ActivityIndicator color={C.sub} style={{ marginTop: 24 }} />}

        {noCargo && (
          <View style={estilos.tarjeta}>
            <Text style={estilos.texto}>{T.inicio.noCargo}</Text>
            <Pressable style={estilos.botonFantasma} onPress={cargar}>
              <Text style={estilos.textoBoton}>{T.inicio.reintentar}</Text>
            </Pressable>
          </View>
        )}

        {/* Las solicitudes recibidas ya NO van acá arriba: empujaban el ranking
            hacia abajo. Ahora van al final, después del ranking. Ver `solicitudes`. */}

        {amigos.length > 1 ? (
          // SIN EL CAMPO ESTELAR DETRÁS (27/9): eran las insignias flotando,
          // quietas y sin aportar ("sacá los emojis del fondo"). La lista se lee
          // sobre el velo de `FondoEspacial`, que ya está detrás.
          <View style={estilos.lista}>
            {/* ESCALONADAS Y NO TODAS DE GOLPE, igual que en la web. Ver `Surgir`. */}
            {/* SE VEN CINCO (20/10) y el resto detrás de la flechita. */}
            {(verTodos ? amigos : amigos.slice(0, RANKING_TOPE)).map((a, i) => (
              <Surgir indice={i} key={a.id}>
                {/* LA FILA LLEVA AL PERFIL, como en la web. Tu propia fila va a
                    tu perfil, que es otra pantalla. */}
                <Pressable
                  testID="ranking-fila"
                  style={({ pressed }) => [estilos.fila, pressed && estilos.filaTocada]}
                  onPress={() => router.push(a.id === miId ? '/yo' : `/perfil/${a.id}`)}
                  // Mantener apretado sobre un amigo: denunciar o bloquear, sin
                  // tener que entrar al perfil. Sobre tu propia fila no hace nada.
                  onLongPress={() => a.id !== miId && setAccion({ id: a.id, username: a.username })}
                  accessibilityRole="button"
                >
                  <Text style={[estilos.dato, { width: 20 }]}>{i + 1}</Text>
                  {/* LA CARA, no la insignia del rango de hoy (12/10): en una
                      lista de amigos se busca a la persona. */}
                  <Avatar url={a.avatar_url} nombre={a.username} tam={38} />
                  {/* LAS MEDALLAS, al lado del nombre, igual que en el perfil.
                      Caen en segundo plano (ver el efecto de arriba). */}
                  <View style={{ flex: 1 }}>
                    {/* LA DEL RANGO MÁS ALTO VA ACÁ, con las otras medallas (14/10): al lado
                        del número de la racha se confundía con la racha de hoy. */}
                    <Medallas
                      medallas={medallas[a.id] ?? []}
                      mejorRacha={Math.max(a.racha_actual, a.mejor_racha ?? 0)}
                      tam={20}
                      nombre={
                        <Text style={estilos.nombre}>{a.id === miId ? T.social.yoEnLista(a.username) : a.username}</Text>
                      }
                    />
                  </View>
                  <Text style={[estilos.dato, estilos.racha]}>{a.racha_actual}</Text>
                </Pressable>
              </Surgir>
            ))}
            {amigos.length > RANKING_TOPE && (
              <Pressable
                testID="ranking-ver-mas"
                onPress={() => setVerTodos((v) => !v)}
                hitSlop={12}
                style={estilos.verMas}
                accessibilityRole="button"
                accessibilityState={{ expanded: verTodos }}
                accessibilityLabel={verTodos ? T.social.actividadMenos : T.social.actividadMas(amigos.length - RANKING_TOPE)}
              >
                {/* LA FLECHITA (20/10): abajo abre, arriba vuelve a cerrar. */}
                <Svg width={22} height={22} viewBox="0 0 24 24" style={verTodos ? estilos.flechaArriba : undefined}>
                  <Path d="M6 9l6 6 6-6" fill="none" stroke={C.sub} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Pressable>
            )}
          </View>
        ) : (
          cargado &&
          !noCargo && (
            <View style={estilos.vacio}>
              <Text style={estilos.vacioTexto}>{T.social.vacioTitulo}</Text>
              <Text style={estilos.vacioTexto}>{T.social.vacioPie}</Text>
            </View>
          )
        )}


        {entrenando.length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.rotulo}>{T.social.entrenandoAhora}</Text>
            {entrenando.map((e) => {
              const union = unionCon(juntos.uniones, e.id);
              return (
                // LA FILA YA NO ES UN BOTÓN ENTERO: lleva "Unirse" adentro, y un
                // botón adentro de otro se come el toque del de adentro.
                <View style={[estilos.fila, noSePudo?.id === e.id && estilos.filaConAviso]} key={e.id}>
                  <Pressable
                    style={({ pressed }) => [estilos.filaAdentro, pressed && estilos.filaTocada]}
                    onPress={() => router.push(`/perfil/${e.id}`)}
                    accessibilityRole="button"
                  >
                    <View style={estilos.puntoVivo} />
                    <Avatar url={e.avatar_url} nombre={e.username} tam={28} />
                    <Text style={[estilos.nombre, { fontSize: 14 }]}>{T.social.estaEntrenando(e.username)}</Text>
                  </Pressable>
                  {conJuntos && !union && (
                    <Tocable
                      testID="unirse"
                      style={estilos.unirse}
                      hitSlop={8}
                      onPress={() => void unirseA(e)}
                      accessibilityRole="button"
                    >
                      <Text style={estilos.unirseTexto}>{T.social.unirse}</Text>
                    </Tocable>
                  )}
                  {union?.estado === 'pendiente' && union.laPediYo && <Text style={estilos.dato}>{T.social.pedidoEnviado}</Text>}
                  {/* Renglón propio y a todo el ancho: al lado del nombre no entra. */}
                  {noSePudo?.id === e.id && (
                    <Text testID="unirse-no-se-pudo" style={estilos.noSePudo}>
                      {noSePudo.texto}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* LAS SOLICITUDES RECIBIDAS, al final: es "algo que te llegó", no la
            tabla, así que no tiene por qué empujar el ranking hacia abajo.
            (El aviso de que HAY una, estando en otra pestaña, es aparte.) */}
        {(datos?.solicitudes ?? []).length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.rotulo}>{T.social.solicitudes}</Text>
            <View style={estilos.tarjeta}>
              {datos!.solicitudes.map((s) => (
                <View style={estilos.fila} key={s.id}>
                  <Avatar url={s.de.avatar_url} nombre={s.de.username} />
                  <Text style={estilos.nombre}>{s.de.username}</Text>
                  <Pressable onPress={() => aceptar(s.id)} hitSlop={8}>
                    <Text style={estilos.accion}>{T.social.aceptar}</Text>
                  </Pressable>
                  <Pressable onPress={() => rechazar(s.id)} hitSlop={8}>
                    <Text style={[estilos.accion, { color: C.apagado }]}>{T.social.no}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Invitar: al final de lo tuyo, antes de lo que hacen los demás. */}
        <View style={estilos.seccion}>
          <InvitarConLink usuario={datos?.amigos.find((a) => a.id === miId)?.username} />
        </View>

        {/* LA ACTIVIDAD, ABAJO DE TODO (15/10): es lo menos importante de la pantalla. */}
        {(datos?.actividad ?? []).length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.rotulo}>{T.social.actividad}</Text>
            {(verTodaLaActividad ? datos!.actividad : datos!.actividad.slice(0, ACTIVIDAD_TOPE)).map((a, i) => (
              <Pressable
                style={({ pressed }) => [estilos.fila, pressed && estilos.filaTocada]}
                key={i}
                onPress={() => router.push(a.userId === miId ? '/yo' : `/perfil/${a.userId}`)}
                accessibilityRole="button"
              >
                <Avatar url={a.avatar} nombre={a.username} tam={28} />
                {a.foto && <Image source={{ uri: a.foto }} style={estilos.miniatura} />}
                <Text style={[estilos.nombre, { color: C.sub, fontSize: 14 }]}>
                  {T.social.registroEl(a.username, fechaLinda(a.fecha))}
                </Text>
              </Pressable>
            ))}
            {datos!.actividad.length > ACTIVIDAD_TOPE && (
              <Pressable onPress={() => setVerTodaLaActividad((v) => !v)} hitSlop={8} style={estilos.verMas}>
                <Text style={estilos.verMasTexto}>
                  {verTodaLaActividad ? T.social.actividadMenos : T.social.actividadMas(datos!.actividad.length - ACTIVIDAD_TOPE)}
                </Text>
              </Pressable>
            )}
          </View>
        )}

      </ScrollView>

      <AccionesDeUsuario
        usuario={accion}
        onCerrar={() => setAccion(null)}
        onBloqueado={() => cargar()}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  // Transparente: el fondo lo dibuja `FondoRaiz`.
  raiz: { flex: 1 },
  pantalla: { flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 40 },
  titulo: { color: C.tinta, fontSize: 22, marginBottom: 20 },
  tarjeta: {
    backgroundColor: 'rgba(11,13,19,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
  },
  ranking: { position: 'relative', marginBottom: 16 },
  lista: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.linea, paddingVertical: 4 },
  // El hundido al tocar: sin eso, una fila que navega se ve igual que una
  // que no hace nada, y la única forma de saberlo es tocarla.
  filaTocada: { opacity: 0.55 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  // Sin flex: las medallas van pegadas al nombre (14/10); uno largo las baja de renglón.
  nombre: { flexShrink: 1, color: C.tinta, fontSize: 15 },
  dato: { color: C.sub, fontSize: 14, fontVariant: ['tabular-nums'] },
  // La racha de hoy, sola y apartada a la derecha: lo de al lado del nombre son logros.
  racha: { color: C.tinta, fontSize: 16, minWidth: 34, textAlign: 'right', marginLeft: 14 },
  filaAdentro: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  unirse: { borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineaFuerte, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  unirseTexto: { color: C.tinta, fontSize: 13 },
  filaConAviso: { flexWrap: 'wrap' },
  noSePudo: { color: C.sub, fontSize: 13, lineHeight: 18, flexBasis: '100%', paddingTop: 2, paddingBottom: 6 },
  accion: { color: C.claro, fontSize: 14 },
  texto: { color: C.sub, fontSize: 14, marginVertical: 10 },
  botonFantasma: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  textoBoton: { color: C.tinta, fontSize: 14 },
  vacio: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  vacioTexto: { color: C.sub, fontSize: 14, textAlign: 'center' },
  seccion: { marginTop: 24 },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  verMas: { paddingVertical: 10, alignItems: 'center' },
  verMasTexto: { color: C.sub, fontSize: 13 },
  flechaArriba: { transform: [{ rotate: '180deg' }] },
  // El punto verde de "en vivo", al lado de quien está entrenando ahora.
  puntoVivo: { width: 8, height: 8, borderRadius: 999, backgroundColor: C.vivo },
  sinResultado: { color: C.apagado, fontSize: 13, paddingVertical: 12 },
  miniatura: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
  },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 999,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  lupa: { color: C.apagado, fontSize: 15 },
  campo: { flex: 1, color: C.tinta, fontSize: 14, paddingVertical: 6 },
});
