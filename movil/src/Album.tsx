import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
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
import { plataforma } from '@plataforma';
import { supabase } from './supabase';
import { quienSoy } from '@compartido/quienSoy';
import { SURGIR_MS } from '@nucleo/animacion';
import { CURVA } from '@nucleo/deslizar';
import Surgir from './Surgir';
import { T } from '@nucleo/textos';
import { fechaCorta, fechaLinda } from '@nucleo/fechas';
import { cambiarVisibilidad, cargarAlbum, porMes, quitarFoto, type DatosDeAlbum } from '@compartido/album';
import { primeraYUltima, resumenDelMes } from '@nucleo/album';
import { paletaDe } from '@nucleo/paletas';
import FondoEspacial from './FondoEspacial';
import { C, conAlfa } from './colores';
import { useRecargarAlVolver } from './irAPestana';
import { bloquearDeslizarPestanas, desbloquearDeslizarPestanas } from './gestoDePestanas';
import { useEnVuelo } from '@compartido/useEnVuelo';
import { useRefrescoDeFirmadas } from '@compartido/useRefrescoDeFirmadas';
import { eventos } from '@compartido/eventos';
import { FOTOS_CAMBIO } from '@compartido/foto';
import { DIA_CAMBIO } from '@compartido/gimnasio';
import { completarMiniaturas } from './miniaturas';

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
    const yo = await quienSoy(supabase);
    if (yo.estado === 'sin') return alSalir();
    // No poder preguntar quién soy es no haber podido cargar: cartel y Reintentar.
    const d = yo.estado === 'con' ? await cargarAlbum(supabase, yo.uid).catch(() => null) : null;
    setNoCargo(!d);
    if (d) setDatos(d);
    setCargado(true);
    // Las miniaturas que falten las hace este teléfono, por atrás: ver
    // `completarMiniaturas`. Se ven en la apertura siguiente.
    if (d) void completarMiniaturas(d.celdas);
  }, [alSalir]);

  // Las URL firmadas vencen a la hora: se vuelven a pedir antes de que se rompan,
  // al volver al frente y con un chequeo periódico (ver `useRefrescoDeFirmadas`).
  const recargar = useRefrescoDeFirmadas(cargar, plataforma.ciclo.alCambiar);
  useEffect(() => {
    recargar();
  }, [recargar]);

  // AL VOLVER A ESTA PESTAÑA, SOLO SI ALGO CAMBIÓ (8/10). Se recargaba siempre,
  // y cada recarga firma enlaces nuevos: el teléfono guarda las imágenes por
  // enlace, así que volver a la pestaña era bajar todas las fotos otra vez.
  // Ahora se recarga si se sumó una foto o se tocó un día; el vencimiento de
  // los enlaces lo cuida `useRefrescoDeFirmadas`, y quitar o cambiar una foto
  // acá adentro ya actualiza lo que se ve.
  const cambioAlgo = useRef(false);
  useEffect(() => {
    const marcar = () => {
      cambioAlgo.current = true;
    };
    const dejarFotos = eventos.escuchar(FOTOS_CAMBIO, marcar);
    const dejarDias = eventos.escuchar(DIA_CAMBIO, marcar);
    return () => {
      dejarFotos();
      dejarDias();
    };
  }, []);
  const recargarSiCambio = useCallback(() => {
    if (!cambioAlgo.current) return;
    cambioAlgo.current = false;
    recargar();
  }, [recargar]);
  useRecargarAlVolver('album', recargarSiCambio);

  // MIENTRAS LA FOTO ESTÁ ABIERTA, LAS PESTAÑAS NO DESLIZAN (27/9): así el
  // arrastre para pasar de foto es de la foto, y no se escapa a otra pestaña.
  // Ver `gestoDePestanas.ts`. (La hoja es un Modal, pero el candado no cuesta
  // nada y cubre cualquier borde.)
  useEffect(() => {
    if (abierta === null) return;
    bloquearDeslizarPestanas();
    return () => desbloquearDeslizarPestanas();
  }, [abierta]);

  // PRECARGAR LAS QUE SIGUEN A LAS VECINAS. La anterior y la siguiente ya están
  // DIBUJADAS al lado (ver la tira, más abajo) y bajan solas; acá se adelantan
  // las de dos lugares, para que al pasar la vecina nueva ya esté. No bloquea
  // nada y si falla (sin señal) la foto se baja igual cuando llega su turno.
  useEffect(() => {
    if (abierta === null) return;
    const cs = datos?.celdas ?? [];
    for (const j of [abierta - 2, abierta + 2]) {
      const u = cs[j]?.url;
      if (u) Image.prefetch(u).catch(() => {});
    }
  }, [abierta, datos]);

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

  // LA TIRA (8/10). El visor tenía UNA imagen: al soltar la animaba hacia
  // afuera y, al terminar, cambiaba la foto y volvía la posición al centro.
  // Eran dos relojes: la posición volvía al instante y la foto nueva llegaba un
  // dibujado después (y además tenía que decodificarse), así que en el medio se
  // veía la ANTERIOR de nuevo en el centro. Es el titileo de las pestañas.
  //
  // Ahora las fotos están en una tira, cada una en su lugar fijo (su índice por
  // el ancho), y lo único que se mueve es la tira: `base` dice en qué foto está
  // parada y `desliz` cuánto la corre el dedo. Al pasar, `base` avanza un ancho
  // y `desliz` vuelve a cero en el mismo instante: la suma no cambia, no se
  // mueve nada, y la foto que queda en el centro es la vecina que YA estaba
  // dibujada. Qué índice está abierto se actualiza después y no mueve nada.
  const base = useRef(new Animated.Value(0)).current;
  const corrimiento = useMemo(() => Animated.add(base, desliz), [base, desliz]);
  const anchoRef = useRef(width);
  anchoRef.current = width;
  // Abrir, cerrar, las flechas, quitar una foto o girar el teléfono: la tira se
  // para en la foto abierta antes de pintarse.
  useLayoutEffect(() => {
    if (abierta === null) return;
    base.setValue(-abierta * width);
    desliz.setValue(0);
  }, [abierta, width, base, desliz]);

  const saltar = useCallback(
    (d: 1 | -1) => {
      Animated.timing(desliz, {
        toValue: -d * anchoRef.current,
        duration: 180,
        easing: Easing.bezier(...CURVA),
        useNativeDriver: true,
      }).start(() => {
        const i = abiertaRef.current;
        if (i === null) return;
        // Las dos juntas, y ANTES de avisarle a React: ver arriba.
        base.setValue(-(i + d) * anchoRef.current);
        desliz.setValue(0);
        setAbierta(i + d);
      });
    },
    [base, desliz]
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
      // ARRANCA EL RESPONDER EN EL TOUCH-DOWN (bug del iPhone, 29/9). Adentro de un
      // <Modal> de iOS, un PanResponder que SOLO tiene `onMoveShouldSet...` nunca
      // se consulta en el move: el gesto quedaba muerto en el teléfono aunque
      // anduviera en la web (donde se construyó y probó). Con `onStartShouldSet`
      // la capa entra en la cadena de responders al tocar, y ahí sí se le pregunta
      // por el movimiento. La foto no tiene toque propio, así que tomar el
      // responder acá no le saca nada a nadie; el toque corto cierra (abajo).
      onStartShouldSetPanResponder: () => true,
      // MÁS HORIZONTAL QUE VERTICAL, con ocho píxeles de margen. La variante de
      // CAPTURA además le gana a los Pressable hermanos (flechas, cerrar) cuando
      // el gesto ya es claramente un arrastre horizontal.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => desliz.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        const i = abiertaRef.current;
        const total = cuantasRef.current;
        // UN TOQUE (casi sin desplazamiento) CIERRA. El fondo dejó de ser un
        // Pressable aparte —competía por el touch y era parte de por qué el gesto
        // no agarraba en el teléfono—; ahora la capa del gesto es una sola y el
        // toque para cerrar se resuelve acá.
        if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) return setAbierta(null);
        // UN QUINTO DE PANTALLA O UN TIRÓN RÁPIDO. Solo por distancia, un
        // movimiento corto y decidido no pasa; solo por velocidad, un arrastre
        // lento y largo tampoco. 45px o un envión suave ya pasan de foto.
        const fuerte = Math.abs(g.dx) > 45 || Math.abs(g.vx) > 0.25;
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

  // EL MARCO SIENTE EL RANGO (4.2): el borde de la foto abierta se tiñe apenas
  // con el color del rango —a un 45% de alfa, para que se sienta y no grite—. El
  // rango ya vive acá; escribirlo además sería de más (por eso el número NO va
  // en la foto, 4.3).
  const acentoRango = datos ? paletaDe(datos.miRango, datos.miPlaneta).principal : C.linea;

  // EL "¿QUITAR?" SE DESARMA CUANDO CAMBIA LA FOTO (su id), NO EL ÍNDICE (29/9).
  // Al borrar una del medio, el índice queda igual pero pasás a la de al lado;
  // con el reset atado al índice, el "sí" quedaba armado apuntando a OTRA foto y
  // un segundo toque borraba la equivocada. La web ya lo ataba al id (VisorFoto).
  useEffect(() => setConfirmando(false), [foto?.id]);

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
  // Traba síncrona contra el doble-tap: quitar ESCRIBE y borra para siempre, y el
  // segundo toque del rebote no puede colarse (ver `useEnVuelo`).
  const quitarGuardado = useEnVuelo(quitar);

  return (
    <View style={estilos.raiz}>
      {datos && <FondoEspacial rango={datos.miRango} planeta={datos.miPlaneta} velo={0.72} />}
      <ScrollView contentContainerStyle={estilos.pantalla}>
        <Text style={estilos.titulo}>{T.album.titulo}</Text>
        {!!error && <Text style={estilos.error}>{error}</Text>}
        {!cargado && <ActivityIndicator color={C.sub} style={{ marginTop: 24 }} />}

        {noCargo && !datos ? (
          <View style={estilos.tarjeta}>
            <Text style={estilos.texto}>{T.inicio.noCargo}</Text>
            <Pressable style={estilos.botonFantasma} onPress={cargar}>
              <Text style={estilos.textoBoton}>{T.inicio.reintentar}</Text>
            </Pressable>
          </View>
        ) : celdas.length > 0 ? (
          meses.map((m) => {
            const cuenta = resumenDelMes(m.fotos);
            const par = primeraYUltima(m.fotos);
            return (
            <View key={m.clave} style={{ marginBottom: 20 }}>
              {/* EL ENCABEZADO DICE CUÁNTO FUISTE (25/9). Era solo el mes. Las
                  fotos ya sabían la respuesta —una por día entrenado— y nadie
                  se la estaba preguntando. */}
              <View style={estilos.cabezaMes}>
                <Text style={estilos.rotulo}>{m.titulo}</Text>
                <Text style={estilos.cuentaMes}>{T.album.cuentaDelMes(cuenta.fotos, cuenta.dias)}</Text>
              </View>

              {/* LA COMPARACIÓN: la primera del mes y la última, lado a lado.
                  Es lo que uno hace a mano con las fotos de gimnasio, y es lo
                  único que una grilla no puede mostrar. Solo si hay dos de días
                  DISTINTOS: comparar una foto con sí misma no es comparar. */}
              {par && (
                <View style={estilos.comparar}>
                  {([par.primera, par.ultima] as const).map((c, i) => (
                    <Pressable
                      key={c.id}
                      style={estilos.mitad}
                      onPress={() => setAbierta(celdas.findIndex((x) => x.id === c.id))}
                      accessibilityLabel={fechaLinda(c.fecha)}
                    >
                      {!!(c.miniatura || c.url) && (
                        <Image source={{ uri: c.miniatura || c.url }} style={estilos.mitadFoto} resizeMode="cover" />
                      )}
                      <Text style={estilos.mitadCuando}>
                        {i === 0 ? T.album.laPrimera : T.album.laUltima} · {fechaCorta(c.fecha)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

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
                      {/* LA MINIATURA, no la entera (8/10): la celda mide un
                          tercio de pantalla y bajaba la foto de 1600 px. La
                          entera queda de respaldo para la que todavía no tiene. */}
                      {!!(c.miniatura || c.url) && <Foto url={c.miniatura || c.url} lado={lado} />}
                      {/* Un punto y nada más: quién ve la foto, de un vistazo. */}
                      {c.visibilidad === 'amigos' && <View style={estilos.punto} />}
                    </Pressable>
                  </Surgir>
                ))}
              </View>
            </View>
            );
          })
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
            {/* UNA SOLA CAPA PARA EL GESTO, a pantalla completa, con la foto
                centrada adentro (29/9). Antes el fondo era un Pressable aparte
                que cerraba al tocar: competía por el touch y —adentro del Modal
                de iOS— dejaba el gesto de deslizar MUERTO en el teléfono (andaba
                solo en la web). Ahora la capa es una: el toque corto cierra
                (en `onPanResponderRelease`) y el arrastre pasa de foto. El
                encabezado y las flechas van DESPUÉS, así quedan por encima y
                sus toques siguen andando.

                EL MARCO (25/9): un borde fino, teñido apenas por el rango (4.2),
                para que una foto vertical no deje dos huecos sin forma. */}
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: corrimiento }] }]} {...gesto.panHandlers}>
              {/* La abierta y sus dos vecinas, cada una en su lugar de la tira
                  y con su id: al pasar, la vecina es la MISMA imagen, ya
                  bajada, que queda en el centro. */}
              {[abierta! - 1, abierta!, abierta! + 1].map((j) => {
                const c = celdas[j];
                if (!c) return null;
                return (
                  <View key={c.id} style={[estilos.capaGesto, { position: 'absolute', top: 0, bottom: 0, left: j * width, width }]}>
                    <View style={[estilos.marco, { borderColor: conAlfa(acentoRango, 0.45) }]}>
                      <Image source={{ uri: c.url }} style={{ width: width - 32, height: width - 32 }} resizeMode="contain" />
                    </View>
                  </View>
                );
              })}
            </Animated.View>

            {/* LA FECHA ARRIBA, al lado de la cruz, en su propio renglón. Se
                dibuja después de la capa del gesto: queda por encima. */}
            <View style={estilos.encabezado} pointerEvents="box-none">
              <View style={estilos.cuando}>
                <Text style={estilos.fecha}>{fechaLinda(foto.fecha)}</Text>
                {/* EL DÍA DE RACHA (6.4): "día 41" — la foto pasa de suelta a
                    registro. Va al lado de la fecha, no sobre la imagen, para no
                    ensuciarla. El rango NO se escribe: vive en el color del marco. */}
                {foto.dia != null && <Text style={estilos.diaDeRacha}>{T.album.diaDeRacha(foto.dia)}</Text>}
                {!!foto.planeta && <Text style={estilos.planeta}>{foto.planeta}</Text>}
                {foto.esSubida && <Text style={estilos.planeta}>{T.album.deSubida}</Text>}
              </View>
              <Pressable onPress={() => setAbierta(null)} accessibilityLabel={T.general.cerrar} hitSlop={12}>
                <Text style={estilos.cerrarTexto}>×</Text>
              </Pressable>
            </View>

            {/* `box-none` ES LO QUE HACÍA QUE NO SE PUDIERA DESLIZAR (25/9).
                Esta barra cruza la pantalla entera a la altura del medio —que
                es justo por donde uno arrastra— y, sin esto, se comía el toque
                antes de que llegara a la foto. El gesto estaba bien escrito y
                no lo recibía nunca. Con `box-none` la vista deja pasar todo
                menos lo que tocan sus hijos, o sea las dos flechas. */}
            <View style={estilos.pasos} pointerEvents="box-none">
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
                    <Pressable style={[estilos.pastilla, estilos.pastillaRoja]} onPress={() => quitarGuardado()}>
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
  cabezaMes: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  rotulo: { color: C.sub, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  cuentaMes: { color: C.apagado, fontSize: 11 },
  // LA COMPARACION: dos mitades iguales, con la fecha debajo de cada una.
  comparar: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  mitad: { flex: 1 },
  mitadFoto: { width: '100%', aspectRatio: 1, borderRadius: 6, backgroundColor: C.hoja },
  mitadCuando: { color: C.apagado, fontSize: 10, marginTop: 4, textAlign: 'center' },
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
  // OPACO, no al 96 % (25/9). Ese 4 % de más no dejaba pasar atmósfera: dejaba
  // pasar EL ÁLBUM —el título, el mes, las miniaturas—, que se veía de fantasma
  // detrás de la foto abierta y se lee como que algo quedó a medio dibujar. Lo
  // único que tiene que competir con una foto es la foto.
  visor: { flex: 1, backgroundColor: C.fondo, justifyContent: 'center' },
  // El encabezado: la fecha a la izquierda y la cruz a la derecha.
  encabezado: {
    position: 'absolute',
    top: 54,
    left: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 2,
  },
  cerrarTexto: { color: C.tinta, fontSize: 32, lineHeight: 34 },
  // La capa del gesto ocupa toda la pantalla y centra la foto: así el arrastre
  // se puede empezar en cualquier lado, no solo sobre el cuadrado de la foto.
  capaGesto: { alignItems: 'center', justifyContent: 'center' },
  // EL MARCO DE LA FOTO. El mismo hilo que separa todo en esta app.
  marco: {
    alignSelf: 'center',
    padding: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.linea,
    backgroundColor: C.hoja,
    overflow: 'hidden',
  },
  pasos: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paso: { color: C.tinta, fontSize: 40, paddingHorizontal: 8 },
  pie: { position: 'absolute', left: 24, right: 24, bottom: 48 },
  cuando: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  fecha: { color: C.tinta, fontSize: 16 },
  // "día 41": el registro, en el claro de la app para que se lea como un logro.
  diaDeRacha: { color: C.claro, fontSize: 13, fontVariant: ['tabular-nums'] },
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
