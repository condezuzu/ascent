'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { enDias, hoyISO, restarDias, deISO } from '@nucleo/fechas';
import { transcurrido, duracionLinda } from '@nucleo/sesiones';
import { planetaDeDia, progresoEnRango, rangoDeRacha, siguienteRango } from '@nucleo/rangos';
import { citaDelDia } from '@nucleo/frases';
import { hayPresagio } from '@nucleo/atmosfera';
import { esDiaDeDescanso, type ConfigDescanso } from '@nucleo/descansos';
import { guardarPerfilCache, leerPerfilCache } from '@compartido/cache';
import { perfilFresco, perfilVivo } from '@compartido/perfilVivo';
import { pedirInicio, type DatosDeInicio } from '@compartido/inicio';
import { marca } from '@/lib/medir';
import { sincronizarZona } from '@/lib/zona';
import { marcarPunto } from '@/lib/gimnasio';
import { plataforma } from '@/plataforma';
import { eventos } from '@compartido/eventos';
import { DIA_CAMBIO, SUBIO_RANGO } from '@/components/VigilanteDeGimnasio';
import { lineaDeMarcas } from '@nucleo/fuerza';
import { impulsosSinVer, hastaDondeVisto, rachaSiSeDevuelve, CLAVE_VIDA_VISTA } from '@nucleo/impulsos';
import type { Log, MiFuerza, Perfil, ResultadoRegistro } from '@nucleo/tipos';
import type { CierreDeSesion } from '@compartido/usarSesion';
import FondoEspacial from '@/components/FondoEspacial';
import TiraSemanal from '@/components/TiraSemanal';
import RegistrarSheet from '@/components/RegistrarSheet';
import PesoSheet from '@/components/PesoSheet';
import SubidaRango from '@/components/SubidaRango';
import ResumenSesion from '@/components/ResumenSesion';
import GloboPrimeraVez from '@/components/GloboPrimeraVez';
import Bloque from '@/components/Bloque';
import DiaSumado from '@/components/DiaSumado';
import RachaSalvada from '@/components/RachaSalvada';
import AccionPrincipal from '@/components/AccionPrincipal';
import NumeroQueCuenta from '@/components/NumeroQueCuenta';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import ChipSesion from '@/components/ChipSesion';
import Descanso from '@/components/Descanso';
import { usarSesion } from '@compartido/usarSesion';
import { T } from '@nucleo/textos';

type LineaSocial = { username: string; racha: number } | null;

// El último día que entró SOLO y que esta persona ya vio. Guarda la fecha, no
// un booleano: si guardara "ya lo vi" habría que acordarse de borrarlo cada
// medianoche, y el día que fallara ese borrado el mensaje no volvería a
// aparecer nunca más.
const CLAVE_LLEGADA_VISTA = 'ascent:llegada-vista';

// Hasta qué día cubierto se anunció ya en ESTE aparato. Una fecha y no un
// booleano, por lo mismo que la de arriba: un booleano habría que acordarse de
// limpiarlo, y el día que ese borrado fallara el aviso no volvería nunca.
//
// SE ESCRIBE AL CERRAR LA VENTANA, no al abrirla. Si se escribiera al abrirla,
// cerrar la app antes de leerla sería perderse el aviso para siempre — que es
// EXACTAMENTE el bug que esto arregla. Escribiendo al cerrar, lo peor que
// puede pasar es que vuelva a aparecer una vez.
const CLAVE_IMPULSO_VISTO = CLAVE_VIDA_VISTA;

export default function Principal() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [descansos, setDescansos] = useState<ConfigDescanso[]>([]);
  const [social, setSocial] = useState<LineaSocial>(null);
  const [marcas, setMarcas] = useState<string | null>(null);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [pesoAbierto, setPesoAbierto] = useState(false);
  const [descansoAbierto, setDescansoAbierto] = useState(false);
  // El toque que pregunta si de verdad se termina la sesión.
  const [terminando, setTerminando] = useState(false);
  const [subida, setSubida] = useState<{ antes: number; despues: number } | null>(null);
  // Lo que dejó la sesión al cerrarse, para el resumen del final.
  const [cierre, setCierre] = useState<CierreDeSesion | null>(null);
  // El día entró solo Y esta persona todavía no lo vio. Es lo que convierte
  // "Día registrado" —idéntico a haberlo apretado— en un descubrimiento.
  const [llegadaNueva, setLlegadaNueva] = useState(false);
  // El día que se acaba de sumar, para la animación. Ver `DiaSumado`.
  const [sumando, setSumando] = useState(false);
  const [perdida, setPerdida] = useState(false);
  // Los días de este mes que una vida cubrió, para la tira semanal.
  const [cubiertos, setCubiertos] = useState<string[]>([]);
  // Los días cubiertos que esta persona TODAVÍA NO VIO.
  //
  // ANTES SALÍAN DE `verificar_perdida`, que reporta lo que cubrió SOLO en la
  // llamada que lo cubrió, y el comentario que había acá decía que eso era una
  // ventaja: "no hace falta guardar si ya se mostró, porque el hecho no se
  // repite". Estaba mal, y el bug es que a veces no avisaba nada. El hecho no
  // se repite, pero el REPORTE es de una sola llamada: si esa llamada pasaba
  // con una sesión corriendo, o la pantalla se volvía a montar, o cualquier
  // otra llamada llegaba primero, el aviso se perdía para siempre y el día
  // quedaba cubierto sin que nadie se enterara.
  //
  // Ahora sale del ESTADO: `mis_vidas` dice qué días están cubiertos y el
  // aparato se acuerda de hasta dónde anunció. Se puede preguntar mil veces.
  const [impulsoUsado, setImpulsoUsado] = useState<{
    dias: string[];
    quedan: number;
    total: number;
  } | null>(null);
  // El unico momento en que es probable que la persona este parada en el
  // gimnasio es JUSTO despues de registrar el dia. Ahi se pide el punto, y
  // solo ahi. Nunca al empezar la sesion (§13): a esa hora casi nadie llego.
  const [pedirGimnasio, setPedirGimnasio] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [avisoGimnasio, setAvisoGimnasio] = useState('');
  const [cargado, setCargado] = useState(false);
  const [noCargo, setNoCargo] = useState(false);
  // Si alguna vez hubo un perfil en pantalla —de la caché o de la red—. Con
  // uno a la vista, una falla NO se contesta con el cartel de error: se deja
  // lo que se está viendo, que es viejo pero es de esta persona.
  const huboCache = useRef(false);

  // La línea social se carga aparte y después: no puede demorar el dibujo
  // de la pantalla, que es lo único que el usuario vino a ver.
  const cargarSocial = useCallback(
    async (uid: string) => {
      const { data: amistades } = await supabase
        .from('friendships')
        .select('solicitante, destinatario')
        .eq('estado', 'aceptada');
      const amigos = (amistades ?? []).map((a) =>
        a.solicitante === uid ? a.destinatario : a.solicitante
      );
      if (amigos.length === 0) return;
      const { data: ultimo } = await supabase
        .from('logs')
        .select('user_id, fecha')
        .in('user_id', amigos)
        .eq('es_descanso', false)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ultimo) return;
      const { data: quien } = await supabase
        .from('usuarios_publicos')
        .select('username, racha_actual')
        .eq('id', ultimo.user_id)
        .maybeSingle();
      if (quien) setSocial({ username: quien.username, racha: quien.racha_actual });
    },
    [supabase]
  );

  // `deArranque` decide si el perfil se puede COMPARTIR con el vigilante del
  // armazon, que lo pide al mismo tiempo. Solo la carga del arranque puede:
  // las demas vienen despues de escribir y necesitan leer de nuevo, porque un
  // pedido que salio antes de la escritura trae la racha vieja.
  // LOS IMPULSOS, que llegan por los dos caminos y se leen igual: los días
  // cubiertos para que la tira no dibuje un agujero donde hubo una vida, y el
  // aviso de los que esta persona todavía no vio.
  const leerImpulsos = useCallback(async (data: DatosDeInicio['impulsos']) => {
    if (!data) return;
    if (Array.isArray(data.vigentes)) setCubiertos(data.vigentes as string[]);

    // `ultimas` son los últimos días cubiertos y vigentes; la marca dice hasta
    // dónde se anunció en ESTE aparato. Lo que quede en el medio es lo que
    // esta persona no vio.
    const ultimas = Array.isArray(data.ultimas) ? (data.ultimas as string[]) : [];
    const sinVer = impulsosSinVer(ultimas, await plataforma.almacenamiento.leer(CLAVE_IMPULSO_VISTO));
    if (sinVer.length > 0) {
      setImpulsoUsado({
        dias: sinVer,
        quedan: Number(data.quedan ?? 0),
        total: Number(data.total ?? 0),
      });
    }
  }, []);

  // EL CAMINO VIEJO, entero y sin tocar: cuatro tandas de pedidos encadenadas.
  // Se usa cuando la migración 43 todavía no corrió en la base. No es código
  // muerto ni es temporal de mentira: una base vieja y un cliente nuevo es
  // exactamente lo que pasa entre que se publica la app y se corre la
  // migración, y esa ventana no puede ser una pantalla rota.
  const cargarEncadenado = useCallback(
    async (uid: string, deArranque: boolean) => {
      const desde = restarDias(hoyISO(), 6);
      const [p, { data: ls }, { data: v }, { data: cfgs }] = await Promise.all([
        deArranque ? perfilVivo(supabase, uid) : perfilFresco(supabase, uid),
        supabase.from('logs').select('*').eq('user_id', uid).gte('fecha', desde).order('fecha'),
        supabase.rpc('verificar_perdida'),
        supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
      ]);
      if (!p) return null;
      // Si hubo pérdida, el perfil que trajimos quedó viejo: se relee. Esta es
      // la ida y vuelta de más que el camino nuevo no necesita, porque adentro
      // de la función la pérdida corre ANTES de leer el perfil.
      const fresco = v?.perdida ? (await perfilFresco(supabase, uid)) ?? p : p;
      return {
        perfil: fresco,
        logs: (ls ?? []) as Log[],
        descansos: (cfgs ?? []) as ConfigDescanso[],
        perdida: (v ?? null) as DatosDeInicio['perdida'],
      };
    },
    [supabase]
  );

  const cargar = useCallback(async (deArranque: boolean) => {
    // getSession lee la cookie sin ir a la red; el JWT igual lo valida la
    // base en cada consulta, así que no se pierde nada de seguridad.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return router.push('/login');

    // UN SOLO PEDIDO, y si la migración no corrió, el camino viejo.
    const r = await pedirInicio(supabase);

    let p: Perfil | null = null;
    let perdida: DatosDeInicio['perdida'] = null;
    let despues: (() => void) | null = null;

    if (r.tipo === 'listo') {
      p = r.datos.perfil;
      perdida = r.datos.perdida;
      if (p) {
        setLogs(r.datos.logs);
        setDescansos(r.datos.descansos);
        // Estos tres venían en las tandas 2, 3 y 4. Ahora ya están en la mano:
        // se aplican DESPUÉS de dibujar igual, para no alargar el render que
        // pone la racha en pantalla, pero sin costar un viaje más.
        const d = r.datos;
        const unidad = p.unidad_peso ?? 'kg';
        despues = () => {
          leerImpulsos(d.impulsos);
          if (d.fuerza) setMarcas(lineaDeMarcas(d.fuerza.marcas, unidad));
          setSocial(d.social);
        };
      }
    } else if (r.tipo === 'sin-funcion') {
      const viejo = await cargarEncadenado(uid, deArranque);
      if (viejo) {
        p = viejo.perfil;
        perdida = viejo.perdida;
        setLogs(viejo.logs);
        setDescansos(viejo.descansos);
        despues = () => {
          cargarSocial(uid);
          supabase.rpc('mis_impulsos').then(({ data, error }) => {
            if (!error) leerImpulsos(data as DatosDeInicio['impulsos']);
          });
          supabase.rpc('mi_fuerza').then(({ data }) => {
            const f = data as MiFuerza | null;
            if (f) setMarcas(lineaDeMarcas(f.marcas, p?.unidad_peso ?? 'kg'));
          });
        };
      }
    }

    // NO VINO EL PERFIL. Antes esto era un `return` mudo y la pantalla se
    // quedaba en el armazón para siempre, sin error y sin nada que tocar: en
    // el subsuelo de un gimnasio, quedarse afuera de la app sin forma de
    // salir. Por eso existe la pantalla de reintento.
    //
    // PERO SI YA HAY PERFIL EN PANTALLA —el de la caché, que se dibuja antes
    // de salir a la red— tapar todo con un cartel de error es peor: la persona
    // tenía su racha y su paleta a la vista y se las cambiamos por "no se
    // pudo". Mejor la pantalla de ayer. La de reintento queda para cuando de
    // verdad no hay NADA que mostrar, que es el caso que la hizo necesaria.
    if (!p) {
      setNoCargo(!huboCache.current);
      return;
    }
    setNoCargo(false);
    if (!p.username) return router.push('/onboarding');

    if (perdida?.perdida) setPerdida(true);
    setPerfil(p);
    guardarPerfilCache(p);
    huboCache.current = true;
    setCargado(true);
    marca('ascent:pantalla-lista');
    despues?.();

    // La zona del teléfono, para que el día corte donde está el usuario. Va
    // después de dibujar y solo escribe si cambió: es una llamada por viaje,
    // no una por arranque. El usuario nunca la ve ni la configura.
    sincronizarZona(supabase);
  }, [supabase, router, cargarSocial, cargarEncadenado, leerImpulsos]);

  // El cronómetro vive acá desde §20: empezar pasa una vez por entrenamiento
  // y no merecía una pestaña, pero sí estar a la vista.
  const sesion = usarSesion((r) => {
    if (r?.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
    cargar(false);
  });

  // Por refs y no por dependencias: `sesion`, `perfil` y `logs` cambian en
  // cada render, y el vigilante los necesita frescos adentro. Con
  // dependencias, el efecto se desarmaría y se rearmaría —y volvería a pedir
  // el GPS— una vez por segundo, que es justo lo que no hay que hacer.
  const sesionRef = useRef(sesion);
  sesionRef.current = sesion;
  const perfilRef = useRef(perfil);
  perfilRef.current = perfil;
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const ultimaMirada = useRef(0);
  const mirando = useRef(false);

  /**
   * Mirar el gimnasio y actuar: registrar el día al llegar (§13), arrancar la
   * sesión cuando se quedó el rato suficiente, y cerrarla cuando se fue.
   *
   * UNA SOLA lectura de GPS para las dos cosas: preguntar dos veces sería
   * pagar la antena dos veces por la misma respuesta.
   *
   * El día se registra AL INSTANTE y la sesión espera siete minutos. No es una
   * inconsistencia: el día es un hecho —fuiste— y la sesión es una medición,
   * que si arranca antes de que empieces a entrenar mide mal.
   */
  // ---- el día que entró solo, la primera vez que se lo ve ----
  //
  // SE PERDIÓ AL MUDAR EL VIGILANTE y estuvo muerto una tanda entera: el
  // recorte se llevó este efecto de paso, así que `llegadaNueva` nunca se
  // ponía en true y el mensaje no aparecía nunca. No lo agarró ningún test
  // porque no hay ninguno que mire esta pantalla con un día por ubicación.
  //
  // Llegar al gimnasio y que el día se registre en el bolsillo es lo único
  // que la app hace y ninguna otra. Se dice una sola vez por día y se anota
  // enseguida: un mensaje que aparece cada vez que abrís la app deja de ser
  // una noticia y pasa a ser decorado.
  useEffect(() => {
    (async () => {
      const dia = hoyISO();
      const log = logs.find((l) => l.fecha === dia);
      if (!log || log.origen !== 'ubicacion') return;
      const visto = await plataforma.almacenamiento.leer(CLAVE_LLEGADA_VISTA);
      if (visto === dia) return;
      setLlegadaNueva(true);
      // Y ACÁ TAMBIÉN VA LA ANIMACIÓN. Antes solo salía por la hoja de
      // "Registrar día", o sea por el camino que en un día de gimnasio de
      // verdad nunca se usa: el día entra por ubicación y el momento que
      // construimos no se disparaba justo los días que importan.
      setSumando(true);
      await plataforma.almacenamiento.guardar(CLAVE_LLEGADA_VISTA, dia);
    })();
  }, [logs]);

  // EL VIGILANTE DEL GIMNASIO SE MUDÓ A `VigilanteDeGimnasio`, que vive en el
  // armazón. Acá adentro solo miraba estando en esta pestaña: abrir la app en
  // Stats o en el Álbum dejaba el automático apagado, y llegar al gimnasio no
  // es un asunto de una pantalla. Esta pantalla ahora solo ESCUCHA que el día
  // cambió, que es lo único que le importa.
  useEffect(() => eventos.escuchar(DIA_CAMBIO, () => cargar(false)), [cargar]);

  // La subida de rango del día que entró SOLO. Los otros dos caminos la
  // disparan donde el toque termina; este no tenía dónde, porque no hay toque.
  useEffect(
    () =>
      eventos.escuchar(SUBIO_RANGO, (dato) => {
        const r = dato as ResultadoRegistro;
        if (r?.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
      }),
    []
  );


  // Al volver a entrar, la pantalla sale con la racha y la paleta de la
  // última visita mientras la red confirma. Nada de esperar en blanco.
  useEffect(() => {
    // La caché se lee y recién después se pide a la red. Es asíncrona desde
    // que pasó por el puerto de almacenamiento, pero resuelve en el mismo
    // tick en web: no hay parpadeo.
    (async () => {
      const cacheado = await leerPerfilCache();
      if (cacheado) {
        setPerfil(cacheado);
        setCargado(true);
        huboCache.current = true;
      }
      cargar(true);
    })();
  }, [cargar]);

  if (!perfil) {
    // Primera visita sin caché: se muestra el armazón, no una pantalla vacía.
    return (
      <>
        <FondoEspacial rango={1} esquina="abajo-derecha" velo={0.55} />
        <PantallaDeslizable>
          <div className="cabecera">
            <div className="avatar" />
          </div>
          <div className="racha-bloque">
            <div className="racha-fila">
              <span className="racha-label">{T.inicio.racha}</span>
              <span className="racha-numero esqueleto-num">·</span>
            </div>
          </div>
          {noCargo && (
            <div className="no-cargo">
              <p>{T.inicio.noCargo}</p>
              <button className="boton-fantasma" onClick={() => cargar(false)}>
                {T.inicio.reintentar}
              </button>
            </div>
          )}
        </PantallaDeslizable>
        <Nav />
      </>
    );
  }

  const hoy = hoyISO();
  const logHoy = logs.find((l) => l.fecha === hoy) ?? null;
  const registradoHoy = !!logHoy;
  const racha = perfil.racha_actual;
  const sinNada = racha === 0 && logs.length === 0;
  // Mientras se entrena, Inicio se despeja: ver el bloque de abajo.
  const entrenando = sesion.estado.corriendo;
  const prox = siguienteRango(racha);
  const progreso = progresoEnRango(racha);
  const planeta = planetaDeDia(racha);

  // Día de descanso fijo: el objeto se ve desde su lado nocturno y quieto.
  // Sigue entero; no es un estado de falla.
  const esDescanso = esDiaDeDescanso(descansos, hoy) && !registradoHoy;

  // Fantasma de la mejor racha: el objeto más grande que alcanzó alguna vez.
  // Si la racha actual ya lo superó, no se muestra. Tampoco si sería el mismo
  // objeto que el de ahora, porque no se distinguiría del actual.
  const rangoMejor = rangoDeRacha(perfil.mejor_racha).n;
  const planetaMejor = planetaDeDia(perfil.mejor_racha);
  const fantasma =
    racha < perfil.mejor_racha && (rangoMejor !== perfil.rango_actual || planetaMejor !== planeta)
      ? { rango: rangoMejor, planeta: planetaMejor }
      : null;

  // Los últimos días antes de subir: algo sin forma, detrás. No dice qué
  // viene ni cuántos días faltan; solo que hay algo. Le gana al fantasma
  // cuando los dos darían (ver escena.ts).
  const presagio = hayPresagio(racha);

  const cita = citaDelDia(perfil.rango_actual, `${hoy}-${perfil.id}`);

  // El aviso solo aparece cuando falta poco de verdad, no a la mañana.
  // Redacción hacia adelante, nunca hacia la pérdida.
  const hora = new Date().getHours();
  const avisoTiempo = !registradoHoy && racha > 0 && hora >= 19;

  // ---- la ventana de la vida ----
  //
  // Cerrar es lo que ANOTA: hasta que no se cierra, el aviso vuelve. Se marca
  // el máximo de TODO lo que trajo la base y no solo lo que se mostró, para
  // que un día cubierto más viejo que la marca no vuelva a anunciarse.
  async function cerrarImpulsoUsado() {
    const dias = impulsoUsado?.dias ?? [];
    setImpulsoUsado(null);
    const hasta = hastaDondeVisto(dias, await plataforma.almacenamiento.leer(CLAVE_IMPULSO_VISTO));
    if (hasta) await plataforma.almacenamiento.guardar(CLAVE_IMPULSO_VISTO, hasta);
  }

  // "Guardarla para después": la vida vuelve al mes y la racha se corta. La
  // base hace las dos cosas en una sola llamada —devolver y volver a evaluar
  // la pérdida— para que no exista un instante con la vida devuelta y la racha
  // todavía entera.
  async function guardarImpulsos(): Promise<boolean> {
    if (!impulsoUsado) return false;
    const { data, error } = await supabase.rpc('devolver_impulsos', { p_fechas: impulsoUsado.dias });
    if (error || !data) return false;
    if (data?.perdida?.perdida) setPerdida(true);
    await cargar(false);
    return true;
  }

  function alConfirmar(r: ResultadoRegistro | null) {
    setHojaAbierta(false);
    // Solo cuando el día ACABA de entrar. Si `r` viene en null es que ya
    // estaba y solo se le sumó una foto o el peso: ahí no se sumó ninguna
    // masa, y animar igual sería festejar algo que no pasó.
    if (r) setSumando(true);
    // La animación se dispara SOLO después de que la base confirmó. Viene en
    // null cuando el día ya estaba y solo se le sumó foto o peso: ahí no hay
    // subida de rango que festejar.
    if (r?.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
    // `r` en null = el dia ya estaba y solo se le sumo foto o peso: ahi la
    // persona puede estar en cualquier lado. Solo se pregunta cuando el dia
    // ACABA de entrar.
    if (r && !perfil?.gimnasio_lat) setPedirGimnasio(true);
    cargar(false);
  }

  async function marcarDesdeAca() {
    if (!perfil) return;
    setMarcando(true);
    setAvisoGimnasio('');
    const r = await marcarPunto(supabase, perfil.id);
    setMarcando(false);
    if (!r.ok) {
      return setAvisoGimnasio(
        r.motivo === 'sin-gps'
          ? T.ajustes.gimnasioSinGps
          : r.motivo === 'sin-permiso'
            ? T.ajustes.gimnasioSinPermiso
            : T.general.noSePudo
      );
    }
    setPerfil((x) => (x ? { ...x, gimnasio_lat: r.lat, gimnasio_lon: r.lon } : x));
    setPedirGimnasio(false);
  }

  return (
    <>
      <FondoEspacial
        rango={perfil.rango_actual}
        planeta={planeta}
        apagado={perdida}
        vacio={sinNada}
        reposo={esDescanso}
        fantasma={fantasma}
        presagio={presagio}
        esquina="abajo-derecha"
        // Inicio es la ÚNICA pantalla con atmósfera: es la que muestra tu
        // rango, y el velo que se abre solo tiene sentido donde está el
        // objeto. En Stats o en el Álbum sería un efecto suelto.
        atmosfera
      />

      <PantallaDeslizable>
        {/* La cabecera es la puerta al perfil propio Y la casa del
            cronómetro (§20.2): el reloj va acá, discreto, y no en una pestaña
            propia — un cronómetro que hay que buscar no lo usa nadie. */}
        <div className="cabecera">
          <Link href="/yo" className="cabecera-yo">
            <Avatar url={perfil.avatar_url} nombre={perfil.username} />
            <span className="nombre">{perfil.username}</span>
          </Link>
          <ChipSesion
            estado={sesion.estado}
            alEmpezar={sesion.empezar}
            alDescansar={sesion.descansarSuelto}
            alAbrirDescanso={() => setDescansoAbierto(true)}
          />
        </div>

        <div className="racha-bloque">
          <div className="racha-fila">
            <span className="racha-label">{T.inicio.racha}</span>
            {/* Cuenta de 46 a 47 en vez de reemplazarse. Ver
                `NumeroQueCuenta`: la primera pintada NO se anima, porque
                contar desde cero al abrir la app contaría algo falso. */}
            <NumeroQueCuenta valor={racha} className="racha-numero" />
          </div>
          {/* barra de progreso al siguiente rango, sin etiqueta de texto */}
          {prox && (
            <div className="progreso">
              <div style={{ width: `${Math.round(progreso * 100)}%` }} />
            </div>
          )}
        </div>

        {avisoTiempo && <p className="aviso-tiempo">{T.inicio.ultimoTramo(racha + 1)}</p>}
        {perdida && (
          <p className="aviso-tiempo">{T.inicio.perdida}</p>
        )}
        {esDescanso && <p className="aviso-tiempo">{T.inicio.hoyDescansa}</p>}
        {/* El día que la guarda dejó esperando. Se dice acá y no solo en la
            hoja: el usuario puede cerrar la app y volver, y lo que no puede
            es quedarse pensando que perdió el día (§11). */}
        {perfil.dia_pendiente && (
          <p className="aviso-tiempo">{T.inicio.diaPendiente}</p>
        )}

        {/* Con el día ya registrado esto era un cartel muerto, y el día
            quedaba cerrado: no había forma de agregarle la foto ni el peso
            después. Ahora sigue abierto, que es lo único razonable cuando el
            día lo pudo registrar el cronómetro sin preguntar nada. */}
        {/* Con la sesión andando, "Serie hecha" se lleva el botón sólido: es
            lo que más se toca durante un entrenamiento, y el día ya está. */}
        {sesion.estado.corriendo ? (
          <>
            {/* El bloque: qué estás haciendo, cuántas te propusiste, cuántas
                van. Antes era un número suelto con un + y un −, que dice
                cuántas series llevás en toda la sesión y nada más — o sea que
                cuántas van de CADA ejercicio había que llevarlo de memoria.
                El + sigue siendo el mismo gesto de siempre: suma la serie y
                arranca el descanso (§20.3). Ver `lib/bloques.ts`. */}
            <GloboPrimeraVez cual="series">{T.inicio.globoSeries}</GloboPrimeraVez>
            <Bloque
              estado={sesion.estado.bloques}
              total={sesion.estado.series}
              alSumar={sesion.serieHecha}
              alRestar={sesion.deshacerSerie}
              alSiguiente={sesion.bloqueSiguiente}
              alElegirEjercicio={sesion.elegirEjercicio}
              alMudarSeries={sesion.mudarSeries}
              alElegirMeta={sesion.elegirMeta}
              alTocarBloque={sesion.tocarBloque}
              unidad={perfil.unidad_peso === 'lb' ? 'lb' : 'kg'}
              alElegirPeso={sesion.elegirPeso}
              alCorregirPeso={sesion.corregirPesoDeSerie}
              cargaConsultada={sesion.estado.cargaConsultada}
              alElegirCarga={sesion.elegirCarga}
              alCorregirCarga={sesion.corregirCargaDeBloque}
            />
            {/* "Cada + suma la serie y arranca el descanso" lo dice el globo
                de la primera vez, tres renglones más arriba. Repetirlo abajo
                era decir dos veces lo mismo y ocupar la altura que hace que
                Inicio no entre. Lo que SÍ se dice siempre es que el día entró
                solo, porque eso no lo sabe nadie si no se dice. */}
            {sesion.estado.porUbicacion && (
              <p className="nota-privada" style={{ textAlign: 'center', marginTop: 10 }}>
                {T.inicio.sesionSola}
              </p>
            )}
            {/* PREGUNTA ANTES DE TERMINAR. Es el botón sólido y ancho de
                abajo —el más fácil de tocar sin querer con el teléfono en la
                mano— y lo que hace no se deshace: cierra la sesión y fija la
                duración. Se pregunta en el mismo lugar, sin ventana, que es
                lo que ya hace la lista de bloques para quitar uno.

                "Seguir" se queda con el botón sólido: el que llegó acá sin
                querer toca donde ya estaba tocando y no pasa nada. */}
            <AccionPrincipal>
              {terminando ? (
                <>
                  <span className="pregunta-terminar">
                    {T.sesion.terminarPregunta}{' '}
                    <b>
                      {T.sesion.terminarLlevas(
                        sesion.estado.series,
                        duracionLinda(
                          transcurrido(sesion.estado.inicio!, sesion.estado.desfasaje)
                        )
                      )}
                    </b>
                  </span>
                  <button className="boton-solido" onClick={() => setTerminando(false)}>
                    {T.sesion.seguir}
                  </button>
                  <button
                    className="boton-texto"
                    disabled={sesion.estado.ocupado}
                    onClick={async () => {
                      const cierre = await sesion.terminar();
                      setTerminando(false);
                      // Nada de resumen si la base deshizo el día: no hubo
                      // entrenamiento que resumir, y festejar un toque sin
                      // querer es peor que no decir nada.
                      if (cierre && !cierre.deshizoElDia) setCierre(cierre);
                    }}
                  >
                    {T.sesion.terminar}
                  </button>
                </>
              ) : (
                <button className="boton-solido" onClick={() => setTerminando(true)}>
                  {T.sesion.terminar}
                </button>
              )}
            </AccionPrincipal>
          </>
        ) : registradoHoy ? (
          /* El día ya está. Lo que queda no es "registrar" otra vez: es
             sumarle una foto o el peso, que son dos cosas distintas y por eso
             son dos botones. El cartel se dice UNA vez y con aire, en vez de
             ir apretado adentro de un botón ancho. */
          <div className="dia-listo">
            <span className={`rotulo${llegadaNueva ? ' solo' : ''}`}>
              {llegadaNueva ? T.inicio.diaSolo : T.inicio.diaRegistrado}
            </span>
            {/* Con rótulo: una cámara se entiende sola, una balanza no. Dos
                iconos pelados obligan a tocar uno para averiguar cuál era. */}
            <div className="acciones">
              <button onClick={() => setHojaAbierta(true)}>
                <span className="redondo">
                  <IconoFoto />
                </span>
                <span className="rotulo">{T.registrar.foto}</span>
              </button>
              <button onClick={() => setPesoAbierto(true)}>
                <span className="redondo">
                  <IconoPeso />
                </span>
                <span className="rotulo">{T.registrar.peso}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <AccionPrincipal
              secundaria={
                /* El peso NO pasa por registrar el día: pesarse no es haber
                   ido al gimnasio. Va acá igual porque tiene que poder
                   anotarse cualquier día, entrenes o no — y va PEGADO al
                   principal porque suelto en el flujo quedaba flotando arriba
                   de la tira semanal, sin significar nada. */
                <button className="boton-texto" onClick={() => setPesoAbierto(true)}>
                  {T.peso.anotarPeso}
                </button>
              }
            >
              <button className="boton-solido" onClick={() => setHojaAbierta(true)}>
                {T.inicio.registrarDia}
              </button>
            </AccionPrincipal>
          </>
        )}
        {sesion.estado.aviso && <p className="ok-msg">{sesion.estado.aviso}</p>}

        <TiraSemanal logs={logs} descansos={descansos} cubiertos={cubiertos} />

        {/* Los tres pesos, una sola línea, y SOLO si hay marcas cargadas
            (§16.8): al que no usa el módulo la pantalla le queda igual que
            antes. Se alinea con la tira semanal y no con el margen, para no
            romper la asimetría —nada cierra en la misma vertical—. El DOTS no
            va acá: es un número que pide contexto, y ese contexto es Stats. */}
        {/* El punto del gimnasio es LO QUE DIFERENCIA a la app, y vivia
            escondido en Ajustes: si nadie lo marca, nadie ve el atajo. Este
            recordatorio se queda mientras no haya punto y se va solo el dia
            que se marca — no hay que cerrarlo, hay que resolverlo. Va en el
            idioma de los globos y en voz baja: no compite con nada. */}
        {!perfil.gimnasio_lat && !pedirGimnasio && !entrenando && (
          <Link href="/ajustes" className="globo globo-quieto">
            <p>{T.inicio.gimnasioRecordatorio}</p>
          </Link>
        )}

        {pedirGimnasio && (
          <div className="globo globo-quieto pedido-gimnasio">
            <p>
              <strong>{T.inicio.gimnasioAhora}</strong> {T.inicio.gimnasioAhoraPie}
            </p>
            <div className="acciones">
              <button className="boton-solido" onClick={marcarDesdeAca} disabled={marcando}>
                {marcando ? T.ajustes.gimnasioBuscando : T.ajustes.gimnasioMarcar}
              </button>
              <button className="boton-texto" onClick={() => setPedirGimnasio(false)}>
                {T.inicio.gimnasioAhoraNo}
              </button>
            </div>
            {avisoGimnasio && <p className="error-msg">{avisoGimnasio}</p>}
          </div>
        )}

        {/* DE ACÁ PARA ABAJO, NADA MIENTRAS SE ENTRENA (§20).
            Medido: con la sesión abierta el contenido daba 1088 px en una
            pantalla de 844, y el humano tenía que scrollear entre serie y
            serie para ver cuántas llevaba. Nada de esto es de la sesión: la
            cita motiva antes o después, la línea social es una distracción en
            el medio, y las marcas y el recordatorio del gimnasio son de otro
            momento. No se borran, vuelven solas al terminar. */}
        {marcas && !entrenando && (
          <Link href="/fuerza" className="linea-marcas">{marcas}</Link>
        )}

        {!sinNada && !entrenando && (
          <figure className="cita">
            <blockquote>{cita.texto}</blockquote>
            <figcaption>{cita.autor}</figcaption>
          </figure>
        )}

        {social && !entrenando && (
          <div className="linea-social">
            <span>
              {T.inicio.sigueSubiendo(social.username, enDias(social.racha))}
            </span>
          </div>
        )}

        {sinNada && (
          <div className="vacio-cosmico">
            <div className="particulas">
              <i /><i /><i /><i />
            </div>
            {T.inicio.vacioTitulo}
            <br />
            {T.inicio.vacioPie}
          </div>
        )}
      </PantallaDeslizable>

      {hojaAbierta && (
        <RegistrarSheet
          racha={racha}
          logId={logHoy?.id}
          visibilidadDefault={perfil.visibilidad_default}
          alCerrar={() => setHojaAbierta(false)}
          alConfirmar={alConfirmar}
        />
      )}

      {pesoAbierto && (
        <PesoSheet
          unidad={perfil.unidad_peso ?? 'kg'}
          alCerrar={() => setPesoAbierto(false)}
          alGuardar={() => cargar(false)}
        />
      )}

      {(sesion.estado.descanso && descansoAbierto) && (
        <Descanso
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

      {/* La subida de rango va ANTES que el resumen en el orden de la
          pantalla, pero el usuario ve primero el resumen porque la subida
          solo aparece al registrar el día, y terminar la sesión no registra
          nada. Nunca coinciden. */}
      {subida && (
        <SubidaRango
          rangoAntes={subida.antes}
          rangoDespues={subida.despues}
          planeta={planeta}
          racha={racha}
          alCerrar={() => setSubida(null)}
        />
      )}

      {cierre && (
        <ResumenSesion
          minutos={cierre.minutos}
          series={cierre.series}
          porUbicacion={cierre.porUbicacion}
          bloques={cierre.bloques}
          unidad={perfil?.unidad_peso === 'lb' ? 'lb' : 'kg'}
          alCerrar={() => setCierre(null)}
        />
      )}

      {/* LA VENTANA DE LA VIDA. Va afuera de la pantalla deslizable porque
          toma la pantalla entera, como la subida de rango.

          NO SALE CON UNA SESIÓN ANDANDO, y ahora eso es gratis: la marca se
          escribe recién al cerrarla, así que lo único que pasa es que aparece
          cuando la sesión termina. Antes esta misma condición era una de las
          tres formas de perderse el aviso para siempre. */}
      {impulsoUsado && !entrenando && perfil && (
        <RachaSalvada
          dias={impulsoUsado.dias}
          quedan={impulsoUsado.quedan}
          total={impulsoUsado.total}
          rango={perfil.rango_actual}
          planeta={planeta}
          rachaSiGuarda={rachaSiSeDevuelve(racha)}
          alGuardar={guardarImpulsos}
          alCerrar={cerrarImpulsoUsado}
        />
      )}

      {sumando && <DiaSumado alTerminar={() => setSumando(false)} />}

      <Nav />
    </>
  );
}

/* Los dos únicos iconos de esta pantalla. Van acá y no en su propio archivo
   porque no los usa nadie más. */
function IconoFoto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5h3l1.4-2h7.2L17 8.5h3v10H4z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

function IconoPeso() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 6h10l2.5 13H4.5z" />
      <path d="M9.6 6a2.4 2.4 0 0 1 4.8 0" />
    </svg>
  );
}
