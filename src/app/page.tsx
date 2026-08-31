'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { enDias, hoyISO, restarDias, deISO } from '@nucleo/fechas';
import { planetaDeDia, progresoEnRango, rangoDeRacha, siguienteRango } from '@nucleo/rangos';
import { citaDelDia } from '@nucleo/frases';
import { hayPresagio } from '@nucleo/atmosfera';
import { esDiaDeDescanso, type ConfigDescanso } from '@nucleo/descansos';
import { guardarPerfilCache, leerPerfilCache } from '@/lib/cache';
import { marca } from '@/lib/medir';
import { sincronizarZona } from '@/lib/zona';
import { marcarPunto } from '@/lib/gimnasio';
import { plataforma } from '@/plataforma';
import { eventos } from '@/plataforma/eventos';
import { DIA_CAMBIO } from '@/components/VigilanteDeGimnasio';
import { lineaDeMarcas } from '@nucleo/fuerza';
import type { Log, MiFuerza, Perfil, ResultadoRegistro } from '@nucleo/tipos';
import type { CierreDeSesion } from '@/lib/usarSesion';
import FondoEspacial from '@/components/FondoEspacial';
import TiraSemanal from '@/components/TiraSemanal';
import RegistrarSheet from '@/components/RegistrarSheet';
import PesoSheet from '@/components/PesoSheet';
import SubidaRango from '@/components/SubidaRango';
import ResumenSesion from '@/components/ResumenSesion';
import GloboPrimeraVez from '@/components/GloboPrimeraVez';
import Bloque from '@/components/Bloque';
import DiaSumado from '@/components/DiaSumado';
import AccionPrincipal from '@/components/AccionPrincipal';
import NumeroQueCuenta from '@/components/NumeroQueCuenta';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import ChipSesion from '@/components/ChipSesion';
import Descanso from '@/components/Descanso';
import { usarSesion } from '@/lib/usarSesion';
import { T } from '@nucleo/textos';

type LineaSocial = { username: string; racha: number } | null;

// El último día que entró SOLO y que esta persona ya vio. Guarda la fecha, no
// un booleano: si guardara "ya lo vi" habría que acordarse de borrarlo cada
// medianoche, y el día que fallara ese borrado el mensaje no volvería a
// aparecer nunca más.
const CLAVE_LLEGADA_VISTA = 'ascent:llegada-vista';

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
  const [subida, setSubida] = useState<{ antes: number; despues: number } | null>(null);
  // Lo que dejó la sesión al cerrarse, para el resumen del final.
  const [cierre, setCierre] = useState<CierreDeSesion | null>(null);
  // El día entró solo Y esta persona todavía no lo vio. Es lo que convierte
  // "Día registrado" —idéntico a haberlo apretado— en un descubrimiento.
  const [llegadaNueva, setLlegadaNueva] = useState(false);
  // El día que se acaba de sumar, para la animación. Ver `DiaSumado`.
  const [sumando, setSumando] = useState(false);
  const [perdida, setPerdida] = useState(false);
  // El unico momento en que es probable que la persona este parada en el
  // gimnasio es JUSTO despues de registrar el dia. Ahi se pide el punto, y
  // solo ahi. Nunca al empezar la sesion (§13): a esa hora casi nadie llego.
  const [pedirGimnasio, setPedirGimnasio] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [avisoGimnasio, setAvisoGimnasio] = useState('');
  const [cargado, setCargado] = useState(false);
  const [noCargo, setNoCargo] = useState(false);

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

  const cargar = useCallback(async () => {
    // getSession lee la cookie sin ir a la red; el JWT igual lo valida la
    // base en cada consulta, así que no se pierde nada de seguridad.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return router.push('/login');

    // Perfil, logs y verificación de pérdida van EN PARALELO. Antes eran
    // siete viajes en fila y la pantalla no dibujaba nada hasta el último.
    const desde = restarDias(hoyISO(), 6);
    const [{ data: p }, { data: ls }, { data: v }, { data: cfgs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('logs').select('*').eq('user_id', uid).gte('fecha', desde).order('fecha'),
      supabase.rpc('verificar_perdida'),
      supabase.from('descansos').select('desde, dias').order('desde', { ascending: false }),
    ]);
    // Si el perfil no vino, ANTES esto era un `return` mudo: la pantalla se
    // quedaba en el armazón para siempre, sin error y sin nada que tocar. Con
    // una conexión mala —el subsuelo de un gimnasio— eso es quedarse afuera de
    // la app sin forma de salir, que es la clase de bug que más caro sale
    // cuando encima no hay recuperación de contraseña.
    if (!p) {
      setNoCargo(true);
      return;
    }
    setNoCargo(false);
    if (!p.username) return router.push('/onboarding');

    setLogs(ls ?? []);
    setDescansos((cfgs ?? []) as ConfigDescanso[]);

    // Si hubo pérdida, el perfil que trajimos quedó viejo: se relee.
    if (v?.perdida) {
      setPerdida(true);
      const { data: p2 } = await supabase.from('profiles').select('*').eq('id', uid).single();
      const fresco = p2 ?? p;
      setPerfil(fresco);
      guardarPerfilCache(fresco);
    } else {
      setPerfil(p);
      guardarPerfilCache(p);
    }
    setCargado(true);
    marca('ascent:pantalla-lista');
    cargarSocial(uid);

    // La zona del teléfono, para que el día corte donde está el usuario. Va
    // después de dibujar y solo escribe si cambió: es una llamada por viaje,
    // no una por arranque. El usuario nunca la ve ni la configura.
    sincronizarZona(supabase);

    // Las marcas también van después de dibujar, y por la misma razón que la
    // línea social: son un agregado, no lo que el usuario vino a ver. Si la
    // migración todavía no corrió, el RPC no existe y la línea no aparece.
    supabase.rpc('mi_fuerza').then(({ data }) => {
      const f = data as MiFuerza | null;
      if (f) setMarcas(lineaDeMarcas(f.marcas, p.unidad_peso ?? 'kg'));
    });

  }, [supabase, router, cargarSocial]);

  // El cronómetro vive acá desde §20: empezar pasa una vez por entrenamiento
  // y no merecía una pestaña, pero sí estar a la vista.
  const sesion = usarSesion((r) => {
    if (r?.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
    cargar();
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
  useEffect(() => eventos.escuchar(DIA_CAMBIO, () => cargar()), [cargar]);


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
      }
      cargar();
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
              <button className="boton-fantasma" onClick={cargar}>
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
    cargar();
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
              alElegirMeta={sesion.elegirMeta}
            />
            <p className="nota-privada" style={{ textAlign: 'center', marginTop: 10 }}>
              {sesion.estado.porUbicacion ? T.inicio.sesionSola : T.inicio.masArrancaDescanso}
            </p>
            <AccionPrincipal>
              <button
                className="boton-solido"
                onClick={async () => {
                  const cierre = await sesion.terminar();
                  // Nada de resumen si la base deshizo el día: no hubo
                  // entrenamiento que resumir, y festejar un toque sin querer
                  // es peor que no decir nada.
                  if (cierre && !cierre.deshizoElDia) setCierre(cierre);
                }}
              >
                {T.sesion.terminar}
              </button>
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

        <TiraSemanal logs={logs} descansos={descansos} />

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
        {!perfil.gimnasio_lat && !pedirGimnasio && (
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

        {marcas && <Link href="/fuerza" className="linea-marcas">{marcas}</Link>}

        {!sinNada && (
          <figure className="cita">
            <blockquote>{cita.texto}</blockquote>
            <figcaption>{cita.autor}</figcaption>
          </figure>
        )}

        {social && (
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
          alGuardar={cargar}
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
          alCerrar={() => setSubida(null)}
        />
      )}

      {cierre && (
        <ResumenSesion
          minutos={cierre.minutos}
          series={cierre.series}
          porUbicacion={cierre.porUbicacion}
          alCerrar={() => setCierre(null)}
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
