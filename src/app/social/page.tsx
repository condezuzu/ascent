'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { fechaLinda, hoyISO } from '@nucleo/fechas';
import { RETOS_LISTOS } from '@nucleo/reglas';
import { planetaDeDia } from '@nucleo/rangos';
import type { Reto, UsuarioPublico } from '@nucleo/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import GloboPrimeraVez from '@/components/GloboPrimeraVez';
import NoCargo from '@/components/NoCargo';
import { T } from '@nucleo/textos';

type Solicitud = { id: string; de: UsuarioPublico };
type Actividad = {
  username: string;
  userId: string;
  avatar: string | null;
  fecha: string;
  planeta: string | null;
  foto: string | null;
};
type RetoConNombre = Reto & { nombreRival: string; idRival: string };

export default function Social() {
  const [supabase] = useState(() => crearCliente());
  const [miId, setMiId] = useState('');
  const [amigos, setAmigos] = useState<UsuarioPublico[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [retos, setRetos] = useState<RetoConNombre[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<UsuarioPublico[]>([]);
  const [pedidosMandados, setPedidosMandados] = useState<Set<string>>(new Set());
  const [cargado, setCargado] = useState(false);
  const [noCargo, setNoCargo] = useState(false);
  const [miRango, setMiRango] = useState(1);
  const [miPlaneta, setMiPlaneta] = useState<string | null>(null);
  const busquedaRef = useRef('');

  const cargar = useCallback(async () => {
    const user = await miUsuario(supabase);
    if (!user) return;
    setMiId(user.id);

    // cerrar retos vencidos antes de mostrarlos (fecha local, no UTC del server)
    await supabase.rpc('cerrar_retos_vencidos');

    const { data: rel, error: errAmigos } = await supabase.from('friendships').select('*');
    // Igual que en el álbum: que la consulta falle no es lo mismo que no tener
    // amigos. Decir "tu cielo todavía está vacío" cuando lo que pasó es que no
    // se pudo preguntar es mentir sobre los datos de la persona.
    if (errAmigos) {
      setNoCargo(true);
      return setCargado(true);
    }
    setNoCargo(false);
    const aceptadas = (rel ?? []).filter((r) => r.estado === 'aceptada');
    const idsAmigos = aceptadas.map((r) =>
      r.solicitante === user.id ? r.destinatario : r.solicitante
    );
    const pendientes = (rel ?? []).filter(
      (r) => r.estado === 'pendiente' && r.destinatario === user.id
    );
    const mandadas = (rel ?? []).filter(
      (r) => r.estado === 'pendiente' && r.solicitante === user.id
    );
    setPedidosMandados(new Set(mandadas.map((r) => r.destinatario)));

    // yo también aparezco en el campo estelar
    const idsInteres = [...new Set([...idsAmigos, user.id, ...pendientes.map((p) => p.solicitante)])];
    const { data: publicos } = await supabase
      .from('usuarios_publicos')
      .select('*')
      .in('id', idsInteres);
    const mapaUsuarios = new Map(((publicos ?? []) as UsuarioPublico[]).map((p) => [p.id, p]));
    const yo = mapaUsuarios.get(user.id);
    setMiRango(yo?.rango_actual ?? 1);
    setMiPlaneta(yo ? planetaDeDia(yo.racha_actual) : null);
    setAmigos(
      ((publicos ?? []) as UsuarioPublico[])
        .filter((p) => p.id === user.id || idsAmigos.includes(p.id))
        .sort((a, b) => b.racha_actual - a.racha_actual)
    );

    setSolicitudes(
      pendientes
        .map((p) => ({ id: p.id, de: mapaUsuarios.get(p.solicitante) as UsuarioPublico }))
        .filter((s) => s.de)
    );

    // retos que me involucran (pendientes de responder, activos, y últimos cerrados)
    const { data: rs } = await supabase
      .from('challenges')
      .select('*')
      .or(`retador.eq.${user.id},rival.eq.${user.id}`)
      .neq('estado', 'rechazado')
      .order('creado', { ascending: false })
      .limit(6);
    setRetos(
      ((rs ?? []) as Reto[]).map((r) => {
        const otro = r.retador === user.id ? r.rival : r.retador;
        return {
          ...r,
          idRival: otro,
          nombreRival: mapaUsuarios.get(otro)?.username ?? '¿?',
        };
      })
    );

    // Feed derivado: logs de amigos aceptados, con su foto visible si la hay.
    if (idsAmigos.length > 0) {
      const { data: ls } = await supabase
        .from('logs')
        .select('id, user_id, fecha, planeta_del_dia')
        .in('user_id', idsAmigos)
        .eq('es_descanso', false)
        .order('fecha', { ascending: false })
        .limit(12);
      const logIds = (ls ?? []).map((l) => l.id);
      let fotosPorLog = new Map<string, string>();
      if (logIds.length > 0) {
        // la RLS solo devuelve las fotos con visibilidad 'amigos'
        const { data: fs } = await supabase
          .from('photos')
          .select('log_id, storage_path')
          .in('log_id', logIds);
        if (fs && fs.length > 0) {
          const { data: firmadas } = await supabase.storage
            .from('fotos')
            .createSignedUrls(fs.map((f) => f.storage_path), 3600);
          fotosPorLog = new Map(
            fs.map((f, i) => [f.log_id as string, firmadas?.[i]?.signedUrl ?? ''])
          );
        }
      }
      setActividad(
        (ls ?? []).map((l) => ({
          username: mapaUsuarios.get(l.user_id)?.username ?? T.social.sinNombre,
          userId: l.user_id,
          avatar: mapaUsuarios.get(l.user_id)?.avatar_url ?? null,
          fecha: l.fecha,
          planeta: l.planeta_del_dia,
          foto: fotosPorLog.get(l.id) ?? null,
        }))
      );
    }
    setCargado(true);
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function buscar(texto: string) {
    setBusqueda(texto);
    busquedaRef.current = texto;
    const limpio = texto.trim();
    if (limpio.length < 2) return setResultados([]);
    const { data } = await supabase
      .from('usuarios_publicos')
      .select('*')
      .ilike('username', `%${limpio}%`)
      .neq('id', miId)
      .limit(8);
    // respuesta vieja llegando tarde: se descarta
    if (busquedaRef.current !== texto) return;
    const idsActuales = new Set(amigos.map((a) => a.id));
    setResultados(((data ?? []) as UsuarioPublico[]).filter((u) => !idsActuales.has(u.id)));
  }

  async function pedirAmistad(destino: string) {
    const { error } = await supabase
      .from('friendships')
      .insert({ solicitante: miId, destinatario: destino });
    // si ya existía una relación en el otro sentido, el índice único lo frena:
    // recargar para mostrar el estado real
    if (error) return cargar();
    setPedidosMandados(new Set([...pedidosMandados, destino]));
  }

  async function aceptar(id: string) {
    await supabase.from('friendships').update({ estado: 'aceptada' }).eq('id', id);
    cargar();
  }

  async function rechazar(id: string) {
    await supabase.from('friendships').delete().eq('id', id);
    cargar();
  }

  async function responderReto(id: string, acepta: boolean) {
    await supabase
      .from('challenges')
      .update({ estado: acepta ? 'activo' : 'rechazado' })
      .eq('id', id);
    cargar();
  }

  const maxRacha = Math.max(1, ...amigos.map((a) => a.racha_actual));
  const hoy = hoyISO();
  // Con los retos escondidos las tres listas quedan vacías, y entonces no se
  // dibuja ninguna de sus secciones. Ver RETOS_LISTOS.
  const conRetos = RETOS_LISTOS ? retos : [];
  const retosPendientesMios = conRetos.filter((r) => r.estado === 'pendiente' && r.rival === miId);
  const retosActivos = conRetos.filter((r) => r.estado === 'activo');
  const retosCerrados = conRetos.filter((r) => r.estado === 'terminado').slice(0, 3);

  return (
    <>
      <FondoEspacial rango={miRango} planeta={miPlaneta} esquina="arriba-derecha" velo={0.68} />
      <PantallaDeslizable>
        <div className="titulo-pantalla">{T.social.titulo}</div>

        <GloboPrimeraVez cual="leaderboard">
          {T.social.globo}
        </GloboPrimeraVez>

        {noCargo && <NoCargo reintentar={cargar} />}

        {solicitudes.length > 0 && (
          <div className="tarjeta" style={{ marginBottom: 16 }}>
            {solicitudes.map((s) => (
              <div className="fila" key={s.id}>
                <Avatar url={s.de.avatar_url} nombre={s.de.username} />
                <span className="nombre">{s.de.username}</span>
                <button className="boton-texto" style={{ width: 'auto' }} onClick={() => aceptar(s.id)}>
                  {T.social.aceptar}
                </button>
                <button
                  className="boton-texto"
                  style={{ width: 'auto', color: 'var(--apagado)' }}
                  onClick={() => rechazar(s.id)}
                >
                  {T.social.no}
                </button>
              </div>
            ))}
          </div>
        )}

        {retosPendientesMios.map((r) => (
          <div className="tarjeta" key={r.id} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              {T.social.teReto(r.nombreRival)}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="boton-solido" style={{ flex: 1 }} onClick={() => responderReto(r.id, true)}>
                {T.social.acepto}
              </button>
              <button
                className="boton-fantasma"
                style={{ flex: 1, width: 'auto' }}
                onClick={() => responderReto(r.id, false)}
              >
                {T.social.paso}
              </button>
            </div>
          </div>
        ))}

        {amigos.length > 1 ? (
          <>
            {/* UNA sola vista. Antes eran dos —campo y lista— con un
                selector, y el campo venia primero: se entraba a una pantalla
                bonita y habia que tocar "Lista" para ver quien va ganando,
                que es a lo que se entra. Ahora la lista manda y el campo pasa
                a ser el fondo. Los astros siguen ahi, con su tamano y su
                brillo diciendo la racha de un vistazo, pero detras. */}
            <div className="ranking">
              <div className="campo-estelar de-fondo" aria-hidden>
                {amigos.map((a, i) => {
                  const t = a.racha_actual / maxRacha;
                  const tam = 18 + Math.round(t * 40);
                  const x = 18 + ((i * 137) % 64);
                  const y = 16 + ((i * 89) % 66);
                  return (
                    // Sin nombre y sin enlace: de fondo, la etiqueta se
                    // pisaria con la fila que dice lo mismo, y un enlace
                    // debajo de la lista es una trampa para el dedo.
                    <div
                      key={a.id}
                      className="astro-amigo"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        opacity: 0.45 + t * 0.55,
                        animationDelay: `${(i * 1.3) % 5}s`,
                      }}
                    >
                      <Insignia rango={a.rango_actual} tam={tam} />
                    </div>
                  );
                })}
              </div>

              <div className="tarjeta ranking-lista">
                {amigos.map((a, i) => {
                  const fila = (
                    <>
                      <span className="dato" style={{ width: 20 }}>
                        {i + 1}
                      </span>
                      <Insignia rango={a.rango_actual} />
                      <span className="nombre">{a.id === miId ? T.social.yoEnLista(a.username) : a.username}</span>
                      <span className="dato">{a.racha_actual}</span>
                    </>
                  );
                  return a.id === miId ? (
                    <div className="fila" key={a.id}>
                      {fila}
                    </div>
                  ) : (
                    <Link href={`/perfil/${a.id}`} className="fila" key={a.id}>
                      {fila}
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          cargado && (
            <div className="vacio-cosmico">
              <div className="particulas">
                <i /><i /><i /><i />
              </div>
              {T.social.vacioTitulo}
              <br />
              {T.social.vacioPie}
            </div>
          )
        )}

        {(retosActivos.length > 0 || retosCerrados.length > 0) && (
          <div className="seccion" style={{ marginTop: 24 }}>
            <h3>{T.social.retos}</h3>
            {retosActivos.map((r) => (
              <Link href={`/perfil/${r.idRival}`} className="fila" key={r.id}>
                <span className="nombre" style={{ fontSize: 14 }}>
                  {T.social.vs(r.nombreRival)}
                </span>
                <span className="dato" style={{ fontSize: 13 }}>
                  {r.hasta >= hoy ? T.social.hastaEl(fechaLinda(r.hasta)) : T.social.cerrando}
                </span>
              </Link>
            ))}
            {retosCerrados.map((r) => (
              <div className="fila" key={r.id}>
                <span className="nombre" style={{ fontSize: 14, color: 'var(--sub)' }}>
                  {T.social.vs(r.nombreRival)}
                </span>
                <span className="dato" style={{ fontSize: 13 }}>
                  {r.ganador === null
                    ? T.social.empate
                    : r.ganador === miId
                      ? T.social.ganaste
                      : T.social.gano(r.nombreRival)}
                </span>
              </div>
            ))}
          </div>
        )}

        {actividad.length > 0 && (
          <div className="seccion" style={{ marginTop: 24 }}>
            <h3>{T.social.actividad}</h3>
            {actividad.map((a, i) => (
              <Link href={`/perfil/${a.userId}`} className="fila" key={i}>
                <Avatar url={a.avatar} nombre={a.username} tam={28} />
                {a.foto && (
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      overflow: 'hidden',
                      flex: 'none',
                      border: '0.5px solid var(--linea)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </span>
                )}
                <span className="nombre" style={{ color: 'var(--sub)', fontSize: 14 }}>
                  {T.social.registroEl(a.username, fechaLinda(a.fecha))}
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="seccion" id="buscar" style={{ marginTop: 24 }}>
          <h3>{T.social.buscarGente}</h3>
          <input
            placeholder={T.ajustes.nombrePlaceholder}
            value={busqueda}
            onChange={(e) => buscar(e.target.value)}
            autoCapitalize="off"
          />
          {resultados.map((u) => (
            <div className="fila" key={u.id}>
              <Avatar url={u.avatar_url} nombre={u.username} />
              <Link href={`/perfil/${u.id}`} className="nombre">
                {u.username}
              </Link>
              {pedidosMandados.has(u.id) ? (
                <span className="dato">{T.social.pedidoEnviado}</span>
              ) : (
                <button
                  className="boton-texto"
                  style={{ width: 'auto' }}
                  onClick={() => pedirAmistad(u.id)}
                >
                  {T.social.agregar}
                </button>
              )}
            </div>
          ))}
        </div>
      </PantallaDeslizable>
      <Nav />
    </>
  );
}
