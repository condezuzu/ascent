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
  const [descansoAbierto, setDescansoAbierto] = useState(false);
  const [subida, setSubida] = useState<{ antes: number; despues: number } | null>(null);
  const [perdida, setPerdida] = useState(false);
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
      // TODO(quitar p_hoy): el servidor lo IGNORA desde la migración 12 —la
      // fecha la decide él con la zona del usuario—. Se sigue mandando solo
      // para que un cliente viejo no rompa mientras Vercel despliega. Se
      // saca en el primer deploy posterior al 20/8/2026. Ver trampas.md.
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
    const cacheado = leerPerfilCache();
    if (cacheado) {
      setPerfil(cacheado);
      setCargado(true);
    }
    cargar();
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
              <span className="racha-label">Racha</span>
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

  function alConfirmar(r: ResultadoRegistro | null) {
    setHojaAbierta(false);
    // La animación se dispara SOLO después de que la base confirmó. Viene en
    // null cuando el día ya estaba y solo se le sumó foto o peso: ahí no hay
    // subida de rango que festejar.
    if (r?.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
    cargar();
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
            <span className="racha-label">Racha</span>
            <span className="racha-numero">{racha}</span>
          </div>
          {/* barra de progreso al siguiente rango, sin etiqueta de texto */}
          {prox && (
            <div className="progreso">
              <div style={{ width: `${Math.round(progreso * 100)}%` }} />
            </div>
          )}
        </div>

        {avisoTiempo && <p className="aviso-tiempo">Último tramo para el {racha + 1}.</p>}
        {perdida && (
          <p className="aviso-tiempo">Se dispersó un poco de masa. Hoy se recupera.</p>
        )}
        {esDescanso && <p className="aviso-tiempo">Hoy descansa. La racha sigue igual.</p>}
        {/* El día que la guarda dejó esperando. Se dice acá y no solo en la
            hoja: el usuario puede cerrar la app y volver, y lo que no puede
            es quedarse pensando que perdió el día (§11). */}
        {perfil.dia_pendiente && (
          <p className="aviso-tiempo">Tu día de hoy quedó anotado y se suma solo. No lo perdiste.</p>
        )}

        {/* Con el día ya registrado esto era un cartel muerto, y el día
            quedaba cerrado: no había forma de agregarle la foto ni el peso
            después. Ahora sigue abierto, que es lo único razonable cuando el
            día lo pudo registrar el cronómetro sin preguntar nada. */}
        {/* Con la sesión andando, "Serie hecha" se lleva el botón sólido: es
            lo que más se toca durante un entrenamiento, y el día ya está. */}
        {sesion.estado.corriendo ? (
          <>
            <button className="boton-solido" onClick={sesion.serieHecha}>
              Serie hecha
            </button>
            <div className="series-fila">
              <span className="cuenta">{sesion.estado.series}</span>
              <span style={{ flex: 1 }}>
                {sesion.estado.series === 1 ? 'serie' : 'series'}
              </span>
              {/* Un toque de más es fácil. Se puede deshacer toda la sesión, y
                  deshacer NO cancela el descanso: son cosas separadas. */}
              {sesion.estado.series > 0 && (
                <button onClick={sesion.deshacerSerie} aria-label="Sacar una serie">
                  −
                </button>
              )}
              <button className="boton-fantasma" onClick={sesion.terminar}>
                Terminar
              </button>
            </div>
          </>
        ) : (
          <button
            className={registradoHoy ? 'boton-fantasma' : 'boton-solido'}
            onClick={() => setHojaAbierta(true)}
          >
            {registradoHoy ? 'Día registrado · sumar foto o peso' : 'Registrar día'}
          </button>
        )}
        {sesion.estado.aviso && <p className="ok-msg">{sesion.estado.aviso}</p>}

        <TiraSemanal logs={logs} descansos={descansos} />

        {/* Los tres pesos, una sola línea, y SOLO si hay marcas cargadas
            (§16.8): al que no usa el módulo la pantalla le queda igual que
            antes. Se alinea con la tira semanal y no con el margen, para no
            romper la asimetría —nada cierra en la misma vertical—. El DOTS no
            va acá: es un número que pide contexto, y ese contexto es Stats. */}
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
              {social.username} sigue subiendo — {enDias(social.racha)}
            </span>
          </div>
        )}

        {sinNada && (
          <div className="vacio-cosmico">
            <div className="particulas">
              <i /><i /><i /><i />
            </div>
            Todavía no hay nada acá.
            <br />
            Registrá tu primer día y algo se empieza a formar.
          </div>
        )}
      </PantallaDeslizable>

      {hojaAbierta && (
        <RegistrarSheet
          racha={racha}
          logId={logHoy?.id}
          unidadPeso={perfil.unidad_peso}
          visibilidadDefault={perfil.visibilidad_default}
          alCerrar={() => setHojaAbierta(false)}
          alConfirmar={alConfirmar}
        />
      )}

      {(sesion.estado.descanso && descansoAbierto) && (
        <Descanso
          vivo={sesion.estado.descanso}
          alReiniciar={sesion.reiniciarDescanso}
          alCerrar={() => {
            setDescansoAbierto(false);
            sesion.cerrarDescanso();
          }}
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
