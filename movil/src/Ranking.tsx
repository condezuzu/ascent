import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from './supabase';
import { T } from '@nucleo/textos';
import { fechaLinda } from '@nucleo/fechas';
import type { UsuarioPublico } from '@nucleo/tipos';
import {
  aceptarAmistad,
  buscarGente,
  cargarRanking,
  pedirAmistad,
  rechazarAmistad,
  type DatosDeRanking,
} from '@compartido/ranking';
import Avatar from './Avatar';
import Surgir from './Surgir';
import Insignia from './Insignia';
import Medallas from './Medallas';
import FondoEspacial from './FondoEspacial';
import { cargarMedallasDeAmigo } from '@compartido/perfil';
import type { Medalla } from '@nucleo/medallas';
import { C } from './colores';
import { useRecargarAlVolver } from './irAPestana';

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
 *
 * LO QUE NO ESTÁ, marcado: los retos. En la web tampoco se muestran
 * (`RETOS_LISTOS = false`).
 */
export default function Ranking({ alSalir }: { alSalir: () => void }) {
  const router = useRouter();
  const [miId, setMiId] = useState('');
  const [datos, setDatos] = useState<DatosDeRanking | null>(null);
  const [noCargo, setNoCargo] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<UsuarioPublico[]>([]);
  const [mandados, setMandados] = useState<Set<string>>(new Set());
  // Las medallas de cada amigo, para mostrarlas en la fila. Se traen APARTE y
  // en segundo plano (una consulta por amigo, en paralelo) para no demorar la
  // primera pintada del ranking: la lista aparece y las medallas caen encima.
  const [medallas, setMedallas] = useState<Record<string, Medalla[]>>({});
  // AMIGOS ENTRENANDO AHORA (actividad en vivo). Se refresca con el ranking.
  // Si la migración de actividad no corrió, vuelve vacío y no se muestra nada.
  const [entrenando, setEntrenando] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const busquedaAhora = useRef('');

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return alSalir();
    setMiId(uid);
    const d = await cargarRanking(supabase, uid).catch(() => null);
    // No poder preguntar no es no tener amigos: ver `compartido/ranking.ts`.
    setNoCargo(!d);
    if (d) {
      setDatos(d);
      setMandados(d.pedidosMandados);
    }
    setCargado(true);
    // Quién está entrenando ahora, aparte y sin frenar el ranking.
    void (async () => {
      try {
        const { data: viv } = await supabase.rpc('entrenando_ahora');
        setEntrenando(Array.isArray(viv) ? viv : []);
      } catch {
        setEntrenando([]);
      }
    })();
  }, [alSalir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Y de nuevo al volver a esta pestaña: ahora se queda montada.
  useRecargarAlVolver('ranking', cargar);

  // LAS MEDALLAS DE LOS AMIGOS, en segundo plano. Una consulta por amigo, en
  // paralelo, disparada solo cuando cambia la lista de amigos —no en cada
  // carga—: la lista del ranking se pinta ya y las medallas aparecen encima.
  const idsAmigos = (datos?.amigos ?? []).map((a) => a.id).join(',');
  useEffect(() => {
    const ids = idsAmigos ? idsAmigos.split(',') : [];
    if (ids.length === 0) return;
    let vivo = true;
    Promise.all(
      ids.map(async (id) => [id, await cargarMedallasDeAmigo(supabase, id).catch(() => [])] as const)
    ).then((pares) => {
      if (vivo) setMedallas(Object.fromEntries(pares));
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

  async function agregar(destino: string) {
    if (!(await pedirAmistad(supabase, miId, destino))) return cargar();
    setMandados(new Set([...mandados, destino]));
  }

  const amigos = datos?.amigos ?? [];

  return (
    <View style={estilos.raiz}>
      {/* El fondo de la web en Ranking: tu propio cuerpo, arriba a la derecha,
          con más velo que en Inicio porque acá manda la lista. */}
      {datos && (
        <FondoEspacial rango={datos.miRango} planeta={datos.miPlaneta} velo={0.68} />
      )}
      <ScrollView contentContainerStyle={estilos.pantalla} keyboardShouldPersistTaps="handled">
        <Text style={estilos.titulo}>{T.social.titulo}</Text>

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
            {amigos.map((a, i) => (
              <Surgir indice={i} key={a.id}>
                {/* LA FILA LLEVA AL PERFIL, como en la web. Tu propia fila va a
                    tu perfil, que es otra pantalla. */}
                <Pressable
                  style={({ pressed }) => [estilos.fila, pressed && estilos.filaTocada]}
                  onPress={() => router.push(a.id === miId ? '/yo' : `/perfil/${a.id}`)}
                  accessibilityRole="button"
                >
                  <Text style={[estilos.dato, { width: 20 }]}>{i + 1}</Text>
                  <Insignia rango={a.rango_actual} tam={38} />
                  {/* LAS MEDALLAS, al lado del nombre, igual que en el perfil.
                      Caen en segundo plano (ver el efecto de arriba). */}
                  <View style={{ flex: 1 }}>
                    <Medallas
                      medallas={medallas[a.id] ?? []}
                      tam={15}
                      nombre={
                        <Text style={estilos.nombre}>{a.id === miId ? T.social.yoEnLista(a.username) : a.username}</Text>
                      }
                    />
                  </View>
                  <Text style={estilos.dato}>{a.racha_actual}</Text>
                </Pressable>
              </Surgir>
            ))}
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

        {/* ENTRENANDO AHORA (en vivo): arriba del historial, porque es lo que
            está pasando. Solo dice que están entrenando, nunca dónde. */}
        {entrenando.length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.rotulo}>{T.social.entrenandoAhora}</Text>
            {entrenando.map((e) => (
              <Pressable
                style={({ pressed }) => [estilos.fila, pressed && estilos.filaTocada]}
                key={e.id}
                onPress={() => router.push(`/perfil/${e.id}`)}
                accessibilityRole="button"
              >
                <View style={estilos.puntoVivo} />
                <Avatar url={e.avatar_url} nombre={e.username} tam={28} />
                <Text style={[estilos.nombre, { fontSize: 14 }]}>{T.social.estaEntrenando(e.username)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {(datos?.actividad ?? []).length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.rotulo}>{T.social.actividad}</Text>
            {datos!.actividad.map((a, i) => (
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
                  <Pressable
                    onPress={async () => {
                      await aceptarAmistad(supabase, s.id);
                      cargar();
                    }}
                    hitSlop={8}
                  >
                    <Text style={estilos.accion}>{T.social.aceptar}</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      await rechazarAmistad(supabase, s.id);
                      cargar();
                    }}
                    hitSlop={8}
                  >
                    <Text style={[estilos.accion, { color: C.apagado }]}>{T.social.no}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={estilos.seccion}>
          <Text style={estilos.rotulo}>{T.social.buscarGente}</Text>
          <Text style={estilos.pieBusqueda}>{T.social.buscarPie}</Text>
          <TextInput
            style={estilos.campo}
            placeholder={T.ajustes.nombrePlaceholder}
            placeholderTextColor={C.apagado}
            value={busqueda}
            onChangeText={buscar}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {resultados.map((u) => (
            <View style={estilos.fila} key={u.id}>
              <Avatar url={u.avatar_url} nombre={u.username} />
              {/* Su rango al lado, como en el ranking: de un desconocido, lo
                  primero que dice algo es en qué anda. El nombre lleva al perfil
                  y "Agregar" queda aparte: mirar antes que agregar. */}
              <Insignia rango={u.rango_actual} tam={26} />
              <Pressable style={{ flex: 1 }} onPress={() => router.push(`/perfil/${u.id}`)} accessibilityRole="button">
                <Text style={estilos.nombre}>{u.username}</Text>
              </Pressable>
              {mandados.has(u.id) ? (
                <Text style={estilos.dato}>{T.social.pedidoEnviado}</Text>
              ) : (
                <Pressable onPress={() => agregar(u.id)} hitSlop={8}>
                  <Text style={estilos.accion}>{T.social.agregar}</Text>
                </Pressable>
              )}
            </View>
          ))}
          {/* "No encontramos a nadie": solo cuando se buscó algo de verdad y no
              hubo con qué. Antes un nombre inexistente no decía nada y parecía
              que la búsqueda no andaba. */}
          {busqueda.trim().length >= 2 && resultados.length === 0 && (
            <Text style={estilos.sinResultado}>{T.social.sinResultado}</Text>
          )}
        </View>
      </ScrollView>
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
  nombre: { flex: 1, color: C.tinta, fontSize: 15 },
  dato: { color: C.sub, fontSize: 14, fontVariant: ['tabular-nums'] },
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
  pieBusqueda: { color: C.apagado, fontSize: 12, marginBottom: 8 },
  // El punto verde de "en vivo", al lado de quien está entrenando ahora.
  puntoVivo: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#5fd08a' },
  sinResultado: { color: C.apagado, fontSize: 13, paddingVertical: 12 },
  miniatura: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
  },
  campo: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.tinta,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 6,
  },
});
