'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearCliente } from '@/lib/supabase/client';
import { DIAS_SEMANA, enDias, hoyISO } from '@/lib/fechas';
import { planetaDeDia } from '@/lib/rangos';
import { borrarPerfilCache } from '@/lib/cache';
import type { Log, Perfil } from '@/lib/tipos';
import FondoEspacial from '@/components/FondoEspacial';
import Avatar from '@/components/Avatar';
import CalendarioCorregir from '@/components/CalendarioCorregir';
import InstalarPWA from '@/components/InstalarPWA';
import Nav from '@/components/Nav';

export default function Ajustes() {
  const router = useRouter();
  const [supabase] = useState(() => crearCliente());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [sugerencia, setSugerencia] = useState('');
  const [sugerenciaOk, setSugerenciaOk] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [avisoRecalculo, setAvisoRecalculo] = useState('');
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);
  const [avisoAvatar, setAvisoAvatar] = useState('');
  const inputAvatar = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setPerfil(p);
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Días fijos de descanso semanal. El cambio rige DESDE HOY hacia adelante:
  // el pasado queda con la configuración que estaba vigente entonces, así que
  // cambiar de rutina nunca hace perder rachas ya ganadas.
  async function alternarDescanso(dia: number) {
    if (!perfil) return;
    const nuevos = perfil.dias_descanso.includes(dia)
      ? perfil.dias_descanso.filter((d) => d !== dia)
      : [...perfil.dias_descanso, dia];
    setPerfil({ ...perfil, dias_descanso: nuevos });
    const { error } = await supabase.rpc('fijar_descansos', {
      p_dias: nuevos,
      p_hoy: hoyISO(),
    });
    if (error) cargar(); // no se guardó: se vuelve a lo que dice la base
  }

  async function subirAvatar(archivo: File) {
    if (!perfil) return;
    setAvisoAvatar('');
    if (!archivo.type.startsWith('image/')) {
      return setAvisoAvatar('Eso no parece una imagen.');
    }
    if (archivo.size > 5 * 1024 * 1024) {
      return setAvisoAvatar('La imagen pesa más de 5 MB. Probá con una más liviana.');
    }
    setSubiendoAvatar(true);
    const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase();
    const ruta = `${perfil.id}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from('avatares')
      .upload(ruta, archivo, { upsert: true, contentType: archivo.type });
    if (error) {
      setSubiendoAvatar(false);
      return setAvisoAvatar('No se pudo subir la foto. Probá de nuevo.');
    }
    // ?v= para que el navegador no siga mostrando la anterior desde su caché
    const { data } = supabase.storage.from('avatares').getPublicUrl(ruta);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    const { error: errPerfil } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', perfil.id);
    setSubiendoAvatar(false);
    if (errPerfil) return setAvisoAvatar('La foto subió pero no se pudo guardar. Probá de nuevo.');
    setPerfil({ ...perfil, avatar_url: url });
    setAvisoAvatar('Foto actualizada.');
    setTimeout(() => setAvisoAvatar(''), 3000);
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
        ? `Tu historial da ${enDias(r.racha)}: está cortado, así que se aplicó el descuento.`
        : `Listo: ${enDias(r.racha)}.`
    );
    cargar();
  }

  async function salir() {
    borrarPerfilCache(); // que la próxima cuenta no vea la racha de esta
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
                disabled={subiendoAvatar}
              >
                {subiendoAvatar
                  ? 'Subiendo…'
                  : perfil.avatar_url
                    ? 'Cambiar foto'
                    : 'Poner una foto'}
              </button>
            </div>
          </div>
          {avisoAvatar && (
            <p className={avisoAvatar === 'Foto actualizada.' ? 'ok-msg' : 'error-msg'}>
              {avisoAvatar}
            </p>
          )}
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
            Esos días la racha no se corta aunque no registres. El cambio vale de hoy en
            adelante: lo que ya pasó queda como estaba.
          </p>
        </div>

        <div className="seccion">
          <h3>Corregir días</h3>
          <CalendarioCorregir alCambiar={cargar} />
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
          <h3>Sugerencias</h3>
          <textarea
            rows={3}
            placeholder="¿Algo anda mal? ¿Se te ocurrió algo? Contá acá."
            value={sugerencia}
            onChange={(e) => setSugerencia(e.target.value)}
          />
          <button className="boton-fantasma" style={{ marginTop: 8 }} onClick={mandarSugerencia}>
            Mandar
          </button>
          {sugerenciaOk && (
            <p className="ok-msg">Gracias por tu opinión, la leo yo mismo.</p>
          )}
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

      <Nav />
    </>
  );
}
