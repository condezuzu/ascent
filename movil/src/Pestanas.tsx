import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from './supabase';
import { miId, quienSoy } from '@compartido/quienSoy';
import type { Perfil } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { alSoltar, arrastre, CURVA, luzDePestana, reposo, VIAJE_MS, vecina } from '@nucleo/deslizar';
import Inicio from './Inicio';
import Stats from './Stats';
import Ranking from './Ranking';
import Album from './Album';
import Ajustes from './Ajustes';
import { despertarMotor } from './despertarMotor';
import { ponerDesenfoque } from './desenfoqueDelFondo';
import { eventos } from '@compartido/eventos';
import { IR_A_PESTANA, PESTANA_ACTIVA, type Pestana } from './irAPestana';
import { ContextoVisible } from './pedidoDeFondo';
import { deslizarPestanasBloqueado } from './gestoDePestanas';
import Recorrido from './Recorrido';

/**
 * LA BARRA DE ABAJO, con las pantallas que ya existen en nativo.
 *
 * LAS QUE YA EXISTEN, NI UNA MÁS. Una pestaña que abre "próximamente" es un
 * botón que miente en el lugar más tocado de la app. Cada pantalla entra
 * cuando entra, en el mismo orden que la web (Ranking y Álbum desde el 18/9).
 *
 * LAS PESTAÑAS SIGUEN SIENDO UN `useState` Y EL ROUTER VIVE AFUERA (22/9).
 * Expo Router entró para lo que las pestañas no podían: apilar el perfil
 * encima y volver. Una ruta por pestaña obligaría a montar y tumbar el motor
 * en cada cambio y a reescribir el asomo del gesto con otra biblioteca, para
 * conseguir lo mismo que ya funciona.
 *
 * SE DESLIZA ENTRE PESTAÑAS (22/9), como en la web. Las reglas del gesto
 * —cuánto hay que arrastrar, qué velocidad alcanza, cuánto dura el viaje— son
 * las MISMAS y salen de `nucleo/deslizar.ts`: un gesto que pide un quinto de
 * la pantalla en la web y la mitad en el teléfono no es la misma app.
 *
 * LA DE AL LADO SE MONTA DE VERDAD MIENTRAS SE ARRASTRA, y ahí esto se separa
 * de la web: allá entra una copia congelada del DOM porque la pantalla ya
 * estuvo dibujada alguna vez y clonarla es gratis. Acá no hay copia que
 * clonar, así que asoma la pantalla real. Cuesta lo que cuesta abrirla —la
 * misma consulta que si se tocara la pestaña— y por eso no se monta con el
 * primer píxel: recién cuando el gesto se decidió que es horizontal.
 *
 * CADA PESTAÑA SE MONTA UNA VEZ Y SE QUEDA (23/9). Antes solo quedaba la
 * activa, y volver a una la cargaba de cero — que además de costar una
 * consulta era el TITILEO: la pantalla de destino ya estaba montada y
 * cargada en el carril que asomaba, y al soltar el gesto se tiraba para
 * montarla de nuevo, vacía. Ver `montadas`.
 *
 * Lo que se perdió al arreglarlo —que cada vuelta recargara los datos— se
 * paga a mano con `PESTANA_ACTIVA`: sin eso, sumás una foto en Inicio, vas
 * al Álbum, y no está.
 *
 * ─────────────────────────────────────────────────────────────────────
 * EL TITILEO, TERCER INTENTO, Y ESTA VEZ LA CAUSA ERA DE iOS (24/9)
 *
 * Seguía pasando en el teléfono después de dos arreglos que en el navegador se
 * veían bien, y el humano tenía razón en pedir que se midiera ahí: la causa
 * solo existe con el driver nativo.
 *
 * QUÉ PASABA. Cada carril se colocaba con `left` según su DISTANCIA a la
 * pestaña activa, y el conjunto se movía con un `translateX` animado. Al
 * cambiar de pestaña cambiaban las dos cosas a la vez... por dos caminos
 * distintos: `left` es una prop normal y viaja con el dibujado de React;
 * `translateX` con `useNativeDriver` lo aplica el lado nativo por su cuenta.
 * NADIE GARANTIZA EL ORDEN. Si el nativo centraba el carril antes de que
 * llegaran los `left` nuevos, durante un cuadro la pestaña VIEJA quedaba
 * centrada y visible. Eso es el parpadeo, y en la web no puede pasar porque
 * las dos cosas salen del mismo commit del DOM.
 *
 * AHORA `left` NO CAMBIA NUNCA. Cada carril se coloca por su índice absoluto
 * —Inicio en 0, Ranking en un ancho, Álbum en dos— y lo único que se mueve es
 * UNA sola cosa: el desplazamiento de la tira entera. Sin dos caminos no hay
 * carrera posible.
 *
 * Y LA DE DESTINO SE MONTA EN EL MISMO DIBUJADO, no en un efecto de después:
 * tocar una pestaña nunca abierta dejaba un cuadro con la vieja ya escondida y
 * la nueva todavía sin montar, o sea en blanco.
 */

const ORDEN: Pestana[] = ['inicio', 'ranking', 'album', 'stats', 'ajustes'];

// Cuánto tiene que moverse el dedo para que esto sea un arrastre horizontal y
// no el scroll de la pantalla. La comparación contra el movimiento vertical es
// lo que decide: adentro de cada pantalla hay un ScrollView, y robarle el
// gesto por un temblor de la mano hace que la app se sienta trabada.
const DECIDE_PX = 14;

/**
 * CUÁNTO SE DESENFOCA EL FONDO EN CADA PESTAÑA, de 0 a 1.
 *
 * En el orden de `ORDEN`. Inicio en cero es la definición de todo esto: el
 * planeta se ve entero ahí y en ningún otro lado.
 *
 * STATS VA A MENOS DE LA MITAD (25/9, a pedido): *"en Stats bajá el desenfoque,
 * no lo saques del todo"*. Y tiene su lógica: Stats es la pantalla más cargada
 * de la app —dos gráficos, el volumen, el calendario— y ahí el fondo ya compite
 * con el contenido aunque esté nítido. Desenfocarlo a fondo, además, es plata
 * gastada: no se ve nada del planeta atrás de todo eso.
 */
const DESENFOQUE: number[] = [0, 1, 1, 0.45, 1];

/**
 * CUÁNTO DESENFOQUE LE TOCA A LA TIRA DONDE ESTÁ AHORA.
 *
 * Inicio vive en `left: 0`, así que en reposo sobre Inicio la tira está en 0 y
 * sobre cualquier otra pestaña en `-ancho × índice`. De ahí sale un índice CON
 * DECIMALES —2,4 es "entre Álbum y Stats, más cerca del Álbum"— y el nivel se
 * interpola entre los dos vecinos.
 *
 * Es lo que hace que el fondo se aclare MIENTRAS arrastrás y no al soltar: sale
 * de dónde está la tira ahora, no de qué pestaña va a quedar activa. Y que la
 * bajada hacia Stats sea gradual en vez de un escalón al llegar.
 */
function desenfoqueEn(x: number, ancho: number): number {
  if (ancho <= 0) return 0;
  const i = Math.max(0, Math.min(DESENFOQUE.length - 1, Math.abs(x) / ancho));
  const a = DESENFOQUE[Math.floor(i)];
  const b = DESENFOQUE[Math.ceil(i)];
  return a + (b - a) * (i - Math.floor(i));
}

export default function Pestanas({
  alSalir,
  alFaltarNombre,
}: {
  alSalir: () => void;
  alFaltarNombre: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [perfilNoCargo, setPerfilNoCargo] = useState(false);
  // CUÁNTAS SOLICITUDES DE AMISTAD ESPERAN. Para el puntito en la pestaña
  // Ranking: sin esto, alguien te agrega y no hay forma de enterarse hasta que
  // entrás a Ranking por tu cuenta. Es una cuenta barata (head), se refresca al
  // cambiar de pestaña. El aviso al teléfono (push) es aparte y es nativo.
  const [solicitudes, setSolicitudes] = useState(0);
  /** La de al lado, mientras el dedo está abajo. `null` = no se está arrastrando. */
  const [asomando, setAsomando] = useState<Pestana | null>(null);
  /**
   * LAS QUE YA SE ABRIERON ALGUNA VEZ, y la razón de que exista este estado
   * es EL TITILEO (23/9, segundo intento).
   *
   * QUÉ PASABA. Cada carril dibujaba `dibujar(cual)`, o sea un elemento
   * NUEVO. Al soltar el gesto, la pantalla de destino estaba montada y
   * cargada en el carril que asomaba... y `setPestana` la volvía a crear
   * desde cero en el carril principal, mientras la instancia buena se
   * desmontaba. O sea: llegabas a Álbum cargado y la app lo tiraba y lo
   * montaba de nuevo, vacío, pidiendo sus datos otra vez. Eso es el
   * parpadeo, y por eso el arreglo anterior —mover el centrado a
   * `useLayoutEffect`— no alcanzó: arreglaba CUÁNDO se centra el carril, y
   * el problema no era el carril, era que la pantalla se remontaba.
   *
   * AHORA CADA PESTAÑA SE MONTA UNA VEZ Y SE QUEDA. Se colocan por su
   * distancia a la activa, así que al cambiar de pestaña los desplazamientos
   * se recalculan y el carril vuelve a cero en el mismo dibujo: la de
   * destino ya estaba en su lugar y no se mueve ni un píxel.
   *
   * SOLO LAS VISITADAS, no las cinco: montar las cinco al abrir la app
   * costaría cinco pantallas pidiendo sus datos en el arranque, que es el
   * momento en que más se nota.
   */
  const montadas = useRef<Set<Pestana>>(new Set(['inicio']));
  const { width: ancho } = useWindowDimensions();
  /**
   * CUÁNTO ESTÁ CORRIDA LA TIRA ENTERA, en píxeles. En reposo vale menos el
   * índice de la pestaña activa por un ancho; mientras el dedo arrastra, eso
   * más el arrastre.
   *
   * ES LO ÚNICO QUE SE MUEVE. Antes también cambiaba el `left` de cada carril,
   * y esas dos cosas viajan por caminos distintos —una con React, la otra con
   * el driver nativo— sin orden garantizado entre ellas. Ver el encabezado.
   */
  const correr = useRef(new Animated.Value(0)).current;
  /**
   * EN CUÁL ESTÁ LA TIRA, O A CUÁL ESTÁ YENDO — EL TITILEO AL DESLIZAR RÁPIDO (3/10).
   *
   * El gesto leía `pestana`, que es estado: cambia recién cuando el viaje
   * TERMINA (340 ms) y la pantalla se vuelve a dibujar. Un segundo gesto en ese
   * rato todavía creía estar en la pestaña de antes y colocaba la tira ahí: se
   * veía la anterior un cuadro o dos y después la nueva. Medido con dos gestos
   * pegados: la tira iba de −390 (Ranking) a −17 (Inicio) y a −414.
   *
   * Los tres intentos anteriores arreglaron otras cosas —el remontaje, el
   * `left` contra el `translateX`, los cuadros del motor— y por eso este
   * seguía: no era de dibujado, era de QUÉ PESTAÑA CREE EL GESTO QUE ES.
   *
   * Esto se actualiza AL SOLTAR, antes de que arranque el viaje, y es lo único
   * que miran el gesto y la barra. `pestana` sigue siendo lo que se dibuja como
   * activa, y se pone al día cuando el viaje llega.
   */
  const rumbo = useRef<Pestana>('inicio');
  // El gesto se lee con refs y no con estado: el estado llega un cuadro tarde,
  // y un cuadro tarde en un dedo que se mueve se ve como un tirón.
  const gesto = useRef<{ decidido: boolean; vecina: Pestana | null; desde: number; x0: number }>({
    decidido: false,
    vecina: null,
    desde: 0,
    x0: 0,
  });

  // Ajustes necesita el perfil entero; se pide al entrar, no antes: Inicio ya
  // lo pide para lo suyo, y pedirlo dos veces al abrir la app es un viaje más
  // en el momento en que más se nota. También se pide cuando Ajustes es la que
  // asoma: si no, la primera mitad del gesto muestra una ruedita.
  const cargarPerfil = useCallback(async () => {
    const yo = await quienSoy(supabase);
    if (yo.estado === 'sin') return alSalir();
    setPerfilNoCargo(false);
    const data = yo.estado === 'con' ? (await supabase.from('profiles').select('*').eq('id', yo.uid).single()).data : null;
    if (data) setPerfil(data as Perfil);
    // Sin red esto era una ruedita para siempre: ni mensaje ni reintento.
    else setPerfilNoCargo(true);
  }, [alSalir]);

  useEffect(() => {
    if (pestana === 'ajustes' || asomando === 'ajustes') cargarPerfil();
  }, [pestana, asomando, cargarPerfil]);

  // El puntito de "te llegó una solicitud": se cuenta al montar y al cambiar de
  // pestaña (entrar a Ranking la deja al día en cuanto la ves).
  const contarSolicitudes = useCallback(async () => {
    const uid = await miId(supabase);
    if (!uid) return;
    const { count } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('destinatario', uid)
      .eq('estado', 'pendiente');
    setSolicitudes(count ?? 0);
  }, []);
  useEffect(() => {
    contarSolicitudes();
  }, [contarSolicitudes, pestana]);

  // AL VOLVER A UNA PESTAÑA, QUE PIDA SUS DATOS DE NUEVO. Antes lo hacía
  // sola porque se remontaba entera —que era el titileo—; ahora que se
  // queda montada, hay que avisarle. Ver `useRecargarAlVolver`.
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    eventos.emitir(PESTANA_ACTIVA, pestana);
  }, [pestana]);

  // AL VOLVER LA APP AL FRENTE, RECARGAR LA PESTAÑA ACTIVA (H3 #7+#8).
  //
  // Las pantallas se quedan montadas y solo recargan al CAMBIAR de pestaña. Si
  // dejás la app abierta y volvés a la MISMA pestaña una hora después, pasan
  // dos cosas feas: las URL firmadas de las fotos viven 1 h
  // (`createSignedUrl(..., 3600)`) y ya vencieron —403, fotos rotas—, y la
  // racha/`perdida` quedaron congeladas en lo de hace una hora. El token se
  // renueva al frente (ver `app/_layout.tsx`), pero eso no vuelve a pedir los
  // datos ni a re-firmar las fotos.
  //
  // Reusa el MISMO aviso que el cambio de pestaña: `PESTANA_ACTIVA` dispara el
  // `cargar()` de la pantalla que esté activa (`useRecargarAlVolver`), que es
  // el que vuelve a firmar las fotos y a traer la racha. Un solo lugar arregla
  // las dos cosas, y solo para la activa: las otras recargan al volver a ellas.
  const pestanaAhora = useRef(pestana);
  pestanaAhora.current = pestana;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (e) => {
      if (e === 'active') eventos.emitir(PESTANA_ACTIVA, pestanaAhora.current);
    });
    return () => sub.remove();
  }, []);

  // Y AL VOLVER DE UNA PANTALLA APILADA (4/10). Mis marcas, un perfil o el
  // calendario se apilan encima de las pestañas, que siguen montadas debajo:
  // al volver no cambia la pestaña ni la app vuelve al frente, así que no
  // avisaba nadie. Se anotaba una marca más alta y Stats seguía con la de antes.
  // La primera vez no: es el montaje, y cada pantalla ya carga sola.
  const yaTuvoFoco = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!yaTuvoFoco.current) {
        yaTuvoFoco.current = true;
        return;
      }
      eventos.emitir(PESTANA_ACTIVA, pestanaAhora.current);
    }, [])
  );

  // LA QUE SE ABRE —O LA QUE ASOMA— QUEDA MONTADA PARA SIEMPRE, y se anota
  // ACÁ, al dibujar, no en un efecto de después. Un efecto corre cuando la
  // pantalla ya se pintó: tocar una pestaña nunca abierta dejaba un cuadro con
  // la vieja escondida y la nueva sin montar, o sea en blanco.
  //
  // Escribir una ref al dibujar es impuro, pero esto solo AGREGA y agregar dos
  // veces lo mismo no cambia nada, así que un dibujado repetido da lo mismo.
  montadas.current.add(pestana);
  if (asomando) montadas.current.add(asomando);

  // SOLO SI CAMBIA EL ANCHO —girar el teléfono— se recoloca sin animar. En un
  // cambio de pestaña no: ahí la tira ya la está moviendo la animación, y un
  // `setValue` encima la cortaría a la mitad.
  const anchoAnterior = useRef(ancho);
  useEffect(() => {
    if (anchoAnterior.current === ancho) return;
    anchoAnterior.current = ancho;
    correr.setValue(reposo(ORDEN.indexOf(rumbo.current), ancho));
    // Si esto cortó un viaje, aquel ya no va a decir cuál quedó activa.
    setPestana(rumbo.current);
  }, [ancho, correr]);

  /**
   * LA LUZ DE CADA PESTAÑA, ATADA A LA TIRA (3/10). Es una opacidad que sale del
   * mismo valor animado que mueve las pantallas: no hay estado, no espera al
   * viaje ni al redibujado, y acompaña al dedo. Ver `luzDePestana`.
   */
  const luces = useMemo(
    () =>
      ORDEN.map((_p, i) => {
        const { entrada, salida } = luzDePestana(i, ORDEN.length, ancho);
        return correr.interpolate({ inputRange: entrada, outputRange: salida, extrapolate: 'clamp' });
      }),
    [correr, ancho]
  );

  /**
   * IR A UNA PESTAÑA, tocando el botón de abajo.
   *
   * SE MUEVE Y SE ANIMA, igual que el gesto. Antes el toque era instantáneo
   * porque los carriles se recolocaban solos al cambiar la activa; ahora los
   * lugares son absolutos, así que si no se mueve la tira no se ve nada. Y ya
   * que hay que moverla, se anima: el mismo viaje que soltando el dedo, así
   * tocar y deslizar se sienten la misma cosa.
   */
  const irA = useCallback(
    (destino: Pestana) => {
      // Contra el RUMBO y no contra `pestana`: con un viaje en curso la activa
      // todavía es la de antes y la tira ya va para otro lado.
      if (destino === rumbo.current) return;
      rumbo.current = destino;
      montadas.current.add(destino);
      setPestana(destino);
      setAsomando(null);
      const llega = reposo(ORDEN.indexOf(destino), ancho);
      ponerDesenfoque(desenfoqueEn(llega, ancho));
      // Sin nada al terminar: la activa ya quedó dicha arriba. Si este viaje
      // corta uno del gesto, aquel se entera de que no terminó y no decide.
      Animated.timing(correr, {
        toValue: llega,
        duration: VIAJE_MS,
        easing: Easing.bezier(...CURVA),
        useNativeDriver: true,
      }).start();
    },
    [ancho, correr]
  );

  // "Ir a Ajustes" desde el texto de otra pantalla: ver `irAPestana.ts`.
  useEffect(() => eventos.escuchar(IR_A_PESTANA, (p) => irA(p as Pestana)), [irA]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // No se pide el gesto al tocar: un toque tiene que llegar al botón que
        // se tocó. Se pide recién al MOVERSE, y solo si el movimiento es
        // claramente horizontal.
        onMoveShouldSetPanResponder: (_e, g) => {
          // EL CANDADO (27/9): si un hijo está manejando el horizontal —la foto
          // abierta, un carrusel, un campo de texto por el que se está
          // deslizando— las pestañas NO agarran el gesto. Sin esto, el
          // `PanResponder` de acá le robaba el deslizamiento a la foto abierta y
          // terminabas en otra pestaña. Ver `gestoDePestanas.ts`.
          if (deslizarPestanasBloqueado()) return false;
          if (Math.abs(g.dx) < DECIDE_PX || Math.abs(g.dx) < Math.abs(g.dy) * 1.5) return false;
          return vecina(ORDEN.indexOf(rumbo.current), g.dx, ORDEN.length) !== null;
        },
        onPanResponderGrant: (_e, g) => {
          const destino = vecina(ORDEN.indexOf(rumbo.current), g.dx, ORDEN.length);
          gesto.current = { decidido: true, vecina: destino === null ? null : ORDEN[destino], desde: Date.now(), x0: g.dx };
          setAsomando(destino === null ? null : ORDEN[destino]);
        },
        onPanResponderMove: (_e, g) => {
          if (!gesto.current.decidido) return;
          // Si el dedo cambia de lado a mitad del gesto, cambia la que asoma.
          // Desde el RUMBO: la cuenta está en `nucleo/deslizar.ts`, probada.
          const { asoma, x } = arrastre(ORDEN.indexOf(rumbo.current), g.dx, ancho, ORDEN.length);
          const cual = asoma === null ? null : ORDEN[asoma];
          if (cual !== gesto.current.vecina) {
            gesto.current.vecina = cual;
            setAsomando(cual);
          }
          // Sobre el reposo, no desde cero: la tira ya está corrida.
          correr.setValue(x);
          // EL DESENFOQUE SIGUE AL DEDO. Lo que se mide es la distancia a
          // Inicio en anchos de pantalla: en Inicio es 0, en cualquier otra 1,
          // y a mitad de camino la mitad. No es el índice de la pestaña sino
          // dónde está la tira AHORA, que es lo que hace que baje mientras
          // arrastrás en vez de saltar al soltar.
          ponerDesenfoque(desenfoqueEn(x, ancho));
        },
        onPanResponderRelease: (_e, g) => {
          const ms = Math.max(1, Date.now() - gesto.current.desde);
          const hasta = alSoltar(ORDEN.indexOf(rumbo.current), g.dx, ancho, g.dx / ms, ORDEN.length);
          // EL RUMBO CAMBIA ACÁ, AL SOLTAR, y no cuando el viaje termina: el
          // gesto que venga en los próximos 340 ms ya parte de la pestaña a la
          // que va la tira. Esperar al final era el titileo.
          rumbo.current = ORDEN[hasta];
          const llega = reposo(hasta, ancho);
          // Al soltar, el desenfoque va A DONDE VA LA TIRA y no a donde está:
          // los dos viajes duran lo mismo y terminan juntos.
          ponerDesenfoque(desenfoqueEn(llega, ancho));
          Animated.timing(correr, {
            toValue: llega,
            duration: VIAJE_MS,
            easing: Easing.bezier(...CURVA),
            useNativeDriver: true,
          }).start(({ finished }) => {
            // UN VIAJE CORTADO NO DECIDE NADA. Lo corta otro gesto o un toque en
            // la barra, y el que lo cortó sabe dónde queda la tira. Antes esto
            // corría igual: pisaba la pestaña que acababa de elegir el toque
            // —la barra marcaba una y se veía otra— y le apagaba al gesto nuevo
            // la que asomaba.
            if (!finished) return;
            // LA TIRA YA ESTÁ DONDE TIENE QUE ESTAR: la animación la dejó
            // sobre la pestaña de destino. Lo único que falta es decir cuál es
            // la activa, y eso NO MUEVE NADA — los `left` son absolutos y no
            // cambian. Por eso acá ya no hay nada que centrar ni que esperar.
            setPestana(rumbo.current);
            // Si ya hay otro gesto en curso, la que asoma es de él.
            if (!gesto.current.decidido) setAsomando(null);
          });
          gesto.current = { decidido: false, vecina: null, desde: 0, x0: 0 };
        },
        onPanResponderTerminationRequest: () => false,
      }),
    // SIN `pestana`: el gesto no puede depender de lo que se está dibujando.
    // Además así el PanResponder no se rearma debajo del dedo a mitad de un
    // gesto, que le ponía el arrastre en cero.
    [ancho, correr]
  );

  const dibujar = (cual: Pestana) => {
    if (cual === 'inicio') return <Inicio alSalir={alSalir} alFaltarNombre={alFaltarNombre} />;
    if (cual === 'ranking') return <Ranking alSalir={alSalir} />;
    if (cual === 'album') return <Album alSalir={alSalir} />;
    if (cual === 'stats') return <Stats alSalir={alSalir} />;
    return perfil ? (
      <Ajustes perfil={perfil} alCambiar={(parcial) => setPerfil((p) => (p ? { ...p, ...parcial } : p))} alSalir={alSalir} />
    ) : perfilNoCargo ? (
      <View style={estilos.centrado}>
        <Text style={estilos.noCargo}>{T.inicio.noCargo}</Text>
        <Pressable style={estilos.reintentar} onPress={cargarPerfil}>
          <Text style={estilos.reintentarTexto}>{T.inicio.reintentar}</Text>
        </Pressable>
      </View>
    ) : (
      <View style={estilos.centrado}>
        <ActivityIndicator color="#8a93a8" />
      </View>
    );
  };

  return (
    // CADA TOQUE DESPIERTA AL MOTOR. En la web lo escucha el `window`; acá no
    // hay `window`, y los toques los ve la vista que los recibe. `onTouchStart`
    // en la raíz los ve todos —sube desde cualquier hijo— sin quitárselos a
    // nadie. Ver `despertarMotor.ts`.
    <View style={estilos.todo} onTouchStart={despertarMotor}>
      <View style={estilos.pantalla} {...pan.panHandlers}>
        {/* EL MOTOR YA NO VIVE ACÁ (22/9): subió a `app/_layout.tsx`, detrás
            del stack entero. Estaba adentro de las pestañas desde que era lo
            único que había, y con el perfil apilado encima quedaba tapado: se
            entraba a `/yo` y el planeta desaparecía, cuando en la web está.
            Sigue siendo UN solo contexto de GL para toda la sesión; lo que
            cambió es de qué está detrás. */}
        {/* UN CARRIL POR PESTAÑA VISITADA, colocado por su distancia a la
            activa. Ninguna se desmonta al cambiar de pestaña: ese remonte era
            el titileo. Ver `montadas`. */}
        {ORDEN.filter((cual) => montadas.current.has(cual)).map((cual) => {
          // EL LUGAR ES ABSOLUTO Y NO CAMBIA NUNCA: Inicio en 0, Ranking en un
          // ancho, Álbum en dos. Lo que se mueve es la tira entera. Ver el
          // encabezado: dos cosas moviéndose por caminos distintos era el
          // titileo que no se iba.
          return (
            <Animated.View
              key={cual}
              // Para la sonda del titileo: lo que hay que poder comprobar es que
              // este nodo sea EL MISMO despues de cambiar de pestaña, porque
              // eso es lo que significa que no se remonto.
              testID={'carril-' + cual}
              style={[
                estilos.carril,
                { left: ORDEN.indexOf(cual) * ancho, width: ancho },
                { transform: [{ translateX: correr }] },
                // NINGUNA SE ESCONDE. Estuvieron con `display: none` para
                // ahorrarle al motor dibujar las que quedan fuera de la
                // ventana, y ese ahorro costaba un cuadro en blanco: esconder
                // la vieja y mostrar la nueva es un cambio de React, mover la
                // tira es del driver nativo, y entre los dos no hay orden
                // garantizado. Todas visibles, todas en su lugar: entonces no
                // importa cuál de las dos cosas llegue primero.
                //
                // Las que quedan afuera las recorta el `overflow: hidden` del
                // contenedor, y son vistas quietas: el motor, que es lo caro,
                // vive en la raíz y es uno solo.
              ]}
              // La que asoma es para mirar, no para tocar: un toque ahí sería
              // en una pantalla que todavía no es la que está.
              pointerEvents={cual === pestana ? 'auto' : 'none'}
              // Y TAMPOCO SE LEEN EN VOZ ALTA. Con las cinco montadas —que es
              // lo que arregló el titileo— VoiceOver recorría las cinco
              // pantallas seguidas: el `overflow: hidden` recorta lo que se
              // ve, no lo que se lee. Salió del barrido del 25/9, que se topó
              // con un enlace de Stats estando en Ajustes.
              accessibilityElementsHidden={cual !== pestana}
            >
              {/* QUIÉN PUEDE PEDIR EL FONDO. Con las cinco pestañas montadas,
                  las cinco lo pedían y ganaba la última que hubiera corrido su
                  efecto: volvías a Inicio y te quedaba el `soloEstrellas` de
                  Ranking, o sea el espacio sin el cuerpo. Solo la activa, y no
                  la que asoma: el fondo es uno solo detrás de las dos, y
                  cambiarlo a mitad del gesto se vería como un salto. */}
              <ContextoVisible.Provider value={cual === pestana}>
                {dibujar(cual)}
              </ContextoVisible.Provider>
            </Animated.View>
          );
        })}
      </View>

      {/* EL RECORRIDO DE LA PRIMERA VEZ (§10), encima de la barra. Va acá y no
          adentro de cada pantalla porque la barra está en las cinco del
          recorrido: puesto una vez, aparece donde tiene que aparecer. No
          dibuja nada si no hay recorrido andando. */}
      <Recorrido pestana={pestana} />

      <View style={estilos.barra} accessibilityRole="tablist">
        {/* El orden de la web: Inicio, Ranking, Álbum, Stats, Ajustes. */}
        {ORDEN.map((p, i) => {
          // EL PUNTITO EN RANKING: hay solicitudes esperando y no estás mirando
          // Ranking. Estando ahí ya las ves (van al final de la pantalla).
          const avisa = p === 'ranking' && solicitudes > 0 && pestana !== 'ranking';
          return (
            <Pressable
              key={p}
              style={estilos.boton}
              onPress={() => irA(p)}
              accessibilityRole="tab"
              accessibilityState={{ selected: pestana === p }}
              // SIEMPRE CON SU NOMBRE: el rótulo está dos veces —apagado y
              // encendido— y sin esto se leería dos veces en voz alta.
              accessibilityLabel={avisa ? `${T.nav[p]} — ${T.social.tePidieron(solicitudes)}` : T.nav[p]}
            >
              <View>
                <Text style={estilos.texto}>{T.nav[p]}</Text>
                {/* LA LUZ: el mismo rótulo, encendido, encima del apagado. Lo
                    que cambia es su opacidad, y sale de la tira (`luces`), no
                    de `pestana`. */}
                <Animated.Text
                  testID={'luz-' + p}
                  style={[estilos.texto, estilos.luz, { opacity: luces[i] }]}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {T.nav[p]}
                </Animated.Text>
                {avisa && <View style={estilos.punto} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // SIN FONDO PROPIO: el motor vive en la raíz del router, detrás de todo, y
  // pintar acá lo taparía. Ver .
  todo: { flex: 1 },
  pantalla: { flex: 1, overflow: 'hidden' },
  // ABSOLUTO CON ANCHO PROPIO y no `absoluteFill`: ese pone `right: 0`, y con
  // un `left` de una pantalla entera la de al lado quedaba de ancho cero. Se
  // veía el fondo del motor en vez de la pantalla que asoma (visto a :8092).
  carril: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noCargo: { color: '#8a93a8', fontSize: 14, textAlign: 'center', paddingHorizontal: 32, marginBottom: 14 },
  reintentar: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#8a93a8', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  reintentarTexto: { color: '#e8ebf2', fontSize: 14 },
  barra: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1d2230',
    paddingBottom: 22,
    paddingTop: 10,
    backgroundColor: '#05060a',
  },
  boton: { flex: 1, alignItems: 'center', paddingVertical: 6, minHeight: 44, justifyContent: 'center' },
  texto: { color: '#4a5163', fontSize: 12, letterSpacing: 0.5 },
  // Encima del rótulo apagado, calzado: mismo texto, mismo tamaño, otro color.
  luz: { position: 'absolute', left: 0, top: 0, color: '#e8ecf6' },
  // El puntito de aviso, arriba a la derecha del rótulo de la pestaña.
  punto: {
    position: 'absolute',
    top: -3,
    right: -9,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#e8705f',
  },
});
