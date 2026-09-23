import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { cargarMiPerfil, type DatosDePerfil } from '@compartido/perfil';
import { subirAvatar } from '@compartido/avatar';
import { planetaDeDia } from '@nucleo/rangos';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { prepararFoto } from './foto';
import Avatar from './Avatar';
import FondoEspacial from './FondoEspacial';
import FotosQueVen from './FotosQueVen';
import Insignia from './Insignia';
import Surgir from './Surgir';
import { C } from './colores';

/**
 * TU PERFIL: quién sos acá adentro, cómo te ven tus amigos, y quiénes son.
 *
 * ES LA PRIMERA PANTALLA APILADA de la app nativa, y por eso llegó recién con
 * el router: no es una pestaña, se entra DESDE otra pantalla y se vuelve. Con
 * el `useState` de antes habría sido una sexta pestaña o un estado más adentro
 * de Inicio, y las dos cosas son mentiras distintas sobre lo que es.
 *
 * LO QUE SE VE ES LO QUE VEN ELLOS (decisión del 19/9): las fotos que se
 * muestran son las COMPARTIDAS, las últimas nueve, con la misma cuenta que usa
 * el perfil de un amigo. Acá no se administran ni se ven todas: eso es el
 * Álbum. Si fueran todas, esta pantalla contestaría "qué tengo" en vez de
 * "qué se ve de mí", que es la única pregunta que justifica que exista.
 *
 * LA FOTO DE PERFIL SE RECORTA CON EL SISTEMA (`allowsEditing`), y eso es una
 * diferencia con la web a favor: allá hubo que escribir un recortador
 * (`RecorteCircular`) porque el navegador no tiene ninguno. Acá el recorte es
 * el de iOS, que la gente ya sabe usar.
 */
export default function PerfilPropio() {
  const router = useRouter();
  const [datos, setDatos] = useState<DatosDePerfil | null>(null);
  const [cargado, setCargado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [porQuitar, setPorQuitar] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    const { data: sesion } = await supabase.auth.getSession();
    const uid = sesion.session?.user?.id;
    if (!uid) return setCargado(true);
    const d = await cargarMiPerfil(supabase, uid);
    if (!d) setError(T.inicio.noCargo);
    setDatos(d);
    setCargado(true);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarFoto() {
    if (!datos) return;
    setError('');
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // El recorte cuadrado es del sistema: la foto de perfil se dibuja
        // redonda y lo que entra tiene que ser cuadrado o se deforma.
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        exif: false,
      });
      const a = r.canceled ? null : r.assets?.[0];
      if (!a) return;
      setSubiendo(true);
      const lista = await prepararFoto(a.uri, a.width, a.height);
      if (!lista.ok) throw new Error('no se pudo preparar');
      const subida = await subirAvatar(supabase, datos.perfil.id, lista.datos);
      if ('error' in subida) throw new Error(subida.error);
      setDatos({ ...datos, perfil: { ...datos.perfil, avatar_url: subida.url } as Perfil });
    } catch {
      setError(T.yo.noSePudoLaFoto);
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarAmigo(id: string) {
    const { error: err } = await supabase.rpc('eliminar_amigo', { p_otro: id });
    if (err) return setError(T.general.noSePudo);
    setPorQuitar(null);
    cargar();
  }

  if (!cargado) {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color={C.sub} />
      </View>
    );
  }

  if (!datos) {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.error}>{error || T.inicio.noCargo}</Text>
        <Pressable onPress={cargar}>
          <Text style={estilos.enlace}>{T.inicio.reintentar}</Text>
        </Pressable>
      </View>
    );
  }

  const { perfil, fotos, amigos } = datos;

  return (
    <View style={estilos.raiz}>
      <FondoEspacial
        rango={perfil.rango_actual}
        planeta={planetaDeDia(perfil.racha_actual)}
        esquina="abajo-derecha"
        velo={0.72}
      />
      <ScrollView contentContainerStyle={estilos.pantalla}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={estilos.volver}>
          <Text style={estilos.enlace}>{T.general.volver}</Text>
        </Pressable>

        <View style={estilos.cabecera}>
          <Pressable onPress={cambiarFoto} disabled={subiendo} accessibilityLabel={T.yo.cambiarFoto}>
            <Avatar url={perfil.avatar_url} nombre={perfil.username} tam={76} />
          </Pressable>
          <View style={estilos.identidad}>
            <Text style={estilos.nombre}>{perfil.username}</Text>
            <View style={estilos.meta}>
              <Insignia rango={perfil.rango_actual} tam={16} />
              <Text style={estilos.metaTexto}>
                {subiendo ? T.yo.subiendoFoto : T.yo.deRacha(perfil.racha_actual)}
              </Text>
            </View>
          </View>
        </View>

        {error !== '' && <Text style={estilos.error}>{error}</Text>}

        {/* LO QUE VEN TUS AMIGOS, con el MISMO componente que dibuja el
            perfil de un amigo. No es ahorro de código: esta pantalla promete
            "así te ven", y la única forma de que la promesa no se rompa es
            que sea literalmente el mismo dibujo. Con dos copias, la del dueño
            se mejora un día y la promesa pasa a ser falsa sin que nadie lo
            note. Lo cazó §135. */}
        <FotosQueVen fotos={fotos} />
        <Text style={estilos.nota}>{fotos.length > 0 ? T.yo.fotosPie : T.yo.sinFotos}</Text>

        <Text style={estilos.seccion}>
          {T.yo.amigos} {amigos.length > 0 ? amigos.length : ''}
        </Text>
        {amigos.length === 0 && <Text style={estilos.nota}>{T.yo.sinAmigos}</Text>}
        {amigos.map((a, i) => (
          <Surgir key={a.id} indice={i}>
            <View style={estilos.amigo}>
              <Avatar url={a.avatar_url} nombre={a.username} />
              <Text style={estilos.amigoNombre}>{a.username}</Text>
              {porQuitar === a.id ? (
                <>
                  <Pressable onPress={() => quitarAmigo(a.id)} hitSlop={8}>
                    <Text style={estilos.peligro}>{T.yo.eliminar}</Text>
                  </Pressable>
                  <Pressable onPress={() => setPorQuitar(null)} hitSlop={8}>
                    <Text style={estilos.apagada}>{T.yo.no}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => setPorQuitar(a.id)} hitSlop={8}>
                  <Text style={estilos.apagada}>{T.yo.quitar}</Text>
                </Pressable>
              )}
            </View>
          </Surgir>
        ))}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  // SIN FONDO PROPIO: el motor está detrás del stack (ver `app/_layout.tsx`).
  raiz: { flex: 1 },
  pantalla: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  volver: { paddingBottom: 10 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 26 },
  identidad: { flex: 1 },
  nombre: { color: C.tinta, fontSize: 22, fontWeight: '500' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  metaTexto: { color: C.sub, fontSize: 13 },
  seccion: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginTop: 34, marginBottom: 10 },
  amigo: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  amigoNombre: { color: C.tinta, fontSize: 15, flex: 1 },
  nota: { color: C.apagado, fontSize: 12, lineHeight: 17, marginTop: 10 },
  enlace: { color: C.sub, fontSize: 15 },
  apagada: { color: C.apagado, fontSize: 13 },
  peligro: { color: C.error, fontSize: 13 },
  error: { color: C.error, fontSize: 13, marginTop: 10 },
});
