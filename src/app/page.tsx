'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { hoyISO, restarDias } from '@/lib/fechas';
import { planetaDeDia, progresoEnRango, siguienteRango } from '@/lib/rangos';
import type { Log, Perfil, ResultadoRegistro } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import TiraSemanal from '@/components/TiraSemanal';
import RegistrarSheet from '@/components/RegistrarSheet';
import SubidaRango from '@/components/SubidaRango';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';

type LineaSocial = { username: string; racha: number } | null;

export default function Principal() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [social, setSocial] = useState<LineaSocial>(null);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [subida, setSubida] = useState<{ antes: number; despues: number } | null>(null);
  const [perdida, setPerdida] = useState(false);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!p) return;
    if (!p.username) return router.push('/onboarding');

    // Pérdida de racha: el sistema no explota, se dispersa.
    // Se verifica al abrir; si hubo, el fondo se apaga.
    // p_hoy = fecha LOCAL del usuario (el servidor está en UTC).
    const { data: v } = await supabase.rpc('verificar_perdida', { p_hoy: hoyISO() });
    if (v?.perdida) {
      setPerdida(true);
      const { data: p2 } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setPerfil(p2 ?? p);
    } else {
      setPerfil(p);
    }

    const desde = restarDias(hoyISO(), 6);
    const { data: ls } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('fecha', desde)
      .order('fecha');
    setLogs(ls ?? []);

    // Una sola línea de actividad de un amigo. Una. Con tres se vuelve red social.
    const { data: amistades } = await supabase
      .from('friendships')
      .select('solicitante, destinatario')
      .eq('estado', 'aceptada');
    const amigos = (amistades ?? [])
      .map((a) => (a.solicitante === user.id ? a.destinatario : a.solicitante));
    if (amigos.length > 0) {
      const { data: ultimo } = await supabase
        .from('logs')
        .select('user_id, fecha')
        .in('user_id', amigos)
        .eq('es_descanso', false)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ultimo) {
        const { data: quien } = await supabase
          .from('usuarios_publicos')
          .select('username, racha_actual')
          .eq('id', ultimo.user_id)
          .maybeSingle();
        if (quien) setSocial({ username: quien.username, racha: quien.racha_actual });
      }
    }
    setCargado(true);
  }, [supabase, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!cargado || !perfil) {
    return (
      <>
        <FondoEspacial rango={1} vacio esquina="centro" velo={0.6} />
        <div className="pantalla" />
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
        esquina="abajo-derecha"
      />

      <div className="pantalla">
        <div className="cabecera">
          <Avatar url={perfil.avatar_url} nombre={perfil.username} />
          <span className="nombre">{perfil.username}</span>
        </div>

        <div className="racha-bloque">
          <div className="racha-label">Racha</div>
          <div className="racha-numero">{racha}</div>
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

        {!registradoHoy ? (
          <button className="boton-solido" onClick={() => setHojaAbierta(true)}>
            Registrar día
          </button>
        ) : (
          <div className="boton-fantasma" style={{ pointerEvents: 'none' }}>
            Día registrado
          </div>
        )}

        <TiraSemanal logs={logs} diasDescanso={perfil.dias_descanso} />

        {social && (
          <div className="linea-social">
            <span>
              {social.username} sigue subiendo — {social.racha} días
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
      </div>

      {hojaAbierta && (
        <RegistrarSheet
          racha={racha}
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
