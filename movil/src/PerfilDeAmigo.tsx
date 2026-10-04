import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { cargarPerfilDeAmigo, DIAS_VISIBLES, NO_SE_PUDO, type PerfilDeAmigo as Datos } from '@compartido/perfil';
import Medallas from './Medallas';
import { aceptarAmistad, pedirAmistad } from '@compartido/ranking';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { useRefrescoDeFirmadas } from '@compartido/useRefrescoDeFirmadas';
import { plataforma } from '@plataforma';
import AccionesDeUsuario from './AccionesDeUsuario';
import { DIAS_SEMANA, deISO, enDias, hoyISO, restarDias } from '@nucleo/fechas';
import { conComa } from '@nucleo/peso';
import { numeroDeRango, planetaDeDia } from '@nucleo/rangos';
import { T } from '@nucleo/textos';
import { supabase } from './supabase';
import { miId, quienSoy } from '@compartido/quienSoy';
import Avatar from './Avatar';
import FondoEspacial from './FondoEspacial';
import FotosQueVen from './FotosQueVen';
import Insignia from './Insignia';
import { C } from './colores';

/**
 * EL PERFIL DE OTRO: su racha, su semana y lo que comparte.
 *
 * EL FONDO ES EL DE ÉL, no el tuyo. Es la mitad de para qué se entra: ver en
 * qué se convirtió la persona que está arriba tuyo en el ranking. Un fondo
 * neutro haría que todos los perfiles se vieran iguales, que es justo lo que
 * la app decidió no hacer con los rangos.
 *
 * SIN AMISTAD NO SE VE NADA SUYO, y no porque lo esconda la pantalla: la base
 * no lo deja leer. Lo que queda es el nombre, el botón de agregar, y decir qué
 * se va a ver cuando acepte.
 *
 * NO SE VEN SUS DESCANSOS. La semana se dibuja sin ellos: qué días descansa es
 * configuración suya, no un hecho de su racha.
 *
 * LO QUE NO SE PUEDE HACER ACÁ, a propósito: nada. No se toca ninguna de sus
 * fotos, no se comenta, no hay "me gusta". Eliminar de amigos se hace desde tu
 * propio perfil, que es donde está la lista.
 */
export default function PerfilDeAmigo() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [dots, setDots] = useState<number | null>(null);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');
  const [noCargo, setNoCargo] = useState(false);
  const [accion, setAccion] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    // El id viene de la URL: si no es un uuid, ni se consulta. Interpolarlo en
    // un filtro con formato inválido solo da errores de PostgREST.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')) {
      return setCargado(true);
    }
    setNoCargo(false);
    const quien = await quienSoy(supabase);
    if (quien.estado !== 'con') {
      // Sin sesión lo resuelve la raíz. Sin poder preguntar, no es "no existe".
      setNoCargo(quien.estado === 'no-se');
      return setCargado(true);
    }
    const yo = quien.uid;
    // Tu propio perfil tiene su pantalla: entrar al tuyo por acá mostraría una
    // versión recortada de vos mismo.
    if (yo === id) return router.replace('/yo');
    const d = await cargarPerfilDeAmigo(supabase, yo, id);
    // Sin señal: se dice, con Reintentar, y lo que ya estaba en pantalla queda.
    if (d === NO_SE_PUDO) {
      setNoCargo(true);
      return setCargado(true);
    }
    if (!d) setError(T.social.noExiste);
    setDatos(d);
    setCargado(true);
    // El DOTS del amigo, número crudo. Sale de `ranking_fuerza`, que ya está
    // gateada a amigos aceptados (self + amigos): un no-amigo no aparece ahí, y
    // solo lo pedimos si esta persona ES amiga. Nunca expone su peso corporal,
    // solo el número, que los amigos ya ven en el ranking (§16.7).
    if (d?.esAmigo) {
      supabase.rpc('ranking_fuerza').then(({ data }) => {
        const fila = (data as { id: string; dots: number }[] | null)?.find((f) => f.id === id);
        setDots(fila && typeof fila.dots === 'number' ? fila.dots : null);
      });
    } else {
      setDots(null);
    }
  }, [id, router]);

  // Las fotos del perfil vencen a la hora: se vuelven a pedir antes de que se
  // rompan (ver `useRefrescoDeFirmadas`). Es lo que ve un amigo mirando tu perfil.
  const recargar = useRefrescoDeFirmadas(cargar, plataforma.ciclo.alCambiar);
  useEffect(() => {
    recargar();
  }, [recargar]);

  // Traba contra el doble-tap: sin esto, dos toques mandaban dos pedidos de
  // amistad a la misma persona.
  const mandarPedido = useEnVuelo(async () => {
    if (!datos) return;
    const yo = await miId(supabase);
    if (!yo) return;
    // La misma función que usa Ranking: la amistad se pide en un solo lugar.
    if (!(await pedirAmistad(supabase, yo, datos.usuario.id))) return setError(T.general.noSePudo);
    setDatos({ ...datos, pedidoPendiente: true });
  });

  const aceptarPedido = useEnVuelo(async () => {
    if (!datos?.pedidoRecibido) return;
    if (!(await aceptarAmistad(supabase, datos.pedidoRecibido))) return setError(T.general.noSePudo);
    cargar();
  });

  // LA SALIDA SE DIBUJA SIEMPRE, también mientras carga. La rama del error ya
  // la tenía; esta no, y una consulta que tarda encierra igual que una que
  // falla — con mala señal, tardar mucho es lo normal. Lo encontró el barrido
  // del 25/9 en el perfil propio, y esta pantalla tenía la mitad del problema.
  const salida = (
    <Pressable onPress={() => router.back()} hitSlop={8} style={estilos.volverSuelto}>
      <Text style={estilos.enlace}>{T.general.volver}</Text>
    </Pressable>
  );

  if (!cargado) {
    return (
      <View style={estilos.raiz}>
        {salida}
        <View style={estilos.centrado}>
          <ActivityIndicator color={C.sub} />
        </View>
      </View>
    );
  }

  if (!datos) {
    return (
      <View style={estilos.raiz}>
        {salida}
        <View style={estilos.centrado}>
          {/* El "Volver" que estaba acá abajo se fue arriba con el resto: una
              sola salida, en el mismo lugar en las tres ramas, en vez de una
              que se mueve según lo que haya pasado. */}
          <Text style={estilos.error}>{noCargo ? T.inicio.noCargo : error || T.social.noExiste}</Text>
          {noCargo && (
            <Pressable onPress={cargar} hitSlop={8} style={{ marginTop: 14 }}>
              <Text style={estilos.enlace}>{T.inicio.reintentar}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const { usuario, esAmigo, pedidoPendiente, pedidoRecibido, logs, fotos } = datos;
  const hoy = hoyISO();
  const semana = Array.from({ length: DIAS_VISIBLES }, (_, i) => {
    const fecha = restarDias(hoy, DIAS_VISIBLES - 1 - i);
    const log = logs.find((l) => l.fecha === fecha);
    return { fecha, entreno: !!log && !log.es_descanso, esHoy: fecha === hoy };
  });

  return (
    <View style={estilos.raiz}>
      <FondoEspacial
        rango={numeroDeRango(usuario.racha_actual)}
        planeta={planetaDeDia(usuario.racha_actual)}
        esquina="abajo-derecha"
        velo={0.72}
        // ES EL CUERPO DE ÉL: tu día de descanso no apaga su planeta. Ver
        // `ponerEstadoDelCuerpo` en `pedidoDeFondo.ts`.
        ajeno
      />
      <ScrollView contentContainerStyle={estilos.pantalla}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={estilos.volver}>
          <Text style={estilos.enlace}>{T.general.volver}</Text>
        </Pressable>

        <View style={estilos.cabecera}>
          <Avatar url={usuario.avatar_url} nombre={usuario.username} tam={52} />
          <View style={{ flex: 1 }}>
            {/* SUS MEDALLAS, al lado de su nombre y del mismo alto, igual que
                en tu perfil. Se pueden tocar: es la única forma de saber qué
                son, y acá no hay ningún botón con el que competir. */}
            <Medallas
              medallas={datos.medallas}
              tam={20}
              nombre={<Text style={estilos.nombre}>{usuario.username}</Text>}
            />
            <View style={estilos.meta}>
              <Insignia rango={numeroDeRango(usuario.racha_actual)} tam={16} />
              <Text style={estilos.metaTexto}>{T.stats.rachaDe(enDias(usuario.racha_actual))}</Text>
            </View>
            {esAmigo && dots !== null && (
              <Text style={estilos.dots}>
                <Text style={estilos.dotsNumero}>{conComa(String(dots))}</Text> DOTS
              </Text>
            )}
          </View>
        </View>

        {error !== '' && <Text style={estilos.error}>{error}</Text>}

        {esAmigo ? (
          <>
            <View style={estilos.tira}>
              {semana.map((d) => (
                <View key={d.fecha} style={estilos.tiraDia}>
                  <View style={[estilos.punto, d.entreno ? estilos.lleno : estilos.vacio, d.esHoy && estilos.puntoHoy]} />
                  <Text style={estilos.letra}>{DIAS_SEMANA[deISO(d.fecha).getDay()]}</Text>
                </View>
              ))}
            </View>
            <FotosQueVen fotos={fotos} />
          </>
        ) : (
          <>
            {pedidoRecibido ? (
              <Pressable style={estilos.solido} onPress={() => aceptarPedido()}>
                <Text style={estilos.solidoTexto}>{T.social.aceptar}</Text>
              </Pressable>
            ) : pedidoPendiente ? (
              <View style={estilos.boton}>
                <Text style={estilos.botonTexto}>{T.social.pedidoDeAmistad}</Text>
              </View>
            ) : (
              <Pressable style={estilos.solido} onPress={() => mandarPedido()}>
                <Text style={estilos.solidoTexto}>{T.social.agregar}</Text>
              </Pressable>
            )}
            <Text style={estilos.nota}>{T.social.cuandoSeanAmigos}</Text>
          </>
        )}

        {/* Denunciar o bloquear: al alcance en el perfil de cualquiera, sea
            amigo o no. Bloquear también sirve para frenar a alguien que todavía
            no es amigo pero insiste con solicitudes. */}
        <Pressable onPress={() => setAccion(true)} hitSlop={8} style={estilos.reportar}>
          <Text style={estilos.reportarTexto}>{T.social.denunciarOBloquear}</Text>
        </Pressable>
      </ScrollView>

      <AccionesDeUsuario
        usuario={accion ? { id: usuario.id, username: usuario.username } : null}
        onCerrar={() => setAccion(false)}
        onBloqueado={() => router.back()}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  // Sin fondo propio: el motor está detrás del stack (ver `app/_layout.tsx`).
  raiz: { flex: 1 },
  pantalla: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  volver: { paddingBottom: 10 },
  // La misma salida cuando no hay `ScrollView` que le ponga el margen de
  // arriba. Los 60 son el `paddingTop` de `pantalla`, para que no baile al
  // llegar los datos.
  volverSuelto: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 10 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 22 },
  nombre: { color: C.tinta, fontSize: 18, fontWeight: '500' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  metaTexto: { color: C.sub, fontSize: 13 },
  dots: { color: C.sub, fontSize: 12, letterSpacing: 1, marginTop: 4 },
  dotsNumero: { color: C.tinta, fontSize: 15, fontVariant: ['tabular-nums'] },
  tira: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
  tiraDia: { alignItems: 'center', gap: 7 },
  punto: { width: 26, height: 26, borderRadius: 13 },
  lleno: { backgroundColor: '#7e8ca8' },
  vacio: { borderWidth: 1, borderColor: '#2a3040' },
  puntoHoy: { borderWidth: 1, borderColor: C.claro },
  letra: { color: '#4a5163', fontSize: 11 },
  solido: { backgroundColor: C.claro, borderRadius: 2, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  solidoTexto: { color: C.fondo, fontSize: 15, fontWeight: '600' },
  boton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  botonTexto: { color: C.sub, fontSize: 14 },
  nota: { color: C.apagado, fontSize: 13, lineHeight: 19, marginTop: 20 },
  enlace: { color: C.sub, fontSize: 15 },
  error: { color: C.error, fontSize: 13, marginTop: 10 },
  reportar: { marginTop: 40, alignItems: 'center', paddingVertical: 8 },
  reportarTexto: { color: C.apagado, fontSize: 13 },
});
