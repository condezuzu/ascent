'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { hoyISO } from '@/lib/fechas';
import { planetaDeDia } from '@/lib/rangos';
import { duracionLinda, desfasajeDelReloj, type SesionViva } from '@/lib/sesiones';
import { borrarSesionCache, guardarSesionCache, leerSesionCache } from '@/lib/sesionCache';
import { estaBloqueado, textoDeBloqueo } from '@/lib/pendiente';
import type { Perfil, ResultadoRegistro } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import Cronometro from '@/components/Cronometro';
import SubidaRango from '@/components/SubidaRango';

/**
 * La sesión, con pantalla propia (§17.6). Empezar pasa una vez por
 * entrenamiento, así que tiene su pestaña; descansar pasa veinte, y para eso
 * está la franja que se ve desde cualquier lado (§17.6b).
 *
 * Acá se hace la consulta de verdad a `mi_sesion` y se reconcilia la caché:
 * es la única pantalla que la pisa, porque es la única donde importa que el
 * estado sea exacto y no aproximado.
 */
export default function Sesion() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [sesion, setSesion] = useState<{ inicio: string; desfasaje: number } | null>(null);
  const [ultima, setUltima] = useState<number | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [subida, setSubida] = useState<{ antes: number; despues: number } | null>(null);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return router.push('/login');
    const [{ data: p }, { data: viva }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.rpc('mi_sesion'),
    ]);
    setPerfil(p ?? null);
    const s = viva as SesionViva | null;
    if (s?.corriendo && s.inicio) {
      const guardada = { inicio: s.inicio, desfasaje: desfasajeDelReloj(s.ahora) };
      setSesion(guardada);
      guardarSesionCache(guardada);
    } else {
      setSesion(null);
      // la base es la autoridad: si acá no hay sesión, la caché mentía
      borrarSesionCache();
    }
    setCargado(true);
  }, [supabase, router]);

  useEffect(() => {
    // la caché primero, para que la pantalla no parpadee mientras llega la red
    setSesion(leerSesionCache());
    cargar();
  }, [cargar]);

  async function empezar() {
    setCambiando(true);
    const { data, error } = await supabase.rpc('iniciar_sesion', { p_hoy: hoyISO() });
    setCambiando(false);
    if (error) return;
    // La sesión se cuelga de un día, así que si la guarda lo frenó no hay
    // sesión que empezar. El día igual quedó anotado (§12b).
    if (estaBloqueado(data)) return setAviso(textoDeBloqueo(data.hasta));
    const r = data as { inicio: string; ahora: string; registro: ResultadoRegistro | null };
    const guardada = { inicio: r.inicio, desfasaje: desfasajeDelReloj(r.ahora) };
    setSesion(guardada);
    guardarSesionCache(guardada);
    setUltima(null);
    // Empezar REGISTRA el día (§17.2): si ese día cruza un umbral, la subida
    // de rango se anima igual que por el camino manual.
    if (r.registro?.subio_rango) {
      setSubida({ antes: r.registro.rango_antes, despues: r.registro.rango_despues });
    }
    cargar();
  }

  async function terminar() {
    setCambiando(true);
    const { data } = await supabase.rpc('terminar_sesion');
    setCambiando(false);
    const r = data as { termino: boolean; segundos?: number } | null;
    setSesion(null);
    borrarSesionCache();
    if (r?.termino && r.segundos) setUltima(r.segundos);
    cargar();
  }

  if (!perfil && !cargado) {
    return (
      <>
        <FondoEspacial rango={1} vacio esquina="centro" velo={0.7} />
        <div className="pantalla" />
        <Nav />
      </>
    );
  }

  return (
    <>
      <FondoEspacial
        rango={perfil?.rango_actual ?? 1}
        planeta={planetaDeDia(perfil?.racha_actual ?? 0)}
        esquina="abajo-derecha"
        velo={0.72}
      />
      <PantallaDeslizable>
        <div className="titulo-pantalla">Sesión</div>

        {sesion ? (
          <Cronometro
            inicio={sesion.inicio}
            desfasaje={sesion.desfasaje}
            terminando={cambiando}
            alTerminar={terminar}
          />
        ) : (
          <>
            {aviso && <p className="ok-msg" style={{ marginBottom: 18 }}>{aviso}</p>}
            {ultima !== null && (
              <p className="ok-msg" style={{ marginBottom: 18 }}>
                Sesión guardada: {duracionLinda(ultima)}.
              </p>
            )}
            <p className="sesion-intro">
              Empezá cuando llegues al gimnasio. El día queda registrado al toque, así que si te
              olvidás de parar el cronómetro no perdés nada — solo la duración.
            </p>
            <button className="boton-solido" onClick={empezar} disabled={cambiando}>
              {cambiando ? 'Un momento…' : 'Empezar sesión'}
            </button>
            <p className="nota-privada">
              Mientras corra vas a tener el tiempo y el botón de descansar en todas las pantallas.
            </p>
          </>
        )}
      </PantallaDeslizable>

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
