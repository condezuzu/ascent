'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { enDias, hoyISO, restarDias } from '@nucleo/fechas';
import { conComa } from '@nucleo/peso';
import { numeroDeRango, planetaDeDia } from '@nucleo/rangos';
import type { Log, UsuarioPublico } from '@nucleo/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import { miniaturas } from '@compartido/album';
import { aceptarAmistad } from '@compartido/ranking';
import { useRefrescoDeFirmadas } from '@compartido/useRefrescoDeFirmadas';
import { plataforma } from '@/plataforma';
import { T } from '@nucleo/textos';
import Medallas from '@/components/Medallas';
import AccionesDeUsuario from '@/components/AccionesDeUsuario';
import { cargarMedallasDeAmigo } from '@compartido/perfil';
import type { Medalla } from '@nucleo/medallas';
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
  // El pedido que me mandó ÉL: el id de la fila, que es con lo que se acepta.
  const [pedidoRecibido, setPedidoRecibido] = useState<string | null>(null);
  // No se pudo preguntar (la red): no es "no existe".
  const [noCargo, setNoCargo] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [fotos, setFotos] = useState<FotoPerfil[]>([]);
  const [medallas, setMedallas] = useState<Medalla[]>([]);
  const [dots, setDots] = useState<number | null>(null);
  const [cargado, setCargado] = useState(false);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [accion, setAccion] = useState(false);

  const cargar = useCallback(async () => {
    // el id viene de la URL: si no es un uuid, ni consultar
    // (interpolarlo en filtros de PostgREST con formato inválido solo da errores)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
      setCargado(true);
      return;
    }
    const user = await miUsuario(supabase);
    if (!user) return;
    if (params.id === user.id) return router.replace('/');
    setMiId(user.id);

    setNoCargo(false);
    const { data: u, error: errUsuario } = await supabase
      .from('usuarios_publicos')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    // NO PODER PREGUNTAR NO ES "NO EXISTE" (4/10): sin señal esto decía "Este
    // usuario no existe", o mostraba a un amigo como si no lo fuera.
    if (errUsuario) {
      setNoCargo(true);
      setCargado(true);
      return;
    }
    if (!u) {
      setCargado(true);
      return;
    }
    setUsuario(u as UsuarioPublico);

    const { data: rel, error: errRelacion } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(solicitante.eq.${user.id},destinatario.eq.${params.id}),and(solicitante.eq.${params.id},destinatario.eq.${user.id})`
      )
      .maybeSingle();
    if (errRelacion) {
      setNoCargo(true);
      setCargado(true);
      return;
    }
    const amigos = rel?.estado === 'aceptada';
    setEsAmigo(amigos);
    // De quién es el pedido: el de él se acepta, el mío se espera.
    setPedidoPendiente(rel?.estado === 'pendiente' && rel.solicitante === user.id);
    setPedidoRecibido(rel?.estado === 'pendiente' && rel.solicitante === params.id ? (rel.id as string) : null);

    if (amigos) {
      // El DOTS del amigo, número crudo. Sale de `ranking_fuerza`, ya gateada a
      // amigos aceptados; solo se pide porque acá ya se confirmó la amistad.
      supabase.rpc('ranking_fuerza').then(({ data }) => {
        const fila = (data as { id: string; dots: number }[] | null)?.find((f) => f.id === params.id);
        setDots(fila && typeof fila.dots === 'number' ? fila.dots : null);
      });
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
        // Las URL enteras y las miniaturas a la vez: la grilla usa la chica.
        const [{ data: firmadas }, chicas] = await Promise.all([
          supabase.storage.from('fotos').createSignedUrls(fs.map((f) => f.storage_path), 3600),
          miniaturas(supabase, fs.map((f) => f.storage_path as string)),
        ]);
        setFotos(
          fs.map((f, i) => ({
            id: f.id,
            url: firmadas?.[i]?.signedUrl ?? '',
            miniatura: chicas[i] ?? undefined,
            fecha: f.log_id ? (mapa.get(f.log_id) ?? null) : null,
          }))
        );
      }
      // Sus medallas, del numero que el dejo escrito: su peso corporal no se
      // ve nunca, ni entre amigos, asi que calcularlas aca es imposible. Van
      // AFUERA del `if` de las fotos: adentro, solo se pedían si el amigo
      // compartía alguna.
      setMedallas(await cargarMedallasDeAmigo(supabase, params.id));
    }
    setCargado(true);
  }, [supabase, params.id, router]);

  // Las fotos del perfil se sirven con URL firmadas que vencen a la hora: se
  // vuelven a pedir antes de que se rompan (ver `useRefrescoDeFirmadas`). Es el
  // caso que ven los amigos: dejan tu perfil abierto y las fotos se rompen.
  const recargar = useRefrescoDeFirmadas(cargar, plataforma.ciclo.alCambiar);
  useEffect(() => {
    recargar();
  }, [recargar]);

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
        <FondoEspacial vacio esquina="centro" velo={0.7} />
        <div className="pantalla" />
        <Nav />
      </>
    );
  }

  if (!usuario) {
    return (
      <>
        <FondoEspacial vacio esquina="centro" velo={0.7} />
        <div className="pantalla">
          <div className="vacio-cosmico">
            <div className="particulas"><i /><i /><i /><i /></div>
            {noCargo ? T.inicio.noCargo : T.social.noExiste}
            {noCargo && (
              <>
                <br />
                <button className="boton-texto" onClick={() => cargar()}>
                  {T.inicio.reintentar}
                </button>
              </>
            )}
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
        rango={numeroDeRango(usuario.racha_actual)}
        planeta={planetaDeDia(usuario.racha_actual)}
        esquina="abajo-derecha"
        velo={0.6}
      />
      {/* Espera también a sus fotos (19/9): ver `FotosQueVen`. */}
      <PantallaDeslizable>
        <button className="boton-texto" style={{ textAlign: 'left', padding: '0 0 14px' }} onClick={() => router.back()}>
          {T.general.volver}
        </button>

        {!esAmigo ? (
          <>
            <div className="cabecera" style={{ marginBottom: 22 }}>
              <Avatar url={usuario.avatar_url} nombre={usuario.username} tam={52} />
              <div>
                {/* SUS MEDALLAS, al lado de su nombre, igual que en el propio. */}
                <Medallas
                  medallas={medallas}
                  tam={20}
                  nombre={<span className="nombre" style={{ fontSize: 18 }}>{usuario.username}</span>}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Insignia rango={numeroDeRango(usuario.racha_actual)} tam={16} />
                  <span style={{ fontSize: 13, color: 'var(--sub)' }}>
                    {T.stats.rachaDe(enDias(usuario.racha_actual))}
                  </span>
                </div>
                {esAmigo && dots !== null && (
                  <div className="yo-dots">
                    <strong>{conComa(String(dots))}</strong> DOTS
                  </div>
                )}
              </div>
            </div>

            {pedidoRecibido ? (
              <button
                className="boton-solido"
                onClick={async () => {
                  if (await aceptarAmistad(supabase, pedidoRecibido)) cargar();
                }}
              >
                {T.social.aceptar}
              </button>
            ) : pedidoPendiente ? (
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
            <ComoMeVen usuario={usuario} logs={logs} fotos={fotos} medallas={medallas} dots={dots} />

            {/* ---- dejar de ser amigos ---- */}
            <div className="seccion" style={{ marginTop: 30 }}>
              {confirmandoBaja ? (
                <div className="tarjeta">
                  <p style={{ fontSize: 14, marginBottom: 12 }}>
                    {T.social.dejanDeVer}.
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

        {/* Denunciar o bloquear: al alcance en el perfil de cualquiera, sea
            amigo o no. Bloquear también sirve para frenar a alguien que
            todavía no es amigo pero insiste con solicitudes. */}
        <div className="seccion" style={{ marginTop: 40, textAlign: 'center' }}>
          <button
            className="boton-texto"
            style={{ color: 'var(--apagado)', fontSize: 13 }}
            onClick={() => setAccion(true)}
          >
            {T.social.denunciarOBloquear}
          </button>
        </div>
      </PantallaDeslizable>

      <AccionesDeUsuario
        usuario={accion ? { id: usuario.id, username: usuario.username } : null}
        onCerrar={() => setAccion(false)}
        onBloqueado={() => router.push('/social')}
      />
      <Nav />
    </>
  );
}
