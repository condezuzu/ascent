import { useCallback, useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { supabase } from './supabase';
import { SURGIR_MS } from '@nucleo/animacion';
import { CURVA } from '@nucleo/deslizar';
import Surgir from './Surgir';
import { T } from '@nucleo/textos';
import { fechaLinda } from '@nucleo/fechas';
import { cambiarVisibilidad, cargarAlbum, porMes, quitarFoto, type DatosDeAlbum } from '@compartido/album';
import FondoEspacial from './FondoEspacial';
import { C } from './colores';
import { useRecargarAlVolver } from './irAPestana';

/**
 * ÁLBUM — tanda 4.
 *
 * Las consultas son las MISMAS que las de la web (`compartido/album.ts`).
 *
 * NO HAY CÁMARA NI FOTOTECA ACÁ, tampoco en la web: el álbum muestra las
 * fotos del día, que entran al registrar el día (`RegistrarDia` + `foto.ts`).
 * Esa parte —elegir de la fototeca, sacar con la cámara, los permisos de iOS,
 * una foto HEIC y su orientación— NO está probada: en :8090 el selector de
 * `expo-image-picker` es un `<input type=file>`. Queda para el iPhone.
 *
 * SE PASA CON EL DEDO (25/9). Era lo único que faltaba respecto de la web y
 * era, además, lo único que uno intenta: en un visor de fotos a pantalla
 * completa nadie busca una flecha, arrastra. Las flechas se quedan —sirven
 * para el lector de pantalla y para saber que hay más de una— pero ya no son
 * el camino.
 */
export default function Album({ alSalir }: { alSalir: () => void }) {
  const [datos, setDatos] = useState<DatosDeAlbum | null>(null);
  const [cargado, setCargado] = useState(false);
  const [noCargo, setNoCargo] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return alSalir();
    const d = await cargarAlbum(supabase, uid).catch(() => null);
    setNoCargo(!d);
    if (d) setDatos(d);
    setCargado(true);
  }, [alSalir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Y de nuevo al volver a esta pestaña: ahora se queda montada.
  useRecargarAlVolver('album', cargar);

  useEffect(() => setConfirmando(false), [abierta]);

  // ---- PASAR LA FOTO CON EL DEDO ----
  //
  // EL GESTO SE ARMA UNA SOLA VEZ y lee el estado por REFERENCIA. Un
  // `PanResponder` guarda las funciones que tenía cuando se creó: armado con el
  // estado de cada dibujo, el primer arrastre después de abrir la segunda foto
  // usaría el índice de la primera. Es la misma trampa que las teclas de
  // volumen y la misma solución.
  const abiertaRef = useRef(abierta);
  abiertaRef.current = abierta;
  const cuantasRef = useRef(0);
  const desliz = useRef(new Animated.Value(0)).current;

  const saltar = useCallback(
    (d: 1 | -1) => {
      // Sale por su lado y entra por el otro: sin esto, la foto nueva aparece
      // corrida y vuelve al centro, que se lee al revés del gesto.
      Animated.timing(desliz, {
        toValue: -d * 600,
        duration: 140,
        easing: Easing.bezier(...CURVA),
        useNativeDriver: true,
      }).start(() => {
        setAbierta((i) => (i === null ? null : i + d));
        desliz.setValue(0);
      });
    },
    [desliz]
  );

  const volverAlCentro = useCallback(() => {
    Animated.timing(desliz, {
      toValue: 0,
      duration: 160,
      easing: Easing.bezier(...CURVA),
      useNativeDriver: true,
    }).start();
  }, [desliz]);

  const gesto = useRef(
    PanResponder.create({
      // MÁS HORIZONTAL QUE VERTICAL, y con ocho píxeles de margen: un toque para
      // cerrar mueve el dedo uno o dos, y sin el margen cada toque arrancaría un
      // arrastre.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => desliz.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        const i = abiertaRef.current;
        const total = cuantasRef.current;
        // UN QUINTO DE PANTALLA O UN TIRÓN RÁPIDO. Solo por distancia, un
        // movimiento corto y decidido no pasa; solo por velocidad, un arrastre
        // lento y largo tampoco.
        const fuerte = Math.abs(g.dx) > 70 || Math.abs(g.vx) > 0.4;
        if (i === null || !fuerte) return volverAlCentro();
        if (g.dx < 0 && i < total - 1) return saltar(1);
        if (g.dx > 0 && i > 0) return saltar(-1);
        // En la primera o en la última no hay adónde ir: vuelve, y ese rebote
        // es la respuesta.
        volverAlCentro();
      },
      onPanResponderTerminate: () => volverAlCentro(),
    })
  ).current;

  const celdas = datos?.celdas ?? [];
  const meses = porMes(celdas);
  // Tres por fila, todas del mismo tamaño: el criterio de la web (una grilla
  // pareja, no un mosaico que con una sola foto la vuelve gigante).
  const HUECO = 4;
  const lado = Math.floor((width - 48 - HUECO * 2) / 3);
  const foto = abierta !== null ? celdas[abierta] : null;
  cuantasRef.current = celdas.length;

  async function alternar() {
    if (!foto) return;
    const nueva = foto.visibilidad === 'privada' ? 'amigos' : 'privada';
    if (!(await cambiarVisibilidad(supabase, foto.id, nueva))) return setError(T.general.falloVisibilidad);
    setDatos((d) =>
      d ? { ...d, celdas: d.celdas.map((x) => (x.id === foto.id ? { ...x, visibilidad: nueva } : x)) } : d
    );
  }

  async function quitar() {
    if (!foto) return;
    setError('');
    if (!(await quitarFoto(supabase, foto.id, foto.ruta))) return setError(T.album.noSeQuito);
    setDatos((d) => {
      if (!d) return d;
      const quedan = d.celdas.filter((x) => x.id !== foto.id);
      setAbierta((i) => (quedan.length === 0 || i === null ? null : Math.min(i, quedan.length - 1)));
      return { ...d, celdas: quedan };
    });
  }

  return (
    <View style={estilos.raiz}>
      {datos && <FondoEspacial rango={datos.miRango} planeta={datos.miPlaneta} soloEstrellas velo={0.72} />}
      <ScrollView contentContainerStyle={estilos.pantalla}>
        <Text style={estilos.titulo}>{T.album.titulo}</Text>
        {!!error && <Text style={estilos.error}>{error}</Text>}
        {!cargado && <ActivityIndicator color={C.sub} style={{ marginTop: 24 }} />}

        {noCargo ? (
          <View style={estilos.tarjeta}>
            <Text style={estilos.texto}>{T.inicio.noCargo}</Text>
            <Pressable style={estilos.botonFantasma} onPress={cargar}>
              <Text style={estilos.textoBoton}>{T.inicio.reintentar}</Text>
            </Pressable>
          </View>
        ) : celdas.length > 0 ? (
          meses.map((m) => (
            <View key={m.clave} style={{ marginBottom: 20 }}>
              <Text style={estilos.rotulo}>{m.titulo}</Text>
              <View style={[estilos.grilla, { gap: HUECO }]}>
                {m.fotos.map((c, j) => (
                  // ENTRAN EN ORDEN, NO TODAS DE GOLPE (24/9). En la web cada
                  // celda lleva su `--i` y entra escalonada; acá aparecían
                  // todas juntas, que es lo que el humano notó USANDO la app.
                  // El escalón es el mismo de `nucleo/animacion.ts`, que ya
                  // usa Ranking: una lista de fotos que entra a otro ritmo que
                  // una de amigos se lee como dos apps.
                  //
                  // EL ÍNDICE ES EL DE LA FOTO EN EL ÁLBUM ENTERO y no el del
                  // mes: con el del mes, cada mes volvería a empezar el
                  // escalón desde cero y la segunda tanda entraría antes que
                  // el final de la primera.
                  <Surgir key={c.id} indice={m.desde + j}>
                    <Pressable
                      onPress={() => setAbierta(m.desde + j)}
                      accessibilityLabel={fechaLinda(c.fecha)}
                      style={[estilos.celda, { width: lado, height: lado }]}
                    >
                      {!!c.url && <Foto url={c.url} lado={lado} />}
                      {/* Un punto y nada más: quién ve la foto, de un vistazo. */}
                      {c.visibilidad === 'amigos' && <View style={estilos.punto} />}
                    </Pressable>
                  </Surgir>
                ))}
              </View>
            </View>
          ))
        ) : (
          cargado && (
            <View style={estilos.vacio}>
              <Text style={estilos.vacioTexto}>{T.album.vacioTitulo}</Text>
              <Text style={estilos.vacioTexto}>{T.album.vacioPie}</Text>
            </View>
          )
        )}
      </ScrollView>

      <Modal visible={!!foto} transparent animationType="fade" onRequestClose={() => setAbierta(null)}>
        {foto && (
          <View style={estilos.visor}>
            {/* El fondo cierra; la foto y la barra de abajo no. */}
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setAbierta(null)} />
            <Pressable style={estilos.cerrar} onPress={() => setAbierta(null)} accessibilityLabel={T.general.cerrar} hitSlop={12}>
              <Text style={estilos.cerrarTexto}>×</Text>
            </Pressable>

            {/* LA FOTO ES LA QUE RECIBE EL ARRASTRE, y va sola en su capa: si
                el gesto viviera en el fondo, competiría con el toque que
                cierra. */}
            <Animated.View {...gesto.panHandlers} style={{ transform: [{ translateX: desliz }] }}>
              <Image source={{ uri: foto.url }} style={{ width, height: width }} resizeMode="contain" />
            </Animated.View>

            <View style={estilos.pasos}>
              {abierta! > 0 ? (
                <Pressable onPress={() => setAbierta((i) => (i ?? 0) - 1)} accessibilityLabel={T.album.anterior} hitSlop={12}>
                  <Text style={estilos.paso}>‹</Text>
                </Pressable>
              ) : (
                <View />
              )}
              {abierta! < celdas.length - 1 ? (
                <Pressable onPress={() => setAbierta((i) => (i ?? 0) + 1)} accessibilityLabel={T.album.siguiente} hitSlop={12}>
                  <Text style={estilos.paso}>›</Text>
                </Pressable>
              ) : (
                <View />
              )}
            </View>

            <View style={estilos.pie}>
              {/* La fecha manda y el planeta la acompaña. */}
              <View style={estilos.cuando}>
                <Text style={estilos.fecha}>{fechaLinda(foto.fecha)}</Text>
                {!!foto.planeta && <Text style={estilos.planeta}>{foto.planeta}</Text>}
                {foto.esSubida && <Text style={estilos.planeta}>{T.album.deSubida}</Text>}
              </View>
              <View style={estilos.acciones}>
                <Pressable
                  onPress={alternar}
                  style={[estilos.pastilla, foto.visibilidad === 'amigos' && estilos.pastillaPrendida]}
                >
                  <Text style={[estilos.pastillaTexto, foto.visibilidad === 'amigos' && { color: C.fondo }]}>
                    {foto.visibilidad === 'privada' ? T.album.soloVos : T.album.amigos}
                  </Text>
                </Pressable>
                {/* LOS DOS SON BOTONES Y SE VE (25/9). *"Los dos botones abajo
                    a la derecha del visor no parecen botones, parecen frases
                    chicas."* Y el de quitar lo era literalmente: texto suelto,
                    del mismo tamaño y color que la fecha de al lado. El de
                    visibilidad ya tenía píldora; ahora los dos la tienen, la
                    misma, y lo único que los diferencia es lo que dicen.

                    QUITAR VA EN ROJO Y SOLO AL CONFIRMAR: el primer toque
                    pregunta, y hasta ahí no hay nada que avisar. */}
                {confirmando ? (
                  <View style={estilos.confirmar}>
                    <Pressable style={[estilos.pastilla, estilos.pastillaRoja]} onPress={quitar}>
                      <Text style={[estilos.pastillaTexto, estilos.textoRojo]}>{T.album.quitarSi}</Text>
                    </Pressable>
                    <Pressable style={estilos.pastilla} onPress={() => setConfirmando(false)}>
                      <Text style={estilos.pastillaTexto}>{T.album.no}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={estilos.pastilla} onPress={() => setConfirmando(true)}>
                    <Text style={estilos.pastillaTexto}>{T.album.quitarFoto}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

/**
 * UNA FOTO QUE APARECE, no que salta.
 *
 * POR QUÉ NO ALCANZABA CON `Surgir` (23/9). La celda ya entraba escalonada,
 * pero entraba VACÍA: la animación dura poco más de un segundo y las fotos
 * llegan de la red después. O sea que lo que se veía era un escalón de
 * cuadrados oscuros y, un rato más tarde, las fotos apareciendo de golpe —
 * que desde afuera es exactamente "el Álbum no tiene animación".
 *
 * Ahora la foto se funde cuando termina de cargar. Con la caché llena entra
 * junto con la celda y se lee como un solo movimiento; la primera vez entra
 * cuando puede, que es lo único honesto con una imagen que viaja.
 */
function Foto({ url, lado }: { url: string; lado: number }) {
  const opacidad = useRef(new Animated.Value(0)).current;
  return (
    <Animated.Image
      source={{ uri: url }}
      style={{ width: lado, height: lado, opacity: opacidad }}
      onLoad={() =>
        Animated.timing(opacidad, {
          toValue: 1,
          duration: SURGIR_MS,
          easing: Easing.bezier(...CURVA),
          useNativeDriver: true,
        }).start()
      }
    />
  );
}

const estilos = StyleSheet.create({
  // Transparente: el fondo lo dibuja `FondoRaiz`.
  raiz: { flex: 1 },
  pantalla: { flexGrow: 1, padding: 24, paddingTop: 64, paddingBottom: 40 },
  titulo: { color: C.tinta, fontSize: 22, marginBottom: 20 },
  error: { color: C.error, fontSize: 14, marginBottom: 12 },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: { backgroundColor: C.hoja, borderRadius: 6, overflow: 'hidden' },
  punto: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.claro,
  },
  tarjeta: {
    backgroundColor: 'rgba(11,13,19,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    borderRadius: 14,
    padding: 14,
  },
  texto: { color: C.sub, fontSize: 14 },
  botonFantasma: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  textoBoton: { color: C.tinta, fontSize: 14 },
  vacio: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  vacioTexto: { color: C.sub, fontSize: 14, textAlign: 'center' },
  visor: { flex: 1, backgroundColor: 'rgba(5,6,10,0.96)', justifyContent: 'center' },
  cerrar: { position: 'absolute', top: 56, right: 20, zIndex: 2 },
  cerrarTexto: { color: C.tinta, fontSize: 32, lineHeight: 34 },
  pasos: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paso: { color: C.tinta, fontSize: 40, paddingHorizontal: 8 },
  pie: { position: 'absolute', left: 24, right: 24, bottom: 48, gap: 14 },
  cuando: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  fecha: { color: C.tinta, fontSize: 16 },
  planeta: { color: C.sub, fontSize: 13 },
  acciones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pastilla: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineaFuerte,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pastillaPrendida: { backgroundColor: C.claro, borderColor: C.claro },
  pastillaRoja: { borderColor: C.error },
  textoRojo: { color: C.error },
  pastillaTexto: { color: C.tinta, fontSize: 14 },
  confirmar: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
