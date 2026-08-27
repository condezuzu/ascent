'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { enDias, hoyISO, restarDias, deISO } from '@/lib/fechas';
import { planetaDeDia, progresoEnRango, rangoDeRacha, siguienteRango } from '@/lib/rangos';
import { citaDelDia } from '@/lib/frases';
import { esDiaDeDescanso, type ConfigDescanso } from '@/lib/descansos';
import { guardarPerfilCache, leerPerfilCache } from '@/lib/cache';
import { marca } from '@/lib/medir';
import { sincronizarZona } from '@/lib/zona';
import { estoyEnElGimnasio, marcarPunto, registrarPorSenal } from '@/lib/gimnasio';
import { lineaDeMarcas } from '@/lib/fuerza';
import type { Log, MiFuerza, Perfil, ResultadoRegistro } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import TiraSemanal from '@/components/TiraSemanal';
import RegistrarSheet from '@/components/RegistrarSheet';
import SubidaRango from '@/components/SubidaRango';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import ChipSesion from '@/components/ChipSesion';
import Descanso from '@/components/Descanso';
import { usarSesion } from '@/lib/usarSesion';
import { T } from '@/textos';

type LineaSocial = { username: string; racha: number } | null;

export default function Principal() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [descansos, setDescansos] = useState<ConfigDescanso[]>([]);
  const [social, setSocial] = useState<LineaSocial>(null);
  const [marcas, setMarcas] = useState<string | null>(null);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  // Con qué campo se abre la hoja: los dos botones redondos del día ya
  // registrado llevan al mismo lugar, pero no a lo mismo.
  const [focoHoja, setFocoHoja] = useState<'foto' | 'peso' | undefined>(undefined);
  const [descansoAbierto, setDescansoAbierto] = useState(false);
  const [subida, setSubida] = useState<{ antes: number; despues: number } | null>(null);
  const [perdida, setPerdida] = useState(false);
  // El unico momento en que es probable que la persona este parada en el
  // gimnasio es JUSTO despues de registrar el dia. Ahi se pide el punto, y
  // solo ahi. Nunca al empezar la sesion (§13): a esa hora casi nadie llego.
  const [pedirGimnasio, setPedirGimnasio] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [avisoGimnasio, setAvisoGimnasio] = useState('');
  const [cargado, setCargado] = useState(false);

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
    if (!p) return;
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

    // El atajo de §13: abrir la app estando en el gimnasio registra el día.
    // Va al final de todo y sin await porque pide el GPS, que tarda segundos:
    // la pantalla no espera por esto. Y solo si el día NO está registrado, para
    // no gastar el GPS en el 90% de las veces que se abre la app.
    const yaHoy = (ls ?? []).some((l) => l.fecha === hoyISO());
    if (!yaHoy && p.gimnasio_lat) {
      estoyEnElGimnasio(p as Perfil).then(async (adentro) => {
        if (!adentro) return;
        const r = await registrarPorSenal(supabase, 'ubicacion');
        // Solo se recarga si de verdad entró: si estaba bloqueado por la
        // guarda de zona o ya estaba, no hay nada nuevo que mostrar.
        if (r.registrado) cargar();
      });
    }
  }, [supabase, router, cargarSocial]);

  // El cronómetro vive acá desde §20: empezar pasa una vez por entrenamiento
  // y no merecía una pestaña, pero sí estar a la vista.
  const sesion = usarSesion((r) => {
    if (r?.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
    cargar();
  });

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

  const cita = citaDelDia(perfil.rango_actual, `${hoy}-${perfil.id}`);

  // El aviso solo aparece cuando falta poco de verdad, no a la mañana.
  // Redacción hacia adelante, nunca hacia la pérdida.
  const hora = new Date().getHours();
  const avisoTiempo = !registradoHoy && racha > 0 && hora >= 19;

  function abrirHoja(foco?: 'foto' | 'peso') {
    setFocoHoja(foco);
    setHojaAbierta(true);
  }

  function alConfirmar(r: ResultadoRegistro | null) {
    setHojaAbierta(false);
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
        esquina="abajo-derecha"
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
            <span className="racha-numero">{racha}</span>
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
            {/* Antes acá había un botón que decía "Serie hecha" y nadie entendía
                qué hacía: parecía una confirmación, no un contador. Ahora se ve
                LO QUE CUENTA — el número de series — con un + y un − a los
                costados, que es la forma en que un contador se lee sin que
                nadie lo explique. El + sigue siendo el mismo gesto de siempre:
                suma la serie y arranca el descanso (§20.3). */}
            <div className="contador-series">
              <button
                className="paso"
                onClick={sesion.deshacerSerie}
                disabled={sesion.estado.series === 0}
                aria-label={T.inicio.sacarSerie}
              >
                −
              </button>
              <div className="cuenta" aria-live="polite">
                <span className="numero">{sesion.estado.series}</span>
                <span className="palabra">{T.sesion.seriesPalabra(sesion.estado.series)}</span>
              </div>
              <button className="paso mas" onClick={sesion.serieHecha} aria-label={T.inicio.sumarSerie}>
                +
              </button>
            </div>
            <p className="nota-privada" style={{ textAlign: 'center', marginTop: 10 }}>
              {T.inicio.masArrancaDescanso}
            </p>
            <button className="boton-fantasma" style={{ marginTop: 12 }} onClick={sesion.terminar}>
              {T.sesion.terminar}
            </button>
          </>
        ) : registradoHoy ? (
          /* El día ya está. Lo que queda no es "registrar" otra vez: es
             sumarle una foto o el peso, que son dos cosas distintas y por eso
             son dos botones. El cartel se dice UNA vez y con aire, en vez de
             ir apretado adentro de un botón ancho. */
          <div className="dia-listo">
            <span className="rotulo">{T.inicio.diaRegistrado}</span>
            {/* Con rótulo: una cámara se entiende sola, una balanza no. Dos
                iconos pelados obligan a tocar uno para averiguar cuál era. */}
            <div className="acciones">
              <button onClick={() => abrirHoja('foto')}>
                <span className="redondo">
                  <IconoFoto />
                </span>
                <span className="rotulo">{T.registrar.foto}</span>
              </button>
              <button onClick={() => abrirHoja('peso')}>
                <span className="redondo">
                  <IconoPeso />
                </span>
                <span className="rotulo">{T.registrar.peso}</span>
              </button>
            </div>
          </div>
        ) : (
          <button className="boton-solido" onClick={() => abrirHoja()}>
            {T.inicio.registrarDia}
          </button>
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
          unidadPeso={perfil.unidad_peso}
          visibilidadDefault={perfil.visibilidad_default}
          foco={focoHoja}
          alCerrar={() => setHojaAbierta(false)}
          alConfirmar={alConfirmar}
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
        />
      )}

      {subida && (
        <SubidaRango
          rangoAntes={subida.antes}
          rangoDespues={subida.despues}
          alCerrar={() => setSubida(null)}
        />
      )}

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
