import { useCallback, useEffect, useRef, useState } from 'react';
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
import FondoEspacial from './FondoEspacial';
import { C } from './colores';

/**
 * RANKING — tanda 4.
 *
 * Las consultas son las MISMAS que las de la web: viven en
 * `compartido/ranking.ts` y las dos apps las llaman. Acá solo se dibuja.
 *
 * LO QUE NO ESTÁ, marcado:
 *
 *   - LA INSIGNIA DE CADA RANGO en la fila. En la web es un SVG de 51 formas
 *     —polígonos, una medialuna, capas superpuestas— y en la app nativa no
 *     hay con qué dibujarla sin `react-native-svg`. No se la reemplaza por un
 *     círculo de color: eso sería otra insignia, no esta. Es la misma decisión
 *     pendiente que los degradados radiales del fondo.
 *   - El campo estelar detrás de la lista, que está hecho con las mismas
 *     insignias.
 *   - Tocar a alguien para ver su perfil: la pantalla de perfil no está
 *     portada todavía.
 *   - Los retos: en la web tampoco se muestran (`RETOS_LISTOS = false`).
 */
export default function Ranking({ alSalir }: { alSalir: () => void }) {
  const [miId, setMiId] = useState('');
  const [datos, setDatos] = useState<DatosDeRanking | null>(null);
  const [noCargo, setNoCargo] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<UsuarioPublico[]>([]);
  const [mandados, setMandados] = useState<Set<string>>(new Set());
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
  }, [alSalir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

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
        <FondoEspacial rango={datos.miRango} planeta={datos.miPlaneta} esquina="arriba-derecha" velo={0.68} />
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

        {(datos?.solicitudes ?? []).length > 0 && (
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
        )}

        {amigos.length > 1 ? (
          <View style={estilos.tarjeta}>
            {amigos.map((a, i) => (
              <View style={estilos.fila} key={a.id}>
                <Text style={[estilos.dato, { width: 20 }]}>{i + 1}</Text>
                {/* Acá va la Insignia de su rango. Ver arriba: sin SVG no hay
                    con qué dibujarla, y un reemplazo inventado sería otra. */}
                <Text style={estilos.nombre}>{a.id === miId ? T.social.yoEnLista(a.username) : a.username}</Text>
                <Text style={estilos.dato}>{a.racha_actual}</Text>
              </View>
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

        {(datos?.actividad ?? []).length > 0 && (
          <View style={estilos.seccion}>
            <Text style={estilos.rotulo}>{T.social.actividad}</Text>
            {datos!.actividad.map((a, i) => (
              <View style={estilos.fila} key={i}>
                <Avatar url={a.avatar} nombre={a.username} tam={28} />
                {a.foto && <Image source={{ uri: a.foto }} style={estilos.miniatura} />}
                <Text style={[estilos.nombre, { color: C.sub, fontSize: 14 }]}>
                  {T.social.registroEl(a.username, fechaLinda(a.fecha))}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={estilos.seccion}>
          <Text style={estilos.rotulo}>{T.social.buscarGente}</Text>
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
              <Text style={estilos.nombre}>{u.username}</Text>
              {mandados.has(u.id) ? (
                <Text style={estilos.dato}>{T.social.pedidoEnviado}</Text>
              ) : (
                <Pressable onPress={() => agregar(u.id)} hitSlop={8}>
                  <Text style={estilos.accion}>{T.social.agregar}</Text>
                </Pressable>
              )}
            </View>
          ))}
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
