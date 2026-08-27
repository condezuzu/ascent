'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { enDias, fechaLinda, hoyISO, restarDias } from '@/lib/fechas';
import { planetaDeDia } from '@/lib/rangos';
import { RETOS_LISTOS } from '@/lib/reglas';
import type { Log, Reto, UsuarioPublico } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import { T } from '@/textos';
import ComoMeVen, {
  DIAS_VISIBLES,
  FOTOS_VISIBLES,
  type FotoVisible,
} from '@/components/ComoMeVen';

type FotoPerfil = FotoVisible;

// Perfil de un amigo: su objeto de rango de fondo, racha, última semana,
// fotos que decidió compartir, y el reto entre ambos.
export default function Perfil() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [miId, setMiId] = useState('');
  const [usuario, setUsuario] = useState<UsuarioPublico | null>(null);
  const [esAmigo, setEsAmigo] = useState(false);
  const [pedidoPendiente, setPedidoPendiente] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [fotos, setFotos] = useState<FotoPerfil[]>([]);
  const [reto, setReto] = useState<Reto | null>(null);
  const [marcador, setMarcador] = useState<{ yo: number; el: number } | null>(null);
  const [cargado, setCargado] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  const cargar = useCallback(async () => {
    // el id viene de la URL: si no es un uuid, ni consultar
    // (interpolarlo en filtros de PostgREST con formato inválido solo da errores)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
      setCargado(true);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (params.id === user.id) return router.replace('/');
    setMiId(user.id);

    const { data: u } = await supabase
      .from('usuarios_publicos')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (!u) {
      setCargado(true);
      return;
    }
    setUsuario(u as UsuarioPublico);

    const { data: rel } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(solicitante.eq.${user.id},destinatario.eq.${params.id}),and(solicitante.eq.${params.id},destinatario.eq.${user.id})`
      )
      .maybeSingle();
    const amigos = rel?.estado === 'aceptada';
    setEsAmigo(amigos);
    setPedidoPendiente(rel?.estado === 'pendiente');

    if (amigos) {
      // La RLS permite leer logs y fotos visibles de amigos aceptados.
      const desde = restarDias(hoyISO(), DIAS_VISIBLES - 1);
      const { data: ls } = await supabase
        .from('logs')
        .select('*')
        .eq('user_id', params.id)
        .gte('fecha', desde)
        .order('fecha');
      setLogs(ls ?? []);

      const { data: fs } = await supabase
        .from('photos')
        .select('id, storage_path, log_id, creado')
        .eq('user_id', params.id)
        .order('creado', { ascending: false })
        .limit(FOTOS_VISIBLES);
      if (fs && fs.length > 0) {
        const logIds = fs.map((f) => f.log_id).filter(Boolean) as string[];
        const { data: logsFotos } = logIds.length
          ? await supabase.from('logs').select('id, fecha').in('id', logIds)
          : { data: [] };
        const mapa = new Map((logsFotos ?? []).map((l) => [l.id, l.fecha]));
        const { data: firmadas } = await supabase.storage
          .from('fotos')
          .createSignedUrls(fs.map((f) => f.storage_path), 3600);
        setFotos(
          fs.map((f, i) => ({
            id: f.id,
            url: firmadas?.[i]?.signedUrl ?? '',
            fecha: f.log_id ? (mapa.get(f.log_id) ?? null) : null,
          }))
        );
      }

      // cerrar vencidos antes de mirar (fecha local, no UTC del server)
      await supabase.rpc('cerrar_retos_vencidos');

      // reto vigente entre los dos (pendiente o activo)
      const { data: retos } = await supabase
        .from('challenges')
        .select('*')
        .in('estado', ['pendiente', 'activo'])
        .or(
          `and(retador.eq.${user.id},rival.eq.${params.id}),and(retador.eq.${params.id},rival.eq.${user.id})`
        )
        .order('creado', { ascending: false })
        .limit(1);
      const r = (retos?.[0] as Reto) ?? null;
      setReto(r);

      if (r && r.estado === 'activo') {
        const [{ count: cYo }, { count: cEl }] = await Promise.all([
          supabase
            .from('logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('es_descanso', false)
            .gte('fecha', r.desde)
            .lte('fecha', r.hasta),
          supabase
            .from('logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', params.id)
            .eq('es_descanso', false)
            .gte('fecha', r.desde)
            .lte('fecha', r.hasta),
        ]);
        setMarcador({ yo: cYo ?? 0, el: cEl ?? 0 });
      }
    }
    setCargado(true);
  }, [supabase, params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function retar() {
    const hoy = hoyISO();
    await supabase.from('challenges').insert({
      retador: miId,
      rival: params.id,
      desde: hoy,
      hasta: restarDias(hoy, -6), // 7 días
    });
    cargar();
  }

  async function responderReto(acepta: boolean) {
    if (!reto) return;
    await supabase
      .from('challenges')
      .update({ estado: acepta ? 'activo' : 'rechazado' })
      .eq('id', reto.id);
    cargar();
  }

  async function pedirAmistad() {
    const { error } = await supabase
      .from('friendships')
      .insert({ solicitante: miId, destinatario: params.id });
    if (error) return cargar();
    setPedidoPendiente(true);
  }

  // Va por RPC: además de la amistad hay que cerrar el reto vigente, que
  // ninguno de los dos puede borrar por sí solo desde el cliente.
  async function eliminarAmigo() {
    const { error } = await supabase.rpc('eliminar_amigo', { p_otro: params.id });
    if (error) {
      setConfirmandoBaja(false);
      return;
    }
    router.push('/social');
    router.refresh();
  }

  if (!cargado) {
    return (
      <>
        <FondoEspacial rango={1} vacio esquina="centro" velo={0.7} />
        <div className="pantalla" />
        <Nav />
      </>
    );
  }

  if (!usuario) {
    return (
      <>
        <FondoEspacial rango={1} vacio esquina="centro" velo={0.7} />
        <div className="pantalla">
          <div className="vacio-cosmico">
            <div className="particulas"><i /><i /><i /><i /></div>
            {T.social.noExiste}
          </div>
        </div>
        <Nav />
      </>
    );
  }

  return (
    <>
      {/* el perfil de un amigo se ve con SU paleta y SU objeto: entrás a su cielo */}
      <FondoEspacial
        rango={usuario.rango_actual}
        planeta={planetaDeDia(usuario.racha_actual)}
        esquina="abajo-derecha"
        velo={0.6}
      />
      <div className="pantalla">
        <button className="boton-texto" style={{ textAlign: 'left', padding: '0 0 14px' }} onClick={() => router.back()}>
          {T.general.volver}
        </button>

        {!esAmigo ? (
          <>
            <div className="cabecera" style={{ marginBottom: 22 }}>
              <Avatar url={usuario.avatar_url} nombre={usuario.username} tam={52} />
              <div>
                <div className="nombre" style={{ fontSize: 18 }}>{usuario.username}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Insignia rango={usuario.rango_actual} tam={16} />
                  <span style={{ fontSize: 13, color: 'var(--sub)' }}>
                    {T.stats.rachaDe(enDias(usuario.racha_actual))}
                  </span>
                </div>
              </div>
            </div>

            {pedidoPendiente ? (
              <div className="boton-fantasma" style={{ pointerEvents: 'none' }}>
                {T.social.pedidoDeAmistad}
              </div>
            ) : (
              <button className="boton-solido" onClick={pedirAmistad}>
                {T.social.agregar}
              </button>
            )}
            <div className="vacio-cosmico">
              <div className="particulas"><i /><i /><i /><i /></div>
              {T.social.cuandoSeanAmigos}
            </div>
          </>
        ) : (
          <>
            {/* Exactamente lo que esta persona comparte: el mismo componente
                que usa el modo "ver como lo ven los demás" del perfil propio,
                para que la vista previa nunca prometa algo distinto. */}
            <ComoMeVen usuario={usuario} logs={logs} fotos={fotos}>
            {/* ---- reto ---- */}
            {RETOS_LISTOS && (
            <div className="seccion" style={{ marginTop: 20 }}>
              <h3>{T.social.reto}</h3>
              {!reto && (
                <button className="boton-solido" onClick={retar}>
                  {T.social.retarA7}
                </button>
              )}
              {reto?.estado === 'pendiente' && reto.retador === miId && (
                <div className="boton-fantasma" style={{ pointerEvents: 'none' }}>
                  {T.social.retoEnviado}
                </div>
              )}
              {reto?.estado === 'pendiente' && reto.rival === miId && (
                <div className="tarjeta">
                  <p style={{ fontSize: 14, marginBottom: 12 }}>
                    {T.social.teReto(usuario.username)}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="boton-solido" style={{ flex: 1 }} onClick={() => responderReto(true)}>
                      {T.social.acepto}
                    </button>
                    <button className="boton-fantasma" style={{ flex: 1, width: 'auto' }} onClick={() => responderReto(false)}>
                      {T.social.paso}
                    </button>
                  </div>
                </div>
              )}
              {reto?.estado === 'activo' && marcador && (
                <div className="tarjeta">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 34, fontWeight: 200 }}>{marcador.yo}</div>
                      <div style={{ fontSize: 11, color: 'var(--sub)' }}>{T.social.vos}</div>
                    </div>
                    <div style={{ color: 'var(--apagado)', fontSize: 13 }}>vs</div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 34, fontWeight: 200 }}>{marcador.el}</div>
                      <div style={{ fontSize: 11, color: 'var(--sub)' }}>{usuario.username}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--apagado)', textAlign: 'center', marginTop: 8 }}>
                    {T.social.hastaEl(fechaLinda(reto.hasta))}
                  </p>
                </div>
              )}
            </div>
            )}
            </ComoMeVen>

            {/* ---- dejar de ser amigos ---- */}
            <div className="seccion" style={{ marginTop: 30 }}>
              {confirmandoBaja ? (
                <div className="tarjeta">
                  <p style={{ fontSize: 14, marginBottom: 12 }}>
                    {T.social.dejanDeVer}
                    {reto && reto.estado !== 'terminado' ? T.social.yElRetoSeCancela : ''}.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="boton-fantasma" style={{ flex: 1, width: 'auto' }} onClick={eliminarAmigo}>
                      {T.social.eliminar}
                    </button>
                    <button
                      className="boton-fantasma"
                      style={{ flex: 1, width: 'auto' }}
                      onClick={() => setConfirmandoBaja(false)}
                    >
                      {T.general.cancelar}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="boton-texto" onClick={() => setConfirmandoBaja(true)}>
                  {T.social.eliminarDeAmigos}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <Nav />
    </>
  );
}
