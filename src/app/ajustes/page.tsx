'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { DIAS_SEMANA, hoyISO } from '@/lib/fechas';
import { planetaDeDia } from '@/lib/rangos';
import type { Log, Perfil } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import RegistrarSheet from '@/components/RegistrarSheet';
import Avatar from '@/components/Avatar';
import InstalarPWA from '@/components/InstalarPWA';
import Nav from '@/components/Nav';

export default function Ajustes() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [sugerencia, setSugerencia] = useState('');
  const [sugerenciaOk, setSugerenciaOk] = useState(false);
  const [fechaCorregir, setFechaCorregir] = useState('');
  const [hojaCorregir, setHojaCorregir] = useState(false);
  const [ultimos, setUltimos] = useState<Log[]>([]);
  const [recalculando, setRecalculando] = useState(false);
  const [avisoRecalculo, setAvisoRecalculo] = useState('');
  const inputAvatar = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setPerfil(p);
    const { data: ls } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(10);
    setUltimos(ls ?? []);
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Días fijos de descanso semanal. Se deciden antes del día, nunca después:
  // cambiar los descansos no puede salvar una racha ya perdida, porque la
  // verificación de pérdida corre antes en cada apertura.
  async function alternarDescanso(dia: number) {
    if (!perfil) return;
    const nuevos = perfil.dias_descanso.includes(dia)
      ? perfil.dias_descanso.filter((d) => d !== dia)
      : [...perfil.dias_descanso, dia];
    setPerfil({ ...perfil, dias_descanso: nuevos });
    await supabase.from('profiles').update({ dias_descanso: nuevos }).eq('id', perfil.id);
  }

  async function subirAvatar(archivo: File) {
    if (!perfil) return;
    const ext = archivo.name.split('.').pop() || 'jpg';
    const ruta = `${perfil.id}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from('avatares')
      .upload(ruta, archivo, { upsert: true });
    if (error) return;
    const { data } = supabase.storage.from('avatares').getPublicUrl(ruta);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', perfil.id);
    setPerfil({ ...perfil, avatar_url: url });
  }

  async function mandarSugerencia() {
    if (!perfil || !sugerencia.trim()) return;
    const { error } = await supabase.from('feedback').insert({
      user_id: perfil.id,
      texto: sugerencia.trim(),
      tipo: 'idea',
      version_app: '0.1.0',
      plataforma: navigator.userAgent.includes('Android')
        ? 'android'
        : /iPhone|iPad/.test(navigator.userAgent)
          ? 'ios'
          : 'web',
      pantalla_origen: 'ajustes',
    });
    if (!error) {
      setSugerencia('');
      setSugerenciaOk(true);
      setTimeout(() => setSugerenciaOk(false), 3500);
    }
  }

  async function borrarDia(id: string) {
    await supabase.from('logs').delete().eq('id', id);
    cargar();
  }

  // El RPC recalcula y aplica la pérdida en la misma transacción: el número
  // que mostramos acá es el final, no rebota al recargar.
  async function recalcular() {
    setRecalculando(true);
    setAvisoRecalculo('');
    const { data, error } = await supabase.rpc('recalcular_desde_cero', { p_hoy: hoyISO() });
    setRecalculando(false);
    if (error) return setAvisoRecalculo('No se pudo recalcular. Probá de nuevo.');
    const r = data as { racha: number; perdida: boolean };
    setAvisoRecalculo(
      r.perdida
        ? `Tu historial da ${r.racha} días: está cortado, así que se aplicó el descuento.`
        : `Listo: ${r.racha} días.`
    );
    cargar();
  }

  async function salir() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (!perfil) {
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
        rango={perfil.rango_actual}
        planeta={planetaDeDia(perfil.racha_actual)}
        esquina="arriba-derecha"
        velo={0.74}
      />
      <div className="pantalla">
        <div className="titulo-pantalla">Ajustes</div>

        <div className="seccion">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => inputAvatar.current?.click()} style={{ padding: 0 }}>
              <Avatar url={perfil.avatar_url} nombre={perfil.username} tam={52} />
            </button>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{perfil.username}</div>
              <button
                className="boton-texto"
                style={{ padding: 0, textAlign: 'left', fontSize: 12 }}
                onClick={() => inputAvatar.current?.click()}
              >
                Cambiar foto
              </button>
            </div>
          </div>
          <input
            ref={inputAvatar}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && subirAvatar(e.target.files[0])}
          />
        </div>

        <div className="seccion">
          <h3>Días de descanso</h3>
          <div className="dias-selector">
            {DIAS_SEMANA.map((d, i) => (
              <button
                key={i}
                className={perfil.dias_descanso.includes(i) ? 'activo' : ''}
                onClick={() => alternarDescanso(i)}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="nota-privada" style={{ marginTop: 8 }}>
            Esos días la racha no se corta aunque no registres.
          </p>
        </div>

        <div className="seccion">
          <h3>Corregir días</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="date"
              value={fechaCorregir}
              max={hoyISO()}
              onChange={(e) => setFechaCorregir(e.target.value)}
            />
            <button
              className="boton-fantasma"
              style={{ width: 'auto', whiteSpace: 'nowrap' }}
              onClick={() => fechaCorregir && setHojaCorregir(true)}
            >
              Registrar
            </button>
          </div>
          {ultimos.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {ultimos.map((l) => (
                <div className="fila" key={l.id}>
                  <span className="nombre" style={{ fontSize: 13, color: 'var(--sub)' }}>
                    {l.fecha} {l.es_descanso ? '· descanso' : ''}
                    {l.planeta_del_dia ? ` · ${l.planeta_del_dia}` : ''}
                  </span>
                  <button
                    className="boton-texto"
                    style={{ width: 'auto', fontSize: 12 }}
                    onClick={() => borrarDia(l.id)}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            className="boton-texto"
            onClick={recalcular}
            disabled={recalculando}
            style={{ marginTop: 4 }}
          >
            {recalculando ? 'Recalculando…' : 'Recalcular racha desde el historial'}
          </button>
          {avisoRecalculo && <p className="ok-msg">{avisoRecalculo}</p>}
        </div>

        <div className="seccion">
          <h3>Buzón</h3>
          <textarea
            rows={3}
            placeholder="¿Algo anda mal? ¿Se te ocurrió algo? Contá acá."
            value={sugerencia}
            onChange={(e) => setSugerencia(e.target.value)}
          />
          <button className="boton-fantasma" style={{ marginTop: 8 }} onClick={mandarSugerencia}>
            Mandar
          </button>
          {sugerenciaOk && <p className="ok-msg">Llegó. Gracias.</p>}
        </div>

        <InstalarPWA />

        <div className="seccion">
          <button className="boton-texto" onClick={() => router.push('/nueva-clave')}>
            Cambiar contraseña
          </button>
          <button className="boton-texto" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {hojaCorregir && (
        <RegistrarSheet
          racha={perfil.racha_actual}
          fecha={fechaCorregir}
          alCerrar={() => setHojaCorregir(false)}
          alConfirmar={() => {
            setHojaCorregir(false);
            cargar();
          }}
        />
      )}
      <Nav />
    </>
  );
}
