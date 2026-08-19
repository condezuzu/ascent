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
import { lineaDeMarcas } from '@/lib/fuerza';
import type { Log, MiFuerza, Perfil, ResultadoRegistro } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import TiraSemanal from '@/components/TiraSemanal';
import RegistrarSheet from '@/components/RegistrarSheet';
import SubidaRango from '@/components/SubidaRango';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';

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
      // p_hoy = fecha LOCAL del usuario (el servidor está en UTC)
      supabase.rpc('verificar_perdida', { p_hoy: hoyISO() }),
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

    // Las marcas también van después de dibujar, y por la misma razón que la
    // línea social: son un agregado, no lo que el usuario vino a ver. Si la
    // migración todavía no corrió, el RPC no existe y la línea no aparece.
    supabase.rpc('mi_fuerza').then(({ data }) => {
      const f = data as MiFuerza | null;
      if (f) setMarcas(lineaDeMarcas(f.marcas, p.unidad_peso ?? 'kg'));
    });
  }, [supabase, router, cargarSocial]);

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
  const registradoHoy = logs.some((l) => l.fecha === hoy);
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

  function alConfirmar(r: ResultadoRegistro) {
    setHojaAbierta(false);
    // La animación se dispara SOLO después de que la base confirmó.
    if (r.subio_rango) setSubida({ antes: r.rango_antes, despues: r.rango_despues });
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
        {/* la cabecera es la puerta al perfil propio: hasta ahora se podía
            entrar al de un amigo pero no al de uno mismo */}
        <Link href="/yo" className="cabecera">
          <Avatar url={perfil.avatar_url} nombre={perfil.username} />
          <span className="nombre">{perfil.username}</span>
        </Link>

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

        {!registradoHoy ? (
          <button className="boton-solido" onClick={() => setHojaAbierta(true)}>
            Registrar día
          </button>
        ) : (
          <div className="boton-fantasma" style={{ pointerEvents: 'none' }}>
            Día registrado
          </div>
        )}

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
          unidadPeso={perfil.unidad_peso}
          visibilidadDefault={perfil.visibilidad_default}
          alCerrar={() => setHojaAbierta(false)}
          alConfirmar={alConfirmar}
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
