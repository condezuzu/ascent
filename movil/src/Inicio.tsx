import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { supabase } from './supabase';
import { DIAS_SEMANA, deISO, hoyISO, restarDias } from '@nucleo/fechas';
import { esDiaDeDescanso, type ConfigDescanso } from '@nucleo/descansos';
import { estaBloqueado, textoDeBloqueo } from '@nucleo/pendiente';
import { planetaDeDia, rangoDeRacha } from '@nucleo/rangos';
import { hayPresagio } from '@nucleo/atmosfera';
import { laCuentaYaNoExiste, mensajeDeAuth } from '@nucleo/errores';
import type { Log, Perfil, ResultadoRegistro } from '@nucleo/tipos';
import { T } from '@nucleo/textos';
import { cronoLindo, duracionLinda, transcurrido } from '@nucleo/sesiones';
import { useSesion, type CierreDeSesion } from '@compartido/useSesion';
import { eventos } from '@compartido/eventos';
import { DIA_CAMBIO, SUBIO_RANGO } from '@compartido/gimnasio';
import { FilaDeMedallas } from './Medallas';
import { useRecargarAlVolver } from './irAPestana';
import { useMisMedallas } from '@compartido/misMedallas';
import { CERRO_SOLA } from './VigilanteDeGimnasio';
import Bloque from './Bloque';
import Descanso from './Descanso';
import RachaSalvada from './RachaSalvada';
import SubidaRango from './SubidaRango';
import RegistrarDia from './RegistrarDia';
import { plataforma } from '@plataforma';
import { CLAVE_VIDA_VISTA, hastaDondeVisto, impulsosSinVer, rachaSiSeDevuelve } from '@nucleo/impulsos';
import SugerenciasDeMarca from './SugerenciasDeMarca';
import MarcaEnElMomento from './MarcaEnElMomento';
import { paletaDe } from '@nucleo/paletas';
import { cuentaAtras, restante } from '@compartido/descanso';
import FondoEspacial from './FondoEspacial';
import { mostrando } from './loVisible';
import Avatar from './Avatar';
import DiaListo from './DiaListo';
import InsistirGimnasio, { useInsistirGimnasio } from './InsistirGimnasio';
import GloboPrimeraVez from './GloboPrimeraVez';
import RachaConRotulo from './RachaConRotulo';
import { irAPestana } from './irAPestana';
import PesoHoja from './PesoHoja';

/**
 * INICIO — TANDA 2. La racha, la semana y el botón que registra el día.
 *
 * ES EL BUCLE ENTERO DE LA APP: abrir, ver el número, tocar una vez. Todo lo
 * demás —el motor visual, el cronómetro, las marcas— vive alrededor de esto.
 *
 * DE NUEVO, LO QUE NO HAY ACÁ ES LO QUE IMPORTA: ni una regla de racha, ni un
 * cálculo de qué día es descanso, ni un texto, ni el mensaje del bloqueo de
 * las 20 horas. Todo sale de `nucleo/`, los mismos archivos que usa la web. Lo
 * único propio es cómo se dibuja.
 *
 * EL OBJETO DE RANGO (tanda 4) es el MISMO motor que la web, desde
 * `compartido/motor/`, montado en `FondoEspacial` sobre `expo-gl`. Con él se
 * fue el andamio que nombraba el rango en texto: en web el rango no se nombra
 * nunca (§7), lo dice el objeto, y ahora acá también.
 *
 * LA FOTO Y EL PESO ya están (22/9): la hoja de registrar con cámara y galería
 * (`RegistrarDia`) y la del peso, que es su propia puerta porque pesarse no es
 * haber ido al gimnasio (`PesoHoja`).
 *
 * LA SESIÓN (tanda 3, N1) NO ESTÁ ESCRITA ACÁ: es `useSesion`, el MISMO hook
 * que usa la web, desde `compartido/`. Iniciar, el cronómetro, terminar, el
 * cierre por inactividad y el aviso de "se cerró sola" son una sola lógica
 * para las dos apps. Esta pantalla solo la dibuja. El bloque —contar series,
 * el peso— es N2 y vive en `Bloque.tsx`; el descanso es N3 y vive en
 * `Descanso.tsx`, con el aviso del sistema programado en `compartido/descanso.ts`.
 */

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; que: string }
  | {
      tipo: 'listo';
      perfil: Perfil;
      logs: Log[];
      descansos: ConfigDescanso[];
      cubiertos: string[];
      impulsos: { quedan: number; total: number } | null;
      /** Si hoy se perdió la racha: el fondo se apaga, igual que en la web. */
      perdida: boolean;
    };

export default function Inicio({
  alSalir,
  alFaltarNombre,
}: {
  alSalir: () => void;
  /** Cuenta nueva sin nombre: la pantalla de elegirlo es de App. */
  alFaltarNombre: () => void;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  // EL SCROLL, para traer a la vista la pregunta de marca de la serie recién
  // confirmada (ver `MarcaEnElMomento`). Se mide en coordenadas de PANTALLA y
  // no con `measureLayout`, que no se porta igual en la vista web de la nativa y
  // en el teléfono: así lo que se prueba en :8090 es lo que pasa en el iPhone.
  const scroll = useRef<ScrollView>(null);
  const desplazado = useRef(0);
  const { height: altoVentana } = useWindowDimensions();
  const traerALaVista = useCallback(
    (v: View) => {
      v.measureInWindow((_x, y, _w, alto) => {
        // Lo que tapa abajo: la barra de pestañas y un margen para respirar.
        const borde = altoVentana - 90;
        const sobra = y + alto - borde;
        if (sobra > 0) scroll.current?.scrollTo({ y: desplazado.current + sobra, animated: true });
      });
    },
    [altoVentana]
  );
  // La hoja de registrar el día (con foto): la misma que la web.
  const [registrarAbierto, setRegistrarAbierto] = useState(false);
  // La hoja del peso: su propia puerta, como en la web.
  const [pesoAbierto, setPesoAbierto] = useState(false);
  // Terminar pregunta antes, en el mismo lugar: es el botón más fácil de tocar
  // sin querer, y lo que hace no se deshace.
  const [terminando, setTerminando] = useState(false);
  const [cierre, setCierre] = useState<CierreDeSesion | null>(null);
  /**
   * EL RESUMEN SE CIERRA, LOS MINUTOS SE QUEDAN (25/9).
   *
   * *"Desapareció «Día registrado · hoy entrenaste X minutos». Me gustaba que
   * apareciera el tiempo."*
   *
   * Antes el resumen y el dato vivían en la misma variable: tocar el resumen
   * para sacarlo del medio —que es lo que uno hace— se llevaba puesto el único
   * lugar donde el número existía. Ahora son dos cosas: `cierre` es la tarjeta
   * que se puede cerrar y esto es cuánto duró el día, que no se cierra porque
   * no es un aviso, es un dato.
   *
   * Y POR ESO SE LEE DEL SERVIDOR, no solo del cierre. Separarlos arreglaba
   * cerrar la tarjeta; no arreglaba cerrar la APP. El número solo existía si
   * esta misma pantalla había visto terminar la sesión, así que volver a abrir
   * Ascent a la noche —o mirarlo desde el otro aparato— dejaba el dato en la
   * nada aunque la sesión estuviera guardada. Ahora `cargar()` lo suma de las
   * sesiones terminadas de hoy, que es donde vive de verdad.
   */
  const [minutosDeHoy, setMinutosDeHoy] = useState<number | null>(null);
  // LA SUBIDA DE RANGO. Los tres caminos que registran un dia terminan
  // aca: el toque, el cronometro, y el dia que entra solo al llegar al
  // gimnasio. Antes no terminaban en ningun lado.
  const [subida, setSubida] = useState<{ antes: number; despues: number } | null>(null);
  // La pantalla del descanso se abre desde la píldora, igual que en la web: el
  // + arranca el descanso pero no tapa el bloque.
  const [descansoAbierto, setDescansoAbierto] = useState(false);
  // LA VENTANA DE LAS VIDAS: los días cubiertos que este aparato todavía no
  // anunció. Misma regla y misma marca que la web (`nucleo/impulsos.ts`).
  const [vidaUsada, setVidaUsada] = useState<{ dias: string[]; quedan: number; total: number } | null>(null);
  const [aviso, setAviso] = useState('');

  // CUÁNTAS VECES SE CARGÓ. No es para mostrar: es lo que hace que las cosas
  // que se piden aparte —hoy las medallas— se enteren de que hay que volver a
  // preguntar.
  const [vueltas, setVueltas] = useState(0);

  /**
   * UNA CARGA QUE FALLA NO BORRA LO QUE YA ESTABA.
   *
   * ERA UN BUG QUE METÍ HOY, y es exactamente el del gimnasio. Al hacer que
   * Inicio recargue al volver, cada vuelta pasó a poder fallar — y fallando
   * ponía la pantalla de error ENCIMA de una pantalla que ya tenía todo.
   * Resultado: sótano sin señal, volvés a Inicio desde el Álbum, y en vez de tu
   * racha y el `+` te encontrás "no hay conexión con el servidor".
   *
   * Lo encontró el barrido corriendo sin red, no usándola.
   *
   * LA PANTALLA DE ERROR ES PARA CUANDO NO HAY NADA QUE MOSTRAR: la primera
   * carga. Si ya hay datos, se queda lo que hay —que es de hace un rato, pero
   * es cierto— y la próxima vuelta vuelve a intentar.
   */
  const fallo = useCallback((que: string) => {
    setEstado((y) => (y.tipo === 'listo' ? y : { tipo: 'error', que }));
  }, []);

  const cargar = useCallback(async () => {
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const uid = sesion.session?.user?.id;
      if (!uid) return alSalir();

      // La pérdida se verifica ANTES de leer el perfil: es la llamada que
      // aplica los impulsos, y si se leyera el perfil primero se mostraría por un
      // instante una racha que la base está por corregir.
      const { data: verificacion } = await supabase.rpc('verificar_perdida');

      const desde = restarDias(hoyISO(), 6);
      const [
        { data: perfil, error },
        { data: logs },
        { data: descansos },
        { data: impulsos },
        { data: deHoy },
      ] = await Promise.all([
        // `maybeSingle` y no `single`: que no haya fila NO es un error de la
        // consulta, es un dato —la cuenta se borró desde otro aparato— y hay
        // que poder distinguirlo de que la consulta no haya llegado.
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        supabase.from('logs').select('*').eq('user_id', uid).gte('fecha', desde).order('fecha'),
        supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
        supabase.rpc('mis_impulsos'),
        // CUÁNTO DURÓ HOY. Se cuelga del día por `log_id` y no de la hora de
        // inicio: una sesión que empieza a las 23:50 y termina a las 00:10 es
        // del día en que empezó, que es lo que dice el resto de la app.
        //
        // `!inner` y no un select suelto: sin eso PostgREST devuelve TODAS las
        // sesiones con `logs` en null para las que no casan, y la suma saldría
        // de la semana entera en vez del día.
        supabase
          .from('sesiones')
          .select('inicio, fin, logs!inner(fecha)')
          .eq('user_id', uid)
          .eq('estado', 'terminada')
          .eq('logs.fecha', hoyISO()),
      ]);

      if (error) return fallo(mensajeDeAuth(error));
      if (!perfil) {
        // HAY TOKEN PERO NO HAY FILA. Antes esto era "algo falló, probá de
        // nuevo": un botón de reintentar que no podía funcionar nunca, porque
        // la cuenta ya no estaba. Se le pregunta al servidor quién es este
        // token, y solo si CONTESTA que ese usuario no existe se cierra la
        // sesión —sin red la pregunta también falla, y ahí reintentar sí es lo
        // correcto—. Ver `laCuentaYaNoExiste`.
        const { error: eQuien } = await supabase.auth.getUser();
        if (laCuentaYaNoExiste(eQuien)) {
          // El signOut no es de más: `alSalir` solo hace que la raíz vuelva a
          // mirar, y el token guardado sigue ahí. Sin esto la raíz lo encuentra
          // otra vez y vuelve a esta misma pantalla.
          await supabase.auth.signOut();
          return alSalir();
        }
        return fallo(T.general.noSePudo);
      }

      // CUENTA RECIÉN CREADA, SIN NOMBRE: no se dibuja Inicio a medias, se
      // manda a elegirlo. Es lo mismo que hace la web rebotando a /onboarding.
      //
      // Se avisa ACÁ y no al dibujar. Estaba en el render y React lo cantó:
      // "Cannot update a component while rendering a different component".
      // Cambiarle el estado al padre mientras el hijo se dibuja es pedirle a
      // React que rehaga un árbol que todavía no terminó; que hoy funcione no
      // lo hace correcto, y en modo concurrente deja de funcionar.
      if (!perfil.username) return alFaltarNombre();

      setEstado({
        tipo: 'listo',
        perfil: perfil as Perfil,
        logs: (logs ?? []) as Log[],
        descansos: (descansos ?? []) as ConfigDescanso[],
        cubiertos: Array.isArray(impulsos?.vigentes) ? (impulsos.vigentes as string[]) : [],
        impulsos: impulsos ? { quedan: Number(impulsos.quedan), total: Number(impulsos.total) } : null,
        perdida: !!(verificacion as { perdida?: boolean } | null)?.perdida,
      });
      // Las dos puntas son del SERVIDOR, así que restarlas no mete el desfasaje
      // de reloj del teléfono —a diferencia del cierre, que tiene que corregirlo
      // (ver `terminar` en `useSesion`)—.
      const minutos = ((deHoy ?? []) as { inicio: string; fin: string | null }[]).reduce(
        (t, s) => (s.fin ? t + (Date.parse(s.fin) - Date.parse(s.inicio)) / 60000 : t),
        0
      );
      // Cero se guarda como `null`: "hoy entrenaste 0 minutos" no es un dato,
      // es una línea de más.
      setMinutosDeHoy(minutos >= 1 ? Math.round(minutos) : null);
      // Una vuelta mas: lo que se pide aparte —las medallas— se entera de que
      // hay datos nuevos. Va aca y no al empezar, para que no pregunten dos
      // veces por una carga que todavia puede fallar.
      setVueltas((v) => v + 1);
      const ultimas = Array.isArray(impulsos?.ultimas) ? (impulsos.ultimas as string[]) : [];
      const sinVer = impulsosSinVer(ultimas, await plataforma.almacenamiento.leer(CLAVE_VIDA_VISTA));
      if (sinVer.length > 0) {
        setVidaUsada({ dias: sinVer, quedan: Number(impulsos?.quedan ?? 0), total: Number(impulsos?.total ?? 0) });
      }
    } catch (e) {
      fallo(String((e as Error)?.message ?? e));
    }
  }, [alSalir, alFaltarNombre, fallo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Iniciar una sesión registra el día: cuando la base avisa, se recarga la
  // racha y la semana. Va antes de cualquier `return`: es un hook.
  const sesion = useSesion((r) => {
    cargar();
    // EMPEZAR LA SESION REGISTRA EL DIA, asi que tambien puede subirte de
    // rango: es el camino mas comun de los tres en un gimnasio.
    if (r?.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
  });

  // EL DÍA QUE ENTRÓ SOLO AL LLEGAR AL GIMNASIO (24/9). Ese camino no pasa
  // por `useSesion` —lo registra el vigilante, o el sistema con la app
  // cerrada—, así que sin esto la racha seguía diciendo el número de ayer
  // hasta que alguien recargara la pantalla a mano.
  useEffect(() => eventos.escuchar(DIA_CAMBIO, () => cargar()), [cargar]);

  // LA SUBIDA DEL DIA QUE ENTRO SOLO. Los otros dos caminos la disparan
  // donde termina el toque; este no tenia donde, porque no hay toque — y en
  // el telefono es peor que en la web, porque el dia puede entrar con la
  // app cerrada y este es el unico momento en que se puede decir algo.
  useEffect(
    () =>
      eventos.escuchar(SUBIO_RANGO, (dato) => {
        const r = dato as ResultadoRegistro;
        if (r?.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
      }),
    []
  );

  // Y LA SESIÓN QUE CERRÓ LA SALIDA DEL GIMNASIO: el resumen tiene que
  // aparecer igual que cuando la terminás con el botón. Quien sabe que se
  // cerró es el vigilante, que no dibuja nada; el que sabe dibujarlo es este.
  useEffect(
    () =>
      eventos.escuchar(CERRO_SOLA, (c) => {
        setCierre(c as CierreDeSesion);
        setMinutosDeHoy((c as CierreDeSesion).minutos);
      }),
    []
  );

  // LO QUE SE VE QUEDA ANOTADO PARA EL DIAGNÓSTICO (22/9). De las tres fuentes
  // del bug de las series —pantalla, teléfono, base— esta es la única que no
  // se puede leer después: la caché y la base siguen ahí dentro de un rato,
  // pero lo que decía la pantalla se lo lleva el primer toque. Ver
  // `loVisible.ts`. Es una anotación en un módulo suelto, no un estado: no
  // vuelve a dibujar nada.
  useEffect(() => {
    mostrando({
      corriendo: sesion.estado.corriendo,
      series: sesion.estado.series,
      hechas: sesion.estado.bloques.hechas,
      meta: sesion.estado.bloques.meta,
      ejercicio: sesion.estado.bloques.ejercicio,
    });
  }, [sesion.estado.corriendo, sesion.estado.series, sesion.estado.bloques]);

  // ¿SE INSISTE HOY CON EL PUNTO DEL GIMNASIO? Se pregunta acá arriba y no
  // adentro del cartel porque el globo quieto de más abajo dice lo mismo: los
  // dos juntos serían dos carteles sobre lo mismo en la misma pantalla.
  const cargado = estado.tipo !== 'cargando' && estado.tipo !== 'error' ? estado : null;
  const insistirGimnasio = useInsistirGimnasio(
    cargado !== null,
    !!cargado?.perfil.gimnasio_lat,
    !!cargado?.logs.some((l) => l.fecha === hoyISO()),
    hoyISO()
  );

  // AL VOLVER A INICIO, QUE PIDA SUS DATOS DE NUEVO.
  //
  // ERA UN BUG, y de los que no se ven hasta que se buscan: desde que las
  // pestañas quedan todas montadas (23/9), volver a una NO la recarga. Se le
  // puso este aviso a Ranking, al Álbum y a Stats... y a Inicio no. O sea la
  // pestaña que más se vuelve a abrir era la única que mostraba lo de antes:
  // cargabas una marca en Stats y volvías a una racha, una semana y un DOTS
  // de hace diez minutos. Encontrado en el barrido del 24/9.
  useRecargarAlVolver('inicio', cargar);

  // LAS MEDALLAS POR MARCA, para la fila del nombre. Va acá arriba como los
  // otros hooks, antes de los retornos tempranos. `vueltas` las hace pedir de
  // nuevo cuando Inicio se recarga: si no, la medalla que acabás de ganar no
  // aparece hasta reiniciar la app.
  const medallas = useMisMedallas(supabase, cargado?.perfil.id, cargado?.perfil.sexo, vueltas);

  if (estado.tipo === 'cargando') {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color="#8a93a8" />
      </View>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.error}>{estado.que}</Text>
        <Pressable onPress={cargar}>
          <Text style={estilos.enlace}>{T.inicio.reintentar}</Text>
        </Pressable>
      </View>
    );
  }

  const { perfil, logs, descansos, cubiertos, impulsos, perdida } = estado;

  const hoy = hoyISO();
  // Igual que la web: un día marcado como descanso a mano TAMBIÉN está (bug del
  // 15/9). Contarlo como vacío ofrecía "Registrar día", la base lo rechazaba
  // por repetido y la hoja lo tomaba como hecho: la racha no subía y nadie
  // decía nada.
  const registradoHoy = logs.some((l) => l.fecha === hoy);

  // LO QUE SE LE PASA AL MOTOR, con las mismas reglas que Inicio de la web
  // (`src/app/page.tsx`): el planeta del día, el lado nocturno los días de
  // descanso, el fantasma de la mejor racha y el presagio de los últimos días.
  const racha = perfil.racha_actual;
  const planeta = planetaDeDia(racha);
  const esDescanso = esDiaDeDescanso(descansos, hoy) && !registradoHoy;
  // EL AVISO SOLO CUANDO FALTA POCO DE VERDAD. A las nueve de la mañana
  // "ultimo tramo" seria una amenaza de doce horas; a las siete de la tarde
  // es un dato. Misma regla que la web.
  const avisoTiempo = !registradoHoy && perfil.racha_actual > 0 && new Date().getHours() >= 19;
  const rangoMejor = rangoDeRacha(perfil.mejor_racha).n;
  const planetaMejor = planetaDeDia(perfil.mejor_racha);
  const fantasma =
    racha < perfil.mejor_racha && (rangoMejor !== perfil.rango_actual || planetaMejor !== planeta)
      ? { rango: rangoMejor, planeta: planetaMejor }
      : null;
  // "Sin nada" es la cuenta recién abierta: el espacio antes de que se forme
  // algo. Acá solo se tienen los logs de la semana, y alcanza: con racha 0 y
  // ninguno en siete días, lo que se ve es lo mismo.
  const sinNada = racha === 0 && logs.length === 0;

  // La semana arranca el LUNES y se alinea al calendario, igual que en web:
  // "los últimos siete días" es más exacto y se ve mal, porque las letras
  // salen corridas y eso se lee como un error.
  const diaDeSemana = (deISO(hoy).getDay() + 6) % 7;
  const lunes = restarDias(hoy, diaDeSemana);
  const semana = Array.from({ length: 7 }, (_, i) => {
    const fecha = restarDias(lunes, -i);
    const log = logs.find((l) => l.fecha === fecha);
    let estadoDia: 'lleno' | 'vacio' | 'descanso' | 'futuro' | 'cubierto' = 'vacio';
    if (fecha > hoy) estadoDia = 'futuro';
    else if (log && !log.es_descanso) estadoDia = 'lleno';
    else if ((log && log.es_descanso) || esDiaDeDescanso(descansos, fecha)) estadoDia = 'descanso';
    else if (cubiertos.includes(fecha)) estadoDia = 'cubierto';
    return { fecha, estadoDia, esHoy: fecha === hoy };
  });

  return (
    <View style={estilos.raiz}>
      <FondoEspacial
        rango={perfil.rango_actual}
        planeta={planeta}
        apagado={perdida}
        vacio={sinNada}
        reposo={esDescanso}
        fantasma={fantasma}
        presagio={hayPresagio(racha)}
        esquina="abajo-derecha"
        // Como en la web: Inicio es la única pantalla con atmósfera.
        atmosfera
      />
    <ScrollView
      ref={scroll}
      contentContainerStyle={estilos.pantalla}
      scrollEventThrottle={32}
      onScroll={(e) => (desplazado.current = e.nativeEvent.contentOffset.y)}
    >
      <View style={estilos.cabecera}>
        {/* LA CABECERA ES LA PUERTA AL PERFIL, igual que en la web: el avatar
            y el nombre juntos y tocables. Antes el nombre era un texto y no
            llevaba a ningún lado — no porque se hubiera decidido así, sino
            porque no había adónde ir. */}
        {/* POR QUÉ NO SE PODÍA ENTRAR AL PERFIL ENTRENANDO (25/9).
            La fila no se achicaba. Con la sesión corriendo aparecen DOS chips a
            la derecha —el cronómetro y el descanso— y entre el avatar, el
            nombre y las medallas, esta fila necesitaba más ancho del que había:
            se salía por la izquierda de la pantalla y lo que quedaba tocable
            era una franja de pocos píxeles, cuando quedaba alguna. Sin sesión
            hay un solo chip, entra todo, y por eso el perfil se abría bien.
            `flexShrink` es lo que hace que ceda el nombre en vez de la fila. */}
        <Pressable
          style={estilos.yo}
          onPress={() => router.push('/yo')}
          accessibilityRole="button"
          accessibilityLabel={T.nav.yo}
          hitSlop={10}
        >
          <Avatar url={perfil.avatar_url} nombre={perfil.username} tam={28} />
          <Text style={estilos.usuario} numberOfLines={1}>
            {perfil.username}
          </Text>
          {/* LAS MEDALLAS TAMBIÉN ACÁ, y sin tocar: esta fila entera ya es un
              botón que lleva al perfil, y una medalla que se abriera sola
              competiría con ese toque. Se ven; para saber qué son, se entra. */}
          <FilaDeMedallas medallas={medallas} />
        </Pressable>
        {/* El chip de la sesión, arriba a la derecha como en la web: sin
            sesión la inicia; con sesión, es el reloj. */}
        {sesion.estado.corriendo && sesion.estado.inicio ? (
          <View style={estilos.sesionViva}>
            <View style={estilos.chip}>
              <View style={estilos.latido} />
              <Text style={estilos.chipTexto}>
                {cronoLindo(transcurrido(sesion.estado.inicio, sesion.estado.desfasaje))}
              </Text>
            </View>
            {/* LA PÍLDORA DEL DESCANSO: sin descanso lo arranca; con uno
                andando muestra lo que falta y abre la pantalla grande. */}
            {sesion.estado.descanso ? (
              <Pressable
                style={[estilos.chip, restante(sesion.estado.descanso.fin) === 0 && estilos.chipListo]}
                onPress={() => setDescansoAbierto(true)}
                accessibilityRole="button"
              >
                <Text style={[estilos.chipTexto, restante(sesion.estado.descanso.fin) === 0 && estilos.chipTextoListo]}>
                  {restante(sesion.estado.descanso.fin) === 0 ? T.sesion.listo : cuentaAtras(restante(sesion.estado.descanso.fin))}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={estilos.chip}
                onPress={() => {
                  void sesion.descansarSuelto();
                  setDescansoAbierto(true);
                }}
                accessibilityRole="button"
              >
                <Text style={estilos.chipTexto}>{T.sesion.descansar}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            style={[estilos.chip, sesion.estado.ocupado && estilos.apagado]}
            onPress={() => sesion.empezar()}
            disabled={sesion.estado.ocupado}
            accessibilityRole="button"
          >
            <Text style={estilos.chipTexto}>{sesion.estado.ocupado ? '…' : T.inicio.iniciarEntrenamiento}</Text>
          </Pressable>
        )}
      </View>

      {/* EL NÚMERO ESTÁ SIEMPRE (25/9). Estuvo escondido durante la sesión
          con el argumento de que "mientras entrenás, Inicio es el
          entrenamiento", y el pedido fue el contrario y es más simple: *"la
          racha desaparece cuando inicio el entrenamiento. Ya pedí que se
          quedara y quedó al revés. El número tiene que estar siempre."*

          Y tiene razón hasta por lo que la app dice de sí misma: la racha es
          LO QUE CUENTA esta app. Esconderla justo en el momento en que estás
          sumándole un día es esconder el marcador mientras metés el gol.

          LA TIRA DE LA SEMANA SÍ SE VA mientras entrenás, y eso se queda como
          estaba: son siete puntos que no cambian en medio de una sesión y que
          empujan el bloque —lo que se toca doce veces— más abajo. */}
      {/* EL ESTADO VACIO NO DICE "no hay datos" (§11). El dia uno no hay
          racha, ni amigos, ni fotos, y esa es la primera impresion de la
          app: un cero gigante seria un boletin de lo que todavia no hiciste.
          Dos lineas y el fondo, que ya esta ahi detras. */}
      {perfil.racha_actual === 0 && logs.length === 0 ? (
        <View style={estilos.sinNada}>
          <Text style={estilos.vacioTitulo}>{T.inicio.vacioTitulo}</Text>
          <Text style={estilos.vacioPie}>{T.inicio.vacioPie}</Text>
        </View>
      ) : (
        /* LA RACHA CON SU ROTULO AL COSTADO Y LA BARRA DE RANGO (24/9): las
           dos formas que faltaban portar de la web. Ver `RachaConRotulo`. */
        <RachaConRotulo racha={perfil.racha_actual} rango={perfil.rango_actual} />
      )}

      {!sesion.estado.corriendo && (
      <View style={estilos.tira}>
        {semana.map((d) => (
          <View key={d.fecha} style={estilos.tiraDia}>
            <View
              style={[
                estilos.punto,
                d.estadoDia === 'lleno' && estilos.lleno,
                d.estadoDia === 'vacio' && estilos.vacio,
                d.estadoDia === 'futuro' && estilos.futuro,
                (d.estadoDia === 'descanso' || d.estadoDia === 'cubierto') && estilos.vacio,
                d.esHoy && estilos.puntoHoy,
              ]}
            >
              {/* El descanso es un guioncito y el cubierto un punto adentro:
                  ninguno de los dos puede parecer un día perdido, y el
                  cubierto tampoco puede parecer entrenado. */}
              {d.estadoDia === 'descanso' && <View style={estilos.guion} />}
              {d.estadoDia === 'cubierto' && <View style={estilos.cubierto} />}
            </View>
            <Text style={estilos.letra}>{DIAS_SEMANA[deISO(d.fecha).getDay()]}</Text>
          </View>
        ))}
      </View>
      )}

      {impulsos && (
        <View style={estilos.impulsos}>
          <Text style={estilos.impulsosEt}>{T.impulso.titulo}</Text>
          {Array.from({ length: impulsos.total }, (_, i) => (
            <View key={i} style={[estilos.impulso, i < impulsos.quedan && estilos.impulsoVivo]} />
          ))}
        </View>
      )}

      {/* LOS ESTADOS DE BORDE (24/9), que faltaban enteros en el telefono.
          Los cuatro son de una linea y en voz baja: ninguno pide hacer nada,
          los cuatro dicen QUE ES CIERTO AHORA. */}

      {/* El aviso de tiempo solo aparece cuando falta poco DE VERDAD, no a
          la mañana, y esta redactado hacia adelante: "ultimo tramo para el
          48", nunca "vas a perder la racha". */}
      {avisoTiempo && <Text style={estilos.aviso}>{T.inicio.ultimoTramo(perfil.racha_actual + 1)}</Text>}
      {perdida && <Text style={estilos.aviso}>{T.inicio.perdida}</Text>}
      {esDescanso && <Text style={estilos.aviso}>{T.inicio.hoyDescansa}</Text>}
      {/* EL DIA QUE LA GUARDA DEJO ESPERANDO. Se dice aca y no solo en la
          hoja: podes cerrar la app y volver, y lo que no podes es quedarte
          pensando que perdiste el dia (§11). */}
      {perfil.dia_pendiente && <Text style={estilos.aviso}>{T.inicio.diaPendiente}</Text>}

      {/* MARCA TU GIMNASIO, mientras no este marcado. Se RECUERDA, no se
          insiste: es un globo quieto que lleva a Ajustes, y no aparece
          mientras entrenas — ahi la pantalla es el entrenamiento.

          Y SE CALLA CUANDO HABLA LA TARJETA de abajo, que dice lo mismo con
          mas fuerza porque el dia se acaba de anotar a mano. Dos carteles
          sobre lo mismo en la misma pantalla no son el doble de insistencia:
          son ruido. */}
      {!perfil.gimnasio_lat && !sesion.estado.corriendo && !insistirGimnasio && (
        <Pressable style={estilos.globoQuieto} onPress={() => irAPestana('ajustes')}>
          <Text style={estilos.globoTexto}>{T.inicio.gimnasioRecordatorioNativo}</Text>
        </Pressable>
      )}

      {aviso !== '' && <Text style={estilos.aviso}>{aviso}</Text>}
      {sesion.estado.aviso !== '' && <Text style={estilos.aviso}>{sesion.estado.aviso}</Text>}

      {sesion.estado.corriendo && sesion.estado.inicio ? (
        <View style={estilos.sesion}>
          {/* SE CIERRA SOLO CON EL PRIMER `+`: para entonces ya se entendió qué
              hace, y la pregunta de marca —que sale después de un `+`— nunca lo
              encuentra abierto. */}
          <GloboPrimeraVez cual="series" cerrarCuando={sesion.estado.series > 0}>
            {T.inicio.globoSeries}
          </GloboPrimeraVez>
          {/* El reloj ya está arriba, en el chip: acá manda el bloque, que es
              lo que se toca doce veces por sesión. */}
          <Bloque
            estado={sesion.estado.bloques}
            total={sesion.estado.series}
            unidad={perfil.unidad_peso === 'lb' ? 'lb' : 'kg'}
            cargaConsultada={sesion.estado.cargaConsultada}
            alSumar={sesion.serieHecha}
            alRestar={sesion.deshacerSerie}
            alSiguiente={sesion.bloqueSiguiente}
            alElegirEjercicio={sesion.elegirEjercicio}
            alMudarSeries={sesion.mudarSeries}
            alElegirMeta={sesion.elegirMeta}
            alTocarBloque={sesion.tocarBloque}
            alElegirPeso={sesion.elegirPeso}
            alCorregirPeso={sesion.corregirPesoDeSerie}
            alElegirCarga={sesion.elegirCarga}
            alCorregirCarga={sesion.corregirCargaDeBloque}
            alCorregirEjercicio={sesion.corregirEjercicioDeBloque}
            debajoDelMas={
              // "¿Lo guardo como marca?", en el momento de la serie.
              <MarcaEnElMomento
                bloques={sesion.estado.bloques}
                inicio={sesion.estado.inicio}
                unidad={perfil.unidad_peso === 'lb' ? 'lb' : 'kg'}
                principal={paletaDe(perfil.rango_actual ?? 1, null).principal}
                alAparecer={traerALaVista}
              />
            }
          />
          {sesion.estado.porUbicacion && <Text style={estilos.nota}>{T.inicio.sesionSola}</Text>}

          {terminando ? (
            <>
              <Text style={estilos.pregunta}>
                {T.sesion.terminarPregunta}{' '}
                <Text style={estilos.preguntaFuerte}>
                  {T.sesion.terminarLlevas(
                    sesion.estado.series,
                    duracionLinda(transcurrido(sesion.estado.inicio, sesion.estado.desfasaje))
                  )}
                </Text>
              </Text>
              {/* "Seguir" se queda con el botón sólido: el que llegó acá sin
                  querer toca donde ya estaba tocando y no pasa nada. */}
              <Pressable style={estilos.solido} onPress={() => setTerminando(false)}>
                <Text style={estilos.textoSolido}>{T.sesion.seguir}</Text>
              </Pressable>
              <Pressable
                style={estilos.secundario}
                disabled={sesion.estado.ocupado}
                onPress={async () => {
                  const c = await sesion.terminar();
                  setTerminando(false);
                  // Sin resumen si la base deshizo el día: no hubo
                  // entrenamiento, y festejar un toque sin querer es peor.
                  if (c && !c.deshizoElDia) {
                    setCierre(c);
                    setMinutosDeHoy(c.minutos);
                  }
                  cargar();
                }}
              >
                <Text style={estilos.enlace}>{sesion.estado.ocupado ? T.sesion.guardando : T.sesion.terminar}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={estilos.solido} onPress={() => setTerminando(true)}>
              <Text style={estilos.textoSolido}>{T.sesion.terminar}</Text>
            </Pressable>
          )}
        </View>
      ) : cierre ? (
        // AL TERMINAR, PRIMERO LOS DOS BOTONES Y DESPUÉS EL RESUMEN (25/9).
        //
        // "No aparece dónde agregar el peso de hoy." / "Falta un botón para
        // agregar foto." Estaban — en `DiaListo`— pero justo en el momento en
        // que hacen falta no se dibujaban: al terminar una sesión, esta rama se
        // quedaba con la pantalla y `DiaListo` es la rama de al lado. O sea que
        // el único día en que la app te felicita era el único día sin forma de
        // sumarle la foto.
        //
        // Y EL RESUMEN VA ABAJO Y MÁS CHICO: *"me encanta, pero hacelo más
        // chico y poné arriba los botones de foto y peso"*. Es un premio, no
        // una pantalla: se lee una vez y lo que queda por HACER tiene que estar
        // primero.
        <>
          <DiaListo
            alaFoto={() => setRegistrarAbierto(true)}
            alPeso={() => setPesoAbierto(true)}
            minutos={minutosDeHoy}
          />
          <Pressable style={estilos.resumen} onPress={() => setCierre(null)}>
            <Text style={estilos.resumenTitulo}>{T.sesion.resumenTitulo}</Text>
            <View style={estilos.cifras}>
              <View style={estilos.cifra}>
                <Text style={estilos.cifraNumero}>{cierre.minutos}</Text>
                <Text style={estilos.etiqueta}>{T.sesion.resumenMinutos}</Text>
              </View>
              {cierre.series > 0 && (
                <View style={estilos.cifra}>
                  <Text style={estilos.cifraNumero}>{cierre.series}</Text>
                  <Text style={estilos.etiqueta}>{T.sesion.resumenSeries(cierre.series)}</Text>
                </View>
              )}
            </View>
            {cierre.porUbicacion && <Text style={estilos.nota}>{T.sesion.resumenSolo}</Text>}
            {/* Afuera del toque que cierra: elegir repeticiones no cierra nada. */}
            <SugerenciasDeMarca bloques={cierre.bloques} unidad={perfil.unidad_peso === 'lb' ? 'lb' : 'kg'} />
          </Pressable>
        </>
      ) : registradoHoy ? (
        // El día ya está —casi siempre lo registró la sesión—: lo que queda es
        // sumarle la foto o el peso. Era un renglón de texto que no parecía un
        // botón; ahora es lo mismo que la web. Ver `DiaListo.tsx`.
        <>
          <DiaListo
            alaFoto={() => setRegistrarAbierto(true)}
            alPeso={() => setPesoAbierto(true)}
            minutos={minutosDeHoy}
          />
          {/* Y ACÁ SE INSISTE CON EL PUNTO DEL GIMNASIO: pegado al día que se
              acaba de anotar a mano, que es el único momento en que la oferta
              se puede demostrar en vez de explicar. Tres veces como mucho, una
              por día; la regla está en `nucleo/insistirGimnasio.ts`. */}
          {insistirGimnasio && <InsistirGimnasio alMarcar={() => irAPestana('ajustes')} />}
        </>
      ) : (
        <>
          <Pressable style={estilos.solido} onPress={() => setRegistrarAbierto(true)}>
            <Text style={estilos.textoSolido}>{T.inicio.registrarDia}</Text>
          </Pressable>
          {/* PEGADO AL PRINCIPAL, como en la web: el peso NO pasa por registrar
              el día —pesarse no es haber ido al gimnasio— pero tiene que poder
              anotarse cualquier día, entrenes o no. */}
          <Pressable style={estilos.secundario} onPress={() => setPesoAbierto(true)}>
            <Text style={estilos.enlace}>{T.peso.anotarPeso}</Text>
          </Pressable>
        </>
      )}

      <PesoHoja
        visible={pesoAbierto}
        unidad={perfil.unidad_peso === 'lb' ? 'lb' : 'kg'}
        alCerrar={() => setPesoAbierto(false)}
        alGuardar={cargar}
      />

      <RegistrarDia
        visible={registrarAbierto}
        racha={perfil.racha_actual}
        logId={logs.find((l) => l.fecha === hoy && !l.es_descanso)?.id ?? null}
        visibilidadDefault={perfil.visibilidad_default}
        alCerrar={() => setRegistrarAbierto(false)}
        alConfirmar={(r) => {
          setRegistrarAbierto(false);
          cargar();
          if (r?.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
        }}
      />

      {/* No sale con una sesión andando, igual que en la web: aparece al
          terminarla. Contestar la ventana en medio de una serie no es el
          momento. */}
      {/* SUBISTE DE RANGO. Va antes que cualquier otra ventana: si el mismo
          dia se salvo la racha y ademas se subio de rango, lo que hay que
          contar es el rango. */}
      {subida && (
        <SubidaRango
          rangoAntes={subida.antes}
          rangoDespues={subida.despues}
          planeta={planeta}
          racha={perfil.racha_actual}
          alCerrar={() => setSubida(null)}
        />
      )}

      {vidaUsada && !sesion.estado.corriendo && (
        <RachaSalvada
          dias={vidaUsada.dias}
          quedan={vidaUsada.quedan}
          total={vidaUsada.total}
          rachaSiGuarda={rachaSiSeDevuelve(perfil.racha_actual)}
          alGuardar={async () => {
            // Devolver y volver a evaluar la pérdida van juntos en la base.
            const { data, error } = await supabase.rpc('devolver_impulsos', { p_fechas: vidaUsada.dias });
            if (error || !data) return false;
            await cargar();
            return true;
          }}
          alCerrar={async () => {
            // Cerrar es lo que ANOTA: hasta que no se cierra, el aviso vuelve.
            const dias = vidaUsada.dias;
            setVidaUsada(null);
            const hasta = hastaDondeVisto(dias, await plataforma.almacenamiento.leer(CLAVE_VIDA_VISTA));
            if (hasta) await plataforma.almacenamiento.guardar(CLAVE_VIDA_VISTA, hasta);
          }}
        />
      )}

      {sesion.estado.descanso && (
        <Descanso
          visible={descansoAbierto}
          vivo={sesion.estado.descanso}
          alReiniciar={sesion.reiniciarDescanso}
          alSaltar={() => {
            setDescansoAbierto(false);
            sesion.cerrarDescanso();
          }}
          alOcultar={() => setDescansoAbierto(false)}
          alSumar={sesion.serieHecha}
        />
      )}
    </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  // Transparente: el fondo lo dibuja `FondoRaiz`, detrás de todas las
  // pestañas. Un color acá lo taparía.
  raiz: { flex: 1 },
  // Transparente: detrás está el fondo, que ya pinta el color de base.
  pantalla: { flexGrow: 1, padding: 24, paddingTop: 64 },
  centrado: { flex: 1, backgroundColor: '#05060a', alignItems: 'center', justifyContent: 'center', gap: 16 },
  // FLEXIBLE Y CON MINIMO: cede el nombre, nunca la fila entera. Ver el
  // comentario de la cabecera.
  yo: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 96 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  usuario: { color: '#e8ecf6', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  etiqueta: { color: '#8a93a8', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase' },
  racha: { color: '#c4c2ba', fontSize: 92, fontWeight: '300', lineHeight: 100 },

  tira: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 34 },
  tiraDia: { alignItems: 'center', gap: 7 },
  punto: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  lleno: { backgroundColor: '#7e8ca8' },
  vacio: { borderWidth: 1, borderColor: '#2a3040' },
  futuro: { borderWidth: 1, borderColor: '#171c26' },
  puntoHoy: { borderWidth: 1, borderColor: '#c4c2ba' },
  guion: { width: 10, height: 2, borderRadius: 1, backgroundColor: '#4a5163' },
  cubierto: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6b7488' },
  letra: { color: '#4a5163', fontSize: 11 },

  impulsos: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 26 },
  impulsosEt: {
    color: '#4a5163',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginRight: 4,
  },
  impulso: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: '#3a4152' },
  impulsoVivo: { backgroundColor: '#c4c2ba', borderColor: '#c4c2ba' },

  solido: {
    backgroundColor: '#c4c2ba',
    borderRadius: 2,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 34,
  },
  apagado: { opacity: 0.6 },
  textoSolido: { color: '#05060a', fontSize: 15, fontWeight: '600' },
  // `vacio` ya era el punto apagado de la tira de la semana: este es otro.
  sinNada: { marginTop: 26, marginBottom: 10, gap: 6 },
  vacioTitulo: { color: '#e8ecf6', fontSize: 20, fontWeight: '300' },
  vacioPie: { color: '#8a93a8', fontSize: 14, lineHeight: 20 },
  globoQuieto: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#1d2230',
  },
  globoTexto: { color: '#8a93a8', fontSize: 13, lineHeight: 18 },
  aviso: { color: '#8a93a8', fontSize: 13, marginTop: 20, textAlign: 'center', lineHeight: 19 },
  error: { color: '#e8705f', fontSize: 13, textAlign: 'center' },
  enlace: { color: '#8a93a8', fontSize: 13 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#2a3040',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  chipTexto: { color: '#c4c2ba', fontSize: 13, fontVariant: ['tabular-nums'] },
  latido: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7e8ca8' },
  // No se achica: los dos chips son numeros y un numero cortado no se lee.
  sesionViva: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  chipListo: { backgroundColor: '#c4c2ba', borderColor: '#c4c2ba' },
  chipTextoListo: { color: '#05060a' },

  sesion: { marginTop: 16 },
  crono: { color: '#e8ecf6', fontSize: 44, fontWeight: '300', fontVariant: ['tabular-nums'], marginTop: 4 },
  nota: { color: '#4a5163', fontSize: 12, lineHeight: 17, marginTop: 8 },
  pregunta: { color: '#8a93a8', fontSize: 14, lineHeight: 20, marginTop: 24 },
  preguntaFuerte: { color: '#e8ecf6', fontWeight: '600' },
  secundario: { paddingVertical: 14, alignItems: 'center' },

  // MAS CHICO QUE ANTES (25/9): era marginTop 34 y 22 de alto con el numero
  // en 40. Es un premio, se lee una vez, y arriba de el va lo que queda por
  // hacer.
  resumen: {
    marginTop: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#1d2230',
  },
  resumenTitulo: { color: '#e8ecf6', fontSize: 14, fontWeight: '500' },
  cifras: { flexDirection: 'row', gap: 28, marginTop: 8 },
  cifra: { alignItems: 'flex-start' },
  cifraNumero: { color: '#c4c2ba', fontSize: 26, fontWeight: '300', fontVariant: ['tabular-nums'] },
});
